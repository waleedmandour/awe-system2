/**
 * AWE System — LTI 1.3 JWT Utilities
 *
 * Handles creation and validation of JWTs for LTI 1.3 flows:
 *   1. OIDC Authorization Request (state + nonce JWT)
 *   2. LTI Launch id_token verification
 *   3. Deep Linking response JWT
 *   4. OAuth2 client_assertion for AGS token exchange
 */

import { SignJWT, jwtVerify } from 'jose';
import { getPrivateKey, getKeyId, verifyJWTWithJWKS } from './keys';
import { getToolURL, getLTIPlatformConfig } from './config';
import type { LTILaunchClaims } from './types';

// ─── OIDC State Management ────────────────────────────────────────────────────

/** State payload stored in the state JWT (sent during OIDC login). */
interface OIDCStatePayload {
  /** The nonce that must appear in the id_token response. */
  nonce: string;
  /** The platform issuer. */
  issuer: string;
  /** When this state was created. */
  iat: number;
  /** When this state expires (5 minutes from creation). */
  exp: number;
}

/**
 * Create a signed state JWT for the OIDC Authorization Request.
 * The state JWT encodes the nonce so it survives the redirect flow.
 */
export async function createStateJWT(nonce: string, issuer: string): Promise<string> {
  const privateKey = await getPrivateKey();
  const kid = getKeyId();
  const toolURL = getToolURL();

  return new SignJWT({
    nonce,
    issuer,
    iat: Math.floor(Date.now() / 1000),
  })
    .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
    .setIssuer(toolURL)
    .setSubject('lti-state')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

/**
 * Verify a state JWT returned from the platform during OIDC flow.
 * Returns the nonce if valid.
 */
export async function verifyStateJWT(stateJWT: string): Promise<{ nonce: string; issuer: string }> {
  const privateKey = await getPrivateKey();
  // We use our own key to verify state JWTs (we signed them)
  const publicKey = await getPrivateKey();

  const { payload } = await jwtVerify(stateJWT, publicKey, {
    algorithms: ['RS256'],
  });

  if (!payload.nonce || !payload.issuer) {
    throw new Error('Invalid LTI state JWT: missing nonce or issuer');
  }

  return {
    nonce: payload.nonce as string,
    issuer: payload.issuer as string,
  };
}

// ─── LTI Launch id_token Verification ────────────────────────────────────────

/**
 * Verify and decode an LTI 1.3 id_token JWT from the platform.
 *
 * Validates:
 *   - JWT signature against platform's JWKS
 *   - Audience matches our client_id
 *   - nonce matches our stored state
 *   - Required LTI claims are present
 *   - Token is not expired
 */
export async function verifyLTILaunchToken(
  idToken: string,
  expectedNonce: string
): Promise<LTILaunchClaims> {
  const platformConfig = getLTIPlatformConfig();
  if (!platformConfig) {
    throw new Error('LTI platform not configured');
  }

  // Verify the JWT against the platform's JWKS
  const { payload } = await verifyJWTWithJWKS(
    idToken,
    platformConfig.jwksEndpoint,
    platformConfig.clientId
  );

  // Verify nonce
  const nonce = payload.nonce as string;
  if (nonce !== expectedNonce) {
    throw new Error(`LTI nonce mismatch: expected ${expectedNonce}, got ${nonce}`);
  }

  // Verify issuer
  const iss = payload.iss as string;
  if (iss !== platformConfig.issuer) {
    throw new Error(`LTI issuer mismatch: expected ${platformConfig.issuer}, got ${iss}`);
  }

  // Verify LTI version
  const ltiVersion = payload['https://purl.imsglobal.org/spec/lti/claim/version'] as string;
  if (ltiVersion !== '1.3.0') {
    throw new Error(`Unsupported LTI version: ${ltiVersion}`);
  }

  // Verify message type
  const messageType = payload['https://purl.imsglobal.org/spec/lti/claim/message_type'] as string;
  if (messageType !== 'LtiResourceLinkRequest' && messageType !== 'LtiDeepLinkingRequest') {
    throw new Error(`Unsupported LTI message type: ${messageType}`);
  }

  return payload as unknown as LTILaunchClaims;
}

// ─── Deep Linking Response JWT ────────────────────────────────────────────────

/**
 * Create a Deep Linking response JWT to send content items
 * back to the platform (Moodle).
 */
export async function createDeepLinkingJWT(
  deploymentId: string,
  contentItems: Array<{
    type: 'ltiResourceLink';
    title: string;
    url: string;
    lineItem?: { scoreMaximum: number; label: string };
    custom?: Record<string, unknown>;
  }>,
  deepLinkingSettings: {
    deep_link_return_url: string;
    data?: string;
  }
): Promise<string> {
  const privateKey = await getPrivateKey();
  const kid = getKeyId();
  const toolURL = getToolURL();
  const platformConfig = getLTIPlatformConfig();

  const now = Math.floor(Date.now() / 1000);

  const jwtItems = contentItems.map(item => {
    const result: Record<string, unknown> = {
      type: item.type,
      title: item.title,
      url: item.url,
    };
    if (item.lineItem) {
      result.lineItem = item.lineItem;
    }
    if (item.custom) {
      result.custom = item.custom;
    }
    return result;
  });

  const payload: Record<string, unknown> = {
    iss: toolURL,
    aud: platformConfig?.issuer,
    exp: now + 300,
    iat: now,
    nonce: crypto.randomUUID(),
    'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': deploymentId,
    'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': jwtItems,
  };

  if (deepLinkingSettings.data) {
    payload['https://purl.imsglobal.org/spec/lti-dl/claim/data'] = deepLinkingSettings.data;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
    .sign(privateKey);
}

// ─── OAuth2 Client Assertion ──────────────────────────────────────────────────

/**
 * Create a client_assertion JWT for OAuth2 token exchange.
 * Used when obtaining an access token for AGS grade passback.
 */
export async function createClientAssertionJWT(
  tokenEndpoint: string
): Promise<string> {
  const privateKey = await getPrivateKey();
  const kid = getKeyId();
  const toolURL = getToolURL();
  const platformConfig = getLTIPlatformConfig();

  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    iss: toolURL,
    sub: platformConfig?.clientId,
    aud: tokenEndpoint,
    iat: now,
    exp: now + 60,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
    .sign(privateKey);
}
