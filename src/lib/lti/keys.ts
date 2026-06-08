/**
 * AWE System — LTI 1.3 RSA Key Management
 *
 * Manages the tool's RSA key pair for:
 *   1. Signing outgoing JWTs (OIDC auth requests, Deep Linking responses)
 *   2. Serving the public key via the JWKS endpoint
 *
 * Key storage:
 *   - Private key: PEM format stored in LTI_PRIVATE_KEY environment variable
 *   - Public key: Derived from the private key at runtime
 *   - JWKS: Computed on first request and cached in memory
 *
 * Key generation:
 *   Run `node scripts/generate-lti-keys.js` to generate a new key pair.
 *   The script outputs the PEM private key (for .env) and JWKS JSON.
 */

import { importPKCS8, exportJWK, jwtVerify, createLocalJWKSet } from 'jose';
import { getLTIPrivateKey, getLTIKeyId, isLTIConfigured } from './config';

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

let cachedPrivateKey: CryptoKey | null = null;
let cachedPublicJWK: Record<string, unknown> | null = null;
let cachedJWKS: { keys: Record<string, unknown>[] } | null = null;

/**
 * Import the RSA private key from PEM format.
 * Caches the CryptoKey object for reuse.
 */
export async function getPrivateKey(): Promise<CryptoKey> {
  if (cachedPrivateKey) return cachedPrivateKey;

  if (!isLTIConfigured()) {
    throw new Error('LTI is not configured. Set LTI_PRIVATE_KEY and other LTI_* env vars.');
  }

  const pem = getLTIPrivateKey();
  try {
    cachedPrivateKey = await importPKCS8(pem, 'RS256');
    return cachedPrivateKey;
  } catch (error) {
    throw new Error(
      `Failed to import LTI private key. Ensure LTI_PRIVATE_KEY is a valid RSA PEM. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the public JWK derived from the tool's private key.
 * Used for the JWKS endpoint.
 */
export async function getPublicJWK(): Promise<Record<string, unknown>> {
  if (cachedPublicJWK) return cachedPublicJWK;

  const privateKey = await getPrivateKey();
  const jwk = await exportJWK(privateKey);

  // Add required JWK metadata
  const kid = getLTIKeyId();
  cachedPublicJWK = {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    alg: 'RS256',
    use: 'sig',
    kid,
  };

  return cachedPublicJWK;
}

/**
 * Get the full JWKS (JSON Web Key Set) for the JWKS endpoint.
 * Returns: { keys: [publicJWK] }
 */
export async function getJWKS(): Promise<{ keys: Record<string, unknown>[] }> {
  if (cachedJWKS) return cachedJWKS;

  const publicJWK = await getPublicJWK();
  cachedJWKS = { keys: [publicJWK] };
  return cachedJWKS;
}

/**
 * Get the key ID (kid) for JWT headers.
 */
export function getKeyId(): string {
  return getLTIKeyId();
}

/**
 * Verify a JWT using the platform's JWKS endpoint.
 * Used to validate id_tokens from the LTI platform (Moodle).
 */
export async function verifyJWTWithJWKS(
  jwt: string,
  jwksEndpoint: string,
  expectedAudience: string
): Promise<{ payload: Record<string, unknown> }> {
  // Fetch platform JWKS
  const response = await fetch(jwksEndpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch platform JWKS from ${jwksEndpoint}: ${response.status}`);
  }
  const jwks = await response.json();

  // Create a local JWK set for verification
  const localJWKSet = createLocalJWKSet(jwks);

  // Verify the JWT
  const { payload } = await jwtVerify(jwt, localJWKSet, {
    audience: expectedAudience,
    algorithms: ['RS256'],
  });

  return { payload: payload as Record<string, unknown> };
}

/**
 * Clear the cached keys (useful for testing or key rotation).
 */
export function clearKeyCache(): void {
  cachedPrivateKey = null;
  cachedPublicJWK = null;
  cachedJWKS = null;
}
