const BASE = "/api";

// ─── Utilities ─────────────────────────────────────────────────────────────────

export async function getUuid() {
    const response = await fetch(`${BASE}/uuid`);
    if (!response.ok) {
        throw new Error('Failed to get uuid from backend');
    }
    const data = await response.json();
    return data.uuid;
}

export async function getSha256(value) {
    const response = await fetch(`${BASE}/hash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
    });
    if (!response.ok) {
        throw new Error('Failed to get sha256 from backend');
    }
    const data = await response.json();
    return data.hash;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function fetchNextConfig() {
    return fetch(`${BASE}/config/next`).then(r => r.json());
}

export async function fetchAllConfigs() {
    return fetch(`${BASE}/config/all`).then(r => r.json());
}

export async function addConfig(config, start, end) {
    const { config_id } = await fetch(`${BASE}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, start, end }),
    }).then(r => r.json());
    return config_id;
}

export async function removeConfig(config_id) {
    await fetch(`${BASE}/config/${config_id}`, { method: "DELETE" });
}

// ─── Scores ───────────────────────────────────────────────────────────────────

export async function fetchScoresByConfig(config_id) {
    return fetch(`${BASE}/scores/config/${config_id}`).then(r => r.json());
}

export async function fetchScoreChartByConfig(config_id) {
    return fetch(`${BASE}/scores/chart/${config_id}`).then(r => r.json());
}

export async function fetchScoresByUser(user_id) {
    return fetch(`${BASE}/scores/user/${user_id}`).then(r => r.json());
}

export async function fetchScore(user_id, config_id) {
    return fetch(`${BASE}/scores/${user_id}/${config_id}`).then(r => r.json());
}

export async function deleteScore(user_id, config_id) {
    await fetch(`${BASE}/scores/${user_id}/${config_id}`, { method: 'DELETE' });
}

export async function submitScore(user_id, config_id, score) {
    await fetch(`${BASE}/scores/${user_id}/${config_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
    });
}