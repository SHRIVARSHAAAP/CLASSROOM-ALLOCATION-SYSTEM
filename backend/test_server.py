import importlib.util
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

spec = importlib.util.spec_from_file_location('server', Path(__file__).with_name('server.py'))
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class APIIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        server.DB = Path(cls.temp.name)/'test.sqlite3'
        os.environ['CAMPUS_SETUP_PASSWORD'] = 'test-only-password-2026'
        server.bootstrap()
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.API)
        cls.base = f'http://127.0.0.1:{cls.http.server_port}/api'
        threading.Thread(target=cls.http.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.temp.cleanup()

    def call(self, path, method='GET', data=None, token=None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer '+token
        request = Request(self.base+path, method=method, headers=headers,
                          data=json.dumps(data).encode() if data is not None else None)
        try:
            response = urlopen(request)
        except HTTPError as error:
            response = error
        return response.status, json.loads(response.read())

    def login(self, role):
        status, data = self.call('/login', 'POST', {'email': role+'@campus.local',
                 'password': 'test-only-password-2026', 'role': role})
        self.assertEqual(status, 200)
        self.assertNotIn('password', data['user'])
        return data['token']

    def test_logins(self):
        for role in server.ROLES:
            self.login(role)
        self.assertEqual(self.call('/login', 'POST', {'email':'student@campus.local',
                          'password':'test-only-password-2026','role':'admin'})[0], 401)

    def test_permissions(self):
        self.assertEqual(self.call('/rooms')[0], 401)
        self.assertEqual(self.call('/rooms', 'POST', {}, self.login('student'))[0], 403)

    def test_room_lifecycle(self):
        token = self.login('admin')
        room = {'name':'A101','building':'Main','floor':1,'capacity':60,'facilities':'Projector','active':True}
        status, data = self.call('/rooms','POST',room,token)
        self.assertEqual(status,200)
        self.assertEqual(self.call('/rooms','POST',room,token)[0],409)
        room['maintenance'] = True
        self.assertEqual(self.call('/rooms/'+str(data['id']),'PATCH',room,token)[0],200)
        self.assertEqual(self.call('/rooms',token=self.login('student'))[1][0]['maintenance'],1)
        self.assertEqual(len(self.call('/audit',token=token)[1]),2)
        self.assertEqual(self.call('/logout','POST',{},token)[0],200)
        self.assertEqual(self.call('/me',token=token)[0],401)

    def test_invalid_room(self):
        self.assertEqual(self.call('/rooms','POST',{'capacity':-1},self.login('admin'))[0],400)

if __name__ == '__main__':
    unittest.main()
