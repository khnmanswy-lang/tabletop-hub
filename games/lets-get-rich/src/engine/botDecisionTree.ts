/**
 * LINE Let's Get Rich (Peak Era Recreation) — Hybrid Rule-Tree + 1-Turn Expectimax AI Brain
 *
 * Architecture:
 * 1. Tactical Board & Monopoly Analyzer:
 *    - Detects Win-in-1 tiles (Triple Color x2, Line x3, Tourism x5) for self & enemies.
 *    - Detects Block-in-1 critical tiles when any opponent is 1 tile away from Monopoly victory.
 *    - Evaluates board danger level, enemy Landmark threats, and dynamic cash reserve floors.
 * 2. 1-Turn Probability Lookahead (Expectimax over Gauge 2..12 × Odd/Even Modes):
 *    - Uses the exact DICE_TABLE_NONE / DICE_TABLE_EVEN / DICE_TABLE_ODD probability matrices
 *      blended with the character's Dice Control (DC%) rate.
 *    - Evaluates Black Hole warps, S01 Perfume pass-through steals, S02/M07 enemy collision risks,
 *      and 2nd-ply runway safety from each candidate landing tile.
 * 3. Rule-Based Tactical Trees for All Post-Roll Decisions:
 *    - Desert Island Bail vs Safe-Zone Stay ("คุกเซฟโซน" when leading late-game).
 *    - City Build Level selection with cash-reserve & skill synergy awareness.
 *    - Hostile Takeover + instant Landmark lock-in evaluation.
 *    - World Travel, Black Hole placement (sniping enemy winning tiles), Olympic, Start Upgrade,
 *      M10 Disrupt (Swap vs Force-Sell), Bonus Coin Flip risk management, and Debt Liquidation order.
 */

import {
  BoardTileState,
  BuildingLevel,
  DICE_TABLE_EVEN,
  DICE_TABLE_NONE,
  DICE_TABLE_ODD,
  MATCH_CONFIG,
  OddEvenMode,
  PlayerId,
  PlayerState,
  UNIVERSAL_DOUBLE_PROB_PCT,
  WORLD_MAP_TILES,
} from '../data/lgrGameData';
import type { DisruptActionMode, GameEngine, MatchState } from './gameEngine';
import {
  BLUE_TOURISM_INDICES,
  COLOR_GROUP_TILES,
  computePlayerStats,
  getCharacterDef,
  getEffectiveSkillPct,
  getTreasureDef,
  LINE_PURCHASABLE_TILES,
  PLAYER_IDS,
  RED_TOURISM_INDICES,
  TOURISM_TILE_INDICES,
} from './gameEngine';

export interface AiRollPlan {
  payBailFirst: boolean;
  oddEvenMode: OddEvenMode;
  gaugeTarget: number;
  expectedUtility: number;
}

export interface TacticalBoardAnalysis {
  /** Tiles that immediately win the match for the AI if bought or taken over */
  selfWinningTiles: Set<number>;
  /** Map of tileIndex -> urgency score for tiles that an enemy needs to win on their next step */
  enemyWinningThreatTiles: Map<number, number>;
  /** Tiles that complete a color group (2/2 or 3/3) for the AI */
  selfGroupCompletingTiles: Set<number>;
  /** Highest enemy toll currently on the board */
  maxEnemyToll: number;
  /** Recommended minimum cash reserve after voluntary purchases */
  cashReserveFloor: number;
  /** Whether AI is currently #1 in total assets */
  isLeadingAssets: boolean;
  /** Total assets by player ID */
  assetsByPlayer: Record<PlayerId, number>;
}

/**
 * Analyzes the entire 32-tile board for immediate win conditions, lethal enemy monopoly threats,
 * color group completions, and cash reserve requirements.
 */
