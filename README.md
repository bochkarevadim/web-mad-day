# WEB MAD DAY

Публичная веб-форма регистрации на игру MAD DAY (без Telegram).

## Локальный запуск

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 web_form.py
```

Форма будет доступна на `http://localhost:8080`.

## Переменные окружения

Обязательные:
- `GOOGLE_SHEETS_SPREADSHEET` или `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_CREDENTIALS_JSON` (полный JSON сервисного аккаунта)

Рекомендуемые:
- `REGISTRATION_TIMEZONE`
- `PAYMENT_LINK`
- `FACTION_LIMITS`
- `TARIFFS`
- `TARIFF_BUTTONS`

## Деплой на Render

Render читает `render.yaml` автоматически.

1. Создай **Web Service** и подключи этот репозиторий.
2. Задай переменные окружения (см. выше).
3. После деплоя получишь публичную ссылку вида `https://...onrender.com`.

## GitHub Pages (страница с iframe)

1. Открой `docs/index.html` и замени `RENDER_FORM_URL` на ссылку Render.
2. В GitHub включи Pages для ветки `main`, папка `/docs`.

После этого получишь публичную страницу, где форма встроена через iframe.
