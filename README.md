# Tabletop Lounge (6 Multiplayer Games Online)

A unified parlor game hub for real-time multiplayer tabletop games in the browser. Zero accounts required, ultra-low latency WebSockets, and crafted in the Anthropic editorial design style.

---

## 🎲 Included Games

1. **Blind Heist (3–5 Players)**
   - Silent cooperative poker deduction.
   - Steal and lock in rank chips from ★1 (weakest hand) to ★N (strongest hand) across Pre-Flop, Flop, Turn, and River.
   - Route: `/heist`
   - WebSocket: `/heist/ws`

2. **Love Letter: 2019 Z-Man Edition (3–5 Players)**
   - Complete 21-card official ruleset with custom high-contrast SVG card art.
   - Features Princess (9), Countess (8), King (7), Chancellor (6), Prince (5), Handmaid (4), Baron (3), Priest (2), Guard (1), and Spy (0).
   - Single discard tray with top-card victim preview, kick button, reset match, and turn chime.
   - Features Normal Mode (live card counters `5/6` + clickable discard history) and Expert Mode (static totals `6` + no peeking).
   - Route: `/love-letter`
   - WebSocket: `/love-letter/ws`

3. **ไพ่สลาฟ — Thai Slave Card Game (3–6 Players)**
   - The legendary Thai card shedding game!
   - 3♣ first trick lead, 2♠ as supreme card, Single, Pair, Triple, and Quad.
   - Special cuts: Triple cuts Single (ตองปาดเดี่ยว), Quad cuts Pair (โฟร์ปาดคู่).
   - Hard pass rule, Tribute ceremony (King/Queen ↔ Slave/Vice-Slave), and the dramatic **ล้มเจ้า (King Overthrow)** revolution rule!
   - Route: `/slave`
   - WebSocket: `/slave/ws`

4. **Flip 7 (3–6 Players)**
   - The ultimate press-your-luck 94-card game! Race to 200 points.
   - Hit or Stay: Flip cards one by one to accumulate number points (0 through 12).
   - Duplicate bust rule: Two cards of the same number bust your round score to 0!
   - Special cards: Modifiers (+2, +4, +6, +8, +10, ×2), Freeze, Flip Three, and Second Chance duplicate bust shields.
   - Instant round win bonus: Collect 7 unique numbers to score a +15 bonus and end the round immediately.
   - Live draw shoe tracker, real-time bust risk calculator, kick button, and turn chime.
   - Route: `/flip-7`
   - WebSocket: `/flip-7/ws`

5. **LINE Let's Get Rich: Peak Era (2–4 Players / 2v2)**
   - The legendary 2014–2016 peak era recreated in full 3D!
   - 32-tile isometric Three.js world map, curved rainbow dice-control gauge, 8 S+ characters, 10 S+ treasures.
   - Real-time multiplayer over WebSockets across devices with automated rule-tree AI bots.
   - Direct Lobby layout: Topbar, 4x horizontal player banners, (1/3) Character & 3-Treasure pickers, (2/3) Abilities inspector, sum stats & active 7-skill stack matrix.
   - Triple, Line, and Tourism monopolies, Landmark defense, hostile takeovers, and debt/bankruptcy settlement.
   - Route: `/rich`
   - WebSocket: `/rich/ws`

6. **Cockroach Poker / Kakerlakenpoker (3–5 Players)**
   - The hit reverse set-collection bluffing game!
   - Features both **Classic Edition** (64 cards · 8 critters) and **Royal Edition** (65 cards · Royals & Penalty Deck + Wild + Blank Lie).
   - Slide face-down cards, call bluffs ("TRUE!" or "BLUFF!"), or secretly peek and pass forward.
   - Sudden-death loss conditions: 4-of-a-kind penalty, full critter set, or starting a chain with 0 cards in hand.
   - Sleek 1-line table announcement banner, turn chime audio, and interactive pass modals.
   - Route: `/cockroach`
   - WebSocket: `/cockroach/ws`

---

## 🚀 How to Host Permanently 24/7 (Free)

### Option 1: Render.com (Recommended Free Cloud Hosting)

Render provides free persistent WebSockets with automated SSL certificates (`https://` and `wss://`).

#### Step 1: Create a GitHub Repository
1. Initialize git in this directory and make your first commit:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of tabletop hub"
   ```
2. Create a new repository on [GitHub](https://github.com/new) (public or private).
3. Push your repository:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```

