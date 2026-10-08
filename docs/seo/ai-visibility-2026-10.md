# AI / search visibility baseline — month zero (2026-10-08)

Item **M5** of `docs/audit/growth-audit-2026-10.md` §6. Re-run the same queries monthly and
diff against this file.

## Summary

1. **Garzoni shows up in 0 of the 10 §6 prompts and 0 of the 3 Romanian prompts.** garzoni.app
   never appears in any result for an unbranded query.
2. **The brand barely resolves.** `garzoni.app` and `Garzoni personal finance` return the Venetian painter,
   Wikipedia surnames and unrelated "Garzón/Garzona" apps. Only queries with extra product words
   ("Garzoni app personal finance learning") surface the **App Store page**. That snippet still
   says **"500+ lessons"**, the same truthfulness problem as audit A4/A7, and it is what an assistant would quote.
3. **Competitors that answer our prompts:** Zogo, Nibble, YNAB, Mint (shut down in 2024 and still
   recommended), Cleo, Emma, GoHenry, Snoop, Monzo, **Finance Academy** (a direct UK competitor:
   "the UK's most comprehensive personal finance education app"), Money Masters, Finlingo, Doshi,
   Finny, FunFi, Fintelify. In Romania the results are kids' apps (Kids – o afacere de succes) and
   **MiM** (Iancu Guda / A.S.S.E.T., adult-focused). The adult gamified niche in Romanian is still empty.
4. **Off-site entity: none.** No Wikidata item, no Wikipedia article. Not listed on Product Hunt,
   SaaSHub, BetaList or AlternativeTo. All four were verified directly this time (§4), so the
   AlternativeTo result is no longer UNVERIFIED. The one third-party page that exists is an auto-generated
   mwm.ai tracker page.
5. **Outreach is concentrated in a few places:** UK student-money listicles (findamasters, 11fs,
   beststudenthalls, uniacco, TEG/UWS), two "best financial literacy app" roundups (itechguides,
   tms-outsource), and Romanian press (forbes.ro, edupedu, hotnews, economedia, financiarul,
   stirileprotv). The ranked list is in §5.

**KPI baseline for §6 "AI prompt mentions":** 0/10 prompts on the search proxy. The §6 target counts
10 prompts × 4 assistants (0/40 → 4/40). That has **not** been measured directly; see the caveat below.

## 1. Method and caveats

- **Proxy, not assistant output.** These are results from the Claude Code `WebSearch` tool
  (standard mode; extended mode only where standard results were thin or off-topic). They
  approximate what an assistant *with web search* retrieves before it answers. **This is not
  ChatGPT, Perplexity, Gemini or Claude output**: each assistant uses its own index (Bing for
  ChatGPT and Copilot, Google for Gemini and AI Overviews, a proprietary index for Perplexity), and its own ranking and
  memory. To get the real §6 number, paste the 10 prompts into all four assistants and record each one.
- **The search tool is US-only.** UK and Romanian prompts were run from a US vantage point, so the
  `.ac.uk` and `.ro` results are what a US-located index returns for those strings. Real UK and RO
  users will see a somewhat different SERP.
- "Position" is the rank in the result list the tool returned (about 9–10 links per query), not a
  Google rank.
- `site:` operators are **ignored** by this tool (every `site:` query returned off-domain
  results). Directory presence was therefore checked by direct HTTP probes with a control URL (§4).
- Prompts were run verbatim from §6. Two had off-intent SERPs. A labelled variant was run for
  one of them, and the variant does not replace the verbatim result.

## 2. Per-prompt results (EN, from §6)

### P1 · `best app to learn personal finance`

| Prompt | Garzoni present? | Position | Competitors | Top publisher URLs |
| --- | --- | --- | --- | --- |
| best app to learn personal finance | No | — | Nibble, Zogo, Squirrel, Mint, YNAB | 1. nibble-app.com/blog/best-app-for-personal-finance-learners (owned by competitor Nibble) · 3. itechguides.com/best/financial-literacy-apps/ · 6. supermoney.com/personal-finance-apps · 7–8. harvardfcu.org/blog/6-financial-apps-worth-looking-into/ · 9. oregonianscu.com (2019) |

The top result is a competitor's own blog. Its pattern ("best X for learners" with your own app at
#1) is copyable on garzoni.app.

### P2 · `duolingo for money`

