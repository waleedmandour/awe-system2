/**
 * AWE System — LTI 1.3 + AGS Type Definitions
 *
 * Defines all TypeScript interfaces for LTI 1.3 core, AGS (Assignment and
 * Grade Services), Names and Roles Provisioning Service (NRPS), and
 * Deep Linking 2.0 claims used throughout the integration.
 *
 * References:
 *   - IMS LTI 1.3 Core: https://www.imsglobal.org/spec/lti/v1p3/
 *   - IMS AGS:          https://www.imsglobal.org/spec/lti-ags/v2p0/
 *   - IMS Deep Linking: https://www.imsglobal.org/spec/lti-dl/v2p0/
 */

// ─── Platform Registration ────────────────────────────────────────────────────

/** Configuration for a single LTI Platform (e.g., a Moodle instance). */
export interface LTIPlatformConfig {
  /** Unique identifier for this platform registration. */
  id: string;
  /** The platform issuer URL (e.g., "https://elearnt.squ.edu.om"). */
  issuer: string;
  /** OAuth2 client_id assigned by the platform for this tool. */
  clientId: string;
  /** OIDC authorization endpoint on the platform. */
  authEndpoint: string;
  /** OAuth2 token endpoint on the platform. */
  tokenEndpoint: string;
  /** JWKS endpoint on the platform for verifying id_tokens. */
  jwksEndpoint: string;
  /** Optional deployment IDs (Moodle can have multiple deployments). */
  deploymentIds?: string[];
}

// ─── LTI 1.3 Core Claims ─────────────────────────────────────────────────────

/** LTI 1.3 message claims from the id_token JWT. */
export interface LTILaunchClaims {
  /** Standard JWT issuer — must match the platform's issuer URL. */
  iss: string;
  /** Standard JWT audience — must include our client_id. */
  aud: string | string[];
  /** Subject — platform user identifier. */
  sub: string;
  /** Expiration timestamp (seconds since epoch). */
  exp: number;
  /** Issued-at timestamp. */
  iat: number;
  /** JWT unique identifier (nonce for replay protection). */
  nonce: string;

  // LTI-specific
  /** https://purl.imsglobal.org/spec/lti/claim/message_type */
  'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest' | 'LtiDeepLinkingRequest';
  /** https://purl.imsglobal.org/spec/lti/claim/version */
  'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0';
  /** https://purl.imsglobal.org/spec/lti/claim/deployment_id */
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': string;
  /** https://purl.imsglobal.org/spec/lti/claim/target_link_uri */
  'https://purl.imsglobal.org/spec/lti/claim/target_link_uri'?: string;
  /** https://purl.imsglobal.org/spec/lti/claim/resource_link */
  'https://purl.imsglobal.org/spec/lti/claim/resource_link': LTIResourceLink;
  /** https://purl.imsglobal.org/spec/lti/claim/roles */
  'https://purl.imsglobal.org/spec/lti/claim/roles': string[];
  /** https://purl.imsglobal.org/spec/lti/claim/context */
  'https://purl.imsglobal.org/spec/lti/claim/context'?: LTIContext;
  /** https://purl.imsglobal.org/spec/lti/claim/tool_platform */
  'https://purl.imsglobal.org/spec/lti/claim/tool_platform'?: LTIPlatform;

  // User identity
  /** User's given / first name. */
  given_name?: string;
  /** User's family / last name. */
  family_name?: string;
  /** User's full name. */
  name?: string;
  /** User's email address. */
  email?: string;

  // LIS (Learning Information Services) claims
  'https://purl.imsglobal.org/spec/lti/claim/lis'?: LTILIS;

  // Extensions
  /** https://purl.imsglobal.org/spec/lti/claim/ext */
  'https://purl.imsglobal.org/spec/lti/claim/ext'?: Record<string, unknown>;
  /** https://purl.imsglobal.org/spec/lti/claim/custom */
  'https://purl.imsglobal.org/spec/lti/claim/custom'?: Record<string, unknown>;

  // AGS claim
  'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'?: AGSEndpointClaim;

  // NRPS claim
  'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'?: NRPSClaim;

  // Deep Linking claim
  'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'?: DeepLinkingSettings;
}

/** Resource link claim — identifies the specific LTI link/assignment. */
export interface LTIResourceLink {
  id: string;
  title?: string;
  description?: string;
}

/** Context claim — identifies the Moodle course. */
export interface LTIContext {
  id: string;
  label?: string;
  title?: string;
  type?: string[];
}

