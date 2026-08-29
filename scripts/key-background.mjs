/* =====================================================================
   RECORTAR FONDO POR INUNDACION — compartido entre el importador de
   botones y el reparador de fuentes sin canal alfa.
   ---------------------------------------------------------------------
   El color de fondo se MIDE (mediana del borde), nunca se asume blanco: se
   vieron laminas con fondo gris azulado o casi-blanco-pero-no-blanco donde
   un umbral fijo de "casi blanco" no keyeaba nada.

   Dos pasadas de inundacion desde el borde. La primera es estricta y se
   lleva el fondo liso. La segunda, sembrada desde los vecinos de lo que ya
   es fondo, es mas tolerante pero exige que el pixel sea NEUTRO (no muy
   saturado) para no comerse un brillo claro que sea parte del dibujo.
===================================================================== */

/** Mediana del color de las cuatro orillas. Mediana y no promedio: si el
 *  dibujo toca el borde, el promedio se corre — y el promedio de dos
 *  colores no es ninguno de los dos. */
export function colorDeFondo(data, W, H, C) {
  const muestras = [[], [], []];
  const anotar = (x, y) => {
    const i = (y * W + x) * C;
    for (let k = 0; k < 3; k++) muestras[k].push(data[i + k]);
  };
  for (let x = 0; x < W; x += 2) { anotar(x, 0); anotar(x, H - 1); }
  for (let y = 0; y < H; y += 2) { anotar(0, y); anotar(W - 1, y); }
  return muestras.map((m) => m.sort((a, b) => a - b)[m.length >> 1]);
}

/** Máscara de fondo (1 = es fondo) para una imagen RGB(A) cruda. */
export function keyBackground(data, W, H, C, fondo, rellenarHuecos) {
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

  /* Huecos encerrados — opcional. La inundación entra únicamente desde el
     borde, así que el fondo atrapado adentro de un lazo cerrado nunca se
     alcanza. Va apagado por defecto: en un arte con grandes superficies del
     color del fondo (nieve casi blanca sobre fondo casi blanco) esto le
     come pedazos a la nieve. El tamaño mínimo alcanza para no tocar brillos
     especulares, pero no para separar nieve de hueco. */
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
