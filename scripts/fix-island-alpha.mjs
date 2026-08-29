/* =====================================================================
   REPARAR UNA FUENTE SIN CANAL ALFA
   ---------------------------------------------------------------------
   Cuando island-source.png llega SIN transparencia real (fondo blanco o
   gris parejo en vez de alfa), import-island-art.mjs se niega a usarlo —
   una isla opaca tapa el cielo entero. Este script intenta arreglarlo con
   la misma inundación por color de borde que ya usa import-level-button.mjs,
   en vez de pedir que se regenere la lámina de cero.

   Uso:
     node scripts/fix-island-alpha.mjs island9

   Sólo funciona si el fondo real es liso (blanco, gris, un color parejo).
   Si el "fondo" es en realidad el cuadriculado de transparencia PINTADO
   como píxeles duros (alternando dos grises), esto no lo separa bien —
   para eso hace falta reexportar con alfa de verdad. Mirá el resultado
   antes de creer que quedó bien: guarda una copia de control sobre un
   fondo AZUL para que un halo blanco se note.
===================================================================== */
import fs from "node:fs";
import sharp from "sharp";
import { fuentesDe } from "./island-paths.mjs";
import { colorDeFondo, keyBackground } from "./key-background.mjs";

const id = process.argv[2];
const huecos = process.argv.includes("--huecos");
if (!id || !/^island\d{1,2}$/.test(id)) {
  console.log("Uso: node scripts/fix-island-alpha.mjs islandN [--huecos]");
  console.log("  --huecos  además rellena fondo ENCERRADO adentro de un hueco");
  console.log("            (p.ej. detrás de una tela). Mirar el resultado con");
  console.log("            cuidado si el arte tiene superficies claras grandes");
  console.log("            de verdad (nieve, papel): con --huecos se las come.");
  process.exit(1);
}

const dir = fuentesDe(id);
const src = `${dir}/island-source.png`;
if (!fs.existsSync(src)) throw new Error(`no existe ${src}`);

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.channels === 4) {
  const yaTransparente = (() => {
    for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
    return false;
  })();
  if (yaTransparente) {
    console.log(id + ": island-source.png YA tiene alfa real, no hay nada que reparar.");
    process.exit(0);
  }
}

const fondo = colorDeFondo(data, info.width, info.height, info.channels);
console.log(id + ": color de fondo medido rgb(" + fondo.join(",") + ")");

const bg = keyBackground(data, info.width, info.height, info.channels, fondo, huecos);
const salida = Buffer.alloc(info.width * info.height * 4);
for (let p = 0; p < info.width * info.height; p++) {
  salida[p * 4] = data[p * info.channels];
  salida[p * 4 + 1] = data[p * info.channels + 1];
  salida[p * 4 + 2] = data[p * info.channels + 2];
  salida[p * 4 + 3] = bg[p] ? 0 : 255;
}

const original = `${dir}/island-source-sin-alfa.png`;
if (!fs.existsSync(original)) fs.copyFileSync(src, original);

await sharp(salida, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png().toFile(src);

/* Copia de control sobre azul: si queda un halo del fondo viejo alrededor
   del dibujo, sobre blanco no se nota — sobre azul salta a la vista. */
const S = process.env.TMPDIR || process.env.TEMP || ".";
const control = `${dir}/_control-sobre-azul.png`;
const azul = await sharp({ create: { width: info.width, height: info.height, channels: 3, background: "#2255cc" } }).png().toBuffer();
await sharp(azul).composite([{ input: src }]).png().toFile(control);

const bgFrac = bg.reduce((a, v) => a + v, 0) / bg.length;
console.log(id + ": alfa reconstruido -- " + (100 * bgFrac).toFixed(1) + "% del lienzo quedo transparente.");
console.log("  original sin tocar en: " + original);
console.log("  control sobre azul en: " + control + " -- mirala antes de importar.");
