const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname + '/public'));

let players = {};
let playerCount = 0;
let rooms = {};
io.on('connection', (socket) => {
    playerCount++;
    
    // Logic: 1-3 = room0, 4-6 = room1, 7-9 = room2...
    const roomNumber = Math.floor((playerCount - 1) / 3);
    const roomName = `arena_${roomNumber}`;
    
    socket.join(roomName);
    console.log(`User ${socket.id} joined ${roomName}`);
    if (!rooms[roomName]) {
            rooms[roomName] = { playerIds: [], started: false };
        }
    rooms[roomName].playerIds.push(socket.id);

    players[socket.id] = {
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        playerId: socket.id,
        color: Math.random() * 0xffffff,
        room: roomName // Track which room they are in
    };

    // Only send players that are in the SAME room
    const playersInRoom = {};
    Object.keys(players).forEach(id => {
        if (players[id].room === roomName) {
            playersInRoom[id] = players[id];
        }
    });

    socket.emit('currentPlayers', playersInRoom);
    if (rooms[roomName].playerIds.length === 3 && !rooms[roomName].started) {
        rooms[roomName].started = true;
        io.to(roomName).emit('gameStarted');
        
        // Spawn 5 circles in the center
        const circles = {};
        for(let i=0; i<5; i++) {
            const id = `circle_${i}`;
            circles[id] = { id: id, x: 400 + (i * 40 - 80), y: 300, owner: null };
        }
        rooms[roomName].circles = circles;
        io.to(roomName).emit('spawnCircles', Object.values(circles));
    }
    socket.on('toggleGrab', () => {
        console.log("Toggle grab received from ", socket.id);
        const room = rooms[players[socket.id].room];
        const player = players[socket.id];
        
        // If already holding something, drop it
        if (player.holding) {
            const circleId = player.holding;
            console.log("Dropping circle ", circleId);
            room.circles[circleId].owner = null;
            room.circles[circleId].x = player.x;
            room.circles[circleId].y = player.y;
            player.holding = null;
            io.to(player.room).emit('circleDropped', { circleId, x: player.x, y: player.y });
        } else {
            // Try to grab the nearest circle
            console.log("Trying to grab a circle");
            for (let id in room.circles) {
                const c = room.circles[id];
                const dist = Math.hypot(c.x - player.x, c.y - player.y);
                
                if (dist < 50 && !c.owner) { // Close enough and not taken
                    c.owner = socket.id;
                    player.holding = id;
                    io.to(player.room).emit('circleGrabbed', { circleId: id, playerId: socket.id });
                    break;
                }
            }
        }
    });
    // Broadcast ONLY to others in that specific room
    socket.to(roomName).emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (movementData) => {
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        // Notify only room members
        socket.to(players[socket.id].room).emit('playerMoved', players[socket.id]);
    });

    socket.on('disconnect', () => {
            const roomName = players[socket.id]?.room;
            if (roomName && rooms[roomName]) {
                // Remove player from room tracking
                rooms[roomName].playerIds = rooms[roomName].playerIds.filter(id => id !== socket.id);
                
                // CHECK: If 2 players left (1 remaining) and game had started
                if (rooms[roomName].started && rooms[roomName].playerIds.length === 1) {
                    io.to(roomName).emit('winner', rooms[roomName].playerIds[0]);
                }
            }
            delete players[socket.id];
            io.to(roomName).emit('disconnected', socket.id);
        });
});

http.listen(3000, () => console.log('Server running on http://localhost:3000'));