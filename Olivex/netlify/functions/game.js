// This file will be deployed as a Netlify Serverless Function.
// It uses 'uuid' for generating unique game IDs. Make sure to install it: `npm install uuid`
const { v4: uuidv4 } = require('uuid');

// A simple in-memory store for game states.
// IMPORTANT: For a production app, you would use a real, persistent database
// (like Firestore, FaunaDB, Redis, etc.) instead of a simple in-memory object.
// This in-memory store is for demonstration purposes with Netlify's serverless functions
// and will reset when the function "cold starts" (i.e., after inactivity or deployment).
const games = {};

// Helper function to check for a winner
const checkWinner = (board) => {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        // Check if the cells are not empty and all three are the same symbol
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // Return the winning symbol ('X' or 'O')
        }
    }
    return null; // No winner yet
};

// Main handler for the Netlify function
exports.handler = async (event, context) => {
    // Extract HTTP method, query parameters, and request body
    const { httpMethod, queryStringParameters, body } = event;

    // --- GET Request: Fetch Game State ---
    if (httpMethod === 'GET') {
        const { gameId, clientId } = queryStringParameters;

        // Validate gameId
        if (!gameId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Game ID is required.' }),
            };
        }

        const game = games[gameId];

        // Check if game exists
        if (!game) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Game not found' }),
            };
        }

        // Return the current game state
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(game),
        };
    }

    // --- POST Request: Create, Join, or Make a Move ---
    if (httpMethod === 'POST') {
        let data;
        try {
            data = JSON.parse(body);
        } catch (e) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid JSON body.' }),
            };
        }

        const { action, gameId, player, move, clientId } = data;

        // Validate clientId for all POST actions
        if (!clientId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Client ID is required.' }),
            };
        }

        // Action: Create a new game
        if (action === 'create') {
            const newGameId = uuidv4(); // Generate a unique ID for the new game
            games[newGameId] = {
                gameId: newGameId,
                board: ['', '', '', '', '', '', '', '', ''], // Empty Tic-Tac-Toe board
                players: { 'X': clientId, 'O': null }, // Creator is Player X
                status: "Player X's turn. Waiting for a second player to join...",
                turn: 'X', // X starts
                winner: null,
            };
            console.log(`Game created: ${newGameId} by client ${clientId}`);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(games[newGameId]),
            };
        }

        // Action: Join an existing game
        if (action === 'join') {
            // Validate gameId
            if (!gameId) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Game ID is required to join.' }),
                };
            }

            const game = games[gameId];

            // Check if game exists
            if (!game) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Game not found.' }),
                };
            }

            // If the joining client is already 'X' or 'O', they are rejoining
            if (game.players['X'] === clientId) {
                 console.log(`Client ${clientId} (Player X) rejoining game ${gameId}`);
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...game, player: 'X' }), // Send back current state as player X
                };
            }
            if (game.players['O'] === clientId) {
                 console.log(`Client ${clientId} (Player O) rejoining game ${gameId}`);
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...game, player: 'O' }), // Send back current state as player O
                };
            }

            // If O slot is taken
            if (game.players['O']) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Game is already full. Please create a new game or join another.' }),
                };
            }

            // Assign joining player as 'O'
            game.players['O'] = clientId;
            game.status = `Player X's turn.`; // Game can now start
            console.log(`Client ${clientId} joined game ${gameId} as Player O`);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...game, player: 'O' }), // Inform the client they are 'O'
            };
        }

        // Action: Handle a move
        if (action === 'move') {
            // Validate required parameters for a move
            if (!gameId || player === undefined || move === undefined) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Game ID, player, and move are required.' }),
                };
            }

            const game = games[gameId];

            // Check if game exists
            if (!game) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Game not found.' }),
                };
            }

            // Check if the current client is actually one of the players in this game
            if (game.players[player] !== clientId) {
                 return {
                    statusCode: 403,
                    body: JSON.stringify({ error: 'You are not authorized to make this move as this player.' }),
                };
            }

            // Check if game is already over
            if (game.winner || game.status.includes('draw')) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Game is over. Start a new one!' }),
                };
            }

            // Check if it's the current player's turn
            if (game.turn !== player) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: `It's not your turn. It's Player ${game.turn}'s turn.` }),
                };
            }

            // Check if the chosen cell is already taken
            if (game.board[move] !== '') {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Cell is already taken. Choose another.' }),
                };
            }

            // Apply the move
            game.board[move] = player;
            game.turn = (player === 'X') ? 'O' : 'X'; // Switch turn

            // Check for winner after the move
            const winner = checkWinner(game.board);
            if (winner) {
                game.winner = winner;
                game.status = `Player ${winner} wins! 🎉`;
            } else if (!game.board.includes('')) {
                // If no winner and no empty cells, it's a draw
                game.status = 'Game is a draw! 🤝';
            } else {
                // Game continues, update status for next turn
                game.status = `Player ${game.turn}'s turn.`;
            }
            console.log(`Move made in game ${gameId}: Player ${player} at index ${move}. New turn: ${game.turn}`);

            // Return the updated game state
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(game),
            };
        }
    }

    // Handle unsupported HTTP methods
    return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
};
