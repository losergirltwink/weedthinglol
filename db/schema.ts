// Database schema (Drizzle, Postgres). Migrations are generated from this file
// into db/migrations/ with `pnpm db:generate` — never hand-edit a generated
// migration; change this file and regenerate.
//
// The static strain graph is NOT in the database (it's baked into
// public/graph.*.json). Personal data that references a strain does so by
// `strainKey` (app/lib/strain-key.ts), never a node id.

import { sql } from "drizzle-orm";

import { METHODS, TIMES_OF_DAY, WISHLIST_SOURCES } from "@/app/lib/journal/constants";
import { STRAIN_TYPES } from "@/app/lib/strains";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Auth (Better Auth). Field names are dictated by Better Auth's model; verify
// against `getAuthTables` when upgrading it. Only the owner ever has a row here
// — see app/lib/auth.ts for the gate.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  // name/email/image come from GitHub. They identify the owner privately and
  // must never be rendered on a public page (pseudonymity — docs/phase-5-plan.md).
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    // For GitHub this is the numeric GitHub user id — what OWNER_GITHUB_ID matches.
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    // One external identity links to at most one user.
    uniqueIndex("account_provider_account_uidx").on(t.providerId, t.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at", { withTimezone: true }),
    aaguid: text("aaguid"),
  },
  (t) => [index("passkey_user_id_idx").on(t.userId), index("passkey_credential_id_idx").on(t.credentialID)],
);

// Shared rate-limit counters, so limits hold across serverless instances rather
// than resetting per cold start (Better Auth `rateLimit.storage: "database"`).
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// Journal (Phase 5C). One row per consumption session — many per strain. The
// table is `journal_entry` because `session` is the auth table; the UI calls
// these "sessions".
// ---------------------------------------------------------------------------

export const consumptionMethod = pgEnum("consumption_method", METHODS);
export const timeOfDay = pgEnum("time_of_day", TIMES_OF_DAY);

export const journalEntry = pgTable(
  "journal_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    strainKey: text("strain_key").notNull(),
    // Half-star units, 1–10 (= 0.5–5 stars). Integer, so no float rounding.
    ratingHalves: smallint("rating_halves").notNull(),
    notes: text("notes"),
    effectsFelt: text("effects_felt").array().notNull().default(sql`'{}'::text[]`),
    negativesFelt: text("negatives_felt").array().notNull().default(sql`'{}'::text[]`),
    flavors: text("flavors").array().notNull().default(sql`'{}'::text[]`),
    terpenes: text("terpenes").array().notNull().default(sql`'{}'::text[]`),
    method: consumptionMethod("method"),
    dose: text("dose"),
    timeOfDay: timeOfDay("time_of_day"),
    brand: text("brand"),
    batch: text("batch"),
    wouldBuyAgain: boolean("would_buy_again"),
    // Date only — exact timestamps would reveal routines (pseudonymity).
    consumedOn: date("consumed_on", { mode: "string" }).notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("journal_entry_strain_key_idx").on(t.strainKey),
    index("journal_entry_consumed_on_idx").on(t.consumedOn),
    check("journal_entry_rating_range", sql`${t.ratingHalves} between 1 and 10`),
  ],
);

export const wishlistSource = pgEnum("wishlist_source", WISHLIST_SOURCES);

/** Strains I want to try. At most one row per strain. */
export const wishlistItem = pgTable("wishlist_item", {
  strainKey: text("strain_key").primaryKey(),
  source: wishlistSource("source").notNull().default("manual"),
  note: text("note"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Personal strains (Phase 5C). Strains the owner logged that aren't in any baked
// source. Keyed by strainKey (derived from the name, immutable once created —
// journal entries reference it). `parent_keys` may name catalog OR personal
// strains. Graduates to curated via `pnpm promote` (docs/phase-5-plan.md 5A.4).
// ---------------------------------------------------------------------------

export const strainTypeEnum = pgEnum("strain_type", STRAIN_TYPES);

export const personalStrain = pgTable("personal_strain", {
  strainKey: text("strain_key").primaryKey(),
  name: text("name").notNull(),
  strainType: strainTypeEnum("strain_type").notNull(),
  parentKeys: text("parent_keys").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
