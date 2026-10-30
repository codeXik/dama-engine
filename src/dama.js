// Turkish draughts (Türk daması) rules: no screen, no clock, only positions and moves.
//
// Board: 64 squares, index = row * 8 + col, row 0 is the top. White (WHITE = 1) starts at the bottom and
// moves up, black (BLACK = -1) starts at the top and moves down. Pieces: 1 / -1 man (taş), 2 / -2 dama (king).
// Rules: men step forward or sideways and capture forward or sideways; a dama slides and captures like a rook.
// Capturing is compulsory and the longest capture must be taken (pieces count the same). Captured pieces are
// removed when the whole move is over, so they block the way and cannot be jumped twice. A man is crowned
// when its move ends on the last row. No pieces or no legal move loses.

export const WHITE = 1;
export const BLACK = -1;
export const MAN = 1;
export const DAMA = 2;
export const QUIET_DRAW = 100; // plies without a capture or a man move that end the game as a draw

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export const rowOf = (sq) => sq >> 3;
export const colOf = (sq) => sq & 7;
export const sideOf = (piece) => (piece > 0 ? WHITE : piece < 0 ? BLACK : 0);
export const kindOf = (piece) => Math.abs(piece);
export const squareName = (sq) => 'abcdefgh'[colOf(sq)] + (8 - rowOf(sq));

export function initialState () {
  const board = new Int8Array(64);
  for (let c = 0; c < 8; c++) {
    board[8 + c] = -MAN;
    board[16 + c] = -MAN;
    board[40 + c] = MAN;
    board[48 + c] = MAN;
  }
  return { board, turn: WHITE, quiet: 0 };
}

export const cloneState = (s) => ({ board: Int8Array.from(s.board), turn: s.turn, quiet: s.quiet });

export const stateToJSON = (s) => ({ board: Array.from(s.board), turn: s.turn, quiet: s.quiet });
export const stateFromJSON = (j) => ({ board: Int8Array.from(j.board), turn: j.turn, quiet: j.quiet });

// A step of `n` squares in direction [dr, dc] from `sq`, or -1 when it leaves the board.
function step (sq, dr, dc, n = 1) {
  const r = rowOf(sq) + dr * n;
  const c = colOf(sq) + dc * n;
  return r < 0 || r > 7 || c < 0 || c > 7 ? -1 : r * 8 + c;
}

// Moves are { from, to, path, caps }: path = every square the piece lands on (the last one is `to`),
// caps = the captured squares in order. A plain step has one path square and no caps.
function captureSearch (board, side, piece, sq, caps, path, out) {
  let extended = false;
  const forward = side === WHITE ? -1 : 1;
  for (const [dr, dc] of DIRS) {
    if (kindOf(piece) === MAN) {
      if (dr === -forward) continue; // men never capture backwards
      const mid = step(sq, dr, dc);
      const land = mid < 0 ? -1 : step(mid, dr, dc);
      if (land < 0 || sideOf(board[mid]) !== -side || caps.includes(mid) || board[land] !== 0) continue;
      extended = true;
      captureSearch(board, side, piece, land, [...caps, mid], [...path, land], out);
    } else {
      let n = 1;
      let mid = step(sq, dr, dc, n);
      while (mid >= 0 && board[mid] === 0) mid = step(sq, dr, dc, ++n);
      if (mid < 0 || sideOf(board[mid]) !== -side || caps.includes(mid)) continue;
      for (let k = n + 1; ; k++) {
        const land = step(sq, dr, dc, k);
        if (land < 0 || board[land] !== 0) break;
        extended = true;
        captureSearch(board, side, piece, land, [...caps, mid], [...path, land], out);
      }
    }
  }
  if (!extended && caps.length > 0) out.push({ from: path[0], to: sq, path: path.slice(1), caps });
}

export function legalMoves (state) {
  const { board, turn: side } = state;
  const captures = [];
  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq];
    if (sideOf(piece) !== side) continue;
    board[sq] = 0; // the moving piece leaves its square, so it may pass over it
    captureSearch(board, side, piece, sq, [], [sq], captures);
    board[sq] = piece;
  }
  if (captures.length > 0) {
    const most = Math.max(...captures.map((m) => m.caps.length));
    return captures.filter((m) => m.caps.length === most);
  }
  const moves = [];
  const forward = side === WHITE ? -1 : 1;
  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq];
    if (sideOf(piece) !== side) continue;
    for (const [dr, dc] of DIRS) {
      if (kindOf(piece) === MAN) {
        if (dr === -forward) continue;
        const to = step(sq, dr, dc);
        if (to >= 0 && board[to] === 0) moves.push({ from: sq, to, path: [to], caps: [] });
      } else {
        for (let n = 1; ; n++) {
          const to = step(sq, dr, dc, n);
          if (to < 0 || board[to] !== 0) break;
          moves.push({ from: sq, to, path: [to], caps: [] });
        }
      }
    }
  }
  return moves;
}

// Plays a legal move and returns the new state (the old one is left alone).
export function applyMove (state, move) {
  const next = cloneState(state);
  const piece = next.board[move.from];
  next.board[move.from] = 0;
  for (const c of move.caps) next.board[c] = 0;
  const lastRow = state.turn === WHITE ? 0 : 7;
  next.board[move.to] = kindOf(piece) === MAN && rowOf(move.to) === lastRow ? piece * 2 : piece;
  next.quiet = move.caps.length > 0 || kindOf(piece) === MAN ? 0 : state.quiet + 1;
  next.turn = -state.turn;
  return next;
}

export function countPieces (state) {
  const n = { [WHITE]: { men: 0, damas: 0 }, [BLACK]: { men: 0, damas: 0 } };
  for (const p of state.board) if (p !== 0) n[sideOf(p)][kindOf(p) === MAN ? 'men' : 'damas']++;
  return n;
}

// null while the game goes on; otherwise { winner: WHITE | BLACK | 0, reason }.
export function gameResult (state, moves = legalMoves(state)) {
  if (moves.length === 0) {
    const mine = countPieces(state)[state.turn];
    return { winner: -state.turn, reason: mine.men + mine.damas === 0 ? 'noPieces' : 'blocked' };
  }
  if (state.quiet >= QUIET_DRAW) return { winner: 0, reason: 'quiet' };
  return null;
}

export const sameMove = (a, b) => a.from === b.from && a.to === b.to && a.path.join() === b.path.join();
