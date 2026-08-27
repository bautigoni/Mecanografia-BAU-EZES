import sharp from "sharp";

/* =====================================================================
   Importa una lámina de botón de nivel (los dos estados lado a lado sobre
   fondo liso, como la devuelve nanobanana) y saca los dos WebP que consume
   el juego, encuadrados igual que el botón de piedra.

   Uso:  node scripts/import-level-button.mjs island6
         node scripts/import-level-button.mjs            (todas)

   POR QUÉ NO SE MIDE SOLO. La base de piedra no se puede detectar por
   silueta ni por color: cada isla saca la decoración fuera de la huella
   (pasto, cristales, flores, merengues) y la pinta del mismo material que
   la base. Así que la base va medida a ojo sobre una grilla de %, y esos
   números viven en la tabla de abajo. Para dar de alta una isla nueva:
   correr scripts/measure-button-sheet.mjs para los recortes, mirar la
   imagen con grilla y anotar dónde está la base.
===================================================================== */

/* Encuadre que espera el juego, heredado de btn-default.png. */
const CANVAS = { w: 600, h: 445, baseX: 299.5, baseY: 214 };

/* crop  : recorte del estado libre dentro de la lámina [x, y, ancho, alto]
   gap   : cuánto hay que correrse a la derecha para el estado apretado
   base  : la base de piedra DENTRO del recorte — cx, cy (su ecuador) y ancho
   huecos: rellenar el fondo atrapado adentro de lazos cerrados. Apagado por
           defecto: en un arte con grandes zonas del color del fondo (la nieve
           de la 8) se las come. */
const SHEETS = {
  island1:  { file: "btn-island1.png",  crop: [100, 120, 638, 396], gap: 806, base: { cx: 340, cy: 246, w: 549 } },
  island2:  { file: "btn-island2.jpg",  crop: [56, 139, 717, 387], gap: 810, base: { cx: 365, cy: 194, w: 549 } },
  /* La 3 trae un libro apoyado a la derecha que se sale de la huella: no
     cuenta como base, pero sí obliga a dejarle lugar en el lienzo. */
  island3:  { file: "btn-island3.png",  crop: [54,  87, 750, 479], gap: 811, base: { cx: 367, cy: 225, w: 570 } },
  island4:  { file: "btn-island4.png",  crop: [63, 140, 706, 456], gap: 800, base: { cx: 353, cy: 219, w: 530 } },
  island5:  { file: "btn-island5.png",  crop: [57, 115, 735, 439], gap: 807, base: { cx: 371, cy: 198, w: 522 } },
  island6:  { file: "btn-island6.png",  crop: [96,  84, 642, 443], gap: 808, base: { cx: 321, cy: 257, w: 514 } },
  island7:  { file: "btn-island7.png",  crop: [75, 138, 691, 407], gap: 811, base: { cx: 352, cy: 195, w: 497 } },
  /* La 8 trae nieve blanca alrededor: contra el fondo blanco de la lámina no
     se distingue, así que el recorte se come la parte más pálida del manto.
     Queda la nieve con sombra azulada, que es la que se ve. */
  island8:  { file: "btn-island8.png",  crop: [26,  80, 766, 555], gap: 794, base: { cx: 383, cy: 278, w: 560 } },
  island9:  { file: "btn-island9.png",  crop: [25, 130, 780, 476], gap: 816, base: { cx: 398, cy: 262, w: 452 } },
  /* huecos: las lianas cuelgan cerrando dos lazos, y el fondo que queda
     atrapado adentro hay que rellenarlo aparte. */
  island10: { file: "btn-island10.png", crop: [37,  77, 750, 537], gap: 801, base: { cx: 384, cy: 279, w: 480 }, huecos: true },
  /* La 12 es la más asimétrica: la roca está corrida a la izquierda y la arena
     se derrama a la derecha. El centro sale del disco, no de la silueta. */
  island12: { file: "btn-island12.png", crop: [85, 137, 750, 400], gap: 801, base: { cx: 338, cy: 220, w: 522 } },
  island13: { file: "btn-island13.png", crop: [59,  96, 728, 462], gap: 807, base: { cx: 364, cy: 240, w: 553 } },
  island14: { file: "btn-island14.png", crop: [69, 102, 706, 460], gap: 801, base: { cx: 350, cy: 253, w: 558 } },
  island15: { file: "btn-island15.png", crop: [105, 79, 639, 479], gap: 814, base: { cx: 316, cy: 240, w: 601 } },
  island11: { file: "btn-island11.png", crop: [41, 231, 462, 336], gap: 492, base: { cx: 232, cy: 190, w: 433 } },
};

