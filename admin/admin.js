import { addConfig, deleteScore, fetchAllConfigs, fetchScoreChartByConfig, fetchScoresByConfig, removeConfig, getUuid, getSha256 } from '../src/api.js';
import storage from '../src/storage.js';

const ADMIN_PASSWORD_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
let backendConnected = false;
let activeScoreConfigId = null;

async function sha256Hex(value) {
    return getSha256(value);
}

const elements = {
    loginSection: document.getElementById('admin-login'),
    adminPanel: document.getElementById('admin-panel'),
    passwordInput: document.getElementById('admin-password'),
    loginBtn: document.getElementById('admin-login-btn'),
    loginError: document.getElementById('login-error'),
    awsRegion: document.getElementById('aws-region'),
    awsAccessKey: document.getElementById('aws-access-key'),
    awsSecretKey: document.getElementById('aws-secret-key'),
    awsConnectBtn: document.getElementById('aws-connect-btn'),
    awsStatus: document.getElementById('aws-status'),
    refreshConfigs: document.getElementById('refresh-configs'),
    configsTableBody: document.querySelector('#configs-table tbody'),
    configFileInput: document.getElementById('config-file-input'),
    configStart: document.getElementById('config-start'),
    configEnd: document.getElementById('config-end'),
    configAddBtn: document.getElementById('config-add-btn'),
    configAddStatus: document.getElementById('config-add-status'),
    refreshScores: document.getElementById('refresh-scores'),
    scoreSummary: document.getElementById('score-summary'),
    configViewerDetails: document.getElementById('config-viewer-details'),
};

function setLoginError(message) {
    elements.loginError.textContent = message;
}

function setAwsStatus(message, isError = false) {
    elements.awsStatus.textContent = message;
    elements.awsStatus.style.color = isError ? '#b32d2e' : '#2d7a32';
}

