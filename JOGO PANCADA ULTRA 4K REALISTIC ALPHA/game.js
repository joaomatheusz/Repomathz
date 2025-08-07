const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('scoreEl');
const modalEl = document.getElementById('modalEl');
const bigScoreEl = document.getElementById('bigScoreEl');
const startGameBtn = document.getElementById('startGameBtn');
const powerUpStatusEl = document.getElementById('powerUpStatus');

canvas.width = innerWidth;
canvas.height = innerHeight;

const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

// --- CLASSES DO JOGO ---
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.color = 'hsl(204, 86%, 53%)';
        this.angle = 0;
        this.velocity = { x: 0, y: 0 };
        this.acceleration = 0.2;
        this.maxSpeed = 5;
        this.friction = 0.97;
        this.powerUp = null;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(-this.radius * 0.8, this.radius * 0.8);
        ctx.lineTo(this.radius * 0.8, this.radius * 0.8);
        ctx.closePath();
        ctx.strokeStyle = this.color;
        ctx.stroke();
        ctx.restore();
    }
    update() {
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        if (keys.w.pressed) this.velocity.y -= this.acceleration;
        if (keys.s.pressed) this.velocity.y += this.acceleration;
        if (keys.a.pressed) this.velocity.x -= this.acceleration;
        if (keys.d.pressed) this.velocity.x += this.acceleration;
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (speed > this.maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
            this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
        }
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.clampToScreen();
        this.draw();
    }
    clampToScreen() {
        if (this.x - this.radius < 0) this.x = this.radius;
        if (this.x + this.radius > canvas.width) this.x = canvas.width - this.radius;
        if (this.y - this.radius < 0) this.y = this.radius;
        if (this.y + this.radius > canvas.height) this.y = canvas.height - this.radius;
    }
}

class Projectile {
    constructor(x, y, radius, color, velocity) { this.x = x; this.y = y; this.radius = radius; this.color = color; this.velocity = velocity; }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); }
    update() { this.draw(); this.x += this.velocity.x; this.y += this.velocity.y; }
}

class Enemy {
    constructor(x, y, radius, color, velocity) { this.x = x; this.y = y; this.radius = radius; this.color = color; this.velocity = velocity; }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); }
    update() { this.draw(); this.x += this.velocity.x; this.y += this.velocity.y; }
}

class PowerUp {
    constructor(x, y, velocity) { this.x = x; this.y = y; this.velocity = velocity; this.radius = 8; this.color = '#2ecc71'; }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); ctx.font = '10px Arial'; ctx.fillStyle = 'white'; ctx.fillText('3X', this.x - 5, this.y + 3); }
    update() { this.draw(); this.x += this.velocity.x; this.y += this.velocity.y; }
}

const friction = 0.99;
class Particle {
    constructor(x, y, radius, color, velocity) { this.x = x; this.y = y; this.radius = radius; this.color = color; this.velocity = velocity; this.alpha = 1; }
    draw() { ctx.save(); ctx.globalAlpha = this.alpha; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); ctx.restore(); }
    update() { this.draw(); this.velocity.x *= friction; this.velocity.y *= friction; this.x += this.velocity.x; this.y += this.velocity.y; this.alpha -= 0.01; }
}

class EnemyProjectile {
    constructor(x, y, velocity) { this.x = x; this.y = y; this.radius = 4; this.color = '#e74c3c'; this.velocity = velocity; }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); }
    update() { this.draw(); this.x += this.velocity.x; this.y += this.velocity.y; }
}

class ShootingEnemy {
    constructor(x, y, velocity) { this.x = x; this.y = y; this.radius = 12; this.color = '#9b59b6'; this.velocity = velocity; this.shootCooldown = Math.random() * 100 + 50; }
    draw() { ctx.fillStyle = this.color; ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2); }
    shoot() { const angle = Math.atan2(player.y - this.y, player.x - this.x); const speed = 4; enemyProjectiles.push(new EnemyProjectile(this.x, this.y, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })); }
    update() { this.draw(); this.x += this.velocity.x; this.y += this.velocity.y; this.shootCooldown--; if (this.shootCooldown <= 0) { this.shoot(); this.shootCooldown = 120; } }
}

