/**
 * AWE System — LTI 1.3 JWKS Endpoint
 *
 * GET /api/lti/jwks
 *
 * Serves the tool's public key in JWKS (JSON Web Key Set) format.
 * The platform (Moodle) fetches this endpoint to verify JWTs signed
 * by the tool (state JWTs, Deep Linking responses, client_assertions).
 *
 * Response format:
 *   {
 *     "keys": [
 *       {
 *         "kty": "RSA",
 *         "n": "<modulus>",
 *         "e": "<exponent>",
 *         "alg": "RS256",
 *         "use": "sig",
 *         "kid": "awe-lti-key-1"
 *       }
 *     ]
 *   }
 *
 * Reference: https://www.imsglobal.org/spec/lti/v1p3/#tool-jwks-endpoint
 */

import { NextResponse } from 'next/server';
import { getJWKS } from '@/lib/lti/keys';
import { isLTIConfigured } from '@/lib/lti/config';

export async function GET() {
  try {
    if (!isLTIConfigured()) {
      return NextResponse.json(
        { error: 'LTI is not configured' },
        { status: 503 }
      );
    }

    const jwks = await getJWKS();

    return NextResponse.json(jwks, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('JWKS endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to serve JWKS' },
      { status: 500 }
    );
  }
}
