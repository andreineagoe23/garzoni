# Plans and billing

> Garzoni has three plans: Starter (free), Plus and Pro, priced in GBP. RevenueCat is the purchase
> channel on every platform: RevenueCat Web Billing (backed by Stripe) on web, and App Store /
> Google Play in-app purchase on mobile. A legacy direct-Stripe checkout still exists and takes
> over silently on web when `VITE_REVENUECAT_API_KEY` is unset.
>
> The backend decides what a user gets, using `UserProfile` billing fields that webhooks write.
> Display prices in code are £6.99/£59.99 for Plus and £7.99/£69.99 for Pro (monthly/yearly), with
> a 7-day trial on yearly plans only. The amounts users are actually charged live in the
> RevenueCat, App Store Connect and Play Console dashboards. Nothing in code checks that the two
> match.

## Plans and prices

The catalog lives in `PLAN_CATALOG`, `backend/authentication/entitlements.py:247-310`, and is
served at `GET /api/plans/` (`authentication/urls.py:78`, `views_entitlements.py:98`):

| Plan    | Monthly | Yearly | Trial               | Currency |
| ------- | ------- | ------ | ------------------- | -------- |
| Starter | £0      | —      | —                   | GBP      |
| Plus    | £6.99   | £59.99 | 7 days, yearly only | GBP      |
| Pro     | £7.99   | £69.99 | 7 days, yearly only | GBP      |

**Where each displayed price comes from:**

| Surface                                                              | Price source                                                                                                                                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web plan cards (`SubscriptionPlansPage.tsx:260`) and landing pricing | `/api/plans/`, i.e. the code values above                                                                                                                                               |
| Web RevenueCat paywall                                               | RevenueCat Web Billing products, one Stripe product per plan and period (`backend/authentication/revenuecat_products.py`, the `prod_*` ids)                                             |
| Mobile paywall (`mobile/app/subscriptions.tsx:413-422`)              | The **store** `priceString`. For yearly, the card shows the store's annual price ÷ 12 as "/ month, billed annually". Free trials and paid intro offers come from the store `introPrice` |

The real charged amounts exist **only in the dashboards**, so they cannot be checked from this
repo. The comment at `entitlements.py:246` and `docs/prod/subscription-matrix.md` say the
dashboards must match the code values by hand.

**Active promotion: `newyear2026`.** It runs 2026-09-01 to 2026-12-31 (`entitlements.py:323-341`):

| Plan         | Offer                        | Discount |
| ------------ | ---------------------------- | -------- |
| Plus yearly  | £29.99 first year            | 50% off  |
| Pro yearly   | £34.99 first year            | 50% off  |
| Plus monthly | £4.19 for the first 3 months | 40% off  |
| Pro monthly  | £4.79 for the first 3 months | 40% off  |

The promotion is **display-only**. `/api/plans/` returns `promo_price_amount` and the cards show
it. The discount at checkout only happens if a matching offer exists in App Store Connect, Play
Console and RC Web Billing. The code comment warns that `summer60` once shipped monthly promo
prices with no store offer behind them.

**Trials.**

- **RevenueCat (web and mobile).** The 7-day trial is an introductory offer set up in each store
  and in RC Web Billing. When a webhook or sync reports a trial `period_type`, the backend records
  `subscription_status=trialing` and sets `trial_end`
  (`authentication/services/revenuecat_billing.py:80-105`).
- **Legacy Stripe checkout.** Sets `trial_period_days=7` on yearly Plus/Pro
  (`finance/views.py:2787`).
  - It does not check whether the user has subscribed before, so a returning subscriber gets
    the yearly trial again. Only the expired monthly offer had that check.
  - A 30-day "free first month" monthly offer ran 2026-06-19 → 2026-08-31 and has expired by
    date (`:2776`).
- **Reminder.** A trial-ending email goes out 2 days before `trial_end`
  (`authentication/tasks.py:211-216`).

## What each plan unlocks

Sources:

- the features table is `PLAN_MATRIX`, `backend/authentication/entitlements.py:48-243`
- daily quotas are counted per user per **UTC** day in the cache
  (`entitlement:<feature>:<user>:<date>`)
- the other rows are cited in their own Source column

