const socket = io();

let player;
let otherPlayers = {};
let keys;
let lastSent = 0;

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: "#000000",
    physics: {
        default: "arcade",
        arcade: { debug: false }
    },
    scene: { preload, create, update }
};

new Phaser.Game(config);

function preload() {}

function create() {
    const self = this;

    keys = this.input.keyboard.addKeys({
        up: "W",
        down: "S",
        left: "A",
        right: "D",
        grab: "F"
    });

    socket.on("currentPlayers", (players) => {
        Object.keys(players).forEach((id) => {
            if (id === socket.id) {
                addPlayer(self, players[id]);
            } else {
                addOtherPlayer(self, players[id]);
            }
        });
    });

    socket.on("newPlayer", (data) => {
        addOtherPlayer(self, data);
    });

    socket.on("playerMoved", (data) => {
        const p = otherPlayers[data.id];
        if (p) {
            p.x = data.x;
            p.y = data.y;
        }
    });

    socket.on("disconnectPlayer", (id) => {
        if (otherPlayers[id]) {
            otherPlayers[id].destroy();
            delete otherPlayers[id];
        }
    });
}

function addPlayer(scene, info) {
    player = scene.add.rectangle(info.x, info.y, 40, 40, 0x000000);
    scene.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);
}

function addOtherPlayer(scene, info) {
    const other = scene.add.rectangle(info.x, info.y, 40, 40, 0x666666);
    scene.physics.add.existing(other);
    otherPlayers[info.id] = other;
}

function update() {
    if (!player) return;

    const speed = 250;
    player.body.setVelocity(0);

    if (keys.left.isDown) player.body.setVelocityX(-speed);
    if (keys.right.isDown) player.body.setVelocityX(speed);
    if (keys.up.isDown) player.body.setVelocityY(-speed);
    if (keys.down.isDown) player.body.setVelocityY(speed);
// Inside the update() function in index.html
    if (keys.grab.isDown) {
        // This sends a custom message to the server
        this.socket.emit('toggleGrab'); 
    }
    const now = Date.now();
    if (now - lastSent > 30) {
        socket.emit("movement", { x: player.x, y: player.y });
        lastSent = now;
    }
}
