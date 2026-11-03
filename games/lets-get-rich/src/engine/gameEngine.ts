import {
  BlackHoleState,
  BLUE_TOURISM_INDICES,
  BoardPickReason,
  BoardTileState,
  BuildingLevel,
  CHARACTER_ROSTER,
  CHARACTER_SYNERGIES,
  CharacterDef,
  CharacterSynergyDef,
  ControlType,
  DICE_TABLE_EVEN,
  DICE_TABLE_NONE,
  DICE_TABLE_ODD,
  formatMarbleCompact,
  FORTUNE_CARD_DECK,
  FortuneCardId,
  GameMode,
  getCharacterDef,
  getCharacterSynergy,
  getSkillDef,
  getTreasureDef,
  getTourismMultiplierForTile,
  MainSkillId,
  MATCH_CONFIG,
  NON_DOUBLE_DIE_PAIRS,
  OddEvenMode,
  PendingBonusGameState,
  PendingDebtState,
  PlayerId,
  PlayerState,
  RED_TOURISM_INDICES,
  ScreenState,
  SKILL_CATALOG,
  SkillDefinition,
  SkillId,
  STAT_SCALING_TABLE,
  SubSkillId,
  TeamId,
  TREASURE_POOL,
  TreasureDef,
  TurnPhase,
  UNIVERSAL_DOUBLE_PROB_PCT,
  VictoryResult,
  WORLD_MAP_TILES,
  WorldTileDef,
} from '../data/lgrGameData';
import {
  decideAiBoardTarget,
  decideAiBonusCoinAction,
  decideAiBuildLevel,
  decideAiTakeover,
  planAiRollDecision,
  selectBestTileToSellForDebt,
} from './botDecisionTree';

export const SESSION_STORAGE_KEY = 'LGR_PEAK_ERA_SESSION_V1';

export {
  CHARACTER_ROSTER,
  CHARACTER_SYNERGIES,
  TREASURE_POOL,
  WORLD_MAP_TILES,
  MATCH_CONFIG,
  formatMarbleCompact,
  getCharacterDef,
  getCharacterSynergy,
  getTreasureDef,
  getSkillDef,
} from '../data/lgrGameData';
export type { CharacterSynergyDef } from '../data/lgrGameData';

export {
  planAiRollDecision,
  decideAiBuildLevel,
  decideAiTakeover,
  decideAiBonusCoinAction,
  decideAiBoardTarget,
  selectBestTileToSellForDebt,
} from './botDecisionTree';

export const PLAYER_IDS: readonly PlayerId[] = ['P1', 'P2', 'P3', 'P4'] as const;

export const DEFAULT_PLAYER_COLORS: Readonly<Record<PlayerId, string>> = {
  P1: '#E11D48',
  P2: '#0284C7',
  P3: '#16A34A',
  P4: '#D97706',
};

export const COLOR_GROUP_TILES: Readonly<Record<number, readonly number[]>> = {
  1: [1, 3],
  2: [6, 7, 9],
  3: [11, 12, 14],
  4: [17, 18],
  5: [21, 22, 23],
  6: [26, 27],
  7: [29, 31],
};

export const LINE_PURCHASABLE_TILES: Readonly<Record<0 | 1 | 2 | 3, readonly number[]>> = {
  0: [1, 3, 5, 6, 7],
  1: [9, 10, 11, 12, 14, 15],
  2: [17, 18, 19, 21, 22, 23],
  3: [25, 26, 27, 29, 31],
};

// 5 Tourism Islands: 3 Blue Islands (5, 10, 15) and 2 Red Islands (19, 25)
export const TOURISM_TILE_INDICES: readonly number[] = [5, 10, 15, 19, 25] as const;
export { BLUE_TOURISM_INDICES, RED_TOURISM_INDICES };

export interface LobbyPlayerSlot {
  id: PlayerId;
  name: string;
  colorHex: string;
  teamId: TeamId;
  controlType: ControlType;
  characterId: string;
  treasureIds: [string, string, string];
}

export interface LobbyConfig {
  gameMode: GameMode;
  ffaPlayerCount?: 2 | 3 | 4;
  players: Record<PlayerId, LobbyPlayerSlot>;
  loadoutInspectPlayerId: PlayerId;
}

export interface EquippedMainSkillEntry {
  skillId: MainSkillId;
  def: SkillDefinition;
  procPct: number;
  sourceType: 'CHARACTER' | 'TREASURE';
  sourceName: string;
  sourceEmoji: string;
  usesRemaining: number | null;
  maxUses: number | null;
}

export interface EquippedSubSkillEntry {
  skillId: SubSkillId;
  def: SkillDefinition;
  totalProcPct: number;
  sources: {
    sourceType: 'CHARACTER' | 'TREASURE';
    sourceName: string;
    sourceEmoji: string;
    procPct: number;
  }[];
  usesRemaining: number | null;
  maxUses: number | null;
}

export interface ComputedPlayerStats {
  dcLevel: number;
  dcProcPct: number;
  gaugeSpeed: number;
  constDcLevel: number;
  constDiscountPct: number;
  acqDcLevel: number;
  acqDiscountPct: number;
  tollDcLevel: number;
  tollDiscountPct: number;
  salLuckLevel: number;
  salBonusPct: number;
  doubleBoostPct: number;
}

export interface PlayerEquippedSkillsSummary {
  character: CharacterDef;
  treasures: [TreasureDef, TreasureDef, TreasureDef];
  mainSkills: EquippedMainSkillEntry[];
  subSkills: EquippedSubSkillEntry[];
  computedStats: ComputedPlayerStats;
}

export interface DiceRollResult {
  playerId: PlayerId;
  gaugeValue: number;
  targetSum: number;
  die1: number;
  die2: number;
  sum: number;
  isDouble: boolean;
  dcTriggered: boolean;
  dcProcPct: number;
  oddEvenUsed: OddEvenMode;
  doubleBoostPct: number;
}

export interface BuildOptionEntry {
  level: BuildingLevel;
  labelEn: string;
  labelTh: string;
  cost: number;
  canAfford: boolean;
  isLockedByLap1: boolean;
}

export type ActiveActionPrompt =
  | {
      type: 'BUY_OR_UPGRADE_CITY';
      playerId: PlayerId;
      tileIndex: number;
      currentLevel: BuildingLevel;
      maxAllowedLevel: BuildingLevel;
      lap1HotelLocked: boolean;
      isAfterTakeover: boolean;
      options: BuildOptionEntry[];
    }
  | {
      type: 'TAKEOVER_PROMPT';
      playerId: PlayerId;
      tileIndex: number;
      defenderId: PlayerId;
      buildingLevel: BuildingLevel;
      takeoverCost: number;
      canAfford: boolean;
      paidToll: number;
    }
  | {
      type: 'BONUS_COIN_GAME';
      bonusState: PendingBonusGameState;
    }
  | ({
      type: 'FORTUNE_CARD_MODAL';
    } & FortuneCardModalPayload);

export interface FortuneCardModalPayload {
  playerId: PlayerId;
  cardId: FortuneCardId;
  titleTh: string;
  titleEn: string;
  descTh: string;
  rewardAmount: number;
}

export interface MonopolyAlertInfo {
  ownerPlayerId: PlayerId;
  teamId: TeamId;
  alertType: 'TRIPLE_MONOPOLY' | 'LINE_MONOPOLY' | 'TOURISM_MONOPOLY';
  labelTh: string;
  missingTileIndex: number;
}

export interface ActionLogEntry {
  id: string;
  turnNumber: number;
  playerId: PlayerId;
  message: string;
  category: 'DICE' | 'MOVE' | 'BUILD' | 'TOLL' | 'SKILL' | 'SYSTEM';
  timestamp: number;
}

export interface SkillBannerPayload {
  playerId: PlayerId;
  playerName: string;
  skillId: SkillId;
  skillName: string;
  procPct: number;
  message: string;
}

export interface FloatingTextPayload {
  tileIndex: number;
  text: string;
  colorHex: string;
}

export type DisruptActionMode = 'FORCE_SELL' | 'SWAP';

export interface MatchState {
  gameMode: GameMode;
  turnNumber: number;
  maxTurns: number;
  activePlayerIndex: number;
  activePlayerId: PlayerId;
  phase: TurnPhase;
  players: Record<PlayerId, PlayerState>;
  tiles: BoardTileState[];
  blackHole: BlackHoleState | null;
  olympicTileIndex: number | null;
  olympicHostCount: number;
  gaugeValue: number;
  gaugeDirection: 1 | -1;
  lastDiceRoll: DiceRollResult | null;
  pendingMovePath: number[];
  pendingSteppedCount: number;
  activePrompt: ActiveActionPrompt | null;
  boardPickReason: BoardPickReason | null;
  boardPickValidTiles: number[];
  pendingBlackHoleLandmarkIndex: number | null;
  pendingLineTeleportLandmarkIndex: number | null;
  pendingOlympicIsFree: boolean;
  disruptMode: DisruptActionMode;
  pendingDebt: PendingDebtState | null;
  pendingDebtQueue: PendingDebtState[];
  extraRollGranted: boolean;
  freeWorldTravelMap: Record<PlayerId, boolean>;
  monopolyAlerts: MonopolyAlertInfo[];
  actionLogs: ActionLogEntry[];
  victoryResult: VictoryResult | null;
}

export interface PersistedSessionEnvelope {
  version: 1;
  screenState: ScreenState;
  lobbyConfig: LobbyConfig;
  matchState: MatchState | null;
}

export interface GameEngineCallbacks {
  onStateChange?: (engine: GameEngine) => void;
  onSkillBanner?: (payload: SkillBannerPayload) => void;
  onToastBanner?: (message: string, accentColor?: string) => void;
  onFloatingText?: (payload: FloatingTextPayload) => void;
  onPerfumeSteal?: (payload: {
    stealerId: PlayerId;
    victimId: PlayerId;
    amount: number;
    tileIndex: number;
    ratePct: number;
  }) => void;
  onTollPaid?: (payload: {
    payerId: PlayerId;
    receiverId: PlayerId;
    amount: number;
    tileIndex: number;
  }) => void;
  onTaxPaid?: (payload: {
    payerId: PlayerId;
    amount: number;
    tileIndex: number;
  }) => void;
  onAngelCardUsed?: (payload: {
    playerId: PlayerId;
    tileIndex: number;
    targetName: string;
    reason: 'TOLL' | 'BLACKOUT' | 'DISRUPT';
  }) => void;
  onActionLog?: (entry: ActionLogEntry) => void;
}

// ============================================================================
// PURE HELPER FUNCTIONS FOR LOADOUT, STATS & SKILL STACKING
// ============================================================================

export function isTreasureValidForCharacter(characterId: string, treasureId: string): boolean {
  const charDef = getCharacterDef(characterId);
  const trDef = getTreasureDef(treasureId);
  return trDef.mainSkill.skillId !== charDef.mainSkill.skillId;
}

/** Two Main skills conflict (can't be co-equipped) — except M06 Super Perfume, which may stack. */
export function isMainSkillConflict(a: string, b: string): boolean {
  return a === b && a !== 'M06_SUPER_PERFUME';
}

export function sanitizePlayerTreasures(
  characterId: string,
  treasureIds: readonly string[]
): [string, string, string] {
  const charDef = getCharacterDef(characterId);
  const result: string[] = [];
  const usedIds = new Set<string>();
  const usedMainSkills = new Set<MainSkillId>([charDef.mainSkill.skillId]);
  // Exception: M06 Super Perfume may duplicate (char 12% + treasure 7% = 19% steal)
  const isBlocked = (id: MainSkillId) => id !== 'M06_SUPER_PERFUME' && usedMainSkills.has(id);

  for (const tid of treasureIds) {
    if (result.length >= 3) break;
    const tr = TREASURE_POOL.find((t) => t.id === tid);
    if (tr && !usedIds.has(tr.id) && !isBlocked(tr.mainSkill.skillId)) {
      result.push(tr.id);
      usedIds.add(tr.id);
      usedMainSkills.add(tr.mainSkill.skillId);
    }
  }

  for (const fallback of TREASURE_POOL) {
    if (result.length >= 3) break;
    if (!usedIds.has(fallback.id) && !usedMainSkills.has(fallback.mainSkill.skillId)) {
      result.push(fallback.id);
      usedIds.add(fallback.id);
      usedMainSkills.add(fallback.mainSkill.skillId);
    }
  }

  return [result[0], result[1], result[2]];
}

/**
 * Generates a synergistic 3-treasure loadout for a character following the
 * "2 Core Synergies + 1 Wildcard" archetype meta pattern:
 * - 2 treasures drawn from character-specific curated high-synergy pool
 * - 1 wildcard treasure drawn from remaining valid pool (off-meta variety)
 * - 100% sanitized against duplicate main skills and duplicate IDs
 */
export function generateSynergisticLoadout(
  characterId: string
): [string, string, string] {
  const charDef = getCharacterDef(characterId);
  const synergy = CHARACTER_SYNERGIES[characterId];

  // 1. All valid treasures (excluding duplicate main skill)
  const validTreasures = TREASURE_POOL.filter(
    (t) => t.mainSkill.skillId !== charDef.mainSkill.skillId || t.mainSkill.skillId === 'M06_SUPER_PERFUME'
  ).map((t) => t.id);

  // 2. Curated core synergistic treasures
  const corePool = (synergy?.coreTreasures ?? []).filter((id) =>
    validTreasures.includes(id)
  );

  // Shuffle core candidates and pick 2
  const shuffledCore = [...corePool].sort(() => Math.random() - 0.5);
  const pickedCore = shuffledCore.slice(0, 2);

  // 3. For the 3rd slot (Wildcard), pick from remaining valid treasures
  const wildcardPool = validTreasures.filter((id) => !pickedCore.includes(id));
  const shuffledWildcard = [...wildcardPool].sort(() => Math.random() - 0.5);
  const pickedWildcard = shuffledWildcard.slice(0, 1);

  // 4. Sanitize and validate
  return sanitizePlayerTreasures(characterId, [...pickedCore, ...pickedWildcard]);
}

export function computePlayerStats(
  characterId: string,
  treasureIds: readonly [string, string, string]
): ComputedPlayerStats {
  const charDef = getCharacterDef(characterId);
  const clampLv = (v: number) => Math.max(0, Math.min(5, Math.round(v)));

  const dcLevel = clampLv(charDef.stats.dc);
  const constDcLevel = clampLv(charDef.stats.constDc);
  const acqDcLevel = clampLv(charDef.stats.acqDc);
  const tollDcLevel = clampLv(charDef.stats.tollDc);
  const salLuckLevel = clampLv(charDef.stats.salLuck);

  const dcProcPct = STAT_SCALING_TABLE.dcProcPct[dcLevel];
  const gaugeSpeed = Number((9.5 * (1 - 0.018 * dcLevel)).toFixed(3));
  const constDiscountPct = STAT_SCALING_TABLE.constDiscountPct[constDcLevel];
  const acqDiscountPct = STAT_SCALING_TABLE.acqDiscountPct[acqDcLevel];
  const tollDiscountPct = STAT_SCALING_TABLE.tollDiscountPct[tollDcLevel];
  const salBonusPct = STAT_SCALING_TABLE.salLuckBonusPct[salLuckLevel];

  // Additive S10_DOUBLE_BOOST across Character's 2 subs and 3 Treasures' subs
  let doubleBoostPct = 0;
  for (const sub of charDef.subSkills) {
    if (sub.skillId === 'S10_DOUBLE_BOOST') {
      doubleBoostPct += sub.procPct;
    }
  }
  for (const tid of treasureIds) {
    const tr = getTreasureDef(tid);
    if (tr.subSkill.skillId === 'S10_DOUBLE_BOOST') {
      doubleBoostPct += tr.subSkill.procPct;
    }
  }

  return {
    dcLevel,
    dcProcPct,
    gaugeSpeed,
    constDcLevel,
    constDiscountPct,
    acqDcLevel,
    acqDiscountPct,
    tollDcLevel,
    tollDiscountPct,
    salLuckLevel,
    salBonusPct,
    doubleBoostPct,
  };
}

export function getPlayerEquippedSkillsSummary(
  slotOrPlayer: Pick<PlayerState, 'characterId' | 'treasureIds'> & {
    skillUsesRemaining?: Record<string, number>;
  }
): PlayerEquippedSkillsSummary {
  const charDef = getCharacterDef(slotOrPlayer.characterId);
  const cleanTreasureIds = sanitizePlayerTreasures(
    slotOrPlayer.characterId,
    slotOrPlayer.treasureIds
  );
  const treasures: [TreasureDef, TreasureDef, TreasureDef] = [
    getTreasureDef(cleanTreasureIds[0]),
    getTreasureDef(cleanTreasureIds[1]),
    getTreasureDef(cleanTreasureIds[2]),
  ];

  const usesMap = slotOrPlayer.skillUsesRemaining ?? {};

  // 1. 4 Main Skills (1 from Character + 3 from Treasures, all distinct)
  const mainSkills: EquippedMainSkillEntry[] = [];
  const charMainDef = getSkillDef(charDef.mainSkill.skillId);
  mainSkills.push({
    skillId: charDef.mainSkill.skillId,
    def: charMainDef,
    procPct: charDef.mainSkill.procPct,
    sourceType: 'CHARACTER',
    sourceName: charDef.name,
    sourceEmoji: charDef.avatarEmoji,
    maxUses: charMainDef.maxUsesPerMatch,
    usesRemaining:
      charMainDef.maxUsesPerMatch !== null
        ? (usesMap[charDef.mainSkill.skillId] ?? charMainDef.maxUsesPerMatch)
        : null,
  });

  for (const tr of treasures) {
    const mDef = getSkillDef(tr.mainSkill.skillId);
    const maxUses = tr.mainSkill.maxUses ?? mDef.maxUsesPerMatch;
    mainSkills.push({
      skillId: tr.mainSkill.skillId,
      def: mDef,
      procPct: tr.mainSkill.procPct,
      sourceType: 'TREASURE',
      sourceName: tr.name,
      sourceEmoji: tr.iconEmoji,
      maxUses,
      usesRemaining: maxUses !== null ? (usesMap[tr.mainSkill.skillId] ?? maxUses) : null,
    });
  }

  // 2. Sub Skills (Stack directly & additively!)
  const subMap = new Map<SubSkillId, EquippedSubSkillEntry>();

  const addSubSource = (
    skillId: SubSkillId,
    procPct: number,
    sourceType: 'CHARACTER' | 'TREASURE',
    sourceName: string,
    sourceEmoji: string
  ) => {
    const def = getSkillDef(skillId);
    const existing = subMap.get(skillId);
    if (!existing) {
      const maxUses = def.maxUsesPerMatch;
      subMap.set(skillId, {
        skillId,
        def,
        totalProcPct: Math.min(95, procPct),
        sources: [{ sourceType, sourceName, sourceEmoji, procPct }],
        maxUses,
        usesRemaining: maxUses !== null ? (usesMap[skillId] ?? maxUses) : null,
      });
    } else {
      existing.sources.push({ sourceType, sourceName, sourceEmoji, procPct });
      existing.totalProcPct = Math.min(95, existing.totalProcPct + procPct);
    }
  };

  for (const sub of charDef.subSkills) {
    addSubSource(sub.skillId, sub.procPct, 'CHARACTER', charDef.name, charDef.avatarEmoji);
  }
  for (const tr of treasures) {
    addSubSource(tr.subSkill.skillId, tr.subSkill.procPct, 'TREASURE', tr.name, tr.iconEmoji);
  }

  return {
    character: charDef,
    treasures,
    mainSkills,
    subSkills: Array.from(subMap.values()),
    computedStats: computePlayerStats(charDef.id, cleanTreasureIds),
  };
}

