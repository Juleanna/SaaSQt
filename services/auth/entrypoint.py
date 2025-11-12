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

    deadline = time.time() + 120

    while time.time() < deadline:
        try:
            conn = psycopg2.connect(host=host, port=port, dbname='postgres', user=user, password=password)
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute("SELECT 1")
            try:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,))
                exists = cur.fetchone() is not None
                if not exists:
                    try:
                        cur.execute(f'CREATE DATABASE "{name}"')
                    except Exception:
                        pass
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,))
                if cur.fetchone() is not None:
                    cur.close()
                    conn.close()
                    return
            finally:
                try:
                    cur.close()
                except Exception:
                    pass
                try:
                    conn.close()
                except Exception:
                    pass
        except Exception:
            time.sleep(1)
    raise RuntimeError('Database not available')


if __name__ == '__main__':
    wait_for_db()
    subprocess.check_call(['python', 'manage.py', 'migrate', '--noinput'])
    subprocess.check_call(['python', 'manage.py', 'ensure_superuser'])
    subprocess.check_call(['python', 'manage.py', 'runserver', '0.0.0.0:8000'])

