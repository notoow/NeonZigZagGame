const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score-board');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

// Game State
let isPlaying = false;
let score = 0;
let gameSpeed = 5;
let frameCount = 0;

// Dimensions
let width, height;

function resize() {
    width = canvas.width = canvas.offsetWidth;
    height = canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', resize);
resize();

// Game Objects
const ball = {
    x: 0,
    y: 0,
    radius: 8,
    color: '#ff00ff',
    dx: 0,
    dy: 0,
    speed: 5,
    trail: []
};

let path = [];
const pathWidth = 50;
const segmentLength = 40; // Visual length of segment
let cameraY = 0;

// Audio
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'tap') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'die') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'score') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
}

// Path Generation Logic
function generatePathSegment() {
    let lastSegment;

    if (path.length === 0) {
        // Start platform - Start from bottom-leftish
        lastSegment = {
            x: width * 0.3, // Start at 30% width
            y: height * 0.8, // Start at 80% height
            width: pathWidth,
            height: segmentLength,
            direction: 'right' // Start moving Right (Diagonal Up-Right)
        };
        path.push(lastSegment);
        return;
    } else {
        lastSegment = path[path.length - 1];
    }

    let direction = lastSegment.direction || 'right';

    // Randomly switch direction, but less frequently to make it smoother
    if (Math.random() < 0.15) {
        direction = (direction === 'right') ? 'left' : 'right';
    }

    // BOUNDS CHECKING
    // We need to look ahead. If we are too close to the edge, force a turn.
    const margin = pathWidth * 1.5;
    const step = segmentLength / 2;

    // Predict next position based on current direction
    let nextX = lastSegment.x + (direction === 'right' ? step : -step);

    // If going Right would hit right wall, force Left
    if (direction === 'right' && nextX > width - margin) {
        direction = 'left';
    }
    // If going Left would hit left wall, force Right
    else if (direction === 'left' && nextX < margin) {
        direction = 'right';
    }

    // Calculate final new position
    let newX = lastSegment.x;
    let newY = lastSegment.y - step; // Always moving up

    if (direction === 'right') {
        newX += step;
    } else {
        newX -= step;
    }

    path.push({
        x: newX,
        y: newY,
        width: pathWidth,
        height: segmentLength,
        direction: direction
    });
}

function initGame() {
    score = 0;
    scoreElement.innerText = score;
    gameSpeed = 5;
    cameraY = 0;

    // Reset Path
    path = [];

    // 1. Create the first segment manually to set the start point
    generatePathSegment(); // This creates the first block at width*0.3, height*0.8

    // 2. Create a "Safe Zone" - a long diagonal straight path
    // We force the direction to be 'right' for the first 15 segments
    for (let i = 0; i < 15; i++) {
        const last = path[path.length - 1];
        const step = segmentLength / 2;
        path.push({
            x: last.x + step,
            y: last.y - step,
            width: pathWidth,
            height: segmentLength,
            direction: 'right'
        });
    }

    // 3. Generate random path after the safe zone
    for (let i = 0; i < 50; i++) {
        generatePathSegment();
    }

    // 4. Place Ball on the start of the path
    ball.x = path[0].x;
    ball.y = path[0].y;

    // Initial velocity must match the 'right' direction
    ball.dx = ball.speed; // Moving Right
    ball.dy = -ball.speed; // Moving Up

    ball.trail = [];
}

function handleInput() {
    if (!isPlaying) {
        isPlaying = true;
        startScreen.classList.remove('active');
        gameOverScreen.classList.remove('active');
        initGame();
        loop();
        playSound('tap');
        return;
    }

    // Switch Direction
    ball.dx = -ball.dx;
    playSound('tap');
}

// Event Listeners
window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput();
}, { passive: false });
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') handleInput();
});

restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleInput();
});

function update() {
    // Move Ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Camera Follow
    const targetCamY = ball.y - height * 0.6;
    cameraY += (targetCamY - cameraY) * 0.1;

    // Trail
    if (frameCount % 2 === 0) {
        ball.trail.push({ x: ball.x, y: ball.y, alpha: 0.8 });
    }
    for (let i = ball.trail.length - 1; i >= 0; i--) {
        ball.trail[i].alpha -= 0.05;
        if (ball.trail[i].alpha <= 0) {
            ball.trail.splice(i, 1);
        }
    }

    // Collision Detection
    let onPath = false;

    // We can look at segments that are within vertical range of the ball
    for (const seg of path) {
        if (ball.y >= seg.y && ball.y <= seg.y + seg.height) {
            // Check X overlap
            const tolerance = ball.radius;
            if (ball.x >= seg.x - seg.width / 2 - tolerance && ball.x <= seg.x + seg.width / 2 + tolerance) {
                onPath = true;
                break;
            }
        }
    }

    if (!onPath) {
        gameOver();
    }

    // Score
    // Score is based on distance traveled up
    // Use the start Y of the path to calculate score
    // The start Y is roughly height * 0.8
    const startY = height * 0.8;
    const currentScore = Math.floor((startY - ball.y) / 50);
    if (currentScore > score) {
        score = currentScore;
        scoreElement.innerText = score;
        if (score % 10 === 0) playSound('score');
    }

    // Infinite Path
    if (path[path.length - 1].y > ball.y - height) {
        generatePathSegment();
    }

    // Cleanup
    if (path[0].y > ball.y + height) {
        path.shift();
    }

    frameCount++;
}

function draw() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(0, -cameraY);

    // Draw Path
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 243, 255, 0.5)';

    for (const seg of path) {
        // Top face
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(seg.x - seg.width / 2, seg.y, seg.width, seg.height);

        // Borders
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(seg.x - seg.width / 2, seg.y, seg.width, seg.height);
    }

    // Draw Trail
    ctx.shadowBlur = 0;
    for (const t of ball.trail) {
        ctx.fillStyle = `rgba(255, 0, 255, ${t.alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, ball.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw Ball
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff00ff';
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner light
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 2, ball.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function loop() {
    if (!isPlaying) return;
    update();
    // Only draw and schedule next frame if still playing
    if (isPlaying) {
        draw();
        requestAnimationFrame(loop);
    }
}

function gameOver() {
    isPlaying = false;
    playSound('die');
    finalScoreElement.innerText = `Score: ${score}`;
    gameOverScreen.classList.add('active');
}

// Prevent double input on desktop (mousedown on button bubbling to window)
restartBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
});

// Init
resize();
initGame();
draw();