export function analyzeTacticalBoard(
  engine: GameEngine,
  match: MatchState,
  ai: PlayerState
): TacticalBoardAnalysis {
  const selfWinningTiles = new Set<number>();
  const enemyWinningThreatTiles = new Map<number, number>();
  const selfGroupCompletingTiles = new Set<number>();

  const activePlayerIds = PLAYER_IDS.filter(
    (pid) => match.players[pid].isSlotActive !== false && !match.players[pid].isBankrupt
  );

  const assetsByPlayer: Record<PlayerId, number> = {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
  };
  for (const pid of activePlayerIds) {
    assetsByPlayer[pid] = engine.calculatePlayerTotalAssets(pid);
  }

  const aiAssets = assetsByPlayer[ai.id] ?? 0;
  const maxOtherAssets = Math.max(
    0,
    ...activePlayerIds.filter((pid) => !engine.arePlayersAllied(ai.id, pid)).map((pid) => assetsByPlayer[pid])
  );
  const isLeadingAssets = aiAssets > maxOtherAssets * 1.08;

  // Helper to check if `buyer` can acquire `tileIdx` (either unowned or enemy non-Landmark city)
  const canPlayerAcquireTile = (buyer: PlayerState, tileIdx: number, includeSalaryBoost = false): boolean => {
    const tile = match.tiles[tileIdx];
    const def = WORLD_MAP_TILES[tileIdx];
    if (!tile || !def || (def.type !== 'CITY' && def.type !== 'TOURISM')) return false;
    if (engine.arePlayersAllied(buyer.id, tile.ownerId)) return false;

    const budget = buyer.marble + (includeSalaryBoost ? MATCH_CONFIG.salaryAmount : 0);

    if (tile.ownerId === null) {
      const minBuildCost = engine.calculateBuildCost(
        buyer.id,
        tileIdx,
        BuildingLevel.NONE,
        BuildingLevel.LAND
      );
      return budget >= minBuildCost;
    }

    // Owned by enemy: only CITY with LAND..HOTEL can be taken over
    if (def.type === 'CITY' && tile.buildingLevel < BuildingLevel.LANDMARK) {
      const toll = engine.calculateTollBreakdown(tileIdx, buyer.id).netToll;
      const takeover = engine.calculateTakeoverCost(buyer.id, tileIdx);
      return budget >= toll + takeover;
    }

    return false;
  };

  // Analyze Monopoly Win-in-1 for every active player
  for (const pid of activePlayerIds) {
    const p = match.players[pid];
    const isAlly = engine.arePlayersAllied(ai.id, pid);

    // 1. Tourism Monopoly (owns 4 of 5 islands -> 5th island wins x5)
    const unownedTourism = TOURISM_TILE_INDICES.filter(
      (idx) => !engine.arePlayersAllied(pid, match.tiles[idx].ownerId)
    );
    if (unownedTourism.length === 1) {
      const missIdx = unownedTourism[0];
      if (isAlly) {
        if (canPlayerAcquireTile(ai, missIdx, true)) {
          selfWinningTiles.add(missIdx);
        }
      } else if (match.tiles[missIdx].ownerId === null) {
        const prev = enemyWinningThreatTiles.get(missIdx) ?? 0;
        enemyWinningThreatTiles.set(missIdx, Math.max(prev, 9500));
      }
    }

    // 2. Line Monopoly (owns N-1 of N tiles on any board edge -> last tile wins x3)
    for (const line of [0, 1, 2, 3] as const) {
      const lineTiles = LINE_PURCHASABLE_TILES[line];
      const missing = lineTiles.filter(
        (idx) => !engine.arePlayersAllied(pid, match.tiles[idx].ownerId)
      );
      if (missing.length === 1) {
        const missIdx = missing[0];
        if (isAlly) {
          if (canPlayerAcquireTile(ai, missIdx, true)) {
            selfWinningTiles.add(missIdx);
          }
        } else {
          const prev = enemyWinningThreatTiles.get(missIdx) ?? 0;
          enemyWinningThreatTiles.set(missIdx, Math.max(prev, 7800));
        }
      }
    }

    // 3. Color Groups & Triple Monopoly (owns 2 groups and 1 tile away in 3rd group -> wins x2)
    let completedGroups = 0;
    const oneAwayGroupTiles: number[] = [];
    for (let g = 1; g <= 7; g++) {
      const gTiles = COLOR_GROUP_TILES[g];
      const missing = gTiles.filter(
        (idx) => !engine.arePlayersAllied(pid, match.tiles[idx].ownerId)
      );
      if (missing.length === 0) {
        completedGroups += 1;
      } else if (missing.length === 1) {
        oneAwayGroupTiles.push(missing[0]);
        if (isAlly) {
          selfGroupCompletingTiles.add(missing[0]);
        }
      }
    }

    if (completedGroups >= 2 && oneAwayGroupTiles.length > 0) {
      for (const missIdx of oneAwayGroupTiles) {
        if (isAlly) {
          if (canPlayerAcquireTile(ai, missIdx, true)) {
            selfWinningTiles.add(missIdx);
          }
        } else {
          const prev = enemyWinningThreatTiles.get(missIdx) ?? 0;
          enemyWinningThreatTiles.set(missIdx, Math.max(prev, 6500));
        }
      }
    }
  }

  // Compute maxEnemyToll and recommended cashReserveFloor
  let maxEnemyToll = 0;
  let totalEnemyDangerAhead = 0;
  for (let step = 2; step <= 12; step++) {
    const idx = (ai.tileIndex + step) % MATCH_CONFIG.boardSize;
    const t = match.tiles[idx];
    if (t.ownerId && !engine.arePlayersAllied(ai.id, t.ownerId)) {
      const toll = engine.calculateTollBreakdown(idx, ai.id).netToll;
      if (toll > maxEnemyToll) maxEnemyToll = toll;
      const stepWeight = 6 - Math.abs(7 - step); // 1..6 weight peaking at 7
      totalEnemyDangerAhead += toll * (stepWeight / 36);
    }
  }

  const lateMult = match.turnNumber >= MATCH_CONFIG.lateGameTurnThreshold ? 1.35 : 1.0;
  const rawReserve = Math.max(180_000, totalEnemyDangerAhead * 1.25 * lateMult, maxEnemyToll * 0.45);
  const cashReserveFloor = Math.min(850_000, Math.round(rawReserve));

  return {
    selfWinningTiles,
    enemyWinningThreatTiles,
    selfGroupCompletingTiles,
    maxEnemyToll,
    cashReserveFloor,
    isLeadingAssets,
    assetsByPlayer,
  };
}

/**
 * Evaluates the strategic utility of the AI landing on `rawDestTileIdx` after rolling `diceSum`.
 */
