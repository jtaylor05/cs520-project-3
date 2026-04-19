import { handleAngryCat, handleNodeClick, handleScrollBarClick } from './controller.js'
import { fetchScoreChartByConfig, fetchScoresByConfig } from './api.js'

export const NODE_TAG          = 'node'
export const AGENT_TAG         = 'agent'
export const TARGET_TAG        = 'target'
export const EDGE_TAG          = 'edge'
export const SCROLL_BUTTON_TAG = 'move-item'

class Renderer {
    constructor(game) {
        this.game = game;
    }

    render(document) {
    }
}

export class DisplayRenderer extends Renderer {
    constructor(game, margins) {
        super(game);
        this.margins = margins;
        this.svgRenderer = new SVGRenderer(game, margins);
        this.nodeGraphRenderer = new NodeGraphRenderer(game, margins);
        this.scrollbarRenderer = new ScrollbarRenderer(game);
    }

    render(document) {
        const graphDisplay = document.getElementById('graph-display');
        graphDisplay.innerHTML = '';

        const bb = this.game.graph.bounding_box();
        const width = bb.maxX - bb.minX + 2 * this.margins;
        const height = bb.maxY - bb.minY + 2 * this.margins;
        graphDisplay.style.width = width + 'px';
        graphDisplay.style.height = height + 'px';

        const moveScrollbar = document.getElementById('move-scrollbar');
        this.svgRenderer.render(graphDisplay);
        this.nodeGraphRenderer.render(graphDisplay);
        this.scrollbarRenderer.render(moveScrollbar);
    }
}

class NodeGraphRenderer extends Renderer {
    constructor(game, margins) {
        super(game);
        this.margins = margins;
    }

    render(graphDisplay) {
        this.game.graph.nodes.forEach(node => {
            const div = document.createElement('div');
            div.className = NODE_TAG;
            if (node.isEdge) div.classList.add(EDGE_TAG);
            const pos = this.game.graph.to_local(node.x, node.y);
            div.style.left = pos.x - node.width / 2 + this.margins + 'px';
            div.style.top = pos.y - node.height / 2 + this.margins + 'px';
            div.style.width = node.width + 'px'
            div.style.height = node.height + 'px'
            if (this.game.agents.some(a => a.position === node)) div.classList.add(AGENT_TAG);
            if (this.game.target.position === node) div.classList.add(TARGET_TAG);
            div.addEventListener('click', () => handleNodeClick(this.game, node));
            div.addEventListener('click', () => handleAngryCat(div));
            graphDisplay.appendChild(div);
        });
    }
}

class SVGRenderer extends Renderer {
    constructor(game, margins) {
        super(game);
        this.margins = margins;
        this.padding = 20
    }

    render(graphDisplay) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.top = this.margins - this.padding + 'px';
        svg.style.left = this.margins - this.padding + 'px';
        svg.style.width = (graphDisplay.offsetWidth - 2 * (this.margins - this.padding)) + 'px';
        svg.style.height = (graphDisplay.offsetHeight - 2 * (this.margins - this.padding)) + 'px';
        svg.style.pointerEvents = 'none';
        this.game.graph.nodes.forEach(node => {
            node.neighbors.forEach(neighbor => {
                if (neighbor.id > node.id) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    const pos = this.game.graph.to_local(node.x, node.y);
                    const neighborPos = this.game.graph.to_local(neighbor.x, neighbor.y);
                    line.setAttribute('x1', pos.x + this.padding);
                    line.setAttribute('y1', pos.y + this.padding);
                    line.setAttribute('x2', neighborPos.x + this.padding);
                    line.setAttribute('y2', neighborPos.y + this.padding);
                    line.setAttribute('stroke', '#777777');
                    line.setAttribute('stroke-width', '3');
                    svg.appendChild(line);
                }
            });
        });
        graphDisplay.appendChild(svg);
    }
}

class ScrollbarRenderer extends Renderer {
    constructor(game) {
        super(game);
    }

    render(moveScrollbar) {
        moveScrollbar.innerHTML = '';
        const item = document.createElement('div');
        item.className = SCROLL_BUTTON_TAG;
        item.textContent = 'Start';
        if (this.game.currentMoveIndex === -1) item.classList.add('current');
        item.addEventListener('click', () => handleScrollBarClick(this.game, -1))
        moveScrollbar.appendChild(item);
        let current;
        this.game.moves.forEach((move, index) => {
            console.log(move, index);
            const item = document.createElement('div');
            item.className = SCROLL_BUTTON_TAG;
            if (index === this.game.currentMoveIndex) {
                item.classList.add('current');
                current = item;
            }
            item.textContent = 'Move ' + (index + 1);
            item.addEventListener('click', () => handleScrollBarClick(this.game, index))
            moveScrollbar.appendChild(item);
        });
        current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

export class ScoreGraphRenderer extends Renderer {
    constructor(game) {
        super(game);
        this.chartElement = null;
    }

    async render(chartContainer) {
        chartContainer.innerHTML = '';
        const canvas = document.createElement('canvas');
        chartContainer.appendChild(canvas)

        const playerScore = this.game.moves.length
        const chartData = await fetchScoreChartByConfig(this.game.config.id);
        new Chart(canvas, {
            type: "bar",
            data: {
                ...chartData,
                datasets: [{
                    ...chartData.datasets[0],
                    backgroundColor: chartData.labels.map(label =>
                        label === playerScore ? "#e53935" : "#1e88e5"
                    ),
                    borderWidth: 0,
                    barPercentage: 1.0,
                    categoryPercentage: 1.0,
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => `Moves: ${items[0].label}`,
                            label: (item) => `Count: ${item.raw}`,
                        }
                    },
                    datalabels: {
                        anchor: "end",
                        align: "end",
                        color: "#000000",
                        formatter: (value) => value === 0 ? "" : value,
                    }
                },
                scales: {
                    x: {
                        border: { display: false },
                        grid: { display: false },
                        ticks: { display: false },
                    },
                    y: {
                        border: { display: false },
                        grid: { display: false },
                        ticks: { display: false },
                    }
                },
                backgroundColor: "transparent",
                layout: { padding: { top: 20 } },
            }
        });
    }
}
