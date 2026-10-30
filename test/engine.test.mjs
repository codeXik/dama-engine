import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WHITE, BLACK, initialState, legalMoves, applyMove, gameResult, countPieces, squareName } from '../src/dama.js';
import { chooseMove } from '../src/ai.js';

const sq = (name) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);
// Builds a position from { a1: 1, d4: -2, ... }.
function position (pieces, turn = WHITE) {
  const board = new Int8Array(64);
  for (const [name, p] of Object.entries(pieces)) board[sq(name)] = p;
  return { board, turn, quiet: 0 };
}
const names = (moves) => moves.map((m) => `${squareName(m.from)}-${m.path.map(squareName).join('-')}`).sort();

test('start position: 16 men each, 8 opening moves, white to move', () => {
  const s = initialState();
  assert.deepEqual(countPieces(s)[WHITE], { men: 16, damas: 0 });
  assert.deepEqual(countPieces(s)[BLACK], { men: 16, damas: 0 });
  assert.equal(legalMoves(s).length, 8);
  assert.equal(s.turn, WHITE);
});

test('a man steps forward and sideways, never backwards', () => {
  assert.deepEqual(names(legalMoves(position({ d4: 1 }))), ['d4-c4', 'd4-d5', 'd4-e4']);
  assert.deepEqual(names(legalMoves(position({ d4: -1 }, BLACK))), ['d4-c4', 'd4-d3', 'd4-e4']);
});

test('a man captures forward and sideways but not backwards', () => {
  assert.deepEqual(names(legalMoves(position({ d4: 1, d5: -1 }))), ['d4-d6']);
  assert.deepEqual(names(legalMoves(position({ d4: 1, e4: -1 }))), ['d4-f4']);
  // the enemy behind is not taken: only plain steps remain
  const moves = legalMoves(position({ d4: 1, d3: -1 }));
  assert.ok(moves.every((m) => m.caps.length === 0));
});

test('capturing is compulsory', () => {
  const moves = legalMoves(position({ d4: 1, d5: -1, a1: 1 }));
  assert.deepEqual(names(moves), ['d4-d6']);
});

test('the longest capture must be taken', () => {
  // d4 can take one piece to the left, or two pieces going up and then right
  const s = position({ d4: 1, c4: -1, d5: -1, e6: -1, h8: -1 });
  const moves = legalMoves(s);
  assert.deepEqual(names(moves), ['d4-d6-f6']);
  assert.equal(moves[0].caps.length, 2);
});

test('captured pieces are removed only after the move and cannot be jumped twice', () => {
  const s = position({ d4: 1, d5: -1, e6: -1 });
  const [m] = legalMoves(s);
  assert.deepEqual(m.caps.map(squareName), ['d5', 'e6']);
  const next = applyMove(s, m);
  assert.equal(next.board[sq('d5')], 0);
  assert.equal(next.board[sq('e6')], 0);
  assert.equal(next.board[sq('f6')], 1);
});

test('a man ending on the last row becomes a dama', () => {
  const next = applyMove(position({ d7: 1, a1: -1 }), legalMoves(position({ d7: 1, a1: -1 })).find((m) => m.to === sq('d8')));
  assert.equal(next.board[sq('d8')], 2);
});

test('a man that passes the last row while capturing is crowned only if it ends there', () => {
  // d7 takes d8? impossible; here e7 takes sideways along the seventh row and stays a man
  const s = position({ b7: 1, c7: -1, e7: -1 });
  const [m] = legalMoves(s);
  assert.equal(m.to, sq('f7'));
  assert.equal(applyMove(s, m).board[sq('f7')], 1);
});

test('a dama slides any distance and captures from afar', () => {
  const s = position({ a1: 2, a5: -1 });
  const moves = legalMoves(s);
  // a1 jumps a5, landing on a6, a7 or a8
  assert.deepEqual(names(moves), ['a1-a6', 'a1-a7', 'a1-a8']);
  const plain = legalMoves(position({ d4: 2 }));
  assert.equal(plain.length, 14);
});

test('a dama may not jump two pieces in a row without a gap', () => {
  const moves = legalMoves(position({ a1: 2, a4: -1, a5: -1 }));
  assert.equal(moves.filter((m) => m.caps.length > 0).length, 0);
});

test('the dama continues in another direction and takes the longest route', () => {
  const s = position({ a1: 2, a4: -1, d6: -1 });
  const moves = legalMoves(s);
  // a1 x a4 lands a5 / a6 / a7 / a8; from a6 it can take d6
  assert.ok(moves.every((m) => m.caps.length === 2));
  assert.ok(moves.some((m) => m.path[0] === sq('a6')));
});

test('no pieces or no moves loses; a stuck side loses', () => {
  const s = position({ a1: 1 }, BLACK);
  assert.deepEqual(gameResult(s), { winner: WHITE, reason: 'noPieces' });
  const blocked = position({ a8: -1, a7: 1, b8: 1, a6: 1, b7: 1, c8: 1 }, BLACK);
  assert.equal(gameResult(blocked)?.winner, WHITE);
});

test('quiet moves end in a draw', () => {
  const s = { ...position({ a1: 2, h8: -2 }), quiet: 100 };
  assert.deepEqual(gameResult(s), { winner: 0, reason: 'quiet' });
});

test('the computer takes a free piece and avoids losing one', () => {
  const grab = position({ d4: 1, d5: -1, h1: 1, h8: -1 });
  assert.equal(chooseMove(grab, 'normal', 200).to, sq('d6'));
});

test('computer vs computer plays legal moves and finishes', () => {
  for (const level of ['easy', 'normal']) {
    let s = initialState();
    for (let ply = 0; ply < 300 && !gameResult(s); ply++) {
      const m = chooseMove(s, level, 10);
      assert.ok(legalMoves(s).some((x) => x.from === m.from && x.to === m.to && x.path.join() === m.path.join()), 'illegal move');
      s = applyMove(s, m);
    }
  }
});

test('300 random games never break the rules', () => {
  for (let g = 0; g < 300; g++) {
    let s = initialState();
    let ply = 0;
    while (!gameResult(s) && ply++ < 400) {
      const moves = legalMoves(s);
      const longest = Math.max(...moves.map((m) => m.caps.length));
      assert.ok(moves.every((m) => m.caps.length === longest), 'mixed capture lengths');
      const before = countPieces(s);
      s = applyMove(s, moves[Math.floor(Math.random() * moves.length)]);
      const after = countPieces(s);
      assert.ok(after[WHITE].men + after[WHITE].damas + after[BLACK].men + after[BLACK].damas <= before[WHITE].men + before[WHITE].damas + before[BLACK].men + before[BLACK].damas);
    }
  }
});
