document.addEventListener('DOMContentLoaded', () => {
    // Canvas & Context
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // DOM Elements
    const ui = {
        p1HpBar: document.getElementById('player1-hp-bar'),
        p2HpBar: document.getElementById('player2-hp-bar'),
        p1HpText: document.getElementById('player1-hp-text'),
        p2HpText: document.getElementById('player2-hp-text'),
        p1Moves: document.getElementById('player1-moves'),
        p2Moves: document.getElementById('player2-moves'),
        timer: document.getElementById('timer'),
        messageBox: document.getElementById('message-box'),
        keyInstructions: document.getElementById('key-instructions'),
        attackButtons: document.getElementById('attack-buttons'),
        attackBtn: document.getElementById('attack-btn'),
        menuOverlay: document.getElementById('menu-overlay'),
        modeSelection: document.getElementById('mode-selection'),
        rulesScreen: document.getElementById('rules-screen'),
        gameOverScreen: document.getElementById('game-over'),
        gameOverMsg: document.getElementById('game-over-message')
    };

    // Game State
    let state = {
        mode: null,
        status: 'menu', // 'menu', 'playing', 'over'
        timer: 499,
        timerId: null,
        cpuAttackTimerId: null,
        projectiles: [],
        survivalRound: 1,
        player1: { hp: 1000, moves: 0, x: 200, y: 450, canAttack: true },
        player2: { hp: 1000, moves: 0, x: 800, y: 450, isCPU: false, canAttack: true }
    };

    // --- Drawing Functions ---
    const drawGun = (x, y, isFacingRight) => {
        ctx.fillStyle = '#6c757d'; // Gunmetal grey
        if (isFacingRight) {
            ctx.fillRect(x + 30, y - 15, 25, 10); // Gun body
            ctx.fillRect(x + 55, y - 13, 10, 6);  // Barrel
        } else {
            ctx.fillRect(x - 55, y - 15, 25, 10); // Gun body
            ctx.fillRect(x - 65, y - 13, 10, 6);  // Barrel
        }
    };

    const drawStickman = (x, y, hasHat, hasBand, isFacingRight) => {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        const armX = isFacingRight ? x + 35 : x - 35;
        const armY = y - 10;
        ctx.beginPath();
        ctx.moveTo(x, y - 30); ctx.lineTo(armX, armY); ctx.stroke(); // Firing arm
        drawGun(x, y, isFacingRight);
        ctx.moveTo(x, y - 30); ctx.lineTo(isFacingRight ? x - 25 : x + 25, y); ctx.stroke(); // Other arm
        ctx.beginPath();
        ctx.moveTo(x, y - 50); ctx.lineTo(x, y); ctx.stroke();
        ctx.moveTo(x, y); ctx.lineTo(x - 25, y + 40); ctx.stroke();
        ctx.moveTo(x, y); ctx.lineTo(x + 25, y + 40); ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y - 70, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'black'; ctx.fill(); ctx.stroke();
        if (hasHat) {
            ctx.fillStyle = 'gold';
            ctx.fillRect(x - 22, y - 95, 44, 10);
            ctx.fillRect(x - 15, y - 105, 30, 10);
        }
        if (hasBand) {
            ctx.strokeStyle = 'red'; ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(x - 25, y); ctx.lineTo(x - 35, y + 5); ctx.stroke();
        }
    };
    
    const drawProjectiles = () => {
        state.projectiles.forEach((p, index) => {
            p.x += p.vx;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            const target = p.attacker === 1 ? state.player2 : state.player1;
            if ((p.vx > 0 && p.x >= target.x) || (p.vx < 0 && p.x <= target.x)) {
                if (p.isHit) {
                    handleHit(p.attacker, p.isUltimate);
                }
                state.projectiles.splice(index, 1);
            }
        });
    };

    const gameLoop = () => {
        if (state.status !== 'playing' && state.status !== 'over') return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawStickman(state.player1.x, state.player1.y, true, false, true);
        drawStickman(state.player2.x, state.player2.y, false, true, false);
        drawProjectiles();
        requestAnimationFrame(gameLoop);
    };

    // --- Game Logic ---
    const resetPlayers = () => {
        state.player1 = { hp: 1000, moves: 0, x: 200, y: 450, canAttack: true };
        state.player2 = { hp: 1000, moves: 0, x: 800, y: 450, isCPU: state.mode === 'cpu' || state.mode === 'survival', canAttack: true };
        if (state.mode === 'survival') {
            state.player2.hp += (state.survivalRound - 1) * 100;
            if (state.survivalRound > 1 && state.survivalRound % 5 === 0) {
                 state.player1.hp = 1000;
                 displayMessage(`Round ${state.survivalRound}! HP Restored!`, 1500);
            }
        }
    };

    const updateUI = () => {
        ui.p1HpBar.style.width = `${Math.max(0, state.player1.hp / 10)}%`;
        ui.p2HpBar.style.width = `${Math.max(0, state.player2.hp / (state.mode === 'survival' ? (1000 + (state.survivalRound - 1) * 100) / 100 : 10))}%`;
        ui.p1HpText.textContent = `P1 HP: ${state.player1.hp}`;
        ui.p2HpText.textContent = `${state.player2.isCPU ? 'CPU' : 'P2'} HP: ${state.player2.hp}`;
        ui.p1Moves.textContent = `Attacks: ${state.player1.moves}`;
        ui.p2Moves.textContent = `Attacks: ${state.player2.moves}`;
        ui.timer.textContent = state.timer;
    };

    const displayMessage = (msg, duration = 2000) => {
        ui.messageBox.textContent = msg;
        ui.messageBox.style.opacity = 1;
        setTimeout(() => { ui.messageBox.style.opacity = 0; }, duration);
    };

    const startCpuAttackLoop = () => {
        const attack = () => {
            if (state.status === 'playing' && state.player2.isCPU) {
                performAttack(2);
                const randomInterval = Math.random() * 1500 + 1500; // Attack every 1.5 - 3 seconds
                state.cpuAttackTimerId = setTimeout(attack, randomInterval);
            }
        };
        attack();
    };

    const startGame = () => {
        state.status = 'playing';
        resetPlayers();
        updateUI();

        ui.menuOverlay.classList.remove('active');
        if (state.mode === '2player') {
            ui.attackButtons.style.display = 'none';
            ui.keyInstructions.style.display = 'block';
            ui.keyInstructions.textContent = 'P1: Press Q  |  P2: Press E';
        } else {
            ui.attackButtons.style.display = 'block';
            ui.attackBtn.disabled = false; // Ensure button is enabled at start
            ui.keyInstructions.style.display = 'none';
            startCpuAttackLoop();
        }
        
        state.timer = 499;
        state.timerId = setInterval(updateTimer, 1000);
        gameLoop();
    };

    const updateTimer = () => {
        state.timer--;
        ui.timer.textContent = state.timer;
        if (state.timer <= 0) {
            clearInterval(state.timerId);
            checkWinCondition(true);
        }
    };
    
    const performAttack = (attacker, isUltimate = false) => {
        const attackerPlayer = attacker === 1 ? state.player1 : state.player2;
        if (!attackerPlayer.canAttack || state.status !== 'playing') return;

        attackerPlayer.canAttack = false;
        attackerPlayer.moves++;
        updateUI();

        const cooldown = isUltimate ? 3000 : 1200; // 1.2s cooldown for normal attack
        setTimeout(() => {
            attackerPlayer.canAttack = true;
        }, cooldown);

        const isHit = Math.random() > 0.20; // 80% hit chance
        
        if (!isHit && !isUltimate) {
             displayMessage(`P${attacker} Missed!`, 1000);
        }
        
        const targetPlayer = attacker === 1 ? state.player2 : state.player1;
        const projectile = {
            attacker, isUltimate, isHit,
            x: attacker === 1 ? attackerPlayer.x + 65 : attackerPlayer.x - 65,
            y: isHit ? (targetPlayer.y - 40) : (attackerPlayer.y - 120),
            vx: attacker === 1 ? 20 : -20,
            size: isUltimate ? 30 : 10,
            color: isUltimate ? (attacker === 1 ? 'blue' : 'gold') : 'white',
        };
        state.projectiles.push(projectile);
    };
    
    const handleHit = (attacker, isUltimate) => {
        const defender = attacker === 1 ? state.player2 : state.player1;
        let damage = isUltimate ? Math.floor(Math.random() * 600) + 200 : Math.floor(Math.random() * 300) + 50;
        let critThreshold = isUltimate ? 1000 : 200;
        
        defender.hp = Math.max(0, defender.hp - damage);
        
        let msg = `P${attacker} Hit! ${damage} DMG!`;
        if (damage > critThreshold) { msg = `P${attacker} CRITICAL! ${damage} DMG!`; }
        displayMessage(msg, 1500);

        updateUI();
        checkWinCondition();
    }

    const checkWinCondition = (timeout = false) => {
        if (state.status !== 'playing') return;
        let winner = null;
        if (state.player1.hp <= 0 && state.player2.hp <= 0) { winner = 'Draw!'; } 
        else if (state.player1.hp <= 0) { winner = state.player2.isCPU ? 'CPU' : 'Player 2'; } 
        else if (state.player2.hp <= 0) { winner = state.mode === 'survival' ? `Round ${state.survivalRound} Cleared!` : 'Player 1'; }
        
        if (timeout) {
            if (state.player1.hp < state.player2.hp) winner = state.player2.isCPU ? 'CPU' : 'Player 2';
            else if (state.player2.hp < state.player1.hp) winner = 'Player 1';
            else { 
                displayMessage("Draw! Ultimate Round!", 3000);
                performAttack(1, true);
                if (!state.player2.isCPU) performAttack(2, true);
                return;
            }
        }
        if (winner) {
            if (state.mode === 'survival' && state.player2.hp <= 0) {
                state.survivalRound++;
                displayMessage(winner, 2000);
                setTimeout(startGame, 2500);
            } else {
                endGame(winner);
            }
        }
    };

    const endGame = (winnerMsg) => {
        state.status = 'over';
        clearInterval(state.timerId);
        clearTimeout(state.cpuAttackTimerId);
        
        ui.gameOverMsg.textContent = winnerMsg.includes('Draw') || winnerMsg.includes('Cleared') ? winnerMsg : `${winnerMsg} Wins!`;
        setTimeout(() => {
            ui.menuOverlay.classList.add('active');
            ui.gameOverScreen.classList.add('active');
        }, 2000);
    };

    // --- Event Listeners ---
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.mode = btn.dataset.mode;
            ui.modeSelection.classList.remove('active');
            displayMessage("Get Ready...", 1500);
            setTimeout(startGame, 1500);
        });
    });

    ui.attackBtn.addEventListener('click', () => performAttack(1));
    
    document.addEventListener('keydown', (e) => {
        if (state.mode === '2player' && state.status === 'playing') {
            const key = e.key.toLowerCase();
            if (key === 'q') performAttack(1);
            if (key === 'e') performAttack(2);
        }
        if (e.key.toLowerCase() === 'r' && state.status === 'menu') {
            ui.rulesScreen.classList.add('active');
            ui.modeSelection.classList.remove('active');
        }
    });
    
    document.getElementById('play-again-yes').addEventListener('click', () => {
        state.status = 'menu';
        state.survivalRound = 1;
        ui.gameOverScreen.classList.remove('active');
        ui.modeSelection.classList.add('active');
    });
    
    document.getElementById('play-again-no').addEventListener('click', () => {
        ui.gameOverScreen.classList.remove('active');
        displayMessage("Thanks for playing!", 5000);
    });
    
    document.getElementById('close-rules-btn').addEventListener('click', () => {
        ui.rulesScreen.classList.remove('active');
        ui.modeSelection.classList.add('active');
    });
});