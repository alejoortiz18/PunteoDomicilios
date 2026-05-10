---
name: ui-ux-pro-max
description: Advanced UI/UX patterns for complex interfaces and interaction design. Use when designing pages, creating/refactoring UI components, choosing color schemes or typography, reviewing UI for accessibility, implementing navigation/animations/responsive behavior, or making product-level design decisions. Skip for pure backend, API-only, or DevOps tasks.
license: MIT — https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
---

# UI/UX Pro Max - Design Intelligence

Comprehensive design guide for web and mobile applications. Contains 50+ styles, 161 color palettes, 57 font pairings, 161 product types with reasoning rules, 99 UX guidelines, and 25 chart types across 10 technology stacks.

## When to Apply

### Must Use
- Designing new pages (Landing Page, Dashboard, Admin, SaaS, Mobile App)
- Creating or refactoring UI components (buttons, modals, forms, tables, charts, etc.)
- Choosing color schemes, typography systems, spacing standards, or layout systems
- Reviewing UI code for user experience, accessibility, or visual consistency
- Implementing navigation structures, animations, or responsive behavior
- Making product-level design decisions (style, information hierarchy, brand expression)
- Improving perceived quality, clarity, or usability of interfaces

### Recommended
- UI looks "not professional enough" but the reason is unclear
- Receiving feedback on usability or experience
- Pre-launch UI quality optimization
- Aligning cross-platform design (Web / iOS / Android)
- Building design systems or reusable component libraries

### Skip
- Pure backend logic development
- Only involving API or database design
- Performance optimization unrelated to the interface
- Infrastructure or DevOps work
- Non-visual scripts or automation tasks

**Decision criteria**: If the task will change how a feature looks, feels, moves, or is interacted with, this Skill should be used.

## Rule Categories by Priority

| # | Category | Priority | Domains | Key Rules | Anti-Patterns |
|---|----------|----------|---------|-----------|---------------|
| 1 | Accessibility | CRITICAL | ux | Contrast 4.5:1, Alt text, Keyboard nav, Aria-labels | Removing focus rings, Icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | ux | Min size 44×44px, 8px+ spacing, Loading feedback | Reliance on hover only, Instant state changes (0ms) |
| 3 | Performance | HIGH | ux | WebP/AVIF, Lazy loading, Reserve space (CLS < 0.1) | Layout thrashing, Cumulative Layout Shift |
| 4 | Style Selection | HIGH | style, product | Match product type, Consistency, SVG icons (no emoji) | Mixing flat & skeuomorphic randomly, Emoji as icons |
| 5 | Layout & Responsive | HIGH | ux | Mobile-first breakpoints, Viewport meta, No horizontal scroll | Horizontal scroll, Fixed px container widths, Disable zoom |
| 6 | Typography & Color | MEDIUM | typography, color | Base 16px, Line-height 1.5, Semantic color tokens | Text < 12px body, Gray-on-gray, Raw hex in components |
| 7 | Animation | MEDIUM | ux | Duration 150–300ms, Motion conveys meaning, Spatial continuity | Decorative-only animation, Animating width/height, No reduced-motion |
| 8 | Forms & Feedback | MEDIUM | ux | Visible labels, Error near field, Helper text, Progressive disclosure | Placeholder-only label, Errors only at top, Overwhelm upfront |
| 9 | Navigation Patterns | HIGH | ux | Predictable back, Bottom nav ≤5, Deep linking | Overloaded nav, Broken back behavior, No deep links |
| 10 | Charts & Data | LOW | chart | Legends, Tooltips, Accessible colors | Relying on color alone to convey meaning |

## Quick Reference

### 1. Accessibility (CRITICAL)
- `color-contrast` — Minimum 4.5:1 ratio for normal text (large text 3:1)
- `focus-states` — Visible focus rings on interactive elements (2–4px)
- `alt-text` — Descriptive alt text for meaningful images
- `aria-labels` — aria-label for icon-only buttons
- `keyboard-nav` — Tab order matches visual order; full keyboard support
- `form-labels` — Use `<label>` with `for` attribute
- `skip-links` — Skip to main content for keyboard users
- `heading-hierarchy` — Sequential h1→h6, no level skip
- `color-not-only` — Don't convey info by color alone (add icon/text)
- `dynamic-type` — Support system text scaling; avoid truncation
- `reduced-motion` — Respect `prefers-reduced-motion`
- `escape-routes` — Provide cancel/back in modals and multi-step flows

