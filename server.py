#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
from urllib.parse import urlparse, parse_qs
import threading

PORT = 8000
USERS_FILE = "users.json"

# Load users
users = {}
try:
    with open(USERS_FILE, 'r') as f:
        users = json.load(f)
except:
    users = {}
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f)

def save_users():
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)

def auth(headers):
    u = headers.get('X-User')
    p = headers.get('X-Pass')
    
    if not u or not p:
        return None
    
    if u not in users or users[u]['password'] != p:
        return None
    
    return users[u]

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '/hub':
            self.serve_file('hub.html')
        elif self.path == '/mines':
            self.serve_file('mines.html')
        elif self.path == '/casino':
            self.serve_file('hub.html')
        elif self.path == '/api/balance':
            self.handle_balance()
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/api/register':
            self.handle_register()
        elif self.path == '/api/login':
            self.handle_login()
        elif self.path == '/api/logout':
            self.handle_logout()
        elif self.path == '/api/startGame':
            self.handle_start_game()
        elif self.path == '/api/reveal':
            self.handle_reveal()
        elif self.path == '/api/cashout':
            self.handle_cashout()
        else:
            self.send_error(404)
    
    def serve_file(self, filename):
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(content.encode())
        except FileNotFoundError:
            self.send_error(404)
    
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def get_post_data(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        try:
            return json.loads(post_data.decode())
        except:
            return {}
    
    def handle_register(self):
        data = self.get_post_data()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return self.send_json({'error': 'Missing fields'}, 400)
        
        if username in users:
            return self.send_json({'error': 'User exists'}, 400)
        
        users[username] = {
            'password': password,
            'balance': 1000,
            'activeGame': None,
            'logouts': 0
        }
        
        save_users()
        self.send_json({'message': 'Registered'})
    
    def handle_login(self):
        data = self.get_post_data()
        username = data.get('username')
        password = data.get('password')
        
        if username not in users or users[username]['password'] != password:
            return self.send_json({'error': 'Invalid login'}, 401)
        
        self.send_json({'message': 'Logged in', 'balance': users[username]['balance']})
    
    def handle_logout(self):
        username = self.headers.get('X-User')
        if username in users:
            users[username]['logouts'] += 1
            save_users()
        self.send_json({'message': 'Logged out'})
    
    def handle_balance(self):
        user = auth(self.headers)
        if not user:
            return self.send_json({'error': 'Invalid login'}, 401)
        self.send_json({'balance': user['balance']})
    
    def handle_start_game(self):
        user = auth(self.headers)
        if not user:
            return self.send_json({'error': 'Invalid login'}, 401)
        
        data = self.get_post_data()
        bet = int(data.get('bet', 0))
        mines = int(data.get('mines', 0))
        
        if bet <= 0 or bet > user['balance']:
            return self.send_json({'error': 'Invalid bet'}, 400)
        
        user['balance'] -= bet
        
        import random
        mine_positions = []
        while len(mine_positions) < mines:
            pos = random.randint(0, 24)
            if pos not in mine_positions:
                mine_positions.append(pos)
        
        user['activeGame'] = {
            'bet': bet,
            'mines': mines,
            'minePositions': mine_positions,
            'revealed': [],
            'currentProfit': 0
        }
        
        save_users()
        self.send_json({'balance': user['balance']})
    
    def handle_reveal(self):
        user = auth(self.headers)
        if not user:
            return self.send_json({'error': 'Invalid login'}, 401)
        
        if not user['activeGame']:
            return self.send_json({'error': 'No active game'}, 400)
        
        data = self.get_post_data()
        index = int(data.get('index', 0))
        
        if index in user['activeGame']['minePositions']:
            mine_positions = user['activeGame']['minePositions']
            user['activeGame'] = None
            save_users()
            return self.send_json({'hitMine': True, 'balance': user['balance'], 'minePositions': mine_positions})
        
        if index not in user['activeGame']['revealed']:
            user['activeGame']['revealed'].append(index)
        
        user['activeGame']['currentProfit'] = round(
            user['activeGame']['bet'] * (1 + len(user['activeGame']['revealed']) * 0.25)
        )
        
        save_users()
        self.send_json({
            'hitMine': False,
            'currentProfit': user['activeGame']['currentProfit'],
            'balance': user['balance']
        })
    
    def handle_cashout(self):
        user = auth(self.headers)
        if not user:
            return self.send_json({'error': 'Invalid login'}, 401)
        
        if not user['activeGame']:
            return self.send_json({'error': 'No active game'}, 400)
        
        user['balance'] += user['activeGame']['currentProfit']
        won = user['activeGame']['currentProfit']
        
        user['activeGame'] = None
        save_users()
        
        self.send_json({'balance': user['balance'], 'wonAmount': won})

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        httpd.serve_forever()
