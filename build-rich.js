const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const richDir = path.join(__dirname, 'games', 'lets-get-rich');
const distAssets = path.join(richDir, 'dist', 'assets');
fs.mkdirSync(distAssets, { recursive: true });

// 0. Reassemble uiManager.ts if split into chunks
const uiDir = path.join(richDir, 'src', 'ui');
if (fs.existsSync(path.join(uiDir, 'uiManager.p1'))) {
  const parts = fs.existsSync(path.join(uiDir, 'uiManager.p2a'))
    ? ['uiManager.p1', 'uiManager.p2a', 'uiManager.p2b', 'uiManager.p3']
    : ['uiManager.p1', 'uiManager.p2', 'uiManager.p3'];
  let combined = parts
    .map(f => fs.readFileSync(path.join(uiDir, f), 'utf8'))
    .join('')
    .replace(/\r\n/g, '\n');

  // Default 3-Tab High-Legibility Lobby on both PC and Mobile (with toggle button for Compact All-in-One view)
  combined = combined.replace(
    `  private isMobileLobbyMode(): boolean {\n    if (this.forceMobileLobbyOverride !== null) {\n      return this.forceMobileLobbyOverride;\n    }\n    const vv = window.visualViewport;\n    const vw = vv ? vv.width : window.innerWidth;\n    const vh = vv ? vv.height : window.innerHeight;\n    return vw <= 1100 || vh <= 620;\n  }`,
    `  private isMobileLobbyMode(): boolean {\n    if (this.forceMobileLobbyOverride !== null) {\n      return this.forceMobileLobbyOverride;\n    }\n    return true;\n  }`
  );

  // Ensure per-slot isPlayerSlotActive & 2P/3P/4P quick selector are active in uiManager.ts
  if (!combined.includes('const isPlayerSlotActive =')) {
    combined = combined.replace(
      `const isTeamMode = this.state.mode === 'TEAM_2V2';\n    const ffaCount = this.state.ffaPlayerCount ?? 4;\n    const activeSlotCount = isTeamMode ? 4 : ffaCount;\n\n    // Ensure selected player is valid\n    if (!this.state.players.some((p) => p.id === this.selectedLoadoutPlayerId)) {\n      this.selectedLoadoutPlayerId = 'P1';\n    }`,
      `const isTeamMode = this.state.mode === 'TEAM_2V2';\n    const ffaCount = this.state.ffaPlayerCount ?? 4;\n    const isPlayerSlotActive = (p: PlayerState | undefined, idx: number): boolean => {\n      if (!p) return false;\n      if (typeof p.isSlotActive === 'boolean') return p.isSlotActive;\n      return isTeamMode || idx < ffaCount;\n    };\n    const activeSlotCount = this.state.players.filter((p, idx) => isPlayerSlotActive(p, idx)).length;\n    if (!this.state.players.some((p, idx) => p.id === this.selectedLoadoutPlayerId && isPlayerSlotActive(p, idx))) {\n      const firstActive = this.state.players.find((p, idx) => isPlayerSlotActive(p, idx));\n      this.selectedLoadoutPlayerId = firstActive?.id ?? 'P1';\n    }`
    );
    combined = combined.replace(
      `const playerBannersHtml = PLAYER_IDS.map((pid, idx) => {\n      const isActiveSlot = isTeamMode || idx < ffaCount;\n      const p = this.state.players[idx];`,
      `const playerBannersHtml = PLAYER_IDS.map((pid, idx) => {\n      const p = this.state.players[idx];\n      const isActiveSlot = isPlayerSlotActive(p, idx);`
    );
    combined = combined.replace(
      `<div style="font-size:11px; font-weight:900; color:#786C5E;">SLOT \${pid} EMPTY</div>\n            <div style="display:flex; gap:6px; width:100%;">\n              <button class="gold-btn btn-lobby-add-ai" data-idx="\${idx}" style="flex:1; padding:4px 6px; font-size:10px; font-weight:900; border-radius:8px;">\n                🤖 + Add AI\n              </button>\n              <button class="tab-pill btn-lobby-add-human" data-idx="\${idx}" style="flex:1; padding:4px 4px; font-size:10px; font-weight:900; border-radius:8px;">\n                👤 + Human\n              </button>\n            </div>`,
      `<div style="font-size:12px; font-weight:900; color:#786C5E;">ที่นั่ง \${pid} ว่าง (EMPTY SLOT)</div>\n            <div style="display:flex; gap:6px; width:100%;">\n              <button class="gold-btn btn-lobby-add-ai" data-idx="\${idx}" style="flex:1; padding:5px 6px; font-size:11px; font-weight:900; border-radius:8px; cursor:pointer;">\n                🤖 + เพิ่ม AI Bot\n              </button>\n              <button class="tab-pill btn-lobby-add-human" data-idx="\${idx}" style="flex:1; padding:5px 4px; font-size:11px; font-weight:900; border-radius:8px; cursor:pointer;">\n                👤 + ผู้เล่น\n              </button>\n            </div>`
    );
    combined = combined.replace(
      `const activeHumans = this.state.players.filter((p, i) => (isTeamMode || i < ffaCount) && p.controlType === 'HUMAN').length;`,
      `const activeHumans = this.state.players.filter((p, i) => isPlayerSlotActive(p, i) && p.controlType === 'HUMAN').length;`
    );
    combined = combined.replace(
      `const playerSwitcherPillsHtml = PLAYER_IDS.map((pid, idx) => {\n        const isActiveSlot = isTeamMode || idx < ffaCount;\n        const p = this.state.players[idx];`,
      `const playerSwitcherPillsHtml = PLAYER_IDS.map((pid, idx) => {\n        const p = this.state.players[idx];\n        const isActiveSlot = isPlayerSlotActive(p, idx);`
    );
    combined = combined.replace(
      `const mobilePlayerCardsHtml = PLAYER_IDS.map((pid, idx) => {\n          const isActiveSlot = isTeamMode || idx < ffaCount;\n          const p = this.state.players[idx];`,
      `const mobilePlayerCardsHtml = PLAYER_IDS.map((pid, idx) => {\n          const p = this.state.players[idx];\n          const isActiveSlot = isPlayerSlotActive(p, idx);`
    );
    combined = combined.replace(
      `<button id="lobbyModeTeam" class="tab-pill \${isTeamMode ? 'active' : ''}" style="border-radius:999px; padding:8px 20px; font-size:16px; font-weight:900; \${isTeamMode ? 'background:#1B65C6; color:#fff;' : ''}">\n                  🤝 ทีม 2v2 (Team Match)\n                </button>`,
      `<button id="lobbyModeTeam" class="tab-pill \${isTeamMode ? 'active' : ''}" style="border-radius:999px; padding:7px 16px; font-size:15.5px; font-weight:900; \${isTeamMode ? 'background:#1B65C6; color:#fff;' : ''}">\n                  🤝 ทีม 2v2\n                </button>\n                \${!isTeamMode ? \`<div style="display:inline-flex; align-items:center; gap:6px; margin-left:6px; background:#F3E5C8; border:2.5px solid #1E1612; border-radius:999px; padding:2px 6px;"><span style="font-size:14px; font-weight:900; color:#1E1612; padding-left:4px;">จำนวน:</span>\${([2, 3, 4] as const).map((cnt) => \`<button class="tab-pill btn-lobby-ffa-count \${activeSlotCount === cnt ? 'active' : ''}" data-count="\${cnt}" style="border-radius:999px; padding:4px 12px; font-size:14.5px; font-weight:900; \${activeSlotCount === cnt ? 'background:#D97706; color:#fff;' : ''}">\${cnt}P</button>\`).join('')}</div>\` : ''}`
    );
    combined = combined.replace(
      `<button id="lobbyModeTeam" class="tab-pill \${isTeamMode ? 'active' : ''}" style="border-radius:999px; padding:3px 12px; font-size:11px; font-weight:900; \${isTeamMode ? 'background:#1B65C6; color:#fff;' : ''}">\n                🤝 2v2 Team Match\n              </button>\n            </div>`,
      `<button id="lobbyModeTeam" class="tab-pill \${isTeamMode ? 'active' : ''}" style="border-radius:999px; padding:3px 12px; font-size:11px; font-weight:900; \${isTeamMode ? 'background:#1B65C6; color:#fff;' : ''}">\n                🤝 2v2 Team Match\n              </button>\n            </div>\n            \${!isTeamMode ? \`<div style="background:#F3E5C8; border:2px solid #1E1612; border-radius:999px; padding:2px; display:flex; gap:3px;">\${([2, 3, 4] as const).map((cnt) => \`<button class="tab-pill btn-lobby-ffa-count \${activeSlotCount === cnt ? 'active' : ''}" data-count="\${cnt}" style="border-radius:999px; padding:3px 10px; font-size:11px; font-weight:900; \${activeSlotCount === cnt ? 'background:#D97706; color:#fff;' : ''}">\${cnt}P</button>\`).join('')}</div>\` : ''}`
    );
    combined = combined.replace(
      `🎲 เริ่มเกม (\${isTeamMode ? '2v2' : \`\${ffaCount}P\`})`,
      `\${activeSlotCount < 2 ? '⚠️ ต้องมี 2+ คน' : \`🎲 เริ่มเกม (\${isTeamMode ? '2v2' : \`\${activeSlotCount}P\`})\`}`
    );
    combined = combined.replace(
      `🎲 START MATCH (\${isTeamMode ? '2v2' : \`\${ffaCount}P\`})`,
      `\${activeSlotCount < 2 ? '⚠️ NEED 2+ PLAYERS' : \`🎲 START MATCH (\${isTeamMode ? '2v2' : \`\${activeSlotCount}P\`})\`}`
    );
    combined = combined.replace(
      `    // Start Match\n    container.querySelector('#btnStartMatchNow')?.addEventListener('click', () => {`,
      `    container.querySelectorAll('.btn-lobby-ffa-count').forEach((btn) => {\n      btn.addEventListener('click', () => {\n        soundManager.playClick();\n        const cnt = Number((btn as HTMLElement).dataset.count) as 2 | 3 | 4;\n        if (cnt === 2 || cnt === 3 || cnt === 4) {\n          this.state.ffaPlayerCount = cnt;\n          this.callbacks.onFfaPlayerCountChange?.(cnt);\n          this.renderLobbyScreen();\n        }\n      });\n    });\n\n    // Start Match\n    container.querySelector('#btnStartMatchNow')?.addEventListener('click', () => {`
    );
  }

  // Ensure TakeoverModalPayload, AngelCardModalPayload, renderAngelCardModal, and renderTakeoverModal are present
  if (!combined.includes('AngelCardModalPayload')) {
    combined = combined.replace(
      `  canUpgradeToLandmarkAfter: boolean;\n  landmarkUpgradeCost: number;\n}`,
      `  canUpgradeToLandmarkAfter: boolean;\n  landmarkUpgradeCost: number;\n  paidToll?: number;\n  tollExemptReason?: string;\n}\n\nexport interface AngelCardModalPayload {\n  playerId: PlayerId;\n  tileIndex: number;\n  creditorId: PlayerId | 'BANK';\n  tollAmount: number;\n  hasDiscountCoupon: boolean;\n  discountedTollAmount: number;\n  reason: 'TOLL' | 'TAX';\n}`
    );
    combined = combined.replace(
      `  pendingCityModal?: CityModalPayload | null;\n  pendingTakeoverModal?: TakeoverModalPayload | null;`,
      `  pendingCityModal?: CityModalPayload | null;\n  pendingTakeoverModal?: TakeoverModalPayload | null;\n  pendingAngelCardModal?: AngelCardModalPayload | null;`
    );
    combined = combined.replace(
      `  onConfirmTakeover?: (alsoUpgradeLandmark?: boolean) => void;\n  onPassTakeover?: () => void;`,
      `  onConfirmTakeover?: (alsoUpgradeLandmark?: boolean) => void;\n  onPassTakeover?: () => void;\n  onResolveAngelCard?: (useCard: boolean) => void;`
    );
    combined = combined.replace(
      `    if (this.state.pendingTakeoverModal) {\n      if (this.canControlSlotLocally(this.state.pendingTakeoverModal.buyerId)) {\n        this.renderTakeoverModal(modal, this.state.pendingTakeoverModal);\n        modal.classList.add('open');\n        return;\n      }\n    }`,
      `    if (this.state.pendingAngelCardModal) {\n      if (this.canControlSlotLocally(this.state.pendingAngelCardModal.playerId)) {\n        this.renderAngelCardModal(modal, this.state.pendingAngelCardModal);\n        modal.classList.add('open');\n        return;\n      }\n    }\n\n    if (this.state.pendingTakeoverModal) {\n      if (this.canControlSlotLocally(this.state.pendingTakeoverModal.buyerId)) {\n        this.renderTakeoverModal(modal, this.state.pendingTakeoverModal);\n        modal.classList.add('open');\n        return;\n      }\n    }`
    );
    combined = combined.replace(
      `  private renderTakeoverModal(`,
      `  private renderAngelCardModal(\n    modal: HTMLElement,\n    payload: AngelCardModalPayload\n  ): void {\n    const tileDef = WORLD_MAP_TILES[payload.tileIndex];\n    const player = this.state.players.find((p) => p.id === payload.playerId);\n    const creditor = payload.creditorId === 'BANK' ? null : this.state.players.find((p) => p.id === payload.creditorId);\n    const playerCash = player?.marble ?? 0;\n    const effectiveToll = payload.discountedTollAmount ?? payload.tollAmount;\n    const canAffordCash = playerCash >= effectiveToll;\n    const cashAfterPay = Math.max(0, playerCash - effectiveToll);\n    const isTax = payload.reason === 'TAX';\n\n    modal.innerHTML = \`\n      <div class="royal-panel" style="width:760px; padding:22px 28px; display:flex; flex-direction:column; gap:16px; text-align:center;">\n        <div style="background:linear-gradient(180deg, #FDE047 0%, #EAB308 55%, #CA8A04 100%); border:4px solid #1E1612; border-radius:18px; padding:12px 22px; box-shadow:inset 0 3px 0 rgba(255,255,255,0.8), 0 5px 0 #854D0E, 0 8px 0 #1E1612; display:flex; align-items:center; justify-content:center; gap:12px;">\n          <span style="font-size:32px; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">👼</span>\n          <span style="font-family:var(--font-display); font-size:24px; font-weight:900; color:#FFFFFF; -webkit-text-stroke:2px #1E1612; text-shadow:0 3px 0 #1E1612; letter-spacing:0.04em;">ANGEL SHIELD CARD</span>\n          <span style="font-family:var(--font-body); font-size:15px; font-weight:900; color:#1E1612; background:#FFFBEB; padding:4px 14px; border-radius:999px; border:2.5px solid #1E1612; box-shadow:0 2px 0 #1E1612;">ต้องการใช้การ์ดนางฟ้าตอนนี้ไหม?</span>\n        </div>\n        <div style="background:#FFFFFF; border:3.5px solid #1E1612; border-radius:16px; padding:18px 22px; box-shadow:0 4px 0 #1E1612; text-align:left; display:flex; flex-direction:column; gap:14px;">\n          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2.5px dashed #CBD5E1; padding-bottom:10px;">\n            <div style="display:flex; align-items:center; gap:10px;">\n              <span style="background:\${tileDef?.colorHex ?? '#EF4444'}; color:#FFF; padding:4px 14px; border-radius:999px; border:2.5px solid #1E1612; font-size:15px; font-weight:900; box-shadow:0 2px 0 #1E1612;">\${(tileDef?.name ?? 'TAX').toUpperCase()}</span>\n              <span style="font-size:22px; font-weight:900; color:#141413;">\${tileDef?.nameTh ?? 'สรรพากร'}</span>\n            </div>\n            <div style="font-size:15px; font-weight:900; color:#141413; display:flex; align-items:center; gap:6px;">\n              <span>\${isTax ? 'จ่ายให้:' : 'เจ้าของเมือง:'}</span>\n              <span style="background:#FEE2E2; color:#991B1B; padding:4px 14px; border-radius:999px; border:2px solid #1E1612; display:flex; align-items:center; gap:4px;">\n                <span>\${creditor ? getCharacterDef(creditor.characterId).avatarEmoji : '🏛️'}</span>\n                <span>\${creditor?.name ?? 'ธนาคาร (สรรพากร)'}</span>\n              </span>\n            </div>\n          </div>\n          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">\n            <div style="background:#FFF9EB; border:2.5px solid #1E1612; border-radius:14px; padding:14px 16px; display:flex; flex-direction:column; justify-content:space-between; gap:8px;">\n              <div style="font-size:15px; font-weight:900; color:#9A3412;">💸 ตัวเลือกที่ 1: เก็บการ์ดนางฟ้าไว้ใช้ทีหลัง</div>\n              <div style="font-size:13.5px; font-weight:700; color:#475569; line-height:1.4;">ยอมจ่าย\${isTax ? 'ภาษี' : 'ค่าผ่านทาง'}รอบนี้ เพื่อเก็บ <strong>👼 การ์ดนางฟ้า</strong> ไว้กันแลนด์มาร์กแพงๆ ในเทิร์นถัดไป</div>\n              \${payload.hasDiscountCoupon ? \`<div style="font-size:12.5px; font-weight:900; color:#0284C7; background:#E0F2FE; padding:3px 10px; border-radius:8px; border:1.5px solid #38BDF8;">🎟️ ใช้คูปองลด 50% อัตโนมัติ (จาก \${formatMarbleCompact(payload.tollAmount)})</div>\` : ''}\n              <div style="background:#FEE2E2; border:2px solid #EF4444; border-radius:10px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">\n                <span style="font-size:14px; font-weight:900; color:#991B1B;">ยอดที่ต้องจ่าย:</span>\n                <span style="font-family:var(--font-num); font-size:20px; font-weight:900; color:#DC2626;">-\${formatMarbleFull(effectiveToll)}</span>\n              </div>\n              <div style="font-size:13px; font-weight:800; color:\${canAffordCash ? '#15803D' : '#DC2626'};">\${canAffordCash ? \`💵 เงินคงเหลือหลังจ่าย: \${formatMarbleFull(cashAfterPay)}\` : \`⚠️ เงินสดไม่พอ (ต้องกู้ธนาคาร/ขายเมือง)\`}</div>\n            </div>\n            <div style="background:#F0FDF4; border:2.5px solid #16A34A; border-radius:14px; padding:14px 16px; display:flex; flex-direction:column; justify-content:space-between; gap:8px;">\n              <div style="font-size:15px; font-weight:900; color:#166534;">👼 ตัวเลือกที่ 2: ใช้การ์ดนางฟ้าเดี๋ยวนี้!</div>\n              <div style="font-size:13.5px; font-weight:700; color:#475569; line-height:1.4;">ฉีกการ์ดนางฟ้าเพื่อยกเว้น\${isTax ? 'ภาษีสรรพากร' : 'ค่าผ่านทาง'} <strong>100%</strong> ทันที (การ์ดจะหายไปหลังใช้)</div>\n              <div style="background:#DCFCE7; border:2px solid #22C55E; border-radius:10px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">\n                <span style="font-size:14px; font-weight:900; color:#166534;">ยอดที่ต้องจ่าย:</span>\n                <span style="font-family:var(--font-num); font-size:20px; font-weight:900; color:#15803D;">ฟรี 0 M!</span>\n              </div>\n              <div style="font-size:13px; font-weight:800; color:#15803D;">💵 เงินคงเหลือเท่าเดิม: \${formatMarbleFull(playerCash)}</div>\n            </div>\n          </div>\n        </div>\n        <div style="display:flex; justify-content:center; align-items:center; gap:18px; margin-top:2px;">\n          <button class="red-btn" id="btnSaveAngelAndPay" style="flex:1; padding:13px 20px; font-size:16px; font-weight:900;">💸 จ่ายเอง -\${formatMarbleCompact(effectiveToll)} (เก็บการ์ดไว้)</button>\n          <button class="gold-btn" id="btnUseAngelCardNow" style="flex:1.15; padding:13px 24px; font-size:17px; font-weight:900;">👼 ใช้การ์ดนางฟ้า (ฟรี 0 M!)</button>\n        </div>\n      </div>\n    \`;\n\n    modal.querySelector('#btnSaveAngelAndPay')?.addEventListener('click', () => {\n      soundManager.playClick();\n      this.callbacks.onResolveAngelCard?.(false);\n    });\n    modal.querySelector('#btnUseAngelCardNow')?.addEventListener('click', () => {\n      soundManager.playLandmarkFanfare();\n      this.callbacks.onResolveAngelCard?.(true);\n    });\n  }\n\n  private renderTakeoverModal(`
    );
    combined = combined.replace(
      `    const tierLabels: Record<number, string> = {\n      [BuildingLevel.NONE]: 'ที่ดินเปล่า',\n      [BuildingLevel.VILLA]: '🏡 วิลล่า',\n      [BuildingLevel.BUILDING]: '🏢 ตึก',\n      [BuildingLevel.HOTEL]: '🏨 โรงแรม',\n      [BuildingLevel.LANDMARK]: '🏰 แลนด์มาร์ก',\n    };\n    const tierBadge = tierLabels[payload.buildingLevel] ?? 'สิ่งก่อสร้าง';`,
      `    const tierLabels: Record<number, string> = {\n      [BuildingLevel.NONE]: 'ที่ดินเปล่า',\n      [BuildingLevel.LAND]: '🚩 ที่ดินเปล่า (0 หลัง)',\n      [BuildingLevel.VILLA]: '🏡 บ้านพัก (1 หลัง)',\n      [BuildingLevel.BUILDING]: '🏢 ตึกแถว (2 หลัง)',\n      [BuildingLevel.HOTEL]: '🏨 โรงแรม (3 หลัง)',\n      [BuildingLevel.LANDMARK]: '🏰 แลนด์มาร์ก',\n    };\n    const tierBadge = tierLabels[payload.buildingLevel] ?? 'สิ่งก่อสร้าง';\n    const paidTollVal = payload.paidToll ?? 0;\n    const canShowLandmarkBtn = payload.canUpgradeToLandmarkAfter && payload.buildingLevel === BuildingLevel.HOTEL && payload.landmarkUpgradeCost > 0;\n    const tollReceiptBannerHtml = paidTollVal > 0 ? \`<div style="background:#FEF2F2; border:2.5px solid #DC2626; border-radius:12px; padding:8px 16px; display:flex; justify-content:space-between; align-items:center; font-size:15px; font-weight:900; color:#991B1B;"><span>💸 หักค่าผ่านทางให้ \${owner?.name ?? payload.ownerId} เรียบร้อยแล้ว:</span><span style="font-family:var(--font-num); font-size:18px; color:#DC2626; background:#FEE2E2; padding:2px 12px; border-radius:999px; border:1.5px solid #EF4444;">-\${formatMarbleFull(paidTollVal)}</span></div>\` : payload.tollExemptReason ? \`<div style="background:#EFF6FF; border:2.5px solid #2563EB; border-radius:12px; padding:8px 16px; display:flex; justify-content:space-between; align-items:center; font-size:14.5px; font-weight:900; color:#1E40AF;"><span>🛡️ \${payload.tollExemptReason}</span><span style="font-family:var(--font-num); font-size:16px; color:#15803D; background:#DCFCE7; padding:2px 12px; border-radius:999px; border:1.5px solid #22C55E;">เสียค่าผ่านทาง 0 M!</span></div>\` : '';`
    );
    combined = combined.replace(
      `        <!-- Deed Card Container -->\n        <div style="background:#FFFFFF; border:3.5px solid #1E1612; border-radius:16px; padding:18px 22px; box-shadow:0 4px 0 #1E1612; text-align:left; display:flex; flex-direction:column; gap:14px;">`,
      `        <!-- Deed Card Container -->\n        <div style="background:#FFFFFF; border:3.5px solid #1E1612; border-radius:16px; padding:16px 20px; box-shadow:0 4px 0 #1E1612; text-align:left; display:flex; flex-direction:column; gap:12px;">\n          \${tollReceiptBannerHtml}`
    );
    combined = combined.replace(
      `          \${\n            payload.canUpgradeToLandmarkAfter\n              ? \`<button class="gold-btn" id="btnTakeoverAndLandmark" \${!canAffordBoth ? 'disabled' : ''} style="padding:12px 30px; font-size:17px; font-weight:900;">\n                  🏰 ซื้อต่อ + สร้างแลนด์มาร์ก (\${formatMarbleFull(totalWithLandmark)}) \${!canAffordBoth ? '— เงินไม่พอ' : ''}\n                </button>\`\n              : ''\n          }`,
      `          \${\n            canShowLandmarkBtn\n              ? \`<button class="gold-btn" id="btnTakeoverAndLandmark" \${!canAffordBoth ? 'disabled' : ''} style="padding:12px 26px; font-size:16px; font-weight:900;">\n                  🏰 ซื้อต่อ + สร้างแลนด์มาร์ก (+\${formatMarbleCompact(payload.landmarkUpgradeCost)} = \${formatMarbleFull(totalWithLandmark)}) \${!canAffordBoth ? '— เงินไม่พอ' : ''}\n                </button>\`\n              : ''\n          }`
    );
  }

  fs.writeFileSync(path.join(uiDir, 'uiManager.ts'), combined, 'utf8');
}

