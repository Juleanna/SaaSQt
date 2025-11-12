# 🔍 Огляд Сервісів
- Django‑мікросервіси `auth`, `orgs`, `tms` (REST + Celery) — кожен має власний `Dockerfile` й `entrypoint.py` з автозапуском міграцій та dev‑сервера `0.0.0.0:8000` (наприклад, `services/auth/Dockerfile`, `services/auth/entrypoint.py`).
- Фронтенд — Vite/React → білд + Nginx reverse proxy для `/auth|/orgs|/tms` (див. `frontend/Dockerfile`, `frontend/nginx.conf`).
- Інфраструктура в `docker-compose.dev.yml`: Traefik (gateway + dashboard `:8080`), Postgres (створює `auth_db/orgs_db/tms_db` через `infra/postgres/init-multiple-dbs.sh`), Redis, RabbitMQ, MinIO, frontend.

# 🧰 Підготовка Середовища
- Встанови Docker Desktop (з WSL2 для Windows) та Docker Compose v2.
- Створи/онови `.env` у корені (вже є базові dev‑секрети) перед запуском.
- Переконайся, що порти 80/8080/8001-8003/9000-9001 вільні.

# 🚀 Запуск Dev-стека
1. `docker compose -f docker-compose.dev.yml up -d --build` — збирає образи та стартує всі сервіси (бекенди, Celery, фронтенд).
2. `docker compose -f docker-compose.dev.yml logs -f` — стрім логів для діагностики.
3. `docker compose -f docker-compose.dev.yml down -v` — повна зупинка + видалення томів 
(очищає дані Postgres/MinIO).
4. `docker compose -f docker-compose.dev.yml logs -f > logs.txt` - стрім логів для діагностики в файл

# ✅ Перевірка Працездатності
- Через Traefik:
  - `curl http://localhost/auth/api/health`
  - `curl http://localhost/orgs/api/health`
  - `curl http://localhost/tms/api/health`
- Напряму: `curl http://localhost:8001/api/health` (аналогічно `:8002`, `:8003`).
- Веб-точки:
  - SPA: `http://localhost`
  - Traefik dashboard: `http://localhost:8080`
  - MinIO console: `http://localhost:9001` (логіни з `.env`)
  - Host-маршрути: `http://auth.localhost`, `http://orgs.localhost`, `http://tms.localhost`, `http://app.localhost`.

# 🛠️ Корисні Команди
- Міграції вручну:
  - `docker compose -f docker-compose.dev.yml exec -T auth python manage.py migrate`
  - `docker compose -f docker-compose.dev.yml exec -T orgs python manage.py migrate`
  - `docker compose -f docker-compose.dev.yml exec -T tms python manage.py migrate`
- Створення суперкористувача:
  - `docker compose -f docker-compose.dev.yml exec -T auth python manage.py createsuperuser`
- Перевстановлення залежностей у контейнері:
  - `docker compose -f docker-compose.dev.yml exec -T auth pip install -r requirements.txt`

# ℹ️ Корисні Нотатки
- Celery worker/beat у `auth` використовують Redis як брокер; конфігуруються змінними середовища (`services/auth/auth_service/celery.py`).
- Якщо Traefik повертає 502 — перевір сервіси на `:8001/:8002/:8003` й чи пройшли healthchecks.
- Postgres створює всі dev-бази автоматично завдяки `infra/postgres/init-multiple-dbs.sh`, тому додаткові ручні дії не потрібні.
