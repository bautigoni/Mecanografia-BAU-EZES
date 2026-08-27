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
     (y se borra scene.webp, la escena combinada que servia hasta ahora)
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

/** Manchas de damero PINTADAS: pixeles opacos y grises neutros dibujados donde
 *  deberia haber transparencia. Pasa cuando el modelo dibuja como SE VE un
 *  fondo transparente en un editor, en vez de dejar el canal alfa vacio, y
 *  quedan cuadrados grises flotando sobre el cielo.
 *
 *  Lo que separa un damero de la piedra gris del propio dibujo no es el color
 *  -- las dos son grises neutros -- sino DONDE esta: el damero flota en la zona
 *  transparente, rodeado de nada, mientras que una roca esta metida adentro de
 *  la isla, rodeada de pixeles opacos. Por eso cada mancha se valida mirando su
 *  contorno. Sin este chequeo la isla 5 daba cinco falsos positivos, que eran
 *  sus bloques de piedra. */
async function dameroPintado(archivo) {
  const { data, info } = await sharp(archivo).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const alfa = (x, y) =>
    (x < 0 || y < 0 || x >= info.width || y >= info.height)
      ? 0
      : data[(y * info.width + x) * info.channels + 3];

  const pts = [];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (data[i + 3] < 200) continue;
      if (Math.abs(r - g) < 4 && Math.abs(g - b) < 4 && Math.abs(r - b) < 4 && r > 185 && r < 218) {
        pts.push([x, y]);
      }
    }
  }
  if (!pts.length) return null;

  const cajas = [];
  for (const [x, y] of pts) {
    const c = cajas.find((k) => x >= k.x0 - 25 && x <= k.x1 + 25 && y >= k.y0 - 25 && y <= k.y1 + 25);
    if (c) { c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y); }
    else cajas.push({ x0: x, x1: x, y0: y, y1: y });
  }

  /* Solo cuenta si es lo bastante grande para verse Y esta FLOTANDO. El umbral
     de contorno transparente es empirico, medido sobre las islas ya separadas:
     las manchas legitimas -- piedra y roca del propio dibujo -- llegan hasta un
     27 % (isla 2), mientras que el damero real de la isla 3 da 36 %. 32 % las
     separa. Si algun dia una isla nueva da un falso positivo cerca del limite,
     mirala antes de mover el numero. */
  const flotantes = cajas.filter((c) => {
    if ((c.x1 - c.x0) < 8 || (c.y1 - c.y0) < 8) return false;
    let vacio = 0, total = 0;
    const m = 3;
    for (let x = c.x0 - m; x <= c.x1 + m; x++) {
      for (const y of [c.y0 - m, c.y1 + m]) { total++; if (alfa(x, y) < 50) vacio++; }
    }
    for (let y = c.y0 - m; y <= c.y1 + m; y++) {
      for (const x of [c.x0 - m, c.x1 + m]) { total++; if (alfa(x, y) < 50) vacio++; }
    }
    return total > 0 && vacio / total > 0.32;
  });

  return flotantes.length ? { manchas: flotantes.length, mayor: flotantes[0] } : null;
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
  const yaSeparada = fs.existsSync(salida + "/island.webp");

  /* Media isla no sirve. Si todavia no esta separada y falta una de las dos
     fuentes, no se escribe nada: dejar sky.webp al lado de scene.webp deja la
     carpeta con dos fondos y sin forma de saber cual manda. Una isla que YA
     esta separada si admite reemplazar una capa sola. */
  if (!yaSeparada && !(srcIsla && srcCielo)) {
    notas.push("falta la otra mitad: hay " + (srcIsla ? "island-source" : "sky-source") +
      " pero no " + (srcIsla ? "sky-source" : "island-source") + ".");
    notas.push("  No escribo nada hasta tener las dos, para no dejar la carpeta a medias.");
    return { id, notas, error: true };
  }

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

    /* La Chromebook objetivo es 1366x768 y el escenario entra CONTENIDO, asi
       que la isla se escala hasta llenar el alto. Si para eso hay que
       agrandarla, se va a ver blanda y no hay nada que el codigo pueda hacer:
       el detalle no esta en el archivo. */
    const amp = Math.min(1366 / fin.width, 768 / fin.height);
    if (amp > 1.02) {
      notas.push("  RESOLUCION BAJA: en una Chromebook 1366x768 hay que agrandarla x" +
        amp.toFixed(2) + ", asi que se va a ver borrosa.");
      notas.push("  Para que no pase, la isla recortada tiene que dar al menos " +
        Math.ceil(fin.width * amp) + "x" + Math.ceil(fin.height * amp) + " px.");
    }

    const dam = await dameroPintado(salida + "/island.webp");
    if (dam) {
      notas.push("  DAMERO PINTADO: " + dam.manchas + " mancha(s) de tablero de transparencia");
      notas.push("  dibujadas como pixeles opacos, la mayor de " +
        (dam.mayor.x1 - dam.mayor.x0 + 1) + "x" + (dam.mayor.y1 - dam.mayor.y0 + 1) +
        " px en (" + dam.mayor.x0 + "," + dam.mayor.y0 + ").");
      notas.push("  Van a verse como cuadrados grises flotando sobre el cielo.");
    }
  }

  /* Al quedar separada, la escena combinada ya no la carga nadie: se va, para
     que la carpeta no tenga dos fondos y no haya que adivinar cual manda. */
  if (srcIsla && srcCielo && fs.existsSync(salida + "/scene.webp")) {
    fs.rmSync(salida + "/scene.webp");
    notas.push("scene.webp borrado: la isla ya tiene sus dos capas");
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
