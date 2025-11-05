# 🧪 Test Manager — планування, виконання, результати

Модуль для управління тестовою документацією від створення планів до обліку результатів. Працює в межах multi‑tenant, з RBAC та CursorPagination.

Основні сутності
- Release — реліз проєкту (опційно для планів)
- TestPlan — тест‑план у проєкті, може бути прив’язаний до Release
- PlanItem — пункт плану; містить посилання на TestCase та його знімок TestCaseVersion
- TestRun — прогін плану/набору; статуси: planned/running/completed/canceled
- TestInstance — виконання окремого тест‑кейсa у прогоні; статуси: not_started/in_progress/passed/failed/blocked/skipped
- TestCaseVersion — версійний знімок TestCase, створюється автоматично при зміні TestCase та/або коли пункт плану додається без явної версії

RBAC (коротко)
- create: owner/admin/member
- update/delete: owner/admin
- run actions (start/pass/fail/...): owner/admin/member

Multi‑tenant
- Усі запити в TMS мають містити `X-Tenant-ID` або коректний claim `tenant_id` у JWT. За розбіжності — 403.

HTTPie приклади (швидкий флоу)
1) Створити реліз (опційно):
   http POST :/tms/api/releases/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:<TENANT> \
     project:=<PROJECT> name='R1' version='1.0.0'

2) Створити тест‑план:
   http POST :/tms/api/plans/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:<TENANT> \
     project:=<PROJECT> name='Smoke Plan' description='E2E smoke' release:=<RELEASE>

3) Додати пункт плану (snapshot створиться автоматично, якщо версію не вказано):
   http POST :/tms/api/plan-items/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:<TENANT> \
     plan:=<PLAN> testcase:=<TESTCASE>

4) Створити прогін:
   http POST :/tms/api/runs/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:<TENANT> \
     project:=<PROJECT> plan:=<PLAN> name='Smoke Run'

5) Стартувати прогін (згенерує TestInstance з прив’язкою до TestCaseVersion):
   http POST :/tms/api/runs/<RUN>/start/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:<TENANT>

6) Позначати інстанси як пройдені/завалені/заблоковані/пропущені:
   http POST :/tms/api/instances/<INSTANCE>/pass_case/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:<TENANT>
   http POST :/tms/api/instances/<INSTANCE>/fail_case/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:<TENANT> actual_result='...'

7) Завершити прогін:
   http POST :/tms/api/runs/<RUN>/finish/ Authorization:"Bearer <ACCESS>" X-Tenant-ID:<TENANT>

Результати автоматизації
- POST /tms/api/runs/{id}/results
  {
    "results": [
      {"automation_ref": "login_smoke", "status": "passed", "actual_result": "OK", "defects": []}
    ]
  }
  Пошук інстансів здійснюється за `automation_ref`.

Пагінація
- CursorPagination (`next`, `previous`); для наступної сторінки використовуйте параметр `?cursor=` зі значенням із поля `next`.

