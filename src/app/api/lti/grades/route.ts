/**
 * AWE System — LTI 1.3 AGS Grade Passback API
 *
 * POST /api/lti/grades
 *
 * Internal API endpoint called by the AWE frontend after an assessment
 * completes. Submits the assessment score to the platform (Moodle)
 * via the AGS (Assignment and Grade Services) protocol.
 *
 * Request body:
 *   {
 *     "percentage": 75,           // Assessment percentage (0-100)
 *     "maxScore": 24,             // Maximum possible score
 *     "comment": "Good effort",   // Optional feedback comment
 *     "activityProgress": "Completed",
 *     "gradingProgress": "FullyGraded"
 *   }
 *
 * Requires: Valid LTI session cookie with AGS scope
 */

import { NextRequest, NextResponse } from 'next/server';
import { deserializeSession, validateSession, hasAGS } from '@/lib/lti/session';
import { passbackGrade } from '@/lib/lti/ags';
import { LTI_SESSION_CONFIG } from '@/lib/lti/config';

export async function POST(request: NextRequest) {
  try {
    // ── Get and validate LTI session ─────────────────────────────────────
    const sessionCookie = request.cookies.get(LTI_SESSION_CONFIG.cookieName)?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'No LTI session found. Please launch the assignment from Moodle.' },
        { status: 401 }
      );
    }

    const session = deserializeSession(sessionCookie);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid LTI session. Please relaunch the assignment.' },
        { status: 401 }
      );
    }

    // Validate session (expiry + signature)
    const validation = await validateSession(session);
    if (!validation.valid) {
      const response = NextResponse.json(
        { error: `LTI session invalid: ${validation.reason}. Please relaunch the assignment.` },
        { status: 401 }
      );
      response.cookies.delete(LTI_SESSION_CONFIG.cookieName);
      return response;
    }

    // Check AGS availability
    if (!hasAGS(session)) {
      return NextResponse.json(
        { error: 'Grade passback is not available for this assignment. The Moodle activity may not have AGS enabled.' },
        { status: 400 }
      );
    }

    // ── Parse request body ───────────────────────────────────────────────
    const body = await request.json();
    const {
      percentage,
      maxScore,
      comment,
      activityProgress = 'Completed',
      gradingProgress = 'FullyGraded',
    } = body;

    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      return NextResponse.json(
        { error: 'percentage must be a number between 0 and 100' },
        { status: 400 }
      );
    }

    if (typeof maxScore !== 'number' || maxScore <= 0) {
      return NextResponse.json(
        { error: 'maxScore must be a positive number' },
        { status: 400 }
      );
    }

    // ── Submit grade via AGS ─────────────────────────────────────────────
    const result = await passbackGrade(session, percentage, maxScore, comment);

    console.log(
      `AGS grade passback successful: ${percentage}% for user ${session.userId} ` +
      `in ${session.contextTitle} - ${session.resourceLinkTitle}`
    );

    return NextResponse.json({
      success: true,
      message: 'Grade submitted to Moodle successfully.',
      details: {
        percentage,
        maxScore,
        scoreGiven: Math.round((percentage / 100) * maxScore * 100) / 100,
        userId: session.userId,
        courseTitle: session.contextTitle,
        assignmentTitle: session.resourceLinkTitle,
        lineitemUrl: result.lineitemUrl,
      },
    });

  } catch (error) {
    console.error('AGS grade passback error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit grade to Moodle';

    return NextResponse.json(
      { error: `Grade passback failed: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/lti/grades
 *
 * Returns the AGS status for the current LTI session.
 * Useful for the frontend to check if grade passback is available.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(LTI_SESSION_CONFIG.cookieName)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ available: false, reason: 'No LTI session' });
    }

    const session = deserializeSession(sessionCookie);
    if (!session) {
      return NextResponse.json({ available: false, reason: 'Invalid session' });
    }

    const validation = await validateSession(session);
    if (!validation.valid) {
      return NextResponse.json({ available: false, reason: validation.reason });
    }

    return NextResponse.json({
      available: hasAGS(session),
      session: {
        userName: session.userName,
        contextTitle: session.contextTitle,
        resourceLinkTitle: session.resourceLinkTitle,
        roles: session.roles,
        agsScopes: session.agsScopes,
      },
    });

  } catch (error) {
    return NextResponse.json({ available: false, reason: 'Error checking AGS status' });
  }
}
