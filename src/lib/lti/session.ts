/**
 * AWE System — LTI 1.3 Session Management
 *
 * Manages LTI sessions using httpOnly cookies. After a successful LTI launch,
 * the session data is serialized, HMAC-signed, and stored in a cookie.
 * This allows the session to survive page navigations without server-side
 * session storage.
 *
 * Security:
 *   - Session data is HMAC-SHA256 signed to prevent tampering
 *   - Cookie is httpOnly (not accessible from JavaScript)
 *   - Cookie uses SameSite=None for cross-origin LTI launches
 *   - Cookie is Secure (HTTPS only)
 *   - Session expires after 4 hours
 */

import type { LTISession, LTILaunchClaims, AGSScope } from './types';
import { LTI_SESSION_CONFIG, getLTIPlatformConfig } from './config';

/**
 * Create an LTI session from verified LTI launch claims.
 */
export function createLTISession(claims: LTILaunchClaims): LTISession {
  const platformConfig = getLTIPlatformConfig();

  const agsClaim = claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];
  const resourceLink = claims['https://purl.imsglobal.org/spec/lti/claim/resource_link'];
  const context = claims['https://purl.imsglobal.org/spec/lti/claim/context'];

  const session: LTISession = {
    issuer: claims.iss,
    clientId: platformConfig?.clientId || '',
    deploymentId: claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
    userId: claims.sub,
    userName: claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(' ') || 'Student',
    userEmail: claims.email,
    roles: claims['https://purl.imsglobal.org/spec/lti/claim/roles'] || [],
    resourceLinkId: resourceLink.id,
    resourceLinkTitle: resourceLink.title,
    contextId: context?.id || '',
    contextTitle: context?.title || '',
    agsLineitemsUrl: agsClaim?.lineitems,
    agsLineitemUrl: agsClaim?.lineitem,
    agsScopes: agsClaim?.scope || [],
    nrpsUrl: claims['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice']?.context_memberships_url,
    createdAt: Date.now(),
    signature: '', // Will be set by signSession
  };

  return session;
}

/**
 * Sign an LTI session with HMAC-SHA256.
 * Adds the signature field to the session object.
 */
export async function signSession(session: LTISession): Promise<LTISession> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    throw new Error('AUTH_SECRET environment variable is required for LTI session signing');
  }

  // Create a copy without the signature for signing
  const { signature: _, ...sessionData } = session;
  const dataToSign = JSON.stringify(sessionData);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToSign));
  const signature = arrayBufferToBase64Url(signatureBytes);

  return { ...session, signature };
}

/**
 * Verify an LTI session's HMAC signature.
 * Returns true if the signature is valid.
 */
export async function verifySession(session: LTISession): Promise<boolean> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) return false;

  const { signature: providedSignature, ...sessionData } = session;
  const dataToSign = JSON.stringify(sessionData);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBytes = base64UrlToArrayBuffer(providedSignature);
  return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(dataToSign));
}

/**
 * Serialize an LTI session to a string for cookie storage.
 */
export function serializeSession(session: LTISession): string {
  return Buffer.from(JSON.stringify(session)).toString('base64url');
}

/**
 * Deserialize an LTI session from a cookie string.
 */
export function deserializeSession(cookieValue: string): LTISession | null {
  try {
    const json = Buffer.from(cookieValue, 'base64url').toString('utf-8');
    return JSON.parse(json) as LTISession;
  } catch {
    return null;
  }
}

/**
 * Validate an LTI session (check expiry and signature).
 */
export async function validateSession(session: LTISession): Promise<{ valid: boolean; reason?: string }> {
  // Check expiry (4 hours)
  const age = Date.now() - session.createdAt;
  if (age > LTI_SESSION_CONFIG.maxAge * 1000) {
    return { valid: false, reason: 'Session expired' };
  }

  // Verify signature
  const isValid = await verifySession(session);
  if (!isValid) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Check if a user has an instructor/teacher role.
 */
export function isInstructor(session: LTISession): boolean {
  const instructorRoles = [
    'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Instructor',
    'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Staff',
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
    'http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#Instructor',
    'http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper',
    'http://purl.imsglobal.org/vocab/lis/v2/system/person#Administrator',
  ];

  return session.roles.some(role => instructorRoles.includes(role));
}

/**
 * Check if AGS grade passback is available for this session.
 */
export function hasAGS(session: LTISession): boolean {
  return (
    (session.agsLineitemsUrl || session.agsLineitemUrl) !== undefined &&
    session.agsScopes.includes('https://purl.imsglobal.org/spec/lti-ags/scope/score')
  );
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
