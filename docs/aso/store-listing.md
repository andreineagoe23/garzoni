# Store listing copy — canonical (App Store + Google Play)

Single source of truth for store text from 2026-09-27. Supersedes `docs/prod/aso-1.1.5.md`,
`docs/seo/phase-2-aso-copy.md` and `docs/aso/play-listing-assets-2026-07.md` (copy sections).

## Rules

- **Truthful numbers only.** Prod has ~175 lessons across 35 courses; copy says **150+** so it
  stays true as content moves. No exercise counts, no "∞", no "offline-first".
- Free tier = 3 learning activities a day. Plus £6.99/mo or £59.99/yr, Pro £7.99/mo or £69.99/yr
  (`docs/prod/subscription-matrix.md`).
- UK spelling in English. Romanian with diacritics (keyword field without — users type without).
- Every release carries "What's new" in en + ro.

## Where it lives

- **iOS**: `eas metadata:pull` writes `mobile/store.config.json` (gitignored — it holds the App
  Review phone and demo login). Edit, then `eas metadata:push` **only while a version is editable
  in App Store Connect** (i.e. after uploading 1.2.1, before submitting for review). Title,
  subtitle, description, keywords, what's new and screenshots are locked on a live version; only
  promo text changes anytime.
- **Play**: Play Console → Grow → Store presence, or the Play API (the update replaces the whole
  listing — always send title, short description, full description and video together).
- **Screenshots / feature graphic**: `store-assets/` pipeline.

---

## App Store — English (UK)

| Field | Value | Limit |
|---|---|---|
| Title | `Garzoni: Learn Money & Finance` | 30/30 |
| Subtitle | `Investing & Budgeting Lessons` | 29/30 |
| Keywords | `personal,financial,literacy,course,quiz,beginner,stocks,crypto,saving,credit,debt,pension,isa` | 93/100 bytes |
| Promo text | Five minutes a day, 150+ bite-sized lessons and an AI money tutor. Build a budget, start investing and keep your streak alive with smarter reminders. | 149/170 |

