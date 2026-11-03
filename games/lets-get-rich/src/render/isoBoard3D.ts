import * as THREE from 'three';
import {
  BlackHoleState,
  BLUE_TOURISM_INDICES,
  BoardTileState,
  BuildingLevel,
  CHARACTER_ROSTER,
  formatMarbleCompact,
  getTourismMultiplierForTile,
  MATCH_CONFIG,
  PlayerId,
  PlayerState,
  RED_TOURISM_INDICES,
  WORLD_MAP_TILES,
  WorldTileDef,
} from '../data/lgrGameData';

export interface BoardRenderSyncData {
  tiles: readonly BoardTileState[];
  players: readonly PlayerState[];
  activePlayerId: PlayerId;
  blackHole: BlackHoleState | null;
  highlightedTileIndices: readonly number[];
}

interface TileVisualEntry {
  index: number;
  def: WorldTileDef;
  worldPos: THREE.Vector3;
  rootGroup: THREE.Group;
  baseMesh: THREE.Mesh;
  topMesh: THREE.Mesh;
  topMaterial: THREE.MeshBasicMaterial;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  buildingGroup: THREE.Group;
  highlightGroup: THREE.Group;
  festivalRing: THREE.Mesh;
  olympicBadgeGroup: THREE.Group;
  stepCanvas: HTMLCanvasElement;
  stepCtx: CanvasRenderingContext2D;
  stepTexture: THREE.CanvasTexture;
  stepSprite: THREE.Sprite;
  stepNumber: number | null;
  multiplierBadgeCanvas: HTMLCanvasElement;
  multiplierBadgeCtx: CanvasRenderingContext2D;
  multiplierBadgeTexture: THREE.CanvasTexture;
  multiplierBadgeSprite: THREE.Sprite;
  lastMultiplierValue: number;
  lastRenderKey: string;
  lastBuildingLevel: BuildingLevel;
  lastBuildingOwner: PlayerId | null;
  buildingAnimProgress: number;
  hoverAmount: number;
}

interface PawnVisualEntry {
  id: PlayerId;
  rootGroup: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  activeRing: THREE.Mesh;
  activeChevron: THREE.Mesh;
  islandCage: THREE.Group;
  travelHalo: THREE.Mesh;
  badgeSprite: THREE.Sprite;
  badgeCanvas: HTMLCanvasElement;
  badgeTexture: THREE.CanvasTexture;
  lastAvatarKey: string;
  currentTileIndex: number;
  isAnimatingHop: boolean;
  baseY?: number;
}

interface ActiveHopAnimation {
  playerId: PlayerId;
  path: number[];
  stepIndex: number;
  stepElapsedMs: number;
  stepDurationMs: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  hopHeight: number;
  onStepCallback?: (tileIndex: number) => void;
  onComplete?: () => void;
}

interface ActiveDiceAnimation {
  die1: number;
  die2: number;
  elapsedMs: number;
  durationMs: number;
  startRot1: THREE.Euler;
  startRot2: THREE.Euler;
  targetRot1: THREE.Euler;
  targetRot2: THREE.Euler;
  onComplete?: () => void;
}

interface StepRippleEffect {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  elapsedMs: number;
  durationMs: number;
}

const DEFAULT_PLAYER_COLORS: Record<PlayerId, string> = {
  P1: '#E11D48',
  P2: '#0284C7',
  P3: '#16A34A',
  P4: '#D97706',
};

const PLAYER_ORDER: readonly PlayerId[] = ['P1', 'P2', 'P3', 'P4'];

// Board geometry constants: 9x9 perimeter (8 steps per edge = 32 tiles)
const TILE_STEP = 2.24;
const BOARD_HALF_SPAN = TILE_STEP * 4; // 8.96
const TILE_SIZE_REGULAR = 2.08;
const TILE_SIZE_CORNER = 2.18;
const TILE_HEIGHT_REGULAR = 0.42;
const TILE_HEIGHT_CORNER = 0.54;

export class IsoBoard3DRenderer {
  private readonly container: HTMLElement;
  private readonly onTileClick: (tileIndex: number) => void;
  private readonly onTileHover?: (tileIndex: number | null) => void;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly raycaster: THREE.Raycaster;
  private readonly pointerNdc: THREE.Vector2;

  private readonly boardGroup: THREE.Group;
  private readonly tiles: TileVisualEntry[] = [];
  private readonly pickableMeshes: THREE.Object3D[] = [];
  private readonly pawns: Map<PlayerId, PawnVisualEntry> = new Map();

  // Special board FX groups
  private readonly blackHoleGroup: THREE.Group;
  private readonly whiteHoleGroup: THREE.Group;
  private readonly dicePadGroup: THREE.Group;
  private readonly diceShockwave: THREE.Mesh;
  private readonly diceMeshes: [THREE.Mesh, THREE.Mesh];

  private activeHop: ActiveHopAnimation | null = null;
  private activeDiceAnim: ActiveDiceAnimation | null = null;
  private readonly ripples: StepRippleEffect[] = [];

  private lastSyncData: BoardRenderSyncData | null = null;
  private hoveredTileIndex: number | null = null;
  private highlightedSet: Set<number> = new Set();
  private externalHighlightSet: Set<number> = new Set();
  private externalHighlightColor: string | null = null;

  private rafId: number | null = null;
  private lastFrameTime = performance.now();
  private elapsedClock = 0;
  private isDisposed = false;

  // Bound event listeners for clean disposal
  private readonly handlePointerDownBound: (ev: PointerEvent) => void;
  private readonly handlePointerMoveBound: (ev: PointerEvent) => void;
  private readonly handleWindowResizeBound: () => void;