export function evaluateLandingTileUtility(
  engine: GameEngine,
  match: MatchState,
  ai: PlayerState,
  diceSum: number,
  analysis: TacticalBoardAnalysis
): number {
  const startIdx = ai.tileIndex;
  const passedOrLandedStart = startIdx + diceSum >= MATCH_CONFIG.boardSize;
  const rawDestIdx = (startIdx + diceSum) % MATCH_CONFIG.boardSize;

  let utility = 0;

  // 1. Salary bonus if passing/landing on START (Tile 0)
  const stats = computePlayerStats(ai.characterId, ai.treasureIds);
  const salaryGain = passedOrLandedStart
    ? Math.round(MATCH_CONFIG.salaryAmount * (1 + stats.salBonusPct / 100))
    : 0;
  if (passedOrLandedStart) {
    utility += 280;
  }

  const effectiveCash = ai.marble + salaryGain;

  // 2. Perfume Steal (M06_SUPER_PERFUME 12% Char / 7% Treasure + S01_PERFUME_STEAL 3%) expected value along the path
  const superPerfumePct = getEffectiveSkillPct(ai, 'M06_SUPER_PERFUME');
  const subPerfumePct = getEffectiveSkillPct(ai, 'S01_PERFUME_STEAL');
  if (superPerfumePct > 0 || subPerfumePct > 0) {
    const charDef = getCharacterDef(ai.characterId);
    const charHasPerfume = charDef.mainSkill.skillId === 'M06_SUPER_PERFUME';
    const treasureHasPerfume = ai.treasureIds.some(
      (tid) => getTreasureDef(tid).mainSkill.skillId === 'M06_SUPER_PERFUME'
    );
    const superPerfumeStealRate =
      charHasPerfume && treasureHasPerfume
        ? MATCH_CONFIG.perfumeCharStealRate + MATCH_CONFIG.perfumeTreasureStealRate
        : charHasPerfume
        ? MATCH_CONFIG.perfumeCharStealRate
        : MATCH_CONFIG.perfumeTreasureStealRate;

    const combinedStealRate =
      (superPerfumePct / 100) * superPerfumeStealRate +
      (subPerfumePct / 100) * MATCH_CONFIG.perfumeSubStealRate;
    for (let s = 1; s <= diceSum; s++) {
      const stepIdx = (startIdx + s) % MATCH_CONFIG.boardSize;
      for (const pid of PLAYER_IDS) {
        const other = match.players[pid];
        if (
          other.isSlotActive !== false &&
          !other.isBankrupt &&
          !engine.arePlayersAllied(ai.id, other.id) &&
          other.tileIndex === stepIdx &&
          other.marble > 0
        ) {
          const expectedSteal = other.marble * combinedStealRate;
          utility += Math.min(350, expectedSteal / 1200);
        }
      }
    }
  }

  // 3. Check Black Hole Warp! If rawDestIdx has a Black Hole, the AI actually lands on whiteTileIndex!
  let effectiveTileIdx = rawDestIdx;
  if (match.blackHole && match.blackHole.blackTileIndex === rawDestIdx) {
    effectiveTileIdx = match.blackHole.whiteTileIndex;
    utility -= 150; // Slight penalty for losing positional control
  } else {
    // 4. Check standing enemy collision risks (S02_SHERIFF_TAX & M07_WRONG_GUIDEBOOK)
    for (const pid of PLAYER_IDS) {
      const enemy = match.players[pid];
      if (
        enemy.isSlotActive !== false &&
        !enemy.isBankrupt &&
        !engine.arePlayersAllied(ai.id, enemy.id) &&
        enemy.tileIndex === effectiveTileIdx
      ) {
        const sheriffPct = getEffectiveSkillPct(enemy, 'S02_SHERIFF_TAX');
        if (sheriffPct > 0 && effectiveCash > 0) {
          const expectedTax = effectiveCash * MATCH_CONFIG.sheriffTaxRate * (sheriffPct / 100);
          utility -= Math.min(450, expectedTax / 1000);
        }
        const guidePct = getEffectiveSkillPct(enemy, 'M07_WRONG_GUIDEBOOK');
        if (guidePct > 0) {
          const enemyHasLandmark = match.tiles.some(
            (t) =>
              engine.arePlayersAllied(enemy.id, t.ownerId) &&
              t.buildingLevel === BuildingLevel.LANDMARK
          );
          if (enemyHasLandmark) {
            utility -= 750 * (guidePct / 100);
          }
        }
      }
    }
  }

  const tile = match.tiles[effectiveTileIdx];
  const def = WORLD_MAP_TILES[effectiveTileIdx];

  // 5. Evaluate Special Non-Property Tiles
  if (def.type === 'START') {
    const hasUpgradableHotel = match.tiles.some(
      (t) =>
        engine.arePlayersAllied(ai.id, t.ownerId) && t.buildingLevel === BuildingLevel.HOTEL
    );
    const hasUpgradableCity = match.tiles.some(
      (t) =>
        WORLD_MAP_TILES[t.index].type === 'CITY' &&
        engine.arePlayersAllied(ai.id, t.ownerId) &&
        t.buildingLevel < BuildingLevel.LANDMARK
    );
    utility += hasUpgradableHotel ? 1250 : hasUpgradableCity ? 620 : 260;
  } else if (def.type === 'WORLD_TRAVEL') {
    // World Travel is ultra-valuable if we have an affordable winning tile or lethal block tile!
    const canAffordTicket = effectiveCash >= MATCH_CONFIG.worldTravelTicketCost;
    if (canAffordTicket) {
      if (analysis.selfWinningTiles.size > 0) {
        utility += 4800;
      } else if (analysis.enemyWinningThreatTiles.size > 0) {
        utility += 3200;
      } else {
        utility += 1350;
      }
    } else {
      utility += 150;
    }
  } else if (def.type === 'OLYMPIC') {
    const ownLandmarks = match.tiles.filter(
      (t) =>
        engine.arePlayersAllied(ai.id, t.ownerId) && t.buildingLevel === BuildingLevel.LANDMARK
    ).length;
    const ownCities = match.tiles.filter((t) => engine.arePlayersAllied(ai.id, t.ownerId)).length;
    if (effectiveCash >= MATCH_CONFIG.olympicBaseFee && ownCities > 0) {
      utility += ownLandmarks > 0 ? 920 : 480;
    } else {
      utility += 40;
    }
  } else if (def.type === 'BONUS_GAME') {
    const coinMasterPct = getEffectiveSkillPct(ai, 'S09_COIN_MASTER');
    utility += 460 + coinMasterPct * 8;
  } else if (def.type === 'CHANCE') {
    const disruptPct = getEffectiveSkillPct(ai, 'M10_DISRUPT_CITY');
    const enemyThreatBonus = analysis.enemyWinningThreatTiles.size > 0 ? disruptPct * 18 : disruptPct * 6;
    utility += 380 + enemyThreatBonus;
  } else if (def.type === 'DESERT_ISLAND') {
    const escapePct = getEffectiveSkillPct(ai, 'S03_ISLAND_ESCAPE');
    if (
      match.turnNumber >= MATCH_CONFIG.lateGameTurnThreshold &&
      analysis.isLeadingAssets &&
      analysis.maxEnemyToll >= 600_000
    ) {
      // Safe-zone island strategy when leading late-game!
      utility += 340;
    } else {
      utility -= Math.round(980 * (1 - escapePct / 100));
    }
  } else if (def.type === 'TAX_AUDIT') {
    const taxLoss = Math.max(50_000, Math.round(analysis.assetsByPlayer[ai.id] * MATCH_CONFIG.taxAuditRate));
    utility -= Math.min(1800, Math.round(taxLoss / 1100));
  } else if (def.type === 'CITY' || def.type === 'TOURISM') {
    // 6. Evaluate Property Tiles (Unowned, Allied, or Enemy)
    if (tile.ownerId === null) {
      const landCost = engine.calculateBuildCost(
        ai.id,
        effectiveTileIdx,
        BuildingLevel.NONE,
        BuildingLevel.LAND
      );
      if (effectiveCash >= landCost) {
        if (analysis.selfWinningTiles.has(effectiveTileIdx)) {
          utility += 18_000; // WIN IN 1!
        } else if (analysis.enemyWinningThreatTiles.has(effectiveTileIdx)) {
          utility += analysis.enemyWinningThreatTiles.get(effectiveTileIdx)!; // CRITICAL BLOCK!
        } else {
          let propScore = 480 + Math.round(def.baseCost / 1800);
          if (def.type === 'TOURISM') {
            const counts = engine.getTourismCounts(ai.id);
            const isBlue = BLUE_TOURISM_INDICES.includes(effectiveTileIdx);
            const isRed = RED_TOURISM_INDICES.includes(effectiveTileIdx);
            // Completing Blue (3rd island) -> 4x multiplier, completing Red (2nd island) -> 3x multiplier
            const completionBoost =
              isBlue && counts.blueCount === 2
                ? 1600
                : isBlue && counts.blueCount === 1
                ? 800
                : isRed && counts.redCount === 1
                ? 1400
                : 400;
            propScore += 450 + completionBoost + counts.totalCount * 350;
          }
          if (analysis.selfGroupCompletingTiles.has(effectiveTileIdx)) {
            propScore += 1150;
          }
          if (tile.isFestival) {
            propScore += 480;
          }
          utility += propScore;
        }
      } else {
        utility -= 80; // Wasted step when broke
      }
    } else if (engine.arePlayersAllied(ai.id, tile.ownerId)) {
      if (def.type === 'TOURISM') {
        utility += 90;
      } else if (tile.buildingLevel === BuildingLevel.LANDMARK) {
        // Visiting own Landmark triggers Hook 9 skills (S05, M01, M08, M02)
        const s05 = getEffectiveSkillPct(ai, 'S05_STEP_TOLL_X2');
        const m01 = getEffectiveSkillPct(ai, 'M01_MAGNET');
        const m02 = getEffectiveSkillPct(ai, 'M02_BLACK_HOLE');
        const m08 = getEffectiveSkillPct(ai, 'M08_AIRPORT_RECALL');
        utility += 220 + Math.round((s05 + m01 * 1.4 + m02 * 1.2 + m08) * 3.5);
      } else if (tile.buildingLevel === BuildingLevel.HOTEL) {
        const lmCost = engine.calculateBuildCost(
          ai.id,
          effectiveTileIdx,
          BuildingLevel.HOTEL,
          BuildingLevel.LANDMARK
        );
        if (effectiveCash >= lmCost) {
          utility += 1480 + (tile.isFestival ? 450 : 0);
        } else {
          utility += 180;
        }
      } else {
        utility += 360;
      }
    } else {
      // Owned by Enemy!
      const breakdown = engine.calculateTollBreakdown(effectiveTileIdx, ai.id);
      const blackCardPct = getEffectiveSkillPct(ai, 'S07_BLACK_CARD');
      let expectedToll = Math.round(breakdown.netToll * (1 - blackCardPct / 100));
      if (ai.hasAngelCard || tile.isBlackout) {
        expectedToll = 0;
      } else if (ai.hasDiscountCoupon) {
        expectedToll = Math.round(expectedToll * 0.5);
      }

      const canTakeover =
        def.type === 'CITY' &&
        tile.buildingLevel >= BuildingLevel.LAND &&
        tile.buildingLevel <= BuildingLevel.HOTEL;
      const takeoverCost = canTakeover
        ? engine.calculateTakeoverCost(ai.id, effectiveTileIdx)
        : Infinity;

      if (canTakeover && effectiveCash >= expectedToll + takeoverCost) {
        const defender = match.players[tile.ownerId];
        const shieldPct = defender ? getEffectiveSkillPct(defender, 'S08_TAKEOVER_SHIELD') : 0;
        const successRate = 1 - shieldPct / 100;

        if (analysis.selfWinningTiles.has(effectiveTileIdx)) {
          utility += Math.round(16_500 * successRate) - Math.round(expectedToll / 2000);
        } else if (analysis.enemyWinningThreatTiles.has(effectiveTileIdx)) {
          const urgency = analysis.enemyWinningThreatTiles.get(effectiveTileIdx)!;
          utility += Math.round(urgency * successRate) - Math.round(expectedToll / 1600);
        } else if (analysis.selfGroupCompletingTiles.has(effectiveTileIdx)) {
          utility += Math.round(1450 * successRate) - Math.round(expectedToll / 900);
        } else {
          utility -= Math.min(2200, Math.round(expectedToll / 650));
        }
      } else {
        // Cannot takeover (or is Enemy Landmark / Tourism) -> pure toll damage!
        if (expectedToll > effectiveCash) {
          // High danger of forced city sale or bankruptcy!
          const totalNetWorth = analysis.assetsByPlayer[ai.id] + salaryGain;
          const maxRecoverable =
            effectiveCash +
            (ai.loanUsed ? 0 : MATCH_CONFIG.bankLoanAmount) +
            Math.round((totalNetWorth - ai.marble) * MATCH_CONFIG.citySellRefundRate);
          if (expectedToll > maxRecoverable) {
            utility -= 18_000; // LETHAL BANKRUPTCY TILE!
          } else {
            utility -= 3800 + Math.round(expectedToll / 500);
          }
        } else {
          utility -= Math.min(3200, Math.round(expectedToll / 550));
        }
      }
    }
  }

  return utility;
}

