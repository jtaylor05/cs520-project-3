import express from "express";
import { DynamoDBConfigDatabase, DynamoDBScoreDatabase } from "./src/database.js";

const app = express();
const configDb = new DynamoDBConfigDatabase();
const scoreDb = new DynamoDBScoreDatabase();

app.use(express.json());
app.use(express.static("."));
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
});

// ─── Config ───────────────────────────────────────────────────────────────────

app.get("/api/config/next", async (req, res) => {
    try {
        console.log("fetching");
        const config = await configDb.getNextConfig();
        console.log(config);
        res.json(config);
    }
    catch (err) {
        res.json(err)
    }
});

app.get("/api/config/all", async (req, res) => {
    const configs = await configDb.getAllConfigs();
    res.json(configs);
});

app.post("/api/config", async (req, res) => {
    console.log("here")
    const { config, start, end } = req.body;
    const config_id = await configDb.addConfig(config, start, end);
    res.json({ config_id });
});

app.delete("/api/config/:config_id", async (req, res) => {
    await configDb.removeConfig(req.params.config_id);
    res.json({ ok: true });
});

// ─── Scores ───────────────────────────────────────────────────────────────────

app.get("/api/scores/chart/:config_id", async (req, res) => {
    const scores = await scoreDb.getAllData(req.params.config_id);
    const lengths = scores
        .map((entry) => Array.isArray(entry.score) ? entry.score.length : Number(entry.score))
        .filter((value) => Number.isFinite(value) && value >= 0)
        .map((value) => Math.floor(value));

    if (lengths.length === 0) {
        return res.json({ labels: [], datasets: [{ label: 'Moves', data: [] }] });
    }

    const minLength = Math.min(...lengths);
    let maxLength = Math.max(...lengths);
    if (maxLength - minLength < 10) {
        maxLength = minLength + 10;
    }
    const counts = {};

    for (let length = minLength; length <= maxLength; length++) {
        counts[length] = 0;
    }

    lengths.forEach((length) => {
        counts[length] = (counts[length] || 0) + 1;
    });

    const labels = Object.keys(counts).map((value) => Number(value));
    const data = labels.map((label) => counts[label]);

    res.json({
        labels,
        datasets: [
            {
                label: 'Moves',
                data,
            },
        ],
    });
})

app.get("/api/scores/config/:config_id", async (req, res) => {
    const scores = await scoreDb.getAllData(req.params.config_id);
    res.json(scores);
});

app.get("/api/scores/user/:user_id", async (req, res) => {
    const scores = await scoreDb.getUserData(req.params.user_id);
    res.json(scores);
});

app.get("/api/scores/:user_id/:config_id", async (req, res) => {
    const score = await scoreDb.getSingleUserData(req.params.user_id, req.params.config_id);
    res.json(score);
});

app.post("/api/scores/:user_id/:config_id", async (req, res) => {
    const { score } = req.body;
    await scoreDb.setSingleUserData(req.params.user_id, req.params.config_id, score);
    res.json({ ok: true });
});

app.delete("/api/scores/:user_id/:config_id", async (req, res) => {
    await scoreDb.removeSingleUserData(req.params.user_id, req.params.config_id);
    res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(3000, () => console.log("Listening on http://localhost:3000"));