  constructor(
    container: HTMLElement,
    onTileClick: (tileIndex: number) => void,
    onTileHover?: (tileIndex: number | null) => void
  ) {
    this.container = container;
    this.onTileClick = onTileClick;
    this.onTileHover = onTileHover;

    this.scene = new THREE.Scene();
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    // Orthographic camera configured for a true 16:9 widescreen isometric diamond ring
    this.camera = new THREE.OrthographicCamera(-16, 16, 9, -9, 0.1, 200);
    // Position at (+D, +H, +D) so (+R, +R) is Bottom Corner (Tile 0 START),
    // (-R, +R) is Left Corner (Tile 8 Island), (-R, -R) is Top Corner (Tile 16 Expo),
    // and (+R, -R) is Right Corner (Tile 24 Sky Terminal).
    this.camera.position.set(28, 22.5, 28);
    this.camera.lookAt(0.45, -0.55, 0.45);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();

    this.setupLighting();
    this.buildBoardFrameAndPlaza();
    this.buildTiles();

    this.blackHoleGroup = this.createBlackHoleVortex();
    this.whiteHoleGroup = this.createWhiteHolePortal();
    this.boardGroup.add(this.blackHoleGroup);
    this.boardGroup.add(this.whiteHoleGroup);

    const { padGroup, shockwave, dicePair } = this.createCenterDicePadAndDice();
    this.dicePadGroup = padGroup;
    this.diceShockwave = shockwave;
    this.diceMeshes = dicePair;
    this.boardGroup.add(this.dicePadGroup);

    this.buildPlayerPawns();

    this.handlePointerDownBound = (ev: PointerEvent) => this.onPointerDown(ev);
    this.handlePointerMoveBound = (ev: PointerEvent) => this.onPointerMove(ev);
    this.handleWindowResizeBound = () => this.resize();

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDownBound);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMoveBound);
    this.renderer.domElement.addEventListener('pointerleave', () => {
      if (this.hoveredTileIndex !== null) {
        this.hoveredTileIndex = null;
        this.onTileHover?.(null);
      }
    });
    window.addEventListener('resize', this.handleWindowResizeBound);

    this.resize();
    this.lastFrameTime = performance.now();
    this.tick(this.lastFrameTime);
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight('#FFFDF9', 1.25);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight('#FFF8EB', '#C8BFA8', 0.65);
    hemiLight.position.set(0, 25, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#FFF7E6', 1.45);
    sunLight.position.set(16, 32, 22);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 85;
    const d = 15.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#93C5FD', 0.55);
    rimLight.position.set(-20, 14, -18);
    this.scene.add(rimLight);
  }

  private computeTileWorldPosition(index: number): THREE.Vector3 {
    const R = BOARD_HALF_SPAN;
    const step = TILE_STEP;
    const line = Math.floor(index / 8);
    const offset = index % 8;

    // Line 0 (0..7): Bottom Corner (+R, +R) -> Left Corner (-R, +R)
    if (line === 0) {
      return new THREE.Vector3(R - offset * step, 0, R);
    }
    // Line 1 (8..15): Left Corner (-R, +R) -> Top Corner (-R, -R)
    if (line === 1) {
      return new THREE.Vector3(-R, 0, R - offset * step);
    }
    // Line 2 (16..23): Top Corner (-R, -R) -> Right Corner (+R, -R)
    if (line === 2) {
      return new THREE.Vector3(-R + offset * step, 0, -R);
    }
    // Line 3 (24..31): Right Corner (+R, -R) -> Bottom Corner (+R, +R)
    return new THREE.Vector3(R, 0, -R + offset * step);
  }

  private buildBoardFrameAndPlaza(): void {
    const outerSpan = BOARD_HALF_SPAN * 2 + TILE_SIZE_CORNER + 0.9;
    const innerSpan = BOARD_HALF_SPAN * 2 - TILE_SIZE_REGULAR - 0.14;

    // 1. Handsome 3D beveled outer board pedestal frame around the perimeter
    const frameShape = new THREE.Shape();
    const halfOut = outerSpan / 2;
    const halfIn = innerSpan / 2;
    frameShape.moveTo(-halfOut, -halfOut);
    frameShape.lineTo(halfOut, -halfOut);
    frameShape.lineTo(halfOut, halfOut);
    frameShape.lineTo(-halfOut, halfOut);
    frameShape.closePath();

    const holePath = new THREE.Path();
    holePath.moveTo(-halfIn, -halfIn);
    holePath.lineTo(-halfIn, halfIn);
    holePath.lineTo(halfIn, halfIn);
    holePath.lineTo(halfIn, -halfIn);
    holePath.closePath();
    frameShape.holes.push(holePath);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.46,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.14,
      bevelThickness: 0.12,
    };

    const frameGeo = new THREE.ExtrudeGeometry(frameShape, extrudeSettings);
    frameGeo.rotateX(Math.PI / 2);
    const frameMat = new THREE.MeshStandardMaterial({
      color: '#B45309',
      roughness: 0.35,
      metalness: 0.15,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.y = 0.05;
    frameMesh.receiveShadow = true;
    this.boardGroup.add(frameMesh);

    // Golden inner and outer trim rails
    const outerTrimGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(outerSpan + 0.15, 0.12, outerSpan + 0.15));
    const trimMat = new THREE.LineBasicMaterial({ color: '#E5A93B', transparent: true, opacity: 0.65 });
    const outerTrim = new THREE.LineSegments(outerTrimGeo, trimMat);
    outerTrim.position.y = 0.08;
    this.boardGroup.add(outerTrim);

    // 2. Translucent sky-plaza floor inside the hollow diamond
    const plazaCanvas = document.createElement('canvas');
    plazaCanvas.width = 1024;
    plazaCanvas.height = 1024;
    const pctx = plazaCanvas.getContext('2d')!;
    this.drawSkyPlazaTexture(pctx, 1024, 1024);
    const plazaTex = new THREE.CanvasTexture(plazaCanvas);
    plazaTex.colorSpace = THREE.SRGBColorSpace;
    plazaTex.anisotropy = 4;

    const plazaGeo = new THREE.PlaneGeometry(innerSpan, innerSpan);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMat = new THREE.MeshStandardMaterial({
      map: plazaTex,
      transparent: true,
      opacity: 0.94,
      roughness: 0.35,
      metalness: 0.1,
    });
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.position.y = -0.04;
    plazaMesh.receiveShadow = true;
    this.boardGroup.add(plazaMesh);

    // Subtle recessed gold border inside the hollow plaza
    const innerRimGeo = new THREE.RingGeometry(innerSpan * 0.69, innerSpan * 0.705, 4);
    innerRimGeo.rotateZ(Math.PI / 4);
    innerRimGeo.rotateX(-Math.PI / 2);
    const innerRimMat = new THREE.MeshBasicMaterial({
      color: '#D97757',
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const innerRim = new THREE.Mesh(innerRimGeo, innerRimMat);
    innerRim.position.y = 0.01;
    this.boardGroup.add(innerRim);
  }

  private drawSkyPlazaTexture(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Warm editorial ivory-alabaster sky plaza with subtle compass rose & grid lines
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.05, w / 2, h / 2, w * 0.65);
    grad.addColorStop(0, '#FCFBF7');
    grad.addColorStop(0.55, '#F3EFE6');
    grad.addColorStop(1, '#E6DFD1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle architectural tile grid
    ctx.strokeStyle = 'rgba(20, 20, 19, 0.055)';
    ctx.lineWidth = 2;
    const step = w / 8;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(w, i * step);
      ctx.stroke();
    }

    // Concentric compass circles & diamond emblem in the plaza center
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = 'rgba(217, 119, 87, 0.22)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(229, 169, 59, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.24, 0, Math.PI * 2);
    ctx.stroke();

    // Rotate -45 deg so text inside the plaza faces upright toward the isometric camera
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = 'rgba(20, 20, 19, 0.10)';
    ctx.font = '700 40px "Newsreader", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("LET'S GET RICH", 0, 115);
    ctx.font = '600 22px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(217, 119, 87, 0.28)';
    ctx.fillText('PEAK ERA • WORLD TOURNAMENT', 0, 152);
    ctx.restore();
  }

  private buildTiles(): void {
    for (let i = 0; i < WORLD_MAP_TILES.length; i++) {
      const def = WORLD_MAP_TILES[i];
      const isCorner = i % 8 === 0;
      const tileSize = isCorner ? TILE_SIZE_CORNER : TILE_SIZE_REGULAR;
      const tileHeight = isCorner ? TILE_HEIGHT_CORNER : TILE_HEIGHT_REGULAR;
      const worldPos = this.computeTileWorldPosition(i);

      const rootGroup = new THREE.Group();
      rootGroup.position.copy(worldPos);
      rootGroup.userData = { tileIndex: i };
      this.boardGroup.add(rootGroup);

      // 3D Tile Pedestal Block
      const baseGeo = new THREE.BoxGeometry(tileSize, tileHeight, tileSize);
      const baseMat = new THREE.MeshStandardMaterial({
        color: isCorner ? '#F5E6C8' : '#F4F1EA',
        roughness: 0.42,
        metalness: isCorner ? 0.22 : 0.08,
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = tileHeight / 2;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      baseMesh.userData = { tileIndex: i };
      rootGroup.add(baseMesh);
      this.pickableMeshes.push(baseMesh);

      // Crisp thin dark border around the pedestal block
      const edgeGeo = new THREE.EdgesGeometry(baseGeo);
      const edgeMat = new THREE.LineBasicMaterial({
        color: isCorner ? '#C6922C' : '#CFC9BC',
        transparent: true,
        opacity: 0.75,
      });
      const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
      baseMesh.add(edgeLines);

      // High-Craft Procedural Canvas Texture on top face
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;

      const topGeo = new THREE.PlaneGeometry(tileSize - 0.06, tileSize - 0.06);
      topGeo.rotateX(-Math.PI / 2);

      // Rotate top mesh around Y so that every tile's text reads upright from the camera at (+D, +H, +D):
      // Line 0 & Line 2 run along X -> rotation.y = 0 puts canvas +Y toward -Z (Up-Right) and +X toward +X (Down-Right).
      // Line 1 & Line 3 run along Z -> rotation.y = Math.PI / 2 puts canvas +Y toward -X (Up-Left) and +X toward -Z (Up-Right).
      if (def.line === 1 || def.line === 3) {
        topGeo.rotateY(Math.PI / 2);
      }

      const topMaterial = new THREE.MeshBasicMaterial({
        map: texture,
      });
      const topMesh = new THREE.Mesh(topGeo, topMaterial);
      topMesh.position.y = tileHeight + 0.006;
      topMesh.userData = { tileIndex: i };
      rootGroup.add(topMesh);
      this.pickableMeshes.push(topMesh);

      // Building container positioned on the upper portion of the tile
      const buildingGroup = new THREE.Group();
      const bOffset = this.getBuildingOffsetOnTile(def.line);
      buildingGroup.position.set(bOffset.x, tileHeight, bOffset.z);
      buildingGroup.userData = { tileIndex: i };
      rootGroup.add(buildingGroup);
      this.pickableMeshes.push(buildingGroup);

      // Pulsing golden selection frame for highlighted tiles
      const highlightGroup = this.createTileHighlightGroup(tileSize, tileHeight);
      highlightGroup.visible = false;
      rootGroup.add(highlightGroup);

      // Festival ribbon ring
      const festGeo = new THREE.RingGeometry(tileSize * 0.48, tileSize * 0.56, 32);
      festGeo.rotateX(-Math.PI / 2);
      const festMat = new THREE.MeshBasicMaterial({
        color: '#EC4899',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const festivalRing = new THREE.Mesh(festGeo, festMat);
      festivalRing.position.y = tileHeight + 0.03;
      festivalRing.visible = false;
      rootGroup.add(festivalRing);

      // Olympic golden crown/torch indicator above tile
      const olympicBadgeGroup = this.createOlympicCrownGroup();
      olympicBadgeGroup.position.set(0, tileHeight + 1.85, 0);
      olympicBadgeGroup.visible = false;
      rootGroup.add(olympicBadgeGroup);

      // Roll step number preview sprite (1..12 indicator for planning dice rolls)
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = 128;
      stepCanvas.height = 128;
      const stepCtx = stepCanvas.getContext('2d')!;
      const stepTexture = new THREE.CanvasTexture(stepCanvas);
      const stepMat = new THREE.SpriteMaterial({
        map: stepTexture,
        transparent: true,
        depthTest: false,
      });
      const stepSprite = new THREE.Sprite(stepMat);
      stepSprite.scale.set(0.85, 0.85, 1);
      stepSprite.position.set(0, tileHeight + 1.6, 0);
      stepSprite.visible = false;
      rootGroup.add(stepSprite);

      // Multiplier Billboard Badge (x2, x3, x4, x5, x8, x16) floating prominently above tile
      const multCanvas = document.createElement('canvas');
      multCanvas.width = 160;
      multCanvas.height = 96;
      const multCtx = multCanvas.getContext('2d')!;
      const multTexture = new THREE.CanvasTexture(multCanvas);
      const multMat = new THREE.SpriteMaterial({
        map: multTexture,
        transparent: true,
        depthTest: false,
      });
      const multiplierBadgeSprite = new THREE.Sprite(multMat);
      multiplierBadgeSprite.scale.set(1.18, 0.7, 1);
      multiplierBadgeSprite.position.set(0, tileHeight + 1.25, -0.28);
      multiplierBadgeSprite.visible = false;
      rootGroup.add(multiplierBadgeSprite);

      const entry: TileVisualEntry = {
        index: i,
        def,
        worldPos,
        rootGroup,
        baseMesh,
        topMesh,
        topMaterial,
        canvas,
        ctx,
        texture,
        buildingGroup,
        highlightGroup,
        festivalRing,
        olympicBadgeGroup,
        stepCanvas,
        stepCtx,
        stepTexture,
        stepSprite,
        stepNumber: null,
        multiplierBadgeCanvas: multCanvas,
        multiplierBadgeCtx: multCtx,
        multiplierBadgeTexture: multTexture,
        multiplierBadgeSprite,
        lastMultiplierValue: 1,
        lastRenderKey: '',
        lastBuildingLevel: BuildingLevel.NONE,
        lastBuildingOwner: null,
        buildingAnimProgress: 1,
        hoverAmount: 0,
      };

      // Draw initial unowned state
      this.renderTileCanvas(entry, null, null, false, []);
      this.tiles.push(entry);
    }
  }

  private getBuildingOffsetOnTile(line: 0 | 1 | 2 | 3): { x: number; z: number } {
    // Place buildings slightly toward the outer/upper side of each tile so labels remain clear
    switch (line) {
      case 0:
        return { x: 0, z: -0.34 };
      case 1:
        return { x: -0.34, z: 0 };
      case 2:
        return { x: 0, z: -0.34 };
      case 3:
        return { x: -0.34, z: 0 };
    }
  }

  private createTileHighlightGroup(tileSize: number, tileHeight: number): THREE.Group {
    const group = new THREE.Group();

    const frameGeo = new THREE.RingGeometry(tileSize * 0.56, tileSize * 0.68, 4);
    frameGeo.rotateZ(Math.PI / 4);
    frameGeo.rotateX(-Math.PI / 2);
    const frameMat = new THREE.MeshBasicMaterial({
      color: '#FACC15',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.y = tileHeight + 0.04;
    frameMesh.name = 'highlightFrame';
    group.add(frameMesh);

    // Floating pointer chevron above the highlighted tile
    const coneGeo = new THREE.ConeGeometry(0.28, 0.52, 4);
    coneGeo.rotateX(Math.PI);
    const coneMat = new THREE.MeshStandardMaterial({
      color: '#FDE047',
      emissive: '#CA8A04',
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.5,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.y = tileHeight + 1.55;
    coneMesh.name = 'highlightBeacon';
    group.add(coneMesh);

    return group;
  }

  private createOlympicCrownGroup(): THREE.Group {
    const group = new THREE.Group();
    const torusGeo = new THREE.TorusGeometry(0.32, 0.06, 12, 24);
    torusGeo.rotateX(Math.PI / 2);
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#FBBF24',
      emissive: '#D97706',
      emissiveIntensity: 0.5,
      metalness: 0.75,
      roughness: 0.2,
    });
    const ring = new THREE.Mesh(torusGeo, goldMat);
    group.add(ring);

    const flameGeo = new THREE.OctahedronGeometry(0.18, 0);
    const flameMat = new THREE.MeshBasicMaterial({ color: '#FEF08A' });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 0.2;
    group.add(flame);
    return group;
  }

  private renderTileCanvas(
    entry: TileVisualEntry,
    tileState: BoardTileState | null,
    ownerPlayer: PlayerState | null,
    hasColorMonopoly: boolean,
    ownerTourismIndices: readonly number[]
  ): void {
    const { ctx, canvas, def } = entry;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const ownerId = tileState?.ownerId ?? null;
    const ownerColor = ownerPlayer?.colorHex ?? (ownerId ? DEFAULT_PLAYER_COLORS[ownerId] : null);
    const isCorner = def.index % 8 === 0;

    // 1. Background Surface
    ctx.fillStyle = isCorner ? '#FAF3E3' : '#FAF9F5';
    ctx.fillRect(0, 0, w, h);

    // Subtle inner tint if owned
    if (ownerColor) {
      ctx.fillStyle = this.hexToRgba(ownerColor, 0.12);
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Top Color Group Header Bar for Cities / Special Tiles
    if (!isCorner) {
      const barH = 128;
      ctx.fillStyle = def.colorHex;
      ctx.fillRect(0, 0, w, barH);

      // Subtle glossy highlight strip on header bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(0, 0, w, 24);

      // Divider line
      ctx.fillStyle = '#141413';
      ctx.fillRect(0, barH, w, 6);

      // Tile index pill in top-left of header bar
      ctx.fillStyle = 'rgba(20, 20, 19, 0.35)';
      this.roundRect(ctx, 22, 20, 78, 44, 12);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 26px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${def.index}`, 61, 43);

      // Building level pips in top-right of header bar if owned
      if (tileState && tileState.buildingLevel > BuildingLevel.NONE) {
        const lv = tileState.buildingLevel;
        for (let p = 1; p <= 5; p++) {
          ctx.beginPath();
          ctx.arc(w - 32 - (5 - p) * 26, 42, 9, 0, Math.PI * 2);
          ctx.fillStyle = p <= lv ? '#FDE047' : 'rgba(255,255,255,0.28)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#141413';
          ctx.stroke();
        }
      }
    } else {
      // Corner ornamental frame
      ctx.strokeStyle = '#D97757';
      ctx.lineWidth = 14;
      ctx.strokeRect(18, 18, w - 36, h - 36);
    }

    // 3. Special Icon or City Details
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (def.type === 'CITY' || def.type === 'TOURISM') {
      // City Name
      ctx.fillStyle = '#141413';
      const fontSize = def.name.length > 11 ? 42 : 48;
      ctx.font = `800 ${fontSize}px "Inter", sans-serif`;
      ctx.fillText(def.name, w / 2, 245);

      // Thai subtitle
      ctx.fillStyle = '#666560';
      ctx.font = '600 28px "Inter", sans-serif';
      ctx.fillText(def.nameTh, w / 2, 296);

      // Calculate effective toll or base cost
      const effectiveMult = this.computeTileMultiplier(def, tileState, hasColorMonopoly, ownerTourismIndices);
      const displayAmount = ownerId
        ? Math.round(def.baseToll * effectiveMult)
        : def.baseCost;

      // Toll / Price pill at bottom
      const pillW = 340;
      const pillH = 78;
      const pillX = (w - pillW) / 2;
      const pillY = 392;

      ctx.fillStyle = ownerColor ? ownerColor : '#EAE5D9';
      this.roundRect(ctx, pillX, pillY, pillW, pillH, 18);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = ownerColor ? '#141413' : '#C8C2B4';
      ctx.stroke();

      ctx.fillStyle = ownerColor ? '#FFFFFF' : '#141413';
      ctx.font = '800 42px "JetBrains Mono", monospace';
      const prefix = ownerId ? 'TOLL ' : '';
      ctx.fillText(`${prefix}${formatMarbleCompact(displayAmount)}`, w / 2, pillY + pillH / 2 + 2);

      // Multiplier / Status Badges (Total Combined Multiplier e.g. x2, x3, x4, x8)
      let specialMult = 1;
      if (tileState && tileState.ownerId && !tileState.isBlackout) {
        const festMult = tileState.isFestival ? MATCH_CONFIG.festivalTollMultiplier : 1;
        const olyMult = Math.max(1, tileState.olympicMultiplier || 1);
        const stepMult = Math.max(1, tileState.stepMultiplier || 1);
        const monoMult = hasColorMonopoly ? MATCH_CONFIG.colorMonopolyTollMultiplier : 1;
        let tourMult = 1;
        if (def.type === 'TOURISM') {
          tourMult = getTourismMultiplierForTile(def.index, ownerTourismIndices);
        }
        specialMult = festMult * olyMult * stepMult * monoMult * tourMult;
      }

      if (tileState?.isBlackout) {
        ctx.fillStyle = '#334155';
        this.roundRect(ctx, 46, 332, w - 92, 46, 12);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 25px "JetBrains Mono", monospace';
        ctx.fillText('🔌 ไฟดับ (0 M)', w / 2, 356);
      } else if (specialMult > 1) {
        ctx.fillStyle = specialMult >= 8 ? '#DC2626' : specialMult >= 4 ? '#EA580C' : '#E11D48';
        this.roundRect(ctx, 36, 326, w - 72, 54, 14);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FDE047';
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 32px "JetBrains Mono", monospace';
        const breakdownParts: string[] = [];
        if (tileState?.isFestival) breakdownParts.push('FEST');
        if (tileState && tileState.olympicMultiplier > 1) breakdownParts.push(`OLY x${tileState.olympicMultiplier}`);
        if (tileState && tileState.stepMultiplier > 1) breakdownParts.push(`STEP x${tileState.stepMultiplier}`);
        if (hasColorMonopoly && ownerId) breakdownParts.push('MONO');
        if (def.type === 'TOURISM' && specialMult > 1) {
          const isBlue = def.tourismGroup === 'BLUE';
          breakdownParts.push(isBlue ? 'BLUE 🏝️' : 'RED 🌺');
        }
        const detail = breakdownParts.length > 1 ? ` (${breakdownParts.join('+')})` : '';
        ctx.fillText(`🔥 TOLL x${specialMult}${detail}`, w / 2, 354);
      } else if (def.type === 'TOURISM') {
        const isBlue = def.tourismGroup === 'BLUE';
        ctx.fillStyle = isBlue ? '#0284C7' : '#E11D48';
        ctx.font = '800 25px "Inter", sans-serif';
        ctx.fillText(isBlue ? '🏝️ BLUE ISLAND (2x/4x)' : '🌺 RED ISLAND (3x)', w / 2, 355);
      }
    } else {
      // Special non-city tiles: START, DESERT_ISLAND, OLYMPIC, WORLD_TRAVEL, BONUS_GAME, CHANCE, TAX_AUDIT
      const spec = this.getSpecialTileLabelAndIcon(def);
      ctx.font = isCorner ? '130px sans-serif' : '105px sans-serif';
      ctx.fillText(spec.emoji, w / 2, isCorner ? 185 : 235);

      ctx.fillStyle = '#141413';
      ctx.font = '900 48px "Inter", sans-serif';
      ctx.fillText(spec.title, w / 2, isCorner ? 330 : 355);

      ctx.fillStyle = def.colorHex;
      this.roundRect(ctx, 76, isCorner ? 380 : 398, w - 152, 68, 16);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 32px "JetBrains Mono", monospace';
      ctx.fillText(spec.badge, w / 2, isCorner ? 415 : 433);
    }

    // 4. Dynamic Owner Color Border around the entire tile when owned
    if (ownerColor && ownerId) {
      ctx.strokeStyle = ownerColor;
      ctx.lineWidth = 24;
      ctx.strokeRect(12, 12, w - 24, h - 24);

      // Owner ID tag in top-left below header
      ctx.fillStyle = ownerColor;
      this.roundRect(ctx, 20, 140, 86, 46, 10);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 28px "JetBrains Mono", monospace';
      ctx.fillText(ownerId, 63, 164);
    } else {
      ctx.strokeStyle = '#D5CFC2';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
    }

    entry.texture.needsUpdate = true;
  }

  private computeTileMultiplier(
    def: WorldTileDef,
    tileState: BoardTileState | null,
    hasColorMonopoly: boolean,
    ownerTourismIndices: readonly number[]
  ): number {
    if (!tileState || !tileState.ownerId) return 1;
    if (tileState.isBlackout) return 0;
    if (def.type === 'TOURISM') {
      const tourismMult = getTourismMultiplierForTile(def.index, ownerTourismIndices);
      return tourismMult * (tileState.isFestival ? MATCH_CONFIG.festivalTollMultiplier : 1);
    }
    const levelMult = MATCH_CONFIG.buildingTollMultipliers[tileState.buildingLevel] || 1;
    const festMult = tileState.isFestival ? MATCH_CONFIG.festivalTollMultiplier : 1;
    const olyMult = Math.max(1, tileState.olympicMultiplier || 1);
    const stepMult = Math.max(1, tileState.stepMultiplier || 1);
    const monoMult = hasColorMonopoly ? MATCH_CONFIG.colorMonopolyTollMultiplier : 1;
    return levelMult * festMult * olyMult * stepMult * monoMult;
  }

  private getSpecialTileLabelAndIcon(def: WorldTileDef): {
    emoji: string;
    title: string;
    badge: string;
  } {
    switch (def.type) {
      case 'START':
        return { emoji: '🚀', title: 'START', badge: '+300K SALARY' };
      case 'DESERT_ISLAND':
        return { emoji: '🏝️', title: 'ISLAND', badge: 'LOCK 3 TURNS' };
      case 'OLYMPIC':
        return { emoji: '🏆', title: 'EXPO', badge: 'TOLL UP TO x5' };
      case 'WORLD_TRAVEL':
        return { emoji: '✈️', title: 'TRAVEL', badge: 'FLY ANYWHERE' };
      case 'BONUS_GAME':
        return { emoji: '🪙', title: 'FLIP', badge: 'WIN UP TO 800K' };
      case 'CHANCE':
        return { emoji: '🃏', title: 'FORTUNE', badge: 'SKILL & CARD' };
      case 'TAX_AUDIT':
        return { emoji: '⚖️', title: 'TAX 10%', badge: 'AUDIT 10%' };
      default:
        return { emoji: '⭐', title: def.name, badge: 'SPECIAL' };
    }
  }

  private rebuildTileBuildingMesh(
    entry: TileVisualEntry,
    level: BuildingLevel,
    ownerId: PlayerId | null,
    ownerColorHex: string
  ): void {
    // Clear existing meshes in buildingGroup
    while (entry.buildingGroup.children.length > 0) {
      const child = entry.buildingGroup.children[0];
      entry.buildingGroup.remove(child);
    }

    if (level === BuildingLevel.NONE || !ownerId) {
      return;
    }

    const ownerMat = new THREE.MeshStandardMaterial({
      color: ownerColorHex,
      roughness: 0.35,
      metalness: 0.18,
    });
    const creamWallMat = new THREE.MeshStandardMaterial({
      color: '#FAF6EE',
      roughness: 0.45,
      metalness: 0.08,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      emissive: '#B45309',
      emissiveIntensity: 0.35,
      roughness: 0.22,
      metalness: 0.78,
    });
    const windowMat = new THREE.MeshBasicMaterial({
      color: '#BAE6FD',
    });

    if (level === BuildingLevel.LAND) {
      // LAND: Owner-colored flag/marker post
      const padMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 16), ownerMat);
      padMesh.position.y = 0.04;
      padMesh.castShadow = true;
      entry.buildingGroup.add(padMesh);

      const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 10), goldMat);
      poleMesh.position.set(-0.1, 0.45, 0);
      poleMesh.castShadow = true;
      entry.buildingGroup.add(poleMesh);

      const flagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.05), ownerMat);
      flagMesh.position.set(0.12, 0.72, 0);
      flagMesh.castShadow = true;
      entry.buildingGroup.add(flagMesh);
    } else if (level === BuildingLevel.VILLA) {
      // VILLA: Cute 3D house (BoxGeometry walls + pitched ConeGeometry roof)
      const houseGroup = this.createVillaMesh(creamWallMat, ownerMat, windowMat);
      entry.buildingGroup.add(houseGroup);
    } else if (level === BuildingLevel.BUILDING) {
      // BUILDING: 3-story modern tower with window stripes
      const towerGroup = this.createModernTowerMesh(creamWallMat, ownerMat, windowMat);
      entry.buildingGroup.add(towerGroup);
    } else if (level === BuildingLevel.HOTEL) {
      // HOTEL: Grand 3-building complex (Villa + Building + Red/Gold Roof Hotel)
      const villa = this.createVillaMesh(creamWallMat, ownerMat, windowMat);
      villa.scale.setScalar(0.75);
      villa.position.set(-0.48, 0, 0.14);
      entry.buildingGroup.add(villa);

      const tower = this.createModernTowerMesh(creamWallMat, ownerMat, windowMat);
      tower.scale.setScalar(0.78);
      tower.position.set(0.48, 0, 0.14);
      entry.buildingGroup.add(tower);

      const hotelCore = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.15, 0.52), creamWallMat);
      hotelCore.position.set(0, 0.575, -0.1);
      hotelCore.castShadow = true;
      entry.buildingGroup.add(hotelCore);

      const hotelRoof = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.45, 4), ownerMat);
      hotelRoof.rotation.y = Math.PI / 4;
      hotelRoof.position.set(0, 1.37, -0.1);
      hotelRoof.castShadow = true;
      entry.buildingGroup.add(hotelRoof);

      const crownTrim = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.09, 0.56), goldMat);
      crownTrim.position.set(0, 1.15, -0.1);
      entry.buildingGroup.add(crownTrim);
    } else if (level === BuildingLevel.LANDMARK) {
      // LANDMARK: Majestic tall golden-trimmed Landmark monument/spire with glowing star/ring on top!
      const podium1 = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.24, 1.12), ownerMat);
      podium1.position.y = 0.12;
      podium1.castShadow = true;
      entry.buildingGroup.add(podium1);

      const podium2 = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.28, 0.86), goldMat);
      podium2.position.y = 0.38;
      podium2.castShadow = true;
      entry.buildingGroup.add(podium2);

      const spireBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 1.45, 8), creamWallMat);
      spireBody.position.y = 1.24;
      spireBody.castShadow = true;
      entry.buildingGroup.add(spireBody);

      // Golden vertical ribs
      const ribGeo = new THREE.BoxGeometry(0.54, 1.38, 0.54);
      const ribMesh = new THREE.Mesh(ribGeo, ownerMat);
      ribMesh.position.y = 1.22;
      ribMesh.rotation.y = Math.PI / 4;
      ribMesh.castShadow = true;
      entry.buildingGroup.add(ribMesh);

      const spireTip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.65, 8), goldMat);
      spireTip.position.y = 2.28;
      spireTip.castShadow = true;
      entry.buildingGroup.add(spireTip);

      // Glowing star & halo ring at the apex
      const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 12, 28), goldMat);
      haloRing.rotation.x = Math.PI / 2;
      haloRing.position.y = 2.52;
      haloRing.name = 'landmarkHalo';
      entry.buildingGroup.add(haloRing);

      const starMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), goldMat);
      starMesh.position.y = 2.78;
      starMesh.name = 'landmarkStar';
      entry.buildingGroup.add(starMesh);
    }

    // Tag all building children with tileIndex so raycasting works seamlessly
    entry.buildingGroup.traverse((obj) => {
      obj.userData = { tileIndex: entry.index };
    });

    // Trigger spring pop animation
    entry.buildingAnimProgress = 0.01;
    entry.buildingGroup.scale.setScalar(0.01);
  }

  private createVillaMesh(
    wallMat: THREE.Material,
    roofMat: THREE.Material,
    windowMat: THREE.Material
  ): THREE.Group {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.48, 0.54), wallMat);
    walls.position.y = 0.24;
    walls.castShadow = true;
    g.add(walls);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.42, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 0.69;
    roof.castShadow = true;
    g.add(roof);

    const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.28), windowMat);
    win.position.y = 0.28;
    g.add(win);
    return g;
  }

  private createModernTowerMesh(
    wallMat: THREE.Material,
    accentMat: THREE.Material,
    windowMat: THREE.Material
  ): THREE.Group {
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.08, 0.58), wallMat);
    tower.position.y = 0.54;
    tower.castShadow = true;
    g.add(tower);

    // 3 horizontal window stripes
    for (let s = 0; s < 3; s++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.61), windowMat);
      stripe.position.y = 0.26 + s * 0.3;
      g.add(stripe);
    }

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.64), accentMat);
    cap.position.y = 1.12;
    cap.castShadow = true;
    g.add(cap);
    return g;
  }

  private createBlackHoleVortex(): THREE.Group {
    const group = new THREE.Group();
    group.visible = false;

    const coreGeo = new THREE.CircleGeometry(0.65, 32);
    coreGeo.rotateX(-Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({ color: '#090514' });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.04;
    group.add(core);

    const outerTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.76, 0.09, 16, 40),
      new THREE.MeshStandardMaterial({
        color: '#7C3AED',
        emissive: '#4C1D95',
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.5,
      })
    );
    outerTorus.rotation.x = Math.PI / 2;
    outerTorus.position.y = 0.18;
    outerTorus.name = 'bhOuter';
    group.add(outerTorus);

    const innerTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.06, 14, 32),
      new THREE.MeshBasicMaterial({
        color: '#C084FC',
      })
    );
    innerTorus.rotation.x = Math.PI / 2;
    innerTorus.position.y = 0.32;
    innerTorus.name = 'bhInner';
    group.add(innerTorus);

    return group;
  }

  private createWhiteHolePortal(): THREE.Group {
    const group = new THREE.Group();
    group.visible = false;

    const outerTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.08, 16, 40),
      new THREE.MeshStandardMaterial({
        color: '#FEF08A',
        emissive: '#F59E0B',
        emissiveIntensity: 0.85,
        roughness: 0.15,
        metalness: 0.7,
      })
    );
    outerTorus.rotation.x = Math.PI / 2;
    outerTorus.position.y = 0.22;
    outerTorus.name = 'whOuter';
    group.add(outerTorus);

    const innerTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.05, 14, 32),
      new THREE.MeshBasicMaterial({
        color: '#FFFFFF',
      })
    );
    innerTorus.rotation.x = Math.PI / 2;
    innerTorus.position.y = 0.38;
    innerTorus.name = 'whInner';
    group.add(innerTorus);

    return group;
  }

  private createCenterDicePadAndDice(): {
    padGroup: THREE.Group;
    shockwave: THREE.Mesh;
    dicePair: [THREE.Mesh, THREE.Mesh];
  } {
    const padGroup = new THREE.Group();
    // Position in the upper-middle of the hollow diamond plaza (-1.4, 0, -1.4)
    padGroup.position.set(-1.35, 0.02, -1.35);

    // Glowing octagonal/circular pedestal pad
    const baseDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(2.65, 2.85, 0.18, 32),
      new THREE.MeshStandardMaterial({
        color: '#23201C',
        roughness: 0.35,
        metalness: 0.4,
      })
    );
    baseDisc.position.y = 0.09;
    baseDisc.receiveShadow = true;
    padGroup.add(baseDisc);

    // Glowing terracotta/gold ring on the dice pad
    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(2.22, 2.52, 48),
      new THREE.MeshBasicMaterial({
        color: '#E5A93B',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.19;
    padGroup.add(glowRing);

    // Inner diamond emblem on the dice pad
    const innerDiamond = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.32, 4),
      new THREE.MeshBasicMaterial({
        color: '#D97757',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      })
    );
    innerDiamond.rotation.x = -Math.PI / 2;
    innerDiamond.position.y = 0.195;
    padGroup.add(innerDiamond);

    // Shockwave ring triggered when dice bounce
    const shockwave = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.65, 36),
      new THREE.MeshBasicMaterial({
        color: '#FDE047',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      })
    );
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.position.y = 0.21;
    padGroup.add(shockwave);

    // 2 Spotted 3D Dice
    const dieMaterials = this.createSpottedDieMaterials();
    const dieGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96);

    const dieMesh1 = new THREE.Mesh(dieGeo, dieMaterials);
    dieMesh1.castShadow = true;
    dieMesh1.receiveShadow = true;
    dieMesh1.rotation.order = 'YZX';
    dieMesh1.position.set(-0.78, 0.68, 0.15);
    padGroup.add(dieMesh1);

    const dieMesh2 = new THREE.Mesh(dieGeo, dieMaterials);
    dieMesh2.castShadow = true;
    dieMesh2.receiveShadow = true;
    dieMesh2.rotation.order = 'YZX';
    dieMesh2.position.set(0.78, 0.68, -0.15);
    padGroup.add(dieMesh2);

    return {
      padGroup,
      shockwave,
      dicePair: [dieMesh1, dieMesh2],
    };
  }

  private createSpottedDieMaterials(): THREE.MeshStandardMaterial[] {
    // BoxGeometry material order:
    // 0: +X (Face 3), 1: -X (Face 4), 2: +Y (Face 1), 3: -Y (Face 6), 4: +Z (Face 2), 5: -Z (Face 5)
    const faceValues = [3, 4, 1, 6, 2, 5];
    return faceValues.map((val) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;

      // Outer bevel border (simulates rounded ivory die edges)
      ctx.fillStyle = '#E2DDD2';
      ctx.fillRect(0, 0, 256, 256);

      ctx.fillStyle = '#FFFFFF';
      this.roundRect(ctx, 14, 14, 228, 228, 42);
      ctx.fill();

      ctx.strokeStyle = '#EDEAE2';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Traditional Asian/LGR spotted dice: 1 and 4 are crimson red, others are deep charcoal
      const pipColor = val === 1 || val === 4 ? '#E11D48' : '#1E293B';
      ctx.fillStyle = pipColor;

      const pipCoords: Record<number, [number, number][]> = {
        1: [[128, 128]],
        2: [
          [74, 74],
          [182, 182],
        ],
        3: [
          [68, 68],
          [128, 128],
          [188, 188],
        ],
        4: [
          [74, 74],
          [182, 74],
          [74, 182],
          [182, 182],
        ],
        5: [
          [68, 68],
          [188, 68],
          [128, 128],
          [68, 188],
          [188, 188],
        ],
        6: [
          [74, 62],
          [182, 62],
          [74, 128],
          [182, 128],
          [74, 194],
          [182, 194],
        ],
      };

      const radius = val === 1 ? 36 : 22;
      for (const [px, py] of pipCoords[val]) {
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.22,
        metalness: 0.08,
      });
    });
  }

  private getTargetEulerForDieValue(value: number, yawSpin: number): THREE.Euler {
    // Using Euler order 'YZX': rx or rz tilts the desired face normal to +Y, then ry spins around World Y
    const clamped = Math.max(1, Math.min(6, Math.round(value)));
    let rx = 0;
    let rz = 0;
    switch (clamped) {
      case 1: // +Y is already up
        rx = 0;
        rz = 0;
        break;
      case 6: // -Y -> +Y
        rx = Math.PI;
        rz = 0;
        break;
      case 2: // +Z -> +Y
        rx = -Math.PI / 2;
        rz = 0;
        break;
      case 5: // -Z -> +Y
        rx = Math.PI / 2;
        rz = 0;
        break;
      case 3: // +X -> +Y
        rx = 0;
        rz = Math.PI / 2;
        break;
      case 4: // -X -> +Y
        rx = 0;
        rz = -Math.PI / 2;
        break;
    }
    return new THREE.Euler(rx, yawSpin, rz, 'YZX');
  }

  private buildPlayerPawns(): void {
    for (const pid of PLAYER_ORDER) {
      const colorHex = DEFAULT_PLAYER_COLORS[pid];
      const rootGroup = new THREE.Group();

      // Base pedestal disc
      const baseMat = new THREE.MeshStandardMaterial({
        color: '#1E1B18',
        roughness: 0.3,
        metalness: 0.6,
      });
      const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.1, 20), baseMat);
      baseDisc.position.y = 0.05;
      baseDisc.castShadow = true;
      rootGroup.add(baseDisc);

      // Chibi body cone/cylinder
      const bodyMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.28,
        metalness: 0.2,
      });
      const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.31, 0.56, 20), bodyMat);
      bodyMesh.position.y = 0.38;
      bodyMesh.castShadow = true;
      rootGroup.add(bodyMesh);

      // White collar ring
      const collarMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.3 });
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 20), collarMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.64;
      rootGroup.add(collar);

      // Spherical chibi head
      const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 22, 22), bodyMat);
      headMesh.position.y = 0.88;
      headMesh.castShadow = true;
      rootGroup.add(headMesh);

      // Golden crown/visor cap on top of head
      const accentMat = new THREE.MeshStandardMaterial({
        color: '#FBBF24',
        roughness: 0.25,
        metalness: 0.7,
      });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.14, 6), accentMat);
      crown.position.y = 1.15;
      rootGroup.add(crown);

      // Glowing ring under active player
      const activeRing = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.56, 32),
        new THREE.MeshBasicMaterial({
          color: '#FDE047',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        })
      );
      activeRing.rotation.x = -Math.PI / 2;
      activeRing.position.y = 0.03;
      activeRing.visible = false;
      rootGroup.add(activeRing);

      // Floating active player chevron above pawn
      const activeChevron = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        new THREE.MeshBasicMaterial({ color: '#FDE047' })
      );
      activeChevron.position.y = 1.98;
      activeChevron.visible = false;
      rootGroup.add(activeChevron);

      // Desert Island prison bars visual indicator
      const islandCage = new THREE.Group();
      const cageMat = new THREE.MeshStandardMaterial({ color: '#64748B', metalness: 0.8, roughness: 0.3 });
      for (let b = 0; b < 4; b++) {
        const angle = (b * Math.PI) / 2 + Math.PI / 4;
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), cageMat);
        bar.position.set(Math.cos(angle) * 0.34, 0.55, Math.sin(angle) * 0.34);
        islandCage.add(bar);
      }
      islandCage.visible = false;
      rootGroup.add(islandCage);

      // World Travel ready halo
      const travelHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.035, 10, 24),
        new THREE.MeshBasicMaterial({ color: '#38BDF8' })
      );
      travelHalo.rotation.x = Math.PI / 2;
      travelHalo.position.y = 1.25;
      travelHalo.visible = false;
      rootGroup.add(travelHalo);

      // Floating Avatar & Player ID Badge Sprite
      const badgeCanvas = document.createElement('canvas');
      badgeCanvas.width = 160;
      badgeCanvas.height = 96;
      const badgeTexture = new THREE.CanvasTexture(badgeCanvas);
      badgeTexture.colorSpace = THREE.SRGBColorSpace;
      const spriteMat = new THREE.SpriteMaterial({
        map: badgeTexture,
        transparent: true,
        depthTest: false,
      });
      const badgeSprite = new THREE.Sprite(spriteMat);
      badgeSprite.scale.set(1.15, 0.69, 1);
      badgeSprite.position.y = 1.56;
      rootGroup.add(badgeSprite);

      const startPos = this.computeTileWorldPosition(0);
      rootGroup.position.set(startPos.x, TILE_HEIGHT_CORNER, startPos.z);
      this.boardGroup.add(rootGroup);

      const pawnEntry: PawnVisualEntry = {
        id: pid,
        rootGroup,
        bodyMat,
        accentMat,
        activeRing,
        activeChevron,
        islandCage,
        travelHalo,
        badgeSprite,
        badgeCanvas,
        badgeTexture,
        lastAvatarKey: '',
        currentTileIndex: 0,
        isAnimatingHop: false,
      };
      this.updatePawnBadgeSprite(pawnEntry, pid, '🎲', colorHex);
      this.pawns.set(pid, pawnEntry);
    }
  }

  private updatePawnBadgeSprite(
    pawn: PawnVisualEntry,
    pid: PlayerId,
    emoji: string,
    colorHex: string
  ): void {
    const key = `${pid}|${emoji}|${colorHex}`;
    if (pawn.lastAvatarKey === key) return;
    pawn.lastAvatarKey = key;

    const ctx = pawn.badgeCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 160, 96);

    ctx.fillStyle = colorHex;
    this.roundRect(ctx, 8, 12, 144, 72, 36);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.font = '42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 50, 50);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 34px "JetBrains Mono", monospace';
    ctx.fillText(pid, 110, 50);

    pawn.badgeTexture.needsUpdate = true;
  }

  public setExternalHighlightTiles(
    tileIndices: readonly number[],
    colorHex?: string
  ): void {
    this.externalHighlightSet = new Set(tileIndices);
    this.externalHighlightColor = colorHex ?? null;
    this.refreshHighlightVisibility();
  }

  private refreshHighlightVisibility(): void {
    for (const entry of this.tiles) {
      const isPick = this.highlightedSet.has(entry.index);
      const isExternal = this.externalHighlightSet.has(entry.index);
      entry.highlightGroup.visible = isPick || isExternal;

      const frame = entry.highlightGroup.getObjectByName(
        'highlightFrame'
      ) as THREE.Mesh | undefined;
      const beacon = entry.highlightGroup.getObjectByName(
        'highlightBeacon'
      ) as THREE.Mesh | undefined;

      const col =
        isExternal && this.externalHighlightColor
          ? this.externalHighlightColor
          : '#FDE047';

      if (frame) {
        (frame.material as THREE.MeshBasicMaterial).color.set(col);
      }
      if (beacon) {
        const mat = beacon.material as THREE.MeshStandardMaterial;
        mat.color.set(col);
        mat.emissive.set(col);
      }
    }
  }

  /**
   * Renders the numbered step indicator badge (1..12) for dice aiming.
   */
  private renderStepBadgeCanvas(
    _canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    step: number,
    isActive: boolean
  ): void {
    ctx.clearRect(0, 0, 128, 128);
    const cx = 64;
    const cy = 64;
    const r = 46;

    ctx.save();
    ctx.shadowColor = isActive ? '#FDE047' : '#0284C7';
    ctx.shadowBlur = isActive ? 16 : 8;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx - 10, cy - 10, 6, cx, cy, r);
    if (isActive) {
      grad.addColorStop(0, '#FEF08A');
      grad.addColorStop(0.7, '#EAB308');
      grad.addColorStop(1, '#854D0E');
    } else {
      grad.addColorStop(0, '#7DD3FC');
      grad.addColorStop(0.7, '#0284C7');
      grad.addColorStop(1, '#0C4A6E');
    }
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = isActive ? 6 : 4;
    ctx.strokeStyle = isActive ? '#FFFFFF' : '#BAE6FD';
    ctx.stroke();
    ctx.restore();

    ctx.font = '900 52px "Arial Black", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isActive ? '#1E1B4B' : '#FFFFFF';
    ctx.fillText(`${step}`, cx, cy + 3);
  }

  /**
   * Displays floating 1..12 step badges over tiles ahead during roll charging (User Request 5).
   */
  public setRollStepPreviews(fromTileIndex: number | null, activeStep: number | null): void {
    if (fromTileIndex === null) {
      for (const entry of this.tiles) {
        entry.stepSprite.visible = false;
        entry.stepNumber = null;
      }
      return;
    }

    const activeIndices = new Set<number>();
    for (let step = 1; step <= 12; step++) {
      const targetIdx = (fromTileIndex + step) % 32;
      activeIndices.add(targetIdx);
      const entry = this.tiles[targetIdx];
      const isActive = step === activeStep;
      if (entry.stepNumber !== step || isActive !== (entry.stepSprite.scale.x > 1.1)) {
        entry.stepNumber = step;
        this.renderStepBadgeCanvas(entry.stepCanvas, entry.stepCtx, step, isActive);
        entry.stepTexture.needsUpdate = true;
      }
      entry.stepSprite.visible = true;
      const scale = isActive ? 1.25 : 0.82;
      entry.stepSprite.scale.set(scale, scale, 1);
      const tileH = entry.def.index % 8 === 0 ? 0.9 : 0.7;
      entry.stepSprite.position.y = tileH + (isActive ? 1.85 : 1.5);
    }

    for (const entry of this.tiles) {
      if (!activeIndices.has(entry.index)) {
        entry.stepSprite.visible = false;
        entry.stepNumber = null;
      }
    }
  }

  /**
   * Spawns pink fragrant aura ripple and floating hearts for Perfume Steal.
   */
  public spawnPerfumeEffect(tileIndex: number): void {
    const tile = this.tiles[tileIndex];
    if (!tile) return;
    const h = tile.def.index % 8 === 0 ? 0.9 : 0.7;
    const geo = new THREE.RingGeometry(0.32, 0.75, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: '#EC4899',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(tile.worldPos.x, h + 0.1, tile.worldPos.z);
    this.boardGroup.add(mesh);
    this.ripples.push({
      mesh,
      material: mat,
      elapsedMs: 0,
      durationMs: 700,
    });
    tile.hoverAmount = 0.28;
  }

  /**
   * Spawns toll payment visual shockwaves: red at payer, green at receiver.
   */
  public spawnTollPaymentEffect(payerTileIdx: number, receiverTileIdx: number): void {
    const payerTile = this.tiles[payerTileIdx];
    const receiverTile = this.tiles[receiverTileIdx];
    if (payerTile) {
      this.spawnLandingShockwave(payerTile.worldPos, 0.8, '#EF4444');
    }
    if (receiverTile) {
      setTimeout(() => {
        this.spawnLandingShockwave(receiverTile.worldPos, 0.8, '#10B981');
      }, 160);
    }
  }

  /**
   * Spawns tax audit red shockwave on the tile.
   */
  public spawnTaxEffect(tileIndex: number): void {
    const tile = this.tiles[tileIndex];
    if (!tile) return;
    this.spawnLandingShockwave(tile.worldPos, 0.8, '#DC2626');
  }

  /**
   * Renders high-visibility floating 3D multiplier billboard badge (x2, x3, x4, x5, x8, x16) or blackout (0x) or festival unowned.
   */
  private renderMultiplierBadgeCanvas(
    ctx: CanvasRenderingContext2D,
    multiplier: number,
    isBlackout: boolean,
    isFestivalUnowned: boolean = false
  ): void {
    ctx.clearRect(0, 0, 160, 96);
    if (multiplier <= 1 && !isBlackout && !isFestivalUnowned) return;

    ctx.save();
    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    const pillW = 144;
    const pillH = 80;
    const pillX = 8;
    const pillY = 8;

    // Gradient
    const grad = ctx.createLinearGradient(pillX, pillY, pillX, pillY + pillH);
    if (isBlackout) {
      grad.addColorStop(0, '#475569');
      grad.addColorStop(1, '#1E293B');
    } else if (isFestivalUnowned) {
      grad.addColorStop(0, '#F43F5E');
      grad.addColorStop(0.5, '#EC4899');
      grad.addColorStop(1, '#BE185D');
    } else if (multiplier >= 8) {
      grad.addColorStop(0, '#DC2626');
      grad.addColorStop(0.5, '#EA580C');
      grad.addColorStop(1, '#991B1B');
    } else if (multiplier >= 4) {
      grad.addColorStop(0, '#EA580C');
      grad.addColorStop(1, '#C2410C');
    } else {
      grad.addColorStop(0, '#E11D48');
      grad.addColorStop(1, '#BE123C');
    }

    ctx.fillStyle = grad;
    this.roundRect(ctx, pillX, pillY, pillW, pillH, 20);
    ctx.fill();

    // Golden border
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4;
    ctx.strokeStyle = isBlackout ? '#94A3B8' : '#FDE047';
    ctx.stroke();

    // Inner highlight ring
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    this.roundRect(ctx, pillX + 3, pillY + 3, pillW - 6, pillH - 6, 17);
    ctx.stroke();

    // Bold text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    if (isFestivalUnowned) {
      ctx.font = '900 28px "Fredoka", "Kanit", sans-serif';
      ctx.fillText('🎪 FEST x2', 80, 48);
    } else {
      ctx.font = '900 42px "JetBrains Mono", sans-serif';
      const text = isBlackout ? '🔌 0x' : `🔥 x${multiplier}`;
      ctx.fillText(text, 80, 49);
    }

    ctx.restore();
  }

  /**
   * Spawns divine golden angel shield expanding ripples on the tile.
   */
  public spawnAngelShieldEffect(tileIndex: number): void {
    const tile = this.tiles[tileIndex];
    if (!tile) return;
    const h = tile.def.index % 8 === 0 ? 0.9 : 0.7;

    // Double golden divine shockwaves
    this.spawnLandingShockwave(tile.worldPos, h, '#FDE047');
    setTimeout(() => {
      this.spawnLandingShockwave(tile.worldPos, h + 0.1, '#FEF08A');
    }, 180);

    // Divine golden ascending ring
    const geo = new THREE.RingGeometry(0.35, 0.9, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: '#FACC15',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(tile.worldPos.x, h + 0.15, tile.worldPos.z);
    this.boardGroup.add(mesh);
    this.ripples.push({
      mesh,
      material: mat,
      elapsedMs: 0,
      durationMs: 950,
    });

    tile.hoverAmount = 0.38;
  }

  public syncBoard(data: BoardRenderSyncData): void {
    this.lastSyncData = data;
    this.highlightedSet = new Set(data.highlightedTileIndices);
    this.refreshHighlightVisibility();

    const playerById = new Map<PlayerId, PlayerState>();
    for (const p of data.players) {
      playerById.set(p.id, p);
    }

    // Precompute color monopolies and tourism counts per player
    const groupTiles = new Map<number, number[]>();
    const tourismTiles: number[] = [];
    for (const t of WORLD_MAP_TILES) {
      if (t.group !== null) {
        const list = groupTiles.get(t.group) ?? [];
        list.push(t.index);
        groupTiles.set(t.group, list);
      }
      if (t.type === 'TOURISM') {
        tourismTiles.push(t.index);
      }
    }

    const stateByIndex = new Map<number, BoardTileState>();
    for (const ts of data.tiles) {
      stateByIndex.set(ts.index, ts);
    }

    // 1. Sync all 32 tiles (Canvas textures + 3D buildings + Festival/Olympic/Highlight indicators)
    for (const entry of this.tiles) {
      const ts = stateByIndex.get(entry.index) ?? null;
      const ownerId = ts?.ownerId ?? null;
      const ownerPlayer = ownerId ? playerById.get(ownerId) ?? null : null;
      const ownerColorHex = ownerPlayer?.colorHex ?? (ownerId ? DEFAULT_PLAYER_COLORS[ownerId] : '#94A3B8');

      let hasColorMonopoly = false;
      if (ownerId && entry.def.group !== null) {
        const groupIndices = groupTiles.get(entry.def.group) ?? [];
        hasColorMonopoly =
          groupIndices.length > 0 &&
          groupIndices.every((idx) => stateByIndex.get(idx)?.ownerId === ownerId);
      }

      let ownerTourismIndices: number[] = [];
      if (ownerId && entry.def.type === 'TOURISM') {
        ownerTourismIndices = tourismTiles.filter(
          (idx) => stateByIndex.get(idx)?.ownerId === ownerId
        );
      }

      const renderKey = [
        ownerId ?? 'NONE',
        ownerColorHex,
        ts?.buildingLevel ?? 0,
        ts?.isFestival ? 1 : 0,
        ts?.isBlackout ? 1 : 0,
        ts?.olympicMultiplier ?? 1,
        ts?.stepMultiplier ?? 1,
        hasColorMonopoly ? 1 : 0,
        ownerTourismIndices.join(','),
      ].join('|');

      if (entry.lastRenderKey !== renderKey) {
        entry.lastRenderKey = renderKey;
        this.renderTileCanvas(entry, ts, ownerPlayer, hasColorMonopoly, ownerTourismIndices);
      }

      const targetLevel = ts?.buildingLevel ?? BuildingLevel.NONE;
      if (
        entry.lastBuildingLevel !== targetLevel ||
        entry.lastBuildingOwner !== ownerId
      ) {
        entry.lastBuildingLevel = targetLevel;
        entry.lastBuildingOwner = ownerId;
        this.rebuildTileBuildingMesh(entry, targetLevel, ownerId, ownerColorHex);
      }

      entry.festivalRing.visible = Boolean(ts?.isFestival);
      entry.olympicBadgeGroup.visible = Boolean(ts && ts.olympicMultiplier > 1);
      entry.highlightGroup.visible =
        this.highlightedSet.has(entry.index) ||
        this.externalHighlightSet.has(entry.index);

      // Update floating 3D Multiplier Billboard Badge (Total net combined multiplier x2, x3, x4, x8, etc.)
      let specialMult = 1;
      const isBlackout = Boolean(ts?.isBlackout);
      const isUnownedFestival = Boolean(ts?.isFestival && !ts?.ownerId);
      if (ts && ts.ownerId && !isBlackout) {
        const festMult = ts.isFestival ? MATCH_CONFIG.festivalTollMultiplier : 1;
        const olyMult = Math.max(1, ts.olympicMultiplier || 1);
        const stepMult = Math.max(1, ts.stepMultiplier || 1);
        const monoMult = hasColorMonopoly ? MATCH_CONFIG.colorMonopolyTollMultiplier : 1;
        let tourMult = 1;
        if (entry.def.type === 'TOURISM') {
          tourMult = getTourismMultiplierForTile(entry.def.index, ownerTourismIndices);
        }
        specialMult = festMult * olyMult * stepMult * monoMult * tourMult;
      } else if (isUnownedFestival) {
        specialMult = MATCH_CONFIG.festivalTollMultiplier;
      }

      const multKeyVal = isBlackout ? 0 : (isUnownedFestival ? 999 : specialMult);
      if (entry.lastMultiplierValue !== multKeyVal) {
        entry.lastMultiplierValue = multKeyVal;
        this.renderMultiplierBadgeCanvas(entry.multiplierBadgeCtx, specialMult, isBlackout, isUnownedFestival);
        entry.multiplierBadgeTexture.needsUpdate = true;
      }

      const showMultiplierBadge = ((specialMult > 1 || isBlackout) && Boolean(ts?.ownerId)) || isUnownedFestival;
      entry.multiplierBadgeSprite.visible = showMultiplierBadge;
      if (showMultiplierBadge) {
        const bLevel = ts?.buildingLevel ?? BuildingLevel.NONE;
        const bOffset = bLevel === BuildingLevel.LANDMARK ? 2.3 : bLevel >= BuildingLevel.HOTEL ? 1.85 : 1.45;
        const tileH = entry.index % 8 === 0 ? TILE_HEIGHT_CORNER : TILE_HEIGHT_REGULAR;
        entry.multiplierBadgeSprite.position.y = tileH + bOffset;
      }
    }

    // 2. Sync Black Hole & White Hole portals
    if (data.blackHole) {
      const bhTile = this.tiles[data.blackHole.blackTileIndex];
      const whTile = this.tiles[data.blackHole.whiteTileIndex];
      if (bhTile) {
        const h = bhTile.index % 8 === 0 ? TILE_HEIGHT_CORNER : TILE_HEIGHT_REGULAR;
        this.blackHoleGroup.position.set(bhTile.worldPos.x, h + 0.02, bhTile.worldPos.z);
        this.blackHoleGroup.visible = true;
      }
      if (whTile) {
        const h = whTile.index % 8 === 0 ? TILE_HEIGHT_CORNER : TILE_HEIGHT_REGULAR;
        this.whiteHoleGroup.position.set(whTile.worldPos.x, h + 0.02, whTile.worldPos.z);
        this.whiteHoleGroup.visible = true;
      }
    } else {
      this.blackHoleGroup.visible = false;
      this.whiteHoleGroup.visible = false;
    }

    // 3. Sync Player Chibi Pawns
    for (const p of data.players) {
      const pawn = this.pawns.get(p.id);
      if (!pawn) continue;

      const isPawnVisible = p.isSlotActive !== false && !p.isBankrupt;
      pawn.rootGroup.visible = isPawnVisible;
      pawn.bodyMat.color.set(p.colorHex || DEFAULT_PLAYER_COLORS[p.id]);
      pawn.activeRing.visible = p.id === data.activePlayerId && isPawnVisible;
      pawn.activeChevron.visible = p.id === data.activePlayerId && isPawnVisible;
      pawn.islandCage.visible = p.islandTurnsLeft > 0 && isPawnVisible;
      pawn.travelHalo.visible = p.isWaitingTravel && isPawnVisible;

      const charDef = CHARACTER_ROSTER.find((c) => c.id === p.characterId);
      const emoji = charDef?.avatarEmoji ?? '🎲';
      this.updatePawnBadgeSprite(pawn, p.id, emoji, p.colorHex || DEFAULT_PLAYER_COLORS[p.id]);

      if (!pawn.isAnimatingHop) {
        pawn.currentTileIndex = ((p.tileIndex % 32) + 32) % 32;
      }
    }

    this.layoutRestingPawns();
  }

  private layoutRestingPawns(): void {
    // Group non-hopping visible pawns by tileIndex so multiple pawns on the same tile offset neatly
    const byTile = new Map<number, PawnVisualEntry[]>();
    for (const pawn of this.pawns.values()) {
      if (!pawn.rootGroup.visible || pawn.isAnimatingHop) continue;
      const list = byTile.get(pawn.currentTileIndex) ?? [];
      list.push(pawn);
      byTile.set(pawn.currentTileIndex, list);
    }

    const multiOffsets: readonly [number, number][] = [
      [-0.36, 0.28],
      [0.36, 0.28],
      [-0.36, -0.22],
      [0.36, -0.22],
    ];

    for (const [tileIdx, list] of byTile.entries()) {
      const tileCenter = this.computeTileWorldPosition(tileIdx);
      const baseH = tileIdx % 8 === 0 ? TILE_HEIGHT_CORNER : TILE_HEIGHT_REGULAR;
      if (list.length === 1) {
        list[0].baseY = baseH;
        list[0].rootGroup.position.set(tileCenter.x, baseH, tileCenter.z + 0.16);
        list[0].rootGroup.scale.setScalar(1);
      } else {
        for (let i = 0; i < list.length; i++) {
          const [ox, oz] = multiOffsets[i % multiOffsets.length];
          list[i].baseY = baseH;
          list[i].rootGroup.position.set(tileCenter.x + ox, baseH, tileCenter.z + oz);
          list[i].rootGroup.scale.setScalar(0.88);
        }
      }
    }
  }

  public animatePieceHop(
    playerId: PlayerId,
    pathTileIndices: number[],
    speedMultiplier: number,
    onStepCallback?: (tileIndex: number) => void,
    onComplete?: () => void
  ): void {
    const pawn = this.pawns.get(playerId);
    if (!pawn || pathTileIndices.length === 0) {
      onComplete?.();
      return;
    }

    const cleanPath = pathTileIndices.map((idx) => ((idx % 32) + 32) % 32);
    const speed = Math.max(0.4, speedMultiplier || 1);
    const isSingleWarp =
      cleanPath.length === 1 &&
      Math.abs(cleanPath[0] - pawn.currentTileIndex) > 1 &&
      !(pawn.currentTileIndex === 31 && cleanPath[0] === 0);

    const stepDurationMs = isSingleWarp ? 340 / speed : 165 / speed;
    const hopHeight = isSingleWarp ? 2.4 : 1.15;

    pawn.isAnimatingHop = true;
    pawn.rootGroup.scale.setScalar(1);

    const targetIdx = cleanPath[0];
    const targetWorld = this.computeTileWorldPosition(targetIdx);
    const targetY = targetIdx % 8 === 0 ? TILE_HEIGHT_CORNER : TILE_HEIGHT_REGULAR;

    this.activeHop = {
      playerId,
      path: cleanPath,
      stepIndex: 0,
      stepElapsedMs: 0,
      stepDurationMs,
      fromPos: pawn.rootGroup.position.clone(),
      toPos: new THREE.Vector3(targetWorld.x, targetY, targetWorld.z + 0.12),
      hopHeight,
      onStepCallback,
      onComplete,
    };
  }

  public animateDiceRoll(
    die1: number,
    die2: number,
    speedMultiplier: number,
    onComplete?: () => void
  ): void {
    const speed = Math.max(0.4, speedMultiplier || 1);
    const durationMs = 740 / speed;

    const [mesh1, mesh2] = this.diceMeshes;
    const startRot1 = mesh1.rotation.clone();
    const startRot2 = mesh2.rotation.clone();

    const endRot1 = this.getTargetEulerForDieValue(die1, 0.22);
    const endRot2 = this.getTargetEulerForDieValue(die2, -0.28);

    // Add full multi-turn revolutions so the dice tumble energetically before settling
    const spins = Math.PI * 6;
    const targetRot1 = new THREE.Euler(
      endRot1.x + spins,
      endRot1.y + Math.PI * 4,
      endRot1.z + spins,
      'YZX'
    );
    const targetRot2 = new THREE.Euler(
      endRot2.x - spins,
      endRot2.y - Math.PI * 4,
      endRot2.z + spins,
      'YZX'
    );

    this.activeDiceAnim = {
      die1,
      die2,
      elapsedMs: 0,
      durationMs,
      startRot1,
      startRot2,
      targetRot1,
      targetRot2,
      onComplete,
    };
  }

  public getTileScreenPosition(tileIndex: number): { x: number; y: number } {
    const cleanIdx = ((tileIndex % 32) + 32) % 32;
    const worldPos = this.computeTileWorldPosition(cleanIdx);
    const projected = new THREE.Vector3(worldPos.x, 0.65, worldPos.z);
    projected.project(this.camera);

    const width = this.container.clientWidth || window.innerWidth || 1280;
    const height = this.container.clientHeight || window.innerHeight || 720;

    return {
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height,
    };
  }

  public resize(): void {
    if (this.isDisposed) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    const aspect = width / height;

    // Fit the 32-tile isometric diamond comfortably inside the center of a 16:9 screen
    // while leaving room for the 4 corner player HUD cards and bottom gauge bar
    const baseHalfHeight = aspect < 1.55 ? 11.4 / (aspect / 1.55) : 10.6;
    const halfWidth = baseHalfHeight * aspect;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = baseHalfHeight;
    this.camera.bottom = -baseHalfHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDownBound);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMoveBound);
    window.removeEventListener('resize', this.handleWindowResizeBound);

    for (const tile of this.tiles) {
      tile.texture.dispose();
      tile.topMaterial.dispose();
    }
    for (const pawn of this.pawns.values()) {
      pawn.badgeTexture.dispose();
    }

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private spawnStepRipple(worldPos: THREE.Vector3, y: number, colorHex: string): void {
    const geo = new THREE.RingGeometry(0.22, 0.36, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(worldPos.x, y + 0.03, worldPos.z);
    this.boardGroup.add(mesh);

    this.ripples.push({
      mesh,
      material: mat,
      elapsedMs: 0,
      durationMs: 360,
    });
  }

  private spawnLandingShockwave(
    worldPos: THREE.Vector3,
    y: number,
    colorHex: string
  ): void {
    const geo = new THREE.RingGeometry(0.26, 0.48, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex || '#FDE047',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(worldPos.x, y + 0.04, worldPos.z);
    this.boardGroup.add(mesh);

    this.ripples.push({
      mesh,
      material: mat,
      elapsedMs: 0,
      durationMs: 500,
    });
  }

  private tick(now: number): void {
    if (this.isDisposed) return;
    this.rafId = requestAnimationFrame((t) => this.tick(t));

    const dtMs = Math.min(64, Math.max(1, now - this.lastFrameTime));
    this.lastFrameTime = now;
    this.elapsedClock += dtMs * 0.001;

    this.updateHopAnimation(dtMs);
    this.updateDiceAnimation(dtMs);
    this.updateAmbientBoardAnimations(dtMs);

    this.renderer.render(this.scene, this.camera);
  }

  private updateHopAnimation(dtMs: number): void {
    if (!this.activeHop) return;
    const hop = this.activeHop;
    const pawn = this.pawns.get(hop.playerId);
    if (!pawn) {
      this.activeHop = null;
      return;
    }

    hop.stepElapsedMs += dtMs;
    const t = Math.min(1, hop.stepElapsedMs / hop.stepDurationMs);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    pawn.rootGroup.position.lerpVectors(hop.fromPos, hop.toPos, ease);
    const arcY = Math.sin(t * Math.PI) * hop.hopHeight;
    pawn.rootGroup.position.y += arcY;

    // Subtle cheerful squash & stretch during hop
    const stretch = 1 + Math.sin(t * Math.PI) * 0.16;
    pawn.rootGroup.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));

    if (t >= 1) {
      const landedTileIdx = hop.path[hop.stepIndex];
      pawn.currentTileIndex = landedTileIdx;
      const landedTile = this.tiles[landedTileIdx];
      if (landedTile) {
        const h = landedTileIdx % 8 === 0 ? TILE_HEIGHT_CORNER : TILE_HEIGHT_REGULAR;
        this.spawnStepRipple(
          landedTile.worldPos,
          h,
           `#${pawn.bodyMat.color.getHexString()}`
        );
      }

      hop.onStepCallback?.(landedTileIdx);

      hop.stepIndex++;
      if (hop.stepIndex < hop.path.length) {
        hop.stepElapsedMs = 0;
        hop.fromPos.copy(hop.toPos);
        const nextIdx = hop.path[hop.stepIndex];
        const nextWorld = this.computeTileWorldPosition(nextIdx);
        const nextY = nextIdx % 8 === 0 ? TILE_HEIGHT_CORNER : TILE_HEIGHT_REGULAR;
        hop.toPos.set(nextWorld.x, nextY, nextWorld.z + 0.12);
      } else {
        pawn.isAnimatingHop = false;
        pawn.rootGroup.scale.setScalar(1);
        const finalTile = this.tiles[landedTileIdx];
        if (finalTile) {
          const h =
            landedTileIdx % 8 === 0 ? TILE_HEIGHT_CORNER : TILE_HEIGHT_REGULAR;
          this.spawnLandingShockwave(
            finalTile.worldPos,
            h,
            `#${pawn.bodyMat.color.getHexString()}`
          );
          finalTile.hoverAmount = 0.22;
        }
        const doneCb = hop.onComplete;
        this.activeHop = null;
        this.layoutRestingPawns();
        doneCb?.();
      }
    }
  }

  private updateDiceAnimation(dtMs: number): void {
    if (!this.activeDiceAnim) return;
    const anim = this.activeDiceAnim;
    anim.elapsedMs += dtMs;
    const t = Math.min(1, anim.elapsedMs / anim.durationMs);
    const easeOut = 1 - Math.pow(1 - t, 3);

    const [mesh1, mesh2] = this.diceMeshes;

    // Two-bounce vertical trajectory above the center plaza pad
    const bounceY = Math.abs(Math.sin(t * Math.PI * 2.2)) * Math.pow(1 - t, 1.35) * 3.1;
    const spread = Math.sin(t * Math.PI) * 0.35;

    mesh1.position.set(-0.78 - spread, 0.68 + bounceY, 0.15 + spread * 0.4);
    mesh2.position.set(0.78 + spread, 0.68 + bounceY, -0.15 - spread * 0.4);

    mesh1.rotation.set(
      THREE.MathUtils.lerp(anim.startRot1.x, anim.targetRot1.x, easeOut),
      THREE.MathUtils.lerp(anim.startRot1.y, anim.targetRot1.y, easeOut),
      THREE.MathUtils.lerp(anim.startRot1.z, anim.targetRot1.z, easeOut),
      'YZX'
    );
    mesh2.rotation.set(
      THREE.MathUtils.lerp(anim.startRot2.x, anim.targetRot2.x, easeOut),
      THREE.MathUtils.lerp(anim.startRot2.y, anim.targetRot2.y, easeOut),
      THREE.MathUtils.lerp(anim.startRot2.z, anim.targetRot2.z, easeOut),
      'YZX'
    );

    // Shockwave ring expansion on the dice pad
    const shockMat = this.diceShockwave.material as THREE.MeshBasicMaterial;
    shockMat.opacity = (1 - t) * 0.75;
    const shockScale = 0.8 + t * 3.2;
    this.diceShockwave.scale.setScalar(shockScale);

    if (t >= 1) {
      const exact1 = this.getTargetEulerForDieValue(anim.die1, 0.22);
      const exact2 = this.getTargetEulerForDieValue(anim.die2, -0.28);
      mesh1.rotation.copy(exact1);
      mesh2.rotation.copy(exact2);
      mesh1.position.set(-0.78, 0.68, 0.15);
      mesh2.position.set(0.78, 0.68, -0.15);
      shockMat.opacity = 0;

      const cb = anim.onComplete;
      this.activeDiceAnim = null;
      cb?.();
    }
  }

  private updateAmbientBoardAnimations(dtMs: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsedClock * 4.5);

    // 1. Tile building pop-in, highlight beacon bobbing, and hover elevation
    for (const tile of this.tiles) {
      // Smooth hover elevation
      const targetHover = this.hoveredTileIndex === tile.index ? 0.14 : 0;
      tile.hoverAmount = THREE.MathUtils.lerp(tile.hoverAmount, targetHover, 0.2);
      tile.rootGroup.position.y = tile.hoverAmount;

      // Building construction pop animation
      if (tile.buildingAnimProgress < 1) {
        tile.buildingAnimProgress = Math.min(1, tile.buildingAnimProgress + dtMs * 0.0042);
        const p = tile.buildingAnimProgress;
        // Overshoot spring curve
        const scale = p < 0.7 ? (p / 0.7) * 1.15 : 1.15 - ((p - 0.7) / 0.3) * 0.15;
        tile.buildingGroup.scale.setScalar(scale);
      }

      // Rotate Landmark star & halo if Landmark exists
      if (tile.lastBuildingLevel === BuildingLevel.LANDMARK) {
        const star = tile.buildingGroup.getObjectByName('landmarkStar');
        const halo = tile.buildingGroup.getObjectByName('landmarkHalo');
        if (star) star.rotation.y = this.elapsedClock * 2.2;
        if (halo) halo.rotation.z = -this.elapsedClock * 1.5;
      }

      // Highlight frame pulse
      if (tile.highlightGroup.visible) {
        const frame = tile.highlightGroup.getObjectByName('highlightFrame') as THREE.Mesh | undefined;
        const beacon = tile.highlightGroup.getObjectByName('highlightBeacon');
        if (frame) {
          const s = 1 + pulse * 0.1;
          frame.scale.set(s, s, 1);
        }
        if (beacon) {
          beacon.position.y =
            (tile.index % 8 === 0 ? TILE_HEIGHT_CORNER : TILE_HEIGHT_REGULAR) +
            1.45 +
            Math.sin(this.elapsedClock * 5.5) * 0.18;
          beacon.rotation.y = this.elapsedClock * 2.5;
        }
      }

      if (tile.olympicBadgeGroup.visible) {
        tile.olympicBadgeGroup.rotation.y = this.elapsedClock * 1.8;
      }
      if (tile.festivalRing.visible) {
        const s = 1 + Math.sin(this.elapsedClock * 3.2) * 0.05;
        tile.festivalRing.scale.set(s, s, 1);
      }
    }

    // 2. Black Hole & White Hole swirling vortex rotation
    if (this.blackHoleGroup.visible) {
      const outer = this.blackHoleGroup.getObjectByName('bhOuter');
      const inner = this.blackHoleGroup.getObjectByName('bhInner');
      if (outer) outer.rotation.z = this.elapsedClock * 2.6;
      if (inner) inner.rotation.z = -this.elapsedClock * 4.2;
    }
    if (this.whiteHoleGroup.visible) {
      const outer = this.whiteHoleGroup.getObjectByName('whOuter');
      const inner = this.whiteHoleGroup.getObjectByName('whInner');
      if (outer) outer.rotation.z = -this.elapsedClock * 2.4;
      if (inner) inner.rotation.z = this.elapsedClock * 3.8;
    }

    // 3. Active player pawn aura ring & chevron bobbing
    for (const pawn of this.pawns.values()) {
      if (pawn.activeRing.visible) {
        const s = 1 + pulse * 0.16;
        pawn.activeRing.scale.set(s, s, 1);
        (pawn.activeRing.material as THREE.MeshBasicMaterial).opacity =
          0.55 + 0.35 * pulse;
      }
      if (pawn.activeRing.visible && !pawn.isAnimatingHop) {
        const by = pawn.baseY ?? pawn.rootGroup.position.y;
        pawn.rootGroup.position.y =
          by + Math.sin(this.elapsedClock * 3.6) * 0.045;
      }
      if (pawn.activeChevron.visible) {
        pawn.activeChevron.position.y =
          1.96 + Math.sin(this.elapsedClock * 5) * 0.1;
        pawn.activeChevron.rotation.y = this.elapsedClock * 2.4;
      }
      if (pawn.travelHalo.visible) {
        pawn.travelHalo.rotation.z = this.elapsedClock * 3;
      }
    }

    // 4. Step ripples fade out
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.elapsedMs += dtMs;
      const t = Math.min(1, r.elapsedMs / r.durationMs);
      r.mesh.scale.setScalar(1 + t * 2.3);
      r.material.opacity = (1 - t) * 0.85;
      if (t >= 1) {
        this.boardGroup.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.material.dispose();
        this.ripples.splice(i, 1);
      }
    }
  }

  private getTileIndexFromPointerEvent(ev: PointerEvent): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    this.pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickableMeshes, true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (typeof obj.userData?.tileIndex === 'number') {
          return obj.userData.tileIndex;
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  private onPointerMove(ev: PointerEvent): void {
    const tileIdx = this.getTileIndexFromPointerEvent(ev);
    if (tileIdx !== this.hoveredTileIndex) {
      this.hoveredTileIndex = tileIdx;
      this.onTileHover?.(tileIdx);
    }
    if (tileIdx !== null && (this.highlightedSet.size === 0 || this.highlightedSet.has(tileIdx))) {
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  private onPointerDown(ev: PointerEvent): void {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const tileIdx = this.getTileIndexFromPointerEvent(ev);
    if (ev.pointerType === 'touch' || ev.pointerType === 'pen') {
      if (tileIdx !== this.hoveredTileIndex) {
        this.hoveredTileIndex = tileIdx;
        this.onTileHover?.(tileIdx);
      } else if (tileIdx === null && this.hoveredTileIndex !== null) {
        this.hoveredTileIndex = null;
        this.onTileHover?.(null);
      }
    }
    if (tileIdx !== null) {
      this.onTileClick(tileIdx);
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  private hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    if (Number.isNaN(num)) return `rgba(217, 119, 87, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}