Keywords never repeat title/subtitle words (Apple indexes those already). Changed 2026-09-27:
added `personal` (for "personal finance"), `budgeting`, `investing`; dropped `course`, `etf`,
`tax`, `education`, `isa`.
Changed 2026-10-02 (`docs/audit/growth-audit-2026-10.md` S2): head terms like "budgeting" and
"personal finance" are owned by apps with 26k–79k ratings, and every rank we hold is an education
long-tail ("finance learning" #25, "money lessons" #51). `budgeting`/`investing` moved into the
subtitle next to `Lessons` (indexes "budgeting lessons", "learn investing"); `course`, `quiz`, `isa`
back in keywords.

Description (3672/4000):

```
Garzoni is a financial literacy app that teaches personal finance in 5 minutes a day. From your first budget to your first stock, Garzoni turns budgeting, saving, investing, real estate, crypto and forex into 150+ bite-sized lessons you'll actually finish.

No jargon. No overwhelm. Just clear steps that build real financial confidence, whether you're a complete beginner or levelling up your money skills.

WHY GARZONI
• 150+ short lessons in guided learning paths, from budgeting basics to investing
• The Climb: a personalised, step-by-step finance journey built around your goals
• Learn by doing: practice exercises, quizzes and budget simulations
• AI money tutor: ask anything and get a plain-English answer
• Stay motivated: XP, coins, missions, streaks and a global leaderboard
• Learn in English or Romanian

WHAT YOU'LL LEARN
• Budgeting: build your first budget, track spending and stop living payday to payday
• Saving money: emergency funds, savings goals and the power of compound interest
• Investing for beginners: how stocks, index funds and ETFs work
• Stock market basics: shares, dividends and building long-term wealth
• Crypto basics: what Bitcoin and blockchain actually are, minus the hype
• Real estate: how property investing works
• Forex: how currency markets move and what drives exchange rates
• Credit and debt: credit scores, paying off debt and borrowing smart
• Money psychology: the habits and biases that shape how you spend and save

REAL TOOLS, NOT JUST THEORY
• Budget Planner: see spending by category with budget envelopes
• Savings Goal Calculator: find out how long a goal takes at your saving rate
• Portfolio Analyzer: see how your investments really perform
• Market Explorer: understand stocks, funds and crypto at a glance
• Statement Import: upload a bank statement and see where the month went
• Receipt Scan (Pro): upload a photo of a receipt and let Garzoni categorise it

THE CLIMB: YOUR PERSONAL FINANCE JOURNEY
Answer a few quick questions and get a learning path built around your goals: saving your first £1,000, understanding investing, buying a home or getting out of debt. Every step unlocks the next, so you always know what to learn today.

BUILD THE HABIT
Learning personal finance works like learning a language: a little every day beats a lot once a month. Daily reminders and streak alerts keep your 5-minute money lesson on track, and missions and XP make it feel like a game, not a chore. Refer a friend and you both get rewarded.

FAQ
Is Garzoni free? Yes. Start free with 3 learning activities a day. Garzoni Plus unlocks unlimited learning, and Garzoni Pro adds the voice tutor and receipt scanning.
Do I need any finance knowledge? None at all. Lessons start from zero and grow with you.
How long is a lesson? About 5 minutes, built for commutes, coffee breaks and queues.
Is this financial advice? No. Garzoni is a financial education app. We teach the skills; the decisions stay yours.

Whether you want to learn how to budget, start investing, understand the stock market or finally feel in control of your money, Garzoni is the personal finance course that fits in your pocket.

Start free today. Master your money, one lesson at a time.

SUBSCRIPTIONS
Garzoni Plus: £6.99/month or £59.99/year
Garzoni Pro: £7.99/month or £69.99/year
Prices in GBP and may vary by region. Payment is charged to your Apple ID at confirmation. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store account settings.
Privacy Policy: https://garzoni.app/privacy-policy
Terms of Use (EULA): https://garzoni.app/terms-of-service
```

## App Store — Romanian (new; not live yet)

| Field | Value | Limit |
|---|---|---|
| Title | `Garzoni: Educație Financiară` | 28/30 |
| Subtitle | `Buget, investiții și economii` | 29/30 |
| Keywords | `bani,finante,buget,economii,investitii,actiuni,bursa,crypto,credit,datorii,pensie,curs,lectii` | 93/100 bytes |
| Promo text | Cinci minute pe zi, peste 150 de lecții scurte și un tutor AI pentru bani. Fă-ți primul buget, începe să investești și păstrează-ți seria zilnică. | 146/170 |

Description (3456/4000):

```
Garzoni este aplicația ta de educație financiară: înveți finanțe personale în 5 minute pe zi. De la primul tău buget până la prima acțiune la bursă, Garzoni transformă bugetul, economiile, investițiile, imobiliarele și crypto în peste 150 de lecții scurte pe care chiar le vei termina.

Fără jargon. Fără stres. Doar pași clari care îți construiesc încredere financiară reală, fie că ești începător complet, fie că vrei să-ți duci abilitățile la nivelul următor.

DE CE GARZONI
• Peste 150 de lecții scurte, organizate pe trasee de învățare, de la bazele bugetului la investiții
• The Climb: un traseu financiar personalizat, pas cu pas, construit în jurul obiectivelor tale
• Înveți exersând: exerciții interactive, quiz-uri și simulări de buget
• Tutor AI pentru bani: întreabă orice și primești un răspuns pe înțelesul tău
• Rămâi motivat: XP, monede, misiuni, serii zilnice și clasament global
• Înveți în română sau în engleză

CE VEI ÎNVĂȚA
• Buget: construiește primul tău buget și nu mai trăi de la un salariu la altul
• Economisire: fond de urgență, obiective de economisire și puterea dobânzii compuse
• Investiții pentru începători: cum funcționează acțiunile, fondurile indexate și ETF-urile
• Bazele bursei: acțiuni, dividende și construirea averii pe termen lung
• Bazele crypto: ce sunt cu adevărat Bitcoin și blockchain, fără hype
• Imobiliare: cum funcționează investițiile în proprietăți
• Credit și datorii: scor de credit, plata datoriilor și împrumuturi inteligente
• Psihologia banilor: obiceiurile care îți modelează felul în care cheltuiești și economisești

INSTRUMENTE REALE, NU DOAR TEORIE
• Planificator de buget: cheltuieli pe categorii, cu plicuri de buget
• Calculator de economii: află cât durează să atingi un obiectiv
• Analizor de portofoliu: vezi cum performează cu adevărat investițiile tale
• Explorator de piață: înțelege acțiuni, fonduri și crypto dintr-o privire
• Import extras de cont: încarcă un extras și vezi unde s-au dus banii luna asta
• Scanare bon (Pro): alege o poză cu bonul și Garzoni îl încadrează pe categorii

CONSTRUIEȘTE OBICEIUL
Educația financiară funcționează ca învățarea unei limbi străine: puțin în fiecare zi bate mult o dată pe lună. Memento-urile zilnice și alertele de serie îți păstrează lecția de 5 minute pe drumul cel bun. Recomandă un prieten și amândoi primiți recompense.

ÎNTREBĂRI FRECVENTE
Este Garzoni gratuit? Da. Începi gratuit, cu 3 activități de învățare pe zi. Garzoni Plus deblochează învățarea nelimitată, iar Garzoni Pro adaugă tutorul vocal și scanarea bonurilor.
Am nevoie de cunoștințe financiare? Deloc. Lecțiile pornesc de la zero și cresc odată cu tine.
Cât durează o lecție? Aproximativ 5 minute, perfecte pentru navetă sau pauza de cafea.
Este consultanță financiară? Nu. Garzoni este o aplicație de educație financiară. Noi te învățăm abilitățile; deciziile îți aparțin.

Începe gratuit azi. Stăpânește-ți banii, lecție cu lecție.

ABONAMENTE
Garzoni Plus și Garzoni Pro sunt disponibile lunar sau anual. Prețul exact apare în aplicație înainte de plată și poate varia în funcție de țară. Plata se face prin contul tău Apple ID la confirmare. Abonamentele se reînnoiesc automat dacă nu le anulezi cu cel puțin 24 de ore înainte de sfârșitul perioadei curente. Le poți gestiona sau anula oricând din setările contului App Store.
Politica de confidențialitate: https://garzoni.app/privacy-policy
Termeni de utilizare (EULA): https://garzoni.app/terms-of-service
```

---

## Google Play — English (UK), default language

| Field | Value | Limit |
|---|---|---|
| Title | `Garzoni: Learn Money & Finance` | 30/30 |
| Short description | `Learn personal finance in 5-min lessons: budgeting, investing & money skills.` | 77/80 |
| Video | https://youtu.be/IQ3LXX4RoH0 | |

Full description — replaces the live one, which still says "500+ lessons" (3208/4000):

```
Garzoni is a financial literacy app that teaches personal finance in 5 minutes a day. From your first budget to your first stock, Garzoni turns budgeting, saving, investing, real estate, crypto and forex into 150+ bite-sized lessons you'll actually finish.

No jargon. No overwhelm. Just clear steps that build real financial confidence, whether you're a complete beginner or levelling up your money skills.

WHY GARZONI
• 150+ short lessons in guided learning paths, from budgeting basics to investing
• The Climb: a personalised, step-by-step finance journey built around your goals
• Learn by doing: practice exercises, quizzes and budget simulations
• AI money tutor: ask anything and get a plain-English answer
• Stay motivated: XP, coins, missions, streaks and a global leaderboard
• Learn in English or Romanian

WHAT YOU'LL LEARN
• Budgeting: build your first budget, track spending and stop living payday to payday
• Saving money: emergency funds, savings goals and the power of compound interest
• Investing for beginners: how stocks, index funds and ETFs work
• Stock market basics: shares, dividends and building long-term wealth
• Crypto basics: what Bitcoin and blockchain actually are, minus the hype
• Real estate: how property investing works
• Forex: how currency markets move and what drives exchange rates
• Credit and debt: credit scores, paying off debt and borrowing smart
• Money psychology: the habits and biases that shape how you spend and save

REAL TOOLS, NOT JUST THEORY
• Budget Planner: see spending by category with budget envelopes
• Savings Goal Calculator: find out how long a goal takes at your saving rate
• Portfolio Analyzer: see how your investments really perform
• Market Explorer: understand stocks, funds and crypto at a glance
• Statement Import: upload a bank statement and see where the month went
• Receipt Scan (Pro): upload a photo of a receipt and let Garzoni categorise it

THE CLIMB: YOUR PERSONAL FINANCE JOURNEY
Answer a few quick questions and get a learning path built around your goals: saving your first £1,000, understanding investing, buying a home or getting out of debt. Every step unlocks the next, so you always know what to learn today.

BUILD THE HABIT
Learning personal finance works like learning a language: a little every day beats a lot once a month. Daily reminders and streak alerts keep your 5-minute money lesson on track, and missions and XP make it feel like a game, not a chore. Refer a friend and you both get rewarded.

FAQ
Is Garzoni free? Yes. Start free with 3 learning activities a day. Garzoni Plus unlocks unlimited learning, and Garzoni Pro adds the voice tutor and receipt scanning.
Do I need any finance knowledge? None at all. Lessons start from zero and grow with you.
How long is a lesson? About 5 minutes, built for commutes, coffee breaks and queues.
Is this financial advice? No. Garzoni is a financial education app. We teach the skills; the decisions stay yours.

Whether you want to learn how to budget, start investing, understand the stock market or finally feel in control of your money, Garzoni is the personal finance course that fits in your pocket.

Start free today. Master your money, one lesson at a time.
```

## Google Play — Romanian (live since 2026-09-26; upgrade to this)

| Field | Value | Limit |
|---|---|---|
| Title | `Garzoni: Educație Financiară` | 28/30 |
| Short description | `Învață finanțe personale în lecții de 5 minute: buget, investiții, bani.` | 72/80 |

Full description (2927/4000):

```
Garzoni este aplicația ta de educație financiară: înveți finanțe personale în 5 minute pe zi. De la primul tău buget până la prima acțiune la bursă, Garzoni transformă bugetul, economiile, investițiile, imobiliarele și crypto în peste 150 de lecții scurte pe care chiar le vei termina.

Fără jargon. Fără stres. Doar pași clari care îți construiesc încredere financiară reală, fie că ești începător complet, fie că vrei să-ți duci abilitățile la nivelul următor.

DE CE GARZONI
• Peste 150 de lecții scurte, organizate pe trasee de învățare, de la bazele bugetului la investiții
• The Climb: un traseu financiar personalizat, pas cu pas, construit în jurul obiectivelor tale
• Înveți exersând: exerciții interactive, quiz-uri și simulări de buget
• Tutor AI pentru bani: întreabă orice și primești un răspuns pe înțelesul tău
• Rămâi motivat: XP, monede, misiuni, serii zilnice și clasament global
• Înveți în română sau în engleză

CE VEI ÎNVĂȚA
• Buget: construiește primul tău buget și nu mai trăi de la un salariu la altul
• Economisire: fond de urgență, obiective de economisire și puterea dobânzii compuse
• Investiții pentru începători: cum funcționează acțiunile, fondurile indexate și ETF-urile
• Bazele bursei: acțiuni, dividende și construirea averii pe termen lung
• Bazele crypto: ce sunt cu adevărat Bitcoin și blockchain, fără hype
• Imobiliare: cum funcționează investițiile în proprietăți
• Credit și datorii: scor de credit, plata datoriilor și împrumuturi inteligente
• Psihologia banilor: obiceiurile care îți modelează felul în care cheltuiești și economisești

INSTRUMENTE REALE, NU DOAR TEORIE
• Planificator de buget: cheltuieli pe categorii, cu plicuri de buget
• Calculator de economii: află cât durează să atingi un obiectiv
• Analizor de portofoliu: vezi cum performează cu adevărat investițiile tale
• Explorator de piață: înțelege acțiuni, fonduri și crypto dintr-o privire
• Import extras de cont: încarcă un extras și vezi unde s-au dus banii luna asta
• Scanare bon (Pro): alege o poză cu bonul și Garzoni îl încadrează pe categorii

CONSTRUIEȘTE OBICEIUL
Educația financiară funcționează ca învățarea unei limbi străine: puțin în fiecare zi bate mult o dată pe lună. Memento-urile zilnice și alertele de serie îți păstrează lecția de 5 minute pe drumul cel bun. Recomandă un prieten și amândoi primiți recompense.

ÎNTREBĂRI FRECVENTE
Este Garzoni gratuit? Da. Începi gratuit, cu 3 activități de învățare pe zi. Garzoni Plus deblochează învățarea nelimitată, iar Garzoni Pro adaugă tutorul vocal și scanarea bonurilor.
Am nevoie de cunoștințe financiare? Deloc. Lecțiile pornesc de la zero și cresc odată cu tine.
Cât durează o lecție? Aproximativ 5 minute, perfecte pentru navetă sau pauza de cafea.
Este consultanță financiară? Nu. Garzoni este o aplicație de educație financiară. Noi te învățăm abilitățile; deciziile îți aparțin.

Începe gratuit azi. Stăpânește-ți banii, lecție cu lecție.
```

---

## What's new — 1.2.1

en:

```
Cleaner rating prompt. Voice tutor rebuilt on a newer audio engine. Money now shows in pounds across the tools. Fewer permissions: Garzoni no longer asks for camera access on Android.
```

ro:

```
Solicitare de evaluare simplificată. Tutorul vocal folosește un motor audio nou. Sumele apar acum în lire sterline în toate instrumentele. Mai puține permisiuni: pe Android, Garzoni nu mai cere acces la cameră.
```
