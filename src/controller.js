import { NODE_TAG } from "./render.js"

export function handleNodeClick(game, node) {
    if (!game.inProgress()) return;
    if (game.selectedAgent) {
        // Move to node
        if (game.selectedAgent.position.neighbors.includes(node) && !game.agents.some(a => a.position === node) && !(game.target.position === node)) {
            game.performRound(game.selectedAgent, node);
            game.selectedAgent = null;
        } else {
            game.selectedAgent = null;
        }
    } else {
        // Select agent
        const agent = game.agents.find(a => a.position === node);
        if (agent) {
            game.selectedAgent = agent;
        }
    }
}

export function handleAngryCat(node_pressed) {
    if (node_pressed.classList.contains('target')) {
        node_pressed.classList.add('angry');
        console.log(node_pressed)
        setTimeout(() => {
            if (node_pressed.classList.contains('angry')) node_pressed.classList.remove('angry')
        }, 700);
    }
}

export function handleScrollBarClick(game, index) {
    game.setMoveIndex(index);
}