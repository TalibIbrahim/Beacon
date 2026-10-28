---
name: Beacon
description: A private control panel for one friends-only Minecraft server, built like a game's own side menu.
colors:
  ground-top: "#3a2b33"
  ground: "#2a2026"
  ground-bottom: "#221a1f"
  surface: "#342a31"
  raised: "#40353d"
  border: "#4d4048"
  rule: "#43373f"
  control: "#92848c"
  edge: "#66555f"
  obsidian: "#0e0a0c"
  text: "#f6efe9"
  muted: "#d0c3c6"
  faint: "#b3a4aa"
  beacon-cyan: "#52d6e6"
  beacon-cyan-hover: "#74e2ef"
  accent-ink: "#0e0a0c"
  focus: "#52d6e6"
  positive: "#86d672"
  negative: "#ff8080"
  on-negative: "#0e0a0c"
  warning: "#f3ae45"
  info: "#82c4ff"
  pill-positive-bg: "#2c3a2c"
  pill-negative-bg: "#4a2a31"
  pill-warning-bg: "#47362a"
  pill-info-bg: "#2b3646"
  grass: "#5fae4e"
  grass-dark: "#3f7d33"
  dirt: "#8b5e3c"
  dirt-dark: "#6a4329"
  stone: "#7f7b8e"
  stone-dark: "#5e5a6d"
  sky: "#5aa9e6"
  torch: "#f3ae45"
  beam: "#52d6e6"
  day-ground-top: "#cde6f6"
  day-ground: "#e3eef3"
  day-ground-bottom: "#eef3ea"
  day-surface: "#ffffff"
  day-raised: "#eef1f6"
  day-border: "#d7dbe5"
  day-rule: "#e6e9f0"
  day-control: "#6f6c83"
  day-edge: "#1d1b29"
  day-text: "#1b1a24"
  day-muted: "#474558"
  day-faint: "#5d5b70"
  day-beacon-cyan: "#3fc6d8"
  day-beacon-cyan-hover: "#2fb4c6"
  day-accent-ink: "#0f0d16"
  day-focus: "#0a7584"
  day-positive: "#2d7424"
  day-negative: "#c0292b"
  day-on-negative: "#ffffff"
  day-warning: "#9a5200"
  day-info: "#1c66ad"
  day-pill-positive-bg: "#e3f3dc"
  day-pill-negative-bg: "#fbe3e3"
  day-pill-warning-bg: "#fbecd7"
  day-pill-info-bg: "#deebf8"
  day-stone: "#8d8a9c"
  day-stone-dark: "#6d6a7d"
  day-torch: "#f5a623"
  day-beam: "#2fb4c6"
typography:
  status-word:
    fontFamily: "Pixelify Sans, Public Sans, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: "40px"
    letterSpacing: "0.01em"
  display:
    fontFamily: "Pixelify Sans, Public Sans, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Pixelify Sans, Public Sans, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
  title:
    fontFamily: "Pixelify Sans, Public Sans, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: "24px"
    letterSpacing: "0.01em"
  wordmark:
    fontFamily: "Pixelify Sans, Public Sans, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "0.02em"
  address:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "0.01em"
    fontFeature: "tnum"
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  button:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  label:
    fontFamily: "Public Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  pixel: "2px"
  tile: "6px"
  control: "8px"
  card: "10px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  gutter-mobile: "16px"
  gutter-desktop: "24px"
  container: "1152px"
  rail: "360px"
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "24px 20px 20px"
  button-primary:
    backgroundColor: "{colors.beacon-cyan}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.beacon-cyan-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.faint}"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.surface}"
  button-danger:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.negative}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.pill-negative-bg}"
  button-destructive-confirm:
    backgroundColor: "{colors.negative}"
    textColor: "{colors.on-negative}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
  input:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  pill:
    typography: "{typography.label}"
    rounded: "{rounded.tile}"
    padding: "0 10px"
    height: "28px"
  icon-tile:
    rounded: "{rounded.tile}"
    size: "32px"
---

# Design System: Beacon

## Overview

**Creative North Star: "The Game's Own Side Menu"**

