# Ten2Ten — миграция бэкенда в Yandex Cloud (152-ФЗ)

Цель: перенести хранение персональных данных в РФ (Yandex Cloud, `ru-central1`),
чтобы соответствовать локализации по 152-ФЗ и подать уведомление в Роскомнадзор,
где хранилищем указан Yandex Cloud, а оператором — ООО «Тен2Тен».

## Целевая архитектура

```
Пользователь → Vercel (фронтенд Next.js, остаётся за рубежом)
             → https://api.ten2ten.ru  (self-hosted Supabase на ВМ Yandex)
                   ├── Kong (шлюз) → GoTrue (auth) / PostgREST / Storage API
                   ├── БД: Managed Service for PostgreSQL (ru-central1, приватный)
                   └── Файлы: Object Storage (S3, ru-central1) — фото объявлений
             → e-mail: Yandex Postbox (SMTP)
```

Ключевой принцип: **мастер-БД и файлы физически в РФ**. Vercel остаётся фронтендом;
он обращается только к `api.ten2ten.ru`. Код приложения почти не меняется — тот же
клиент `@supabase/supabase-js`, просто другой URL/ключи.

## Сервисы Yandex Cloud (из калькулятора)

| Сервис | Роль |
|---|---|
| Managed Service for PostgreSQL (`Кластер PostgreSQL`, класс `s4a-c2-m8`) | мастер-БД |
| Compute Cloud ВМ (2 vCPU / 4 ГБ / 25 ГБ SSD, публичный IP) | self-hosted Supabase |
| Object Storage (100 ГБ) | S3-хранилище фото |
| Postbox | исходящая почта (SMTP) |
| Certificate Manager (бесплатно) | TLS — опционально, если не Caddy |

---

## Этап 0. Подготовка
- Аккаунт Yandex Cloud, платёжный аккаунт, каталог (folder).
- Доступ к DNS зоны `ten2ten.ru` (нужно добавить запись `api`).
- Доступ к текущему проекту Supabase (`fujmmiczdchvpgzjtvks`): connection string и Storage.
- Установить локально: `psql`, `pg_dump`, `docker`, `docker compose`, `rclone` (или `aws` CLI).

## Этап 1. Провижининг инфраструктуры (в консоли Yandex)
1. **Сеть**: создать `VPC network` + подсеть в зоне `ru-central1-a`. Все ресурсы — в одной сети/зоне (иначе приватная связка ВМ↔БД не заработает).
2. **Managed PostgreSQL**: кластер, версия PG 15/16, класс `s4a-c2-m8`, `network-ssd` 10 ГБ, 1 хост, **публичный IP — выкл**, в той же сети/подсети. Создать пользователя `app` и базу `peredai`.
3. **Compute ВМ**: Ubuntu 22.04 LTS, 2 vCPU / 4 ГБ, диск SSD 25 ГБ, **публичный IP — вкл**, в той же сети. Открыть в security group порты 80/443 (входящие) и доступ к PG (внутренний).
4. **Object Storage**: создать бакет `ten2ten-photos` (или имя из `PHOTO_BUCKET`), тип «Стандартное». Создать **сервисный аккаунт** + **статический ключ доступа** (Access Key / Secret) для S3.
5. **DNS**: A-запись `api.ten2ten.ru` → публичный IP ВМ.
6. (Опц.) **Certificate Manager**: TLS-сертификат на `api.ten2ten.ru` — если не используете Caddy (см. этап 3).

## Этап 2. Бутстрап БД под self-hosted Supabase
Self-hosted Supabase ожидает свои роли/схемы. На чистой Managed PG выполнить (psql):
- роли: `supabase_admin`, `authenticator`, `anon`, `authenticated`, `service_role`, `supabase_auth_admin`, `supabase_storage_admin`, `supabase_realtime_admin` (с нужными GRANT);
- расширения: `pgcrypto`, `pgjwt`, `uuid-ossp` (или `pgcrypto`+`gen_random_uuid`), `pg_stat_statements`;
- схемы: `auth`, `storage` (создаются миграциями Supabase при первом старте GoTrue/Storage).

Ориентир — официальные скрипты Supabase self-hosting и гайд «external/managed Postgres».
Это самый тонкий шаг; выполнять по чек-листу Supabase, не на глаз.

