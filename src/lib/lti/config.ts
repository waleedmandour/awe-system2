/**
 * AWE System — LTI 1.3 Configuration
 *
 * Reads all LTI-related configuration from environment variables and provides
 * a validated, typed configuration object. Supports multiple platform
 * registrations (e.g., production + staging Moodle instances).
 *
 * Environment Variables:
 *   LTI_ISSUER            — Platform issuer URL (Moodle base URL)
 *   LTI_CLIENT_ID         — OAuth2 client ID assigned by the platform
 *   LTI_AUTH_ENDPOINT     — Platform OIDC authorization endpoint
 *   LTI_TOKEN_ENDPOINT    — Platform OAuth2 token endpoint
 *   LTI_JWKS_ENDPOINT     — Platform JWKS endpoint for id_token verification
 *   LTI_DEPLOYMENT_ID     — Deployment ID (optional, defaults to "1")
 *   LTI_PRIVATE_KEY       — RSA private key in PEM format (tool's signing key)
 *   LTI_KEY_ID            — Key ID for the JWKS kid claim (optional)
 *   LTI_TOOL_URL          — Base URL of the AWE tool (e.g., "https://iawe.space-z.ai")
 */

import type { LTIPlatformConfig } from './types';

/** Get a required environment variable or throw. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Get an optional environment variable with a default. */
function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Load the primary LTI platform configuration from environment variables.
 * Returns null if LTI is not configured (LTI_ISSUER not set).
 */
export function getLTIPlatformConfig(): LTIPlatformConfig | null {
  const issuer = process.env.LTI_ISSUER;
  if (!issuer) return null;

  return {
    id: 'moodle-primary',
    issuer: issuer.replace(/\/+$/, ''), // remove trailing slash
    clientId: requireEnv('LTI_CLIENT_ID'),
    authEndpoint: requireEnv('LTI_AUTH_ENDPOINT'),
    tokenEndpoint: requireEnv('LTI_TOKEN_ENDPOINT'),
    jwksEndpoint: requireEnv('LTI_JWKS_ENDPOINT'),
    deploymentIds: optionalEnv('LTI_DEPLOYMENT_ID', '1').split(',').map(s => s.trim()),
  };
}

/**
 * Get the tool's base URL.
 * This is used to construct redirect URIs and launch URLs.
 */
export function getToolURL(): string {
  const toolUrl = process.env.LTI_TOOL_URL;
  if (!toolUrl) {
    // In development, use localhost
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:3000';
    }
    throw new Error('LTI_TOOL_URL environment variable is required in production');
  }
  return toolUrl.replace(/\/+$/, '');
}

/**
 * Get the RSA private key PEM for signing JWTs.
 * The corresponding public key is served via the JWKS endpoint.
 */
export function getLTIPrivateKey(): string {
  return requireEnv('LTI_PRIVATE_KEY');
}

/**
 * Get the key ID for the JWKS kid claim.
 * If not set, defaults to "awe-lti-key-1".
 */
export function getLTIKeyId(): string {
  return optionalEnv('LTI_KEY_ID', 'awe-lti-key-1');
}

/**
 * Check if LTI integration is fully configured.
 */
export function isLTIConfigured(): boolean {
  return !!(
    process.env.LTI_ISSUER &&
    process.env.LTI_CLIENT_ID &&
    process.env.LTI_AUTH_ENDPOINT &&
    process.env.LTI_TOKEN_ENDPOINT &&
    process.env.LTI_JWKS_ENDPOINT &&
    process.env.LTI_PRIVATE_KEY
  );
}

/**
 * LTI 1.3 standard URL paths for the tool.
 * These are the endpoints the platform (Moodle) needs to register.
 */
export const LTI_ROUTES = {
  /** OIDC login initiation URL. */
  login: '/api/lti/login',
  /** LTI launch URL (receives id_token POST). */
  launch: '/api/lti/launch',
  /** JWKS URL (serves public key for JWT verification). */
  jwks: '/api/lti/jwks',
  /** Grade passback API (internal — called from assessment results). */
  grades: '/api/lti/grades',
  /** Deep linking return URL. */
  deepLink: '/api/lti/deep-link',
  /** Student-facing LTI launch page. */
  launchPage: '/lti/launch',
} as const;

/**
 * Get all tool URLs for a given base URL.
 * Useful for providing to the Moodle admin during setup.
 */
export function getToolURLs(baseURL?: string): Record<string, string> {
  const base = baseURL || getToolURL();
  return {
    loginInitiationURL: `${base}${LTI_ROUTES.login}`,
    redirectionURI: `${base}${LTI_ROUTES.launch}`,
    jwksURL: `${base}${LTI_ROUTES.jwks}`,
    deepLinkingURL: `${base}${LTI_ROUTES.deepLink}`,
    launchPageURL: `${base}${LTI_ROUTES.launchPage}`,
  };
}

/**
 * Known Moodle LTI 1.3 endpoint patterns.
 * Used for auto-configuring platform endpoints from the issuer URL.
 */
export function getMoodleEndpoints(issuerURL: string): {
  authEndpoint: string;
  tokenEndpoint: string;
  jwksEndpoint: string;
} {
  const base = issuerURL.replace(/\/+$/, '');
  return {
    authEndpoint: `${base}/mod/lti/auth.php`,
    tokenEndpoint: `${base}/mod/lti/token.php`,
    jwksEndpoint: `${base}/mod/lti/certs.php`,
  };
}

/**
 * LTI session cookie configuration.
 */
export const LTI_SESSION_CONFIG = {
  cookieName: 'awe-lti-session',
  maxAge: 4 * 60 * 60, // 4 hours
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const, // Required for cross-origin LTI launches
  path: '/',
} as const;

/**
 * AWE course code mapping for LTI resource link selection.
 * Maps Moodle course categories to AWE course codes.
 */
export const LTI_COURSE_MAP: Record<string, { code: string; name: string }> = {
  '0230': { code: '0230', name: 'English Language Foundation I' },
  '0340': { code: '0340', name: 'English Language Foundation II' },
  'lanc2160': { code: 'LANC2160', name: 'Academic English: Summary Writing' },
  'lanc1070': { code: 'LANC1070', name: 'Academic English: Synthesis Writing' },
  'lanc2070': { code: 'LANC2070', name: 'Academic English: Report Writing' },
} as const;
