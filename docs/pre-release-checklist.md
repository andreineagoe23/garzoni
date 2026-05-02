# Pre-release checklist

**Run this before every deploy. Target: <10 minutes.**

---

## 🔹 Tools

- [ ] **Tools hub loads**
- [ ] **Each of the 6 tools opens**
- [ ] **No blank screens if:**
  - calendar widget fails
  - news feed is empty
- [ ] **Completion event fires once per tool**

---

## 🔹 Profile propagation

- [ ] **Edit profile**
- [ ] **Refresh page**
- [ ] **Profile affects:**
  - portfolio goal fit
  - calendar relevance
  - next steps recommendations

---

## 🔹 News

- [ ] **News loads from cache**
- [ ] **Provider failure shows stale data**
- [ ] **No infinite loading**

---

## 🔹 Exercises (dashboard skill intent)

- [ ] **From dashboard weak skill / practice / quick card:** lands on `/exercises` with the expected focus (category or “all” if unmapped)
- [ ] **Refresh on `/exercises?skill=…`** still applies the right category when mapped
- [ ] After release, skim [monitoring red flags](./monitoring-red-flags.md) and [skill intent funnels](./analytics/skill-intent-funnels.md) for spikes (unmapped, mapped-zero, manual override)

## 🔹 Recommendations

- [ ] **Next Steps shows ≤ 3 items**
- [ ] **Each item has:**
  - reason
  - clear action
- [ ] **Click is tracked**

---

## 🔹 AI tutor (web + mobile)

- [ ] **Chat opens** and loads server-side history (scrollback persists across reload)
- [ ] **Wrong-answer flow on a multiple choice exercise** triggers inline AI explanation + a follow-up practice question
- [ ] **Personalized path** loads with AI reasoning per course (Plus/Pro)
- [ ] **Coach Brief card** appears on personalized path for Plus/Pro users
- [ ] **Daily quotas enforced**: hit free-tier limit → 429/upsell modal renders
- [ ] **Token-budget guard**: confirm Redis counter increments on each AI call
- [ ] **Sentry** has no `openai_unexpected_error` spike in the last hour

## 🔹 Pro mobile features (iOS + Android)

- [ ] **Voice tutor** (`/voice-chat`): record → transcript appears → reply audio plays
- [ ] **Receipt scan** (`/scan`): pick image → categorized JSON renders + lesson recommendation
- [ ] Free / Plus user sees Pro-gate screen on both routes
- [ ] **Smart Resume nudge** appears on dashboard (cached 24h)
- [ ] **AI push nudge** delivered (test with Customer.io test send)

## 🔹 Migrations & embeddings

- [ ] `python manage.py migrate --check` passes (no pending migrations)
- [ ] `python manage.py makemigrations --check --dry-run` reports nothing
- [ ] `ContentEmbedding` table populated for active Lessons + Courses (run `backfill_embeddings_async` if low)
- [ ] `pgvector` extension exists on prod DB

## 🔹 Build / deploy gates

- [ ] `pnpm precommit` green locally (typecheck + lint + Prettier + Vitest)
- [ ] `flake8 backend` green
- [ ] CI green on master
- [ ] Vercel preview deploy renders
- [ ] Railway backend healthcheck green

---

## Definition of done

- You can run this checklist in **<10 minutes**
- You do it **before every deploy**

---

See also: [Error reporting](error-reporting.md), [Monitoring red flags](monitoring-red-flags.md).
