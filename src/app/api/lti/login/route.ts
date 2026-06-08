/**
 * AWE System — LTI 1.3 OIDC Login Initiation
 *
 * GET /api/lti/login
 *
 * First step of the LTI 1.3 launch flow. Receives the OIDC initiation
 * request from the platform (Moodle), validates it, creates a state JWT
 * with nonce, and redirects to the platform's authorization endpoint.
 *
 * Flow:
 *   1. Moodle sends: GET /api/lti/login?iss=...&login_hint=...&target_link_uri=...&lti_message_hint=...&client_id=...
 *   2. AWE validates the request
 *   3. AWE creates state JWT with nonce
 *   4. AWE redirects to Moodle's auth endpoint with OIDC auth request params
 *   5. Moodle authenticates user and POSTs id_token to /api/lti/launch
 *
 * Reference: https://www.imsglobal.org/spec/lti/v1p3/#oidc-login-initiation-flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLTIPlatformConfig, getToolURL, LTI_ROUTES } from '@/lib/lti/config';
import { createStateJWT } from '@/lib/lti/jwt';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ── Validate required OIDC parameters ────────────────────────────────
    const iss = searchParams.get('iss');
    const loginHint = searchParams.get('login_hint');
    const targetLinkUri = searchParams.get('target_link_uri');
    const ltiMessageHint = searchParams.get('lti_message_hint');
    const clientId = searchParams.get('client_id');

    if (!iss || !loginHint) {
      return NextResponse.json(
        { error: 'Missing required OIDC parameters: iss, login_hint' },
        { status: 400 }
      );
    }

    // ── Validate platform configuration ──────────────────────────────────
    const platformConfig = getLTIPlatformConfig();
    if (!platformConfig) {
      return NextResponse.json(
        { error: 'LTI integration is not configured on this server.' },
        { status: 500 }
      );
    }

    // Verify the issuer matches our configured platform
    if (iss !== platformConfig.issuer) {
      return NextResponse.json(
        { error: `Unrecognized platform issuer: ${iss}` },
        { status: 403 }
      );
    }

    // Verify client_id if provided
    if (clientId && clientId !== platformConfig.clientId) {
      return NextResponse.json(
        { error: `Unrecognized client_id: ${clientId}` },
        { status: 403 }
      );
    }

    // ── Generate nonce and state ─────────────────────────────────────────
    const nonce = crypto.randomUUID();
    const state = await createStateJWT(nonce, iss);

    const toolURL = getToolURL();
    const redirectURI = `${toolURL}${LTI_ROUTES.launch}`;

    // ── Build OIDC Authorization Request ─────────────────────────────────
    const authParams = new URLSearchParams({
      scope: 'openid',
      response_type: 'id_token',
      client_id: platformConfig.clientId,
      redirect_uri: redirectURI,
      login_hint: loginHint,
      nonce: nonce,
      state: state,
      response_mode: 'form_post',
      prompt: 'none',
    });

    // Include lti_message_hint if provided
    if (ltiMessageHint) {
      authParams.set('lti_message_hint', ltiMessageHint);
    }

    // ── Redirect to platform's authorization endpoint ────────────────────
    const authURL = `${platformConfig.authEndpoint}?${authParams.toString()}`;

    console.log(`LTI OIDC login initiated: issuer=${iss}, nonce=${nonce.substring(0, 8)}...`);

    return NextResponse.redirect(authURL);

  } catch (error) {
    console.error('LTI login initiation error:', error);
    return NextResponse.json(
      { error: 'LTI login initiation failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lti/login
 *
 * Some LTI platforms send the OIDC initiation as a POST.
 */
export async function POST(request: NextRequest) {
  try {
    let iss: string | null = null;
    let loginHint: string | null = null;
    let targetLinkUri: string | null = null;
    let ltiMessageHint: string | null = null;
    let clientId: string | null = null;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      iss = formData.get('iss') as string;
      loginHint = formData.get('login_hint') as string;
      targetLinkUri = formData.get('target_link_uri') as string;
      ltiMessageHint = formData.get('lti_message_hint') as string;
      clientId = formData.get('client_id') as string;
    } else {
      const body = await request.json();
      iss = body.iss;
      loginHint = body.login_hint;
      targetLinkUri = body.target_link_uri;
      ltiMessageHint = body.lti_message_hint;
      clientId = body.client_id;
    }

    if (!iss || !loginHint) {
      return NextResponse.json(
        { error: 'Missing required OIDC parameters: iss, login_hint' },
        { status: 400 }
      );
    }

    // Redirect to the GET handler with the same parameters
    const params = new URLSearchParams({ iss, login_hint: loginHint });
    if (targetLinkUri) params.set('target_link_uri', targetLinkUri);
    if (ltiMessageHint) params.set('lti_message_hint', ltiMessageHint);
    if (clientId) params.set('client_id', clientId);

    return NextResponse.redirect(new URL(`/api/lti/login?${params.toString()}`, request.url));

  } catch (error) {
    console.error('LTI login POST error:', error);
    return NextResponse.json(
      { error: 'LTI login initiation failed.' },
      { status: 500 }
    );
  }
}
