# Transaction merchant name on card statements (Stripe)

What customers see on their bank or card statement (e.g. **REVOLUT** or **MONEVO * PLUS**) is controlled by **statement descriptors** in Stripe. Here’s how to set them up so your brand shows clearly (Revolut-style).

---

## 1. Set the main “merchant” name (required)

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com).
2. Go to **Settings** (gear icon) → **Business details**.
3. Find **Statement descriptor**.
4. Enter the name that should appear on card statements (e.g. `MONEVO` or `MONEVO FINANCE`).

**Rules:**

- **5–22 characters** (Latin only).
- At least one letter; no special characters: `< > \ ' " *`.
- Should match your Doing Business As (DBA) or brand so customers recognise the charge.

This value is used for all charges unless you override it (e.g. per product). Many banks show exactly this; some show a “friendly” name they map themselves (Stripe can’t control that).

---

## 2. Optional: prefix + dynamic suffix (e.g. `MONEVO * PLUS`)

If you want a **fixed prefix** plus a **per-transaction suffix** (e.g. plan name):

1. In **Settings → Business details**, set:
   - **Statement descriptor** – full static text (e.g. `MONEVO`) for non-card or fallback.
   - **Shortened descriptor** – 2–10 character **prefix** used for card charges (e.g. `MONEVO`).
2. Total length of **prefix + `* ` + suffix** must be ≤ 22 characters.

For **subscriptions** created via Stripe Checkout, you **cannot** set a different suffix per checkout session. The descriptor comes from:

- Your **account** (statement descriptor / shortened descriptor above), or
- The **Product** (see below).

So for “merchant” style like Revolut, setting the **Statement descriptor** (and optionally **Shortened descriptor**) in Business details is enough.

---

## 3. Optional: different descriptor per plan (Plus vs Pro)

To show something like `MONEVO* PLUS` vs `MONEVO* PRO` on statements:

1. In Stripe go to **Product catalog** → open the **Plus** product.
2. Set **Statement descriptor** (or product-level descriptor if shown) for that product (e.g. `PLUS` or keep empty to use account descriptor).
3. Repeat for the **Pro** product.

Stripe may use the first subscription item’s **product** descriptor for the charge. Exact behaviour can depend on Stripe version; if in doubt, use the account-level descriptor only.

---

## Summary

| Goal                         | Where to set it                                      |
|-----------------------------|------------------------------------------------------|
| Single name (e.g. `MONEVO`) | **Settings → Business details → Statement descriptor** |
| Prefix for card (e.g. `MONEVO`) | **Settings → Business details → Shortened descriptor** |
| Per-plan text                | **Product** (Plus/Pro) statement descriptor, if supported |

No code changes are required in Monevo: subscription checkout uses your Stripe account (and product) descriptors automatically. After you save Business details, new charges will use the new merchant name; existing subscriptions may keep the previous descriptor until the next billing cycle, depending on the bank.
