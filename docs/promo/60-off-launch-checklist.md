# 60% Off Launch — Manual Checklist

Campaign: **summer60** — 60% off all paid plans, 2026-07-11 → 2026-08-31.
Discount shape: **first year** (yearly plans) / **first 3 months** (monthly plans).

| Plan         | Normal   | Promo                       |
| ------------ | -------- | --------------------------- |
| Plus yearly  | £59.99   | **£23.99** first year       |
| Pro yearly   | £69.99   | **£27.99** first year       |
| Plus monthly | £6.99/mo | **£2.79/mo** first 3 months |
| Pro monthly  | £7.99/mo | **£3.19/mo** first 3 months |

Code + Customer.io are already done (see "Already done" at the bottom). The steps below
are dashboard-only and cannot be automated.

---

## 1. App Store Connect (iOS)

My Apps → garzoni → Monetization → Subscriptions. For each product:

| Product                              | Offer type                            | Setup                    |
| ------------------------------------ | ------------------------------------- | ------------------------ |
| `app.garzoni.mobile.plus_yearly_v3`  | Introductory Offer, **Pay Up Front**  | 1 year at **£23.99**     |
| `app.garzoni.mobile.pro_yearly_v3`   | Introductory Offer, **Pay Up Front**  | 1 year at **£27.99**     |
| `app.garzoni.mobile.plus_monthly_v3` | Introductory Offer, **Pay As You Go** | 3 months at **£2.79**/mo |
| `app.garzoni.mobile.pro_monthly_v3`  | Introductory Offer, **Pay As You Go** | 3 months at **£3.19**/mo |

- Set the offer **end date = 31 Aug 2026** (ASC supports start/end dates on intro offers).
- ⚠️ Apple allows **one intro offer per product per territory** — the yearly products
  currently use theirs for the 7-day free trial. Creating the paid intro offer means the
  trial is paused for the sale window; re-create the trial offer after 31 Aug.
- Optional: Offer Codes → create custom code `GARZONI60` (same discounts) for socials /
  win-back — redeemable in-app via the existing "Redeem code" sheet, and works for
  lapsed subscribers whom intro offers don't cover.

## 2. Google Play Console (Android)

Monetize → Products → Subscriptions. For each base plan, **Add offer**:

| Base plan                                          | Offer phases                                         |
| -------------------------------------------------- | ---------------------------------------------------- |
| `plus-yearly` (product `app.garzoni.mobile.plus`)  | Single payment: 1 year at **£23.99**                 |
| `pro-yearly` (product `app.garzoni.mobile.pro`)    | Single payment: 1 year at **£27.99**                 |
| `plus-monthly` (product `app.garzoni.mobile.plus`) | Discounted recurring: 3 billing periods at **£2.79** |
| `pro-monthly` (product `app.garzoni.mobile.pro`)   | Discounted recurring: 3 billing periods at **£3.19** |

- Eligibility: **New customer acquisition** (auto-applies; RevenueCat picks the offer up
  without app changes).
- Play offers have no end date — **deactivate them manually on 31 Aug**.
- Unlike Apple, Play offers support multiple phases: you may prepend the existing free-trial
  phase to the yearly offers to keep trial + discount together.

## 3. RevenueCat dashboard (Web Billing)

Projects → garzoni → Products (Stripe app `app3de1608d7a`). For each product, add an
**Introductory Offer** (dashboard-only; not exposed via API/MCP):

| RC product   | Stripe id             | Intro offer                          |
| ------------ | --------------------- | ------------------------------------ |
| Plus Yearly  | `prod_Tw8XTqsFe6slAo` | **£23.99**, 1 year, pay upfront      |
| Pro Yearly   | `prod_Tw8XX1mhiswUMR` | **£27.99**, 1 year, pay upfront      |
| Plus Monthly | `prod_UeM1DHb2SyTnH7` | **£2.79**, 3 months, multiple cycles |
| Pro Monthly  | `prod_UeM2zJPn7Cblal` | **£3.19**, 3 months, multiple cycles |

- Eligibility: **first-time purchasers** (or Everyone if you want lapsed users covered).
- Web Billing schedules intro price **after** the existing 7-day trial, so web keeps
  trial + discount.
- ⚠️ Intro pricing can't be edited once saved. If the dashboard refuses to add an intro
  offer to an existing product, create 4 replacement products with intro pricing and ping
  Claude — package re-wiring in RC can be done via MCP.
- No end date on Web Billing intro offers — **remove/replace on 31 Aug**.

## 4. Verify web paywall is on RevenueCat

The web discount only shows in checkout if the site uses the RC Web Billing paywall:
`VITE_REVENUECAT_API_KEY` must be set in the production frontend env (Vercel). If it is
unset, the site falls back to legacy Django/Stripe checkout, which knows nothing about
these offers.

## 5. Ship the code (already written, needs deploy)

- Backend: `PROMO_CAMPAIGN` in `backend/authentication/entitlements.py` — `/plans/` now
  returns promo prices + banner payload inside the date window. Deploy Railway.
- Web: pricing page shows sale banner + strikethrough prices automatically. Deploy.
- Mobile: paywall shows strikethrough + "60% off first year, then £X" whenever the store
  reports a paid intro price — needs an **EAS build + store release** (or it rides the
  next release; store offers still apply at checkout meanwhile, only the badge is missing).

## 6. Send the Customer.io campaign — AFTER steps 1–3 are live

Two **draft** newsletters are ready in Customer.io (EU workspace 215084):

- **#3 "Summer Sale — 60% Off All Plans (Email)"** → segment 6 Valid Email Address (~71 people)
- **#4 "Summer Sale — 60% Off All Plans (Push)"** → segment 8 Have a Mobile Device (~36 devices)

Do **not** send before the store offers exist — the message promises an automatic
discount. Send from the dashboard (Broadcasts) or ask Claude to trigger
`update_type: "send"` once you confirm the offers are live.

## 7. On 31 Aug (teardown)

- ASC: intro offers auto-end (if end date set). Re-create the 7-day trial intro offers on yearly.
- Play: deactivate the 4 offers.
- RC Web Billing: remove intro offers / swap products back.
- Backend: nothing — `PROMO_CAMPAIGN` window self-expires; banner and promo prices disappear.

---

## Already done (2026-07-11)

- Backend promo catalog + `/plans/` payload (`entitlements.py`).
- Web pricing page: banner, strikethrough, promo-duration labels (EN+RO i18n).
- Mobile paywall: strikethrough + discount label driven by store `introPrice` (auto on/off).
- Customer.io: newsletters #3 (email) + #4 (push) drafted with branded template.
- Verified RC state: prices, offerings `plus_subscriptions`/`pro_subscriptions`, 0 active subs.