| Feature (key)                                                                       | Starter | Plus      | Pro       |
| ----------------------------------------------------------------------------------- | ------- | --------- | --------- |
| Lesson/quiz hints (`hints`)                                                         | 2/day   | unlimited | unlimited |
| Streak repair (`streak_repair`)                                                     | locked  | 1/day     | 1/day     |
| Certificate/share downloads (`downloads`)                                           | 1/day   | unlimited | unlimited |
| Analytics & insights (`analytics`)                                                  | locked  | ✔         | ✔         |
| AI tutor chat (`ai_tutor`), **also used by the Personal CFO coach**                 | 5/day   | 50/day    | 200/day   |
| AI "explain wrong answer" (`ai_explain`), **also used by the statement AI insight** | 3/day   | unlimited | unlimited |
| Personalized Path 2.0 (`personalized_path`)                                         | locked  | ✔         | ✔         |
| Weekly AI Coach Brief (`ai_coach_brief`)                                            | locked  | ✔         | ✔         |
| Voice tutor (`ai_voice`), mobile only                                               | locked  | locked    | ✔         |
| Receipt scan (`ai_scan`), mobile only                                               | locked  | locked    | 5/day     |
| Personal CFO hub + coach (`personal_cfo`)                                           | locked  | ✔         | ✔         |
| Budget envelopes/spending (`budget_tracking`)                                       | locked  | ✔         | ✔         |

The next table covers gating that sits outside `PLAN_MATRIX`:

| Gate                                                         | Starter                                                | Plus                                                         | Pro                          | Source                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------- |
| Learning paths                                               | Basic Finance only                                     | + Personal Finance, Everyday Money Skills, Financial Mindset | + Crypto, Forex, Real Estate | `Path.access_tier` column; title-based fallback in `education/utils.py:53-86` |
| Instant heart refills                                        | 3/day                                                  | unlimited (throttle only)                                    | unlimited                    | `authentication/views_hearts.py:25-35` (`HEARTS_FREE_REFILL_DAILY_CAP`)       |
| Statement import saves                                       | 1 total, 400 rows, 3 MB                                | unlimited, 5,000 rows, 10 MB                                 | same as Plus                 | `budgeting/services/statement_import.py:57`, `settings.py:767-776`            |
| Portfolio Analyzer, Market Explorer                          | locked                                                 | ✔                                                            | ✔                            | see `docs/dev/tools.md`                                                       |
| Weekly CFO report email                                      | —                                                      | ✔                                                            | ✔                            | `budgeting/tasks.py:190`                                                      |
| OpenAI daily token budget (a hard cap behind every AI quota) | 50k tokens                                             | 500k                                                         | 500k                         | `OPENAI_DAILY_TOKEN_BUDGET_FREE/_PREMIUM`, `support/services/openai.py:76-80` |
| AI model                                                     | `OPENAI_MODEL_ASSISTANT` (code default `gpt-4.1-mini`) | same                                                         | same                         | `settings.py:501`. No plan picks a different model                            |

When a server gate refuses, it returns **402** with `reason: "upgrade"` (locked) or
`reason: "limit"` (quota used up) from `check_and_consume_entitlement` (`entitlements.py:542-591`).
The budgeting and CFO endpoints return 402 with a `feature` key. Clients read
`GET /api/entitlements/`, served by `authentication.EntitlementsView`, which wins the URL match
over the `finance` copy.

**What makes a user paid.** `get_plan_from_profile` (`entitlements.py:388`) grants Plus/Pro only
when `has_paid` or `is_premium` is true. A verified webhook or reconcile sets those flags.
`subscription_plan_id` on its own never unlocks anything.

## How purchasing works

### Web, primary path: RevenueCat Web Billing (when `VITE_REVENUECAT_API_KEY` is set)

1. `/subscriptions` (`frontend/src/components/billing/SubscriptionPlansPage.tsx`) lists the
   `/api/plans/` cards. `/pricing` redirects there, and `/upgrade` and `/payment-required` show
   `UpgradePage`.
2. Choosing a paid plan requires three things: the user is logged in, has finished the onboarding
   questionnaire, and has a **numeric Django user id**. Without that id the page sends the user
   back to log in rather than bind the purchase to a placeholder id (`:305-313`).
3. `RevenueCatPaywall.tsx` opens the RC offering: `plus_subscriptions` or `pro_subscriptions`,
   with packages `$rc_monthly` and `$rc_annual` (`frontend/src/services/revenueCatService.ts:29-33`).
4. On success the client calls `POST /api/revenuecat-sync/`. The RC webhook also arrives
   separately. After that, `GET /api/entitlements/` reports the new plan.

### Web, fallback path: legacy Stripe Checkout (when `VITE_REVENUECAT_API_KEY` is unset)

1. The same page posts to `/api/subscriptions/create/` (`SubscriptionPlansPage.tsx:321-344`,
   `finance/views.py:2679`), which creates a Stripe Checkout session.
2. That session uses the `STRIPE_PRICE_{PLUS,PRO}_{MONTHLY,YEARLY}` price ids, applies the trial
   rules above, and accepts promotion and referral codes (`STRIPE_DEFAULT_PROMOTION_CODE`,
   referral promos).
3. The user returns to `/payment-success`, and the purchase activates through
   `/api/stripe-webhook/`.

