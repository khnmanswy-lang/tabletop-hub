/**
 * COCKROACH POKER (Kakerlakenpoker) — Real-Time Multiplayer Server
 * Classic (64 Cards) & Royal Edition (65 Cards) (3–5 Players)
 *
 * Reverse set-collection bluffing game. Zero bots, pure psychological bluffing.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

// ============================================================================
// 1. DECLARATIVE DECK & RULESET SPECIFICATION
// ============================================================================

const CRITTERS = [
  { id: 'COCKROACH', name: 'Cockroach', code: 'CKR', glyph: '🪳' },
  { id: 'RAT',       name: 'Rat',       code: 'RAT', glyph: '🐀' },
  { id: 'STINK_BUG', name: 'Stink Bug', code: 'STB', glyph: '🪲' },
  { id: 'BAT',       name: 'Bat',       code: 'BAT', glyph: '🦇' },
  { id: 'FLY',       name: 'Fly',       code: 'FLY', glyph: '🪰' },
  { id: 'TOAD',      name: 'Toad',      code: 'TOD', glyph: '🐸' },
  { id: 'SCORPION',  name: 'Scorpion',  code: 'SCP', glyph: '🦂' },
  { id: 'SPIDER',    name: 'Spider',    code: 'SPD', glyph: '🕷️' }
];

const CRITTER_BY_ID = Object.fromEntries(CRITTERS.map(c => [c.id, c]));

const MODE_SPEC = {
  CLASSIC: {
    name: 'Classic (64 Cards · 8 Critters)',
    speciesIds: ['COCKROACH', 'RAT', 'STINK_BUG', 'BAT', 'FLY', 'TOAD', 'SCORPION', 'SPIDER'],
    copiesPerSpecies: 8,
    includeRoyals: false,
    includeSpecials: false,
    penaltyDeckCount: 0,
    lossSameCount: 4
  },
  ROYAL: {
    name: 'Royal (65 Cards · Royals & Penalty Deck)',
    speciesIds: ['COCKROACH', 'RAT', 'STINK_BUG', 'BAT', 'FLY', 'TOAD', 'SCORPION'],
    copiesPerSpecies: 7, // 7 standard + 1 royal = 8 per species (56 cards)
    includeRoyals: true,
    includeSpecials: true, // +1 Wild (🎭) +1 Blank Lie (∅) = 58 cards + 7 penalty deck = 65 cards
    penaltyDeckCount: 7,
    lossSameCount: 4
  }
};

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck(modeKey) {
  const spec = MODE_SPEC[modeKey] || MODE_SPEC.CLASSIC;
  const deck = [];
  let seq = 1;

  for (const sId of spec.speciesIds) {
    const info = CRITTER_BY_ID[sId];
    for (let i = 0; i < spec.copiesPerSpecies; i++) {
      deck.push({
        id: `c_${seq++}`,
        kind: 'NORMAL',
        species: sId,
        isRoyal: false,
        name: info.name,
        glyph: info.glyph,
        short: `Standard ${info.name}`
      });
    }
    if (spec.includeRoyals) {
      deck.push({
        id: `c_${seq++}`,
        kind: 'ROYAL',
        species: sId,
        isRoyal: true,
        name: `Royal ${info.name}`,
        glyph: `${info.glyph}👑`,
        short: `Matches "${info.name}" OR "Royal". Costs +1 Penalty Deck card!`
      });
    }
  }

  if (spec.includeSpecials) {
    deck.push({
      id: `c_${seq++}`,
      kind: 'WILD_SPECIES',
      species: 'WILD',
      isRoyal: false,
      name: 'All-Species Wild',
      glyph: '🎭',
      short: 'True for ANY Critter species, but False for "Royal".'
    });
    deck.push({
      id: `c_${seq++}`,
      kind: 'BLANK_LIE',
      species: 'NONE',
      isRoyal: false,
      name: 'Nothing (Blank Lie)',
      glyph: '∅',
      short: 'Always FALSE for every claim!'
    });
  }

  return shuffle(deck);
}

function isClaimTrue(card, claimedType) {
  if (card.kind === 'BLANK_LIE') return false;
  if (card.kind === 'WILD_SPECIES') {
    return claimedType !== 'ROYAL';
  }
  if (claimedType === 'ROYAL') {
    return Boolean(card.isRoyal);
  }
  return card.species === claimedType;
}

function formatClaimLabel(claimedType) {
  if (claimedType === 'ROYAL') return '👑 Royal (Crowned)';
  const c = CRITTER_BY_ID[claimedType];
  return c ? `${c.glyph} ${c.name}` : claimedType;
}

// ============================================================================
// 2. ROOM ENGINE FACTORY
// ============================================================================

function createCockroachRoom() {
  const wss = new WebSocketServer({ noServer: true });
  const htmlPath = path.join(__dirname, 'index.html');

  const game = {
    mode: 'CLASSIC', // 'CLASSIC' | 'ROYAL'
    stage: 'LOBBY',  // 'LOBBY' | 'START_CHAIN' | 'RESPOND_PASS' | 'GAME_OVER'
    players: [],     // { token, id, name, connected, hand, penalties }
    turnPlayerId: null,
    penaltyDeck: [],
    activePass: null, // { card, senderId, receiverId, claimedType, seenByIds, hasPeeked, history }
    loserInfo: null,  // { loserId, loserName, reason }
    lastAnnouncement: 'Welcome to Cockroach Poker! 3–5 players required.'
  };

  const clientsByToken = new Map();

  function setAnnouncement(text) {
    game.lastAnnouncement = text;
  }

  function getValidClaimsForMode() {
    const spec = MODE_SPEC[game.mode];
    const claims = spec.speciesIds.map(id => ({
      id,
      label: `${CRITTER_BY_ID[id].glyph} ${CRITTER_BY_ID[id].name}`
    }));
    if (spec.includeRoyals) {
      claims.push({ id: 'ROYAL', label: '👑 Royal (Any Crowned)' });
    }
    return claims;
  }

  function checkPenaltyLossCondition(player) {
    const spec = MODE_SPEC[game.mode];
    const counts = {};
    for (const c of player.penalties) {
      if (c.species && c.species !== 'WILD' && c.species !== 'NONE') {
        counts[c.species] = (counts[c.species] || 0) + 1;
        if (counts[c.species] >= spec.lossSameCount) {
          return `Collected ${spec.lossSameCount} ${CRITTER_BY_ID[c.species].name} (${CRITTER_BY_ID[c.species].glyph}) penalty cards!`;
        }
      }
    }
    const uniqueSpeciesHeld = Object.keys(counts).length;
    if (uniqueSpeciesHeld >= spec.speciesIds.length) {
      return `Collected 1 of every single critter species (${spec.speciesIds.length}/${spec.speciesIds.length})!`;
    }
    return null;
  }

  function triggerGameOver(loserPlayer, reason) {
    game.stage = 'GAME_OVER';
    game.activePass = null;
    game.loserInfo = {
      loserId: loserPlayer.id,
      loserName: loserPlayer.name,
      reason
    };
    setAnnouncement(`💥 GAME OVER — ${loserPlayer.name} loses: ${reason}! Everyone else wins!`);
    broadcastState();
  }

  function startNewMatch() {
    if (game.players.length < 3 || game.players.length > 5) {
      setAnnouncement('Cannot start match: Need 3 to 5 players.');
      broadcastState();
      return;
    }

    const spec = MODE_SPEC[game.mode];
    const deck = buildDeck(game.mode);

    game.penaltyDeck = [];
    if (spec.penaltyDeckCount > 0) {
      for (let i = 0; i < spec.penaltyDeckCount; i++) {
        game.penaltyDeck.push(deck.pop());
      }
    }

    for (const p of game.players) {
      p.hand = [];
      p.penalties = [];
    }

    // Deal remaining cards evenly around the table
    let pIdx = 0;
    while (deck.length > 0) {
      game.players[pIdx].hand.push(deck.pop());
      pIdx = (pIdx + 1) % game.players.length;
    }

    for (const p of game.players) {
      p.hand.sort((a, b) => a.name.localeCompare(b.name));
    }

    const starter = game.players[crypto.randomInt(0, game.players.length)];
    game.turnPlayerId = starter.id;
    game.activePass = null;
    game.loserInfo = null;
    game.stage = 'START_CHAIN';

    setAnnouncement(`🎲 Match started (${spec.name})! ${starter.name} slides the first face-down card.`);
    broadcastState();
  }

  function handleStartPass(player, payload) {
    if (game.stage !== 'START_CHAIN' || game.turnPlayerId !== player.id) return;

    const { cardId, targetId, claimedType } = payload;
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return;

    const target = game.players.find(p => p.id === targetId && p.id !== player.id);
    if (!target) return;

    const validClaimIds = getValidClaimsForMode().map(c => c.id);
    if (!validClaimIds.includes(claimedType)) return;

    const [card] = player.hand.splice(cardIdx, 1);

    game.activePass = {
      card,
      senderId: player.id,
      receiverId: target.id,
      claimedType,
      seenByIds: [player.id],
      hasPeeked: false,
      history: [
        {
          fromName: player.name,
          toName: target.name,
          claimedType
        }
      ]
    };

    game.stage = 'RESPOND_PASS';
    setAnnouncement(`🪳 ${player.name} slides a card face-down to ${target.name} claiming: "${formatClaimLabel(claimedType)}".`);
    broadcastState();
  }

  function handlePeekCard(player) {
    if (game.stage !== 'RESPOND_PASS' || !game.activePass) return;
    if (game.activePass.receiverId !== player.id || game.activePass.hasPeeked) return;

    const eligibleNext = game.players.filter(
      p => p.id !== player.id && !game.activePass.seenByIds.includes(p.id)
    );
    if (eligibleNext.length === 0) return;

    game.activePass.hasPeeked = true;
    game.activePass.seenByIds.push(player.id);

    setAnnouncement(`👁 ${player.name} secretly peeks at the face-down card and prepares to pass it forward...`);
    broadcastState();
  }

  function handleRelayPass(player, payload) {
    if (game.stage !== 'RESPOND_PASS' || !game.activePass) return;
    if (game.activePass.receiverId !== player.id || !game.activePass.hasPeeked) return;

    const { targetId, claimedType } = payload;
    const target = game.players.find(
      p => p.id === targetId && !game.activePass.seenByIds.includes(p.id)
    );
    if (!target) return;

    const validClaimIds = getValidClaimsForMode().map(c => c.id);
    if (!validClaimIds.includes(claimedType)) return;

    game.activePass.senderId = player.id;
    game.activePass.receiverId = target.id;
    game.activePass.claimedType = claimedType;
    game.activePass.hasPeeked = false;
    game.activePass.history.push({
      fromName: player.name,
      toName: target.name,
      claimedType
    });

    setAnnouncement(`↪ ${player.name} slides the card to ${target.name} claiming: "${formatClaimLabel(claimedType)}" (Chain step #${game.activePass.history.length}).`);
    broadcastState();
  }

  function handleCallChallenge(player, payload) {
    if (game.stage !== 'RESPOND_PASS' || !game.activePass) return;
    if (game.activePass.receiverId !== player.id || game.activePass.hasPeeked) return;

    const believeClaim = Boolean(payload.believeClaim); // true = "True", false = "Bluff"
    const { card, senderId, claimedType } = game.activePass;
    const sender = game.players.find(p => p.id === senderId);
    if (!sender) return;

    const actualTruth = isClaimTrue(card, claimedType);
    const receiverGuessedRight = believeClaim === actualTruth;
    const victim = receiverGuessedRight ? sender : player;

    const cardLabel = `[${card.glyph} ${card.name}]`;

    // Apply penalty
    if (card.kind === 'WILD_SPECIES' || card.kind === 'BLANK_LIE') {
      if (game.penaltyDeck.length > 0) {
        const penCard = game.penaltyDeck.pop();
        victim.penalties.push(penCard);
        setAnnouncement(`${player.name} called "${believeClaim ? 'TRUE' : 'BLUFF'}": Revealed ${cardLabel}! Special card discarded; ${victim.name} drew [${penCard.glyph} ${penCard.name}] from Penalty Deck.`);
      } else if (victim.hand.length > 0) {
        const selfPen = victim.hand.pop();
        victim.penalties.push(selfPen);
        setAnnouncement(`${player.name} called "${believeClaim ? 'TRUE' : 'BLUFF'}": Revealed ${cardLabel}! Penalty Deck empty: ${victim.name} sacrificed [${selfPen.glyph} ${selfPen.name}] from hand.`);
      }
    } else {
      victim.penalties.push(card);
      let royalText = '';
      if (card.isRoyal && game.penaltyDeck.length > 0) {
        const bonusPenalty = game.penaltyDeck.pop();
        victim.penalties.push(bonusPenalty);
        royalText = ` + ROYAL PENALTY: also took [${bonusPenalty.glyph} ${bonusPenalty.name}]!`;
      }
      setAnnouncement(`${player.name} called "${believeClaim ? 'TRUE' : 'BLUFF'}": Revealed ${cardLabel}! ${receiverGuessedRight ? `${player.name} was RIGHT!` : `${player.name} was FOOLED!`} ${victim.name} takes the penalty${royalText}`);
    }

    // Check immediate loss conditions
    const lossReason = checkPenaltyLossCondition(victim);
    if (lossReason) {
      triggerGameOver(victim, lossReason);
      return;
    }

    // Victim must start next chain: if hand is empty, they lose!
    if (victim.hand.length === 0) {
      triggerGameOver(victim, 'Forced to start next bluff chain with 0 cards remaining in hand!');
      return;
    }

    game.activePass = null;
    game.turnPlayerId = victim.id;
    game.stage = 'START_CHAIN';

    broadcastState();
  }

  // ============================================================================
  // 3. SANITIZED CLIENT STATE
  // ============================================================================

  function sanitizeStateFor(viewerToken) {
    const viewer = game.players.find(p => p.token === viewerToken);
    const viewerId = viewer ? viewer.id : null;
    const revealAll = game.stage === 'GAME_OVER';

    let sanitizedPass = null;
    if (game.activePass) {
      const canSeeSecret =
        revealAll ||
        game.activePass.seenByIds.includes(viewerId);

      const eligibleTargets = game.players
        .filter(p => p.id !== game.activePass.receiverId && !game.activePass.seenByIds.includes(p.id))
        .map(p => p.id);

      sanitizedPass = {
        senderId: game.activePass.senderId,
        receiverId: game.activePass.receiverId,
        claimedType: game.activePass.claimedType,
        claimedLabel: formatClaimLabel(game.activePass.claimedType),
        seenByIds: game.activePass.seenByIds,
        hasPeeked: game.activePass.hasPeeked,
        eligibleTargetIds: eligibleTargets,
        history: game.activePass.history,
        secretCard: canSeeSecret ? game.activePass.card : '??'
      };
    }

    return {
      mode: game.mode,
      modeName: MODE_SPEC[game.mode].name,
      stage: game.stage,
      turnPlayerId: game.turnPlayerId,
      youId: viewerId,
      penaltyDeckCount: game.penaltyDeck.length,
      validClaims: getValidClaimsForMode(),
      critterMeta: CRITTERS.filter(c => MODE_SPEC[game.mode].speciesIds.includes(c.id)),
      activePass: sanitizedPass,
      loserInfo: game.loserInfo,
      lastAnnouncement: game.lastAnnouncement,
      players: game.players.map((p, idx) => {
        const isSelf = p.id === viewerId;
        return {
          id: p.id,
          seat: idx + 1,
          name: p.name,
          connected: p.connected,
          handCount: p.hand.length,
          hand: isSelf || revealAll ? p.hand : p.hand.map(() => '??'),
          penalties: p.penalties
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

  // ============================================================================
  // 4. WEBSOCKET DISPATCHER
  // ============================================================================

  wss.on('connection', (ws) => {
    let boundToken = null;

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'AUTH') {
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
          if (msg.name && msg.name.trim()) player.name = msg.name.trim().slice(0, 16);
        } else {
          if (game.stage !== 'LOBBY' && game.stage !== 'GAME_OVER') {
            // Join as spectator if match in progress
          } else if (game.players.length < 5) {
            const nextSeat = game.players.length + 1;
            player = {
              token,
              id: `p_${crypto.randomBytes(4).toString('hex')}`,
              name: msg.name && msg.name.trim() ? msg.name.trim().slice(0, 16) : `Player ${nextSeat}`,
              connected: true,
              hand: [],
              penalties: []
            };
            game.players.push(player);
            setAnnouncement(`${player.name} joined the parlor (Seat ${nextSeat}).`);
          }
        }

        broadcastState();
        return;
      }

      const player = game.players.find(p => p.token === boundToken);
      if (!player) return;

      switch (msg.type) {
        case 'SET_NAME': {
          const name = String(msg.name || '').trim().slice(0, 16);
          if (name) {
            player.name = name;
            broadcastState();
          }
          break;
        }

        case 'SET_MODE': {
          if (game.stage === 'LOBBY') {
            const m = msg.mode === 'ROYAL' ? 'ROYAL' : 'CLASSIC';
            game.mode = m;
            setAnnouncement(`Game mode set to ${MODE_SPEC[m].name}.`);
            broadcastState();
          }
          break;
        }

        case 'KICK': {
          if (game.stage === 'LOBBY') {
            const host = game.players[0];
            if (host && host.id === player.id) {
              const targetIdx = game.players.findIndex(p => p.id === msg.targetId);
              if (targetIdx > 0) {
                const [kicked] = game.players.splice(targetIdx, 1);
                setAnnouncement(`${host.name} removed ${kicked.name} from the room.`);
                broadcastState();
              }
            }
          }
          break;
        }

        case 'START_MATCH': {
          if (game.stage === 'LOBBY') {
            startNewMatch();
          }
          break;
        }

        case 'START_PASS': {
          handleStartPass(player, msg);
          break;
        }

        case 'PEEK_CARD': {
          handlePeekCard(player);
          break;
        }

        case 'RELAY_PASS': {
          handleRelayPass(player, msg);
          break;
        }

        case 'CALL_CHALLENGE': {
          handleCallChallenge(player, msg);
          break;
        }

        case 'RESET_MATCH': {
          if (game.players.length >= 3 && game.players.length <= 5) {
            startNewMatch();
          }
          break;
        }

        case 'RETURN_LOBBY': {
          game.stage = 'LOBBY';
          game.turnPlayerId = null;
          game.activePass = null;
          game.loserInfo = null;
          game.penaltyDeck = [];
          for (const p of game.players) {
            p.hand = [];
            p.penalties = [];
          }
          setAnnouncement('Returned to parlor lobby. Ready up to play!');
          broadcastState();
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
          const p = game.players.find(x => x.token === boundToken);
          if (p) {
            p.connected = false;
            broadcastState();
          }
        }
      }
    });
  });

  return {
    wss,
    serveHtml: (req, res) => {
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }
  };
}

// Standalone runner
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const room = createCockroachRoom();
  const server = http.createServer((req, res) => {
    room.serveHtml(req, res);
  });
  server.on('upgrade', (req, socket, head) => {
    room.wss.handleUpgrade(req, socket, head, (ws) => {
      room.wss.emit('connection', ws, req);
    });
  });
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Cockroach Poker Server running at http://localhost:${PORT}`);
  });
}

module.exports = { createCockroachRoom };