function formatTimestamp(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function requireConnection() {
    if (!backendConnected) {
        throw new Error('Backend API is not initialized.');
    }
}

async function deleteScoreEntry(user_id, config_id) {
    if (!confirm(`Delete score for user ${user_id} on config ${config_id}?`)) {
        return;
    }

    try {
        await deleteScore(user_id, config_id);
        setAwsStatus(`Deleted score for ${user_id} on ${config_id}.`, false);
        if (activeScoreConfigId === config_id) {
            await showConfigScores(config_id);
        } else {
            await refreshAllScores();
        }
    } catch (error) {
        console.error(error);
        setAwsStatus('Failed to delete score entry.', true);
    }
}

function showAdminPanel() {
    elements.loginSection.hidden = true;
    elements.adminPanel.hidden = false;
}

async function connectAws() {
    try {
        await fetchAllConfigs();
        backendConnected = true;
        setAwsStatus('Connected to backend API. AWS credentials are not required.');
        await refreshConfigs();
    } catch (error) {
        console.error('Connect failed', error);
        setAwsStatus('Could not connect to backend API.', true);
    }
}

function renderConfigRow(item) {
    const innerId = item.config?.id;
    const idDisplay = item.config_id && innerId && item.config_id !== innerId
        ? `${item.config_id}<br><small>${innerId}</small>`
        : (item.config_id || innerId || '-');

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${idDisplay}</td>
        <td>${formatTimestamp(item.start)}</td>
        <td>${formatTimestamp(item.end)}</td>
        <td class="admin-actions">
            <button class="open-btn">Open</button>
            <button class="scores-btn">View Scores</button>
            <button class="chart-btn">Show Chart</button>
            <button class="delete-btn">Delete</button>
        </td>
    `;

    tr.querySelector('.open-btn').addEventListener('click', () => openConfigInGame(item));
    tr.querySelector('.scores-btn').addEventListener('click', () => showConfigScores(item.config_id));
    tr.querySelector('.chart-btn').addEventListener('click', () => showConfigChart(item.config_id));
    tr.querySelector('.delete-btn').addEventListener('click', async () => {
        if (!confirm(`Delete config ${item.config_id}?`)) return;
        try {
            await removeConfig(item.config_id);
            await refreshConfigs();
        } catch (error) {
            console.error(error);
            setAwsStatus('Failed to delete config.', true);
        }
    });

    return tr;
}

async function refreshConfigs() {
    try {
        requireConnection();
        const configs = await fetchAllConfigs();
        elements.configsTableBody.innerHTML = '';
        if (configs.length === 0) {
            elements.configsTableBody.innerHTML = '<tr><td colspan="4">No configs found.</td></tr>';
            return;
        }
        configs.forEach((config) => {
            elements.configsTableBody.appendChild(renderConfigRow(config));
        });
    } catch (error) {
        console.error(error);
        setAwsStatus('Unable to load configs.', true);
    }
}

function openConfigInGame(item) {
    if (!item?.config) {
        setAwsStatus('Loaded config payload is invalid.', true);
        return;
    }
    storage.setItem('adminConfigToLoad', JSON.stringify(item.config));
    window.location.href = '../index.html';
}

async function showConfigScores(config_id) {
    try {
        requireConnection();
        activeScoreConfigId = config_id;
        const scores = await fetchScoresByConfig(config_id);
        renderScoreDetails(config_id, scores);
    } catch (error) {
        console.error(error);
        setAwsStatus('Failed to load config-specific scores.', true);
    }
}

async function showConfigChart(config_id) {
    try {
        requireConnection();
        const chartData = await fetchScoreChartByConfig(config_id);
        if (!chartData || !Array.isArray(chartData.labels)) {
            setAwsStatus('Chart data is unavailable for this config.', true);
            return;
        }

        elements.configViewerDetails.innerHTML = `
            <h3>Score chart for config ${config_id}</h3>
            <canvas id="config-score-chart" width="600" height="320"></canvas>
        `;

        const canvas = document.getElementById('config-score-chart');
        if (!canvas) {
            throw new Error('Chart canvas not found');
        }

        if (window.adminChart) {
            window.adminChart.destroy();
        }

        const ctx = canvas.getContext('2d');
        window.adminChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Score distribution',
                    },
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Moves' },
                    },
                    y: {
                        title: { display: true, text: 'Count' },
                        beginAtZero: true,
                    },
                },
            },
        });
    } catch (error) {
        console.error(error);
        setAwsStatus('Failed to load score chart.', true);
    }
}

function renderScoreDetails(config_id, scores) {
    const rows = scores
        .map(
            (score) =>
                `<tr data-user-id="${score.user_id}" data-config-id="${score.config_id}">
                    <td>${score.user_id}</td>
                    <td>${score.config_id}</td>
                    <td>${score.score}</td>
                    <td><button class="delete-score-btn">Delete</button></td>
                </tr>`
        )
        .join('');

    elements.configViewerDetails.innerHTML = `
        <h3>Scores for config ${config_id}</h3>
        <table class="admin-data-table">
            <thead><tr><th>User</th><th>Config</th><th>Score</th><th>Actions</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4">No scores for this config.</td></tr>'}</tbody>
        </table>
    `;

    elements.configViewerDetails.querySelectorAll('.delete-score-btn').forEach((button) => {
        const row = button.closest('tr');
        const user_id = row.dataset.userId;
        const config_id = row.dataset.configId;
        button.addEventListener('click', () => deleteScoreEntry(user_id, config_id));
    });
}

async function refreshAllScores() {
    try {
        requireConnection();
        const configs = await fetchAllConfigs();
        const allScores = (
            await Promise.all(
                configs.map(async (config) => {
                    const scores = await fetchScoresByConfig(config.config_id);
                    return scores.map((score) => ({ ...score, config_id: config.config_id }));
                })
            )
        ).flat();

        const rows = allScores
            .map(
                (score) =>
                    `<tr data-user-id="${score.user_id}" data-config-id="${score.config_id}">
                        <td>${score.user_id}</td>
                        <td>${score.config_id}</td>
                        <td>${score.score}</td>
                        <td><button class="delete-score-btn">Delete</button></td>
                    </tr>`
            )
            .join('');

        elements.scoreSummary.innerHTML = `
            <p>Total score entries: ${allScores.length}</p>
            <table class="admin-data-table">
                <thead><tr><th>User</th><th>Config</th><th>Score</th><th>Actions</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="4">No score entries.</td></tr>'}</tbody>
            </table>
        `;

        elements.scoreSummary.querySelectorAll('.delete-score-btn').forEach((button) => {
            const row = button.closest('tr');
            const user_id = row.dataset.userId;
            const config_id = row.dataset.configId;
            button.addEventListener('click', () => deleteScoreEntry(user_id, config_id));
        });
    } catch (error) {
        console.error(error);
        setAwsStatus('Could not load score entries.', true);
    }
}

async function addConfigFromFile() {
    try {
        requireConnection();
        const file = elements.configFileInput.files[0];
        if (!file) {
            elements.configAddStatus.textContent = 'Choose a JSON config file first.';
            return;
        }

        const start = elements.configStart.value;
        const end = elements.configEnd.value;
        if (!start || !end) {
            elements.configAddStatus.textContent = 'Provide both a start and end date.';
            return;
        }

        const fileText = await file.text();
        const payload = JSON.parse(fileText);
        const payloadId = payload?.id;
        const hasValidId = typeof payloadId === 'string' ? payloadId.trim().length > 0 : Number.isFinite(payloadId);
        if (!hasValidId) {
            payload.id = await getUuid();
        }
        const config_id = await addConfig(payload, new Date(start), new Date(end));
        elements.configAddStatus.textContent = `Saved config ${config_id}.`;
        await refreshConfigs();
    } catch (error) {
        console.error(error);
        elements.configAddStatus.textContent = 'Failed to add config. Check file format and backend connection.';
    }
}

function setAdminAuthVisible() {
    elements.adminPanel.hidden = true;
    elements.loginSection.hidden = false;
}

function setAdminAuthSuccess() {
    elements.adminPanel.hidden = false;
    elements.loginSection.hidden = true;
    setAwsStatus('Backend API ready. Click Connect to verify.', false);
}
console.log(elements.loginBtn)
elements.loginBtn.addEventListener('click', async () => {
    const value = elements.passwordInput.value;
    const hashedValue = await sha256Hex(value);
    if (hashedValue === ADMIN_PASSWORD_HASH) {
        setAdminAuthSuccess();
    } else {
        setLoginError('Invalid password.');
    }
});

elements.awsConnectBtn.addEventListener('click', async () => {
    await connectAws();
});

elements.refreshConfigs.addEventListener('click', async () => {
    await refreshConfigs();
});

elements.refreshScores.addEventListener('click', async () => {
    await refreshAllScores();
});

elements.configAddBtn.addEventListener('click', async () => {
    await addConfigFromFile();
});

setAdminAuthVisible();
