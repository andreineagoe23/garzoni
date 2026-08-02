# Open Banking (AIS) — full-scale plan + go/no-go

Date: 2026-08-02
Scope: connect UK + Romanian bank accounts, ingest transactions, feed the Personal CFO / AI system.
Priority banks: Banca Transilvania (RO), Revolut (UK/EU), Barclays (UK).

---

## 0. Verdict first

**Do not build bank linking now. Postpone to a revenue gate.**

Reasons, in order of weight:

1. **Cost floor is recurring and per-user.** Open banking aggregation is priced per connected
   end-user per month, usually with a monthly minimum. Revenue today is 1 subscription. Every
   linked user is a net loss until ARPU covers the aggregator fee plus the compliance overhead.
2. **You cannot legally call bank APIs yourself.** Reaching Banca Transilvania / Barclays PSD2
   endpoints directly requires an eIDAS QWAC/QSEAL certificate and an FCA (UK) or BNR (RO)
   AISP authorisation. The only realistic route is riding an aggregator's licence — which is
   the paid path, and which requires KYB, a signed DPA, and a security review of your app.
3. **The blocker in the funnel is not missing features.** Per the analytics and UX audits already
   in `docs/analytics/` and `docs/ux/`, the problem is activation and paywall conversion.
   Bank linking is a *high-friction* step (redirect to bank, SCA, consent screen). Adding it to a
   product users already drop out of will not increase conversion; it adds another drop-off point.
4. **Handling real financial data raises your blast radius by an order of magnitude.** Today a
   breach leaks lesson progress. After AIS it leaks account balances, salary, addresses inferred
   from merchants, and gambling/medical spending. That is a GDPR Art. 33/34 notifiable event with
   an ICO/ANSPDCP reporting duty in 72 hours. The security bar below is what "fully secured
   end-to-end" actually costs — it is not a weekend.

**What to do instead now:** the £0 validation path in §8. It gets the AI-on-spending feature and
proves demand without a single regulated integration.

---

## 1. Clarifying "handle cards"

Two very different things get called this:

