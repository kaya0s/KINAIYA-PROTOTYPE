# KINAIYA

_Your Inner Character, Your Excellence._

KINAIYA is a **demo-first MVP prototype** for an **AI-powered reading companion** that supports Filipino learners' English reading practice and gives teachers a quick class view.

## Highlights

- **Student flow:** join class (demo code) -> diagnostic -> results -> practice + games
- **STT (speech-to-text):** uses the browser's built-in Web Speech API where available (falls back gracefully if unsupported)
- **SLM (small language model):** demo "local edge inference" that maps results to teacher-friendly cues/competencies (no server calls)
- **Teacher flow:** dashboard + quick class view with DepEd/MATATAG-aligned cues (demo copy)
- **Continuity learning:** "PAGASA Alert" demo trigger for offline-pack UX
- **Offline sync:** teacher "Sync Handshake" demo that marks local offline records as synced

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

- Demo/presentation build: most state is local (`localStorage`) and flows are optimized for a live demo, not production.
- No external API calls: `src/lib/kinaiyaApi.ts` intentionally throws.
- "Offline sync" + "handshake" are local demo mechanics: `src/lib/offlineQueue.ts`, `src/lib/kinaiyaDb.ts`.