The fallback raises **no error**. Web simply takes a different code path. Existing direct-Stripe
subscribers keep working either way.

### iOS and Android: App Store / Google Play in-app purchase through RevenueCat

- **Paywall.** `mobile/app/subscriptions.tsx` (2,288 lines) uses `react-native-purchases`. It
  shows store packages, buys with `Purchases.purchasePackage` (`:1100`), then runs
  `syncRevenueCatSubscription`, which calls `POST /api/revenuecat-sync/`
  (`mobile/src/billing/subscriptionRuntime.ts:495`).
- **Product ids.**

  | Store              | Product ids                                                 |
  | ------------------ | ----------------------------------------------------------- |
  | App Store, current | `app.garzoni.mobile.{plus,pro}_{monthly,yearly}_v3`         |
  | App Store, older   | v2 (sandbox) and v1 (legacy)                                |
  | Google Play        | `app.garzoni.mobile.{plus,pro}:{plus,pro}-{monthly,yearly}` |

  All of them are mapped in `PRODUCT_PLAN_MAP` (`backend/authentication/revenuecat_products.py`).

- **Identity.** The RevenueCat app user id is the Django user's primary key
  (`configureRevenueCatForUser` + `identifyRevenueCatUser`).
- **Sync on launch.** `syncEntitlementOnLaunch` (`subscriptionRuntime.ts:457`) compares RC's
  active plan with the backend and calls sync when the backend is behind.
- **Restore.** `Purchases.restorePurchases()` (`subscriptions.tsx:1246`).
- **Upsells.** `mobile/src/components/tools/PlusBottomSheet.tsx` on locked tool tiles, plus the
  in-screen Pro gates on voice and scan.

### Cross-platform sync

- **Shared customer.** Every client configures RevenueCat with the numeric Django user id, so a
  purchase made on one platform is the same RevenueCat customer everywhere.
- **Non-numeric ids are dropped.** The webhook ignores any `app_user_id` that is not all digits
  (`views_revenuecat.py:104-110`). A purchase bound to an anonymous id charges the card and never
  unlocks anything.
- **Backend is the source of truth.** Web and mobile both read `GET /api/entitlements/`.
- **Manual drift repair.** `POST /api/subscriptions/sync/` runs the reconciliation against both
  Stripe and RevenueCat (`finance/views.py:3106`).

### Managing and cancelling

| Channel            | Manage / cancel                                                                                                                                                                                                   | Code                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Web, RevenueCat    | RC Customer Center embedded in `/billing`                                                                                                                                                                         | `SubscriptionManager.tsx:564`, `RevenueCatCustomerCenter.tsx` |
| Web, legacy Stripe | `/api/subscriptions/cancel/` sets `cancel_at_period_end` (`finance/views.py:3218`); `/api/subscriptions/portal/` opens the Stripe billing portal (`:3147`); `/api/subscriptions/change/` switches plans (`:2950`) | `SubscriptionManager.tsx:273,294`                             |
| iOS / Android      | Opens `apps.apple.com/account/subscriptions` or `play.google.com/store/account/subscriptions`                                                                                                                     | `mobile/app/subscriptions.tsx:1276-1280`                      |

Mobile has no separate manage screen. Restore and the store link are part of the paywall screen.

### Refunds

**The code does not handle refunds.**

- The Stripe webhook handles none of `charge.refunded`, `charge.dispute.*` or refund events.
- The RevenueCat webhook has no `REFUND` branch. RevenueCat reports refunds as `CANCELLATION`,
  which the code treats as an immediate downgrade (see gap 1).
- Store refunds are issued by Apple and Google; the operator cannot override them. Web refunds go
  through the Stripe dashboard.

## Under the hood

- **Webhooks.**
  - **`/api/revenuecat-webhook/`** (`authentication/views_revenuecat.py`)
    - Auth: Bearer token compared to `REVENUECAT_WEBHOOK_SECRET` in constant time. If the secret
      is unset in production, every request is rejected.
    - Events that grant the plan: `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`,
      `SUBSCRIBER_ALIAS`.
    - Events that set `starter` / `cancelled`: `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`.
    - Every other event type is ignored.
    - Which plan to grant is worked out from the product id or the entitlement
      (`ENTITLEMENT_PLAN_MAP`: `Garzoni Plus`/`Pro`, plus `Garzoni Educational *` aliases).
  - **`/api/stripe-webhook/`** (`finance/views.py:1966`)
    - Auth: Stripe signature, checked with `STRIPE_WEBHOOK_SECRET`.
    - Events handled: `checkout.session.completed`, `.expired`, `.async_payment_failed`;
      `customer.subscription.created`, `.updated`, `.deleted`; `invoice.payment_succeeded`,
      `.payment_failed`.
    - Duplicate events are dropped by an insert inside a savepoint. 13 contract tests cover it.
