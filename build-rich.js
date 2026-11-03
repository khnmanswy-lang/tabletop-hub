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
    .join('');

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

  fs.writeFileSync(path.join(uiDir, 'uiManager.ts'), combined, 'utf8');
}

// 0b. Ensure gameEngine.ts has per-slot isSlotActive kick/2P/3P support
const engineFile = path.join(richDir, 'src', 'engine', 'gameEngine.ts');
if (fs.existsSync(engineFile)) {
  let engSrc = fs.readFileSync(engineFile, 'utf8');
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
