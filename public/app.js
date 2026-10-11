// app.js — the browser side of Clockwork Core.
// IMPORTANT: this file never decides whether an answer is correct.
// It sends the four bits to the server and displays what the server says.
'use strict';

// ---------- Grab the page elements we need ----------
const $ = (id) => document.getElementById(id);

const els = {
  arena: $('arena'),
  floatLayer: $('floatLayer'),
  turnLabel: $('turnLabel'),
  numA: $('numA'),
  numB: $('numB'),
  bitButtons: Array.from(document.querySelectorAll('.bit')),
  submitBtn: $('submitBtn'),
  errorBox: $('errorBox'),
  errorText: $('errorText'),
  retryBtn: $('retryBtn'),
  feedback: $('feedback'),
  feedbackBanner: $('feedbackBanner'),
  fbYours: $('fbYours'),
  fbCorrect: $('fbCorrect'),
  fbSteps: $('fbSteps'),
  nextBtn: $('nextBtn'),
  endScreen: $('endScreen'),
  endCard: $('endCard'),
  endTitle: $('endTitle'),
  endMessage: $('endMessage'),
  endHp: $('endHp'),
  playAgainBtn: $('playAgainBtn'),
  hp: {
    player: { fill: $('playerFill'), text: $('playerHpText'), bar: $('playerBar') },
    guardian: { fill: $('guardianFill'), text: $('guardianHpText'), bar: $('guardianBar') },
  },
};

// ---------- What the browser remembers ----------
const state = {
  gameId: null,
  maxHp: 100,
  bits: [0, 0, 0, 0],   // the answer the player is building (leftmost = 8s place)
  busy: false,          // true while waiting for the server
  lastResult: null,     // the server's reply to the most recent answer
  playerHp: 100,
  guardianHp: 100,
};

// ---------- Talking to the server ----------

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Sends a request and returns the JSON reply. Throws ApiError with a
// friendly message if anything goes wrong.
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (networkError) {
    throw new ApiError('Cannot reach the game server. Is it running?', 0);
  }
  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    // reply was not JSON; fall through to the generic message below
  }
  if (!response.ok) {
    throw new ApiError(data.error || 'Something went wrong. Please try again.', response.status);
  }
  return data;
}

// ---------- Drawing things on screen ----------

function updateHealth(side, hp) {
  const { fill, text, bar } = els.hp[side];
  const percent = Math.max(0, Math.min(100, (hp / state.maxHp) * 100));
  fill.style.width = percent + '%';
  fill.classList.toggle('low', percent <= 30);
  text.textContent = `${hp} / ${state.maxHp}`;
  bar.setAttribute('aria-valuenow', String(hp));
}

function renderBits() {
  els.bitButtons.forEach((button, i) => {
    const value = state.bits[i];
    const place = [8, 4, 2, 1][i];
    button.textContent = value;
    button.setAttribute('aria-pressed', value === 1 ? 'true' : 'false');
    button.setAttribute('aria-label', `Bit for the ${place}s place, currently ${value}. Press to flip.`);
  });
}

function setControlsEnabled(enabled) {
  els.bitButtons.forEach((b) => (b.disabled = !enabled));
  els.submitBtn.disabled = !enabled;
}

function showQuestion(question) {
  els.turnLabel.textContent = `Question ${question.turn}`;
  els.numA.textContent = question.a;
  els.numB.textContent = question.b;
  state.bits = [0, 0, 0, 0];
  renderBits();
  els.feedback.hidden = true;
  els.submitBtn.hidden = false;
  setControlsEnabled(true);
  els.bitButtons[0].focus();
}

function showError(message) {
  els.errorText.textContent = message;
  els.errorBox.hidden = false;
}

function clearError() {
  els.errorBox.hidden = true;
}

// Restart the CSS attack animation (remove the class, force a reflow, add it back).
function playAttack(kind) {
  els.arena.classList.remove('fire-player', 'fire-guardian');
  void els.arena.offsetWidth;
  els.arena.classList.add(kind === 'player' ? 'fire-player' : 'fire-guardian');
}

