import { GridGraphConfig } from "./config.js";

const NODE_SIZE = 20;

export class Node {
    constructor(id, x, y, width, height) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.neighbors = [];
        this.isEdge = false;
    }

    save() {
        return {
            id : this.id,
            x : this.x,
            y : this.y,
            isEdge : this.isEdge
        }
    }
}

export class Graph {
    constructor(config = null) {
        this.config = config ? config : new GridGraphConfig(20, 5, 5);
        this.nodes = this.config.init_nodes();
    }

    bounding_box() {
        const minX = Math.min(...this.nodes.map(n => n.x));
        const maxX = Math.max(...this.nodes.map(n => n.x));
        const minY = Math.min(...this.nodes.map(n => n.y));
        const maxY = Math.max(...this.nodes.map(n => n.y));
        return { minX, maxX, minY, maxY };
    }

    to_local(x, y) {
        const bb = this.bounding_box();
        return { x: x - bb.minX, y: y - bb.minY };
    }

    size() {
        return this.nodes.length;
    }

    edges() {
        return this.nodes.filter(n => n.isEdge);
    }

    save() {
        return {
            config : this.config.save()
        }
    }
}