/**
 * LINE Let's Get Rich (Peak Era Recreation) — Golden Source of Truth Data & Types
 * Includes:
 * - 32-Tile World Map
 * - Two-Stage Continuous Gauge Dice Tables (2.00 .. 12.00)
 * - 5 Core Stats (+0 to +5)
 * - 20 Skills (M01..M10 and S01..S10) with (÷3) × 1.6 Balanced Rates
 * - 8 Characters (5 Stats + 1 Main + 2 Subs)
 * - 10 Treasures (1 Unique Main + 1 Sub, no duplicate Main with Character)
 */

import characterConfigData from './character_config.json';
import treasureConfigData from './treasure_config.json';

export type GameMode = 'FFA_4P' | 'TEAM_2V2';
export type ControlType = 'HUMAN' | 'AI_BOT';
export type PlayerId = 'P1' | 'P2' | 'P3' | 'P4';
export type TeamId = 'ALPHA' | 'BRAVO' | null;
export type OddEvenMode = 'NONE' | 'ODD' | 'EVEN';

export enum BuildingLevel {
  NONE = 0,
  LAND = 1,
  VILLA = 2,
  BUILDING = 3,
  HOTEL = 4,
  LANDMARK = 5,
}

export type TileType =
  | 'START'
  | 'CITY'
  | 'BONUS_GAME'
  | 'CHANCE'
  | 'TOURISM'
  | 'DESERT_ISLAND'
  | 'OLYMPIC'
  | 'WORLD_TRAVEL'
  | 'TAX_AUDIT';

export type MainSkillId =
  | 'M01_MAGNET'
  | 'M02_BLACK_HOLE'
  | 'M03_BUILD_TO_START'
  | 'M04_BUILD_TO_TRAVEL'
  | 'M05_HEALING_TRAVEL'
  | 'M06_SUPER_PERFUME'
  | 'M06_INSTANT_LANDMARK' // Deprecated fallback
  | 'M07_WRONG_GUIDEBOOK'
  | 'M08_AIRPORT_RECALL'
  | 'M09_VICTORY_HORN'
  | 'M10_DISRUPT_CITY';

export type SubSkillId =
  | 'S01_PERFUME_STEAL'
  | 'S02_SHERIFF_TAX'
  | 'S03_ISLAND_ESCAPE'
  | 'S04_TRIPLE_DBL_FLY'
  | 'S05_STEP_TOLL_X2'
  | 'S06_AUTO_EXPO'
  | 'S07_BLACK_CARD'
  | 'S08_TAKEOVER_SHIELD'
  | 'S09_COIN_MASTER'
  | 'S10_DOUBLE_BOOST';

export type SkillId = MainSkillId | SubSkillId;

export type ScreenState = 'MAIN_MENU' | 'LOBBY' | 'LOADOUT' | 'IN_GAME';

export type TurnPhase =
  | 'IDLE_ROLL'
  | 'GAUGE_CHARGING'
  | 'DICE_ANIMATING'
  | 'PIECE_MOVING'
  | 'TILE_RESOLUTION'
  | 'BOARD_TARGET_PICK'
  | 'DEBT_RESOLUTION'
  | 'VICTORY_SUMMARY';

export type BoardPickReason =
  | 'BLACK_HOLE_PLACE'
  | 'OLYMPIC_SELECT'
  | 'WORLD_TRAVEL_DEST'
  | 'START_UPGRADE_CITY'
  | 'DISRUPT_SELL_OR_SWAP'
  | 'BLACKOUT_SELECT'
  | 'LINE_TELEPORT_DEST';

export type FortuneCardId =
  | 'ANGEL_SHIELD'
  | 'DISCOUNT_COUPON'
  | 'FREE_START_PASS'
  | 'HOST_OLYMPIC_FREE'
  | 'WORLD_TRAVEL_INVITE'
  | 'POWER_OUTAGE'
  | 'FORCED_SALE_OR_SWAP'
  | 'CHARITY_TAX'
  | 'ISLAND_EXILE';