### 2. Touch & Interaction (CRITICAL)
- `touch-target-size` — Min 44×44pt (Apple) / 48×48dp (Material)
- `touch-spacing` — Minimum 8px gap between touch targets
- `hover-vs-tap` — Use click/tap for primary; don't rely on hover alone
- `loading-buttons` — Disable button during async; show spinner or progress
- `error-feedback` — Clear error messages near problem
- `cursor-pointer` — Add `cursor-pointer` to clickable elements (Web)
- `tap-delay` — Use `touch-action: manipulation` to reduce 300ms delay
- `press-feedback` — Visual feedback on press (ripple/highlight)
- `haptic-feedback` — Use haptic for confirmations; avoid overuse
- `safe-area-awareness` — Keep targets away from notch, Dynamic Island, gesture bar

### 3. Performance (HIGH)
- `image-optimization` — Use WebP/AVIF, responsive images (srcset/sizes), lazy load
- `image-dimension` — Declare width/height or aspect-ratio to prevent layout shift (CLS)
- `font-loading` — Use `font-display: swap/optional` to avoid FOIT
- `lazy-loading` — Lazy load non-hero components via dynamic import
- `bundle-splitting` — Split code by route/feature (React Suspense / Next.js dynamic)
- `virtualize-lists` — Virtualize lists with 50+ items
- `progressive-loading` — Use skeleton screens instead of long blocking spinners for >1s
- `debounce-throttle` — Use debounce/throttle for scroll, resize, input events

### 4. Style Selection (HIGH)
- `style-match` — Match style to product type
- `consistency` — Use same style across all pages
- `no-emoji-icons` — Use SVG icons (Heroicons, Lucide), not emojis
- `effects-match-style` — Shadows, blur, radius aligned with chosen style
- `dark-mode-pairing` — Design light/dark variants together
- `icon-style-consistent` — Use one icon set/visual language
- `primary-action` — Each screen should have only one primary CTA

### 5. Layout & Responsive (HIGH)
- `viewport-meta` — `width=device-width initial-scale=1` (never disable zoom)
- `mobile-first` — Design mobile-first, then scale up
- `breakpoint-consistency` — Use systematic breakpoints (375 / 768 / 1024 / 1440)
- `readable-font-size` — Minimum 16px body text on mobile
- `line-length-control` — Mobile 35–60 chars; desktop 60–75 chars
- `horizontal-scroll` — No horizontal scroll on mobile
- `spacing-scale` — Use 4pt/8dp incremental spacing system
- `container-width` — Consistent max-width on desktop (max-w-6xl / 7xl)
- `viewport-units` — Prefer `min-h-dvh` over `100vh` on mobile

### 6. Typography & Color (MEDIUM)
- `line-height` — Use 1.5–1.75 for body text
- `font-scale` — Consistent type scale (e.g. 12 14 16 18 24 32)
- `color-semantic` — Define semantic color tokens (primary, secondary, error, surface)
- `color-dark-mode` — Dark mode uses desaturated/lighter tonal variants, not inverted
- `color-accessible-pairs` — Foreground/background pairs must meet 4.5:1 (AA) or 7:1 (AAA)
- `color-not-decorative-only` — Functional color must include icon/text; avoid color-only meaning
- `number-tabular` — Use tabular figures for data columns, prices, timers

### 7. Animation (MEDIUM)
- `duration-timing` — 150–300ms for micro-interactions; complex transitions ≤400ms
- `transform-performance` — Use transform/opacity only; avoid animating width/height
- `loading-states` — Show skeleton or progress indicator when loading exceeds 300ms
- `easing` — ease-out for entering, ease-in for exiting
- `motion-meaning` — Every animation must express cause-effect, not just decorative
- `spring-physics` — Prefer spring/physics-based curves over linear
- `exit-faster-than-enter` — Exit animations ~60–70% of enter duration
- `interruptible` — Animations must be interruptible by user input