/**
 * Computes the exact probability distribution over sums 2..12 for a given integer target (2..12),
 * Odd/Even mode, and character DC% proc rate.
 */
function getEffectiveSumProbabilities(
  targetInt: number,
  mode: OddEvenMode,
  dcProcPct: number,
  doubleBoostPct: number
): number[] {
  const clampedTarget = Math.max(2, Math.min(12, Math.round(targetInt)));
  const table =
    mode === 'EVEN'
      ? DICE_TABLE_EVEN
      : mode === 'ODD'
        ? DICE_TABLE_ODD
        : DICE_TABLE_NONE;

  const baseRow = table[clampedTarget] ?? DICE_TABLE_NONE[7];
  const probs = new Array<number>(13).fill(0); // index 2..12

  const isTargetCompatibleWithMode =
    mode === 'NONE' ||
    (mode === 'EVEN' && clampedTarget % 2 === 0) ||
    (mode === 'ODD' && clampedTarget % 2 === 1);

  const dcProb = isTargetCompatibleWithMode ? Math.max(0, Math.min(1, dcProcPct / 100)) : 0;

  let rowSum = 0;
  for (let i = 0; i < 11; i++) rowSum += baseRow[i];
  const norm = rowSum > 0 ? rowSum : 100;

  for (let i = 0; i < 11; i++) {
    const sum = i + 2;
    const tableP = baseRow[i] / norm;
    probs[sum] = (1 - dcProb) * tableP;
  }

  if (dcProb > 0) {
    probs[clampedTarget] += dcProb;
  }

  // Slight adjustment for double bonus value in caller
  void doubleBoostPct;
  return probs;
}

/**
 * Root Expectimax + Rule-Tree planner for the AI's pre-roll & dice gauge release turn.
 */
