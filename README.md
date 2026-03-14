# WEB MAD DAY

Публичная веб-форма регистрации на игру MAD DAY (без Telegram).

## Локальный запуск (для теста)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 web_form.py
```

Форма будет доступна на `http://localhost:8080`.

## Публикация на GitHub Pages + Apps Script

GitHub Pages отдаёт только статические страницы. Поэтому серверную часть мы выносим в Google Apps Script.

### 1) Создай Apps Script

1. Открой [https://script.google.com](https://script.google.com)
2. Создай новый проект
3. Удали весь код и вставь содержимое файла `apps_script.gs`
4. Вверху в `CONFIG` задай:
   - `SPREADSHEET_NAME` (название таблицы)
   - `TIMEZONE` (например `Europe/Moscow`)
   - при желании `FACTION_LIMITS`, `TARIFFS`
5. Нажми **Deploy → New deployment**
6. Тип: **Web app**
7. Execute as: **Me**
8. Who has access: **Anyone**
9. Скопируй URL веб‑приложения

### 2) Вставь URL в GitHub Pages

1. Открой `docs/index.html`
2. Найди строку:
   ```js
   const APPS_SCRIPT_URL = "PASTE_APPS_SCRIPT_URL_HERE";
   ```
3. Вставь URL из Apps Script
4. Запушь изменения

### 3) Включи GitHub Pages

В GitHub: Settings → Pages → Branch: `main`, Folder: `/docs`.

После этого форма будет доступна по ссылке:
`https://bochkarevadim.github.io/web-mad-day/`
