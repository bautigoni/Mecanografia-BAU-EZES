import sharp from "sharp";
import { colorDeFondo, keyBackground, alphaConBordeSuave } from "./key-background.mjs";

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
   huecos: área mínima, en px de la lámina, del fondo atrapado adentro de un
           lazo cerrado que hay que rellenar. Apagado por defecto: en un arte
           con grandes zonas del color del fondo (la nieve de la 8, el núcleo
           blanco del resplandor de la 1) se las come. Antes de prenderlo en
           una isla nueva hay que MIRAR qué se rellenaría — lo encerrado y
           casi blanco es tan seguido dibujo como hueco. */
const SHEETS = {
  /* SIN huecos a propósito: lo que queda encerrado entre la piedra y el aro
     de resplandor es el núcleo brillante del resplandor mismo (cian casi
     blanco, 236,255,255), no fondo. Rellenarlo le abre un agujero al halo. */
  island1:  { file: "btn-island1.png",  crop: [100, 120, 638, 396], gap: 806, base: { cx: 340, cy: 246, w: 549 } },
  island2:  { file: "btn-island2.jpg",  crop: [56, 139, 717, 387], gap: 810, base: { cx: 365, cy: 194, w: 549 } },
  /* La 3 trae un libro apoyado a la derecha que se sale de la huella: no
     cuenta como base, pero sí obliga a dejarle lugar en el lienzo. */
  island3:  { file: "btn-island3.png",  crop: [54,  87, 750, 479], gap: 811, base: { cx: 367, cy: 225, w: 570 }, halo: { entrada: 85, umbral: 150 } },
  /* huecos: las raicillas que cuelgan del musgo cierran lazos chicos contra
     la base y dejaban el fondo adentro. */
  island4:  { file: "btn-island4.png",  crop: [63, 140, 706, 456], gap: 800, base: { cx: 353, cy: 219, w: 530 }, huecos: 40 },
  /* halo: la neblina de suelo abajo del pasto es un degradé pintado que
     llega hasta el blanco; con alfa binario quedaba una franja crema opaca
     de borde duro alrededor de todo el botón. La entrada baja deja afuera
     la piedra del canto, que contra el fondo ya arranca en 170. */
  island5:  { file: "btn-island5.png",  crop: [57, 115, 735, 439], gap: 807, base: { cx: 371, cy: 198, w: 522 }, halo: { entrada: 85, umbral: 150 } },
  island6:  { file: "btn-island6.png",  crop: [96,  84, 642, 443], gap: 808, base: { cx: 321, cy: 257, w: 514 } },
  /* huecos: las ramas de cerezo dan la vuelta al canto y cierran doce lazos
     contra la piedra; adentro quedaba el fondo opaco, que es el bug que se
     veía como manchas blancas entre las ramitas. Los huecos van de 51 a
     566 px, muy por debajo de los 900 del umbral histórico. */
  island7:  { file: "btn-island7.png",  crop: [75, 138, 691, 407], gap: 811, base: { cx: 352, cy: 195, w: 497 }, huecos: 40 },
  /* La 8 trae nieve blanca alrededor: contra el fondo blanco de la lámina no
     se distingue, así que el recorte se come la parte más pálida del manto.
     Queda la nieve con sombra azulada, que es la que se ve.
     SIN huecos a propósito, por lo mismo: lo encerrado y casi blanco de esta
     lámina es el manto de nieve y los ventisqueros del engranaje — es el
     caso que documenta por qué esto no se puede prender para todas. */
  island8:  { file: "btn-island8.png",  crop: [26,  80, 766, 555], gap: 794, base: { cx: 383, cy: 278, w: 560 } },
  island9:  { file: "btn-island9.png",  crop: [25, 130, 780, 476], gap: 816, base: { cx: 398, cy: 262, w: 452 }, halo: { entrada: 85, umbral: 150 } },
  /* huecos: las lianas cuelgan cerrando varios lazos, y el fondo que queda
     atrapado adentro hay que rellenarlo aparte. Con el umbral viejo de 900
     se rellenaban los dos lazos grandes y quedaban sin tocar cinco chicos
     (69 a 541 px) sobre la misma liana. */
  island10: { file: "btn-island10.png", crop: [37,  77, 750, 537], gap: 801, base: { cx: 384, cy: 279, w: 480 }, huecos: 40 },
  /* La 12 es la más asimétrica: la roca está corrida a la izquierda y la arena
     se derrama a la derecha. El centro sale del disco, no de la silueta. */
  /* SIN halo a propósito: acá el crema pálido de alrededor no es neblina
     sino la arena, que es dibujo y arranca pegada al color del fondo. Con
     el desvanecido prendido la arena se volvía translúcida — el mismo caso
     que la nieve de la 8. */
  island12: { file: "btn-island12.png", crop: [85, 137, 750, 400], gap: 801, base: { cx: 338, cy: 220, w: 522 } },
  island13: { file: "btn-island13.png", crop: [59,  96, 728, 462], gap: 807, base: { cx: 364, cy: 240, w: 553 } },
  /* huecos: las argollas de cobre y el resorte del costado son lazos cerrados
     de metal, y el fondo les quedaba adentro. */
  island14: { file: "btn-island14.png", crop: [69, 102, 706, 460], gap: 801, base: { cx: 350, cy: 253, w: 558 }, huecos: 40 },
  island15: { file: "btn-island15.png", crop: [105, 79, 639, 479], gap: 814, base: { cx: 316, cy: 240, w: 601 }, halo: { entrada: 85, umbral: 150 } },
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
    const bg = keyBackground(data, W, H, C, fondo, s.huecos ?? false);
    /* `halo` ablanda el borde donde el dibujo se desvanece contra el fondo;
       sin él, el alfa es binario y ese degradé queda cortado en seco. */
    const alpha = s.halo ? alphaConBordeSuave(data, W, H, C, fondo, bg, s.halo) : null;

    const rgba = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      rgba[i * 4] = data[i * C];
      rgba[i * 4 + 1] = data[i * C + 1];
      rgba[i * 4 + 2] = data[i * C + 2];
      rgba[i * 4 + 3] = alpha ? alpha[i] : bg[i] ? 0 : 255;
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
