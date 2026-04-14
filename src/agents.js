export class Agent {
    constructor(id, position) {
        this.id = id;
        this.position = position;
    }
}

export class Target extends Agent {
    constructor(position) {
        super('target', position);
    }

    getMove(game) {
        const occupied = new Set(game.agents.map(a => a.position.id));
        const neighbors = this.position.neighbors.filter(n => !occupied.has(n.id));
        if (neighbors.length === 0) return null;

        const dist = Object.fromEntries(game.graph.nodes.map(n => [n.id, Infinity]));
        const parent = {};
        const visited = new Set();

        dist[this.position.id] = 0;
        parent[this.position.id] = null;

        // Dijkstra's to handle the non-uniform edge weights
        const queue = [this.position];

        while (queue.length > 0) {
            // Pull the unvisited node with the lowest distance
            queue.sort((a, b) => dist[a.id] - dist[b.id]);
            const current = queue.shift();
            if (visited.has(current.id)) continue;
            visited.add(current.id);

            current.neighbors.forEach(neighbor => {
                const weight = occupied.has(neighbor.id) ? 50 : 1;
                const newDist = dist[current.id] + weight;
                if (newDist < dist[neighbor.id]) {
                    dist[neighbor.id] = newDist;
                    parent[neighbor.id] = current;
                    queue.push(neighbor);
                }
            });
        }

        // Find the closest edge node by weighted distance
        const edges = game.graph.edges();
        let minDist = Infinity;
        let closestEdge = null;
        edges.forEach(edge => {
            if (dist[edge.id] < minDist) {
                minDist = dist[edge.id];
                closestEdge = edge;
            }
        });

        if (closestEdge === null || minDist === Infinity) return null;

        // Reconstruct the path back to the target's current position
        const path = [];
        let current = closestEdge;
        while (current !== null) {
            path.unshift(current);
            current = parent[current.id];
        }

        // path[1] is the ideal next step — but if it's occupied, pick the
        // best unoccupied neighbor pointing in the same general direction
        if (path.length > 1) {
            const idealNext = path[1];
            if (!occupied.has(idealNext.id)) return idealNext;

            // Fall back to the unoccupied neighbor with the lowest dist to closestEdge
            const fallback = neighbors.sort((a, b) => dist[a.id] - dist[b.id])[0];
            return fallback ?? null;
        }

        return null;
    }
}