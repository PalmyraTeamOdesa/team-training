# TRITON Team — тренування

Застосунок команди TRITON Triathlon Team (Одеса): план тренувань, щоденник, харчування, командна стрічка і кабінет тренера.
Статичний PWA (GitHub Pages) + Supabase (Auth, Postgres з RLS, Storage, Edge Functions).

**Живий сайт:** https://palmyrateamodesa.github.io/team-training/

## Структура
- `src/` — код застосунку (звичайний JS, без фреймворку). Порядок збирання — у `build.mjs`.
  - `core.js` — константи, бібліотека з 79 тренувань, парсер їжі
  - `num.js` — поле «цифра + повзунок»
  - `plan.js` — генератор тижня, графіки, експорт .zwo
  - `data.js` — робота з Supabase, зберігання планів
  - `athlete.js`, `team.js`, `food.js`, `prog.js` — вкладки спортсмена
  - `coach.js` — кабінет тренера
  - `onb.js` — анкета (8 кроків)
  - `files.js` — стиснення фото, читання .fit/.gpx/.tcx
  - `misc.js` — профіль, налаштування, асистент
- `public/` — index.html, service worker, маніфест, іконки
- `supabase/migrations/` — схема бази, політики RLS, тригери
- `supabase/functions/` — Edge Functions `ai-assistant` (Gemini) і `account` (реєстрація, скидання пароля тренером)

## Збирання
```
npm ci
npm run build   # результат у dist/
```
Кожен push у `main` автоматично публікує сайт (GitHub Actions → Pages).

## Ролі і безпека
- Тренер — лише акаунт, записаний у таблицю `coaches` (тільки через SQL у Supabase; з застосунку призначити неможливо).
- Нові учасники мають статус `pending`, доки тренер не прийме їх у команду.
- Спортсмен бачить лише свої дані; команда бачить лише те, чим поділились (стрічка, чат, рейтинг).
- У фронтенді лише публічний ключ (publishable). Сервісний ключ живе тільки в Edge Functions.

## Асистент АІ
Edge Function `ai-assistant` читає секрет `GEMINI_API_KEY` (і необовʼязковий `GEMINI_MODEL`, типово `gemini-2.5-flash`).
Без ключа застосунок показує «АІ ще не підключено». Додати: Supabase → Edge Functions → Secrets.
