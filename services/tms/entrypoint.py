import os
import time
import psycopg2
import subprocess


def wait_for_db():
    host = os.getenv('DB_HOST', 'localhost')
    port = int(os.getenv('DB_PORT', '5432'))
    name = os.getenv('DB_NAME', '')
    user = os.getenv('DB_USER', '')
    password = os.getenv('DB_PASSWORD', '')
    for _ in range(60):
        try:
            conn = psycopg2.connect(host=host, port=port, dbname=name, user=user, password=password)
            conn.close()
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError('Database not available')


if __name__ == '__main__':
    wait_for_db()
    subprocess.check_call(['python', 'manage.py', 'migrate', '--noinput'])
    subprocess.check_call(['python', 'manage.py', 'runserver', '0.0.0.0:8000'])

