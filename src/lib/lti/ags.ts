/**
 * AWE System — LTI 1.3 AGS (Assignment and Grade Services)
 *
 * Handles grade passback from AWE assessment results to the LTI platform
 * (Moodle). Implements the OAuth2 client_credentials flow with JWT
 * client_assertion as required by LTI 1.3 AGS.
 *
 * Flow:
 *   1. After assessment, AWE computes percentage score
 *   2. AWE requests OAuth2 access token from platform (client_assertion grant)
 *   3. AWE finds or creates a LineItem for this assignment
 *   4. AWE POSTs a Score to the LineItem
 *   5. Grade appears in Moodle gradebook
 */

import { createClientAssertionJWT } from './jwt';
import { getLTIPlatformConfig } from './config';
import type {
  AGSScore,
  AGSLineItem,
  AGSLineItemResponse,
  AGSScope,
  OAuth2TokenResponse,
} from './types';

// ─── Token Cache ──────────────────────────────────────────────────────────────

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
  scope: string;
}

let tokenCache: Map<string, TokenCacheEntry> = new Map();

/**
 * Get an OAuth2 access token for AGS operations.
 * Uses the client_credentials grant with JWT client_assertion.
 * Caches tokens until 60 seconds before expiry.
 */
export async function getAGSAccessToken(scopes: AGSScope[]): Promise<string> {
  const platformConfig = getLTIPlatformConfig();
  if (!platformConfig) {
    throw new Error('LTI platform not configured');
  }

  const scopeString = scopes.join(' ');
  const cacheKey = `${platformConfig.issuer}:${scopeString}`;

  // Check cache
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() / 1000 + 60) {
    return cached.accessToken;
  }

  // Create client assertion JWT
  const clientAssertion = await createClientAssertionJWT(platformConfig.tokenEndpoint);

  // Request access token
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
    scope: scopeString,
  });

  const response = await fetch(platformConfig.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AGS token request failed:', response.status, errorText);
    throw new Error(`Failed to obtain AGS access token: ${response.status} ${errorText}`);
  }

  const tokenResponse: OAuth2TokenResponse = await response.json();

  // Cache the token
  tokenCache.set(cacheKey, {
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() / 1000 + tokenResponse.expires_in,
    scope: tokenResponse.scope,
  });

  return tokenResponse.access_token;
}

/**
 * Find or create a LineItem for the given resource link.
 * Returns the LineItem URL for score submission.
 */
export async function ensureLineItem(
  accessToken: string,
  lineitemsUrl: string,
  lineitemUrl: string | undefined,
  resourceLinkId: string,
  resourceLinkTitle: string,
  scoreMaximum: number
): Promise<string> {
  // If a specific lineitem URL was provided in the launch, use it
  if (lineitemUrl) {
    return lineitemUrl;
  }

  // Search for existing lineitem matching the resourceLinkId
  if (lineitemsUrl) {
    try {
      const searchUrl = `${lineitemsUrl}?resourceLinkId=${encodeURIComponent(resourceLinkId)}`;
      const response = await fetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.ims.lis.v2.lineitem+json',
        },
      });

      if (response.ok) {
        const lineitems: AGSLineItemResponse[] = await response.json();
        const existing = Array.isArray(lineitems)
          ? lineitems.find(li => li.resourceLinkId === resourceLinkId)
          : null;

        if (existing && existing.id) {
          return existing.id;
        }
      }
    } catch (error) {
      console.warn('Failed to search for existing lineitem:', error);
    }

    // Create a new lineitem
    const newLineItem: AGSLineItem = {
      scoreMaximum,
      label: resourceLinkTitle || 'AWE Assessment',
      resourceLinkId,
      tag: 'awe-assessment',
    };

    const createResponse = await fetch(lineitemsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.ims.lis.v2.lineitem+json',
      },
      body: JSON.stringify(newLineItem),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Failed to create lineitem:', createResponse.status, errorText);
      throw new Error(`Failed to create AGS lineitem: ${createResponse.status}`);
    }

    const created: AGSLineItemResponse = await createResponse.json();
    return created.id;
  }

  throw new Error('No lineitems URL available for AGS grade passback');
}

