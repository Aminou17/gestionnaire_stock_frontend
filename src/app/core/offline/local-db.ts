// Petite base de l'appareil (IndexedDB) pour travailler sans internet :
// "kv" garde le catalogue et l'état de la caisse, "outbox" les ventes qui attendent d'être envoyées.
// Sans IndexedDB (navigation privée très stricte, tests), les données restent en mémoire.
const DB_NAME = "boutiki";
const DB_VERSION = 1;

export type StoreName = "kv" | "outbox";

let opening: Promise<IDBDatabase | null> | null = null;
const memory: Record<StoreName, Map<string, unknown>> = { kv: new Map(), outbox: new Map() };

function open(): Promise<IDBDatabase | null> {
    if (opening) return opening;

    opening = new Promise((resolve) => {
        if (typeof indexedDB === "undefined") return resolve(null);

        try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
                if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox");
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        } catch {
            resolve(null);
        }
    });

    return opening;
}

function run<T>(
    store: StoreName,
    mode: IDBTransactionMode,
    action: (s: IDBObjectStore) => IDBRequest,
) {
    return open().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                if (!db) return reject(new Error("no-db"));
                const request = action(db.transaction(store, mode).objectStore(store));
                request.onsuccess = () => resolve(request.result as T);
                request.onerror = () => reject(request.error);
            }),
    );
}

export async function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
    try {
        return await run<T>(store, "readonly", (s) => s.get(key));
    } catch {
        return memory[store].get(key) as T | undefined;
    }
}

export async function dbSet(store: StoreName, key: string, value: unknown) {
    try {
        await run(store, "readwrite", (s) => s.put(value, key));
    } catch {
        memory[store].set(key, value);
    }
}

export async function dbDelete(store: StoreName, key: string) {
    try {
        await run(store, "readwrite", (s) => s.delete(key));
    } catch {
        memory[store].delete(key);
    }
}

export async function dbAll<T>(store: StoreName): Promise<T[]> {
    try {
        return await run<T[]>(store, "readonly", (s) => s.getAll());
    } catch {
        return [...memory[store].values()] as T[];
    }
}
