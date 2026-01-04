const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

const app = express();
const PORT = 43594;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: false,
  })
);

// Load users
function loadUsers() {
  return JSON.parse(fs.readFileSync("./users.json")).users;
}

// Save users
function saveUsers(users) {
  fs.writeFileSync("./users.json", JSON.stringify({ users }, null, 2));
}

// Redirect root → login
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/hub");
  res.redirect("/login.html");
});

// Serve login page
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Serve hub page (protected)
app.get("/hub", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "hub.html"));
});

app.get("/cashout-page", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "cashout.html"));
});

app.get("/mines", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "mines.html"));
});

app.get("/cashout-chat", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "cashout.html"));
});

app.get("/admin-chat", (req, res) => {
  // You can add admin authentication later
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.post("/send-message", (req, res) => {
  if (!req.session.user) return res.json({ success: false });

  const { text } = req.body;
  let data = JSON.parse(fs.readFileSync("./users.json"));

  data.messages.push({
    user: req.session.user,
    text,
    time: new Date().toISOString()
  });

  fs.writeFileSync("./users.json", JSON.stringify(data, null, 2));

  res.json({ success: true });
});

app.get("/messages", (req, res) => {
  let data = JSON.parse(fs.readFileSync("./users.json"));
  res.json(data.messages);
});


// Register
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  let users = loadUsers();

  if (users.find((u) => u.username === username)) {
    return res.json({ success: false, message: "Username already exists" });
  }

  users.push({ username, password, balance: 100 }); // start with 100
  saveUsers(users);

  res.json({ success: true });
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  let users = loadUsers();

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) return res.json({ success: false, message: "Invalid login" });

  req.session.user = username;
  res.json({ success: true });
});

// Get balance
app.get("/balance", (req, res) => {
  if (!req.session.user) return res.json({ balance: 0 });

  let users = loadUsers();
  let user = users.find((u) => u.username === req.session.user);

  res.json({ balance: user.balance });
});

// Cashout (sets balance to 0)
app.post("/cashout", (req, res) => {
  if (!req.session.user) return res.json({ success: false });

  let users = loadUsers();
  let user = users.find((u) => u.username === req.session.user);

  user.balance = 0;
  saveUsers(users);

  res.json({ success: true });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html?loggedout=1");
  });
});

// Deduct from balance
app.post("/deduct", (req, res) => {
  if (!req.session.user) return res.json({ success: false, error: "No session" });

  const amount = Number(req.body.amount);
  if (isNaN(amount) || amount <= 0) {
    return res.json({ success: false, error: "Invalid amount" });
  }

  let users = loadUsers();
  let user = users.find(u => u.username === req.session.user);
  if (!user) return res.json({ success: false, error: "User not found" });

  if (user.balance < amount) {
    return res.json({ success: false, error: "Insufficient balance" });
  }

  user.balance -= amount;
  saveUsers(users);

  res.json({ success: true, balance: user.balance });
});

// Add to balance
app.post("/add", (req, res) => {
  if (!req.session.user) return res.json({ success: false, error: "No session" });

  const amount = Number(req.body.amount);
  if (isNaN(amount) || amount <= 0) {
    return res.json({ success: false, error: "Invalid amount" });
  }

  let users = loadUsers();
  let user = users.find(u => u.username === req.session.user);
  if (!user) return res.json({ success: false, error: "User not found" });

  user.balance += amount;
  saveUsers(users);

  res.json({ success: true, balance: user.balance });
});

app.post("/request-cashout", (req, res) => {
  if (!req.session.user) return res.json({ success: false });

  const message = req.body.message;
  let data = JSON.parse(fs.readFileSync("./users.json"));

  data.cashoutRequests.push({
    user: req.session.user,
    message: message,
    time: new Date().toISOString(),
    status: "pending"
  });

  fs.writeFileSync("./users.json", JSON.stringify(data, null, 2));

  res.json({ success: true });
});

app.listen(43594, "0.0.0.0", () => {
  console.log("Server running on port 43594");
});



