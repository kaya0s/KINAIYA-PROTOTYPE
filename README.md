# KINAIYA

_Your Inner Character, Your Excellence._

KINAIYA is a **UI-only prototype** for an **AI-powered reading companion** that supports Filipino learners' English reading practice and gives teachers a quick class view.

## Highlights

- **Student flow:** join class (mock QR/code) -> diagnostic -> results -> practice + games
- **Teacher flow:** dashboard, student profiles, DepEd/MATATAG-aligned cues (prototype copy)
- **PAGASA features (simulated):** weather card + "Simulate PAGASA Alert" to trigger continuity-learning UX (offline pack)
- **Handshake features (simulated):** teacher "Sync Handshake" marks offline records as synced (still local)

## Run locally

Prereqs: **Node.js 18+** and **npm**

```sh
npm i
npm run dev
```

Other scripts: `npm run build`, `npm run preview`, `npm run test`, `npm run lint`

## Demo routes

- `/` (Welcome)
- `/student/join` (Join class)
- `/diagnostic` -> `/results` (Diagnostic + results)
- `/offline-pack` (Offline practice pack)
- `/games` (Word games)
- `/teacher` (Teacher dashboard + handshake sync)

## Reset demo data

```js
localStorage.removeItem("kinaiya_mock_db_v2");
localStorage.removeItem("kinaiya_student_session_v1");
localStorage.removeItem("kinaiya_last_analysis_v1");
localStorage.removeItem("kinaiya_offline_queue_v1");
localStorage.removeItem("kinaiya_resilience_pack_v1");
location.reload();
```

## Prototype notes

- No external API calls: `src/lib/kinaiyaApi.ts` intentionally throws.
- "Offline sync" + "handshake" are local demo mechanics: `src/lib/offlineQueue.ts`, `src/lib/kinaiyaDb.ts`.
