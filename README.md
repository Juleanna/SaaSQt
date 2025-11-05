# TestCloud Suite — Django мікросервіси для QA/TMS

Набір сервісів для побудови SaaS‑платформи тест‑менеджменту: аутентифікація, організації та управління тестовими кейсами/планами/прогонами. Архітектура орієнтована на масштабування і розділення відповідальностей (microservices) з Traefik‑гейтом.

- 🧩 Сервіси: `auth`, `orgs`, `tms`
- 🗄️ Інфраструктура: Postgres, Redis, RabbitMQ, MinIO, Traefik
- 🐳 Оркестрація: Docker Compose

---

## 🚀 Швидкий старт (Dev)

- Підготуйте змінні середовища: `cp .env.example .env` (якщо файл присутній) і налаштуйте значення.
- Запустіть стек: `docker compose -f docker-compose.dev.yml up -d --build`
- Перевірка здоров’я сервісів:
  - Auth: `curl http://localhost/auth/api/health`
  - Orgs: `curl http://localhost/orgs/api/health`
  - TMS:  `curl http://localhost/tms/api/health`
- Панелі:
  - Traefik: `http://localhost:8080`
  - MinIO: `http://localhost:9001` (логіни/паролі у `.env`)

Після змін у моделях TMS застосуйте міграції:
- `docker compose -f docker-compose.dev.yml exec -T tms python manage.py migrate`

---

## 🧭 Маршрути та гейт

- Traefik проксуює сервіси за шляхами: `http://localhost/auth|orgs|tms/...`
- Прямі порти (для налагодження): auth `:8001`, orgs `:8002`, tms `:8003`

---

## 🔐 Auth: JWT, JWKS, сервісні токени

SimpleJWT (access/refresh), throttle, RS256 через JWKS для міжсервісної взаємодії.

- Отримати токен: `POST /auth/api/auth/token` body `{username,password,tenant_id?}`
- Refresh: `POST /auth/api/auth/token/refresh`
- Перемкнути орендаря: `POST /auth/api/auth/switch-tenant` `{tenant_id:N}` — оновлює access із claim `tenant_id`.
- Сервісні ключі/JWKS: `GET /auth/api/service/jwks`, `POST /auth/api/service/token`

Env (приклади): `ACCESS_TOKEN_LIFETIME_MINUTES`, `REFRESH_TOKEN_LIFETIME_DAYS`, `ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION`, `SERVICE_JWKS_MAX_AGE`, `SERVICE_JWT_GRACE_SECONDS`.

---

## 🏢 Orgs: орендарі, ролі, запрошення

- Сутності: `Tenant`, `Role`, `Membership`, `Invitation`, `ProjectRole`, `ProjectMembership`
- Запрошення з валідацією email (accept/resend), роли tenant/project рівнів
- JWT перевіряється за RS256/JWKS; throttle (Redis) на IP/користувача
- CursorPagination як дефолт для списків

Приклади:
- `GET /orgs/api/tenants/`
- `POST /orgs/api/invitations/` → `POST /orgs/api/invitations/{id}/resend/` → `POST /orgs/api/invitations/{id}/accept/`

---

## 🧰 TMS (база): проєкти, кейси, сьюти

- Моделі: `Project`, `TestCase`, `Suite`, `SuiteCase`
- RBAC (owner/admin/member) із перевіркою членства в Tenant/Project через Orgs (service JWT)
- Multi‑tenant middleware: `X-Tenant-ID` або claim `tenant_id` у JWT; невідповідність → 403
- CursorPagination (`-created_at` або `-id`)

Основні ендпоінти:
- `POST /tms/api/testcases/{id}/archive|unarchive`
- `POST /tms/api/suite-cases/{id}/move` — транзакційна зміна порядку

---

## 🧪 Test Manager (Планування → Виконання → Результати)

Модуль управління повним циклом тестування: релізи, плани, пункти плану, прогони, виконання й результати (включно з авто‑тестами).

Сутності:
- Release — реліз проєкту (опційний для планів)
- TestPlan — тест‑план у межах проєкту, може лінкуватися до Release
- PlanItem — пункт плану; містить `testcase` і знімок `TestCaseVersion`
- TestRun — прогін (planned/running/completed/canceled), опційно на базі плану
- TestInstance — виконання окремого тест‑кейсу у прогоні (not_started/in_progress/passed/failed/blocked/skipped)
- TestCaseVersion — версійний знімок TestCase: створюється автоматично при оновленні TestCase; також знімається при додаванні PlanItem без явної версії

RBAC (скорочено):
- create: owner/admin/member; update/delete: owner/admin
- Дії виконання (assign/start/pass/fail/block/skip): owner/admin/member

Потоки та дії:
- Клонування плану: `POST /tms/api/plans/{id}/clone`
- Порядок пунктів плану: `POST /tms/api/plan-items/{id}/move` `{order}`
- Планування/запуск/завершення прогонів: `POST /tms/api/runs/{id}/schedule|start|finish|cancel`
- Приймання результатів авто‑тестів: `POST /tms/api/runs/{id}/results` з масивом `{automation_ref,status,actual_result?,defects?}` — пошук інстансів по `automation_ref`
- Керування інстансами: `POST /tms/api/instances/{id}/assign|unassign|start|pass_case|fail_case|block|skip|link_defect`