export interface FortuneCardDef {
  cardId: FortuneCardId;
  emoji: string;
  titleTh: string;
  titleEn: string;
  category: 'BUFF' | 'DISRUPT' | 'HAZARD';
  weightPct: number;
  descTh: string;
}

export interface SkillDefinition {
  id: SkillId;
  code: string;
  slotCategory: 'MAIN' | 'SUB';
  name: string;
  nameEn: string;
  trigger: string;
  effectDesc: string;
  charPct: number;
  treasurePct: number;
  maxUsesPerMatch: number | null;
}

export interface CharacterStats {
  dc: number;       // 0..5 -> 10%..20% (+2%/lv) + subtle gauge speed reduction (-1.8%/lv)
  constDc: number;  // 0..5 -> 0%..20% (+4%/lv)
  acqDc: number;    // 0..5 -> 0%..25% (+5%/lv)
  tollDc: number;   // 0..5 -> 0%..20% (+4%/lv)
  salLuck: number;  // 0..5 -> 0%..40% (+8%/lv)
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  rank: 'S+' | 'S' | 'A+';
  avatarEmoji: string;
  accentColor: string;
  stats: CharacterStats;
  mainSkill: { skillId: MainSkillId; procPct: number };
  subSkills: [
    { skillId: SubSkillId; procPct: number },
    { skillId: SubSkillId; procPct: number }
  ];
}

export interface TreasureDef {
  id: string;
  name: string;
  nameEn: string;
  iconEmoji: string;
  mainSkill: { skillId: MainSkillId; procPct: number; maxUses?: number };
  subSkill: { skillId: SubSkillId; procPct: number; maxUses?: number };
}

export interface WorldTileDef {
  index: number;
  line: 0 | 1 | 2 | 3;
  name: string;
  nameTh: string;
  type: TileType;
  group: number | null;
  tourismGroup?: 'BLUE' | 'RED';
  colorHex: string;
  baseCost: number;
  baseToll: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  colorHex: string;
  teamId: TeamId;
  controlType: ControlType;
  characterId: string;
  treasureIds: [string, string, string];
  marble: number;
  loanUsed: boolean;
  isBankrupt: boolean;
  isSlotActive?: boolean;
  tileIndex: number;
  lapCount: number;
  islandTurnsLeft: number;
  isWaitingTravel: boolean;
  consecutiveDoubles: number;
  oddEvenCharges: number;
  selectedOddEven: OddEvenMode;
  skillUsesRemaining: Record<string, number>;
  hasAngelCard?: boolean;
  hasDiscountCoupon?: boolean;
  connected?: boolean;
}

export interface BoardTileState {
  index: number;
  ownerId: PlayerId | null;
  buildingLevel: BuildingLevel;
  isFestival: boolean;
  isBlackout?: boolean;
  olympicMultiplier: number;
  stepMultiplier: number;
}

export interface BlackHoleState {
  blackTileIndex: number;
  whiteTileIndex: number;
  ownerId: PlayerId;
}

export interface PendingDebtState {
  debtorId: PlayerId;
  creditorId: PlayerId | 'BANK';
  amountOwed: number;
  sourceTileIndex: number;
  allowPostPayTakeover: boolean;
  isFromSkillPull: boolean;
}

export interface PendingBonusGameState {
  playerId: PlayerId;
  round: 1 | 2 | 3;
  currentReward: number;
  hasCoinMasterRetry: boolean;
  autoWonRound1: boolean;
}

export interface VictoryResult {
  winnerPlayerIds: PlayerId[];
  winnerTeam: TeamId;
  winType: 'BANKRUPTCY' | 'TRIPLE_MONOPOLY' | 'LINE_MONOPOLY' | 'TOURISM_MONOPOLY' | 'TURN_LIMIT_ASSET';
  winTypeLabel: string;
  multiplier: number;
}

