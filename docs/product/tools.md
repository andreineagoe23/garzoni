# Tools

> Garzoni's in-app money tools, as the code stands on 2026-10-08. Two separate registries define
> them, one per client, and they do not agree. The web registry has 11 entries
> (`frontend/src/components/tools/toolsRegistry.ts`). The mobile registry has 12
> (`mobile/src/components/tools/mobileToolsRegistry.ts`), because it adds Receipt Scan. Mobile
> also has a CFO coach screen that is reachable but not in its registry. Three things here are
> not what they look like. Open banking is stubbed (`BUDGETING_PROVIDER=disabled`). The mobile
> Economic Calendar shows hardcoded sample events. The web in-app Savings Calculator posts to an
> endpoint that cannot answer it. The public `/calculators/*` pages are separate marketing pages
> and sit outside both registries.

**About "six tools".** `docs/dev/tools-principles.md` says "No new tools outside the six defined
in the tools registry". The code does not support that number. The web registry has 11 ids today
and already had 10 in May 2026 (`git show 0b64ff23:frontend/src/components/tools/toolsRegistry.ts`).
Every registry id is listed below. Treat "six" as a stale rule that needs a decision, not as a
description of the product.

## At a glance

Plan values: "Free" means every plan. "Plus/Pro" means Starter is locked out. "Server" means the
API also refuses Starter, and "client" means only the UI hides it.

| Tool (web id / mobile id)                                              | Web                                    | Mobile                              | Plan                                                      | Status                                            |
| ---------------------------------------------------------------------- | -------------------------------------- | ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| Personal CFO (`personal-cfo`)                                          | ✅                                     | ✅                                  | Plus/Pro (server)                                         | Shipped                                           |
| Personal CFO coach (no registry id)                                    | ⚠️ embedded panel in the CFO dashboard | ✅ modal `tools/personal-cfo-coach` | Plus/Pro (server)                                         | Shipped                                           |
| Budget Planner / "Budget & Spending" (`budget-planner`)                | ✅                                     | ✅                                  | Plus/Pro (server)                                         | Partial: bank linking stubbed                     |
| Statement Import (`statement-import`)                                  | ✅                                     | ✅                                  | Free to analyse. Saving is limited to 1 import on Starter | Shipped                                           |
| Receipt Scan (mobile `receipt-scan`)                                   | ❌                                     | ✅                                  | Pro only (server, 5/day)                                  | Shipped (mobile only)                             |
| Savings calculator (web `savings-calculator` / mobile `savings-goals`) | ⚠️ appears broken (see gaps)           | ✅                                  | Free                                                      | Web broken / mobile shipped                       |
| Portfolio Analyzer (`portfolio`)                                       | ✅                                     | ✅                                  | Plus/Pro (server)                                         | Shipped                                           |
| Goals Reality Check (`reality-check`)                                  | ✅                                     | ✅                                  | Free                                                      | Shipped                                           |
| Economic Calendar (`calendar`)                                         | ✅ TradingView widget                  | ⚠️ hardcoded sample data            | Free                                                      | Web real / mobile fake                            |
| Economic Map (`economic-map`)                                          | ✅ TradingView widget                  | ✅ TradingView widget in a WebView  | Web Plus/Pro (client) · mobile free                       | Shipped                                           |
| News & Market Context (`news-context`)                                 | ✅ TradingView widget                  | ✅ TradingView widget in a WebView  | Web Plus/Pro (client) · mobile free                       | Shipped                                           |
| Market Explorer (`market-explorer`)                                    | ✅ TradingView chart only              | ✅ native quotes + paper trading    | Plus/Pro (client on both)                                 | Shipped, but a different tool on each platform    |
| Next Steps (`next-steps`)                                              | ✅ client-side rules                   | ✅ server-computed queue            | Free                                                      | Shipped, but a different engine on each platform  |
| Public calculators (`/calculators/*`)                                  | ✅                                     | ❌                                  | Public, no login                                          | Shipped (marketing pages, not in either registry) |

Web gating happens in one place. `ToolsPage.tsx:124-126` renders an upsell card instead of the
tool when `requiredPlan === "plus_or_pro"` and the plan is Starter. Mobile gating uses the
`plusOnly` flag on the hub tile (`mobile/app/tools/index.tsx:152`) and checks in each screen.

## Each tool

### Personal CFO (`personal-cfo`), Plus/Pro

- **What it is.** The hub for paid users. Web opens on it by default for Plus/Pro
  (`ToolsPage.tsx:44-45`) and opens Starter users on Next Steps.
