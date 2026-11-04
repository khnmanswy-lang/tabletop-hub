'TAX') {
        this.finishTileResolution();
      } else {
        this.proceedAfterEnemyTollPaid(
          player,
          tile,
          def,
          0,
          '👼 ใช้การ์ดนางฟ้าคุ้มครอง (ยกเว้นค่าผ่านทาง 100%)'
        );
      }
      return true;
    }

    // Player chose NOT to use Angel Card (save it for later and pay cash!)
    this.appendLog(
      player.id,
      `🛡️ ${player.name} เก็บการ์ดนางฟ้าไว้ใช้ทีหลัง และยอมจ่ายเงินเอง!`,
      'TOLL'
    );
    if (prompt.reason === 'TAX') {
      this.executeTaxAuditPayment(player, prompt.tollAmount);
    } else {
      this.executeEnemyTollPayment(player, tile, def, prompt.tollAmount);
    }
    return true;
  }

  private proceedAfterEnemyTollPaid(
    mover: PlayerState,
    tile: BoardTileState,
    def: WorldTileDef,
    paidToll: number,
    tollExemptReason?: string
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
          tollExemptReason,
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

  public confirmTakeover(alsoUpgradeLandmark: boolean = false): boolean {
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

    // After taking over an enemy city, reuse the standard City Construction Modal (BUY_OR_UPGRADE_CITY)
    // so the player can upgrade it (e.g. add buildings or upgrade HOTEL -> LANDMARK) on a separate screen!
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
    this.matchS