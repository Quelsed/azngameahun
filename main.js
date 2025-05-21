document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('touchmove', function (e) {
        if (e.scale !== 1) {
            e.preventDefault();
        }
    }, { passive: false });

    resizeCanvas();
});

window.addEventListener('resize', function () {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(resizeCanvas, 200);
});

let axeAnimation = {
    active: false,
    progress: 0,
    side: 'right',
    duration: 0.3,
    rotation: 0
};

let fallingBranches = [];
let particles = [];
let isPlayerDead = false;
let playerFallProgress = 0;
const FALL_DURATION = 1.0;

const AXE_OFFSET = 20;
const FALLING_SPEED = 5;
const PARTICLE_COUNT = 10;
const HEAD_HEIGHT = 0.3;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const scoreElement = document.getElementById('scoreContainer');
const timerBar = document.getElementById('timerBar');
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');
let highScore = localStorage.getItem('highScore') || 0;

const IMAGE_PATHS = {
    tree: 'tree.png',
    branchLeft: 'branchleft.png',
    branchRight: 'branchright.png',
    playerLeft: 'ahunleft.png',
    playerRight: 'ahunright.png',
    playerDead: 'ahundead.png',
    axe: 'axe.png',
    background: 'back3.jpg'
};

const images = {
    tree: null,
    branchLeft: null,
    branchRight: null,
    playerLeft: null,
    playerRight: null,
    playerDead: null,
    axe: null,
    background: null
};

function loadImages() {
    return new Promise((resolve, reject) => {
        let loaded = 0;
        const total = Object.keys(IMAGE_PATHS).length;

        for (const key in IMAGE_PATHS) {
            const img = new Image();
            img.src = IMAGE_PATHS[key];
            img.onload = () => {
                images[key] = img;
                loaded++;
                if (loaded === total) resolve();
            };
            img.onerror = () => {
                console.error(`Error loading image: ${IMAGE_PATHS[key]}`);
                loaded++;
                if (loaded === total) resolve();
            };
        }
    });
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    updateGameSettings();
}

let isGameRunning = false;
let score = 0;
let playerSide = 'right';
let treeScroll = 0;
let branches = [];
let timeLeft = 1.0;
let timerId = null;
let speedMultiplier = 1.0;
const BASE_SPEED = 0.006;
const TIME_BOOST = 0.3;
const SCROLL_EASING = 0.2;
const MAX_TIME = 1.0;

let BRANCH_WIDTH;
let BRANCH_HEIGHT;
let TREE_WIDTH;
let PLAYER_SIZE;
let LEVEL_HEIGHT;
let VISIBLE_LEVELS = 2;
let targetTreeScroll = 0;

let isTelegram = false;

function updateGameSettings() {
    const scaleFactor = canvas.width / 400;

    BRANCH_WIDTH = 160 * scaleFactor;
    BRANCH_HEIGHT = 80 * scaleFactor;
    TREE_WIDTH = 100 * scaleFactor;
    PLAYER_SIZE = 100 * scaleFactor;
    LEVEL_HEIGHT = 100 * scaleFactor;
}

function updateTimer() {
    speedMultiplier = 1.0 + Math.floor(score / 20) * 0.5;
    timeLeft -= BASE_SPEED * speedMultiplier;

    timerBar.style.width = `${Math.max(0, timeLeft) * 100}%`;

    if (timeLeft < 0.3) {
        timerBar.style.backgroundColor = '#e74c3c';
    } else if (timeLeft < 0.6) {
        timerBar.style.backgroundColor = '#f39c12';
    } else {
        timerBar.style.backgroundColor = '#2ecc71';
    }

    if (timeLeft <= 0) {
        gameOver();
        return;
    }

    timerId = requestAnimationFrame(updateTimer);
}

function addTime() {
    if (!isGameRunning) return;
    timeLeft += TIME_BOOST / (1.0 + Math.floor(score / 20) * 0.5);
    if (timeLeft > MAX_TIME) timeLeft = MAX_TIME;
}

