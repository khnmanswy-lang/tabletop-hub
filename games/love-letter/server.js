const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const CARD_DEFS = [
  { value: 9, name: 'Princess', count: 1, short: 'Out of the round if you play/discard.' },
  { value: 8, name: 'Countess', count: 1, short: 'Must play if you have King or Prince.' },
  { value: 7, name: 'King', count: 1, short: 'Trade hands.' },
  { value: 6, name: 'Chancellor', count: 2, short: 'Draw & return 2 cards.' },
  { value: 5, name: 'Prince', count: 2, short: 'Discard a hand & redraw.' },
  { value: 4, name: 'Handmaid', count: 2, short: 'Immune to other cards until your next turn.' },
  { value: 3, name: 'Baron', count: 2, short: 'Compare hands.' },
  { value: 2, name: 'Priest', count: 2, short: 'Look at a hand.' },
  { value: 1, name: 'Guard', count: 6, short: 'Guess a hand.' },
  { value: 0, name: 'Spy', count: 2, short: 'Gain favor if no one else plays/discards a Spy.' }
];

const CARD_BY_VALUE = Object.fromEntries(CARD_DEFS.map(c => [c.value, c]));

const TOKENS_TO_WIN = {
  3: 5,
  4: 4,
  5: 3
};

const HTML_CLIENT = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function createLoveLetterRoom() {
  const game = {
    stage: 'LOBBY',
    roundNumber: 0,
    players: [],
    turnIndex: 0,
    lastRoundWinnerId: null,
    deck: [],
    setAsideCard: null,
    discardPile: [],
    roundSummary: null,
    expertMode: false
  };

  const wss = new WebSocketServer({ noServer: true });
  const clientsByToken = new Map();

  function buildDeck() {
    const deck = [];
    let uid = 1;
    for (const def of CARD_DEFS) {
      for (let i = 0; i < def.count; i++) {
        deck.push({
          id: `c_${uid++}_${def.value}`,
          value: def.value,
          name: def.name,
          short: def.short
        });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function sendPrivateReveal(player, title, message) {
    const sockets = clientsByToken.get(player.token);
    if (sockets) {
      const payload = JSON.stringify({ type: 'PRIVATE_REVEAL', title, message });
      for (const ws of sockets) {
        if (ws.readyState === 1) ws.send(payload);
      }
    }
  }

  function getTargetThreshold() {
    const count = Math.min(5, Math.max(3, game.players.length));
    return TOKENS_TO_WIN[count] || 4;
  }

  function getValidTargets(actingPlayer, cardValue) {
    if (cardValue === 5) {
      const others = game.players.filter(
        p => p.id !== actingPlayer.id && !p.eliminated && !p.immune
      );
      return [...others, actingPlayer].map(p => p.id);
    }
    if ([1, 2, 3, 7].includes(cardValue)) {
      return game.players
        .filter(p => p.id !== actingPlayer.id && !p.eliminated && !p.immune)
        .map(p => p.id);
    }
    return [];
  }

  function mustPlayCountess(hand) {
    const hasCountess = hand.some(c => c.value === 8);
    const hasRoyal = hand.some(c => c.value === 7 || c.value === 5);
    return hasCountess && hasRoyal;
  }

  function sanitizeStateFor(viewerToken) {
    const revealAll = game.stage === 'ROUND_OVER' || game.stage === 'GAME_OVER';
    const viewer = game.players.find(p => p.token === viewerToken);

    return {
      stage: game.stage,
      roundNumber: game.roundNumber,
      targetTokens: getTargetThreshold(),
      deckCount: game.deck.length,
      setAsideExists: Boolean(game.setAsideCard),
      setAsideRevealed: revealAll && !game.setAsideCard ? null : (revealAll && game.setAsideCard ? game.setAsideCard : null),
      recentDiscard: game.discardPile[game.discardPile.length - 1] || null,
      discardCount: game.discardPile.length,
      discardHistory: game.expertMode ? null : game.discardPile,
      expertMode: Boolean(game.expertMode),
      turnPlayerId: game.players[game.turnIndex]?.id || null,
      youId: viewer ? viewer.id : null,
      roundSummary: game.roundSummary,
      players: game.players.map((p, idx) => {
        const isSelf = p.token === viewerToken;
        const shouldShowRealHand = isSelf || (revealAll && !p.eliminated);
        return {
          id: p.id,
          seat: idx + 1,
          name: p.name,
          connected: p.connected,
          tokens: p.tokens,
          eliminated: p.eliminated,
          immune: p.immune,
          handCount: p.hand.length,
          hand: shouldShowRealHand ? p.hand : p.hand.map(() => '??')
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
    if (game.players.length < 3 || game.players.length > 5) return;
    game.roundNumber = 0;
    game.lastRoundWinnerId = null;
    for (const p of game.players) {
      p.tokens = 0;
    }
    startNewRound();
  }

  function startNewRound() {
    game.roundNumber += 1;
    game.deck = buildDeck();
    game.setAsideCard = game.deck.pop();
    game.discardPile = [];
    game.roundSummary = null;

    for (const p of game.players) {
      p.hand = [game.deck.pop()];
      p.discards = [];
      p.eliminated = false;
      p.immune = false;
    }

    if (game.lastRoundWinnerId) {
      const idx = game.players.findIndex(p => p.id === game.lastRoundWinnerId);
      game.turnIndex = idx >= 0 ? idx : 0;
    } else {
      game.turnIndex = crypto.randomInt(0, game.players.length);
    }

    beginTurn();
  }

  function beginTurn() {
    const activePlayers = game.players.filter(p => !p.eliminated);
    if (activePlayers.length <= 1 || game.deck.length === 0) {
      endRound();
      return;
    }

    while (game.players[game.turnIndex].eliminated) {
      game.turnIndex = (game.turnIndex + 1) % game.players.length;
    }

    const current = game.players[game.turnIndex];
    if (current.immune) {
      current.immune = false;
    }

    const drawn = game.deck.pop();
    current.hand.push(drawn);
    game.stage = 'TURN_PLAY';

    broadcastState();
  }

  function advanceTurnOrEndRound() {
    const activePlayers = game.players.filter(p => !p.eliminated);
    if (activePlayers.length <= 1 || game.deck.length === 0) {
      endRound();
      return;
    }
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
    while (game.players[game.turnIndex].eliminated) {
      game.turnIndex = (game.turnIndex + 1) % game.players.length;
    }
    beginTurn();
  }

  function eliminatePlayer(player, reason) {
    player.eliminated = true;
    player.immune = false;
    while (player.hand.length > 0) {
      const c = player.hand.pop();
      player.discards.push(c);
      game.discardPile.push({
        value: c.value,
        name: c.name,
        short: c.short,
        discardedBy: player.name,
        reason
      });
    }
  }

  function handlePlayCard(player, payload) {
    if (game.stage !== 'TURN_PLAY') return;
    const activePlayer = game.players[game.turnIndex];
    if (!activePlayer || activePlayer.id !== player.id) return;

    const { cardId, targetId, guessValue } = payload;
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const playedCard = player.hand[cardIndex];

    if (mustPlayCountess(player.hand) && playedCard.value !== 8) {
      return;
    }

    const validTargetIds = getValidTargets(player, playedCard.value);
    const targetPlayer = targetId ? game.players.find(p => p.id === targetId) : null;

    if (validTargetIds.length > 0) {
      if (!targetPlayer || !validTargetIds.includes(targetPlayer.id)) {
        return;
      }
    }

    let parsedGuess = null;
    if (playedCard.value === 1 && validTargetIds.length > 0) {
      parsedGuess = Number(guessValue);
      if (!Number.isInteger(parsedGuess) || parsedGuess < 0 || parsedGuess > 9 || parsedGuess === 1) {
        return;
      }
    }

    player.hand.splice(cardIndex, 1);
    player.discards.push(playedCard);
    game.discardPile.push({
      value: playedCard.value,
      name: playedCard.name,
      short: playedCard.short,
      discardedBy: player.name
    });

    switch (playedCard.value) {
      case 9: {
        eliminatePlayer(player, 'played the Princess');
        advanceTurnOrEndRound();
        break;
      }

      case 8: {
        advanceTurnOrEndRound();
        break;
      }

      case 7: {
        if (targetPlayer) {
          const myCard = player.hand.pop();
          const theirCard = targetPlayer.hand.pop();
          player.hand.push(theirCard);
          targetPlayer.hand.push(myCard);

          sendPrivateReveal(
            player,
            'King Hand Trade',
            `You gave ${myCard.value}–${myCard.name} to ${targetPlayer.name} and received ${theirCard.value}–${theirCard.name}.`
          );
          sendPrivateReveal(
            targetPlayer,
            'King Hand Trade',
            `${player.name} played 7–King and traded hands with you. You received ${myCard.value}–${myCard.name}.`
          );
        }
        advanceTurnOrEndRound();
        break;
      }

      case 6: {
        if (game.deck.length === 0) {
          advanceTurnOrEndRound();
        } else {
          const drawCount = Math.min(2, game.deck.length);
          for (let i = 0; i < drawCount; i++) {
            player.hand.push(game.deck.pop());
          }
          game.stage = 'CHANCELLOR_RETURN';
          broadcastState();
        }
        break;
      }

      case 5: {
        const chosen = targetPlayer || player;
        const discarded = chosen.hand.pop();
        if (discarded) {
          chosen.discards.push(discarded);
          game.discardPile.push({
            value: discarded.value,
            name: discarded.name,
            short: discarded.short,
            discardedBy: chosen.name,
            reason: 'discarded by Prince'
          });

          if (discarded.value === 9) {
            eliminatePlayer(chosen, 'forced to discard the Princess');
          } else {
            let replacement = null;
            if (game.deck.length > 0) {
              replacement = game.deck.pop();
            } else if (game.setAsideCard) {
              replacement = game.setAsideCard;
              game.setAsideCard = null;
            }
            if (replacement) chosen.hand.push(replacement);
          }
        }
        advanceTurnOrEndRound();
        break;
      }

      case 4: {
        player.immune = true;
        advanceTurnOrEndRound();
        break;
      }

      case 3: {
        if (targetPlayer) {
          const myCard = player.hand[0];
          const theirCard = targetPlayer.hand[0];

          sendPrivateReveal(
            player,
            'Baron Comparison',
            `You compared ${myCard.value}–${myCard.name} vs. ${targetPlayer.name}'s ${theirCard.value}–${theirCard.name}.`
          );
          sendPrivateReveal(
            targetPlayer,
            'Baron Comparison',
            `${player.name} compared their ${myCard.value}–${myCard.name} against your ${theirCard.value}–${theirCard.name}.`
          );

          if (myCard.value > theirCard.value) {
            eliminatePlayer(targetPlayer, `lost Baron comparison vs ${player.name}`);
          } else if (theirCard.value > myCard.value) {
            eliminatePlayer(player, `lost Baron comparison vs ${targetPlayer.name}`);
          }
        }
        advanceTurnOrEndRound();
        break;
      }

      case 2: {
        if (targetPlayer) {
          const theirCard = targetPlayer.hand[0];
          sendPrivateReveal(
            player,
            'Priest Inspection',
            `${targetPlayer.name} is holding ${theirCard.value}–${theirCard.name}.`
          );
        }
        advanceTurnOrEndRound();
        break;
      }

      case 1: {
        if (targetPlayer) {
          const theirCard = targetPlayer.hand[0];
          if (theirCard && theirCard.value === parsedGuess) {
            eliminatePlayer(targetPlayer, `eliminated by ${player.name}'s Guard guessing ${parsedGuess}`);
          }
        }
        advanceTurnOrEndRound();
        break;
      }

      case 0: {
        advanceTurnOrEndRound();
        break;
      }
    }
  }

  function handleChancellorReturn(player, payload) {
    if (game.stage !== 'CHANCELLOR_RETURN') return;
    const activePlayer = game.players[game.turnIndex];
    if (!activePlayer || activePlayer.id !== player.id) return;

    const { keepCardId, bottomOrderIds } = payload;
    if (!keepCardId || !Array.isArray(bottomOrderIds)) return;

    const expectedReturnCount = player.hand.length - 1;
    if (bottomOrderIds.length !== expectedReturnCount) return;

    const allSelectedIds = [keepCardId, ...bottomOrderIds];
    const uniqueIds = new Set(allSelectedIds);
    if (uniqueIds.size !== player.hand.length) return;

    const handMap = new Map(player.hand.map(c => [c.id, c]));
    for (const id of allSelectedIds) {
      if (!handMap.has(id)) return;
    }

    const keptCard = handMap.get(keepCardId);
    const returnedCards = bottomOrderIds.map(id => handMap.get(id));

    player.hand = [keptCard];

    for (let i = 0; i < returnedCards.length; i++) {
      game.deck.unshift(returnedCards[i]);
    }

    advanceTurnOrEndRound();
  }

  function endRound() {
    const survivors = game.players.filter(p => !p.eliminated);
    let roundWinners = [];

    if (survivors.length === 1) {
      roundWinners = [survivors[0]];
    } else if (survivors.length > 1) {
      let maxVal = -1;
      for (const p of survivors) {
        const val = p.hand[0]?.value ?? -1;
        if (val > maxVal) maxVal = val;
      }
      roundWinners = survivors.filter(p => (p.hand[0]?.value ?? -1) === maxVal);
    }

    for (const w of roundWinners) {
      w.tokens += 1;
    }
    if (roundWinners.length > 0) {
      game.lastRoundWinnerId = roundWinners[0].id;
    }

    const survivingSpyPlayers = survivors.filter(p => p.discards.some(c => c.value === 0));
    let spyWinner = null;
    if (survivingSpyPlayers.length === 1) {
      spyWinner = survivingSpyPlayers[0];
      spyWinner.tokens += 1;
    }

    const threshold = getTargetThreshold();
    const matchWinners = game.players.filter(p => p.tokens >= threshold);
    let overallWinners = [];
    if (matchWinners.length > 0) {
      const maxTokens = Math.max(...matchWinners.map(p => p.tokens));
      overallWinners = matchWinners.filter(p => p.tokens === maxTokens);
      game.stage = 'GAME_OVER';
    } else {
      game.stage = 'ROUND_OVER';
    }

    game.roundSummary = {
      roundNumber: game.roundNumber,
      roundWinnerIds: roundWinners.map(w => w.id),
      spyWinnerId: spyWinner ? spyWinner.id : null,
      matchWinnerIds: overallWinners.map(w => w.id),
      survivorHands: survivors.map(p => ({
        playerId: p.id,
        name: p.name,
        card: p.hand[0]
      }))
    };

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
          if (msg.name && typeof msg.name === 'string' && msg.name.trim()) {
            player.name = msg.name.trim().slice(0, 22);
          }
        } else if (game.stage === 'LOBBY' && game.players.length < 5) {
          const seatNum = game.players.length + 1;
          const cleanName = (msg.name && String(msg.name).trim())
            ? String(msg.name).trim().slice(0, 22)
            : `Suitor ${seatNum}`;
          player = {
            token,
            id: `p_${crypto.randomBytes(4).toString('hex')}`,
            name: cleanName,
            connected: true,
            tokens: 0,
            hand: [],
            discards: [],
            eliminated: false,
            immune: false
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
          const targetIdx = game.players.findIndex(p => p.id === targetId);
          if (targetIdx === -1) break;
          const target = game.players[targetIdx];

          if (game.stage === 'LOBBY') {
            game.players.splice(targetIdx, 1);
          } else {
            const wasActive = !target.eliminated;
            const wasTheirTurn = game.players[game.turnIndex]?.id === target.id;

            if (wasActive) {
              eliminatePlayer(target, 'kicked from game');
            }
            game.players.splice(targetIdx, 1);

            if (game.turnIndex >= game.players.length) {
              game.turnIndex = 0;
            }

            const activeSurvivors = game.players.filter(p => !p.eliminated);
            if (activeSurvivors.length <= 1 || game.deck.length === 0) {
              endRound();
            } else if (wasTheirTurn) {
              advanceTurnOrEndRound();
            }
          }
          broadcastState();
          break;
        }

        case 'RESET_MATCH': {
          if (game.players.length >= 3 && game.players.length <= 5) {
            startNewMatch();
          } else {
            game.stage = 'LOBBY';
            game.roundNumber = 0;
            game.roundSummary = null;
            for (const p of game.players) {
              p.tokens = 0;
              p.hand = [];
              p.discards = [];
              p.eliminated = false;
              p.immune = false;
            }
            broadcastState();
          }
          break;
        }

        case 'TOGGLE_EXPERT_MODE': {
          if (game.stage === 'LOBBY') {
            game.expertMode = !game.expertMode;
            broadcastState();
          }
          break;
        }

        case 'SET_EXPERT_MODE': {
          if (game.stage === 'LOBBY') {
            game.expertMode = Boolean(msg.enabled);
            broadcastState();
          }
          break;
        }

        case 'START_MATCH': {
          if ((game.stage === 'LOBBY' || game.stage === 'GAME_OVER') && game.players.length >= 3 && game.players.length <= 5) {
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
          game.roundSummary = null;
          for (const p of game.players) {
            p.tokens = 0;
            p.hand = [];
            p.discards = [];
            p.eliminated = false;
            p.immune = false;
          }
          broadcastState();
          break;
        }

        case 'PLAY_CARD': {
          handlePlayCard(player, msg);
          break;
        }

        case 'CHANCELLOR_RETURN': {
          handleChancellorReturn(player, msg);
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
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML_CLIENT);
    }
  };
}

module.exports = { createLoveLetterRoom };
