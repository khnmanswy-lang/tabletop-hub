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
    tile.isFestival = false;
    tile.isBlackout = false;
    tile.stepMultiplier = 1;
    if (this.matchState.olympicTileIndex === tileIndex) {
      this.matchState.olympicTileIndex = null;
    }

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
        tile.isFestival = false;
        tile.isBlackout = false;
        tile.stepMultiplier = 1;
        if (this.matchState.olympicTileIndex === tile.index) {
          this.matchState.olympicTileIndex = null;
        }
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

    // If S08 Toll Blackout Counter was triggered when paying toll, open BLACKOUT_SELECT picker now
    if (this.matchState.pendingBlackoutFromSkill) {
      this.matchState.pendingBlackoutFromSkill = false;
      if (activePlayer && !activePlayer.isBankrupt) {
        const enemyTiles = this.matchState.tiles
          .filter(
            (t) =>
              t.ownerId !== null &&
              !this.arePlayersAllied(activePlayer.id, t.ownerId) &&
              !t.isBlackout
          )
          .map((t) => t.index);
        if (enemyTiles.length > 0) {
          this.matchState.phase = 'BOARD_TARGET_PICK';
          this.matchState.boardPickReason = 'BLACKOUT_SELECT';
          this.matchState.boardPickValidTiles = enemyTiles;
          this.appendLog(
            activePlayer.id,
            `🔌 ตัดไฟฉุกเฉินทำงาน! เลือกเมืองศัตรู 1 แห่งเพื่อตัดไฟให้ค่าผ่านทางเหลือ 0 M!`,
            'SKILL'
          );
          this.emitStateChange();
          return;
        }
      }
    }

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
      const candidate = this.matchState.players[candidateId];
      if (candidate.isSlotActive !== false && !candidate.isBankrupt) {
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
        : PLAYER_IDS.filter((pid) => this.matchState!.players[pid].isSlotActive !== false && !this.matchState!.players[pid].isBankrupt);

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
        : PLAYER_IDS.filter((pid) => this.matchState!.players[pid].isSlotActive !== false && !this.matchState!.players[pid].isBankrupt);

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

      if (prompt.type === 'ANGEL_CARD_PROMPT') {
        const shouldUseAngel =
          prompt.discountedTollAmount >= 350_000 ||
          prompt.discountedTollAmount > ai.marble * 0.35 ||
          prompt.discountedTollAmount > ai.marble;
        this.resolveAngelCardPrompt(shouldUseAngel);
        return true;
      }

      if (prompt.type === 'TAKEOVER_PROMPT') {
        if (decideAiTakeover(this, this.matchState, ai)) {
          this.confirmTakeover(true);
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