function drawTree() {
    if (images.tree) {
        ctx.drawImage(
            images.tree,
            canvas.width / 2 - TREE_WIDTH / 2,
            0,
            TREE_WIDTH,
            canvas.height
        );
    } else {
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(
            canvas.width / 2 - TREE_WIDTH / 2,
            0,
            TREE_WIDTH,
            canvas.height
        );
    }
}

function drawPlayer() {
    let x, y;

    if (isPlayerDead) {
        x = playerSide === 'left' ?
            canvas.width / 2 - TREE_WIDTH / 2 - PLAYER_SIZE * 0.7 :
            canvas.width / 2 + TREE_WIDTH / 2 - PLAYER_SIZE * 0.3;
        y = canvas.height - PLAYER_SIZE * 0.5 - 80 + 100 * (1 - playerFallProgress);

        if (images.playerDead) {
            ctx.drawImage(images.playerDead, x, y, PLAYER_SIZE, PLAYER_SIZE);
        } else {
            ctx.fillStyle = '#888';
            ctx.fillRect(x, y, PLAYER_SIZE, PLAYER_SIZE);
        }
    } else {
        x = playerSide === 'left' ?
            canvas.width / 2 - TREE_WIDTH / 2 - PLAYER_SIZE :
            canvas.width / 2 + TREE_WIDTH / 2;
        y = canvas.height - PLAYER_SIZE - 120;

        const img = playerSide === 'left' ? images.playerLeft : images.playerRight;

        if (img) {
            ctx.drawImage(img, x, y, PLAYER_SIZE, PLAYER_SIZE);
        } else {
            ctx.fillStyle = '#3498db';
            ctx.fillRect(x, y, PLAYER_SIZE, PLAYER_SIZE);
        }
    }

    if (axeAnimation.active && !isPlayerDead) {
        const axeX = playerSide === 'left' ?
            x + PLAYER_SIZE - AXE_OFFSET * axeAnimation.progress :
            x - AXE_OFFSET * axeAnimation.progress;
        const axeY = y + PLAYER_SIZE * 0.3;

        ctx.save();
        ctx.globalAlpha = 1 - axeAnimation.progress * 0.5;

        if (images.axe) {
            const axeWidth = 40;
            const axeHeight = 40;

            ctx.translate(axeX, axeY);
            ctx.rotate(playerSide === 'left' ? -axeAnimation.progress * Math.PI : axeAnimation.progress * Math.PI);
            ctx.drawImage(
                images.axe,
                -axeWidth / 2,
                -axeHeight / 2,
                axeWidth,
                axeHeight
            );
        } else {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(axeX, axeY, 30, 10);
        }

        ctx.restore();
    }
}

function createParticles(x, y, side) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: x + (side === 'left' ? -20 : 20),
            y: y + BRANCH_HEIGHT / 2,
            size: Math.random() * 5 + 2,
            color: ['#8B4513', '#654321', '#A0522D'][Math.floor(Math.random() * 3)],
            speedX: (Math.random() - 0.5) * 10 * (side === 'left' ? -1 : 1),
            speedY: Math.random() * -5 - 2,
            life: 1.0
        });
    }
}

function drawParticles() {
    particles.forEach((p, index) => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);

        p.x += p.speedX;
        p.y += p.speedY;
        p.life -= 0.02;

        if (p.life <= 0) {
            particles.splice(index, 1);
        }
    });
    ctx.globalAlpha = 1.0;
}

function drawFallingBranches() {
    fallingBranches.forEach((branch, index) => {
        const img = branch.side === 'left' ? images.branchLeft : images.branchRight;

        if (img) {
            ctx.save();
            ctx.translate(branch.x + BRANCH_WIDTH/2, branch.y + BRANCH_HEIGHT/2);
            ctx.rotate(branch.rotation);
            ctx.drawImage(
                img,
                -BRANCH_WIDTH/2,
                -BRANCH_HEIGHT/2,
                BRANCH_WIDTH,
                BRANCH_HEIGHT
            );
            ctx.restore();
        } else {
            ctx.fillStyle = '#2ecc71';
            ctx.save();
            ctx.translate(branch.x + BRANCH_WIDTH/2, branch.y + BRANCH_HEIGHT/2);
            ctx.rotate(branch.rotation);
            ctx.fillRect(
                -BRANCH_WIDTH/2,
                -BRANCH_HEIGHT/2,
                BRANCH_WIDTH,
                BRANCH_HEIGHT
            );
            ctx.restore();
        }

        branch.y += FALLING_SPEED;
        branch.rotation += branch.rotationSpeed;

        if (branch.y > canvas.height) {
            fallingBranches.splice(index, 1);
        }
    });
}

