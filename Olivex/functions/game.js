const { v4: uuidv4 } = require('uuid');

// A simple in-memory store for game states.
// NOTE: For a production app, you would use a real database (like FaunaDB or Redis).
// This is for demonstration purposes on Netlify's serverless functions.
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
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
};

// Main handler for the Netlify function
exports.handler = async (event, context) => {
    const { httpMethod, queryStringParameters, body } = event;

    if (httpMethod === 'GET') {
        const { gameId } = queryStringParameters;
        if (!games[gameId]) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Game not found' }),
            };
        }
        return {
            statusCode: 200,
            body: JSON.stringify(games[gameId]),
        };
    }

    if (httpMethod === 'POST') {
        const data = JSON.parse(body);

        // Action: Create a new game
        if (data.action === 'create') {
            const newGameId = uuidv4();
            games[newGameId] = {
                gameId: newGameId,
                board: ['', '', '', '', '', '', '', '', ''],
                players: { 'X': null, 'O': null },
                status: "Player X's turn. Waiting for a second player to join...",
                turn: 'X',
                winner: null,
            };
            return {
                statusCode: 200,
                body: JSON.stringify(games[newGameId]),
            };
        }

        // Action: Join an existing game
        if (data.action === 'join') {
            const { gameId } = data;
            const game = games[gameId];
            if (!game) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Game not found.' }),
                };
            }
            if (game.players['O']) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Game is already full.' }),
                };
            }
            game.players['O'] = 'joined';
            game.status = "Player X's turn.";
            return {
                statusCode: 200,
                body: JSON.stringify({ ...game, player: 'O' }),
            };
        }

        // Action: Handle a move
        const { gameId, player, move } = data;
        const game = games[gameId];

        if (!game) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Game not found' }),
            };
        }

        if (game.winner || game.status.includes('Game is a draw')) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Game is over.' }),
            };
        }

        if (game.turn !== player) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: `It's not your turn.` }),
            };
        }

        if (game.board[move] !== '') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Cell is already taken.' }),
            };
        }

        game.board[move] = player;
        game.turn = (player === 'X') ? 'O' : 'X';

        const winner = checkWinner(game.board);
        if (winner) {
            game.winner = winner;
            game.status = `Player ${winner} wins!`;
        } else if (!game.board.includes('')) {
            game.status = 'Game is a draw!';
        } else {
            game.status = `Player ${game.turn}'s turn.`;
        }

        return {
            statusCode: 200,
            body: JSON.stringify(game),
        };
    }

    return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
};

