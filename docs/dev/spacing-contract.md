# Spacing & layout contract

One layout scale for web and mobile. Source of truth: **`packages/tokens/src/index.ts`**.

Nothing else defines spacing. If you find a second scale, it is a bug.

---

## 1. The scale

| Token   | px  | Tailwind equivalent | RN              |
| ------- | --- | ------------------- | --------------- |
| `xs`    | 4   | `1`                 | `spacing.xs`    |
| `sm`    | 8   | `2`                 | `spacing.sm`    |
| `md`    | 12  | `3`                 | `spacing.md`    |
| `lg`    | 16  | `4`                 | `spacing.lg`    |
| `xl`    | 20  | `5`                 | `spacing.xl`    |
| `xxl`   | 24  | `6`                 | `spacing.xxl`   |
| `xxxl`  | 32  | `8`                 | `spacing.xxxl`  |
| `xxxxl` | 48  | `12`                | `spacing.xxxxl` |

Radii: `sm` 6 · `md` 10 · `lg` 14 · `card` 20 · `full` 9999.

**10, 14, 18, 22 px are not spacing values.** If a design calls for one, round to the
nearest step rather than introducing it.

### Semantic constants

Prefer these over picking a raw step, so the app-wide gutter and rhythm can be
tuned in one place:

| Constant                | px  | Use                                   |
| ----------------------- | --- | ------------------------------------- |
| `layout.screenPaddingX` | 20  | horizontal inset of every screen/page |
| `layout.stackGap`       | 16  | gap between related items             |
| `layout.sectionGap`     | 32  | gap between page sections             |
| `layout.cardPadding`    | 20  | default card interior                 |

### How each platform consumes it

- **Mobile** — `mobile/src/theme/tokens.ts` re-exports `@garzoni/tokens`. Keep
  importing from `../theme/tokens`; never import the package directly.
- **Web** — `pnpm -F @garzoni/tokens build:css` writes `packages/tokens/tokens.css`
  (`--space-*`, `--layout-*`, `--radius-*`, `--font-size-*`). It is imported by
  `frontend/src/styles/entry.ts` and runs automatically on the web app's
  `predev` / `build`. **Commit the regenerated CSS** — the diff is the audit trail.
  `tailwind.config.cjs` maps semantic aliases (`p-card`, `gap-section`, …) onto
  those custom properties.

Tailwind's stock numeric scale already matches the token steps, so `p-4`/`gap-6`
etc. remain correct; the aliases exist for the semantic cases.

---

## 2. Containers

**One container per screen. Never hand-roll one.**

### Web — `frontend/src/components/common/PageContainer.tsx`

```tsx
<PageContainer maxWidth="6xl">…</PageContainer>
```

It owns `min-h-screen`, the page background, `px-4 py-10`, the max width and the
vertical gap. Do not re-type `min-h-screen bg-surface-page px-4 py-10` — four
files used to, and three of them had already drifted.

- `maxWidth`: content pages `4xl`, dashboards/profile `5xl`, lists/grids `6xl`,
  wide data views `7xl`.
- `gap`: `"section"` (32, default) or `"stack"` (16). Nothing else — do not pass
  `innerClassName="gap-10"`. A 40px override on the leaderboard is what made the
  search bar sit visibly further from the podium than anything else on the page.
- `layout="none"` only for pages that manage their own grid.

### Mobile — `mobile/src/components/ui/ScreenContainer.tsx`

```tsx
const paddingX = useScreenPaddingX(); // for FlatList/ScrollView contentContainerStyle
```

Owns `layout.screenPaddingX` plus the tablet gutter from `useScreenGutter()`.
Screens must not re-derive `spacing.xl + gutter` by hand — that duplication is
how the leaderboard ended up at a 12px inset while every other tab used 20px,
misaligned with the shared `TabScreenHeader`.

---

## 3. Vertical rhythm

**The stack owns the space between its children. Children never set vertical margins.**

React Native does not collapse margins, so a child `marginTop` _adds_ to the
parent `gap` and that one child ends up further from its neighbours than
everything else. The "Your consistency" card sat at 28px (16 gap + 12 margin)
while its siblings sat at 16.

- Mobile: wrap in `<Stack gap="stack" | "section">`.
- Web: `PageContainer`'s `gap`, or a local `space-y-*` on a list wrapper.

Related RN trap: **a horizontal `ScrollView` defaults to `flexGrow: 1`**. Dropped
into a flex column it swallows the leftover vertical space, and with
`alignItems: "center"` it floats its content in the middle of that void — this
is what made the Tools tab's filter chips look like they had enormous padding.
Always give one `style={{ flexGrow: 0, flexShrink: 0 }}`.

---

## 4. Cards

One padding vocabulary, three densities, identical on both platforms.

| Density | px  | Web                | Mobile                |
| ------- | --- | ------------------ | --------------------- |
| small   | 16  | `app-card--pad-sm` | `<Card padding="sm">` |
| default | 20  | `app-card--pad`    | `<Card padding="md">` |
| large   | 24  | `app-card--pad-lg` | `<Card padding="lg">` |

- Web: `.app-card` is the _skin_ (background, border, radius, shadow) and carries
  no padding, because plenty of cards lay out full-bleed children. When a card
  does own its padding, add a density class — do not invent a `p-*` / `px-* py-*`
  pair. `GlassCard`'s `padding` prop resolves to the same three classes.
- Mobile: `Card` and `GlassCard` share `CARD_PADDING` and `radius.card`; they
  differ only in fill treatment (blur on iOS for `GlassCard`).
- Card radius is `radius.card` (20) everywhere — web, mobile and email.

---

## 5. Known exceptions

These are deliberately outside the contract; do not "fix" them without a design pass.

- `mobile/app/welcome.tsx`, `onboarding.tsx`, `demo-lesson.tsx`, `subscriptions.tsx`
- `frontend/src/components/landing/` (`marketing.css`, `welcome.css`, `MarketingPage.tsx`, `Welcome.tsx`)

They are pixel-tuned marketing and paywall surfaces and hold most of the
remaining off-scale values. Normalising them is a separate, screenshot-driven task.

---

## 6. Adding or changing a token

1. Edit `packages/tokens/src/index.ts`.
2. `pnpm -F @garzoni/tokens build:css`, commit `packages/tokens/tokens.css`.
3. Both apps pick it up — mobile through `theme/tokens`, web through the custom
   properties. Nothing else to update.

Colours are **not** in this package yet; they still follow the manual mirror list
in `brand/README.md`.
