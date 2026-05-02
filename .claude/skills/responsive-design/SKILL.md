---
name: responsive-design
description: Use this skill whenever building, modifying, or reviewing any frontend UI — web pages, web apps, dashboards, components, landing pages, marketing sites, admin panels, or any HTML/CSS/JSX/Vue/Svelte/etc. layout work. Triggers on requests like "build a landing page," "create a dashboard," "design a hero section," "make this component," "style this page," or any task that produces user-facing visual layout. Ensures output is responsive across phones, tablets, laptops, and large monitors by default, with content prioritization across breakpoints — not just scaling. Apply at full depth for multi-section pages and layouts; apply at lighter depth for isolated components (still fluid, still tested across sizes, but skip page-level concerns like nav collapse).
---

# Responsive Design by Default

## The decision process

Responsive design is content prioritization across breakpoints, not "the same thing, smaller." Every screen size has a different attention budget. Before writing layout code, work through these in order:

1. Identify the primary user action or content for this view. On a landing page it's typically a CTA; on a dashboard, the key metric; on a product page, the product plus buy action.

2. For each breakpoint, decide what serves that primary action. Decorative elements, secondary nav, supporting copy, and tertiary widgets get reconsidered — not just resized — on smaller screens. A hero image that sets brand mood on desktop may push the CTA below the fold on mobile; hide it, swap it for a colored block, or replace it with a smaller version.

3. Choose a layout primitive that flexes. Default to CSS Grid for two-dimensional layouts, Flexbox for one-dimensional flows, and container queries when a component's layout should depend on its container rather than the viewport.

4. Mentally test against real device sizes before declaring done: 360px (small phone), 768px (tablet portrait), 1024px (tablet landscape / small laptop), 1440px (standard laptop), 2560px+ (large monitor / ultrawide).

## Sizing defaults

Avoid fixed pixel widths on layout containers — use `%`, `fr`, `rem`, `clamp()`, `min()`, `max()`, `minmax()`. Type and spacing should also scale fluidly (e.g. `font-size: clamp(1rem, 0.5rem + 1.5vw, 1.5rem)`); a `2rem` gutter that's right on desktop is often too much on mobile. Cap text columns at ~60–75 characters with `max-width` so paragraphs don't stretch across a 4K monitor. Use `min-width: 0` on flex/grid children containing text to allow truncation, and `minmax()` in grids to prevent items from squeezing below usability.

## Common patterns

**Navigation.** Horizontal nav with many links collapses to a hamburger on small screens, but keep the highest-priority action (Sign Up, Cart, primary CTA) visible *outside* the menu — hiding it costs conversions.

**Data tables.** Desktop shows all columns. Mobile shows 2–3 priority columns with tap-to-expand for the rest, or transforms into a card list. Horizontal scroll is a last resort, not a default.

**Sidebars.** Collapse to drawer/overlay on mobile, or move below main content. Never compete with main content on a narrow screen.

**Multi-step forms.** A single-page form on desktop often needs to become genuinely paginated on mobile — scrolling through 20 fields on a phone is a usability failure, not a layout one.

**Cards / grids.** Use `grid-template-columns: repeat(auto-fit, minmax(MIN, 1fr))` so cards reflow without media queries. Pick `MIN` so cards don't squeeze below usable size.

**Images.** Use `srcset` and `sizes` for responsive delivery. Use `aspect-ratio` to reserve space and prevent layout shift. Prefer `object-fit: cover` with a defined aspect ratio over fixed heights.

## Large-screen failure modes

Mobile failures are obvious; large-screen failures get ignored. Cap container widths (`max-width: 1440px` or similar, centered) unless the design genuinely benefits from edge-to-edge. Cap line length even when the screen has room. If a layout looks sparse on ultrawide, consider whether secondary content can promote into view at that size.

## Accessibility

Touch targets at least 44×44px on touch devices. Don't rely on hover for critical interactions — touch devices have no hover. Respect `prefers-reduced-motion` for any animations. Keep focus states visible at all viewport sizes. Test with browser zoom up to 200% — it's both a real accessibility requirement and a stress test for sizing choices.

## When showing work to the user

State prioritization decisions explicitly, especially ones that hide or restructure. For example: "On mobile, I've hidden the decorative hero image and stacked the headline and CTA so the primary action is above the fold. The secondary nav collapses into a hamburger, but the Sign Up button stays visible because it's the primary conversion goal."

This makes the design intentional and reviewable, and helps the user catch cases where the prioritization assumption was wrong.

## Scope notes

Framework-agnostic — use whatever the project already uses (Tailwind, vanilla CSS, CSS-in-JS, CSS Modules). The test sizes above are a mental check, not required media query values; let content dictate where layouts change, not arbitrary device categories. This skill gets the defaults right but does not replace verification in a real browser.