### 8. Forms & Feedback (MEDIUM)
- `input-labels` — Visible label per input (not placeholder-only)
- `error-placement` — Show error below the related field
- `submit-feedback` — Loading then success/error state on submit
- `required-indicators` — Mark required fields (asterisk)
- `empty-states` — Helpful message and action when no content
- `toast-dismiss` — Auto-dismiss toasts in 3–5s
- `confirmation-dialogs` — Confirm before destructive actions
- `inline-validation` — Validate on blur (not keystroke)
- `input-type-keyboard` — Use semantic input types (email, tel, number)
- `password-toggle` — Provide show/hide toggle for password fields
- `focus-management` — After submit error, auto-focus the first invalid field
- `toast-accessibility` — Toasts must not steal focus; use `aria-live="polite"`

### 9. Navigation Patterns (HIGH)
- `bottom-nav-limit` — Bottom navigation max 5 items with labels + icons
- `back-behavior` — Back navigation must be predictable and consistent
- `deep-linking` — All key screens reachable via deep link / URL
- `nav-label-icon` — Navigation items must have both icon and text label
- `nav-state-active` — Current location must be visually highlighted
- `modal-escape` — Modals must offer clear close/dismiss affordance
- `state-preservation` — Navigating back must restore scroll, filter, input state
- `adaptive-navigation` — Large screens (≥1024px) prefer sidebar; small use bottom/top nav

### 10. Charts & Data (LOW)
- `chart-type` — Match chart type to data (trend → line, comparison → bar, proportion → pie/donut)
- `legend-visible` — Always show legend near the chart
- `tooltip-on-interact` — Tooltips on hover/tap showing exact values
- `responsive-chart` — Charts must reflow on small screens
- `empty-data-state` — Show meaningful empty state when no data
- `no-pie-overuse` — Avoid pie/donut for >5 categories

## How to Use This Skill

### Step 1: Analyze User Requirements
Extract: product type, target audience, style keywords, and tech stack.

### Step 2: Apply Design System
Always start with the full design system approach:
- Pattern, style, colors, typography, effects
- Include anti-patterns to avoid
- Use semantic color tokens

### Step 3: Domain-Specific Details
Focus on the relevant domains:
- Product type patterns → `product` domain
- UI styles/colors/effects → `style` domain
- Font pairings → `typography` domain
- Color palettes by product type → `color` domain
- Chart types/recommendations → `chart` domain
- UX best practices/anti-patterns → `ux` domain
- Landing page structure → `landing` domain

### Step 4: Pre-Delivery Validation
Before delivering UI code:
1. Run through Quick Reference §1–§3 (CRITICAL + HIGH) as a final review
2. Test on 375px (small phone) and landscape orientation
3. Verify behavior with reduced-motion enabled
4. Check dark mode contrast independently
5. Confirm all touch targets ≥44pt

## Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from a consistent icon family and style
- [ ] Semantic theme tokens used consistently (no hardcoded hex per-screen)

### Interaction
- [ ] All tappable elements provide clear pressed feedback
- [ ] Touch targets meet minimum size (≥44×44pt iOS, ≥48×48dp Android)
- [ ] Micro-interaction timing stays in 150–300ms range
- [ ] Disabled states are visually clear and non-interactive
- [ ] Screen reader focus order matches visual order

### Light/Dark Mode
- [ ] Primary text contrast ≥4.5:1 in both modes
- [ ] Secondary text contrast ≥3:1 in both modes
- [ ] Both themes tested before delivery

### Layout
- [ ] Safe areas respected for headers, tab bars, bottom CTA bars
- [ ] Scroll content not hidden behind fixed/sticky bars
- [ ] Verified on small phone, large phone, and tablet
- [ ] 4/8dp spacing rhythm maintained

### Accessibility
- [ ] All meaningful images/icons have accessibility labels
- [ ] Form fields have labels, hints, and clear error messages
- [ ] Color is not the only indicator
- [ ] Reduced motion and dynamic text size supported