function drawBranches() {
    const BRANCH_OFFSET = 130; // Новое значение отступа от дерева (было BRANCH_WIDTH)

    branches.forEach(branch => {
        const branchY = branch.y + treeScroll - 80;
        if (branchY < canvas.height && branchY > -BRANCH_HEIGHT) {
            const img = branch.side === 'left' ? images.branchLeft : images.branchRight;

            if (img) {
                const x = branch.side === 'left' ?
                    canvas.width / 2 - TREE_WIDTH / 2 - BRANCH_OFFSET : // Изменено здесь
                    canvas.width / 2 + TREE_WIDTH / 2 - BRANCH_WIDTH + BRANCH_OFFSET; // И здесь
                ctx.drawImage(
                    img,
                    x,
                    branchY,
                    BRANCH_WIDTH,
                    BRANCH_HEIGHT
                );
            } else {
                ctx.fillStyle = '#2ecc71';
                ctx.fillRect(
                    branch.side === 'left' ?
                        canvas.width / 2 - TREE_WIDTH / 2 - BRANCH_OFFSET : // И здесь
                        canvas.width / 2 + TREE_WIDTH / 2 - BRANCH_WIDTH + BRANCH_OFFSET, // И здесь
                    branchY,
                    BRANCH_WIDTH,
                    BRANCH_HEIGHT
                );
            }
        }
    });
}

function generateSafeBranch() {
    const dangerousSides = new Set();

    branches.forEach(branch => {
        if (branch.y === -LEVEL_HEIGHT) {
            dangerousSides.add(branch.side);
        }
    });

    if (dangerousSides.size >= 2) return 'left';
    if (dangerousSides.size === 1) return dangerousSides.has('left') ? 'right' : 'left';

    const lastTwo = branches.slice(-2).map(b => b.side);
    if (lastTwo.length === 2 && lastTwo[0] === lastTwo[1]) {
        return lastTwo[0] === 'left' ? 'right' : 'left';
    }

    return Math.random() < 0.5 ? 'left' : 'right';
}

function checkCollision() {
    const playerY = canvas.height - PLAYER_SIZE - 100;
    const playerHeadY = playerY + PLAYER_SIZE * 0.2;
    const playerHeadHeight = PLAYER_SIZE * 0.5;

    const branchAtPlayerLevel = branches.find(branch => {
        const branchYPos = branch.y + treeScroll;
        const branchBottom = branchYPos + BRANCH_HEIGHT;

        return (
            (branchBottom + 50) >= playerHeadY &&
            branchYPos <= playerHeadY + playerHeadHeight &&
            branch.side === playerSide
        );
    });

    return !!branchAtPlayerLevel;
}

function handleMove(side) {
    if (!isGameRunning) return;

    axeAnimation = {
        active: true,
        progress: 0,
        side: side,
        duration: 0.2
    };

    playerSide = side;
    targetTreeScroll += LEVEL_HEIGHT;
    addTime();

    if (checkCollision()) {
        createParticles(
            playerSide === 'left' ?
                canvas.width / 2 - TREE_WIDTH / 2 - PLAYER_SIZE :
                canvas.width / 2 + TREE_WIDTH / 2,
            canvas.height - PLAYER_SIZE - 80,
            playerSide
        );
        gameOver();
        return;
    }

    const playerY = canvas.height - PLAYER_SIZE - 80;
    
    // Новая логика: проверяем все ветки, которые теперь находятся ниже игрока
    const branchesToBreak = branches.filter(branch => {
        const branchScreenY = branch.y + targetTreeScroll;
        const branchBottom = branchScreenY + BRANCH_HEIGHT;
        return branchBottom > (playerY + 150) && branch.side !== playerSide;
    });

    // Добавляем сломанные ветки в fallingBranches
    branchesToBreak.forEach(branch => {
        const x = branch.side === 'left' ?
            canvas.width / 2 - TREE_WIDTH / 2 - BRANCH_WIDTH :
            canvas.width / 2 + TREE_WIDTH / 2;
        
        fallingBranches.push({
            side: branch.side,
            x: x,
            y: branch.y + targetTreeScroll,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        });
        
        createParticles(x, branch.y + targetTreeScroll, branch.side);
    });

    // Удаляем сломанные ветки из основного массива
    branches = branches.filter(branch => !branchesToBreak.includes(branch));

    // Генерируем новую безопасную ветку
    if (branches.every(b => b.y !== -targetTreeScroll)) {
        branches.push({
            side: generateSafeBranch(),
            y: -targetTreeScroll - LEVEL_HEIGHT
        });
    }

    branches = branches.filter(b => b.y + treeScroll < canvas.height + BRANCH_HEIGHT);

    score++;
    scoreElement.textContent = `Score: ${score}`;
}

