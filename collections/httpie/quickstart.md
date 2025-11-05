# HTTPie швидкий старт

Використовуйте `http` (HTTPie). Базовий URL: http://localhost

## Auth

- Здоров'я:
  http GET :/auth/api/health

- Логін (отримати access/refresh):
  http POST :/auth/api/auth/token username=demo@example.com password=Secret123! tenant_id:=2

- Перемкнути тенант (новий access):
  http POST :/auth/api/auth/switch-tenant Authorization:"Bearer <ACCESS>" tenant_id:=2

- JWKS:
  http GET :/auth/api/service/jwks

- Видати сервісний токен:
  http POST :/auth/api/service/token Authorization:"Service dev-service-token" aud=orgs sub=tms

## Orgs

- Список тенантів:
  http GET :/orgs/api/tenants/ Authorization:"Bearer <ACCESS>"

- Створити тенанта:
  http POST :/orgs/api/tenants/ Authorization:"Bearer <ACCESS>" name='Acme QA' slug=acme-qa owner_user_id:=1

## TMS

- Список проєктів (CursorPagination):
  http GET :/tms/api/projects/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2

- Наступна сторінка:
  http GET ":/tms/api/projects/?cursor=<TOKEN>" Authorization:"Bearer <ACCESS>" X-Tenant-ID:2

- Створити тест-кейс (member може створювати):
  http POST :/tms/api/testcases/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2 project:=1 title='Login works' description='...' steps:='[]' tags:='[]' status=active version:=1

- Перемістити тест-кейс у сьюті:
  http POST :/tms/api/suite-cases/1/move Authorization:"Bearer <ACCESS>" X-Tenant-ID:2 order:=3

## Test Manager (планування → виконання → результати)

- Створити реліз (опціонально):
  http POST :/tms/api/releases/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2 project:=1 name='R1' version='1.0.0'

- Створити тест-план:
  http POST :/tms/api/plans/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2 project:=1 name='Smoke Plan' description='E2E smoke' release:=1

- Додати пункт плану (PlanItem) з автоснімком версії кейсу:
  http POST :/tms/api/plan-items/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2 plan:=1 testcase:=1

- Створити прогін (Run):
  http POST :/tms/api/runs/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2 project:=1 plan:=1 name='Smoke Run'

- Стартувати прогін (згенерує інстанси по пунктах плану):
  http POST :/tms/api/runs/1/start/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2

- Отримати інстанси та взяти перший `id`:
  http GET  :/tms/api/instances/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2 run==1

- Позначити як Passed/Failed/Blocked/Skipped:
  http POST :/tms/api/instances/1/pass_case/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2
  # або
  http POST :/tms/api/instances/1/fail_case/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2 actual_result='Очікувалося 200, отримано 500'

- Завершити прогін:
  http POST :/tms/api/runs/1/finish/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:2