Beacon is a server dashboard that feels like a menu inside the game it controls: warm, tactile, built from blocks, instead of a terminal. It refuses both the near-black ops console it replaced and the cartoon kids' launcher. The material is chunky and physical: stone-slab cards with an ink outline and a small hard shadow, buttons that sink when pressed, a thin strip of grass, sky, dirt or stone on top of every card, and crisp pixel-art drawn on whole-pixel grids. The tone is friendly and a little playful but grown-up; it is never a kids' play site.

Density is calm and readable: one column on phones, a wide main column plus a 360px rail on desktop, 24px between cards. Everything a person reads or counts is set in a plain, sturdy sans (Public Sans) with tabular numerals; the pixel face (Pixelify Sans) is reserved for names, the things you would see on a game menu's tabs. One accent, beacon cyan, carries the primary action, focus, selection and the beacon's own light. Twilight (dark, warm plum) is the default; daytime (sky-blue ground, white cards, the same ink outlines) follows the system until the visitor picks a theme, and both meet WCAG AA.

Confirmed rejections: no mascot faces, no jokes in sign-in, power confirmations or errors, no Mojang logos, textures, fonts or screenshots, and no near-black terminal look.

**Key Characteristics:**
- Stone-slab cards: 2px ink outline, 10px corners, 4px hard offset shadow, a 6px material band on top.
- One accent (beacon cyan) and one primary button per state.
- Pixelify Sans for names only; Public Sans with tabular numerals for everything read or counted.
- Pixel art as inline SVG on small integer grids, rendered crisp (`image-rendering: pixelated`).
- Warm twilight dark by default, daytime light on request; both AA, 44px touch targets.
- One motion grammar: short ease-out, transform and opacity only, off under reduced motion.

## Colors

A warm plum twilight (or daytime sky) ground, stone-toned surfaces, one bright beacon cyan, and Minecraft-flavoured material colours that live only in bands, blocks and meters. Every colour is a CSS custom property in `src/index.css`; the `day-*` tokens are the light theme's values for the same variables.

### Primary
- **Beacon Cyan** (`beacon-cyan`; daytime `day-beacon-cyan`): the primary button's fill, the focus ring in twilight, text selection (35% mix), the caret, the outline around the current boot block. It is the beacon's own light, so it also appears as **Beam** in the pixel beacon's beam, the lit boot-track rail and the app mark. Text on it is always **Accent Ink** (near black), never white.
- **Focus** (`focus`; daytime `day-focus`, a deeper teal): the 3px focus outline. In daytime it darkens so the ring holds 3:1 against white cards.

### Secondary (state)
- **Positive** (`positive`): Online dot, positive pills and their marks, success toasts.
- **Warning** (`warning`): starting/stopping dot, warning pills and notices.
- **Negative / Redstone** (`negative`): errors, the Stop server label, the destructive confirm button (with **On Negative** text), over-limit meter segments.
- **Info** (`info`): sign-in and download activity, info toasts.
- **Pill tints** (`pill-positive-bg`, `pill-negative-bg`, `pill-warning-bg`, `pill-info-bg`): low-chroma grounds behind state text in pills, icon tiles and inline notices.

### Tertiary (materials)
- **Grass** / **Grass Dark** (`grass`, `grass-dark`): the Online band, the header ground line, filled meter segments, the grass block.
- **Sky** (`sky`): the Players card band.
- **Dirt** / **Dirt Dark** (`dirt`, `dirt-dark`): the World save band, the dirt under the header's grass line, dirt blocks.
- **Stone** / **Stone Dark** (`stone`, `stone-dark`): the band for operational cards and for Off/stopping/unknown status, the Off dot and the beacon's dormant core.
- **Torch** (`torch`): the status band while starting. Kept separate from Warning so warning text can darken in daytime while the band stays bright.

### Neutral
- **Ground Top / Ground / Ground Bottom**: the page's vertical gradient (top colour to ground by 420px, then to bottom). Ground Top also fills the sticky header and the browser's `theme-color`.
- **Surface** (`surface`; daytime white): card fill.
- **Raised** (`raised`): secondary buttons, inputs, meter troughs, hover fills, the beacon's glass.
- **Edge** (`edge`): the 2px outline on cards, buttons, pills, tiles and avatars. A warm rim in twilight, ink in daytime.
- **Obsidian** (`obsidian`): every hard shadow and every pixel-art outline.
- **Rule** (`rule`): 2px row dividers inside cards. **Border** (`border`): disabled outlines and dashed empty-state boxes. **Control** (`control`): input outlines, empty boot slots, the unlit rail, scrollbars.
- **Text / Muted / Faint**: primary text, secondary lines, labels and timestamps. All three meet AA on Surface in both themes.