function gameOver() {
    isGameRunning = false;
    isPlayerDead = true;
    playerFallProgress = 0;

    function animateFall() {
        playerFallProgress += 0.05;
        if (playerFallProgress >= 1) {
            playerFallProgress = 1;
            // Удалите эту строку, чтобы кнопка старта не показывалась
            // startButton.classList.remove('hidden');
            if (timerId) {
                cancelAnimationFrame(timerId);
                timerId = null;
            }

            if (score > highScore) {
                highScore = score;
                localStorage.setItem('highScore', highScore);
            }

            const gameOverScreen = document.getElementById('gameOverScreen');
            const finalScoreElement = document.getElementById('finalScore');
            const ahunsitImage = document.getElementById('ahunsitImage');

            finalScoreElement.textContent = `Score: ${score} | Best: ${highScore}`;
            ahunsitImage.style.display = 'block';
            gameOverScreen.style.display = 'flex';
        } else {
            requestAnimationFrame(animateFall);
        }
    }

    animateFall();
}


async function startGame() {
    if (!images.tree || !images.branchLeft || !images.branchRight || !images.playerLeft || !images.playerRight) {
        await loadImages();
    }

    startButton.classList.add('hidden');
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('ahunsitImage').style.display = 'none';

    isGameRunning = true;
    isPlayerDead = false;
    score = 0;
    timeLeft = MAX_TIME;
    speedMultiplier = 1.0;
    treeScroll = 0;
    targetTreeScroll = 0;
    playerSide = 'right';
    branches = [];
    scoreElement.textContent = `Score: ${score}`;
    timerBar.style.width = '100%';
    timerBar.style.backgroundColor = '#2ecc71';

    for (let i = 0; i < 1; i++) {
        branches.push({
            side: generateSafeBranch(),
            y: -i * LEVEL_HEIGHT
        });
    }

    if (timerId) cancelAnimationFrame(timerId);
    timerId = requestAnimationFrame(updateTimer);

    gameLoop();
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (axeAnimation.active) {
        axeAnimation.progress += 0.05;
        if (axeAnimation.progress >= 1) {
            axeAnimation.active = false;
        }
    }

    treeScroll += (targetTreeScroll - treeScroll) * SCROLL_EASING;
    if (Math.abs(targetTreeScroll - treeScroll) < 0.5) {
        treeScroll = targetTreeScroll;
    }

    if (images.background) {
        ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    drawTree();
    drawBranches();
    drawFallingBranches();
    drawParticles();
    drawPlayer();

    if (isGameRunning) requestAnimationFrame(gameLoop);
}

// Event listeners
leftButton.addEventListener('click', () => handleMove('left'));
rightButton.addEventListener('click', () => handleMove('right'));
startButton.addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('click', () => {
    document.getElementById('gameOverScreen').style.display = 'none';
    startGame();
});

// Touch controls
let touchStartX = 0;
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
});

canvas.addEventListener('touchend', (e) => {
    if (!isGameRunning) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX;

    if (Math.abs(diffX) > 30) {
        if (diffX > 0) {
            handleMove('right');
        } else {
            handleMove('left');
        }
    }
});

// Initialize
resizeCanvas();

// Инициализация Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();

}