export function planAiRollDecision(
  engine: GameEngine,
  match: MatchState,
  ai: PlayerState
): AiRollPlan {
  const analysis = analyzeTacticalBoard(engine, match, ai);
  const stats = computePlayerStats(ai.characterId, ai.treasureIds);

  // 1. Evaluate whether to pay Desert Island bail (if currently trapped on Island)
  let payBailFirst = false;
  if (ai.islandTurnsLeft > 0 && ai.marble >= MATCH_CONFIG.desertIslandBailCost) {
    // Check if any winning tile or critical block tile is reachable from Island (tile 8) within 2..12 steps
    let urgentReachableFromIsland = false;
    for (let s = 2; s <= 12; s++) {
      const dest = (8 + s) % MATCH_CONFIG.boardSize;
      if (analysis.selfWinningTiles.has(dest) || analysis.enemyWinningThreatTiles.has(dest)) {
        urgentReachableFromIsland = true;
        break;
      }
    }

    const unownedCount = match.tiles.filter(
      (t) =>
        (WORLD_MAP_TILES[t.index].type === 'CITY' || WORLD_MAP_TILES[t.index].type === 'TOURISM') &&
        t.ownerId === null
    ).length;

    const stayInSafeJailLateGame =
      match.turnNumber >= MATCH_CONFIG.lateGameTurnThreshold &&
      analysis.isLeadingAssets &&
      analysis.maxEnemyToll >= 550_000 &&
      !urgentReachableFromIsland;

    if (urgentReachableFromIsland && ai.marble >= 450_000) {
      payBailFirst = true;
    } else if (
      !stayInSafeJailLateGame &&
      (unownedCount >= 7 || ai.marble >= analysis.cashReserveFloor + 450_000)
    ) {
      payBailFirst = true;
    }
  }

  // 2. Precompute leaf utilities U[2..12] plus 2nd-ply runway lookahead
  const directUtilities = new Array<number>(13).fill(0);
  for (let sum = 2; sum <= 12; sum++) {
    directUtilities[sum] = evaluateLandingTileUtility(engine, match, ai, sum, analysis);
  }

  const combinedUtilities = new Array<number>(13).fill(0);
  for (let sum = 2; sum <= 12; sum++) {
    let u = directUtilities[sum];

    // Extra roll value if rolling a double (unless consecutiveDoubles === 2 which sends to Island!)
    const baseDblPct = UNIVERSAL_DOUBLE_PROB_PCT[sum - 2] ?? 0;
    const effDblProb =
      baseDblPct > 0
        ? Math.min(1, (baseDblPct + stats.doubleBoostPct) / 100)
        : 0;

    if (ai.consecutiveDoubles >= 2) {
      u -= effDblProb * 650; // Risk of 3rd consecutive double -> Desert Island
    } else if (u > 0) {
      u += effDblProb * 210; // Extra turn tempo bonus
    }

    combinedUtilities[sum] = u;
  }

  // 3. Evaluate all Gauge Targets (2..12) across NONE, EVEN, ODD
  let bestNoneTarget = 7;
  let bestNoneScore = -Infinity;

  for (let g = 2; g <= 12; g++) {
    const probs = getEffectiveSumProbabilities(g, 'NONE', stats.dcProcPct, stats.doubleBoostPct);
    let expected = 0;
    for (let s = 2; s <= 12; s++) {
      expected += probs[s] * combinedUtilities[s];
    }
    if (expected > bestNoneScore) {
      bestNoneScore = expected;
      bestNoneTarget = g;
    }
  }

  let chosenMode: OddEvenMode = 'NONE';
  let chosenTarget = bestNoneTarget;
  let chosenScore = bestNoneScore;

  // Check if spending an ODD/EVEN charge is worthwhile
  if (ai.oddEvenCharges > 0 && (ai.islandTurnsLeft === 0 || payBailFirst)) {
    let bestSpecialMode: OddEvenMode = 'NONE';
    let bestSpecialTarget = bestNoneTarget;
    let bestSpecialScore = bestNoneScore;

    for (const mode of ['EVEN', 'ODD'] as const) {
      for (let g = 2; g <= 12; g++) {
        if (mode === 'EVEN' && g % 2 !== 0) continue;
        if (mode === 'ODD' && g % 2 !== 1) continue;

        const probs = getEffectiveSumProbabilities(g, mode, stats.dcProcPct, stats.doubleBoostPct);
        let expected = 0;
        for (let s = 2; s <= 12; s++) {
          expected += probs[s] * combinedUtilities[s];
        }
        if (expected > bestSpecialScore) {
          bestSpecialScore = expected;
          bestSpecialTarget = g;
          bestSpecialMode = mode;
        }
      }
    }

    // Conservation threshold: spend charge if high gain (win, block, dodge lethal toll, or late game)
    const remainingTurns = Math.max(1, match.maxTurns - match.turnNumber + 1);
    const conservationThreshold =
      ai.oddEvenCharges >= remainingTurns
        ? 80
        : bestSpecialScore >= 3500 || bestNoneScore <= -1200
          ? 180
          : 420;

    if (bestSpecialMode !== 'NONE' && bestSpecialScore - bestNoneScore >= conservationThreshold) {
      chosenMode = bestSpecialMode;
      chosenTarget = bestSpecialTarget;
      chosenScore = bestSpecialScore;
    }
  }

  // Add tiny realistic human-like micro-precision around chosenTarget (scaled tighter by higher DC)
  const precisionSpread = Math.max(0.06, 0.22 - stats.dcLevel * 0.025);
  const jitter = (Math.random() - 0.5) * precisionSpread;
  const gaugeTarget = Number(Math.max(2.0, Math.min(12.0, chosenTarget + jitter)).toFixed(2));

  return {
    payBailFirst,
    oddEvenMode: chosenMode,
    gaugeTarget,
    expectedUtility: chosenScore,
  };
}

/**
 * Decides which building level the AI should construct on `BUY_OR_UPGRADE_CITY`.
 * Returns `null` if the AI should skip building to preserve emergency cash.
 */
