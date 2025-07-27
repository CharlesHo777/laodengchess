import { Chess, SQUARES } from "chess.js";
import { Chessground } from '@lichess-org/chessground';

const boardElement = document.getElementById("board");

// Initialize Chess.js game logic
const chess = new Chess();

// Initialize Chessground
const ground = Chessground(boardElement, {
  draggable: {
    enabled: true,
    showGhost: true,
  },
  orientation: 'white',
  highlight: {
    lastMove: true,
    check: true
  },
  movable: {
    free: false,
    color: 'white',
    showDests: true,
    dests: getDests()
  },
  events: {
    move: onUserMove
  }
});

// Stockfish Web Worker
const engine = new Worker("/stockfish-17-lite.js");  // STOCKFISH is exposed by stockfish.js

// Send UCI init commands
engine.postMessage('uci');
engine.postMessage('setoption name Threads value 2');
engine.postMessage('isready');

// Respond to engine outputs
engine.onmessage = function(event) {
  // 1. Pull out what the worker sent us
  let line = event.data;
  
  // 2. If it isn’t already a string, make it one
  if (typeof line !== 'string') {
    if (line instanceof ArrayBuffer) {
      // TextDecoder turns bytes into a JS string
      line = new TextDecoder('utf-8').decode(line);
    } else {
      // Fallback for anything else
      line = String(line);
    }
  }
  
  // (optional) log so you can see exactly what’s coming back:
  console.log('↩ stockfish:', line);
  
  // 3. Now it’s safe to use startsWith()
  if (line.startsWith('readyok')) {
    // engine is ready (you could kick off your first 'position' here)
  }
  if (line.startsWith('bestmove')) {
    const best = line.split(' ')[1];
    chess.move({ from: best.slice(0,2), to: best.slice(2,4) });
    ground.set({
      fen: chess.fen(),
      turnColor: chess.turn() === 'w' ? 'white' : 'black',
      movable: { color: 'white', dests: getDests() }
    });
  }
};

// Compute legal destinations map for Chessground
function getDests() {
  const dests = new Map();
  SQUARES.forEach(sq => {
    const moves = chess.moves({ square: sq, verbose: true });
    if (moves.length) {
      // Map from source square → array of destination squares
      dests.set(sq, moves.map(m => m.to));
    }
  });
  return dests;
}

// Handler when user makes a move on the board
function onUserMove(orig, dest) {
  const move = chess.move({ from: orig, to: dest, promotion: 'q' });
  if (move === null) return; // illegal
  ground.set({
    fen: chess.fen(),
    turnColor: 'black',
    movable: { color: 'white', dests: getDests() }
  });
  makeAIMove();
}

// Ask Stockfish for its move
function makeAIMove() {
  engine.postMessage('position fen ' + chess.fen());
  engine.postMessage('go depth 15');  // adjust depth for strength/speed
}

// Control buttons
document.getElementById('newGame').addEventListener('click', () => {
  chess.reset();
  ground.set({
    fen: chess.fen(),
    turnColor: 'white',
    orientation: 'white',
    movable: { color: 'white', dests: getDests() }
  });
});

// document.getElementById('flipBtn').addEventListener('click', () => {
//   ground.set({ orientation: ground.state.orientation === 'white' ? 'black' : 'white' });
// });
