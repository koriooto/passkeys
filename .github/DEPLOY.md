# Деплой на сервер через GitHub Actions

## Секреты репозитория

В **Settings → Secrets and variables → Actions** добавь:

| Секрет | Описание |
|--------|----------|
| `SERVER_IP` | IP сервера |
| `SERVER_USER` | Пользователь SSH (обычно `root`) |
| `SERVER_PASSWORD` | Пароль для SSH |
| `POSTGRES_USER` | Пользователь PostgreSQL (по умолчанию passkeys) |
| `POSTGRES_PASSWORD` | **Пароль PostgreSQL — обязательно смени!** |
| `POSTGRES_DB` | Имя БД (по умолчанию passkeys) |
| `JWT_SECRET` | Секрет для JWT |
| `JWT_ACCESS_HOURS` | TTL access token в часах (по умолчанию 1) |
| `JWT_REFRESH_HOURS` | TTL refresh token в часах (по умолчанию 720) |

## Подготовка сервера

1. Установи Docker и Docker Compose:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. Создай каталог для проекта:
   ```bash
   mkdir -p /opt/passkeys
   ```

3. Скопируй `.env.example` в `.env` и задай переменные (локально и в GitHub Secrets для деплоя).

**Если БД уже поднималась с старыми креденшалами** (passkeys/passkeys), нужно сбросить данные:
   ```bash
   docker compose down -v
   ```
   Затем заново задеплой — создастся БД с новыми данными.

## Триггеры

- **push** в ветки `main` или `master`
- **workflow_dispatch** — ручной запуск в Actions

## Что делает workflow

1. Синхронизирует файлы на сервер (rsync)
2. Поднимает контейнер `db`, применяет миграции
3. Собирает и перезапускает контейнер `api`

## Путь деплоя

По умолчанию используется `/opt/passkeys`. Чтобы изменить, отредактируй `DEPLOY_PATH` в `.github/workflows/deploy-backend.yml`.
