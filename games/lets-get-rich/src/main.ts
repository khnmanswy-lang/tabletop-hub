import './styles/main.css';
import {
  BoardTileState,
  BuildingLevel,
  MATCH_CONFIG,
  PlayerId,
  PlayerState,
  WORLD_MAP_TILES,
} from './data/lgrGameData';
import {
  computePlayerStats,
  GameEngine,
  PLAYER_IDS,
} from './engine/gameEngine';
import { IsoBoard3DRenderer } from './render/isoBoard3D';
import {
  BoardPickModalPayload,
  CityConstructionOption,
  CityModalPayload,
  TakeoverModalPayload,
  UIGameStateSnapshot,
  UIManager,
} from './ui/uiManager';

const LEVEL_ICONS: Record<BuildingLevel, string> = {
  [BuildingLevel.NONE]: '⬜',
  [BuildingLevel.LAND]: '🟩',
  [BuildingLevel.VILLA]: '🏡',
  [BuildingLevel.BUILDING]: '🏢',
  [BuildingLevel.HOTEL]: '🏨',
  [BuildingLevel.LANDMARK]: '🏰',
};

const LEVEL_SUBLABELS: Record<BuildingLevel, string> = {
  [BuildingLevel.NONE]: '',
  [BuildingLevel.LAND]: 'ที่ดินเปล่า',
  [BuildingLevel.VILLA]: 'บ้านพัก (หลังที่ 1)',
  [BuildingLevel.BUILDING]: 'อาคาร (หลังที่ 2)',
  [BuildingLevel.HOTEL]: 'โรงแรม (หลังที่ 3)',
  [BuildingLevel.LANDMARK]: 'แลนด์มาร์ก (ห้ามซื้อต่อ!)',
};

class LgrPeakEraApp {
  private engine: GameEngine;
  private ui!: UIManager;
  private board3D!: IsoBoard3DRenderer;

  private speedMultiplier: 1 | 2 | 3 = 1;
  private isAnimating3D = false;
  private aiTimerId: number | null = null;
  private fortuneTimerId: number | null = null;
  private currentBannerText =
    '🎲 กดปุ่ม ROLL ค้างไว้เพื่อวิ่งเข็มเกจโค้ง 2.00 – 12.00 แล้วปล่อยเพื่อทอยลูกเต๋า!';
  private lastKnownMarbles: Record<PlayerId, number> = {
    P1: MATCH_CONFIG.startingMarbleByPlayer.P1,
    P2: MATCH_CONFIG.startingMarbleByPlayer.P2,
    P3: MATCH_CONFIG.startingMarbleByPlayer.P3,
    P4: MATCH_CONFIG.startingMarbleByPlayer.P4,
  };

  private ws: WebSocket | null = null;
  private youPlayerId: PlayerId | null = null;
  private playerToken: string = '';

