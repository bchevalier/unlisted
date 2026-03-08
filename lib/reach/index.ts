/**
 * Reach module public API.
 *
 * Re-exports contracts, types, and the policy engine for use by
 * Reach API routes and services.
 */

export {
  // Enums / constants
  REACH_ACTOR_TYPES,
  REACH_CONTRACT_TYPES,
  REACH_CONTRACT_STATUSES,
  REACH_POLICY_ACTIONS,
  REACH_EVENT_TYPES,
  REACH_EVENT_ACTORS,
  CONTRACT_TRANSITIONS,

  // Functions
  canTransition,
  validateActorTypes,

  // Zod schemas
  ReachActorCreateSchema,
  ReachPolicyCreateSchema,
  ReachContractCreateSchema,
  AgentMetaSchema,
} from './contracts';

export type {
  ReachActorType,
  ReachContractType,
  ReachContractStatus,
  ReachPolicyAction,
  ReachContractEventType,
  ReachContractEventActor,
  ReachActorCreate,
  ReachPolicyCreate,
  ReachContractCreate,
  AgentMeta,
} from './contracts';

export { evaluatePolicies, evaluatePoliciesWithTrace } from './policy-engine';

export type {
  PolicyRecord,
  ContractProposal,
  PolicyMatchResult,
  PolicyNoMatch,
  PolicyEvaluation,
  PolicySkipReason,
  PolicyTraceEntry,
  PolicyEvaluationTrace,
} from './policy-engine';

export {
  // Service functions — actors
  createActor,
  getActorByHandle,
  getActorByUserId,
  deactivateActor,
  updateActor,
  rotateApiKey,
  ReachActorUpdateSchema,

  // Service functions — org membership
  addOrgMember,
  removeOrgMember,
  updateOrgMemberRole,
  listOrgMembers,
  getOrgMembership,

  // Service functions — policies
  createPolicy,
  listPolicies,
  updatePolicy,
  deactivatePolicy,

  // Service functions — contracts
  proposeContract,
  transitionContract,
  fulfillContract,
  getContract,
  listContracts,
  listEscalatedContracts,
  overrideContractDecision,
  expireStaleContracts,

  // Actor lifecycle
  deactivateActorWithCascade,

  ReachError,
} from './service';

export type { ReachActorUpdate } from './service';

export {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from './auth';

export type { ReachAuthResult } from './auth';

export {
  resolveAuthz,
  hasPermission,
  requirePermission,
  getPermissionsForRole,
  REACH_PERMISSIONS,
  REACH_ORG_ROLES,
} from './permissions';

export type {
  ReachPermission as ReachPermissionScope,
  ReachOrgRole,
  AuthzContext,
} from './permissions';

export {
  dispatchContract,
  deliverWebhook,
  deliverWebhookWithSecret,
  getContractDeliveryStatus,
  isCircuitOpen,
  getCircuitState,
  resetCircuitBreakers,
} from './router';

export type {
  DeliveryTarget,
  ContractPayload,
  WebhookPayload,
  DeliveryResult,
  ContractDeliveryStatus,
} from './router';

// Pilot metrics
export {
  computeMetrics,
  computeDistribution,
  getReachPilotMetrics,
} from './metrics';

export type {
  ContractMetricRow,
  DistributionStats,
  ReachPilotMetrics,
  MetricsQueryOptions,
} from './metrics';

// Safety & abuse controls
export {
  blockActor,
  unblockActor,
  isBlocked,
  listBlockedActors,
  enforceActorRateLimit,
  enforcePairCooldown,
  createReachAbuseReport,
  listReachAbuseReports,
  listOwnAbuseReports,
  updateReachAbuseReportStatus,
  reviewAbuseReport,
  getActorAbuseScore,
  checkAndAutoSuspend,
  autoBlockOnConfirmedAbuse,
  ReachBlockCreateSchema,
  ReachAbuseReportCreateSchema,
  ReachAbuseReportUpdateSchema,
  ReachSafetyError,
} from './safety';

export type {
  ReachBlockCreate,
  ReachAbuseReportCreate,
} from './safety';

// Content sanitization
export {
  sanitizeContractInput,
  SanitizeError,
} from './sanitize';

export type { SanitizedContractInput } from './sanitize';

// Webhook integration layer
export {
  createWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  listDeliveries,
  dispatchWebhookEvent,
  pingWebhook,
  ReachWebhookCreateSchema,
  ReachWebhookUpdateSchema,
} from './webhooks';

export type {
  ReachWebhookCreate,
  ReachWebhookUpdate,
  WebhookEventPayload,
  SignedWebhookPayload,
} from './webhooks';