- **Clients.** Web: `PersonalCFOHub.tsx` wraps `CFODashboard.tsx`, which embeds `CFOCoachPanel.tsx`.
  Mobile: `mobile/app/tools/personal-cfo/index.tsx`, with the dashboard in
  `mobile/src/components/tools/cfo/CFODashboard.tsx`.
- **API.** `personal-cfo/summary|dashboard|narrative|progress|coach/`. Every endpoint returns 402
  for Starter (`backend/budgeting/views.py:332` onward).
- **What the dashboard shows** (`backend/budgeting/services/dashboard.py`):
  - portfolio block: real holdings only, paper trades excluded
  - goals block
  - spending block
  - 12-month projection
  - net worth
  - a narrative
- **The narrative.** The AI narrative is cached. While it generates, or if it fails, the user
  sees a deterministic fallback text (`resolve_narrative`, `:460`).
- **Weekly email.** A weekly CFO report goes out Monday 09:00 to Plus/Pro users only
  (`budgeting/tasks.py:190`).

### Personal CFO coach, Plus/Pro

- **What it is.** A chat that runs through `OpenAIService` with `source_override="cfo_coach"`
  (`budgeting/views.py:569-574`), so every message uses up the user's **`ai_tutor` daily quota**:
  50/day on Plus, 200/day on Pro.
- **Mobile.** A full-screen modal, opened from the Personal CFO screen
  (`mobile/app/tools/personal-cfo/index.tsx:275`).
- **Web.** No route. The coach is a panel inside the CFO dashboard.

### Budget Planner / "Budget & Spending" (`budget-planner`), Plus/Pro

- **What it does.** Budget envelopes (monthly targets per category), a spending summary per
  period, and spending anomalies.
- **API.** `budgeting/envelopes|spending-summary|anomalies|linked-accounts|provider-status/`.
  All of them return 402 for Starter through `_require_budget_entitlement`
  (`budgeting/views.py:75`).
- **Bank linking is stubbed.** `BUDGETING_PROVIDER` defaults to `disabled`.
  `PlaidProvider.exchange_public_token` raises `NotImplementedError`, and the account and
  transaction fetchers return `[]` (`budgeting/services/providers.py`). The web UI says "Bank
  connections are coming soon". The only real way to get transactions in is Statement Import.
- **Naming.** Web calls this tool "Budget Planner"; the mobile title is "Budget & Spending".

### Statement Import (`statement-import`): free to analyse, paywalled on save

- **Flow.** `budgeting/statements/allowance/` → `preview/` → `commit/` → `insight/`
  (`budgeting/views_statements.py`).
- **Formats.** Detected from file bytes, not the extension (`services/statements.py:239`):
  - CSV/TSV, with delimiters `, ; tab |`
  - `.xlsx`
  - PDF, parsed as a text layout, with rows rebuilt and the statement year inferred
  - OFX/QFX
  - QIF

  Old binary `.xls` is rejected with a "re-save as .xlsx or CSV" message.

- **Encodings tried.** utf-8-sig, utf-8, cp1252, iso-8859-2, latin-1.
- **Bank dialects** (`statements.py:157`):

  | Bank               | Default currency | Notes                                    |
  | ------------------ | ---------------- | ---------------------------------------- |
  | Revolut            | none set         | drops reverted, declined and failed rows |
  | Monzo              | none set         |                                          |
  | Starling           | GBP              |                                          |
  | Barclays           | GBP              |                                          |
  | Banca Transilvania | RON              |                                          |
  | ING Romania        | RON              |                                          |

  Columns are mapped by score, not hardcoded. A file from an unknown bank still parses if it has
  a date, a description and an amount (or a debit/credit pair). The docstring also names BCR, but
  BCR has no dialect entry.

- **Privacy.** The uploaded file is never written to disk. Card numbers (PANs), IBANs and account
  numbers are redacted when the file is parsed.
- **What it computes** (`services/statement_analysis.py:348`). All of this is deterministic and
  makes no LLM call:
  - income, spending and net totals
  - spending by category, with share %
  - top 8 merchants
  - the 8 largest transactions
  - recurring payments: the same merchant at least twice, with amounts within ±15%
  - monthly and daily series, and the spending rhythm
  - the essentials versus discretionary split
  - rule-based insights
- **Categorisation.** Heuristic, in `services/categorization.py` (754 lines). Users cannot
  correct a category or add a merchant rule.
- **Optional AI insight.** `insight/` uses up the `ai_explain` quota (3/day on Starter,
  `views_statements.py:392`). The AI receives only redacted category totals.
