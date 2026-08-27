# 🂡 CARD CLASH

An original **UNO-inspired multiplayer card game** with realistic physical cards,
smart AI bots, online multiplayer, and player statistics.

Built with HTML/CSS/JavaScript, **Phaser-style CSS cards** (no image assets required),
Node.js + Express, Socket.IO, and MongoDB (optional).

---

## ✅ Installation

```bash
npm install
```

## ▶️ Start

```bash
npm start
```

## 🌐 Open

```
http://localhost:3000
```

> **Bot mode works with NO database and NO internet.** MongoDB is only needed
> for online profiles, leaderboard, history, and analytics.

---

## 🤖 Bot Mode (Play Immediately)

1. On the main menu click **PLAY WITH BOTS**.
2. Choose **2 Bots** or **3 Bots**.
3. Choose difficulty: **Easy / Normal / Hard**.
4. Click **START**.
5. Realistic cards appear — play cards that match the **color** or **value**
   of the discard pile, or play a special/wild card.
6. Cannot play? Click **DRAW CARD**.
7. First player to empty their hand wins.

### Special Cards (original names)
| Card | Effect |
|------|--------|
| ❄ **Freeze** | Next player loses their turn |
| ⇄ **Switch** | Reverses play direction |
| **+2 Double Draw** | Next player draws 2 and is skipped |
| ★ **Color Shift** | Wild — choose any color |
| ✫ **Chaos Draw** | Wild — choose color, next player draws 4 and is skipped |

---

## 🌐 Online Multiplayer

1. On the main menu click **ONLINE MULTIPLAYER**.
2. Enter a name and click **CREATE ROOM** (you are the host).
   - Optionally add 0–2 bots to fill the table.
3. Share the **room code** with a friend.
4. They open the same URL, click **ONLINE MULTIPLAYER**, enter the code, and **JOIN ROOM**.
5. The host clicks **START GAME**.
6. Open multiple browser tabs/windows to simulate several players locally.

The **server is authoritative**: it controls the deck, validates every move,
hides opponents' cards, and decides the winner.

---

## 🗄️ MongoDB (Optional)

Copy `.env.example` to `.env` and adjust if needed:

```bash
cp .env.example .env
```

```text
PORT=3000
MONGODB_URI=mongodb://localhost:27017/card-clash
USE_MONGODB=true
```

With MongoDB running, the game records:
- **Profiles** (`/profile.html`) — games played, wins, win rate, best score, streak
- **Leaderboard** (`/leaderboard.html`) — top players by total score
- **History** (`/history.html`) — past games and winners
- **Analytics** — simple rule-based advice on the profile page

Without MongoDB these pages show a friendly "MongoDB off" message, but
**bot mode and multiplayer still work**.

---

## 🎮 Features

- Realistic premium CSS cards (2:3 ratio, rounded corners, paper texture, 3D depth)
- Original card backs and color picker
- Fan layout, hover-lift, draw/play animations
- 3 bot personalities: 🔥 Blaze (aggressive), 🧠 Sage (strategic), 🍀 Lucky (unpredictable)
- Difficulty levels with genuine decision-making
- One-card warning, win screen with confetti, scores
- Sound effects generated in-browser (no asset files)
- Responsive (desktop, tablet, mobile)

---

## 📁 Project Structure

```
card-clash/
├── server.js                # Express + Socket.IO + optional MongoDB
├── public/                  # Front-end (static)
│   ├── index.html           # Main menu
│   ├── game.html            # Bot game
│   ├── lobby.html           # Multiplayer lobby + game
│   ├── leaderboard.html / profile.html / history.html
│   ├── css/  (style, menu, lobby, game)
│   └── js/   (cards, bot, ui, game, socket, lobby, mpgame, main)
└── server/
    ├── game/   (Deck, Game, Bot)   # authoritative logic
    ├── models/ (User, GameHistory, PlayerStats)
    └── socket/ (gameSocket)
```

---

## 🚀 Deploying to Vercel

Card Clash is structured so the **front-end (bot mode + all pages) deploys to Vercel as a static site**. A `vercel.json` is included that serves the `public/` folder.

```bash
npm install -g vercel      # or: npx vercel
vercel login               # open the browser and authenticate
vercel                    # deploys the static site
```

After deploy, open the URL → **PLAY WITH BOTS** works immediately (no server, no database).

> ⚠️ **About multiplayer on Vercel:** Vercel does not run a persistent
> Socket.IO server, so real-time online play cannot be hosted there.
> Two options:
> 1. **Keep multiplayer local / on your own server** (where `npm start` runs).
> 2. **Deploy the server separately** (Render, Railway, Fly.io) and tell the
>    front-end where it lives by setting, before `socket.js` loads:
>    ```html
>    <script>window.SOCKET_URL = "https://your-socket-server.onrender.com";</script>
>    ```
>    Then online multiplayer works from the Vercel site too.

### Environment variables (for the server, when self-hosted)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

## 🧪 Testing the Game Logic

A small standalone check of the core rules:

```bash
node -e "global.window={};require('./public/js/cards.js');const C=window.CardClash;console.log('deck',C.createDeck().length)"
```

Enjoy Card Clash! 🃏
