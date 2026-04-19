import { Graph } from './map.js';
import { Agent, Target } from './agents.js';
import { DefaultGameConfig, generateConfig } from './config.js';

class Move {
    constructor(agent, from, to) {
        this.agent = agent;
        this.from = from;
        this.to = to;
    }

    enact() {
        this.agent.position = this.to;
    }

    reverse() {
        this.agent.position = this.from;
    }

    toString() {
        return `${this.agent instanceof Target ? 'T' : 'A ' + this.agent.id} -> ${this.from.id} : ${this.to.id}`;
    }

    saveState() {
        return {
            agentId: this.agent.id,
            fromId: this.from.id,
            toId: this.to.id
        };
    }

    static loadState(data, game) {
        const agent = data.agentId === 'target' ? game.target : game.agents.find(a => a.id === data.agentId);
        const from = game.graph.nodes.find(n => n.id === data.fromId);
        const to = game.graph.nodes.find(n => n.id === data.toId);
        return new Move(agent, from, to);
    }
}

export class AggregateMove extends Move {
    constructor(agentMove, targetMove) {
        super(agentMove.agent, agentMove.from, agentMove.to);
        this.agentMove = agentMove;
        this.targetMove = targetMove;
    }

    enact() {
        this.agentMove.enact();
        this.targetMove.enact();
    }

    reverse() {
        this.targetMove.reverse();
        this.agentMove.reverse();
    }

    toString() { return `A${this.agentMove.from.id}->${this.agentMove.to.id}, T${this.targetMove.from.id}->${this.targetMove.to.id}`; }

    saveState() {
        return {
            agentMove: this.agentMove.saveState(),
            targetMove: this.targetMove.saveState()
        };
    }

    static loadState(data, game) {
        return new AggregateMove(Move.loadState(data.agentMove, game), Move.loadState(data.targetMove, game));
    }
}

export class Game {
    constructor(eventbus, config = new DefaultGameConfig(3, 3)) {
        this.setConfig(config);
        this.eventbus = eventbus
    }

    setConfig(config) {
        this.config = config;
        this.graph = new Graph(config.graphconfig);
        this.agents = config.init_agents(this.graph.nodes);
        this.target = config.init_targets(this.graph.nodes)[0];
        this.moves = [];
        this.currentMoveIndex = -1;
        this.selectedAgent = null;
        this.status = this.updateStatus();
    }

    performRound(agent, to) {
        const playerMove = new Move(agent, agent.position, to);
        playerMove.enact();

        const targetTo = this.target.getMove(this) || this.target.position;
        console.log(targetTo);
        const targetMove = new Move(this.target, this.target.position, targetTo);
        targetMove.enact();

        this.appendMove(new AggregateMove(playerMove, targetMove));

        this.eventbus.dispatchEvent(new Event("update"))
        if (this.inProgress()) this.updateStatus();
    }

    updateStatus() {
        // Check if there are no valid moves for the player agents
        if (this.target.position.isEdge) {
            this.status = 'Player loses!';
        }
        else if (this.agents.map(a => a.position.neighbors).flat().filter(n => !(this.agents.some(a => a.position === n) || this.target.position === n)).length === 0) {
            this.status = "Player loses!";
        }
        else if (this.moves.length > 0 && this.target.getMove(this) === null) {
            this.status = 'Player wins!';
        }
        else this.status = 'In Progress';
        if (this.status === 'Player wins!') {
            this.eventbus.dispatchEvent(new Event('win'));
        }
        if (this.status === 'Player loses!') {
            this.eventbus.dispatchEvent(new Event('lose'));
        }
    }

    inProgress() {
        console.log("in progress", this.status !== 'Player wins!' && this.status !== 'Player loses!')
        return this.status !== 'Player wins!' && this.status !== 'Player loses!';
    }

    appendMove(move) {
        this.currentMoveIndex++;
        this.moves.splice(this.currentMoveIndex);
        this.moves.push(move);
    }

    undo() {
        if (this.currentMoveIndex < 0) return;
        const move = this.moves[this.currentMoveIndex];
        move.reverse(this);
        this.currentMoveIndex--;

        this.eventbus.dispatchEvent(new Event("update"))
        this.updateStatus();
    }

    redo() {
        if (this.currentMoveIndex >= this.moves.length - 1) return;
        const move = this.moves[this.currentMoveIndex + 1];
        move.enact(this);
        this.currentMoveIndex++;

        this.eventbus.dispatchEvent(new Event("update"))
        this.updateStatus();
    }

    setMoveIndex(index) {
        console.log(this.moves);
        while (this.currentMoveIndex > index) {
            this.undo();
        }
        while (this.currentMoveIndex < index) {
            this.redo();
        }
    }

    saveState() {
        return {
            config : this.config.save(),
            moves : this.moves.map(m => m.saveState()),
            currentMoveIndex : this.currentMoveIndex,
        };
    }

    loadState(state) {
        this.setConfig(generateConfig(state.config));
        this.moves = state.moves.map(m => AggregateMove.loadState(m, this));
        this.setMoveIndex(state.currentMoveIndex);
    }
}