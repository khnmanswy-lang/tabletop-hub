/**
 * SLAVE CARD GAME (ไพ่สลาฟ) — Real-Time Multiplayer Server
 * Supports 3–6 Players.
 *
 * Rules:
 *  - Ranks: 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2 (3 lowest, 2 highest)
 *  - Suits: ♣ (c) < ♦ (d) < ♥ (h) < ♠ (s)
 *  - Round 1: Holder of 3♣ leads the first trick.
 *  - Plays: Single, Pair, Triple, Quad.
 *  - Cutting: Triple (ตอง) cuts Single (เดี่ยว); Quad (โฟร์) cuts Pair (คู่).
 *  - Hard Pass: Passing locks player out of current trick until board clears.
 *  - Roles: King, Queen, Citizen(s), Vice-Slave, Slave based on finish order.
 *  - Tribute: Slave gives highest card(s) to King; Vice-Slave gives highest to Queen.
 *  - ล้มเจ้า (King Overthrow): If anyone finishes 1st before King in Round 2+,
 *    they become the new King and the former King immediately falls to Slave!
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const RANKS = ['3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A', '2'];
const SUITS = ['c', 'd', 'h', 's'];
const SUIT_NAMES = { c: '♣ Club', d: '♦ Diamond', h: '♥ Heart', s: '♠ Spade' };
const RANK_NAMES = {
  '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  'T': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A', '2': '2'
};

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;

// Role distribution by player count
const ROLE_TEMPLATES = {
  3: ['KING', 'CITIZEN', 'SLAVE'],
  4: ['KING', 'QUEEN', 'VICE_SLAVE', 'SLAVE'],
  5: ['KING', 'QUEEN', 'CITIZEN', 'VICE_SLAVE', 'SLAVE'],
  6: ['KING', 'QUEEN', 'CITIZEN', 'CITIZEN', 'SLAVE_VICE', 'SLAVE']
};

const TRIBUTE_RULES = {
  3: { kingGet: 1, slaveGive: 1, queenGet: 0, viceGive: 0 },
  4: { kingGet: 2, slaveGive: 2, queenGet: 1, viceGive: 1 },
  5: { kingGet: 2, slaveGive: 2, queenGet: 1, viceGive: 1 },
  6: { kingGet: 2, slaveGive: 2, queenGet: 1, viceGive: 1 }
};

function getCardScore(card) {
  if (!card || card.length < 2) return -1;
  const rank = card[0];
  const suit = card[1];
  const rIdx = RANKS.indexOf(rank);
  const sIdx = SUITS.indexOf(suit);
  if (rIdx === -1 || sIdx === -1) return -1;
  return rIdx * 4 + sIdx;
}

function sortCards(cards) {
  return [...cards].sort((a, b) => getCardScore(a) - getCardScore(b));
}

function getCardRankIdx(card) {
  return RANKS.indexOf(card[0]);
}

function classifyCombination(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  const len = cards.length;
  const sorted = sortCards(cards);

  if (len === 1) {
    return {
      type: 'SINGLE',
      rankIdx: getCardRankIdx(sorted[0]),
      rank: sorted[0][0],
      highestCard: sorted[0],
      score: getCardScore(sorted[0]),
      cards: sorted
    };
  }

  const allSameRank = sorted.every(c => c[0] === sorted[0][0]);
  if (!allSameRank) return null;

  const highestCard = sorted[sorted.length - 1];
  const rankIdx = getCardRankIdx(sorted[0]);

  if (len === 2) {
    return {
      type: 'PAIR',
      rankIdx,
      rank: sorted[0][0],
      highestCard,
      score: rankIdx * 4 + SUITS.indexOf(highestCard[1]),
      cards: sorted
    };
  }

  if (len === 3) {
    return {
      type: 'TRIPLE',
      rankIdx,
      rank: sorted[0][0],
      highestCard,
      score: rankIdx * 4 + 3,
      cards: sorted
    };
  }

  if (len === 4) {
    return {
      type: 'QUAD',
      rankIdx,
      rank: sorted[0][0],
      highestCard,
      score: rankIdx * 4 + 3,
      cards: sorted
    };
  }

  return null;
}

function canBeat(newPlay, currentTrick) {
  if (!currentTrick) return true;

  // Single trick
  if (currentTrick.type === 'SINGLE') {
    if (newPlay.type === 'SINGLE') {
      return newPlay.score > currentTrick.score;
    }
    // Triple cuts Single!
    if (newPlay.type === 'TRIPLE') {
      return true;
    }
    return false;
  }

  // Pair trick
  if (currentTrick.type === 'PAIR') {
    if (newPlay.type === 'PAIR') {
      return newPlay.score > currentTrick.score;
    }
    // Quad cuts Pair!
    if (newPlay.type === 'QUAD') {
      return true;
    }
    return false;
  }

  // Triple trick
  if (currentTrick.type === 'TRIPLE') {
    return newPlay.type === 'TRIPLE' && newPlay.rankIdx > currentTrick.rankIdx;
  }

  // Quad trick
  if (currentTrick.type === 'QUAD') {
    return newPlay.type === 'QUAD' && newPlay.rankIdx > currentTrick.rankIdx;
  }

  return false;
}

function createSlaveRoom() {
  const game = {
    stage: 'LOBBY', // 'LOBBY' | 'TRIBUTE' | 'PLAYING' | 'ROUND_OVER'
    roundNumber: 0,
    players: [], // { token, id, name, connected, hand, role, finishRank, isOverthrown }
    turnIndex: 0,
    trickLeaderId: null,
    currentTrick: null, // { type, cards, playedBy, playedByName, highestCard, score, rankIdx }
    trickHistory: [],
    passedPlayerIds: [],
    finishOrder: [], // [playerId1, playerId2, ...]
    roundAnnouncement: null,
    tributeState: null // { exchanges: [{ fromId, toId, cardCount, givenCards: [], returnCards: [] }] }
  };

  const wss = new WebSocketServer({ noServer: true });
  const clientsByToken = new Map();

  function sanitizeStateFor(viewerToken) {
    const viewer = game.players.find(p => p.token === viewerToken);
    const viewerId = viewer ? viewer.id : null;

    return {
      stage: game.stage,
      roundNumber: game.roundNumber,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      turnPlayerId: game.players[game.turnIndex]?.id || null,
      youId: viewerId,
      currentTrick: game.currentTrick,
      passedPlayerIds: game.passedPlayerIds,
      roundAnnouncement: game.roundAnnouncement,
      tributeState: sanitizeTributeFor(viewerId),
      finishOrder: game.finishOrder.map(id => {
        const p = game.players.find(pl => pl.id === id);
        return { id, name: p ? p.name : '', role: p ? p.role : '' };
      }),
      players: game.players.map((p, idx) => {
        const isSelf = p.token === viewerToken;
        return {
          id: p.id,
          seat: idx + 1,
          name: p.name,
          connected: p.connected,
          role: p.role,
          finishRank: p.finishRank,
          isOverthrown: Boolean(p.isOverthrown),
          hasPassed: game.passedPlayerIds.includes(p.id),
          cardCount: p.hand.length,
          hand: isSelf ? p.hand : p.hand.map(() => '??')
        };
      })
    };
  }

  function sanitizeTributeFor(viewerId) {
    if (!game.tributeState) return null;
    return {
      pending: game.tributeState.pending,
      exchanges: game.tributeState.exchanges.map(ex => {
        const isParticipant = ex.fromId === viewerId || ex.toId === viewerId;
        return {
          id: ex.id,
          fromId: ex.fromId,
          fromName: ex.fromName,
          fromRole: ex.fromRole,
          toId: ex.toId,
          toName: ex.toName,
          toRole: ex.toRole,
          cardCount: ex.cardCount,
          givenCards: isParticipant ? ex.givenCards : ex.givenCards.map(() => '??'),
          returnCards: isParticipant ? ex.returnCards : ex.returnCards.map(() => '??'),
          status: ex.status // 'WAITING_RETURN' | 'CONFIRMED'
        };
      })
    };
  }

  function broadcastState() {
    for (const [token, sockets] of clientsByToken.entries()) {
      const payload = JSON.stringify({
        type: 'STATE',
        state: sanitizeStateFor(token)
      });
      for (const ws of sockets) {
        if (ws.readyState === 1) ws.send(payload);
      }
    }
  }

  function startNewMatch() {
    if (game.players.length < MIN_PLAYERS || game.players.length > MAX_PLAYERS) return;
    game.roundNumber = 0;
    for (const p of game.players) {
      p.role = null;
      p.finishRank = null;
      p.isOverthrown = false;
    }
    startNewRound();
  }

  function startNewRound() {
    game.roundNumber += 1;
    game.currentTrick = null;
    game.trickHistory = [];
    game.passedPlayerIds = [];
    game.finishOrder = [];
    game.roundAnnouncement = null;
    game.tributeState = null;

    // Build and deal complete 52-card deck
    const deck = [];
    for (const r of RANKS) {
      for (const s of SUITS) {
        deck.push(r + s);
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const hands = Array.from({ length: game.players.length }, () => []);
    let pIdx = 0;
    while (deck.length > 0) {
      hands[pIdx].push(deck.pop());
      pIdx = (pIdx + 1) % game.players.length;
    }

    for (let i = 0; i < game.players.length; i++) {
      game.players[i].hand = sortCards(hands[i]);
      game.players[i].finishRank = null;
      game.players[i].isOverthrown = false;
    }

    // Round 1: No tribute. Player with 3♣ leads.
    if (game.roundNumber === 1) {
      const leaderIdx = game.players.findIndex(p => p.hand.includes('3c'));
      game.turnIndex = leaderIdx >= 0 ? leaderIdx : 0;
      game.trickLeaderId = game.players[game.turnIndex].id;
      game.stage = 'PLAYING';
      game.roundAnnouncement = `เปิดศึกสลาฟตาแรก! ${game.players[game.turnIndex].name} ถือ 3♣ ได้เป็นคนลงไพ่คนแรก`;
      broadcastState();
      return;
    }

    // Round 2+: Setup Tribute Phase
    setupTributePhase();
  }

  function setupTributePhase() {
    const pCount = game.players.length;
    const rules = TRIBUTE_RULES[pCount];
    if (!rules) {
      beginPlayingRound();
      return;
    }

    const king = game.players.find(p => p.role === 'KING');
    const slave = game.players.find(p => p.role === 'SLAVE');
    const queen = game.players.find(p => p.role === 'QUEEN');
    const vice = game.players.find(p => p.role === 'VICE_SLAVE' || p.role === 'SLAVE_VICE');

    const exchanges = [];

    // Slave gives highest cards to King
    if (king && slave && rules.kingGet > 0) {
      // Sort slave's hand descending to take the absolute highest cards
      const sortedDesc = [...slave.hand].sort((a, b) => getCardScore(b) - getCardScore(a));
      const given = sortedDesc.slice(0, rules.kingGet);

      // Move given cards from Slave to King right now
      slave.hand = slave.hand.filter(c => !given.includes(c));
      king.hand = sortCards([...king.hand, ...given]);

      exchanges.push({
        id: 'king_slave',
        fromId: slave.id,
        fromName: slave.name,
        fromRole: 'SLAVE',
        toId: king.id,
        toName: king.name,
        toRole: 'KING',
        cardCount: rules.kingGet,
        givenCards: given,
        returnCards: [],
        status: 'WAITING_RETURN'
      });
    }

    // Vice-Slave gives highest card to Queen
    if (queen && vice && rules.queenGet > 0) {
      const sortedDesc = [...vice.hand].sort((a, b) => getCardScore(b) - getCardScore(a));
      const given = sortedDesc.slice(0, rules.queenGet);

      vice.hand = vice.hand.filter(c => !given.includes(c));
      queen.hand = sortCards([...queen.hand, ...given]);

      exchanges.push({
        id: 'queen_vice',
        fromId: vice.id,
        fromName: vice.name,
        fromRole: 'VICE_SLAVE',
        toId: queen.id,
        toName: queen.name,
        toRole: 'QUEEN',
        cardCount: rules.queenGet,
        givenCards: given,
        returnCards: [],
        status: 'WAITING_RETURN'
      });
    }

    if (exchanges.length === 0) {
      beginPlayingRound();
      return;
    }

    game.stage = 'TRIBUTE';
    game.tributeState = {
      pending: exchanges.length,
      exchanges
    };
    game.roundAnnouncement = `ธรรมเนียมส่งส่วยเริ่มขึ้น! Slave และ Vice-Slave ส่งมอบไพ่ใบใหญ่ที่สุดให้ King และ Queen`;
    broadcastState();
  }

  function handleReturnTribute(player, exchangeId, returnCardList) {
    if (game.stage !== 'TRIBUTE' || !game.tributeState) return;
    const ex = game.tributeState.exchanges.find(e => e.id === exchangeId || (e.toId === player.id && e.status === 'WAITING_RETURN'));
    if (!ex || ex.toId !== player.id || ex.status !== 'WAITING_RETURN') return;

    if (!Array.isArray(returnCardList) || returnCardList.length !== ex.cardCount) return;

    // Check player holds all return cards
    const hasAll = returnCardList.every(c => player.hand.includes(c));
    if (!hasAll) return;

    // Transfer return cards from King/Queen back to Slave/Vice
    const targetPlayer = game.players.find(p => p.id === ex.fromId);
    if (!targetPlayer) return;

    player.hand = sortCards(player.hand.filter(c => !returnCardList.includes(c)));
    targetPlayer.hand = sortCards([...targetPlayer.hand, ...returnCardList]);

    ex.returnCards = returnCardList;
    ex.status = 'CONFIRMED';
    game.tributeState.pending -= 1;

    if (game.tributeState.pending <= 0) {
      beginPlayingRound();
    } else {
      broadcastState();
    }
  }

  function beginPlayingRound() {
    game.stage = 'PLAYING';
    game.currentTrick = null;
    game.passedPlayerIds = [];

    // In Round 2+, the Slave opens the round!
    const slaveIdx = game.players.findIndex(p => p.role === 'SLAVE');
    game.turnIndex = slaveIdx >= 0 ? slaveIdx : 0;
    game.trickLeaderId = game.players[game.turnIndex].id;
    game.roundAnnouncement = `การแลกไพ่เสร็จสิ้น! ${game.players[game.turnIndex].name} (Slave) ได้เปิดเกมก่อน`;
    broadcastState();
  }

  function advanceTurn() {
    const total = game.players.length;
    // Check if trick should clear:
    // If all remaining active players (with cards) have passed, except the player who played the trick
    const activeUnfinished = game.players.filter(p => p.hand.length > 0);

    if (activeUnfinished.length <= 1) {
      endRound();
      return;
    }

    if (game.currentTrick) {
      const activeNonPassed = activeUnfinished.filter(p => !game.passedPlayerIds.includes(p.id));

      // If everyone active passed, or only 1 person remains and it's the trick winner
      if (activeNonPassed.length === 0 || (activeNonPassed.length === 1 && activeNonPassed[0].id === game.currentTrick.playedBy)) {
        // Clear trick!
        const winner = game.players.find(p => p.id === game.currentTrick.playedBy);
        const winnerName = winner ? winner.name : 'Everyone passed';

        game.roundAnnouncement = `ล้างวง! ไพ่ของ ${winnerName} ชนะรอบนี้ ได้สิทธิ์เปิดกองใหม่`;
        game.currentTrick = null;
        game.passedPlayerIds = [];

        // If winner still has cards, winner leads
        if (winner && winner.hand.length > 0) {
          game.turnIndex = game.players.findIndex(p => p.id === winner.id);
          game.trickLeaderId = winner.id;
          broadcastState();
          return;
        }

        // If winner finished hand on that play, turn passes to next active unfinished player
        let nextIdx = (game.turnIndex + 1) % total;
        while (game.players[nextIdx].hand.length === 0) {
          nextIdx = (nextIdx + 1) % total;
        }
        game.turnIndex = nextIdx;
        game.trickLeaderId = game.players[nextIdx].id;
        broadcastState();
        return;
      }
    }

    // Normal turn advance: find next player who has cards and hasn't passed
    let nextIdx = (game.turnIndex + 1) % total;
    let loopGuard = 0;
    while (loopGuard < total) {
      const candidate = game.players[nextIdx];
      if (candidate.hand.length > 0 && !game.passedPlayerIds.includes(candidate.id)) {
        game.turnIndex = nextIdx;
        broadcastState();
        return;
      }
      nextIdx = (nextIdx + 1) % total;
      loopGuard++;
    }

    // If no one can play, clear trick
    game.currentTrick = null;
    game.passedPlayerIds = [];
    nextIdx = (game.turnIndex + 1) % total;
    while (game.players[nextIdx].hand.length === 0) {
      nextIdx = (nextIdx + 1) % total;
    }
    game.turnIndex = nextIdx;
    broadcastState();
  }

  function handlePlayCards(player, cardList) {
    if (game.stage !== 'PLAYING') return;
    if (game.players[game.turnIndex]?.id !== player.id) return;
    if (player.hand.length === 0) return;
    if (game.passedPlayerIds.includes(player.id)) return;

    if (!Array.isArray(cardList) || cardList.length === 0) return;

    // Check player holds all cards
    const hasAll = cardList.every(c => player.hand.includes(c));
    if (!hasAll) return;

    // Rule: First trick of Round 1 MUST include 3♣
    if (game.roundNumber === 1 && game.trickHistory.length === 0 && !game.currentTrick) {
      if (!cardList.includes('3c')) return;
    }

    const comb = classifyCombination(cardList);
    if (!comb) return;

    // Check can beat current trick
    if (!canBeat(comb, game.currentTrick)) return;

    // Execute play
    player.hand = player.hand.filter(c => !cardList.includes(c));

    const isCutTriple = game.currentTrick && game.currentTrick.type === 'SINGLE' && comb.type === 'TRIPLE';
    const isCutQuad = game.currentTrick && game.currentTrick.type === 'PAIR' && comb.type === 'QUAD';

    let actionDesc = '';
    if (isCutTriple) {
      actionDesc = `💥 ตองปาดเดี่ยว! ${player.name} ลงตอง ${comb.rank} ปาดไพ่เดี่ยว`;
    } else if (isCutQuad) {
      actionDesc = `🔥 โฟร์ปาดคู่! ${player.name} ลงโฟร์ ${comb.rank} ปาดไพ่คู่`;
    } else {
      actionDesc = `${player.name} ลง ${comb.type} [${comb.cards.join(' ')}]`;
    }

    game.currentTrick = {
      type: comb.type,
      rankIdx: comb.rankIdx,
      rank: comb.rank,
      highestCard: comb.highestCard,
      score: comb.score,
      cards: comb.cards,
      playedBy: player.id,
      playedByName: player.name,
      timestamp: Date.now()
    };
    game.trickHistory.push(game.currentTrick);

    // Check if player finished hand
    if (player.hand.length === 0) {
      game.finishOrder.push(player.id);
      const finishRank = game.finishOrder.length;
      player.finishRank = finishRank;

      // Check ล้มเจ้า (King Overthrow rule)
      if (game.roundNumber >= 2) {
        const formerKing = game.players.find(p => p.role === 'KING');
        if (finishRank === 1) {
          if (formerKing && formerKing.id !== player.id) {
            // Revolution! Former king overthrown to Slave!
            formerKing.isOverthrown = true;
            actionDesc += ` | 👑 ล้มเจ้าสำเร็จ! ${player.name} เข้าที่ 1 ยึดตำแหน่ง King ส่วนอดีต King (${formerKing.name}) ร่วงสู่ Slave ทันที!`;
          } else {
            actionDesc += ` | 👑 King ${player.name} รักษาบัลลังก์สำเร็จ!`;
          }
        }
      } else {
        actionDesc += ` | 🎉 ${player.name} ทิ้งไพ่หมดมือเป็นคนที่ ${finishRank}!`;
      }
    }

    game.roundAnnouncement = actionDesc;

    // Check if round should end (only 1 player with cards left)
    const remaining = game.players.filter(p => p.hand.length > 0);
    if (remaining.length <= 1) {
      if (remaining.length === 1) {
        game.finishOrder.push(remaining[0].id);
        remaining[0].finishRank = game.players.length;
      }
      endRound();
      return;
    }

    advanceTurn();
  }

  function handlePass(player) {
    if (game.stage !== 'PLAYING') return;
    if (game.players[game.turnIndex]?.id !== player.id) return;
    if (player.hand.length === 0) return;
    if (!game.currentTrick) return; // Cannot pass when leading

    if (!game.passedPlayerIds.includes(player.id)) {
      game.passedPlayerIds.push(player.id);
    }
    game.roundAnnouncement = `${player.name} ขอผ่าน (Pass)`;
    advanceTurn();
  }

  function endRound() {
    game.stage = 'ROUND_OVER';

    // Assign roles for next round based on finish order & overthrow rules
    const pCount = game.players.length;
    const template = ROLE_TEMPLATES[pCount];

    const formerKing = game.players.find(p => p.isOverthrown);
    if (formerKing) {
      // Former king is forced to SLAVE
      formerKing.role = 'SLAVE';
      // Winner is KING
      const winner = game.players.find(p => p.id === game.finishOrder[0]);
      if (winner) winner.role = 'KING';

      // Remaining players fill intermediate roles (Queen, Citizens, Vice-Slave)
      const others = game.finishOrder
        .slice(1)
        .filter(id => id !== formerKing.id)
        .map(id => game.players.find(p => p.id === id));

      const intermediateRoles = template.slice(1, template.length - 1);
      others.forEach((p, i) => {
        if (p && intermediateRoles[i]) {
          p.role = intermediateRoles[i];
        }
      });
    } else {
      // Normal assignment: 1st=King, 2nd=Queen, ..., Last=Slave
      game.finishOrder.forEach((id, idx) => {
        const p = game.players.find(pl => pl.id === id);
        if (p && template[idx]) {
          p.role = template[idx];
        }
      });
    }

    // Role summary
    const roleLines = game.players.map(p => `${p.name}: ${p.role} (อันดับ ${p.finishRank || 'ร่วงสลาฟ'})`).join(', ');
    game.roundAnnouncement = `จบการแข่งขันรอบที่ ${game.roundNumber}! ตำแหน่งรอบถัดไป: ${roleLines}`;
    broadcastState();
  }

  wss.on('connection', (ws) => {
    let boundToken = null;

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'AUTH' || msg.type === 'JOIN') {
        const token = String(msg.token || '').trim();
        if (!token) return;
        boundToken = token;

        if (!clientsByToken.has(token)) {
          clientsByToken.set(token, new Set());
        }
        clientsByToken.get(token).add(ws);

        let player = game.players.find(p => p.token === token);
        if (player) {
          player.connected = true;
          if (msg.name && String(msg.name).trim()) {
            player.name = String(msg.name).trim().slice(0, 22);
          }
        } else if (game.stage === 'LOBBY' && game.players.length < MAX_PLAYERS) {
          const seatNum = game.players.length + 1;
          const cleanName = (msg.name && String(msg.name).trim())
            ? String(msg.name).trim().slice(0, 22)
            : `ผู้เล่น ${seatNum}`;
          player = {
            token,
            id: `p_${crypto.randomBytes(4).toString('hex')}`,
            name: cleanName,
            connected: true,
            hand: [],
            role: null,
            finishRank: null,
            isOverthrown: false
          };
          game.players.push(player);
        }

        broadcastState();
        return;
      }

      if (!boundToken) return;
      const player = game.players.find(p => p.token === boundToken);
      if (!player) return;

      switch (msg.type) {
        case 'SET_NAME': {
          const newName = String(msg.name || '').trim().slice(0, 22);
          if (newName) {
            player.name = newName;
            broadcastState();
          }
          break;
        }

        case 'KICK': {
          const targetId = msg.targetPlayerId || msg.targetId;
          if (!targetId || targetId === player.id) break;
          const idx = game.players.findIndex(p => p.id === targetId);
          if (idx !== -1) {
            game.players.splice(idx, 1);
            if (game.stage !== 'LOBBY' && game.players.length < MIN_PLAYERS) {
              game.stage = 'LOBBY';
              game.roundNumber = 0;
            } else if (game.stage === 'TRIBUTE') {
              setupTributePhase();
            } else if (game.stage === 'PLAYING') {
              if (game.turnIndex >= game.players.length) game.turnIndex = 0;
              advanceTurn();
            }
            broadcastState();
          }
          break;
        }

        case 'START_MATCH': {
          if (game.players.length >= MIN_PLAYERS && game.players.length <= MAX_PLAYERS) {
            startNewMatch();
          }
          break;
        }

        case 'NEXT_ROUND': {
          if (game.stage === 'ROUND_OVER') {
            startNewRound();
          }
          break;
        }

        case 'RETURN_LOBBY': {
          game.stage = 'LOBBY';
          game.roundNumber = 0;
          game.currentTrick = null;
          game.finishOrder = [];
          for (const p of game.players) {
            p.hand = [];
            p.role = null;
            p.finishRank = null;
            p.isOverthrown = false;
          }
          broadcastState();
          break;
        }

        case 'PLAY_CARDS': {
          handlePlayCards(player, msg.cards);
          break;
        }

        case 'PASS': {
          handlePass(player);
          break;
        }

        case 'RETURN_TRIBUTE': {
          handleReturnTribute(player, msg.exchangeId, msg.returnCards);
          break;
        }
      }
    });

    ws.on('close', () => {
      if (!boundToken) return;
      const set = clientsByToken.get(boundToken);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          const player = game.players.find(p => p.token === boundToken);
          if (player) {
            player.connected = false;
            broadcastState();
          }
        }
      }
    });
  });

  return {
    wss,
    serveHtml: (req, res) => {
      const htmlPath = path.join(__dirname, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
  };
}

// Standalone runner
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const room = createSlaveRoom();
  const server = http.createServer((req, res) => {
    room.serveHtml(req, res);
  });
  server.on('upgrade', (req, socket, head) => {
    room.wss.handleUpgrade(req, socket, head, (ws) => {
      room.wss.emit('connection', ws, req);
    });
  });
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Slave Card Game server running at http://localhost:${PORT}`);
  });
}

module.exports = { createSlaveRoom };
