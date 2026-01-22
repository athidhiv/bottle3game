# bottle3game
a classic game
🍾 Bottle Game

A 3-player real-time multiplayer 2D game built with Node.js, Socket.io, and Phaser.js.

Players compete to collect bottles and store them in their zone. The first player to store 3 bottles wins.

🎯 Features

Real-time multiplayer: Players see each other move instantly.

3-player matches: Compete with friends in a single match.

5 bottles per match: Carry only one bottle at a time.

Stealing mechanic: You can steal bottles from other players’ zones.

Fixed camera: Simple, clean 2D arena.

Authoritative server: All game logic is validated server-side to prevent cheating.

🕹 How to Play

Each player controls an avatar in a 2D arena.

Move toward bottles to grab them.

Carry only one bottle at a time.

Drop bottles in your zone to score.

You can steal bottles from other players’ zones.

First player to store 3 bottles wins the match.

⚙️ Tech Stack

Backend:

Node.js (JavaScript)

Socket.io (real-time WebSockets)

Event-driven architecture for game logic

In-memory match state (optional DB for match history)

Frontend:

Phaser.js (2D game engine)

HTML5 / Canvas

Socket.io-client for communication

Optional:

Postgres / MySQL for storing match results and leaderboard

Docker for deployment

🗂 Architecture Overview
Backend

Match Manager: Manages active matches and players.

Player Manager: Tracks player position, score, and carrying bottle.

Bottle Manager: Tracks bottle states (ground / carried / in zone).

Event Bus: Handles player actions: move, grab, drop, steal.

Game Loop: Updates positions, resolves collisions, validates actions every tick (~30ms).

Broadcast Manager: Sends authoritative game state to all clients.

Frontend

Rendering Engine: Draws avatars, bottles, and zones using Phaser.js.

Input Handler: Sends player actions to server via WebSockets.

Animation: Smooth player movement, grabbing, and dropping bottles.

State Sync: Receives server updates and animates game objects accordingly.

🎨 Game Flow
Players join → Match starts → Move & grab bottles → Drop bottles in zone → Steal if possible → First to 3 wins → Match ends


Player actions:

Move

Grab bottle

Drop bottle in zone

Steal bottle from other zone

🔧 Setup & Running

Clone the repository

git clone https://github.com/yourusername/bottle-game.git
cd bottle-game


Install backend dependencies

cd backend
npm install


Install frontend dependencies

cd frontend
npm install


Start the backend server

cd backend
node server.js


Start the frontend

cd frontend
npm start


Open browser → connect 3 players → enjoy the game!

🧠 Development Roadmap

 Design game state model (players, bottles, zones)

 Implement server-side game loop & event handling

 Setup WebSocket communication (Socket.io)

 Implement frontend 2D rendering (avatars, bottles, zones)

 Connect frontend input → backend actions

 Add smooth animations & effects

 Deploy to web (optional multiplayer rooms, leaderboards)

⚡ Learning Points

Event-driven backend architecture

Real-time WebSocket communication

Multiplayer game state management

2D animation with Phaser.js

Handling race conditions (steals, grabs)

🏆 Future Enhancements

Power-ups (speed boost, shield)

AI players / bots

Multiple arenas

Matchmaking and lobby system

Leaderboards & stats tracking
