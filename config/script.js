class Node {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.neighbors = [];
        this.isEdge = false;
    }
}

class Graph {
    constructor() {
        this.nodes = [];
        this.nextId = 0;
    }

    addNode(x, y) {
        const node = new Node(this.nextId++, x, y);
        this.nodes.push(node);
        return node;
    }

    removeNode(node) {
        this.nodes = this.nodes.filter(n => n !== node);
        this.nodes.forEach(n => n.neighbors = n.neighbors.filter(nn => nn !== node));
        this.nodes.forEach(n => {
            if (n.id > node.id) n.id--; // Adjust IDs of subsequent nodes
        });
        this.nextId--;
    }

    connect(node1, node2) {
        if (!node1.neighbors.includes(node2)) {
            node1.neighbors.push(node2);
            node2.neighbors.push(node1);
        }
    }

    toggleEdge(node) {
        node.isEdge = !node.isEdge;
    }
}

const NODE_SIZE = 64;

function generateRandomId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'cfg-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

class Config {
    constructor() {
        this.graph = new Graph();
        this.agents = [];
        this.target = null;
        this.id = null;
    }

    addAgent(node) {
        if (!this.agents.includes(node)) {
            this.agents.push(node);
            if (this.target === node) this.target = null; // Can't be both agent and target
        }
    }

    removeAgent(node) {
        this.agents = this.agents.filter(a => a !== node);
    }

    setTarget(node) {
        this.target = node;
        if (this.agents.includes(node)) this.agents = this.agents.filter(a => a !== node); // Can't be both agent and target
    }

    removeTarget() {
        this.target = null;
    }

    save() {
        if (this.graph.nodes.length === 0) {
            alert('Graph is empty! Please add some nodes before saving.');
            return false;
        }
        if (this.agents.length === 0) {
            alert('No agents defined! Please add at least one agent before saving.');
            return false;
        }
        if (!this.target) {
            alert('No target defined! Please set a target before saving.');
            return false;
        }
        if (!this.graph.nodes.some(n => n.isEdge)) {
            alert('No nodes are marked as edges! Please toggle some on before saving.');
            return false;
        }

        if (!this.id) {
            this.id = generateRandomId();
        }

        const config = {
            id: this.id,
            node_size: NODE_SIZE,
            nodes: this.graph.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, isEdge: n.isEdge })),
            edges: this.graph.nodes.flatMap(n => n.neighbors.filter(nn => nn.id > n.id).map(nn => [n.id, nn.id])),
            agents: this.agents.map(a => a.id),
            target: this.target ? this.target.id : null
        };
        
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `config-${config.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    }
}

const WIDTH  = 500;
const HEIGHT = 500;

// UI
const config = new Config();
const graphDisplay = document.getElementById('graph-display');
const addNodeBtn = document.getElementById('add-node');
const connectBtn = document.getElementById('connect-nodes');
const toggleEdgeBtn = document.getElementById('toggle-edge');
const toggleAgentBtn = document.getElementById('add-agent');
const toggleTargetBtn = document.getElementById('add-target');
const saveBtn = document.getElementById('save-config');
const instructions = document.getElementById('instructions');

let mode = null;
let selectedNodes = [];
let isDragging = false;
let draggedNode = null;

function render() {
    graphDisplay.style.width = WIDTH + 'px';
    graphDisplay.style.height = HEIGHT + 'px';
    graphDisplay.innerHTML = '';
    // Draw lines
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = WIDTH + 'px';
    svg.style.height = HEIGHT + 'px';
    svg.style.pointerEvents = 'none';
    config.graph.nodes.forEach(node => {
        node.neighbors.forEach(neighbor => {
            if (neighbor.id > node.id) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', node.x);
                line.setAttribute('y1', node.y);
                line.setAttribute('x2', neighbor.x);
                line.setAttribute('y2', neighbor.y);
                line.setAttribute('stroke', 'gray');
                line.setAttribute('stroke-width', '2');
                svg.appendChild(line);
            }
        });
    });
    graphDisplay.appendChild(svg);

    // Draw nodes
    config.graph.nodes.forEach(node => {
        const div = document.createElement('div');
        div.className = 'node';
        if (selectedNodes.includes(node)) div.classList.add('selected');
        if (node.isEdge) div.classList.add('edge');
        if (config.agents.includes(node)) div.classList.add('agent');
        if (config.target === node) div.classList.add('target');
        div.style.left = node.x - 10 + 'px';
        div.style.top = node.y - 10 + 'px';
        div.textContent = node.id;
        div.addEventListener('mousedown', (e) => {
            if (mode === 'add') return;
            e.preventDefault();
            isDragging = true;
            draggedNode = node;
        });
        div.addEventListener('click', () => handleNodeClick(node));
        div.addEventListener('contextmenu', (e) => handleNodeRightClick(e, node));
        graphDisplay.appendChild(div);
    });
}

function handleNodeRightClick(event, node) {
    event.preventDefault();
    config.graph.removeNode(node);
    if (config.agents.includes(node)) config.removeAgent(node);
    if (config.target === node) config.removeTarget();
    selectedNodes = selectedNodes.filter(n => n !== node);
    render();
}

function handleNodeClick(node) {
    if (mode === 'add' || isDragging) return; // Ignore in add mode or during drag
    if (selectedNodes.includes(node)) {
        selectedNodes = selectedNodes.filter(n => n !== node);
    } else {
        selectedNodes.push(node);
    }
    render();
}

graphDisplay.addEventListener('click', (e) => {
    if (mode === 'add') {
        if (!e.shiftKey) {
            mode = null;
            instructions.textContent = 'Click "Add Node" then click on the graph to place nodes. Select nodes to connect or modify. Drag nodes to move them (not in add mode).';
        }
        const rect = graphDisplay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        config.graph.addNode(x, y);
        render();
    }
});

addNodeBtn.addEventListener('click', () => {
    if (mode === 'add') {
        mode = null;
        instructions.textContent = 'Click "Add Node" then click on the graph to place nodes. Select nodes to connect or modify. Drag nodes to move them (not in add mode).';
    }
    else {
        mode = 'add';
        instructions.textContent = 'Click on the graph to add nodes.';
    }
});

connectBtn.addEventListener('click', () => {
    if (selectedNodes.length === 2) {
        config.graph.connect(selectedNodes[0], selectedNodes[1]);
        selectedNodes = [];
        render();
    } else {
        instructions.textContent = 'Select exactly 2 nodes to connect.';
    }
});

toggleEdgeBtn.addEventListener('click', () => {
    selectedNodes.forEach(node => config.graph.toggleEdge(node));
    selectedNodes = [];
    render();
});

toggleAgentBtn.addEventListener('click', () => {
    selectedNodes.forEach(node => {
        if (config.agents.includes(node)) {
            config.removeAgent(node);
        } else {
            config.addAgent(node);
        }
    });
    render();
});

toggleTargetBtn.addEventListener('click', () => {
    if (selectedNodes.length === 1) {
        if (config.target === selectedNodes[0]) {
            config.removeTarget();
        } else {
            config.setTarget(selectedNodes[0]);
        }
        render();
    }
});

saveBtn.addEventListener('click', () => {
    config.save();
});

document.addEventListener('mousemove', (e) => {
    if (isDragging && draggedNode) {
        const rect = graphDisplay.getBoundingClientRect();
        draggedNode.x = Math.max(10, Math.min(WIDTH - 10, e.clientX - rect.left));
        draggedNode.y = Math.max(10, Math.min(HEIGHT - 10, e.clientY - rect.top));
        render();
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    draggedNode = null;
});

render();