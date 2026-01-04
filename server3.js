const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.use(
    session({
        secret: "mines-secret",
        resave: false,
        saveUninitialized: true,
    })
);

// Initialize balance for new sessions
app.use((req, res, next) => {
    if (!req.session.balanc}
req.session.balance = 1000;
    if (!req.session.minesGames) req.session.minesGames = {};
    next();
});

// GET BALANCE
app.get("/api/balance", (req, res) => {
    res.json({ balance: req.session.balance });
});

// Generate a mines board
function generateBoard(minesCount) {
    const board = Array(25).fill({ mine: false, revealed: false });

    let positions = [];
    while (positions.length < minesCount) {
        let pos = Math.floor(Math.random() * 25);
        if (!positions.includes(pos)) positions.push(pos);
    }

    return board.map((tile, index) => ({
        mine: positions.includes(index),
        revealed: false,
    }));
}

// START GAME
app.post("/api/mines/start", (req, res) => {
    const { bet, mines } = req.body;

    const betAmount = Number(bet);
    const minesCount = Number(mines);

    if (betAmount <= 0 || minesCount < 1 || minesCount > 24) {
        return res.json({ success: false, message: "Invalid bet or mine count." });
    }

    if (req.session.balance < betAmount) {
        return res.json({ success: false, message: "Insufficient balance." });
    }

    req.session.balance -= betAmount;

    const gameId = Date.now().toString();
    const board = generateBoard(minesCount);

    req.session.minesGames[gameId] = {
        bet: betAmount,
        mines: minesCount,
        board,
        revealedSafe: 0,
        active: true,
    };

    res.json({
        success: true,
        gameId,
        board,
    });
});

// CLICK TILE
app.post("/api/mines/click", (req, res) => {
    const { gameId, index } = req.body;

    const game = req.session.minesGames[gameId];
    if (!game || !game.active) {
        return res.json({ success: false, message: "Game not found." });
    }

    const tile = game.board[index];

    if (tile.revealed) {
        return res.json({ success: true, board: game.board });
    }

    tile.revealed = true;

    if (tile.mine) {
        // Game lost
        game.active = false;

        // Reveal all mines
        game.board.forEach(t => {
            if (t.mine) t.revealed = true;
        });

        return res.json({
            success: true,
            lose: true,
            board: game.board,
        });
    }

    game.revealedSafe++;

    return res.json({
        success: true,
        lose: false,
        board: game.board,
    });
});

// CASHOUT
app.post("/api/mines/cashout", (req, res) => {
    const { gameId } = req.body;

    const game = req.session.minesGames[gameId];
    if (!game || !game.active) {
        return res.json({ success: false, message: "Game not found or already ended." });
    }

    game.active = false;

    // Simple multiplier: increases with each safe reveal
    const multiplier = 1 + game.revealedSafe * (0.1 + game.mines * 0.01);
    const winAmount = Math.floor(game.bet * multiplier);

    req.session.balance += winAmount;

    return res.json({
        success: true,
        win: winAmount,
    });
});

// START SERVER
app.listen(3000, () => {
    console.log("Mines server running on http://localhost:3000");
});