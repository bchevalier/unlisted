-- Add agent identity metadata and scoped API key permissions to ReachActor.
-- agentMeta: structured JSON for AI_AGENT identity (operator, model, version, deployment).
-- apiKeyScopes: permission scope allowlist for API keys (empty = full access).

ALTER TABLE "ReachActor" ADD COLUMN "agentMeta" JSONB;
ALTER TABLE "ReachActor" ADD COLUMN "apiKeyScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
