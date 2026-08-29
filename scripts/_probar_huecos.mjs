import sharp from "sharp";
import { colorDeFondo, keyBackground } from "./key-background.mjs";
const S = "C:/Users/Usuario/AppData/Local/Temp/claude/C--Users-Usuario-Typely/1c8d4582-4d50-459f-b607-a709ebe60e73/scratchpad";

const src = "Images/islands/island9/island-source-sin-alfa.png";
const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
const fondo = colorDeFondo(data, info.width, info.height, info.channels);
const bg = keyBackground(data, info.width, info.height, info.channels, fondo, true);

const salida = Buffer.alloc(info.width * info.height * 4);
for (let p = 0; p < info.width * info.height; p++) {
  salida[p * 4] = data[p * info.channels];
  salida[p * 4 + 1] = data[p * info.channels + 1];
  salida[p * 4 + 2] = data[p * info.channels + 2];
  salida[p * 4 + 3] = bg[p] ? 0 : 255;
}
await sharp(salida, { raw: { width: info.width, height: info.height, channels: 4 } })
  .flatten({ background: "#2255cc" }).png().toFile(S + "/i9-huecos-control.png");
await sharp(salida, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png().toFile("/tmp/i9-huecos-full.png");
console.log("listo, " + (100 * bg.reduce((a,v)=>a+v,0) / bg.length).toFixed(1) + "% transparente");
