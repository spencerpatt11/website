const http = require("http");
const fs = require("fs");
const path = require("path");

let balance = 1000;

// Active game stored in memory
let activeGame = null;

function sendJSON(res, obj, status = 200) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
}

function sendFile(res, filename, contentType) {
    const filePath = path.join(__dirname, filename);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            return res.end("Error loading " + filename);
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    console.log("Request:", req.method, req.url);

    // ---------------- PAGES ----------------
    if (req.url === "/" || req.url === "/casino") {
        return sendFile(res, "hub.html", "text/html");
    }

    if (req.url === "/mines") {
        return sendFile(res, "mines.html", "text/html");
    }

    if (req.url === "/plinko") {
        return sendFile(res, "plinko.html", "text/html");
    }

    // ---------------- BALANCE ----------------
    if (req.url === "/api/balance" && req.method === "GET") {
        return sendJSON(res, { balance });
    }

    // ---------------- START GAME ----------------
    if (req.url === "/api/startGame" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            const data = JSON.parse(body);
            const bet = Number(data.bet);
            const mines = Number(data.mines);

            if (bet <= 0 || bet > balance) {
                return sendJSON(res, { error: "Invalid bet amount." }, 400);
            }

            // Deduct bet
            balance -= bet;

            // Generate mines
            const minePositions = new Set();
            while (minePositions.size < mines) {
                minePositions.add(Math.floor(Math.random() * 25));
            }

            activeGame = {
                bet,
                mines,
                minePositions,
                revealed: new Set(),
                currentProfit: 0
            };

            return sendJSON(res, {
                balance,
                message: "Game started"
            });
        });
        return;
    }

    // ---------------- REVEAL TILE ----------------
    if (req.url === "/api/reveal" && req.method === "POST") {
        if (!activeGame) {
            return sendJSON(res, { error: "No active game." }, 400);
        }

        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            const data = JSON.parse(body);
            const index = Number(data.index);

            if (activeGame.minePositions.has(index)) {
                // Hit a mine → lose game
                activeGame = null;
                return sendJSON(res, {
                    hitMine: true,
                    balance
                });
            }

            // Safe tile
            activeGame.revealed.add(index);

            // Profit formula (simple)
            activeGame.currentProfit = Math.round(
                activeGame.bet * (1 + activeGame.revealed.size * 0.25)
            );

            return sendJSON(res, {
                hitMine: false,
                currentProfit: activeGame.currentProfit,
                balance
            });
        });
        return;
    }

    // ---------------- CASHOUT ----------------
    if (req.url === "/api/cashout" && req.method === "POST") {
        if (!activeGame) {
            return sendJSON(res, { error: "No active game." }, 400);
        }

        balance += activeGame.currentProfit;
        const wonAmount = activeGame.currentProfit;

        activeGame = null;

        return sendJSON(res, {
            balance,
            wonAmount
        });
    }

    // ---------------- 404 ----------------
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
});

server.listen(5000, () => {
const http = require("http");
const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "users.json");

// Load users.json or create it
let users = {};
try {
    users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
} catch {
    users = {};
    fs.writeFileSync(USERS_FILE, "{}");
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function sendJSON(res, obj, status = 200) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
}

function sendFile(res, filename, contentType) {
    const filePath = path.join(__dirname, filename);
    fs.readFile(filePath, (err, data) => {
        if (err) return sendJSON(res, { error: "File error" }, 500);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    });
}

function parseBody(req, callback) {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
        try {
            callback(JSON.parse(body || "{}"));
        } catch {
            callback({});
        }
    });
}

function auth(req, res) {
    const user = req.headers["x-user"];
    const pass = req.headers["x-pass"];

    if (!user || !pass) {
        sendJSON(res, { error: "Missing login" }, 401);
        return null;
    }

    if (!users[user] || users[user].password !== pass) {
        sendJSON(res, { error: "Invalid username or password" }, 401);
        return null;
    }

    return users[user];
}

const server = http.createServer((req, res) => {
    console.log(req.method, req.url);

    // Serve pages
    if (req.url === "/" || req.url === "/casino") return sendFile(res, "hub.html", "text/html");
    if (req.url === "/mines") return sendFile(res, "mines.html", "text/html");
    if (req.url === "/plinko") return sendFile(res, "plinko.html", "text/html");

    // REGISTER
    if (req.url === "/api/register" && req.method === "POST") {
        return parseBody(req, data => {
            const { username, password } = data;

            if (!username || !password)
                return sendJSON(res, { error: "Username and password required" }, 400);

            if (users[username])
                return sendJSON(res, { error: "Username already exists" }, 400);

            users[username] = {
                password,
                balance: 1000,
                activeGame: null
            };

            saveUsers();
            sendJSON(res, { message: "Registered", balance: 1000 });
        });
    }

    // LOGIN
    if (req.url === "/api/login" && req.method === "POST") {
        return parseBody(req, data => {
            const { username, password } = data;

            if (!users[username] || users[username].password !== password)
                return sendJSON(res, { error: "Invalid username or password" }, 401);

            sendJSON(res, { message: "Logged in", balance: users[username].balance });
        });
    }

    // BALANCE
    if (req.url === "/api/balance" && req.method === "GET") {
        const user = auth(req, res);
        if (!user) return;
        sendJSON(res, { balance: user.balance });
    }

    // MINES: START GAME
    if (req.url === "/api/startGame" && req.method === "POST") {
        const user = auth(req, res);
        if (!user) return;

        return parseBody(req, data => {
            const bet = Number(data.bet);
            const mines = Number(data.mines);

            if (bet <= 0 || bet > user.balance)
                return sendJSON(res, { error: "Invalid bet" }, 400);

            user.balance -= bet;

            const minePositions = [];
            while (minePositions.length < mines) {
                const pos = Math.floor(Math.random() * 25);
                if (!minePositions.includes(pos)) minePositions.push(pos);
            }

            user.activeGame = {
                bet,
                mines,
                minePositions,
                revealed: [],
                currentProfit: 0
            };

            saveUsers();
            sendJSON(res, { balance: user.balance });
        });
    }

    // MINES: REVEAL TILE
    if (req.url === "/api/reveal" && req.method === "POST") {
        const user = auth(req, res);
        if (!user) return;

        if (!user.activeGame)
            return sendJSON(res, { error: "No active game" }, 400);

        return parseBody(req, data => {
            const index = Number(data.index);

            if (user.activeGame.minePositions.includes(index)) {
                user.activeGame = null;
                saveUsers();
                return sendJSON(res, { hitMine: true, balance: user.balance });
            }

            if (!user.activeGame.revealed.includes(index))
                user.activeGame.revealed.push(index);

            user.activeGame.currentProfit =
                Math.round(user.activeGame.bet * (1 + user.activeGame.revealed.length * 0.25));

            saveUsers();
            sendJSON(res, {
                hitMine: false,
                currentProfit: user.activeGame.currentProfit,
                balance: user.balance
            });
        });
    }

    // MINES: CASHOUT
    if (req.url === "/api/cashout" && req.method === "POST") {
        const user = auth(req, res);
        if (!user) return;

        if (!user.activeGame)
            return sendJSON(res, { error: "No active game" }, 400);

        user.balance += user.activeGame.currentProfit;
        const won = user.activeGame.currentProfit;

        user.activeGame = null;
        saveUsers();

        sendJSON(res, { balance: user.balance, wonAmount: won });
    }

    // 404
    sendJSON(res, { error: "Not found" }, 404);
});

server.listen(8000, () => console.log("Server running on http://localhost:8000"));
});
