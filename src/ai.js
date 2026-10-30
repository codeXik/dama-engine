// The computer player: iterative-deepening alpha-beta over the rules in dama.js.
// Levels: easy (shallow and sometimes careless), normal, hard (as deep as the time allows).
import { WHITE, BLACK, legalMoves, applyMove, rowOf, colOf, sideOf, kindOf } from './dama.js';

export const LEVELS = {
  easy: { depth: 2, ms: 150, slip: 0.35 },
  normal: { depth: 5, ms: 500, slip: 0 },
  hard: { depth: 14, ms: 1200, slip: 0 },
};

const MAN_VALUE = 100;
const DAMA_VALUE = 320;
const WIN = 100000;
const MAX_EXTEND = 6;

// Score from white's point of view.
function evaluate (board) {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (p === 0) continue;
    const side = sideOf(p);
    let v;
    if (kindOf(p) === 1) {
      const advance = side === WHITE ? 6 - rowOf(sq) : rowOf(sq) - 1; // 0 on the start rows, up to 6
      v = MAN_VALUE + advance * 6 + (advance >= 5 ? 14 : 0);
      if (colOf(sq) === 0 || colOf(sq) === 7) v -= 3;
    } else {
      const centre = 3.5 - Math.max(Math.abs(rowOf(sq) - 3.5), Math.abs(colOf(sq) - 3.5)) + 0.5;
      v = DAMA_VALUE + centre * 3;
    }
    score += side * v;
  }
  return score;
}

class Timeout extends Error {}

function search (state, depth, alpha, beta, ply, extended, ctx) {
  if ((++ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) throw new Timeout();
  const moves = legalMoves(state);
  if (moves.length === 0) return -WIN + ply; // the side to move has lost
  if (state.quiet >= 100) return 0;
  const forced = moves[0].caps.length > 0;
  if (depth <= 0 && !(forced && extended < MAX_EXTEND)) return state.turn * evaluate(state.board);
  const ext = depth <= 0 ? 1 : 0;
  order(moves, state);
  let best = -Infinity;
  for (const m of moves) {
    const score = -search(applyMove(state, m), depth - 1 + ext, -beta, -alpha, ply + 1, extended + ext, ctx);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Longer captures first, then moves that crown or advance.
function order (moves, state) {
  const row = state.turn === WHITE ? (m) => 7 - rowOf(m.to) : (m) => rowOf(m.to);
  moves.sort((a, b) => (b.caps.length - a.caps.length) || (row(b) - row(a)));
}

// Picks a move for state.turn. `thinkMs` caps the thinking time (default: the level's own).
export function chooseMove (state, level = 'normal', thinkMs) {
  const moves = legalMoves(state);
  if (moves.length <= 1) return moves[0] ?? null;
  const cfg = LEVELS[level] ?? LEVELS.normal;
  const deadline = performance.now() + (thinkMs ?? cfg.ms);
  const ctx = { nodes: 0, deadline };
  order(moves, state);
  let best = moves[0];
  let ranked = moves.map((m) => ({ m, score: 0 }));
  for (let depth = 1; depth <= cfg.depth; depth++) {
    try {
      const scored = [];
      let alpha = -Infinity;
      for (const m of moves) {
        const score = -search(applyMove(state, m), depth - 1, -Infinity, -alpha, 1, 0, ctx);
        scored.push({ m, score });
        if (score > alpha) alpha = score;
      }
      scored.sort((a, b) => b.score - a.score);
      ranked = scored;
      best = scored[0].m;
      moves.sort((a, b) => scored.findIndex((s) => s.m === a) - scored.findIndex((s) => s.m === b));
      if (scored[0].score > WIN - 100) break; // a forced win was found
    } catch (e) {
      if (e instanceof Timeout) break;
      throw e;
    }
  }
  // The easy level now and then plays the second or third best move.
  if (cfg.slip > 0 && ranked.length > 1 && Math.random() < cfg.slip) {
    return ranked[1 + Math.floor(Math.random() * Math.min(2, ranked.length - 1))].m;
  }
  return best;
}