export function createInitialSkillUsesMap(
  characterId: string,
  treasureIds: readonly [string, string, string]
): Record<string, number> {
  const uses: Record<string, number> = {};
  const summary = getPlayerEquippedSkillsSummary({
    characterId,
    treasureIds: [treasureIds[0], treasureIds[1], treasureIds[2]],
  });

  for (const m of summary.mainSkills) {
    if (m.maxUses !== null) {
      uses[m.skillId] = m.maxUses;
    }
  }
  for (const s of summary.subSkills) {
    if (s.maxUses !== null) {
      uses[s.skillId] = s.maxUses;
    }
  }
  return uses;
}

export function getEffectiveSkillPct(player: PlayerState, skillId: SkillId): number {
  const def = getSkillDef(skillId);
  if (def.maxUsesPerMatch !== null) {
    const remaining = player.skillUsesRemaining[skillId] ?? def.maxUsesPerMatch;
    if (remaining <= 0) return 0;
  }

  const charDef = getCharacterDef(player.characterId);

  if (def.slotCategory === 'MAIN') {
    if (charDef.mainSkill.skillId === skillId) {
      return charDef.mainSkill.procPct;
    }
    for (const tid of player.treasureIds) {
      const tr = getTreasureDef(tid);
      if (tr.mainSkill.skillId === skillId) {
        return tr.mainSkill.procPct;
      }
    }
    return 0;
  }

  // SUB SKILL: Direct additive stacking across Character's 2 subSkills + 3 Treasures' subSkills
  let sumPct = 0;
  for (const sub of charDef.subSkills) {
    if (sub.skillId === skillId) {
      sumPct += sub.procPct;
    }
  }
  for (const tid of player.treasureIds) {
    const tr = getTreasureDef(tid);
    if (tr.subSkill.skillId === skillId) {
      sumPct += tr.subSkill.procPct;
    }
  }

  return Math.min(95, sumPct);
}

// ============================================================================
// MAIN GAME ENGINE CLASS
// ============================================================================

export class GameEngine {
  private screenState: ScreenState = 'LOBBY';
  private lobbyConfig: LobbyConfig;
  private matchState: MatchState | null = null;
  private callbacks: GameEngineCallbacks;
  /** M09 Victory Horn may only fire in a tile resolution where the player built/upgraded something. */
  private builtThisResolution = false;

  constructor(callbacks: GameEngineCallbacks = {}) {
    this.callbacks = callbacks;
    this.lobbyConfig = this.createDefaultLobbyConfig();
    this.restoreFromSessionStorage();
  }

