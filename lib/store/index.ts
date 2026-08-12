import { neon } from "@neondatabase/serverless";
import { MemoryStore } from "./memory";
import { PostgresStore } from "./postgres";
import { Store } from "./types";

export * from "./types";

/**
 * The instance hangs off globalThis, not a module-level `let`.
 *
 * Next compiles route handlers and server components into separate module
 * graphs, so a module-scoped singleton is instantiated once per graph. With
 * MemoryStore that gave the API one map and the pages another: an analysis
 * written by POST /api/analyze was invisible to /r/[id], which 404'd every
 * report the moment it was created — in dev and in a production build alike.
 * globalThis is shared across the graphs, so both sides see one store.
 *
 * This does not make MemoryStore safe across serverless instances; nothing can.
 * Set DATABASE_URL for that.
 */
const globalForStore = globalThis as typeof globalThis & {
  __resumeTruthCheckerStore?: Store;
};

export function getStore(): Store {
  const existing = globalForStore.__resumeTruthCheckerStore;
  if (existing) return existing;

  const url = process.env.DATABASE_URL;
  const store = url ? new PostgresStore(neon(url)) : new MemoryStore();
  globalForStore.__resumeTruthCheckerStore = store;
  return store;
}

/** Test hook. */
export function setStore(store: Store | null): void {
  globalForStore.__resumeTruthCheckerStore = store ?? undefined;
}