### Named Rules
**The One Beacon Rule.** Beacon cyan marks the primary action, focus, selection and the beacon's light, and nothing else. A screen shows at most one cyan button at a time: Start server while off, Copy while online.

**The Materials Stay Thin Rule.** Grass, sky, dirt, stone and torch appear only as card bands, the header ground line, the boot-track blocks, avatars and meter segments. They never fill a card, a button or a page area.

**The Not By Colour Alone Rule.** Every state carries a word plus a mark or shape: the status word beside its dot, pills with a square mark and text, unfilled boot blocks drawn as dashed outlines rather than dimmed fills.

## Typography

**Display Font:** Pixelify Sans 500/600 (with Public Sans, system-ui fallback), self-hosted, SIL OFL
**Body Font:** Public Sans 400 to 700 (with system-ui, -apple-system, Segoe UI, Roboto fallback), self-hosted, SIL OFL

**Character:** A pixel face used like the lettering on a game menu's tabs, paired with a sturdy, neutral civic sans for everything that has to be read accurately. The pixel face names things; the sans says things.

### Hierarchy
- **Status word** (Pixelify 600, 34px/40px, 0.01em): Off, Starting, Online, Shutting down, Unknown. The single loudest text on the dashboard.
- **Display** (Pixelify 600, 30px/36px, 0.01em): the page title. The sign-in title runs at 28px/36px.
- **Headline** (Pixelify 600, 22px/28px): dialog titles ("Stop the server?").
- **Title** (Pixelify 500, 17px/24px, 0.01em): card titles; 15px inside the Settings popover and in faint colour on skeletons.
- **Wordmark** (Pixelify 600, 18px, 0.02em; 20px on sign-in): "Beacon" beside the pixel app mark.
- **Address** (Public Sans 600, 20px/28px, 18px on phones, tabular): the join address. It never breaks mid-number; the Copy button wraps instead.
- **Body** (Public Sans 400, 14px/20px): all running text, rows, values, toasts. Big counts (player count, meter values, cost) step up to 20px semibold within the body line.
- **Button** (Public Sans 600, 14px).
- **Label** (Public Sans 400, 12px/16px, Faint, sentence case): field labels such as "Join address", row details, footnotes.

### Named Rules
**The Pixel Names Rule.** Pixelify Sans appears only on the wordmark, page and dialog titles, card titles and the status word. Never on body copy, buttons, labels, numbers or the join address.

**The Tabular Count Rule.** Every number that updates or is compared (address, players, sizes, times, costs, countdowns) uses tabular numerals.

## Layout

A centred container of 1152px with 16px gutters on phones and 24px from 640px up. From 1024px the dashboard is a two-column grid: a flexible main column and a 360px rail, 24px apart (720 + 24 + 360). Below 1024px it is a single column of cards, reordered so the answer comes first: status, players, world save, backups, cost, activity. Cards stack with 24px gaps.

The header is sticky, 56px tall, on the Ground Top colour, and ends in a 7px ground line (grass over a 3px dirt inset, 2px ink rule beneath). Under it, a title row pairs the page title and plain finding line on the left with the power buttons on the right (stacked, full-width buttons on phones).

Inside cards: header rows at 24px top, 20px sides, 12px bottom; content at 20px sides; the status card opens at 28px top to clear its band. Rows are at least 40px (44px where tappable) and separated by 2px Rule lines. The sign-in screen is a single 384px column, vertically centred.

## Elevation & Depth

Depth is physical, not atmospheric: every lifted object has a solid ink outline and a hard, unblurred shadow in Obsidian, as if lit by a game's flat sun. There are no blurred or ambient shadows anywhere. This is the world's native material: the pixel art itself is drawn with hard Obsidian outlines, and the cards and buttons share that edge.

