# Clockwork Core

A browser game that teaches **4-bit binary addition**. You control a small cyan repair robot fighting a giant bronze clockwork guardian. Answer the addition question correctly to damage the guardian; answer wrongly and you take damage.

- **Frontend:** plain HTML, CSS, JavaScript (all artwork is inline SVG/CSS, no image files)
- **Backend:** Node.js + Express (the server makes the questions and checks the answers)
- **Storage:** none. Games live in the server's memory.

## Setup and run

1. Install [Node.js](https://nodejs.org) (version 18 or newer). Check with `node -v`.
2. Open this folder in VS Code, then open the terminal (**Terminal → New Terminal**).
3. Install the one dependency (Express):

   ```bash
   npm install
   ```

4. Start the game:

   ```bash
   npm start
   ```

5. Open <http://localhost:3000> in your browser.

Stop the server with `Ctrl + C`. To use a different port: `PORT=4000 npm start` (macOS/Linux) or `$env:PORT=4000; npm start` (Windows PowerShell).

Optional: `npm run dev` restarts the server automatically when you edit files, and `npm test` runs the rule tests.

## How to play

1. Look at the two 4-bit numbers, e.g. `0111 + 0011 = ?`.
2. Click each answer box to flip it between `0` and `1`. The small numbers underneath (8, 4, 2, 1) show each box's place value.
3. Press **Submit Answer**.
4. Read the feedback: whether you were right, the correct 4-bit result, and a column-by-column explanation.

| Result | Effect |
| --- | --- |
| Correct | Guardian loses 20 HP |
| Wrong | You lose 10 HP |

Both sides start at 100 HP. When either reaches 0, the win or lose screen appears with a **Play Again** button.

If the sum is bigger than 15 (for example `1100 + 1001 = 10101`), the answer boxes hold only the **lower four bits** (`0101`). The extra leftmost `1` is the *carry-out*, and the explanation points it out.

## Project layout

```
clockwork-core/
├── package.json        project info and the "start" script
├── server.js           Express server + API routes + in-memory game storage
├── game.js             game rules: questions, checking, damage, explanations
├── test/game.test.js   automated tests for game.js
└── public/             files the browser downloads
    ├── index.html      page structure and SVG artwork
    ├── style.css       layout, colours, animations
    └── app.js          button clicks and calls to the API
```

## API

| Method and path | What it does |
| --- | --- |
| `GET /api/health` | Returns `{ "ok": true }` if the server is running |
| `POST /api/game/new` | Starts a game; returns `gameId`, health, and the first question |
| `POST /api/game/:id/answer` | Body: `{ "bits": [1, 0, 1, 0] }`. Returns whether it was correct, the correct bits, an explanation, new health, and the next question or the game-over status |

You can try it from a terminal while the server runs:

```bash
curl -X POST http://localhost:3000/api/game/new
```

Bad requests get a friendly JSON error: `400` for invalid bits, `404` for an unknown game ID, `409` if the game is already over.

## Limitations of in-memory storage

- **Restarting the server erases every game.** A browser refresh also starts a fresh game, because the game ID is not saved in the browser.
- **One server only.** If you ran several copies of the server, each would have its own separate games.
- **Memory is limited.** The server deletes games idle for 2 hours and keeps at most 1000 at a time.
- **No accounts or scores.** Nothing is saved between sessions.

Swapping the `games` Map in `server.js` for a database would fix these, but that is beyond this first version.

## Ideas for next steps

Add difficulty levels, a streak counter, or sound effects. Keep any new rules in `game.js` so the server stays in charge.