| Thing | What it means | Regime | Verdict for Garzoni |
|---|---|---|---|
| Read card/account **transactions** | AIS via open banking. You see merchant, amount, date. You never see the PAN. | PSD2 / UK Open Banking. AISP licence (or aggregator's). | This is what you want. |
| **Store or process card numbers** | You accept a PAN, store it, charge it. | PCI DSS. SAQ-D if you touch card data. | **Never.** Billing stays with RevenueCat/Stripe/Apple/Google. |

Design rule to write into the codebase: **no PAN, CVV, or full IBAN ever enters Garzoni storage
or logs.** Account identity is the provider's opaque account id plus a 4-digit mask, which is
already how `budgeting.LinkedAccount` models it (`provider_account_id`, `mask`).

---

## 2. Regulatory reality

### UK (Barclays, Revolut UK, Monzo, Starling, etc.)
- Reading account data = **Account Information Service**, a regulated activity. You need FCA
  registration as an **RAISP** (registered account information service provider, PSD2 Art. 33 —
  no minimum capital, but requires PII insurance, a security policy, a business plan, fit-and-proper
  directors) — **or** you use an aggregator that is the AISP of record and you are its client.
- Consent lifetime: UK dropped the 90-day *SCA re-authentication* for AIS in 2022. TPPs must instead
  **reconfirm consent with the user every 90 days**. Build the reconfirmation flow from day one.
  *(Verify current wording against FCA/OBL guidance before shipping — rules are moving with PSD3/FIDA.)*
- Barclays and Revolut are both mandated CMA9/PSD2 participants; coverage via any major aggregator
  is a given.

### Romania (Banca Transilvania)
- Same directive (PSD2), supervised by **BNR**. BT publishes a PSD2 developer portal with a sandbox,
  but production access requires a TPP certificate + licence — the sandbox being open does **not**
  mean you can go live.
- Romanian bank coverage via aggregators is thinner than UK. Roughly a dozen of the ~160 Romanian
  institutions are reachable via at least one aggregator; BT is covered by the majors (Salt Edge,
  Tink, Yapily, TrueLayer, Enable Banking). **Verify BT and BCR/ING RO coverage per-provider before
  choosing** — this is the single biggest provider-selection input for you.
- Salt Edge is Moldova/Romania-rooted and has the strongest RO coverage historically.

### Cross-cutting (both markets)
- **GDPR**: transaction data is not "special category" per se, but it *reveals* health, religion,
  political donations and sex life through merchant names. Treat as high-risk.
  Required: **DPIA** (Art. 35 — mandatory here), ROPA entry, updated privacy policy, lawful basis =
  explicit consent, retention schedule, data-subject export/erasure that actually deletes
  transactions, and a **processor DPA with every sub-processor** (aggregator, OpenAI, Railway,
  Cloudinary, Sentry, Customer.io).
- **Purpose limitation**: consent for "show me my spending" does **not** cover training or
  marketing segmentation. If Customer.io ever receives a spending-derived attribute, that is a
  separate purpose needing separate consent.

---

## 3. Provider landscape (as of 2026 — re-verify before committing)

| Provider | Free tier | UK | RO / BT | Notes |
|---|---|---|---|---|
| **GoCardless Bank Account Data** (ex-Nordigen) | was the famous free one | — | — | **Closed to new signups / winding down.** Not an option. |
| **Enable Banking** | "Restricted Production" free — real production data, but **only accounts you link yourself** | yes | EU coverage, verify BT | Best free *dev/spike* tier in Europe. Cannot serve arbitrary end users on free. |
| **Salt Edge** | sandbox free | yes | **strongest RO coverage** | Holds its own FCA AISP registration; agency model available. |
| **Yapily** | dev sandbox | yes | EU | Infrastructure-only (no UI), tiered Starter/Growth/Enterprise. |
| **TrueLayer** | sandbox | strong UK | EU | Per-call AIS pricing + monthly minimums on enterprise contracts. |
| **Plaid** | sandbox free | yes | weaker RO | Priced per monthly-active connected user. Already the skeleton in `budgeting/services/providers.py`. |
| **Tink** (Visa) | sandbox | yes | EU | Enterprise sales motion, slow for a solo dev. |

**Nothing is free at production scale for multiple end users.** Free tiers are sandbox or
self-linked-account only. Budget assumption: **per-connected-user-per-month fee plus a monthly
minimum**; get written quotes from Salt Edge, Enable Banking and Yapily rather than trusting
any published figure.

**Recommended shortlist if/when you proceed:**
1. **Enable Banking** — spike and build against it for free using your own BT + Revolut accounts.
2. **Salt Edge** — production candidate, best RO/BT coverage, agency model for the licence.
3. **TrueLayer or Yapily** — UK-heavy fallback if RO gets dropped from v1.

---

## 4. Security architecture — what "fully secured end-to-end" means

This is the non-negotiable list. Each item maps to a concrete change.

### 4.1 Secrets and tokens
- **Application-level envelope encryption for access/refresh tokens.** Today
  `LinkedAccount.encrypted_access_token` is a plain `TextField` with a comment saying encryption is
  "infrastructure-side". That is a naming lie and a real gap: a SQL injection, a leaked read-replica,
  or a `db-backups/` dump exposes live bank tokens. Fix: a custom Django field that encrypts with a
  data key wrapped by a KMS master key (AES-256-GCM, per-row nonce, key id stored alongside for
  rotation). No plaintext token in `dumpdata`, admin, logs, or Sentry.
- Master key lives in the platform secret store, **not** in `.env` committed anywhere. Rotation
  procedure documented; re-wrap job written before launch, not after.
- **Django admin must never render token fields.** Audit `budgeting/admin.py` for this.
- The existing `db-backups/` directory needs a documented encryption + retention policy before any
  bank data lands in it.

### 4.2 Transport and provider auth
- TLS 1.2+ only, HSTS preload (Cloudflare already fronting the domain).
- Aggregator callbacks: **verify webhook signatures** — `BudgetingProvider.verify_webhook_signature`
  currently defaults to `return False`, which is the correct fail-closed default. Any real provider
  subclass must implement it, and the view must reject unsigned payloads with no bypass flag.
- Replay protection: `ProviderWebhookEvent.event_id` is already unique — keep that as the idempotency
  key and reject events older than a short window.
- If you ever go direct-to-bank: mTLS with QWAC, request signing with QSEAL, FAPI 2.0 profile,
  OAuth 2.0 + PAR + PKCE. This is the strongest argument for staying on an aggregator.

### 4.3 Data at rest and in the app
- Separate Postgres schema (or database) for banking tables with its own least-privilege role.
  The web app role should not be able to `SELECT` raw tokens at all — only a narrow sync worker role.
- Retention: raw transactions **24 months max**, then roll into `BudgetPeriodSummary` and delete rows.
  Disconnect = immediate token revocation at the provider + hard delete of transactions within 30 days,
  not a soft `status='disconnected'`.
- **Audit log** on every read of another user's data and every admin access to banking tables. Append-only.
- No transaction description or merchant name in application logs, Sentry breadcrumbs, or exception
  context. Add a Sentry `before_send` scrubber keyed on the banking modules.

### 4.4 Access control
- Every banking endpoint object-scoped to `request.user` with an explicit queryset filter — never
  rely on a URL id. (`budgeting/views.py` needs a line-by-line pass for IDOR before launch; the
  July security audit already found paywall/tamper holes in the education viewsets, so assume the
  same class of bug is present here.)
- Strict rate limits on link/sync/export endpoints; the existing `throttles.py` pattern extends here.
- Step-up auth: re-prompt for password or biometric before linking an account, viewing full
  transaction history, or exporting data. JWT alone is not enough for this surface.
- Mobile: tokens and any cached financial data in **SecureStore/Keychain**, never AsyncStorage
  (this exact bug was already found and fixed for CFO data in the July security audit — do not regress).
- Screenshot/backup exclusion on the accounts screen; jailbreak/root signal at minimum logged.

### 4.5 Operations
- Third-party pen test before public launch. Budget for it — this is the one item you cannot DIY.
- Incident runbook with the 72-hour GDPR notification path pre-written (ICO + ANSPDCP).
- Break-glass admin access is time-boxed, logged, and alerts you.
- Kill switch: a single flag that stops all syncs and revokes tokens.

---

## 5. Threat model (top risks, ranked)

| # | Threat | Impact | Control |
|---|---|---|---|
| 1 | DB dump / backup leak exposes bank tokens | Attacker reads live accounts | §4.1 envelope encryption + backup encryption |
| 2 | IDOR on `/budgeting/transactions/` | Cross-user financial data read | Object-scoped querysets + tests |
| 3 | Forged provider webhook injects transactions | Poisoned AI insights, possible fraud narrative | Signature verify (fail-closed) + idempotency |
| 4 | Transaction text leaks to OpenAI / Sentry / Customer.io | GDPR breach, purpose-limitation violation | §6 + log scrubbing |
| 5 | Account takeover via existing auth weaknesses | Full financial history | Step-up auth; also fix the reCAPTCHA mobile-spoof bypass already logged in the auth audit |
| 6 | Aggregator compromise | Everything, out of your control | Provider due diligence, minimal scopes, short retention |
| 7 | Insider/admin browsing user finances | Trust destruction | Admin field masking + audit log |

---

## 6. Feeding the AI system — the rules

The current CFO narrative (`budgeting/services/dashboard.py`) already does the right thing: it sends
**aggregated numbers**, hashed for caching, not raw transaction rows. Keep that invariant.

- **Never send raw merchant strings or descriptions to OpenAI.** Categorise locally (rules + a small
  local classifier over the merchant string), then send category totals only.
- If per-merchant nuance is ever needed, tokenise: send `MERCHANT_A: -£43.20` with the mapping held
  server-side.
- Enable **zero data retention** on the OpenAI account and record the DPA. Disclose OpenAI as a
  sub-processor in the privacy policy *before* any spending data flows.
- Categorisation quality is the actual product moat here and is doable offline for free — UK/RO
  merchant strings are messy (`SumUp *`, `PayPal *`, `REVOLUT**1234*`), and a decent normaliser is
  worth more than the LLM layer.

---

## 7. Phased plan (only when the revenue gate is passed)

**Gate: ≥ 150 paying subscribers, or ≥ £1,000 MRR.** Below that, the per-user aggregator fee plus
compliance overhead is unrecoverable.

| Phase | Work | Cost |
|---|---|---|
| **P0 — Spike (2 wks)** | Enable Banking free Restricted Production. Link your own BT + Revolut. Implement `EnableBankingProvider` behind the existing `BudgetingProvider` interface. Prove BT actually returns usable transaction data. | £0 |
| **P1 — Security foundation (3 wks)** | Envelope-encrypted token field + KMS + rotation job. Separate schema/role. Webhook signature verification. IDOR test suite. Sentry scrubber. Admin masking. | £0 + time |
| **P2 — Compliance (3 wks, parallel)** | DPIA. ROPA. Privacy policy rewrite. Consent screen + 90-day reconfirmation flow. Deletion/export flows that really delete. Sub-processor list. | £0, or ~£1–2k if you want it reviewed |
| **P3 — Provider contract (4–8 wks lead time)** | KYB + agency-model agreement with Salt Edge (or chosen provider). Their security questionnaire. Written pricing. | Setup + monthly minimum |
| **P4 — Categorisation (2 wks)** | UK/RO merchant normalisation, GBP/RON/EUR handling, transfer/internal detection so budgets aren't garbage. | £0 |
| **P5 — Beta (4 wks)** | 20–50 opt-in users. Pen test. Monitor sync failure rates. | Pen test £3–8k |
| **P6 — GA** | Gradual rollout, kill switch armed. | Per-user recurring |

Realistic total: **~4 months of focused work + low-four-figures cash minimum**, most of it before a
single user benefits.

---

## 8. The £0 path to do *now* instead

Same product promise ("AI that understands your spending"), none of the regulation:

1. **Manual + CSV import.** `Transaction.Source` already has `MANUAL` and `CSV`. Every UK/RO bank
   exports CSV; Revolut's export is clean. Ship an importer and a paste-a-statement flow.
   Zero licence, zero per-user cost, works for BT and Barclays today.
2. **Receipt/statement scan.** `support/views_scan.py` already exists — reuse it to turn a
   screenshot of a banking app into transactions.
3. **Demo mode with synthetic data.** Let free users see the CFO dashboard fully populated with
   realistic fake transactions. This is a *conversion* asset: it shows the value the paid tier gives
   without needing anyone's real bank.

If (1)–(3) get low usage, that is your answer on demand — and it cost nothing to learn.
If they get high usage, you have the demand evidence *and* the categorisation engine already built,
which is most of P4.

---

## 9. Answer to "should we postpone and focus on paying users?"

Yes. Concretely, the next quarter should be:

1. Fix the activation cliff and the paywall-after-first-lesson question (already scoped in
   `docs/analytics/` and `docs/ux/`).
2. Ship the ASO/SEO work already planned — that is the top of the funnel and it is free.
3. Ship the £0 spending path above as a *paid-tier* feature to raise perceived value of the sub.
4. Revisit this document when the gate in §7 is hit.

Bank linking is a feature for a product that already has retained, paying users. It is not a way to
get them.

---

## Sources

- [Free & Indie Open Banking APIs (2026)](https://www.openbankingtracker.com/guides/free-open-banking-apis)
- [Banking Data Aggregation APIs (2026): Compare Plaid, TrueLayer, Tink](https://www.openbankingtracker.com/banking-data-aggregation)
- [Banca Transilvania — API & Developer Portal](https://www.openbankingtracker.com/provider/bancatransilvania-ro)
- [162 Banks in Romania — Open Banking API Directory](https://www.openbankingtracker.com/providers/country/ro)
- [Salt Edge — Romania coverage](https://www.saltedge.com/products/account_information/coverage/ro)
- [GoCardless Bank Account Data docs](https://developer.gocardless.com/bank-account-data/overview)
- [AISP licence / PSD2 Art. 33 registration overview](https://crassula.io/guides/licenses/aisp/)
- [Open Banking AIS / RAISP authorisation](https://www.buckinghamcapitalconsulting.com/open-banking-ais-pisp-raisp)
