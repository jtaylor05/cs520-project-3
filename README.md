# Graph Trap Game

A turn-based puzzle game where the player must trap a target on a graph map by positioning agents to block its movement.

## How to Play

- The game is played on a 5x5 grid graph.
- The player controls 4 agents (green circles) that can be moved to adjacent nodes.
- The target (red circle) moves towards the closest agent after each player move.
- Goal: Trap the target so it cannot move (no empty adjacent nodes).
- Lose: If the target reaches an edge node (border nodes with thick border).

## Controls

- Click on an agent to select it.
- Click on an adjacent empty node to move the agent there.
- Use the horizontal scrollbar to navigate move history.

## Config Editor

A separate page for creating custom game configurations.

- Open `config/index.html` in a browser.
- Add nodes by clicking "Add Node" then clicking on the graph.
- Select nodes and use buttons to connect them, toggle edges, add agents/targets.
- Save the config (prototype logs to console).

## Running the Game

Open `index.html` in a web browser to play the game.

## Files

- `index.html`: Main HTML file
- `script.js`: Game logic and UI interaction
- `style.css`: Styling for the game

## Game Logic

- Moves are stored as objects that can be enacted and reversed for undo/redo functionality.
- The target uses a predictable algorithm: it always moves to the adjacent node that minimizes the Manhattan distance to the nearest agent.

Configs PK: config_id
Scores PK: user_id, SK: config_id (GSI: config_id)