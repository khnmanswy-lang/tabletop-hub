/**
 * LINE Let's Get Rich (Peak Era) — Real-Time Multiplayer Server
 * Authoritative GameEngine with WebSockets, AI Bots, and 3D State Broadcasting.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const engineBundlePath = fs.existsSync(path.join(__dirname, 'scripts', 'engine.bundle.cjs'))
  ? path.join(__dirname, 'scripts', 'engine.bundle.cjs')
  : path.join(__dirname, 'engine.bundle.cjs');

const {
  GameEngine,
  PLAYER_IDS,
  CHARACTER_ROSTER,
  TREASURE_POOL,
  WORLD_MAP_TILES,
  MATCH_CONFIG,
  getCharacterDef,
  getTreasureDef,
  getSkillDef,
  planAiRollDecision,
  decideAiBuildLevel,
  decideAiTakeover,
  decideAiBonusCoinAction,
  decideAiBoardTarget,
  selectBestTileToSellForDebt,
  computePlayerStats
} = require(engineBundlePath);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon'
};

function createRichGameRoom() {
  const wss = new WebSocketServer({ noServer: true });
  const distDir = path.join(__dirname, 'dist');

  let engine = new GameEngine();
  let aiStepTimeout = null;

  // token -> Set<WebSocket>
  const clientsByToken = new Map();
  // token -> string (PlayerId or null for spectator)
  const tokenToSlot = new Map();
  // token -> string (Player Name)
  const tokenToName = new Map();

  function clearAiTimeout() {
    if (aiStepTimeout) {
      clearTimeout(aiStepTimeout);
      aiStepTimeout = null;
    }
  }

  function getActiveSlotCount() {
    const lobby = engine.getLobbyConfig();
    return lobby.gameMode === 'TEAM_2V2' ? 4 : (lobby.ffaPlayerCount ?? 4);
  }

  function findSlotForToken(token) {
    return tokenToSlot.get(token) || null;
  }

  function assignSlotForToken(token, desiredName) {
    if (tokenToSlot.has(token)) {
      return tokenToSlot.get(token);
    }
    const lobby = engine.getLobbyConfig();
    const maxActive = getActiveSlotCount();

    // Check if any slot is currently assigned to this token
    for (const [t, s] of tokenToSlot.entries()) {
      if (t === token) return s;
    }

    // Find first vacant slot among active slots
    const occupiedSlots = new Set(Array.from(tokenToSlot.values()).filter(Boolean));
    for (let i = 0; i < maxActive; i++) {
      const pid = PLAYER_IDS[i];
      if (!occupiedSlots.has(pid)) {
        tokenToSlot.set(token, pid);
        if (desiredName) tokenToName.set(token, desiredName);
        engine.setPlayerControlType(pid, 'HUMAN');
        return pid;
      }
    }

    // If active slots full, spectator
    tokenToSlot.set(token, null);
    return null;
  }

  function isPlayerConnected(pid) {
    let token = null;
    for (const [t, s] of tokenToSlot.entries()) {
      if (s === pid) {
        token = t;
        break;
      }
    }
    if (!token) return false;
    const sockets = clientsByToken.get(token);
    if (!sockets || sockets.size === 0) return false;
    for (const ws of sockets) {
      if (ws.readyState === 1) return true;
    }
    return false;
  }

  function buildSnapshot() {
    const screen = engine.getScreenState();
    const lobby = engine.getLobbyConfig();
    const m = engine.getMatchState();

    if (!m) {
      const ffaCount = lobby.ffaPlayerCount ?? 4;
      const activeSlotCount = lobby.gameMode === 'TEAM_2V2' ? 4 : ffaCount;
      const lobbyPlayers = PLAYER_IDS.map((pid, idx) => {
        const slot = lobby.players[pid];
        const isSlotActive = idx < activeSlotCount;
        return {
          id: pid,
          name: slot.name,
          colorHex: slot.colorHex,
          teamId: slot.teamId,
          controlType: slot.controlType,
          characterId: slot.characterId,
          treasureIds: slot.treasureIds,
          marble: MATCH_CONFIG.startingMarbleByPlayer[pid] ?? MATCH_CONFIG.startingMarble,
          loanUsed: false,
          isBankrupt: !isSlotActive,
          isSlotActive,
          connected: slot.controlType === 'AI_BOT' ? true : isPlayerConnected(pid),
          tileIndex: 0,
          lapCount: 0,
          islandTurnsLeft: 0,
          isWaitingTravel: false,
          consecutiveDoubles: 0,
          oddEvenCharges: MATCH_CONFIG.oddEvenChargesPerMatch,
          selectedOddEven: 'NONE',
          skillUsesRemaining: {},
          hasAngelCard: isSlotActive,
          hasDiscountCoupon: false
        };
      });

      return {
        screen,
        mode: lobby.gameMode,
        ffaPlayerCount: ffaCount,
        turnNumber: 0,
        maxTurns: 20,
        activePlayerIndex: 0,
        phase: 'IDLE_ROLL',
        players: lobbyPlayers,
        tiles: WORLD_MAP_TILES.map((t, idx) => ({
          index: idx,
          ownerId: null,
          buildingLevel: 0,
          tollMultiplier: 1,
          isTourism: t.isTourism,
          isFestival: false,
          tollMultiplierCount: 0
        })),
        lastDice: null,
        bannerText: 'Match Lobby — Choose Character & 3 Treasures!',
        pendingDebt: null,
        pendingBonusGame: null,
        pendingBoardPick: null,
        pendingCityModal: null,
        pendingTakeoverModal: null,
        victoryResult: null,
        monopolyAlerts: []
      };
    }

    // In-game snapshot
    const activeSlotCount = m.gameMode === 'TEAM_2V2' ? 4 : (lobby.ffaPlayerCount ?? 4);
    const playersList = PLAYER_IDS.map((pid) => {
      const p = m.players[pid];
      if (!p) return null;
      return {
        ...p,
        connected: p.controlType === 'AI_BOT' ? true : isPlayerConnected(pid)
      };
    });

    let pendingCityModal = null;
    if (m.activePrompt?.type === 'BUY_OR_UPGRADE_CITY') {
      const p = m.activePrompt;
      const player = m.players[p.playerId];
      const stats = computePlayerStats(player.characterId, player.treasureIds);
      const def = WORLD_MAP_TILES[p.tileIndex];
      const options = p.options.map((opt) => {
        const tollMult = MATCH_CONFIG.buildingTollMultipliers[opt.level] ?? 1;
        const resultingToll =
          def.type === 'TOURISM'
            ? def.baseToll
            : Math.round(def.baseToll * tollMult);
        return {
          level: opt.level,
          label: opt.labelTh || opt.labelEn,
          subLabel: opt.labelEn || '',
          icon: '🏙️',
          cost: opt.cost,
          resultingToll,
          locked: Boolean(opt.isLockedByLap1),
          lockReason: opt.isLockedByLap1 ? 'ปลดล็อกรอบ 2 (Lap 2)' : undefined,
        };
      });
      const unlockedOpts = options.filter((o) => !o.locked);
      const affordableOpts = unlockedOpts.filter((o) => player.marble >= o.cost);
      pendingCityModal = {
        playerId: p.playerId,
        tileIndex: p.tileIndex,
        currentLevel: p.currentLevel,
        lapCount: player.lapCount,
        constDiscountPct: stats.constDiscountPct,
        options,
        defaultSelectedLevel:
          affordableOpts.length > 0
            ? affordableOpts[affordableOpts.length - 1].level
            : (unlockedOpts[0]?.level ?? 1),
      };
    }

    let pendingTakeoverModal = null;
    if (m.activePrompt?.type === 'TAKEOVER_PROMPT') {
      const p = m.activePrompt;
      const buyer = m.players[p.playerId];
      const stats = computePlayerStats(buyer.characterId, buyer.treasureIds);
      pendingTakeoverModal = {
        buyerId: p.playerId,
        ownerId: p.defenderId,
        tileIndex: p.tileIndex,
        buildingLevel: p.buildingLevel,
        acqDiscountPct: stats.acqDiscountPct,
        rawTakeoverCost: p.takeoverCost,
        netTakeoverCost: p.takeoverCost,
        resultingToll: engine.calculateTollBreakdown(p.tileIndex).rawToll,
        canUpgradeToLandmarkAfter: p.buildingLevel === 3,
        landmarkUpgradeCost: 0
      };
    }

    let pendingBoardPick = null;
    if (m.phase === 'BOARD_TARGET_PICK' && m.boardPickReason) {
      pendingBoardPick = {
        playerId: m.activePlayerId,
        reason: m.boardPickReason,
        validTileIndices: m.boardPickValidTiles,
        disruptMode: m.disruptMode === 'SWAP' ? 'SWAP' : 'SELL'
      };
    }

    return {
      screen,
      mode: m.gameMode,
      ffaPlayerCount: lobby.ffaPlayerCount ?? 4,
      turnNumber: m.turnNumber,
      maxTurns: m.maxTurns,
      activePlayerIndex: m.activePlayerIndex,
      phase: m.phase,
      players: playersList,
      tiles: m.tiles,
      lastDice: m.lastDiceRoll
        ? {
            d1: m.lastDiceRoll.die1,
            d2: m.lastDiceRoll.die2,
            sum: m.lastDiceRoll.sum,
            isDouble: m.lastDiceRoll.isDouble,
            gaugeValue: m.lastDiceRoll.gaugeValue
          }
        : null,
      bannerText: engine.getScreenState() === 'IN_GAME'
        ? `Turn ${m.turnNumber}/20 • Active: ${m.players[m.activePlayerId]?.name}`
        : 'Match Lobby',
      pendingDebt: m.pendingDebt,
      pendingBonusGame: m.activePrompt?.type === 'BONUS_COIN_GAME' ? m.activePrompt.bonusState : null,
      pendingBoardPick,
      pendingCityModal,
      pendingTakeoverModal,
      pendingFortuneCard: m.activePrompt?.type === 'FORTUNE_CARD_MODAL' ? m.activePrompt : null,
      blackHole: m.blackHole ?? null,
      victoryResult: m.victoryResult,
      monopolyAlerts: m.monopolyAlerts ?? []
    };
  }

  function broadcast(data) {
    const raw = JSON.stringify(data);
    for (const [token, sockets] of clientsByToken.entries()) {
      for (const ws of sockets) {
        if (ws.readyState === 1) {
          ws.send(raw);
        }
      }
    }
  }

  function broadcastState() {
    const snapshot = buildSnapshot();
    broadcast({ type: 'STATE_SYNC', state: snapshot });
  }

  // Hook engine callbacks
  engine.setCallbacks({
    onStateChange: () => {
      broadcastState();
    },
    onSkillBanner: (payload) => {
      broadcast({ type: 'SKILL_BANNER', message: payload.message, isEpic: true });
    },
    onToastBanner: (message) => {
      broadcast({ type: 'TOAST', message });
    },
    onFloatingText: (payload) => {
      const tileName = WORLD_MAP_TILES[payload.tileIndex]?.nameTh ?? '';
      broadcast({ type: 'TOAST', message: `${tileName}: ${payload.text}` });
    }
  });

  // Automated AI loop (uses GameEngine's built-in prepareAiRollAndGetGaugeTarget & stepAiTurn)
  function checkAndTriggerAi() {
    clearAiTimeout();
    const m = engine.getMatchState();
    if (!m || engine.getScreenState() !== 'IN_GAME' || m.phase === 'VICTORY_SUMMARY' || m.victoryResult) {
      return;
    }

    // Check if the current decision-maker (active player OR debtor in DEBT_RESOLUTION) is an AI_BOT
    let isAiDecision = false;
    if (m.phase === 'DEBT_RESOLUTION' && m.pendingDebt) {
      const debtor = m.players[m.pendingDebt.debtorId];
      isAiDecision = debtor?.controlType === 'AI_BOT';
    } else {
      const activeP = m.players[m.activePlayerId];
      isAiDecision = activeP?.controlType === 'AI_BOT';
    }

    if (!isAiDecision) return;

    const activeP = m.players[m.activePlayerId];

    // 1. Normal AI Dice Roll (when in IDLE_ROLL and not waiting at Sky Terminal)
    if (m.phase === 'IDLE_ROLL' && activeP?.controlType === 'AI_BOT' && !activeP.isWaitingTravel) {
      aiStepTimeout = setTimeout(() => {
        executeAiRoll();
      }, 950);
      return;
    }

    // 2. All other AI decisions (Sky Terminal trigger, City Build, Takeover, Bonus Coin, Fortune Card, Board Pick, Debt Resolution)
    const delayMs = m.activePrompt?.type === 'FORTUNE_CARD_MODAL' ? 1200 : 750;
    aiStepTimeout = setTimeout(() => {
      executeAiPrompt();
    }, delayMs);
  }

  function executeAiRoll() {
    try {
      const m = engine.getMatchState();
      if (!m || m.phase !== 'IDLE_ROLL') return;
      const activeP = m.players[m.activePlayerId];
      if (!activeP || activeP.controlType !== 'AI_BOT') return;

      if (activeP.isWaitingTravel) {
        engine.startGaugeCharge();
        broadcastState();
        checkAndTriggerAi();
        return;
      }

      const targetGauge = engine.prepareAiRollAndGetGaugeTarget();
      const rollResult = engine.releaseGaugeRoll(targetGauge);
      if (!rollResult) {
        broadcastState();
        checkAndTriggerAi();
        return;
      }

      const afterRoll = engine.getMatchState();
      // If 3rd consecutive double sent AI directly to Desert Island, there is no dice animation phase
      if (afterRoll && afterRoll.phase !== 'DICE_ANIMATING') {
        broadcastState();
        checkAndTriggerAi();
        return;
      }

      engine.completeDiceAnimation();
      const afterDice = engine.getMatchState();
      const movePath = afterDice?.pendingMovePath ? [...afterDice.pendingMovePath] : [];

      broadcast({
        type: 'DICE_ROLLED',
        activePlayerId: m.activePlayerId,
        die1: rollResult.die1,
        die2: rollResult.die2,
        gaugeValue: rollResult.gaugeValue,
        isDouble: rollResult.isDouble,
        movePath
      });

      const hopDuration = Math.max(850, movePath.length * 165 + 550);
      aiStepTimeout = setTimeout(() => {
        try {
          if (movePath.length > 0) {
            for (const stepTileIdx of movePath) {
              engine.advancePieceStep(stepTileIdx);
            }
          }
          engine.completePieceMovement();
          broadcastState();
          checkAndTriggerAi();
        } catch (err) {
          console.error('[Rich AI Hop Error]:', err);
        }
      }, hopDuration);
    } catch (err) {
      console.error('[Rich AI Roll Error]:', err);
    }
  }

  function executeAiPrompt() {
    try {
      const m = engine.getMatchState();
      if (!m || m.phase === 'VICTORY_SUMMARY') return;

      const wasWorldTravelPick =
        m.phase === 'BOARD_TARGET_PICK' &&
        (m.boardPickReason === 'WORLD_TRAVEL_DEST' || m.boardPickReason === 'LINE_TELEPORT_DEST');
      const moverId = m.activePlayerId;

      const stepped = engine.stepAiTurn();
      if (!stepped) return;

      const afterStep = engine.getMatchState();
      if (
        wasWorldTravelPick &&
        afterStep &&
        afterStep.phase === 'PIECE_MOVING' &&
        afterStep.pendingMovePath.length > 0
      ) {
        const movePath = [...afterStep.pendingMovePath];
        broadcast({
          type: 'DICE_ROLLED',
          activePlayerId: moverId,
          die1: afterStep.lastDiceRoll?.die1 ?? 1,
          die2: afterStep.lastDiceRoll?.die2 ?? 1,
          gaugeValue: afterStep.lastDiceRoll?.gaugeValue ?? 7,
          isDouble: false,
          movePath
        });
        const hopDuration = Math.max(800, movePath.length * 150 + 400);
        aiStepTimeout = setTimeout(() => {
          try {
            for (const stepTileIdx of movePath) {
              engine.advancePieceStep(stepTileIdx);
            }
            engine.completePieceMovement();
            broadcastState();
            checkAndTriggerAi();
          } catch (err) {
            console.error('[Rich AI Travel Error]:', err);
          }
        }, hopDuration);
        return;
      }

      broadcastState();
      checkAndTriggerAi();
    } catch (err) {
      console.error('[Rich AI Prompt Error]:', err);
    }
  }

  // WebSocket connection handler
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

        const assignedSlot = assignSlotForToken(token, msg.name);
        const snapshot = buildSnapshot();

        ws.send(JSON.stringify({
          type: 'INIT',
          you: { id: assignedSlot, token },
          state: snapshot
        }));

        broadcastState();
        return;
      }

      // Action Handlers
      switch (msg.type) {
        case 'TOGGLE_CONTROL': {
          const pid = msg.playerId;
          const lobby = engine.getLobbyConfig();
          const cur = lobby.players[pid]?.controlType ?? 'HUMAN';
          const next = cur === 'HUMAN' ? 'AI_BOT' : 'HUMAN';
          engine.setPlayerControlType(pid, next);
          if (next === 'AI_BOT') {
            engine.randomizePlayerLoadout(pid);
          }
          broadcastState();
          break;
        }

        case 'SET_MODE': {
          engine.setGameMode(msg.mode === 'TEAM_2V2' ? 'TEAM_2V2' : 'FFA_4P');
          broadcastState();
          break;
        }

        case 'SET_FFA_COUNT': {
          if ([2, 3, 4].includes(msg.count)) {
            engine.setFfaPlayerCount(msg.count);
            broadcastState();
          }
          break;
        }

        case 'ADD_AI': {
          const idx = Number(msg.slotIndex);
          if (idx >= 0 && idx < 4) {
            const pid = PLAYER_IDS[idx];
            const curCount = engine.getFfaPlayerCount();
            if (idx >= curCount) {
              engine.setFfaPlayerCount(Math.min(4, idx + 1));
            }
            engine.setPlayerControlType(pid, 'AI_BOT');
            engine.randomizePlayerLoadout(pid);
            broadcastState();
          }
          break;
        }

        case 'ADD_HUMAN': {
          const idx = Number(msg.slotIndex);
          if (idx >= 0 && idx < 4) {
            const pid = PLAYER_IDS[idx];
            const curCount = engine.getFfaPlayerCount();
            if (idx >= curCount) {
              engine.setFfaPlayerCount(Math.min(4, idx + 1));
            }
            engine.setPlayerControlType(pid, 'HUMAN');
            broadcastState();
          }
          break;
        }

        case 'KICK_SLOT': {
          const pid = msg.playerId;
          if (pid) {
            engine.kickPlayerSlot(pid);
            // Free token assignment & demote kicked player's client to spectator
            for (const [t, s] of tokenToSlot.entries()) {
              if (s === pid) {
                tokenToSlot.delete(t);
                tokenToName.delete(t);
                const sockets = clientsByToken.get(t);
                if (sockets) {
                  for (const ws of sockets) {
                    if (ws.readyState === 1) {
                      ws.send(JSON.stringify({
                        type: 'INIT',
                        you: { id: null, token: t },
                        state: buildSnapshot()
                      }));
                    }
                  }
                }
              }
            }
            broadcastState();
          }
          break;
        }

        case 'SET_LOADOUT': {
          const pid = msg.playerId;
          if (pid && msg.characterId && Array.isArray(msg.treasureIds)) {
            engine.setPlayerCharacter(pid, msg.characterId);
            msg.treasureIds.forEach((tid, idx) => {
              if (idx < 3) engine.setPlayerTreasureSlot(pid, idx, tid);
            });
            broadcastState();
          }
          break;
        }

        case 'RANDOM_LOADOUT': {
          if (msg.playerId) {
            engine.randomizePlayerLoadout(msg.playerId);
            broadcastState();
          }
          break;
        }

        case 'START_MATCH': {
          clearAiTimeout();
          engine.startNewMatch();
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'ROLL_GAUGE': {
          const m = engine.getMatchState();
          if (!m) return;
          const userSlot = findSlotForToken(boundToken);
          if (userSlot && userSlot !== m.activePlayerId) {
            // Check if active player is a remote player on another connected client
            let isAssignedToOtherClient = false;
            for (const [t, s] of tokenToSlot.entries()) {
              if (s === m.activePlayerId && t !== boundToken && clientsByToken.get(t)?.size > 0) {
                isAssignedToOtherClient = true;
                break;
              }
            }
            if (isAssignedToOtherClient) return;
          }

          const activeP = m.players[m.activePlayerId];
          if (activeP && activeP.isWaitingTravel) {
            engine.startGaugeCharge();
            broadcastState();
            checkAndTriggerAi();
            break;
          }

          const rollResult = engine.releaseGaugeRoll(msg.gaugeValue);
          if (!rollResult) return;

          const afterRoll = engine.getMatchState();
          if (afterRoll && afterRoll.phase !== 'DICE_ANIMATING') {
            broadcastState();
            checkAndTriggerAi();
            break;
          }

          engine.completeDiceAnimation();
          const afterDice = engine.getMatchState();
          const movePath = afterDice?.pendingMovePath ? [...afterDice.pendingMovePath] : [];
          broadcast({
            type: 'DICE_ROLLED',
            activePlayerId: m.activePlayerId,
            die1: rollResult.die1,
            die2: rollResult.die2,
            gaugeValue: rollResult.gaugeValue,
            isDouble: rollResult.isDouble,
            movePath
          });

          const hopDuration = Math.max(850, movePath.length * 165 + 550);
          setTimeout(() => {
            try {
              if (movePath.length > 0) {
                for (const stepTileIdx of movePath) {
                  engine.advancePieceStep(stepTileIdx);
                }
              }
              engine.completePieceMovement();
              broadcastState();
              checkAndTriggerAi();
            } catch (err) {
              console.error('[Rich Human Hop Error]:', err);
            }
          }, hopDuration);
          break;
        }

        case 'CONFIRM_FORTUNE': {
          engine.confirmFortuneCard();
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'SET_ODD_EVEN': {
          engine.toggleOddEvenMode(msg.mode);
          broadcastState();
          break;
        }

        case 'CONFIRM_BUILD': {
          engine.confirmBuildOrUpgrade(msg.targetLevel);
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'SKIP_BUILD': {
          engine.skipBuildOrUpgrade();
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'CONFIRM_TAKEOVER': {
          const ok = engine.confirmTakeover();
          if (ok && msg.alsoUpgradeLandmark) {
            engine.confirmBuildOrUpgrade(5);
          }
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'SKIP_TAKEOVER': {
          engine.skipTakeover();
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'BONUS_GUESS': {
          engine.flipBonusCoin(msg.guess);
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'BONUS_STOP': {
          engine.takeBonusReward();
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'PICK_TILE': {
          const m = engine.getMatchState();
          const moverId = m?.activePlayerId ?? 'P1';
          if (msg.extraMode) {
            engine.setDisruptMode(msg.extraMode === 'SWAP' ? 'SWAP' : 'FORCE_SELL');
          }
          engine.selectBoardTargetTile(msg.tileIndex);
          const afterPick = engine.getMatchState();
          if (afterPick && afterPick.phase === 'PIECE_MOVING' && afterPick.pendingMovePath.length > 0) {
            const movePath = [...afterPick.pendingMovePath];
            broadcast({
              type: 'DICE_ROLLED',
              activePlayerId: moverId,
              die1: afterPick.lastDiceRoll?.die1 ?? 1,
              die2: afterPick.lastDiceRoll?.die2 ?? 1,
              gaugeValue: afterPick.lastDiceRoll?.gaugeValue ?? 7,
              isDouble: false,
              movePath
            });
            const hopDuration = Math.max(800, movePath.length * 150 + 400);
            setTimeout(() => {
              try {
                for (const stepTileIdx of movePath) {
                  engine.advancePieceStep(stepTileIdx);
                }
                engine.completePieceMovement();
                broadcastState();
                checkAndTriggerAi();
              } catch (err) {
                console.error('[Rich Pick Tile Move Error]:', err);
              }
            }, hopDuration);
            break;
          }
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'TAKE_LOAN': {
          engine.takeBankLoan();
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'SELL_CITIES': {
          if (Array.isArray(msg.tileIndices)) {
            for (const idx of msg.tileIndices) {
              engine.sellOwnedTileForDebt(idx);
            }
            broadcastState();
          }
          break;
        }

        case 'PAY_DEBT': {
          engine.payResolvedDebt();
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'DECLARE_BANKRUPTCY': {
          engine.declareBankruptcy();
          broadcastState();
          checkAndTriggerAi();
          break;
        }

        case 'PAY_ISLAND_BAIL': {
          engine.payDesertIslandBail();
          broadcastState();
          break;
        }

        case 'RETURN_LOBBY': {
          clearAiTimeout();
          engine.returnToLobby();
          broadcastState();
          break;
        }

        case 'REMATCH': {
          clearAiTimeout();
          engine.startNewMatch();
          broadcastState();
          checkAndTriggerAi();
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
          clientsByToken.delete(boundToken);
          broadcastState();
        }
      }
    });
  });

  function serveStatic(req, res, pathname) {
    let filePath = '';
    if (pathname === '/rich' || pathname === '/rich/' || pathname === '/' || pathname === '/index.html') {
      filePath = path.join(distDir, 'index.html');
    } else if (pathname.startsWith('/rich/assets/')) {
      const assetFile = pathname.replace('/rich/assets/', '');
      filePath = path.join(distDir, 'assets', assetFile);
    } else if (pathname.startsWith('/assets/')) {
      const assetFile = pathname.replace('/assets/', '');
      filePath = path.join(distDir, 'assets', assetFile);
    } else {
      filePath = path.join(distDir, pathname.replace(/^\/rich\//, ''));
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
      });
      return fs.createReadStream(filePath).pipe(res);
    }

    // Fallback to index.html for SPA
    const indexHtml = path.join(distDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(indexHtml).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  return {
    wss,
    serveHtml: (req, res) => serveStatic(req, res, '/'),
    serveStatic
  };
}

// Standalone runner
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const room = createRichGameRoom();
  const server = http.createServer((req, res) => {
    room.serveStatic(req, res, req.url.split('?')[0]);
  });
  server.on('upgrade', (req, socket, head) => {
    room.wss.handleUpgrade(req, socket, head, (ws) => {
      room.wss.emit('connection', ws, req);
    });
  });
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LINE Let's Get Rich Server running at http://localhost:${PORT}`);
  });
}

module.exports = { createRichGameRoom };
