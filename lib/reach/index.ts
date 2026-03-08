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
} from './contracts';

export { evaluatePolicies } from './policy-engine';

export type {
  PolicyRecord,
  ContractProposal,
  PolicyMatchResult,
  PolicyNoMatch,
  PolicyEvaluation,
} from './policy-engine';

export {
  // Service functions
  createActor,
  getActorByHandle,
  getActorByUserId,
  deactivateActor,
  createPolicy,
  listPolicies,
  updatePolicy,
  deactivatePolicy,
  proposeContract,
  transitionContract,
  getContract,
  listContracts,
  expireStaleContracts,
  ReachError,
} from './service';

export {
  authenticateReachRequest,
  reachDisabledResponse,
  unauthorizedResponse,
} from './auth';

export type { ReachAuthResult } from './auth';