  constructor(rootEl: HTMLElement) {
    this.engine = new GameEngine({
      onStateChange: () => {
        if (!this.isNetworkConnected()) {
          this.syncAll();
        }
      },
      onSkillBanner: (payload) => {
        this.currentBannerText = payload.message;
        this.ui?.showSkillCutIn(payload.message, true);
      },
      onToastBanner: (message) => {
        this.currentBannerText = message;
        this.ui?.showSkillCutIn(message, true);
      },
      onFloatingText: (payload) => {
        this.currentBannerText = `${WORLD_MAP_TILES[payload.tileIndex]?.nameTh ?? ''}: ${payload.text}`;
        this.ui?.showSkillCutIn(this.currentBannerText, false);
      },
      onPerfumeSteal: (payload) => {
        this.board3D?.spawnPerfumeEffect(payload.tileIndex);
      },
      onTollPaid: (payload) => {
        const m = this.engine.getMatchState();
        if (m) {
          const payer = m.players[payload.payerId];
          const receiver = m.players[payload.receiverId];
          if (payer && receiver) {
            this.board3D?.spawnTollPaymentEffect(payer.tileIndex, receiver.tileIndex);
          }
        }
      },
      onTaxPaid: (payload) => {
        this.board3D?.spawnTaxEffect(payload.tileIndex);
      },
      onAngelCardUsed: (payload) => {
        this.board3D?.spawnAngelShieldEffect(payload.tileIndex);
        this.ui?.showAngelShieldActivationBanner(payload.targetName, payload.reason);
      },
    });

    const initialSnapshot = this.buildUISnapshot();
    this.ui = new UIManager(rootEl, initialSnapshot, {
      onScreenChange: (screen) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'SET_SCREEN', screen });
        } else {
          this.engine.setScreenState(screen);
        }
      },
      onModeChange: (mode) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'SET_MODE', mode });
        } else {
          this.engine.setGameMode(mode);
        }
      },
      onFfaPlayerCountChange: (count) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'SET_FFA_COUNT', count });
        } else {
          this.engine.setFfaPlayerCount(count);
        }
      },
      onTogglePlayerControl: (playerId) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'TOGGLE_CONTROL', playerId });
        } else {
          const lobby = this.engine.getLobbyConfig();
          const cur = lobby.players[playerId]?.controlType ?? 'HUMAN';
          this.engine.setPlayerControlType(
            playerId,
            cur === 'HUMAN' ? 'AI_BOT' : 'HUMAN'
          );
        }
      },
      onUpdatePlayerLoadout: (playerId, characterId, treasureIds) => {
        if (this.isNetworkConnected()) {
          this.sendWs({
            type: 'SET_LOADOUT',
            playerId,
            characterId,
            treasureIds,
          });
        } else {
          this.engine.setPlayerCharacter(playerId, characterId);
          treasureIds.forEach((tid, idx) => {
            this.engine.setPlayerTreasureSlot(
              playerId,
              idx as 0 | 1 | 2,
              tid
            );
          });
        }
      },
      onKickPlayerSlot: (playerId) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'KICK_SLOT', playerId });
        } else {
          this.engine.kickPlayerSlot(playerId);
          this.syncAll();
        }
      },
      onAddAiSlot: (slotIndex) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'ADD_AI', slotIndex });
        } else {
          const pid = PLAYER_IDS[slotIndex];
          this.engine.setPlayerControlType(pid, 'AI_BOT');
          this.engine.randomizePlayerLoadout(pid);
          this.syncAll();
        }
      },
      onAddHumanSlot: (slotIndex) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'ADD_HUMAN', slotIndex });
        } else {
          const pid = PLAYER_IDS[slotIndex];
          this.engine.setPlayerControlType(pid, 'HUMAN');
          this.syncAll();
        }
      },
      onRandomizePlayerLoadout: (playerId) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'RANDOM_LOADOUT', playerId });
        } else {
          this.engine.randomizePlayerLoadout(playerId);
          this.syncAll();
        }
      },
      onStartMatch: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'START_MATCH' });
        } else {
          this.clearTimers();
          this.isAnimating3D = false;
          const m = this.engine.startNewMatch();
          for (const pid of PLAYER_IDS) {
            this.lastKnownMarbles[pid] = m.players[pid].marble;
          }
          this.currentBannerText =
            '🎉 เริ่มการแข่งขัน! กดค้างที่ปุ่ม ROLL เพื่อเล็งเกจลูกเต๋า 2.00 – 12.00';
          this.syncAll();
        }
      },
      onSetOddEven: (mode) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'SET_ODD_EVEN', mode });
        } else {
          this.engine.toggleOddEvenMode(mode);
          this.syncAll();
        }
      },
      onGaugeStepChange: (fromTileIndex, activeStep) => {
        this.board3D?.setRollStepPreviews(fromTileIndex, activeStep);
      },
      onGaugeReleaseRoll: (gaugeValue) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'ROLL_GAUGE', gaugeValue });
        } else {
          this.handleDiceRollSequence(gaugeValue);
        }
      },
      onPayIslandBail: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'PAY_ISLAND_BAIL' });
        } else {
          this.engine.payDesertIslandBail();
        }
      },
      onConfirmCityBuild: (targetLevel) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'CONFIRM_BUILD', targetLevel });
        } else {
          this.engine.confirmBuildOrUpgrade(targetLevel);
        }
      },
      onPassCityBuild: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'SKIP_BUILD' });
        } else {
          this.engine.skipBuildOrUpgrade();
        }
      },
      onConfirmTakeover: (alsoUpgradeLandmark) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'CONFIRM_TAKEOVER', alsoUpgradeLandmark });
        } else {
          this.engine.confirmTakeover(alsoUpgradeLandmark);
        }
      },
      onPassTakeover: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'SKIP_TAKEOVER' });
        } else {
          this.engine.skipTakeover();
        }
      },
      onBonusCoinGuess: (guess) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'BONUS_GUESS', guess });
        } else {
          this.engine.flipBonusCoin(guess);
        }
      },
      onBonusStopAndCollect: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'BONUS_STOP' });
        } else {
          this.engine.takeBonusReward();
        }
      },
      onConfirmFortuneCard: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'CONFIRM_FORTUNE' });
        } else {
          this.engine.confirmFortuneCard();
          this.syncAll();
        }
      },
      onBoardTilePicked: (tileIndex, extraMode) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'PICK_TILE', tileIndex, extraMode });
        } else {
          if (extraMode) {
            this.engine.setDisruptMode(
              extraMode === 'SWAP' ? 'SWAP' : 'FORCE_SELL'
            );
          }
          this.handleBoardTileSelected(tileIndex);
        }
      },
      onTakeBankLoan: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'TAKE_LOAN' });
        } else {
          this.engine.takeBankLoan();
        }
      },
      onSellCitiesForDebt: (tileIndices) => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'SELL_CITIES', tileIndices });
        } else {
          for (const idx of tileIndices) {
            this.engine.sellOwnedTileForDebt(idx);
          }
        }
      },
      onPayResolvedDebt: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'PAY_DEBT' });
        } else {
          this.engine.payResolvedDebt();
        }
      },
      onDeclareBankruptcy: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'DECLARE_BANKRUPTCY' });
        } else {
          this.engine.declareBankruptcy();
        }
      },
      onToggleSpeed: (speed) => {
        this.speedMultiplier = speed;
      },
      onPlayerCardHover: (pid) => {
        if (!pid) {
          this.board3D.setExternalHighlightTiles([]);
          return;
        }
        const m = this.engine.getMatchState();
        if (!m) return;
        const player = m.players[pid];
        const ownedTiles = m.tiles
          .filter((t) => t.ownerId === pid)
          .map((t) => t.index);
        this.board3D.setExternalHighlightTiles(ownedTiles, player?.colorHex);
      },
      onRematch: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'REMATCH' });
        } else {
          this.clearTimers();
          this.isAnimating3D = false;
          const m = this.engine.startNewMatch();
          for (const pid of PLAYER_IDS) {
            this.lastKnownMarbles[pid] = m.players[pid].marble;
          }
          this.syncAll();
        }
      },
      onReturnToLobby: () => {
        if (this.isNetworkConnected()) {
          this.sendWs({ type: 'RETURN_LOBBY' });
        } else {
          this.clearTimers();
          this.isAnimating3D = false;
          this.engine.returnToLobby();
          this.syncAll();
        }
      },
    });

    // Mount Three.js 3D Isometric Board Renderer inside UI Canvas Container
    const canvasHost = this.ui.getCanvasContainer();
    this.board3D = new IsoBoard3DRenderer(
      canvasHost,
      (clickedTileIndex) => {
        const m = this.engine.getMatchState();
        if (
          m &&
          m.phase === 'BOARD_TARGET_PICK' &&
          m.boardPickValidTiles.includes(clickedTileIndex)
        ) {
          this.handleBoardTileSelected(clickedTileIndex);
        }
      },
      (hoveredTileIndex) => {
        this.ui.updateHoveredTile(hoveredTileIndex);
      }
    );

    this.syncAll();
    this.initNetwork();
    (window as any).__lgr = this;
  }

  private initNetwork(): void {
    if (typeof window === 'undefined') return;
    let tok = localStorage.getItem('lgr_player_token');
    if (!tok) {
      tok = 'tok_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('lgr_player_token', tok);
    }
    this.playerToken = tok;

    const loc = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const isHub = loc.pathname.startsWith('/rich');
    const wsPath = isHub ? '/rich/ws' : '/ws';
    const wsUrl = `${proto}//${loc.host}${wsPath}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.sendWs({
          type: 'AUTH',
          token: this.playerToken,
          name: 'Player ' + this.playerToken.slice(-4),
        });
      };

      this.ws.onmessage = (e) => {
        this.handleWsMessage(e.data);
      };

      this.ws.onerror = () => {
        // Fallback to offline mode seamlessly
      };

      this.ws.onclose = () => {
        setTimeout(() => this.initNetwork(), 3500);
      };
    } catch {
      // Offline fallback
    }
  }

  private sendWs(payload: Record<string, any>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private isNetworkConnected(): boolean {
    return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  private handleWsMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'INIT') {
      this.youPlayerId = msg.you?.id ?? null;
      this.ui.setYouPlayerId(this.youPlayerId);
      if (msg.state) {
        this.applyServerSnapshot(msg.state);
      }
    } else if (msg.type === 'STATE_SYNC') {
      if (msg.state) {
        this.applyServerSnapshot(msg.state);
      }
    } else if (msg.type === 'DICE_ROLLED') {
      this.handleServerDiceRolled(msg);
    } else if (msg.type === 'SKILL_BANNER') {
      this.currentBannerText = msg.message;
      this.ui?.showSkillCutIn(msg.message, !!msg.isEpic);
    } else if (msg.type === 'TOAST') {
      this.currentBannerText = msg.message;
      this.ui?.showSkillCutIn(msg.message, false);
    }
  }

  private applyServerSnapshot(snapshot: UIGameStateSnapshot): void {
    if (snapshot.pendingCityModal && Array.isArray(snapshot.pendingCityModal.options)) {
      const tileDef = WORLD_MAP_TILES[snapshot.pendingCityModal.tileIndex];
      snapshot.pendingCityModal.options = snapshot.pendingCityModal.options.map((opt: any) => {
        const isLocked = Boolean(opt.locked || opt.isLockedByLap1);
        const tollMult = (MATCH_CONFIG.buildingTollMultipliers as any)[opt.level] ?? 1;
        const resultingToll = typeof opt.resultingToll === 'number' && !isNaN(opt.resultingToll)
          ? opt.resultingToll
          : (tileDef ? Math.round(tileDef.baseToll * tollMult) : 0);
        return {
          level: opt.level,
          label: opt.label || opt.labelTh || opt.labelEn || `Level ${opt.level}`,
          subLabel: opt.subLabel || opt.labelEn || opt.labelTh || '',
          icon: opt.icon || '🏙️',
          cost: opt.cost,
          resultingToll,
          locked: isLocked,
          lockReason: opt.lockReason || (isLocked ? (snapshot.pendingCityModal!.lapCount === 0 ? '🔒 ปลดล็อกรอบ 2 (Lap 2)' : 'ยังสร้างไม่ได้') : undefined),
        };
      });
    }

    this.ui.sync(snapshot);
    if (snapshot.screen === 'IN_GAME' && Array.isArray(snapshot.players)) {
      for (const p of snapshot.players) {
        if (!p || p.isSlotActive === false) continue;
        const prev = this.lastKnownMarbles[p.id];
        const cur = p.marble;
        if (typeof prev === 'number' && cur !== prev) {
          this.ui.showCashDelta(p.id, cur - prev);
        }
        this.lastKnownMarbles[p.id] = cur;
      }
    }
    if (this.board3D) {
      this.board3D.syncBoard({
        tiles: snapshot.tiles,
        players: snapshot.players,
        activePlayerId:
          snapshot.players[snapshot.activePlayerIndex]?.id ?? 'P1',
        blackHole: null,
        highlightedTileIndices:
          snapshot.pendingBoardPick?.validTileIndices ?? [],
      });
    }
  }

  private handleServerDiceRolled(msg: any): void {
    this.isAnimating3D = true;
    this.ui.updateDiceVisuals(msg.die1, msg.die2, msg.gaugeValue);
    this.board3D.animateDiceRoll(
      msg.die1,
      msg.die2,
      this.speedMultiplier,
      () => {
        if (msg.movePath && msg.movePath.length > 0) {
          this.board3D.animatePieceHop(
            msg.activePlayerId,
            msg.movePath,
            this.speedMultiplier,
            undefined,
            () => {
              this.isAnimating3D = false;
              this.sendWs({ type: 'ANIMATION_DONE' });
            }
          );
        } else {
          this.isAnimating3D = false;
          this.sendWs({ type: 'ANIMATION_DONE' });
        }
      }
    );
  }

  private clearTimers(): void {
    if (this.aiTimerId !== null) {
      window.clearTimeout(this.aiTimerId);
      this.aiTimerId = null;
    }
    if (this.fortuneTimerId !== null) {
      window.clearTimeout(this.fortuneTimerId);
      this.fortuneTimerId = null;
    }
  }

  private handleDiceRollSequence(gaugeValue: number): void {
    if (this.isAnimating3D) return;
    const m = this.engine.getMatchState();
    if (!m) return;

    const activePlayer = m.players[m.activePlayerId];
    if (activePlayer.isWaitingTravel) {
      this.engine.startGaugeCharge();
      return;
    }

    const rollResult = this.engine.releaseGaugeRoll(gaugeValue);
    if (!rollResult) return;

    const sum = rollResult.die1 + rollResult.die2;
    const destIdx = (activePlayer.tileIndex + sum) % 32;
    const destDef = WORLD_MAP_TILES[destIdx];
    this.currentBannerText = `🎲 ทอยได้ ${sum} (${rollResult.die1}+${rollResult.die2}${rollResult.isDouble ? ' DOUBLE!' : ''}) ➔ ไปยัง #${destIdx} ${destDef.nameTh}`;
    this.ui.showSkillCutIn(this.currentBannerText, false);

    this.isAnimating3D = true;
    this.board3D.setRollStepPreviews(null, null);
    this.ui.updateDiceVisuals(
      rollResult.die1,
      rollResult.die2,
      rollResult.gaugeValue
    );

    this.board3D.animateDiceRoll(
      rollResult.die1,
      rollResult.die2,
      this.speedMultiplier,
      () => {
        this.engine.completeDiceAnimation();
        const afterDiceMatch = this.engine.getMatchState();
        if (
          afterDiceMatch &&
          afterDiceMatch.phase === 'PIECE_MOVING' &&
          afterDiceMatch.pendingMovePath.length > 0
        ) {
          const path = [...afterDiceMatch.pendingMovePath];
          const moverId = afterDiceMatch.activePlayerId;
          this.board3D.animatePieceHop(
            moverId,
            path,
            this.speedMultiplier,
            (stepTileIdx) => {
              this.engine.advancePieceStep(stepTileIdx);
            },
            () => {
              this.isAnimating3D = false;
              this.engine.completePieceMovement();
            }
          );
        } else {
          this.isAnimating3D = false;
          this.syncAll();
        }
      }
    );
  }

  private handleBoardTileSelected(tileIndex: number): void {
    const m = this.engine.getMatchState();
    if (!m || m.phase !== 'BOARD_TARGET_PICK') return;
    const wasWorldTravel =
      m.boardPickReason === 'WORLD_TRAVEL_DEST' ||
      m.boardPickReason === 'LINE_TELEPORT_DEST';
    const moverId = m.activePlayerId;

    const ok = this.engine.selectBoardTargetTile(tileIndex);
    if (!ok) return;

    const afterPick = this.engine.getMatchState();
    if (
      wasWorldTravel &&
      afterPick &&
      afterPick.phase === 'PIECE_MOVING' &&
      afterPick.pendingMovePath.length > 0
    ) {
      this.isAnimating3D = true;
      const path = [...afterPick.pendingMovePath];
      this.board3D.animatePieceHop(
        moverId,
        path,
        this.speedMultiplier,
        undefined,
        () => {
          this.isAnimating3D = false;
          this.engine.completePieceMovement();
        }
      );
    }
  }

  private buildUISnapshot(): UIGameStateSnapshot {
    const screen = this.engine.getScreenState();
    const lobby = this.engine.getLobbyConfig();
    const m = this.engine.getMatchState();

    if (!m) {
      const ffaCount = this.engine.getFfaPlayerCount();
      const lobbyPlayers: PlayerState[] = PLAYER_IDS.map((pid) => {
        const slot = lobby.players[pid];
        const isSlotActive = slot.isSlotActive !== false;
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
          tileIndex: 0,
          lapCount: 0,
          islandTurnsLeft: 0,
          isWaitingTravel: false,
          consecutiveDoubles: 0,
          oddEvenCharges: MATCH_CONFIG.oddEvenChargesPerMatch,
          selectedOddEven: 'NONE',
          skillUsesRemaining: {},
          hasAngelCard: false,
          hasDiscountCoupon: false,
        };
      });

      const emptyTiles: BoardTileState[] = WORLD_MAP_TILES.map((def) => ({
        index: def.index,
        ownerId: null,
        buildingLevel: BuildingLevel.NONE,
        isFestival: false,
        olympicMultiplier: 1,
        stepMultiplier: 1,
      }));

      return {
        screen,
        mode: lobby.gameMode,
        ffaPlayerCount: ffaCount,
        turnNumber: 1,
        maxTurns: MATCH_CONFIG.maxTurns,
        activePlayerIndex: 0,
        phase: 'IDLE_ROLL',
        players: lobbyPlayers,
        tiles: emptyTiles,
        lastDice: null,
        bannerText: this.currentBannerText,
      };
    }

    const playersList = PLAYER_IDS.map((pid) => m.players[pid]);

    // Build City Modal Payload if activePrompt is BUY_OR_UPGRADE_CITY
    let pendingCityModal: CityModalPayload | null = null;
    let pendingTakeoverModal: TakeoverModalPayload | null = null;

    if (m.activePrompt?.type === 'BUY_OR_UPGRADE_CITY') {
      const p = m.activePrompt;
      const player = m.players[p.playerId];
      const stats = computePlayerStats(player.characterId, player.treasureIds);

      const options: CityConstructionOption[] = p.options.map((opt) => {
        const def = WORLD_MAP_TILES[p.tileIndex];
        const tollMult = (MATCH_CONFIG.buildingTollMultipliers as any)[opt.level] ?? 1;
        const resultingToll =
          def.type === 'TOURISM'
            ? def.baseToll
            : Math.round(def.baseToll * tollMult);

        return {
          level: opt.level,
          label: opt.labelEn,
          subLabel: LEVEL_SUBLABELS[opt.level] || opt.labelTh,
          icon: LEVEL_ICONS[opt.level] ?? '🏢',
          cost: opt.cost,
          resultingToll,
          locked: opt.isLockedByLap1,
          lockReason: opt.isLockedByLap1 ? 'Locked on Lap 1' : undefined,
        };
      });

      const affordableOpts = options.filter(
        (o) => !o.locked && player.marble >= o.cost
      );
      const unlockedOpts = options.filter((o) => !o.locked);
      const defaultSelectedLevel =
        affordableOpts.length > 0
          ? affordableOpts[affordableOpts.length - 1].level
          : unlockedOpts.length > 0
            ? unlockedOpts[unlockedOpts.length - 1].level
            : options[0]?.level ?? BuildingLevel.LAND;

      pendingCityModal = {
        playerId: p.playerId,
        tileIndex: p.tileIndex,
        currentLevel: p.currentLevel,
        lapCount: player.lapCount,
        constDiscountPct: stats.constDiscountPct,
        options,
        defaultSelectedLevel,
      };
    } else if (m.activePrompt?.type === 'TAKEOVER_PROMPT') {
      const p = m.activePrompt;
      const buyer = m.players[p.playerId];
      const stats = computePlayerStats(buyer.characterId, buyer.treasureIds);
      const propVal = this.engine.calculateTilePropertyValue(p.tileIndex);
      const rawTakeoverCost = Math.round(
        propVal * MATCH_CONFIG.takeoverCostMultiplier
      );
      const resultingToll = this.engine.calculateTollBreakdown(
        p.tileIndex
      ).rawToll;
      const canUpgradeToLandmarkAfter =
        p.buildingLevel === BuildingLevel.HOTEL;
      const landmarkUpgradeCost = canUpgradeToLandmarkAfter
        ? this.engine.calculateBuildCost(
            p.playerId,
            p.tileIndex,
            BuildingLevel.HOTEL,
            BuildingLevel.LANDMARK
          )
        : 0;

      pendingTakeoverModal = {
        buyerId: p.playerId,
        ownerId: p.defenderId,
        tileIndex: p.tileIndex,
        buildingLevel: p.buildingLevel,
        acqDiscountPct: stats.acqDiscountPct,
        rawTakeoverCost,
        netTakeoverCost: p.takeoverCost,
        resultingToll,
        canUpgradeToLandmarkAfter,
        landmarkUpgradeCost,
        paidToll: p.paidToll ?? 0,
        tollExemptReason: p.tollExemptReason,
      };
    }

    let pendingBoardPick: BoardPickModalPayload | null = null;
    if (m.phase === 'BOARD_TARGET_PICK' && m.boardPickReason) {
      pendingBoardPick = {
        playerId: m.activePlayerId,
        reason: m.boardPickReason,
        validTileIndices: m.boardPickValidTiles,
        disruptMode: m.disruptMode === 'SWAP' ? 'SWAP' : 'SELL',
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
            gaugeValue: m.lastDiceRoll.gaugeValue,
          }
        : null,
      bannerText: this.currentBannerText,
      pendingDebt: m.pendingDebt,
      pendingBonusGame:
        m.activePrompt?.type === 'BONUS_COIN_GAME'
          ? m.activePrompt.bonusState
          : null,
      pendingBoardPick,
      pendingCityModal,
      pendingTakeoverModal,
      pendingFortuneCard:
        m.activePrompt?.type === 'FORTUNE_CARD_MODAL'
          ? m.activePrompt
          : null,
      victoryResult: m.victoryResult,
      monopolyAlerts: m.monopolyAlerts ?? [],
    };
  }

  private syncAll(): void {
    const snapshot = this.buildUISnapshot();
    this.ui.sync(snapshot);

    const m = this.engine.getMatchState();
    if (m) {
      // Show floating cash deltas on corner HUDs when player marble changes
      for (const pid of PLAYER_IDS) {
        const prev = this.lastKnownMarbles[pid];
        const cur = m.players[pid].marble;
        if (cur !== prev) {
          this.ui.showCashDelta(pid, cur - prev);
          this.lastKnownMarbles[pid] = cur;
        }
      }
    }

    if (this.board3D) {
      this.board3D.syncBoard({
        tiles: snapshot.tiles,
        players: snapshot.players,
        activePlayerId: m?.activePlayerId ?? 'P1',
        blackHole: m?.blackHole ?? null,
        highlightedTileIndices: m?.boardPickValidTiles ?? [],
      });
    }

    // Auto-resolve Fortune Card prompt for AI players after allowing time to view the 3D flip
    if (
      m?.activePrompt?.type === 'FORTUNE_CARD_MODAL' &&
      this.fortuneTimerId === null
    ) {
      const card = m.activePrompt;
      const player = m.players[card.playerId];
      if (player?.controlType === 'AI_BOT') {
        this.fortuneTimerId = window.setTimeout(() => {
          this.fortuneTimerId = null;
          this.engine.confirmFortuneCard();
          this.syncAll();
        }, Math.round(1400 / this.speedMultiplier));
      }
    }

    this.scheduleAiTurnIfNeeded();
  }

  private scheduleAiTurnIfNeeded(): void {
    if (this.isAnimating3D || this.aiTimerId !== null) return;
    const m = this.engine.getMatchState();
    if (
      !m ||
      this.engine.getScreenState() !== 'IN_GAME' ||
      m.phase === 'VICTORY_SUMMARY'
    ) {
      return;
    }

    // Check if current decision maker is an AI_BOT
    let isAiDecision = false;
    if (m.phase === 'DEBT_RESOLUTION' && m.pendingDebt) {
      const debtor = m.players[m.pendingDebt.debtorId];
      isAiDecision = debtor?.controlType === 'AI_BOT';
    } else {
      const active = m.players[m.activePlayerId];
      isAiDecision = active?.controlType === 'AI_BOT';
    }

    if (!isAiDecision) return;

    const delayMs = Math.round(650 / this.speedMultiplier);
    this.aiTimerId = window.setTimeout(() => {
      this.aiTimerId = null;
      this.executeAiStep();
    }, delayMs);
  }

  private executeAiStep(): void {
    if (this.isAnimating3D) return;
    const m = this.engine.getMatchState();
    if (!m || m.phase === 'VICTORY_SUMMARY') return;

    const active = m.players[m.activePlayerId];
    // If AI is about to roll the dice in IDLE_ROLL (and not waiting at Sky Terminal),
    // run the full 3D dice + piece hop animation sequence!
    if (
      m.phase === 'IDLE_ROLL' &&
      active.controlType === 'AI_BOT' &&
      !active.isWaitingTravel
    ) {
      const targetGauge = this.engine.prepareAiRollAndGetGaugeTarget();
      this.handleDiceRollSequence(targetGauge);
      return;
    }

    const wasWorldTravelPick =
      m.phase === 'BOARD_TARGET_PICK' &&
      (m.boardPickReason === 'WORLD_TRAVEL_DEST' ||
        m.boardPickReason === 'LINE_TELEPORT_DEST');
    const moverId = m.activePlayerId;

    const stepped = this.engine.stepAiTurn();
    if (!stepped) return;

    const afterStep = this.engine.getMatchState();
    if (
      wasWorldTravelPick &&
      afterStep &&
      afterStep.phase === 'PIECE_MOVING' &&
      afterStep.pendingMovePath.length > 0
    ) {
      this.isAnimating3D = true;
      const path = [...afterStep.pendingMovePath];
      this.board3D.animatePieceHop(
        moverId,
        path,
        this.speedMultiplier,
        undefined,
        () => {
          this.isAnimating3D = false;
          this.engine.completePieceMovement();
        }
      );
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const appRoot = document.getElementById('app');
  if (appRoot) {
    new LgrPeakEraApp(appRoot);
  }
});
