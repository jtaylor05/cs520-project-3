import {
    DynamoDBClient,
    DeleteItemCommand,
    GetItemCommand,
    PutItemCommand,
    QueryCommand,
    ScanCommand,
    UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

// ─── Base ────────────────────────────────────────────────────────────────────

export class ConfigDatabase {
    constructor() {}

    getNextConfig() {
        return DefaultGameConfig(3, 3);
    }

    getAllConfigs() {
        return [];
    }

    addConfig(config, start, end) {}

    removeConfig(config_id) {}
}

export class ScoreDatabase {
    constructor() {}

    getAllData(config_id) {
        return [];
    }

    getUserData(user_id) {
        return [];
    }

    setSingleUserData(user_id, config_id, score) {}

    getSingleUserData(user_id, config_id) {
        return [];
    }

    removeSingleUserData(user_id, config_id) {}
}

// ─── DynamoDB: Config ────────────────────────────────────────────────────────

/**
 * DynamoDB table schema for Configs:
 *
 *   Table name : Configs
 *   PK         : config_id  (S)  – UUID generated at write time
 *
 * Additional attributes stored per item:
 *   config  – marshalled game-config object
 *   start   – ISO-8601 string
 *   end     – ISO-8601 string
 */
export class DynamoDBConfigDatabase extends ConfigDatabase {
    /**
     * @param {string} tableName   - DynamoDB table name (default: "Configs")
     * @param {object} clientConfig - Optional AWS client config (region, credentials, …)
     */
    constructor(tableName = "Configs", clientConfig = {}) {
        super();
        this.tableName = tableName;
        this.client = new DynamoDBClient(clientConfig);
    }

    /**
     * Returns the config whose active window contains right now.
     * Falls back to the base-class default when no matching config is found.
     */
    async getNextConfig() {
        const now = new Date().toISOString();

        const result = await this.client.send(
            new ScanCommand({
                TableName: this.tableName,
                FilterExpression: "#start <= :now AND #end >= :now",
                ExpressionAttributeNames: {
                    "#start": "start",
                    "#end": "end",
                },
                ExpressionAttributeValues: marshall({
                    ":now": now,
                }),
            })
        );

        console.log("result", result)

        if (!result.Items || result.Items.length === 0) {
            return super.getNextConfig();
        }

        // Among all currently-active configs pick the one that started most recently.
        const items = result.Items.map(unmarshall).sort(
            (a, b) => new Date(b.start) - new Date(a.start)
        );

        return items[0].config;
    }

    /** Returns every config stored in the table. */
    async getAllConfigs() {
        const result = await this.client.send(
            new ScanCommand({ TableName: this.tableName })
        );

        return (result.Items ?? []).map((item) => unmarshall(item));
    }

    /**
     * Persists a new config entry.
     *
     * @param {object} config - Game-config object (e.g. from DefaultGameConfig)
     * @param {string|Date} start - Window open  (ISO string or Date)
     * @param {string|Date} end   - Window close (ISO string or Date)
     * @returns {string} The generated config_id
     */
    async addConfig(config, start, end) {
        const providedId = config?.id;
        const hasValidId = typeof providedId === 'string'
            ? providedId.trim().length > 0
            : Number.isFinite(providedId);
        console.log(hasValidId)
        const config_id = hasValidId ? String(providedId) : crypto.randomUUID();
        if (config && !hasValidId) {
            config.id = config_id;
        }

        await this.client.send(
            new PutItemCommand({
                TableName: this.tableName,
                Item: marshall({
                    config_id,
                    config,
                    start: start instanceof Date ? start.toISOString() : start,
                    end: end instanceof Date ? end.toISOString() : end,
                }),
            })
        );

        return config_id;
    }

    /**
     * Deletes a config entry by its ID.
     *
     * @param {string} config_id
     */
    async removeConfig(config_id) {
        await this.client.send(
            new DeleteItemCommand({
                TableName: this.tableName,
                Key: marshall({ config_id }),
            })
        );
    }
}

// ─── Base: Save ──────────────────────────────────────────────────────────────

export class SaveDatabase {
    constructor() {}

    // Persists a JSON-serialisable game state for a given user.
    saveState(user_id, state) {}

    // Returns the parsed state object, or null if none exists.
    loadState(user_id) {
        return null;
    }
}

// ─── File-based: Save ─────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";

/**
 * Stores one JSON file per user under a local directory.
 *
 *   saves/
 *     <user_id>.json
 */
export class FileSaveDatabase extends SaveDatabase {
    /**
     * @param {string} saveDir - Directory to store save files (default: "saves")
     */
    constructor(saveDir = "saves") {
        super();
        this.saveDir = saveDir;
        fs.mkdirSync(saveDir, { recursive: true });
    }

    #filePath(user_id) {
        return path.join(this.saveDir, `${user_id}.json`);
    }

    /** Writes the game state to disk as JSON. */
    saveState(user_id, state) {
        fs.writeFileSync(this.#filePath(user_id), JSON.stringify(state), "utf-8");
    }

    /**
     * Reads and parses the saved state from disk.
     * Returns null if no save file exists for this user.
     */
    loadState(user_id) {
        const filePath = this.#filePath(user_id);
        if (!fs.existsSync(filePath)) return null;
        try {
            return JSON.parse(fs.readFileSync(filePath, "utf-8"));
        } catch (e) {
            console.error("Failed to load state from file:", e);
            return null;
        }
    }
}

// ─── DynamoDB: Save ───────────────────────────────────────────────────────────

/**
 * DynamoDB table schema for SaveStates:
 *
 *   Table name : SaveStates
 *   PK         : user_id (S)
 *
 * Additional attributes stored per item:
 *   state – JSON string of the full game state
 *   saved_at – ISO-8601 timestamp of the last save
 */
export class DynamoDBSaveDatabase extends SaveDatabase {
    /**
     * @param {string} tableName    - DynamoDB table name (default: "SaveStates")
     * @param {object} clientConfig - Optional AWS client config
     */
    constructor(tableName = "SaveStates", clientConfig = {}) {
        super();
        this.tableName = tableName;
        this.client = new DynamoDBClient(clientConfig);
    }

    /**
     * Persists the game state for a user. Overwrites any previous save.
     *
     * @param {string} user_id
     * @param {object} state - JSON-serialisable game state
     */
    async saveState(user_id, state) {
        await this.client.send(
            new PutItemCommand({
                TableName: this.tableName,
                Item: marshall({
                    user_id,
                    state: JSON.stringify(state),
                    saved_at: new Date().toISOString(),
                }),
            })
        );
    }

    /**
     * Loads and parses the saved state for a user.
     * Returns null if no save exists.
     *
     * @param {string} user_id
     * @returns {object|null}
     */
    async loadState(user_id) {
        const result = await this.client.send(
            new GetItemCommand({
                TableName: this.tableName,
                Key: marshall({ user_id }),
            })
        );

        if (!result.Item) return null;
        try {
            return JSON.parse(unmarshall(result.Item).state);
        } catch (e) {
            console.error("Failed to parse saved state from DynamoDB:", e);
            return null;
        }
    }
}

// ─── StateService ─────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for the localStorage-based StateService.
 * Works with any SaveDatabase implementation (file or DynamoDB).
 *
 * Usage:
 *   const service = new StateService(game, new FileSaveDatabase(), "user_123");
 *   await service.saveState();
 *   await service.loadState();
 */
export class StateService {
    /**
     * @param {object}       game     - Game instance with saveState() / loadState() / setConfig()
     * @param {SaveDatabase} db       - Any SaveDatabase implementation
     * @param {string}       user_id  - Identifies whose save slot to use
     */
    constructor(game, db, user_id) {
        this.game = game;
        this.db = db;
        this.user_id = user_id;
    }

    async saveState() {
        const state = this.game.saveState();
        await this.db.saveState(this.user_id, state);
    }

    async loadState() {
        try {
            const state = await this.db.loadState(this.user_id);
            if (state) {
                this.game.loadState(state);
            } else {
                this.game.setConfig(new DefaultGameConfig(3, 3));
            }
        } catch (e) {
            console.error("Failed to load state:", e);
            this.game.setConfig(new DefaultGameConfig(3, 3));
        }
    }
}

// ─── DynamoDB: Scores ────────────────────────────────────────────────────────

/**
 * DynamoDB table schema for Scores:
 *
 *   Table name : Scores
 *   PK         : user_id   (S)
 *   SK         : config_id (S)
 *
 * GSI (optional but recommended for getAllData):
 *   GSI name   : config_id-index
 *   PK         : config_id (S)
 *
 * Additional attributes stored per item:
 *   score – number
 */
export class DynamoDBScoreDatabase extends ScoreDatabase {
    /**
     * @param {string} tableName    - DynamoDB table name (default: "Scores")
     * @param {string} configIndex  - GSI name for config-based queries (default: "config_id-index")
     * @param {object} clientConfig - Optional AWS client config
     */
    constructor(
        tableName = "Scores",
        configIndex = "config_id-index",
        clientConfig = {}
    ) {
        super();
        this.tableName = tableName;
        this.configIndex = configIndex;
        this.client = new DynamoDBClient(clientConfig);
    }

    /**
     * Returns every score entry for a given config.
     * Requires the config_id GSI to be present on the table.
     *
     * @param {string} config_id
     * @returns {Array<{user_id, config_id, score}>}
     */
    async getAllData(config_id) {
        const result = await this.client.send(
            new QueryCommand({
                TableName: this.tableName,
                IndexName: this.configIndex,
                KeyConditionExpression: "config_id = :cid",
                ExpressionAttributeValues: marshall({ ":cid": config_id }),
            })
        );

        return (result.Items ?? []).map(unmarshall);
    }

    /**
     * Returns all score entries for a specific user across every config.
     *
     * @param {string} user_id
     * @returns {Array<{user_id, config_id, score}>}
     */
    async getUserData(user_id) {
        const result = await this.client.send(
            new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: "user_id = :uid",
                ExpressionAttributeValues: marshall({ ":uid": user_id }),
            })
        );

        return (result.Items ?? []).map(unmarshall);
    }

    /**
     * Creates or replaces the score entry for (user_id, config_id).
     *
     * @param {string} user_id
     * @param {string} config_id
     * @param {number} score
     */
    async setSingleUserData(user_id, config_id, score) {
        await this.client.send(
            new PutItemCommand({
                TableName: this.tableName,
                Item: marshall({ user_id, config_id, score }),
            })
        );
    }

    /**
     * Returns the score entry for a single (user_id, config_id) pair,
     * or an empty array when no entry exists.
     *
     * @param {string} user_id
     * @param {string} config_id
     * @returns {object|[]}
     */
    async getSingleUserData(user_id, config_id) {
        const result = await this.client.send(
            new GetItemCommand({
                TableName: this.tableName,
                Key: marshall({ user_id, config_id }),
            })
        );

        return result.Item ? unmarshall(result.Item) : [];
    }

    /**
     * Deletes the score entry for a single (user_id, config_id) pair.
     *
     * @param {string} user_id
     * @param {string} config_id
     */
    async removeSingleUserData(user_id, config_id) {
        await this.client.send(
            new DeleteItemCommand({
                TableName: this.tableName,
                Key: marshall({ user_id, config_id }),
            })
        );
    }
}