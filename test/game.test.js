// Run with: npm test   (uses Node's built-in test runner, no extra packages)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const game = require('../game');

// Helper: make a game with a question we choose.
function gameWith(a, b) {
  const g = game.createGame('test');
  g.question = { a, b };
  return g;
}

test('correct answer damages the guardian by 20', () => {
  const g = gameWith(7, 3); // 0111 + 0011 = 1010
  const r = game.submitAnswer(g, [1, 0, 1, 0]);
  assert.strictEqual(r.correct, true);
  assert.strictEqual(r.correctBits, '1010');
  assert.strictEqual(r.guardianHp, 80);
  assert.strictEqual(r.playerHp, 100);
});

test('wrong answer damages the player by 10', () => {
  const g = gameWith(7, 3);
  const r = game.submitAnswer(g, [0, 0, 0, 0]);
  assert.strictEqual(r.correct, false);
  assert.strictEqual(r.playerHp, 90);
  assert.strictEqual(r.guardianHp, 100);
});

test('carry-out: only the lower four bits are the answer', () => {
  const g = gameWith(12, 9); // 21 = 10101 -> lower four bits 0101
  const r = game.submitAnswer(g, [0, 1, 0, 1]);
  assert.strictEqual(r.correct, true);
  assert.strictEqual(r.carryOut, 1);
  assert.match(r.explanation.join(' '), /carry-out/);
});

test('guardian reaches 0 HP after five correct answers -> won', () => {
  const g = game.createGame('t');
  let r;
  for (let i = 0; i < 5; i++) {
    g.question = { a: 1, b: 1 };
    r = game.submitAnswer(g, [0, 0, 1, 0]);
  }
  assert.strictEqual(r.status, 'won');
  assert.strictEqual(r.guardianHp, 0);
  assert.strictEqual(r.nextQuestion, null);
});

test('player reaches 0 HP after ten wrong answers -> lost', () => {
  const g = game.createGame('t');
  let r;
  for (let i = 0; i < 10; i++) {
    g.question = { a: 1, b: 1 };
    r = game.submitAnswer(g, [1, 1, 1, 1]);
  }
  assert.strictEqual(r.status, 'lost');
  assert.strictEqual(r.playerHp, 0);
});

test('isValidBits rejects bad input', () => {
  assert.strictEqual(game.isValidBits([0, 1, 0, 1]), true);
  for (const bad of [null, 'abcd', [0, 1, 0], [0, 1, 0, 1, 1], ['1', 0, 0, 0], [true, 0, 0, 0], [2, 0, 0, 0], {}]) {
    assert.strictEqual(game.isValidBits(bad), false);
  }
});

test('generated questions are 4-bit numbers and include some carries', () => {
  let carries = 0;
  for (let i = 0; i < 500; i++) {
    const { a, b } = game.generateQuestion();
    assert.ok(a >= 1 && a <= 15 && b >= 1 && b <= 15);
    if (a + b > 15) carries++;
  }
  assert.ok(carries > 50 && carries < 450);
});