// 1. MATCH & ECONOMY CONSTANTS
export const MATCH_CONFIG = {
  boardSize: 32,
  maxPlayers: 4,
  supportedModes: ['FFA_4P', 'TEAM_2V2'] as const,
  startingMarble: 2_000_000,
  startingMarbleByPlayer: {
    P1: 1_800_000,
    P2: 1_900_000,
    P3: 2_100_000,
    P4: 2_200_000,
  } as const,
  salaryAmount: 300_000,
  bankLoanAmount: 1_000_000,
  maxLoansPerPlayer: 1,
  desertIslandTurns: 3,
  desertIslandBailCost: 200_000,
  worldTravelTicketCost: 150_000,
  olympicBaseFee: 100_000,
  maxOlympicMultiplier: 5,
  festivalCityCount: 0,
  festivalTollMultiplier: 2.0,
  colorMonopolyTollMultiplier: 2.0,
  takeoverCostMultiplier: 2.0,
  citySellRefundRate: 0.50,
  taxAuditRate: 0.10,
  perfumeCharStealRate: 0.12,   // Character M06 Super Perfume steals 12% on pass or land
  perfumeTreasureStealRate: 0.07, // Treasure M06 Super Perfume steals 7% on pass or land
  perfumeMainStealRate: 0.07,   // Baseline compatibility
  perfumeSubStealRate: 0.03,    // S01 Perfume sub-skill steals 3% on pass or land (stackable)
  perfumeStealRate: 0.07,       // Fallback compatibility
  sheriffTaxRate: 0.20,   // S02 Sheriff steals 20% when enemy lands on you
  maxTurns: 20,
  lateGameTurnThreshold: 16, // Turns 16..20 (Last 5 turns)
  lateGameTollMultiplier: 1.5,
  oddEvenChargesPerMatch: 3,
  maxConsecutiveDoublesBeforeIsland: 3,
  globalMaxBlackHoles: 1,
  bonusGameRewards: [100_000, 200_000, 400_000, 800_000] as const,
  winRewardMultipliers: {
    BANKRUPTCY: 1,
    TURN_LIMIT_ASSET: 1,
    TRIPLE_MONOPOLY: 2,
    LINE_MONOPOLY: 3,
    TOURISM_MONOPOLY: 5,
  },
  // City construction growth curve reduced by ~1.5x for smoother peak-era pacing
  buildingCostMultipliers: {
    [BuildingLevel.NONE]: 0,
    [BuildingLevel.LAND]: 1.0,
    [BuildingLevel.VILLA]: 1.3,
    [BuildingLevel.BUILDING]: 1.6,
    [BuildingLevel.HOTEL]: 2.0,
    [BuildingLevel.LANDMARK]: 2.7,
  },
  buildingTollMultipliers: {
    [BuildingLevel.NONE]: 0,
    [BuildingLevel.LAND]: 1.0,
    [BuildingLevel.VILLA]: 2.0,
    [BuildingLevel.BUILDING]: 3.0,
    [BuildingLevel.HOTEL]: 4.0,
    [BuildingLevel.LANDMARK]: 6.0,
  },
} as const;

// 1.1 TOURISM ISLAND GROUPS (3 Blue Islands 2x/4x & 2 Red Islands 3x)
export const BLUE_TOURISM_INDICES: readonly number[] = [5, 10, 15] as const;
export const RED_TOURISM_INDICES: readonly number[] = [19, 25] as const;

export function getTourismMultiplierForTile(
  tileIndex: number,
  alliedOwnedTourismIndices: readonly number[]
): number {
  if (BLUE_TOURISM_INDICES.includes(tileIndex)) {
    const blueCount = alliedOwnedTourismIndices.filter((idx) =>
      BLUE_TOURISM_INDICES.includes(idx)
    ).length;
    if (blueCount >= 3) return 4;
    if (blueCount === 2) return 2;
    return 1;
  }
  if (RED_TOURISM_INDICES.includes(tileIndex)) {
    const redCount = alliedOwnedTourismIndices.filter((idx) =>
      RED_TOURISM_INDICES.includes(idx)
    ).length;
    if (redCount >= 2) return 3;
    return 1;
  }
  return 1;
}