class Asteroid {
    constructor(x, y, radius, velocity) {
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.radius = radius;
        this.color = '#7f8c8d';
        this.shapePoints = [];
        const numVertices = Math.floor(Math.random() * 5 + 10);
        for (let i = 0; i < numVertices; i++) {
            const angle = (i / numVertices) * Math.PI * 2;
            const randomRadius = this.radius * (Math.random() * 0.4 + 0.8);
            this.shapePoints.push({
                x: Math.cos(angle) * randomRadius,
                y: Math.sin(angle) * randomRadius
            });
        }
    }

    draw() {
        ctx.beginPath();
        ctx.moveTo(this.x + this.shapePoints[0].x, this.y + this.shapePoints[0].y);
        for (let i = 1; i < this.shapePoints.length; i++) {
            ctx.lineTo(this.x + this.shapePoints[i].x, this.y + this.shapePoints[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    update() {
        this.draw();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

let player, projectiles, enemies, particles, asteroids, powerUps, enemyProjectiles;
let score, animationId;
let difficultyLevel, enemySpawnRate, asteroidSpawnRate;
let spawnEnemiesIntervalId, spawnAsteroidsIntervalId;
const keys = { w: { pressed: false }, a: { pressed: false }, s: { pressed: false }, d: { pressed: false } };

function init() {
    player = new Player(canvas.width / 2, canvas.height / 2);
    projectiles = []; enemies = []; particles = []; asteroids = []; powerUps = []; enemyProjectiles = [];
    score = 0; scoreEl.textContent = score; bigScoreEl.textContent = score;
    difficultyLevel = 1;
    enemySpawnRate = 1800;
    asteroidSpawnRate = 2500;
}

function spawnObjects() {
    clearInterval(spawnEnemiesIntervalId); clearInterval(spawnAsteroidsIntervalId);
    spawnEnemiesIntervalId = setInterval(() => {
        const radius = Math.random() * (30 - 8) + 8; let x, y;
        if (Math.random() < 0.5) { x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius; y = Math.random() * canvas.height; } else { x = Math.random() * canvas.width; y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius; }
        const angle = Math.atan2(player.y - y, player.x - x); const velocity = { x: Math.cos(angle), y: Math.sin(angle) };
        if (Math.random() < 0.4 * (difficultyLevel / 1.5)) {
            enemies.push(new ShootingEnemy(x, y, velocity));
        } else {
            enemies.push(new Enemy(x, y, radius, `hsl(${Math.random() * 360}, 50%, 50%)`, velocity));
        }
    }, enemySpawnRate);

    spawnAsteroidsIntervalId = setInterval(() => {
        const radius = Math.random() * (50 - 20) + 20; let x, y;
        if (Math.random() < 0.5) { x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius; y = Math.random() * canvas.height; } else { x = Math.random() * canvas.width; y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius; }
        const angle = Math.atan2(player.y - y, player.x - x);
        const velocity = { x: Math.cos(angle) * 1.8, y: Math.sin(angle) * 1.8 };
        asteroids.push(new Asteroid(x, y, radius, velocity));
    }, asteroidSpawnRate);
}

function updateDifficulty() {
    difficultyLevel++;
    enemySpawnRate = Math.max(250, 1800 - difficultyLevel * 200);
    asteroidSpawnRate = Math.max(800, 2500 - difficultyLevel * 180);
    spawnObjects();
}

function animate() {
    animationId = requestAnimationFrame(animate);
    ctx.fillStyle = 'rgba(0, 0, 10, 0.2)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (score > difficultyLevel * 1000) { updateDifficulty(); }
    player.update();
    particles.forEach((p, i) => { if (p.alpha <= 0) particles.splice(i, 1); else p.update(); });
    projectiles.forEach((p, i) => { if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) projectiles.splice(i, 1); else p.update(); });
    enemyProjectiles.forEach((ep, i) => { ep.update(); if (Math.hypot(player.x - ep.x, player.y - ep.y) - player.radius - ep.radius < 1) { endGame(); } });
    powerUps.forEach((p, i) => { p.update(); if (Math.hypot(player.x - p.x, player.y - p.y) - player.radius - p.radius < 1) { activateTripleShot(); powerUps.splice(i, 1); } });

    enemies.forEach((enemy, enemyIndex) => {
        enemy.update();
        if (Math.hypot(player.x - enemy.x, player.y - enemy.y) - player.radius - enemy.radius < 1) { endGame(); }
        projectiles.forEach((proj, projIndex) => {
            if (Math.hypot(proj.x - enemy.x, proj.y - enemy.y) - enemy.radius - proj.radius < 1) {
                for (let i = 0; i < enemy.radius; i++) { particles.push(new Particle(proj.x, proj.y, Math.random() * 2, enemy.color, { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 })); }
                score += (enemy instanceof ShootingEnemy) ? 150 : 100; scoreEl.textContent = score;
                if (enemy instanceof ShootingEnemy && Math.random() > 0.7) {
                    powerUps.push(new PowerUp(proj.x, proj.y, { x: (Math.random() - 0.5), y: (Math.random() - 0.5) }));
                }
                setTimeout(() => { enemies.splice(enemyIndex, 1); projectiles.splice(projIndex, 1); }, 0);
            }
        });
    });

    asteroids.forEach((asteroid, astIndex) => {
        asteroid.update();
        if (Math.hypot(player.x - asteroid.x, player.y - asteroid.y) - player.radius - asteroid.radius < 1) { endGame(); }
        if (asteroid.x + asteroid.radius < 0 || asteroid.x - asteroid.radius > canvas.width ||
            asteroid.y + asteroid.radius < 0 || asteroid.y - asteroid.radius > canvas.height) {
            setTimeout(() => { asteroids.splice(astIndex, 1); }, 0);
        }
    });
}

function endGame() {
    cancelAnimationFrame(animationId);
    clearInterval(spawnEnemiesIntervalId);
    clearInterval(spawnAsteroidsIntervalId);
    modalEl.style.display = 'flex';
    bigScoreEl.textContent = score;
}

function activateTripleShot() {
    player.powerUp = 'TripleShot';
    powerUpStatusEl.style.display = 'block';
    setTimeout(() => { player.powerUp = null; powerUpStatusEl.style.display = 'none'; }, 7000);
}

window.addEventListener('mousemove', (event) => { mouse.x = event.clientX; mouse.y = event.clientY; });
window.addEventListener('click', () => {
    const speed = 7;
    const velocity = { x: Math.cos(player.angle) * speed, y: Math.sin(player.angle) * speed };
    if (player.powerUp === 'TripleShot') {
        for (let i = -1; i <= 1; i++) {
            const offsetAngle = 0.2 * i;
            projectiles.push(new Projectile(player.x, player.y, 5, '#f1c40f', { x: Math.cos(player.angle + offsetAngle) * speed, y: Math.sin(player.angle + offsetAngle) * speed }));
        }
    } else {
        projectiles.push(new Projectile(player.x, player.y, 5, 'white', velocity));
    }
});
window.addEventListener('keydown', (event) => { const key = event.key.toLowerCase(); if (key in keys) { keys[key].pressed = true; } });
window.addEventListener('keyup', (event) => { const key = event.key.toLowerCase(); if (key in keys) { keys[key].pressed = false; } });
startGameBtn.addEventListener('click', () => { init(); animate(); spawnObjects(); modalEl.style.display = 'none'; });
window.addEventListener('resize', () => { canvas.width = innerWidth; canvas.height = innerHeight; init(); });