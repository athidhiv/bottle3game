const socket = io();

const joinForm = document.getElementById('join-form');
const statusArea = document.getElementById('status-area');
const playerCountText = document.getElementById('player-count');
const countdownText = document.getElementById('countdown');

joinForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const color = document.querySelector('input[name="color"]:checked').value;

    socket.emit('joinGame', { username, color });

    joinForm.style.display = 'none';
    statusArea.style.display = 'block';
});

socket.on('playerUpdate', (data) => {
    playerCountText.innerText = `Players waiting: ${data.count}/3`;

    if (data.count === 3) {
        startCountdown();
    }
});

function startCountdown() {
    let timeLeft = 3;
    countdownText.innerText = timeLeft;

    const interval = setInterval(() => {
        timeLeft--;
        countdownText.innerText = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(interval);
            window.location.href = 'game.html';
        }
    }, 1000);
}
