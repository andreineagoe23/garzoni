# Cleanup plan (2026-11-16)

**Status:** PLAN, nothing executed. From a read-only investigation of the repo, the Claude Code
setup around it and git. Token figures are bytes ÷ 4 estimates. Dead-code findings are
grep reachability only (no knip/vulture installed), so each delete gets a check first.

**Order of work agreed 2026-11-16:** this plan → release 1.2.2 → cleanup execution and the growth
implementation plan. No cleanup touches `mobile/` until 1.2.2 is live in both stores, so master
stays equal to the shipped binary.

---

## 1. Where the session tokens go

| Source | Cost | Loaded |
| --- | --- | --- |
| Claude Code setup outside the repo: ~775 MCP tool names, 8 MCP instruction blocks, ~175 skill descriptions, ~27 agent descriptions | **~18–22K tokens** | every session |
| Reading one giant source file whole | 17–40K each | per task that touches it |
| `docs/` (78 files) | ~235K total; ~59K of it superseded | on demand, easy to misread |
| `.claude/context/` | ~24K, last verified 2026-08-18 | per `/context` run |
| `docs/README.md` | ~6.4K | most doc lookups |
| Root `CLAUDE.md` | 1.7K | every session |
| Memory index | 0.45K | every session |

The repo's own auto-loaded files are about a tenth of the setup around it. The biggest win is
not in the repo.

---

## 2. Phases

### Phase A — Claude Code setup (30 min, no repo risk, ~15–20K tokens saved per session)

Yours to switch off; none of it is in git.

| Action | Detail |
| --- | --- |
| Disable connectors this project never uses | Vercel (~290 tools), Higgsfield (~190), Airtable (~66), Lucid (~38), Render (~50), Google Drive, Claude Docs. Keep Railway, Google Play, Customer.io, Cloudinary, Sentry. Turn Vercel or Higgsfield back on for the session that needs them. |
| Disable plugins per project | `cloudflare`, `render`. Keep `marketing-skills` only if used; it adds ~40 skill descriptions. |
| Move the 33 SEO skills and 17 `seo-*` agents out of the default profile | They load into every session in every project. |
| Lower the default effort and model | `effortLevel: xhigh` on the top model is the largest cost multiplier. Use it for planning, a cheaper default for routine edits. |
| Tighten one permission | `Bash(git reset:*)` is allowed without a prompt, which includes `--hard`. |

### Phase B — Safe deletes (one PR, ~2 h, after 1.2.2 is live)

| Action | Size |
| --- | --- |
| Remove tracked junk: `mobile/app/(tabs)/.index.tsx.swp`, `backend/package.json` + `package-lock.json` (only `gsap`, never imported), `backend/cloudinary-upload-results.json` | 3 files + lockfile |
| Delete 22 orphan mobile components | 2,511 lines |
| Delete 10 orphan web components | 986 lines |
| Delete unreachable routes `mobile/app/feed.tsx`, `mobile/app/duels/index.tsx` | 400 lines |
| Fix dead scripts: root `build:marketing`, `build:all`, `upload:cloudinary*`; frontend `predeploy`, `deploy`; Makefile `frontend-install`, `load-backup` | — |
| Remove `.claude/scripts/` history-rewrite leftovers | 4 files |
| Delete `GROWTH-PHASES.tmp.md` once its open items are in `growth-audit-2026-11.md` | 11.6 KB |
| Delete merged branches: `feat/cio-retention-loop`, `fix/retention-loop`, `fix/exercise-answer-integrity`, `security-latency-audit-2026-08`, `sprint1-platform-hardening`, `sprint2-money-path` (local + origin) | 6 branches |
| Drop unused dependencies: backend `groq`; frontend `react-google-recaptcha`, `react-google-recaptcha-v3`, `gh-pages` | touches the lockfile — your OK needed |

Gate: `pnpm precommit` and `make backend-test` green, then a web build on Vercel.

Orphan lists are in the investigation scratch output; each file gets one last grep for dynamic
imports before it goes.

### Phase C — Docs and context (half a day, ~90K tokens of misread risk removed)

| Action | Size |
| --- | --- |
| Move superseded docs to `docs/archive/` and deny that folder to Claude | ~59K tokens, 15 files |
| Move `docs/content/eeat-drafts-2026-10.md` out of `docs/` (content drafts, not documentation) | ~22K |
| Cut `docs/README.md` to a short index | 6.4K → ~1.5K |
| Re-verify `.claude/context/`: version says 1.1.8, `groq` listed as dead while still pinned, 17 docs unmapped, "1,100 unreachable lines" is now 400 | ~24K, trim to ~15K |
| Slim root `CLAUDE.md`: the docs table and the "do not read" list each exist three times | 1.7K → ~1.1K |
| Close read gaps in `.claude/settings.json` `permissions.deny`: `mobile/store/`, `store-assets/out/`, `mobile/.expo`, `backend/education/content/rewrite_output/`, `exercises_release.json`, locale `common.json`, `brand/logo-mark.svg`, `.cursor/` | prevents 5–50K accidental reads |
| Prune memory: merge the three finished-work records (retention teardown, October audit, release state) into the current ones; fix the release-state file that says 1.1.9 in the body and 1.2.0 in the index | ~12K on demand |

