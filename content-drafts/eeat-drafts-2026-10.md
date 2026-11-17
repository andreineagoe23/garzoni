# E-E-A-T drafts: sources, fact-check, guide expansions, author page (growth plan C4)

**Status:** drafts for owner review, 2026-10-08. No database rows, lesson content or code were
changed. Everything below is a proposal. Applying it means admin edits or seed-command runs,
which are owner actions.

**Inputs:** the live read-only API, `/api/public/lessons/` (43 lessons) and
`/api/public/articles/` (20 guides), fetched 2026-10-08, plus their `?lang=ro` variants for the
UK-specific lessons. Every external URL below loaded (HTTP 200, by `curl` or WebFetch) on
2026-10-08, and the page title I saw is recorded in the appendix. Where a figure is quoted, I read
it on that page. URLs that would not load (MoneyHelper, MaPS, IFS, consumerfinance.gov, FGDB,
ANPC, MoneySavingExpert and Science/Wiley/SAGE all sit behind bot challenges) are **not**
included, even where they would be the better source. See "Sources I could not verify" at the end.

---

## Summary

- **43 / 43 public lessons covered.** Each lesson gets 2–3 verified sources, mapped to the lesson
  section where they belong, plus a Romanian authority where one fits (9 lessons).
- **100 distinct verified URLs** (appendix): 95 proposed as sources, 5 kept as evidence for the mismatches.
- **4 guides expanded:** the four shortest by body word count. Before → after (body text only,
  FAQ excluded):

  | Guide | Before | After (draft) |
  | --- | --- | --- |
  | `how-credit-scores-work-uk` | 164 | 992 |
  | `how-to-pay-off-debt` | 164 | 924 |
  | `investing-basics-for-beginners` | 166 | 944 |
  | `garzoni-vs-acorns` | 170 | 927 |

- **Existing lesson sources need replacing.** Today 11 lessons carry 33 section sources (3 each).
  Every one points to a **US** body (CFPB, CFTC, FTC). Meanwhile `/editorial-standards` says the
  site is "moving every lesson to official UK sources", and `/about` says lessons "cite official
  sources such as MoneyHelper, the FCA, HMRC and the Bank of England". Two are off-topic: `tracking-income-and-expenses` cites a CFPB
  *credit reports* page, and `how-compound-interest-works` cites a *budget worksheet*. One is
  mislabelled: "CFPB: Budget worksheet" points to consumer.gov, which is an **FTC** site (its
  footer links FTC.gov). consumerfinance.gov returned 403 to every fetch, so I could not confirm
  that those links still resolve.

### Factual mismatches, highest impact first

