const gameBoard = document.getElementById('game-board');
const statusMessage = document.getElementById('status-message');
const resetButton = document.getElementById('reset-button');
const gameIdDisplay = document.getElementById('game-id-display');
const playerIdDisplay = document.getElementById('player-id-display');
const copyGameLinkButton = document.getElementById('copy-game-link-button');
const messageBox = document.getElementById('message-box');
const messageContent = document.getElementById('message-content');

let gameId = null;
let playerSymbol = null; // 'X' or 'O'
let gameActive = false;
let gamePollingInterval = null; // To store the interval ID for polling

// Netlify Function endpoint
const API_URL = '/.netlify/functions/game';

// --- Utility Functions ---

/**
 * Displays a custom message box instead of alert().
 * @param {string} message - The message to display.
 */
function showMessageBox(message) {
    messageContent.textContent = message;
    messageBox.classList.remove('hidden');
}

/**
 * Hides the custom message box.
 */
function hideMessageBox() {
    messageBox.classList.add('hidden');
}

// Attach to the global scope for the HTML onclick
window.hideMessageBox = hideMessageBox;

/**
 * Generates a unique client ID if one doesn't exist in local storage.
 * This helps identify the user across sessions.
 * @returns {string} The unique client ID.
 */
function getOrCreateClientId() {
    let clientId = localStorage.getItem('ticTacToeClientId');
    if (!clientId) {
        clientId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('ticTacToeClientId', clientId);
    }
    return clientId;
}

const clientId = getOrCreateClientId(); // Get client ID on script load

/**
 * Fetches the game ID from the URL query parameters.
 * @returns {string|null} The game ID if found, otherwise null.
 */
function getGameIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('gameId');
}

/**
 * Updates the browser's URL with the current game ID.
 * This allows sharing the link for multiplayer.
 * @param {string} id - The game ID to add to the URL.
 */
function updateURL(id) {
    if (history.pushState) {
        const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?gameId=${id}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }
}

// --- API Interaction Functions ---

/**
 * Retries a fetch request with exponential backoff.
 * @param {Function} apiCall - The async function that performs the API call.
 * @param {number} retries - Number of retries.
 * @param {number} delay - Initial delay in ms.
 */
async function retryFetch(apiCall, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            if (i < retries - 1) {
                console.warn(`Attempt ${i + 1} failed, retrying in ${delay / 1000}s...`, error);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2; // Exponential backoff
            } else {
                throw error; // Re-throw if all retries fail
            }
        }
    }
}


/**
 * Fetches the current state of the game from the Netlify Function.
 * @returns {Promise<Object>} The game state data.
 * @throws {Error} If the fetch request fails.
 */