function floatDamage(target, amount) {
  const el = document.createElement('div');
  el.className = `float-dmg float-dmg--${target}`;
  el.textContent = `−${amount}`;
  el.addEventListener('animationend', () => el.remove());
  els.floatLayer.appendChild(el);
}

function showFeedback(result) {
  const box = els.feedback;
  box.classList.toggle('feedback--ok', result.correct);
  box.classList.toggle('feedback--bad', !result.correct);

  els.feedbackBanner.textContent = result.correct
    ? `Correct! The guardian takes ${result.damage.amount} damage.`
    : `Wrong! The guardian counterattacks — you take ${result.damage.amount} damage.`;
  els.fbYours.textContent = result.submittedBits;
  els.fbCorrect.textContent = result.correctBits;

  els.fbSteps.innerHTML = '';
  result.explanation.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line; // textContent (not innerHTML) keeps this safe
    els.fbSteps.appendChild(li);
  });

  els.nextBtn.textContent = result.status === 'playing' ? 'Next question' : 'See result';
  box.hidden = false;
  els.submitBtn.hidden = true;
  els.nextBtn.focus();
}

function showEndScreen(result) {
  const won = result.status === 'won';
  els.endCard.classList.toggle('lose', !won);
  els.endTitle.textContent = won ? 'Victory!' : 'Defeat';
  els.endMessage.textContent = won
    ? 'You shut down the Clockwork Guardian with perfect binary math!'
    : 'The guardian overpowered your repair bot. Review the steps and try again!';
  els.endHp.textContent = `Final HP — You: ${result.playerHp}  ·  Guardian: ${result.guardianHp}`;
  els.endScreen.hidden = false;
  els.playAgainBtn.focus();
}

// ---------- Game actions ----------

async function startNewGame() {
  state.busy = true;
  clearError();
  els.endScreen.hidden = true;
  els.feedback.hidden = true;
  els.submitBtn.hidden = false;
  setControlsEnabled(false);
  // Show full health right away so the previous game's HP never flashes on screen.
  // (The server's reply below is still what sets the real values.)
  updateHealth('player', state.maxHp);
  updateHealth('guardian', state.maxHp);
  try {
    const data = await api('/api/game/new', { method: 'POST' });
    state.gameId = data.gameId;
    state.maxHp = data.maxHp;
    updateHealth('player', data.playerHp);
    updateHealth('guardian', data.guardianHp);
    showQuestion(data.question);
  } catch (err) {
    showError(err.message);
  } finally {
    state.busy = false;
  }
}

async function submitAnswer() {
  if (state.busy || !state.gameId) return;
  state.busy = true;
  clearError();
  setControlsEnabled(false);
  try {
    const result = await api(`/api/game/${state.gameId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ bits: state.bits }),
    });
    state.lastResult = result;

    // Everything below just DISPLAYS what the server decided.
    updateHealth('player', result.playerHp);
    updateHealth('guardian', result.guardianHp);
    playAttack(result.correct ? 'player' : 'guardian');
    floatDamage(result.damage.target, result.damage.amount);
    showFeedback(result);
  } catch (err) {
    showError(err.message);
    // If the game no longer exists there is nothing to retry; otherwise let them try again.
    if (err.status !== 404 && err.status !== 409) setControlsEnabled(true);
  } finally {
    state.busy = false;
  }
}

function goNext() {
  const result = state.lastResult;
  if (!result) return;
  if (result.status === 'playing') {
    showQuestion(result.nextQuestion);
  } else {
    showEndScreen(result);
  }
}

// ---------- Wire up the buttons ----------

els.bitButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const i = Number(button.dataset.index);
    state.bits[i] = state.bits[i] === 0 ? 1 : 0; // flip 0 <-> 1
    renderBits();
  });
});
els.submitBtn.addEventListener('click', submitAnswer);
els.nextBtn.addEventListener('click', goNext);
els.playAgainBtn.addEventListener('click', startNewGame);
els.retryBtn.addEventListener('click', startNewGame);

// ---------- Go! ----------
renderBits();
setControlsEnabled(false);
startNewGame();
