/**
 * AWE System — LTI 1.3 Deep Linking Handler
 *
 * GET /api/lti/deep-link
 *
 * Displays a content selection UI for teachers when they add an
 * iAWE External Tool activity in Moodle. After the teacher selects
 * a course/assignment type, the selection is returned to Moodle
 * as a Deep Linking response JWT.
 *
 * POST /api/lti/deep-link
 *
 * Processes the teacher's content selection and returns the
 * Deep Linking response JWT to Moodle.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDeepLinkingJWT } from '@/lib/lti/jwt';
import { LTI_ROUTES, getToolURL } from '@/lib/lti/config';

/**
 * GET /api/lti/deep-link
 * Renders the content selection UI for deep linking.
 */
export async function GET(request: NextRequest) {
  const sessionParam = new URL(request.url).searchParams.get('session');
  if (!sessionParam) {
    return NextResponse.json(
      { error: 'Missing session parameter' },
      { status: 400 }
    );
  }

  // Redirect to the deep linking page with session
  const toolURL = getToolURL();
  return NextResponse.redirect(`${toolURL}/lti/deep-link?session=${encodeURIComponent(sessionParam)}`);
}

/**
 * POST /api/lti/deep-link
 * Processes the teacher's selection and returns a Deep Linking response.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseCode, returnUrl, deepLinkData, deploymentId } = body;

    if (!courseCode || !returnUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: courseCode, returnUrl' },
        { status: 400 }
      );
    }

    const toolURL = getToolURL();
    const launchURL = `${toolURL}${LTI_ROUTES.launchPage}?course=${courseCode}`;

    // Build content items
    const contentItems = [
      {
        type: 'ltiResourceLink' as const,
        title: `iAWE Assessment - ${courseCode.toUpperCase()}`,
        url: launchURL,
        lineItem: {
          scoreMaximum: 100,
          label: `iAWE Assessment - ${courseCode.toUpperCase()}`,
        },
        custom: {
          course_code: courseCode,
        },
      },
    ];

    // Create Deep Linking response JWT
    const jwt = await createDeepLinkingJWT(
      deploymentId || '1',
      contentItems,
      {
        deep_link_return_url: returnUrl,
        data: deepLinkData,
      }
    );

    // Return HTML form that auto-submits to Moodle
    const html = `<!DOCTYPE html>
<html>
<head><title>Returning to Moodle...</title></head>
<body>
<form id="ltijs_submit" method="POST" action="${returnUrl}" encType="application/x-www-form-urlencoded">
  <input type="hidden" name="JWT" value="${jwt}" />
</form>
<script>document.getElementById('ltijs_submit').submit();</script>
<noscript>
  <p>Redirecting back to Moodle...</p>
  <button type="submit" form="ltijs_submit">Click here if not redirected</button>
</noscript>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('Deep linking error:', error);
    return NextResponse.json(
      { error: 'Deep linking failed.' },
      { status: 500 }
    );
  }
}