export function decideAiBuildLevel(
  engine: GameEngine,
  match: MatchState,
  ai: PlayerState
): BuildingLevel | null {
  if (match.activePrompt?.type !== 'BUY_OR_UPGRADE_CITY') return null;
  const prompt = match.activePrompt;
  const affordable = prompt.options.filter((o) => o.canAfford && !o.isLockedByLap1);
  if (affordable.length === 0) return null;

  const analysis = analyzeTacticalBoard(engine, match, ai);
  const tileIdx = prompt.tileIndex;

  // 1. If buying/building this tile immediately wins the match or blocks an enemy win, always buy!
  const isCriticalTile =
    analysis.selfWinningTiles.has(tileIdx) ||
    analysis.enemyWinningThreatTiles.has(tileIdx) ||
    analysis.selfGroupCompletingTiles.has(tileIdx);

  // 2. If LANDMARK is available and affordable, always lock in the Landmark!
  const landmarkOpt = affordable.find((o) => o.level === BuildingLevel.LANDMARK);
  if (landmarkOpt) {
    return BuildingLevel.LANDMARK;
  }

  // 3. If HOTEL is available and bot has build skills or healthy cash, build HOTEL
  const hotelOpt = affordable.find((o) => o.level === BuildingLevel.HOTEL);
  const hasBuildSkills =
    getEffectiveSkillPct(ai, 'M03_BUILD_TO_START') > 0 ||
    getEffectiveSkillPct(ai, 'M04_BUILD_TO_TRAVEL') > 0;

  if (hotelOpt && (hasBuildSkills || isCriticalTile || ai.marble - hotelOpt.cost >= analysis.cashReserveFloor * 0.55)) {
    return BuildingLevel.HOTEL;
  }

  // 4. Pick the highest level that leaves at least 60% of cashReserveFloor (or lowest option if critical)
  for (let i = affordable.length - 1; i >= 0; i--) {
    const opt = affordable[i];
    if (ai.marble - opt.cost >= analysis.cashReserveFloor * 0.55) {
      return opt.level;
    }
  }

  // If even the lowest option dips into reserve, still buy if unowned or critical (owning property > dead cash)
  if (prompt.currentLevel === BuildingLevel.NONE || isCriticalTile) {
    return affordable[0].level;
  }

  return null;
}

/**
 * Decides whether the AI should execute a Hostile Takeover on an enemy city.
 */
export function decideAiTakeover(
  engine: GameEngine,
  match: MatchState,
  ai: PlayerState
): boolean {
  if (match.activePrompt?.type !== 'TAKEOVER_PROMPT') return false;
  const prompt = match.activePrompt;
  if (!prompt.canAfford || ai.marble < prompt.takeoverCost) return false;

  const analysis = analyzeTacticalBoard(engine, match, ai);
  const tileIdx = prompt.tileIndex;
  const tile = match.tiles[tileIdx];
  const def = WORLD_MAP_TILES[tileIdx];

  // Priority 1: Instant Monopoly Win!
  if (analysis.selfWinningTiles.has(tileIdx)) {
    return true;
  }

  // Priority 2: Blocks an imminent Enemy Monopoly Win or breaks an existing Enemy Color Monopoly!
  if (
    analysis.enemyWinningThreatTiles.has(tileIdx) ||
    engine.isColorGroupMonopoly(def.group, tile.ownerId)
  ) {
    return true;
  }

  // Priority 3: Completes AI's own Color Group
  if (analysis.selfGroupCompletingTiles.has(tileIdx)) {
    return ai.marble - prompt.takeoverCost >= 120_000;
  }

  // Priority 4: Enemy city is at HOTEL (3 buildings) and AI can immediately upgrade to LANDMARK after takeover!
  if (prompt.buildingLevel === BuildingLevel.HOTEL) {
    const lmUpgradeCost = engine.calculateBuildCost(
      ai.id,
      tileIdx,
      BuildingLevel.HOTEL,
      BuildingLevel.LANDMARK
    );
    if (ai.marble - prompt.takeoverCost - lmUpgradeCost >= analysis.cashReserveFloor * 0.5) {
      return true;
    }
  }

  // Priority 5: Festival city or strong reserve
  if (tile.isFestival && ai.marble - prompt.takeoverCost >= analysis.cashReserveFloor * 0.75) {
    return true;
  }

  return ai.marble - prompt.takeoverCost >= analysis.cashReserveFloor * 1.15;
}

/**
 * Decides whether the AI should flip again or stop & collect in the Bonus Coin Flip minigame.
 */
export function decideAiBonusCoinAction(
  engine: GameEngine,
  match: MatchState,
  ai: PlayerState
): { action: 'FLIP' | 'TAKE'; choice: 'HEADS' | 'TAILS' } {
  const choice: 'HEADS' | 'TAILS' = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
  if (match.activePrompt?.type !== 'BONUS_COIN_GAME') {
    return { action: 'TAKE', choice };
  }

  const bs = match.activePrompt.bonusState;
  // Rule 1: If S09_COIN_MASTER free retry is still active, 100% risk-free flip!
  if (bs.hasCoinMasterRetry) {
    return { action: 'FLIP', choice };
  }

  const analysis = analyzeTacticalBoard(engine, match, ai);

  // Rule 2: Round 1 (100K pot -> 200K) is worth flipping unless AI is broke and urgently needs 100K
  if (bs.round === 1) {
    if (ai.marble < 150_000 && bs.currentReward >= 100_000) {
      return { action: 'TAKE', choice };
    }
    return { action: 'FLIP', choice };
  }

  // Rule 3: Round 2 (200K pot -> 400K): Flip if trailing in assets, collect if leading or low cash
  if (bs.round === 2) {
    if (!analysis.isLeadingAssets && ai.marble >= 400_000) {
      return { action: 'FLIP', choice };
    }
    return { action: 'TAKE', choice };
  }

  // Rule 4: Round 3 (400K pot -> 800K): Collect guaranteed 400K unless far behind in late game
  const maxEnemyAssets = Math.max(
    0,
    ...PLAYER_IDS.filter((pid) => !engine.arePlayersAllied(ai.id, pid)).map(
      (pid) => analysis.assetsByPlayer[pid]
    )
  );
  if (match.turnNumber >= 15 && analysis.assetsByPlayer[ai.id] + 400_000 < maxEnemyAssets * 0.65) {
    return { action: 'FLIP', choice };
  }

  return { action: 'TAKE', choice };
}

/**
 * Selects the optimal board tile (and optional Disrupt mode) during `BOARD_TARGET_PICK`.
 */
