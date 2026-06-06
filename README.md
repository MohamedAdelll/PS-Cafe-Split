# PS Café Split

Bill splitter for PlayStation cafés. Everyone pays only for their own time.

## Stack

- **Backend**: Node.js + Express + SQLite (via better-sqlite3)
- **Frontend**: React + Vite
- **DB file**: `cafe.db` (auto-created on first run)

---

## Setup

Create a root `.env` file from `.env.example` or use the defaults already checked into your workspace. The app reads the same variables in local dev and in Docker.

### 1. Install backend dependencies

```bash
cd ~/Documents/cafe
npm install
```

### 2. Install frontend dependencies

```bash
cd ~/Documents/cafe/client
npm install
```

---

## Development (two terminals)

**Terminal 1 — backend:**
```bash
cd ~/Documents/cafe
npm run dev       # nodemon auto-reloads on changes
# or: npm start   # plain node
```
Server runs on http://localhost:3001

**Terminal 2 — frontend:**
```bash
cd ~/Documents/cafe/client
npm run dev
```
Frontend runs on http://localhost:5173 and proxies `/api` → backend.

---

## Production build

```bash
# Build the React app
cd ~/Documents/cafe/client
npm run build

# Run the server (serves built frontend too)
cd ~/Documents/cafe
npm start
```

Open http://localhost:3001 — everything served from one port.

## Docker

Build and run the full app in one container:

```bash
docker compose up --build
```

The app will be available on http://localhost:3001 and SQLite data is stored in a named volume mounted at `/app/data`.

---

## Sharing with friends

For friends on other devices to access your group:

1. Find your local IP: `ip addr` or `ipconfig`
2. Share `http://<your-ip>:3001` and your group code
3. Or deploy to any Node.js host (Railway, Render, Fly.io) for public access

---

## How billing works

- Each person is billed **only for the time they were in the room**
- When someone joins or leaves, a new **billing interval** is recorded
- Each interval divides `hourly_rate ÷ people_in_room` across its duration
- Formula: `cost = Σ (rate_per_hour / people_count) × (interval_duration_hours)`

---

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/groups` | Create group `{ name, ratePerHour }` |
| GET | `/api/groups/:gid` | Get group info |
| PATCH | `/api/groups/:gid` | Update rate `{ ratePerHour }` |
| POST | `/api/groups/:gid/sessions` | Start session |
| GET | `/api/groups/:gid/sessions/active` | Get active (or latest) session |
| GET | `/api/groups/:gid/sessions` | List all sessions |
| POST | `/api/sessions/:sid/end` | End session |
| POST | `/api/sessions/:sid/people` | Add person `{ name }` |
| POST | `/api/sessions/:sid/people/:pid/leave` | Mark person as left |

---

## File structure

```
cafe/
├── server.js          # Express API
├── db.js              # SQLite setup + schema
├── package.json
├── cafe.db            # auto-created
└── client/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js         # fetch helpers
        ├── utils.js       # billing math + formatting
        └── views/
            ├── HomeView.jsx
            ├── HomeView.module.css
            ├── GroupView.jsx
            └── GroupView.module.css
```