Швидкий флоу (HTTPie):
- Реліз: `http POST :/tms/api/releases/ Authorization:"Bearer <AT>" X-Tenant-ID:<T> project:=<P> name='R1' version='1.0.0'`
- План: `http POST :/tms/api/plans/ Authorization:"Bearer <AT>" X-Tenant-ID:<T> project:=<P> name='Smoke Plan' release:=<R>`
- Пункт плану (snapshot): `http POST :/tms/api/plan-items/ Authorization:"Bearer <AT>" X-Tenant-ID:<T> plan:=<PLAN> testcase:=<TC>`
- Прогін: `http POST :/tms/api/runs/ Authorization:"Bearer <AT>" X-Tenant-ID:<T> project:=<P> plan:=<PLAN> name='Smoke Run'`
- Старт: `http POST :/tms/api/runs/<RUN>/start/ Authorization:"Bearer <AT>" X-Tenant-ID:<T>`
- Passed: `http POST :/tms/api/instances/<INST>/pass_case/ Authorization:"Bearer <AT>" X-Tenant-ID:<T>`
- Завершити: `http POST :/tms/api/runs/<RUN>/finish/ Authorization:"Bearer <AT>" X-Tenant-ID:<T>`

Пагінація: CursorPagination (`next`, `previous`); для наступної сторінки використовуйте `?cursor=<token>`.

Multi‑tenant: додавайте `X-Tenant-ID` або використовуйте claim `tenant_id` у JWT; у разі розбіжності — 403.

---

## 🔁 Пагінація (Cursor)

- Приклад: `GET /tms/api/projects/?cursor=<TOKEN>` — токен береться з поля `next` попередньої відповіді.
- Розмір сторінки: `PAGE_SIZE` (env), дефолт 25.

---

## ⚙️ Змінні середовища (приклади)

JWT/Throttling (Auth):
- `ACCESS_TOKEN_LIFETIME_MINUTES`, `REFRESH_TOKEN_LIFETIME_DAYS`
- `ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION`
- `THROTTLE_USER`, `THROTTLE_ANON`, `THROTTLE_REGISTER`, `THROTTLE_TOKEN`

JWKS/сервісні ключі:
- `SERVICES_JWKS_URL=http://auth:8000/api/service/jwks`
- `SERVICE_JWKS_MAX_AGE`, `SERVICE_JWT_GRACE_SECONDS`

Сервісні JWT/міжсервісна взаємодія:
- `SERVICES_JWT_ISSUER`, `SERVICES_JWT_AUDIENCE`, `SERVICES_JWT_SECRET` (HS256, dev)
- або RS256 через JWKS (рекомендовано)

Пагінація:
- `PAGE_SIZE=25`, `CURSOR_ORDERING=-id` (окремі ViewSet — `-created_at`)

URL інших сервісів для запитів:
- TMS: `AUTH_BASE_URL=http://auth:8000/api`
- Orgs: `ORGS_BASE_URL=http://orgs:8000/api`, `ORGS_SERVICE_TOKEN` (dev), `SERVICES_JWKS_URL` для RS256

---

## 🧪 Колекції Postman та HTTPie

- Postman: `collections/postman/TestCloud.postman_collection.json`
- Test Manager smoke: `collections/postman/TestCloud.tms_test_manager_smoke.postman_collection.json`
- Environment: `collections/postman/TestCloud.postman_environment.json` (автозбереження `{{access}}`)
- HTTPie: `collections/httpie/quickstart.md`

Запуск Newman локально:
- `newman run collections/postman/TestCloud.postman_collection.json -e collections/postman/TestCloud.postman_environment.json`
- `newman run collections/postman/TestCloud.tms_test_manager_smoke.postman_collection.json -e collections/postman/TestCloud.postman_environment.json`

---

## 🧰 CI/CD

GitHub Actions (`.github/workflows/ci.yml`):
- Підіймає стек, чекає health, експортує OpenAPI (`/api/schema`) для усіх сервісів і валідовує схеми
- Запускає smoke‑сценарії Postman (включно з Test Manager)
- Артефакти: OpenAPI JSON

---

## ❓ FAQ / Поширені помилки

- 403 у TMS на GET? Додайте заголовок `X-Tenant-ID` або переконайтесь, що claim `tenant_id` у JWT відповідає. Невідповідність — 403.
- 403 на створення/оновлення? Перевірте ролі. Для більшості write‑дій потрібні `owner`/`admin`. Частина create‑дій доступна `member`.
- Traefik 502? Звертайтесь напряму на порти сервісів `:8001/:8002/:8003` та перевірте compose.
- JWKS кеш не оновлюється? Налаштуйте `SERVICE_JWKS_MAX_AGE`/`SERVICE_JWT_GRACE_SECONDS`.
- CursorPagination: використовуйте посилання з поля `next` і параметр `?cursor=`.

---

