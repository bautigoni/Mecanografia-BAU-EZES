import sharp from "sharp";
const S = "C:/Users/Usuario/AppData/Local/Temp/claude/C--Users-Usuario-Typely/1c8d4582-4d50-459f-b607-a709ebe60e73/scratchpad";
const f = "Images/islands/island3/island-source.png";
const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i+1], data[i+2], data[i+3]]; };
/* Busco pixeles OPACOS y grises (r=g=b) de valor claro: eso es el damero pintado. */
let grises = 0, total = 0;
const zonas = [];
for (let y = 0; y < info.height; y += 2) {
  for (let x = 0; x < info.width; x += 2) {
    const [r, g, b, a] = px(x, y);
    if (a < 200) continue;
    total++;
    const gris = Math.abs(r - g) < 4 && Math.abs(g - b) < 4 && Math.abs(r - b) < 4;
    if (gris && ((r > 190 && r < 215) || r > 248)) { grises++; if (zonas.length < 6) zonas.push([x, y, r]); }
  }
}
console.log("archivo " + info.width + "x" + info.height + "  alpha=" + (info.channels === 4));
console.log("pixeles opacos grises de damero: " + grises + " de " + total + " (" + (100 * grises / total).toFixed(2) + "%)");
console.log("muestras:", zonas.map((z) => "(" + z[0] + "," + z[1] + ") gris " + z[2]).join("  "));
await sharp(f).extract({ left: 380, top: 480, width: 200, height: 120 }).resize({ width: 600, kernel: "nearest" }).png().toFile(S + "/i3-zoom.png");