export function decideAiBoardTarget(
  engine: GameEngine,
  match: MatchState,
  ai: PlayerState
): { tileIndex: number; disruptMode?: DisruptActionMode } {
  const valid = match.boardPickValidTiles;
  const reason = match.boardPickReason;
  if (valid.length === 0) {
    return { tileIndex: 0 };
  }

  const analysis = analyzeTacticalBoard(engine, match, ai);

  // 1. WORLD TRAVEL OR M10 LINE TELEPORT DESTINATION SELECTION
  if (reason === 'WORLD_TRAVEL_DEST' || reason === 'LINE_TELEPORT_DEST') {
    const isFree =
      reason === 'LINE_TELEPORT_DEST' ? true : (match.freeWorldTravelMap[ai.id] ?? false);
    const ticketFee = isFree ? 0 : MATCH_CONFIG.worldTravelTicketCost;
    const budgetAfterTicket = ai.marble - ticketFee;

    const canAffordAtDest = (idx: number): boolean => {
      const t = match.tiles[idx];
      const def = WORLD_MAP_TILES[idx];
      if (t.ownerId === null) {
        return (
          budgetAfterTicket >=
          engine.calculateBuildCost(ai.id, idx, BuildingLevel.NONE, BuildingLevel.LAND)
        );
      }
      if (
        def.type === 'CITY' &&
        !engine.arePlayersAllied(ai.id, t.ownerId) &&
        t.buildingLevel < BuildingLevel.LANDMARK
      ) {
        const toll = engine.calculateTollBreakdown(idx, ai.id).netToll;
        const take = engine.calculateTakeoverCost(ai.id, idx);
        return budgetAfterTicket >= toll + take;
      }
      return false;
    };

    // Priority 1: Immediate Monopoly Win!
    const winTile = valid.find((idx) => analysis.selfWinningTiles.has(idx) && canAffordAtDest(idx));
    if (winTile !== undefined) return { tileIndex: winTile };

    // Priority 2: Block imminent Enemy Monopoly Win!
    const threatCandidates = valid
      .filter((idx) => analysis.enemyWinningThreatTiles.has(idx) && canAffordAtDest(idx))
      .sort(
        (a, b) =>
          (analysis.enemyWinningThreatTiles.get(b) ?? 0) -
          (analysis.enemyWinningThreatTiles.get(a) ?? 0)
      );
    if (threatCandidates.length > 0) return { tileIndex: threatCandidates[0] };

    // Priority 3: Upgrade own HOTEL -> LANDMARK
    const ownHotels = valid
      .filter((idx) => {
        const t = match.tiles[idx];
        if (!engine.arePlayersAllied(ai.id, t.ownerId) || t.buildingLevel !== BuildingLevel.HOTEL) {
          return false;
        }
        const lmCost = engine.calculateBuildCost(
          ai.id,
          idx,
          BuildingLevel.HOTEL,
          BuildingLevel.LANDMARK
        );
        return budgetAfterTicket >= lmCost;
      })
      .sort((a, b) => WORLD_MAP_TILES[b].baseToll - WORLD_MAP_TILES[a].baseToll);
    if (ownHotels.length > 0) return { tileIndex: ownHotels[0] };

    // Priority 4: Complete own Color Group or acquire Tourism Island
    const groupCompleter = valid.find(
      (idx) => analysis.selfGroupCompletingTiles.has(idx) && canAffordAtDest(idx)
    );
    if (groupCompleter !== undefined) return { tileIndex: groupCompleter };

    const unownedTourism = valid.find(
      (idx) =>
        WORLD_MAP_TILES[idx].type === 'TOURISM' &&
        match.tiles[idx].ownerId === null &&
        canAffordAtDest(idx)
    );
    if (unownedTourism !== undefined) return { tileIndex: unownedTourism };

    // Priority 5: Best utility tile
    let bestTile = valid[0];
    let bestScore = -Infinity;
    for (const idx of valid) {
      const steps = (idx - ai.tileIndex + MATCH_CONFIG.boardSize) % MATCH_CONFIG.boardSize;
      const score = evaluateLandingTileUtility(engine, match, ai, steps || 32, analysis);
      if (score > bestScore) {
        bestScore = score;
        bestTile = idx;
      }
    }
    return { tileIndex: bestTile };
  }

  // 2. BLACK HOLE PLACEMENT (M02_BLACK_HOLE)
  if (reason === 'BLACK_HOLE_PLACE') {
    // Priority 1: Place Black Hole directly on the tile an enemy needs to complete their Monopoly!
    const enemyWinTargets = valid
      .filter((idx) => analysis.enemyWinningThreatTiles.has(idx))
      .sort(
        (a, b) =>
          (analysis.enemyWinningThreatTiles.get(b) ?? 0) -
          (analysis.enemyWinningThreatTiles.get(a) ?? 0)
      );
    if (enemyWinTargets.length > 0) {
      return { tileIndex: enemyWinTargets[0] };
    }

    // Priority 2: Place on an enemy's HOTEL city (so if they try to visit it to make a Landmark, they get sucked into our Landmark!) or 6..8 steps ahead of richest enemy
    const enemies = PLAYER_IDS.map((pid) => match.players[pid])
      .filter((p) => p.isSlotActive !== false && !p.isBankrupt && !engine.arePlayersAllied(ai.id, p.id))
      .sort((a, b) => analysis.assetsByPlayer[b.id] - analysis.assetsByPlayer[a.id]);

    const richestEnemy = enemies[0];
    let bestTile = valid[0];
    let bestTrapScore = -Infinity;

    for (const idx of valid) {
      const t = match.tiles[idx];
      let score = 0;

      // Avoid placing Black Hole on our own cities!
      if (engine.arePlayersAllied(ai.id, t.ownerId)) {
        score -= 1000;
      } else if (t.ownerId) {
        // Enemy's own HOTEL or high-toll Landmark
        if (t.buildingLevel === BuildingLevel.HOTEL) score += 650;
        if (t.buildingLevel === BuildingLevel.LANDMARK) score += 450;
      }

      if (idx === 24) {
        score += 520; // Trapping World Travel tile 24!
      }

      if (richestEnemy && richestEnemy.islandTurnsLeft === 0) {
        const dist = (idx - richestEnemy.tileIndex + MATCH_CONFIG.boardSize) % MATCH_CONFIG.boardSize;
        if (dist >= 5 && dist <= 9) {
          score += 500 - Math.abs(7 - dist) * 85; // Peak dice bell-curve 6..8 steps ahead!
        }
      }

      if (score > bestTrapScore) {
        bestTrapScore = score;
        bestTile = idx;
      }
    }

    return { tileIndex: bestTile };
  }

  // 3. START UPGRADE CITY (+1 Building Level)
  if (reason === 'START_UPGRADE_CITY') {
    // Prioritize upgrading HOTEL -> LANDMARK, especially in threatened or high-value color groups
    const sorted = [...valid].sort((a, b) => {
      const ta = match.tiles[a];
      const tb = match.tiles[b];
      const aToLm = ta.buildingLevel === BuildingLevel.HOTEL ? 1 : 0;
      const bToLm = tb.buildingLevel === BuildingLevel.HOTEL ? 1 : 0;
      if (aToLm !== bToLm) return bToLm - aToLm;
      if (ta.isFestival !== tb.isFestival) return tb.isFestival ? 1 : -1;
      return WORLD_MAP_TILES[b].baseToll - WORLD_MAP_TILES[a].baseToll;
    });
    return { tileIndex: sorted[0] };
  }

  // 4. OLYMPIC / EXPO CITY SELECTION
  if (reason === 'OLYMPIC_SELECT') {
    const sorted = [...valid].sort((a, b) => {
      const ta = match.tiles[a];
      const tb = match.tiles[b];
      // Prefer White Hole Landmark or highest-toll Landmark
      const aIsWhiteHole = match.blackHole?.whiteTileIndex === a ? 1 : 0;
      const bIsWhiteHole = match.blackHole?.whiteTileIndex === b ? 1 : 0;
      if (aIsWhiteHole !== bIsWhiteHole) return bIsWhiteHole - aIsWhiteHole;
      if (ta.buildingLevel !== tb.buildingLevel) return tb.buildingLevel - ta.buildingLevel;
      return engine.calculateTollBreakdown(b).rawToll - engine.calculateTollBreakdown(a).rawToll;
    });
    return { tileIndex: sorted[0] };
  }

  // 4b. BLACKOUT CITY SELECTION (Power Outage Chance Card)
  if (reason === 'BLACKOUT_SELECT') {
    const sorted = [...valid].sort((a, b) => {
      const ownerA = match.tiles[a].ownerId ? match.players[match.tiles[a].ownerId!] : null;
      const ownerB = match.tiles[b].ownerId ? match.players[match.tiles[b].ownerId!] : null;
      const aNoAngel = ownerA?.hasAngelCard ? 0 : 1;
      const bNoAngel = ownerB?.hasAngelCard ? 0 : 1;
      if (aNoAngel !== bNoAngel) return bNoAngel - aNoAngel;
      return engine.calculateTollBreakdown(b, ai.id).netToll - engine.calculateTollBreakdown(a, ai.id).netToll;
    });
    return { tileIndex: sorted[0] };
  }

  // 5. M10_DISRUPT_CITY (FORCE_SELL vs SWAP)
  if (reason === 'DISRUPT_SELL_OR_SWAP') {
    const ownNonLandmarkCities = match.tiles.filter(
      (t) =>
        WORLD_MAP_TILES[t.index].type === 'CITY' &&
        t.ownerId === ai.id &&
        t.buildingLevel >= BuildingLevel.LAND &&
        t.buildingLevel < BuildingLevel.LANDMARK
    );

    const isUnshieldedByAngel = (idx: number): boolean => {
      const ownerId = match.tiles[idx].ownerId;
      return Boolean(ownerId && !match.players[ownerId]?.hasAngelCard);
    };

    // Check if SWAP can immediately win or complete a Color Group for the AI!
    if (ownNonLandmarkCities.length > 0) {
      const winSwapTarget = valid.find(
        (idx) => analysis.selfWinningTiles.has(idx) && isUnshieldedByAngel(idx)
      );
      if (winSwapTarget !== undefined) {
        return { tileIndex: winSwapTarget, disruptMode: 'SWAP' };
      }
      const groupSwapTarget = valid.find(
        (idx) => analysis.selfGroupCompletingTiles.has(idx) && isUnshieldedByAngel(idx)
      );
      if (groupSwapTarget !== undefined) {
        return { tileIndex: groupSwapTarget, disruptMode: 'SWAP' };
      }
    }

    // Otherwise FORCE_SELL the enemy city that is unshielded by Angel Card, breaks a Color Monopoly, or has highest value
    const sortedTargets = [...valid].sort((a, b) => {
      const ta = match.tiles[a];
      const tb = match.tiles[b];
      const aUnshielded = isUnshieldedByAngel(a) ? 1 : 0;
      const bUnshielded = isUnshieldedByAngel(b) ? 1 : 0;
      if (aUnshielded !== bUnshielded) return bUnshielded - aUnshielded;
      const aMono = engine.isColorGroupMonopoly(WORLD_MAP_TILES[a].group, ta.ownerId) ? 1 : 0;
      const bMono = engine.isColorGroupMonopoly(WORLD_MAP_TILES[b].group, tb.ownerId) ? 1 : 0;
      if (aMono !== bMono) return bMono - aMono;
      return engine.calculateTilePropertyValue(b) - engine.calculateTilePropertyValue(a);
    });

    const targetIdx = sortedTargets[0];
    // Use SWAP if we have a very cheap disposable city and target is an expensive HOTEL
    const cheapestOwn = [...ownNonLandmarkCities].sort(
      (a, b) => engine.calculateTilePropertyValue(a.index) - engine.calculateTilePropertyValue(b.index)
    )[0];
    const shouldSwap =
      cheapestOwn &&
      !engine.isColorGroupMonopoly(WORLD_MAP_TILES[cheapestOwn.index].group, ai.id) &&
      engine.calculateTilePropertyValue(targetIdx) >=
        engine.calculateTilePropertyValue(cheapestOwn.index) * 1.6;

    return {
      tileIndex: targetIdx,
      disruptMode: shouldSwap ? 'SWAP' : 'FORCE_SELL',
    };
  }

  return { tileIndex: valid[0] };
}

