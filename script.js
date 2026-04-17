import { Game, AggregateMove } from './src/game.js';
import { generateConfig, DefaultGameConfig } from './src/config.js';
import { DisplayRenderer, ScoreGraphRenderer } from './src/render.js';
import { fetchNextConfig, fetchScore, submitScore, getUuid } from './src/api.js';
import { StateService } from './src/stateService.js';

const MARGINS = 100;

// ─── User identity ────────────────────────────────────────────────────────────

async function getUserId() {
    let userId = localStorage.getItem('user_id');
    if (!userId) {
        userId = await getUuid();
        localStorage.setItem('user_id', userId);
    }
    return userId;
}

let USER_ID = null;

// ─── Game setup ───────────────────────────────────────────────────────────────

const gameEvents = new EventTarget();
const game = new Game(gameEvents, new DefaultGameConfig(3, 3));
const stateService = new StateService(game);
const renderService = new DisplayRenderer(game, MARGINS);
const scoreRenderer = new ScoreGraphRenderer(game);

// True once the player has submitted a score for the current config
let submittedScore = false;

// True once the game is in a completed (won) state
function gameIsWon() {
    return game.status === 'Player wins!';
}

// ─── DOM elements ─────────────────────────────────────────────────────────────

const elements = {
    fileBtn:         document.getElementById('load-config'),
    configFileInput: document.getElementById('config-file'),
    submitScoreBtn:  document.getElementById('submit-score-btn'),
    winOverlay:      document.getElementById('win-overlay'),
    loseOverlay:     document.getElementById('lose-overlay'),
    winMessage:      document.getElementById('win-message'),
    loseMessage:     document.getElementById('lose-message'),
    closeWinBtn:     document.getElementById('close-win'),
    closeLoseBtn:    document.getElementById('close-lose'),
    scoreChart:      document.getElementById('score-chart'),
};

// ─── Submit button ────────────────────────────────────────────────────────────

// Visible only when the game is won and the player hasn't submitted yet
function updateSubmitButton() {
    const canSubmit = gameIsWon() && !submittedScore;
    elements.submitScoreBtn.hidden = !canSubmit;
    elements.submitScoreBtn.disabled = !canSubmit;
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

function hideOverlays() {
    elements.winOverlay.style.display = 'none';
    elements.loseOverlay.style.display = 'none';
}

function showWinOverlay() {
    elements.winMessage.textContent = `You won in ${game.moves.length} moves!`;
    elements.winOverlay.style.display = 'block';
    // Only render the score chart after the player has submitted
    if (submittedScore) {
        scoreRenderer.render(elements.scoreChart);
    }
}

// ─── State helpers ────────────────────────────────────────────────────────────

function saveState() {
    stateService.saveState();
}

function loadState() {
    stateService.loadState();
    renderService.render(document);
}

// ─── Initialisation ───────────────────────────────────────────────────────────

const adminConfigJson = localStorage.getItem('adminConfigToLoad');
let adminConfig = null;
if (adminConfigJson) {
    try {
        adminConfig = JSON.parse(adminConfigJson);
    } catch (error) {
        console.warn('Invalid admin saved config:', error);
    }
    localStorage.removeItem('adminConfigToLoad');
}

async function initializeDatabase() {
    try {
        USER_ID = await getUserId();
        // Admin preview — load the injected config directly
        if (adminConfig) {
            game.setConfig(generateConfig(adminConfig));
            renderService.render(document);
            saveState();
            return;
        }

        const nextConfig = await fetchNextConfig();
        loadState();

        if (nextConfig.id !== game.config?.id) {
            // New config available — reset the game to it
            game.setConfig(generateConfig(nextConfig));
            renderService.render(document);
            saveState();
        } else {
            // Same config — check if the player already submitted
            const prevScore = await fetchScore(USER_ID, game.config.id);
            const moves = prevScore.score;
            if (moves.length !== 0) {
                submittedScore = true;
                game.moves = moves.map(m => AggregateMove.loadState(m, game));
                game.setMoveIndex(game.moves.length - 1);
            }
        }

        updateSubmitButton();
        console.log('Config loaded:', game.config.id);
    } catch (error) {
        console.error('Failed to initialize:', error);
    }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

gameEvents.addEventListener('update', async () => {
    hideOverlays();
    renderService.render(document);
    updateSubmitButton();
    saveState();
});

gameEvents.addEventListener('win', () => {
    updateSubmitButton();
    // Only show the win overlay automatically if already submitted
    // (otherwise the player sees it after they click submit)
    if (submittedScore) showWinOverlay();
});

gameEvents.addEventListener('lose', () => {
    hideOverlays();
    elements.loseMessage.textContent = `You lost after ${game.moves.length} moves.`;
    elements.loseOverlay.style.display = 'block';
});

elements.submitScoreBtn.addEventListener('click', async () => {
    if (!gameIsWon() || !game.config?.id || submittedScore) return;
    try {
        const savedState = game.saveState();
        await submitScore(USER_ID, game.config.id, savedState.moves);
        submittedScore = true;
        updateSubmitButton();
        showWinOverlay();
    } catch (error) {
        console.error('Failed to submit score:', error);
        alert('Could not submit score. Please try again.');
    }
});

elements.fileBtn.addEventListener('click', () => {
    elements.configFileInput.value = null;
    elements.configFileInput.click();
});

elements.configFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const config = generateConfig(JSON.parse(e.target.result));
        game.setConfig(config);
        renderService.render(document);
        saveState();
    };
    reader.readAsText(new Blob([file], { type: 'application/json' }));
});

elements.closeWinBtn.addEventListener('click', hideOverlays);
elements.closeLoseBtn.addEventListener('click', hideOverlays);

// ─── Boot ─────────────────────────────────────────────────────────────────────

loadState();
renderService.render(document);
initializeDatabase();