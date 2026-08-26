/**
 * Centralised asset paths for the app.
 *
 * Every entry points to the optimised WebP build produced by
 * `scripts/optimize_images.py`. The original PNG sources are kept on disk
 * untouched so artists and the existing `Images-new/` pipeline can still
 * regenerate them — only the *web* references go through WebP. If a kid is
 * on a browser without WebP (extremely rare in 2026: <0.4% globally), the
 * `<picture>` fallback in `Img.tsx` lets us re-introduce the PNG without
 * editing this file again.
 */
export const assets = {
  loginBg: "/assets/edutic-art/login-sky-islands-bg.webp",
  homeBg: "/assets/edutic-art/sky-soft-bg.webp",
  gameplayBg: "/assets/edutic-art/gameplay-bg.webp",

  // Male mascot.
  mascotMaleWave: "/assets/edutic-art/mascot-wave.webp",
  mascotMaleJump: "/assets/edutic-art/mascot-jump.webp",
  mascotMaleProud: "/assets/edutic-art/mascot-proud.webp",
  mascotMaleLaptop: "/assets/edutic-art/mascot-laptop.webp",
  mascotMaleNatural: "/assets/edutic-art/mascot-natural.webp",

  // Female mascot.
  mascotFemaleWave: "/assets/edutic-art/mascot-women-wave.webp",
  mascotFemaleLaptop: "/assets/edutic-art/mascot-women-laptop.webp",

  /* Small, high-quality map thumbnails (see Images-new/process_map_thumbs.py).
     The big detail art lives elsewhere; the map only needs these. */
  worldsIsland1: "/typely_islands_thumb_webp/worlds-island1-transparent.webp",
  worldsIsland2: "/typely_islands_thumb_webp/worlds-island2-transparent.webp",
  worldsIsland3: "/typely_islands_thumb_webp/worlds-island3-transparent.webp",
  worldsIsland4: "/typely_islands_thumb_webp/worlds-island4-transparent.webp",
  worldsIsland5: "/typely_islands_thumb_webp/world-island5.webp",
  island1: "/assets/edutic-art/island1.webp",
  island2: "/assets/edutic-art/island2.webp",
  island3: "/assets/edutic-art/island3.webp",
  island4: "/assets/edutic-art/island4.webp",
  island5: "/assets/edutic-art/island5.webp",
  shipFront: "/assets/edutic-art/spaceships/ship-front.webp",
  shipBack: "/assets/edutic-art/spaceships/ship-back.webp",
  shipLeft: "/assets/edutic-art/spaceships/ship-left.webp",
  shipRight: "/assets/edutic-art/spaceships/ship-right.webp",
  shipDiagonalLeft: "/assets/edutic-art/spaceships/ship-diagonal-left.webp",
  shipDiagonalRight: "/assets/edutic-art/spaceships/ship-diagonal-right.webp",
  /* 3D level button images (pre-rendered at base perspective, no number). */
  /* Botón de nivel BÁSICO — el de piedra sin decorar. Es el que se usa en
     cualquier isla que todavía no tenga el suyo propio; ver levelButtonFor()
     más abajo. No lo referencies directo desde una página. */
  levelButton: "/assets/level-buttons/btn-default.png",
  levelButtonPressed: "/assets/level-buttons/btn-default-pressed.png",

  /* Island 5 props — used by SkillLevelView for the mouse-skill levels. */
  i5Star:    "/assets/edutic-art/island5/star.webp",
  i5Apple:   "/assets/edutic-art/island5/apple.webp",
  i5Rabbit:  "/assets/edutic-art/island5/rabbit.webp",
  i5Ball:    "/assets/edutic-art/island5/ball.webp",
  i5Shot:    "/assets/edutic-art/island5/shot.webp",
  i5Penguin: "/assets/edutic-art/island5/penguin.webp",
  i5Bag:     "/assets/edutic-art/island5/bag.webp",
  i5Chest:   "/assets/edutic-art/island5/cofre.webp",
  i5Potion:  "/assets/edutic-art/island5/potion.webp",
  i5Apps:    "/assets/edutic-art/island5/apps.webp",
  i5WindowControls: "/assets/edutic-art/island5/cerrar-maximizar-minimizar-ventana.webp",
  i5Message: "/assets/edutic-art/island5/mensaje.webp",
  i5Notes:   "/assets/edutic-art/island5/notas.webp",
  i5WindowMedia: "/assets/edutic-art/island5/ventana-mismedios.webp",
  i5BrowserTabs: "/assets/edutic-art/island5/pestanas-explorador-videos-dibujos.webp",
  i5DrawingsWindow: "/assets/edutic-art/island5/dibujos-ventana.webp",
  i5Mouse:   "/assets/edutic-art/island5/mouse.webp",
  i5CastleVertical: "/assets/edutic-art/island5/castillo-vertical.webp",
  i5CastleSquare:   "/assets/edutic-art/island5/castillo-cuadrada.webp",
  i5ZoomBtns:       "/assets/edutic-art/island5/zoom-mas-menos.webp",
};

