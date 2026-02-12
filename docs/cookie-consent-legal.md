# Cookie consent – UK and EU compliance

We use **only our own in-app cookie banner**. We do not use Usercentrics, Cookiebot, or any other third-party consent tool. The same rules apply whether you use a CMP or your own solution.

## What the law expects (UK and EU)

**UK**: Privacy and Electronic Communications Regulations (PECR) and UK GDPR.
**EU**: ePrivacy Directive and GDPR (and national laws).
Requirements are aligned: inform users, get consent for non-essential cookies, and allow withdrawal.

### 1. Inform users

- Tell users that the site uses cookies.
- Explain the **purpose** of those cookies in clear, non-technical language.
- In the Cookie Policy we explain **session vs persistent** cookies and list categories (necessary, analytics, marketing).

### 2. Consent must be informed, express, and unambiguous

- **Informed**: User knows what they are agreeing to (we describe categories in the banner and Cookie Policy).
- **Express**: Active choice (e.g. “Accept all” or “Reject non-essential” or toggles in settings). No implied consent from continued browsing.
- **Unambiguous**: No pre-ticked boxes for optional cookies; optional categories start off. User must opt in.

### 3. Essential exception

Cookies that are **strictly necessary** to provide a service the user has requested do **not** require consent (e.g. session cookies for login, security). We use necessary cookies without consent and only set analytics/marketing cookies after the user has consented.

### 4. Reject as prominent as Accept

The “Reject non-essential” option must be as visible and easy as “Accept all”. We do not hide reject in a second layer only.

### 5. No dark patterns

We avoid design or wording that nudges users to accept (e.g. we do not make “Reject” visually weaker than “Accept”).

### 6. Withdraw consent

Users must be able to change their mind. We provide “Cookie settings” in the footer and on the Cookie Policy page so they can turn optional categories on or off at any time.

### 7. Cookie policy / declaration

We maintain a Cookie Policy that describes what we use (session vs persistent, categories, purpose) and link to “Cookie settings” for managing preferences. Non-compliance with cookie rules can lead to enforcement and fines from data protection authorities in the UK and EU.

---

## What we implemented

- **Banner**: Clear message that we use cookies and need consent for non-essential ones; necessary cookies are used without consent. “Accept all”, “Reject non-essential”, “Cookie settings” with equal prominence for accept and reject.
- **Settings modal**: “Necessary cookies are always on (no consent required).” Toggles for Analytics and Marketing (unchecked by default); “Save” applies the choice.
- **Storage**: Choice stored in `localStorage` under `monevo_cookie_consent`. We only load Google Analytics when the user has consented to analytics.
- **Withdraw**: Footer “Cookie settings” and Cookie Policy link open the same preferences modal.
- **Cookie Policy**: Sections on what cookies are, session vs persistent, categories, consent requirements (informed/express/unambiguous + essential exception), managing consent, third parties, and a short declaration. No third-party CMP script.

This setup is designed to meet UK and EU expectations. If you operate in other jurisdictions or want formal legal certainty, consider advice from a lawyer or compliance resource.
