/**
 * AWE System — LTI 1.3 Launch Handler
 *
 * POST /api/lti/launch
 *
 * Receives the id_token from the platform (Moodle) after OIDC authentication.
 * Validates the JWT, creates an LTI session, and redirects the user to
 * the LTI launch page with the session cookie set.
 *
 * Flow:
 *   1. Moodle POSTs id_token + state to this endpoint
 *   2. AWE verifies state JWT (extracts nonce)
 *   3. AWE verifies id_token JWT against platform's JWKS
 *   4. AWE creates LTI session from claims
 *   5. AWE signs session, sets cookie, redirects to /lti/launch
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyStateJWT, verifyLTILaunchToken } from '@/lib/lti/jwt';
import { createLTISession, signSession, serializeSession } from '@/lib/lti/session';
import { LTI_SESSION_CONFIG, LTI_ROUTES, getToolURL, isLTIConfigured } from '@/lib/lti/config';

export async function POST(request: NextRequest) {
  try {
    // ── Check LTI is configured ──────────────────────────────────────────
    if (!isLTIConfigured()) {
      return NextResponse.json(
        { error: 'LTI integration is not configured on this server.' },
        { status: 500 }
      );
    }

    // ── Parse form data (LTI uses form_post response mode) ───────────────
    const contentType = request.headers.get('content-type') || '';
    let idToken: string | null = null;
    let state: string | null = null;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      idToken = formData.get('id_token') as string;
      state = formData.get('state') as string;
    } else {
      // Fallback for JSON body (testing)
      const body = await request.json();
      idToken = body.id_token;
      state = body.state;
    }

    if (!idToken || !state) {
      return NextResponse.json(
        { error: 'Missing required parameters: id_token, state' },
        { status: 400 }
      );
    }

    // ── Verify state JWT ─────────────────────────────────────────────────
    let expectedNonce: string;
    try {
      const stateData = await verifyStateJWT(state);
      expectedNonce = stateData.nonce;
    } catch (error) {
      console.error('LTI state verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid or expired LTI state. Please relaunch the assignment.' },
        { status: 403 }
      );
    }

    // ── Verify id_token JWT ──────────────────────────────────────────────
    let claims;
    try {
      claims = await verifyLTILaunchToken(idToken, expectedNonce);
    } catch (error) {
      console.error('LTI id_token verification failed:', error);
      return NextResponse.json(
        { error: 'LTI launch verification failed. Please relaunch the assignment.' },
        { status: 403 }
      );
    }

    // ── Determine message type ───────────────────────────────────────────
    const messageType = claims['https://purl.imsglobal.org/spec/lti/claim/message_type'];

    if (messageType === 'LtiDeepLinkingRequest') {
      // Redirect to deep linking handler
      // Store claims temporarily and redirect
      const toolURL = getToolURL();
      const deepLinkURL = `${toolURL}${LTI_ROUTES.deepLink}`;
      // For deep linking, we need to pass the claims somehow
      // We'll use a temporary session approach
      const tempSession = await createAndSignTempSession(claims);
      const redirectURL = `${deepLinkURL}?session=${encodeURIComponent(tempSession)}`;
      return NextResponse.redirect(redirectURL);
    }

    // ── Create LTI session for LtiResourceLinkRequest ────────────────────
    const session = createLTISession(claims);
    const signedSession = await signSession(session);
    const serializedSession = serializeSession(signedSession);

    // ── Determine redirect target ────────────────────────────────────────
    const toolURL = getToolURL();
    const launchPageURL = `${toolURL}${LTI_ROUTES.launchPage}`;

    console.log(
      `LTI launch successful: user=${session.userName}, ` +
      `course=${session.contextTitle}, ` +
      `resource=${session.resourceLinkTitle}, ` +
      `AGS=${session.agsLineitemsUrl ? 'yes' : 'no'}`
    );

    // ── Set session cookie and redirect ──────────────────────────────────
    const response = NextResponse.redirect(launchPageURL);

    response.cookies.set(LTI_SESSION_CONFIG.cookieName, serializedSession, {
      httpOnly: LTI_SESSION_CONFIG.httpOnly,
      secure: LTI_SESSION_CONFIG.secure,
      sameSite: LTI_SESSION_CONFIG.sameSite,
      path: LTI_SESSION_CONFIG.path,
      maxAge: LTI_SESSION_CONFIG.maxAge,
    });

    return response;

  } catch (error) {
    console.error('LTI launch error:', error);
    return NextResponse.json(
      { error: 'LTI launch failed. Please try again or contact support.' },
      { status: 500 }
    );
  }
}

/**
 * Create a temporary session for deep linking requests.
 * This is a simplified version that stores just enough info for deep linking.
 */
async function createAndSignTempSession(claims: any): Promise<string> {
  const session = createLTISession(claims);
  const signedSession = await signSession(session);
  return serializeSession(signedSession);
}