`.claudeignore` has no effect on Claude Code; only `permissions.deny` does. Locale JSON and
`exercises_release.json` stay readable in slices — deny whole-file reads, not the paths.

Archive candidates: `release/1.1.7-runbook`, `promo/60-off-launch-checklist`, `prod/aso-1.1.5`,
`seo/phase-1-critical-fixes`, `seo/phase-2-app-stores-aso`, `seo/phase-2-aso-copy`,
`seo/android-launch-checklist`, `customer-io-overhaul`, `dev/missions-pool-and-randomization`,
`prod/stripe-statement-descriptor`, `prod/stripe-plan-descriptions-and-assets`,
`prod/google-oauth-consent-screen`, `prod/deployment-docker`,
`aso/play-listing-assets-2026-07`, `dev/ios-yearly-trial-sandbox-checklist`.

### Phase D — Deletes that need a check first (half a day)

| Action | Check |
| --- | --- |
| ~38 management commands never referenced (~7.3K lines): one-off seeders and content rewrites | Search Celery beat rows, `call_command`, shell scripts and runbooks. Keep ops commands (`resync_cio_users`, `reconcile_progress`, `backfill_*`). |
| 11 images in `frontend/src/assets` (7.7 MB), referenced only by Cloudinary name | Confirm they are not the upload source |
| `finance.models.Tool`, unused outside migrations | Needs a migration |
| `notifications/interfaces.py`, `support/views_contact.py` | Name-based check only so far |
| Branches `staging`, `tests` | Confirm neither is a deploy target |
| Unused `STRIPE_PRICE_*` settings | Re-verify against the web checkout |

### Phase E — Structural, done only when the file is being touched anyway

Splitting a file for its own sake is risk without a user-visible gain. Split when the growth
work lands in it.

| File | Lines | Split | Touched by |
| --- | --- | --- | --- |
| `backend/education/views.py` | 3,444 | by resource into `views_*.py` + `services/` | lesson-order fix |
| `mobile/src/lesson/LessonFlowScreen.tsx` | 1,516 | completion side effects into a hook | push-prompt fix |
| `mobile/app/subscriptions.tsx` | 2,288 | plan card, paywall, RevenueCat logic into `src/billing` | paywall rework |
| `backend/finance/views.py` | 3,981 | by resource | not planned |
| `frontend/.../ExercisePage.tsx` | 3,131 | one component per exercise type | not planned |

Web/mobile duplication that belongs in `packages/core`, top offenders:
`useDashboardSkillExercisesNavigation`, `heartsPracticeStatus.ts`, `wagerHelpers.ts`,
`StreakWagerCard`, `MissionCard`. Same rule: move when touched.

### Not planned

**Git history rewrite.** `.git` is 235 MB against 21 MB of tracked files (old videos, source
maps, two database dumps in history). It costs clone time only, not session tokens, and needs
`filter-repo` and a force-push. If the old dumps hold real user data, that is a privacy reason
to do it, and a separate decision.

---

## 3. Looks like clutter, must stay

- `backend/core/` — labelled legacy in settings, but holds live middleware, the HTTP client and
  public views.
- Stripe code — web checkout still runs on it; mobile is on RevenueCat.
- Flagged-off features (`GAMIFICATION_RETENTION_V2`, `CIO_TRACK_ENABLED`, `BUDGETING_PROVIDER`)
  and the embedding fallback behind `RAG_HYBRID_ENABLED`.
- Expo packages a grep calls unused (`expo-asset`, `expo-linking`, `expo-system-ui`,
  `expo-dev-client`, `expo-updates`, `react-native-screens`, `react-native-worklets`) — native
  peers.
- `ota/1.2.0-chat-fix` branch (one unmerged commit, the live OTA source).
- `keep-warm.yml`, `railway-db-backup.yml`, `.secrets.baseline`, `.eas/`, the three identical
  icon PNGs, the `query-string-pkg` shim.

---

## 4. Expected result

| | Before | After A–C |
| --- | --- | --- |
| Tokens loaded before the first message | ~22–25K | ~5–8K |
| Docs that can mislead | 15 superseded files in the main tree | archived and denied |
| First-party lines | — | −3.9K (B), up to −11K with D |
| Tracked junk | ~8 MB | ~0 with D |

## 5. Not verified

- The setup token estimate comes from reading the prompt, not a measured count.
- Orphan detection is by filename and identifier; dynamic imports and Celery task names could
  hide uses.
- No linter or test was run for this plan.
