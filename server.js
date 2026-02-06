const express = require('express');
const app = express();
const http = require('http');           // just require http
const server = http.createServer(app);  // create server once
const { Server } = require('socket.io');
const io = new Server(server);  
app.use(express.static(__dirname + '/public'));
let players = {};
let rooms = {};
const WORLD_RADIUS = 1;
const PLAYER_GRAB_DIST = 0.08;


io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (data) => {
        const roomName = createRoom(data.numPlayers, data.private);
        socket.emit('roomCreated', roomName);
    });

    socket.on('joinGame', (data) => {
        joinLobby(socket, data.numPlayers, data.roomName,data.playerName);
    });
    socket.on("leaveRoom", () => {
        const player = players[socket.id];
        if (!player) return;

        const roomName = player.room;
        const room = rooms[roomName];

        if (room) {
            room.playerIds = room.playerIds.filter(id => id !== socket.id);
            socket.to(roomName).emit("disconnected", socket.id);
            if (room.playerIds.length === 0) delete rooms[roomName];
        }

        socket.leave(roomName);
        delete players[socket.id];
    });
});

function createRoom(num, isPrivate) {
    const roomName = `arena_${Date.now()}`;
    rooms[roomName] = {
        playerIds: [],
        started: false,
        capacity: num,
        private: isPrivate,
        rematchVotes: new Set(),
        circles: {},
        zones: {}
    };
    return roomName;
}

function joinLobby(socket, num, roomName, playerName) {
    if (!roomName) {
        for (let id in rooms) {
            let r = rooms[id];
            if (r.capacity === num && r.playerIds.length < r.capacity && !r.started && !r.private) {
                roomName = id;
                break;
            }
        }
    }

    if (!roomName && num) roomName = createRoom(num, false);

    if (!rooms[roomName]) return socket.emit('roomNotFound');
    if (rooms[roomName].playerIds.length >= rooms[roomName].capacity) return socket.emit('roomFull');

    socket.join(roomName);
    rooms[roomName].playerIds.push(socket.id);

    players[socket.id] = {
        x: 0,
        y: 0,
        playerId: socket.id,
        playerName: playerName || "Anonymous"+socket.id.slice(0,4),
        color: Math.random() * 0xffffff,
        room: roomName,
        holding: null
    };

    const playersInRoom = {};
    rooms[roomName].playerIds.forEach(id => { playersInRoom[id] = players[id]; });

    socket.emit('currentPlayers', playersInRoom);
    socket.to(roomName).emit('newPlayer', players[socket.id]);

    registerGameHandlers(socket);
    tryStartGame(roomName);
}

function tryStartGame(roomName) {
    const room = rooms[roomName];
    if (room.playerIds.length === room.capacity && !room.started) {
        room.started = true;

        // ---- SPAWN CIRCLES (WORLD SPACE) ----
        const count = room.capacity * 2 - 1;
        const ring = 0.25;
        const step = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            const a = step * i;
            const id = `circle_${i}`;

            room.circles[id] = {
                id,
                x: Math.cos(a) * ring,
                y: Math.sin(a) * ring,
                owner: null
            };
        }

        // ---- SPAWN ZONES (WORLD SPACE) ----
        const zRing = 0.9;
        const zStep = (Math.PI * 2) / room.playerIds.length;

        room.playerIds.forEach((pId, i) => {
            const a = zStep * i;

            room.zones[pId] = {
                id: pId,
                x: Math.cos(a) * zRing,
                y: Math.sin(a) * zRing,
                r: 0.17,
                ownerName: players[pId].playerName,
                count: 0,
                color: players[pId].color
            };
        });

        io.to(roomName).emit("gameStarted");
        io.to(roomName).emit("spawnCircles", Object.values(room.circles));
        io.to(roomName).emit("spawnZones", Object.values(room.zones));
    }
}

function registerGameHandlers(socket) {
    socket.on('playerMovement', (data) => {
        if (!players[socket.id]) return;
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
    });
    
    socket.on("toggleGrab", () => {
        const player = players[socket.id];
        if (!player) return;

        const room = rooms[player.room];
        if (!room) return;

        // ---------- DROP ----------
        if (player.holding) {
            const circle = room.circles[player.holding];
            if (!circle) return;

            circle.owner = null;
            circle.x = player.x;
            circle.y = player.y;
            players[socket.id].holding = null;

            io.to(player.room).emit("circleDropped", {
                circleId: circle.id,
                x: circle.x,
                y: circle.y
            });

            for (let zid in room.zones) {
                const z = room.zones[zid];
                if (Math.hypot(z.x - circle.x, z.y - circle.y) < z.r) {
                    z.count++;

                    io.to(player.room).emit("zoneUpdated", {
                        zoneId: z.id,
                        count: z.count
                    });

                    if (z.count >= room.capacity) {
                        io.to(player.room).emit("gameOver", { winner: z.ownerName, winnerId: z.id });
                    }
                }
            }

            
            return;
        }

        // ---------- PICK ----------
        for (let id in room.circles) {
            const c = room.circles[id];

            if (!c.owner && Math.hypot(c.x - player.x, c.y - player.y) < PLAYER_GRAB_DIST) {
                c.owner = socket.id;
                player.holding = id;
                players[socket.id].holding = id;
                io.to(player.room).emit("circleGrabbed", {
                    circleId: id,
                    playerId: socket.id
                });

                for (let zid in room.zones) {
                    const z = room.zones[zid];
                    if (Math.hypot(z.x - c.x, z.y - c.y) < z.r) {
                        z.count = Math.max(0, z.count - 1);

                        io.to(player.room).emit("zoneUpdated", {
                            zoneId: z.id,
                            count: z.count
                        });
                    }
                }

                break;
            }
        }
    });
    socket.on("requestRematch", () => {

        const player = players[socket.id];
        if (!player) return;

        const room = rooms[player.room];
        if (!room) return;

        // Use Set instead of counter
        room.rematchVotes.add(socket.id);

        io.to(player.room).emit("rematchRequested", { 
            count: room.rematchVotes.size 
        });

        // Everyone agreed
        if (room.rematchVotes.size >= room.capacity) {
            console.log("All players agreed. Restarting game...");

            // ---- RESET ROOM ----
            room.started = false;
            room.rematchVotes.clear();
            room.circles = {};
            room.zones = {};

            // ---- RESET PLAYERS ----
            room.playerIds.forEach(id => {
                if (players[id]) {
                    players[id].holding = null;
                    players[id].x = 0;
                    players[id].y = 0;
                }
            });

            // ---- NOTIFY CLIENT ----
            io.to(player.room).emit("rematchStart");
            setTimeout(() => {
                tryStartGame(player.room);
            }, 100);
            // ---- START AGAIN ----
            tryStartGame(player.room);
        }
    });
     socket.on('disconnect', () => {
            const player = players[socket.id];
            if (player) {
                const rName = player.room;
                if (rooms[rName]) {
                    rooms[rName].playerIds = rooms[rName].playerIds.filter(id => id !== socket.id);
                    if (rooms[rName].playerIds.length === 0) delete rooms[rName];
                }
                delete players[socket.id];
                io.to(rName).emit('disconnected', socket.id);
            }
        });
    }
setInterval(() => {
    for (let roomName in rooms) {
        const room = rooms[roomName];

        const snapshot = room.playerIds.map(id => {
            const p = players[id];
            return { 
                id, 
                x: p.x, 
                y: p.y, 
                holding: p.holding 
            };
        });

        io.to(roomName).emit("stateUpdate", snapshot);
    }
}, 50); // 20Hz
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));