  public setCallbacks(callbacks: GameEngineCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private createDefaultLobbyConfig(): LobbyConfig {
    const defaultChars = ['CHAR_COSMO', 'CHAR_CLEO', 'CHAR_ARIA', 'CHAR_KAEL'] as const;
    const defaultTreasures: [string, string, string][] = [
      sanitizePlayerTreasures(defaultChars[0], ['TR_01_MAGNET', 'TR_03_HAMMER', 'TR_05_TICKET']),
      sanitizePlayerTreasures(defaultChars[1], ['TR_02_BLACKHOLE', 'TR_06_BLUEPRINT', 'TR_08_RADIO']),
      sanitizePlayerTreasures(defaultChars[2], ['TR_02_BLACKHOLE', 'TR_03_HAMMER', 'TR_09_HORN']),
      sanitizePlayerTreasures(defaultChars[3], ['TR_01_MAGNET', 'TR_06_BLUEPRINT', 'TR_10_ORB']),
    ];

    return {
      gameMode: 'FFA_4P',
      ffaPlayerCount: 4,
      loadoutInspectPlayerId: 'P1',
      players: {
        P1: {
          id: 'P1',
          name: 'Player 1',
          colorHex: DEFAULT_PLAYER_COLORS.P1,
          teamId: null,
          controlType: 'HUMAN',
          characterId: defaultChars[0],
          treasureIds: defaultTreasures[0],
        },
        P2: {
          id: 'P2',
          name: 'Bot Cleo',
          colorHex: DEFAULT_PLAYER_COLORS.P2,
          teamId: null,
          controlType: 'AI_BOT',
          characterId: defaultChars[1],
          treasureIds: defaultTreasures[1],
        },
        P3: {
          id: 'P3',
          name: 'Bot Aria',
          colorHex: DEFAULT_PLAYER_COLORS.P3,
          teamId: null,
          controlType: 'AI_BOT',
          characterId: defaultChars[2],
          treasureIds: defaultTreasures[2],
        },
        P4: {
          id: 'P4',
          name: 'Bot Kael',
          colorHex: DEFAULT_PLAYER_COLORS.P4,
          teamId: null,
          controlType: 'AI_BOT',
          characterId: defaultChars[3],
          treasureIds: defaultTreasures[3],
        },
      },
    };
  }

  // --------------------------------------------------------------------------
  // SESSION STORAGE PERSISTENCE
  // --------------------------------------------------------------------------

  public saveToSessionStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      const envelope: PersistedSessionEnvelope = {
        version: 1,
        screenState: this.screenState,
        lobbyConfig: this.lobbyConfig,
        matchState: this.matchState,
      };
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // Ignore storage quota or private mode errors
    }
  }

  public restoreFromSessionStorage(): boolean {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return false;
      const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<PersistedSessionEnvelope>;
      if (parsed.version !== 1 || !parsed.lobbyConfig) return false;

      this.lobbyConfig = parsed.lobbyConfig;
      if (
        this.lobbyConfig.ffaPlayerCount !== 2 &&
        this.lobbyConfig.ffaPlayerCount !== 3 &&
        this.lobbyConfig.ffaPlayerCount !== 4
      ) {
        this.lobbyConfig.ffaPlayerCount = 4;
      }
      for (const pid of PLAYER_IDS) {
        const slot = this.lobbyConfig.players[pid];
        if (slot) {
          slot.treasureIds = sanitizePlayerTreasures(slot.characterId, slot.treasureIds);
        }
      }

      if (parsed.matchState) {
        this.matchState = parsed.matchState;
      }

      if (parsed.screenState === 'IN_GAME' && !this.matchState) {
        this.screenState = 'LOBBY';
      } else if (parsed.screenState) {
        this.screenState = parsed.screenState;
      }
      return true;
    } catch {
      return false;
    }
  }

  public clearSessionStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }

  private emitStateChange(): void {
    this.saveToSessionStorage();
    this.callbacks.onStateChange?.(this);
  }

  // --------------------------------------------------------------------------
  // SCREEN & LOBBY MANAGEMENT
  // --------------------------------------------------------------------------

  public getScreenState(): ScreenState {
    return this.screenState;
  }

  public setScreenState(screen: ScreenState): void {
    this.screenState = screen;
    if (screen !== 'IN_GAME' && this.matchState) {
      this.matchState.victoryResult = null;
      this.matchState.activePrompt = null;
      this.matchState.pendingDebt = null;
    }
    this.emitStateChange();
  }

  public getLobbyConfig(): LobbyConfig {
    return this.lobbyConfig;
  }

  public getMatchState(): MatchState | null {
    return this.matchState;
  }

  public setGameMode(mode: GameMode): void {
    this.lobbyConfig.gameMode = mode;
    for (const pid of PLAYER_IDS) {
      const slot = this.lobbyConfig.players[pid];
      if (mode === 'TEAM_2V2') {
        slot.teamId = pid === 'P1' || pid === 'P3' ? 'ALPHA' : 'BRAVO';
      } else {
        slot.teamId = null;
      }
    }
    this.emitStateChange();
  }

  public setFfaPlayerCount(count: 2 | 3 | 4): void {
    this.lobbyConfig.ffaPlayerCount = count;
    const activeIds = PLAYER_IDS.slice(0, count);
    if (!activeIds.includes(this.lobbyConfig.loadoutInspectPlayerId)) {
      this.lobbyConfig.loadoutInspectPlayerId = 'P1';
    }
    this.emitStateChange();
  }

  public getFfaPlayerCount(): 2 | 3 | 4 {
    return this.lobbyConfig.ffaPlayerCount ?? 4;
  }

  public setPlayerControlType(playerId: PlayerId, controlType: ControlType): void {
    const slot = this.lobbyConfig.players[playerId];
    if (!slot) return;
    slot.controlType = controlType;
    const charDef = getCharacterDef(slot.characterId);
    if (controlType === 'AI_BOT') {
      slot.name = `Bot ${charDef.name}`;
    } else if (controlType === 'HUMAN') {
      slot.name = `Player ${playerId.slice(1)}`;
    }
    this.emitStateChange();
  }

  public setPlayerName(playerId: PlayerId, name: string): void {
    const slot = this.lobbyConfig.players[playerId];
    if (!slot) return;
    slot.name = name.trim() || `Player ${playerId.slice(1)}`;
    this.emitStateChange();
  }

  public setLoadoutInspectPlayer(playerId: PlayerId): void {
    this.lobbyConfig.loadoutInspectPlayerId = playerId;
    this.emitStateChange();
  }

  public setPlayerCharacter(playerId: PlayerId, characterId: string): void {
    const slot = this.lobbyConfig.players[playerId];
    if (!slot) return;
    const charDef = getCharacterDef(characterId);
    slot.characterId = charDef.id;
    slot.treasureIds = sanitizePlayerTreasures(charDef.id, slot.treasureIds);
    if (slot.controlType === 'AI_BOT' && slot.name.startsWith('Bot ')) {
      slot.name = `Bot ${charDef.name}`;
    }
    this.emitStateChange();
  }

  public setPlayerTreasureSlot(
    playerId: PlayerId,
    slotIndex: 0 | 1 | 2,
    treasureId: string
  ): { ok: boolean; reason?: string } {
    const slot = this.lobbyConfig.players[playerId];
    if (!slot) return { ok: false, reason: 'Invalid player' };

    if (!isTreasureValidForCharacter(slot.characterId, treasureId)) {
      return {
        ok: false,
        reason: 'ห้ามใส่สมบัติที่มีสกิลหลัก (Main Skill) ซ้ำกับสกิลหลักของตัวละคร!',
      };
    }

    const next = [...slot.treasureIds] as [string, string, string];
    const existingIdx = next.indexOf(treasureId);
    if (existingIdx !== -1 && existingIdx !== slotIndex) {
      // Swap slots if the treasure is already equipped in another slot
      const prev = next[slotIndex];
      next[slotIndex] = treasureId;
      next[existingIdx] = prev;
    } else {
      next[slotIndex] = treasureId;
    }

    slot.treasureIds = sanitizePlayerTreasures(slot.characterId, next);
    this.emitStateChange();
    return { ok: true };
  }

  public randomizePlayerLoadout(playerId: PlayerId): void {
    const slot = this.lobbyConfig.players[playerId];
    if (!slot) return;

    const randomChar =
      CHARACTER_ROSTER[Math.floor(Math.random() * CHARACTER_ROSTER.length)];
    slot.characterId = randomChar.id;
    slot.treasureIds = generateSynergisticLoadout(randomChar.id);

    if (slot.controlType === 'AI_BOT') {
      slot.name = `Bot ${randomChar.name}`;
    }

    this.emitStateChange();
  }

  public kickPlayerSlot(playerId: PlayerId): void {
    const slot = this.lobbyConfig.players[playerId];
    if (!slot) return;

    const ffaCount = this.lobbyConfig.ffaPlayerCount ?? 4;
    const targetIdx = PLAYER_IDS.indexOf(playerId);

    // In 2v2 team mode, all 4 slots must stay; kick resets slot to AI Bot
    if (this.lobbyConfig.gameMode === 'TEAM_2V2') {
      this.setPlayerControlType(playerId, 'AI_BOT');
      this.randomizePlayerLoadout(playerId);
      this.emitStateChange();
      return;
    }

    // In Single (FFA):
    // 1. If slot is currently HUMAN, kick the human and convert slot to AI_BOT
    if (slot.controlType === 'HUMAN') {
      this.setPlayerControlType(playerId, 'AI_BOT');
      this.randomizePlayerLoadout(playerId);
      this.emitStateChange();
      return;
    }

    // 2. If it's already an AI_BOT:
    // If it's the trailing active slot and we have > 2 players, close the slot (reduce count)
    if (targetIdx === ffaCount - 1 && ffaCount > 2) {
      this.setFfaPlayerCount((ffaCount - 1) as 2 | 3 | 4);
      return;
    }

    // Otherwise re-randomize bot loadout
    this.randomizePlayerLoadout(playerId);
    this.emitStateChange();
  }

  // --------------------------------------------------------------------------
  // MATCH INITIALIZATION
  // --------------------------------------------------------------------------

  public startNewMatch(): MatchState {
    const mode = this.lobbyConfig.gameMode;
    const ffaCount = this.lobbyConfig.ffaPlayerCount ?? 4;
    const activeSlotCount = mode === 'TEAM_2V2' ? 4 : ffaCount;
    const players: Record<PlayerId, PlayerState> = {} as Record<PlayerId, PlayerState>;

    for (let idx = 0; idx < PLAYER_IDS.length; idx++) {
      const pid = PLAYER_IDS[idx];
      const isSlotActive = idx < activeSlotCount;
      const slot = this.lobbyConfig.players[pid];
      const cleanTreasures = sanitizePlayerTreasures(slot.characterId, slot.treasureIds);
      const teamId: TeamId =
        mode === 'TEAM_2V2' ? (pid === 'P1' || pid === 'P3' ? 'ALPHA' : 'BRAVO') : null;

      players[pid] = {
        id: pid,
        name: slot.name,
        colorHex: slot.colorHex,
        teamId,
        controlType: slot.controlType,
        characterId: slot.characterId,
        treasureIds: cleanTreasures,
        marble: isSlotActive
          ? (MATCH_CONFIG.startingMarbleByPlayer[pid] ?? MATCH_CONFIG.startingMarble)
          : 0,
        loanUsed: false,
        isBankrupt: !isSlotActive,
        isSlotActive,
        tileIndex: isSlotActive ? 0 : -1,
        lapCount: 0,
        islandTurnsLeft: 0,
        isWaitingTravel: false,
        consecutiveDoubles: 0,
        oddEvenCharges: MATCH_CONFIG.oddEvenChargesPerMatch,
        selectedOddEven: 'NONE',
        skillUsesRemaining: createInitialSkillUsesMap(slot.characterId, cleanTreasures),
        hasAngelCard: isSlotActive,
        hasDiscountCoupon: false,
      };
    }

    const tiles: BoardTileState[] = WORLD_MAP_TILES.map((def) => ({
      index: def.index,
      ownerId: null,
      buildingLevel: BuildingLevel.NONE,
      isFestival: false,
      olympicMultiplier: 1,
      stepMultiplier: 1,
    }));

    // Pick 3 random CITY tiles for x2 Festival Cities at match start
    const cityIndices = WORLD_MAP_TILES.filter((t) => t.type === 'CITY').map((t) => t.index);
    const shuffled = [...cityIndices].sort(() => Math.random() - 0.5);
    const festivalPicked = shuffled.slice(0, MATCH_CONFIG.festivalCityCount);
    for (const idx of festivalPicked) {
      tiles[idx].isFestival = true;
    }

    const festivalNames = festivalPicked.map((i) => WORLD_MAP_TILES[i].nameTh).join(', ');

    this.matchState = {
      gameMode: mode,
      turnNumber: 1,
      maxTurns: MATCH_CONFIG.maxTurns,
      activePlayerIndex: 0,
      activePlayerId: 'P1',
      phase: 'IDLE_ROLL',
      players,
      tiles,
      blackHole: null,
      olympicTileIndex: null,
      olympicHostCount: 0,
      gaugeValue: 7.0,
      gaugeDirection: 1,
      lastDiceRoll: null,
      pendingMovePath: [],
      pendingSteppedCount: 0,
      activePrompt: null,
      boardPickReason: null,
      boardPickValidTiles: [],
      pendingBlackHoleLandmarkIndex: null,
      pendingLineTeleportLandmarkIndex: null,
      pendingOlympicIsFree: false,
      disruptMode: 'FORCE_SELL',
      pendingDebt: null,
      pendingDebtQueue: [],
      extraRollGranted: false,
      freeWorldTravelMap: { P1: false, P2: false, P3: false, P4: false },
      monopolyAlerts: [],
      actionLogs: [],
      victoryResult: null,
    };

    this.screenState = 'IN_GAME';
    this.appendLog(
      'P1',
      `🎉 เริ่มการแข่งขัน! เมืองเทศกาล x2ประจำแมตช์: ${festivalNames}`,
      'SYSTEM'
    );
    this.emitStateChange();
    return this.matchState;
  }

  public returnToLobby(): void {
    this.matchState = null;
    this.screenState = 'LOBBY';
    this.emitStateChange();
  }

  // --------------------------------------------------------------------------
  // ALLIANCE, OWNERSHIP & TOLL / COST CALCULATIONS
  // --------------------------------------------------------------------------

  public arePlayersAllied(p1: PlayerId | null, p2: PlayerId | null): boolean {
    if (!p1 || !p2) return false;
    if (p1 === p2) return true;
    if (!this.matchState || this.matchState.gameMode !== 'TEAM_2V2') return false;
    const t1 = this.matchState.players[p1]?.teamId;
    const t2 = this.matchState.players[p2]?.teamId;
    return Boolean(t1 && t1 === t2);
  }

  public isColorGroupMonopoly(group: number | null, ownerId: PlayerId | null): boolean {
    if (!this.matchState || group === null || !ownerId) return false;
    const groupTiles = COLOR_GROUP_TILES[group];
    if (!groupTiles) return false;
    return groupTiles.every((idx) =>
      this.arePlayersAllied(ownerId, this.matchState!.tiles[idx].ownerId)
    );
  }

  public countOwnedTourismIslands(ownerId: PlayerId | null): number {
    if (!this.matchState || !ownerId) return 0;
    return TOURISM_TILE_INDICES.filter((idx) =>
      this.arePlayersAllied(ownerId, this.matchState!.tiles[idx].ownerId)
    ).length;
  }

  public getOwnedTourismIslandIndices(ownerId: PlayerId | null): number[] {
    if (!this.matchState || !ownerId) return [];
    return TOURISM_TILE_INDICES.filter((idx) =>
      this.arePlayersAllied(ownerId, this.matchState!.tiles[idx].ownerId)
    );
  }

  public getTourismCounts(ownerId: PlayerId | null): { blueCount: number; redCount: number; totalCount: number } {
    const owned = this.getOwnedTourismIslandIndices(ownerId);
    const blueCount = owned.filter((idx) => BLUE_TOURISM_INDICES.includes(idx)).length;
    const redCount = owned.filter((idx) => RED_TOURISM_INDICES.includes(idx)).length;
    return { blueCount, redCount, totalCount: owned.length };
  }

  public calculateTilePropertyValue(tileIndex: number): number {
    if (!this.matchState) return 0;
    const tile = this.matchState.tiles[tileIndex];
    const def = WORLD_MAP_TILES[tileIndex];
    if (!tile || !def || !tile.ownerId || tile.buildingLevel === BuildingLevel.NONE) return 0;
    if (def.type === 'TOURISM') {
      return def.baseCost;
    }
    const mult = MATCH_CONFIG.buildingCostMultipliers[tile.buildingLevel] ?? 1;
    return Math.round(def.baseCost * mult);
  }

  public calculateTileSellRefund(tileIndex: number): number {
    return Math.round(this.calculateTilePropertyValue(tileIndex) * MATCH_CONFIG.citySellRefundRate);
  }

  public calculateBuildCost(
    playerId: PlayerId,
    tileIndex: number,
    fromLevel: BuildingLevel,
    targetLevel: BuildingLevel
  ): number {
    if (!this.matchState || targetLevel <= fromLevel) return 0;
    const player = this.matchState.players[playerId];
    const def = WORLD_MAP_TILES[tileIndex];
    if (!player || !def) return 0;

    const stats = computePlayerStats(player.characterId, player.treasureIds);
    const fromMult = MATCH_CONFIG.buildingCostMultipliers[fromLevel] ?? 0;
    const toMult = MATCH_CONFIG.buildingCostMultipliers[targetLevel] ?? 1;
    const rawCost = def.baseCost * Math.max(0, toMult - fromMult);
    return Math.round(rawCost * (1 - stats.constDiscountPct / 100));
  }

  public calculateTakeoverCost(buyerId: PlayerId, tileIndex: number): number {
    if (!this.matchState) return 0;
    const buyer = this.matchState.players[buyerId];
    const propVal = this.calculateTilePropertyValue(tileIndex);
    if (!buyer || propVal <= 0) return 0;
    const stats = computePlayerStats(buyer.characterId, buyer.treasureIds);
    const rawTakeover = propVal * MATCH_CONFIG.takeoverCostMultiplier;
    return Math.round(rawTakeover * (1 - stats.acqDiscountPct / 100));
  }

  public calculateTollBreakdown(
    tileIndex: number,
    visitorId?: PlayerId
  ): {
    baseLevelToll: number;
    festivalMult: number;
    colorMonoMult: number;
    olympicMult: number;
    stepMult: number;
    lateGameMult: number;
    rawToll: number;
    tollDiscountPct: number;
    netToll: number;
  } {
    if (!this.matchState) {
      return {
        baseLevelToll: 0,
        festivalMult: 1,
        colorMonoMult: 1,
        olympicMult: 1,
        stepMult: 1,
        lateGameMult: 1,
        rawToll: 0,
        tollDiscountPct: 0,
        netToll: 0,
      };
    }

    const tile = this.matchState.tiles[tileIndex];
    const def = WORLD_MAP_TILES[tileIndex];
    if (!tile || !def || !tile.ownerId || tile.buildingLevel === BuildingLevel.NONE || tile.isBlackout) {
      return {
        baseLevelToll: 0,
        festivalMult: 1,
        colorMonoMult: 1,
        olympicMult: 1,
        stepMult: 1,
        lateGameMult: 1,
        rawToll: 0,
        tollDiscountPct: 0,
        netToll: 0,
      };
    }

    let baseLevelToll = 0;
    if (def.type === 'TOURISM') {
      const ownedIndices = this.getOwnedTourismIslandIndices(tile.ownerId);
      const scale = getTourismMultiplierForTile(tileIndex, ownedIndices);
      baseLevelToll = def.baseToll * scale;
    } else {
      const mult = MATCH_CONFIG.buildingTollMultipliers[tile.buildingLevel] ?? 1;
      baseLevelToll = def.baseToll * mult;
    }

    const festivalMult = tile.isFestival ? MATCH_CONFIG.festivalTollMultiplier : 1;
    const colorMonoMult =
      def.type === 'CITY' && this.isColorGroupMonopoly(def.group, tile.ownerId)
        ? MATCH_CONFIG.colorMonopolyTollMultiplier
        : 1;
    const olympicMult = Math.max(1, tile.olympicMultiplier);
    const stepMult = Math.max(1, tile.stepMultiplier);
    const lateGameMult =
      this.matchState.turnNumber >= MATCH_CONFIG.lateGameTurnThreshold
        ? MATCH_CONFIG.lateGameTollMultiplier
        : 1;

    const rawToll = Math.round(
      baseLevelToll * festivalMult * colorMonoMult * olympicMult * stepMult * lateGameMult
    );

    let tollDiscountPct = 0;
    if (visitorId && !this.arePlayersAllied(visitorId, tile.ownerId)) {
      const visitor = this.matchState.players[visitorId];
      if (visitor) {
        tollDiscountPct = computePlayerStats(
          visitor.characterId,
          visitor.treasureIds
        ).tollDiscountPct;
      }
    }

    const netToll = Math.round(rawToll * (1 - tollDiscountPct / 100));
    return {
      baseLevelToll,
      festivalMult,
      colorMonoMult,
      olympicMult,
      stepMult,
      lateGameMult,
      rawToll,
      tollDiscountPct,
      netToll,
    };
  }

  public calculatePlayerTotalAssets(playerId: PlayerId): number {
    if (!this.matchState) return 0;
    const player = this.matchState.players[playerId];
    if (!player || player.isBankrupt) return 0;
    let propSum = 0;
    for (const tile of this.matchState.tiles) {
      if (tile.ownerId === playerId) {
        propSum += this.calculateTilePropertyValue(tile.index);
      }
    }
    return player.marble + propSum;
  }

  // --------------------------------------------------------------------------
  // SKILL TRIGGER RESOLVER
  // --------------------------------------------------------------------------

  private tryTriggerSkill(player: PlayerState, skillId: SkillId): boolean {
    if (!this.matchState || player.isBankrupt) return false;
    const pct = getEffectiveSkillPct(player, skillId);
    if (pct <= 0) return false;

    const roll = Math.random() * 100;
    if (roll >= pct) return false;

    const def = getSkillDef(skillId);
    if (def.maxUsesPerMatch !== null) {
      const cur = player.skillUsesRemaining[skillId] ?? def.maxUsesPerMatch;
      player.skillUsesRemaining[skillId] = Math.max(0, cur - 1);
    }

    const message = `⚡ ${player.name} ใช้สกิล: ${def.name} (${pct}%)!`;
    this.appendLog(player.id, message, 'SKILL');
    this.callbacks.onSkillBanner?.({
      playerId: player.id,
      playerName: player.name,
      skillId,
      skillName: def.name,
      procPct: pct,
      message,
    });

    return true;
  }

  private appendLog(
    playerId: PlayerId,
    message: string,
    category: ActionLogEntry['category']
  ): void {
    if (!this.matchState) return;
    const entry: ActionLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      turnNumber: this.matchState.turnNumber,
      playerId,
      message,
      category,
      timestamp: Date.now(),
    };
    this.matchState.actionLogs.unshift(entry);
    if (this.matchState.actionLogs.length > 60) {
      this.matchState.actionLogs.length = 60;
    }
    this.callbacks.onActionLog?.(entry);
  }

  // --------------------------------------------------------------------------
  // TURN CONTROLS: ODD/EVEN, ISLAND BAIL, GAUGE & DICE ROLL
  // --------------------------------------------------------------------------

  public toggleOddEvenMode(mode: OddEvenMode): void {
    if (!this.matchState) return;
    if (this.matchState.phase !== 'IDLE_ROLL' && this.matchState.phase !== 'GAUGE_CHARGING') return;
    const player = this.matchState.players[this.matchState.activePlayerId];
    if (!player) return;

    if (mode !== 'NONE' && player.oddEvenCharges <= 0) {
      this.callbacks.onToastBanner?.('สิทธิ์ใช้ลูกเต๋า คู่/คี่ (ODD/EVEN) หมดแล้ว!', '#DC2626');
      return;
    }

    player.selectedOddEven = player.selectedOddEven === mode ? 'NONE' : mode;
    this.emitStateChange();
  }

  public payDesertIslandBail(): boolean {
    if (!this.matchState || this.matchState.phase !== 'IDLE_ROLL') return false;
    const player = this.matchState.players[this.matchState.activePlayerId];
    if (!player || player.islandTurnsLeft <= 0) return false;
    if (player.marble < MATCH_CONFIG.desertIslandBailCost) {
      this.callbacks.onToastBanner?.('เงิน Marble ไม่พอจ่ายค่าประกันตัวออกจากเกาะร้าง!', '#DC2626');
      return false;
    }

    player.marble -= MATCH_CONFIG.desertIslandBailCost;
    player.islandTurnsLeft = 0;
    this.appendLog(
      player.id,
      `💸 ${player.name} จ่ายค่าประกันตัว ${formatMarbleCompact(MATCH_CONFIG.desertIslandBailCost)} ออกจากเกาะร้าง!`,
      'MOVE'
    );
    this.callbacks.onFloatingText?.({
      tileIndex: player.tileIndex,
      text: `-${formatMarbleCompact(MATCH_CONFIG.desertIslandBailCost)} ประกันตัว`,
      colorHex: '#DC2626',
    });
    this.emitStateChange();
    return true;
  }

  public startGaugeCharge(): void {
    if (!this.matchState || this.matchState.phase !== 'IDLE_ROLL') return;
    const player = this.matchState.players[this.matchState.activePlayerId];
    if (!player) return;

    // If waiting at Sky Terminal (Tile 24), open World Travel destination picker instead of rolling
    if (player.isWaitingTravel) {
      this.openWorldTravelPicker(player);
      return;
    }

    this.matchState.phase = 'GAUGE_CHARGING';
    this.matchState.gaugeValue = 2.0;
    this.matchState.gaugeDirection = 1;
    this.emitStateChange();
  }

  public updateGauge(dtSeconds: number): number {
    if (!this.matchState || this.matchState.phase !== 'GAUGE_CHARGING') {
      return this.matchState?.gaugeValue ?? 7.0;
    }
    const player = this.matchState.players[this.matchState.activePlayerId];
    const stats = computePlayerStats(player.characterId, player.treasureIds);
    const speed = stats.gaugeSpeed; // 9.5 * (1 - 0.018 * dcLevel)

    let next = this.matchState.gaugeValue + this.matchState.gaugeDirection * speed * dtSeconds;
    if (next >= 12.0) {
      next = 12.0 - (next - 12.0);
      this.matchState.gaugeDirection = -1;
    } else if (next <= 2.0) {
      next = 2.0 + (2.0 - next);
      this.matchState.gaugeDirection = 1;
    }
    this.matchState.gaugeValue = Math.max(2.0, Math.min(12.0, next));
    return this.matchState.gaugeValue;
  }

  public releaseGaugeRoll(overrideGaugeValue?: number): DiceRollResult | null {
    if (!this.matchState) return null;
    if (this.matchState.phase !== 'GAUGE_CHARGING' && this.matchState.phase !== 'IDLE_ROLL') {
      return null;
    }

    const player = this.matchState.players[this.matchState.activePlayerId];
    if (player.isWaitingTravel) {
      this.openWorldTravelPicker(player);
      return null;
    }

    if (typeof overrideGaugeValue === 'number' && !Number.isNaN(overrideGaugeValue)) {
      this.matchState.gaugeValue = Math.max(2.0, Math.min(12.0, overrideGaugeValue));
    }

    const rollResult = this.resolveTwoStageDiceRoll(player, this.matchState.gaugeValue);
    this.matchState.lastDiceRoll = rollResult;
    this.matchState.phase = 'DICE_ANIMATING';
    this.matchState.extraRollGranted = false;

    const dblTag = rollResult.isDouble ? ' (DOUBLE!)' : '';
    const dcTag = rollResult.dcTriggered ? ' 🎯[คุมเต๋าแม่นยำ!]' : '';
    this.appendLog(
      player.id,
      `🎲 ${player.name} ทอยได้ ${rollResult.die1} + ${rollResult.die2} = ${rollResult.sum}${dblTag}${dcTag}`,
      'DICE'
    );

    if (rollResult.dcTriggered) {
      this.callbacks.onToastBanner?.(
        `🎯 ${player.name} คุมเต๋าทำงาน! ออก ${rollResult.sum} เป๊ะ (${rollResult.dcProcPct}%)`,
        player.colorHex
      );
    }

    this.emitStateChange();
    return rollResult;
  }

  private resolveTwoStageDiceRoll(player: PlayerState, rawGauge: number): DiceRollResult {
    const g = Math.max(2.0, Math.min(12.0, rawGauge));
    const targetSum = Math.round(g);
    const stats = computePlayerStats(player.characterId, player.treasureIds);
    const oddEvenUsed = player.selectedOddEven;

    // Consume ODD/EVEN charge if active
    if (oddEvenUsed !== 'NONE' && player.oddEvenCharges > 0) {
      player.oddEvenCharges -= 1;
    }
    player.selectedOddEven = 'NONE';

    const targetCompatible =
      oddEvenUsed === 'NONE' ||
      (oddEvenUsed === 'EVEN' && targetSum % 2 === 0) ||
      (oddEvenUsed === 'ODD' && targetSum % 2 !== 0);

    // Stage 1: Determine Sum (2..12)
    const dcTriggered = targetCompatible && Math.random() * 100 < stats.dcProcPct;
    let sum = targetSum;

    if (!dcTriggered) {
      const table =
        oddEvenUsed === 'EVEN'
          ? DICE_TABLE_EVEN
          : oddEvenUsed === 'ODD'
          ? DICE_TABLE_ODD
          : DICE_TABLE_NONE;

      const low = Math.max(2, Math.min(12, Math.floor(g)));
      const high = Math.max(2, Math.min(12, Math.ceil(g)));
      const t = g - low;

      const rowLow = table[low];
      const rowHigh = table[high];
      const weights: number[] = [];
      let totalWeight = 0;

      for (let i = 0; i < 11; i++) {
        const w = (1 - t) * rowLow[i] + t * rowHigh[i];
        weights.push(w);
        totalWeight += w;
      }

      let pick = Math.random() * totalWeight;
      sum = 7;
      for (let i = 0; i < 11; i++) {
        pick -= weights[i];
        if (pick <= 0) {
          sum = i + 2;
          break;
        }
      }
    }

    // Stage 2: Universal Double Check + Hook 1 (S10_DOUBLE_BOOST)
    const doubleBoostPct = getEffectiveSkillPct(player, 'S10_DOUBLE_BOOST');
    let isDouble = false;
    let die1 = 1;
    let die2 = 1;

    if (sum === 2) {
      isDouble = true;
      die1 = 1;
      die2 = 1;
    } else if (sum === 12) {
      isDouble = true;
      die1 = 6;
      die2 = 6;
    } else if (sum % 2 !== 0) {
      isDouble = false;
      const pairs = NON_DOUBLE_DIE_PAIRS[sum];
      const chosen = pairs[Math.floor(Math.random() * pairs.length)];
      die1 = chosen[0];
      die2 = chosen[1];
    } else {
      // Even sum in {4, 6, 8, 10}
      const baseDoublePct = UNIVERSAL_DOUBLE_PROB_PCT[sum - 2] ?? 0;
      const effectiveDoublePct = Math.min(95, baseDoublePct + doubleBoostPct);
      isDouble = Math.random() * 100 < effectiveDoublePct;
      if (isDouble) {
        die1 = sum / 2;
        die2 = sum / 2;
      } else {
        const pairs = NON_DOUBLE_DIE_PAIRS[sum];
        const chosen = pairs[Math.floor(Math.random() * pairs.length)];
        die1 = chosen[0];
        die2 = chosen[1];
      }
    }

    return {
      playerId: player.id,
      gaugeValue: g,
      targetSum,
      die1,
      die2,
      sum,
      isDouble,
      dcTriggered,
      dcProcPct: stats.dcProcPct,
      oddEvenUsed,
      doubleBoostPct,
    };
  }

  // --------------------------------------------------------------------------
  // POST-DICE ANIMATION -> MOVEMENT & STEP HOOKS
  // --------------------------------------------------------------------------

  public completeDiceAnimation(): void {
    if (!this.matchState || this.matchState.phase !== 'DICE_ANIMATING') return;
    const roll = this.matchState.lastDiceRoll;
    const player = this.matchState.players[this.matchState.activePlayerId];
    if (!roll || !player) return;

    // Case 1: Player is currently trapped on Desert Island (islandTurnsLeft > 0)
    if (player.islandTurnsLeft > 0) {
      if (roll.isDouble) {
        player.islandTurnsLeft = 0;
        player.consecutiveDoubles = 0;
        this.appendLog(
          player.id,
          `🔓 ${player.name} ทอยออกเบิ้ล (${roll.die1}+${roll.die2}) หนีออกจากเกาะร้างสำเร็จ!`,
          'MOVE'
        );
        this.callbacks.onToastBanner?.(
          `🔓 ${player.name} ทอยเบิ้ลหนีออกจากเกาะร้างสำเร็จ!`,
          '#16A34A'
        );
        // Move forward by roll.sum without granting extra double turn
        this.startForwardMovement(player, roll.sum, false);
        return;
      } else {
        player.islandTurnsLeft = Math.max(0, player.islandTurnsLeft - 1);
        this.appendLog(
          player.id,
          `🏝️ ${player.name} ทอยไม่เบิ้ล ติดเกาะร้างต่อ (เหลือ ${player.islandTurnsLeft} เทิร์น)`,
          'MOVE'
        );
        this.callbacks.onToastBanner?.(
          `🏝️ ทอยไม่เบิ้ล! ${player.name} ติดเกาะร้าง (เหลือ ${player.islandTurnsLeft} เทิร์น)`,
          '#D97706'
        );
        this.finishTurnOrExtraRoll();
        return;
      }
    }

    // Case 2: Normal Roll — Check Consecutive Doubles & Hook 2 (S04_TRIPLE_DBL_FLY)
    if (roll.isDouble) {
      player.consecutiveDoubles += 1;
      if (player.consecutiveDoubles >= MATCH_CONFIG.maxConsecutiveDoublesBeforeIsland) {
        // Hook 2: ON_THIRD_CONSECUTIVE_DOUBLE -> S04_TRIPLE_DBL_FLY
        if (this.tryTriggerSkill(player, 'S04_TRIPLE_DBL_FLY')) {
          player.consecutiveDoubles = 0;
          this.matchState.extraRollGranted = false;
          this.warpPlayerToSkyTerminal(player, true);
          this.finishTurnOrExtraRoll();
          return;
        }

        // Otherwise sent to Desert Island (Tile 8)
        this.appendLog(
          player.id,
          `🚨 ${player.name} ทอยเบิ้ล 3 ครั้งติด! ถูกส่งไปเกาะร้างทันที!`,
          'MOVE'
        );
        this.callbacks.onToastBanner?.(
          `🚨 ทอยเบิ้ล 3 ครั้งติด! ${player.name} ถูกส่งเข้าเกาะร้าง!`,
          '#DC2626'
        );
        this.sendPlayerToDesertIsland(player);
        return;
      }
      this.matchState.extraRollGranted = true;
    } else {
      player.consecutiveDoubles = 0;
      this.matchState.extraRollGranted = false;
    }

    this.startForwardMovement(player, roll.sum, roll.isDouble);
  }

  private startForwardMovement(player: PlayerState, steps: number, _isDouble: boolean): void {
    if (!this.matchState) return;
    const path: number[] = [];
    let cur = player.tileIndex;
    for (let s = 1; s <= steps; s++) {
      cur = (cur + 1) % MATCH_CONFIG.boardSize;
      path.push(cur);
    }

    this.matchState.pendingMovePath = path;
    this.matchState.pendingSteppedCount = 0;
    this.matchState.phase = 'PIECE_MOVING';
    this.emitStateChange();
  }

  /**
   * Called on each hop step (either by IsoBoard3DRenderer's onStepCallback or automatically
   * inside completePieceMovement if any steps remain).
   * Handles:
   * - Passing/Landing on START (Tile 0) -> +1 Lap & Salary
   * - S01_PERFUME_STEAL -> Steals 7% cash from any enemy on that step's tile!
   */
  public advancePieceStep(stepTileIndex?: number): void {
    if (!this.matchState || this.matchState.phase !== 'PIECE_MOVING') return;
    const path = this.matchState.pendingMovePath;
    if (this.matchState.pendingSteppedCount >= path.length) return;

    const expectedIdx = path[this.matchState.pendingSteppedCount];
    const tileIdx = typeof stepTileIndex === 'number' ? stepTileIndex : expectedIdx;

    const mover = this.matchState.players[this.matchState.activePlayerId];
    if (!mover) return;

    this.matchState.pendingSteppedCount += 1;
    mover.tileIndex = tileIdx;

    // 1. Check START (Tile 0) Salary & Lap Increment
    if (tileIdx === 0) {
      this.awardStartSalary(mover);
    }

    // 2. Check Perfume Steal (M06_SUPER_PERFUME 7% + S01_PERFUME_STEAL 3% - Stackable!)
    const enemiesOnTile = PLAYER_IDS.map((pid) => this.matchState!.players[pid]).filter(
      (other) =>
        !other.isBankrupt &&
        other.id !== mover.id &&
        !this.arePlayersAllied(mover.id, other.id) &&
        other.tileIndex === tileIdx &&
        other.marble > 0
    );

    if (enemiesOnTile.length > 0) {
      let combinedRate = 0;
      const triggeredNames: string[] = [];
      if (this.tryTriggerSkill(mover, 'M06_SUPER_PERFUME')) {
        const charDef = getCharacterDef(mover.characterId);
        const charHasSuperPerfume = charDef.mainSkill.skillId === 'M06_SUPER_PERFUME';
        const treasureHasSuperPerfume = mover.treasureIds.some((tid) => {
          const tr = getTreasureDef(tid);
          return tr.mainSkill.skillId === 'M06_SUPER_PERFUME';
        });

        let superRate = 0;
        let rateLabel = '';
        if (charHasSuperPerfume && treasureHasSuperPerfume) {
          // If stacked: add cash steal percentage (12% + 7% = 19%), trigger proc chance stays identical
          superRate = MATCH_CONFIG.perfumeCharStealRate + MATCH_CONFIG.perfumeTreasureStealRate;
          rateLabel = `น้ำหอมมหาเสน่ห์ (ซ้อนทับ ${Math.round(superRate * 100)}%)`;
        } else if (charHasSuperPerfume) {
          superRate = MATCH_CONFIG.perfumeCharStealRate; // 12%
          rateLabel = `น้ำหอมมหาเสน่ห์ (${Math.round(superRate * 100)}%)`;
        } else {
          superRate = MATCH_CONFIG.perfumeTreasureStealRate; // 7%
          rateLabel = `น้ำหอมมหาเสน่ห์ (${Math.round(superRate * 100)}%)`;
        }

        combinedRate += superRate;
        triggeredNames.push(rateLabel);
      }
      if (this.tryTriggerSkill(mover, 'S01_PERFUME_STEAL')) {
        combinedRate += MATCH_CONFIG.perfumeSubStealRate; // 3%
        triggeredNames.push('น้ำหอมหลากสี (3%)');
      }

      if (combinedRate > 0) {
        const ratePct = Math.round(combinedRate * 100);
        let totalStolen = 0;
        for (const enemy of enemiesOnTile) {
          const stolen = Math.round(enemy.marble * combinedRate);
          if (stolen > 0) {
            enemy.marble -= stolen;
            mover.marble += stolen;
            totalStolen += stolen;
            this.callbacks.onPerfumeSteal?.({
              stealerId: mover.id,
              victimId: enemy.id,
              amount: stolen,
              tileIndex: tileIdx,
              ratePct,
            });
          }
        }
        if (totalStolen > 0) {
          const label = triggeredNames.join(' + ');
          this.appendLog(
            mover.id,
            `🌸 ${mover.name} ใช้${label} ดูดเงินสด ${formatMarbleCompact(totalStolen)} (${ratePct}%) จากศัตรู!`,
            'SKILL'
          );
          this.callbacks.onFloatingText?.({
            tileIndex: tileIdx,
            text: `+${formatMarbleCompact(totalStolen)} น้ำหอม ${ratePct}%!`,
            colorHex: '#EC4899',
          });
        }
      }
    }

    this.emitStateChange();
  }

  public completePieceMovement(): void {
    if (!this.matchState || this.matchState.phase !== 'PIECE_MOVING') return;

    // Process any steps that haven't been stepped yet
    while (this.matchState.pendingSteppedCount < this.matchState.pendingMovePath.length) {
      this.advancePieceStep();
    }

    const mover = this.matchState.players[this.matchState.activePlayerId];
    this.matchState.pendingMovePath = [];
    this.matchState.pendingSteppedCount = 0;
    this.matchState.phase = 'TILE_RESOLUTION';

    this.resolveLandedTile(mover, mover.tileIndex, false);
  }

  private awardStartSalary(player: PlayerState): void {
    if (!this.matchState) return;
    player.lapCount += 1;
    const stats = computePlayerStats(player.characterId, player.treasureIds);
    const salary = Math.round(MATCH_CONFIG.salaryAmount * (1 + stats.salBonusPct / 100));
    player.marble += salary;

    this.appendLog(
      player.id,
      `💰 ${player.name} ผ่านจุด START (รอบที่ ${player.lapCount + 1}) รับเงินเดือน +${formatMarbleCompact(salary)}!`,
      'MOVE'
    );
    this.callbacks.onFloatingText?.({
      tileIndex: 0,
      text: `+${formatMarbleCompact(salary)} SALARY!`,
      colorHex: '#16A34A',
    });
  }

  // --------------------------------------------------------------------------
  // TILE RESOLUTION & ALL 12 LIFECYCLE HOOKS
  // --------------------------------------------------------------------------

  private resolveLandedTile(
    mover: PlayerState,
    tileIndex: number,
    isFromBlackHoleOrGuidebook: boolean
  ): void {
    if (!this.matchState || mover.isBankrupt) return;
    mover.tileIndex = tileIndex;

    // 1. Check Black Hole Warp first (if player landed on blackTileIndex during normal movement)
    if (
      !isFromBlackHoleOrGuidebook &&
      this.matchState.blackHole &&
      // Hits EVERYONE incl. the owner (by design: owner can use it as a shortcut back to their Landmark)
      this.matchState.blackHole.blackTileIndex === tileIndex
    ) {
      const bh = this.matchState.blackHole;
      const whiteIdx = bh.whiteTileIndex;
      const lmName = WORLD_MAP_TILES[whiteIdx].nameTh;
      this.matchState.blackHole = null; // Single Black Hole disappears after sucking 1 player in

      this.appendLog(
        mover.id,
        `🌀 ${mover.name} ถูกดูดเข้าหลุมดำ! วาร์ปไปที่แลนด์มาร์ก ${lmName}!`,
        'SKILL'
      );
      this.callbacks.onToastBanner?.(
        `🌀 ${mover.name} ถูกดูดเข้าหลุมดำ! วาร์ปไปที่ ${lmName}!`,
        '#7C3AED'
      );
      mover.tileIndex = whiteIdx;
      this.resolveLandedTile(mover, whiteIdx, true);
      return;
    }

    // 2. Hook 4: ON_LAND_WITH_PLAYERS (Standing enemies check S02_SHERIFF_TAX & M07_WRONG_GUIDEBOOK)
    if (!isFromBlackHoleOrGuidebook) {
      const standingEnemies = PLAYER_IDS.map((pid) => this.matchState!.players[pid]).filter(
        (other) =>
          !other.isBankrupt &&
          other.id !== mover.id &&
          !this.arePlayersAllied(mover.id, other.id) &&
          other.tileIndex === tileIndex
      );

      for (const defender of standingEnemies) {
        // Defender checks S02_SHERIFF_TAX (steals 20% of mover's cash)
        if (mover.marble > 0 && this.tryTriggerSkill(defender, 'S02_SHERIFF_TAX')) {
          const tax = Math.round(mover.marble * MATCH_CONFIG.sheriffTaxRate);
          if (tax > 0) {
            mover.marble -= tax;
            defender.marble += tax;
            this.appendLog(
              defender.id,
              `🤠 ${defender.name} ใช้ตรานายอำเภอ เก็บภาษี ${formatMarbleCompact(tax)} (20%) จาก ${mover.name}!`,
              'SKILL'
            );
            this.callbacks.onFloatingText?.({
              tileIndex,
              text: `-${formatMarbleCompact(tax)} ตรานายอำเภอ 20%!`,
              colorHex: '#D97706',
            });
          }
        }

        // Defender checks M07_WRONG_GUIDEBOOK (send mover to defender's highest-toll Landmark)
        const defenderLandmarks = this.matchState.tiles.filter(
          (t) =>
            this.arePlayersAllied(defender.id, t.ownerId) &&
            t.buildingLevel === BuildingLevel.LANDMARK
        );
        if (defenderLandmarks.length > 0 && this.tryTriggerSkill(defender, 'M07_WRONG_GUIDEBOOK')) {
          let bestLm = defenderLandmarks[0];
          let bestToll = -1;
          for (const lm of defenderLandmarks) {
            const toll = this.calculateTollBreakdown(lm.index, mover.id).netToll;
            if (toll > bestToll) {
              bestToll = toll;
              bestLm = lm;
            }
          }
          const lmDef = WORLD_MAP_TILES[bestLm.index];
          this.appendLog(
            defender.id,
            `📕 ${defender.name} ใช้ไกด์บุ๊กผิดพลาด! ส่ง ${mover.name} ไปยังแลนด์มาร์ก ${lmDef.nameTh}!`,
            'SKILL'
          );
          mover.tileIndex = bestLm.index;
          this.resolveLandedTile(mover, bestLm.index, true);
          return;
        }
      }
    }

    const tile = this.matchState.tiles[tileIndex];
    const def = WORLD_MAP_TILES[tileIndex];

    switch (def.type) {
      case 'START': {
        // Landing directly on START allows upgrading any 1 owned/teammate city by +1 level
        this.openStartUpgradePicker(mover);
        return;
      }

      case 'DESERT_ISLAND': {
        this.sendPlayerToDesertIsland(mover);
        return;
      }

      case 'OLYMPIC': {
        this.openOlympicCityPicker(mover, false);
        return;
      }

      case 'WORLD_TRAVEL': {
        this.enterSkyTerminalTile(mover, false);
        this.finishTileResolution();
        return;
      }

      case 'BONUS_GAME': {
        this.startBonusCoinGame(mover);
        return;
      }

      case 'CHANCE': {
        this.resolveChanceTile(mover);
        return;
      }

      case 'TAX_AUDIT': {
        this.resolveTaxAuditTile(mover);
        return;
      }

      case 'CITY':
      case 'TOURISM': {
        this.resolvePropertyTile(mover, tile, def);
        return;
      }
    }
  }

  // --------------------------------------------------------------------------
  // PROPERTY TILE RESOLUTION (UNOWNED, OWN/ALLY, OR ENEMY)
  // --------------------------------------------------------------------------

  private resolvePropertyTile(
    mover: PlayerState,
    tile: BoardTileState,
    def: WorldTileDef
  ): void {
    if (!this.matchState) return;

    // 1. Unowned City or Tourism Island
    if (tile.ownerId === null) {
      this.openBuyOrUpgradePrompt(mover, tile.index, false);
      return;
    }

    // 2. Owned by Self or Teammate (2v2)
    if (this.arePlayersAllied(mover.id, tile.ownerId)) {
      if (tile.isBlackout) {
        tile.isBlackout = false;
        this.appendLog(mover.id, `💡 ${mover.name} กู้คืนระบบไฟที่ ${def.nameTh} สำเร็จ!`, 'MOVE');
      }
      if (def.type === 'TOURISM') {
        this.appendLog(mover.id, `🏝️ ${mover.name} แวะพักผ่อนที่ ${def.nameTh} ของทีมตัวเอง`, 'MOVE');
        this.finishTileResolution();
        return;
      }

      if (tile.buildingLevel === BuildingLevel.LANDMARK) {
        // Hook 9: ON_VISIT_OWN_LANDMARK
        this.triggerOwnLandmarkHooks(mover, tile.index, false);
        return;
      }

      // Can upgrade own/teammate city (HOTEL unlocks LANDMARK!)
      this.openBuyOrUpgradePrompt(mover, tile.index, false);
      return;
    }

    // 3. Owned by Enemy -> Pay Toll + Optional Takeover
    const owner = this.matchState.players[tile.ownerId];
    if (!owner || owner.isBankrupt) {
      this.openBuyOrUpgradePrompt(mover, tile.index, false);
      return;
    }

    // Check Power Outage (Blackout) on enemy city!
    if (tile.isBlackout) {
      tile.isBlackout = false;
      this.appendLog(
        mover.id,
        `🔌 ${def.nameTh} ไฟดับอยู่! ${mover.name} ไม่ต้องเสียค่าผ่านทาง (และไฟกลับมาติดแล้ว)!`,
        'TOLL'
      );
      this.callbacks.onFloatingText?.({
        tileIndex: tile.index,
        text: `🔌 ไฟดับ! ฟรี 0 M`,
        colorHex: '#38BDF8',
      });
      this.proceedAfterEnemyTollPaid(mover, tile, def, 0);
      return;
    }

    const breakdown = this.calculateTollBreakdown(tile.index, mover.id);
    let payableToll = breakdown.netToll;

    // Hook 5: ON_BEFORE_PAY_TOLL -> S07_BLACK_CARD (100% Toll Exemption Once)
    if (payableToll > 0 && this.tryTriggerSkill(mover, 'S07_BLACK_CARD')) {
      payableToll = 0;
      this.appendLog(
        mover.id,
        `💳 ${mover.name} ใช้บัตรเครดิตดำ! ยกเว้นค่าผ่านทางที่ ${def.nameTh} 100%!`,
        'SKILL'
      );
      this.callbacks.onFloatingText?.({
        tileIndex: tile.index,
        text: `FREE! บัตรดำ 100%`,
        colorHex: '#E5A93B',
      });
      this.proceedAfterEnemyTollPaid(mover, tile, def, 0);
      return;
    }

    // Check Held Angel Shield Card (100% Toll Exemption from Chance Card)
    if (payableToll > 0 && mover.hasAngelCard) {
      mover.hasAngelCard = false;
      payableToll = 0;
      this.callbacks.onAngelCardUsed?.({
        playerId: mover.id,
        tileIndex: tile.index,
        targetName: def.nameTh,
        reason: 'TOLL',
      });
      this.appendLog(
        mover.id,
        `👼 ${mover.name} ใช้การ์ดนางฟ้า! ยกเว้นค่าผ่านทางที่ ${def.nameTh} 100%!`,
        'TOLL'
      );
      this.callbacks.onFloatingText?.({
        tileIndex: tile.index,
        text: `👼 นางฟ้า! ฟรี 100%`,
        colorHex: '#FDE047',
      });
      this.proceedAfterEnemyTollPaid(mover, tile, def, 0);
      return;
    }

    // Check Held Discount Coupon Card (-50% Toll from Chance Card)
    if (payableToll > 0 && mover.hasDiscountCoupon) {
      mover.hasDiscountCoupon = false;
      payableToll = Math.round(payableToll * 0.5);
      this.appendLog(
        mover.id,
        `🎟️ ${mover.name} ใช้คูปองลดค่าผ่านทาง 50% ที่ ${def.nameTh} (เหลือ ${formatMarbleCompact(payableToll)})!`,
        'TOLL'
      );
      this.callbacks.onFloatingText?.({
        tileIndex: tile.index,
        text: `🎟️ ลด 50%!`,
        colorHex: '#38BDF8',
      });
    }

    const allowTakeover =
      def.type === 'CITY' &&
      tile.buildingLevel >= BuildingLevel.LAND &&
      tile.buildingLevel <= BuildingLevel.HOTEL;

    if (mover.marble >= payableToll) {
      mover.marble -= payableToll;
      owner.marble += payableToll;
      this.appendLog(
        mover.id,
        `💸 ${mover.name} จ่ายค่าผ่านทาง ${formatMarbleCompact(payableToll)} ให้ ${owner.name} ที่ ${def.nameTh}`,
        'TOLL'
      );
      this.callbacks.onFloatingText?.({
        tileIndex: tile.index,
        text: `-${formatMarbleCompact(payableToll)}`,
        colorHex: '#DC2626',
      });
      this.callbacks.onTollPaid?.({
        payerId: mover.id,
        receiverId: owner.id,
        amount: payableToll,
        tileIndex: tile.index,
      });
      this.proceedAfterEnemyTollPaid(mover, tile, def, payableToll);
    } else {
      // Enter DEBT_RESOLUTION
      this.enqueueOrStartDebt({
        debtorId: mover.id,
        creditorId: owner.id,
        amountOwed: payableToll,
        sourceTileIndex: tile.index,
        allowPostPayTakeover: allowTakeover,
        isFromSkillPull: false,
      });
    }
  }

  private proceedAfterEnemyTollPaid(
    mover: PlayerState,
    tile: BoardTileState,
    def: WorldTileDef,
    paidToll: number
  ): void {
    if (!this.matchState || mover.isBankrupt) return;

    // Hook 6: ON_AFTER_PAY_TOLL -> M05_HEALING_TRAVEL
    if (paidToll > 0 && this.tryTriggerSkill(mover, 'M05_HEALING_TRAVEL')) {
      this.warpPlayerToSkyTerminal(mover, true);
      this.finishTileResolution();
      return;
    }

    // Check if Takeover is possible (Enemy CITY with 1..3 buildings, not Landmark/Tourism)
    if (
      def.type === 'CITY' &&
      tile.ownerId &&
      !this.arePlayersAllied(mover.id, tile.ownerId) &&
      tile.buildingLevel >= BuildingLevel.LAND &&
      tile.buildingLevel <= BuildingLevel.HOTEL
    ) {
      const takeoverCost = this.calculateTakeoverCost(mover.id, tile.index);
      if (mover.marble >= takeoverCost) {
        this.matchState.activePrompt = {
          type: 'TAKEOVER_PROMPT',
          playerId: mover.id,
          tileIndex: tile.index,
          defenderId: tile.ownerId,
          buildingLevel: tile.buildingLevel,
          takeoverCost,
          canAfford: true,
          paidToll,
        };
        this.emitStateChange();
        return;
      }
    }

    this.finishTileResolution();
  }

  // --------------------------------------------------------------------------
  // BUY / UPGRADE CITY & LAP-BASED BUILDING RULE
  // --------------------------------------------------------------------------

  private openBuyOrUpgradePrompt(
    player: PlayerState,
    tileIndex: number,
    isAfterTakeover: boolean
  ): void {
    if (!this.matchState) return;
    const tile = this.matchState.tiles[tileIndex];
    const def = WORLD_MAP_TILES[tileIndex];
    if (!tile || !def) {
      this.finishTileResolution();
      return;
    }

    const currentLevel = tile.ownerId === null ? BuildingLevel.NONE : tile.buildingLevel;
    let maxAllowedLevel = BuildingLevel.NONE;
    let lap1HotelLocked = false;

    if (def.type === 'TOURISM') {
      maxAllowedLevel = BuildingLevel.LAND;
    } else if (tile.ownerId === null) {
      // Unowned CITY: Lap 1 (lapCount === 0) locks HOTEL (maxAllowed = BUILDING)
      if (player.lapCount === 0) {
        maxAllowedLevel = BuildingLevel.BUILDING;
        lap1HotelLocked = true;
      } else {
        maxAllowedLevel = BuildingLevel.HOTEL;
      }
    } else {
      // Already owned by self/teammate (or just taken over)
      if (currentLevel < BuildingLevel.HOTEL) {
        maxAllowedLevel = BuildingLevel.HOTEL;
      } else if (currentLevel === BuildingLevel.HOTEL) {
        maxAllowedLevel = BuildingLevel.LANDMARK;
      }
    }

    if (maxAllowedLevel <= currentLevel) {
      this.finishTileResolution();
      return;
    }

    const levelMeta: Record<BuildingLevel, { en: string; th: string }> = {
      [BuildingLevel.NONE]: { en: 'None', th: 'ว่าง' },
      [BuildingLevel.LAND]: {
        en: def.type === 'TOURISM' ? 'Tourism Island' : 'Land Only',
        th: def.type === 'TOURISM' ? 'ซื้อเกาะท่องเที่ยว' : 'ซื้อที่ดินเปล่า',
      },
      [BuildingLevel.VILLA]: { en: '1 Building (Villa)', th: 'บ้านพัก (1 หลัง)' },
      [BuildingLevel.BUILDING]: { en: '2 Buildings (Tower)', th: 'ตึกแถว (2 หลัง)' },
      [BuildingLevel.HOTEL]: { en: '3 Buildings (Hotel)', th: 'โรงแรม (3 หลัง)' },
      [BuildingLevel.LANDMARK]: { en: 'Landmark', th: 'แลนด์มาร์ก (Landmark)' },
    };

    const options: BuildOptionEntry[] = [];
    const maxLoopLevel =
      def.type === 'TOURISM'
        ? BuildingLevel.LAND
        : tile.ownerId === null
        ? BuildingLevel.HOTEL
        : maxAllowedLevel;

    for (let lv = currentLevel + 1; lv <= maxLoopLevel; lv++) {
      const level = lv as BuildingLevel;
      const isLockedByLap1 = lap1HotelLocked && level === BuildingLevel.HOTEL;
      const cost = this.calculateBuildCost(player.id, tileIndex, currentLevel, level);
      options.push({
        level,
        labelEn: levelMeta[level].en,
        labelTh: levelMeta[level].th,
        cost,
        canAfford: !isLockedByLap1 && player.marble >= cost,
        isLockedByLap1,
      });
    }

    // If the player cannot even afford the lowest available option, still show prompt for Human
    // so they can see the tile info and click Skip, or if after takeover and cannot afford, skip.
    if (isAfterTakeover && !options.some((o) => o.canAfford)) {
      this.finishTileResolution();
      return;
    }

    this.matchState.activePrompt = {
      type: 'BUY_OR_UPGRADE_CITY',
      playerId: player.id,
      tileIndex,
      currentLevel,
      maxAllowedLevel,
      lap1HotelLocked,
      isAfterTakeover,
      options,
    };
    this.emitStateChange();
  }

  public confirmBuildOrUpgrade(targetLevel: BuildingLevel): boolean {
    if (!this.matchState || this.matchState.activePrompt?.type !== 'BUY_OR_UPGRADE_CITY') {
      return false;
    }
    const prompt = this.matchState.activePrompt;
    const player = this.matchState.players[prompt.playerId];
    const tile = this.matchState.tiles[prompt.tileIndex];
    const def = WORLD_MAP_TILES[prompt.tileIndex];

    const opt = prompt.options.find((o) => o.level === targetLevel);
    if (!player || !tile || !def || !opt || opt.isLockedByLap1 || !opt.canAfford) {
      return false;
    }

    player.marble -= opt.cost;
    if (!tile.ownerId) {
      tile.ownerId = player.id;
    }
    tile.buildingLevel = targetLevel;
    this.matchState.activePrompt = null;

    this.appendLog(
      player.id,
      `🏗️ ${player.name} สร้าง "${opt.labelTh}" ที่ ${def.nameTh} (-${formatMarbleCompact(opt.cost)})`,
      'BUILD'
    );
    this.callbacks.onFloatingText?.({
      tileIndex: tile.index,
      text: `🏗️ ${opt.labelTh}`,
      colorHex: player.colorHex,
    });

    // Check Monopoly Victory immediately after building/buying!
    if (this.checkAndApplyVictoryConditions()) {
      this.emitStateChange();
      return true;
    }

    // Hook 8: ON_BUILD_COMPLETE
    this.runPostBuildHooks(player, tile.index);
    return true;
  }

  public skipBuildOrUpgrade(): void {
    if (!this.matchState || this.matchState.activePrompt?.type !== 'BUY_OR_UPGRADE_CITY') return;
    this.matchState.activePrompt = null;
    this.finishTileResolution();
  }

  private runPostBuildHooks(player: PlayerState, tileIndex: number): void {
    if (!this.matchState) return;
    this.builtThisResolution = true;
    const tile = this.matchState.tiles[tileIndex];
    const def = WORLD_MAP_TILES[tileIndex];

    if (def.type !== 'CITY') {
      this.finishTileResolution();
      return;
    }

    // 1. If built 3 buildings (HOTEL):
    if (tile.buildingLevel === BuildingLevel.HOTEL) {
      // Check M03_BUILD_TO_START (Return to START on 3 buildings)
      if (this.tryTriggerSkill(player, 'M03_BUILD_TO_START')) {
        player.tileIndex = 0;
        this.awardStartSalary(player);
        this.openStartUpgradePicker(player);
        return;
      }

      // Check M04_BUILD_TO_TRAVEL (Fly to airport on 3 buildings)
      if (this.tryTriggerSkill(player, 'M04_BUILD_TO_TRAVEL')) {
        this.warpPlayerToSkyTerminal(player, true);
        this.finishTileResolution();
        return;
      }

      this.finishTileResolution();
      return;
    }

    // 2. If tile is now LANDMARK (built directly by player in normal turn):
    if (tile.buildingLevel === BuildingLevel.LANDMARK) {
      // Check S06_AUTO_EXPO (pulls Olympic multiplier for free)
      if (this.tryTriggerSkill(player, 'S06_AUTO_EXPO')) {
        this.applyOlympicExpoToTile(tile.index, player, true);
      }

      // Check M04_BUILD_TO_TRAVEL
      if (this.tryTriggerSkill(player, 'M04_BUILD_TO_TRAVEL')) {
        this.warpPlayerToSkyTerminal(player, true);
      }

      // Run Landmark manual build hooks (M01_MAGNET, M08_AIRPORT_RECALL, M02_BLACK_HOLE, M10_DISRUPT_CITY)
      this.triggerOwnLandmarkHooks(player, tile.index, true);
      return;
    }

    this.finishTileResolution();
  }

  // --------------------------------------------------------------------------
  // HOOK 9: ON_VISIT_OWN_LANDMARK (S05, M01, M08, M02)
  // --------------------------------------------------------------------------

  private triggerOwnLandmarkHooks(
    player: PlayerState,
    landmarkTileIndex: number,
    isJustBuilt: boolean
  ): void {
    if (!this.matchState) return;
    const tile = this.matchState.tiles[landmarkTileIndex];
    const def = WORLD_MAP_TILES[landmarkTileIndex];
    if (!tile || tile.buildingLevel !== BuildingLevel.LANDMARK) {
      this.finishTileResolution();
      return;
    }

    // 1. S05_STEP_TOLL_X2 (only when landing on existing Landmark, or also on visit)
    if (!isJustBuilt && tile.stepMultiplier < 8) {
      if (this.tryTriggerSkill(player, 'S05_STEP_TOLL_X2')) {
        tile.stepMultiplier = Math.min(8, tile.stepMultiplier * 2);
        this.appendLog(
          player.id,
          `🔥 เหยียบบ้านคูณสอง! ค่าผ่านทางที่ ${def.nameTh} เพิ่มเป็น x${tile.stepMultiplier}!`,
          'SKILL'
        );
        this.callbacks.onFloatingText?.({
          tileIndex: landmarkTileIndex,
          text: `TOLL x${tile.stepMultiplier}!`,
          colorHex: '#EA580C',
        });
      }
    }

    // 2. M01_MAGNET (Pull enemies within ±2 tiles who are not on Desert Island)
    const magnetTargets = PLAYER_IDS.map((pid) => this.matchState!.players[pid]).filter((other) => {
      if (other.isBankrupt || other.id === player.id || this.arePlayersAllied(player.id, other.id)) {
        return false;
      }
      if (other.islandTurnsLeft > 0) return false;
      const diff = Math.abs(other.tileIndex - landmarkTileIndex);
      const dist = Math.min(diff, MATCH_CONFIG.boardSize - diff);
      return dist >= 1 && dist <= 2;
    });

    if (magnetTargets.length > 0 && this.tryTriggerSkill(player, 'M01_MAGNET')) {
      for (const enemy of magnetTargets) {
        enemy.tileIndex = landmarkTileIndex;
        enemy.isWaitingTravel = false;
        this.appendLog(
          player.id,
          `🧲 แกนแม่เหล็กดึง ${enemy.name} มาที่แลนด์มาร์ก ${def.nameTh}!`,
          'SKILL'
        );
        this.chargePulledEnemyLandmarkToll(player, enemy, landmarkTileIndex);
      }
    }

    // 3. M08_AIRPORT_RECALL (Pull enemies waiting at Sky Terminal Tile 24 to this Landmark)
    const airportEnemies = PLAYER_IDS.map((pid) => this.matchState!.players[pid]).filter(
      (other) =>
        !other.isBankrupt &&
        other.id !== player.id &&
        !this.arePlayersAllied(player.id, other.id) &&
        (other.tileIndex === 24 || other.isWaitingTravel)
    );

    if (airportEnemies.length > 0 && this.tryTriggerSkill(player, 'M08_AIRPORT_RECALL')) {
      for (const enemy of airportEnemies) {
        enemy.isWaitingTravel = false;
        enemy.tileIndex = landmarkTileIndex;
        this.appendLog(
          player.id,
          `📻 เรียกด่วนประธาน! กระชาก ${enemy.name} จากสนามบินมาที่ ${def.nameTh}!`,
          'SKILL'
        );
        this.chargePulledEnemyLandmarkToll(player, enemy, landmarkTileIndex);
      }
    }

    // 4. M02_BLACK_HOLE (Place global single Black Hole linked to this Landmark)
    if (this.tryTriggerSkill(player, 'M02_BLACK_HOLE')) {
      this.matchState.pendingBlackHoleLandmarkIndex = landmarkTileIndex;
    }

    // 5. M10_DISRUPT_CITY (Landmark Row Teleport: on Landmark build, teleport to any non-corner tile in the same row)
    if (isJustBuilt && !player.isWaitingTravel) {
      if (this.tryTriggerSkill(player, 'M10_DISRUPT_CITY')) {
        this.matchState.pendingLineTeleportLandmarkIndex = landmarkTileIndex;
      }
    }

    // If any pulled enemy entered debt, resolve debt queue first
    if (this.matchState.pendingDebt) {
      this.emitStateChange();
      return;
    }

    if (this.matchState.pendingBlackHoleLandmarkIndex !== null) {
      this.openBlackHolePlacementPicker(player, this.matchState.pendingBlackHoleLandmarkIndex);
      return;
    }

    if (this.matchState.pendingLineTeleportLandmarkIndex !== null) {
      const lmIdx = this.matchState.pendingLineTeleportLandmarkIndex;
      this.matchState.pendingLineTeleportLandmarkIndex = null;
      this.openLineTeleportPicker(player, lmIdx);
      return;
    }

    this.finishTileResolution();
  }

  private chargePulledEnemyLandmarkToll(
    landmarkOwner: PlayerState,
    enemy: PlayerState,
    landmarkTileIndex: number
  ): void {
    if (!this.matchState || enemy.isBankrupt) return;
    const def = WORLD_MAP_TILES[landmarkTileIndex];
    const breakdown = this.calculateTollBreakdown(landmarkTileIndex, enemy.id);
    let payable = breakdown.netToll;

    // Pulled enemy can still check S07_BLACK_CARD
    if (payable > 0 && this.tryTriggerSkill(enemy, 'S07_BLACK_CARD')) {
      this.appendLog(
        enemy.id,
        `💳 ${enemy.name} ใช้บัตรเครดิตดำ ยกเว้นค่าผ่านทางที่ ${def.nameTh}!`,
        'SKILL'
      );
      return;
    }

    // Pulled enemy can also spend a held Angel Card (same as normal toll path)
    if (payable > 0 && enemy.hasAngelCard) {
      enemy.hasAngelCard = false;
      this.callbacks.onAngelCardUsed?.({
        playerId: enemy.id,
        tileIndex: landmarkTileIndex,
        targetName: def.nameTh,
        reason: 'TOLL',
      });
      this.appendLog(enemy.id, `👼 ${enemy.name} ใช้การ์ดนางฟ้า! ยกเว้นค่าผ่านทางที่ ${def.nameTh} 100%!`, 'TOLL');
      return;
    }

    if (enemy.marble >= payable) {
      enemy.marble -= payable;
      landmarkOwner.marble += payable;
      this.appendLog(
        enemy.id,
        `💸 ${enemy.name} จ่ายค่าผ่านทางแลนด์มาร์ก ${formatMarbleCompact(payable)} ให้ ${landmarkOwner.name}`,
        'TOLL'
      );
      this.callbacks.onFloatingText?.({
        tileIndex: landmarkTileIndex,
        text: `-${formatMarbleCompact(payable)}`,
        colorHex: '#DC2626',
      });
    } else {
      this.enqueueOrStartDebt({
        debtorId: enemy.id,
        creditorId: landmarkOwner.id,
        amountOwed: payable,
        sourceTileIndex: landmarkTileIndex,
        allowPostPayTakeover: false,
        isFromSkillPull: true,
      });
    }
  }

  // --------------------------------------------------------------------------
  // TAKEOVER & HOOK 7: ON_OPPONENT_ATTEMPT_TAKEOVER (S08_TAKEOVER_SHIELD)
  // --------------------------------------------------------------------------

  public confirmTakeover(): boolean {
    if (!this.matchState || this.matchState.activePrompt?.type !== 'TAKEOVER_PROMPT') {
      return false;
    }
    const prompt = this.matchState.activePrompt;
    const buyer = this.matchState.players[prompt.playerId];
    const defender = this.matchState.players[prompt.defenderId];
    const tile = this.matchState.tiles[prompt.tileIndex];
    const def = WORLD_MAP_TILES[prompt.tileIndex];

    if (!buyer || !defender || !tile || !def || buyer.marble < prompt.takeoverCost) {
      this.skipTakeover();
      return false;
    }

    this.matchState.activePrompt = null;

    // Hook 7: ON_OPPONENT_ATTEMPT_TAKEOVER -> Defender checks S08_TAKEOVER_SHIELD
    if (this.tryTriggerSkill(defender, 'S08_TAKEOVER_SHIELD')) {
      this.appendLog(
        defender.id,
        `🛡️ โล่กันซื้อต่อทำงาน! ${defender.name} ป้องกันการซื้อต่อเมือง ${def.nameTh} สำเร็จ!`,
        'SKILL'
      );
      this.callbacks.onFloatingText?.({
        tileIndex: tile.index,
        text: `🛡️ โล่กันซื้อต่อ!`,
        colorHex: '#2563EB',
      });
      this.finishTileResolution();
      return false;
    }

    // Execute Takeover — the full takeover price goes to the previous owner
    buyer.marble -= prompt.takeoverCost;
    defender.marble += prompt.takeoverCost;
    tile.ownerId = buyer.id;

    this.appendLog(
      buyer.id,
      `⚔️ ${buyer.name} เทคโอเวอร์เมือง ${def.nameTh} จาก ${defender.name} (-${formatMarbleCompact(prompt.takeoverCost)})!`,
      'BUILD'
    );
    this.callbacks.onFloatingText?.({
      tileIndex: tile.index,
      text: `⚔️ TAKEOVER!`,
      colorHex: buyer.colorHex,
    });

    if (this.checkAndApplyVictoryConditions()) {
      this.emitStateChange();
      return true;
    }

    // After taking over an enemy city, allow upgrading it immediately (e.g. HOTEL -> LANDMARK!)
    this.openBuyOrUpgradePrompt(buyer, tile.index, true);
    return true;
  }

  public skipTakeover(): void {
    if (!this.matchState || this.matchState.activePrompt?.type !== 'TAKEOVER_PROMPT') return;
    this.matchState.activePrompt = null;
    this.finishTileResolution();
  }

  // --------------------------------------------------------------------------
  // SPECIAL TILES: ISLAND, OLYMPIC, SKY TERMINAL, BONUS COIN, CHANCE, TAX
  // --------------------------------------------------------------------------

  private sendPlayerToDesertIsland(player: PlayerState): void {
    if (!this.matchState) return;
    player.tileIndex = 8;
    player.islandTurnsLeft = MATCH_CONFIG.desertIslandTurns;
    player.consecutiveDoubles = 0;
    player.isWaitingTravel = false;
    this.matchState.extraRollGranted = false;

    this.appendLog(
      player.id,
      `🏝️ ${player.name} เข้าสู่เกาะร้าง (กักตัว ${MATCH_CONFIG.desertIslandTurns} เทิร์น)`,
      'MOVE'
    );

    // Hook 3: ON_ENTER_DESERT_ISLAND -> S03_ISLAND_ESCAPE
    if (this.tryTriggerSkill(player, 'S03_ISLAND_ESCAPE')) {
      player.islandTurnsLeft = 0;
      player.consecutiveDoubles = 0;
      this.matchState.extraRollGranted = true;
      this.appendLog(
        player.id,
        `⚡ หนีเกาะร้างทันที! ${player.name} ได้สิทธิ์ทอยเต๋าออกจากเกาะฟรีทันที!`,
        'SKILL'
      );
      this.finishTurnOrExtraRoll();
      return;
    }

    this.finishTurnOrExtraRoll();
  }

  private warpPlayerToSkyTerminal(player: PlayerState, freeTicket: boolean): void {
    if (!this.matchState) return;
    player.tileIndex = 24;
    this.enterSkyTerminalTile(player, freeTicket);
  }

  private enterSkyTerminalTile(player: PlayerState, freeTicket: boolean): void {
    if (!this.matchState) return;
    player.isWaitingTravel = true;
    this.matchState.freeWorldTravelMap[player.id] = freeTicket;
    this.appendLog(
      player.id,
      `✈️ ${player.name} รอขึ้นเครื่องที่สนามบินรอบโลก (เทิร์นหน้าเลือกบินได้ทุกช่อง${freeTicket ? ' ฟรี!' : ''})`,
      'MOVE'
    );
  }

  private openWorldTravelPicker(player: PlayerState): void {
    if (!this.matchState) return;
    const isFree = this.matchState.freeWorldTravelMap[player.id] ?? false;
    const fee = isFree ? 0 : MATCH_CONFIG.worldTravelTicketCost;

    if (fee > 0 && player.marble < fee) {
      // Cannot afford ticket -> clear waiting travel and roll normally
      player.isWaitingTravel = false;
      this.matchState.phase = 'IDLE_ROLL';
      this.callbacks.onToastBanner?.(
        'เงินไม่พอซื้อตั๋วบินรอบโลก ระบบเปลี่ยนเป็นทอยลูกเต๋าปกติ',
        '#D97706'
      );
      this.emitStateChange();
      return;
    }

    const validTiles = WORLD_MAP_TILES.map((t) => t.index).filter((idx) => idx !== 24);
    this.matchState.phase = 'BOARD_TARGET_PICK';
    this.matchState.boardPickReason = 'WORLD_TRAVEL_DEST';
    this.matchState.boardPickValidTiles = validTiles;
    this.emitStateChange();
  }

  private openStartUpgradePicker(player: PlayerState): void {
    if (!this.matchState) return;
    const upgradableTiles = this.matchState.tiles
      .filter((t) => {
        const def = WORLD_MAP_TILES[t.index];
        return (
          def.type === 'CITY' &&
          this.arePlayersAllied(player.id, t.ownerId) &&
          t.buildingLevel >= BuildingLevel.LAND &&
          t.buildingLevel < BuildingLevel.LANDMARK
        );
      })
      .map((t) => t.index);

    if (upgradableTiles.length === 0) {
      this.finishTileResolution();
      return;
    }

    this.matchState.phase = 'BOARD_TARGET_PICK';
    this.matchState.boardPickReason = 'START_UPGRADE_CITY';
    this.matchState.boardPickValidTiles = upgradableTiles;
    this.emitStateChange();
  }

  private openOlympicCityPicker(player: PlayerState, isFree: boolean): void {
    if (!this.matchState) return;
    const fee = isFree ? 0 : MATCH_CONFIG.olympicBaseFee;
    if (player.marble < fee) {
      this.appendLog(player.id, `🏟️ ${player.name} เงินไม่พอจัดงานโอลิมปิก`, 'MOVE');
      this.finishTileResolution();
      return;
    }

    const ownedTiles = this.matchState.tiles
      .filter((t) => this.arePlayersAllied(player.id, t.ownerId))
      .map((t) => t.index);

    if (ownedTiles.length === 0) {
      this.appendLog(player.id, `🏟️ ${player.name} ยังไม่มีเมืองสำหรับจัดงานโอลิมปิก`, 'MOVE');
      this.finishTileResolution();
      return;
    }

    this.matchState.pendingOlympicIsFree = isFree;
    this.matchState.phase = 'BOARD_TARGET_PICK';
    this.matchState.boardPickReason = 'OLYMPIC_SELECT';
    this.matchState.boardPickValidTiles = ownedTiles;
    this.emitStateChange();
  }

  private applyOlympicExpoToTile(
    tileIndex: number,
    player: PlayerState,
    isFree: boolean
  ): void {
    if (!this.matchState) return;
    const fee = isFree ? 0 : MATCH_CONFIG.olympicBaseFee;
    if (!isFree && player.marble >= fee) {
      player.marble -= fee;
    }

    for (const t of this.matchState.tiles) {
      t.olympicMultiplier = 1;
    }

    this.matchState.olympicHostCount = Math.min(4, this.matchState.olympicHostCount + 1);
    const mult = Math.min(
      MATCH_CONFIG.maxOlympicMultiplier,
      this.matchState.olympicHostCount + 1
    ); // x2, x3, x4, x5
    this.matchState.tiles[tileIndex].olympicMultiplier = mult;
    this.matchState.olympicTileIndex = tileIndex;

    const def = WORLD_MAP_TILES[tileIndex];
    this.appendLog(
      player.id,
      `🏅 ${player.name} จัดโอลิมปิกที่ ${def.nameTh} (ค่าผ่านทาง x${mult})!`,
      'BUILD'
    );
    this.callbacks.onFloatingText?.({
      tileIndex,
      text: `🏅 OLYMPIC x${mult}!`,
      colorHex: '#E5A93B',
    });
  }

  private openBlackHolePlacementPicker(player: PlayerState, landmarkTileIndex: number): void {
    if (!this.matchState) return;
    const validTiles = WORLD_MAP_TILES.map((t) => t.index).filter(
      (idx) => idx !== 0 && idx !== 8 && idx !== landmarkTileIndex
    );
    this.matchState.phase = 'BOARD_TARGET_PICK';
    this.matchState.boardPickReason = 'BLACK_HOLE_PLACE';
    this.matchState.boardPickValidTiles = validTiles;
    this.matchState.pendingBlackHoleLandmarkIndex = landmarkTileIndex;
    this.appendLog(
      player.id,
      `🌀 เลือกช่องบนกระดานเพื่อวางหลุมดำเชื่อมมายัง ${WORLD_MAP_TILES[landmarkTileIndex].nameTh}`,
      'SKILL'
    );
    this.emitStateChange();
  }

  private openLineTeleportPicker(player: PlayerState, landmarkTileIndex: number): void {
    if (!this.matchState) return;
    const rowLine = WORLD_MAP_TILES[landmarkTileIndex].line;
    // Non-corner tiles in the same row (indices % 8 !== 0) excluding the Landmark tile itself
    const validTiles = WORLD_MAP_TILES.filter(
      (t) => t.line === rowLine && t.index % 8 !== 0 && t.index !== landmarkTileIndex
    ).map((t) => t.index);

    if (validTiles.length === 0) {
      this.finishTileResolution();
      return;
    }

    this.matchState.phase = 'BOARD_TARGET_PICK';
    this.matchState.boardPickReason = 'LINE_TELEPORT_DEST';
    this.matchState.boardPickValidTiles = validTiles;
    this.appendLog(
      player.id,
      `🔮 วาร์ปแถวแลนด์มาร์กทำงาน! เลือกช่องในแถวเดียวกัน (ไม่รวมช่องมุม) เพื่อวาร์ปไปทันที!`,
      'SKILL'
    );
    this.emitStateChange();
  }

  // --------------------------------------------------------------------------
  // HOOK 11: BONUS COIN FLIP MINIGAME (TILE 2) + S09_COIN_MASTER
  // --------------------------------------------------------------------------

  private startBonusCoinGame(player: PlayerState): void {
    if (!this.matchState) return;
    // Hook 11: ON_BONUS_GAME_START -> S09_COIN_MASTER
    const coinMasterProc = this.tryTriggerSkill(player, 'S09_COIN_MASTER');

    const bonusState: PendingBonusGameState = coinMasterProc
      ? {
          playerId: player.id,
          round: 2,
          currentReward: MATCH_CONFIG.bonusGameRewards[1], // 200,000 M guaranteed Round 1 win!
          hasCoinMasterRetry: true,
          autoWonRound1: true,
        }
      : {
          playerId: player.id,
          round: 1,
          currentReward: MATCH_CONFIG.bonusGameRewards[0], // 100,000 M base pot
          hasCoinMasterRetry: false,
          autoWonRound1: false,
        };

    this.matchState.activePrompt = {
      type: 'BONUS_COIN_GAME',
      bonusState,
    };
    this.emitStateChange();
  }

  public flipBonusCoin(_choice: 'HEADS' | 'TAILS'): {
    wonRound: boolean;
    usedRetry: boolean;
    finished: boolean;
    reward: number;
  } {
    if (!this.matchState || this.matchState.activePrompt?.type !== 'BONUS_COIN_GAME') {
      return { wonRound: false, usedRetry: false, finished: true, reward: 0 };
    }

    const bs = this.matchState.activePrompt.bonusState;
    const player = this.matchState.players[bs.playerId];
    const isWin = Math.random() < 0.5;

    if (isWin) {
      const nextReward = MATCH_CONFIG.bonusGameRewards[bs.round] ?? 800_000;
      bs.currentReward = nextReward;

      if (bs.round >= 3) {
        player.marble += nextReward;
        this.appendLog(
          player.id,
          `🪙 ${player.name} ชนะโยนเหรียญครบ 3 ตาติด! รับแจ็กพอต +${formatMarbleCompact(nextReward)}!`,
          'MOVE'
        );
        this.callbacks.onFloatingText?.({
          tileIndex: 2,
          text: `+${formatMarbleCompact(nextReward)} JACKPOT!`,
          colorHex: '#E5A93B',
        });
        this.matchState.activePrompt = null;
        this.finishTileResolution();
        return { wonRound: true, usedRetry: false, finished: true, reward: nextReward };
      }

      bs.round = (bs.round + 1) as 1 | 2 | 3;
      this.emitStateChange();
      return { wonRound: true, usedRetry: false, finished: false, reward: nextReward };
    }

    // Guessed wrong: check S09_COIN_MASTER free retry!
    if (bs.hasCoinMasterRetry) {
      bs.hasCoinMasterRetry = false;
      this.appendLog(
        player.id,
        `⚡ เซียนมินิเกมทำงาน! ${player.name} ทายผิดแต่ได้สิทธิ์แก้ตัวฟรีอีก 1 ครั้ง!`,
        'SKILL'
      );
      this.callbacks.onToastBanner?.(
        `⚡ เซียนมินิเกม! ได้สิทธิ์โยนเหรียญแก้ตัวฟรี!`,
        '#9333EA'
      );
      this.emitStateChange();
      return { wonRound: false, usedRetry: true, finished: false, reward: bs.currentReward };
    }

    // Lose bonus game pot
    this.appendLog(player.id, `🪙 ${player.name} ทายเหรียญพลาด อดรับเงินรางวัลโบนัส`, 'MOVE');
    this.matchState.activePrompt = null;
    this.finishTileResolution();
    return { wonRound: false, usedRetry: false, finished: true, reward: 0 };
  }

  public takeBonusReward(): void {
    if (!this.matchState || this.matchState.activePrompt?.type !== 'BONUS_COIN_GAME') return;
    const bs = this.matchState.activePrompt.bonusState;
    const player = this.matchState.players[bs.playerId];
    if (player && bs.currentReward > 0) {
      player.marble += bs.currentReward;
      this.appendLog(
        player.id,
        `🪙 ${player.name} หยุดรับเงินรางวัลโยนเหรียญ +${formatMarbleCompact(bs.currentReward)}!`,
        'MOVE'
      );
      this.callbacks.onFloatingText?.({
        tileIndex: 2,
        text: `+${formatMarbleCompact(bs.currentReward)}`,
        colorHex: '#16A34A',
      });
    }
    this.matchState.activePrompt = null;
    this.finishTileResolution();
  }

  // --------------------------------------------------------------------------
  // HOOK 10: CHANCE / FORTUNE CARD TILE + M10_DISRUPT_CITY
  // --------------------------------------------------------------------------

  public setDisruptMode(mode: DisruptActionMode): void {
    if (!this.matchState) return;
    this.matchState.disruptMode = mode;
    this.emitStateChange();
  }

  private resolveChanceTile(player: PlayerState): void {
    if (!this.matchState) return;

    // Weighted 9-Card Classic Fortune Deck (100% Total Weight — No Gold Bonus)
    let totalWeight = 0;
    for (const c of FORTUNE_CARD_DECK) {
      totalWeight += c.weightPct;
    }
    let roll = Math.random() * totalWeight;
    let pickedDef = FORTUNE_CARD_DECK[0];
    for (const c of FORTUNE_CARD_DECK) {
      if (roll < c.weightPct) {
        pickedDef = c;
        break;
      }
      roll -= c.weightPct;
    }

    let rewardAmount = 0;
    const descTh = pickedDef.descTh;
    if (pickedDef.cardId === 'HOST_OLYMPIC_FREE' || pickedDef.cardId === 'FORCED_SALE_OR_SWAP') {
      rewardAmount = 150_000;
    } else if (pickedDef.cardId === 'POWER_OUTAGE' || pickedDef.cardId === 'CHARITY_TAX') {
      rewardAmount = 120_000;
    }

    this.matchState.activePrompt = {
      type: 'FORTUNE_CARD_MODAL',
      playerId: player.id,
      cardId: pickedDef.cardId,
      titleTh: `${pickedDef.emoji} ${pickedDef.titleTh}`,
      titleEn: pickedDef.titleEn,
      descTh,
      rewardAmount,
    };
    this.emitStateChange();
  }

  public confirmFortuneCard(): void {
    if (!this.matchState || this.matchState.activePrompt?.type !== 'FORTUNE_CARD_MODAL') return;
    const prompt = this.matchState.activePrompt;
    const player = this.matchState.players[prompt.playerId];
    this.matchState.activePrompt = null;

    if (!player) {
      this.finishTileResolution();
      return;
    }

    switch (prompt.cardId) {
      case 'ANGEL_SHIELD': {
        player.hasAngelCard = true;
        this.appendLog(
          player.id,
          `👼 ${player.name} ได้รับ "การ์ดนางฟ้า" (ป้องกันค่าผ่านทาง 100% หรือป้องกันการป่วนเมือง)!`,
          'MOVE'
        );
        this.callbacks.onFloatingText?.({
          tileIndex: player.tileIndex,
          text: `👼 ได้การ์ดนางฟ้า!`,
          colorHex: '#FDE047',
        });
        this.finishTileResolution();
        return;
      }

      case 'DISCOUNT_COUPON': {
        player.hasDiscountCoupon = true;
        this.appendLog(
          player.id,
          `🎟️ ${player.name} ได้รับ "คูปองลดค่าผ่านทาง 50%" สำหรับเมืองศัตรูครั้งถัดไป!`,
          'MOVE'
        );
        this.callbacks.onFloatingText?.({
          tileIndex: player.tileIndex,
          text: `🎟️ คูปองลด 50%!`,
          colorHex: '#38BDF8',
        });
        this.finishTileResolution();
        return;
      }

      case 'FREE_START_PASS': {
        player.tileIndex = 0;
        this.awardStartSalary(player);
        this.openStartUpgradePicker(player);
        return;
      }

      case 'HOST_OLYMPIC_FREE': {
        const hasOwned = this.matchState.tiles.some((t) =>
          this.arePlayersAllied(player.id, t.ownerId)
        );
        if (hasOwned) {
          this.openOlympicCityPicker(player, true);
        } else {
          player.marble += prompt.rewardAmount;
          this.appendLog(
            player.id,
            `🃏 ${player.name} ยังไม่มีเมืองจัดโอลิมปิก รับเงินปลอบใจ +${formatMarbleCompact(prompt.rewardAmount)}!`,
            'MOVE'
          );
          this.finishTileResolution();
        }
        return;
      }

      case 'WORLD_TRAVEL_INVITE': {
        this.warpPlayerToSkyTerminal(player, true);
        this.finishTileResolution();
        return;
      }

      case 'POWER_OUTAGE': {
        const enemyTiles = this.matchState.tiles
          .filter((t) => t.ownerId !== null && !this.arePlayersAllied(player.id, t.ownerId) && !t.isBlackout)
          .map((t) => t.index);
        if (enemyTiles.length > 0) {
          this.matchState.phase = 'BOARD_TARGET_PICK';
          this.matchState.boardPickReason = 'BLACKOUT_SELECT';
          this.matchState.boardPickValidTiles = enemyTiles;
          this.emitStateChange();
        } else {
          player.marble += prompt.rewardAmount;
          this.appendLog(
            player.id,
            `🔌 ยังไม่มีเมืองศัตรูให้ตัดไฟ ${player.name} รับโบนัส +${formatMarbleCompact(prompt.rewardAmount)} แทน!`,
            'MOVE'
          );
          this.finishTileResolution();
        }
        return;
      }

      case 'FORCED_SALE_OR_SWAP': {
        const enemyNonLandmarks = this.matchState.tiles
          .filter((t) => {
            const def = WORLD_MAP_TILES[t.index];
            return (
              def.type === 'CITY' &&
              t.ownerId !== null &&
              !this.arePlayersAllied(player.id, t.ownerId) &&
              t.buildingLevel >= BuildingLevel.LAND &&
              t.buildingLevel < BuildingLevel.LANDMARK
            );
          })
          .map((t) => t.index);

        if (enemyNonLandmarks.length > 0) {
          this.matchState.phase = 'BOARD_TARGET_PICK';
          this.matchState.boardPickReason = 'DISRUPT_SELL_OR_SWAP';
          this.matchState.boardPickValidTiles = enemyNonLandmarks;
          this.emitStateChange();
        } else {
          player.marble += prompt.rewardAmount;
          this.appendLog(
            player.id,
            `🔮 ยังไม่มีเมืองศัตรูที่บังคับขายได้ ${player.name} รับโบนัส +${formatMarbleCompact(prompt.rewardAmount)} แทน!`,
            'MOVE'
          );
          this.finishTileResolution();
        }
        return;
      }

      case 'CHARITY_TAX': {
        const paid = Math.min(player.marble, prompt.rewardAmount);
        player.marble -= paid;
        this.appendLog(
          player.id,
          `💸 ${player.name} เปิดได้การ์ดบริจาคการกุศล จ่ายเงิน -${formatMarbleCompact(paid)}!`,
          'TOLL'
        );
        this.callbacks.onFloatingText?.({
          tileIndex: player.tileIndex,
          text: `-${formatMarbleCompact(paid)} บริจาค`,
          colorHex: '#DC2626',
        });
        this.finishTileResolution();
        return;
      }

      case 'ISLAND_EXILE': {
        this.appendLog(
          player.id,
          `🌪️ ${player.name} เปิดเจอพายุพัดหลงติดเกาะร้างทันที!`,
          'MOVE'
        );
        this.sendPlayerToDesertIsland(player);
        return;
      }
    }
  }

  // --------------------------------------------------------------------------
  // TAX AUDIT TILE (TILE 30: 10% OF TOTAL ASSETS)
  // --------------------------------------------------------------------------

  private resolveTaxAuditTile(player: PlayerState): void {
    if (!this.matchState) return;
    const totalAssets = this.calculatePlayerTotalAssets(player.id);
    const taxAmount = Math.max(50_000, Math.round(totalAssets * MATCH_CONFIG.taxAuditRate));

    if (player.marble >= taxAmount) {
      player.marble -= taxAmount;
      this.appendLog(
        player.id,
        `🏛️ ${player.name} จ่ายภาษีสรรพากร 10% (-${formatMarbleCompact(taxAmount)})`,
        'TOLL'
      );
      this.callbacks.onFloatingText?.({
        tileIndex: player.tileIndex,
        text: `-${formatMarbleCompact(taxAmount)} TAX`,
        colorHex: '#DC2626',
      });
      this.callbacks.onTaxPaid?.({
        payerId: player.id,
        amount: taxAmount,
        tileIndex: player.tileIndex,
      });
      this.finishTileResolution();
    } else {
      this.enqueueOrStartDebt({
        debtorId: player.id,
        creditorId: 'BANK',
        amountOwed: taxAmount,
        sourceTileIndex: 30,
        allowPostPayTakeover: false,
        isFromSkillPull: false,
      });
    }
  }

  // --------------------------------------------------------------------------
  // BOARD TARGET PICKER RESOLUTION
  // --------------------------------------------------------------------------

  public selectBoardTargetTile(tileIndex: number): boolean {
    if (!this.matchState || this.matchState.phase !== 'BOARD_TARGET_PICK') return false;
    if (!this.matchState.boardPickValidTiles.includes(tileIndex)) return false;

    const reason = this.matchState.boardPickReason;
    const player = this.matchState.players[this.matchState.activePlayerId];
    const tile = this.matchState.tiles[tileIndex];
    const def = WORLD_MAP_TILES[tileIndex];

    this.matchState.boardPickReason = null;
    this.matchState.boardPickValidTiles = [];
    this.matchState.phase = 'TILE_RESOLUTION';

    switch (reason) {
      case 'BLACK_HOLE_PLACE': {
        const whiteIdx = this.matchState.pendingBlackHoleLandmarkIndex ?? player.tileIndex;
        this.matchState.pendingBlackHoleLandmarkIndex = null;
        this.matchState.blackHole = {
          blackTileIndex: tileIndex,
          whiteTileIndex: whiteIdx,
          ownerId: player.id,
        };
        this.appendLog(
          player.id,
          `🌀 ${player.name} วางหลุมดำที่ ${def.nameTh} เชื่อมมายัง ${WORLD_MAP_TILES[whiteIdx].nameTh}!`,
          'SKILL'
        );
        this.callbacks.onFloatingText?.({
          tileIndex,
          text: `🌀 BLACK HOLE!`,
          colorHex: '#7C3AED',
        });
        this.finishTileResolution();
        return true;
      }

      case 'OLYMPIC_SELECT': {
        const isFree = this.matchState.pendingOlympicIsFree;
        this.matchState.pendingOlympicIsFree = false;
        this.applyOlympicExpoToTile(tileIndex, player, isFree);
        this.finishTileResolution();
        return true;
      }

      case 'BLACKOUT_SELECT': {
        const targetOwner = tile.ownerId ? this.matchState.players[tile.ownerId] : null;
        if (targetOwner && targetOwner.hasAngelCard) {
          targetOwner.hasAngelCard = false;
          this.callbacks.onAngelCardUsed?.({
            playerId: targetOwner.id,
            tileIndex,
            targetName: def.nameTh,
            reason: 'BLACKOUT',
          });
          this.appendLog(
            targetOwner.id,
            `👼 การ์ดนางฟ้าของ ${targetOwner.name} ทำงาน! ป้องกันการ์ดไฟดับที่ ${def.nameTh} สำเร็จ!`,
            'SKILL'
          );
          this.callbacks.onFloatingText?.({
            tileIndex,
            text: `👼 นางฟ้ากันไฟดับ!`,
            colorHex: '#FDE047',
          });
          this.finishTileResolution();
          return true;
        }

        tile.isBlackout = true;
        this.appendLog(
          player.id,
          `🔌 ${player.name} ใช้การ์ดไฟดับ ตัดไฟเมือง ${def.nameTh} (ค่าผ่านทางเหลือ 0 M)!`,
          'SKILL'
        );
        this.callbacks.onFloatingText?.({
          tileIndex,
          text: `🔌 ไฟดับ (x0)!`,
          colorHex: '#38BDF8',
        });
        this.finishTileResolution();
        return true;
      }

      case 'START_UPGRADE_CITY': {
        if (tile.buildingLevel < BuildingLevel.LANDMARK) {
          tile.buildingLevel = (tile.buildingLevel + 1) as BuildingLevel;
          const isNowLm = tile.buildingLevel === BuildingLevel.LANDMARK;
          this.appendLog(
            player.id,
            `⬆️ ${player.name} ใช้สิทธิ์จุด START อัปเกรด ${def.nameTh} เป็น ${isNowLm ? 'แลนด์มาร์ก!' : `ระดับ ${tile.buildingLevel}`}`,
            'BUILD'
          );
          this.callbacks.onFloatingText?.({
            tileIndex,
            text: isNowLm ? `🏛️ LANDMARK!` : `⬆️ UPGRADE!`,
            colorHex: player.colorHex,
          });
          // Landmark skills (M01, M02, M08, M10, S06) ONLY trigger on manual build during normal turn, NEVER from START or skills!
        }
        this.finishTileResolution();
        return true;
      }

      case 'DISRUPT_SELL_OR_SWAP': {
        const prevOwner = tile.ownerId ? this.matchState.players[tile.ownerId] : null;
        if (prevOwner && prevOwner.hasAngelCard) {
          prevOwner.hasAngelCard = false;
          this.callbacks.onAngelCardUsed?.({
            playerId: prevOwner.id,
            tileIndex,
            targetName: def.nameTh,
            reason: 'DISRUPT',
          });
          this.appendLog(
            prevOwner.id,
            `👼 การ์ดนางฟ้าของ ${prevOwner.name} ทำงาน! ป้องกันการบังคับขาย/สลับเมืองที่ ${def.nameTh} สำเร็จ!`,
            'SKILL'
          );
          this.callbacks.onFloatingText?.({
            tileIndex,
            text: `👼 นางฟ้าป้องกันเมือง!`,
            colorHex: '#FDE047',
          });
          this.finishTileResolution();
          return true;
        }

        const ownNonLandmarks = this.matchState.tiles.filter(
          (t) =>
            WORLD_MAP_TILES[t.index].type === 'CITY' &&
            t.ownerId === player.id &&
            t.buildingLevel >= BuildingLevel.LAND &&
            t.buildingLevel < BuildingLevel.LANDMARK
        );

        if (this.matchState.disruptMode === 'SWAP' && ownNonLandmarks.length > 0 && prevOwner) {
          // Swap player's lowest-value non-Landmark city with the target enemy city
          ownNonLandmarks.sort(
            (a, b) =>
              this.calculateTilePropertyValue(a.index) - this.calculateTilePropertyValue(b.index)
          );
          const myLowestTile = ownNonLandmarks[0];
          const myDef = WORLD_MAP_TILES[myLowestTile.index];

          myLowestTile.ownerId = prevOwner.id;
          tile.ownerId = player.id;

          this.appendLog(
            player.id,
            `🔮 ${player.name} ใช้สกิลสลับโฉนด! นำเมือง ${myDef.nameTh} สลับกับ ${def.nameTh} ของ ${prevOwner.name}!`,
            'SKILL'
          );
          this.callbacks.onFloatingText?.({
            tileIndex,
            text: `🔮 SWAPPED!`,
            colorHex: '#9333EA',
          });
        } else {
          // Force-Sell enemy city back to bank
          const refund = this.calculateTileSellRefund(tileIndex);
          if (prevOwner) {
            prevOwner.marble += refund;
          }
          tile.ownerId = null;
          tile.buildingLevel = BuildingLevel.NONE;
          tile.olympicMultiplier = 1;
          tile.stepMultiplier = 1;

          this.appendLog(
            player.id,
            `🔮 ${player.name} บังคับขายเมือง ${def.nameTh} ของ ${prevOwner?.name ?? 'ศัตรู'} คืนธนาคาร!`,
            'SKILL'
          );
          this.callbacks.onFloatingText?.({
            tileIndex,
            text: `🔮 บังคับขาย!`,
            colorHex: '#9333EA',
          });
        }

        if (this.checkAndApplyVictoryConditions()) {
          this.emitStateChange();
          return true;
        }
        this.finishTileResolution();
        return true;
      }

      case 'WORLD_TRAVEL_DEST': {
        const isFree = this.matchState.freeWorldTravelMap[player.id] ?? false;
        const fee = isFree ? 0 : MATCH_CONFIG.worldTravelTicketCost;
        if (fee > 0) {
          player.marble = Math.max(0, player.marble - fee);
        }
        player.isWaitingTravel = false;
        this.matchState.freeWorldTravelMap[player.id] = false;

        // If flying past START (or to START), check if they wrapped around
        if (tileIndex === 0 || tileIndex < 24) {
          this.awardStartSalary(player);
        }

        this.appendLog(
          player.id,
          `✈️ ${player.name} บินลัดฟ้าไปลงที่ ${def.nameTh}!`,
          'MOVE'
        );

        // Animate single warp hop to destination
        this.matchState.pendingMovePath = [tileIndex];
        this.matchState.pendingSteppedCount = 1; // Already processed START wrap
        player.tileIndex = tileIndex;
        this.matchState.phase = 'PIECE_MOVING';
        this.emitStateChange();
        return true;
      }

      case 'LINE_TELEPORT_DEST': {
        this.appendLog(
          player.id,
          `🔮 ${player.name} วาร์ปในแถวเดียวกันไปยัง ${def.nameTh} ทันที!`,
          'SKILL'
        );
        this.callbacks.onFloatingText?.({
          tileIndex,
          text: `🔮 ROW WARP!`,
          colorHex: '#9333EA',
        });

        // Animate single warp hop to destination in same row
        this.matchState.pendingMovePath = [tileIndex];
        this.matchState.pendingSteppedCount = 1;
        player.tileIndex = tileIndex;
        this.matchState.phase = 'PIECE_MOVING';
        this.emitStateChange();
        return true;
      }
    }

    this.finishTileResolution();
    return true;
  }

  // --------------------------------------------------------------------------
  // DEBT, BANK LOAN, CITY SELL-BACK & BANKRUPTCY RESOLUTION
  // --------------------------------------------------------------------------

  private enqueueOrStartDebt(debt: PendingDebtState): void {
    if (!this.matchState) return;
    if (!this.matchState.pendingDebt) {
      this.matchState.pendingDebt = debt;
      this.matchState.phase = 'DEBT_RESOLUTION';
    } else {
      this.matchState.pendingDebtQueue.push(debt);
    }
    this.emitStateChange();
  }

  public takeBankLoan(): boolean {
    if (!this.matchState || !this.matchState.pendingDebt) return false;
    const debtor = this.matchState.players[this.matchState.pendingDebt.debtorId];
    if (!debtor || debtor.loanUsed) return false;

    debtor.loanUsed = true;
    debtor.marble += MATCH_CONFIG.bankLoanAmount;
    this.appendLog(
      debtor.id,
      `🏦 ${debtor.name} กู้เงินฉุกเฉินจากธนาคาร +${formatMarbleCompact(MATCH_CONFIG.bankLoanAmount)}!`,
      'TOLL'
    );
    this.callbacks.onFloatingText?.({
      tileIndex: debtor.tileIndex,
      text: `+${formatMarbleCompact(MATCH_CONFIG.bankLoanAmount)} LOAN`,
      colorHex: '#0284C7',
    });

    this.emitStateChange();
    return true;
  }

  public sellOwnedTileForDebt(tileIndex: number): boolean {
    if (!this.matchState || !this.matchState.pendingDebt) return false;
    const debtor = this.matchState.players[this.matchState.pendingDebt.debtorId];
    const tile = this.matchState.tiles[tileIndex];
    const def = WORLD_MAP_TILES[tileIndex];

    if (!debtor || !tile || tile.ownerId !== debtor.id) return false;

    const refund = this.calculateTileSellRefund(tileIndex);
    debtor.marble += refund;
    tile.ownerId = null;
    tile.buildingLevel = BuildingLevel.NONE;
    tile.olympicMultiplier = 1;
    tile.stepMultiplier = 1;

    this.appendLog(
      debtor.id,
      `🏚️ ${debtor.name} ขายเมือง ${def.nameTh} คืนธนาคาร รับเงิน +${formatMarbleCompact(refund)}`,
      'TOLL'
    );
    this.callbacks.onFloatingText?.({
      tileIndex,
      text: `+${formatMarbleCompact(refund)} SOLD`,
      colorHex: '#D97706',
    });

    this.emitStateChange();
    return true;
  }

  public payResolvedDebt(): boolean {
    if (!this.matchState || !this.matchState.pendingDebt) return false;
    const debt = this.matchState.pendingDebt;
    const debtor = this.matchState.players[debt.debtorId];
    if (!debtor || debtor.marble < debt.amountOwed) return false;

    debtor.marble -= debt.amountOwed;
    if (debt.creditorId !== 'BANK') {
      const creditor = this.matchState.players[debt.creditorId];
      if (creditor) {
        creditor.marble += debt.amountOwed;
      }
    }

    this.appendLog(
      debtor.id,
      `✅ ${debtor.name} ชำระหนี้ค่าผ่านทาง ${formatMarbleCompact(debt.amountOwed)} สำเร็จ!`,
      'TOLL'
    );

    this.advanceDebtQueueOrResume(debt);
    return true;
  }

  public declareBankruptcy(): void {
    if (!this.matchState || !this.matchState.pendingDebt) return;
    const debt = this.matchState.pendingDebt;
    const debtor = this.matchState.players[debt.debtorId];
    if (!debtor) return;

    // Liquidate all remaining cities of debtor
    let liquidatedCash = debtor.marble;
    for (const tile of this.matchState.tiles) {
      if (tile.ownerId === debtor.id) {
        liquidatedCash += this.calculateTileSellRefund(tile.index);
        tile.ownerId = null;
        tile.buildingLevel = BuildingLevel.NONE;
        tile.olympicMultiplier = 1;
        tile.stepMultiplier = 1;
      }
    }

    if (debt.creditorId !== 'BANK') {
      const creditor = this.matchState.players[debt.creditorId];
      if (creditor) {
        creditor.marble += liquidatedCash;
      }
    }

    debtor.marble = 0;
    debtor.isBankrupt = true;
    debtor.isWaitingTravel = false;
    debtor.islandTurnsLeft = 0;

    this.appendLog(debtor.id, `💥 ${debtor.name} ล้มละลาย (BANKRUPT)!`, 'SYSTEM');
    this.callbacks.onToastBanner?.(`💥 ${debtor.name} ล้มละลาย!`, '#DC2626');

    if (this.checkAndApplyVictoryConditions(debtor.id)) {
      this.matchState.pendingDebt = null;
      this.matchState.pendingDebtQueue = [];
      this.emitStateChange();
      return;
    }

    this.advanceDebtQueueOrResume(debt);
  }

  private advanceDebtQueueOrResume(finishedDebt: PendingDebtState): void {
    if (!this.matchState) return;
    const nextDebt = this.matchState.pendingDebtQueue.shift() ?? null;
    this.matchState.pendingDebt = nextDebt;

    if (nextDebt) {
      this.matchState.phase = 'DEBT_RESOLUTION';
      this.emitStateChange();
      return;
    }

    this.matchState.phase = 'TILE_RESOLUTION';
    const activePlayer = this.matchState.players[this.matchState.activePlayerId];

    // If a Black Hole placement was queued from Landmark hooks, open it now
    if (this.matchState.pendingBlackHoleLandmarkIndex !== null) {
      this.openBlackHolePlacementPicker(
        activePlayer,
        this.matchState.pendingBlackHoleLandmarkIndex
      );
      return;
    }

    if (!finishedDebt.isFromSkillPull) {
      const debtor = this.matchState.players[finishedDebt.debtorId];
      const tile = this.matchState.tiles[finishedDebt.sourceTileIndex];
      const def = WORLD_MAP_TILES[finishedDebt.sourceTileIndex];
      if (!debtor.isBankrupt && tile && def && (def.type === 'CITY' || def.type === 'TOURISM')) {
        this.proceedAfterEnemyTollPaid(debtor, tile, def, finishedDebt.amountOwed);
        return;
      }
    }

    this.finishTileResolution();
  }

  // --------------------------------------------------------------------------
  // END OF TILE RESOLUTION -> HOOK 12 (M09_VICTORY_HORN) & TURN ADVANCE
  // --------------------------------------------------------------------------

  private finishTileResolution(): void {
    if (!this.matchState) return;
    this.matchState.activePrompt = null;
    this.matchState.boardPickReason = null;
    this.matchState.boardPickValidTiles = [];

    if (this.checkAndApplyVictoryConditions()) {
      this.emitStateChange();
      return;
    }

    const activePlayer = this.matchState.players[this.matchState.activePlayerId];

    // If M10 Row Teleport was queued from Landmark build (e.g. after Black Hole placement or debt queue), open it now
    if (this.matchState.pendingLineTeleportLandmarkIndex !== null) {
      const lmIdx = this.matchState.pendingLineTeleportLandmarkIndex;
      this.matchState.pendingLineTeleportLandmarkIndex = null;
      if (
        activePlayer &&
        !activePlayer.isBankrupt &&
        activePlayer.islandTurnsLeft === 0 &&
        !activePlayer.isWaitingTravel
      ) {
        this.openLineTeleportPicker(activePlayer, lmIdx);
        return;
      }
    }

    this.updateMonopolyAlerts();
    const builtNow = this.builtThisResolution;
    this.builtThisResolution = false;
    // Hook 12: ON_MONOPOLY_ALERT -> M09_VICTORY_HORN (extra roll without increasing consecutiveDoubles)
    // Only fires right after the player built/upgraded (a build that put them 1 tile from Monopoly).
    if (
      builtNow &&
      activePlayer &&
      !activePlayer.isBankrupt &&
      activePlayer.islandTurnsLeft === 0 &&
      // Waiting at Sky Terminal can't take an extra roll — don't burn the 1/match use
      !activePlayer.isWaitingTravel &&
      !this.matchState.extraRollGranted
    ) {
      const hasMyMonopolyAlert = this.matchState.monopolyAlerts.some((a) =>
        this.arePlayersAllied(activePlayer.id, a.ownerPlayerId)
      );
      if (hasMyMonopolyAlert && this.tryTriggerSkill(activePlayer, 'M09_VICTORY_HORN')) {
        this.matchState.extraRollGranted = true;
        this.appendLog(
          activePlayer.id,
          `📢 โทรโข่งชัยชนะทำงาน! ขาดอีก 1 ช่องจะชนะ Monopoly ได้ทอยเต๋าต่อทันที!`,
          'SKILL'
        );
      }
    }

    this.finishTurnOrExtraRoll();
  }

  private finishTurnOrExtraRoll(): void {
    if (!this.matchState) return;
    if (this.checkAndApplyVictoryConditions()) {
      this.emitStateChange();
      return;
    }

    const activePlayer = this.matchState.players[this.matchState.activePlayerId];

    // If extraRollGranted and player is not trapped on Desert Island or waiting travel
    if (
      this.matchState.extraRollGranted &&
      activePlayer &&
      !activePlayer.isBankrupt &&
      activePlayer.islandTurnsLeft === 0 &&
      !activePlayer.isWaitingTravel
    ) {
      this.matchState.extraRollGranted = false;
      this.matchState.phase = 'IDLE_ROLL';
      this.appendLog(
        activePlayer.id,
        `🎲 ${activePlayer.name} ได้สิทธิ์ทอยเต๋าเพิ่มอีก 1 ครั้ง!`,
        'DICE'
      );
      this.emitStateChange();
      return;
    }

    // Advance to next non-bankrupt player
    let nextIdx = this.matchState.activePlayerIndex;
    let wrappedRound = false;

    for (let step = 0; step < PLAYER_IDS.length; step++) {
      nextIdx = (nextIdx + 1) % PLAYER_IDS.length;
      if (nextIdx === 0) {
        wrappedRound = true;
      }
      const candidateId = PLAYER_IDS[nextIdx];
      if (!this.matchState.players[candidateId].isBankrupt) {
        break;
      }
    }

    if (wrappedRound) {
      if (this.matchState.turnNumber >= this.matchState.maxTurns) {
        this.resolveTurnLimitVictory();
        this.emitStateChange();
        return;
      }
      this.matchState.turnNumber += 1;
      if (this.matchState.turnNumber === MATCH_CONFIG.lateGameTurnThreshold) {
        this.appendLog(
          'P1',
          `🔥 เข้าสู่ช่วง 5 เทิร์นสุดท้าย (Turn ${this.matchState.turnNumber}/20)! ค่าผ่านทางทุกช่องเพิ่มขึ้น x1.5!`,
          'SYSTEM'
        );
        this.callbacks.onToastBanner?.(
          `🔥 5 เทิร์นสุดท้าย! ค่าผ่านทางทั้งกระดาน x1.5!`,
          '#EA580C'
        );
      }
    }

    this.matchState.activePlayerIndex = nextIdx;
    this.matchState.activePlayerId = PLAYER_IDS[nextIdx];
    const nextPlayer = this.matchState.players[this.matchState.activePlayerId];
    nextPlayer.consecutiveDoubles = 0;
    this.matchState.extraRollGranted = false;

    if (nextPlayer.isWaitingTravel) {
      this.openWorldTravelPicker(nextPlayer);
      return;
    }

    this.matchState.phase = 'IDLE_ROLL';
    this.emitStateChange();
  }

  // --------------------------------------------------------------------------
  // 5 WIN CONDITIONS & MONOPOLY ALERT DETECTION
  // --------------------------------------------------------------------------

  private updateMonopolyAlerts(): void {
    if (!this.matchState) return;
    const alerts: MonopolyAlertInfo[] = [];
    const checkedRepresentatives =
      this.matchState.gameMode === 'TEAM_2V2'
        ? (['P1', 'P2'] as PlayerId[])
        : PLAYER_IDS.filter((pid) => !this.matchState!.players[pid].isBankrupt);

    for (const repId of checkedRepresentatives) {
      const rep = this.matchState.players[repId];
      if (!rep || rep.isBankrupt) continue;

      // 1. Check Tourism Monopoly Alert (owns 3 of 4 islands)
      const unownedTourism = TOURISM_TILE_INDICES.filter(
        (idx) => !this.arePlayersAllied(repId, this.matchState!.tiles[idx].ownerId)
      );
      if (unownedTourism.length === 1) {
        const missIdx = unownedTourism[0];
        alerts.push({
          ownerPlayerId: repId,
          teamId: rep.teamId,
          alertType: 'TOURISM_MONOPOLY',
          labelTh: `⚠️ เตือนเกาะท่องเที่ยว x5! ขาดแค่ ${WORLD_MAP_TILES[missIdx].nameTh}`,
          missingTileIndex: missIdx,
        });
      }

      // 2. Check Line Monopoly Alert (owns N-1 of N tiles on any line)
      for (const line of [0, 1, 2, 3] as const) {
        const lineTiles = LINE_PURCHASABLE_TILES[line];
        const missing = lineTiles.filter(
          (idx) => !this.arePlayersAllied(repId, this.matchState!.tiles[idx].ownerId)
        );
        if (missing.length === 1) {
          const missIdx = missing[0];
          alerts.push({
            ownerPlayerId: repId,
            teamId: rep.teamId,
            alertType: 'LINE_MONOPOLY',
            labelTh: `⚠️ เตือนเรียงแถว x3 (แถว ${line + 1})! ขาดแค่ ${WORLD_MAP_TILES[missIdx].nameTh}`,
            missingTileIndex: missIdx,
          });
        }
      }

      // 3. Check Triple Color Monopoly Alert (already owns 2 groups, and 1 tile away in a 3rd group)
      let completedGroups = 0;
      const oneAwayGroups: number[] = [];
      for (let g = 1; g <= 7; g++) {
        const gTiles = COLOR_GROUP_TILES[g];
        const missing = gTiles.filter(
          (idx) => !this.arePlayersAllied(repId, this.matchState!.tiles[idx].ownerId)
        );
        if (missing.length === 0) {
          completedGroups += 1;
        } else if (missing.length === 1) {
          oneAwayGroups.push(missing[0]);
        }
      }
      if (completedGroups === 2 && oneAwayGroups.length > 0) {
        for (const missIdx of oneAwayGroups) {
          alerts.push({
            ownerPlayerId: repId,
            teamId: rep.teamId,
            alertType: 'TRIPLE_MONOPOLY',
            labelTh: `⚠️ เตือนคูณสี x2! ขาดแค่ ${WORLD_MAP_TILES[missIdx].nameTh}`,
            missingTileIndex: missIdx,
          });
        }
      }
    }

    this.matchState.monopolyAlerts = alerts;
  }

  private checkAndApplyVictoryConditions(justBankruptPlayerId?: PlayerId): boolean {
    if (!this.matchState) return false;
    if (this.matchState.victoryResult) return true;

    const mode = this.matchState.gameMode;

    // 1. Check Bankruptcy Victory
    if (mode === 'TEAM_2V2') {
      const alphaAlive = ['P1', 'P3'].some(
        (pid) => !this.matchState!.players[pid as PlayerId].isBankrupt
      );
      const bravoAlive = ['P2', 'P4'].some(
        (pid) => !this.matchState!.players[pid as PlayerId].isBankrupt
      );
      if (!alphaAlive || !bravoAlive) {
        const winningTeam: TeamId = alphaAlive ? 'ALPHA' : 'BRAVO';
        const winners = PLAYER_IDS.filter(
          (pid) => this.matchState!.players[pid].teamId === winningTeam
        );
        this.setVictory({
          winnerPlayerIds: winners,
          winnerTeam: winningTeam,
          winType: 'BANKRUPTCY',
          winTypeLabel: 'ชนะล้มละลาย (Bankruptcy Victory x1)',
          multiplier: MATCH_CONFIG.winRewardMultipliers.BANKRUPTCY,
        });
        return true;
      }
    } else {
      // FFA (2..4 Players): Match ends ONLY when only ONE player remains not bankrupt (sole survivor)
      const survivors = PLAYER_IDS.filter((pid) => {
        const p = this.matchState!.players[pid];
        return p.isSlotActive !== false && !p.isBankrupt;
      });
      if (survivors.length <= 1) {
        const topWinner = survivors[0] ?? 'P1';
        this.setVictory({
          winnerPlayerIds: [topWinner],
          winnerTeam: null,
          winType: 'BANKRUPTCY',
          winTypeLabel: 'ชนะล้มละลาย (Bankruptcy Victory x1)',
          multiplier: MATCH_CONFIG.winRewardMultipliers.BANKRUPTCY,
        });
        return true;
      }
    }

    // 2. Check Tourism, Line, and Triple Monopoly for each player/team
    const checkTargets =
      mode === 'TEAM_2V2'
        ? (['P1', 'P2'] as PlayerId[])
        : PLAYER_IDS.filter((pid) => !this.matchState!.players[pid].isBankrupt);

    for (const repId of checkTargets) {
      const rep = this.matchState.players[repId];
      const winnerIds =
        mode === 'TEAM_2V2'
          ? PLAYER_IDS.filter((pid) => this.matchState!.players[pid].teamId === rep.teamId)
          : [repId];

      // 2a. Tourism Monopoly (All 5 Tourism Islands: x5)
      if (this.countOwnedTourismIslands(repId) >= 5) {
        this.setVictory({
          winnerPlayerIds: winnerIds,
          winnerTeam: rep.teamId,
          winType: 'TOURISM_MONOPOLY',
          winTypeLabel: 'ชนะยึดเกาะท่องเที่ยวครบ 5 เกาะ (Tourism Monopoly x5)!',
          multiplier: MATCH_CONFIG.winRewardMultipliers.TOURISM_MONOPOLY,
        });
        return true;
      }

      // 2b. Line Monopoly (All purchasable tiles on any 1 of the 4 board edges: x3)
      for (const line of [0, 1, 2, 3] as const) {
        const lineTiles = LINE_PURCHASABLE_TILES[line];
        if (
          lineTiles.every((idx) =>
            this.arePlayersAllied(repId, this.matchState!.tiles[idx].ownerId)
          )
        ) {
          this.setVictory({
            winnerPlayerIds: winnerIds,
            winnerTeam: rep.teamId,
            winType: 'LINE_MONOPOLY',
            winTypeLabel: `ชนะยึดเรียงแถวด้านที่ ${line + 1} (Line Monopoly x3)!`,
            multiplier: MATCH_CONFIG.winRewardMultipliers.LINE_MONOPOLY,
          });
          return true;
        }
      }

      // 2c. Triple Monopoly (3 complete Color Groups: x2)
      let colorGroupsOwned = 0;
      for (let g = 1; g <= 7; g++) {
        if (this.isColorGroupMonopoly(g, repId)) {
          colorGroupsOwned += 1;
        }
      }
      if (colorGroupsOwned >= 3) {
        this.setVictory({
          winnerPlayerIds: winnerIds,
          winnerTeam: rep.teamId,
          winType: 'TRIPLE_MONOPOLY',
          winTypeLabel: 'ชนะยึดเมืองครบ 3 สี (Triple Monopoly x2)!',
          multiplier: MATCH_CONFIG.winRewardMultipliers.TRIPLE_MONOPOLY,
        });
        return true;
      }
    }

    return false;
  }

  private resolveTurnLimitVictory(): void {
    if (!this.matchState) return;
    if (this.matchState.gameMode === 'TEAM_2V2') {
      const alphaAssets =
        this.calculatePlayerTotalAssets('P1') + this.calculatePlayerTotalAssets('P3');
      const bravoAssets =
        this.calculatePlayerTotalAssets('P2') + this.calculatePlayerTotalAssets('P4');
      const winningTeam: TeamId = alphaAssets >= bravoAssets ? 'ALPHA' : 'BRAVO';
      const winners = PLAYER_IDS.filter(
        (pid) => this.matchState!.players[pid].teamId === winningTeam
      );
      this.setVictory({
        winnerPlayerIds: winners,
        winnerTeam: winningTeam,
        winType: 'TURN_LIMIT_ASSET',
        winTypeLabel: 'ชนะนับสินทรัพย์รวมเมื่อครบ 20 เทิร์น (Asset Victory x1)',
        multiplier: MATCH_CONFIG.winRewardMultipliers.TURN_LIMIT_ASSET,
      });
    } else {
      const survivors = PLAYER_IDS.filter((pid) => {
        const p = this.matchState!.players[pid];
        return p.isSlotActive !== false && !p.isBankrupt;
      });
      survivors.sort(
        (a, b) => this.calculatePlayerTotalAssets(b) - this.calculatePlayerTotalAssets(a)
      );
      const topWinner = survivors[0] ?? 'P1';
      this.setVictory({
        winnerPlayerIds: [topWinner],
        winnerTeam: null,
        winType: 'TURN_LIMIT_ASSET',
        winTypeLabel: 'ชนะนับสินทรัพย์สูงสุดเมื่อครบ 20 เทิร์น (Asset Victory x1)',
        multiplier: MATCH_CONFIG.winRewardMultipliers.TURN_LIMIT_ASSET,
      });
    }
  }

  private setVictory(result: VictoryResult): void {
    if (!this.matchState) return;
    this.matchState.victoryResult = result;
    this.matchState.phase = 'VICTORY_SUMMARY';
    this.matchState.activePrompt = null;
    this.matchState.boardPickReason = null;
    this.matchState.boardPickValidTiles = [];

    const names = result.winnerPlayerIds
      .map((pid) => this.matchState!.players[pid].name)
      .join(' & ');
    this.appendLog(
      result.winnerPlayerIds[0] ?? 'P1',
      `🏆 ผู้ชนะ: ${names} — ${result.winTypeLabel}!`,
      'SYSTEM'
    );
  }

  // --------------------------------------------------------------------------
  // SMART AI BOT AUTOMATION (Hybrid Rule-Tree + 1-Turn Expectimax Lookahead)
  // --------------------------------------------------------------------------

  /**
   * Runs the AI pre-roll planner (Island bail check + Odd/Even selection + Expectimax Gauge Target)
   * and returns the optimal gauge target (2.00 .. 12.00) for 3D dice animation.
   */
  public prepareAiRollAndGetGaugeTarget(): number {
    if (!this.matchState) return 7.0;
    const ai = this.matchState.players[this.matchState.activePlayerId];
    if (!ai || ai.isBankrupt) return 7.0;

    const plan = planAiRollDecision(this, this.matchState, ai);
    if (plan.payBailFirst && ai.islandTurnsLeft > 0) {
      this.payDesertIslandBail();
    }
    if (plan.oddEvenMode !== 'NONE' && ai.oddEvenCharges > 0) {
      this.toggleOddEvenMode(plan.oddEvenMode);
    } else if (ai.selectedOddEven !== 'NONE') {
      this.toggleOddEvenMode('NONE');
    }
    return plan.gaugeTarget;
  }

  /**
   * Executes one intelligent AI decision step if the current active decision-maker
   * (either activePlayer or the debtor in DEBT_RESOLUTION) is an AI_BOT.
   * Returns true if an AI action was executed.
   */
  public stepAiTurn(): boolean {
    if (!this.matchState || this.matchState.phase === 'VICTORY_SUMMARY') return false;

    // 1. Handle AI Debt Resolution (even if debtor is a pulled enemy during another player's turn!)
    if (this.matchState.phase === 'DEBT_RESOLUTION' && this.matchState.pendingDebt) {
      const debt = this.matchState.pendingDebt;
      const debtor = this.matchState.players[debt.debtorId];
      if (!debtor || debtor.controlType !== 'AI_BOT') return false;

      if (debtor.marble >= debt.amountOwed) {
        this.payResolvedDebt();
        return true;
      }

      if (!debtor.loanUsed) {
        this.takeBankLoan();
        return true;
      }

      // Sell least strategically critical property first (protecting Monopolies & Landmarks)
      const tileToSell = selectBestTileToSellForDebt(this, this.matchState, debtor);
      if (tileToSell !== null) {
        this.sellOwnedTileForDebt(tileToSell);
        return true;
      }

      this.declareBankruptcy();
      return true;
    }

    const ai = this.matchState.players[this.matchState.activePlayerId];
    if (!ai || ai.controlType !== 'AI_BOT' || ai.isBankrupt) return false;

    // 2. IDLE_ROLL -> Run Expectimax + Rule-Tree Planner & Roll
    if (this.matchState.phase === 'IDLE_ROLL') {
      const aimedGauge = this.prepareAiRollAndGetGaugeTarget();
      this.startGaugeCharge();
      this.releaseGaugeRoll(aimedGauge);
      return true;
    }

    if (this.matchState.phase === 'GAUGE_CHARGING') {
      const plan = planAiRollDecision(this, this.matchState, ai);
      this.releaseGaugeRoll(plan.gaugeTarget);
      return true;
    }

    // 3. TILE_RESOLUTION Prompts
    if (this.matchState.phase === 'TILE_RESOLUTION' && this.matchState.activePrompt) {
      const prompt = this.matchState.activePrompt;

      if (prompt.type === 'BUY_OR_UPGRADE_CITY') {
        const chosenLevel = decideAiBuildLevel(this, this.matchState, ai);
        if (chosenLevel !== null) {
          this.confirmBuildOrUpgrade(chosenLevel);
        } else {
          this.skipBuildOrUpgrade();
        }
        return true;
      }

      if (prompt.type === 'TAKEOVER_PROMPT') {
        if (decideAiTakeover(this, this.matchState, ai)) {
          this.confirmTakeover();
        } else {
          this.skipTakeover();
        }
        return true;
      }

      if (prompt.type === 'BONUS_COIN_GAME') {
        const decision = decideAiBonusCoinAction(this, this.matchState, ai);
        if (decision.action === 'FLIP') {
          this.flipBonusCoin(decision.choice);
        } else {
          this.takeBonusReward();
        }
        return true;
      }

      if (prompt.type === 'FORTUNE_CARD_MODAL') {
        this.confirmFortuneCard();
        return true;
      }
    }

    // 4. BOARD_TARGET_PICK -> Run Tactical Board Target Picker Tree
    if (
      this.matchState.phase === 'BOARD_TARGET_PICK' &&
      this.matchState.boardPickValidTiles.length > 0
    ) {
      const pick = decideAiBoardTarget(this, this.matchState, ai);
      if (pick.disruptMode) {
        this.setDisruptMode(pick.disruptMode);
      }
      this.selectBoardTargetTile(pick.tileIndex);
      return true;
    }

    return false;
  }
}