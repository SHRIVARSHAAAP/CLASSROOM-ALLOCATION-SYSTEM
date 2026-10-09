"""Classroom API. Python 3.12+, SQLite; run python backend/server.py."""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / 'campus.sqlite3'
ROLES = ('admin', 'rep', 'club', 'faculty', 'student')


def connect():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 200000).hex()


def initialize():
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL, role TEXT NOT NULL, section TEXT NOT NULL DEFAULT '',
          salt TEXT NOT NULL, password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires TEXT);
        CREATE TABLE IF NOT EXISTS rooms(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL,
          building TEXT NOT NULL,floor INTEGER NOT NULL,capacity INTEGER NOT NULL,
          facilities TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,maintenance INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user_id INTEGER,action TEXT,created TEXT);
        ''')


def bootstrap():
    """Explicit local setup; credentials never ship in the repository."""
    initialize()
    with connect() as db:
        if db.execute('SELECT count(*) FROM users').fetchone()[0]:
            raise ValueError('Users already exist; setup cannot be repeated.')
        password = os.environ.get('CAMPUS_SETUP_PASSWORD', '')
        if len(password) < 12:
            raise ValueError('Set CAMPUS_SETUP_PASSWORD to at least 12 characters.')
        for role in ROLES:
            salt = secrets.token_hex(16)
            db.execute('INSERT INTO users(name,email,role,section,salt,password) VALUES(?,?,?,?,?,?)',
                       (role.title(), role+'@campus.local', role, 'CSE-A', salt, password_hash(password, salt)))
        print('Created local accounts: '+', '.join(role+'@campus.local' for role in ROLES))


class API(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.dispatch('GET')

    def do_POST(self):
        self.dispatch('POST')

    def do_PATCH(self):
        self.dispatch('PATCH')

    def dispatch(self, method):
        try:
            with connect() as db:
                if not self.path.startswith('/api/'):
                    return self.static(method)
                size = int(self.headers.get('Content-Length', '0'))
                if size > 16384:
                    return self.send_json(413, {'error': 'Request too large'})
                data = json.loads(self.rfile.read(size) or '{}') if method != 'GET' else {}
                if not isinstance(data, dict):
                    raise ValueError('Expected a JSON object')
                if self.path == '/api/login' and method == 'POST':
                    user = db.execute('SELECT * FROM users WHERE email=?', (str(data.get('email', '')).lower(),)).fetchone()
                    valid = user and hmac.compare_digest(user['password'], password_hash(str(data.get('password', '')), user['salt']))
                    if not valid or user['role'] != data.get('role'):
                        return self.send_json(401, {'error': 'Invalid email, password or selected portal'})
                    token = secrets.token_urlsafe(32)
                    expires = (datetime.now(timezone.utc)+timedelta(hours=8)).isoformat()
                    db.execute('INSERT INTO tokens VALUES(?,?,?)', (token, user['id'], expires))
                    return self.send_json(200, {'token': token, 'user': self.public_user(user)})
                token = self.headers.get('Authorization', '').removeprefix('Bearer ')
                user = db.execute('SELECT u.* FROM users u JOIN tokens t ON t.user_id=u.id WHERE t.token=? AND t.expires>?',
                                  (token, datetime.now(timezone.utc).isoformat())).fetchone()
                if not user:
                    return self.send_json(401, {'error': 'Please sign in'})
                if self.path == '/api/me' and method == 'GET':
                    return self.send_json(200, self.public_user(user))
                if self.path == '/api/logout' and method == 'POST':
                    db.execute('DELETE FROM tokens WHERE token=?', (token,))
                    return self.send_json(200, {'ok': True})
                if self.path == '/api/rooms' and method == 'GET':
                    return self.send_json(200, [dict(r) for r in db.execute('SELECT * FROM rooms ORDER BY building,name')])
                if self.path == '/api/audit' and method == 'GET' and user['role'] == 'admin':
                    return self.send_json(200, [dict(r) for r in db.execute('SELECT a.*,u.name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100')])
                if self.path.startswith('/api/rooms') and method in ('POST', 'PATCH'):
                    if user['role'] != 'admin':
                        return self.send_json(403, {'error': 'Only administrators can manage classrooms'})
                    name, building = str(data.get('name', '')).strip(), str(data.get('building', '')).strip()
                    capacity, floor = int(data.get('capacity', 0)), int(data.get('floor', 0))
                    if not name or not building or capacity < 1 or floor < 0:
                        raise ValueError('Name, building, positive capacity and nonnegative floor are required')
                    facilities = str(data.get('facilities', ''))
                    values = (name, building, floor, capacity, facilities, int(bool(data.get('active', True))), int(bool(data.get('maintenance', False))))
                    if method == 'POST' and self.path == '/api/rooms':
                        result = db.execute('INSERT INTO rooms(name,building,floor,capacity,facilities,active,maintenance) VALUES(?,?,?,?,?,?,?)', values)
                        room_id = result.lastrowid
                    elif method == 'PATCH':
                        room_id = int(self.path.rsplit('/', 1)[-1])
                        result = db.execute('UPDATE rooms SET name=?,building=?,floor=?,capacity=?,facilities=?,active=?,maintenance=? WHERE id=?', values+(room_id,))
                        if not result.rowcount:
                            return self.send_json(404, {'error': 'Room not found'})
                    else:
                        return self.send_json(404, {'error': 'Route not found'})
                    db.execute('INSERT INTO audit(user_id,action,created) VALUES(?,?,?)',
                               (user['id'], f'{method} classroom {room_id}', datetime.now(timezone.utc).isoformat()))
                    return self.send_json(200, {'id': room_id})
                return self.send_json(404, {'error': 'Route not found'})
        except (ValueError, TypeError, json.JSONDecodeError):
            self.send_json(400, {'error': 'Invalid input; check all required fields'})
        except sqlite3.IntegrityError:
            self.send_json(409, {'error': 'A classroom with this name already exists'})
        except Exception:
            self.send_json(500, {'error': 'Server error'})

    @staticmethod
    def public_user(user):
        return {k: user[k] for k in ('id', 'name', 'email', 'role', 'section')}

    def static(self, method):
        names = {'/': ('index.html', 'text/html'), '/app.js': ('app.js', 'text/javascript'), '/style.css': ('style.css', 'text/css')}
        if method != 'GET' or self.path not in names:
            return self.send_json(404, {'error': 'Not found'})
        name, mime = names[self.path]
        body = (ROOT.parent/'frontend'/name).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mime+'; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    import sys
    if '--setup' in sys.argv:
        bootstrap()
    else:
        initialize()
        print('Open http://localhost:8000')
        ThreadingHTTPServer(('127.0.0.1', 8000), API).serve_forever()