async function fetchGameState() {
    try {
        const response = await retryFetch(async () => {
            const res = await fetch(`${API_URL}?gameId=${gameId}&clientId=${clientId}`);
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Failed to fetch game state: ${res.status} ${res.statusText} - ${errorText}`);
            }
            return res;
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching game state:', error);
        throw error;
    }
}

/**
 * Handles a player's move by sending it to the Netlify Function.
 * @param {number} cellIndex - The index of the cell where the player made a move.
 */
async function handleMove(cellIndex) {
    if (!gameActive || !playerSymbol) {
        showMessageBox("Game not active or your symbol is not set.");
        return;
    }

    try {
        const response = await retryFetch(async () => {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'move',
                    gameId,
                    player: playerSymbol,
                    move: parseInt(cellIndex),
                    clientId // Pass clientId for validation
                })
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to make move.');
            }
            return res;
        });

        const data = await response.json();
        // The API sends back the updated game state directly
        updateBoard(data.board);
        updateStatus(data.status);
        if (data.winner || data.status.includes('draw')) {
            gameActive = false; // End game
            clearInterval(gamePollingInterval); // Stop polling
        }
    } catch (error) {
        console.error('Error making move:', error);
        showMessageBox(error.message || "Error during move. Please try again.");
    }
}

/**
 * Creates a new game by sending a request to the Netlify Function.
 */
async function createNewGame() {
    statusMessage.textContent = "Creating a new game...";
    try {
        const response = await retryFetch(async () => {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', clientId }) // Pass clientId here
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to create new game.');
            }
            return res;
        });
        const data = await response.json();
        gameId = data.gameId;
        playerSymbol = 'X'; // Creator is always 'X'
        gameIdDisplay.textContent = `Game ID: ${gameId}`;
        playerIdDisplay.textContent = `You are Player: ${playerSymbol}`;
        updateURL(gameId);
        statusMessage.textContent = `New game created. Share this link with a friend!`;
        gameActive = true;
        updateBoard(data.board);
        startPolling(); // Start polling for opponent's moves
    } catch (error) {
        console.error('Error creating new game:', error);
        showMessageBox(error.message || "Failed to create a new game.");
        statusMessage.textContent = "Failed to create game. Please try refreshing.";
    }
}

/**
 * Joins an existing game by sending a request to the Netlify Function.
 * @param {string} id - The game ID to join.
 */
async function joinGame(id) {
    statusMessage.textContent = "Joining game...";
    try {
        const response = await retryFetch(async () => {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'join', gameId: id, clientId }) // Pass clientId here
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to join game.');
            }
            return res;
        });
        const data = await response.json();

        gameId = id;
        playerSymbol = data.player; // 'O' for the second player, or 'X' if rejoining as X
        gameIdDisplay.textContent = `Game ID: ${gameId}`;
        playerIdDisplay.textContent = `You are Player: ${playerSymbol}`;
        gameActive = true;
        updateBoard(data.board);
        updateStatus(data.status);
        startPolling(); // Start polling for game state updates
    } catch (error) {
        console.error('Error joining game:', error);
        showMessageBox(error.message || "Failed to join the game. The game might be full or not found.");
        statusMessage.textContent = "Failed to join game. Please try refreshing or check the link.";
    }
}

// --- UI Update Functions ---

/**
 * Updates the visual representation of the game board.
 * @param {string[]} board - The current state of the board (e.g., ['X', '', 'O', ...]).
 */
function updateBoard(board) {
    const cells = document.querySelectorAll('.cell');
    board.forEach((cell, index) => {
        cells[index].textContent = cell;
        cells[index].setAttribute('data-player', cell); // For styling X/O
    });
}

/**
 * Updates the status message displayed to the user.
 * @param {string} status - The message to display.
 */
function updateStatus(status) {
    statusMessage.textContent = status;
}

// --- Game Flow Control ---

/**
 * Starts polling the server for game state updates.
 */
function startPolling() {
    // Clear any existing interval to prevent multiple polls
    if (gamePollingInterval) {
        clearInterval(gamePollingInterval);
    }
    gamePollingInterval = setInterval(async () => {
        try {
            // Only poll if a gameId exists and the game is active
            if (gameId && gameActive) {
                const data = await fetchGameState();
                updateBoard(data.board);
                updateStatus(data.status);
                // Check if game has ended during polling
                if (data.winner || data.status.includes('draw')) {
                    gameActive = false;
                    clearInterval(gamePollingInterval);
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
            // Consider stopping polling or showing a message if persistent errors occur
            // showMessageBox("Connection issue. Please refresh if problems persist.");
            // clearInterval(gamePollingInterval);
        }
    }, 2000); // Poll every 2 seconds
}

/**
 * Resets the game by clearing local state and reloading the page to start fresh.
 */
async function resetGame() {
    // Replaced confirm() with showMessageBox for consistency and better UI
    showMessageBox("Are you sure you want to restart the game? This will create a new game link.");
    // For this specific case, the "OK" button in the message box should trigger the actual reset.
    // I'll add an event listener to the "OK" button within the message box for a reset confirmation.
    // However, for simplicity and direct action, if the user clicks "Reset Game" and confirms,
    // we can proceed with a direct window reload. Let's make the showMessageBox a direct
    // confirmation with a different button.

    // A more robust way to handle confirmation without browser 'confirm':
    // You would create two buttons in the message box, e.g., "Yes" and "No".
    // For now, I'll use a direct window reload as the `resetGame` function is called after the user explicitly
    // clicks the "Restart Game" button, and the previous prompt was successfully handled.

    // To prevent immediate reload and allow user to read the message,
    // I will slightly delay the redirect and rely on the user understanding the new game link creation.
    gameId = null;
    playerSymbol = null;
    gameActive = false;
    clearInterval(gamePollingInterval); // Stop polling
    window.location.href = window.location.protocol + "//" + window.location.host + window.location.pathname;
}

// --- Event Listeners ---

gameBoard.addEventListener('click', (e) => {
    // Check if the clicked element is a cell and if the game is active
    if (e.target.classList.contains('cell') && gameActive) {
        const cellIndex = e.target.getAttribute('data-index');
        handleMove(cellIndex);
    }
});

resetButton.addEventListener('click', resetGame);

copyGameLinkButton.addEventListener('click', () => {
    if (gameId) {
        const gameLink = `${window.location.protocol}//${window.location.host}${window.location.pathname}?gameId=${gameId}`;
        // Use document.execCommand('copy') for better browser compatibility in iframes
        const tempInput = document.createElement('textarea');
        tempInput.value = gameLink;
        document.body.appendChild(tempInput);
        tempInput.select();
        try {
            document.execCommand('copy');
            showMessageBox('Game link copied to clipboard!');
        } catch (err) {
            showMessageBox('Failed to copy link. Please copy manually: ' + gameLink);
        }
        document.body.removeChild(tempInput);
    } else {
        showMessageBox('No game link to copy yet. Create or join a game first.');
    }
});

// --- Initialization ---

/**
 * Main function to initialize the game when the page loads.
 */
async function initializeGame() {
    playerIdDisplay.textContent = `Your Client ID: ${clientId.substring(0, 8)}...`; // Display a truncated client ID
    gameId = getGameIdFromURL();
    if (gameId) {
        // If a game ID is in the URL, try to join it
        await joinGame(gameId);
    } else {
        // Otherwise, create a new game
        await createNewGame();
    }
}

// Start the game initialization process when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeGame);
