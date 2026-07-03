import { pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * waitlist_signups — stores every unique email that joins the BetterRoads
 * waitlist. Keyed on email (unique) so duplicate submissions are idempotent.
 */
export const waitlistSignups = pgTable(
  'waitlist_signups',
  {
    id: serial('id').primaryKey(),

    /** Canonical lowercase email address. Max 254 chars per RFC 5321. */
    email: text('email').notNull(),

    /** Optional first name / display name, trimmed, max 80 chars. */
    name: text('name'),

    /** Optional city, trimmed, max 80 chars. */
    city: text('city'),

    /**
     * Optional way the signup offered to contribute (slug from
     * CONTRIBUTION_OPTIONS, e.g. 'road_data'). Null when none selected.
     */
    contribution: text('contribution'),

    /** Optional WhatsApp number for follow-up. Null when not provided. */
    whatsapp: text('whatsapp'),

    /** Optional free-text message / how they can help. Null when empty. */
    message: text('message'),

    /** Row creation timestamp (server-side UTC). */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('waitlist_signups_email_idx').on(table.email),
  ],
);

export type WaitlistSignup = typeof waitlistSignups.$inferSelect;
export type NewWaitlistSignup = typeof waitlistSignups.$inferInsert;

/**
 * app_settings — simple key-value store for global configurations.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
