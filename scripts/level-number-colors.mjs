import sharp from "sharp";

/* Color del número para un nivel COMPLETADO, uno por isla.
   ---------------------------------------------------------------------
   Sin completar el número va blanco, que es lo que más contrasta. Completado
   tiene que verse distinto de un vistazo, y para eso necesita color propio —
   pero un color que pegue con el botón de esa isla, no un verde de sistema
   igual para las quince.

   La regla: se mide el color que el número tiene DETRÁS (no el disco entero:
   justo la franja donde se dibuja), y se busca su COMPLEMENTARIO PARTIDO —
   el tono opuesto, traído un 25 % de vuelta hacia el original. Es la relación
   que en teoría del color contrasta sin pelearse: el opuesto puro chilla, el
   análogo no se despega. Después se le ajusta la luminosidad hasta pasar
   4.5:1 contra ese fondo, yendo hacia el lado que tenga lugar: si el disco es
   oscuro el número se aclara, y si es claro se oscurece.
*/

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}
function hue2rgb(p, q, t) {
  if (t < 0) t += 1; if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hsl2rgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)].map((v) => Math.round(v * 255));
}
const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/* Franja donde el juego dibuja el número, en el lienzo 600x445. */
const CAJA = { x0: 255, x1: 345, y0: 165, y1: 265 };

async function fondoDelNumero(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W } = info, C = 4;
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = CAJA.y0; y <= CAJA.y1; y++) {
    for (let x = CAJA.x0; x <= CAJA.x1; x++) {
      const i = (y * W + x) * C;
      if (data[i + 3] < 200) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  return [r / n, g / n, b / n].map(Math.round);
}

/* Paleta de premio. Son tonos que se mantienen VIVOS cuando están claros —
   dorado, lima, menta, turquesa, cielo, rosa, lila. Ese es el punto: para
   contrastar contra un disco medio u oscuro el número tiene que ser claro, y
   en la mayoría de los tonos "claro" significa lavado. Estos no.

   Varios salen de la paleta de marca (§5): menta #5be8ba, turquesa #54e8c6,
   rosa #ff9fca, dorado #facc15. */
const PREMIO = [
  { nombre: "dorado",    rgb: [250, 204, 21] },
  { nombre: "ambar",     rgb: [255, 159, 67] },
  { nombre: "lima",      rgb: [183, 240, 0] },
  { nombre: "menta",     rgb: [91, 232, 186] },
  { nombre: "turquesa",  rgb: [84, 232, 198] },
  { nombre: "cielo",     rgb: [127, 215, 255] },
  { nombre: "rosa",      rgb: [255, 159, 202] },
  { nombre: "lila",      rgb: [196, 166, 255] },
  /* Tintes claros. Se usan sólo cuando ningún vivo llega al piso: un disco de
     luminosidad media no contrasta con nada saturado, y hay que irse más
     claro. Siguen teniendo tono, así que al lado de un número blanco de un
     nivel sin completar se distinguen. */
  { nombre: "oro palido",  rgb: [255, 230, 128], tinte: true },
  { nombre: "menta clara", rgb: [184, 255, 227], tinte: true },
  { nombre: "cielo claro", rgb: [199, 238, 255], tinte: true },
  { nombre: "rosa claro",  rgb: [255, 209, 230], tinte: true },
  /* Para los discos CLAROS hace falta ir al otro lado: oscuro pero saturado,
     no gris. */
  { nombre: "vino",      rgb: [122, 20, 58], oscuro: true },
  { nombre: "indigo",    rgb: [45, 42, 130], oscuro: true },
  { nombre: "bosque",    rgb: [16, 78, 52], oscuro: true },
  { nombre: "teja",      rgb: [150, 52, 18], oscuro: true },
];

/** Distancia entre tonos por la vuelta corta de la rueda, en vueltas (0..0.5). */
const dTono = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); };

/* Piso de contraste. 3.5:1 y no 4.5: el número es enorme y en negrita, el
   mínimo exigible para texto grande es 3:1, y además lleva sombra oscura
   debajo. Con 4.5 sólo sobrevivían los dos o tres tonos más claros de la
   paleta y las quince islas terminaban con el mismo color, que es justo lo
   que no se quiere. */
const PISO = 3.5;

function colorCompletado(fondo) {
  const [h] = rgb2hsl(...fondo);
  /* Complementario partido: el opuesto traído un 25 % de vuelta. Es la
     relación que contrasta sin pelearse — el opuesto puro chilla y el
     análogo no se despega. */
  const objetivo = (h + 0.5 - 0.5 * 0.25 + 1) % 1;

  const puntuados = PREMIO.map((c) => {
    const [hc] = rgb2hsl(...c.rgb);
    return { ...c, k: contraste(c.rgb, fondo), armonia: dTono(hc, objetivo) };
  });
  const porArmonia = (a, b) => a.armonia - b.armonia;

  /* Tres escalones, en orden de preferencia. Dentro de cada uno gana el tono
     más cercano al complementario partido.
       1. Vivo: es el que mejor se ve como premio.
       2. Tinte claro: cuando el disco es de luminosidad media y no contrasta
          con nada saturado.
       3. Oscuro: último recurso, sólo si el disco es tan claro que no hay
          nada más claro todavía. Un número oscuro tiende a leerse como
          deshabilitado, que es lo contrario de lo que se quiere decir. */
  for (const tier of [
    (c) => !c.tinte && !c.oscuro,
    (c) => c.tinte,
    (c) => c.oscuro,
  ]) {
    const pasan = puntuados.filter((c) => tier(c) && c.k >= PISO);
    if (pasan.length) return pasan.sort(porArmonia)[0];
  }
  return puntuados.sort((a, b) => b.k - a.k)[0];
}

const filas = [];
for (let n = 1; n <= 15; n++) {
  const id = `island${n}`;
  const fondo = await fondoDelNumero(`public/assets/level-buttons/btn-${id}.webp`);
  const elegido = colorCompletado(fondo);
  filas.push({ id, fondo, color: hex(elegido.rgb), nombre: elegido.nombre, k: elegido.k, blanco: contraste([255, 255, 255], fondo) });
}

console.log("isla        fondo del numero    blanco    completado            contraste");
for (const f of filas) {
  console.log(
    `${f.id.padEnd(10)} rgb(${f.fondo.join(",").padEnd(11)})  ${f.blanco.toFixed(2)}:1   ${f.color} ${f.nombre.padEnd(9)}  ${f.k.toFixed(2)}:1`
  );
}
console.log("\n// para pegar en assets.ts");
for (const f of filas) console.log(`  ${(f.id + ":").padEnd(10)} "${f.color}",   // ${f.nombre} — ${f.k.toFixed(2)}:1`);