/* =====================================================================
   BOTONES DE NIVEL POR ISLA
   ---------------------------------------------------------------------
   Cada mundo puede traer su propio botón, decorado para que pegue con su
   terreno: pasto en las islas verdes, hielo en la del reloj, glaseado en
   la de caramelos. Un botón con pasto sobre una torta rosa se ve mal, y
   por eso no alcanza con uno solo para las quince.

   Las quince ya tienen el suyo. Una isla que NO figure acá cae al básico de
   piedra sin decorar (btn-default): eso ya no es el estado normal de nadie,
   queda como red de seguridad si algún día se suma un mundo nuevo o falla
   un archivo.

   Para dar de alta una isla: dejar los dos WebP en
   public/assets/level-buttons/ y descomentar su línea. Los dos estados
   tienen que estar dibujados con la MISMA cámara, el MISMO tamaño y en la
   MISMA posición del lienzo — si difieren, el botón pega un salto al pasar
   el mouse. Y el centro del lienzo tiene que caer sobre el centro de la
   base de piedra (ver CLAUDE.md §6.1), o los niveles de esa isla se
   desalinean.
===================================================================== */
const LEVEL_BUTTONS_DIR = "/assets/level-buttons";

const LEVEL_BUTTON_BY_WORLD: Partial<Record<string, string>> = {
  island1:  `${LEVEL_BUTTONS_DIR}/btn-island1`,    // teclas: piedra helada, cristales y florcitas
  island2:  `${LEVEL_BUTTONS_DIR}/btn-island2`,    // piedra con pasto y florcitas
  island3:  `${LEVEL_BUTTONS_DIR}/btn-island3`,    // mármol y oro, pasto y pétalos
  island4:  `${LEVEL_BUTTONS_DIR}/btn-island4`,    // piedra con musgo y hojas
  island5:  `${LEVEL_BUTTONS_DIR}/btn-island5`,    // piedra con pasto y cubos de hielo
  island6:  `${LEVEL_BUTTONS_DIR}/btn-island6`,    // portal de cristal: runas y drusas
  island7:  `${LEVEL_BUTTONS_DIR}/btn-island7`,    // jardín: cerezo en flor
  island8:  `${LEVEL_BUTTONS_DIR}/btn-island8`,    // reloj helado: hielo, bronce y nieve
  island9:  `${LEVEL_BUTTONS_DIR}/btn-island9`,    // otoño: barro cocido y hojas de arce
  island10: `${LEVEL_BUTTONS_DIR}/btn-island10`,   // ruinas en la selva: piedra, musgo y helechos
  island11: `${LEVEL_BUTTONS_DIR}/btn-island11`,   // caramelo: galleta glaseada
  island12: `${LEVEL_BUTTONS_DIR}/btn-island12`,   // cañón del desierto: roca naranja, arena y cactus
  island13: `${LEVEL_BUTTONS_DIR}/btn-island13`,   // arcoíris: aros pastel y pasto
  island14: `${LEVEL_BUTTONS_DIR}/btn-island14`,   // alquimia: bronce, runas y cristales
  island15: `${LEVEL_BUTTONS_DIR}/btn-island15`,   // laguna: agua, nenúfares y juncos
};