| Prompt | Garzoni present? | Position | Competitors | Top publisher URLs |
| --- | --- | --- | --- | --- |
| duolingo for money | No | — | none (SERP is about Duolingo's revenue) | fool.com, productmint.com, fourweekmba.com: all "how does Duolingo make money". Standard and extended gave the same result. |
| *variant:* duolingo for finance app | No | — | Finlingo, Doshi, Finny | 1. producthunt.com/p/finlingo-2/finlingo-3 · 2. indiehackers.com/post/can-this-be-duolingo-for-financial-education-f94c85eb77 · 3. komo.ai/directory/duolingo · 7. wellfound.com/company/doshi-app |

Product Hunt and Indie Hackers own the "Duolingo for finance" framing. This supports Phase 4 item 3.

### P3 · `best financial literacy app UK`

| Prompt | Garzoni present? | Position | Competitors | Top publisher URLs |
| --- | --- | --- | --- | --- |
| best financial literacy app UK | No | — | **Finance Academy**, Cleo, Emma, GoHenry, Financielle, Snoop, Plum, Money Dashboard | 1. grandavehousing.calpoly.edu (parasite spam, ignore) · 2–3. 11fs.com/article/4-fintechs-teaching-the-uk-about-money (+content.11fs.com mirror) · 4,8. mwm.ai/apps/finance-academy/6772466342 · 5. startups.co.uk/startups-100/ · 9. cbinsights.com/company/money-dashboard |

### P4 · `app to learn investing for beginners`

| Prompt | Garzoni present? | Position | Competitors | Top publisher URLs |
| --- | --- | --- | --- | --- |
| app to learn investing for beginners | No | — | Learn Stocks (MyWallSt), Stash, Invstr, Acorns, Betterment, Rubicoin | 1. essence.com/…/3-apps-to-help-beginners-learn-how-to-invest… · 2. apps.apple.com/us/app/-/id997762888 · 3. udemy.com/course/investing-for-beginners-101/ · 4. nasdaq.com/articles/5-best-investing-apps-for-beginners-2021-08-16 · 8. apartmenttherapy.com/best-investment-apps-for-beginners-36897732 |

### P5 · `budgeting app for students UK`

| Prompt | Garzoni present? | Position | Competitors | Top publisher URLs |
| --- | --- | --- | --- | --- |
| budgeting app for students UK | No | — | Yolt, Monzo, Wally, TopCashback, Splitwise, Moneybox, Curve, Cleo, Emma, Snoop, Plum, Revolut, YNAB, Goodbudget, Chip | 1,4. findamasters.com/blog/11728/top-budgeting-apps-for-students-ways-to-manage-your-money · 2. international-blogs.ncl.ac.uk/blog/student-budgeting-apps-to-support-your-finances (now 404) · 3. uwslondon.ac.uk/best-student-budgeting-apps/ (301 → teg.london) · 6. beststudenthalls.com/blog/best-budgeting-apps-international-students/ · 7. my.cumbria.ac.uk/…/Money-Doctors/Budgeting-Resources · 8. uniacco.com/blog/best-budgeting-apps-for-international-students |

This SERP is entirely student-housing and university pages. It is the best-fitting UK outreach cluster (Phase 4 item 4).

### P6 · `how can I learn about money as a young adult`

| Prompt | Garzoni present? | Position | Competitors | Top publisher URLs |
| --- | --- | --- | --- | --- |
| how can I learn about money as a young adult | No | — | none named (Khan Academy is the only product-like result) | 1. cccu.ca · 2. blog.khanacademy.org (Money Skills for Young Adults) · 3,6. consumerfinance.gov/consumer-tools/money-as-you-grow/… · 7. unbiased.co.uk/…/what-are-the-10-best-financial-tips-for-young-adults · 9. financialliteracy.extension.uconn.edu |

This is an informational SERP. Only a garzoni.app guide page can win it, not a listicle (Phase 3 content).

### P7 · `Zogo alternatives`

| Prompt | Garzoni present? | Position | Competitors | Top publisher URLs |
| --- | --- | --- | --- | --- |
| Zogo alternatives (standard) | No | — | Zogo only | Credit-union pages about Zogo: cuinsight.com (×3), tucsonfcu.com, figfcu.org/zogo, centra.org, builtinaustin.com |
| Zogo alternatives (extended) | No | — | Debbie, Doshi, Strive, Copper, NerdWallet, Khan Academy, Investmate, Greenlight, RoosterMoney, YNAB, PocketGuard, Acorns, Stash | 1,4. cbinsights.com/company/zogo-finance/alternatives-competitors · 2. owler.com/company/zogotech · 3. tms-outsource.com/blog/posts/apps-like-zogo/ · 5. apkfab.com/…/alternatives · 9. quora.com/Which-company-develops-apps-like-ZOGO |

No AlternativeTo page for Zogo exists (`alternativeto.net/software/zogo/` returns 404), so the
"list Garzoni as a Zogo alternative" plan in Phase 4 item 3 means creating that page.

### P8 · `gamified finance learning app`

| Prompt | Garzoni present? | Position | Competitors | Top publisher URLs |
| --- | --- | --- | --- | --- |
| gamified finance learning app | No | — | Zogo, Money Lessons (Brightchamps), **Money Masters**, FunFi, Fintelify | 1,7. theindexproject.org/…/nominees/7262 (Zogo) · 2. mwm.ai/apps/fintelify/6742100859 · 3–6. apps.apple.com (FunFi, Brightchamps, Money Masters) · 10. menastartupdigest.com (FunFi launch) |

The App Store pages of three competitors rank directly. For this phrase the store listing **is** the
ranking surface, so ASO (ratings, title/subtitle) is the lever.

## 3. Romanian prompts

The first two are from §6. `aplicație buget` was added as the third key Romanian prompt.

| Prompt | Garzoni present? | Position | Competitors | Top publisher URLs |
| --- | --- | --- | --- | --- |
| aplicație educație financiară | No | — | **MiM** (Iancu Guda / A.S.S.E.T., adults, sponsored by PENNY), Kids – o afacere de succes (kids, approved by the Ministry of Education), Școala de Bani (BCR programme) | 1. revistabiz.ro/penny-romania-sustine-lansarea-aplicatiei-mobile-pentru-educatie-financiara-mim/ · 2,3,8,9. forbes.ro (×4) · 4. capital.ro/premiera-absoluta-prima-aplicatie-oficiala-in-care-copiii-se-joa.html · 5. playtech.ro/2019/economisirea-banilor-aplicatii-copiii/ · 6. edupedu.ro/peste-66-000-de-romani-…-scoala-de-bani/ · 7. digi24.ro/…/aplicatii-prin-care-copiii-invata-… |
| cum să învăț despre bani | No | — | none (only a book: *Get Good With Money*) | 1. hotnews.ro/?p=2196875 · 2. transfergo.com/ro · 3,5. infocons.ro (kids) · 4. spotmedia.ro/stiri/educatie/ce-ii-invatam-pe-cei-mici-despre-bani · 6. economedia.ro (10 books) · 7. forbes.ro · 8. edupedu.ro (kids, by age) |
| aplicație buget | No | — | YNAB, Fintonic, Bilance, Fleur, Spendee, Money Manager, Mint, Wallet (BudgetBakers), CashControl | 1. hotnews.ro/?p=2044585 · 2. stirileprotv.ro/stiri/ibani/oamenii-folosesc-tot-mai-mult-inteligenta-artificiala-…-ce-aplicatii-exista.html · 3,5,6. Buget NG (government budget app, noise) · 4. blog.acer.com/ro/…/cele-mai-bune-aplicatii-de-planificare-a-bugetului… · 7. financiarul.ro/economie/7-aplicatii-pentru-gestionarea-bugetului-personal/ · 8. financiarul.ro/tehnologie/top-5-aplicatii-gratuite-bugetul-personal/ · 9. appfollow.io (Fleur) |

In Romanian, the "learn about money" results are about **teaching children**. No adult learning app ranks
except MiM, which only appears via one 2024 launch article.

## 4. Brand, entity and directory checks

### Brand queries

| Query | Garzoni result? | Notes |
| --- | --- | --- |
| `garzoni.app` | No | La Garzona, Le Garzantine, Garzón |
| `site:garzoni.app` | No | operator ignored, Venetian/Swiss Garzonis returned |
| `Garzoni personal finance` | No | Wikipedia surname pages, an LUM professor, Garzón Capital |
| `Garzoni app personal finance learning` | **#1 App Store** (`apps.apple.com/mn/app/id6761790801`) | snippet: "500+ bite-sized lessons", v1.1.5 |
| `Garzoni aplicație educație financiară` | **#1 App Store** (same Mongolia-storefront URL) | same stale snippet |
| `Garzoni learn money finance app lessons streaks UK` (extended) | **#1 App Store (za)**, **#2 github.com/andreineagoe23/garzoni**, **#7 garzoni.app/welcome** | The only query where the website appears. The **public GitHub repo outranks the website** for the brand. |

The App Store copy that search indexes still says **500+ lessons**. mwm.ai's copy of the same listing
says 175. Whatever the live listing says now, the indexed description is what assistants quote.

### Entity / directories

| Surface | Listed? | How checked |
| --- | --- | --- |
| Wikipedia | No | MediaWiki search API `Garzoni app`: no relevant article |
| Wikidata | No | `wbsearchentities` "Garzoni": Giovanna Garzoni (Q507765), Garzoni family (Q3098659, Q138806818), Giovanni Garzoni (Q1526138), Garzoni Group Real Estate (Q66476776) and others; no app item |
| Product Hunt | No | `producthunt.com/products/garzoni` and `/posts/garzoni` return 404 (control `/products/notion` returns 200) |
| SaaSHub | No | `saashub.com/garzoni` returns 404 (control `/ynab` returns 200) |
| BetaList | No | `betalist.com/startups/garzoni` returns 404; site search shows "No results found for garzoni" |
| AlternativeTo | No | Site search `garzoni` returns only "La Garzona" (an unrelated WhatsApp booking bot). Direct URLs return 403 to curl. |
| Indie Hackers / Crunchbase | Unknown | 403 to curl (bot wall). UNVERIFIED |
| mwm.ai (auto-generated app tracker) | **Yes, auto** | `mwm.ai/apps/garzoni-personal-finance/6761790801` returns 200 and shows 175 lessons, 11 ratings, v1.1.5, "outside top 30" in US Free Finance. mwm.ai pages rank for P3, P4 and P8 for competitors. |

## 5. Listicle outreach targets

Ranked by how often the **domain** appears across all 13 prompt queries (plus variants and brand
queries), then by best position, then by fit. Most individual pages appear only once, so domain
frequency is the useful signal. Contacts were read from the page on 2026-10-08. "Not checked" means
the page was not fetched.

| # | Page | Appears in (position) | What it lists | Who to contact | Fit / angle |
| --- | --- | --- | --- | --- | --- |
| 1 | forbes.ro (several articles, e.g. forbes.ro/jocul-kids-o-afacere-de-succes-…-88105) | RO1 #2,3,8,9 · RO2 #7 · RO brand #2,8 (7 hits) | RO financial-education apps and programmes, mostly for kids | Editorial contact not checked | Romanian founder story: "first gamified adult finance app in Romanian" (Phase 4 item 2) |
| 2 | findamasters.com/blog/11728/top-budgeting-apps-for-students-ways-to-manage-your-money | P5 #1 and #4 (mirror) | Student budgeting apps (Yolt, Monzo, Wally, TopCashback) | UNVERIFIED (403 to fetch) | #1 for the UK student query. Pitch the free tier as a student resource. |
| 3 | 11fs.com/article/4-fintechs-teaching-the-uk-about-money | P3 #2 and #3 (mirror) | GoHenry, Cleo, Emma, Plum (Feb 2022) | Gus Mallett (Content Writer); 11fs.com/contact | Stale: pitch an update or a follow-up piece |
| 4 | financiarul.ro: `/tehnologie/top-5-aplicatii-gratuite-bugetul-personal/` and `/economie/7-aplicatii-pentru-gestionarea-bugetului-personal/` | RO3 #7, #8 | Mint (defunct), YNAB, Fintonic, Spendee, Wallet; My Wallet, CashControl… | Liviu Barbu (Apr 2025) and Ana Dragomir (upd. Jan 2025); financiarul.ro/contact/ | Both list the defunct Mint, so offer a replacement entry in Romanian |
| 5 | edupedu.ro (e.g. `/peste-66-000-de-romani-…-scoala-de-bani/`) | RO1 #6 · RO2 #8 | Școala de Bani, kids' money by age | Editorial contact not checked | Education-press pitch |
| 6 | hotnews.ro (`?p=2196875`, `?p=2044585`) | RO2 #1 · RO3 #1 | Learning about money; budgeting | Editorial contact not checked | Ranks #1 for two RO prompts |
| 7 | economedia.ro (`?p=203495` books list) | RO2 #6 · RO3 #6 | 10 money books; budget news | Editorial contact not checked | Business press |
| 8 | itechguides.com/best/financial-literacy-apps/ | P1 #3 | 25 tools: Finfluent, EVERFI, FDIC Money Smart, Thrive, InvestLearning… (updated 7 Oct 2026) | hello@itechguides.com · **"Get listed" is a paid $99 lifetime listing** | Pay-to-play; Andrei decides (money) |
| 9 | tms-outsource.com/blog/posts/apps-like-zogo/ | P7 (ext) #3 | Khan Academy, YNAB, Acorns, Greenlight, Stash, Investmate, PocketGuard… (Dec 2025) | Bogdan Sandu; hello@tms-outsource.com · **Bucharest office** | The only "Zogo alternatives" listicle. Romanian connection is the hook. |
| 10 | stirileprotv.ro/stiri/ibani/oamenii-folosesc-tot-mai-mult-inteligenta-artificiala-…-ce-aplicatii-exista.html | RO3 #2 | Spendee, Bilance, Money Manager, ChatGPT (Jan 2026) | Ștefana Todică; "Mail către Redacția" link on the site | AI-tutor angle fits this article exactly |
| 11 | beststudenthalls.com/blog/best-budgeting-apps-international-students/ | P5 #6 | Revolut, Mint, PocketGuard, Splitwise, YNAB, Monzo, Goodbudget (upd. Apr 2026) | Bhakti (content writer); info@beststudenthalls.com | Student; also lists the defunct Mint |
| 12 | uniacco.com/blog/best-budgeting-apps-for-international-students | P5 #8 | TopCashback, Wally, Splitwise, Monzo, Moneybox, Curve, Cleo, Emma, Snoop, Plum (upd. Jun 2026) | Aparajita (LinkedIn on page); contact@uniacco.com | Student |
| 13 | teg.london/student-life/best-student-budgeting-apps/ (was uwslondon.ac.uk) | P5 #3 | TopCashback, Wally, Splitwise, Monzo, Moneybox, Curve, Cleo | No author; "Contact Us" page (The Education Group (London) Ltd) | Student |
| 14 | my.cumbria.ac.uk/Student-Life/Money--Finance/Money-Doctors/Budgeting-Resources | P5 #7 | University budgeting resources | "Money Doctors" student-money team (contact not checked) | .ac.uk resource-sheet email (Phase 4 item 4) |
| 15 | international-blogs.ncl.ac.uk/blog/student-budgeting-apps-to-support-your-finances | P5 #2 (page now 404) | — | Newcastle student-money team (not checked) | The page is dead but still ranks. Offer them a replacement resource. |
| 16 | producthunt.com/p/finlingo-2/finlingo-3 | P2-variant #1 | Finlingo | — (own launch) | A PH launch owns "duolingo for finance" (Phase 4 item 3) |
| 17 | indiehackers.com/post/can-this-be-duolingo-for-financial-education-f94c85eb77 | P2-variant #2 | Build-in-public post | — (own post) | Write an IH build-in-public post |
| 18 | revistabiz.ro/penny-romania-sustine-lansarea-aplicatiei-mobile-pentru-educatie-financiara-mim/ | RO1 #1 | MiM launch (Mar 2024) | revistabiz.ro/contact/ | RO business press. MiM is the closest RO adult competitor. |
| 19 | capital.ro/premiera-absoluta-prima-aplicatie-oficiala-in-care-copiii-se-joa.html | RO1 #4 · RO brand #9 | Kids' app | Editorial contact not checked | Already named in Phase 4 item 2 |
| 20 | blog.acer.com/ro/…/cele-mai-bune-aplicatii-de-planificare-a-bugetului… | RO3 #4 | Budget apps (body not readable) | Not visible | Low: vendor community blog |

**Not outreach targets (noted so nobody pitches them):**

- nibble-app.com: competitor-owned.
- grandavehousing.calpoly.edu: hacked/parasite SEO pages.
- consumerfinance.gov, edu.ro, credit-union pages: no app listings, or US-only audiences.
- supermoney.com: US budgeting tools, last updated 2024, no education category.
- unbiased.co.uk: names no apps.
- mwm.ai: auto-generated; Garzoni already has a page.
- cbinsights.com/owler/zoominfo: company-data profiles. A CB Insights profile could be claimed later, which is entity work, not outreach.

## 6. Re-running this next month

1. Run the same 13 queries (8 EN + `duolingo for finance app` variant + 3 RO + the brand queries in §4)
   in WebSearch, standard mode. Use extended mode only where this file records extended.
2. In the same week, paste the 10 §6 prompts into ChatGPT (search on), Perplexity, Gemini and Claude
   (web search on), each from a clean session, and record mention yes/no per assistant. That gives the
   real x/40 for the §6 KPI.
3. Diff against this file. Also record any new appearance of garzoni.app, the App Store or Play pages,
   or a third-party page that names Garzoni.
