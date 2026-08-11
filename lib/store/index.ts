import { neon } from "@neondatabase/serverless";
import { MemoryStore } from "./memory";
import { PostgresStore } from "./postgres";
import { Store } from "./types";

export * from "./types";

let instance: Store | null = null;

export function getStore(): Store {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  instance = url ? new PostgresStore(neon(url)) : new MemoryStore();
  return instance;
}

/** Test hook. */
export function setStore(store: Store | null): void {
  instance = store;
}
