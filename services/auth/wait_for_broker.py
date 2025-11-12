import os
import socket
import time
from urllib.parse import urlparse


def wait_for(url_env: str, fallback_port: int, timeout: int = 60) -> None:
    url = os.getenv(url_env)
    if not url:
        return

    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port or fallback_port

    if not host or not port:
        return

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=5):
                return
        except OSError:
            time.sleep(1)

    raise RuntimeError(f"Timed out waiting for {url_env} ({host}:{port})")


if __name__ == "__main__":
    wait_for("CELERY_BROKER_URL", 5672, timeout=120)