/** Platform claim from the LTI launch. */
export interface LTIPlatform {
  guid?: string;
  name?: string;
  version?: string;
  product_family_code?: string;
}

/** LIS (Learning Information Services) claim. */
export interface LTILIS {
  person_sourcedid?: string;
  course_section_sourcedid?: string;
  outcome_service_url?: string;
  result_sourcedid?: string;
}

// ─── AGS (Assignment and Grade Services) ──────────────────────────────────────

/** AGS endpoint claim embedded in LTI launch JWT. */
export interface AGSEndpointClaim {
  lineitems?: string;
  lineitem?: string;
  scope: AGSScope[];
}

/** AGS scope values. */
export type AGSScope =
  | 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem'
  | 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly'
  | 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly'
  | 'https://purl.imsglobal.org/spec/lti-ags/scope/score';

/** AGS Lineitem — represents a grade column in the platform. */
export interface AGSLineItem {
  id?: string;
  scoreMaximum: number;
  label: string;
  resourceId?: string;
  resourceLinkId?: string;
  tag?: string;
  startDateTime?: string;
  endDateTime?: string;
}

/** AGS Score — a grade submission for a specific student. */
export interface AGSScore {
  scoreGiven: number;
  scoreMaximum: number;
  comment?: string;
  activityProgress: 'Initialized' | 'Started' | 'InProgress' | 'Submitted' | 'Completed';
  gradingProgress: 'FullyGraded' | 'Pending' | 'PendingManual' | 'Failed' | 'NotReady';
  timestamp: string;
  userId: string;
  submissionId?: string;
}

/** AGS Lineitem response (includes id after creation). */
export interface AGSLineItemResponse extends AGSLineItem {
  id: string;
}

// ─── NRPS (Names and Roles Provisioning Service) ─────────────────────────────

/** NRPS claim embedded in LTI launch JWT. */
export interface NRPSClaim {
  context_memberships_url: string;
  service_versions: string[];
}

// ─── Deep Linking 2.0 ────────────────────────────────────────────────────────

/** Deep Linking settings claim. */
export interface DeepLinkingSettings {
  deep_link_return_url: string;
  accept_types: string[];
  accept_presentation_document_targets: string[];
  accept_multiple?: boolean;
  auto_create?: boolean;
  title?: string;
  text?: string;
  data?: string;
}

/** Content item for Deep Linking response. */
export interface DeepLinkContentItem {
  type: 'ltiResourceLink';
  title: string;
  url: string;
  lineItem?: AGSLineItem;
  custom?: Record<string, unknown>;
}

// ─── LTI Session ──────────────────────────────────────────────────────────────

/** LTI session data stored in an httpOnly cookie. */
export interface LTISession {
  /** The platform issuer URL. */
  issuer: string;
  /** OAuth2 client_id. */
  clientId: string;
  /** Deployment ID. */
  deploymentId: string;
  /** Platform user ID (sub). */
  userId: string;
  /** User's display name. */
  userName: string;
  /** User's email. */
  userEmail?: string;
  /** User roles. */
  roles: string[];
  /** Resource link ID (assignment). */
  resourceLinkId: string;
  /** Resource link title. */
  resourceLinkTitle?: string;
  /** Course context ID. */
  contextId: string;
  /** Course context title. */
  contextTitle?: string;
  /** AGS lineitems URL (for grade passback). */
  agsLineitemsUrl?: string;
  /** AGS lineitem URL (single assignment). */
  agsLineitemUrl?: string;
  /** AGS scopes available. */
  agsScopes: AGSScope[];
  /** NRPS memberships URL. */
  nrpsUrl?: string;
  /** When this session was created. */
  createdAt: number;
  /** HMAC signature for tamper detection. */
  signature: string;
}

// ─── Grade Passback Request ───────────────────────────────────────────────────

/** Request body for the /api/lti/grades endpoint. */
export interface LTIGradeRequest {
  /** AWE assessment percentage (0-100). */
  percentage: number;
  /** Maximum score for the assessment. */
  maxScore: number;
  /** Optional comment/feedback summary. */
  comment?: string;
  /** Activity progress. */
  activityProgress?: AGSScore['activityProgress'];
  /** Grading progress. */
  gradingProgress?: AGSScore['gradingProgress'];
}

// ─── OAuth2 Token Response ────────────────────────────────────────────────────

/** OAuth2 token response from the platform. */
export interface OAuth2TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}
