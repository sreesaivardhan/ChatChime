# ChatChime — Real-Time Multi-Room Chat

A production-ready real-time chat application built with Node.js, Express, and Socket.IO. Deployed on Render (backend) and Netlify (frontend). No database, no auth service — just clean WebSocket-driven state.

**Live demo:** [your-app.netlify.app](https://your-app.netlify.app)

---

## Features (what actually works)

| Feature | Status |
|---|---|
| Real-time messaging across multiple users | ✅ |
| Multiple chat rooms | ✅ |
| Create / delete rooms (owner-only) | ✅ |
| Live typing indicators | ✅ |
| Online user list per room | ✅ |
| Profile editing (display name + avatar colour) | ✅ |
| Emoji picker | ✅ |
| Message formatting (bold, italic, code) | ✅ |
| Connection status indicator | ✅ |
| Auto-reconnect on drop | ✅ |
| Mobile responsive layout | ✅ |
| Browser push notifications (opt-in) | ✅ |

---

## Stack

```
Frontend   plain HTML + CSS + Vanilla JS
Backend    Node.js 18 · Express 4 · Socket.IO 4
Hosting    Netlify (frontend) · Render (backend)
Storage    none — all state is in-memory on the server
Session    localStorage (username only)
```

---

## Local Setup

### 1. Clone

```bash
git clone https://github.com/your-username/chatchime.git
cd chatchime
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the backend

```bash
npm start
# → [SERVER] Running on port 3001
# → [SERVER] Health: http://localhost:3001/health
```

### 4. Serve the frontend

The frontend is plain static files — use any HTTP server:

```bash
# Option A — npx (no install)
npx serve .

# Option B — VS Code Live Server
# Right-click index.html → Open with Live Server
```

Open `http://localhost:3000` (or whichever port `serve` picks).

> ⚠️ Must be served over HTTP, not opened as `file://` — Socket.IO requires an HTTP origin.

---

## Environment Variables

Create a `.env` file (see `.env.example`):

```
PORT=3001
FRONTEND_ORIGIN=*
```

On Render, `PORT` is set automatically. Set `FRONTEND_ORIGIN` to your Netlify URL in production.

---

## Deploy — Render (Backend)

1. Push repo to GitHub
2. Create new Render **Web Service**
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. **Environment variable:** `FRONTEND_ORIGIN=https://your-app.netlify.app`
6. Deploy → copy your Render URL (e.g. `https://chatchime-api.onrender.com`)
7. Verify: `curl https://chatchime-api.onrender.com/health`

> 💡 Render free tier sleeps after 15 min of inactivity. Use UptimeRobot to ping `/health` every 10 min if you're demoing.

---

## Deploy — Netlify (Frontend)

1. Edit `config.js`:
   ```js
   window.BACKEND_URL = 'https://chatchime-api.onrender.com';
   ```
2. Commit and push
3. Create new Netlify site → **Import from Git**
4. **Build command:** *(leave empty)*
5. **Publish directory:** `.`
6. Deploy → open your Netlify URL
7. Test with two browser tabs

---

## Project Structure

```
chatchime/
├── index.html          Login page
├── chat.html           Chat interface
├── style.css           Full design system
├── script.js           All client logic (Socket.IO, UI, profile)
├── server.js           Express + Socket.IO backend
├── config.js           BACKEND_URL configuration
├── netlify.toml        Netlify publish + redirect config
├── package.json        npm scripts + dependencies
├── .env.example        Environment variable reference
└── .gitignore
```

---

## Resume Bullet Points

- **Built a full-stack real-time chat application** using Node.js, Express, and Socket.IO — supporting multiple concurrent rooms, live typing indicators, and server-driven online user tracking across all connected clients
- **Implemented a clean split-deploy architecture** with a stateless Socket.IO backend on Render and a plain HTML/CSS/JS frontend on Netlify, demonstrating production deployment, CORS configuration, and environment-aware URL injection without any build tooling
- **Delivered a polished, mobile-responsive UI** with profile customisation (display name + avatar colour), emoji picker, message formatting (bold/italic/code), connection status indicator, and auto-reconnect — all in ~700 lines of vanilla JavaScript with zero dependencies on the frontend

---

## Demo Walkthrough

1. Open the live URL — enter a username and click **Enter Chat**
2. You land in the **#general** room. The green dot in the top bar confirms your Socket.IO connection
3. Open a second browser tab, join as a different user — both users appear in the **In this room** sidebar panel
4. Type in Tab 1 — Tab 2 shows a live typing indicator
5. Send a message — it appears in both tabs instantly
6. Click **+** in the sidebar → create a new room → both tabs see it appear in real time
7. Click the **pen** icon on your profile → change your display name or pick an avatar colour → hit **Save**
8. Drop the server — both tabs show the red **Disconnected** pill; restart and they reconnect automatically
