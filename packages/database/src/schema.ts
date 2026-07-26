import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const portfolioV2 = pgSchema("portfolio_v2");

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const accounts = portfolioV2.table("accounts", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  reportingCurrency: text("reporting_currency").notNull(),
  reportingTimezone: text("reporting_timezone").notNull().default("UTC"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const users = portfolioV2.table("users", {
  id: uuid("id").primaryKey(),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const accountMemberships = portfolioV2.table("account_memberships", {
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("account_memberships_account_user_uidx").on(table.accountId, table.userId),
  index("account_memberships_user_idx").on(table.userId),
]);

export const chains = portfolioV2.table("chains", {
  id: uuid("id").primaryKey(),
  namespace: text("namespace").notNull(),
  reference: text("reference").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("chains_namespace_reference_uidx").on(table.namespace, table.reference)]);

export const wallets = portfolioV2.table("wallets", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  chainId: uuid("chain_id").notNull().references(() => chains.id),
  normalizedAddress: text("normalized_address").notNull(),
  addressDisplay: text("address_display").notNull(),
  walletKind: text("wallet_kind").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (table) => [
  uniqueIndex("wallets_account_chain_address_uidx").on(table.accountId, table.chainId, table.normalizedAddress),
  index("wallets_account_idx").on(table.accountId),
]);

export const assets = portfolioV2.table("assets", {
  id: uuid("id").primaryKey(),
  chainId: uuid("chain_id").notNull().references(() => chains.id),
  assetNamespace: text("asset_namespace").notNull(),
  assetReference: text("asset_reference").notNull(),
  decimals: integer("decimals"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("assets_chain_namespace_reference_uidx").on(table.chainId, table.assetNamespace, table.assetReference),
]);

export const providerConnections = portfolioV2.table("provider_connections", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  provider: text("provider").notNull(),
  label: text("label").notNull(),
  encryptedCredentialEnvelope: text("encrypted_credential_envelope"),
  credentialKeyVersion: text("credential_key_version"),
  status: text("status").notNull().default("active"),
  dailyCreditBudget: bigint("daily_credit_budget", { mode: "bigint" }),
  ...timestamps,
}, (table) => [index("provider_connections_account_idx").on(table.accountId)]);

export const syncJobs = portfolioV2.table("sync_jobs", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  providerConnectionId: uuid("provider_connection_id").notNull().references(() => providerConnections.id),
  walletId: uuid("wallet_id").references(() => wallets.id),
  chainId: uuid("chain_id").references(() => chains.id),
  capability: text("capability").notNull(),
  request: jsonb("request").notNull(),
  status: text("status").notNull().default("queued"),
  priority: integer("priority").notNull().default(100),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key").notNull(),
  lastErrorCode: text("last_error_code"),
  ...timestamps,
}, (table) => [
  index("sync_jobs_claim_idx").on(table.status, table.scheduledAt, table.priority),
  index("sync_jobs_lease_idx").on(table.leaseExpiresAt),
  index("sync_jobs_account_idx").on(table.accountId),
]);

export const syncRuns = portfolioV2.table("sync_runs", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  jobId: uuid("job_id").notNull().references(() => syncJobs.id),
  providerConnectionId: uuid("provider_connection_id").notNull().references(() => providerConnections.id),
  walletId: uuid("wallet_id").references(() => wallets.id),
  chainId: uuid("chain_id").references(() => chains.id),
  provider: text("provider").notNull(),
  adapterVersion: text("adapter_version").notNull(),
  capability: text("capability").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  acceptedObservationCount: integer("accepted_observation_count").notNull().default(0),
  rejectedObservationCount: integer("rejected_observation_count").notNull().default(0),
  providerCredits: numeric("provider_credits", { precision: 30, scale: 6 }),
  freshness: text("freshness"),
  reconciliationStatus: text("reconciliation_status"),
  warnings: jsonb("warnings").notNull().default(sql`'[]'::jsonb`),
  error: jsonb("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("sync_runs_account_started_idx").on(table.accountId, table.startedAt)]);

export const rawObservations = portfolioV2.table("raw_observations", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  syncRunId: uuid("sync_run_id").notNull().references(() => syncRuns.id),
  providerConnectionId: uuid("provider_connection_id").notNull().references(() => providerConnections.id),
  walletId: uuid("wallet_id").references(() => wallets.id),
  chainId: uuid("chain_id").references(() => chains.id),
  capability: text("capability").notNull(),
  endpoint: text("endpoint").notNull(),
  sourceKey: text("source_key"),
  requestFingerprint: text("request_fingerprint").notNull(),
  contentSha256: text("content_sha256").notNull(),
  payload: jsonb("payload"),
  archiveLocator: text("archive_locator"),
  schemaVersion: text("schema_version").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }),
  effectiveAt: timestamp("effective_at", { withTimezone: true }),
  page: integer("page"),
  cursorBefore: jsonb("cursor_before"),
  cursorAfter: jsonb("cursor_after"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("raw_observations_content_uidx").on(table.accountId, table.providerConnectionId, table.capability, table.requestFingerprint, table.contentSha256),
  index("raw_observations_account_received_idx").on(table.accountId, table.receivedAt),
]);

export const projectionVersions = portfolioV2.table("projection_versions", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  modelType: text("model_type").notNull(),
  sourceCut: jsonb("source_cut").notNull(),
  projectorVersion: text("projector_version").notNull(),
  status: text("status").notNull(),
  builtAt: timestamp("built_at", { withTimezone: true }).notNull(),
  promotedAt: timestamp("promoted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("projection_versions_account_status_idx").on(table.accountId, table.modelType, table.status)]);

export const portfolioSnapshots = portfolioV2.table("portfolio_snapshots", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  projectionVersionId: uuid("projection_version_id").notNull().references(() => projectionVersions.id),
  valuationPolicyVersion: text("valuation_policy_version").notNull(),
  reportingPolicyVersion: text("reporting_policy_version").notNull(),
  asOf: timestamp("as_of", { withTimezone: true }).notNull(),
  reportingCurrency: text("reporting_currency").notNull(),
  netWorth: numeric("net_worth", { precision: 48, scale: 18 }),
  costBasis: numeric("cost_basis", { precision: 48, scale: 18 }),
  unrealizedPnl: numeric("unrealized_pnl", { precision: 48, scale: 18 }),
  completeness: text("completeness").notNull(),
  confidence: text("confidence").notNull(),
  unpricedAssetCount: integer("unpriced_asset_count").notNull().default(0),
  unknownEventCount: integer("unknown_event_count").notNull().default(0),
  calculationId: uuid("calculation_id").notNull(),
  warnings: jsonb("warnings").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("portfolio_snapshots_version_uidx").on(table.accountId, table.projectionVersionId, table.valuationPolicyVersion, table.reportingPolicyVersion, table.asOf),
  index("portfolio_snapshots_latest_idx").on(table.accountId, table.asOf),
]);