| # | Lesson / guide | What it says | What the source says (2026/27) | Source |
| --- | --- | --- | --- | --- |
| 1 | `where-to-keep-your-emergency-fund` (EN **and** RO) | FSCS "covers up to £85,000 per institution" | **£120,000** per person per firm since **1 Dec 2025** | FSCS; BoE FSCS explainer; PRA PS24/25 |
| 2 | `how-to-read-your-payslip` | £2,000 gross → £200 income tax, **£120 NI**, £100 pension | NI is **8%** on £1,048–£4,189 a month, so ≈ **£76**. Income tax with 1257L ≈ £190 (≈ £170 if the £100 pension is a net-pay deduction). At the pre-2024 12% rate it would be ≈ £114, so £120 looks like an old-rate figure | GOV.UK NI rates; employer rates 2026–27 |
| 3 | `buy-now-pay-later-the-hidden-costs` | Treats BNPL as unregulated ("increasingly, the effect on your credit record") | The FCA has regulated BNPL ("Deferred Payment Credit") since **15 July 2026**. Lenders must check affordability, and complaints can go to the Financial Ombudsman. The lesson was last updated 2026-06-27, before the change | FCA BNPL page |
| 4 | `maximizing-rental-returns` | "Consider a modest increase at the next lease renewal or tenant change" | In England, since **1 May 2026** (Renters' Rights Act) rent can go up **once a year**, only via the section 13 process, with **Form 4A** and at least 2 months' notice, and never in the first year. Rent review clauses no longer apply | GOV.UK RRA overview; assured periodic tenancies: rent increases |
| 5 | `calculating-rental-income` | Use "the Valuation Office Agency" for achieved rents (said 3 times) | The VOA no longer publishes these. GOV.UK says the release moved to the ONS, and the ONS summary-statistics dataset is itself marked "Next release: Discontinued". Current figures come from the ONS *Private rent and house prices, UK* (average UK rent **£1,400**, 12 months to Aug 2026) | GOV.UK VOA collection; ONS |
| 6 | `how-compound-interest-works` | "Early Emma" (£2,000/yr, age 20–30) "will likely have more" than "Late Luke" (£2,000/yr, age 30–60) | True only if returns beat about **6.3% a year**. At 5% Luke ends with ≈ £139.5k against Emma's ≈ £114.2k. At 7% Emma leads, ≈ £225k against ≈ £202k. The lesson must state its assumed rate (its own Next Steps uses 7%) | my calculation, contributions at the start of each year, value at 60 |
| 7 | `short-term-vs-long-term-goals` | £30,000 house deposit in 5 years "in a Lifetime ISA" (London example) | The LISA cap is **£4,000 a year** plus a 25% bonus (≤ £1,000 a year). That is at most £20,000 paid in + £5,000 bonus in 5 years, so £30k needs other savings too. The **£450,000** property price cap matters in London. The LISA is due to be replaced by a First Time Buyer ISA (HMT consultation) | GOV.UK LISA overview and withdrawals; FTB ISA consultation |
| 8 | `fees-overdrafts-how-to-avoid-them` | £100 overdrawn 10 days a month "might cost a few pounds each time — perhaps 40 to 60 GBP a year" | Since April 2020, overdrafts carry a **single interest rate only, with fixed daily/monthly fees banned**. The FCA expected £100 unarranged to cost **less than 20p a day**: that is ≤ £2 per 10-day episode, ≤ ~£24 a year. The example overstates the cost about 2× and implies fees that no longer exist | FCA overdraft changes; FCA press release |
| 9 | Tax and banking lessons, **Romanian translations** | RO readers are told about the UK Personal Allowance "12,570 GBP", PAYE, National Insurance, ISAs and "£85,000" FSCS | Romania has no UK-style personal allowance. Salaries pay a flat **10%** income tax plus **CAS 25%** and **CASS 10%** (to be confirmed against Codul fiscal before publishing). Deposits are covered up to the **€100,000** EU level. Either localise these 7 RO lessons or label them "UK system" in the title | EC deposit guarantee schemes; ANAF Codul fiscal |
| 10 | `national-insurance-other-deductions` | "Your employer adds 100 GBP on top" — the employer "match" | UK auto-enrolment minimums are **employer 3%, you 5%, total 8%** of qualifying earnings. That is not a 1:1 match by default. Keep the point (don't opt out) but reframe the example | GOV.UK workplace pensions: what you, your employer and the government pay |
| 11 | `why-we-pay-taxes-and-where-it-goes` | £24,000 gross → take-home "closer to 20,000 GBP" | 2026/27 (England, Wales, NI; no pension or student loan): tax £2,286 + NI £914 → take-home ≈ **£20,800**. Minor, but easy to make exact | GOV.UK income tax rates; NI rates |
| 12 | `how-to-read-price-charts` (Forex) | No risk warning. Tells the reader to "look for buying opportunities" | ESMA: **74–89%** of retail CFD accounts lose money. CFTC: "Two out of three forex customers lose money". The FCA restricts retail CFDs (PS19/18). Add a risk box and drop the directional trade instruction | ESMA; CFTC; FCA PS19/18 |
| 13 | `building-consistent-money-habits`, `managing-financial-stress-effectively` (`detailed_content`) | Recommend "Mint" | Intuit shut Mint down on **23 March 2024**. The same blocks use "$5 a day", "$50 a week" and "paycheck". `building-long-term-direction`'s short description says "Give every dollar a purpose" | NerdWallet (news) |
| 14 | Rental lessons | Letting fees "8–15%", "UK buy-to-let benchmark of at least five percent" yield, maintenance "1–2% of value" | No official source found for any of the three. Label them as rules of thumb or remove them. Not in the lessons, but relevant to "net returns": property income tax rates rise to **22% / 42% / 47% from 6 April 2027**, and mortgage interest gets only basic-rate (20%) relief | GOV.UK technical note; residential landlords tax relief |
| 15 | `current-vs-savings-accounts`, `how-interest-works-apr-vs-aer` | Savings at "4%" and "5% AER" | Bank Rate is **3.75%** (BoE, held; next decision 5 Nov 2026). The arithmetic is right, but label the rates as illustrative | BoE Bank Rate page |
| 16 | `where-to-keep-your-emergency-fund`, `short-term-vs-long-term-goals` | Recommend Cash ISAs | Still correct (ISA allowance £20,000 in 2026/27). From **6 April 2027** the cash ISA limit drops to **£12,000 for under-65s**. Worth one sentence | GOV.UK ISAs; cash ISA limit reduction |
| 17 | `garzoni-vs-acorns` (guide) | Implies a UK reader can choose Acorns | Acorns prices its plans in US dollars (Bronze $4, Silver $8, Gold $12 a month), and its banking features are for "U.S. residents". The draft below says so | acorns.com, acorns.com/pricing |
| 18 | `how-to-pay-off-debt` (guide) | Snowball "has a higher finish rate" | No source I could load supports a finish-rate claim (HBR's 2016 piece loaded only its header). The draft drops the claim and shows the trade-off with a worked example instead | — |

**Checked and correct:** Personal Allowance £12,570, basic rate to £50,270, higher to £125,140,
additional 45%, tax code 1257L (all 2026/27). "2% a month ≈ 27% APR" (26.8%). £1,000 at 5% AER →
£1,050. £5,000 at 4% → £200. Credit utilisation "under ~30%" (Experian). Checking your own file is
a soft search and doesn't affect your score (Experian, Equifax). "Invest money you won't need for
at least five years" (FCA InvestSmart: "a minimum of 5 years").

**The site promises this already.** `/editorial-standards` says "when UK rules or thresholds
change, for example at the start of a new tax year, we update the affected pages", and that
lessons cite "a primary or official source in a Sources section". `/about` names MoneyHelper, the
FCA, HMRC and the Bank of England (`packages/core/src/locales/en/editorial.json`). Items 1–2 and
the US-only sources mean the promise is not met today. Applying this document closes the gap.

---

## How to apply (owner actions — nothing here was written to any database)

- **Lesson sources** live per section: `LessonSection.source_label` / `source_url`
  (`backend/education/models.py:179-187`). `PublicLesson.tsx:283-292` dedupes them into the visible
  **Sources** block and the citation schema. Each section holds one URL, so each proposed source
  below names the section it goes on (Overview, Core Concept, Applied Insight, Practical
  Walkthrough, Key Takeaways). Edit them in Django admin, then run the usual RO push so the RO
  lesson shows the same links.
- **Guide content** is code: `backend/education/management/commands/seed_guides.py` is the
  source of truth, and re-running `seed_guides` re-syncs by slug. `Article` has **no sources
  field**, so guide sources must be inline links in `content` (as in the drafts below).
  `how-to-pay-off-debt` and `investing-basics-for-beginners` have RO versions. Re-run
  `translate_articles_to_ro` after changing the EN text.
- `garzoni-vs-acorns` is built with the `_comparison()` helper, which fixes the body to
  intro/table/verdict/"who should pick which". The expanded draft needs extra sections, so build it
  with `_guide(..., category="comparison")` instead (same slug, same category).
- When a figure changes (FSCS, NI), update the lesson's text **and** its RO translation, so the
  review date on the page moves.

---

## Part 1 — Sources per public lesson

Format per lesson: what I checked → proposed sources (title as seen → section). "RO:" marks a
Romanian authority. Existing US sources are marked **replace** unless noted.

### Basic Finance — Understanding Income & Expenses / Budgeting

**`what-are-income-and-expenses`** — no sources today. Gross vs net and fixed vs variable are
definitional, and no figures need checking.
- https://www.gov.uk/understanding-your-pay/deductions-from-your-pay — "Understanding your pay: Deductions from your pay - GOV.UK" → Applied Insight (gross vs net)
- https://www.citizensadvice.org.uk/debt-and-money/budgeting1/ — "Budgeting - Citizens Advice" → Practical Walkthrough
- https://www.stepchange.org/debt-info/how-to-make-a-budget.aspx — "Making A Budget Plan. Free Templates & Help. StepChange" → Next Steps

**`tracking-your-money-flow`** — no sources today. The €200 subscriptions example is illustrative, which is fine.
- https://www.citizensadvice.org.uk/debt-and-money/budgeting1/ — "Budgeting - Citizens Advice" → Core Concept
- https://www.stepchange.org/debt-info/how-to-make-a-budget.aspx — "Making A Budget Plan…" → Practical Walkthrough

**`fixed-vs-variable-expenses`** — no sources today. It names council tax as a fixed cost, so cite it.
- https://www.gov.uk/council-tax — "How Council Tax works: Working out your Council Tax - GOV.UK" → Core Concept
- https://www.currentaccountswitch.co.uk/ — "Home" (Current Account Switch Service) → Applied Insight (renegotiating or switching fixed costs)
- https://www.citizensadvice.org.uk/debt-and-money/budgeting1/ — "Budgeting - Citizens Advice" → Practical Walkthrough

**`your-first-income-expense-review`** — no sources today.
- https://www.stepchange.org/debt-info/how-to-make-a-budget.aspx — "Making A Budget Plan…" → Practical Walkthrough
- https://www.citizensadvice.org.uk/debt-and-money/budgeting1/ — "Budgeting - Citizens Advice" → Core Concept

**`tracking-income-and-expenses`** — **replace** the 3× CFPB *credit-reports* link (wrong topic).
- https://www.citizensadvice.org.uk/debt-and-money/budgeting1/ — "Budgeting - Citizens Advice" → Overview
- https://www.stepchange.org/debt-info/how-to-make-a-budget.aspx — "Making A Budget Plan…" → Practical Walkthrough
- https://www.gov.uk/understanding-your-pay/deductions-from-your-pay — "Understanding your pay: Deductions from your pay - GOV.UK" → Key Takeaways (net income)

### Personal Finance — Budgeting Beyond Basics / Building Wealth

**`conducting-an-annual-financial-review`** — **replace** consumer.gov (FTC, US).
- https://www.currentaccountswitch.co.uk/ — "Home" (Current Account Switch Service) → Practical Walkthrough
- https://www.fscs.org.uk/check/check-your-money-is-protected/ — "Bank & savings protection checker | Check your money is protected" → Core Concept (stress-test your safety nets)
- https://www.gov.uk/individual-savings-accounts — "Individual Savings Accounts (ISAs): Overview - GOV.UK" → Overview ("optimise taxes")

**`how-compound-interest-works`** — **replace** consumer.gov (wrong topic). **Fix the Emma/Luke
claim** (mismatch #6). Suggested wording: "…at 7% a year, Emma would still have more at 60. At
lower returns Luke can catch up, but starting early always does more work per pound." The formula
is correct.
- https://www.fca.org.uk/investsmart/risk-returns — "Risk and returns" → Core Concept (time horizon, "a minimum of 5 years")
- https://www.bankofengland.co.uk/explainers/what-is-inflation — "What is inflation?" → Key Takeaways
- https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator — "Compound Interest Calculator | Investor.gov" → Practical Walkthrough (or better: link Garzoni's own `/calculators/compound-interest`, which is public and needs no external source)

### Everyday Money Skills — Banking & Your Accounts

**`what-a-bank-actually-does`** — no sources today. Its "deposit protection up to a set limit" is
correct and unnumbered. Say £120,000.
- https://www.bankofengland.co.uk/explainers/how-is-money-created — "How is money created?" → Overview (banks create deposits when they lend; this sharpens the "lends most of it" framing)
- https://www.fscs.org.uk/what-we-cover/banks-building-societies-credit-unions/ — "See how FSCS protects banks, building societies and credit unions | FSCS" → Core Concept
- https://www.bankofengland.co.uk/explainers/what-is-the-financial-services-compensation-scheme — "What is the FSCS and what is the new deposit protection limit?" → Applied Insight (joint accounts: £120k each)
- RO: https://finance.ec.europa.eu/banking/banking-regulation/deposit-guarantee-schemes_en — "Deposit guarantee schemes - Finance - European Commission" (€100,000) and https://www.bnr.ro/ — "BNR Banca Națională a României (BNR)"

**`current-vs-savings-accounts`** — label the 4% as illustrative (Bank Rate 3.75%).
- https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate — "Interest rates and Bank Rate: our latest decision" → Applied Insight
- https://www.gov.uk/apply-tax-free-interest-on-savings — "Tax on savings interest: Overview - GOV.UK" → Key Takeaways
- https://www.which.co.uk/money/savings-and-isas — "Savings & ISAs - Which?" → Next Steps

**`how-interest-works-apr-vs-aer`** — the 27% APR maths is correct (1.02¹² − 1 = 26.8%). Label 5% AER as an example.
- https://www.bankofengland.co.uk/explainers/what-are-interest-rates — "What are interest rates?" → Overview
- https://www.fca.org.uk/data/changes-overdraft-charges — "Changes to overdraft charges" → Practical Walkthrough (overdrafts now advertised with an APR and priced as a single annual rate)

**`fees-overdrafts-how-to-avoid-them`** — **fix the £40–60/yr example** (mismatch #8).
- https://www.fca.org.uk/data/changes-overdraft-charges — "Changes to overdraft charges" → Overview
- https://www.fca.org.uk/news/press-releases/fca-confirms-biggest-shake-up-overdraft-market — "FCA confirms biggest shake-up to the overdraft market for a generation" → Applied Insight ("less than 20 pence a day" per £100 unarranged)
- https://www.citizensadvice.org.uk/debt-and-money/banking/ — "Banking - Citizens Advice" → Next Steps

**`choosing-the-right-account-for-you`**
- https://www.currentaccountswitch.co.uk/ — "Home" (Current Account Switch Service) → Core Concept ("switching is easier than most people think")
- https://www.fscs.org.uk/check/check-your-money-is-protected/ — "Bank & savings protection checker…" → Core Concept (deposit protection as a comparison factor)
- https://www.which.co.uk/money/banking/bank-accounts — "Bank Accounts - Which?" → Practical Walkthrough

### Basic Finance — Emergency Funds & Financial Safety Nets

**`how-much-to-save`** — "three to six months" is a common guideline, but the only UK sources
for it I know of (MoneyHelper) would not load. Keep it framed as a guideline.
- https://www.fca.org.uk/investsmart/golden-rules-investing — "The golden rules of investing" → Overview ("keep some money in an emergency fund with instant access")
- https://www.fca.org.uk/investsmart/should-you-invest — "Should you invest?" → Key Takeaways (build the fund before investing)
- https://www.citizensadvice.org.uk/debt-and-money/budgeting1/ — "Budgeting - Citizens Advice" → Practical Walkthrough

**`where-to-keep-your-emergency-fund`** — **£85,000 → £120,000** (mismatch #1, EN + RO). Add the April 2027 cash ISA change.
- https://www.fscs.org.uk/what-we-cover/banks-building-societies-credit-unions/ — "See how FSCS protects…" → Practical Walkthrough
- https://www.gov.uk/individual-savings-accounts — "Individual Savings Accounts (ISAs): Overview - GOV.UK" → Core Concept (£20,000 in 2026/27)
- https://www.gov.uk/government/publications/reduction-in-the-cash-individual-savings-account-isa-limit/cash-individual-savings-account-isa-limit-reduction — "Cash Individual Savings Account (ISA) limit reduction - GOV.UK" → Key Takeaways
- RO: https://finance.ec.europa.eu/banking/banking-regulation/deposit-guarantee-schemes_en — "Deposit guarantee schemes…" (€100,000 per depositor per bank)

**`when-and-how-to-use-it`**
- https://www.citizensadvice.org.uk/debt-and-money/help-with-debt/dealing-with-your-debts/work-out-which-debts-to-deal-with-first/ — "Work out which debts to deal with first - Citizens Advice" → Overview (what happens if you fall onto credit)
- https://www.fca.org.uk/investsmart/golden-rules-investing — "The golden rules of investing" → Core Concept
- https://www.stepchange.org/ — "StepChange Debt Charity. Free Expert Debt Help & Advice" → Key Takeaways

### Everyday Money Skills — Taxes Made Simple

**`why-we-pay-taxes-and-where-it-goes`** — £24k → ≈£20,800 take-home (mismatch #11).
- https://www.gov.uk/annual-tax-summary — "Check how the government spends your taxes — Annual Tax Summary - GOV.UK" → Overview
- https://www.gov.uk/income-tax-rates — "Income Tax rates and Personal Allowances : Current rates and allowances - GOV.UK" → Applied Insight
- https://www.gov.uk/estimate-income-tax — "Estimate your Income Tax for the current year - GOV.UK" → Next Steps (HMRC's own calculator, better than "an online take-home calculator")
- RO: https://www.anaf.ro/anaf/internet/ANAF/asistenta_contribuabili/legislatie/codul_fiscal/ — "Codul fiscal" (ANAF; page shows "actualizat în data de 17.12.2025")

**`how-to-read-your-payslip`** — **NI £120 → ≈£76** (mismatch #2).
- https://www.gov.uk/payslips — "Payslips: employee rights - GOV.UK" → Overview (your employer must give you one)
- https://www.gov.uk/tax-codes/what-your-tax-code-means — "Tax codes: What your tax code means - GOV.UK" → Practical Walkthrough ("1257L is the tax code currently used for most people")
- https://www.gov.uk/national-insurance/how-much-you-pay — "National Insurance: introduction: How much you pay - GOV.UK" → Applied Insight

**`income-tax-tax-free-allowances`** — £12,570 / 20% example is correct for 2026/27. You could add
that the allowance tapers above £100,000 and is zero at £125,140 (same GOV.UK page).
- https://www.gov.uk/income-tax-rates — "Income Tax rates and Personal Allowances…" → Applied Insight
- https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027 — "Rates and thresholds for employers 2026 to 2027 - GOV.UK" → Core Concept
- https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief — "Tax on your private pension contributions: Tax relief - GOV.UK" → Practical Walkthrough
- RO: https://www.anaf.ro/anaf/internet/ANAF/asistenta_contribuabili/legislatie/codul_fiscal/ — "Codul fiscal"

**`national-insurance-other-deductions`** — reframe the "match" (mismatch #10).
- https://www.gov.uk/national-insurance/what-national-insurance-is-for — "National Insurance: introduction: What National Insurance is for - GOV.UK" → Core Concept
- https://www.gov.uk/workplace-pensions/what-you-your-employer-and-the-government-pay — "Workplace pensions: What you, your employer and the government pay - GOV.UK" → Applied Insight (3% / 5% / 8%)
- https://www.gov.uk/repaying-your-student-loan — "Repaying your student loan: Overview - GOV.UK" → Overview (student loan deductions)

### Everyday Money Skills — Insurance Basics

**`health-life-insurance-explained`**
- https://www.which.co.uk/money/insurance/life-insurance-and-protection/best-term-life-insurance-abB1g3e4pLmE — "Best life insurance UK 2026: quotes and costs compared - Which?" → Practical Walkthrough (term cover)
- https://www.citizensadvice.org.uk/consumer/insurance/ — "Insurance - Citizens Advice" → Overview
- https://www.financial-ombudsman.org.uk/ — "Financial Ombudsman Service: Our homepage…" → Key Takeaways (where to complain)

**`home-renters-contents-insurance`**
- https://www.abi.org.uk/policy-and-guidance/general-insurance/personal-insurance/home-insurance — "Home insurance" (ABI) → Core Concept (buildings vs contents)
- https://www.which.co.uk/money/insurance/home-and-mobile-insurance/home-insurance-explained/buildings-insurance-explained-autSN4w7iCBI — "Best buildings insurance 2026 - Which?" → Overview
- https://www.citizensadvice.org.uk/consumer/insurance/ — "Insurance - Citizens Advice" → Practical Walkthrough
- RO: https://www.paidromania.ro/ — "POOL-UL DE ASIGURARE ÎMPOTRIVA DEZASTRELOR NATURALE" (PAD, Romania's natural-disaster home policy. Confirm the "mandatory" wording on the page before stating it)

**`car-travel-insurance-essentials`**
- https://www.gov.uk/vehicle-insurance — "Vehicle insurance: Overview - GOV.UK" → Overview ("Third party insurance is the legal minimum")
- https://www.nhs.uk/using-the-nhs/healthcare-abroad/apply-for-a-free-uk-global-health-insurance-card-ghic/ — "Applying for healthcare cover abroad (GHIC and EHIC) - NHS" → Applied Insight ("The UK GHIC is not a replacement for travel insurance")
- https://www.abi.org.uk/policy-and-guidance/general-insurance/personal-insurance/motor-insurance — "Motor insurance" (ABI) → Core Concept
- (alternatives for the travel half) https://www.abi.org.uk/policy-and-guidance/general-insurance/personal-insurance/travel-insurance — "Travel insurance" (ABI); https://www.gov.uk/guidance/foreign-travel-insurance — "Foreign travel insurance - GOV.UK"
- RO: https://asfromania.ro/ro/a/820/precizari-privind-asigurarea-rca-pentru-pagube-produse-tertilor-prin-accidente-de-autovehicule — "Autoritatea de Supraveghere Financiară - Precizari privind asigurarea RCA…" (RCA, Romania's compulsory third-party motor cover)

**`how-to-avoid-over-or-under-insuring`**
- https://www.abi.org.uk/policy-and-guidance/general-insurance/personal-insurance/home-insurance — "Home insurance" (ABI) → Core Concept
- https://www.citizensadvice.org.uk/consumer/insurance/ — "Insurance - Citizens Advice" → Practical Walkthrough
- https://www.financial-ombudsman.org.uk/ — "Financial Ombudsman Service…" → Key Takeaways

### Everyday Money Skills — Borrowing & Big Purchases

**`good-debt-vs-bad-debt`**
- https://www.citizensadvice.org.uk/debt-and-money/borrowing-money/ — "Borrowing money - Citizens Advice" → Overview
- https://www.fca.org.uk/investsmart/should-you-invest — "Should you invest?" → Applied Insight ("prioritise paying off things like credit card debt and payday loans")
- https://www.gov.uk/repaying-your-student-loan — "Repaying your student loan: Overview - GOV.UK" → Core Concept (education loans)

**`loans-financing-in-plain-english`**
- https://www.citizensadvice.org.uk/debt-and-money/borrowing-money/ — "Borrowing money - Citizens Advice" → Core Concept
- https://www.citizensadvice.org.uk/debt-and-money/borrowing-money/how-lenders-decide-whether-to-give-you-credit/ — "How lenders decide whether to give you credit - Citizens Advice" → Practical Walkthrough
- https://www.fca.org.uk/consumers/protect-yourself-scams — "Protect yourself from scams" → Key Takeaways

**`buy-now-pay-later-the-hidden-costs`** — **add the 15 July 2026 regulation** (mismatch #3).
- https://www.fca.org.uk/consumers/buy-now-pay-later — "Buy Now Pay Later | FCA" → Overview and Core Concept
- https://www.financial-ombudsman.org.uk/ — "Financial Ombudsman Service…" → Key Takeaways
- https://www.citizensadvice.org.uk/debt-and-money/help-with-debt/ — "Help with debt - Citizens Advice" → Practical Walkthrough

**`planning-for-a-big-purchase`**
- https://www.gov.uk/vehicle-insurance — "Vehicle insurance: Overview - GOV.UK" → Applied Insight (car running costs)
- https://www.citizensadvice.org.uk/debt-and-money/borrowing-money/ — "Borrowing money - Citizens Advice" → Core Concept
- https://www.gov.uk/consumer-protection-rights — "Consumer rights - GOV.UK" → Key Takeaways

**`your-consumer-rights-refunds-warranties`** — correct, but generic ("In most places"). Add the UK
specifics: **30 days** to reject for a refund, a repair or replacement within **6 months**, and up
to **6 years** to claim (5 in Scotland).
- https://www.citizensadvice.org.uk/consumer/somethings-gone-wrong-with-a-purchase/return-faulty-goods/ — "Return faulty goods - Citizens Advice" → Core Concept
- https://www.citizensadvice.org.uk/consumer/somethings-gone-wrong-with-a-purchase/claim-using-a-warranty-or-guarantee/ — "Claim using a warranty or guarantee - Citizens Advice" → Applied Insight
- https://www.legislation.gov.uk/ukpga/2015/15/section/22 — "Consumer Rights Act 2015" (s.22, time limit for the short-term right to reject) → Key Takeaways
- (alternatives) https://www.legislation.gov.uk/ukpga/2015/15/contents — "Consumer Rights Act 2015" (whole Act); https://www.which.co.uk/consumer-rights/regulation/consumer-rights-act-aKJYx8n5KiSl — "Consumer Rights Act 2015 - Which?"
- RO: https://europa.eu/youreurope/citizens/consumers/shopping/guarantees-returns/index_en.htm — "Guarantees on goods bought in the EU - Your Europe" ("minimum 2-year guarantee")

### Financial Mindset (7 courses)

UK authorities say little about mindset, so these lean on the NHS, the FCA's survey and one
peer-reviewed paper. All of them currently cite the CFPB well-being scale (US, unverifiable: 403).
Keeping one CFPB link as a secondary reference is defensible once it loads in a browser. Lead with
UK sources.

**`learning-from-financial-mistakes`**
- https://www.nhs.uk/every-mind-matters/lifes-challenges/money-worries-mental-health/ — "Money worries and mental health - Every Mind Matters - NHS" → Core Concept (shame and guilt)
- https://www.citizensadvice.org.uk/debt-and-money/help-with-debt/ — "Help with debt - Citizens Advice" → Practical Walkthrough
- https://www.experian.co.uk/consumer/guides/improve-credit-score.html — "How To Improve Your Credit Score" → Overview (the missed-payment example: it stays six years and its impact fades)

**`building-long-term-direction`** — change the short description "Give every dollar a purpose" (US idiom). The €50,000 example is fine.
- https://www.fca.org.uk/investsmart/should-you-invest — "Should you invest?" → Core Concept
- https://www.bankofengland.co.uk/explainers/what-is-inflation — "What is inflation?" → Practical Walkthrough ("look up current prices")
- https://www.gov.uk/workplace-pensions — "Workplace pensions: About workplace pensions - GOV.UK" → Overview (retirement as the long-term goal)

**`managing-financial-stress-effectively`** — remove "Mint" from `detailed_content`.
- https://www.nhs.uk/every-mind-matters/lifes-challenges/money-worries-mental-health/ — "Money worries and mental health…" → Overview
- https://www.citizensadvice.org.uk/debt-and-money/help-with-debt/dealing-with-your-debts/work-out-which-debts-to-deal-with-first/ — "Work out which debts to deal with first…" → Applied Insight ("reaching out to creditors")
- https://www.stepchange.org/ — "StepChange Debt Charity…" → Next Steps

**`building-consistent-money-habits`** — remove "Mint" and the "$" figures from `detailed_content`.
- https://www.gov.uk/workplace-pensions — "Workplace pensions: About workplace pensions - GOV.UK" → Core Concept (automatic saving every payday is the textbook habit loop)
- https://www.fca.org.uk/investsmart/golden-rules-investing — "The golden rules of investing" → Key Takeaways (regular monthly investing)
- https://www.citizensadvice.org.uk/debt-and-money/budgeting1/ — "Budgeting - Citizens Advice" → Practical Walkthrough

**`understanding-your-money-story`** — the "money scripts" vocabulary comes from Klontz et al.; cite it.
- https://journals.newprairiepress.org/jft/article/id/5669/ — "Money Beliefs and Financial Behaviors: Development of the Klontz Money Script Inventory" → Core Concept
- https://www.nhs.uk/every-mind-matters/lifes-challenges/money-worries-mental-health/ — "Money worries and mental health…" → Applied Insight

**`scarcity-vs-abundance-thinking`** — "tunnelling" and "scarcity" come from Mullainathan and
Shafir's research, but the publisher pages block bots, so there is no URL here. Until then:
- https://www.nhs.uk/every-mind-matters/lifes-challenges/money-worries-mental-health/ — "Money worries and mental health…" → Core Concept
- https://www.fca.org.uk/financial-lives — "Financial Lives survey" → Overview (UK data on financial resilience)

**`beliefs-that-shape-financial-behavior`** — names all four Klontz scripts (avoidance, worship, status, vigilance), so the paper is the primary source.
- https://journals.newprairiepress.org/jft/article/id/5669/ — "Money Beliefs and Financial Behaviors…" → Core Concept
- https://www.nhs.uk/every-mind-matters/lifes-challenges/money-worries-mental-health/ — "Money worries and mental health…" → Practical Walkthrough

**`short-term-vs-long-term-goals`** — fix the LISA example (mismatch #7).
- https://www.gov.uk/lifetime-isa — "Lifetime ISA: Overview - GOV.UK" → Applied Insight (£4,000 a year, 25% bonus)
- https://www.gov.uk/lifetime-isa/withdrawing-money-from-your-lifetime-isa — "Lifetime ISA: Withdrawing money from your Lifetime ISA - GOV.UK" → Applied Insight (£450,000 cap, 12-month rule, 25% charge)
- https://www.fca.org.uk/investsmart/risk-returns — "Risk and returns" → Core Concept
- (context) https://www.gov.uk/government/consultations/first-time-buyer-isa-consultation/first-time-buyer-isa-consultation — "First Time Buyer ISA: Consultation - GOV.UK"

**`creating-an-action-plan`**
- https://www.stepchange.org/debt-info/how-to-make-a-budget.aspx — "Making A Budget Plan…" → Practical Walkthrough
- https://www.citizensadvice.org.uk/debt-and-money/budgeting1/ — "Budgeting - Citizens Advice" → Core Concept

Also check the maths: £250 a month for six months is £1,500, so "£1,524 saved" needs a stated source of the extra £24.

**`reviewing-and-adjusting-your-goals`**
- https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23 — "CPI ANNUAL RATE 00: ALL ITEMS 2015=100 - Office for National Statistics" → Overview ("inflation… can make a goal unrealistic")
- https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate — "Interest rates and Bank Rate: our latest decision" → Overview (interest rate changes)
- https://www.citizensadvice.org.uk/debt-and-money/budgeting1/ — "Budgeting - Citizens Advice" → Practical Walkthrough

### Real Estate — Rental Income & Cash Flow Analysis

All four lessons predate the Renters' Rights Act and say "UK and EU". The rules below are
**England-only**. Say so, or add a sentence noting that Scotland, Wales and NI differ.

**`calculating-rental-income`** — VOA → ONS (mismatch #5). Label the "5% benchmark" and "8–15%" as rules of thumb.
- https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/latest — "Private rent and house prices, UK - Office for National Statistics" → Applied Insight
- https://www.gov.uk/government/collections/private-rental-market-statistics — "Valuation Office Agency: private rental market statistics - GOV.UK" → Practical Walkthrough (shows the VOA series ended; cite only to explain the switch, or drop it)
- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income — "Work out your rental income when you let property - GOV.UK" → Core Concept

**`managing-rental-expenses`** — "consult a qualified property accountant…" is fine. Add the finance-cost rule and the 2027 rates.
- https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income — "Work out your rental income…" → Practical Walkthrough (allowable expenses)
- https://www.gov.uk/guidance/changes-to-tax-relief-for-residential-landlords-how-its-worked-out-including-case-studies — "Tax relief for residential landlords: how it's worked out - GOV.UK" → Overview (mortgage interest: 20% tax credit, not a deduction)
- https://www.gov.uk/government/publications/changes-to-tax-rates-for-property-savings-and-dividend-income/change-to-tax-rates-for-property-savings-and-dividend-income-technical-note — "Change to tax rates for property, savings and dividend income — technical note - GOV.UK" → Key Takeaways (22/42/47% from 6 April 2027)
- RO: https://www.anaf.ro/anaf/internet/ANAF/asistenta_contribuabili/legislatie/codul_fiscal/ — "Codul fiscal" (rental income is taxed under the "cedarea folosinței bunurilor" chapter)

**`cash-flow-analysis`** — the arithmetic (£1,400 − £1,100 = £300, the −£50 case) is correct.
- https://www.bankofengland.co.uk/prudential-regulation/publication/2016/underwriting-standards-for-buy-to-let-mortgage-contracts-ss — "Underwriting standards for buy-to-let mortgage contracts" → Overview (why lenders stress-test rent; cite without quoting ratios, which I did not extract)
- https://www.gov.uk/renting-out-a-property/paying-tax — "Renting out your property: Paying tax and National Insurance - GOV.UK" → Applied Insight (cash flow ≠ taxable profit; £1,000 property allowance)
- https://www.gov.uk/guidance/changes-to-tax-relief-for-residential-landlords-how-its-worked-out-including-case-studies — "Tax relief for residential landlords…" → Key Takeaways

**`maximizing-rental-returns`** — **rewrite the rent-increase advice** (mismatch #4). Rental bidding is also now banned.
- https://www.gov.uk/guidance/renters-rights-act-an-overview-for-landlords — "Renters' Rights Act: an overview for landlords - GOV.UK" → Overview
- https://www.gov.uk/assured-tenancy-agreements-a-guide-for-landlords/rent-increases — "Assured periodic tenancies: a guide for landlords: Rent increases - GOV.UK" → Practical Walkthrough
- https://www.gov.uk/renting-out-a-property/landlord-responsibilities — "Renting out your property: Landlord responsibilities - GOV.UK" → Core Concept (repairs and safety duties, where "quality maintenance" is a legal duty, not only good practice)
- (alternative) https://www.gov.uk/government/publications/guide-to-the-renters-rights-act/guide-to-the-renters-rights-act — "Guide to the Renters’ Rights Act - GOV.UK"

### Forex — Introduction to Forex Trading

**`how-to-read-price-charts`** — keep the CFTC link (it loads and is accurate) but lead with UK and EU regulators. Add a risk box (mismatch #12).
- https://www.fca.org.uk/publications/policy-statements/ps19-18-restricting-contract-difference-products — "PS19/18: Restricting contract for difference products sold to retail clients" → Overview
- https://www.esma.europa.eu/press-news/esma-news/esma-agrees-prohibit-binary-options-and-restrict-cfds-protect-retail-investors — "ESMA agrees to prohibit binary options and restrict CFDs to protect retail investors" → Applied Insight ("74-89% of retail accounts typically lose money")
- https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/CustomerAdvisory_MustKnowForex.html — "Customer Advisory: Eight Things You Should Know Before Trading Forex | CFTC" → Key Takeaways (keep)
- RO: https://asfromania.ro/ — "Autoritatea de Supraveghere Financiară" (check a firm is authorised in Romania)

---

## Part 2 — Expanded guide drafts

Word counts were measured on the live API `content` field with HTML stripped, FAQ excluded. The
next-shortest guides, for later: `what-is-an-ai-money-coach` 179, `garzoni-vs-cleo` 183,
`garzoni-vs-monarch` 185, `garzoni-vs-zogo` 186, `how-to-set-savings-goals` 189.

Rules followed: slug, title, H2 skeleton and answer-first bold opener kept. Every external claim is
linked inline to a page from the appendix. Worked examples are labelled as illustrations, with the
arithmetic shown. No statistics about Garzoni users. The only Garzoni features mentioned are ones
confirmed in code: public lessons at `/learn/<slug>` (`AppRoutes.tsx:69-70`), the public compound
interest calculator at `/calculators/compound-interest` (`AppRoutes.tsx:76`), the Starter / Plus /
Pro plans and the Starter AI tutor quota of 5 prompts a day (`docs/prod/subscription-matrix.md`),
and the EN/RO lesson languages (API `available_languages`).

### 2.1 `how-credit-scores-work-uk` — 164 → 992 words

`meta_description` (unchanged is fine). Suggested refresh: "How UK credit scores work: who holds
your file (Experian, Equifax, TransUnion), what moves your score, how to check it free, and the
mistakes that cost people."

```html
<p><strong>A UK credit score is a lender's estimate of how reliably you repay borrowing.</strong> It's built from your credit file, which three credit reference agencies keep — Experian, Equifax and TransUnion — and you improve it mainly by paying on time, using a small share of the credit you have, and keeping your file accurate.</p>

<h2>Who holds your credit file</h2>
<p>There is no single official UK credit score. The three main credit reference agencies each keep a file on most adults, mostly recording how you've handled credit, utility and service accounts (<a href="https://ico.org.uk/for-the-public/credit/">ICO</a>). Each agency shows you its own score on its own scale. Lenders don't simply read that number: they combine what's on your file with their own rules and what you put on the application. That's why one lender can turn you down while another says yes (<a href="https://www.citizensadvice.org.uk/debt-and-money/borrowing-money/how-lenders-decide-whether-to-give-you-credit/">Citizens Advice</a>).</p>

<h2>What's on your file</h2>
<ul>
<li><strong>Your accounts and how you've paid them</strong> — credit cards, loans, overdrafts, phone contracts and utility accounts.</li>
<li><strong>Missed payments, defaults and county court judgments</strong> — these can stay on your file for six years, though their impact fades over that time (<a href="https://www.experian.co.uk/consumer/guides/improve-credit-score.html">Experian</a>).</li>
<li><strong>Searches</strong> — when you apply for credit, the lender runs a "hard" search that other lenders can see. Most hard searches stay on your report for 12 months (<a href="https://www.experian.co.uk/consumer/guides/searches-and-credit-checks.html">Experian</a>).</li>
<li><strong>Your address history and electoral roll entry</strong> — used to confirm who you are.</li>
<li><strong>Financial links</strong> — people you share a bank account or mortgage with can appear on your file.</li>
</ul>

<h2>What affects your score</h2>
<ul>
<li><strong>Payment history</strong> — paying on time, in full where you can, is one of the clearest signals that you're a reliable borrower.</li>
<li><strong>Credit utilisation</strong> — the share of your available credit you're using. Experian suggests keeping it below 30%.</li>
<li><strong>Length of history</strong> — older, well-managed accounts help. If you have little history, a small account managed well can help build one.</li>
<li><strong>Recent applications</strong> — several hard searches in a short time can count against you.</li>
<li><strong>Electoral roll</strong> — registering at your current address helps lenders confirm your name and address (<a href="https://www.experian.co.uk/consumer/guides/improve-credit-score.html">Experian</a>).</li>
</ul>

<h2>A worked example: two people, same card</h2>
<p><em>An illustration, not a prediction of anyone's score.</em> Amira and Tom each have a credit card with a £3,000 limit.</p>
<ul>
<li><strong>Amira</strong> spends about £400 a month on the card and clears the statement in full by direct debit. Her utilisation is around 13% (£400 ÷ £3,000), she pays no interest, and every month adds an on-time payment to her file.</li>
<li><strong>Tom</strong> carries a £2,700 balance, which is 90% utilisation. He moved flat last spring, didn't update his address, missed one payment, and then applied for three new cards in one month to "see what he'd get".</li>
</ul>
<p>To a lender, Tom's file shows high utilisation, a missed payment that can stay visible for six years, and three hard searches that will sit there for about a year. Tom doesn't need a trick to fix this, just three habits: a direct debit for at least the minimum so he never misses again, paying the balance down (getting to £900 would put him at 30%), and registering to vote at his new address. Then he should stop applying until the searches age. Scores update as lenders report, which is usually monthly, so expect months, not days (<a href="https://www.equifax.co.uk/resources/loans-and-credit/how-to-improve-your-credit-score-quickly.html">Equifax</a>).</p>

<h2>How to check your credit file for free</h2>
<p>You have the right to a copy of your file from each of the three agencies, free of charge. You don't need a paid monthly subscription to see it (<a href="https://ico.org.uk/for-the-public/credit/">ICO</a>). Checking your own report or score is a soft search and won't affect your score, however often you look (<a href="https://www.experian.co.uk/consumer/guides/searches-and-credit-checks.html">Experian</a>). If a lender refuses you after checking your file, it must tell you why and which agency it used, so you can check the information is right and ask the agency to correct anything that's wrong (<a href="https://www.citizensadvice.org.uk/debt-and-money/borrowing-money/how-lenders-decide-whether-to-give-you-credit/">Citizens Advice</a>).</p>

<h2>Building a score from scratch</h2>
<p>If you're new to credit — a student, recently arrived in the UK, or someone who has always paid cash — your file may simply be thin. You don't need a credit card to improve it. Registering on the electoral roll, paying bills and accounts on time, checking your report, correcting mistakes and limiting new applications all help (<a href="https://www.experian.co.uk/consumer/guides/improve-credit-score.html">Experian</a>). If you do take a first card, use it for a small regular bill and clear it in full by direct debit each month. That builds a record without costing interest.</p>

<h2>If something on your file is wrong</h2>
<p>Errors happen: an account that isn't yours, a payment marked late that wasn't, an old address. Contact the agency showing the error and ask it to correct the entry. If the information came from a lender, contact the lender too, since the agency will check with it. Correcting wrong information is one of the few ways a score can improve without any change in your behaviour (<a href="https://www.citizensadvice.org.uk/debt-and-money/borrowing-money/how-lenders-decide-whether-to-give-you-credit/">Citizens Advice</a>).</p>

<h2>Common mistakes</h2>
<ul>
<li><strong>Paying for a report you can get free.</strong> Subscriptions are optional; your statutory file is free.</li>
<li><strong>Applying everywhere at once.</strong> Each formal application leaves a hard search. Space applications out.</li>
<li><strong>Forgetting the boring admin.</strong> An old address or no electoral roll entry makes you harder to verify.</li>
<li><strong>Missing a payment by accident.</strong> A direct debit for the minimum is a safety net, not a plan, but it prevents the most damaging mark.</li>
<li><strong>Expecting a quick fix.</strong> Nobody can legitimately raise your score overnight; be wary of anyone who claims they can.</li>
</ul>

<h2>Why it matters</h2>
<p>A stronger file means easier approval and access to lower interest rates on mortgages, loans and cards. Over a lifetime of borrowing, that difference adds up to a lot of money. To see how much an interest rate really costs, read Garzoni's free lesson <a href="/learn/how-interest-works-apr-vs-aer">How Interest Works (APR vs. AER)</a>. Before using Buy Now, Pay Later, read <a href="/learn/buy-now-pay-later-the-hidden-costs">Buy Now, Pay Later: The Hidden Costs</a>.</p>
```

FAQ (keep the two existing items, add three):
- **What is a good credit score in the UK?** (keep the existing answer)
- **Does checking my own score hurt it?** (keep; optionally add "(Experian)")
- **How long do missed payments stay on my credit file?** — "Missed payments, defaults and county court judgments can stay on your file for six years, though their effect fades over that time."
- **Do I have to pay to see my credit report?** — "No. Each credit reference agency must give you your statutory credit file free of charge."
- **Why was I refused credit when my score looks fine?** — "Lenders use their own criteria as well as your file. If you're refused after a credit check, the lender must tell you which agency it used, so you can check the information is correct."

### 2.2 `how-to-pay-off-debt` — 164 → 924 words

```html
<p><strong>To pay off debt, deal with any priority debts first, list everything else, keep paying the minimum on all of it, then put every spare pound towards one target debt.</strong> Choose the avalanche method (highest interest rate first) to pay the least interest, or the snowball method (smallest balance first) to get quick wins. The best method is the one you'll finish.</p>

<h2>Step 0: check for priority debts</h2>
<p>Not all debts carry the same consequences. Citizens Advice calls some of them <em>priority debts</em> because not paying can cost you your home, your energy supply or a court fine. Its list includes rent or mortgage arrears, council tax arrears, gas or electricity bills with your current supplier, and TV licence payments (<a href="https://www.citizensadvice.org.uk/debt-and-money/help-with-debt/dealing-with-your-debts/work-out-which-debts-to-deal-with-first/">Citizens Advice</a>). Deal with these before you speed up repayments on anything else. If you can't cover them, get free advice now from <a href="https://www.citizensadvice.org.uk/debt-and-money/help-with-debt/">Citizens Advice</a> or <a href="https://www.stepchange.org/">StepChange</a>.</p>

<h2>Step 1: list every debt</h2>
<p>For each debt, write down the balance, the interest rate (APR) and the minimum payment. Then work out how much you can pay in total each month without missing essentials. That total is your repayment budget. Everything above the minimums is your "extra".</p>

<h2>The avalanche method</h2>
<p>Order debts by interest rate, highest first. Pay the minimum on everything and put the extra on the most expensive debt. When it's gone, roll its whole payment onto the next-most-expensive debt. Mathematically, this costs the least in interest.</p>

<h2>The snowball method</h2>
<p>Order debts by balance, smallest first, and use the same rule: minimums everywhere, extra on the target, then roll the payment on. You usually pay a little more interest, but you clear whole debts sooner, and each cleared debt is one less bill to think about.</p>

<h2>A worked example</h2>
<p><em>An illustration with simplified maths: interest charged monthly at APR ÷ 12, fixed minimum payments, no new spending.</em> You have £250 a month for three debts:</p>
<table>
<thead><tr><th>Debt</th><th>Balance</th><th>APR</th><th>Minimum</th></tr></thead>
<tbody>
<tr><td>Store card</td><td>£500</td><td>19.9%</td><td>£15</td></tr>
<tr><td>Credit card A</td><td>£1,500</td><td>29.9%</td><td>£40</td></tr>
<tr><td>Credit card B</td><td>£3,000</td><td>24.9%</td><td>£75</td></tr>
</tbody>
</table>
<ul>
<li><strong>Avalanche</strong> (card A → card B → store card): debt-free in about 27 months, roughly £1,530 in interest. The first debt is cleared in month 11.</li>
<li><strong>Snowball</strong> (store card → card A → card B): also about 27 months, roughly £1,610 in interest. The first debt is cleared in month 4.</li>
</ul>
<p>What happens in month one with the avalanche: the three minimums take £130 of your £250, leaving £120 extra for card A. Card A charges about £37 interest that month (£1,500 × 29.9% ÷ 12), so its £160 payment cuts the balance by roughly £123. Every month after, the interest is a little smaller and more of each payment hits the balance. That is compounding working for you instead of against you.</p>
<p>Here the avalanche saves about £80, and the snowball gives you a cleared debt seven months earlier. Avalanche is cheaper; whether £80 is worth the earlier win is your call. The gap grows when rates differ more or balances are bigger.</p>

<h2>Which should you choose?</h2>
<p>If staying motivated is your challenge, choose the snowball. If you're disciplined and want the lowest cost, choose the avalanche. A middle path is fine too: if your smallest debt also has a high rate, clear it first. Choosing either method and sticking to it matters far more than picking the perfect one.</p>

<h2>Common mistakes</h2>
<ul>
<li><strong>Skipping minimums to overpay one debt.</strong> A missed payment brings fees and a mark that can stay on your credit file for six years (<a href="https://www.experian.co.uk/consumer/guides/improve-credit-score.html">Experian</a>).</li>
<li><strong>Ignoring priority debts.</strong> Paying a credit card faster while council tax arrears grow is the wrong way round.</li>
<li><strong>Not rolling payments forward.</strong> When a debt is cleared, its payment should go to the next target, not back into spending.</li>
<li><strong>Borrowing again while repaying.</strong> Pause new credit, including Buy Now, Pay Later, until the list is clear.</li>
<li><strong>No buffer at all.</strong> Without a small cash buffer, the next car repair goes straight back on a card.</li>
<li><strong>Investing while carrying expensive debt.</strong> The FCA's guidance is to prioritise paying off things like credit card debt and payday loans before investing, because their interest is likely to be many times higher than any investment return (<a href="https://www.fca.org.uk/investsmart/should-you-invest">FCA</a>).</li>
</ul>

<h2>Making it stick</h2>
<ul>
<li><strong>Automate the plan.</strong> Set direct debits for every minimum, plus a standing order for the extra on payday, so the plan runs even in a busy month.</li>
<li><strong>Find your real rates.</strong> Your statement or app shows each debt's APR. If you don't know a rate, you can't choose an order.</li>
<li><strong>Read the small print on "fixes".</strong> A balance transfer or consolidation loan can help only if the total cost — the rate, any fee, and what happens when an introductory rate ends — is genuinely lower than what you pay now. Compare total cost, not the monthly payment.</li>
<li><strong>Track cleared debts, not just balances.</strong> Crossing a debt off the list is the moment that keeps people going.</li>
</ul>

<h2>Avoid new debt while you repay</h2>
<p>Keep a small emergency buffer so surprises don't push you back onto credit, and celebrate each cleared balance. Garzoni's free lessons <a href="/learn/how-interest-works-apr-vs-aer">How Interest Works (APR vs. AER)</a> and <a href="/learn/when-and-how-to-use-it">When and How to Use Your Emergency Fund</a> cover both sides of that.</p>

<h2>When to get help instead</h2>
<p>If the minimums alone are more than you can pay, a repayment method won't fix it. Free, confidential debt advice can, for example by setting up an affordable plan with your creditors. <a href="https://www.stepchange.org/">StepChange</a> and <a href="https://www.citizensadvice.org.uk/debt-and-money/help-with-debt/">Citizens Advice</a> both give free help. Avoid paid "debt solution" firms you haven't checked.</p>
```

The `when-and-how-to-use-it` lesson title on the API is "When and How to Use It". Use that
exact title as the link text, or rename the lesson.

FAQ (replace the first answer's unsourced claim, add two):
- **Is the avalanche or snowball method better?** — "Avalanche costs the least interest. Snowball clears individual debts sooner, which many people find motivating. The difference in interest is often modest, so pick the one you'll stick with."
- **Should I save or pay off debt first?** (keep the existing answer)
- **Which debts should I pay first if I can't pay everything?** — "Priority debts first: rent or mortgage arrears, council tax, energy with your current supplier and similar debts with serious consequences. Then use avalanche or snowball on the rest."
- **Where can I get free debt advice?** — "Citizens Advice and StepChange both offer free, confidential debt advice."

### 2.3 `investing-basics-for-beginners` — 166 → 944 words

```html
<p><strong>Investing basics come down to four ideas: compound growth, risk versus reward, diversification, and time in the market.</strong> Get your everyday finances in order first, understand these four ideas, keep costs low, and most beginner mistakes disappear.</p>

<h2>Before you invest</h2>
<p>The FCA's own checklist starts before any investing: pay off short-term debt such as credit cards and payday loans, build an emergency cash fund you can reach quickly, and consider paying more into your workplace pension (<a href="https://www.fca.org.uk/investsmart/should-you-invest">FCA, Should you invest?</a>). Only invest money you won't need for at least five years. Investing over five years or longer helps ride out short-term falls (<a href="https://www.fca.org.uk/investsmart/risk-returns">FCA, Risk and returns</a>).</p>

<h2>Compound growth</h2>
<p>When your returns earn their own returns, money grows faster over time. <em>Illustration, not a forecast:</em> £100 a month for 30 years is £36,000 paid in. If it grew at 3% a year after charges, it would be worth about £57,900. At 5% a year, about £81,500. Starting earlier matters more than starting big. £150 a month from age 25 to 65 at 5% grows to about £222,000; the same £150 a month from 35 reaches about £122,000. Try your own numbers in Garzoni's free <a href="/calculators/compound-interest">compound interest calculator</a>.</p>

<h2>Risk and reward</h2>
<p>Higher potential returns come with a higher risk of loss. Cash is stable, but over long periods it can lose value to inflation. The Bank of England's target for inflation is 2% a year (<a href="https://www.bankofengland.co.uk/monetary-policy/inflation">Bank of England</a>). Shares have tended to grow more over long periods, but they rise and fall in value along the way. Match the risk to when you'll need the money.</p>
<p>What a fall feels like, in numbers: if a £10,000 investment drops 20%, it's worth £8,000. To get back to £10,000 it now needs to rise 25%, not 20%, because the rise starts from a smaller base. That recovery can take years, which is why money you need within five years usually belongs in cash, not shares.</p>

<h2>Shares, bonds, cash and funds in plain English</h2>
<ul>
<li><strong>Cash</strong> — savings accounts. Stable value, modest interest, exposed to inflation.</li>
<li><strong>Bonds</strong> — loans to governments or companies that pay interest. Usually less volatile than shares.</li>
<li><strong>Shares</strong> — small slices of companies. Higher long-run growth potential, bigger swings.</li>
<li><strong>Funds</strong> — a pool of many investors' money, invested in lots of shares and/or bonds at once. The FCA's own example of diversifying is keeping some cash, buying some bonds, and adding a fund that invests in shares across international markets (<a href="https://www.fca.org.uk/investsmart/diversification">FCA</a>).</li>
</ul>

<h2>Diversification</h2>
<p>Don't put everything in one company or asset. Spreading your money across different investments that don't rely on the same things to do well means one bad performer does less damage. Funds, which pool money from many investors, let even small investors diversify (<a href="https://www.fca.org.uk/investsmart/diversification">FCA, Diversification</a>). A low-cost index fund that tracks a whole market is a common way to do this.</p>

<h2>Time in the market</h2>
<p>Trying to time the market is hard even for professionals. Investing a regular amount each month over five or more years helps smooth out the effect of short-term market moves (<a href="https://www.fca.org.uk/investsmart/golden-rules-investing">FCA, Golden rules of investing</a>).</p>

<h2>Costs matter more than they look</h2>
<p>Charges come out every year, whether your investments rise or fall, and they compound too. <em>Illustration:</em> £10,000 invested for 25 years at 5% a year before charges ends up at about £32,300 with 0.2% annual charges, and about £23,600 with 1.5%. That's a difference of more than £8,000 from fees alone. The FCA warns that charges "can mount up over time, eating into your investment returns".</p>

<h2>Where UK beginners usually start</h2>
<ul>
<li><strong>Your workplace pension.</strong> If you're automatically enrolled, the minimum is 8% of qualifying earnings, with at least 3% from your employer (<a href="https://www.gov.uk/workplace-pensions/what-you-your-employer-and-the-government-pay">GOV.UK</a>). Pension contributions also get tax relief (<a href="https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief">GOV.UK</a>).</li>
<li><strong>A stocks and shares ISA.</strong> You can put up to £20,000 a year into ISAs in 2026/27, and growth inside an ISA is tax-free (<a href="https://www.gov.uk/individual-savings-accounts">GOV.UK</a>). From 6 April 2027, under-65s will be able to put at most £12,000 of that into cash ISAs; the rest of the allowance stays available for investing (<a href="https://www.gov.uk/government/publications/reduction-in-the-cash-individual-savings-account-isa-limit/cash-individual-savings-account-isa-limit-reduction">GOV.UK</a>).</li>
<li><strong>A Lifetime ISA</strong>, if you're saving for a first home or later life and are under 40. You can pay in up to £4,000 a year and the government adds a 25% bonus, but other withdrawals carry a 25% charge (<a href="https://www.gov.uk/lifetime-isa">GOV.UK</a>).</li>
</ul>

<h2>A simple order of operations</h2>
<p><em>An example, not personal advice:</em> someone with a credit card balance, no savings and a workplace pension might (1) stay enrolled in the pension so they keep the employer contribution, (2) clear the credit card, (3) build an emergency fund in an easy-access savings account, and only then (4) start a regular monthly amount into a low-cost, diversified fund inside a stocks and shares ISA. Each step makes the next one safer, and the order follows the FCA's own checklist above.</p>

<h2>Common mistakes</h2>
<ul>
<li><strong>Investing your emergency fund.</strong> Markets often fall at the same time people lose income. Keep emergency money in cash.</li>
<li><strong>Investing with borrowed money.</strong> The FCA's rule is plain: never invest using a credit card.</li>
<li><strong>Chasing what's hot.</strong> If you only bought because something was trending, you've skipped the risk question.</li>
<li><strong>Ignoring charges.</strong> Compare the total yearly cost, not just the headline fee.</li>
<li><strong>Using an unregulated firm.</strong> Check any firm on the <a href="https://register.fca.org.uk/s/">FCA Register</a> before you invest, and read the FCA's guide to <a href="https://www.fca.org.uk/consumers/protect-yourself-scams">protecting yourself from scams</a>.</li>
</ul>

<p>Garzoni is an education app, not a regulated financial adviser. For the next steps, its free lessons <a href="/learn/how-compound-interest-works">How Compound Interest Works</a>, <a href="/learn/short-term-vs-long-term-goals">Short-Term vs. Long-Term Goals</a> and <a href="/learn/where-to-keep-your-emergency-fund">Where to Keep Your Emergency Fund</a> go deeper.</p>
```

**Before publishing:** the lesson `how-compound-interest-works` still contains the Emma/Luke claim
(mismatch #6). Fix it first, or this guide links to a page that contradicts its own numbers.

FAQ (keep both, add two):
- **How much money do I need to start investing?** (keep)
- **What should beginners invest in?** (keep)
- **How long should I invest for?** — "Only invest money you won't need for at least five years. Over shorter periods, a fall in value is more likely to hit just when you need the money."
- **How do I know an investment firm is legitimate?** — "Check it on the FCA Register before you invest, and be wary of unexpected contact, pressure to act quickly or promises of high, guaranteed returns."

### 2.4 `garzoni-vs-acorns` — 170 → 927 words

Build it with `_guide(..., category="comparison")` (see "How to apply"). The Acorns facts were
checked on acorns.com and acorns.com/pricing on 2026-10-08. Re-check prices before each re-seed.

```html
<p>Acorns is a micro-investing app that rounds up your card purchases and invests the spare change in ready-made portfolios. Garzoni is a personal-finance education app. Acorns automates one habit; Garzoni teaches the ideas behind it, such as risk, compounding, diversification and costs, so you understand what any investing app is doing with your money.</p>

<h2>Garzoni vs Acorns: at a glance</h2>
<table>
<thead><tr><th>What you get</th><th>Garzoni</th><th>Acorns</th></tr></thead>
<tbody>
<tr><td>Primary purpose</td><td>Learn personal finance</td><td>Automated micro-investing</td></tr>
<tr><td>Invests your money</td><td>No — education only</td><td>Yes</td></tr>
<tr><td>Teaches the "why"</td><td>Yes — lessons, quizzes and an AI tutor</td><td>Some learning content alongside the investing tools</td></tr>
<tr><td>Price</td><td>Free Starter plan; paid Plus and Pro plans</td><td>Monthly subscription: Bronze $4, Silver $8, Gold $12</td></tr>
<tr><td>Where it's built for</td><td>UK-first; lessons in English and Romanian</td><td>The US — priced in dollars; banking features for U.S. residents</td></tr>
<tr><td>Platforms</td><td>Web, iOS and Android</td><td>iOS and Android app</td></tr>
<tr><td>Best first step</td><td>Understand investing before you start</td><td>Start investing small amounts automatically</td></tr>
</tbody>
</table>

<h2>The short answer</h2>
<p>Acorns is an easy way to start investing without thinking about it, if you're in the US. But knowing how compound growth, risk, diversification and fees work means you'll make better choices with any investing app. Garzoni teaches those fundamentals.</p>

<h2>How round-ups work, with real numbers</h2>
<p>Acorns' own example: a $2.50 purchase rounds up to $3.00 and invests the $0.50 difference (<a href="https://www.acorns.com/pricing/">Acorns</a>). <em>Illustration:</em> if your round-ups add up to about £30 a month, that's £3,600 over ten years. At an assumed 5% a year after costs, it would grow to about £4,600. Round-ups are a good habit-starter, but on their own they are small amounts. The bigger decisions are how much you invest on purpose and what it costs.</p>

<h2>Fees on small balances</h2>
<p>A flat monthly fee feels small, but on a small balance it's a large percentage. <em>Illustration:</em> a $4 monthly plan costs $48 a year. On a $1,000 balance, that's 4.8% of your money every year, more than many long-run return assumptions. On $5,000, it's under 1%. This isn't unique to Acorns: any flat fee works this way. It's exactly the kind of maths Garzoni's lessons teach you to check. Run your own numbers in the free <a href="/calculators/compound-interest">compound interest calculator</a>.</p>

<h2>If you're in the UK</h2>
<p>Acorns is built for the US market. If you want to invest automatically from the UK, look for a provider authorised by the Financial Conduct Authority. You can check any firm on the <a href="https://register.fca.org.uk/s/">FCA Register</a>. Many UK beginners start with their workplace pension, where employers must contribute at least 3% if you're automatically enrolled (<a href="https://www.gov.uk/workplace-pensions/what-you-your-employer-and-the-government-pay">GOV.UK</a>), or with a stocks and shares ISA, where growth is tax-free and you can pay in up to £20,000 a year in 2026/27 (<a href="https://www.gov.uk/individual-savings-accounts">GOV.UK</a>).</p>

<h2>What Garzoni actually covers</h2>
<ul>
<li>Short lessons on budgeting, saving, emergency funds, debt, credit, tax, insurance and investing basics. Many are free to read on the web, such as <a href="/learn/how-compound-interest-works">How Compound Interest Works</a> and <a href="/learn/short-term-vs-long-term-goals">Short-Term vs. Long-Term Goals</a>.</li>
<li>Quizzes, streaks and XP to build a daily habit.</li>
<li>An AI tutor you can ask questions. The free Starter plan includes a small daily allowance of prompts, and paid plans include more.</li>
<li>No access to your money: Garzoni doesn't hold, move or invest it, and it isn't a regulated financial adviser.</li>
</ul>

<h2>What to learn before you use any investing app</h2>
<p>You don't need a finance degree, just a handful of ideas, and each one maps to a short Garzoni lesson:</p>
<ul>
<li><strong>Have a safety net first</strong> — <a href="/learn/how-much-to-save">How Much to Save</a> and <a href="/learn/where-to-keep-your-emergency-fund">Where to Keep Your Emergency Fund</a>.</li>
<li><strong>Clear expensive debt</strong> — <a href="/learn/good-debt-vs-bad-debt">Good Debt vs. Bad Debt</a>.</li>
<li><strong>Understand growth over time</strong> — <a href="/learn/how-compound-interest-works">How Compound Interest Works</a>.</li>
<li><strong>Match money to timelines</strong> — <a href="/learn/short-term-vs-long-term-goals">Short-Term vs. Long-Term Goals</a>.</li>
</ul>

<h2>Questions to ask any investing app</h2>
<ul>
<li><strong>Is the firm authorised?</strong> In the UK, check it on the <a href="https://register.fca.org.uk/s/">FCA Register</a>.</li>
<li><strong>What does it cost each year, all in?</strong> Charges "can mount up over time, eating into your investment returns" (<a href="https://www.fca.org.uk/investsmart/golden-rules-investing">FCA</a>).</li>
<li><strong>What exactly will my money be invested in, and how diversified is it?</strong></li>
<li><strong>How quickly can I get my money out, and is there a charge for doing so?</strong></li>
</ul>

<h2>Common mistakes when starting with any investing app</h2>
<ul>
<li>Investing before you have an emergency fund or while carrying credit card debt. The <a href="https://www.fca.org.uk/investsmart/should-you-invest">FCA</a> says to sort those out first.</li>
<li>Not knowing what the portfolio holds. Diversified is good; "I don't know" is not.</li>
<li>Ignoring the fee as a percentage of your balance.</li>
<li>Expecting round-ups alone to fund long-term goals.</li>
</ul>

<h2>Using them together</h2>
<p>These apps answer different questions. Acorns answers "how do I start putting money in without thinking about it?" Garzoni answers "what is my money actually doing, and is this a good idea for me?" A sensible order for a beginner is to learn the basics first, make sure the safety net and expensive debt are sorted, and then choose an investing tool — Acorns in the US, or an FCA-authorised provider in the UK — with a clear idea of what you'll pay, what you'll own and how long you'll leave it invested. Knowing those three answers before you sign up is what turns an app from a novelty into a plan.</p>

<h2>Who should pick which</h2>
<p>Choose <strong>Acorns</strong> if you're in the US, already understand the basics, and want a tool that invests small amounts automatically. Choose <strong>Garzoni</strong> if you want to actually <em>learn</em> personal finance — the concepts, the habits and the confidence — so that any tool you pick later makes sense. Many people will want both: learn first, then automate.</p>
```

Verify before publishing:
- **"iOS and Android app" for Acorns.** I didn't extract this from acorns.com. Drop the row if you can't confirm it.
- **"Some learning content alongside the investing tools".** acorns.com/pricing describes Acorns as a "debit card & learning app" and its plans as helping you "grow your financial confidence". Keep the wording modest.
- **"Many are free to read on the web".** True for the 43 public lessons; the full path needs an account.

FAQ (keep both, add one):
- **Does Garzoni invest my money like Acorns?** (keep)
- **What should I learn before investing?** (keep)
- **Can I use Acorns in the UK?** — "Acorns is built for the US: its plans are priced in dollars and its banking features are offered to U.S. residents. In the UK, check any investing app on the FCA Register."

---

## Part 3 — Author page: what the owner must supply

The code is all in place. The profile renders whatever `FOUNDER_AUTHOR` contains, and empty fields
emit nothing. No code changes are needed; these are the gaps.

| # | Field | Where | What to supply | Notes |
| --- | --- | --- | --- | --- |
| 1 | Headshot | `packages/core/src/constants/editorial.ts:40` → `image: ""` | An **absolute https URL** to a square photo (rendered 96×96 and rounded in `AuthorPage.tsx:162-169`, so supply ≥ 192×192, ideally 400×400) | Also used as `Person.image` in JSON-LD (`AuthorPage.tsx:127`) and as the page's OG image (`AuthorPage.tsx:138`). Simplest host: add the file under `frontend/public/` (for example `frontend/public/images/andrei-neagoe.jpg` → `https://www.garzoni.app/images/andrei-neagoe.jpg`). Avoid `/authors/…` as a file path, so it never collides with the `/authors/:slug` route |
| 2 | **Personal** LinkedIn | `editorial.ts:43` → `sameAs: []` | `https://www.linkedin.com/in/<your-handle>` | **Not** `https://www.linkedin.com/company/112599243/`: that is the Garzoni **company** page and already sits in the Organization `sameAs` (`frontend/index.html:281`). Putting it on the Person would tell search engines the company *is* the person. Rendered as an "Elsewhere" link with `rel="me"` (`AuthorPage.tsx:220-240`) |
| 3 | Other personal profiles (optional) | same `sameAs` array | e.g. personal GitHub or X, only if they are clearly you and active | Each extra one strengthens the entity link. Empty strings are filtered out |
| 4 | Credentials (confirm) | `editorial.ts:44-45` → `alumniOf: "Queen Mary University of London"`, `degree: "BSc Computer Science"` | Confirm both are exactly right | Emitted as `alumniOf` + `hasCredential` (`AuthorPage.tsx:102-125`). The type allows **one** degree. Adding a second credential, or a past employer, needs a type change in `EditorialAuthor` and in the JSON-LD (code work; not done) |
| 5 | Experience line (optional, recommended) | `packages/core/src/locales/en/editorial.json` → `author.bio` / `author.education`, **and** `packages/core/src/locales/ro/editorial.json` | 1–2 verifiable sentences on relevant experience (e.g. professional background) | E-E-A-T's "Experience" signal is currently just "founder… writes and edits". Both languages or it ships broken (repo rule). The file header says only verifiable facts belong there |
| 6 | External reviewer (only if one exists) | — | Name, credential, profile URL | `/editorial-standards` says content is not externally reviewed. There is no code support for a reviewer; `Byline.tsx` only shows a "Reviewed {date}" label. Don't add one until a real reviewer exists |

Two related fixes the owner may want, both from the growth audit and not done here: the
Organization LinkedIn should move from the numeric `company/112599243` to the planned vanity URL
(`company/garzoni-app`) once it exists (`frontend/index.html:281`), and `/editorial-standards`
should stay honest. It promises UK sources and tax-year updates, which Part 1 is what delivers.

---

## Sources I could not verify (excluded from all lists above)

These are good sources, but they answered with a bot challenge (403, "Just a moment…") or an
error, so they appear here only as names. Open them in a browser before adding any:
- **MoneyHelper** (moneyhelper.org.uk) — every URL tried returned 403. It's the best UK
  source for emergency-fund sizing, budgeting, payslips and life insurance; add pages by hand.
- **MaPS** (maps.org.uk), **IFS TaxLab** (ifs.org.uk), **MoneySavingExpert**: 403.
- **consumerfinance.gov** (all current CFPB lesson sources): 403 "Access Denied".
- **FGDB** (fgdb.ro), Romania's deposit guarantee fund: 403. **ANPC** (anpc.ro): 503 browser check.
- **Science** (Mullainathan and Shafir), **Wiley** (Lally et al., habit formation),
  **SAGE** (debt-repayment research): 403.
- **HBR**, "Research: The Best Strategy for Paying Off Credit Card Debt" (Trudel, 2016): loaded,
  but only the header was readable, so it isn't used to support any claim.
- **Romanian salary rates (10% / 25% / 10%):** the ANAF Codul fiscal landing page loads (and is
  cited), but the consolidated text is rendered by JavaScript. The static copy I could parse is the
  2016 version (16% rate), and the ANAF regional PDFs would not parse. Confirm the rates in the
  current Codul fiscal (art. 64, 138, 156) before stating them in a lesson.

---

## Appendix — verified URLs (100), HTTP 200 on 2026-10-08, title as seen

| URL | Page title seen |
| --- | --- |
| https://www.gov.uk/income-tax-rates | Income Tax rates and Personal Allowances : Current rates and allowances - GOV.UK |
| https://www.gov.uk/national-insurance/how-much-you-pay | National Insurance: introduction: How much you pay - GOV.UK |
| https://www.gov.uk/national-insurance/what-national-insurance-is-for | National Insurance: introduction: What National Insurance is for - GOV.UK |
| https://www.gov.uk/understanding-your-pay/deductions-from-your-pay | Understanding your pay: Deductions from your pay - GOV.UK |
| https://www.gov.uk/tax-codes/what-your-tax-code-means | Tax codes: What your tax code means - GOV.UK |
| https://www.gov.uk/estimate-income-tax | Estimate your Income Tax for the current year - GOV.UK |
| https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027 | Rates and thresholds for employers 2026 to 2027 - GOV.UK |
| https://www.gov.uk/workplace-pensions | Workplace pensions: About workplace pensions - GOV.UK |
| https://www.gov.uk/workplace-pensions/what-you-your-employer-and-the-government-pay | Workplace pensions: What you, your employer and the government pay - GOV.UK |
| https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief | Tax on your private pension contributions: Tax relief - GOV.UK |
| https://www.gov.uk/annual-tax-summary | Check how the government spends your taxes — Annual Tax Summary - GOV.UK |
| https://www.gov.uk/payslips | Payslips: employee rights - GOV.UK |
| https://www.gov.uk/repaying-your-student-loan | Repaying your student loan: Overview - GOV.UK |
| https://www.gov.uk/individual-savings-accounts | Individual Savings Accounts (ISAs): Overview - GOV.UK |
| https://www.gov.uk/government/publications/reduction-in-the-cash-individual-savings-account-isa-limit/cash-individual-savings-account-isa-limit-reduction | Cash Individual Savings Account (ISA) limit reduction - GOV.UK |
| https://www.gov.uk/lifetime-isa | Lifetime ISA: Overview - GOV.UK |
| https://www.gov.uk/lifetime-isa/withdrawing-money-from-your-lifetime-isa | Lifetime ISA: Withdrawing money from your Lifetime ISA - GOV.UK |
| https://www.gov.uk/government/consultations/first-time-buyer-isa-consultation/first-time-buyer-isa-consultation | First Time Buyer ISA: Consultation - GOV.UK |
| https://www.gov.uk/apply-tax-free-interest-on-savings | Tax on savings interest: Overview - GOV.UK |
| https://www.gov.uk/council-tax | How Council Tax works: Working out your Council Tax - GOV.UK |
| https://www.gov.uk/vehicle-insurance | Vehicle insurance: Overview - GOV.UK |
| https://www.gov.uk/guidance/foreign-travel-insurance | Foreign travel insurance - GOV.UK |
| https://www.gov.uk/consumer-protection-rights | Consumer rights - GOV.UK |
| https://www.gov.uk/renting-out-a-property/paying-tax | Renting out your property: Paying tax and National Insurance - GOV.UK |
| https://www.gov.uk/renting-out-a-property/landlord-responsibilities | Renting out your property: Landlord responsibilities - GOV.UK |
| https://www.gov.uk/guidance/income-tax-when-you-rent-out-a-property-working-out-your-rental-income | Work out your rental income when you let property - GOV.UK |
| https://www.gov.uk/guidance/changes-to-tax-relief-for-residential-landlords-how-its-worked-out-including-case-studies | Tax relief for residential landlords: how it's worked out - GOV.UK |
| https://www.gov.uk/government/publications/changes-to-tax-rates-for-property-savings-and-dividend-income/change-to-tax-rates-for-property-savings-and-dividend-income-technical-note | Change to tax rates for property, savings and dividend income — technical note - GOV.UK |
| https://www.gov.uk/government/collections/private-rental-market-statistics | Valuation Office Agency: private rental market statistics - GOV.UK |
| https://www.gov.uk/guidance/renters-rights-act-an-overview-for-landlords | Renters' Rights Act: an overview for landlords - GOV.UK |
| https://www.gov.uk/assured-tenancy-agreements-a-guide-for-landlords/rent-increases | Assured periodic tenancies: a guide for landlords: Rent increases - GOV.UK |
| https://www.gov.uk/government/publications/guide-to-the-renters-rights-act/guide-to-the-renters-rights-act | Guide to the Renters’ Rights Act - GOV.UK |
| https://www.legislation.gov.uk/ukpga/2015/15/section/22 | Consumer Rights Act 2015 (s.22 "Time limit for short-term right to reject") |
| https://www.legislation.gov.uk/ukpga/2015/15/contents | Consumer Rights Act 2015 |
| https://www.fca.org.uk/consumers/buy-now-pay-later | Buy Now Pay Later \| FCA |
| https://www.fca.org.uk/data/changes-overdraft-charges | Changes to overdraft charges |
| https://www.fca.org.uk/news/press-releases/fca-confirms-biggest-shake-up-overdraft-market | FCA confirms biggest shake-up to the overdraft market for a generation |
| https://www.fca.org.uk/investsmart/should-you-invest | Should you invest? |
| https://www.fca.org.uk/investsmart/golden-rules-investing | The golden rules of investing |
| https://www.fca.org.uk/investsmart/risk-returns | Risk and returns |
| https://www.fca.org.uk/investsmart/diversification | Diversification |
| https://www.fca.org.uk/publications/policy-statements/ps19-18-restricting-contract-difference-products | PS19/18: Restricting contract for difference products sold to retail clients |
| https://www.fca.org.uk/consumers/protect-yourself-scams | Protect yourself from scams |
| https://register.fca.org.uk/s/ | NewRegister (FCA Financial Services Register) |
| https://www.fca.org.uk/financial-lives | Financial Lives survey |
| https://www.bankofengland.co.uk/explainers/how-is-money-created | How is money created? \| Bank of England – the UK's central bank |
| https://www.bankofengland.co.uk/explainers/what-are-interest-rates | What are interest rates? \| Bank of England – the UK's central bank |
| https://www.bankofengland.co.uk/explainers/what-is-inflation | What is inflation? |
| https://www.bankofengland.co.uk/monetary-policy/inflation | Inflation and the 2% target \| Bank of England – the UK's central bank |
| https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate | Interest rates and Bank Rate: our latest decision |
| https://www.bankofengland.co.uk/explainers/what-is-the-financial-services-compensation-scheme | What is the FSCS and what is the new deposit protection limit? |
| https://www.bankofengland.co.uk/prudential-regulation/publication/2025/november/depositor-protection-policy-statement | PS24/25 – Depositor protection |
| https://www.bankofengland.co.uk/prudential-regulation/publication/2016/underwriting-standards-for-buy-to-let-mortgage-contracts-ss | Underwriting standards for buy-to-let mortgage contracts |
| https://www.fscs.org.uk/what-we-cover/banks-building-societies-credit-unions/ | See how FSCS protects banks, building societies and credit unions \| FSCS |
| https://www.fscs.org.uk/check/check-your-money-is-protected/ | Bank & savings protection checker \| Check your money is protected |
| https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/latest | Private rent and house prices, UK - Office for National Statistics |
| https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23 | CPI ANNUAL RATE 00: ALL ITEMS 2015=100 - Office for National Statistics |
| https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/privaterentalmarketsummarystatisticsinengland | Private rental market summary statistics in England - Office for National Statistics ("Next release: Discontinued") |
| https://www.citizensadvice.org.uk/debt-and-money/budgeting1/ | Budgeting - Citizens Advice |
| https://www.citizensadvice.org.uk/debt-and-money/help-with-debt/ | Help with debt - Citizens Advice |
| https://www.citizensadvice.org.uk/debt-and-money/help-with-debt/dealing-with-your-debts/work-out-which-debts-to-deal-with-first/ | Work out which debts to deal with first - Citizens Advice |
| https://www.citizensadvice.org.uk/debt-and-money/borrowing-money/ | Borrowing money - Citizens Advice |
| https://www.citizensadvice.org.uk/debt-and-money/borrowing-money/how-lenders-decide-whether-to-give-you-credit/ | How lenders decide whether to give you credit - Citizens Advice |
| https://www.citizensadvice.org.uk/debt-and-money/banking/ | Banking - Citizens Advice |
| https://www.citizensadvice.org.uk/consumer/insurance/ | Insurance - Citizens Advice |
| https://www.citizensadvice.org.uk/consumer/somethings-gone-wrong-with-a-purchase/return-faulty-goods/ | Return faulty goods - Citizens Advice |
| https://www.citizensadvice.org.uk/consumer/somethings-gone-wrong-with-a-purchase/claim-using-a-warranty-or-guarantee/ | Claim using a warranty or guarantee - Citizens Advice |
| https://www.nhs.uk/every-mind-matters/lifes-challenges/money-worries-mental-health/ | Money worries and mental health - Every Mind Matters - NHS |
| https://www.nhs.uk/using-the-nhs/healthcare-abroad/apply-for-a-free-uk-global-health-insurance-card-ghic/ | Applying for healthcare cover abroad (GHIC and EHIC) - NHS |
| https://www.stepchange.org/ | StepChange Debt Charity. Free Expert Debt Help & Advice |
| https://www.stepchange.org/debt-info/how-to-make-a-budget.aspx | Making A Budget Plan. Free Templates & Help. StepChange |
| https://www.currentaccountswitch.co.uk/ | Home (Current Account Switch Service) |
| https://www.financial-ombudsman.org.uk/ | Financial Ombudsman Service: Our homepage – Financial Ombudsman service |
| https://ico.org.uk/for-the-public/credit/ | Credit (ICO) |
| https://www.experian.co.uk/consumer/guides/improve-credit-score.html | How To Improve Your Credit Score |
| https://www.experian.co.uk/consumer/guides/searches-and-credit-checks.html | What is a Credit Check? |
| https://www.equifax.co.uk/resources/loans-and-credit/how-to-improve-your-credit-score-quickly.html | How to improve your credit score quickly |
| https://www.abi.org.uk/policy-and-guidance/general-insurance/personal-insurance/home-insurance | Home insurance (ABI) |
| https://www.abi.org.uk/policy-and-guidance/general-insurance/personal-insurance/motor-insurance | Motor insurance (ABI) |
| https://www.abi.org.uk/policy-and-guidance/general-insurance/personal-insurance/travel-insurance | Travel insurance (ABI) |
| https://www.which.co.uk/money/insurance/home-and-mobile-insurance/home-insurance-explained/buildings-insurance-explained-autSN4w7iCBI | Best buildings insurance 2026 - Which? |
| https://www.which.co.uk/money/insurance/life-insurance-and-protection/best-term-life-insurance-abB1g3e4pLmE | Best life insurance UK 2026: quotes and costs compared - Which? |
| https://www.which.co.uk/money/banking/bank-accounts | Bank Accounts - Which? |
| https://www.which.co.uk/money/savings-and-isas | Savings & ISAs - Which? |
| https://www.which.co.uk/consumer-rights/regulation/consumer-rights-act-aKJYx8n5KiSl | Consumer Rights Act 2015 - Which? |
| https://journals.newprairiepress.org/jft/article/id/5669/ | Money Beliefs and Financial Behaviors: Development of the Klontz Money Script Inventory |
| https://www.esma.europa.eu/press-news/esma-news/esma-agrees-prohibit-binary-options-and-restrict-cfds-protect-retail-investors | ESMA agrees to prohibit binary options and restrict CFDs to protect retail investors |
| https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/CustomerAdvisory_MustKnowForex.html | Customer Advisory: Eight Things You Should Know Before Trading Forex \| CFTC |
| https://finance.ec.europa.eu/banking/banking-regulation/deposit-guarantee-schemes_en | Deposit guarantee schemes - Finance - European Commission |
| https://europa.eu/youreurope/citizens/consumers/shopping/guarantees-returns/index_en.htm | Guarantees on goods bought in the EU - Your Europe |
| https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator | Compound Interest Calculator \| Investor.gov |
| https://consumer.gov/your-money/budget-worksheet | Budget Worksheet \| consumer.gov (FTC; existing source, recommended for replacement) |
| https://www.nerdwallet.com/article/finance/mint-app-closing-what-it-means-how-to-pick-a-new-budget-service | Mint App Closing: How to Pick New Budget Service - NerdWallet (evidence for mismatch #13 only) |
| https://www.acorns.com/ | Easy Investing App For Saving & Growing Your Money |
| https://www.acorns.com/pricing/ | Pricing |
| https://www.bnr.ro/ | BNR Banca Națională a României (BNR) |
| https://asfromania.ro/ | Autoritatea de Supraveghere Financiară |
| https://asfromania.ro/ro/a/820/precizari-privind-asigurarea-rca-pentru-pagube-produse-tertilor-prin-accidente-de-autovehicule | Autoritatea de Supraveghere Financiară - Precizari privind asigurarea RCA pentru pagube produse tertilor prin accidente de autovehicule |
| https://www.anaf.ro/anaf/internet/ANAF/asistenta_contribuabili/legislatie/codul_fiscal/ | Codul fiscal (ANAF; "actualizat în data de 17.12.2025") |
| https://www.paidromania.ro/ | POOL-UL DE ASIGURARE ÎMPOTRIVA DEZASTRELOR NATURALE (redirects to padrom.ro) |

Notes on redirects: `gov.uk/annual-tax-summary` → `/guidance/annual-tax-summary`;
`citizensadvice.org.uk/debt-and-money/budgeting/budgeting/` → `/budgeting1/` (the canonical one is
listed); `fca.org.uk/scamsmart` → `/consumers/protect-yourself-scams` (listed); `paidromania.ro` →
`padrom.ro`. Store the final URLs in `source_url` to avoid a redirect hop.