import { carpetaDe, laminaDe } from "./island-paths.mjs";
const MARGIN = 0.98;      // deja un pelo de aire contra el borde del lienzo

/** Fondo -> alfa, por inundación desde el borde.
 *
 *  El color del fondo se MIDE, no se asume blanco: la lámina de la isla 8
 *  vino con un gris azulado (240,244,247) y un umbral fijo de "casi blanco"
 *  no keyeaba nada, así que quedaba el rectángulo entero.
 *
 *  Tampoco se keyea por umbral global, sino por inundación: el hielo, los
 *  merengues y los pétalos tienen brillos de blanco puro y un umbral plano
 *  les haría agujeros en el medio. Creciendo desde el borde eso no pasa.
 *
 *  Dos pasadas. La primera es estricta y se lleva el fondo liso. La segunda
 *  sigue creciendo SÓLO desde lo que ya es fondo y admite además lo claro y
 *  sin color: la sombra suave que varias láminas traen debajo del botón, que
 *  no es exactamente el color del fondo y si no queda como un halo.
 */
function colorDeFondo(data, W, H, C) {
  /* Mediana del borde y no promedio: si el dibujo toca el borde, el promedio
     se corre — y el promedio de dos colores no es ninguno de los dos. */
  const muestras = [[], [], []];
  const anotar = (x, y) => {
    const i = (y * W + x) * C;
    for (let k = 0; k < 3; k++) muestras[k].push(data[i + k]);
  };
  for (let x = 0; x < W; x += 2) { anotar(x, 0); anotar(x, H - 1); }
  for (let y = 0; y < H; y += 2) { anotar(0, y); anotar(W - 1, y); }
  return muestras.map((m) => m.sort((a, b) => a - b)[m.length >> 1]);
}

function keyBackground(data, W, H, C, fondo, rellenarHuecos) {
  const dist = (p) =>
    Math.abs(data[p] - fondo[0]) + Math.abs(data[p + 1] - fondo[1]) + Math.abs(data[p + 2] - fondo[2]);
  const duro = (p) => dist(p) < 26;
  const blando = (p) => {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    return dist(p) < 58 && Math.max(r, g, b) - Math.min(r, g, b) < 22;
  };

  const bg = new Uint8Array(W * H);
  const stack = [];
  const correr = (test) => {
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (bg[i] || !test(i * C)) continue;
      bg[i] = 1;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
  };
  for (let x = 0; x < W; x++) stack.push(x, 0, x, H - 1);
  for (let y = 0; y < H; y++) stack.push(0, y, W - 1, y);
  correr(duro);
  /* Semillas de la segunda pasada: los vecinos de lo que ya es fondo. */
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bg[y * W + x]) stack.push(x, y);
  for (let k = 0; k < stack.length; k += 2) bg[stack[k + 1] * W + stack[k]] = 0;
  correr(blando);

  /* Huecos encerrados — SÓLO si la lámina lo pide (ver `huecos` en SHEETS).
     La inundación entra únicamente desde el borde, así que el fondo atrapado
     adentro de un lazo cerrado nunca se alcanza: las lianas de la isla 10
     cuelgan formando dos gotas y quedaban como manchas en medio del dibujo.

     Va apagado por defecto porque no se puede distinguir un hueco de una
     zona clara legítima cuando el arte tiene grandes superficies del color
     del fondo. En la isla 8, con su manto de nieve casi blanco sobre fondo
     casi blanco, esto le comía pedazos a la nieve. El tamaño mínimo alcanza
     para no tocar brillos especulares, pero no para separar nieve de hueco. */
  const MIN_HUECO = 900;
  if (!rellenarHuecos) return bg;
  const visto = new Uint8Array(W * H);
  for (let y0 = 0; y0 < H; y0++) {
    for (let x0 = 0; x0 < W; x0++) {
      const raiz = y0 * W + x0;
      if (visto[raiz] || bg[raiz] || !duro(raiz * C)) continue;
      const comp = [];
      const pila = [x0, y0];
      visto[raiz] = 1;
      while (pila.length) {
        const y = pila.pop(), x = pila.pop();
        comp.push(y * W + x);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (visto[j] || bg[j] || !duro(j * C)) continue;
          visto[j] = 1;
          pila.push(nx, ny);
        }
      }
      if (comp.length >= MIN_HUECO) for (const j of comp) bg[j] = 1;
    }
  }
  return bg;
}

