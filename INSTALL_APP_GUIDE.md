<!--
INSTALL_APP_GUIDE.md — quick reference, added Jul 29 2026.

Companion to WHY_TRACKER_BLOCKED.md — another "so I can find the answer
later" doc, this time covering the Install app feature: the different
paths through updateInstallUI() in app/app.js, and the specific
chrome://apps troubleshooting case Ronnie hit and solved live on his Mac.
-->

# Install app — how it works, and what to check if it's not showing up

## Short answer

The About → Install app panel shows different instructions depending on
what browser and device it detects, because there's no single universal
"install" button across browsers — each one does it differently, and some
don't support it at all. If the install option seems to be missing
entirely (no address bar icon, no menu entry), the most common cause on
desktop Chrome is that Chrome already thinks the app is installed for that
browser profile — check `chrome://apps`.

## The 6 paths (all live in `updateInstallUI()`, `app/app.js`)

| Detected as | What the user sees |
|---|---|
| Chrome/Edge with a native prompt ready (`deferredInstallPrompt` set) | One-tap **📲 Install SaveTheHives** button — installs immediately, no manual steps |
| iOS Chrome | Instructions for the Share icon → "Add to Home Screen" (iOS Chrome uses Safari's underlying install mechanism, not its own) |
| iOS Safari | Same Share icon → "Add to Home Screen" path, Safari-specific wording |
| Desktop Chrome (no native prompt yet) | Look for the install icon in the address bar, or ⋮ menu → "Install SaveTheHives..." (sometimes nested under "Cast, Save, and Share") |
| Desktop Edge | ••• menu → Apps → "Install this site as an app" |
| Desktop Safari (macOS, 17+) | File menu → "Add to Dock…" — older Safari versions don't support this at all |
| Desktop Firefox | Not supported on desktop; instructions point to the Android path instead |

Detection logic: `isIOSChrome()` and `isIOS()` check the user agent for
`CriOS` / iOS tokens; `desktopBrowser()` checks Edge → Opera → Chrome →
Firefox → Safari tokens in that specific order (Edge and Chrome UAs both
contain `Chrome/` and `Safari/`, so order matters).

## "I don't see an install option anywhere" (Ronnie's Mac Chrome case, solved Jul 29 2026)

If Chrome shows no address-bar install icon **and** no "Install
SaveTheHives..." entry in the ⋮ menu at all, that's different from just
not knowing where to look — it means Chrome itself isn't offering to
install right now.

Confirmed via two checks that Chrome's own diagnostics are the fastest way
to find out why, rather than guessing:

1. **DevTools → Application tab → Manifest.** Chrome lists any real
   installability blockers directly here, under "Errors and warnings." In
   Ronnie's case the only warnings were cosmetic (missing optional
   `screenshots` field in `manifest.json`, which just disables the fancier
   preview UI — not a blocker), meaning the manifest/service worker/HTTPS
   setup was already fully valid.

2. **`chrome://apps`** (type it directly into the address bar — Chrome
   blocks web pages and extensions from navigating there for security
   reasons, so this has to be pasted in manually). This is Chrome's list
   of every PWA/app already installed for that profile. **If SaveTheHives
   is already listed there, that's the answer** — Chrome doesn't offer to
   install something it believes is already installed, even if there's no
   visible icon anywhere obvious like the Dock or Applications folder.

   Ronnie found two stale entries here (likely leftovers from testing
   across the root→`/app/` restructure, or from installing more than once
   during earlier testing). Fix: right-click each → **Remove from
   Chrome**, then reload the site. The install icon/menu entry reappeared
   immediately.

## If a tester hits this

Most friends/testers won't have two months of our own dev testing baked
into their Chrome profile, so this exact scenario is unlikely to be common
in the wild — but if someone reports "I don't see any way to install it,"
the fastest ask is: *"Can you check `chrome://apps` and see if
SaveTheHives is already listed?"* before assuming anything's broken.
