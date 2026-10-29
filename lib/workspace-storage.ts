// Keep small workspaces compatible with existing browser storage. Once a key
// overflows, IndexedDB becomes authoritative for that key, including after reload.
const databaseName = "progressly-workspaces";
const storeName = "workspaces";
const channelName = "progressly-workspace-changes";

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Close other Progressly tabs and try saving again."));
    };
  });
}

async function storedWorkspace(key: string): Promise<string | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

async function persistWorkspace(key: string, value: string): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(value, key);
      // A successful request can still be rolled back: wait for the commit.
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

function isQuotaError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export async function readWorkspaceStorage(
  key: string,
): Promise<string | null> {
  // Never fall back to an older localStorage value if IndexedDB cannot be read.
  return (await storedWorkspace(key)) ?? localStorage.getItem(key);
}

export async function writeWorkspaceStorage(key: string, value: string) {
  try {
    if ((await storedWorkspace(key)) === undefined) {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (error) {
        if (!isQuotaError(error)) throw error;
      }
    }
    await persistWorkspace(key, value);
  } catch (error) {
    if (isQuotaError(error) || typeof indexedDB === "undefined")
      throw new Error(
        "Your browser storage is full or unavailable. Your previous workspace is unchanged. Export a backup before freeing browser space, then try again.",
        { cause: error },
      );
    throw error;
  }
  // Remove only the superseded value, and only after the new copy is durable.
  try {
    localStorage.removeItem(key);
  } catch {
    // Reads prefer IndexedDB even if browser settings prevent cleanup.
  }
  try {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage(key);
    channel.close();
  } catch {
    // Notification availability must not change a committed save's outcome.
  }
}

export function subscribeWorkspaceStorage(onChange: (key: string) => void) {
  const changed = (event: StorageEvent) => {
    if (event.key) onChange(event.key);
  };
  window.addEventListener("storage", changed);
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(channelName);
  if (channel)
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data === "string") onChange(event.data);
    };
  return () => {
    window.removeEventListener("storage", changed);
    channel?.close();
  };
}