async function importOne(id) {
  const s = SHEETS[id];
  if (!s) throw new Error(`no tengo medidas para ${id}`);
  const [cx0, cy0, cw, ch] = s.crop;

  /* Escala máxima que entra en el lienzo con el centro de la base clavado
     en (baseX, baseY). Las cuatro cotas son los cuatro bordes: la que manda
     es la más chica. La de arriba suele ser la crítica — la decoración que
     sube (cristales, pasto) es la que primero se sale. */
  const lim = Math.min(
    CANVAS.baseX / s.base.cx,
    (CANVAS.w - CANVAS.baseX) / (cw - s.base.cx),
    CANVAS.baseY / s.base.cy,
    (CANVAS.h - CANVAS.baseY) / (ch - s.base.cy),
  ) * MARGIN;
  /* Nunca agrandar más de lo que haría falta para igualar la base del botón
     de piedra: pasado ese punto sólo se pierde nitidez. */
  const scale = Math.min(lim, 454 / s.base.w);

  const nw = Math.round(cw * scale), nh = Math.round(ch * scale);
  const left = Math.round(CANVAS.baseX - s.base.cx * scale);
  const top = Math.round(CANVAS.baseY - s.base.cy * scale);

  /* El color del fondo se mide sobre la LÁMINA ENTERA: los recortes van
     pegados al dibujo, así que su propio borde ya es arte. */
  const hoja = await sharp(laminaDe(id)).flatten({ background: "#ffffff" })
    .raw().toBuffer({ resolveWithObject: true });
  const fondo = colorDeFondo(hoja.data, hoja.info.width, hoja.info.height, hoja.info.channels);

  for (const [k, suffix] of [[0, ""], [1, "-pressed"]]) {
    const { data, info } = await sharp(laminaDe(id))
      .flatten({ background: "#ffffff" })
      .extract({ left: cx0 + k * s.gap, top: cy0, width: cw, height: ch })
      .raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: C } = info;
    const bg = keyBackground(data, W, H, C, fondo, s.huecos === true);

    const rgba = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      rgba[i * 4] = data[i * C];
      rgba[i * 4 + 1] = data[i * C + 1];
      rgba[i * 4 + 2] = data[i * C + 2];
      rgba[i * 4 + 3] = bg[i] ? 0 : 255;
    }

    await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
      .resize(nw, nh, { kernel: "lanczos3" })
      .extend({
        top, left,
        bottom: CANVAS.h - nh - top,
        right: CANVAS.w - nw - left,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 92, alphaQuality: 100 })
      .toFile(`${carpetaDe(id)}/button${suffix}.webp`);
  }
  console.log(
    `${id.padEnd(9)} escala ${scale.toFixed(3)}  base ${Math.round(s.base.w * scale)} px ` +
    `(referencia 454)  dibujo ${nw}x${nh} en ${left},${top}`
  );
}

/* OJO: island11 lleva DESPUÉS un pase de scripts/lighten-disc.mjs (+18 %).
   Si se reimporta, hay que volver a correrlo o el disco vuelve al oscuro. */
const arg = process.argv[2];
for (const id of arg ? [arg] : Object.keys(SHEETS)) await importOne(id);
