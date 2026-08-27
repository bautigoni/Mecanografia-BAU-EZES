import sharp from "sharp";
/* Dibuja una grilla de % sobre el recorte de un botón, para leer a ojo dónde
   está la base — que es lo único que no se puede detectar solo. */
const [file, L, T, W0, H0] = [process.argv[2], ...process.argv.slice(3, 7).map(Number)];
const out = process.argv[7] ?? ".tmp-btn/grid.png";
let img = sharp(file).flatten({ background: "#ffffff" });
if (Number.isFinite(L)) img = img.extract({ left: L, top: T, width: W0, height: H0 });
const buf = await img.resize({ width: 800 }).png().toBuffer();
const { width: W, height: H } = await sharp(buf).metadata();
let g = "";
for (let p = 5; p < 100; p += 5) {
  const x = (W * p) / 100, y = (H * p) / 100;
  const M = p % 25 === 0;
  g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${M ? "#e0004a" : "#00a0ff"}" stroke-width="${M ? 1.6 : 0.7}" opacity="0.75"/>`;
  g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${M ? "#e0004a" : "#00a0ff"}" stroke-width="${M ? 1.6 : 0.7}" opacity="0.75"/>`;
  if (p % 10 === 0) g += `<text x="${x + 2}" y="12" font-family="Arial" font-size="12" fill="#e0004a">${p}</text><text x="2" y="${y - 2}" font-family="Arial" font-size="12" fill="#e0004a">${p}</text>`;
}
await sharp(buf).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}">${g}</svg>`) }]).png().toFile(out);
console.log(out, W, H);
