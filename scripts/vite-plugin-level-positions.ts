import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/* =====================================================================
   PLUGIN DE DESARROLLO — guardar posiciones de nivel
   ---------------------------------------------------------------------
   Expone POST /__typely/level-positions SOLO en el servidor de desarrollo
   (`apply: "serve"`), para que el editor visual escriba directo en
   src/data/levelPositions.ts en vez de hacerte copiar y pegar.

   Nunca llega a producción: `vite build` no ejecuta este plugin, así que el
   endpoint no existe en el bundle ni en el Nginx del contenedor.

   Cuerpo esperado:
     { "worldId": "island2",
       "positions": [ { "x": 49.7, "y": 75, "scale": 1.45, … }, … ] }

   Lo que respeta al reescribir:
     · el bloque de comentario que abre el arreglo (ahí vive la explicación
       del método de medición — se pierde si se sobrescribe a lo bruto);
     · el comentario al final de cada línea (`// N3 — disco medio-izquierda`),
       reasignado por índice cuando la cantidad de nodos no cambió.
===================================================================== */

const FILE = "src/data/levelPositions.ts";
const ENDPOINT = "/__typely/level-positions";

type Node = {
  x: number; y: number;
  scale?: number; rotateX?: number; rotateY?: number; rotateZ?: number; perspective?: number;
  /* Corrimiento y tamaño del número sobre el botón; ver LevelPosition. */
  numX?: number; numY?: number; numSize?: number;
  /* Posición del número con el botón apretado. */
  numXHover?: number; numYHover?: number;
};

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Redondeo a 1 decimal: más precisión que eso es ruido — un 0.01 % de una
 *  imagen de 1672px es 0.17px, por debajo de lo que se puede ver o colocar. */
const r1 = (v: number) => Math.round(v * 10) / 10;

function formatNode(n: Node, trailing: string): string {
  const parts = [`x: ${r1(n.x)}`, `y: ${r1(n.y)}`];
  /* Sólo se escriben las propiedades que se apartan del default, para que el
     archivo siga leyéndose como datos y no como un volcado de máquina. */
  if (isFiniteNum(n.scale) && n.scale !== 1) parts.push(`scale: ${Math.round(n.scale * 100) / 100}`);
  if (isFiniteNum(n.rotateX) && n.rotateX !== 0) parts.push(`rotateX: ${r1(n.rotateX)}`);
  if (isFiniteNum(n.rotateY) && n.rotateY !== 0) parts.push(`rotateY: ${r1(n.rotateY)}`);
  if (isFiniteNum(n.rotateZ) && n.rotateZ !== 0) parts.push(`rotateZ: ${r1(n.rotateZ)}`);
  if (isFiniteNum(n.perspective)) parts.push(`perspective: ${Math.round(n.perspective)}`);
  if (isFiniteNum(n.numX) && n.numX !== 0) parts.push(`numX: ${r1(n.numX)}`);
  if (isFiniteNum(n.numY) && n.numY !== 0) parts.push(`numY: ${r1(n.numY)}`);
  if (isFiniteNum(n.numSize) && n.numSize !== 1) parts.push(`numSize: ${Math.round(n.numSize * 100) / 100}`);
  /* El par del apretado se escribe aunque valga 0: "no estar" y "estar en 0"
     significan cosas distintas — sin definir cae a la posición de reposo. */
  if (isFiniteNum(n.numXHover)) parts.push(`numXHover: ${r1(n.numXHover)}`);
  if (isFiniteNum(n.numYHover)) parts.push(`numYHover: ${r1(n.numYHover)}`);
  return `    { ${parts.join(", ")} },${trailing}`;
}

/** Ubica el cuerpo del arreglo de una isla dentro del archivo. */
function locateArray(src: string, worldId: string) {
  const open = src.indexOf(`  ${worldId}: [`);
  if (open < 0) return null;
  const bodyStart = open + `  ${worldId}: [`.length;
  const close = src.indexOf("\n  ],", bodyStart);
  if (close < 0) return null;
  return { bodyStart, bodyEnd: close, body: src.slice(bodyStart, close) };
}

export function levelPositionsWriter(): Plugin {
  return {
    name: "typely-level-positions-writer",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(ENDPOINT, (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("solo POST");
          return;
        }
        let raw = "";
        req.on("data", (c) => {
          raw += c;
          if (raw.length > 200_000) req.destroy();      // cortafuegos simple
        });
        req.on("end", () => {
          const reply = (code: number, payload: unknown) => {
            res.statusCode = code;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(payload));
          };
          try {
            const { worldId, positions } = JSON.parse(raw) as { worldId: string; positions: Node[] };

            if (!/^island\d{1,2}$/.test(worldId ?? "")) return reply(400, { error: "worldId inválido" });
            if (!Array.isArray(positions) || !positions.length) return reply(400, { error: "positions vacío" });
            for (const n of positions) {
              if (!isFiniteNum(n?.x) || !isFiniteNum(n?.y)) return reply(400, { error: "x/y no numéricos" });
              if (n.x < -50 || n.x > 150 || n.y < -50 || n.y > 150) return reply(400, { error: "x/y fuera de rango" });
              /* El número no puede irse más de un ancho de botón del centro:
                 más que eso ya no está sobre el botón, es un error de tipeo. */
              for (const k of ["numX", "numY", "numXHover", "numYHover"] as const) {
                const v = n[k];
                if (v !== undefined && (!isFiniteNum(v) || v < -100 || v > 100)) {
                  return reply(400, { error: `${k} fuera de rango` });
                }
              }
              if (n.numSize !== undefined && (!isFiniteNum(n.numSize) || n.numSize <= 0 || n.numSize > 5)) {
                return reply(400, { error: "numSize fuera de rango" });
              }
            }

            const file = path.resolve(server.config.root, FILE);
            const src = fs.readFileSync(file, "utf8");
            const found = locateArray(src, worldId);
            if (!found) return reply(404, { error: `no encontré ${worldId} en ${FILE}` });

            /* El comentario que abre el arreglo se conserva tal cual: ahí está
               documentado cómo se midieron los pedestales. */
            const lastComment = found.body.lastIndexOf("*/");
            const head = lastComment >= 0 ? found.body.slice(0, lastComment + 2) : "";

            /* Comentarios de final de línea, reasignados por índice. Si cambió
               la cantidad de nodos se descartan, porque ya no se sabe cuál
               describe a cuál. */
            const prevTail: string[] = [];
            for (const m of found.body.matchAll(/^\s*\{[^}]*\},([^\n]*)$/gm)) prevTail.push(m[1] ?? "");
            const keepTails = prevTail.length === positions.length;

            const lines = positions.map((n, i) => formatNode(n, keepTails ? prevTail[i] : ""));
            const nextBody = `${head}\n${lines.join("\n")}`;
            const next = src.slice(0, found.bodyStart) + nextBody + src.slice(found.bodyEnd);

            fs.writeFileSync(file, next, "utf8");
            server.config.logger.info(
              `[typely] ${worldId}: ${positions.length} posiciones guardadas en ${FILE}`,
            );
            reply(200, { ok: true, worldId, count: positions.length, written: lines.join("\n") });
          } catch (err) {
            reply(500, { error: String((err as Error)?.message ?? err) });
          }
        });
      });
    },
  };
}