## Этап 3. Развернуть self-hosted Supabase на ВМ
1. `git clone https://github.com/supabase/supabase`, каталог `docker/`.
2. `.env` (главное):
   - `POSTGRES_HOST=<приватный FQDN Managed PG>`, `POSTGRES_PORT=6432` (пулер) или `5432`, `POSTGRES_DB=peredai`, `POSTGRES_PASSWORD=<пароль app>`.
   - **Отключить встроенный контейнер `db`** (используем Managed PG) — убрать сервис `db` из compose и указать внешний хост.
   - `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` — сгенерировать заново (эти ключи пойдут в Vercel).
   - `SITE_URL=https://ten2ten.ru`, `API_EXTERNAL_URL=https://api.ten2ten.ru`, `SUPABASE_PUBLIC_URL=https://api.ten2ten.ru`.
   - Storage → S3: `STORAGE_BACKEND=s3`, `GLOBAL_S3_BUCKET=ten2ten-photos`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` = ключ сервисного аккаунта, `AWS_DEFAULT_REGION=ru-central1`, `S3_ENDPOINT=https://storage.yandexcloud.net`, force path-style.
   - SMTP → Postbox: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER`/`SMTP_ADMIN_EMAIL` (в приложении — те же `SMTP_*`, см. `src/lib/twilio.ts`).
3. TLS на `api.ten2ten.ru`: проще всего **Caddy** перед Kong (авто-Let's Encrypt, тогда Certificate Manager не нужен). Альтернатива — Yandex ALB + Certificate Manager.
4. `docker compose up -d`. Проверить, что GoTrue/PostgREST/Storage поднялись и видят Managed PG.

## Этап 4. Перенос данных
Пока пользователей мало — окно короткое. По шагам:
1. Включить на сайте «заглушку» (passcode-gate) на время переноса.
2. Дамп из hosted Supabase: `pg_dump` схем `public`, `auth`, `storage` (данные + структура, без ролей).
3. Восстановить в Managed PG (после бутстрапа этапа 2). Сверить количество строк ключевых таблиц (`profiles`, `listings`, `chats`, `messages`, `credit_ledger`, `coupons`).
4. Применить миграции при необходимости (0001→0048 уже в дампе структуры — проверить, что всё на месте, включая `open_connect_chat` из 0048).
5. Фото: скопировать объекты из Supabase Storage в Object Storage (`rclone`/`aws s3 sync` между S3-совместимыми эндпоинтами), сохранив пути (`storage_path`).

## Этап 5. Переключение (cutover)
В переменных окружения **Vercel** заменить на новый инстанс:

| Переменная | Было (hosted Supabase) | Стало (Yandex) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fujmmiczdchvpgzjtvks.supabase.co` | `https://api.ten2ten.ru` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | старый anon | новый anon |
| `SUPABASE_SERVICE_ROLE_KEY` | старый service role | новый service role |
| `SMTP_*` | текущий ESP | Postbox |

- Фото-URL строятся из `NEXT_PUBLIC_SUPABASE_URL` (`getPublicUrl`), поэтому подхватятся автоматически после смены URL.
- Смена `JWT_SECRET` инвалидирует текущие сессии — пользователи перелогинятся. На препроде это не проблема.
- Redeploy Vercel. Прогнать весь путь: регистрация/Сбер ID → оплата (тест) → открытие чата → фото. Снять заглушку.

## Этап 6. После переключения
- Роскомнадзор: подать/обновить уведомление — хранение ПДн в РФ (Yandex Cloud `ru-central1`), оператор ООО «Тен2Тен».
- Проверить автобэкапы Managed PG; включить алерты в Yandex Monitoring (CPU/RAM/соединения/диск).
- Вывести hosted Supabase из эксплуатации после стабильной работы (сохранив финальный дамп).

## Откат (rollback)
Пока DNS `api.ten2ten.ru` и Vercel env не переключены — рабочим остаётся hosted Supabase.
Если после cutover что-то не так: вернуть в Vercel старые `NEXT_PUBLIC_SUPABASE_URL`/ключи и
redeploy — трафик снова идёт в hosted Supabase (данные там на момент дампа).

## Открытые вопросы к юристу (medoed-soft)
- Достаточно ли фронтенда на Vercel (за рубежом) при мастер-БД в РФ, или нужно уведомление о трансграничной передаче.
- Формулировки в уведомлении Роскомнадзора о месте хранения и обработчике (Yandex Cloud).
