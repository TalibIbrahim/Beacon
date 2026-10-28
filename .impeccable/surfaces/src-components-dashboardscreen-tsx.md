---
version: 1
slug: "src-components-dashboardscreen-tsx"
primary_target: "src/components/DashboardScreen.tsx"
related_targets: ["src/components/LoginScreen.tsx","src/index.css"]
---

# Dashboard (signed-in) and sign-in screen

Mode: Operate. Primary use: PC, opening the page to start the server before playing; phone to check status.

Job: see whether the server is playable, start/stop/restart it, copy the address, see who is on, get the world save, check backups and cost.

Constraints: keep every function, route, security behavior and the section layout (status, players, world save, backups, Oracle cost, activity). Strict CSP (self-hosted fonts, inline SVG only, no inline scripts). WCAG AA in dark and light, 44px targets on mobile, reduced motion. Future cards (Discord alerts, whitelist) must slot in.

User steer: playful and friendly but grown-up, "not a kids' play site; serious, but not super serious". Desktop is the main start surface.

## Direction contract

THESIS: A server dashboard that feels like a game's own side menu, warm and tactile, instead of a terminal. It refuses both the near-black ops console and the cartoon kids' launcher: no mascot faces, no jokes where something can be lost.

OWN-WORLD: Dark default is a warm twilight slate ground with a soft vertical gradient; cards one step lighter, 2px ink outline, small hard offset shadow, 10px radius, a thin material band on top (grass, sky, dirt, stone) per card. One bright accent, beacon cyan, for the primary action, focus and selection. State colours: grass online, torch amber starting, redstone error, stone off. Light theme: daytime sky ground, white cards, same ink outlines. Pixelify Sans for the wordmark, page title, card titles and the status word; Public Sans for everything read or counted.

STORY: The visitor reads the state word and the beacon block, presses the one primary button, watches four blocks fill, and joins.

FIRST VIEWPORT: Header with wordmark, theme toggle, refresh, sign out. Title row with the plain finding line and the primary power button. Status card leading the main column: pixel beacon icon and status word left, join address with Copy right, the four-block boot track along the bottom. Players card leads the right rail on desktop.

FORM: Brief-pinned direction (user-specified, adjusted by their steer); no concept roll, per new-work.md: "a user- or brief-pinned direction beats the roll, always" and "A session that reaches directions or comps without concept-seed having run (a direction the user or brief pinned) reads the mode's file instead". seed: none (brief-pinned direction)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Settings (user request): a Settings menu in the header switches the card colour bands on or off, saved per browser.

Signature interaction: the boot track's blocks fill as the server boots (current block pulses), with one small pixel burst when it reaches Online. Motion grammar: short ease-out, transform/opacity only, all disabled under prefers-reduced-motion.
