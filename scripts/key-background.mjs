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

/** Alfa suave para el borde donde el dibujo SE DESVANECE contra el fondo.
 *
 *  Varias láminas traen pintada una neblina de suelo abajo del botón: un
 *  degradé que va del pasto al blanco del fondo en unos veinte píxeles. El
 *  alfa binario lo corta en seco a mitad de camino, y lo que queda es una
 *  franja crema opaca con borde duro — el "blanco" que se ve alrededor de
 *  los botones de las islas 3, 5, 9, 12 y 15.
 *
 *  Acá el alfa de esa franja sale de cuánto se despega el píxel del color
 *  del fondo: pegado al fondo es transparente, y llega a opaco recién a
 *  `umbral` de distancia. El degradé vuelve a ser un degradé.
 *
 *  Sólo se ablanda lo que se ALCANZA desde el fondo pasando siempre por
 *  píxeles cercanos al fondo. Sin esa condición, un blanco del dibujo
 *  rodeado de dibujo (la nieve de la 8, un pétalo) también se volvería
 *  translúcido, que es justo lo que no se quiere.
 *
 *  Y hacen falta DOS umbrales, no uno, porque por distancia de color sola
 *  la neblina y el dibujo claro se pisan: en la isla 5 la neblina llega a
 *  180 y la piedra del canto está en 170. Lo que sí los separa es CÓMO
 *  llegan al borde. La neblina entra pegada al fondo y sube de a poco a lo
 *  largo de veinte píxeles; la piedra arranca en 170 contra el fondo mismo,
 *  de un salto. Así que `entrada` es cuán cerca del fondo tiene que estar
 *  un píxel para que se lo considere el arranque de un desvanecido, y
 *  `umbral` hasta dónde sigue ese desvanecido una vez adentro. La piedra no
 *  llega a entrar y queda opaca entera. */
export function alphaConBordeSuave(data, W, H, C, fondo, bg, { entrada, umbral }) {
  const dist = (p) =>
    Math.abs(data[p] - fondo[0]) + Math.abs(data[p + 1] - fondo[1]) + Math.abs(data[p + 2] - fondo[2]);

  const franja = new Uint8Array(W * H);
  const pila = [];
  /* Semillas: lo que toca el fondo y todavía está muy cerca de su color. */
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (bg[i] || dist(i * C) >= entrada) continue;
    let tocaFondo = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (bg[ny * W + nx]) { tocaFondo = true; break; }
    }
    if (tocaFondo) { franja[i] = 1; pila.push(i); }
  }
  /* Crecimiento hacia adentro, ya con el umbral ancho. */
  while (pila.length) {
    const p = pila.pop(), x = p % W, y = (p / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (bg[j] || franja[j] || dist(j * C) >= umbral) continue;
      franja[j] = 1;
      pila.push(j);
    }
  }

  const alpha = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (bg[i]) alpha[i] = 0;
    else if (franja[i]) alpha[i] = Math.round(255 * Math.min(1, dist(i * C) / umbral));
    else alpha[i] = 255;
  }
  return alpha;
}

/** Máscara de fondo (1 = es fondo) para una imagen RGB(A) cruda.
 *
 *  `rellenarHuecos` puede ser:
 *    false / undefined  no rellenar nada encerrado (por defecto)
 *    true               rellenar, con el área mínima histórica (900 px)
 *    <número>           rellenar, con ese área mínima en píxeles
 *
 *  El número existe porque 900 px es la medida de un lazo de liana grande
 *  (isla 10) y deja pasar enteros los huecos chicos: los que dejan las
 *  ramitas de la 7 miden entre 50 y 570 px, y el fondo se les quedaba
 *  adentro. El umbral va por isla porque lo que hay que dejar afuera —
 *  un brillo especular encerrado — pesa distinto en cada lámina. */
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
     especulares, pero no para separar nieve de hueco: eso se decide isla
     por isla mirando el resultado, no con el umbral. */
  if (!rellenarHuecos) return bg;
  const MIN_HUECO = typeof rellenarHuecos === "number" ? rellenarHuecos : 900;
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
