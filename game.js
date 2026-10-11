// game.js — the RULES of Clockwork Core.
// This file has no web/Express code in it, so it is easy to read and to test.
// The server (server.js) calls these functions; the browser never decides anything.
'use strict';

const MAX_HP = 100;
const CORRECT_DAMAGE = 20; // guardian loses this much when the player is right
const WRONG_DAMAGE = 10;   // player loses this much when the player is wrong
const BIT_COUNT = 4;       // we add 4-bit unsigned numbers (0..15)

// ---------- small helpers ----------

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 5 -> "0101" (always padded to 4 digits unless a different width is given)
function toBinary(value, width = BIT_COUNT) {
  return value.toString(2).padStart(width, '0');
}

// ---------- questions ----------

// Pick two numbers from 1..15. About 1 question in 3 overflows past 15,
// so students regularly see the carry-out case.
function generateQuestion() {
  const wantCarry = Math.random() < 0.35;
  let a, b;
  do {
    a = randomInt(1, 15);
    b = randomInt(1, 15);
  } while ((a + b > 15) !== wantCarry);
  return { a, b };
}

// What the browser is allowed to see about the current question.
// (It never receives the answer.)
function publicQuestion(game) {
  return { turn: game.turn, a: toBinary(game.question.a), b: toBinary(game.question.b) };
}

// ---------- game state ----------

function createGame(id) {
  return {
    id,
    playerHp: MAX_HP,
    guardianHp: MAX_HP,
    turn: 1,
    status: 'playing', // 'playing' | 'won' | 'lost'
    question: generateQuestion(),
    lastActive: Date.now(),
  };
}

// The answer must be an array of exactly four values, each the number 0 or 1.
// (Strings like "1" or booleans are rejected on purpose.)
function isValidBits(bits) {
  return (
    Array.isArray(bits) &&
    bits.length === BIT_COUNT &&
    bits.every((bit) => bit === 0 || bit === 1)
  );
}

// ---------- explanation ----------

// Walk through the addition one column at a time, from right to left,
// the same way you would on paper.
function explainAddition(a, b) {
  const lines = [];
  let carry = 0;

  for (let i = 0; i < BIT_COUNT; i++) {
    const bitA = (a >> i) & 1;
    const bitB = (b >> i) & 1;
    const total = bitA + bitB + carry;
    const written = total % 2;
    const newCarry = total >> 1;
    lines.push(
      `Column ${i + 1} from the right: ${bitA} + ${bitB} + carry ${carry} = ${total.toString(2)}` +
        ` → write ${written}, carry ${newCarry}`
    );
    carry = newCarry;
  }

  const sum = a + b;
  if (sum > 15) {
    lines.push(
      `In decimal: ${a} + ${b} = ${sum}, which is ${toBinary(sum, 5)} in binary. ` +
        `That needs 5 bits: the leftmost 1 is the carry-out. ` +
        `The answer boxes hold only the lower four bits: ${toBinary(sum & 15)}.`
    );
  } else {
    lines.push(`In decimal: ${a} + ${b} = ${sum}, which is ${toBinary(sum)} in binary. No carry-out.`);
  }
  return lines;
}

// ---------- answering ----------

// Checks the answer, applies damage, and moves the game forward.
// `bits` must already have passed isValidBits().
function submitAnswer(game, bits) {
  const { a, b } = game.question;
  const sum = a + b;
  const correctValue = sum & 0b1111; // keep only the lower four bits
  const carryOut = sum > 15 ? 1 : 0;
  const submittedValue = bits.reduce((value, bit) => value * 2 + bit, 0);
  const correct = submittedValue === correctValue;

  let damage;
  if (correct) {
    game.guardianHp = Math.max(0, game.guardianHp - CORRECT_DAMAGE);
    damage = { target: 'guardian', amount: CORRECT_DAMAGE };
  } else {
    game.playerHp = Math.max(0, game.playerHp - WRONG_DAMAGE);
    damage = { target: 'player', amount: WRONG_DAMAGE };
  }

  const explanation = explainAddition(a, b);

  // Is the fight over? If not, prepare the next question.
  if (game.guardianHp === 0) {
    game.status = 'won';
  } else if (game.playerHp === 0) {
    game.status = 'lost';
  } else {
    game.turn += 1;
    game.question = generateQuestion();
  }
  game.lastActive = Date.now();

  return {
    correct,
    submittedBits: toBinary(submittedValue),
    correctBits: toBinary(correctValue),
    carryOut,
    explanation,
    damage,
    playerHp: game.playerHp,
    guardianHp: game.guardianHp,
    status: game.status,
    nextQuestion: game.status === 'playing' ? publicQuestion(game) : null,
  };
}

module.exports = {
  MAX_HP,
  CORRECT_DAMAGE,
  WRONG_DAMAGE,
  generateQuestion,
  publicQuestion,
  createGame,
  isValidBits,
  explainAddition,
  submitAnswer,
  toBinary,
};