/* =====================================================================
   COLOR DEL NÚMERO CUANDO EL NIVEL ESTÁ COMPLETADO
   ---------------------------------------------------------------------
   Sin completar, el número va BLANCO: es lo que más contrasta contra
   cualquier disco. Completado necesita verse distinto de un vistazo, y
   para eso necesita color — pero uno que pegue con el botón de esa isla,
   no un verde de sistema igual para las quince.

   Cada valor sale de medir el color que el número tiene realmente detrás
   en ese botón y buscar su COMPLEMENTARIO PARTIDO: el tono opuesto,
   traído un 25 % de vuelta hacia el original. Es la relación que
   contrasta sin pelearse — el opuesto puro chilla y el análogo no se
   despega. Después se elige, de una paleta de tonos que se mantienen
   vivos, el más cercano a ese tono que pase 3.5:1 de contraste.

   Se regeneran con:  node scripts/level-number-colors.mjs

   Casi todos son claros a propósito. La isla 1 es la excepción: su disco
   es un turquesa muy claro — de hecho es la única donde el número blanco
   queda flojo, 2.80:1 — así que ahí el número completado va oscuro.
===================================================================== */
const LEVEL_NUMBER_DONE: Partial<Record<string, string>> = {
  island1:  "#7a143a",   // vino sobre turquesa claro   — 3.75:1
  island2:  "#b8ffe3",   // menta clara sobre verdeazul — 3.49:1
  island3:  "#5be8ba",   // menta sobre borgoña         — 4.30:1
  island4:  "#b7f000",   // lima sobre verde oscuro     — 3.94:1
  island5:  "#b8ffe3",   // menta clara sobre azul      — 3.42:1
  island6:  "#facc15",   // dorado sobre índigo         — 3.63:1
  island7:  "#b8ffe3",   // menta clara sobre terracota — 3.40:1
  island8:  "#ff9fca",   // rosa sobre pizarra          — 4.05:1
  island9:  "#b8ffe3",   // menta clara sobre naranja   — 3.97:1
  island10: "#54e8c6",   // turquesa sobre verde musgo  — 3.59:1
  island11: "#5be8ba",   // menta sobre frambuesa       — 3.51:1
  island12: "#54e8c6",   // turquesa sobre ocre         — 4.05:1
  island13: "#b7f000",   // lima sobre violeta          — 5.31:1
  island14: "#facc15",   // dorado sobre verdeazul      — 3.56:1
  island15: "#ff9fca",   // rosa sobre azul             — 4.19:1
};

/** Color del número de un nivel COMPLETADO en ese mundo. El menta de marca
 *  queda de reserva para un mundo que todavía no tenga el suyo. */
export function levelNumberDoneColor(worldId: string): string {
  return LEVEL_NUMBER_DONE[worldId] ?? "#5be8ba";
}

/** Botón de nivel de un mundo. Cae al básico si esa isla todavía no tiene
 *  el suyo. `pressed` es el estado con el mouse encima. */
export function levelButtonFor(worldId: string, pressed = false): string {
  const base = LEVEL_BUTTON_BY_WORLD[worldId];
  if (!base) return pressed ? assets.levelButtonPressed : assets.levelButton;
  return `${base}${pressed ? "-pressed" : ""}.webp`;
}

/* =====================================================================
   CHARACTER & SHIP PROGRESSION SKINS (unlocked by cumulative star total)
   Five phases per object (f1…f5). The account-wide star total picks the
   phase (see `getSkinPhaseIndex` in utils/progress): 0★→f1 · 5★→f2 · 10★→f3
   · 20★→f4 · 30★→f5. `t1` is the BASE tier; a future character evolution adds
   a `t2` set that restarts at f1 — drop the art in /skins as `<kind>-t2-f<n>`
   and add `skinTier(kind, "t2")` below. Files: optimised WebP under
   public/assets/edutic-art/skins/ (1024px, transparent).
===================================================================== */
const SKINS_DIR = "/assets/edutic-art/skins";

export type SkinKind = "male" | "female" | "ship";

function skinTier(kind: SkinKind, tier: string): string[] {
  return [1, 2, 3, 4, 5].map((f) => `${SKINS_DIR}/${kind}-${tier}-f${f}.webp`);
}

/** [tierIndex][phaseIndex] — tier 0 = base (`t1`). Index 0 → f1 … 4 → f5. */
export const characterSkins: Record<SkinKind, string[][]> = {
  male:   [skinTier("male", "t1")],
  female: [skinTier("female", "t1")],
  ship:   [skinTier("ship", "t1")],
};

