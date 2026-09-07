# Chainsaw Courses — Brand Reference

Use this document when setting up the new Shopify storefront project.

---

## Colour Palette

| Role | Hex | Usage |
|------|-----|-------|
| **Brand Orange** | `#E27226` | Logo, original brand colour |
| **Primary (UI)** | `#CA611C` | Buttons, links, active states, top bar |
| **White** | `#FFFFFF` | Page background |
| **Near-Black** | `#0F0F0F` | Body text, headings |
| **Card Background** | `#FAFAFA` | Card/panel backgrounds |
| **Border** | `#E0E0E0` | Dividers, input borders |
| **Muted Text** | `#6B6B6B` | Captions, secondary labels |
| **Secondary BG** | `#F0F0F0` | Pill buttons, chips, subtle fills |
| **Danger Red** | `#DC2828` | Errors, destructive actions |

### Tailwind CSS variables (copy into globals.css)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 6%;
  --border: 0 0% 88%;
  --input: 0 0% 92%;
  --ring: 24 76% 45%;
  --card: 0 0% 98%;
  --card-foreground: 0 0% 6%;
  --primary: 24 76% 45%;           /* #CA611C */
  --primary-foreground: 0 0% 100%;
  --secondary: 0 0% 94%;
  --secondary-foreground: 0 0% 12%;
  --muted: 0 0% 95%;
  --muted-foreground: 0 0% 42%;
  --accent: 0 0% 94%;
  --accent-foreground: 0 0% 6%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --radius: 0.25rem;               /* Sharp corners — keep consistent */
}
```

---

## Typography

| Role | Value |
|------|-------|
| **Sans-serif** | `Arial, 'Helvetica Neue', Helvetica, sans-serif` |
| **Serif** | `Georgia, serif` |
| **Border Radius** | `0.25rem` (very tight/square corners — part of the industrial look) |

> Note: No custom web fonts are used. The design intentionally uses system fonts for fast load times.

---

## Logo & Assets

| File | Description |
|------|-------------|
| `brand-logo.svg` | Favicon / app icon — worker in hard hat with chainsaw, orange on white |
| `brand-opengraph.jpg` | Social share image (OG image for meta tags) |

The logo icon is a **silhouette of a person wearing a hard hat operating a chainsaw**, coloured in **Brand Orange (#E27226)** on a white rounded-square background.

---

## Brand Personality

- **Industrial & professional** — not playful, not corporate-sterile
- **Confident and direct** — short copy, clear CTAs
- **Credibility-first** — accreditations, compliance, safety front and centre
- **Colour story:** Orange = energy, safety (hi-vis), action. White = clarity. Black = authority.

---

## Key Copy / Brand Name

- **Brand name:** Chainsaw Courses
- **Domain:** chainsawcourses.com / app.chainsawcourses.com
- **Tone:** Clear, instructional, trustworthy. Never casual or jokey.

---

## What's included in the course (for product page copy)

- 34 training videos
- Physical chainsaw manual
- Per-module quizzes with instant feedback
- AI mock examiner for exam practice
- Inspection checklists & risk assessments
- Digital certificate on completion
- Bio-security maps
- Species identification guides
- Timber characteristics reference
- Chain identification guide
- Glossary
