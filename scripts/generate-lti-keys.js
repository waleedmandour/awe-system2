#!/usr/bin/env node

/**
 * LTI 1.3 RSA Key Pair Generator
 *
 * Generates an RSA 2048-bit key pair for LTI 1.3 JWT signing.
 * Outputs:
 *   1. Private key in PEM format → add to .env as LTI_PRIVATE_KEY
 *   2. Public key in PEM format → for reference only
 *   3. JWKS JSON → for verification (also served by /api/lti/jwks)
 *
 * Usage:
 *   node scripts/generate-lti-keys.js
 *
 * The private key MUST be kept secret. Never commit it to version control.
 */

const { generateKeyPairSync } = require('crypto');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  iAWE LTI 1.3 — RSA Key Pair Generator');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();

// Generate RSA key pair
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

// Output private key for .env
console.log('── Private Key (add to .env as LTI_PRIVATE_KEY) ──────────────');
console.log();
console.log('LTI_PRIVATE_KEY=' + JSON.stringify(privateKey));
console.log();

// Output public key (for reference)
console.log('── Public Key (for reference only) ───────────────────────────');
console.log();
console.log(publicKey);
console.log();

// Output key ID
const kid = 'awe-lti-key-1';
console.log('── Key ID (add to .env as LTI_KEY_ID, optional) ─────────────');
console.log();
console.log(`LTI_KEY_ID=${kid}`);
console.log();

// Instructions
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Setup Instructions');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log();
console.log('1. Copy the LTI_PRIVATE_KEY value above (the JSON-quoted PEM string)');
console.log('2. Add it to your .env file:');
console.log('   LTI_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."');
console.log();
console.log('3. Add the other required LTI environment variables:');
console.log('   LTI_ISSUER=https://elearnt.squ.edu.om');
console.log('   LTI_CLIENT_ID=<from Moodle admin>');
console.log('   LTI_AUTH_ENDPOINT=https://elearnt.squ.edu.om/mod/lti/auth.php');
console.log('   LTI_TOKEN_ENDPOINT=https://elearnt.squ.edu.om/mod/lti/token.php');
console.log('   LTI_JWKS_ENDPOINT=https://elearnt.squ.edu.om/mod/lti/certs.php');
console.log('   LTI_TOOL_URL=https://your-awe-app.vercel.app');
console.log();
console.log('4. Restart the application for the new env vars to take effect.');
console.log();
console.log('5. Verify the JWKS endpoint is accessible:');
console.log('   curl https://your-awe-app.vercel.app/api/lti/jwks');
console.log();
console.log('⚠️  IMPORTANT: Keep the private key secret! Never commit it to git.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
