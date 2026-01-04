const http = require("http");
const fs = require("fs");
const path = require("path");

let balance = 1000; // shared casino balance in memory

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

    // ------- PAGES -------
    if (req.url === "/" || req.url === "/casino") {
        return sendFile(res, "hub.html", "text/html");
    }

    if (req.url === "/mines") {
        return sendFile(res, "mines.html", "text/html");
    }

    if (req.url === "/plinko") {
        return sendFile(res, "plinko.html", "text/html");
    }

    // ------- API: BALANCE -------
    if (req.url === "/api/balance" && req.method === "GET") {
        return sendJSON(res, { balance });
    }

    // Simple endpoint to change balance by a delta
    if (req.url === "/api/changeBalance" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => (body += chunk));
        req.on("end", () => {
            try {
                const data = JSON.parse(body);
                const delta = Number(data.delta);
                if (Number.isNaN(delta)) {
                    return sendJSON(res, { error: "Invalid delta" }, 400);
                }
                balance += delta;
                console.log("Balance changed by", delta, "=>", balance);
                return sendJSON(res, { balance });
            } catch (e) {
                return sendJSON(res, { error: "Bad JSON" }, 400);
            }
        });
        return;
    }

    // Fallback 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
});

server.listen(5000, () => {
    console.log("🎰 Casino server running at http://localhost:5000");
});

