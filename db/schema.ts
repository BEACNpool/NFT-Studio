import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Small, temporary encrypted mint requests. No wallet data or decryption keys.
export const handoffs = sqliteTable(
  'handoffs',
  {
    id: text('id').primaryKey(),
    sealed: text('sealed'),
    revokeHash: text('revoke_hash').notNull(),
    clientHash: text('client_hash').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    index('handoffs_expiry').on(table.expiresAt),
    index('handoffs_client').on(table.clientHash),
  ],
);