// 2. TWO-STAGE DICE PROBABILITY TABLES (Continuous Gauge 2.00 .. 12.00)
export const UNIVERSAL_DOUBLE_PROB_PCT: readonly number[] = [
  // Sum:   2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12
          100,  0, 35,  0, 20,  0, 20,  0, 35,  0, 100,
];

export const DICE_TABLE_NONE: Readonly<Record<number, readonly number[]>> = {
  2:  [20, 38, 20, 14,  6,  2,  0,  0,  0,  0,  0],
  3:  [12, 28, 26, 18, 10,  6,  0,  0,  0,  0,  0],
  4:  [ 5, 15, 31, 24, 15,  8,  2,  0,  0,  0,  0],
  5:  [ 2,  6, 17, 34, 22, 13,  5,  1,  0,  0,  0],
  6:  [ 0,  2,  7, 17, 37, 23, 10,  3,  1,  0,  0],
  7:  [ 0,  1,  3,  8, 18, 40, 18,  8,  3,  1,  0],
  8:  [ 0,  0,  1,  3, 10, 23, 37, 17,  7,  2,  0],
  9:  [ 0,  0,  0,  1,  5, 13, 22, 34, 17,  6,  2],
  10: [ 0,  0,  0,  0,  2,  8, 15, 24, 31, 15,  5],
  11: [ 0,  0,  0,  0,  0,  6, 10, 18, 26, 28, 12],
  12: [ 0,  0,  0,  0,  0,  2,  6, 14, 20, 38, 20],
};

export const DICE_TABLE_EVEN: Readonly<Record<number, readonly number[]>> = {
  2:  [33,  0, 40,  0, 20,  0,  7,  0,  0,  0,  0],
  3:  [22,  0, 44,  0, 25,  0,  9,  0,  0,  0,  0],
  4:  [10,  0, 43,  0, 31,  0, 13,  0,  3,  0,  0],
  5:  [ 4,  0, 29,  0, 45,  0, 18,  0,  4,  0,  0],
  6:  [ 2,  0, 14,  0, 52,  0, 24,  0,  8,  0,  0],
  7:  [ 0,  0,  6,  0, 44,  0, 44,  0,  6,  0,  0],
  8:  [ 0,  0,  8,  0, 24,  0, 52,  0, 14,  0,  2],
  9:  [ 0,  0,  4,  0, 18,  0, 45,  0, 29,  0,  4],
  10: [ 0,  0,  3,  0, 13,  0, 31,  0, 43,  0, 10],
  11: [ 0,  0,  0,  0,  9,  0, 25,  0, 44,  0, 22],
  12: [ 0,  0,  0,  0,  7,  0, 20,  0, 40,  0, 33],
};

export const DICE_TABLE_ODD: Readonly<Record<number, readonly number[]>> = {
  2:  [ 0,  42,  0, 36,  0, 18,  0,  4,  0,   0,  0],
  3:  [ 0,  38,  0, 36,  0, 20,  0,  6,  0,   0,  0],
  4:  [ 0,  24,  0, 44,  0, 25,  0,  7,  0,   0,  0],
  5:  [ 0,  10,  0, 48,  0, 31,  0,  9,  0,   2,  0],
  6:  [ 0,   4,  0, 28,  0, 49,  0, 16,  0,   3,  0],
  7:  [ 0, 2.5,  0, 20,  0, 55,  0, 20,  0, 2.5,  0],
  8:  [ 0,   3,  0, 16,  0, 49,  0, 28,  0,   4,  0],
  9:  [ 0,   2,  0,  9,  0, 31,  0, 48,  0,  10,  0],
  10: [ 0,   0,  0,  7,  0, 25,  0, 44,  0,  24,  0],
  11: [ 0,   0,  0,  6,  0, 20,  0, 36,  0,  38,  0],
  12: [ 0,   0,  0,  4,  0, 18,  0, 36,  0,  42,  0],
};

