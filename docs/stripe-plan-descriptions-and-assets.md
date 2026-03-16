# Stripe plan descriptions & asset prompts

Use these in Stripe for product/price descriptions and for generating plan images (e.g. with Google Gemini).

---

## Stripe – short descriptions

**Plus**
Unlimited learning, personalized path, full analytics, streak repair, and 50 AI tutor prompts per day. Best value to master finance.

**Pro (or Premium)**
Everything in Plus with 200 AI tutor prompts per day. For learners who want maximum AI support and no limits.

---

## Stripe – one-liners (if character limit is tight)

- **Plus:** Unlimited learning + personalized path + full analytics + 50 AI prompts/day.
- **Pro:** Everything in Plus + 200 AI tutor prompts/day.

---

## Google Gemini – image prompts for plan assets

Use these in Gemini (or another image model) to generate **two distinct visuals** for the two paid plans. No text or logos in the image; keep it abstract or metaphorical so you can overlay your own labels.

---

### Image 1 – Plus plan

**Prompt:**
Professional, aspirational illustration for a finance learning app. A single person at a clean desk with a laptop and a small plant, soft golden-hour light from the side. In the background, a subtle path or road winding forward (suggesting a “learning path”). Modern, minimal, warm but not playful. Color palette: deep teal or navy, cream, and one accent of warm gold or copper. No text, no UI elements. Style: editorial illustration or high-end stock photo look, suitable for a subscription card or hero section.

---

### Image 2 – Pro / Premium plan

**Prompt:**
Premium, forward-looking illustration for an advanced finance learning product. Same person or silhouette at a desk, but surrounded by subtle digital or abstract elements: soft glowing nodes, connection lines, or a light “network” in the background (suggesting AI and deeper support). Slightly more dynamic and “power user” feel than the first image. Same color world: deep teal or navy, cream, and a stronger gold or copper accent. No text, no UI. Style: editorial or premium app marketing—sophisticated and calm, not gamified.

---

## Notes

- In the app, the two paid tiers are **Plus** and **Pro**. “Premium” in code is an alias for Plus; if you name the top tier “Premium” in Stripe, use the **Pro** description and the **Image 2** prompt for it.
- Adjust prices in Stripe to match your catalog (e.g. Plus £69/year, £7.99/month; Pro £79/year, £11.99/month).
- For Gemini: if the first run is too literal, add “no text, no numbers, no logos” and “abstract or metaphorical” to refine.
