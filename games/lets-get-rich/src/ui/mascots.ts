/**
 * LINE Let's Get Rich (Peak Era) — Toy-Box Cartoon Vector Mascots & Game Art
 * 100% Free, custom self-contained inline SVG components for Chibi Mascots,
 * 3D Toy Coins, Isometric Deeds Buildings, and Currency Gems.
 * Zero network dependencies. Eliminates broken system emoji glyphs (▯).
 */

export function getMascotSvg(characterId: string, size: number = 48): string {
  switch (characterId) {
    case 'CHAR_COSMO':
      // Cosmo: Cosmic purple void architect with glowing starry eyes and nebula turban
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#7C3AED" stroke="#1D2B53" stroke-width="4"/>
          <!-- Turban / Cosmic Cap -->
          <path d="M12 28 C12 14, 52 14, 52 28 C52 32, 12 32, 12 28 Z" fill="#9333EA" stroke="#1D2B53" stroke-width="3"/>
          <circle cx="32" cy="18" r="5" fill="#FDE047" stroke="#1D2B53" stroke-width="2"/>
          <!-- Chibi Face -->
          <circle cx="32" cy="38" r="16" fill="#FDE047"/>
          <!-- Starry Eyes -->
          <circle cx="26" cy="36" r="3.5" fill="#1D2B53"/>
          <circle cx="38" cy="36" r="3.5" fill="#1D2B53"/>
          <circle cx="27" cy="35" r="1.2" fill="#FFFFFF"/>
          <circle cx="39" cy="35" r="1.2" fill="#FFFFFF"/>
          <!-- Big Toy Smile -->
          <path d="M28 43 Q32 48 36 43" stroke="#1D2B53" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <!-- Cheeks -->
          <circle cx="21" cy="40" r="2.5" fill="#F472B6" opacity="0.8"/>
          <circle cx="43" cy="40" r="2.5" fill="#F472B6" opacity="0.8"/>
        </svg>
      `;

    case 'CHAR_CLEO':
      // Cleo: Fiery crimson trap master with pink rockstar hair and cat-ear headphones
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#E11D48" stroke="#1D2B53" stroke-width="4"/>
          <!-- Cat Ear Headphones -->
          <path d="M16 16 L24 26 L14 28 Z" fill="#FB7185" stroke="#1D2B53" stroke-width="3"/>
          <path d="M48 16 L50 28 L40 26 Z" fill="#FB7185" stroke="#1D2B53" stroke-width="3"/>
          <path d="M18 24 Q32 10 46 24" stroke="#1D2B53" stroke-width="4" fill="none"/>
          <!-- Face -->
          <circle cx="32" cy="36" r="16" fill="#FED7AA"/>
          <!-- Anime Bangs -->
          <path d="M16 30 Q32 40 48 30 Q32 20 16 30 Z" fill="#F43F5E" stroke="#1D2B53" stroke-width="2"/>
          <!-- Eyes -->
          <ellipse cx="25" cy="36" rx="3.5" ry="4" fill="#1D2B53"/>
          <ellipse cx="39" cy="36" rx="3.5" ry="4" fill="#1D2B53"/>
          <circle cx="26" cy="35" r="1.5" fill="#FFFFFF"/>
          <circle cx="40" cy="35" r="1.5" fill="#FFFFFF"/>
          <!-- Cheerful smirk -->
          <path d="M28 43 Q32 47 37 42" stroke="#1D2B53" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <circle cx="21" cy="40" r="2.5" fill="#FB7185" opacity="0.8"/>
          <circle cx="43" cy="40" r="2.5" fill="#FB7185" opacity="0.8"/>
        </svg>
      `;

    case 'CHAR_ARIA':
      // Aria: Skyline heiress with golden tiara, blue royal ribbons, and sparkling wink
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#0284C7" stroke="#1D2B53" stroke-width="4"/>
          <!-- Tiara -->
          <path d="M22 22 L27 14 L32 20 L37 14 L42 22 Z" fill="#FACC15" stroke="#1D2B53" stroke-width="2.5"/>
          <circle cx="32" cy="18" r="2" fill="#E11D48"/>
          <!-- Face -->
          <circle cx="32" cy="36" r="16" fill="#FEF08A"/>
          <!-- Blonde Hair -->
          <path d="M16 28 C16 18, 48 18, 48 28 C42 26, 22 26, 16 28 Z" fill="#FDE047" stroke="#1D2B53" stroke-width="2"/>
          <!-- Sparkling Eyes -->
          <circle cx="25" cy="36" r="3.5" fill="#0284C7"/>
          <circle cx="26" cy="35" r="1.2" fill="#FFFFFF"/>
          <!-- Winking Eye -->
          <path d="M36 37 Q39 33 42 37" stroke="#1D2B53" stroke-width="3" stroke-linecap="round" fill="none"/>
          <path d="M28 43 Q32 48 36 43" stroke="#1D2B53" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <circle cx="20" cy="40" r="2.5" fill="#F472B6" opacity="0.9"/>
          <circle cx="44" cy="40" r="2.5" fill="#F472B6" opacity="0.9"/>
        </svg>
      `;

    case 'CHAR_MASON':
      // Mason: Grand builder with golden hardhat, pencil, and determined grin
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#D97706" stroke="#1D2B53" stroke-width="4"/>
          <!-- Builder Hardhat -->
          <path d="M14 26 C14 12, 50 12, 50 26 L14 26 Z" fill="#F59E0B" stroke="#1D2B53" stroke-width="3"/>
          <rect x="10" y="24" width="44" height="6" rx="3" fill="#D97706" stroke="#1D2B53" stroke-width="2.5"/>
          <path d="M28 14 L36 14" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
          <!-- Face -->
          <circle cx="32" cy="38" r="15" fill="#FED7AA"/>
          <!-- Eyes -->
          <rect x="23" y="34" width="6" height="5" rx="2.5" fill="#1D2B53"/>
          <rect x="35" y="34" width="6" height="5" rx="2.5" fill="#1D2B53"/>
          <!-- Confident Grin -->
          <path d="M26 44 Q32 50 38 44" stroke="#1D2B53" stroke-width="3" stroke-linecap="round" fill="#FFFFFF"/>
        </svg>
      `;

    case 'CHAR_KAEL':
      // Kael: Jetstream pilot with aviator goggles, sky blue jacket, and wind-blown scarf
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#0EA5E9" stroke="#1D2B53" stroke-width="4"/>
          <!-- Aviator Cap & Goggles -->
          <path d="M14 26 C14 14, 50 14, 50 26 Z" fill="#64748B" stroke="#1D2B53" stroke-width="3"/>
          <circle cx="24" cy="22" r="6" fill="#38BDF8" stroke="#1D2B53" stroke-width="2.5"/>
          <circle cx="40" cy="22" r="6" fill="#38BDF8" stroke="#1D2B53" stroke-width="2.5"/>
          <path d="M30 22 L34 22" stroke="#1D2B53" stroke-width="3"/>
          <!-- Face -->
          <circle cx="32" cy="38" r="15" fill="#FFEDD5"/>
          <circle cx="25" cy="36" r="3.5" fill="#1D2B53"/>
          <circle cx="39" cy="36" r="3.5" fill="#1D2B53"/>
          <path d="M27 44 Q32 48 37 44" stroke="#1D2B53" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        </svg>
      `;

    case 'CHAR_VESPER':
      // Vesper: Hostile raider with black eye-mask, bat wings, and mischievous grin
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#DC2626" stroke="#1D2B53" stroke-width="4"/>
          <!-- Face -->
          <circle cx="32" cy="36" r="16" fill="#FEE2E2"/>
          <!-- Domino Mask -->
          <path d="M16 32 Q24 28 32 34 Q40 28 48 32 Q44 40 32 37 Q20 40 16 32 Z" fill="#1E1B4B" stroke="#1D2B53" stroke-width="2.5"/>
          <!-- Piercing Yellow Eyes through mask -->
          <ellipse cx="24" cy="34" rx="3" ry="2" fill="#FDE047"/>
          <ellipse cx="40" cy="34" rx="3" ry="2" fill="#FDE047"/>
          <!-- Smirk with Fang -->
          <path d="M27 44 Q32 48 37 43" stroke="#1D2B53" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          <path d="M34 44 L35 47 L36 44 Z" fill="#FFFFFF"/>
        </svg>
      `;

    case 'CHAR_NYX':
      // Nyx: Dimension weaver with wizard hat, mystic star, and purple twin tails
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#9333EA" stroke="#1D2B53" stroke-width="4"/>
          <!-- Wizard Cone Hat -->
          <path d="M12 28 L32 8 L52 28 Z" fill="#6B21A8" stroke="#1D2B53" stroke-width="3"/>
          <ellipse cx="32" cy="28" rx="22" ry="5" fill="#A855F7" stroke="#1D2B53" stroke-width="2.5"/>
          <circle cx="32" cy="18" r="3" fill="#FDE047"/>
          <!-- Face -->
          <circle cx="32" cy="38" r="15" fill="#F3E8FF"/>
          <!-- Big Anime Eyes -->
          <ellipse cx="25" cy="36" rx="4" ry="5" fill="#4C1D95"/>
          <ellipse cx="39" cy="36" rx="4" ry="5" fill="#4C1D95"/>
          <circle cx="26" cy="34" r="1.5" fill="#FFFFFF"/>
          <circle cx="40" cy="34" r="1.5" fill="#FFFFFF"/>
          <path d="M28 44 Q32 47 36 44" stroke="#1D2B53" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        </svg>
      `;

    case 'CHAR_CHRONOS':
    default:
      // Chronos: Extra-turn chain dominator with clock cog crown and monocle
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#2563EB" stroke="#1D2B53" stroke-width="4"/>
          <!-- Clock Cog Crown -->
          <circle cx="32" cy="18" r="10" fill="#F59E0B" stroke="#1D2B53" stroke-width="2.5"/>
          <path d="M32 12 L32 18 L36 18" stroke="#1D2B53" stroke-width="2.5" stroke-linecap="round"/>
          <!-- Face -->
          <circle cx="32" cy="38" r="15" fill="#FEF3C7"/>
          <!-- Left Eye with Monocle -->
          <circle cx="24" cy="36" r="5" fill="#67E8F9" stroke="#F59E0B" stroke-width="2.5"/>
          <circle cx="24" cy="36" r="2.5" fill="#1D2B53"/>
          <!-- Right Eye -->
          <circle cx="39" cy="36" r="3.5" fill="#1D2B53"/>
          <circle cx="40" cy="35" r="1.2" fill="#FFFFFF"/>
          <!-- Mustache & Smile -->
          <path d="M26 43 Q32 40 38 43 Q32 47 26 43 Z" fill="#92400E" stroke="#1D2B53" stroke-width="1.5"/>
        </svg>
      `;
  }
}