export const NON_DOUBLE_DIE_PAIRS: Readonly<Record<number, readonly [number, number][]>> = {
  3:  [[1, 2], [2, 1]],
  4:  [[1, 3], [3, 1]],
  5:  [[1, 4], [4, 1], [2, 3], [3, 2]],
  6:  [[1, 5], [5, 1], [2, 4], [4, 2]],
  7:  [[1, 6], [6, 1], [2, 5], [5, 2], [3, 4], [4, 3]],
  8:  [[2, 6], [6, 2], [3, 5], [5, 3]],
  9:  [[3, 6], [6, 3], [4, 5], [5, 4]],
  10: [[4, 6], [6, 4]],
  11: [[5, 6], [6, 5]],
};

// 3. 5 CORE PLAYER STATS (+0 TO +5) — LOADED FROM character_config.json
export const STAT_SCALING_TABLE = characterConfigData.statScaling;

// 4. 32-TILE WORLD MAP DATA
export const WORLD_MAP_TILES: readonly WorldTileDef[] = [
  // Line 0 (Bottom-Left Edge: indices 0..7)
  { index: 0,  line: 0, name: 'START',             nameTh: 'จุดเริ่มต้น START', type: 'START',         group: null, colorHex: '#E5A93B', baseCost: 0,       baseToll: 0 },
  { index: 1,  line: 0, name: 'Bangkok',           nameTh: 'กรุงเทพฯ',         type: 'CITY',          group: 1,    colorHex: '#8D5B4C', baseCost: 100_000, baseToll: 25_000 },
  { index: 2,  line: 0, name: 'Coin Flip',         nameTh: 'เกมโยนเหรียญ',     type: 'BONUS_GAME',    group: null, colorHex: '#6366F1', baseCost: 0,       baseToll: 0 },
  { index: 3,  line: 0, name: 'Taipei',            nameTh: 'ไทเป',             type: 'CITY',          group: 1,    colorHex: '#8D5B4C', baseCost: 120_000, baseToll: 30_000 },
  { index: 4,  line: 0, name: 'Fortune Card',      nameTh: 'การ์ดดวง',          type: 'CHANCE',        group: null, colorHex: '#F59E0B', baseCost: 0,       baseToll: 0 },
  { index: 5,  line: 0, name: 'Phi Phi Island',    nameTh: 'เกาะพีพี',          type: 'TOURISM',       group: null, tourismGroup: 'BLUE', colorHex: '#0284C7', baseCost: 200_000, baseToll: 60_000 },
  { index: 6,  line: 0, name: 'Sapporo',           nameTh: 'ซัปโปโร',          type: 'CITY',          group: 2,    colorHex: '#0284C7', baseCost: 150_000, baseToll: 38_000 },
  { index: 7,  line: 0, name: 'Dubai',             nameTh: 'ดูไบ',             type: 'CITY',          group: 2,    colorHex: '#0284C7', baseCost: 170_000, baseToll: 44_000 },

  // Line 1 (Top-Left Edge: indices 8..15)
  { index: 8,  line: 1, name: 'Desert Island',     nameTh: 'เกาะร้าง',          type: 'DESERT_ISLAND', group: null, colorHex: '#E5A93B', baseCost: 0,       baseToll: 0 },
  { index: 9,  line: 1, name: 'Cairo',             nameTh: 'ไคโร',             type: 'CITY',          group: 2,    colorHex: '#0284C7', baseCost: 190_000, baseToll: 50_000 },
  { index: 10, line: 1, name: 'Jeju Island',       nameTh: 'เกาะเชจู',          type: 'TOURISM',       group: null, tourismGroup: 'BLUE', colorHex: '#0284C7', baseCost: 200_000, baseToll: 60_000 },
  { index: 11, line: 1, name: 'Sydney',            nameTh: 'ซิดนีย์',           type: 'CITY',          group: 3,    colorHex: '#DB2777', baseCost: 220_000, baseToll: 58_000 },
  { index: 12, line: 1, name: 'Quebec',            nameTh: 'ควิเบก',           type: 'CITY',          group: 3,    colorHex: '#DB2777', baseCost: 240_000, baseToll: 64_000 },
  { index: 13, line: 1, name: 'Fortune Card',      nameTh: 'การ์ดดวง',          type: 'CHANCE',        group: null, colorHex: '#F59E0B', baseCost: 0,       baseToll: 0 },
  { index: 14, line: 1, name: 'Sao Paulo',         nameTh: 'เซาเปาโล',         type: 'CITY',          group: 3,    colorHex: '#DB2777', baseCost: 260_000, baseToll: 70_000 },
  { index: 15, line: 1, name: 'Bora Bora',         nameTh: 'โบราโบรา',         type: 'TOURISM',       group: null, tourismGroup: 'BLUE', colorHex: '#0284C7', baseCost: 200_000, baseToll: 60_000 },

  // Line 2 (Top-Right Edge: indices 16..23)
  { index: 16, line: 2, name: 'Olympic Expo',      nameTh: 'โอลิมปิก',          type: 'OLYMPIC',       group: null, colorHex: '#E5A93B', baseCost: 0,       baseToll: 0 },
  { index: 17, line: 2, name: 'Prague',            nameTh: 'ปราก',             type: 'CITY',          group: 4,    colorHex: '#EA580C', baseCost: 290_000, baseToll: 80_000 },
  { index: 18, line: 2, name: 'Berlin',            nameTh: 'เบอร์ลิน',          type: 'CITY',          group: 4,    colorHex: '#EA580C', baseCost: 310_000, baseToll: 86_000 },
  { index: 19, line: 2, name: 'Hawaii Island',     nameTh: 'เกาะฮาวาย',         type: 'TOURISM',       group: null, tourismGroup: 'RED',  colorHex: '#E11D48', baseCost: 200_000, baseToll: 60_000 },
  { index: 20, line: 2, name: 'Fortune Card',      nameTh: 'การ์ดดวง',          type: 'CHANCE',        group: null, colorHex: '#F59E0B', baseCost: 0,       baseToll: 0 },
  { index: 21, line: 2, name: 'Zurich',            nameTh: 'ซูริก',            type: 'CITY',          group: 5,    colorHex: '#2563EB', baseCost: 360_000, baseToll: 100_000 },
  { index: 22, line: 2, name: 'Vienna',            nameTh: 'เวียนนา',           type: 'CITY',          group: 5,    colorHex: '#2563EB', baseCost: 380_000, baseToll: 108_000 },
  { index: 23, line: 2, name: 'Rome',              nameTh: 'โรม',              type: 'CITY',          group: 5,    colorHex: '#2563EB', baseCost: 400_000, baseToll: 115_000 },

  // Line 3 (Bottom-Right Edge: indices 24..31)
  { index: 24, line: 3, name: 'Sky Terminal',      nameTh: 'สนามบินรอบโลก',     type: 'WORLD_TRAVEL',  group: null, colorHex: '#E5A93B', baseCost: 0,       baseToll: 0 },
  { index: 25, line: 3, name: 'Galapagos',         nameTh: 'กาลาปากอส',        type: 'TOURISM',       group: null, tourismGroup: 'RED',  colorHex: '#E11D48', baseCost: 200_000, baseToll: 60_000 },
  { index: 26, line: 3, name: 'London',            nameTh: 'ลอนดอน',           type: 'CITY',          group: 6,    colorHex: '#16A34A', baseCost: 440_000, baseToll: 130_000 },
  { index: 27, line: 3, name: 'Paris',             nameTh: 'ปารีส',            type: 'CITY',          group: 6,    colorHex: '#16A34A', baseCost: 470_000, baseToll: 140_000 },
  { index: 28, line: 3, name: 'Fortune Card',      nameTh: 'การ์ดดวง',          type: 'CHANCE',        group: null, colorHex: '#F59E0B', baseCost: 0,       baseToll: 0 },
  { index: 29, line: 3, name: 'Manhattan',         nameTh: 'แมนแฮตตัน',         type: 'CITY',          group: 7,    colorHex: '#DC2626', baseCost: 530_000, baseToll: 160_000 },
  { index: 30, line: 3, name: 'Tax Audit (10%)',   nameTh: 'สรรพากร (10%)',     type: 'TAX_AUDIT',     group: null, colorHex: '#64748B', baseCost: 0,       baseToll: 0 },
  { index: 31, line: 3, name: 'Neo Tokyo',         nameTh: 'นีโอโตเกียว',        type: 'CITY',          group: 7,    colorHex: '#DC2626', baseCost: 580_000, baseToll: 175_000 },
] as const;

