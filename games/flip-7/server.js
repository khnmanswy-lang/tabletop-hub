/**
 * FLIP 7 — Real-Time Multiplayer Server (3–6 Players)
 *
 * 94-Card Press-Your-Luck Deck:
 *   - 79 Number Cards: one 0, one 1, two 2s ... twelve 12s
 *   - 6 Modifiers: +2, +4, +6, +8, +10, ×2 (doubles numbers only)
 *   - 9 Actions: 3x Freeze, 3x Flip Three, 3x Second Chance
 * Target Score: 200 Points
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const WINNING_SCORE = 200;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;

// ============================================================================
// 1. 94-CARD DECK BUILDER
// ============================================================================

function createFullDeck() {
  const cards = [];
  let idCounter = 1;

  // Number cards: one 0, one 1, two 2s ... twelve 12s (79 cards)
  cards.push({
    id: `c_${idCounter++}`,
    category: 'NUMBER',
    value: 0,
    label: '0',
    sub: 'Counts toward Flip 7 (0 pts)'
  });

  for (let n = 1; n <= 12; n++) {
    for (let copy = 0; copy < n; copy++) {
      cards.push({
        id: `c_${idCounter++}`,
        category: 'NUMBER',
        value: n,
        label: String(n),
        sub: `${n} copy count in deck`
      });
    }
  }

  // Score Modifier cards (6 cards): +2, +4, +6, +8, +10, x2
  const addMods = [2, 4, 6, 8, 10];
  for (const mod of addMods) {
    cards.push({
      id: `c_${idCounter++}`,
      category: 'MODIFIER',
      modType: 'ADD',
      value: mod,
      label: `+${mod}`,
      sub: `Adds +${mod} to round score`
    });
  }
  cards.push({
    id: `c_${idCounter++}`,
    category: 'MODIFIER',
    modType: 'MULT',
    value: 2,
    label: '×2',
    sub: 'Doubles Number card sum'
  });

  // Action cards (9 cards): 3x Freeze, 3x Flip Three, 3x Second Chance
  const actions = [
    { actionType: 'FREEZE', label: 'Freeze', sub: 'Target banks points & exits hand' },
    { actionType: 'FLIP_THREE', label: 'Flip Three', sub: 'Target flips 3 cards one by one' },
    { actionType: 'SECOND_CHANCE', label: 'Second Chance', sub: 'Cancels 1 duplicate number bust' }
  ];

  for (const act of actions) {
    for (let i = 0; i < 3; i++) {
      cards.push({
        id: `c_${idCounter++}`,
        category: 'ACTION',
        actionType: act.actionType,
        label: act.label,
        sub: act.sub
      });
    }
  }

  return shuffle(cards);
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================================
// 2. SCORE CALCULATOR & HELPER FUNCTIONS
// ============================================================================

function calculatePlayerRoundScore(player) {
  if (player.status === 'BUSTED') return 0;
  const numSum = player.numbers.reduce((acc, c) => acc + c.value, 0);
  const hasDouble = player.modifiers.some(m => m.modType === 'MULT');
  const addSum = player.modifiers
    .filter(m => m.modType === 'ADD')
    .reduce((acc, m) => acc + m.value, 0);
  const flip7Bonus = player.numbers.length >= 7 ? 15 : 0;

  // Official rule: x2 only doubles Number cards, NOT + modifiers or Flip 7 bonus
  const multipliedNumbers = hasDouble ? numSum * 2 : numSum;
  return multipliedNumbers + addSum + flip7Bonus;
}

function hasAnyTableauCards(player) {
  return (
    player.numbers.length > 0 ||
    player.modifiers.length > 0 ||
    player.secondChance !== null
  );
}

// ============================================================================
// 3. FLIP 7 GAME ENGINE FACTORY
// ============================================================================

function createFlip7Room() {
  const game = {
    stage: 'LOBBY', // 'LOBBY' | 'PLAYER_TURN' | 'AWAIT_TARGET' | 'ROUND_OVER' | 'GAME_OVER'
    roundNumber: 0,
    dealerIndex: 0,
    turnIndex: 0,
    players: [],
    drawPile: [],
    setAsidePile: [], // Face-down used cards from previous rounds
    executionStack: [],
    pendingChoice: null, // { chooserId, actionType, card, validTargetIds, reason }
    lastAnnouncement: null,
    roundSummary: null
  };

  const wss = new WebSocketServer({ noServer: true });
  const clientsByToken = new Map();

  function setAnnouncement(text) {
    game.lastAnnouncement = text;
  }

  function drawOneCard() {
    if (game.drawPile.length === 0) {
      if (game.setAsidePile.length === 0) {
        game.drawPile = createFullDeck();
      } else {
        game.drawPile = shuffle(game.setAsidePile);
        game.setAsidePile = [];
        setAnnouncement(`Draw shoe exhausted! Shuffled ${game.drawPile.length} set-aside cards into a new draw shoe.`);
      }
    }
    return game.drawPile.pop();
  }

  function activePlayersInRound() {
    return game.players.filter(p => p.status === 'ACTIVE');
  }

  function collectPlayerCardsToSetAside(player) {
    while (player.numbers.length > 0) game.setAsidePile.push(player.numbers.pop());
    while (player.modifiers.length > 0) game.setAsidePile.push(player.modifiers.pop());
    while (player.resolvedActions.length > 0) game.setAsidePile.push(player.resolvedActions.pop());
    if (player.secondChance) {
      game.setAsidePile.push(player.secondChance);
      player.secondChance = null;
    }
  }

  function startNewMatch() {
    if (game.players.length < MIN_PLAYERS || game.players.length > MAX_PLAYERS) return;
    game.roundNumber = 0;
    game.dealerIndex = 0;
    game.drawPile = createFullDeck();
    game.setAsidePile = [];
    for (const p of game.players) {
      p.totalScore = 0;
      p.roundScore = 0;
      p.status = 'ACTIVE';
      p.numbers = [];
      p.modifiers = [];
      p.resolvedActions = [];
      p.secondChance = null;
    }
    setAnnouncement(`Match started! First to ${WINNING_SCORE} points claims victory.`);
    startNewRound();
  }

  function startNewRound() {
    for (const p of game.players) {
      collectPlayerCardsToSetAside(p);
      p.status = 'ACTIVE';
      p.roundScore = 0;
    }

    game.roundNumber += 1;
    if (game.roundNumber > 1) {
      game.dealerIndex = (game.dealerIndex + 1) % game.players.length;
    }
    const dealer = game.players[game.dealerIndex];
    game.roundSummary = null;
    game.pendingChoice = null;
    game.executionStack = [];

    // Build initial deal order: left of dealer clockwise, dealer last
    const dealOrder = [];
    for (let offset = 1; offset <= game.players.length; offset++) {
      const idx = (game.dealerIndex + offset) % game.players.length;
      dealOrder.push(game.players[idx].id);
    }

    game.turnIndex = (game.dealerIndex + 1) % game.players.length;
    setAnnouncement(`Round ${game.roundNumber} begins! Dealing initial cards...`);

    game.executionStack.push({
      type: 'INITIAL_DEAL',
      queue: dealOrder
    });

    processExecutionStack();
  }

  function flipCardForPlayer(recipientPlayer, context = {}) {
    if (recipientPlayer.status !== 'ACTIVE') return false;

    const card = drawOneCard();

    if (card.category === 'NUMBER') {
      const duplicate = recipientPlayer.numbers.some(c => c.value === card.value);

      if (duplicate) {
        if (recipientPlayer.secondChance) {
          // Use Second Chance shield!
          const usedShield = recipientPlayer.secondChance;
          recipientPlayer.secondChance = null;
          game.setAsidePile.push(usedShield, card);
          setAnnouncement(`${recipientPlayer.name} flipped duplicate [${card.label}], but discarded SECOND CHANCE to survive!`);
          return false;
        } else {
          // BUST!
          recipientPlayer.numbers.push(card);
          recipientPlayer.status = 'BUSTED';
          recipientPlayer.roundScore = 0;
          setAnnouncement(`💥 BUST! ${recipientPlayer.name} flipped duplicate [${card.label}] and is out of the round with 0 pts!`);
          if (context.flipThreeTask) {
            context.flipThreeTask.remaining = 0;
            context.flipThreeTask.queuedActions = [];
          }
          return false;
        }
      } else {
        recipientPlayer.numbers.push(card);
        recipientPlayer.roundScore = calculatePlayerRoundScore(recipientPlayer);
        setAnnouncement(`${recipientPlayer.name} flipped [${card.label}] (${recipientPlayer.numbers.length}/7 unique numbers, ${recipientPlayer.roundScore} pts).`);

        // Check for FLIP 7 (7 unique number cards)
        if (recipientPlayer.numbers.length >= 7) {
          setAnnouncement(`🎉 FLIP 7!! ${recipientPlayer.name} collected 7 unique numbers (+15 bonus) and ended the round!`);
          endRound(`FLIP 7 achieved by ${recipientPlayer.name}!`);
          return true;
        }
        return false;
      }
    }

    if (card.category === 'MODIFIER') {
      recipientPlayer.modifiers.push(card);
      recipientPlayer.roundScore = calculatePlayerRoundScore(recipientPlayer);
      setAnnouncement(`${recipientPlayer.name} flipped Modifier [${card.label}] (now at ${recipientPlayer.roundScore} pts).`);
      return false;
    }

    if (card.category === 'ACTION') {
      if (card.actionType === 'SECOND_CHANCE') {
        if (!recipientPlayer.secondChance) {
          recipientPlayer.secondChance = card;
          setAnnouncement(`${recipientPlayer.name} flipped [Second Chance] and holds it as a bust shield!`);
          return false;
        } else {
          // Already holds Second Chance -> give to another active player without one
          const eligibleOthers = activePlayersInRound().filter(
            p => p.id !== recipientPlayer.id && !p.secondChance
          );
          if (eligibleOthers.length === 0) {
            game.setAsidePile.push(card);
            setAnnouncement(`${recipientPlayer.name} flipped duplicate [Second Chance], but no other active player can take it.`);
            return false;
          } else if (eligibleOthers.length === 1) {
            eligibleOthers[0].secondChance = card;
            setAnnouncement(`${recipientPlayer.name} gifted [Second Chance] to ${eligibleOthers[0].name}.`);
            return false;
          } else {
            game.stage = 'AWAIT_TARGET';
            game.pendingChoice = {
              chooserId: recipientPlayer.id,
              actionType: 'SECOND_CHANCE_GIFT',
              card,
              validTargetIds: eligibleOthers.map(p => p.id),
              reason: 'You already hold a Second Chance! Choose an active player to receive this shield.'
            };
            setAnnouncement(`${recipientPlayer.name} flipped a second [Second Chance] and must choose a recipient.`);
            return false;
          }
        }
      }

      // FREEZE or FLIP_THREE
      if (context.insideFlipThree && context.flipThreeTask) {
        context.flipThreeTask.queuedActions.push(card);
        setAnnouncement(`${recipientPlayer.name} flipped [${card.label}] during Flip Three! Queued until flips finish.`);
        return false;
      }

      promptOrAutoResolveAction(recipientPlayer, card);
      return false;
    }

    return false;
  }

  function promptOrAutoResolveAction(actingPlayer, card) {
    const actives = activePlayersInRound();
    if (actives.length === 0) {
      game.setAsidePile.push(card);
      return;
    }

    if (actives.length === 1) {
      const soleTarget = actives[0];
      setAnnouncement(`${actingPlayer.name} drew [${card.label}] — targets ${soleTarget.name} automatically.`);
      applyActionToTarget(actingPlayer, soleTarget, card);
      return;
    }

    game.stage = 'AWAIT_TARGET';
    game.pendingChoice = {
      chooserId: actingPlayer.id,
      actionType: card.actionType,
      card,
      validTargetIds: actives.map(p => p.id),
      reason:
        card.actionType === 'FREEZE'
          ? 'Choose an active player (including yourself) to FREEZE (banks points and stays).'
          : 'Choose an active player (including yourself) to FLIP THREE cards one by one!'
    };
    setAnnouncement(`${actingPlayer.name} flipped [${card.label}]! Selecting target...`);
  }

  function applyActionToTarget(actingPlayer, targetPlayer, card) {
    targetPlayer.resolvedActions.push(card);

    if (card.actionType === 'FREEZE') {
      targetPlayer.roundScore = calculatePlayerRoundScore(targetPlayer);
      targetPlayer.status = 'STAYED';
      setAnnouncement(`❄️ ${actingPlayer.name} froze ${targetPlayer.name}! ${targetPlayer.name} banks ${targetPlayer.roundScore} pts.`);
      return;
    }

    if (card.actionType === 'FLIP_THREE') {
      setAnnouncement(`🎲 ${actingPlayer.name} targeted ${targetPlayer.name} with [Flip Three]!`);
      game.executionStack.push({
        type: 'FLIP_THREE',
        targetId: targetPlayer.id,
        remaining: 3,
        queuedActions: []
      });
    }
  }

  function processExecutionStack() {
    while (game.executionStack.length > 0) {
      if (game.stage === 'AWAIT_TARGET' || game.stage === 'ROUND_OVER' || game.stage === 'GAME_OVER') {
        broadcastState();
        return;
      }

      const topTask = game.executionStack[game.executionStack.length - 1];

      if (topTask.type === 'INITIAL_DEAL') {
        if (topTask.queue.length === 0) {
          game.executionStack.pop();
          continue;
        }
        const nextPlayerId = topTask.queue.shift();
        const player = game.players.find(p => p.id === nextPlayerId);
        if (!player || player.status !== 'ACTIVE') continue;

        const ended = flipCardForPlayer(player, { insideFlipThree: false });
        if (ended) return;
        continue;
      }

      if (topTask.type === 'FLIP_THREE') {
        const target = game.players.find(p => p.id === topTask.targetId);
        if (!target || target.status !== 'ACTIVE' || topTask.remaining <= 0) {
          game.executionStack.pop();
          if (target && topTask.queuedActions && topTask.queuedActions.length > 0) {
            for (let i = topTask.queuedActions.length - 1; i >= 0; i--) {
              game.executionStack.push({
                type: 'QUEUED_ACTION',
                actorId: target.id,
                card: topTask.queuedActions[i]
              });
            }
          }
          continue;
        }

        topTask.remaining -= 1;
        const flipNumber = 3 - topTask.remaining;
        setAnnouncement(`Flip Three (${flipNumber}/3) for ${target.name}...`);
        const ended = flipCardForPlayer(target, {
          insideFlipThree: true,
          flipThreeTask: topTask
        });
        if (ended) return;
        continue;
      }

      if (topTask.type === 'QUEUED_ACTION') {
        game.executionStack.pop();
        const actor = game.players.find(p => p.id === topTask.actorId);
        if (!actor) continue;
        promptOrAutoResolveAction(actor, topTask.card);
        continue;
      }
    }

    const actives = activePlayersInRound();
    if (actives.length === 0) {
      endRound('All players have either Stayed or Busted.');
      return;
    }

    while (game.players[game.turnIndex].status !== 'ACTIVE') {
      game.turnIndex = (game.turnIndex + 1) % game.players.length;
    }

    game.stage = 'PLAYER_TURN';
    broadcastState();
  }

  function advanceToNextActivePlayer() {
    const actives = activePlayersInRound();
    if (actives.length === 0) {
      endRound('All players have either Stayed or Busted.');
      return;
    }
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
    while (game.players[game.turnIndex].status !== 'ACTIVE') {
      game.turnIndex = (game.turnIndex + 1) % game.players.length;
    }
    processExecutionStack();
  }

  function endRound(reasonText) {
    game.executionStack = [];
    game.pendingChoice = null;

    const roundBreakdown = [];
    for (const p of game.players) {
      if (p.status === 'BUSTED') {
        p.roundScore = 0;
      } else {
        p.roundScore = calculatePlayerRoundScore(p);
        p.totalScore += p.roundScore;
      }
      roundBreakdown.push({
        id: p.id,
        name: p.name,
        status: p.status,
        roundScore: p.roundScore,
        totalScore: p.totalScore
      });
    }

    setAnnouncement(`Round ${game.roundNumber} Over — ${reasonText}`);

    const contenders = game.players.filter(p => p.totalScore >= WINNING_SCORE);
    let winner = null;
    if (contenders.length > 0) {
      const maxScore = Math.max(...contenders.map(p => p.totalScore));
      const topTied = contenders.filter(p => p.totalScore === maxScore);
      if (topTied.length === 1) {
        winner = topTied[0];
      } else {
        setAnnouncement(`Tie at ${maxScore} points! Playing overtime round!`);
      }
    }

    if (winner) {
      game.stage = 'GAME_OVER';
      setAnnouncement(`🏆 CHAMPION: ${winner.name} wins the match with ${winner.totalScore} points!`);
    } else {
      game.stage = 'ROUND_OVER';
    }

    game.roundSummary = {
      reason: reasonText,
      winnerId: winner ? winner.id : null,
      breakdown: roundBreakdown
    };

    broadcastState();
  }

  function handlePlayerHit(player) {
    if (game.stage !== 'PLAYER_TURN') return;
    const current = game.players[game.turnIndex];
    if (!current || current.id !== player.id || player.status !== 'ACTIVE') return;

    const ended = flipCardForPlayer(player, { insideFlipThree: false });
    if (ended) return;

    if (game.stage === 'AWAIT_TARGET') {
      game.pendingChoice.advanceTurnAfter = true;
      broadcastState();
      return;
    }

    if (game.executionStack.length > 0) {
      game.executionStack.unshift({ type: 'ADVANCE_TURN_MARKER' });
      runStackWithTurnAdvance();
      return;
    }

    advanceToNextActivePlayer();
  }

  function runStackWithTurnAdvance() {
    game.executionStack = game.executionStack.filter(t => t.type !== 'ADVANCE_TURN_MARKER');
    processExecutionStack();
    if (game.stage === 'PLAYER_TURN') {
      advanceToNextActivePlayer();
    }
  }

  function handlePlayerStay(player) {
    if (game.stage !== 'PLAYER_TURN') return;
    const current = game.players[game.turnIndex];
    if (!current || current.id !== player.id || player.status !== 'ACTIVE') return;

    if (!hasAnyTableauCards(player)) return;

    player.roundScore = calculatePlayerRoundScore(player);
    player.status = 'STAYED';
    setAnnouncement(`${player.name} STAYED and banked ${player.roundScore} points.`);
    advanceToNextActivePlayer();
  }

  function handleTargetSelection(player, targetId) {
    if (game.stage !== 'AWAIT_TARGET' || !game.pendingChoice) return;
    if (game.pendingChoice.chooserId !== player.id) return;
    if (!game.pendingChoice.validTargetIds.includes(targetId)) return;

    const target = game.players.find(p => p.id === targetId);
    if (!target) return;

    const choice = game.pendingChoice;
    game.pendingChoice = null;
    game.stage = 'PLAYER_TURN';

    if (choice.actionType === 'SECOND_CHANCE_GIFT') {
      target.secondChance = choice.card;
      setAnnouncement(`${player.name} gave their extra [Second Chance] to ${target.name}.`);
    } else {
      applyActionToTarget(player, target, choice.card);
    }

    const shouldAdvance = Boolean(choice.advanceTurnAfter);
    processExecutionStack();

    if (shouldAdvance && game.stage === 'PLAYER_TURN') {
      advanceToNextActivePlayer();
    }
  }

  function computeUnseenCounts() {
    const counts = {};
    for (let n = 0; n <= 12; n++) counts[n] = 0;
    let modifiersLeft = 0;
    let actionsLeft = 0;

    for (const c of game.drawPile) {
      if (c.category === 'NUMBER') counts[c.value] = (counts[c.value] || 0) + 1;
      else if (c.category === 'MODIFIER') modifiersLeft++;
      else if (c.category === 'ACTION') actionsLeft++;
    }

    return {
      totalDrawPile: game.drawPile.length,
      totalSetAside: game.setAsidePile.length,
      numberCounts: counts,
      modifiersLeft,
      actionsLeft
    };
  }

  function sanitizeStateFor(viewerToken) {
    const viewer = game.players.find(p => p.token === viewerToken);
    const shoeStats = computeUnseenCounts();

    return {
      stage: game.stage,
      roundNumber: game.roundNumber,
      winningScore: WINNING_SCORE,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      dealerId: game.players[game.dealerIndex]?.id || null,
      turnPlayerId: game.players[game.turnIndex]?.id || null,
      youId: viewer ? viewer.id : null,
      lastAnnouncement: game.lastAnnouncement,
      shoeStats,
      pendingChoice: game.pendingChoice
        ? {
            chooserId: game.pendingChoice.chooserId,
            actionType: game.pendingChoice.actionType,
            cardLabel: game.pendingChoice.card.label,
            validTargetIds: game.pendingChoice.validTargetIds,
            reason: game.pendingChoice.reason
          }
        : null,
      roundSummary: game.roundSummary,
      players: game.players.map((p, idx) => {
        const heldValues = new Set(p.numbers.map(c => c.value));
        let duplicateCardsInShoe = 0;
        for (const val of heldValues) {
          duplicateCardsInShoe += shoeStats.numberCounts[val] || 0;
        }
        const rawBustPct =
          shoeStats.totalDrawPile > 0
            ? Math.round((duplicateCardsInShoe / shoeStats.totalDrawPile) * 100)
            : 0;

        return {
          id: p.id,
          seat: idx + 1,
          name: p.name,
          connected: p.connected,
          status: p.status, // 'ACTIVE' | 'STAYED' | 'BUSTED'
          totalScore: p.totalScore,
          roundScore: calculatePlayerRoundScore(p),
          canStay: hasAnyTableauCards(p),
          numbers: p.numbers,
          modifiers: p.modifiers,
          resolvedActions: p.resolvedActions,
          secondChance: p.secondChance,
          bustRiskPct: p.secondChance ? 0 : rawBustPct,
          rawDuplicateOddsPct: rawBustPct
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
          if (msg.name && String(msg.name).trim()) {
            player.name = String(msg.name).trim().slice(0, 20);
          }
        } else if (game.stage === 'LOBBY' && game.players.length < MAX_PLAYERS) {
          const seatNum = game.players.length + 1;
          const cleanName =
            msg.name && String(msg.name).trim()
              ? String(msg.name).trim().slice(0, 20)
              : `Player ${seatNum}`;
          player = {
            token,
            id: `p_${crypto.randomBytes(4).toString('hex')}`,
            name: cleanName,
            connected: true,
            status: 'ACTIVE',
            totalScore: 0,
            roundScore: 0,
            numbers: [],
            modifiers: [],
            resolvedActions: [],
            secondChance: null
          };
          game.players.push(player);
          setAnnouncement(`${player.name} joined Seat ${seatNum}.`);
        }

        broadcastState();
        return;
      }

      if (!boundToken) return;
      const player = game.players.find(p => p.token === boundToken);
      if (!player) return;

      switch (msg.type) {
        case 'SET_NAME': {
          const newName = String(msg.name || '').trim().slice(0, 20);
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
            const removed = game.players.splice(idx, 1)[0];
            setAnnouncement(`${removed.name} was removed from the table.`);
            if (game.stage !== 'LOBBY' && game.players.length < MIN_PLAYERS) {
              game.stage = 'LOBBY';
              game.roundNumber = 0;
            } else if (game.stage !== 'LOBBY') {
              if (game.turnIndex >= game.players.length) game.turnIndex = 0;
              processExecutionStack();
            }
            broadcastState();
          }
          break;
        }

        case 'START_MATCH': {
          if ((game.stage === 'LOBBY' || game.stage === 'GAME_OVER') && game.players.length >= MIN_PLAYERS && game.players.length <= MAX_PLAYERS) {
            startNewMatch();
          }
          break;
        }

        case 'RESET_MATCH': {
          if (game.players.length >= MIN_PLAYERS && game.players.length <= MAX_PLAYERS) {
            startNewMatch();
          } else {
            game.stage = 'LOBBY';
            game.roundNumber = 0;
            broadcastState();
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
          game.executionStack = [];
          game.pendingChoice = null;
          for (const p of game.players) {
            p.status = 'ACTIVE';
            p.totalScore = 0;
            p.roundScore = 0;
            p.numbers = [];
            p.modifiers = [];
            p.resolvedActions = [];
            p.secondChance = null;
          }
          setAnnouncement('Returned to table lobby.');
          broadcastState();
          break;
        }

        case 'HIT': {
          handlePlayerHit(player);
          break;
        }

        case 'STAY': {
          handlePlayerStay(player);
          break;
        }

        case 'SELECT_TARGET': {
          handleTargetSelection(player, String(msg.targetId || ''));
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

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const room = createFlip7Room();
  const server = http.createServer((req, res) => {
    room.serveHtml(req, res);
  });
  server.on('upgrade', (req, socket, head) => {
    room.wss.handleUpgrade(req, socket, head, (ws) => {
      room.wss.emit('connection', ws, req);
    });
  });
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Flip 7 Server running at http://localhost:${PORT}`);
  });
}

module.exports = { createFlip7Room };