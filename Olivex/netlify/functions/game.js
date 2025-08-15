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
        console.log('Function invoked.');
        const { httpMethod, queryStringParameters, body } = event;
        console.log(`HTTP Method: ${httpMethod}`);

        // --- GET Request: Fetch Game State ---
        if (httpMethod === 'GET') {
            const { gameId, clientId } = queryStringParameters;
            console.log(`GET request - gameId: ${gameId}, clientId: ${clientId}`);

            // Validate gameId
            if (!gameId) {
                console.error('GET request error: Game ID is required.');
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Game ID is required.' }),
                };
            }

            const game = games[gameId];
            console.log(`Game state for ${gameId}:`, game); // Log the actual game object

            // Check if game exists
            if (!game) {
                console.error(`GET request error: Game ${gameId} not found.`);
                return {
                    statusCode: 404,
                    headers: { 'Content-Type': 'application/json' },
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
                console.log('POST request body parsed:', data);
            } catch (e) {
                console.error('POST request error: Invalid JSON body.', e);
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Invalid JSON body.' }),
                };
            }

            const { action, gameId, player, move, clientId } = data;
            console.log(`POST request - Action: ${action}, GameId: ${gameId}, Player: ${player}, Move: ${move}, ClientId: ${clientId}`);

            // Validate clientId for all POST actions
            if (!clientId) {
                console.error('POST request error: Client ID is required.');
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json' },
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
                    console.error('Join request error: Game ID is required to join.');
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Game ID is required to join.' }),
                    };
                }

                const game = games[gameId];
                console.log(`Attempting to join game ${gameId}. Current game state:`, game);

                // Check if game exists
                if (!game) {
                    console.error(`Join request error: Game ${gameId} not found.`);
                    return {
                        statusCode: 404,
                        headers: { 'Content-Type': 'application/json' },
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
                    console.error(`Join request error: Game ${gameId} is already full.`);
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json' },
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
                    console.error('Move request error: Game ID, player, and move are required.');
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Game ID, player, and move are required.' }),
                    };
                }

                const game = games[gameId];
                console.log(`Attempting move in game ${gameId}. Current game state:`, game);


                // Check if game exists
                if (!game) {
                    console.error(`Move request error: Game ${gameId} not found.`);
                    return {
                        statusCode: 404,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Game not found.' }),
                    };
                }

                // Check if the current client is actually one of the players in this game
                if (game.players[player] !== clientId) {
                     console.error(`Move request error: Client ${clientId} not authorized for player ${player} in game ${gameId}.`);
                     return {
                        statusCode: 403,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'You are not authorized to make this move as this player.' }),
                    };
                }

                // Check if game is already over
                if (game.winner || game.status.includes('draw')) {
                    console.error(`Move request error: Game ${gameId} is already over.`);
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Game is over. Start a new one!' }),
                    };
                }

                // Check if it's the current player's turn
                if (game.turn !== player) {
                    console.error(`Move request error: Not Player ${player}'s turn in game ${gameId}. Current turn: ${game.turn}`);
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: `It's not your turn. It's Player ${game.turn}'s turn.` }),
                    };
                }

                // Check if the chosen cell is already taken
                if (game.board[move] !== '') {
                    console.error(`Move request error: Cell ${move} already taken in game ${gameId}.`);
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json' },
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
                    game.status = 'Game is a draw! �';
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

        // Handle unsupported HTTP methods or unknown actions
        console.error(`Unhandled request: HTTP Method ${httpMethod}, Action ${action}`);
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method Not Allowed or Unknown Action' }),
        };
    };
    