// 5. 20 SKILLS CATALOG — LOADED FROM treasure_config.json
export const SKILL_CATALOG: readonly SkillDefinition[] = treasureConfigData.skills as unknown as SkillDefinition[];

// 6. 8 CHARACTER ROSTER (5 Stats + 1 Main + 2 Rebalanced Subs) — LOADED FROM character_config.json
export const CHARACTER_ROSTER: readonly CharacterDef[] = characterConfigData.characters as unknown as CharacterDef[];

// 7. 10 TREASURE POOL (Each has 1 Unique Main M01..M10 + 1 Sub S01..S10) — LOADED FROM treasure_config.json
export const TREASURE_POOL: readonly TreasureDef[] = treasureConfigData.treasures as unknown as TreasureDef[];

// 7.1 CHARACTER SYNERGIES & META ARCHETYPES — LOADED FROM character_config.json
export interface CharacterSynergyDef {
  archetype: string;
  archetypeTh: string;
  descriptionTh: string;
  coreTreasures: readonly string[];
}

export const CHARACTER_SYNERGIES: Record<string, CharacterSynergyDef> = characterConfigData.synergies as unknown as Record<string, CharacterSynergyDef>;

export function getCharacterSynergy(characterId: string): CharacterSynergyDef | undefined {
  return CHARACTER_SYNERGIES[characterId];
}

