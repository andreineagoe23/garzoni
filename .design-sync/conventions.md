# Garzoni Design System — conventions

A small **dark-glass** UI kit (frosted surfaces, Inter typeface, deep `#0b0f14` page
background). Six primitives, all importable from `window.GarzoniDS`:
`GlassButton`, `GlassCard`, `GlassContainer`, `TextInput`, `SelectInput`, `Modal`.

## Wrapping & theme (required)

These components are designed for a **dark** surface. `TextInput`, `SelectInput`, and
`Modal` render white text on translucent-white fields, so on a light background they are
invisible. Wrap any screen built with this kit in a dark, themed root:

```jsx
<div
  data-theme="dark"
  style={{ background: "#0b0f14", minHeight: "100vh", padding: 32 }}
>
  {/* your UI */}
</div>
```

- `data-theme="dark"` switches the brand CSS variables to their dark values (defined in the
  shipped stylesheet). Without it, the `surface`/`content` tokens resolve to their light values.
- `Modal` renders into `document.body` via a portal with its own full-screen backdrop — just
  mount it with `isOpen`; it does not need to live inside the dark wrapper.
- No React provider is needed — theming is pure CSS (the `data-theme` attribute + tokens).

## Styling idiom

**Primary lever = component props**, not class names. Compose with the documented props:

- `GlassButton`: `variant` = `primary | active | success | danger | ghost`,
  `size` = `sm | md | lg | xl`, plus `icon`, `loading`, `disabled`.
- `GlassCard`: `padding` = `none | sm | md | lg | xl`, `hover`.
- `GlassContainer`: `variant` = `default | subtle | strong`.
- `TextInput` / `SelectInput`: `label`, `value`, `onChange`, `helperText`, `error` (controlled).
- `Modal`: `isOpen`, `title`, `onClose`, `children`.

For **your own layout glue**, the shipped stylesheet is Garzoni's **purged** Tailwind output —
only utility classes actually used in the product survive. The verified safe set:

| Family        | Real class names (present in the shipped CSS)                                           |
| ------------- | --------------------------------------------------------------------------------------- |
| Surfaces      | `bg-surface-page` `bg-surface-card` `bg-surface-elevated`                               |
| Brand / text  | `text-brand-primary` `text-content-primary` `text-content-muted` `text-content-inverse` |
| State         | `text-state-success` `text-state-error`                                                 |
| Border / ring | `border-border` `ring-focus`                                                            |
| Type          | `font-mono` (JetBrains Mono); body text defaults to Inter                               |

Other Tailwind names (e.g. `bg-brand-primary`, `text-state-warning`, `font-sans`) are **not**
in this build and won't resolve. For anything outside the safe set, read the **token directly**
— every color is defined as a CSS variable, so `var(--*)` always works:

```
--color-surface-page  --color-surface-card  --color-surface-elevated
--color-brand-primary --color-brand-primary-hover --color-accent
--color-text-primary  --color-text-muted    --color-text-inverse  --color-text-on-primary  --color-text-faint
--color-state-success --color-state-error   --color-state-warning --color-state-info
--color-border-default --color-ring-focus
--color-icon-default  --color-icon-muted    --color-icon-on-brand
```

e.g. `style={{ color: "var(--color-text-primary)", background: "var(--color-surface-card)" }}`.

## Where the truth lives

- `styles.css` (the single stylesheet to link) → `@import`s the tokens, the `fonts` (Inter +
  JetBrains Mono), and `_ds_bundle.css` (the compiled component/theme CSS with all token defs).
- Per-component API + usage: each `components/general/<Name>/<Name>.d.ts` and `.prompt.md`.

## Build snippet

```jsx
<div data-theme="dark" style={{ background: "#0b0f14", padding: 32 }}>
  <GlassCard padding="lg" style={{ maxWidth: 360 }}>
    <span
      className="text-brand-primary"
      style={{ fontSize: 13, fontWeight: 600 }}
    >
      Apprentice
    </span>
    <h3 className="text-content-primary" style={{ margin: "4px 0 12px" }}>
      Giovanni di Maestro
    </h3>
    <TextInput id="trade" label="Trade" value={trade} onChange={setTrade} />
    <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
      <GlassButton variant="active">Save</GlassButton>
      <GlassButton variant="ghost">Cancel</GlassButton>
    </div>
  </GlassCard>
</div>
```