/** Resolve a skin URL, clamping tier/phase into range so it never returns
 *  undefined even if thresholds or tier counts change later. */
export function skinUrl(kind: SkinKind, phaseIndex: number, tier = 0): string {
  const tiers = characterSkins[kind];
  const set = tiers[Math.min(Math.max(tier, 0), tiers.length - 1)];
  return set[Math.min(Math.max(phaseIndex, 0), set.length - 1)];
}

/* =====================================================================
   Expansion islands (island6 … island15) — THREE separate image families.
   They must NEVER be mixed. Index 0 → island6 … index 9 → island15, and
   all three share the SAME theme order (crystal, garden, frozen, autumn,
   jungle, candyland, desert, rainbow, alchemy, lagoon) so a single world's
   thumbnail + detail map + gameplay scene always match thematically.
===================================================================== */

/* 1) WORLD MAP IMAGE — the floating island art on the worlds-selection map.
      Transparent islands shown small in the sky (from /typely_islands_webp). */
export const expansionIslandThumbs: string[] = [
  "/typely_islands_thumb_webp/background-island1.webp",  // crystal
  "/typely_islands_thumb_webp/background-island2.webp",  // garden / library
  "/typely_islands_thumb_webp/background-island3.webp",  // frozen / clockwork
  "/typely_islands_thumb_webp/background-island4.webp",  // autumn / artist
  "/typely_islands_thumb_webp/background-island5.webp",  // jungle / ruins
  "/typely_islands_thumb_webp/background-island6.webp",  // candyland
  "/typely_islands_thumb_webp/background-island7.webp",  // desert / canyon
  "/typely_islands_thumb_webp/background-island8.webp",  // rainbow / playground
  "/typely_islands_thumb_webp/background-island9.webp",  // alchemy / lab
  "/typely_islands_thumb_webp/background-island10.webp", // lagoon
];

/* 2) ISLAND DETAIL BACKGROUND — the full 16:9 scene WITH painted platforms,
      shown behind the level-selection nodes (from /typely_backgrounds_webp).
      These are NOT gameplay backgrounds — they contain platforms. */
export const islandDetailBackgrounds: string[] = [
  "/typely_backgrounds_webp/bg01_crystal_portal.webp",
  "/typely_backgrounds_webp/bg02_garden_library.webp",
  "/typely_backgrounds_webp/bg03_frozen_clockwork.webp",
  "/typely_backgrounds_webp/bg04_autumn_artist.webp",
  "/typely_backgrounds_webp/bg05_jungle_ruins.webp",
  "/typely_backgrounds_webp/bg06_candyland.webp",
  "/typely_backgrounds_webp/bg07_desert_canyon.webp",
  "/typely_backgrounds_webp/bg08_rainbow_playground.webp",
  "/typely_backgrounds_webp/bg09_alchemy_lab.webp",
  "/typely_backgrounds_webp/bg10_lagoon.webp",
];

/* 3) GAMEPLAY BACKGROUND — the single central-stage scene painted behind the
      keyboard/game UI (from /typely_gameplay_background_webp). Used ONLY by
      the actual gameplay screen, never by the world map or detail map. */
export const gameplayBackgrounds: string[] = [
  "/typely_gameplay_background_webp/gameplaybg-01-crystal-portal.webp",
  "/typely_gameplay_background_webp/gameplaybg-02-garden-library.webp",
  "/typely_gameplay_background_webp/gameplaybg-03-frozen-clockwork.webp",
  "/typely_gameplay_background_webp/gameplaybg-04-autumn-artist.webp",
  "/typely_gameplay_background_webp/gameplaybg-05-jungle-ruins.webp",
  "/typely_gameplay_background_webp/gameplaybg-06-candyland.webp",
  "/typely_gameplay_background_webp/gameplaybg-07-desert-canyon.webp",
  "/typely_gameplay_background_webp/gameplaybg-08-rainbow-playground.webp",
  "/typely_gameplay_background_webp/gameplaybg-09-alchemy-lab.webp",
  "/typely_gameplay_background_webp/gameplaybg-10-lagoon.webp",
];
