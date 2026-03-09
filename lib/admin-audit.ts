/**
 * Admin audit logging.
 *
 * Logs admin actions to both console (structured JSON) and an in-memory
 * ring buffer for recent inspection. A future iteration can persist to
 * the database or an external logging service.
 */

export type AuditEntry = {
  timestamp: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  ip?: string;
};

const RING_BUFFER_SIZE = 500;
const auditLog: AuditEntry[] = [];

/**
 * Record an admin action.
 */
export function logAdminAction(entry: Omit<AuditEntry, 'timestamp'>): void {
  const full: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // Structured console log for external log aggregation
  console.log(JSON.stringify({ level: 'audit', ...full }));

  // Ring buffer for in-process inspection
  auditLog.push(full);
  if (auditLog.length > RING_BUFFER_SIZE) {
    auditLog.shift();
  }
}

/**
 * Get recent audit entries (most recent first).
 */
export function getRecentAuditEntries(limit = 50): AuditEntry[] {
  return auditLog.slice(-limit).reverse();
}

/**
 * UUID v4 format validator.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string looks like a UUID (used for path param validation).
 */
export function isValidUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/**
 * CUID format validator (Prisma default IDs).
 * CUIDs are 25-char strings starting with 'c'.
 */
const CUID_RE = /^c[a-z0-9]{24}$/;

/**
 * Validate that a string looks like a CUID.
 */
export function isValidCuid(id: string): boolean {
  return CUID_RE.test(id);
}

/**
 * Validate that an ID is either a UUID or a CUID (flexible for Prisma schemas).
 */
export function isValidEntityId(id: string): boolean {
  return isValidUuid(id) || isValidCuid(id);
}