- **Shared writer.** Both webhooks write through `apply_subscription_to_profile`
  (`authentication/services/subscriptions.py`).
- **Boot-time validation.** The backend fails at startup with `ImproperlyConfigured` if the
  Stripe price-to-plan mapping is wrong or missing. `validate_rc_plan_mappings` checks the RC maps.
- **Env var names.**

  | Where   | Variables                                                                                                                                                                                                                                                                             |
  | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Backend | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{PLUS,PRO}_{MONTHLY,YEARLY}` (`_ANNUAL` accepted as an alias), `STRIPE_REFERRAL_COUPON_ID`, `STRIPE_DEFAULT_PROMOTION_CODE`, `REVENUECAT_API_KEY` (REST reconcile), `REVENUECAT_WEBHOOK_SECRET` |
  | Web     | `VITE_REVENUECAT_API_KEY`                                                                                                                                                                                                                                                             |
  | Mobile  | `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_REVENUECAT_PAYWALL_PLACEMENT`                                                                                                                                                                    |

- **Paywall placement experiment.** `UX_PAYWALL_PLACEMENT` takes `onboarding` (the default) or
  `post_first_lesson` (`settings.py:210-212`).
- **Lifecycle emails (Celery beat).**
  - Trial ending: 2 days before `trial_end`.
  - Renewal reminder: `send-renewal-reminder`, registered by migration
    `authentication/0020_beat_periodic_send_renewal_reminder`.
  - Customer.io events: `trial_ending_soon`, `subscription_cancelled`.
- **Admin.** The `/pricing-dashboard` and `/analytics` funnel views on web are for staff only.

## Known gaps and flags

1. **Cancelling auto-renew removes access immediately.** RevenueCat sends `CANCELLATION` when a
   user turns off auto-renew, while the entitlement stays active until `EXPIRATION`. The webhook
   treats `CANCELLATION` (and `BILLING_ISSUE`, with no grace period) as an immediate downgrade to
   Starter (`views_revenuecat.py:40,145-154`).
   - Mobile repairs this at the next app launch via `syncEntitlementOnLaunch`.
   - Web has no launch-time sync, so a web or RC-Billing user who cancels loses paid features
     straight away until they reopen the mobile app or something calls `/subscriptions/sync/`.
2. **The reconcile task is never scheduled.** `docs/prod/billing-parity-runbook.md` calls
   `reconcile_subscription_profiles` a "scheduled repair task" (`authentication/tasks.py:489`).
   Nothing schedules it: no beat entry, no `PeriodicTask` migration. Its query also skips profiles
   already marked `cancelled`, so it could not undo gap 1 even if it ran.
3. **Some RevenueCat events are ignored.** `PRODUCT_CHANGE` (Plus↔Pro) and `TRANSFER` are dropped,
   so upgrades depend on the client-side sync after the purchase.
4. **No refund handling** on either webhook.
5. **The promotion is display-only.** `newyear2026` prices show on web cards whether or not the
   store or RC offer exists. Mobile shows whatever intro offer the store returns.
6. **Prices are unverifiable from the repo.** Charged amounts live in the RC, App Store Connect and
   Play dashboards. `docs/prod/subscription-matrix.md` is correct about the list prices.
7. **The billing path on web depends on an env var.** Unset `VITE_REVENUECAT_API_KEY` means legacy
   Stripe Checkout with no error.
8. **Plan copy promises unbuilt features.**
   - The Pro description says "priority insights and bank links" and "spending tracking with
     bank linking" (`entitlements.py`, Pro `personal_cfo` and `budget_tracking`). Open banking is
     stubbed (`BUDGETING_PROVIDER=disabled`).
   - "AI push nudges" tiers appear in `README.md` and the subscription matrix, but the nudge beat
     job was deliberately removed.
9. **Docs disagree with code.**
   - `README.md:89` says Pro gets **gpt-4o** and Starter/Plus get gpt-4o-mini. Code uses one
     model, `OPENAI_MODEL_ASSISTANT`, for every plan (default `gpt-4.1-mini`).
   - `docs/prod/subscription-matrix.md` says receipt scan uses "GPT-4o vision". It uses the same
     assistant model.
   - The subscription matrix lists a "Daily learning limit: 3 core actions/day" (`daily_limits`).
     That key does not exist in `PLAN_MATRIX`. Free-tier scarcity actually comes from hearts and
     path tiers.
   - The matrix says quota refusals use `reason="quota"`. The code returns `reason="limit"`.
   - `.claude/context/feature-status.md` still describes `summer60` as the active promo.
10. **Mobile has no manage-subscription screen**, unlike web `/billing`. Mobile uses store links
    and restore inside the paywall.