export const FORTUNE_CARD_DECK: readonly FortuneCardDef[] = [
  {
    cardId: 'ANGEL_SHIELD',
    emoji: '👼',
    titleTh: 'การ์ดนางฟ้า (ป้องกันค่าผ่านทาง & ป่วนศัตรู)',
    titleEn: 'Angel Shield Card',
    category: 'BUFF',
    weightPct: 20,
    descTh: 'ยกเว้นค่าผ่านทาง 100% เมื่อตกเมืองศัตรู หรือป้องกันการ์ดไฟดับ/บังคับขาย/แลกเมืองของศัตรูอัตโนมัติ!',
  },
  {
    cardId: 'DISCOUNT_COUPON',
    emoji: '🎟️',
    titleTh: 'คูปองลดค่าผ่านทาง 50%',
    titleEn: 'Half-Price Toll Coupon',
    category: 'BUFF',
    weightPct: 14,
    descTh: 'เก็บคูปองลดค่าผ่านทาง 50% อัตโนมัติเมื่อเดินตกเมืองศัตรูครั้งถัดไป!',
  },
  {
    cardId: 'FREE_START_PASS',
    emoji: '🚀',
    titleTh: 'ตั๋วด่วนกลับจุด START!',
    titleEn: 'Express Return to START',
    category: 'BUFF',
    weightPct: 12,
    descTh: 'พุ่งไปยังจุด START รับเงินเดือนทันที และได้สิทธิ์อัปเกรดตึกเมืองตัวเองฟรี +1 ขั้น!',
  },
  {
    cardId: 'HOST_OLYMPIC_FREE',
    emoji: '🏅',
    titleTh: 'เจ้าภาพโอลิมปิกกิตติมศักดิ์!',
    titleEn: 'Honorary Olympic Host',
    category: 'BUFF',
    weightPct: 11,
    descTh: 'เลือกจัดงานโอลิมปิกที่เมืองตัวเองฟรีทันที! (หากยังไม่มีเมือง รับเงิน +150,000 M)',
  },
  {
    cardId: 'WORLD_TRAVEL_INVITE',
    emoji: '✈️',
    titleTh: 'บัตรเชิญสายการบิน VIP!',
    titleEn: 'VIP Sky Terminal Pass',
    category: 'BUFF',
    weightPct: 9,
    descTh: 'วาร์ปไปรอที่สนามบินรอบโลกฟรีทันที เทิร์นหน้าเลือกบินไปลงช่องไหนก็ได้ฟรี!',
  },
  {
    cardId: 'POWER_OUTAGE',
    emoji: '🔌',
    titleTh: 'การ์ดไฟดับ (ตัดไฟเมืองศัตรู)!',
    titleEn: 'City Power Blackout',
    category: 'DISRUPT',
    weightPct: 9,
    descTh: 'เลือกตัดไฟเมืองหรือแลนด์มาร์กศัตรู 1 แห่ง ทำให้ค่าผ่านทางเหลือ 0 M จนกว่าจะมีคนเดินไปตก!',
  },
  {
    cardId: 'FORCED_SALE_OR_SWAP',
    emoji: '🔮',
    titleTh: 'การ์ดบังคับขาย / สลับโฉนด!',
    titleEn: 'Executive Forced Sale / Swap',
    category: 'DISRUPT',
    weightPct: 5,
    descTh: 'เลือกบังคับศัตรูขายเมืองคืนธนาคาร หรือสลับโฉนดเมืองของเรากับเมืองศัตรูทันที!',
  },
  {
    cardId: 'CHARITY_TAX',
    emoji: '💸',
    titleTh: 'การ์ดบริจาคการกุศล (-120K)',
    titleEn: 'Mandatory Charity Audit',
    category: 'HAZARD',
    weightPct: 11,
    descTh: 'ดวงตก! ต้องบริจาคเงินเข้ากองกลางธนาคาร 120,000 M ทันที',
  },
  {
    cardId: 'ISLAND_EXILE',
    emoji: '🌪️',
    titleTh: 'พายุพัดหลงติดเกาะร้าง!',
    titleEn: 'Typhoon Island Exile',
    category: 'HAZARD',
    weightPct: 9,
    descTh: 'พายุพัดหลงทาง! ถูกส่งตัวไปยังเกาะร้างทันที (สกิลหนีเกาะร้างยังทำงานได้ตามปกติ)',
  },
] as const;

export function getSkillDef(skillId: SkillId): SkillDefinition {
  const found = SKILL_CATALOG.find((s) => s.id === skillId);
  if (!found) throw new Error(`Unknown skillId: ${skillId}`);
  return found;
}

export function getCharacterDef(charId: string): CharacterDef {
  return CHARACTER_ROSTER.find((c) => c.id === charId) ?? CHARACTER_ROSTER[0];
}

export function getTreasureDef(trId: string): TreasureDef {
  return TREASURE_POOL.find((t) => t.id === trId) ?? TREASURE_POOL[0];
}

export function formatMarbleCompact(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(Math.round(amount));
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}K`;
  }
  return `${sign}${abs}`;
}

export function formatMarbleFull(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} M`;
}
