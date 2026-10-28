# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner and a small group of friends who share one Minecraft server and one dashboard password. They open Beacon mostly on a PC to turn the server on before playing, and sometimes on a phone to check whether it is up. Everyone with the password can do everything.

## Product Purpose

Answer "can we play right now?" at a glance, and let the group start, stop or restart the Oracle Cloud VM, copy the join address, and download the world save, without anyone needing Oracle console access. Success: someone opens the page, sees the state, presses Start, and joins about two minutes later.

## Positioning

A private control panel for one friends-only server, not a hosting product: it shows the VM and the game as one state (Off, VM booting, Loading world, Online), keeps the world downloadable while every VM is off, and tracks what the paid VM costs.

## Operating Context

- Minecraft runs on a paid Oracle VM ("Minecraft-Premium") that an auto-stop worker shuts down after 30 idle minutes; starting takes about 2 minutes.
- An always-on free ARM VM ("arm-free") backs the server up every 30 minutes and on demand ("Backup now"), and uploads the save to Oracle Object Storage.
- Hosted on Cloudflare (Worker with static assets), free tier.

## Capabilities and Constraints

- Status, boot progress, join address, players, start/stop/restart with cooldown and typed confirmation when people are online, world save download, backups panel, Oracle cost and trial tracking, activity log.
- Strict CSP: scripts, styles, fonts and images from the app's own origin only; no third-party assets.
- Planned later: Discord alerts, whitelist management. Both should arrive as cards in the same system.

## Brand Commitments

- Name: Beacon.
- Tone: friendly and a little playful, but grown-up; not a kids' site. Clear and serious wherever an action is destructive or security-related (sign-in, stop/restart confirmations, errors).
- Minecraft-flavoured but original: no Mojang logos, textures, fonts or screenshots.

## Evidence on Hand

Real data comes from Oracle Cloud and mcsrvstat.us at runtime. No testimonials or marketing claims exist or should be invented.

## Product Principles

1. The state is the answer: one glance tells you whether you can play.
2. Actions are safe by default: cooldowns, confirmations, honest errors.
3. Nothing breaks while the server sleeps: saves and status work with every VM off.
4. Friendly, never flippant, where something can be lost.

## Accessibility & Inclusion

WCAG AA contrast in both themes, visible focus, 44px touch targets on mobile, no state conveyed by color alone, reduced-motion respected.