/**
 * Submit a score to the platform via AGS.
 * This is the main entry point for grade passback.
 *
 * @param scoreGiven - The score achieved by the student
 * @param scoreMaximum - The maximum possible score
 * @param lineitemUrl - The LineItem URL to submit the score to
 * @param userId - The platform user ID (sub from LTI launch)
 * @param comment - Optional comment/feedback
 * @param activityProgress - Activity progress state
 * @param gradingProgress - Grading progress state
 */
export async function submitScore(
  scoreGiven: number,
  scoreMaximum: number,
  lineitemUrl: string,
  userId: string,
  comment?: string,
  activityProgress: AGSScore['activityProgress'] = 'Completed',
  gradingProgress: AGSScore['gradingProgress'] = 'FullyGraded'
): Promise<boolean> {
  // Get access token with score scope
  const accessToken = await getAGSAccessToken([
    'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  ]);

  // Build the score object
  const score: AGSScore = {
    scoreGiven,
    scoreMaximum,
    comment: comment || `AWE Assessment: ${scoreGiven}/${scoreMaximum} (${Math.round((scoreGiven / scoreMaximum) * 100)}%)`,
    activityProgress,
    gradingProgress,
    timestamp: new Date().toISOString(),
    userId,
  };

  // The scores URL is derived from the lineitem URL by appending /scores
  const scoresUrl = lineitemUrl.endsWith('/')
    ? `${lineitemUrl}scores`
    : `${lineitemUrl}/scores`;

  const response = await fetch(scoresUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.ims.lis.v2.score+json',
    },
    body: JSON.stringify(score),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AGS score submission failed:', response.status, errorText);
    throw new Error(`Failed to submit AGS score: ${response.status} ${errorText}`);
  }

  console.log(`AGS score submitted: ${scoreGiven}/${scoreMaximum} for user ${userId}`);
  return true;
}

/**
 * Full grade passback pipeline.
 * Called after an assessment completes.
 *
 * @param session - LTI session data
 * @param percentage - Assessment percentage (0-100)
 * @param maxScore - Maximum possible score
 * @param comment - Optional feedback comment
 */
export async function passbackGrade(
  session: {
    agsLineitemsUrl?: string;
    agsLineitemUrl?: string;
    agsScopes: AGSScope[];
    resourceLinkId: string;
    resourceLinkTitle?: string;
    userId: string;
  },
  percentage: number,
  maxScore: number,
  comment?: string
): Promise<{ success: boolean; lineitemUrl: string }> {
  // Verify AGS is available
  if (!session.agsLineitemsUrl && !session.agsLineitemUrl) {
    throw new Error('AGS is not available for this LTI launch. The platform did not provide grade passback endpoints.');
  }

  // Check score scope
  const hasScoreScope = session.agsScopes.includes(
    'https://purl.imsglobal.org/spec/lti-ags/scope/score'
  );
  if (!hasScoreScope) {
    throw new Error('AGS score scope not granted. Cannot submit grades.');
  }

  // Get access token
  const accessToken = await getAGSAccessToken([
    'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
    'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  ]);

  // Find or create lineitem
  const lineitemUrl = await ensureLineItem(
    accessToken,
    session.agsLineitemsUrl || '',
    session.agsLineitemUrl,
    session.resourceLinkId,
    session.resourceLinkTitle || 'AWE Assessment',
    maxScore
  );

  // Compute score from percentage
  const scoreGiven = Math.round((percentage / 100) * maxScore * 100) / 100;

  // Submit score
  await submitScore(
    scoreGiven,
    maxScore,
    lineitemUrl,
    session.userId,
    comment
  );

  return { success: true, lineitemUrl };
}

/**
 * Clear the token cache (useful for testing).
 */
export function clearTokenCache(): void {
  tokenCache = new Map();
}