#### Step 2: Deploy on Render
1. Sign up for free at [Render.com](https://render.com).
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your GitHub repository.
4. Render will auto-detect Node.js. Configure the following:
   - **Name:** `tabletop-lounge` (or your choice)
   - **Region:** Closest to you (e.g., Singapore, Frankfurt, Oregon)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
5. Click **Create Web Service**.
6. Within 1–2 minutes, Render will build and deploy your lounge at:
   `https://<your-service-name>.onrender.com`

> **Note on Render Free Tier Sleep & 24/7 Keep-Alive:**
> Render's free tier spins down after 15 minutes of inactivity (first wake takes ~30 seconds). To keep it awake 24/7 for zero lag:
> 1. Sign up at [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) (both 100% free).
> 2. Create a recurring HTTP monitor targeting:
>    `https://<your-service-name>.onrender.com/health`
> 3. Set the interval to every **10 minutes**. Your game hub will stay warm and respond instantly!

---

### Option 2: Docker / Fly.io / Railway / VPS

This repository includes a production-ready `Dockerfile` based on `node:20-alpine`.

```bash
docker build -t tabletop-hub .
docker run -p 3000:3000 tabletop-hub
```

Or deploy to [Fly.io](https://fly.io) with one command:
```bash
fly launch
```

---

### Option 3: Instant Quick Tunnel (1-Click Local Host)

To test or play immediately without setting up GitHub/Render:
1. Double-click **`host-tabletop-hub.bat`**.
2. It installs dependencies, boots `node server.js`, and spins up a Cloudflare Tunnel.
3. Look for the `https://*.trycloudflare.com` URL printed in the terminal.
4. Share that link with your friends!

---

## 🛠 Project Layout

```
tabletop-hub/
├── server.js                 # Unified HTTP & WebSocket upgrade router
├── landing.html              # Parlor Lounge homepage
├── package.json              # Minimal dependencies (ws, pokersolver)
├── render.yaml               # Render Infrastructure-as-Code Blueprint
├── Dockerfile                # Minimal container image for Cloud Run/Fly.io
├── host-tabletop-hub.bat     # Windows 1-click launcher + Cloudflare tunnel
├── games/
│   ├── blind-heist/
│   │   ├── index.html        # Blind Heist client UI
│   │   └── server.js         # Blind Heist room logic & WebSocket handler
│   ├── love-letter/
│   │   ├── index.html        # Love Letter 2019 client UI & SVG card art
│   │   └── server.js         # Love Letter 2019 game engine & card actions
│   ├── thai-slave/
│   │   ├── index.html        # Thai Slave client UI
│   │   └── server.js         # Thai Slave game engine & tribute ceremony
│   ├── flip-7/
│   │   ├── index.html        # Flip 7 client UI & live shoe tracker
│   │   └── server.js         # Flip 7 game engine & hit/stay actions
│   ├── cockroach-poker/
│   │   ├── index.html        # Cockroach Poker client UI & bluff modals
│   │   └── server.js         # Cockroach Poker room engine (Classic/Royal)
│   └── lets-get-rich/
│       ├── dist/             # Production 3D Three.js client bundle
│       ├── engine.bundle.cjs # Authoritative headless game engine
│       └── server.js         # Real-time WebSocket room & bot auto-player
└── README.md                 # Deployment & open-source citations
```

---

## 📚 Open Source Citations & Third-Party Credits

In strict accordance with minimal open-source reliance, this project wraps battle-tested libraries:

- **ws** — High-performance WebSocket library for Node.js
  - GitHub: https://github.com/websockets/ws
- **three** — 3D Isometric WebGL renderer for LINE Let's Get Rich
  - GitHub: https://github.com/mrdoob/three.js
- **pokersolver** — Poker hand evaluator and comparison engine
  - GitHub: https://github.com/goldfire/pokersolver
- **cloudflared** — Cloudflare Tunnel client for zero-config public tunneling
  - GitHub: https://github.com/cloudflare/cloudflared
- **shadcn/ui** — Minimalist component token guidelines & typography primitives
  - GitHub: https://github.com/shadcn-ui/ui
- **Inter** — UI sans-serif typeface by Rasmus Andersson
  - GitHub: https://github.com/rsms/inter
- **JetBrains Mono** — Code and data monospace typeface by JetBrains
  - GitHub: https://github.com/JetBrains/JetBrainsMono
- **Newsreader** — Editorial serif typeface by Production Type
  - GitHub: https://github.com/productiontype/Newsreader