/**
 * Selects the least strategically damaging property for the debtor AI to sell during `DEBT_RESOLUTION`.
 */
export function selectBestTileToSellForDebt(
  engine: GameEngine,
  match: MatchState,
  debtor: PlayerState
): number | null {
  const owned = match.tiles.filter((t) => t.ownerId === debtor.id);
  if (owned.length === 0) return null;

  const scoreKeepPriority = (tile: BoardTileState): number => {
    const def = WORLD_MAP_TILES[tile.index];
    let keepScore = engine.calculateTilePropertyValue(tile.index) / 1000;

    if (tile.buildingLevel === BuildingLevel.LANDMARK) {
      keepScore += 50_000; // Keep Landmarks until absolute last resort
    }
    if (engine.isColorGroupMonopoly(def.group, debtor.id)) {
      keepScore += 15_000; // Protect completed Color Monopolies
    }
    if (def.type === 'TOURISM') {
      const counts = engine.getTourismCounts(debtor.id);
      const isBlue = BLUE_TOURISM_INDICES.includes(tile.index);
      const isRed = RED_TOURISM_INDICES.includes(tile.index);
      const groupProtection =
        (isBlue && counts.blueCount >= 2) || (isRed && counts.redCount === 2) ? 6000 : 2500;
      keepScore += groupProtection + counts.totalCount * 3000;
    }
    if (tile.isFestival) {
      keepScore += 2000;
    }
    return keepScore;
  };

  owned.sort((a, b) => scoreKeepPriority(a) - scoreKeepPriority(b));
  return owned[0].index;
}