// 0b. Ensure gameEngine.ts has per-slot isSlotActive kick/2P/3P support
const engineFile = path.join(richDir, 'src', 'engine', 'gameEngine.ts');
if (fs.existsSync(engineFile)) {
  let engSrc = fs.readFileSync(engineFile, 'utf8').replace(/\r\n/g, '\n');
  if (!engSrc.includes('syncFfaPlayerCountFromActiveSlots')) {
    engSrc = engSrc.replace(
      'treasureIds: [string, string, string];\n}',
      'treasureIds: [string, string, string];\n  isSlotActive?: boolean;\n}'
    );
    engSrc = engSrc.replace(
      `  public setGameMode(mode: GameMode): void {\n    this.lobbyConfig.gameMode = mode;\n    for (const pid of PLAYER_IDS) {\n      const slot = this.lobbyConfig.players[pid];\n      if (mode === 'TEAM_2V2') {\n        slot.teamId = pid === 'P1' || pid === 'P3' ? 'ALPHA' : 'BRAVO';\n      } else {\n        slot.teamId = null;\n      }\n    }\n    this.emitStateChange();\n  }\n\n  public setFfaPlayerCount(count: 2 | 3 | 4): void {\n    this.lobbyConfig.ffaPlayerCount = count;\n    const activeIds = PLAYER_IDS.slice(0, count);\n    if (!activeIds.includes(this.lobbyConfig.loadoutInspectPlayerId)) {\n      this.lobbyConfig.loadoutInspectPlayerId = 'P1';\n    }\n    this.emitStateChange();\n  }\n\n  public getFfaPlayerCount(): 2 | 3 | 4 {\n    return this.lobbyConfig.ffaPlayerCount ?? 4;\n  }\n\n  public setPlayerControlType(playerId: PlayerId, controlType: ControlType): void {\n    const slot = this.lobbyConfig.players[playerId];\n    if (!slot) return;\n    slot.controlType = controlType;\n    const charDef = getCharacterDef(slot.characterId);\n    if (controlType === 'AI_BOT') {\n      slot.name = \`Bot \${charDef.name}\`;\n    } else if (controlType === 'HUMAN') {\n      slot.name = \`Player \${playerId.slice(1)}\`;\n    }\n    this.emitStateChange();\n  }`,
      `  public setGameMode(mode: GameMode): void {\n    this.lobbyConfig.gameMode = mode;\n    for (const pid of PLAYER_IDS) {\n      const slot = this.lobbyConfig.players[pid];\n      if (mode === 'TEAM_2V2') {\n        slot.teamId = pid === 'P1' || pid === 'P3' ? 'ALPHA' : 'BRAVO';\n        slot.isSlotActive = true;\n      } else {\n        slot.teamId = null;\n      }\n    }\n    this.syncFfaPlayerCountFromActiveSlots();\n    this.emitStateChange();\n  }\n\n  private syncFfaPlayerCountFromActiveSlots(): void {\n    const activeCount = PLAYER_IDS.filter((pid) => this.lobbyConfig.players[pid]?.isSlotActive !== false).length;\n    this.lobbyConfig.ffaPlayerCount = Math.min(4, Math.max(2, activeCount)) as 2 | 3 | 4;\n  }\n\n  public setFfaPlayerCount(count: 2 | 3 | 4): void {\n    this.lobbyConfig.ffaPlayerCount = count;\n    PLAYER_IDS.forEach((pid, idx) => {\n      const slot = this.lobbyConfig.players[pid];\n      if (slot) slot.isSlotActive = idx < count;\n    });\n    const activeIds = PLAYER_IDS.filter((pid) => this.lobbyConfig.players[pid]?.isSlotActive !== false);\n    if (!activeIds.includes(this.lobbyConfig.loadoutInspectPlayerId)) {\n      this.lobbyConfig.loadoutInspectPlayerId = activeIds[0] ?? 'P1';\n    }\n    this.emitStateChange();\n  }\n\n  public getFfaPlayerCount(): 2 | 3 | 4 {\n    const activeCount = PLAYER_IDS.filter((pid) => this.lobbyConfig.players[pid]?.isSlotActive !== false).length;\n    return Math.min(4, Math.max(2, activeCount)) as 2 | 3 | 4;\n  }\n\n  public setPlayerControlType(playerId: PlayerId, controlType: ControlType): void {\n    const slot = this.lobbyConfig.players[playerId];\n    if (!slot) return;\n    slot.isSlotActive = true;\n    slot.controlType = controlType;\n    const charDef = getCharacterDef(slot.characterId);\n    if (controlType === 'AI_BOT') {\n      slot.name = \`Bot \${charDef.name}\`;\n    } else if (controlType === 'HUMAN') {\n      slot.name = \`Player \${playerId.slice(1)}\`;\n    }\n    this.syncFfaPlayerCountFromActiveSlots();\n    this.emitStateChange();\n  }`
    );
    engSrc = engSrc.replace(
      /public kickPlayerSlot\(playerId: PlayerId\): void \{[\s\S]*?public startNewMatch\(\): MatchState \{\s*const mode = this\.lobbyConfig\.gameMode;\s*const ffaCount = this\.lobbyConfig\.ffaPlayerCount \?\? 4;\s*const activeSlotCount = mode === 'TEAM_2V2' \? 4 : ffaCount;\s*const players: Record<PlayerId, PlayerState> = \{\} as Record<PlayerId, PlayerState>;\s*for \(let idx = 0; idx < PLAYER_IDS\.length; idx\+\+\) \{\s*const pid = PLAYER_IDS\[idx\];\s*const isSlotActive = idx < activeSlotCount;\s*const slot = this\.lobbyConfig\.players\[pid\];/,
      `public kickPlayerSlot(playerId: PlayerId): void {\n    const slot = this.lobbyConfig.players[playerId];\n    if (!slot) return;\n    slot.isSlotActive = false;\n    this.syncFfaPlayerCountFromActiveSlots();\n    const activeIds = PLAYER_IDS.filter((pid) => this.lobbyConfig.players[pid]?.isSlotActive !== false);\n    if (!activeIds.includes(this.lobbyConfig.loadoutInspectPlayerId)) {\n      this.lobbyConfig.loadoutInspectPlayerId = activeIds[0] ?? 'P1';\n    }\n    this.emitStateChange();\n  }\n\n  public startNewMatch(): MatchState {\n    const mode = this.lobbyConfig.gameMode;\n    const currentlyActive = PLAYER_IDS.filter((pid) => this.lobbyConfig.players[pid]?.isSlotActive !== false);\n    if (currentlyActive.length < 2) {\n      for (const pid of PLAYER_IDS) {\n        if (this.lobbyConfig.players[pid].isSlotActive === false) {\n          this.lobbyConfig.players[pid].isSlotActive = true;\n          break;\n        }\n      }\n      this.syncFfaPlayerCountFromActiveSlots();\n    }\n    const players: Record<PlayerId, PlayerState> = {} as Record<PlayerId, PlayerState>;\n    for (let idx = 0; idx < PLAYER_IDS.length; idx++) {\n      const pid = PLAYER_IDS[idx];\n      const slot = this.lobbyConfig.players[pid];\n      const isSlotActive = slot.isSlotActive !== false;`
    );
    fs.writeFileSync(engineFile, engSrc, 'utf8');
  }

  // Ensure gameEngine.ts has ANGEL_CARD_PROMPT, tollExemptReason on TAKEOVER_PROMPT, and clean confirmTakeover(alsoUpgradeLandmark)
  engSrc = fs.readFileSync(engineFile, 'utf8').replace(/\r\n/g, '\n');
  if (!engSrc.includes('ANGEL_CARD_PROMPT')) {
    engSrc = engSrc.replace(
      /      canAfford: boolean;\n      paidToll: number;(?:\n      tollExemptReason\?: string;)?\n    \}/,
      `      canAfford: boolean;\n      paidToll: number;\n      tollExemptReason?: string;\n    }\n  | {\n      type: 'ANGEL_CARD_PROMPT';\n      playerId: PlayerId;\n      tileIndex: number;\n      creditorId: PlayerId | 'BANK';\n      tollAmount: number;\n      hasDiscountCoupon: boolean;\n      discountedTollAmount: number;\n      reason: 'TOLL' | 'TAX';\n    }`
    );
    engSrc = engSrc.replace(
      `        skillUsesRemaining: createInitialSkillUsesMap(slot.characterId, cleanTreasures),\n        hasAngelCard: false,\n        hasDiscountCoupon: false,`,
      `        skillUsesRemaining: createInitialSkillUsesMap(slot.characterId, cleanTreasures),\n        hasAngelCard: isSlotActive,\n        hasDiscountCoupon: false,`
    );
    engSrc = engSrc.replace(
      /      this\.proceedAfterEnemyTollPaid\(mover, tile, def, 0(?:, '[^']*')?\);\n      return;\n    \}\n\n    const breakdown = this\.calculateTollBreakdown\(tile\.index, mover\.id\);\n    let payableToll = breakdown\.netToll;\n\n    \/\/ Hook 5: ON_BEFORE_PAY_TOLL -> S07_BLACK_CARD \(100% Toll Exemption Once\)\n    if \(payableToll > 0 && this\.tryTriggerSkill\(mover, 'S07_BLACK_CARD'\)\) \{[\s\S]*?\/\/ Check Held Angel Shield Card \(100% Toll Exemption from Chance Card\)[\s\S]*?this\.proceedAfterEnemyTollPaid\(mover, tile, def, payableToll\);\n    \} else \{\n      \/\/ Enter DEBT_RESOLUTION\n      this\.enqueueOrStartDebt\(\{\n        debtorId: mover\.id,\n        creditorId: owner\.id,\n        amountOwed: payableToll,\n        sourceTileIndex: tile\.index,\n        allowPostPayTakeover: allowTakeover,\n        isFromSkillPull: false,\n      \}\);\n    \}\n  \}/,
      `      this.proceedAfterEnemyTollPaid(mover, tile, def, 0, '🔌 เมืองไฟดับ (ยกเว้นค่าผ่านทาง 100%)');\n      return;\n    }\n\n    const breakdown = this.calculateTollBreakdown(tile.index, mover.id);\n    let payableToll = breakdown.netToll;\n\n    // Hook 5: ON_BEFORE_PAY_TOLL -> S07_BLACK_CARD (100% Toll Exemption Once)\n    if (payableToll > 0 && this.tryTriggerSkill(mover, 'S07_BLACK_CARD')) {\n      payableToll = 0;\n      this.appendLog(\n        mover.id,\n        \`💳 \${mover.name} ใช้บัตรเครดิตดำ! ยกเว้นค่าผ่านทางที่ \${def.nameTh} 100%!\`,\n        'SKILL'\n      );\n      this.callbacks.onFloatingText?.({\n        tileIndex: tile.index,\n        text: \`FREE! บัตรดำ 100%\`,\n        colorHex: '#E5A93B',\n      });\n      this.proceedAfterEnemyTollPaid(mover, tile, def, 0, '💳 สกิลบัตรเครดิตดำ [S07] (ยกเว้นค่าผ่านทาง 100%)');\n      return;\n    }\n\n    // Check Held Angel Shield Card -> Ask player whether to use it now or save it for later!\n    if (payableToll > 0 && mover.hasAngelCard) {\n      const discountedTollAmount = mover.hasDiscountCoupon\n        ? Math.round(payableToll * 0.5)\n        : payableToll;\n      this.matchState.activePrompt = {\n        type: 'ANGEL_CARD_PROMPT',\n        playerId: mover.id,\n        tileIndex: tile.index,\n        creditorId: owner.id,\n        tollAmount: payableToll,\n        hasDiscountCoupon: Boolean(mover.hasDiscountCoupon),\n        discountedTollAmount,\n        reason: 'TOLL',\n      };\n      this.emitStateChange();\n      return;\n    }\n\n    this.executeEnemyTollPayment(mover, tile, def, payableToll);\n  }\n\n  private executeEnemyTollPayment(\n    mover: PlayerState,\n    tile: BoardTileState,\n    def: WorldTileDef,\n    rawPayableToll: number\n  ): void {\n    if (!this.matchState || mover.isBankrupt || !tile.ownerId) return;\n    const owner = this.matchState.players[tile.ownerId];\n    if (!owner || owner.isBankrupt) {\n      this.openBuyOrUpgradePrompt(mover, tile.index, false);\n      return;\n    }\n\n    let payableToll = rawPayableToll;\n\n    // Check Held Discount Coupon Card (-50% Toll from Chance Card)\n    if (payableToll > 0 && mover.hasDiscountCoupon) {\n      mover.hasDiscountCoupon = false;\n      payableToll = Math.round(payableToll * 0.5);\n      this.appendLog(\n        mover.id,\n        \`🎟️ \${mover.name} ใช้คูปองลดค่าผ่านทาง 50% ที่ \${def.nameTh} (เหลือ \${formatMarbleCompact(payableToll)})!\`,\n        'TOLL'\n      );\n      this.callbacks.onFloatingText?.({\n        tileIndex: tile.index,\n        text: \`🎟️ ลด 50%!\`,\n        colorHex: '#38BDF8',\n      });\n    }\n\n    const allowTakeover =\n      def.type === 'CITY' &&\n      tile.buildingLevel >= BuildingLevel.LAND &&\n      tile.buildingLevel <= BuildingLevel.HOTEL;\n\n    if (mover.marble >= payableToll) {\n      mover.marble -= payableToll;\n      owner.marble += payableToll;\n      this.appendLog(\n        mover.id,\n        \`💸 \${mover.name} จ่ายค่าผ่านทาง \${formatMarbleCompact(payableToll)} ให้ \${owner.name} ที่ \${def.nameTh}\`,\n        'TOLL'\n      );\n      this.callbacks.onFloatingText?.({\n        tileIndex: tile.index,\n        text: \`-\${formatMarbleCompact(payableToll)}\`,\n        colorHex: '#DC2626',\n      });\n      this.callbacks.onTollPaid?.({\n        payerId: mover.id,\n        receiverId: owner.id,\n        amount: payableToll,\n        tileIndex: tile.index,\n      });\n      this.proceedAfterEnemyTollPaid(mover, tile, def, payableToll);\n    } else {\n      // Enter DEBT_RESOLUTION\n      this.enqueueOrStartDebt({\n        debtorId: mover.id,\n        creditorId: owner.id,\n        amountOwed: payableToll,\n        sourceTileIndex: tile.index,\n        allowPostPayTakeover: allowTakeover,\n        isFromSkillPull: false,\n      });\n    }\n  }\n\n  public resolveAngelCardPrompt(useAngelCard: boolean): boolean {\n    if (!this.matchState || this.matchState.activePrompt?.type !== 'ANGEL_CARD_PROMPT') {\n      return false;\n    }\n\n    const prompt = this.matchState.activePrompt;\n    const player = this.matchState.players[prompt.playerId];\n    const tile = this.matchState.tiles[prompt.tileIndex];\n    const def = WORLD_MAP_TILES[prompt.tileIndex];\n    this.matchState.activePrompt = null;\n\n    if (useAngelCard && player.hasAngelCard) {\n      player.hasAngelCard = false;\n      this.callbacks.onAngelCardUsed?.({\n        playerId: player.id,\n        tileIndex: prompt.tileIndex,\n        targetName: def.nameTh,\n        reason: 'TOLL',\n      });\n      this.appendLog(\n        player.id,\n        \`👼 \${player.name} ใช้การ์ดนางฟ้า! ยกเว้น\${prompt.reason === 'TAX' ? 'ภาษีสรรพากร' : \`ค่าผ่านทางที่ \${def.nameTh}\`} 100%!\`,\n        'TOLL'\n      );\n      this.callbacks.onFloatingText?.({\n        tileIndex: prompt.tileIndex,\n        text: \`👼 นางฟ้า! ฟรี 100%\`,\n        colorHex: '#FDE047',\n      });\n\n      if (prompt.reason === 'TAX') {\n        this.finishTileResolution();\n      } else {\n        this.proceedAfterEnemyTollPaid(\n          player,\n          tile,\n          def,\n          0,\n          '👼 ใช้การ์ดนางฟ้าคุ้มครอง (ยกเว้นค่าผ่านทาง 100%)'\n        );\n      }\n      return true;\n    }\n\n    this.appendLog(\n      player.id,\n      \`🛡️ \${player.name} เก็บการ์ดนางฟ้าไว้ใช้ทีหลัง และยอมจ่ายเงินเอง!\`,\n      'TOLL'\n    );\n    if (prompt.reason === 'TAX') {\n      this.executeTaxAuditPayment(player, prompt.tollAmount);\n    } else {\n      this.executeEnemyTollPayment(player, tile, def, prompt.tollAmount);\n    }\n    return true;\n  }`
    );
    engSrc = engSrc.replace(
      `  private proceedAfterEnemyTollPaid(\n    mover: PlayerState,\n    tile: BoardTileState,\n    def: WorldTileDef,\n    paidToll: number\n  ): void {`,
      `  private proceedAfterEnemyTollPaid(\n    mover: PlayerState,\n    tile: BoardTileState,\n    def: WorldTileDef,\n    paidToll: number,\n    tollExemptReason?: string\n  ): void {`
    );
    engSrc = engSrc.replace(
      `          canAfford: true,\n          paidToll,\n        };`,
      `          canAfford: true,\n          paidToll,\n          tollExemptReason,\n        };`
    );
    engSrc = engSrc.replace(
      `  public confirmTakeover(): boolean {`,
      `  public confirmTakeover(alsoUpgradeLandmark: boolean = false): boolean {`
    );
    engSrc = engSrc.replace(
      `    // After taking over an enemy city, allow upgrading it immediately (e.g. HOTEL -> LANDMARK!)\n    this.openBuyOrUpgradePrompt(buyer, tile.index, true);\n    return true;`,
      `    if (alsoUpgradeLandmark && tile.buildingLevel === BuildingLevel.HOTEL) {\n      const lmCost = this.calculateBuildCost(buyer.id, tile.index, BuildingLevel.HOTEL, BuildingLevel.LANDMARK);\n      if (buyer.marble >= lmCost) {\n        buyer.marble -= lmCost;\n        tile.buildingLevel = BuildingLevel.LANDMARK;\n        this.appendLog(buyer.id, \`🏰 \${buyer.name} สร้างแลนด์มาร์กทันทีหลังซื้อต่อที่ \${def.nameTh} (-\${formatMarbleCompact(lmCost)})!\`, 'BUILD');\n        this.callbacks.onFloatingText?.({ tileIndex: tile.index, text: \`🏰 LANDMARK!\`, colorHex: buyer.colorHex });\n        if (this.checkAndApplyVictoryConditions()) {\n          this.emitStateChange();\n          return true;\n        }\n        this.runPostBuildHooks(buyer, tile.index);\n        return true;\n      }\n    }\n    this.finishTileResolution();\n    return true;`
    );
    engSrc = engSrc.replace(
      `  private resolveTaxAuditTile(player: PlayerState): void {\n    if (!this.matchState) return;\n    const totalAssets = this.calculatePlayerTotalAssets(player.id);\n    const taxAmount = Math.max(50_000, Math.round(totalAssets * MATCH_CONFIG.taxAuditRate));\n\n    if (player.marble >= taxAmount) {`,
      `  private resolveTaxAuditTile(player: PlayerState): void {\n    if (!this.matchState) return;\n    const totalAssets = this.calculatePlayerTotalAssets(player.id);\n    const taxAmount = Math.max(50_000, Math.round(totalAssets * MATCH_CONFIG.taxAuditRate));\n\n    if (taxAmount > 0 && player.hasAngelCard) {\n      this.matchState.activePrompt = {\n        type: 'ANGEL_CARD_PROMPT',\n        playerId: player.id,\n        tileIndex: player.tileIndex,\n        creditorId: 'BANK',\n        tollAmount: taxAmount,\n        hasDiscountCoupon: false,\n        discountedTollAmount: taxAmount,\n        reason: 'TAX',\n      };\n      this.emitStateChange();\n      return;\n    }\n\n    this.executeTaxAuditPayment(player, taxAmount);\n  }\n\n  private executeTaxAuditPayment(player: PlayerState, taxAmount: number): void {\n    if (!this.matchState) return;\n    if (player.marble >= taxAmount) {`
    );
    engSrc = engSrc.replace(
      /      if \(prompt\.type === 'TAKEOVER_PROMPT'\) \{\n        if \(decideAiTakeover\(this, this\.matchState, ai\)\) \{\n          this\.confirmTakeover\((?:true)?\);\n        \} else \{/,
      `      if (prompt.type === 'ANGEL_CARD_PROMPT') {\n        const shouldUseAngel =\n          prompt.discountedTollAmount >= 350_000 ||\n          prompt.discountedTollAmount > ai.marble * 0.35 ||\n          prompt.discountedTollAmount > ai.marble;\n        this.resolveAngelCardPrompt(shouldUseAngel);\n        return true;\n      }\n\n      if (prompt.type === 'TAKEOVER_PROMPT') {\n        if (decideAiTakeover(this, this.matchState, ai)) {\n          this.confirmTakeover(true);\n        } else {`
    );
    fs.writeFileSync(engineFile, engSrc, 'utf8');
  }
}

// 1. Bundle server-side authoritative engine
esbuild.buildSync({
  entryPoints: [path.join(richDir, 'src', 'engine', 'gameEngine.ts')],
  bundle: true,
  platform: 'node',
  outfile: path.join(richDir, 'engine.bundle.cjs'),
  logLevel: 'warning'
});

// 2. Bundle client-side 3D game & styles
esbuild.buildSync({
  entryPoints: [path.join(richDir, 'src', 'main.ts')],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: path.join(distAssets, 'app.js'),
  logLevel: 'warning'
});

// 3. Write dist/index.html
const indexHtml = `<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>Let's Get Rich (Peak Era) — 16:9</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Kanit:wght@400;500;600;700&family=Mitr:wght@500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,600;1,6..72,600&display=swap" rel="stylesheet" />
    <script type="module" crossorigin src="/assets/app.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/app.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`;
fs.writeFileSync(path.join(richDir, 'dist', 'index.html'), indexHtml, 'utf8');
console.log('[build-rich] Built engine.bundle.cjs and dist/assets/app.{js,css} successfully.');
