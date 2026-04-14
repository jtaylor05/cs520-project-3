import { Node } from "./map.js";
import { Agent, Target } from "./agents.js";

export function generateConfig(json) {
    if (json === null) {
        return DefaultGameConfig(3, 3);
    }
    const config = new CustomGameConfig(
        new CustomGraphConfig(json.node_size || 64, json.nodes, json.edges),
        json.id || 0,
        json.agents,
        json.target
    );
    return config;
}

export class GameConfig {
    constructor(graphconfig, id) {
        this.id = id
        this.graphconfig = graphconfig;
    }

    init_agents() {
        return []
    }

    init_targets() {
        return []
    }

    save() {
        return {
            id : this.id,
            node_size : this.graphconfig.node_size,
            nodes : [],
            edges : [],
            agents : [],
            target : null
        }
    }
}

export class CustomGameConfig extends GameConfig {
    constructor(graphconfig, id, agents, target) {
        super(graphconfig, id);
        this.agents = agents;
        this.target = target;
    }

    init_agents(nodes) {
        const agentNodes = this.agents.map(a => nodes.find(n => n.id === a));
        return agentNodes.map((node, index) => new Agent(index, node));
    }

    init_targets(nodes) {
        const targetNode = nodes.find(n => n.id === this.target);
        return targetNode ? [new Target(targetNode)] : [];
    }

    save() {
        const graphconfig = this.graphconfig.save();
        const config = {
            id : this.id,
            node_size: graphconfig.node_size,
            nodes: graphconfig.nodes,
            edges: graphconfig.edges,
            agents: this.agents,
            target: this.target
        };
        return config;
    }
}

export class DefaultGameConfig extends GameConfig {
    constructor(x, y) {
        super(new GridGraphConfig(20, x, y), 0);
    }

    get_agent_ids() {
        return [
            0,
            this.graphconfig.x - 1,
            this.graphconfig.x * (this.graphconfig.y - 1),
            this.graphconfig.x * this.graphconfig.y - 1
        ]
    }

    get_target_id() {
        const midX = Math.floor(this.graphconfig.x / 2);
        const midY = Math.floor(this.graphconfig.y / 2);
        return midY * this.graphconfig.x + midX;
    }

    init_agents(nodes) {
        return this.get_agent_ids().map((id, index) => new Agent(index, nodes.find(n => n.id === id)));
    }

    init_targets(nodes) {
        return [
            new Target(nodes[this.get_target_id()])
        ];
    }

    save() {
        const graphconfig = this.graphconfig.save();
        const config = {
            id : this.id,
            node_size: graphconfig.node_size,
            nodes: graphconfig.nodes,
            edges: graphconfig.edges,
            agents: this.get_agent_ids(),
            target: this.get_target_id()
        };
        return config;
    }
}


export class GraphConfig {
    constructor(size) {
        this.node_size = size;
    }

    init_nodes() {
        return [];
    }

    save() {
        return {
            node_size: this.node_size,
            nodes : [],
            edges : []
        }
    }
}

export class CustomGraphConfig extends GraphConfig {
    constructor(size, nodes, edges) {
        super(size);
        this.nodes = nodes;
        this.edges = edges;
    }

    init_nodes() {
        const nodeMap = {};
        this.nodes.forEach(n => {
            nodeMap[n.id] = new Node(n.id, n.x, n.y, this.node_size, this.node_size);
            nodeMap[n.id].isEdge = n.isEdge || false;
        });
        this.edges.forEach(e => {
            const node1 = nodeMap[e[0]];
            const node2 = nodeMap[e[1]];
            if (node1 && node2) {
                node1.neighbors.push(node2);
                node2.neighbors.push(node1);
            }
        });
        return Object.values(nodeMap);
    }

    save() {
        return {
            node_size : this.node_size,
            nodes: this.nodes,
            edges: this.edges
        }
    }
}

export class GridGraphConfig extends GraphConfig {
    constructor(size, x, y) {
        super(size);
        this.x = x;
        this.y = y;
    }

    init_nodes() {
        const nodes = [];
        for (let i = 0; i < this.x; i++) {
            for (let j = 0; j < this.y; j++) {
                const id = i * this.y + j;
                const node = new Node(id, j * 100 + 50, i * 100 + 50, this.node_size, this.node_size);
                nodes.push(node);
            }
        }
        // Set neighbors
        for (let i = 0; i < this.x; i++) {
            for (let j = 0; j < this.y; j++) {
                const id = i * this.y + j;
                const node = nodes[id];
                if (i > 0) node.neighbors.push(nodes[(i-1)*this.y + j]);
                if (i < this.x-1) node.neighbors.push(nodes[(i+1)*this.y + j]);
                if (j > 0) node.neighbors.push(nodes[i*this.y + j-1]);
                if (j < this.y-1) node.neighbors.push(nodes[i*this.y + j+1]);
                if (i === 0 || i === this.x-1 || j === 0 || j === this.y-1) node.isEdge = true;
            }
        }
        return nodes;
    }

    save() {
        const nodes = this.init_nodes()
        return {
            node_size : this.node_size,
            nodes: nodes.map(n => n.save()),
            edges: nodes.flatMap(n => n.neighbors.filter(nn => nn.id > n.id).map(nn => [n.id, nn.id]))
        }
    }
}