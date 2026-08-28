"use client";

/**
 * A local copy of what the student has typed, for when the network is not
 * there.
 *
 * Autosave posts on a debounce. When that post fails the hook sets an error
 * state and the typing lives only in the tab — so a dropped connection plus a
 * closed laptop is a lost answer, and on an intermittent link that is a normal
 * afternoon rather than an edge case.
 *
 * **This is a recovery buffer, not a sync engine.** It never writes to the
 * server and never silently replaces what the server holds. The most it does is
 * tell the student "there is newer text here that never got through" and let
 * them decide. Anything more ambitious means resolving conflicts between two
 * versions of an answer, and getting that wrong loses work rather than saving
 * it — which is the opposite of the point.
 *
 * IndexedDB rather than localStorage: these answers run to 3000 characters
 * across a dozen fields, localStorage is synchronous and blocks the main thread
 * on write, and its 5MB ceiling is shared with everything else on the origin.
 */

const DB_NAME = "pnguot-challenge-drafts";
const DB_VERSION = 1;
const STORE = "steps";

export interface CachedDraft<T = unknown> {
  /** `${applicationId}:${step}` */
  key: string;
  applicationId: string;
  step: string;
  values: T;
  savedAt: number;
}

/**
 * Whether this browser can cache at all.
 *
 * Safari in private mode and some locked-down configurations expose
 * `indexedDB` and then throw on open, so the guard cannot be a property check
 * alone — every call below fails soft.
 */
function available(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  // Only a successful open is cached, for the same reason `sanitize.server.ts`
  // clears a rejected import: a rejected promise left in place would make the
  // failure permanent for the life of the tab.
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

function draftKey(applicationId: string, step: string): string {
  return `${applicationId}:${step}`;
}

/**
 * Every operation here is best-effort.
 *
 * A caching layer that can fail the form it is meant to protect is worse than
 * no caching layer, so a storage error is logged and swallowed rather than
 * surfaced. The student still has the server round trip, which is the path that
 * actually matters.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  if (!available()) return null;

  try {
    const db = await openDb();

    return await new Promise<T | null>((resolve) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));

      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    });
  } catch (error) {
    console.warn("[offline-draft] storage unavailable", error);
    return null;
  }
}

/** Records what is currently in the form, replacing any previous copy. */
export async function cacheDraft(
  applicationId: string,
  step: string,
  values: unknown,
): Promise<void> {
  const entry: CachedDraft = {
    key: draftKey(applicationId, step),
    applicationId,
    step,
    values,
    savedAt: Date.now(),
  };

  await withStore("readwrite", (store) => {
    /*
     * `structuredClone` up front rather than letting IndexedDB do it.
     *
     * React Hook Form values are plain objects, but a field can hold something
     * that will not clone — and IndexedDB reports that as a failed request
     * after the fact, which this layer then swallows. Cloning here turns it
     * into a throw the `catch` above can log, so a field that silently stops
     * being cached is at least visible in the console.
     */
    return store.put(structuredClone(entry));
  });
}

/** The cached copy for a step, or null when there is none. */
export async function readDraft<T>(
  applicationId: string,
  step: string,
): Promise<CachedDraft<T> | null> {
  return withStore<CachedDraft<T>>("readonly", (store) =>
    store.get(draftKey(applicationId, step)),
  );
}

/** Drops the cached copy — called once the server has accepted the values. */
export async function clearDraft(applicationId: string, step: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(draftKey(applicationId, step)));
}

/**
 * Removes every cached step for an application.
 *
 * Called on submit: once an entry is with the panel the student cannot edit it,
 * so a leftover local copy could only ever offer to restore text into a form
 * that will refuse to save it.
 */
export async function clearApplicationDrafts(applicationId: string): Promise<void> {
  if (!available()) return;

  try {
    const db = await openDb();
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.getAllKeys();

    await new Promise<void>((resolve) => {
      request.onsuccess = () => {
        const prefix = `${applicationId}:`;
        for (const key of request.result) {
          if (typeof key === "string" && key.startsWith(prefix)) store.delete(key);
        }
        resolve();
      };
      request.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch (error) {
    console.warn("[offline-draft] could not clear application drafts", error);
  }
}
