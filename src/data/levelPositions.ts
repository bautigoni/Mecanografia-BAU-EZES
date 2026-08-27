import type { Activity } from "./activities";

/* =====================================================================
   LEVEL MARKER POSITIONS  ·  single source of truth
   ---------------------------------------------------------------------
   Each entry is the position of a level marker over its island artwork,
    expressed as PERCENTAGES of the level map container (the level-map
    <section> in IslandDetailPage, which covers the whole island stage):

     x → horizontal %, 0 = left edge, 100 = right edge
     y → vertical %,   0 = top edge,  100 = bottom edge

   The marker is centered on (x, y) — CSS applies translate(-50%, -50%) —
   so x/y is the CENTER of the level bubble, which should sit on the
   center of the painted platform.

   These are percentages (never pixels), so they stay aligned when the
   screen resizes. The island background uses object-fit: cover, so for
   pixel-perfect placement edit at the aspect ratio you ship at.

   HOW TO EDIT BY HAND:
     - Tweak the numbers below, or
     - Open an island in dev with the visual editor (see
       src/components/dev/LevelPositionEditor + IslandDetailPage):
         1. visit  /worlds/<islandId>?editor=1   (dev build only)
         2. drag each numbered marker onto its platform
         3. click "Copiar arreglo" and paste the array back here.

   Level counts vary per island (6, 7 or 8) — each array keeps exactly the
   number of markers that island needs; they are not padded to a fixed size.
===================================================================== */

export type LevelPosition = {
  x: number;
  y: number;
  /** Uniform scale (1 = normal). */
  scale?: number;
  /** 3D tilt backward/forward in degrees. Positive = top tilts away, like lying on the ground. */
  rotateX?: number;
  /** 3D tilt left/right in degrees. */
  rotateY?: number;
  /** 2D spin rotation in degrees. */
  rotateZ?: number;
  /** Perspective depth in px. Lower = stronger 3D effect (camera closer). Default ~500. */
  perspective?: number;

  /* ── El número encima del botón ────────────────────────────────────
     El número se dibuja en el centro de la caja del nodo, que es el
     centro del PNG. Cuando un nodo se inclina o se agranda, ese centro
     deja de coincidir con el centro visible del disco, y el número queda
     corrido. Estos tres campos lo reacomodan por nivel.

     numX/numY van en % del ANCHO DEL BOTÓN (unidad cqw), no en píxeles:
     el nodo declara container-type: inline-size, así que el número se
     mueve junto con el botón en cualquier resolución. Un valor de 5
     desplaza el número un 5 % del ancho del botón.                    */

  /** Corrimiento horizontal del número, en % del ancho del botón. + derecha. */
  numX?: number;
  /** Corrimiento vertical del número, en % del ancho del botón. + abajo. */
  numY?: number;
  /** Tamaño del número relativo al normal (1 = normal). */
  numSize?: number;

  /* Al apretarse, el disco del botón se HUNDE, y cuánto se hunde lo decide el
     dibujo de cada isla: no es el mismo salto en una galleta que en un aro de
     piedra. Estos dos campos son la posición del número en el estado apretado.
     Si no están, se usa la de reposo con el hundido genérico, que es lo que
     hacía antes para las quince por igual y en varias quedaba corrido. */

  /** Corrimiento horizontal del número con el botón apretado, en % del ancho. */
  numXHover?: number;
  /** Corrimiento vertical del número con el botón apretado, en % del ancho. */
  numYHover?: number;
};

/* Per-island level marker positions, placed by hand with the visual editor
   over each island's painted platforms. Coordinates are percentages of the
   ISLAND IMAGE itself — NOT the viewport. islandDetailPage translates them
   to container-relative at render time, which keeps nodes aligned to the
   painted platforms on every screen size regardless of object-fit cropping.

   Each island keeps its own level count (6, 7 or 8) and the order matches
   the level order (index 0 = level 1, index 1 = level 2, …). */
