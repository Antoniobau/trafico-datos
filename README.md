# Trafico Platform - MVP

Este repo contiene un MVP listo para deploy en Railway (backend + bot + Postgres) y un frontend mínimo para probar compras con PayPal.

## Estructura
- /server
  - index.js        -> API (auth, pagos PayPal, webhook, track)
  - db.js           -> pool Postgres
  - bot.js          -> bot de respaldo (Telegram)
- /migrations
  - 001_init.sql    -> migraciones
- /frontend
  - index.html      -> demo simple con PayPal Buttons
  - app.js
- /scripts
  - run_migrations.js
- .env.example

## Quick start (local)
1. Copia `.env.example` a `.env` y completa variables.
2. `npm install`
3. Ejecuta migraciones: `npm run migrate`
4. `npm run start`
5. En otra terminal: `npm run bot`

## Deploy en Railway
- Conecta repo a Railway, añade Postgres plugin.
- Crea dos services: web (`npm start`) y bot (`npm run bot`).
- Añade variables de entorno (ver `.env.example`).

