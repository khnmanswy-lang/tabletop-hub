       </div>
      `;
    }).join('');

    // High-Legibility 3-Treasure Cards (Main + Sub each, 6 Skills total)
    const trCardsHtml = curTrIds.map((tid, idx) => {
      const tr = getTreasureDef(tid);
      const mDef = getSkillDef(tr.mainSkill.skillId);
      const sDef = getSkillDef(tr.subSkill.skillId);
      const isConflict = isMainSkillConflict(tr.mainSkill.skillId, curChar.mainSkill.skillId);
      return `
        <div style="background:${isConflict ? '#FEE2E2' : '#FFF9EB'}; border:2.5px solid ${isConflict ? '#DC2626' : '#1E1612'}; border-radius:12px; padding:6px 8px; box-shadow:0 3px 0 ${isConflict ? '#991B1B' : '#1E1612'}; display:flex; flex-direction:column; justify-content:space-between; gap:4px; flex:1; min-height:0;">
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid ${isConflict ? '#FCA5A5' : '#E5D6B8'}; padding-bottom:3px;">
            <span style="font-weight:900; font-size:11.5px; color:#141413; display:flex; align-items:center; gap:4px;">
              <span style="font-size:16px;">${tr.iconEmoji}</span>
              <span>#${idx + 1} ${tr.name}</span>
            </span>
            ${isConflict ? `<span style="background:#DC2626; color:#FFF; font-weight:900; font-size:9.5px; padding:1px 6px; border-radius:999px;">⛔ซ้ำ Main</span>` : ''}
          </div>

          <!-- Main Skill -->
          <div style="background:#FFFDF7; border:1.5px solid #E5D6B8; border-radius:8px; padding:4px 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:900; font-size:10.5px; color:#1E3A8A;">⚡ Main: ${mDef.name}</span>
              <span style="background:#2563EB; color:#FFF; font-weight:900; font-size:9.5px; padding:1px 6px; border-radius:999px; font-variant-numeric:tabular-nums;">${tr.mainSkill.procPct}%</span>
            </div>
            <div style="font-size:10px; color:#141413; font-weight:700; line-height:1.25; margin-top:2px;">
              ${mDef.effectDesc}
            </div>
          </div>

          <!-- Sub Skill -->
          <div style="background:#FFFDF7; border:1.5px solid #E5D6B8; border-radius:8px; padding:4px 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:900; font-size:10.5px; color:#166534;">🛡️ Sub: ${sDef.name}</span>
              <span style="background:#16A34A; color:#FFF; font-weight:900; font-size:9.5px; padding:1px 6px; border-radius:999px; font-variant-numeric:tabular-nums;">+${tr.subSkill.procPct}%</span>
            </div>
            <div style="font-size:10px; color:#141413; font-weight:700; line-height:1.25; margin-top:2px;">
              ${sDef.effectDesc}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const activeHumans = this.state.players.filter((p, i) => isPlayerSlotActive(p, i) && p.controlType === 'HUMAN').length;
    const isMobileLobby = this.isMobileLobbyMode();

    if (isMobileLobby) {
      // ======================================================================
      // MOBILE / TABLET 3-TAB HIGH-LEGIBILITY LOBBY (LARGE CARDS & BIG TEXT)
      // ======================================================================
      const playerSwitcherPillsHtml = PLAYER_IDS.map((pid, idx) => {
        const p = this.state.players[idx];
        const isActiveSlot = isPlayerSlotActive(p, idx);
        if (!isActiveSlot || !p) return '';
        const isSel = pid === this.selectedLoadoutPlayerId;
        const pChar = getCharacterDef(p.characterId);
        return `
          <button class="btn-mobile-switch-pid" data-pid="${pid}" style="background:${isSel ? playerBannerGradients[pid] : '#FFF9EB'}; color:${isSel ? '#FFF' : '#1E1612'}; border:3px solid #1E1612; border-radius:12px; padding:6px 14px; font-size:15px; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:${isSel ? '0 4px 0 #1E1612, inset 0 2px 0 rgba(255,255,255,0.4)' : '0 3px 0 #1E1612'};">
            <span>${pid}: ${p.name}</span>
            <span style="background:rgba(0,0,0,0.22); color:${isSel ? '#FEF08A' : '#B45309'}; padding:1px 7px; border-radius:999px; font-size:13px;">${pChar.name}</span>
          </button>
        `;
      }).join('');

      let tabBodyHtml = '';

      if (this.mobileLobbyTab === 'PLAYERS') {
        const mobilePlayerCardsHtml = PLAYER_IDS.map((pid, idx) => {
          const p = this.state.players[idx];
          const isActiveSlot = isPlayerSlotActive(p, idx);
          const isSelected = pid === this.selectedLoadoutPlayerId;

          if (!isActiveSlot || !p) {
            return `
              <div class="lobby-banner-empty" style="background:#FFF9EB; border:4px dashed #A89078; border-radius:18px; padding:16px 22px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; box-shadow:inset 0 3px 6px rgba(0,0,0,0.08);">
                <div style="font-size:20px; font-weight:900; color:#786C5E;">ที่นั่ง ${pid} ว่าง (EMPTY SLOT)</div>
                <div style="display:flex; gap:14px; width:100%; max-width:440px;">
                  <button class="gold-btn btn-lobby-add-ai" data-idx="${idx}" style="flex:1; padding:12px 16px; font-size:17px; font-weight:900; border-radius:14px;">
                    🤖 + เพิ่ม AI Bot
                  </button>
                  <button class="tab-pill btn-lobby-add-human" data-idx="${idx}" style="flex:1; padding:12px 16px; font-size:17px; font-weight:900; border-radius:14px;">
                    👤 + เพิ่มผู้เล่น (Human)
                  </button>
                </div>
              </div>
            `;
          }

          const pChar = getCharacterDef(p.characterId);
          const teamBadge = isTeamMode
            ? p.teamId === 'ALPHA' ? 'TEAM A (สีฟ้า)' : 'TEAM B (สีส้ม)'
            : `SOLO ${p.id}`;
          const isYou = this.youPlayerId ? p.id === this.youPlayerId : false;
          const isHuman = p.controlType === 'HUMAN';
          const isRemoteConnected = isHuman && p.connected && !isYou;

          const controlBtnHtml = isRemoteConnected
            ? `<span style="font-size:14px; font-weight:900; padding:6px 14px; border-radius:999px; background:#F0FDF4; color:#15803D; border:2.5px solid #1E1612;">👤 Online</span>`
            : `<button class="btn-lobby-toggle-control" data-pid="${p.id}" style="background:${isHuman ? 'linear-gradient(180deg,#22C55E 0%,#16A34A 100%)' : 'linear-gradient(180deg,#38BDF8 0%,#0284C7 100%)'}; border:2.5px solid #1E1612; color:#fff; border-radius:999px; padding:6px 14px; font-size:14.5px; font-weight:900; cursor:pointer; box-shadow:0 3px 0 #1E1612;">${isHuman ? "🟢 Pass 'n Play (เล่นเอง)" : '🤖 AI Bot (บอท)'}</button>`;

          const trSummaryHtml = p.treasureIds
            .map((tid) => {
              const t = getTreasureDef(tid);
              return `<span style="background:rgba(255,249,235,0.95); color:#1E1612; border:2px solid #1E1612; border-radius:10px; padding:4px 10px; font-size:14px; font-weight:900; display:inline-flex; align-items:center; gap:5px; box-shadow:0 2px 0 #1E1612;"><span>${t.iconEmoji}</span><span>${t.name}</span></span>`;
            })
            .join('');

          return `
            <div class="lobby-player-banner" data-pid="${p.id}" style="background:${playerBannerGradients[p.id]}; border:3.5px solid #1E1612; outline:${isSelected ? '5px solid #FFD43B' : 'none'}; box-shadow:0 6px 0 #1E1612, inset 0 2px 0 rgba(255,255,255,0.35); border-radius:18px; padding:12px 16px; display:flex; flex-direction:column; justify-content:space-between; gap:8px; cursor:pointer;">
              <!-- Top Control Bar -->
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="background:#FFF9EB; border:2.5px solid #1E1612; border-radius:999px; padding:3px 12px; font-size:14px; font-weight:900; color:#1E1612; box-shadow:0 2px 0 #1E1612;">
                    ${teamBadge}
                  </span>
                  ${isYou ? `<span style="background:#FFD43B; color:#1E1612; font-weight:900; font-size:13.5px; padding:3px 10px; border-radius:999px; border:2.5px solid #1E1612; box-shadow:0 2px 0 #1E1612;">YOU ★</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  ${controlBtnHtml}
                  <button class="btn-lobby-randomize" data-pid="${p.id}" style="background:linear-gradient(180deg,#A855F7 0%,#7E22CE 100%); border:2.5px solid #1E1612; color:#fff; border-radius:999px; padding:6px 12px; font-size:14px; font-weight:900; cursor:pointer; box-shadow:0 3px 0 #581C87;">🎲 สุ่มเซ็ต</button>
                  ${!isYou ? `<button class="btn-lobby-kick" data-pid="${p.id}" style="background:linear-gradient(180deg,#FF5A5F 0%,#DC2626 100%); border:2.5px solid #1E1612; color:#fff; border-radius:999px; padding:6px 12px; font-size:14px; font-weight:900; cursor:pointer; box-shadow:0 3px 0 #7F1D1D;">✕ ลบ</button>` : ''}
                </div>
              </div>

              <!-- Middle Character & Edit CTA -->
              <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                  <div style="width:70px; height:70px; border-radius:14px; background:#FFF9EB; border:3px solid #1E1612; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 3px 0 #1E1612;">
                    ${getMascotSvg(p.characterId, 62)}
                  </div>
                  <div style="min-width:0;">
                    <div style="font-size:22px; font-weight:900; color:#FFF; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-shadow:0 2px 0 #1E1612;">
                      ${p.name}
                    </div>
                    <div style="font-size:17px; font-weight:900; color:#FEF08A; text-shadow:0 1.5px 0 #1E1612;">
                      ${pChar.name} (${pChar.rank} • โอกาส ${pChar.mainSkill.procPct}%)
                    </div>
                    <div style="font-size:13.5px; font-weight:800; color:#FFF; opacity:0.95;">
                      ⚡ ${CHARACTER_SYNERGIES[p.characterId]?.archetypeTh || ''}
                    </div>
                  </div>
                </div>

                <button class="gold-btn btn-mobile-edit-loadout" data-pid="${p.id}" style="padding:10px 16px; font-size:15.5px; font-weight:900; border-radius:12px; flex-shrink:0;">
                  ✏️ จัดตัวละคร/สมบัติ ➔
                </button>
              </div>

              <!-- Bottom 3 Treasures Strip -->
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${trSummaryHtml}
              </div>
            </div>
          `;
        }).join('');

        tabBodyHtml = `
          <div style="display:flex; flex-direction:column; gap:12px; flex:1; min-height:0;">
            <!-- Mode Bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:#FFF9EB; border:3px solid #1E1612; border-radius:14px; padding:8px 16px; box-shadow:0 4px 0 #1E1612; flex-shrink:0;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-size:15.5px; font-weight:900; color:#1E1612;">โหมด:</span>
                <button id="lobbyModeSingle" class="tab-pill ${!isTeamMode ? 'active' : ''}" style="border-radius:999px; padding:7px 16px; font-size:15.5px; font-weight:900; ${!isTeamMode ? 'background:#1B65C6; color:#fff;' : ''}">
                  👑 เดี่ยว (FFA)
                </button>
                <button id="lobbyModeTeam" class="tab-pill ${isTeamMode ? 'active' : ''}" style="border-radius:999px; padding:7px 16px; font-size:15.5px; font-weight:900; ${isTeamMode ? 'background:#1B65C6; color:#fff;' : ''}">
                  🤝 ทีม 2v2
                </button>
                ${
                  !isTeamMode
                    ? `<div style="display:inline-flex; align-items:center; gap:6px; margin-left:6px; background:#F3E5C8; border:2.5px solid #1E1612; border-radius:999px; padding:2px 6px;">
                        <span style="font-size:14px; font-weight:900; color:#1E1612; padding-left:4px;">จำนวน:</span>
                        ${([2, 3, 4] as const)
                          .map(
                            (cnt) => `
                          <button class="tab-pill btn-lobby-ffa-count ${activeSlotCount === cnt ? 'active' : ''}" data-count="${cnt}" style="border-radius:999px; padding:4px 12px; font-size:14.5px; font-weight:900; ${activeSlotCount === cnt ? 'background:#D97706; color:#fff;' : ''}">
                            ${cnt}P
                          </button>
                        `
                          )
                          .join('')}
                      </div>`
                    : ''
                }
              </div>
              <span style="background:${activeHumans >= 2 ? 'linear-gradient(180deg,#DCFCE7 0%,#BBF7D0 100%)' : '#F1F5F9'}; color:${activeHumans >= 2 ? '#15803D' : '#475569'}; border:2.5px solid #1E1612; font-size:14.5px; font-weight:900; padding:6px 14px; border-radius:999px; box-shadow:0 2px 0 #1E1612;">
                ${activeHumans >= 2 ? `🎮 Pass 'n Play (${activeHumans}P เล่นด้วยกัน)` : `👤 ${activeSlotCount}P Match`}
              </span>
            </div>

            <!-- 2x2 Big Player Cards Grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:12px; flex:1; min-height:0;">
              ${mobilePlayerCardsHtml}
            </div>
          </div>
        `;
      } else if (this.mobileLobbyTab === 'CHAR') {
        const bigCharCardsHtml = CHARACTER_ROSTER.map((c) => {
          const isSelected = c.id === targetPlayer.characterId;
          const mDef = getSkillDef(c.mainSkill.skillId);
          return `
            <div class="lobby-char-btn" data-char-id="${c.id}" style="background:${isSelected ? 'linear-gradient(180deg,#FFFBEB 0%,#FEF08A 100%)' : '#FFF9EB'}; border:3px solid #1E1612; border-radius:14px; padding:8px 6px; text-align:center; cursor:pointer; box-shadow:${isSelected ? 'inset 0 2px 0 rgba(255,255,255,0.9), 0 4px 0 #B45309, 0 6px 0 #1E1612' : '0 4px 0 #1E1612'}; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:space-between;">
              ${isSelected ? `<span style="position:absolute; top:4px; right:4px; font-size:13px; color:#15803D; font-weight:900; background:#DCFCE7; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border:2px solid #15803D;">✔</span>` : ''}
              <div style="display:flex; justify-content:center; align-items:center; height:58px;">${getMascotSvg(c.id, 56)}</div>
              <div style="font-size:17px; font-weight:900; color:#1E1612;">${c.name}</div>
              <div style="background:#1E1612; color:#FFD43B; font-size:13px; font-weight:900; padding:2px 8px; border-radius:999px;">${c.rank} • ${c.mainSkill.procPct}%</div>
              <div style="font-size:12px; font-weight:800; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${mDef.name}</div>
            </div>
          `;
        }).join('');

        const bigStatBarsHtml = statsList.map((s) => {
          let segs = '';
          for (let i = 1; i <= 5; i++) {
            segs += `<div style="flex:1; height:16px; border-radius:999px; background:${i <= s.lv ? s.color : '#F3E5C8'}; border:2.5px solid #1E1612; box-shadow:${i <= s.lv ? 'inset 0 2px 0 rgba(255,255,255,0.7), 0 2px 0 #1E1612' : 'none'};"></div>`;
          }
          return `
            <div>
              <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:900; color:#141413; margin-bottom:3px;">
                <span>${s.label} (${s.pct})</span>
                <span style="color:#B45309; font-weight:900;">+${s.lv}/5</span>
              </div>
              <div style="display:flex; gap:5px;">${segs}</div>
            </div>
          `;
        }).join('');

        tabBodyHtml = `
          <div style="display:flex; flex-direction:column; gap:10px; flex:1; min-height:0;">
            <!-- Player Switcher Bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; background:#FFF9EB; border:3px solid #1E1612; border-radius:14px; padding:6px 14px; box-shadow:0 4px 0 #1E1612; flex-shrink:0;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-size:15px; font-weight:900; color:#1E1612;">กำลังเลือกตัวละครให้:</span>
                ${playerSwitcherPillsHtml}
              </div>
              <button class="gold-btn mobile-lobby-tab-btn" data-tab="TREASURES" style="padding:8px 18px; font-size:15px; font-weight:900; border-radius:12px;">
                ไปเลือกสมบัติ 3 ชิ้น (Step 3) ➔
              </button>
            </div>

            <!-- 50/50 Split: 8 Character Cards | Selected Character Skill & 5 Stats -->
            <div style="display:grid; grid-template-columns: 50% 50%; gap:12px; flex:1; min-height:0;">
              <div class="royal-panel" style="display:flex; flex-direction:column; min-height:0; overflow:hidden;">
                <div class="royal-header" style="padding:8px 14px; font-size:15px;">
                  <span>🧙‍♀️ แตะเลือกตัวละคร (8 S+ ROSTER)</span>
                  <span style="color:#B45309; font-weight:900;">เลือก: ${curChar.name}</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(4, 1fr); grid-template-rows:repeat(2, 1fr); gap:8px; padding:10px; flex:1; min-height:0;">
                  ${bigCharCardsHtml}
                </div>
              </div>

              <div class="royal-panel" style="display:flex; flex-direction:column; min-height:0; overflow:hidden;">
                <div class="royal-header" style="padding:8px 14px; font-size:15px;">
                  <span>⚡ สกิลประจำตัว & ค่าพลัง (${curChar.name})</span>
                  <span style="color:#B45309; font-weight:900;">${curChar.rank} • ${curChar.title}</span>
                </div>
                <div style="padding:12px 16px; display:flex; flex-direction:column; justify-content:space-between; gap:10px; flex:1; min-height:0;">
                  <!-- Main Skill Box -->
                  <div style="background:#FFFDF7; border:3px solid #1E1612; border-radius:14px; padding:10px 14px; display:flex; gap:14px; align-items:center; box-shadow:0 4px 0 #1E1612;">
                    <div style="width:74px; height:74px; border-radius:14px; background:linear-gradient(180deg, #FFF9EB 0%, #FDE047 100%); border:3px solid #1E1612; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                      ${getMascotSvg(curChar.id, 62)}
                    </div>
                    <div style="flex:1; display:flex; flex-direction:column; gap:5px;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:18px; font-weight:900; color:#141413;">${charMainDef.name} (${charMainDef.code})</span>
                        <span style="background:linear-gradient(180deg,#FF5A5F 0%,#DC2626 100%); color:#fff; font-weight:900; font-size:14.5px; padding:3px 12px; border-radius:999px; border:2px solid #1E1612;">
                          โอกาสติด ${curChar.mainSkill.procPct}%
                        </span>
                      </div>
                      <div style="font-size:15.5px; color:#141413; font-weight:800; line-height:1.35;">
                        ${charMainDef.effectDesc}
                      </div>
                      <div style="font-size:13.5px; font-weight:900; color:#7E22CE;">
                        ⚡ สายการเล่น: ${CHARACTER_SYNERGIES[curChar.id]?.archetypeTh || ''}
                      </div>
                    </div>
                  </div>

                  <!-- 5 Stat Bars -->
                  <div style="display:flex; flex-direction:column; gap:7px;">
                    ${bigStatBarsHtml}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        // TAB 3: TREASURES
        const bigEquippedSlotsHtml = curTrIds.map((tid, slotIdx) => {
          const tr = getTreasureDef(tid);
          const isSlotActive = slotIdx === this.selectedTreasureSlotIndex;
          const isConflict = isMainSkillConflict(tr.mainSkill.skillId, curChar.mainSkill.skillId);
          return `
            <div class="lobby-tr-slot-btn" data-slot-idx="${slotIdx}" style="background:${isSlotActive ? 'linear-gradient(180deg,#FFFBEB 0%,#FEF08A 100%)' : '#FFF9EB'}; border:3.5px solid ${isConflict ? '#DC2626' : '#1E1612'}; outline:${isSlotActive ? '4px solid #F59E0B' : 'none'}; border-radius:14px; padding:8px 14px; display:flex; align-items:center; gap:12px; cursor:pointer; box-shadow:0 4px 0 #1E1612;">
              <span style="font-size:38px; line-height:1;">${tr.iconEmoji}</span>
              <div style="flex:1; min-width:0;">
                <div style="font-size:16.5px; font-weight:900; color:#1E1612; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ช่องที่ ${slotIdx + 1}: ${tr.name}
                </div>
                <div style="font-size:13.5px; color:${isConflict ? '#DC2626' : '#B45309'}; font-weight:900; margin-top:2px;">
                  ${isConflict ? '⛔ ซ้ำสกิลหลักตัวละคร' : `⚡ Main ${tr.mainSkill.procPct}% • 🛡️ Sub +${tr.subSkill.procPct}%`}
                </div>
              </div>
              <span style="background:${isSlotActive ? '#1E1612' : '#E5D6B8'}; color:${isSlotActive ? '#FFD43B' : '#1E1612'}; font-size:13px; font-weight:900; padding:4px 10px; border-radius:999px;">
                ${isSlotActive ? 'กำลังเลือก ▼' : 'แตะเปลี่ยน'}
              </span>
            </div>
          `;
        }).join('');

        const bigPoolCardsHtml = TREASURE_POOL.map((t) => {
          const isEquippedInActiveSlot = curTrIds[this.selectedTreasureSlotIndex] === t.id;
          const isEquippedAnywhere = curTrIds.includes(t.id);
          const isConflict = isMainSkillConflict(t.mainSkill.skillId, curChar.mainSkill.skillId);
          return `
            <div class="lobby-tr-pool-btn" data-tr-id="${t.id}" style="background:${isEquippedInActiveSlot ? '#FEF08A' : '#FFF9EB'}; border:3px solid ${isConflict ? '#DC2626' : '#1E1612'}; border-radius:12px; padding:6px 4px; text-align:center; cursor:${isConflict ? 'not-allowed' : 'pointer'}; opacity:${isConflict ? 0.45 : 1}; position:relative; box-shadow:0 3px 0 #1E1612; display:flex; flex-direction:column; align-items:center; justify-content:space-between;">
              ${isEquippedAnywhere ? `<span style="position:absolute; top:3px; right:3px; font-size:12px; color:#15803D; font-weight:900; background:#DCFCE7; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; border:2px solid #15803D;">✔</span>` : ''}
              <div style="font-size:32px; line-height:1.1;">${t.iconEmoji}</div>
              <div style="font-size:13.5px; font-weight:900; color:#1E1612; line-height:1.15;">${t.name}</div>
              <div style="font-size:12px; color:${isConflict ? '#B91C1C' : '#1E3A8A'}; font-weight:900; background:${isConflict ? '#FEE2E2' : '#DBEAFE'}; padding:1px 7px; border-radius:999px;">
                ${isConflict ? '⛔ ซ้ำ Main' : `Main ${t.mainSkill.procPct}%`}
              </div>
            </div>
          `;
        }).join('');

        const bigTrDetailCardsHtml = curTrIds.map((tid, idx) => {
          const tr = getTreasureDef(tid);
          const mDef = getSkillDef(tr.mainSkill.skillId);
          const sDef = getSkillDef(tr.subSkill.skillId);
          const isSlotActive = idx === this.selectedTreasureSlotIndex;
          return `
            <div class="lobby-tr-slot-btn" data-slot-idx="${idx}" style="background:${isSlotActive ? '#FFFBEB' : '#FFF9EB'}; border:3px solid ${isSlotActive ? '#D97706' : '#1E1612'}; border-radius:12px; padding:8px 12px; box-shadow:0 3px 0 #1E1612; cursor:pointer; display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; al