/**
 * 3D Toy Gold Coin Component for Bonus Minigame & Currency Badges
 * Eliminates Unicode tofu glyphs (▯).
 */
export function getCoinSvg(size: number = 64, isTails: boolean = false): string {
  if (isTails) {
    // Tails: Eagle / Winged Victory Emblem
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="toy-coin-svg">
        <!-- Coin Drop Lip -->
        <circle cx="32" cy="35" r="28" fill="#B45309"/>
        <!-- Coin Outer Rim -->
        <circle cx="32" cy="32" r="28" fill="#F59F00" stroke="#1D2B53" stroke-width="3.5"/>
        <circle cx="32" cy="32" r="23" fill="#FFD43B" stroke="#B45309" stroke-width="2" stroke-dasharray="3 3"/>
        <!-- Wing Emblem -->
        <path d="M20 36 C22 26, 32 24, 44 26 C40 32, 34 36, 20 36 Z" fill="#0284C7" stroke="#1D2B53" stroke-width="2.5"/>
        <path d="M22 36 L42 28" stroke="#38BDF8" stroke-width="2"/>
        <text x="32" y="47" text-anchor="middle" font-family="'Fredoka', sans-serif" font-weight="900" font-size="9" fill="#1D2B53">TAILS</text>
      </svg>
    `;
  }
  // Heads: Royal Crown Emblem
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="toy-coin-svg">
      <!-- Coin Drop Lip -->
      <circle cx="32" cy="35" r="28" fill="#B45309"/>
      <!-- Coin Outer Rim -->
      <circle cx="32" cy="32" r="28" fill="#F59F00" stroke="#1D2B53" stroke-width="3.5"/>
      <circle cx="32" cy="32" r="23" fill="#FFD43B" stroke="#B45309" stroke-width="2" stroke-dasharray="3 3"/>
      <!-- Royal Crown -->
      <path d="M20 36 L24 24 L32 30 L40 24 L44 36 Z" fill="#E11D48" stroke="#1D2B53" stroke-width="2.5"/>
      <circle cx="24" cy="23" r="2" fill="#FFFFFF"/>
      <circle cx="32" cy="28" r="2.5" fill="#38BDF8"/>
      <circle cx="40" cy="23" r="2" fill="#FFFFFF"/>
      <text x="32" y="47" text-anchor="middle" font-family="'Fredoka', sans-serif" font-weight="900" font-size="9" fill="#1D2B53">HEADS</text>
    </svg>
  `;
}

/**
 * Cartoon Monopoly Property Deed Isometric Building Illustrations
 * Replaces tiny system emojis (🏢, 🏨, 🏰) with large, crisp vector art.
 */
export function getBuildingSvg(level: number, size: number = 80): string {
  switch (level) {
    case 1: // Land only (ที่ดินเปล่า / เกาะท่องเที่ยว)
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Land Turf Base -->
          <ellipse cx="40" cy="65" rx="34" ry="12" fill="#86EFAC" stroke="#1D2B53" stroke-width="3"/>
          <ellipse cx="40" cy="63" rx="30" ry="10" fill="#4ADE80"/>
          <!-- Plot Boundary Corner Pegs -->
          <rect x="18" y="52" width="4" height="12" rx="1" fill="#B45309" stroke="#1D2B53" stroke-width="1.5"/>
          <rect x="58" y="52" width="4" height="12" rx="1" fill="#B45309" stroke="#1D2B53" stroke-width="1.5"/>
          <!-- Surveyor Flag / For Sale Sign -->
          <rect x="38" y="24" width="4" height="34" rx="1" fill="#78350F" stroke="#1D2B53" stroke-width="2"/>
          <path d="M42 24 L64 34 L42 44 Z" fill="#FACC15" stroke="#1D2B53" stroke-width="2.5"/>
          <text x="50" y="37" font-family="'Fredoka', sans-serif" font-weight="900" font-size="8" fill="#1D2B53" text-anchor="middle">LAND</text>
        </svg>
      `;

    case 2: // Villa / Cottage (บ้านพัก)
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Grass Island Base -->
          <ellipse cx="40" cy="65" rx="32" ry="12" fill="#4ADE80" stroke="#1D2B53" stroke-width="3"/>
          <!-- Cottage Body -->
          <rect x="22" y="38" width="36" height="26" rx="4" fill="#FEF08A" stroke="#1D2B53" stroke-width="3"/>
          <!-- Roof -->
          <path d="M16 38 L40 18 L64 38 Z" fill="#EF4444" stroke="#1D2B53" stroke-width="3"/>
          <!-- Chimney -->
          <rect x="46" y="18" width="8" height="12" fill="#DC2626" stroke="#1D2B53" stroke-width="2"/>
          <!-- Door & Window -->
          <rect x="34" y="48" width="12" height="16" rx="2" fill="#B45309" stroke="#1D2B53" stroke-width="2"/>
          <circle cx="43" cy="56" r="1.5" fill="#FDE047"/>
          <rect x="25" y="42" width="7" height="7" rx="1.5" fill="#67E8F9" stroke="#1D2B53" stroke-width="1.5"/>
        </svg>
      `;

    case 3: // Building / Commercial Tower (อาคารพาณิชย์)
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Concrete Base -->
          <ellipse cx="40" cy="68" rx="30" ry="10" fill="#94A3B8" stroke="#1D2B53" stroke-width="3"/>
          <!-- Skyscraper Body -->
          <rect x="24" y="16" width="32" height="50" rx="4" fill="#38BDF8" stroke="#1D2B53" stroke-width="3.5"/>
          <!-- Roof Spire & Antennas -->
          <rect x="37" y="6" width="6" height="10" fill="#0284C7" stroke="#1D2B53" stroke-width="2"/>
          <circle cx="40" cy="6" r="2.5" fill="#EF4444"/>
          <!-- Windows Grid -->
          <g fill="#FEF08A" stroke="#1D2B53" stroke-width="1.5">
            <rect x="28" y="22" width="6" height="6" rx="1"/>
            <rect x="37" y="22" width="6" height="6" rx="1"/>
            <rect x="46" y="22" width="6" height="6" rx="1"/>
            <rect x="28" y="32" width="6" height="6" rx="1"/>
            <rect x="37" y="32" width="6" height="6" rx="1"/>
            <rect x="46" y="32" width="6" height="6" rx="1"/>
            <rect x="28" y="42" width="6" height="6" rx="1"/>
            <rect x="37" y="42" width="6" height="6" rx="1"/>
            <rect x="46" y="42" width="6" height="6" rx="1"/>
          </g>
          <!-- Entrance Revolving Door -->
          <rect x="34" y="54" width="12" height="12" rx="2" fill="#1D2B53"/>
        </svg>
      `;

    case 4: // Hotel / Luxury Resort (โรงแรมหรู)
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="40" cy="68" rx="34" ry="10" fill="#E2E8F0" stroke="#1D2B53" stroke-width="3"/>
          <!-- Hotel Main Wing -->
          <rect x="18" y="24" width="44" height="42" rx="5" fill="#F43F5E" stroke="#1D2B53" stroke-width="3.5"/>
          <!-- Golden Rooftop Sign -->
          <rect x="22" y="12" width="36" height="12" rx="3" fill="#FACC15" stroke="#1D2B53" stroke-width="2.5"/>
          <text x="40" y="21" text-anchor="middle" font-family="'Fredoka', sans-serif" font-weight="900" font-size="8" fill="#1D2B53">HOTEL</text>
          <!-- Balconies -->
          <g fill="#FFFFFF" stroke="#1D2B53" stroke-width="1.5">
            <rect x="22" y="28" width="10" height="7" rx="1"/>
            <rect x="35" y="28" width="10" height="7" rx="1"/>
            <rect x="48" y="28" width="10" height="7" rx="1"/>
            <rect x="22" y="39" width="10" height="7" rx="1"/>
            <rect x="35" y="39" width="10" height="7" rx="1"/>
            <rect x="48" y="39" width="10" height="7" rx="1"/>
          </g>
          <!-- Canopy Entrance -->
          <path d="M28 56 L52 56 L48 66 L32 66 Z" fill="#FACC15" stroke="#1D2B53" stroke-width="2"/>
        </svg>
      `;

    case 5: // Landmark / Imperial Castle (แลนด์มาร์กปราสาทหิน)
    default:
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Royal Golden Foundation -->
          <ellipse cx="40" cy="68" rx="36" ry="11" fill="#FACC15" stroke="#1D2B53" stroke-width="3.5"/>
          <!-- Castle Keep -->
          <rect x="22" y="28" width="36" height="38" rx="4" fill="#818CF8" stroke="#1D2B53" stroke-width="3.5"/>
          <!-- Battlements -->
          <path d="M20 28 L20 20 L26 20 L26 24 L31 24 L31 20 L37 20 L37 24 L43 24 L43 20 L49 20 L49 24 L54 24 L54 20 L60 20 L60 28 Z" fill="#6366F1" stroke="#1D2B53" stroke-width="2.5"/>
          <!-- Turrets with Flags -->
          <rect x="14" y="24" width="8" height="42" rx="2" fill="#4F46E5" stroke="#1D2B53" stroke-width="2.5"/>
          <path d="M14 24 L18 10 L22 24 Z" fill="#E11D48" stroke="#1D2B53" stroke-width="2"/>
          <rect x="58" y="24" width="8" height="42" rx="2" fill="#4F46E5" stroke="#1D2B53" stroke-width="2.5"/>
          <path d="M58 24 L62 10 L66 24 Z" fill="#E11D48" stroke="#1D2B53" stroke-width="2"/>
          <!-- Castle Gate with Drawbridge -->
          <path d="M32 66 C32 50, 48 50, 48 66 Z" fill="#312E81" stroke="#1D2B53" stroke-width="2.5"/>
          <!-- Golden Crest -->
          <circle cx="40" cy="38" r="4.5" fill="#FDE047" stroke="#1D2B53" stroke-width="1.5"/>
        </svg>
      `;
  }
}

/**
 * Marble Gem SVG for Currency Display
 */
export function getMarbleGemSvg(size: number = 18): string {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle; display:inline-block; margin-right:2px;">
      <path d="M6 3 L18 3 L22 9 L12 21 L2 9 Z" fill="#38BDF8" stroke="#1D2B53" stroke-width="2"/>
      <path d="M6 3 L12 9 L18 3" stroke="#1D2B53" stroke-width="1.5"/>
      <path d="M12 9 L12 21" stroke="#1D2B53" stroke-width="1.5"/>
      <path d="M2 9 L22 9" stroke="#1D2B53" stroke-width="1.5"/>
      <path d="M7 6 L10 6" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;
}
