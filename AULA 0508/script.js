window.onload = function(){
    const popup = document.createElement('div');
    
    popup.style.width = '20rem';
    popup.style.height = '20rem';
    popup.style.display = 'flex';
    popup.style.backgroundColor = 'black';
    popup.style.transform = 'translate(-50%,-50%)';
    popup.style.border = '2px solid black';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.position = 'absolute';
    popup.style.alignItems = 'center';
    popup.style.justifyContent = 'center';

    document.body.appendChild(popup);

    popup.textContent = "Entre no Jogo";
}


const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');


let gameRunning = true;
let score = 0;
let gameSpeed = 2;


const player = {
    x: canvas.width / 2,
    y: canvas.height - 80,
    width: 30,
    height: 40,
    health: 100,
    speed: 5
};


let bullets = [];
let enemies = [];
let obstacles = [];
let particles = [];


const keys = {};
document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);


let tunnelOffset = 0;

class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 10;
        this.speed = 8;
    }

    update() {
        this.y -= this.speed;
    }

    draw() {
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add glow effect
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 25;
        this.height = 25;
        this.speed = 2 + Math.random() * 2;
        this.health = 2;
    }

    update() {
        this.y += this.speed + gameSpeed;
    }

    draw() {
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Enemy details
        ctx.fillStyle = '#ff8888';
        ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
    }
}

class Obstacle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = gameSpeed;
    }

    update() {
        this.y += this.speed;
    }

    draw() {
        ctx.fillStyle = '#666666';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add metallic effect
        ctx.fillStyle = '#888888';
        ctx.fillRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 30;
        this.maxLife = 30;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.globalAlpha = 1;
    }
}

function drawTunnel() {
    tunnelOffset += gameSpeed;
    
    
    for (let i = 0; i < canvas.height; i += 20) {
        const perspective = i / canvas.height;
        const wallWidth = 50 + perspective * 100;
        
        
        ctx.fillStyle = `rgb(${30 + perspective * 50}, ${30 + perspective * 50}, ${60 + perspective * 50})`;
        ctx.fillRect(0, i, wallWidth, 20);
        
        
        ctx.fillRect(canvas.width - wallWidth, i, wallWidth, 20);
        
        
        if ((i + tunnelOffset) % 40 < 20) {
            ctx.fillStyle = `rgb(${50 + perspective * 30}, ${50 + perspective * 30}, ${80 + perspective * 30})`;
            ctx.fillRect(wallWidth - 5, i, 5, 20);
            ctx.fillRect(canvas.width - wallWidth, i, 5, 20);
        }
    }
}

function drawPlayer() {
    
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(player.x - player.width/2, player.y, player.width, player.height);
    
   
    ctx.fillStyle = '#88ff88';
    ctx.fillRect(player.x - player.width/2 + 5, player.y + 5, player.width - 10, player.height - 10);
    
   
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(player.x - 3, player.y + player.height, 6, 8);
}

function updatePlayer() {
    
    if ((keys['a'] || keys['arrowleft']) && player.x > player.width/2 + 50) {
        player.x -= player.speed;
    }
    if ((keys['d'] || keys['arrowright']) && player.x < canvas.width - player.width/2 - 50) {
        player.x += player.speed;
    }
    if ((keys['w'] || keys['arrowup']) && player.y > 0) {
        player.y -= player.speed;
    }
    if ((keys['s'] || keys['arrowdown']) && player.y < canvas.height - player.height) {
        player.y += player.speed;
    }
    
    
    if (keys[' '] && bullets.length < 10) {
        bullets.push(new Bullet(player.x - 2, player.y));
        keys[' '] = false; // Prevent rapid fire
    }
}

function spawnEnemies() {
    if (Math.random() < 0.02) {
        const x = 100 + Math.random() * (canvas.width - 200);
        enemies.push(new Enemy(x, -30));
    }
}

function spawnObstacles() {
    if (Math.random() < 0.01) {
        const width = 50 + Math.random() * 100;
        const x = 50 + Math.random() * (canvas.width - width - 100);
        obstacles.push(new Obstacle(x, -50, width, 30));
    }
}

function checkCollisions() {
    
    bullets.forEach((bullet, bulletIndex) => {
        enemies.forEach((enemy, enemyIndex) => {
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                
                // Create explosion particles
                for (let i = 0; i < 8; i++) {
                    particles.push(new Particle(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ff4444'));
                }
                
                bullets.splice(bulletIndex, 1);
                enemies.splice(enemyIndex, 1);
                score += 10;
            }
        });
    });
    
   
    enemies.forEach((enemy, index) => {
        if (player.x - player.width/2 < enemy.x + enemy.width &&
            player.x + player.width/2 > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            
            enemies.splice(index, 1);
            player.health -= 20;
            
            
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(player.x, player.y, '#ff0000'));
            }
        }
    });
    
    
    obstacles.forEach((obstacle, index) => {
        if (player.x - player.width/2 < obstacle.x + obstacle.width &&
            player.x + player.width/2 > obstacle.x &&
            player.y < obstacle.y + obstacle.height &&
            player.y + player.height > obstacle.y) {
            
            player.health -= 30;
            
            
            for (let i = 0; i < 8; i++) {
                particles.push(new Particle(player.x, player.y, '#ffff00'));
            }
        }
    });
}

function updateGame() {
    if (!gameRunning) return;
    
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    
    drawTunnel();
    
   
    updatePlayer();
    drawPlayer();
    
   
    spawnEnemies();
    spawnObstacles();
    
    
    bullets.forEach((bullet, index) => {
        bullet.update();
        bullet.draw();
        if (bullet.y < 0) bullets.splice(index, 1);
    });
    

    enemies.forEach((enemy, index) => {
        enemy.update();
        enemy.draw();
        if (enemy.y > canvas.height) enemies.splice(index, 1);
    });
    
   
    obstacles.forEach((obstacle, index) => {
        obstacle.update();
        obstacle.draw();
        if (obstacle.y > canvas.height) obstacles.splice(index, 1);
    });
    
    
    particles.forEach((particle, index) => {
        particle.update();
        particle.draw();
        if (particle.life <= 0) particles.splice(index, 1);
    });
    
    
    checkCollisions();
    
   
    document.getElementById('score').textContent = score;
    document.getElementById('health').textContent = Math.max(0, player.health);
    
    
    gameSpeed += 0.001;
    
    
    if (player.health <= 0) {
        gameOver();
    }
    

    requestAnimationFrame(updateGame);
}

function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
}

function restartGame() {

    gameRunning = true;
    score = 0;
    gameSpeed = 2;
    player.health = 100;
    player.x = canvas.width / 2;
    player.y = canvas.height - 80;
    
    
    bullets = [];
    enemies = [];
    obstacles = [];
    particles = [];
    
    
    document.getElementById('gameOver').style.display = 'none';
    
    
    updateGame();
}
