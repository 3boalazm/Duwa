# DUWA | دُوّا

**Two players. One private universe.** — عالم صغير، لشخصين فقط.

A private online games room for exactly two players on two phones: create a room,
share the invite code, play together, collect DUWA Points, open new worlds.

- Next.js 16 (App Router) + React 19 + Tailwind 4, Arabic / RTL, mobile first, installable (PWA).
- One Postgres database. Locally it is embedded (PGlite, zero setup); in production it is a hosted
  Postgres such as [Neon](https://neon.com) (free plan, no card).
- Every rule, timer, score and unlock is decided on the server (`src/game`, `src/server`); phones only send moves.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
```

No environment variables are needed. Open the app in two browsers (or a normal and a private window)
to play both players. Local data lives in `./.data` (git-ignored).

## Checks

```bash
npm run typecheck
npm run lint
npm test           # rules + server tests on the embedded database
npm run build
```

To run the same server tests through the production driver against a real Postgres
(use a scratch database, it leaves test rooms behind):

```bash
DUWA_TEST_DATABASE_URL="postgres://user@127.0.0.1:5432/scratch" npm test
```

## Deploy (Vercel + Neon)

1. Import this repository in Vercel (framework: Next.js, no settings to change).
2. In the Vercel project open **Storage → Create Database → Neon** (free plan) and connect it to the project.
   Pick the **Frankfurt** region: `vercel.json` runs the functions in `fra1`, and the database should sit next to them.
   The integration adds `DATABASE_URL` to the project.
3. Redeploy. The tables are created automatically on the first request.

Without a database the deployed app answers `503 no_database`
(«قاعدة البيانات لسه مش متوصلة بالتطبيق»). See `.env.example` for all variables.

## What is inside

| Path | What |
| --- | --- |
| `src/game` | Pure rules: catalogue of worlds and games, the round engine, points, badges, the journey, question banks |
| `src/server` | Database schema, room service (two seats, device tokens, recovery codes), long-poll sync |
| `src/app` | Screens (entry, character, lobby, home, worlds, play, results, achievements, journey, settings) and API routes |
| `src/components` | UI, avatars, the six games' screens |
| `tests` | Rules and server tests (third player refused, hidden answers, no double points, resume after a drop…) |

Playable now: خمن إجابتي · ممنوع آه ولا لأ · أول كلمة · الظرف المجهول · تحدي الدقيقة · خمن الرسمة.
