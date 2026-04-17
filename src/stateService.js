import { DefaultGameConfig } from "./config.js";

export class StateService {
    constructor(game) {
        this.game = game;
    }

    saveState() {
        const state = this.game.saveState();
        localStorage.setItem('gameState', JSON.stringify(state));
    }

    loadState() {
        const data = localStorage.getItem('gameState');
        try {
            const state = JSON.parse(data);
            this.game.loadState(state);
        }
        catch (e) {
            console.error("Failed to load state:", e);
            this.game.setConfig(new DefaultGameConfig(3, 3));
        }
    }
}