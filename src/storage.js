let storageAdapter;

if (typeof globalThis.localStorage !== 'undefined') {
    storageAdapter = globalThis.localStorage;
} else if (typeof process !== 'undefined' && process.versions?.node) {
    const fs = await import('fs');
    const path = await import('path');
    const storageFile = process.env.NODE_STORAGE_FILE || path.join(process.cwd(), '.node-storage.json');

    const ensureStore = () => {
        try {
            if (!fs.existsSync(storageFile)) {
                fs.writeFileSync(storageFile, '{}', 'utf8');
            }
            const raw = fs.readFileSync(storageFile, 'utf8');
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            return {};
        }
    };

    const writeStore = (store) => {
        try {
            fs.writeFileSync(storageFile, JSON.stringify(store, null, 2), 'utf8');
        } catch (error) {
            // ignore write failures for now
        }
    };

    storageAdapter = {
        getItem(key) {
            const store = ensureStore();
            return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
        },
        setItem(key, value) {
            const store = ensureStore();
            store[key] = value;
            writeStore(store);
        },
        removeItem(key) {
            const store = ensureStore();
            delete store[key];
            writeStore(store);
        },
        clear() {
            writeStore({});
        },
    };
} else {
    const inMemory = {};
    storageAdapter = {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(inMemory, key) ? inMemory[key] : null;
        },
        setItem(key, value) {
            inMemory[key] = value;
        },
        removeItem(key) {
            delete inMemory[key];
        },
        clear() {
            Object.keys(inMemory).forEach((key) => delete inMemory[key]);
        },
    };
}

export default storageAdapter;
