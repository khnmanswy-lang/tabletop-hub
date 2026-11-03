const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Hand } = require('pokersolver');

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 5;
const STAGES = ['WAITING', 'PRE-FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

const HTML_CLIENT = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function createBlindHeistRoom() {
  let state = {
    stageIdx: 0,
    deck: [],
    community: [],
    players: {},
    seatOrder: [],
    result: null
  };

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map();

  function createDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push(r + s);
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function startNewGame() {
    if (state.seatOrder.length < MIN_PLAYERS) {
      state.stageIdx = 0;
      state.deck = [];
      state.community = [];
      state.result = null;
      for (const token of state.seatOrder) {
        const p = state.players[token];
        p.hand = [];
        p.ranks = [null, null, null, null];
        p.currentRank = null;
        p.locked = false;
      }
      return;
    }

    state.deck = createDeck();
    state.community = [];
    state.stageIdx = 1;
    state.result = null;
    for (const token of state.seatOrder) {
      const p = state.players[token];
      p.hand = [state.deck.pop(), state.deck.pop()];
      p.ranks = [null, null, null, null];
      p.currentRank = null;
      p.locked = false;
    }
  }

  function advanceStage() {
    const histIdx = state.stageIdx - 1;
    for (const token of state.seatOrder) {
      const p = state.players[token];
      p.ranks[histIdx] = p.currentRank;
      p.locked = false;
    }

    state.stageIdx++;
    const stage = STAGES[state.stageIdx];

    if (stage === 'FLOP') state.community.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
    else if (stage === 'TURN' || stage === 'RIVER') state.community.push(state.deck.pop());
    else if (stage === 'SHOWDOWN') evaluateShowdown();
  }

  function evaluateShowdown() {
    const solved = state.seatOrder.map(token => {
      const p = state.players[token];
      const solvedHand = Hand.solve([...p.hand, ...state.community]);
      return {
        token,
        name: p.name,
        hand: p.hand,
        claimedRank: p.ranks[3],
        descr: solvedHand.descr,
        solvedObj: solvedHand
      };
    });

    solved.sort((a, b) => a.claimedRank - b.claimedRank);

    let isWin = true;
    for (let i = 0; i < solved.length - 1; i++) {
      const curr = solved[i].solvedObj;
      const next = solved[i + 1].solvedObj;
      const winners = Hand.winners([curr, next]);
      if (winners.length === 1 && winners[0] === curr) {
        isWin = false;
        break;
      }
    }

    state.result = {
      isWin,
      breakdown: solved.map(s => ({
        name: s.name,
        hand: s.hand,
        claimedRank: s.claimedRank,
        descr: s.descr
      }))
    };
  }

  function getSanitizedState(viewerToken) {
    const stage = STAGES[state.stageIdx];
    const isShowdown = stage === 'SHOWDOWN';
    return {
      stage,
      stageIdx: state.stageIdx,
      community: state.community,
      playerCount: state.seatOrder.length,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      result: state.result,
      players: state.seatOrder.map((token, idx) => {
        const p = state.players[token];
        const isMe = token === viewerToken;
        let myHint = null;
        if ((isMe || isShowdown) && p.hand.length === 2) {
          myHint = Hand.solve([...p.hand, ...state.community]).descr;
        }
        return {
          token,
          seat: idx + 1,
          isMe,
          name: p.name,
          connected: p.connected,
          hand: (isMe || isShowdown) ? p.hand : (p.hand.length === 2 ? ['??', '??'] : []),
          myHint,
          ranks: p.ranks,
          currentRank: p.currentRank,
          locked: p.locked
        };
      })
    };
  }

  function broadcast() {
    for (const [ws, token] of clients.entries()) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify(getSanitizedState(token)));
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'JOIN') {
          const token = msg.token;
          clients.set(ws, token);
          if (!state.players[token]) {
            if (state.seatOrder.length >= MAX_PLAYERS) return;
            state.seatOrder.push(token);
            state.players[token] = {
              name: msg.name || `Agent ${state.seatOrder.length}`,
              hand: [],
              ranks: [null, null, null, null],
              currentRank: null,
              locked: false,
              connected: true
            };
            if (state.seatOrder.length >= MIN_PLAYERS && state.stageIdx <= 1) {
              startNewGame();
            }
          } else {
            state.players[token].connected = true;
            if (msg.name) state.players[token].name = msg.name;
          }
          broadcast();
        }

        const token = clients.get(ws);
        const player = state.players[token];
        if (!player) return;

        if (msg.type === 'CLAIM_RANK' && state.stageIdx >= 1 && state.stageIdx <= 4) {
          const r = Number(msg.rank);
          if (r < 1 || r > state.seatOrder.length) return;
          if (player.currentRank !== r) {
            player.locked = false;
          }
          player.currentRank = r;
          broadcast();
        }

        if (msg.type === 'TOGGLE_LOCK' && state.stageIdx >= 1 && state.stageIdx <= 4) {
          if (!player.currentRank) return;
          if (!player.locked) {
            const rankToLock = player.currentRank;
            for (const t of state.seatOrder) {
              if (t !== token && state.players[t].currentRank === rankToLock) {
                state.players[t].currentRank = null;
                state.players[t].locked = false;
              }
            }
            player.locked = true;
          } else {
            player.locked = false;
          }

          const allLocked = state.seatOrder.length >= MIN_PLAYERS &&
            state.seatOrder.every(t => state.players[t].locked && state.players[t].currentRank !== null);
          if (allLocked) advanceStage();
          broadcast();
        }

        if (msg.type === 'NEW_GAME') {
          startNewGame();
          broadcast();
        }

        if (msg.type === 'KICK' && msg.targetToken) {
          state.seatOrder = state.seatOrder.filter(t => t !== msg.targetToken);
          delete state.players[msg.targetToken];
          startNewGame();
          broadcast();
        }
      } catch (e) {
        console.error(e);
      }
    });

    ws.on('close', () => {
      const token = clients.get(ws);
      if (token && state.players[token]) {
        state.players[token].connected = false;
        broadcast();
      }
      clients.delete(ws);
    });
  });

  return {
    wss,
    serveHtml: (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML_CLIENT);
    }
  };
}

module.exports = { createBlindHeistRoom };