### Shadow Vocabulary
- **Slab** (`box-shadow: 4px 4px 0 var(--obsidian)`): every card, the Settings popover, toasts and dialogs.
- **Slab lifted** (`box-shadow: 5px 5px 0 var(--obsidian)` with `translate(-1px, -1px)`): dashboard cards under a hovering pointer only.
- **Key** (`box-shadow: 0 3px 0 var(--obsidian)`): buttons at rest. Pressed: `translateY(2px)` and `0 1px 0`. Disabled: no shadow, sunk 2px.
- **Band seam** (`box-shadow: inset 0 -2px 0 var(--band-dark)`): the darker underside of a material band.

### Named Rules
**The Hard Light Rule.** Shadows are solid Obsidian offsets with zero blur. Nothing glows, nothing floats on a soft shadow.

**The Press Sink Rule.** Buttons sit on a 3px key shadow and sink into it when pressed; a disabled button is already sunk.

## Shapes

Softened blocks. Cards round at 10px, controls (buttons, inputs, switch rows) at 8px, small tiles, pills, avatars and meter troughs at 6px, and tiny marks (status dots, toast marks, meter segments, switch knobs) at 2 to 3px, so they read as pixels rather than circles. There are no fully round shapes in the system. Outlines are always 2px. Pixel art is drawn as inline SVG on integer grids (10x10 blocks, 16x25 beacon, 8x8 mirrored avatars) and shown at whole multiples (30px and 40px blocks) so edges stay crisp.

## Components

### Buttons
Chunky keys you press, 44px tall.
- **Shape:** gently rounded (8px), 2px Edge outline, 16px side padding, 3px Key shadow.
- **Primary:** Beacon Cyan fill, Accent Ink label, brighter cyan on hover. One per state.
- **Secondary:** Raised fill, Text label, Surface on hover. Used for Restart, Retry, Cancel, Download, Backup now, and Copy while the server is not online.
- **Danger:** Raised fill with a Negative label (Stop server); hover tints to the negative pill ground. The destructive confirm inside the dialog is the only solid Negative button, with On Negative text.
- **Ghost:** no fill or outline, Muted icon or label, Raised fill and Text on hover, at least 44x44 (header theme toggle, settings, refresh, sign out).
- **Focus:** the global 3px Focus outline at 2px offset.
- **Icons:** 16px line icons inline as SVG beside the label; a spinning refresh or loader icon replaces the leading icon while busy.

### Chips (Pills)
- **Style:** 28px tall, 6px corners, 2px Edge outline, 12px semibold text, a pill-tint ground with matching state text (`bg-pill-warning` + Warning, and so on), or Raised + Muted for neutral facts.
- **State:** state pills lead with a small square mark in the state colour, so meaning never rests on tint.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** Surface.
- **Shadow Strategy:** Slab (see Elevation); dashboard cards lift 1px on hover, dialogs, popovers and toasts stay put.
- **Border:** 2px Edge.
- **Band:** a 6px material strip across the top with a 2px darker seam: grass, sky, dirt, stone, or torch. Players is sky, World save dirt, Backups, Oracle Cloud and Recent activity stone, sign-in grass, dialogs stone. The status card's band follows the phase: stone for off, stopping and unknown; torch while booting or loading; grass when online. Settings turns all bands off (`data-bands="off"` on `<html>`); cards must read completely without them.
- **Internal Padding:** 20px sides, 24px header top (28px on the status card and the sign-in form, 32px on dialogs).
- **Inline notices:** 8px corners, 2px Edge outline, a pill-tint ground; empty states use a 2px dashed Border box with Muted text.

### Inputs / Fields
- **Style:** 44px, 8px corners, Raised fill, 2px Control outline, cyan caret, Text value; the label sits above in 14px medium.
- **Focus:** the outline turns Focus colour (Negative inside the typed confirmation).
- **Error / Disabled:** `aria-invalid` turns the outline Negative and a Negative message follows with `role="alert"`; disabled fields drop to 60% opacity.

