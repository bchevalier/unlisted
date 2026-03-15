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
  PolicyFiltersSchema,
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
  PolicyFilters,
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
  listActors,
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

export type { ReachActorUpdate, ListContractsOptions, ListActorsOptions } from './service';

export {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from './auth';

export {
  canAccessContract,
  resolveContractEventActor,
} from './access';

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
  computeFunnel,
  computeSla,
  computeByType,
  computeTrend,
  makeDelta,
  getReachPilotMetrics,
  getReachPilotMetricsWithTrend,
  DEFAULT_SLA_THRESHOLD_SECONDS,
} from './metrics';

export type {
  ContractMetricRow,
  DistributionStats,
  ConversionFunnel,
  SlaMetrics,
  TypeSegmentMetrics,
  TrendDelta,
  TrendComparison,
  ReachPilotMetrics,
  MetricsQueryOptions,
  MetricsWithTrend,
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

// Content sanitization & spam detection
export {
  sanitizeContractInput,
  checkSpamSignals,
  SanitizeError,
} from './sanitize';

export type { SanitizedContractInput, SpamCheckResult } from './sanitize';

// IP-based rate limiting
export {
  InMemoryRateLimiter,
  contractCreateLimiter,
  reachReadLimiter,
  reachWriteLimiter,
  reachAuthLimiter,
  getClientIp,
  rateLimitResponse,
  addRateLimitHeaders,
} from './rate-limit';

export type { RateLimitConfig, RateLimitResult } from './rate-limit';

// Embeddings provider abstraction (multi-provider fallback)
export {
  EMBEDDING_PROVIDER_NAMES,
  resolveEmbeddingProviderOrder,
  configuredEmbeddingProviders,
  generateEmbeddings,
  EmbeddingError,
} from './embeddings';

export type {
  EmbeddingProviderName,
  EmbeddingRequestInput,
  EmbeddingRecord,
  EmbeddingUsage,
  EmbeddingProviderFailure,
  EmbeddingResult,
} from './embeddings';

// Retrieval pipeline (ANN top-K + optional rerank hook)
export {
  retrieveTopK,
  RetrievalError,
} from './retrieval';

export type {
  RetrievalQueryInput,
  RetrievalQuery,
  VectorSearchHit,
  VectorSearchAdapter,
  RerankQuery,
  RerankHit,
  Reranker,
  RetrievalDeps,
  RetrievalHit,
  RetrievalResult,
} from './retrieval';

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
  retryDelivery,
  getWebhookHealthStats,
  getActorWebhookHealth,
  ReachWebhookCreateSchema,
  ReachWebhookUpdateSchema,
} from './webhooks';

export type {
  ReachWebhookCreate,
  ReachWebhookUpdate,
  WebhookEventPayload,
  SignedWebhookPayload,
  WebhookHealthStats,
} from './webhooks';

// Social verification (creator ownership + follower signals)
export {
  ReachSocialVerificationCreateSchema,
  ReachSocialVerificationVerifySchema,
  createSocialVerificationChallenge,
  listSocialVerifications,
  verifySocialVerification,
  deleteSocialVerification,
  getSocialPlatformEnvRequirements,
  getAllSocialPlatformEnvRequirements,
  assertBioOverrideSafe,
  ReachSocialVerificationError,
} from './social-verifications';

export type {
  ReachSocialVerificationCreateInput,
  ReachSocialVerificationVerifyInput,
} from './social-verifications';

// Social adapter types and registry
export {
  getAdapter as getSocialAdapter,
  getAllAdapters as getAllSocialAdapters,
  SOCIAL_PLATFORMS,
  PLATFORM_ENV_REQUIREMENTS as SOCIAL_PLATFORM_ENV_REQUIREMENTS,
} from './social-adapters';

export type {
  SocialAdapter,
  ReachSocialPlatform,
  ProviderVerificationInput,
  ProviderProfileResult,
} from './social-adapters';