- **Limits** (`backend/settings/settings.py:767-776`, `services/statement_import.py:57`):

  | Plan     | Saves                                                                             | Rows  | File size |
  | -------- | --------------------------------------------------------------------------------- | ----- | --------- |
  | Starter  | **1 saved import, ever** (counted from `StatementImport` rows, not reset monthly) | 400   | 3 MB      |
  | Plus/Pro | unlimited                                                                         | 5,000 | 10 MB     |

  Uploads are throttled to 20/hour. All of these values can be overridden through
  `BUDGETING_FREE_STATEMENT_*`, `BUDGETING_MAX_STATEMENT_*` and `STATEMENT_UPLOAD_THROTTLE_RATE`.

- **Dedupe.** Re-importing a statement that overlaps an earlier one does not duplicate
  transactions, because each row is fingerprinted.

### Receipt Scan (mobile `receipt-scan`), Pro only, mobile only

- **Where it lives.** `mobile/app/scan.tsx`, reached from the tools hub through a re-export shim at
  `mobile/app/(tabs)/tools/receipt-scan.tsx`.
- **Input.** Image library only (`launchImageLibraryAsync`, `scan.tsx:166`). There is no camera
  capture.
- **API.** `POST /api/scan/`. It checks `ai_scan` (Pro: 5/day; Starter and Plus: locked), accepts
  images only, max 20 MB (`support/views_scan.py:52-72`), and sends the image to
  `OPENAI_MODEL_ASSISTANT` (code default `gpt-4.1-mini`, `:84`).
- **Output.** Spending categories, a one-line insight, a tip and recommended lessons.
- **Plan gate.** The hub tile deliberately has no `plusOnly` flag, because that flag means
  Plus-or-Pro. The screen does the Pro gating itself.

### Savings calculator (web `savings-calculator` / mobile `savings-goals`), free

- **Mobile** (`mobile/app/tools/savings-goals/index.tsx`). Runs entirely on the device:
  future-value compound interest with a monthly contribution and months-to-goal
  (`mobile/src/types/savings-calculator.ts:20`).
- **Web** (`SavingsGoalCalculator.tsx:73`). Posts goal, initial amount, years, rate and
  compounding frequency to `/calculate-savings-goal/`. That route is `SavingsGoalCalculatorView`,
  which just calls `SavingsAccountView.post` (`backend/finance/views.py:1877`). That view expects
  an `amount` and adds it to the user's _simulated savings account_. The form sends no `amount`,
  so going by the code every submit returns 400 "Amount must be positive". No backend code
  returns the `final_savings` field the web UI reads. I have not reproduced this in a browser.
- **Different id and route per platform.** `mobile/src/navigation/webToolSlug.ts` maps
  `savings-goals` to `savings-calculator` for WebView fallback and push deep links.

### Portfolio Analyzer (`portfolio`), Plus/Pro

- **What it does.** Users record holdings (`/portfolio/`, with `_require_plus` on the server) and
  see their allocation, gain/loss and an AI explanation.
- **Paper trading.** Users can paper-trade against a **$10,000** virtual balance
  (`/paper-trade/buy/`, `finance/views.py:1426`, copy at `PortfolioAnalyzer.tsx:988`).
- **Pricing sources differ by platform.**
  - Web prices stocks and ETFs through `/stock-price/`, which needs `ALPHA_VANTAGE_API_KEY`
    and returns 503 "Price feed unavailable" without it (`finance/views.py:1161-1171`). Crypto
    goes through `/crypto-price/` (CoinGecko).
  - Mobile uses `/market/quotes/` (Yahoo, with a Stooq fallback, and CoinGecko).
