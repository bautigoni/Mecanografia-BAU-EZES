/* =====================================================================
   IMPORTAR EL ARTE DE UNA ISLA — cielo + isla, en dos capas
   ---------------------------------------------------------------------
   Toma las fuentes que deja el artista y produce los dos WebP que el
   juego carga, más el alta en assets.ts.

     Images/islands/islandN/island-source.png   la isla, CON transparencia
     Images/islands/islandN/sky-source.jpg      el cielo, sin plataformas
                    ->
     public/assets/islands/islandN/island.webp
     public/assets/islands/islandN/sky.webp
                    ->
     ISLAND_ART.islandN = { split: true }   en src/utils/assets.ts

   Uso:
     node scripts/import-island-art.mjs island7    una isla
     node scripts/import-island-art.mjs            todas las que tengan
                                                   fuentes sin importar

   Qué hace por vos, para que no tengas que cuidarlo al exportar:

   - RECORTA el margen transparente de la isla. No es cosmético: la caja
     del escenario toma la relación de aspecto de esta imagen, así que
     cada píxel transparente de más es pantalla que la isla ocupa sin
     usar. La isla 1 vino con 80px de aire por lado.
   - Avisa si la isla no trae canal alfa, que es el error más caro: una
     isla con fondo blanco opaco tapa el cielo entero y recién se nota
     al abrirla.
   - No agranda nada. Si la fuente es más chica que el tope se deja como
     está: estirar un PNG no inventa detalle.

   OJO: separar una isla le cambia el sistema de coordenadas. La caja del
   escenario pasa de tener la relación de aspecto de la escena entera a
   la de la isla recortada, así que TODAS las posiciones de esa isla en
   levelPositions.ts hay que volver a ubicarlas con ?editor=1. Por eso
   conviene separar el arte ANTES de acomodar los niveles.
===================================================================== */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { carpetaDe, fuentesDe } from "./island-paths.mjs";

/* Tope del lado más largo. Las escenas que ya estaban rondan los 1672px;
   1920 deja aire para una fuente mejor sin que un PNG de 4K infle el bundle. */
const TOPE = 1920;
const CALIDAD = 90;

const ISLAS = Array.from({ length: 15 }, (_, i) => "island" + (i + 1));

/** Primera fuente que exista con ese nombre base, en cualquier formato. */
function fuente(id, base) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const p = fuentesDe(id) + "/" + base + "." + ext;
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Caja de lo que realmente se ve, ignorando el borde transparente. */
async function cajaVisible(archivo) {
  const { data, info } = await sharp(archivo).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Redimensiona sólo hacia abajo, nunca hacia arriba. */
const achicar = (img, w, h) =>
  Math.max(w, h) > TOPE
    ? img.resize({ width: w >= h ? TOPE : null, height: h > w ? TOPE : null })
    : img;

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0) + "KB";

async function importarIsla(id) {
  const srcIsla = fuente(id, "island-source");
  const srcCielo = fuente(id, "sky-source");
  if (!srcIsla && !srcCielo) return null;

  const salida = carpetaDe(id);
  fs.mkdirSync(salida, { recursive: true });
  const notas = [];

  if (srcCielo) {
    const m = await sharp(srcCielo).metadata();
    await achicar(sharp(srcCielo).flatten({ background: "#ffffff" }), m.width, m.height)
      .webp({ quality: CALIDAD })
      .toFile(salida + "/sky.webp");
    const tam = m.width + "x" + m.height + (Math.max(m.width, m.height) > TOPE ? " -> tope " + TOPE : "");
    notas.push("cielo  " + path.basename(srcCielo) + "  " + tam + "  " + kb(salida + "/sky.webp"));
  }

  if (srcIsla) {
    const m = await sharp(srcIsla).metadata();
    if (!m.hasAlpha) {
      notas.push("ISLA SIN TRANSPARENCIA: " + path.basename(srcIsla) + " no trae canal alfa.");
      notas.push("  Va a tapar el cielo con un rectángulo. Reexportala como PNG con alfa.");
      return { id, notas, error: true };
    }
    const caja = await cajaVisible(srcIsla);
    if (!caja) return { id, notas: notas.concat("La isla está enteramente transparente."), error: true };

    const recortada = caja.width !== m.width || caja.height !== m.height;
    await achicar(sharp(srcIsla).extract(caja), caja.width, caja.height)
      .webp({ quality: CALIDAD })
      .toFile(salida + "/island.webp");

    const fin = await sharp(salida + "/island.webp").metadata();
    notas.push("isla   " + path.basename(srcIsla) + "  " + m.width + "x" + m.height +
      (recortada ? " -> recortada a " + caja.width + "x" + caja.height : " (ya venía justa)") +
      " -> " + fin.width + "x" + fin.height + "  " + kb(salida + "/island.webp"));
    notas.push("  relación de aspecto del escenario: " + (fin.width / fin.height).toFixed(3));
  }

  return { id, notas, separada: !!srcIsla };
}

/** Marca las islas como separadas en la tabla ISLAND_ART de assets.ts.
 *  Se hace por líneas y acotado al bloque de la tabla, para no pisar por
 *  accidente una entrada con el mismo id en otra tabla del archivo. */
function marcarSeparada(ids) {
  const p = "src/utils/assets.ts";
  const raw = fs.readFileSync(p, "utf8");
  const crlf = raw.includes("\r\n");
  const lineas = raw.replace(/\r\n/g, "\n").split("\n");

  const desde = lineas.findIndex((l) => l.startsWith("const ISLAND_ART"));
  if (desde < 0) return [];
  const hasta = lineas.indexOf("};", desde);

  const tocadas = [];
  for (const id of ids) {
    for (let i = desde; i < hasta; i++) {
      if (!lineas[i].trimStart().startsWith(id + ":")) continue;
      if (lineas[i].includes("{}")) {
        lineas[i] = lineas[i].replace("{}", "{ split: true }");
        tocadas.push(id);
      }
      break;
    }
  }
  if (tocadas.length) {
    const salida = lineas.join("\n");
    fs.writeFileSync(p, crlf ? salida.replace(/\n/g, "\r\n") : salida);
  }
  return tocadas;
}

const pedidas = process.argv.slice(2).filter((a) => /^island\d{1,2}$/.test(a));
const objetivo = pedidas.length ? pedidas : ISLAS;

const hechas = [];
let hubo = false;
for (const id of objetivo) {
  const r = await importarIsla(id);
  if (!r) {
    if (pedidas.length) console.log(id + ": no encontré island-source ni sky-source en " + fuentesDe(id) + "/");
    continue;
  }
  hubo = true;
  console.log("");
  console.log("-- " + id + " --");
  for (const n of r.notas) console.log("  " + n);
  if (r.separada && !r.error) hechas.push(id);
}

if (!hubo) {
  console.log("Nada que importar. Dejá island-source.png y sky-source.jpg en Images/islands/islandN/.");
} else if (hechas.length) {
  const tocadas = marcarSeparada(hechas);
  if (tocadas.length) console.log("assets.ts: " + tocadas.join(", ") + " marcadas como separadas (split: true).");
  console.log("");
  console.log("OJO: separar una isla le cambia la caja del escenario, así que sus");
  console.log("posiciones de nivel hay que volver a ubicarlas:");
  for (const id of hechas) console.log("  http://localhost:5210/worlds/" + id + "?editor=1");
}