export const islandLevelLayouts: Record<Activity["worldId"], LevelPosition[]> = {
  island1: [
    { x: 35.8, y: 55.3, scale: 1.78, rotateX: -11, perspective: 290, numX: -7, numY: -32, numSize: 1.35, numYHover: -29 },
    { x: 28.2, y: 42.8, scale: 1.68, numX: -1, numY: -7, numSize: 1.1 },
    { x: 42.7, y: 34.7, scale: 1.58, rotateX: 37.5, numX: -0.5, numY: -2, numSize: 0.96 },
    { x: 61.5, y: 29.9, scale: 1.56, rotateX: 21.5, numX: -2, numY: -3.5, numSize: 1.26 },
    { x: 72.8, y: 38.5, scale: 1.66, rotateX: 27, rotateY: 4.5, numX: -2, numY: -3.5 },
    { x: 59, y: 50.4, scale: 1.72, rotateX: 4.5, perspective: 80, numY: -8 },
    { x: 73.6, y: 55.4, scale: 1.76, rotateX: -7, rotateY: -4, perspective: 670, numX: -2, numY: -7, numSize: 1.19 },
  ],

  island2: [
    /* Isla de palabras — island2.webp (1672x941). 6 niveles, 6 discos.

       -- Recolocada sobre los anillos del pedestal (2026-08-24) -----------
       Medido con  node scripts/measure-pedestal.mjs  y verificado con
       node scripts/preview-level-positions.mjs island2 --sprite

       CENTRO. La referencia es el ANILLO del pedestal (el circulo que forman
       las divisiones de los ladrillos), no el borde exterior: el borde se
       confunde con el canto y con el pasto, y arrastra el centro. Como los
       circulos concentricos de un plano proyectan elipses concentricas, el
       centro del anillo ES el centro de la plataforma.

       ROTACION. Si el anillo se ve ovalado es porque esta en escorzo, y el
       boton tiene que acostarse igual. La BASE de level.png (la elipse gris
       que se apoya — NO el bbox del dibujo, que incluye la tapa azul que
       sobresale) trae un ratio 0.553 horneado. rotateX(alfa) la achata por
       cos(alfa), asi que para un anillo de ratio r = alto/ancho EN PIXELES:

           alfa = acos(r / 0.553)

       El ratio baja con la distancia: 0.537 en el disco de abajo (casi
       redondo, 14 grados) hasta 0.421 en el de arriba (bien ovalado, 40).
       Ese gradiente es la perspectiva de la escena.

       perspective: 4000 ~ ortografico, condicion para que valga el cos(alfa).

       TAMANO. El boton visible ocupa ~72 % del ancho del anillo, asi que las
       divisiones de ladrillo se siguen viendo alrededor. Al convertir, ojo:
       el dibujo solo llena 454/600 del ancho de su lienzo.

       NOTA DE ASSET. public/assets/level.png se re-encuadro de 600x378 a
       600x445 para que el centro del lienzo caiga sobre el centro de la base.
       Antes tenia 81px de margen arriba y 29 abajo, y el boton salia corrido
       hacia abajo en TODAS las islas. El original esta en _backups/.
    */
    { x: 49.1, y: 75.1, scale: 1.82, rotateX: 36.5, perspective: 4000 },  // N1 — disco abajo-centro    (anillo 0.537, el más cercano → casi sin inclinar)
    { x: 33.3, y: 66.7, scale: 1.71, rotateX: 28.4, perspective: 4000 },  // N2 — disco abajo-izquierda (anillo 0.486)
    { x: 32.5, y: 49.6, scale: 1.62, rotateX: 36.1, perspective: 4000 },  // N3 — disco medio-izquierda (anillo 0.447)
    { x: 52.6, y: 35.5, scale: 1.62, rotateX: 40.4, perspective: 4000 },  // N4 — disco arriba-centro   (anillo 0.421, el más lejano → el más acostado)
    { x: 68.2, y: 41.3, scale: 1.59, rotateX: 36.1, perspective: 4000 },  // N5 — disco arriba-derecha  (anillo 0.447)
    { x: 62.9, y: 61.6, scale: 1.64, rotateX: 30, perspective: 4000 },  // N6 — disco medio-derecha   (anillo 0.479)
    { x: 48, y: 55, scale: 1.66, rotateX: 33, perspective: 4000 },  // N7 - provisoria, al centro del anillo
  ],

  island3: [
    /* island3.webp: ONE big central painted chain (the cluster in the
       heatmap at x 20-70, y 30-95). All 7 levels ride the chain in a
       logical path; no separate top/right platforms exist in the art. */
    { x: 53, y: 48 },   // N1 — upper-centre of the main chain
    { x: 57, y: 60 },   // N2 — slightly down-right
    { x: 67, y: 66 },   // N3 — bottom-right of the main chain
    { x: 53, y: 90 },   // N4 — bottom-centre
    { x: 30, y: 69 },   // N5 — bottom-left
    { x: 27, y: 59 },   // N6 — mid-left
    { x: 35, y: 42 },   // N7 — upper-left
  ],

  island4: [
    /* island4.webp: ONE big central painted chain (the main island). The
       "bottom-right small platform" in earlier art isn't a real platform
       in the painted scene (it's just decorative clouds), so all 6 levels
       ride the main chain in a path. */
    { x: 49, y: 42 },   // N1 — upper-centre of the main chain
    { x: 67, y: 60 },   // N2 — centre-right
    { x: 52, y: 71 },   // N3 — centre of the main chain
    { x: 38, y: 76 },   // N4 — bottom-centre
    { x: 32, y: 62 },   // N5 — mid-left of the main chain
    { x: 72, y: 74 },   // N6 — bottom-right of the main chain
    { x: 60, y: 48 },   // N7 - provisoria, hueco arriba a la derecha
  ],

  island5: [
    { x: 31, y: 28 },
    { x: 41, y: 39 },
    { x: 53, y: 45 },
    { x: 43, y: 53 },
    { x: 28, y: 46 },
    { x: 31, y: 38 },
    { x: 42, y: 39 },
  ],

  island6: [
    /* Mundo 2 "Isla de la escritura" — fondo bg01_crystal_portal.webp (1672×941).
       Coordenadas = % de la imagen (la cover-rect math de IslandDetailPage las
       fija a las plataformas pintadas en cualquier viewport). Cadena que sube
       desde el disco de abajo-izquierda hasta el portal. 7 niveles.

       ── Migrado desde CSS (2026-08-24) ───────────────────────────────────
       Estos 7 nodos estaban retocados con reglas `#btnisland6lvl1…7` al final
       de global.css, con translate() y perspective() en PIXELES fijos. Un
       offset en px vale un % distinto de la imagen en cada resolución, así que
       el ajuste solo era válido en la pantalla donde se hizo. Las reglas se
       borraron y sus valores viven acá como datos.

       Conversión px → %: se tomó como referencia 1920×1080, donde el
       rectángulo cover de una imagen 16:9 mide 1920 × 1080.6 px. O sea
       Δx% = px / 19.20  y  Δy% = px / 10.806.

       `perspective: 4000` ≈ proyección ortográfica, que es como se veían las
       rotaciones en CSS (no llevaban función perspective()). No lo bajes sin
       mirar la isla: con valores chicos aparece keystoning.

       OJO: las rotaciones ahora afectan SOLO a la imagen del botón, no al
       número ni a los badges — antes el CSS rotaba el botón entero y dejaba
       los números de esta isla muy achatados. Verificar island6 a ojo. */
    { x: 20.8, y: 83.8, scale: 1.84, rotateX: -28, rotateY: 2, perspective: 4000 },  // N1 — disco rúnico abajo-izquierda (inicio, lleva la nave)
    { x: 19.8, y: 46.3, scale: 1.53, rotateX: 48, perspective: 4000 },               // N2 — disco de la cornisa izquierda (más grande)
    { x: 31.1, y: 38, scale: 1.5, rotateX: 58, perspective: 4000 },                  // N3 — terraza verde sobre la cornisa
    { x: 46.3, y: 34.5, scale: 1.15, rotateX: 49, perspective: 4000 },               // N4 — escalones de piedra hacia el centro
    { x: 57.4, y: 44.5, scale: 1.6, rotateX: 49, rotateY: 3, rotateZ: 4, perspective: 4000 },   // N5 — disco rúnico central
    { x: 76.5, y: 60.1, scale: 1.8, rotateX: -40, rotateZ: 6, perspective: 4000 },   // N6 — disco rúnico derecho (abajo)
    { x: 62.3, y: 23.5, scale: 1.85, rotateX: 57, rotateY: 2, rotateZ: -1, perspective: 4000 }, // N7 — explanada al pie del portal
  ],

  island7: [
    { x: 25.4, y: 77.5, scale: 1.6 },
    { x: 73.5, y: 70.6, scale: 1.2 },
    { x: 83.2, y: 38.7 },
    { x: 47.1, y: 52.8, scale: 1.1 },
    { x: 40.3, y: 42.3 },
    { x: 28.5, y: 45.9 },
    { x: 63, y: 43 },
    { x: 46, y: 56 },
  ],

  island8: [
    { x: 18.5, y: 35.4 },
    { x: 27.9, y: 78.5 },
    { x: 41.3, y: 92.8 },
    { x: 73.6, y: 83.4 },
    { x: 78.9, y: 59.9 },
    { x: 77.1, y: 25.1 },
    // Nudged a few % left + down (2026-06-02) so the marker clears the
    // next-world entrance overlay that was eating the click target.
    { x: 47, y: 15.5 },
    { x: 44, y: 68 },
  ],

  island9: [
    { x: 23.2, y: 90 },
    { x: 37.4, y: 76.6 },
    { x: 33.8, y: 50.7 },
    { x: 47.1, y: 43.2 },
    { x: 54.9, y: 18.3 },
    { x: 67.1, y: 35 },
    { x: 83.5, y: 17 },
    { x: 46, y: 56 },
  ],

  island10: [
    { x: 16.8, y: 20.3 },
    { x: 32.8, y: 32.3 },
    { x: 15.8, y: 64 },
    { x: 36.2, y: 90.3 },
    { x: 61.3, y: 64.9 },
    { x: 76.4, y: 40.9 },
    { x: 58, y: 74 },
    { x: 44, y: 68 },
  ],

  island11: [
    { x: 28.2, y: 73.9, scale: 1.97, rotateX: 43.5 },
    { x: 22.7, y: 47.4, scale: 1.5, rotateX: 38, perspective: 580 },
    { x: 43.2, y: 45, scale: 1.65, rotateX: 47.5 },
    { x: 61.1, y: 40.4, scale: 1.72, rotateX: 53.5, rotateY: 4.5, rotateZ: -3 },
    { x: 82.1, y: 34.9, scale: 1.76, rotateX: 48, rotateY: 8 },
    { x: 70.8, y: 60, scale: 1.8, rotateX: -51, rotateY: -6, rotateZ: -3.5 },
    { x: 50.5, y: 73.9, scale: 1.87, rotateX: 32.5 },
    { x: 46, y: 56 },
  ],

  island12: [
    { x: 13.8, y: 43.6 },
    { x: 29.5, y: 75.3 },
    { x: 41, y: 22.4 },
    { x: 58.6, y: 40.8 },
    { x: 71.2, y: 68.1 },
    { x: 81.1, y: 41.5 },
    { x: 58, y: 74 },
    { x: 44, y: 68 },
  ],

  island13: [
    { x: 16.7, y: 57, scale: 1.4, rotateX: -42.5, rotateY: 1 },
    { x: 56.7, y: 70.6, scale: 1.5, rotateX: 27 },
    { x: 76.9, y: 60.1, scale: 1.5, rotateX: -40.5 },
    { x: 62.7, y: 52.1 },
    { x: 55.6, y: 24.9, scale: 0.9, rotateX: 41.5 },
    { x: 34.9, y: 27.3, rotateX: -50 },
    { x: 60, y: 40 },
    { x: 46, y: 56 },
  ],

  island14: [
    { x: 21.1, y: 48.8 },
    { x: 41.7, y: 30.9 },
    { x: 57.1, y: 44.2 },
    { x: 46.7, y: 78.1 },
    { x: 64.3, y: 75.2 },
    { x: 81.1, y: 65.8 },
    { x: 58, y: 74 },
    { x: 44, y: 68 },
  ],

  island15: [
    { x: 20.8, y: 79.3 },
    { x: 36.8, y: 62 },
    { x: 28.3, y: 25.5 },
    { x: 43.9, y: 2.7 },
    { x: 53.6, y: 45.5 },
    { x: 78.5, y: 53.3 },
    { x: 51.8, y: 89.9 },
    { x: 87.2, y: 82.5 },
  ],
};
