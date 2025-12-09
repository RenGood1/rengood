document.addEventListener('DOMContentLoaded', () => {
    const candle = document.getElementById('candle');
    const candleContainer = document.getElementById('candle-container');
    const flame = document.getElementById('flame');
    const gameContainer = document.getElementById('game-container');
    const startArea = document.getElementById('start-area');
    const finishArea = document.getElementById('finish-area');
    const livesCount = document.getElementById('lives-count');
    const timeCount = document.getElementById('time-count');
    const gameOverModal = document.getElementById('game-over-modal');
    const winModal = document.getElementById('win-modal');
    const restartBtn = document.getElementById('restart-btn');
    const playAgainBtn = document.getElementById('play-again-btn');
    const finalTime = document.getElementById('final-time');
    
    let lives = 3;
    let timer = 0;
    let timerInterval;
    let isDragging = false;
    let isFlameOut = false;
    let startX, startY, offsetX, offsetY;
    
    // Create obstacles
    createObstacles();
    
    // Start timer
    startTimer();
    
    // Initialize candle position
    positionCandleAtStart();
    
    // Desktop drag events
    candle.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Mobile touch events
    candle.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
    
    // Button event listeners
    restartBtn.addEventListener('click', resetGame);
    playAgainBtn.addEventListener('click', resetGame);
    
    function positionCandleAtStart() {
        const startRect = startArea.getBoundingClientRect();
        const containerRect = gameContainer.getBoundingClientRect();
        
        candleContainer.style.left = `${startRect.left - containerRect.left + (startRect.width / 2) - candleContainer.offsetWidth / 2}px`;
        candleContainer.style.top = `${startRect.top - containerRect.top + (startRect.height / 2) - candleContainer.offsetHeight / 2}px`;
    }
    
    function createObstacles() {
        const containerWidth = gameContainer.offsetWidth;
        const containerHeight = gameContainer.offsetHeight;
        
        // Static obstacles
        for (let i = 0; i < 5; i++) {
            const obstacle = document.createElement('div');
            obstacle.className = 'obstacle';
            
            // Random position and size
            const width = Math.random() * 100 + 50;
            const height = Math.random() * 100 + 50;
            const left = Math.random() * (containerWidth - width);
            const top = Math.random() * (containerHeight - height);
            
            obstacle.style.width = `${width}px`;
            obstacle.style.height = `${height}px`;
            obstacle.style.left = `${left}px`;
            obstacle.style.top = `${top}px`;
            
            gameContainer.appendChild(obstacle);
        }
        
        // Wind areas (more dangerous)
        for (let i = 0; i < 3; i++) {
            const wind = document.createElement('div');
            wind.className = 'wind-area';
            
            // Random position and size
            const width = Math.random() * 150 + 50;
            const height = Math.random() * 150 + 50;
            const left = Math.random() * (containerWidth - width);
            const top = Math.random() * (containerHeight - height);
            
            wind.style.width = `${width}px`;
            wind.style.height = `${height}px`;
            wind.style.left = `${left}px`;
            wind.style.top = `${top}px`;
            
            gameContainer.appendChild(wind);
        }
    }
    
    function startTimer() {
        timer = 0;
        timeCount.textContent = timer;
        timerInterval = setInterval(() => {
            timer++;
            timeCount.textContent = timer;
        }, 1000);
    }
    
    function stopTimer() {
        clearInterval(timerInterval);
    }
    
    function startDrag(e) {
        e.preventDefault();
        isDragging = true;
        
        const rect = candleContainer.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        candle.style.cursor = 'grabbing';
    }
    
    function drag(e) {
        if (!isDragging || isFlameOut) return;
        
        const containerRect = gameContainer.getBoundingClientRect();
        
        let x = e.clientX - containerRect.left - offsetX;
        let y = e.clientY - containerRect.top - offsetY;
        
        // Boundary checks
        x = Math.max(0, Math.min(containerRect.width - candleContainer.offsetWidth, x));
        y = Math.max(0, Math.min(containerRect.height - candleContainer.offsetHeight, y));
        
        candleContainer.style.left = `${x}px`;
        candleContainer.style.top = `${y}px`;
        
        // Check for collisions with obstacles and wind
        checkCollisions();
        
        // Check speed to potentially blow out flame
        checkSpeed();
        
        // Check for win condition
        checkWinCondition();
    }
    
    function handleTouchStart(e) {
        e.preventDefault();
        isDragging = true;
        
        const touch = e.touches[0];
        const rect = candleContainer.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;
        
        candle.style.cursor = 'grabbing';
    }
    
    function handleTouchMove(e) {
        if (!isDragging || isFlameOut) return;
        
        const touch = e.touches[0];
        const containerRect = gameContainer.getBoundingClientRect();
        
        let x = touch.clientX - containerRect.left - offsetX;
        let y = touch.clientY - containerRect.top - offsetY;
        
        // Boundary checks
        x = Math.max(0, Math.min(containerRect.width - candleContainer.offsetWidth, x));
        y = Math.max(0, Math.min(containerRect.height - candleContainer.offsetHeight, y));
        
        candleContainer.style.left = `${x}px`;
        candleContainer.style.top = `${y}px`;
        
        // Check for collisions with obstacles and wind
        checkCollisions();
        
        // Check speed to potentially blow out flame
        checkSpeed();
        
        // Check for win condition
        checkWinCondition();
    }
    
    function handleTouchEnd() {
        endDrag();
    }
    
    function endDrag() {
        isDragging = false;
        candle.style.cursor = 'grab';
    }
    
    function checkCollisions() {
        if (isFlameOut) return;
        
        const candleRect = candleContainer.getBoundingClientRect();
        const obstacles = document.querySelectorAll('.obstacle, .wind-area');
        
        obstacles.forEach(obstacle => {
            const obstacleRect = obstacle.getBoundingClientRect();
            
            if (
                candleRect.right > obstacleRect.left &&
                candleRect.left < obstacleRect.right &&
                candleRect.bottom > obstacleRect.top &&
                candleRect.top < obstacleRect.bottom
            ) {
                // Check if it's a wind area (higher chance to blow out)
                if (obstacle.classList.contains('wind-area')) {
                    if (Math.random() < 0.3) {
                        blowOutFlame();
                    }
                } else if (Math.random() < 0.1) {
                    blowOutFlame();
                }
            }
        });
    }
    
    function checkSpeed() {
        // This would require tracking previous positions to calculate speed
        // For simplicity, we'll just check if dragging is happening rapidly
        if (isDragging && Math.random() < 0.009) {
            blowOutFlame();
        }
    }
    
    function blowOutFlame() {
        if (isFlameOut) return;
        
        isFlameOut = true;
        flame.style.display = 'none';
        
        lives--;
        livesCount.textContent = lives;
        
        if (lives <= 0) {
            // Game over
            stopTimer();
            gameOverModal.classList.remove('hidden');
        } else {
            // Show relight prompt
            setTimeout(() => {
                if (isFlameOut) { // Only if still out
                    flame.style.display = 'block';
                    isFlameOut = false;
                    positionCandleAtStart();
                }
            }, 1000);
        }
    }
    
    function checkWinCondition() {
        if (isFlameOut) return;
        
        const candleRect = candleContainer.getBoundingClientRect();
        const finishRect = finishArea.getBoundingClientRect();
        
        if (
            candleRect.right > finishRect.left &&
            candleRect.left < finishRect.right &&
            candleRect.bottom > finishRect.top &&
            candleRect.top < finishRect.bottom
        ) {
            // Win!
            stopTimer();
            finalTime.textContent = timer;
            winModal.classList.remove('hidden');
        }
    }
    
    function resetGame() {
        // Reset game state
        lives = 3;
        isFlameOut = false;
        flame.style.display = 'block';
        livesCount.textContent = lives;
        
        // Hide modals
        gameOverModal.classList.add('hidden');
        winModal.classList.add('hidden');
        
        // Remove old obstacles
        const obstacles = document.querySelectorAll('.obstacle, .wind-area');
        obstacles.forEach(obstacle => obstacle.remove());
        
        // Create new obstacles
        createObstacles();
        
        // Reset candle position
        positionCandleAtStart();
        
        // Restart timer
        startTimer();
    }
    
    // Handle window resize
    window.addEventListener('resize', positionCandleAtStart);
});