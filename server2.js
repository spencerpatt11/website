const http = require("http");
const fs = require("fs");
const path = require("path");

const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, "runclient.bat");

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end("File not found");
        }
        res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": "attachment; filename=runclient.bat"
        });
        res.end(data);
    });
});

server.listen(5001, () => {
    console.log("Download server running at http://localhost:5001");
});

