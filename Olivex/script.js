const gameBoard = document.getElementById('game-board');
const statusMessage = document.getElementById('status-message');
const resetButton = document.getElementById('reset-button');

let gameId = null;
let playerSymbol = null;
let gameActive = false;

const API_URL = '/.netlify/functions/game';

// Check if a game ID exists in the URL
function getGameIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('gameId');
}

// Update the URL with the game ID
function updateURL(id) {
    if (history.pushState) {
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?gameId=${id}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }
}

// Function to fetch the current game state
async function fetchGameState() {
    const response = await fetch(`${API_URL}?gameId=${gameId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch game state.');
    }
    const data = await response.json();
    return data;
}

// Function to handle player moves
async function handleMove(cellIndex) {
    if (!gameActive || !playerSymbol) return;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId,
                player: playerSymbol,
                move: cellIndex
            })
        });

        const data = await response.json();
        if (data.error) {
            statusMessage.textContent = data.error;
            return;
        }

        updateBoard(data.board);
        updateStatus(data.status);
    } catch (error) {
        console.error('Error making move:', error);
        statusMessage.textContent = "Error during move. Please try again.";
    }
}

// Function to create a new game
async function createNewGame() {
    statusMessage.textContent = "Creating a new game...";
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create' })
        });
        const data = await response.json();
        gameId = data.gameId;
        playerSymbol = 'X';
        updateURL(gameId);
        statusMessage.textContent = `New game created. Share this link with a friend!`;
        gameActive = true;
        updateBoard(data.board);
    } catch (error) {
        console.error('Error creating new game:', error);
        statusMessage.textContent = "Failed to create a new game.";
    }
}

// Function to join an existing game
async function joinGame(id) {
    statusMessage.textContent = "Joining game...";
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'join', gameId: id })
        });
        const data = await response.json();
        if (data.error) {
            statusMessage.textContent = data.error;
            return;
        }

        gameId = id;
        playerSymbol = data.player; // 'O'
        gameActive = true;
        updateBoard(data.board);
        updateStatus(data.status);
    } catch (error) {
        console.error('Error joining game:', error);
        statusMessage.textContent = "Failed to join the game.";
    }
}

// Function to update the board UI
function updateBoard(board) {
    const cells = document.querySelectorAll('.cell');
    board.forEach((cell, index) => {
        cells[index].textContent = cell;
    });
}

// Function to update the status message
function updateStatus(status) {
    statusMessage.textContent = status;
}

// Function to handle game reset
async function resetGame() {
    gameId = null;
    playerSymbol = null;
    gameActive = false;
    window.location.search = '';
    await initializeGame();
}

// Main initialization function
async function initializeGame() {
    gameId = getGameIdFromURL();
    if (gameId) {
        await joinGame(gameId);
        // Poll for game state updates every 2 seconds
        setInterval(async () => {
            try {
                const data = await fetchGameState();
                updateBoard(data.board);
                updateStatus(data.status);
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 2000);
    } else {
        await createNewGame();
    }
}

gameBoard.addEventListener('click', (e) => {
    if (e.target.classList.contains('cell') && gameActive) {
        const cellIndex = e.target.getAttribute('data-index');
        handleMove(cellIndex);
    }
});

resetButton.addEventListener('click', resetGame);

initializeGame();