- **Currency.** Everything here is in USD. See [Currency](#currency).

### Goals Reality Check (`reality-check`), free

- **Inputs.** A goal amount, a number of months, the amount already saved, and income and
  expense ranges (low and high).
- **Outputs.**
  - the monthly saving required
  - surplus in a bad month and in a good month
  - best, expected and worst months to reach the goal
  - warnings
  - a projection chart, capped at 60 months
- **Where it runs.** Both platforms compute this on the client:
  `mobile/src/types/reality-check.ts:27` and an inline copy in `GoalsRealityCheck.tsx`. The maths
  is duplicated, not shared through `packages/core`. Web adds an optional "explain my plan" call
  to the AI tutor.

### Economic Calendar (`calendar`), free

- **Web.** The TradingView events widget (`EconomicCalendar.tsx:74`). This is real data.
- **Mobile.** Calls `GET /api/economic-calendar/`, which returns **10 hardcoded sample events**
  (US CPI, FOMC, BoE rate, …) re-dated around `date.today()`, with fixed forecast values
  (`backend/finance/mobile_tools_api.py:14-44`, whose docstring says "for dev"). Mobile users see
  made-up figures.

### Economic Map (`economic-map`) and News & Market Context (`news-context`)

- **Implementation.** Both are TradingView widgets on both platforms: `tv-economic-map.js` and
  the `embed-widget-timeline.js` news timeline. Web injects the scripts into the page; mobile
  wraps the same HTML in a WebView (`mobile/app/tools/economic-map.tsx`, `news-context.tsx`).
- **Plan.** On web they are `requiredPlan: "plus_or_pro"`, which only the client enforces. On
  mobile they are **free** (no `plusOnly` flag).
- **Unused backend endpoint.** `/api/news/` (RSS from MarketWatch, Guardian, BBC, NPR and WSJ,
  `finance/views.py:139-160`) is public (`AllowAny`), but no web or mobile code calls it.

### Market Explorer (`market-explorer`), Plus/Pro

- **Web.** One TradingView advanced-chart widget (`MarketExplorer.tsx`, 114 lines). Nothing else.
- **Mobile.** A native screen (`mobile/app/tools/market-explorer/index.tsx`) with:
  - symbol search through `/market/search/` (Yahoo search plus CoinGecko search)
  - batched quotes through `/market/quotes/`
  - a quote sheet
  - paper-trade buy into the portfolio
- **Plan.** Gated on the client on both platforms. The market endpoints themselves only require
  login.

### Next Steps (`next-steps`), free

- **Web** (`NextStepsEngine.tsx`). Rules on the client that read `sessionStorage` signals from
  other tools (portfolio risk, news browsing) and the financial profile. It suggests 1 to 3
  tool or lesson links and gives no reward.
- **Mobile.** Calls `GET /api/next-steps/` (`finance/services/next_steps.py`). The server builds
  a queue of up to 5 steps from live state:
  - over-budget anomalies
  - due review items
  - course-to-tool bridges
  - missing envelope or goal setup

  The daily limit is 3 completions, and completing a step grants XP through the idempotent
  reward ledger. This is a different feature from the web version under the same name.

## Public calculators (website)

These are SEO landing pages, not in-app tools. They sit outside both registries, and
`docs/dev/tools-principles.md` approves this exception (2026-10-08).

| Route                                      | Page                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| `/calculators/compound-interest` + `/ro/…` | `frontend/src/components/calculators/CompoundInterestPage.tsx` |
| `/calculators/savings-goal` + `/ro/…`      | `SavingsGoalPage.tsx`                                          |
| `/calculators/50-30-20-budget` + `/ro/…`   | `BudgetRulePage.tsx`                                           |

- **Routes.** `frontend/src/routes/AppRoutes.tsx:78-97`. The pages need no login.
- **Maths.** All client-side. The compound maths is shared with the landing demo
  (`landing/home/compound.ts`).
- **Currency.** English pages use GBP (`en-GB`); `/ro` pages use RON (`ro-RO`)
  (`CalculatorParts.tsx:28-29`).
- **Next action.** Each page ends in a signup CTA plus store badges.
- **Web only.** Mobile has no equivalent.
- **Status docs are behind.** `.claude/context/feature-status.md` lists only the compound-interest
  page.

## Under the hood

- **Registries are not shared.** `frontend/src/components/tools/toolsRegistry.ts` (11) and
  `mobile/src/components/tools/mobileToolsRegistry.ts` (12) are hand-maintained copies. Neither
  lives in `packages/core`. Mobile tile titles are hardcoded English in the registry, with
  translations added on top through `mobile/src/components/tools/toolI18n.ts`.
- **Mobile routing.** Each tool has a native screen under `mobile/app/tools/<id>/`, re-exported
  from `mobile/app/(tabs)/tools/*.tsx`. Unknown slugs fall through to `mobile/app/tools/[tool].tsx`,
  which opens `${EXPO_PUBLIC_WEB_APP_URL}/tools/<slug>` in a WebView, mapped through
  `webToolSlug.ts`.
- **Server-side plan checks.** Use `get_user_plan` + `plan_allows(plan, "plus")` and answer 402
  with `reason: "upgrade"`. Server-gated features: Personal CFO, budgeting, portfolio, and statement
  saves beyond the allowance. Receipt scan uses `check_and_consume_entitlement(user, "ai_scan")`.
- **Market data providers.** All keyless except where noted:

  | Provider                                                                                    | Used for                                                                             | Where                      |
  | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------- |
  | Yahoo Finance                                                                               | quotes and search. Unofficial: a scraped crumb/cookie session, v7 quote and v8 chart | `finance/views.py:329-720` |
  | Stooq                                                                                       | CSV fallback for quotes                                                              | `:395-475`                 |
  | CoinGecko                                                                                   | crypto prices and search                                                             | `:736`, `:1353`, `:1531`   |
  | Alpha Vantage (needs `ALPHA_VANTAGE_API_KEY`)                                               | `/stock-price/` for web Portfolio and the web Chatbot                                | `:1161`                    |
  | FreeCurrencyAPI / ExchangeRate-API (need `FREE_CURRENCY_API_KEY` / `EXCHANGE_RATE_API_KEY`) | `/forex-rate/`, called only by the web Chatbot                                       | `:1276`, `:1298`           |
  | TradingView embed widgets                                                                   | Economic Calendar (web), Economic Map, News, Market Explorer (web)                   | client-side, no key        |
  | RSS (MarketWatch, Guardian, BBC, NPR, WSJ)                                                  | `/api/news/`, no client caller                                                       | `:139-160`                 |

  Quote cache TTLs come from `MARKET_YAHOO_QUOTE_CACHE_TTL` and `MARKET_CRYPTO_QUOTE_CACHE_TTL`
  (90s default). None of these feeds has a contract or SLA.

- **AI usage inside tools.** All of it goes through OpenAI, and every call has an explicit timeout:
  - statement insight: `ai_explain` quota
  - CFO coach: `ai_tutor` quota
  - CFO narrative: cached
  - receipt scan: `ai_scan` quota
  - reality-check and portfolio "explain": AI tutor service

### Currency

- **Default is GBP.** `packages/core/src/utils/currency.ts:4` (`DEFAULT_CURRENCY = "GBP"`) and
  `backend/budgeting/models.py:24`. Romanian statements carry RON from their dialect, and `LEI`
  is normalised to `RON`.
- **Market quotes are USD** (`MARKET_QUOTE_CURRENCY = "USD"`, `currency.ts:7`). Yahoo and
  CoinGecko are queried in USD.
- **USD leftovers in the UI.**
  - The mobile portfolio form label reads **"Purchase Price (USD)"**
    (`mobile/src/components/tools/portfolio/AddEntrySheet.tsx:684`).
  - The paper-trading copy says "$10,000 virtual cash".
  - The mobile Economic Calendar sample rows are mostly USD events.
- **No FX conversion anywhere.** The CFO dashboard adds the portfolio value, which comes from USD
  quotes and USD purchase prices, to a net worth reported in the spending currency (GBP by default)
  (`budgeting/services/dashboard.py:523-524`).

## Known gaps and flags

1. **Open banking is stubbed.** `BUDGETING_PROVIDER=disabled`, the Plaid provider is a skeleton,
   and the 6-hourly sync runs and does nothing. The Pro plan's description text still promises
   "bank links" (`backend/authentication/entitlements.py`, Pro `personal_cfo` and
   `budget_tracking`).
2. **The mobile Economic Calendar is fake data.** `finance/mobile_tools_api.py` returns
   hardcoded events.
3. **The web in-app Savings Calculator appears broken.** It posts to an endpoint that adds money
   to the simulated savings account. See the tool section above.
4. **Same id, different tool.** Market Explorer (one chart vs a quote browser with trading) and
   Next Steps (client rules vs a server queue with XP) behave differently on each platform.
5. **Plan mismatches between platforms.** Economic Map and News are Plus/Pro on web and free on
   mobile. In both cases the gate is only in the client, around a free third-party widget.
6. **Ids drift.** `savings-calculator` vs `savings-goals`. The registries are duplicated rather
   than shared, which is how the drift happened.
7. **Receipt Scan is mobile-only and Pro-only.** It has no camera capture, and it needs an EAS
   build that includes the tools-hub entry.
8. **Web Portfolio stock prices depend on `ALPHA_VANTAGE_API_KEY`**, while mobile uses keyless
   Yahoo. `.claude/context/integrations-and-env.md` wrongly lists Alpha Vantage, FreeCurrency and
   ExchangeRate as "dead config". Code calls all three (`finance/views.py:1161`, `:1276`, `:1298`).
9. **USD/GBP mixing in net worth.** There is no FX conversion.
10. **The statement allowance is lifetime.** Starter gets 1 saved import ever, not per month.
    There are no category overrides, no multi-statement trends and no export.
11. **The "six tools" rule** in `docs/dev/tools-principles.md` does not match either registry.