### Navigation
- **Header:** sticky, Ground Top fill, wordmark with the pixel app mark on the left (plus region and shape from 768px), freshness text, then ghost buttons: theme toggle, settings, refresh, sign out. The ground line closes it.
- **Settings popover:** a Slab panel hanging from the gear (320px wide; pinned to the page gutters on phones), opening with the toast-in motion. It holds switch rows: whole-row buttons at least 52px tall, label and hint on the left, "On/Off" in words plus a squared track that fills cyan when on.

### Status Card (signature)
The answer to "can we play right now?". Left: the 72px pixel beacon (core and beam light up as it boots; the beam pulses when online) beside a 12px squared state dot, the status word and a short friendly line. Right: the "Join address" label, the address, and the Copy button (primary only when online). Bottom, under a 2px rule: the boot track, four pixel blocks (stone, dirt, grass, beacon) joined by rails that turn solid Beam once passed and stay dotted Control until then; the current block wears a 2px cyan outline, dozes while off and bobs while booting. One pixel burst (18 squares in beam, grass, warning, sky and positive) fires once when the server reaches Online while you watch.

### Rows, Tiles and Avatars
- **Icon tile:** 32px square, 6px corners, 2px Edge outline, pill-tint ground with a 16px line icon in the state colour (activity rows, cost cells).
- **Player avatar:** an 8x8 mirrored pixel pattern from a hash of the name, hue-tinted per player, 30px, 6px corners, 2px Edge outline. Patterns, never faces.
- **Segmented meter:** a Raised trough with a 2px Edge outline and 3px inner gaps, one segment per unit up to 12, lit Grass (Negative when over the limit), like an XP bar.

### Toasts and Dialogs
- **Toast:** a Slab panel 384px wide (full width on phones) under the header, a 10px squared state mark, the message, and a 44px dismiss button; enters with toast-in (160ms, 8px drop, fade).
- **Dialog:** a stone-banded Slab panel, max 448px, over a 70% dark scrim, bottom-sheet on phones and centred from 640px; enters with dialog-in (140ms, scale from 0.97). With players online, a negative-tint notice asks the user to type STOP or RESTART.

### Motion
One grammar: short ease-out on transform and opacity. Card lift 160ms `cubic-bezier(0.16, 1, 0.3, 1)`; button press 90ms ease-out; colour changes 150ms. Ambient loops are reserved for the status card (sleepy 3.2s, bob 1.1s, beam pulse 2.4s, stepped flicker 1.4s, Online dot pulse 1.8s). Under `prefers-reduced-motion` every animation and transition collapses to 0.01ms and the burst is not rendered.

## Do's and Don'ts

### Do:
- **Do** build every new card (Discord alerts, whitelist, anything else) as a Slab panel with a 2px Edge outline, 10px corners, a material band and a Pixelify card title in the 24px/20px header row.
- **Do** pick a band by what the card is about: grass for live or online, sky for people, dirt for the world and its files, stone for operations, logs and costs, torch only for starting.
- **Do** keep exactly one Beacon Cyan button visible per state; everything else is secondary, danger or ghost.
- **Do** set every number in Public Sans with tabular numerals, including the join address.
- **Do** make every tappable thing at least 44px, show the 3px focus ring, and keep text AA and controls 3:1 in both twilight and daytime.
- **Do** pair every state colour with a word and a mark or shape.
- **Do** draw pixel art as inline SVG on an integer grid with Obsidian outlines, sized in whole multiples, coloured only from theme tokens.
- **Do** keep a card fully readable with bands switched off.

### Don't:
- **Don't** use Pixelify Sans for body copy, buttons, labels, numbers or the join address.
- **Don't** add a second accent colour, or use Beacon Cyan for decoration, headings or status.
- **Don't** fill cards, buttons or page areas with material colours; materials stay in bands, blocks, avatars and meters.
- **Don't** use blurred, glowing or ambient shadows; depth is a hard Obsidian offset.
- **Don't** draw mascot faces or characters; avatars are symmetric patterns.
- **Don't** put jokes or playful lines in sign-in, power confirmations or errors; the friendly lines live beside the status word, which itself stays plain.
- **Don't** use Mojang logos, textures, fonts or screenshots, or images from another origin.
- **Don't** return to the near-black terminal look.
- **Don't** add motion outside the status card's loops and the shared enter, lift and press transitions, or any motion that survives reduced-motion.
