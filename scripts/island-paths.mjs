/* =====================================================================
   RUTAS DEL ARTE DE ISLA — para los scripts de línea de comandos
   ---------------------------------------------------------------------
   Espejo de islandArt() y compañía (src/utils/assets.ts), con una
   diferencia deliberada: acá la separación en capas NO se declara en una
   lista, se DEDUCE de que exista el archivo island.webp. Una lista repetida
   en dos lenguajes se desincroniza el día que alguien separa una isla y se
   olvida de tocar el script; el disco no miente.

   Una isla es una carpeta:
     public/assets/islands/islandN/{sky,island,map,gameplay,button,button-pressed}.webp
     Images/islands/islandN/        ← fuentes, no se publican
===================================================================== */
import fs from "node:fs";

export const SHIPPED = "public/assets/islands";
export const SOURCES = "Images/islands";

/** Carpeta publicada de una isla. */
export const carpetaDe = (id) => `${SHIPPED}/${id}`;

/** Carpeta de fuentes de una isla. */
export const fuentesDe = (id) => `${SOURCES}/${id}`;

/** true si esa isla ya tiene su arte separado en cielo + isla. */
export const estaSeparada = (id) => fs.existsSync(`${SHIPPED}/${id}/island.webp`);

/** El arte contra el que se miden los % de levelPositions.ts: la isla
 *  recortada si ya está separada, y si no la escena entera. */
export const arteDe = (id) =>
  estaSeparada(id) ? `${SHIPPED}/${id}/island.webp` : `${SHIPPED}/${id}/sky.webp`;

/** El fondo que llena la pantalla detrás del arte. */
export const cieloDe = (id) => `${SHIPPED}/${id}/sky.webp`;

/** Botón de nivel de una isla, libre o apretado. */
export const botonDe = (id, apretado = false) =>
  `${SHIPPED}/${id}/button${apretado ? "-pressed" : ""}.webp`;

/** Lámina fuente del botón. Casi todas son PNG; la isla 2 vino en JPG. */
export function laminaDe(id) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const p = `${SOURCES}/${id}/button-sheet.${ext}`;
    if (fs.existsSync(p)) return p;
  }
  return null;
}
