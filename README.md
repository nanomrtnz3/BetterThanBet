# BetterThanBet

Dashboard de fútbol (goleadores, tarjetas, winrate, cuotas en vivo y a futuro).
Los datos se sirven desde `data/football.xml` para no pegarle a la API en cada visita.

## Cómo verla

No abras `index.html` como archivo: el navegador bloqueará el `fetch` del XML.

```bash
npx --yes serve .
```

o

```bash
python -m http.server 8080
```

Luego entra en `http://localhost:3000` (serve) o `http://localhost:8080`.

## Caché XML

La página relee `data/football.xml` cada 30 segundos y solo repinta si `generatedAt` cambió.
Quien llama a las APIs es el sync, no el navegador.

```bash
copy .env.example .env
# pega BZZOIRO_API_KEY (obligatoria) y, si quieres cuotas en directo de casas, API_FOOTBALL_KEY
node tools/sync-loop.mjs
```

| Ritmo | Qué pide | Por qué |
| --- | --- | --- |
| Cada 15 min | Partidos, cuotas consenso y % del modelo (Bzzoiro) | No martillar en cada visita |
| Cada 12 h | Goleadores, tarjetas y clasificación | Casi no cambian entre jornadas |
| Como mucho 40/día y nunca antes de 30 min | Cuotas en directo (API-Football), solo si hay partido en juego | El plan gratis son 100 peticiones/día |

Sin `BZZOIRO_API_KEY` el XML de ejemplo se queda como está.

## Demo en Vercel

Vercel publica la página. No puede dejar `sync-loop` encendido, así que la copia que ve el público vive en un Blob y la reescribe un cron.

1. Sube el repo a GitHub e impórtalo en Vercel.
2. En el proyecto de Vercel, Storage → Blob → conecta un store. Vercel añade `BLOB_STORE_ID`. Con eso basta: no hace falta `BLOB_READ_WRITE_TOKEN`.
3. En Environment Variables pon las mismas claves que en `.env`, más un `CRON_SECRET` largo (una frase aleatoria).
4. En GitHub → Settings → Secrets, crea `CRON_SECRET` (el mismo) y `DEMO_URL` (la URL del deploy, sin barra final).
5. El workflow `.github/workflows/sync.yml` llama a `/api/sync` cada 15 minutos. También puedes lanzarlo a mano en Actions.
6. Cuando eso esté en marcha, para el `sync-loop` del ordenador. Si los dos corren, gastan la cuota de API-Football por separado.

En el plan gratis de Vercel el cron propio del proyecto solo puede ir una vez al día (`vercel.json`). Los 15 minutos los hace GitHub, que sigue aunque el ordenador esté apagado.

En local la página sigue leyendo `data/football.xml`. En el dominio de Vercel lee `/api/football`.
