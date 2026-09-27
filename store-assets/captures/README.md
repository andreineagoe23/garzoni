# Raw app captures

Drop raw simulator screenshots here, one per slot and language:

```
captures/en/slot1.png … slot6.png
captures/ro/slot1.png … slot6.png
```

`render.mjs` frames whatever it finds. A missing file renders as a striped placeholder panel
that names the shot to take, so the set can be reviewed before every capture exists.

## What each slot shows

The `capture` field of each entry in `../captions.en.json` / `../captions.ro.json` says what
the screen must show. In short:

| Slot | Screen                                                      |
| ---- | ----------------------------------------------------------- |
| 1    | The Climb — the journey map, a few steps done, one current  |
| 2    | A lesson question with £ amounts, XP reward visible         |
| 3    | AI tutor mid-conversation, answering a money question       |
| 4    | Streak + daily missions                                     |
| 5    | Portfolio Analyzer with holdings in £                       |
| 6    | The app in Romanian (language picker or a Romanian lesson)  |

Every amount on screen is in **£ (GBP)**. No $ or € anywhere in the set.

## How to capture (iOS Simulator)

1. Boot an **iPhone 17 Pro Max** simulator (1320×2868 captures; the template crops the
   status bar and scales to 1290×2796 and 1080×1920).
2. Freeze a clean status bar:

   ```bash
   xcrun simctl status_bar booted override --time 9:41 --batteryState charged \
     --batteryLevel 100 --cellularBars 4 --wifiBars 3
   ```

3. Sign in with a **clean demo account** made for screenshots:
   - never the App Review account `garzonitest`;
   - never a real person's email — use a throwaway on a domain you control;
   - give it a believable first name, some progress on The Climb, a short streak and a few
     missions done, so screens are not empty. No real portfolio data.
4. Keep every amount in **GBP**. There is no account currency setting. The mobile tools
   hard-code USD (`formatCurrency` in `mobile/src/types/portfolio.ts`, `savings-calculator.ts`,
   `reality-check.ts`), so a £ Portfolio Analyzer shot (slot 5) needs that fixed first, or a
   web capture at phone width. Otherwise the set mixes $ and £ again.
5. Navigate to the screen and capture:

   ```bash
   xcrun simctl io booted screenshot store-assets/captures/en/slot1.png
   ```

6. For Romanian, switch the app language to **Română** in the app's settings, then repeat
   into `captures/ro/`. Every slot needs its own Romanian capture: the listing must not
   show English UI under Romanian captions.
7. Clear the override when done: `xcrun simctl status_bar booted clear`.

Check each capture before rendering: no debug banners, no personal data, no notification
badges, keyboard dismissed.

## Status bar crop

Each entry has `cropTop` — the height cut from the top of the capture, as a fraction of the
capture's **width**. `0.141` removes the 186 px status bar of a 1320 px wide iPhone 17 Pro Max
capture. Captures from a different device need a different value.

## Render

From the repo root (no install needed; uses the installed Google Chrome, or `CHROME_PATH`):

```bash
node store-assets/render.mjs               # en + ro, all slots, all sizes
node store-assets/render.mjs --lang ro --only slot3
```

Output goes to `store-assets/out/<lang>/` (git-ignored):

- `ios/slotN.png` — 1290×2796, App Store iPhone 6.9"/6.7"
- `play/slotN.png` — 1080×1920, Google Play phone
- `feature-graphic.png` — 1024×500, Google Play feature graphic

All PNGs are 24-bit RGB (no alpha), which Play requires. Fonts: Inter loads from Google Fonts
(needs network), JetBrains Mono from `brand/kit/fonts`. If a font fails to load, a caption
overflows its zone, or a headline wraps past its limit, the render shows a red
`RENDER CHECK` banner, so a bad image cannot slip through unnoticed.

To change copy, edit the captions JSON. Keep claims to what the app does today: 150+ lessons,
5-minute lessons, free to start (3 learning activities a day), Plus/Pro, AI tutor, Romanian UI.
