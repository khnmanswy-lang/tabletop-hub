weight:900; color:#141413; display:flex; align-items:center; gap:6px;">
              <span>${isTax ? 'จ่ายให้:' : 'เจ้าของเมือง:'}</span>
              <span style="background:#FEE2E2; color:#991B1B; padding:4px 14px; border-radius:999px; border:2px solid #1E1612; display:flex; align-items:center; gap:4px;">
                <span>${creditor ? getCharacterDef(creditor.characterId).avatarEmoji : '🏛️'}</span>
                <span>${creditor?.name ?? 'ธนาคาร (สรรพากร)'}</span>
              </span>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <!-- Option A: Save Angel Card & Pay Cash -->
            <div style="background:#FFF9EB; border:2.5px solid #1E1612; border-radius:14px; padding:14px 16px; display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
              <div style="font-size:15px; font-weight:900; color:#9A3412;">
                💸 ตัวเลือกที่ 1: เก็บการ์ดนางฟ้าไว้ใช้ทีหลัง
              </div>
              <div style="font-size:13.5px; font-weight:700; color:#475569; line-height:1.4;">
                ยอมจ่าย${isTax ? 'ภาษี' : 'ค่าผ่านทาง'}รอบนี้ เพื่อเก็บ <strong>👼 การ์ดนางฟ้า</strong> ไว้กันแลนด์มาร์กแพงๆ ในเทิร์นถัดไป
              </div>
              ${
                payload.hasDiscountCoupon
                  ? `<div style="font-size:12.5px; font-weight:900; color:#0284C7; background:#E0F2FE; padding:3px 10px; border-radius:8px; border:1.5px solid #38BDF8;">🎟️ ใช้คูปองลด 50% อัตโนมัติ (จาก ${formatMarbleCompact(payload.tollAmount)})</div>`
                  : ''
              }
              <div style="background:#FEE2E2; border:2px solid #EF4444; border-radius:10px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:14px; font-weight:900; color:#991B1B;">ยอดที่ต้องจ่าย:</span>
                <span style="font-family:var(--font-num); font-size:20px; font-weight:900; color:#DC2626;">-${formatMarbleFull(effectiveToll)}</span>
              </div>
              <div style="font-size:13px; font-weight:800; color:${canAffordCash ? '#15803D' : '#DC2626'};">
                ${canAffordCash ? `💵 เงินคงเหลือหลังจ่าย: ${formatMarbleFull(cashAfterPay)}` : `⚠️ เงินสดไม่พอ (ต้องกู้ธนาคาร/ขายเมือง)`}
              </div>
            </div>

            <!-- Option B: Use Angel Card Now -->
            <div style="background:#F0FDF4; border:2.5px solid #16A34A; border-radius:14px; padding:14px 16px; display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
              <div style="font-size:15px; font-weight:900; color:#166534;">
                👼 ตัวเลือกที่ 2: ใช้การ์ดนางฟ้าเดี๋ยวนี้!
              </div>
              <div style="font-size:13.5px; font-weight:700; color:#475569; line-height:1.4;">
                ฉีกการ์ดนางฟ้าเพื่อยกเว้น${isTax ? 'ภาษีสรรพากร' : 'ค่าผ่านทาง'} <strong>100%</strong> ทันที (การ์ดจะหายไปหลังใช้)
              </div>
              <div style="background:#DCFCE7; border:2px solid #22C55E; border-radius:10px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:14px; font-weight:900; color:#166534;">ยอดที่ต้องจ่าย:</span>
                <span style="font-family:var(--font-num); font-size:20px; font-weight:900; color:#15803D;">ฟรี 0 M!</span>
              </div>
              <div style="font-size:13px; font-weight:800; color:#15803D;">
                💵 เงินคงเหลือเท่าเดิม: ${formatMarbleFull(playerCash)}
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; justify-content:center; align-items:center; gap:18px; margin-top:2px;">
          <button class="red-btn" id="btnSaveAngelAndPay" style="flex:1; padding:13px 20px; font-size:16px; font-weight:900;">
            💸 จ่ายเอง -${formatMarbleCompact(effectiveToll)} (เก็บการ์ดไว้)
          </button>
          <button class="gold-btn" id="btnUseAngelCardNow" style="flex:1.15; padding:13px 24px; font-size:17px; font-weight:900;">
            👼 ใช้การ์ดนางฟ้า (ฟรี 0 M!)
          </button>
        </div>
      </div>
    `;

    modal.querySelector('#btnSaveAngelAndPay')?.addEventListener('click', () => {
      soundManager.playClick();
      this.callbacks.onResolveAngelCard?.(false);
    });

    modal.querySelector('#btnUseAngelCardNow')?.addEventListener('click', () => {
      soundManager.playLandmarkFanfare();
      this.callbacks.onResolveAngelCard?.(true);
    });
  }

  /**
   * HOSTILE TAKEOVER MODAL (ซื้อต่อเมืองศัตรู 2.0x ลบส่วนลด Acq Discount)
   */
  private renderTakeoverModal(
    modal: HTMLElement,
    payload: TakeoverModalPayload
  ): void {
    const tileDef = WORLD_MAP_TILES[payload.tileIndex];
    const buyer = this.state.players.find((p) => p.id === payload.buyerId);
    const owner = this.state.players.find((p) => p.id === payload.ownerId);
    const buyerCash = buyer?.marble ?? 0;
    const canAffordTakeover = buyerCash >= payload.netTakeoverCost;
    const totalWithLandmark = payload.netTakeoverCost + payload.landmarkUpgradeCost;
    const canAffordBoth = buyer && payload.canUpgradeToLandmarkAfter
      ? buyerCash >= totalWithLandmark
      : false;

    const tierLabels: Record<number, string> = {
      [BuildingLevel.NONE]: 'ที่ดินเปล่า',
      [BuildingLevel.LAND]: '🚩 ที่ดินเปล่า (0 หลัง)',
      [BuildingLevel.VILLA]: '🏡 บ้านพัก (1 หลัง)',
      [BuildingLevel.BUILDING]: '🏢 ตึกแถว (2 หลัง)',
      [BuildingLevel.HOTEL]: '🏨 โรงแรม (3 หลัง)',
      [BuildingLevel.LANDMARK]: '🏰 แลนด์มาร์ก',
    };
    const tierBadge = tierLabels[payload.buildingLevel] ?? 'สิ่งก่อสร้าง';
    const paidTollVal = payload.paidToll ?? 0;
    const canShowLandmarkBtn =
      payload.canUpgradeToLandmarkAfter &&
      payload.buildingLevel === BuildingLevel.HOTEL &&
      payload.landmarkUpgradeCost > 0;

    const tollReceiptBannerHtml =
      paidTollVal > 0
        ? `<div style="background:#FEF2F2; border:2.5px solid #DC2626; border-radius:12px; padding:8px 16px; display:flex; justify-content:space-between; align-items:center; font-size:15px; font-weight:900; color:#991B1B;">
             <span>💸 หักค่าผ่านทางให้ ${owner?.name ?? payload.ownerId} เรียบร้อยแล้ว:</span>
             <span style="font-family:var(--font-num); font-size:18px; color:#DC2626; background:#FEE2E2; padding:2px 12px; border-radius:999px; border:1.5px solid #EF4444;">-${formatMarbleFull(paidTollVal)}</span>
           </div>`
        : payload.tollExemptReason
          ? `<div style="background:#EFF6FF; border:2.5px solid #2563EB; border-radius:12px; padding:8px 16px; display:flex; justify-content:space-between; align-items:center; font-size:14.5px; font-weight:900; color:#1E40AF;">
               <span>🛡️ ${payload.tollExemptReason}</span>
               <span style="font-family:var(--font-num); font-size:16px; color:#15803D; background:#DCFCE7; padding:2px 12px; border-radius:999px; border:1.5px solid #22C55E;">เสียค่าผ่านทาง 0 M!</span>
             </div>`
          : '';

    modal.innerHTML = `
      <div class="royal-panel" style="width:840px; padding:20px 28px; display:flex; flex-direction:column; gap:14px; text-align:center;">
        <!-- Golden Arcade Title Banner -->
        <div style="background:linear-gradient(180deg, #FFD43B 0%, #F59F00 100%); border:4px solid #1E1612; border-radius:18px; padding:10px 22px; box-shadow:inset 0 3px 0 rgba(255,255,255,0.7), 0 5px 0 #B45309, 0 8px 0 #1E1612; display:flex; align-items:center; justify-content:center; gap:12px;">
          <span style="font-size:26px;">🤝</span>
          <span style="font-family:var(--font-display); font-size:24px; font-weight:900; color:#FFFFFF; -webkit-text-stroke:2px #1E1612; text-shadow:0 3px 0 #1E1612; letter-spacing:0.04em;">
            HOSTILE TAKEOVER
          </span>
          <span style="font-family:var(--font-body); font-size:16px; font-weight:900; color:#1E1612; background:#FFF9EB; padding:3px 14px; border-radius:999px; border:2.5px solid #1E1612; box-shadow:0 2px 0 #1E1612;">
            ซื้อต่อโฉนดเมืองศัตรู!
          </span>
        </div>

        <!-- Deed Card Container -->
        <div style="background:#FFFFFF; border:3.5px solid #1E1612; border-radius:16px; padding:16px 20px; box-shadow:0 4px 0 #1E1612; text-align:left; display:flex; flex-direction:column; gap:12px;">
          ${tollReceiptBannerHtml}
          <!-- City Header & Owner -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2.5px dashed #CBD5E1; padding-bottom:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="background:${tileDef.colorHex}; color:#FFF; padding:4px 14px; border-radius:999px; border:2.5px solid #1E1612; font-size:15px; font-weight:900; box-shadow:0 2px 0 #1E1612;">
                ${tileDef.name.toUpperCase()}
              </span>
              <span style="font-size:22px; font-weight:900; color:#141413;">${tileDef.nameTh}</span>
              <span style="font-size:13px; font-weight:800; background:#F1F5F9; color:#475569; padding:3px 10px; border-radius:8px; border:1.5px solid #CBD5E1;">
                ${tierBadge}
              </span>
            </div>
            <div style="font-size:15px; font-weight:900; color:#141413; display:flex; align-items:center; gap:6px;">
              <span>เจ้าของเดิม:</span>
              <span style="background:#FEE2E2; color:#991B1B; padding:4px 14px; border-radius:999px; border:2px solid #1E1612; display:flex; align-items:center; gap:4px;">
                <span>${owner ? getCharacterDef(owner.characterId).avatarEmoji : '👤'}</span>
                <span>${owner?.name ?? payload.ownerId}</span>
              </span>
            </div>
          </div>

          <!-- 2-Column Property Transfer Receipt -->
          <div style="display:grid; grid-template-columns: 1.05fr 0.95fr; gap:18px; background:#F8FAFC; padding:14px 18px; border-radius:14px; border:2.5px solid #1E1612;">
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:15px; font-weight:800; color:#334155;">
                <span>🏷️ ราคาประเมินซื้อต่อ (2.0x):</span>
                <span style="font-family:var(--font-num); font-size:16px; font-weight:900; color:#1E293B;">${formatMarbleFull(payload.rawTakeoverCost)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:15px; font-weight:900; color:#16A34A;">
                <span>📉 ส่วนลดซื้อต่อ (Acq DC):</span>
                <span style="font-family:var(--font-num); font-size:16px;">-${payload.acqDiscountPct}%</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:17px; font-weight:900; color:#B45309; background:#FEF3C7; border:2px solid #F59E0B; border-radius:10px; padding:8px 12px; margin-top:2px;">
                <span>💰 ยอดชำระซื้อต่อสุทธิ:</span>
                <span style="font-family:var(--font-num); font-size:22px; color:#92400E; font-weight:900;">${formatMarbleFull(payload.netTakeoverCost)}</span>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; justify-content:center; gap:8px; border-left:2.5px dashed #CBD5E1; padding-left:18px;">
              <div style="font-size:14px; font-weight:800; color:#475569;">
                📈 ค่าผ่านทางใหม่หลังยึดครอง:
              </div>
              <div style="background:#DCFCE7; border:2px solid #22C55E; border-radius:10px; padding:6px 14px; font-size:23px; font-weight:900; color:#15803D; font-family:var(--font-num); display:flex; align-items:center; gap:8px;">
                ${getMarbleGemSvg(22)} <span>${formatMarbleFull(payload.resultingToll)}</span>
              </div>
              <div style="background:#FEF2F2; border:1.5px solid #FCA5A5; border-radius:8px; padding:6px 10px; font-size:12px; font-weight:800; color:#991B1B; line-height:1.4;">
                🛡️ สกิล <strong>[S08] โล่ป้องกัน</strong> ของศัตรูอาจทำงานเพื่อสกัดกั้นการซื้อต่อ
              </div>
            </div>
          </div>

          <!-- Player Wallet Affordability Status Bar -->
          <div style="background:${canAffordTakeover ? '#F0FDF4' : '#FEF2F2'}; border:2.5px solid #1E1612; border-radius:12px; padding:10px 18px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px; font-size:15px; font-weight:800; color:#141413;">
              <span>💵 เงินคงเหลือหลังจ่ายค่าผ่านทาง:</span>
              <strong style="font-family:var(--font-num); font-size:17px; color:${canAffordTakeover ? '#15803D' : '#DC2626'};">
                ${formatMarbleFull(buyerCash)}
              </strong>
            </div>
            <div style="font-size:14px; font-weight:900; color:${canAffordTakeover ? '#15803D' : '#DC2626'}; background:${canAffordTakeover ? '#DCFCE7' : '#FEE2E2'}; padding:3px 12px; border-radius:999px; border:1.5px solid ${canAffordTakeover ? '#22C55E' : '#EF4444'};">
              ${canAffordTakeover ? '✅ เงินเพียงพอสำหรับการซื้อต่อ' : `❌ เงินไม่พอ (ขาดอีก ${formatMarbleFull(payload.netTakeoverCost - buyerCash)})`}
            </div>
          </div>
        </div>

        <!-- Action CTA Buttons (Takeover Only — Upgrade happens in the next City Build screen!) -->
        <div style="display:flex; justify-content:center; gap:20px; flex-wrap:wrap;">
          <button class="red-btn" id="btnSkipTakeover" style="padding:12px 32px; font-size:16px; font-weight:900;">
            ข้าม (ไม่ซื้อต่อ)
          </button>
          <button class="green-btn" id="btnDoTakeover" ${!canAffordTakeover ? 'disabled' : ''} style="padding:12px 42px; font-size:18px; font-weight:900;">
            🤝 ซื้อต่อเมือง (${formatMarbleFull(payload.netTakeoverCost)}) ${!canAffordTakeover ? '— เงินไม่พอ' : ''}
          </button>
        </div>
      </div>
    `;

    modal
      .querySelector('#btnSkipTakeover')
      ?.addEventListener('click', () => {
        soundManager.playClick();
        this.callbacks.onPassTakeover?.();
      });
    modal
      .querySelector('#btnDoTakeover')
      ?.addEventListener('click', () => {
        soundManager.playClick();
        this.callbacks.onConfirmTakeover?.(false);
      });
  }

  /**
   * COIN FLIP BONUS MINIGAME MODAL (Tile 2 — Supports S09 Coin Master)
   */
  private renderBonusCoinFlipModal(
    modal: HTMLElement,
    bonus: PendingBonusGameState
  ): void {
    const rewards = MATCH_CONFIG.bonusGameRewards;
    const nextReward = rewards[bonus.round] ?? rewards[3];

    modal.innerHTML = `
      <div class="royal-panel" style="width:780px; padding:24px 30px; display:flex; flex-direction:column; gap:18px; text-align:center;">
        <div>
          <span class="cartoon-title" style="font-size:24px; color:#FFD43B;">
            COIN FLIP BONUS MINIGAME (เกมทายหัว/ก้อย 3 ด่าน)
          </span>
        </div>

        <div style="display:flex; justify-content:center; align-items:center; gap:12px;">
          ${[1, 2, 3]
            .map(
              (r) => `
              <div style="flex:1; background:${
                bonus.round === r ? 'linear-gradient(180deg,#FFFBEB 0%,#FEF08A 100%)' : '#FFF9EB'
              }; border:3px solid #1E1612; border-radius:14px; padding:12px; box-shadow:${
                bonus.round === r ? '0 4px 0 #B45309, 0 6px 0 #1E1612' : '0 3px 0 #1E1612'
              }; position:relative;">
                ${bonus.round === r ? '<span style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:#EF4444; color:#FFF; font-weight:900; font-size:10px; padding:2px 10px; border-radius:999px; border:2px solid #1E1612; box-shadow:0 2px 0 #1E1612;">ACTIVE</span>' : ''}
                <div style="font-size:12px; color:#1E1612; font-weight:900;">ROUND ${r}</div>
                <div style="font-size:17px; font-weight:900; color:#141413; display:flex; align-items:center; justify-content:center; gap:4px; margin-top:3px;">
                  ${getMarbleGemSvg(16)} <span style="font-family:var(--font-num);">${formatMarbleCompact(rewards[r])}</span>
                </div>
              </div>
              ${r < 3 ? '<div style="font-size:22px; font-weight:900; color:#1E1612;">➔</div>' : ''}
            `
            )
            .join('')}
        </div>

        ${
          bonus.autoWonRound1 || bonus.hasCoinMasterRetry
            ? `<div style="background:#DCFCE7; border:2.5px solid #15803D; border-radius:12px; padding:8px 14px; font-size:13px; font-weight:900; color:#166534;">
                ⚡ สกิล [S09] เซียนมินิเกม (Coin Master): ${
                  bonus.hasCoinMasterRetry
                    ? 'มีสิทธิ์ทายผิดแก้ตัวฟรี 1 ครั้ง!'
                    : 'ชนะด่านแรกอัตโนมัติ!'
                }
              </div>`
            : ''
        }

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px;">
          <div style="background:#DCFCE7; border:2.5px solid #1E1612; border-radius:12px; padding:10px 16px; font-size:14px; font-weight:900; color:#166534; box-shadow:0 3px 0 #1E1612;">
            เงินสะสมปัจจุบัน:
            <strong style="font-size:20px; font-family:var(--font-num); color:#15803D; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:4px;">
              ${getMarbleGemSvg(18)} ${formatMarbleFull(bonus.currentReward)}
            </strong>
          </div>
          <div style="background:#FEF9C3; border:2.5px solid #1E1612; border-radius:12px; padding:10px 16px; font-size:14px; font-weight:900; color:#854D0E; box-shadow:0 3px 0 #1E1612;">
            ทายถูกด่านนี้รับเพิ่ม:
            <strong style="font-size:20px; font-family:var(--font-num); color:#B45309; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:4px;">
              ${getMarbleGemSvg(18)} ${formatMarbleFull(nextReward)}
            </strong>
          </div>
        </div>

        <!-- Animated Coin Flip Stage with 3D Vector SVG Coin -->
        <div id="bonusCoinStage" style="height:104px; display:flex; align-items:center; justify-content:center; perspective:800px;">
          <div id="bonusCoinIcon" style="display:inline-flex; align-items:center; justify-content:center; transition:transform 0.2s ease;">
            ${getCoinSvg(100, false)}
          </div>
        </div>

        <div style="display:flex; justify-content:center; gap:18px;">
          <button class="gold-btn" id="btnCoinHeads" style="padding:12px 28px; font-size:16px; font-weight:900;">
            👑 ทายหัว (HEADS)
          </button>
          <button class="blue-btn" id="btnCoinTails" style="padding:12px 28px; font-size:16px; font-weight:900;">
            🦅 ทายก้อย (TAILS)
          </button>
          <button class="green-btn" id="btnCoinStop" style="padding:12px 24px; font-size:15px; font-weight:900;">
            💰 หยุดรับเงิน (${formatMarbleCompact(bonus.currentReward)})
          </button>
        </div>
      </div>
    `;

    const triggerFlip = (guess: 'HEADS' | 'TAILS') => {
      const coinEl = modal.querySelector('#bonusCoinIcon') as HTMLElement | null;
      const headsBtn = modal.querySelector('#btnCoinHeads') as HTMLButtonElement | null;
      const tailsBtn = modal.querySelector('#btnCoinTails') as HTMLButtonElement | null;
      const stopBtn = modal.querySelector('#btnCoinStop') as HTMLButtonElement | null;

      if (headsBtn) headsBtn.disabled = true;
      if (tailsBtn) tailsBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = true;

      if (coinEl) {
        coinEl.style.animation = 'coinFlipAnim 0.75s cubic-bezier(0.2, 0.8, 0.3, 1)';
        soundManager.playRollGaugeTick(0.85);
      }

      setTimeout(() => {
        if (coinEl) {
          coinEl.innerHTML = getCoinSvg(100, guess === 'TAILS');
          coinEl.style.animation = '';
        }
        this.callbacks.onBonusCoinGuess?.(guess);
      }, 720);
    };

    modal
      .querySelector('#btnCoinHeads')
      ?.addEventListener('click', () => triggerFlip('HEADS'));
    modal
      .querySelector('#btnCoinTails')
      ?.addEventListener('click', () => triggerFlip('TAILS'));
    modal
      .querySelector('#btnCoinStop')
      ?.addEventListener('click', () =>
        this.callbacks.onBonusStopAndCollect?.()
      );
  }

  /**
   * Animated 3D Fortune Card Modal (LINE Let's Get Rich Peak Era CHANCE Tile)
   */
  private renderFortuneCardModal(
    modal: HTMLElement,
    payload: FortuneCardModalPayload
  ): void {
    const player = this.state.players.find((p) => p.id === payload.playerId);
    const pName = player?.name ?? payload.playerId;
    const isHuman = !this.youPlayerId || payload.playerId === this.youPlayerId;

    modal.innerHTML = `
      <div class="fortune-card-stage">
        <div class="fortune-card-flipper" id="fortuneCardFlipper">
          <!-- Back of Card (Shown briefly before 3D flipping) -->
          <div class="fortune-card-face fortune-card-back">
            <div class="fc-back-inner">
              <div class="fc-back-star">🌟</div>
              <div class="fc-back-title">CHANCE</div>
              <div class="fc-back-sub">การ์ดดวงชะตา</div>
            </div>
          </div>

          <!-- Front of Card (Revealed after 3D flip) -->
          <div class="fortune-card-face fortune-card-front">
            <div class="fc-front-header">
              <span class="fc-badge">CHANCE CARD</span>
              <span style="font-size:12px; font-weight:800; color:#92400e;">${pName}</span>
            </div>

            <div class="fc-avatar-big">${payload.titleTh.split(' ')[0] ?? '🃏'}</div>

            <div>
              <div class="fc-title-th">${payload.titleTh}</div>
              <div class="fc-title-en">${payload.titleEn}</div>
            </div>

            <div class="fc-desc-box">${payload.descTh}</div>

            ${
              payload.rewardAmount > 0
                ? `<div class="fc-reward-pill">+${formatMarbleCompact(payload.rewardAmount)} MARBLE</div>`
                : ''
            }

            <div style="width:100%; margin-top:8px;">
              <button class="gold-btn fortune-confirm-btn" id="btnConfirmFortuneCard" style="width:100%; padding:10px 16px; font-size:14px; font-weight:900;">
                ${isHuman ? '✨ ตกลง (รับผลการ์ด)' : `⏳ ${pName} กำลังดำเนินการ...`}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Trigger 3D flip shortly after modal renders
    requestAnimationFrame(() => {
      setTimeout(() => {
        const flipper = modal.querySelector('#fortuneCardFlipper');
        if (flipper) {
          flipper.classList.add('flipped');
          soundManager.playLandmarkFanfare();
        }
      }, 140);
    });

    const confirmBtn = modal.querySelector('#btnConfirmFortuneCard') as HTMLButtonElement | null;
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        soundManager.playClick();
        this.callbacks.onConfirmFortuneCard?.();
      });
    }
  }

  /**
   * Displays the glorious animated Angel Shield banner across the screen when an Angel Card is used.
   */
  public showAngelShieldActivationBanner(targetName: string, reason: string): void {
    let overlay = this.stageEl.querySelector('#angelShieldBannerOverlay') as HTMLElement | null;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'angelShieldBannerOverlay';
      overlay.className = 'angel-shield-overlay';
      this.stageEl.appendChild(overlay);
    }

    const reasonText =
      reason === 'TOLL'
        ? `ยกเว้นค่าผ่านทางที่ ${targetName} 100%!`
        : reason === 'BLACKOUT'
        ? `ป้องกันไฟดับที่ ${targetName} สำเร็จ!`
        : `ป้องกันการแย่ง/สลับเมืองที่ ${targetName} สำเร็จ!`;

    overlay.innerHTML = `
      <div class="angel-shield-box">
        <div class="angel-ico">👼</div>
        <div class="angel-heading">การ์ดนางฟ้าทำงาน!</div>
        <div class="angel-detail">${reasonText}</div>
      </div>
    `;

    overlay.classList.add('show');
    soundManager.playLandmarkFanfare();

    setTimeout(() => {
      overlay?.classList.remove('show');
    }, 1800);
  }

  /**
   * BOARD TARGET PICKER DRAWER (For M02 Black Hole, Tile 16 Olympic, Tile 24 World Travel, Tile 0 START Upgrade, M10 Disrupt)
   */
  private renderBoardPickerDrawer(): void {
    const drawer = this.stageEl.