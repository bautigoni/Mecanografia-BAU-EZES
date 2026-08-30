export type ActivityMode = "assisted" | "independent";
export type ActivityInputType =
  | "letter"
  | "word"
  | "phrase"
  | "symbol"
  | "correction"
  | "skill"
  | "shortcut";

/* The original 5 islands plus the 10 expansion islands (island6 … island15).
   Adding ids here is the single source of truth — progress, worlds map and
   the gameplay router all derive their world list from this union. */
export type WorldId =
  | "island1"
  | "island2"
  | "island3"
  | "island4"
  | "island5"
  | "island6"
  | "island7"
  | "island8"
  | "island9"
  | "island10"
  | "island11"
  | "island12"
  | "island13"
  | "island14"
  | "island15";

/* ── Guion de un nivel de atajos ────────────────────────────────────────
   Un nivel de atajos servía una lista de combos sueltos: "Ctrl+C" tres
   veces seguidas. Se apretaba la tecla correcta sin que pasara nada que se
   entendiera, y copiar nunca terminaba en pegar.

   Con `steps` el nivel pasa a ser UNA tarea contada paso a paso: cada paso
   dice qué hay que hacer y por qué, y el simulador conserva su estado entre
   pasos, así lo que seleccionás sigue pintado cuando copiás y lo que
   copiaste aparece cuando pegás.

   Es opcional: un nivel sin `steps` se sigue jugando como antes, que es lo
   que hacen las islas 12 y 14. */

/** El cartel concreto que se muestra en un paso de Enter/Escape. Sin esto
 *  todos los diálogos decían lo mismo, y aceptar o cancelar daba igual: la
 *  gracia es que Enter guarde algo que querés y Escape frene algo que no. */
export type ShortcutDialog = {
  /** Quién muestra el cartel: la app o la página. */
  app: string;
  /** Lo que pregunta el cartel. */
  question: string;
  /** Rótulo del botón que acepta. */
  accept: string;
  /** Rótulo del botón que cancela. */
  cancel: string;
  /** true cuando lo correcto es CANCELAR (descargas raras, premios falsos).
   *  Pinta el cartel como alerta en vez de como confirmación amable. */
  danger?: boolean;
  /** Qué pasó, según lo que se haya elegido. */
  resultAccept: string;
  resultCancel: string;
};

/** Un paso de la tarea: un atajo, más la consigna de ese momento. */
export type ShortcutStep = {
  /** El atajo, mismo formato que `targets` ("Ctrl+C", "Enter"…). */
  combo: string;
  /** Qué hacer ahora, en una línea y con motivo. Se muestra grande. */
  prompt: string;
  /** Sólo para pasos de Enter/Escape. */
  dialog?: ShortcutDialog;
  /** Dónde transcurre el paso. Normalmente se deduce del atajo, pero el
   *  atajo solo no siempre alcanza: Escape cierra un cartel o cierra el
   *  buscador según la tarea, y sin esto un "cerrá el buscador" terminaba
   *  mostrando un cartel de guardar que no venía a cuento. */
  env?: "text-editor" | "find-box" | "dialog";
};

/** El contenido del simulador de un nivel, para que no sea siempre el mismo
 *  texto de ejemplo sino algo que el chico reconozca. */
export type ShortcutScene = {
  /** Lo que hay en la caja de origen. */
  source?: string;
  /** Rótulo de la caja de origen ("Nota de la seño"). */
  sourceLabel?: string;
  /** Rótulo de la caja de destino ("Tu cuaderno"). */
  targetLabel?: string;
  /** El texto de la página en los pasos de Ctrl+F. */
  page?: string;
  /** Lo que se busca ahí; se resalta al abrir el buscador. */
  find?: string;
};

export interface Activity {
  id: string;
  worldId: WorldId;
  levelNumber: number;
  level: number;
  title: string;
  subtitle: string;
  instruction: string;
  listenText: string;
  targets: string[];
  mode: ActivityMode;
  type: ActivityInputType;
  inputType: ActivityInputType;
  difficulty: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  description: string;
  requiresShift?: boolean;
  requiresAccent?: boolean;
  /** Set when inputType === "skill" — points at an entry in digitalSkillsCatalog. */
  skillChallengeId?: string;
  /** Correction levels only: text prefilled WITH a mistake, parallel to `targets`.
   *  The student must Backspace the wrong part and type the correct text. */
  initialTexts?: string[];
  /** Correction levels only: per-objective task hint, parallel to `targets`. */
  correctionHints?: string[];

  /** Shortcut levels: la tarea contada paso a paso (ver ShortcutStep). Si
   *  está, manda sobre `targets` y el simulador no se reinicia entre pasos. */
  steps?: ShortcutStep[];
  /** Shortcut levels: qué texto y qué rótulos muestra el simulador. */
  scene?: ShortcutScene;
}

type ActivityDraft = Omit<Activity, "id" | "level" | "type" | "inputType" | "difficulty"> & {
  difficulty?: Activity["difficulty"];
  inputType?: ActivityInputType;
};

function makeActivity(draft: ActivityDraft & { inputType: ActivityInputType; difficulty: Activity["difficulty"] }): Activity {
  return {
    ...draft,
    id: `${draft.worldId}-l${draft.levelNumber}`,
    level: draft.levelNumber,
    type: draft.inputType,
  } as Activity;
}

const world1: Activity[] = [
  makeActivity({
    worldId: "island1",
    levelNumber: 1,
    title: "Mis primeras teclas",
    subtitle: "Conocé la fila central",
    instruction: "Presioná la letra que aparece.",
    listenText: "Buscá la letra que aparece en pantalla.",
    targets: ["A", "S", "D", "F", "J", "K", "L"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 1,
    description: "Reconocé las teclas de la fila central del teclado.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 2,
    title: "Vocales mágicas",
    subtitle: "Ubicá cada vocal",
    instruction: "Presioná la vocal que aparece.",
    listenText: "Buscá la vocal que aparece en pantalla.",
    targets: ["A", "E", "I", "O", "U", "A", "I"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 1,
    description: "Practicá las cinco vocales.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 3,
    title: "Fila de arriba",
    subtitle: "Q W E R T Y U I O P",
    instruction: "Presioná la letra de la fila de arriba.",
    listenText: "Buscá la letra de la fila superior.",
    targets: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 2,
    description: "Conocé las letras de la fila superior.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 4,
    title: "Fila de abajo",
    subtitle: "Z X C V B N M",
    instruction: "Presioná la letra de la fila inferior.",
    listenText: "Buscá la letra de la fila inferior.",
    targets: ["Z", "X", "C", "V", "B", "N", "M"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 2,
    description: "Practicá las letras de la fila inferior.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 5,
    title: "Mezcla de letras",
    subtitle: "Todo el abecedario",
    instruction: "Presioná la letra correcta sin ayuda visual.",
    listenText: "Presioná la letra correcta.",
    targets: ["G", "H", "P", "B", "N", "F", "T", "L", "M", "R"],
    mode: "independent",
    inputType: "letter",
    difficulty: 3,
    description: "Reconocé letras de todo el teclado.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 6,
    title: "Letra veloz",
    subtitle: "Reto final de letras",
    instruction: "Presioná rápido cada letra que aparece.",
    listenText: "Presioná rápido cada letra que aparece.",
    targets: ["F", "J", "D", "K", "S", "L", "A", "Ñ", "G", "H", "R", "U"],
    mode: "independent",
    inputType: "letter",
    difficulty: 3,
    description: "Cerrá el mundo 1 con velocidad y precisión.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 7,
    title: "Lluvia de letras",
    subtitle: "Reto relámpago del bosque",
    instruction: "Presioná cada letra que cae antes de que se apague.",
    listenText: "Presioná rápido cada letra que aparece en pantalla.",
    targets: ["E", "T", "O", "N", "C", "I", "M", "A", "P", "V", "S", "Ñ"],
    mode: "independent",
    inputType: "letter",
    difficulty: 3,
    description: "Atrapá la lluvia de letras del bosque con velocidad y precisión.",
  }),
];

const world2: Activity[] = [
  makeActivity({
    worldId: "island2",
    levelNumber: 1,
    title: "Palabras cortas",
    subtitle: "Escribí con precisión",
    instruction: "Escribí la palabra que aparece.",
    listenText: "Escribí la palabra que aparece en pantalla.",
    targets: ["mesa", "dedo", "mano", "gota", "pelo"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Escribí palabras simples completas.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 2,
    title: "Cosas del cielo",
    subtitle: "Palabras lindas",
    instruction: "Escribí la palabra completa.",
    listenText: "Escribí la palabra completa.",
    targets: ["luna", "nube", "lago", "rosa", "casa"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Practicá palabras cortas del cielo.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 3,
    title: "Mi mundo",
    subtitle: "Palabras nuevas",
    instruction: "Escribí la palabra que ves.",
    listenText: "Escribí la palabra que ves.",
    targets: ["tecla", "amigo", "verde", "fruta", "libro"],
    mode: "independent",
    inputType: "word",
    difficulty: 3,
    description: "Escribí palabras un poco más largas.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 4,
    title: "Animales",
    subtitle: "Nombres de animales",
    instruction: "Escribí el nombre del animal.",
    listenText: "Escribí el nombre del animal.",
    targets: ["gato", "perro", "conejo", "caballo", "tortuga"],
    mode: "independent",
    inputType: "word",
    difficulty: 3,
    description: "Practicá nombres de animales conocidos.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 5,
    title: "Dos palabras",
    subtitle: "Usá el espacio",
    instruction: "Escribí las dos palabras separadas por un espacio.",
    listenText: "Escribí las dos palabras separadas por un espacio.",
    targets: ["mi casa", "sol grande", "tecla feliz", "nube blanca"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Aprendé a usar la barra espaciadora.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 6,
    title: "Borro y corrijo",
    subtitle: "Usá retroceso",
    instruction: "Borrá el error con Backspace y dejá la palabra correcta.",
    listenText: "Borrá el error con retroceso y dejá la palabra correcta.",
    /* Each word has a DIFFERENT kind of mistake so the correction is varied
       and meaningful: extra letter, missing letter, swapped letters, wrong
       vowel, duplicated letter. No accents/punctuation (not taught yet). */
    targets: ["escuela", "estrella", "tablero", "ventana", "mochila"],
    initialTexts: ["escela", "estrellla", "tabelro", "ventona", "moochila"],
    correctionHints: [
      "A «escela» le falta una letra: corregí hasta «escuela».",
      "En «estrellla» sobra una L: corregí hasta «estrella».",
      "En «tabelro» hay dos letras cambiadas de lugar: corregí hasta «tablero».",
      "En «ventona» hay una vocal equivocada: corregí hasta «ventana».",
      "En «moochila» sobra una O: corregí hasta «mochila».",
    ],
    mode: "independent",
    inputType: "correction",
    difficulty: 4,
    description: "Corregí cada palabra con Backspace: el error es distinto en cada una.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 7,
    title: "Reto de palabras",
    subtitle: "Todo lo aprendido",
    instruction: "Escribí la frase completa.",
    listenText: "Escribí la frase completa.",
    /* Cierre de la isla, un escalón sobre "Dos palabras": tres palabras en vez
       de dos, con el vocabulario que ya practicó en los niveles anteriores.
       Sin tildes ni mayúsculas, que se enseñan recién en la isla 3. */
    targets: ["el gato duerme", "mi libro verde", "la luna brilla", "una fruta rica", "el perro corre"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Cerrá la isla escribiendo frases de tres palabras.",
  }),
];

const world3: Activity[] = [
  makeActivity({
    worldId: "island3",
    levelNumber: 1,
    title: "Mayúsculas mágicas",
    subtitle: "Con Shift",
    instruction: "Escribí cada palabra con la primera letra en mayúscula.",
    listenText: "Escribí cada palabra con mayúscula inicial.",
    targets: ["Sofia", "Lucas", "Maria", "Pedro", "Lima"],
    mode: "assisted",
    inputType: "word",
    difficulty: 3,
    description: "Usá Shift para escribir nombres propios.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 2,
    title: "La ñ especial",
    subtitle: "Letra del español",
    instruction: "Escribí la palabra con la letra ñ.",
    listenText: "Escribí palabras con ñ.",
    targets: ["niño", "año", "piña", "caña", "España"],
    mode: "assisted",
    inputType: "word",
    difficulty: 4,
    description: "Practicá la letra ñ del español.",
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 3,
    title: "Acentos suaves",
    subtitle: "Tildes en palabras",
    instruction: "Escribí la palabra con su tilde.",
    listenText: "Escribí cada palabra con su tilde.",
    /* Arranca con palabras cortas y termina con dos largas: son las que
       traía el viejo nivel 4 ("Palabras con tilde"), que practicaba esta
       misma destreza en un nivel aparte. Al pasar la isla a seis niveles se
       fusionó acá en vez de perderse. */
    targets: ["mamá", "papá", "café", "lápiz", "árbol", "camión", "música"],
    mode: "independent",
    inputType: "word",
    difficulty: 4,
    description: "Aprendé a escribir tildes, de palabras cortas a largas.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 4,
    title: "¿Preguntas?",
    subtitle: "Signos ¿ y ?",
    instruction: "Escribí la pregunta completa con sus signos.",
    listenText: "Escribí la pregunta completa con sus signos.",
    targets: ["¿Dónde?", "¿Quién?", "¿Cómo estás?", "¿Qué día es?"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Practicá los signos de pregunta.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 5,
    title: "¡Exclamaciones!",
    subtitle: "Signos ¡ y !",
    instruction: "Escribí la frase con signos de exclamación.",
    listenText: "Escribí la frase con signos de exclamación.",
    targets: ["¡Hola!", "¡Vamos!", "¡Qué lindo!", "¡Buen día, Sofía!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Practicá los signos de exclamación.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 6,
    title: "Gran dictado",
    subtitle: "Tildes y signos juntos",
    instruction: "Escribí cada frase con sus tildes y signos correctos.",
    listenText: "Escribí cada frase con sus tildes y signos, tal como aparece.",
    targets: ["¿Cómo estás, Martín?", "¡Qué día tan mágico!", "Mi pingüino lee rápido."],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Repaso final de la biblioteca: tildes, ñ y signos del español juntos.",
    requiresAccent: true,
    requiresShift: true,
  }),
];

const world4: Activity[] = [
  makeActivity({
    worldId: "island4",
    levelNumber: 1,
    title: "Puntos y comas",
    subtitle: "Signos básicos",
    instruction: "Escribí el signo que aparece.",
    listenText: "Escribí cada signo de puntuación.",
    targets: [".", ",", ";", ":", "-", "_"],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 4,
    description: "Reconocé los signos de puntuación.",
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 2,
    title: "Arroba y punto",
    subtitle: "Para correos",
    instruction: "Escribí los símbolos especiales.",
    listenText: "Escribí los símbolos especiales.",
    targets: ["@", ".", "@", "-", "_", "."],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 5,
    description: "Aprendé el arroba y el punto.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 3,
    title: "Mi primer correo",
    subtitle: "Dirección de email",
    instruction: "Escribí la dirección de correo completa.",
    listenText: "Escribí la dirección de correo completa.",
    targets: ["sofia@edutic.com", "lucas@edutic.com", "info@edutic.com"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Practicá escribir un correo electrónico.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 4,
    title: "Frases con coma",
    subtitle: "Punto y coma",
    instruction: "Escribí la frase respetando puntos y comas.",
    listenText: "Escribí la frase respetando puntos y comas.",
    targets: ["Hola, Sofía.", "Vamos, ya es hora.", "Sí, claro."],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Frases reales con puntuación.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 5,
    title: "Preguntas reales",
    subtitle: "Frases con ¿?",
    instruction: "Escribí la pregunta completa.",
    listenText: "Escribí la pregunta completa.",
    targets: ["¿Listo, Lucas?", "¿Vamos al parque?", "¿Cómo se llama tu mascota?"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Combiná tildes, signos y puntuación.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 6,
    title: "Reto final",
    subtitle: "Todo junto",
    instruction: "Escribí cada frase exactamente como aparece.",
    listenText: "Escribí cada frase tal como aparece.",
    targets: [
      "¡Hola, mundo!",
      "Mi correo es sofia@edutic.com.",
      "¿Estás listo? ¡Vamos!",
      "Año 2026: ¡a escribir!",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Reto final con todos los signos del español.",
    requiresAccent: true,
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 7,
    title: "Código experto",
    subtitle: "El reto más difícil",
    instruction: "Escribí la línea completa, con todos sus signos.",
    listenText: "Escribí la línea completa, con todos sus signos.",
    /* Un escalón sobre "Reto final": cada línea combina VARIOS signos a la vez
       (pregunta + exclamación + arroba + dos puntos), en vez de uno o dos. */
    targets: [
      "¿Tu correo es ana@edutic.com?",
      "¡Atención! Clave: 2026-ABC.",
      "Escribí a lucas@escuela.edu.ar, por favor.",
      "¿Listo? ¡Enviá el mensaje ahora!",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 7,
    description: "Combiná varios signos en una misma línea.",
  }),
];

/* =====================================================================
   World 5 — Isla digital: 7 levels covering mouse / touchpad / shortcuts.
   Each level is an Activity with `inputType: "skill"` and a link to the
   matching entry in `digitalSkillsCatalog` (src/data/digitalSkills.ts).
   The GameplayPage renders these through the SkillChallengeShell instead
   of the typing keyboard pipeline.
===================================================================== */
/* The order and content of each entry below mirrors exactly what
   SkillLevelView renders for the same levelNumber, so the level chip on
   the world map, the spoken consigna and the on-screen UI all describe
   the same mechanic. */
const world5: Activity[] = [
  makeActivity({
    worldId: "island5",
    levelNumber: 1,
    title: "Clic izquierdo",
    subtitle: "Tu primer gesto con el mouse",
    instruction: "Hacé clic sobre los 5 objetos que brillan.",
    listenText: "Hacé un clic con el botón izquierdo del mouse en cada dibujo.",
    targets: ["click:primary"],
    mode: "assisted",
    inputType: "skill",
    difficulty: 1,
    description: "Aprendé a hacer clic con el botón principal del mouse sobre cada objeto.",
    skillChallengeId: "ds-click-1",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 2,
    title: "Clic derecho",
    subtitle: "Menús secretos",
    instruction: "Hacé clic derecho sobre el objeto que te indica la consigna.",
    listenText: "Hacé clic con el botón derecho del mouse para abrir el menú secreto.",
    targets: ["click:secondary"],
    mode: "assisted",
    inputType: "skill",
    difficulty: 2,
    description: "Descubrí los menús que esconde el clic derecho sobre cofres, mochilas y pociones.",
    skillChallengeId: "ds-click-2",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 3,
    title: "Arrastrar y soltar",
    subtitle: "Drag & drop",
    instruction: "Arrastrá cada objeto y soltalo en la silueta que coincide.",
    listenText: "Mantené apretado el botón izquierdo y movelo hasta el destino correcto.",
    targets: ["drag:item"],
    mode: "independent",
    inputType: "skill",
    difficulty: 3,
    description: "Practicá arrastrar y soltar — los destinos están mezclados.",
    skillChallengeId: "ds-drag-1",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 4,
    title: "Ventanas y pestañas",
    subtitle: "Sistema virtual",
    instruction: "Abrí y cerrá ventanas y pestañas según las tareas.",
    listenText: "Cerrá las ventanas y pestañas que te pide la tarea.",
    targets: ["window:close", "tab:open", "tab:close"],
    mode: "independent",
    inputType: "skill",
    difficulty: 3,
    description: "Aprendé a manejar ventanas y pestañas del escritorio.",
    skillChallengeId: "ds-tab-3",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 5,
    title: "Scroll y zoom",
    subtitle: "Rueda del mouse",
    instruction: "Desplazate por la imagen del castillo y después acercá y alejá el zoom.",
    listenText: "Usá la rueda del mouse para subir y bajar, y los botones más y menos para hacer zoom.",
    targets: ["scroll:page", "zoom:in", "zoom:out"],
    mode: "independent",
    inputType: "skill",
    difficulty: 3,
    description: "Hacé scroll para revelar la imagen y practicá zoom in y zoom out.",
    skillChallengeId: "ds-scroll-1",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 6,
    title: "Doble clic",
    subtitle: "Abrir carpetas",
    instruction: "Hacé doble clic rápido sobre cada carpeta para abrirla.",
    listenText: "Dos clics seguidos sobre la carpeta y se abre.",
    targets: ["click:double"],
    mode: "assisted",
    inputType: "skill",
    difficulty: 2,
    description: "Diferenciá el clic simple del doble clic para abrir carpetas mágicas.",
    skillChallengeId: "ds-click-3",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 7,
    title: "Copiar y pegar",
    subtitle: "Ctrl + C / Ctrl + V",
    instruction: "Seleccioná el mensaje de arriba, copialo con Ctrl + C y pegalo abajo con Ctrl + V.",
    listenText: "Seleccioná el texto, copialo con Control C y pegalo con Control V.",
    targets: ["shortcut:Ctrl+C", "shortcut:Ctrl+V"],
    mode: "independent",
    inputType: "skill",
    difficulty: 4,
    description: "Reto final: copiá un mensaje y pegalo en la caja de abajo.",
    skillChallengeId: "ds-shortcut-ctrlc",
  }),
];

/* =====================================================================
   EXPANSION — 10 new islands (island6 … island15).
   These reuse the existing engines:
     • typing keyboard engine  → inputType letter/word/phrase/symbol/correction
     • keyboard-shortcut engine → inputType "shortcut" (targets are key combos
       like "Ctrl+C", "Alt+Tab" — see ShortcutLevelView.tsx)
   No engine is duplicated; only data is added here. Difficulty climbs across
   worlds, and advanced uppercase / reserved combos are introduced late.
===================================================================== */

/* World 6 — Isla de la escritura (World 2 in the journey): SYLLABLES first,
   not whole words. Two-letter syllables → three-letter syllables, and only the
   last two levels introduce a few short real words. This keeps it clearly
   different from World 1 (which practises single letters). */
const world6: Activity[] = [
  makeActivity({
    worldId: "island6",
    levelNumber: 1,
    title: "Sílabas mágicas",
    subtitle: "Empezamos a unir letras",
    instruction: "Escribí la sílaba que aparece.",
    listenText: "Escribí la sílaba que ves en pantalla.",
    targets: ["ma", "me", "mi", "mo", "mu", "sa"],
    mode: "assisted",
    inputType: "word",
    difficulty: 1,
    description: "Uní dos letras para formar tus primeras sílabas.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 2,
    title: "Sílabas que suenan",
    subtitle: "Nuevos sonidos",
    instruction: "Escribí la sílaba que aparece.",
    listenText: "Escribí la sílaba que ves en pantalla.",
    targets: ["lo", "pe", "tu", "fi", "ca", "de"],
    mode: "assisted",
    inputType: "word",
    difficulty: 1,
    description: "Practicá más sílabas de dos letras.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 3,
    title: "Sílabas largas",
    subtitle: "Sílabas un poco más largas",
    instruction: "Escribí la sílaba de tres letras.",
    listenText: "Escribí la sílaba de tres letras.",
    targets: ["tra", "pre", "blo", "cli", "gru", "fla"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Uní tres letras en una sola sílaba.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 4,
    title: "Sílabas veloces",
    subtitle: "Practicá sin mirar",
    instruction: "Escribí la sílaba que aparece.",
    listenText: "Escribí la sílaba que aparece.",
    targets: ["dra", "ple", "tri", "cro", "gla", "bru"],
    mode: "independent",
    inputType: "word",
    difficulty: 2,
    description: "Ganá ritmo con sílabas de tres letras.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 5,
    title: "Uní las sílabas",
    subtitle: "Sonidos seguidos",
    instruction: "Escribí la sílaba que aparece.",
    listenText: "Escribí la sílaba que aparece.",
    targets: ["pla", "tre", "pri", "clo", "fle", "gro"],
    mode: "independent",
    inputType: "word",
    difficulty: 2,
    description: "Más sílabas para soltar los dedos.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 6,
    title: "Primeras palabras",
    subtitle: "Palabras cortitas",
    instruction: "Escribí la palabra completa.",
    listenText: "Escribí la palabra completa.",
    targets: ["sol", "pan", "mar", "luz", "pez"],
    mode: "independent",
    inputType: "word",
    difficulty: 2,
    description: "Ahora sí: unas pocas palabras cortas.",
  }),
  makeActivity({
    worldId: "island6",
    levelNumber: 7,
    title: "Palabras veloces",
    subtitle: "Reto de la isla",
    instruction: "Escribí rápido cada palabra que aparece.",
    listenText: "Escribí rápido cada palabra que aparece.",
    targets: ["casa", "gato", "mesa", "nube"],
    mode: "independent",
    inputType: "word",
    difficulty: 3,
    description: "Cerrá la isla con unas palabras cortas y veloces.",
  }),
];

/* World 7 — Isla de las palabras largas. */
const world7: Activity[] = [
  makeActivity({
    worldId: "island7",
    levelNumber: 1,
    title: "Palabras más largas",
    subtitle: "Escribí con precisión",
    instruction: "Escribí la palabra completa.",
    listenText: "Escribí la palabra completa.",
    targets: ["ventana", "planeta", "camino", "bosque", "puente"],
    mode: "assisted",
    inputType: "word",
    difficulty: 3,
    description: "Animate con palabras de seis letras.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 2,
    title: "Animales del mundo",
    subtitle: "Palabras largas",
    instruction: "Escribí el nombre del animal.",
    listenText: "Escribí el nombre del animal.",
    targets: ["caballo", "tortuga", "delfin", "conejo", "ardilla"],
    mode: "assisted",
    inputType: "word",
    difficulty: 3,
    description: "Practicá nombres de animales conocidos.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 3,
    title: "Palabras gigantes",
    subtitle: "Sin apurarte",
    instruction: "Escribí la palabra larga sin apurarte.",
    listenText: "Escribí la palabra larga sin apurarte.",
    targets: ["mariposa", "elefante", "biblioteca", "computadora"],
    mode: "independent",
    inputType: "word",
    difficulty: 4,
    description: "Tomate tu tiempo con palabras muy largas.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 4,
    title: "Frases de dos",
    subtitle: "Con espacio",
    instruction: "Escribí la frase completa.",
    listenText: "Escribí la frase completa.",
    targets: ["mar tranquilo", "cielo estrellado", "bosque verde"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Combiná dos palabras largas en una frase.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 5,
    title: "Frases de tres",
    subtitle: "Más espacios",
    instruction: "Escribí la frase con todos sus espacios.",
    listenText: "Escribí la frase con todos sus espacios.",
    targets: ["el gato salta", "mi casa es linda", "vamos a jugar"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Escribí frases de tres palabras.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 6,
    title: "Reto de frases",
    subtitle: "Velocidad y precisión",
    instruction: "Escribí cada frase tal como aparece.",
    listenText: "Escribí cada frase tal como aparece.",
    targets: ["hoy es un gran dia", "me gusta aprender", "puedo escribir bien"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Cerrá la isla escribiendo frases completas.",
  }),
  makeActivity({
    worldId: "island7",
    levelNumber: 7,
    title: "Frases largas",
    subtitle: "El reto más difícil",
    instruction: "Escribí la frase completa.",
    listenText: "Escribí la frase completa.",
    /* Un escalón sobre "Reto de frases": cinco palabras en vez de cuatro.
       Sigue sin tildes ni mayúsculas, igual que el resto de la isla. */
    targets: [
      "me gusta leer libros nuevos",
      "vamos a jugar en el parque",
      "el elefante camina muy despacio",
      "hoy puedo escribir mucho mejor",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Cerrá la isla con las frases más largas.",
  }),
];

/* World 8 — Isla de los signos: puntuación y símbolos progresivos. */
const world8: Activity[] = [
  makeActivity({
    worldId: "island8",
    levelNumber: 1,
    title: "Punto y coma",
    subtitle: "Signos básicos",
    instruction: "Escribí el signo que aparece.",
    listenText: "Escribí cada signo que aparece.",
    targets: [".", ",", ".", ",", "."],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 2,
    description: "Conocé el punto y la coma.",
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 2,
    title: "Dos puntos",
    subtitle: ": y ;",
    instruction: "Escribí el signo que aparece.",
    listenText: "Escribí cada signo que aparece.",
    targets: [":", ";", ":", ";", "-"],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 3,
    description: "Practicá los dos puntos y el punto y coma.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 3,
    title: "Preguntas",
    subtitle: "¿ y ?",
    instruction: "Escribí la pregunta completa con sus signos.",
    listenText: "Escribí la pregunta completa con sus signos.",
    targets: ["¿Hola?", "¿Quién?", "¿Cómo estás?", "¿Qué hora es?"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Usá los signos de pregunta del español.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 4,
    title: "Exclamaciones",
    subtitle: "¡ y !",
    instruction: "Escribí la frase con signos de exclamación.",
    listenText: "Escribí la frase con signos de exclamación.",
    targets: ["¡Hola!", "¡Genial!", "¡Qué lindo!", "¡Vamos ya!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Practicá los signos de exclamación.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 5,
    title: "Comillas y guiones",
    subtitle: "\" y -",
    instruction: "Escribí lo que ves con sus signos.",
    listenText: "Escribí lo que ves con sus signos.",
    targets: ["\"sol\"", "alto-bajo", "\"hola\"", "rojo-azul"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Usá comillas y guiones.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 6,
    title: "Paréntesis",
    subtitle: "( y )",
    instruction: "Escribí lo que aparece entre paréntesis.",
    listenText: "Escribí lo que aparece entre paréntesis.",
    targets: ["(sol)", "(luna)", "(uno)", "(final)"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Aprendé a usar los paréntesis.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island8",
    levelNumber: 7,
    title: "Reto de signos",
    subtitle: "Todo junto",
    instruction: "Escribí cada frase con todos sus signos.",
    listenText: "Escribí cada frase con todos sus signos.",
    targets: ["¿Listo? ¡Sí!", "Hola, ¿cómo estás?", "¡Qué bien (todo)!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Cerrá la isla combinando todos los signos.",
    requiresAccent: true,
    requiresShift: true,
  }),
];

/* World 9 — Isla de los correos. */
const world9: Activity[] = [
  makeActivity({
    worldId: "island9",
    levelNumber: 1,
    title: "Mi nombre",
    subtitle: "Escribir nombres",
    instruction: "Escribí el nombre que aparece.",
    listenText: "Escribí el nombre que aparece.",
    targets: ["sofia", "lucas", "maria", "pedro", "valentina"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Practicá escribir nombres de personas.",
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 2,
    title: "El arroba",
    subtitle: "La tecla @",
    instruction: "Escribí el símbolo que aparece.",
    listenText: "Escribí el símbolo que aparece.",
    targets: ["@", ".", "@", ".", "@"],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 3,
    description: "Conocé el arroba y el punto de los correos.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 3,
    title: "Usuario y arroba",
    subtitle: "nombre@",
    instruction: "Escribí el comienzo del correo.",
    listenText: "Escribí el comienzo del correo.",
    targets: ["sofia@", "lucas@", "info@", "hola@"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 3,
    description: "Uní el nombre con el arroba.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 4,
    title: "Dominios",
    subtitle: ".com y más",
    instruction: "Escribí el final del correo.",
    listenText: "Escribí el final del correo.",
    targets: ["gmail.com", "edu.ar", "correo.com", "escuela.edu"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Practicá los finales como punto com.",
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 5,
    title: "Correo completo",
    subtitle: "Dirección entera",
    instruction: "Escribí la dirección de correo completa.",
    listenText: "Escribí la dirección de correo completa.",
    targets: ["sofia@gmail.com", "lucas@edu.ar", "info@escuela.com"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Escribí un correo electrónico completo.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 6,
    title: "Asunto del mensaje",
    subtitle: "Título corto",
    instruction: "Escribí el asunto del correo.",
    listenText: "Escribí el asunto del correo.",
    targets: ["Hola amigo", "Mi tarea", "Buenos dias", "Nos vemos"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Practicá escribir asuntos cortos.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island9",
    levelNumber: 7,
    title: "Mensaje amigable",
    subtitle: "Reto final",
    instruction: "Escribí el mensaje completo tal como aparece.",
    listenText: "Escribí el mensaje completo tal como aparece.",
    targets: ["Hola, ¿cómo estás?", "Te escribo a sofia@gmail.com", "¡Gracias por todo!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Cerrá la isla escribiendo un mensaje real.",
    requiresAccent: true,
    requiresShift: true,
  }),
];

/* World 10 — Isla de las búsquedas: escribir búsquedas y apretar Enter. */
const world10: Activity[] = [
  makeActivity({
    worldId: "island10",
    levelNumber: 1,
    title: "Una palabra",
    subtitle: "Buscar algo simple",
    instruction: "Escribí lo que querés buscar y apretá Enter.",
    listenText: "Escribí una palabra para buscar y apretá Enter.",
    targets: ["perros", "gatos", "estrellas", "dinosaurios"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Escribí una palabra clave para buscar.",
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 2,
    title: "Palabras clave",
    subtitle: "Dos palabras",
    instruction: "Escribí la búsqueda y apretá Enter.",
    listenText: "Escribí la búsqueda y apretá Enter.",
    targets: ["perros bebes", "juegos divertidos", "dibujos faciles"],
    mode: "assisted",
    inputType: "phrase",
    difficulty: 3,
    description: "Usá dos palabras clave para buscar mejor.",
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 3,
    title: "Preguntas al buscador",
    subtitle: "Buscar dudas",
    instruction: "Escribí la pregunta y apretá Enter.",
    listenText: "Escribí la pregunta y apretá Enter.",
    targets: ["como dibujar un gato", "donde vive el pinguino"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Hacé preguntas reales al buscador.",
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 4,
    title: "Corregir la búsqueda",
    subtitle: "Usá Backspace",
    instruction: "Borrá la letra equivocada con Backspace y escribí la correcta.",
    listenText: "Borrá la letra equivocada con retroceso y escribí la correcta.",
    targets: ["recetas faciles", "cuentos cortos", "musica para bailar"],
    initialTexts: ["recetaz", "cuentoz", "musika"],
    correctionHints: [
      "Borrá la Z y escribí S; después completá «recetas faciles».",
      "Borrá la Z y escribí S; después completá «cuentos cortos».",
      "Borrá la K y escribí C; después completá «musica para bailar».",
    ],
    mode: "independent",
    inputType: "correction",
    difficulty: 4,
    description: "Corregí tu búsqueda mientras escribís.",
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 5,
    title: "Página o búsqueda",
    subtitle: "Sitios web",
    instruction: "Escribí la dirección de la página.",
    listenText: "Escribí la dirección de la página.",
    targets: ["www.google.com", "www.escuela.edu", "www.juegos.com"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Diferenciá una búsqueda de una dirección web.",
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 6,
    title: "Buscador experto",
    subtitle: "Reto final",
    instruction: "Escribí la búsqueda completa y apretá Enter.",
    listenText: "Escribí la búsqueda completa y apretá Enter.",
    targets: ["animales del oceano", "como cuidar una planta", "juegos de mesa para niños"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Cerrá la isla buscando como un experto.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island10",
    levelNumber: 7,
    title: "Búsqueda experta",
    subtitle: "El reto más difícil",
    instruction: "Escribí la búsqueda completa.",
    listenText: "Escribí la búsqueda completa.",
    /* Un escalón sobre "Buscador experto": preguntas más largas, y una
       dirección web mezclada para alternar entre buscar y navegar. */
    targets: [
      "cuantos planetas tiene el sistema solar",
      "www.biblioteca.escuela.edu.ar",
      "como se llaman las nubes mas altas",
      "juegos para aprender a escribir rapido",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Buscá con preguntas largas y escribí direcciones web.",
  }),
];

/* World 11 — Isla de los comandos: atajos básicos (engine de atajos). */
const world11: Activity[] = [
  makeActivity({
    worldId: "island11",
    levelNumber: 1,
    title: "Aceptar o cancelar",
    subtitle: "Enter dice que sí, Escape dice que no",
    instruction: "Leé cada cartel y decidí: ¿lo aceptás o lo cancelás?",
    listenText: "Leé el cartel. Si es algo que querés, aceptá con Enter. Si es algo raro, cancelá con Escape.",
    targets: ["Enter", "Escape", "Enter", "Escape"],
    /* Cuatro carteles distintos, dos para aceptar y dos para cancelar. La
       tecla sola no enseña nada: lo que se practica acá es mirar QUÉ pide el
       cartel antes de contestar. */
    steps: [
      {
        combo: "Enter",
        prompt: "Terminaste tu dibujo y te pregunta si lo guardás. Aceptá con Enter.",
        dialog: {
          app: "Dibujo mágico",
          question: "¿Guardar los cambios de tu dibujo?",
          accept: "Guardar",
          cancel: "No guardar",
          resultAccept: "Tu dibujo quedó guardado.",
          resultCancel: "Se perdieron los cambios del dibujo.",
        },
      },
      {
        combo: "Escape",
        prompt: "¡Ojo! Vos no pediste esa descarga. Cancelala con Escape.",
        dialog: {
          app: "juegos-gratis-ya.com",
          question: "Esta página quiere descargar «super-juego.exe». Vos no lo pediste.",
          accept: "Descargar",
          cancel: "Cancelar",
          danger: true,
          resultAccept: "Se descargó un archivo que no pediste. Mejor cancelarlo.",
          resultCancel: "Frenaste la descarga. ¡Bien ahí!",
        },
      },
      {
        combo: "Enter",
        prompt: "La tarea está lista para enviar. Aceptá con Enter.",
        dialog: {
          app: "Aula virtual",
          question: "¿Enviar tu tarea a la maestra?",
          accept: "Enviar",
          cancel: "Todavía no",
          resultAccept: "Tu tarea llegó a la maestra.",
          resultCancel: "La tarea quedó sin enviar.",
        },
      },
      {
        combo: "Escape",
        prompt: "Nadie regala premios por sorpresa. Cerrá el cartel con Escape.",
        dialog: {
          app: "premio-sorpresa.net",
          question: "«¡Ganaste un celular! Escribí tu dirección para recibirlo.»",
          accept: "Escribir mi dirección",
          cancel: "Cerrar",
          danger: true,
          resultAccept: "Le diste tus datos a una página desconocida.",
          resultCancel: "Cerraste la trampa sin dar ningún dato.",
        },
      },
    ],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 1,
    description: "Enter acepta lo que querés; Escape frena lo que no pediste.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 2,
    title: "Seleccionar y copiar",
    subtitle: "Ctrl + A y después Ctrl + C",
    instruction: "Copiá la nota de la maestra para no perderla.",
    listenText: "Primero seleccioná toda la nota con Control y A. Después copiala con Control y C.",
    targets: ["Ctrl+A", "Ctrl+C"],
    scene: {
      sourceLabel: "Nota de la maestra",
      source: "Mañana traer el cuaderno rojo y una regla.",
      targetLabel: "Tu cuaderno digital",
    },
    steps: [
      { combo: "Ctrl+A", prompt: "Seleccioná toda la nota con Ctrl + A. Vas a ver cómo se pinta." },
      { combo: "Ctrl+C", prompt: "Ahora copiala con Ctrl + C. Se guarda en el portapapeles, mirá abajo." },
    ],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 2,
    description: "Para copiar algo, primero hay que seleccionarlo.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 3,
    title: "Copiar y pegar",
    subtitle: "Ctrl + A, Ctrl + C y Ctrl + V",
    instruction: "Pasá la lista de útiles a tu cuaderno, sin escribirla de nuevo.",
    listenText: "Seleccioná la lista, copiala y después pegala en tu cuaderno.",
    targets: ["Ctrl+A", "Ctrl+C", "Ctrl+V"],
    scene: {
      sourceLabel: "Lista de útiles",
      source: "Cartuchera, tijera, plasticola y hojas de colores.",
      targetLabel: "Tu cuaderno digital",
    },
    steps: [
      { combo: "Ctrl+A", prompt: "Seleccioná toda la lista con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copiala con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegala en tu cuaderno con Ctrl + V. Ahí vas a ver aparecer la lista." },
    ],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 3,
    description: "Copiar sin pegar no sirve de nada: el par completo es Ctrl + C y Ctrl + V.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 4,
    title: "Deshacer un error",
    subtitle: "Ctrl + Z borra lo último",
    instruction: "Pegaste el chiste en la tarea. Sacalo antes de que lo vea la maestra.",
    listenText: "Copiá el texto, pegalo y después deshacé el cambio con Control y Z.",
    targets: ["Ctrl+A", "Ctrl+C", "Ctrl+V", "Ctrl+Z"],
    scene: {
      sourceLabel: "Chiste del recreo",
      source: "¿Qué le dice un cero a un ocho? ¡Lindo cinturón!",
      targetLabel: "Tu tarea de matemática",
    },
    steps: [
      { combo: "Ctrl+A", prompt: "Seleccioná el chiste con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copialo con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegalo en la tarea con Ctrl + V… ¡ups!, ahí no iba." },
      { combo: "Ctrl+Z", prompt: "Sacalo con Ctrl + Z. Deshacer borra lo último que hiciste." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 3,
    description: "Ctrl + Z te salva cuando pegás algo donde no iba.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 5,
    title: "Buscar en la página",
    subtitle: "Ctrl + F encuentra, Escape cierra",
    instruction: "La página es larga. Encontrá el día del acto sin leerla toda.",
    listenText: "Abrí el buscador con Control y F. Después cerralo con Escape.",
    targets: ["Ctrl+F", "Escape"],
    scene: {
      page: "Bienvenidos a la escuela. Las clases empiezan a las 8. El acto es el viernes 12. La biblioteca abre los martes. El comedor cierra a las 14.",
      find: "viernes 12",
    },
    steps: [
      { combo: "Ctrl+F", prompt: "Abrí el buscador con Ctrl + F para encontrar «viernes 12»." },
      { combo: "Escape", prompt: "Ya lo encontraste. Cerrá el buscador con Escape.", env: "find-box" },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 4,
    description: "Ctrl + F busca una palabra en toda la página, sin leerla entera.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 6,
    title: "Copiar el correo",
    subtitle: "Buscar, copiar y pegar",
    instruction: "Encontrá el correo de la escuela y copialo en el formulario.",
    listenText: "Buscá el correo con Control y F, cerrá el buscador, y después copialo y pegalo.",
    targets: ["Ctrl+F", "Escape", "Ctrl+A", "Ctrl+C", "Ctrl+V"],
    scene: {
      page: "Contacto: la secretaría atiende de 8 a 12. Escribinos a hola@escuela.edu.ar y te respondemos.",
      find: "hola@escuela.edu.ar",
      sourceLabel: "Correo que encontraste",
      source: "hola@escuela.edu.ar",
      targetLabel: "Formulario de contacto",
    },
    steps: [
      { combo: "Ctrl+F", prompt: "Abrí el buscador con Ctrl + F y buscá el correo." },
      { combo: "Escape", prompt: "Ya está a la vista. Cerrá el buscador con Escape.", env: "find-box" },
      { combo: "Ctrl+A", prompt: "Seleccioná el correo con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copialo con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegalo en el formulario con Ctrl + V. Copiar evita equivocarse una letra." },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 4,
    description: "Copiar un correo evita el error de escribirlo mal.",
  }),
  makeActivity({
    worldId: "island11",
    levelNumber: 7,
    title: "Reto de comandos",
    subtitle: "Toda la isla en una tarea",
    instruction: "Mandale el mensaje a tu compañero: copialo, arreglá el error y enviá.",
    listenText: "Seleccioná, copiá, pegá, deshacé el error, volvé a pegar y enviá con Enter.",
    targets: ["Ctrl+A", "Ctrl+C", "Ctrl+V", "Ctrl+Z", "Ctrl+V", "Enter"],
    scene: {
      sourceLabel: "Mensaje para tu compañero",
      source: "Te espero en la biblioteca a las 10.",
      targetLabel: "Chat de la clase",
    },
    steps: [
      { combo: "Ctrl+A", prompt: "Seleccioná el mensaje con Ctrl + A." },
      { combo: "Ctrl+C", prompt: "Copialo con Ctrl + C." },
      { combo: "Ctrl+V", prompt: "Pegalo en el chat con Ctrl + V." },
      { combo: "Ctrl+Z", prompt: "Te diste cuenta de que era el chat equivocado: deshacé con Ctrl + Z." },
      { combo: "Ctrl+V", prompt: "Ya estás en el chat correcto. Pegalo de nuevo con Ctrl + V." },
      {
        combo: "Enter",
        prompt: "Último paso: confirmá el envío con Enter.",
        dialog: {
          app: "Chat de la clase",
          question: "¿Enviar el mensaje a tu compañero?",
          accept: "Enviar",
          cancel: "Todavía no",
          resultAccept: "Mensaje enviado. ¡Terminaste la isla!",
          resultCancel: "El mensaje quedó sin enviar.",
        },
      },
    ],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 5,
    description: "Cerrá la isla usando todos los comandos en una sola tarea.",
  }),
];

/* World 12 — Isla de ventanas y pestañas (engine de atajos). */
const world12: Activity[] = [
  makeActivity({
    worldId: "island12",
    levelNumber: 1,
    title: "Nueva pestaña",
    subtitle: "Ctrl + T",
    instruction: "Hacé el atajo para abrir una pestaña.",
    /* Ojo con la consigna hablada de esta isla: sus atajos se los queda el
       navegador (Ctrl+W hasta cierra la pestaña y se lleva la partida), así
       que se pide tocar el teclado DEL JUEGO y no el de verdad. */
    listenText: "Tocá Control y T en el teclado del juego para abrir una pestaña.",
    targets: ["Ctrl+T", "Ctrl+T", "Ctrl+T"],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 2,
    description: "Abrí una pestaña nueva con Ctrl + T.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 2,
    title: "Cerrar pestaña",
    subtitle: "Ctrl + W",
    instruction: "Hacé el atajo para cerrar la pestaña.",
    listenText: "Tocá Control y W en el teclado del juego para cerrar la pestaña.",
    targets: ["Ctrl+W", "Ctrl+W", "Ctrl+W"],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 2,
    description: "Cerrá una pestaña con Ctrl + W.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 3,
    title: "Cambiar de pestaña",
    subtitle: "Ctrl + Tab",
    instruction: "Hacé el atajo para cambiar de pestaña.",
    listenText: "Tocá Control y Tab en el teclado del juego para cambiar de pestaña.",
    targets: ["Ctrl+Tab", "Ctrl+Tab", "Ctrl+Tab"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 3,
    description: "Pasá a la siguiente pestaña con Ctrl + Tab.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 4,
    title: "Nueva ventana",
    subtitle: "Ctrl + N",
    instruction: "Hacé el atajo para abrir una ventana nueva.",
    listenText: "Mantené Control y apretá N para abrir una ventana nueva.",
    /* Este nivel era Alt+Tab y hubo que cambiarlo: Alt+Tab lo maneja el
       SISTEMA OPERATIVO, no el navegador, así que no hay forma de capturarlo
       — ni con pantalla completa ni con Keyboard Lock, que sólo alcanza a los
       atajos del navegador. Se apretaba y el alumno terminaba en otra
       ventana, fuera del juego. Ctrl+N queda en el mismo tema, ventanas, y
       ese sí se captura. */
    targets: ["Ctrl+N", "Ctrl+N", "Ctrl+N"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 4,
    description: "Una ventana nueva es otra ventana entera, no una pestaña más.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 5,
    title: "Abrir y cerrar",
    subtitle: "Ctrl + T / Ctrl + W",
    instruction: "Hacé cada atajo que aparece.",
    listenText: "Hacé cada atajo que aparece en pantalla.",
    targets: ["Ctrl+T", "Ctrl+W", "Ctrl+T", "Ctrl+W"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 4,
    description: "Combiná abrir y cerrar pestañas.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 6,
    title: "Reto de ventanas",
    subtitle: "Todo mezclado",
    instruction: "Hacé cada atajo de ventanas y pestañas.",
    listenText: "Hacé cada atajo de ventanas y pestañas.",
    targets: ["Ctrl+T", "Ctrl+Tab", "Ctrl+W", "Ctrl+N"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 5,
    description: "Cerrá la isla manejando ventanas y pestañas.",
  }),
  makeActivity({
    worldId: "island12",
    levelNumber: 7,
    title: "Malabares de pestañas",
    subtitle: "El reto más difícil",
    instruction: "Hacé cada atajo que aparece, sin equivocarte.",
    listenText: "Hacé cada atajo que aparece en pantalla.",
    /* Un escalón sobre "Reto de ventanas": la misma familia de atajos pero en
       una tanda más larga y alternando más. NO se suma Ctrl+Shift+Tab: ese se
       enseña en la isla 14, que viene después en el orden pedagógico. */
    targets: ["Ctrl+T", "Ctrl+N", "Ctrl+Tab", "Ctrl+W", "Ctrl+N", "Ctrl+T"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 6,
    description: "Encadená seis atajos de ventanas y pestañas seguidos.",
  }),
];

/* World 13 — Isla de los mensajes: frases amigables. */
const world13: Activity[] = [
  makeActivity({
    worldId: "island13",
    levelNumber: 1,
    title: "Saludos",
    subtitle: "Frases cortas",
    instruction: "Escribí el saludo que aparece.",
    listenText: "Escribí el saludo que aparece.",
    targets: ["Hola", "Buen dia", "Que tal", "Adios"],
    mode: "assisted",
    inputType: "phrase",
    difficulty: 3,
    description: "Practicá saludos amigables.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 2,
    title: "Frases amables",
    subtitle: "Decir cosas lindas",
    instruction: "Escribí la frase completa.",
    listenText: "Escribí la frase completa.",
    targets: ["Gracias amigo", "Muy buen trabajo", "Te quiero mucho"],
    mode: "assisted",
    inputType: "phrase",
    difficulty: 3,
    description: "Escribí frases amables para tus amigos.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 3,
    title: "Mensajes con tilde",
    subtitle: "Acentos",
    instruction: "Escribí el mensaje con su tilde.",
    listenText: "Escribí el mensaje con su tilde.",
    targets: ["¿Cómo estás?", "Estoy acá", "Nos vemos pronto"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Sumá tildes a tus mensajes.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 4,
    title: "Mensajes largos",
    subtitle: "Frases completas",
    instruction: "Escribí el mensaje completo.",
    listenText: "Escribí el mensaje completo.",
    targets: ["Hoy fue un dia genial", "Me encanta jugar contigo"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Escribí mensajes más largos.",
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 5,
    title: "Invitaciones",
    subtitle: "Con signos",
    instruction: "Escribí la invitación con todos sus signos.",
    listenText: "Escribí la invitación con todos sus signos.",
    targets: ["¿Querés jugar?", "¡Vení a mi casa!", "¿Vamos al parque?"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Invitá a un amigo con signos correctos.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 6,
    title: "Reto de mensajes",
    subtitle: "Mensaje completo",
    instruction: "Escribí el mensaje completo tal como aparece.",
    listenText: "Escribí el mensaje completo tal como aparece.",
    targets: ["¡Hola! ¿Cómo estás hoy?", "Gracias por ser mi amigo.", "¡Nos vemos mañana!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Cerrá la isla escribiendo un mensaje completo.",
    requiresAccent: true,
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island13",
    levelNumber: 7,
    title: "Mensaje completo",
    subtitle: "El reto más difícil",
    instruction: "Escribí el mensaje completo.",
    listenText: "Escribí el mensaje completo.",
    /* Un escalón sobre "Reto de mensajes": dos oraciones por mensaje en vez de
       una, manteniendo las tildes y los signos de apertura. */
    targets: [
      "¡Hola! ¿Querés jugar en el parque mañana?",
      "Gracias por invitarme, me divertí mucho.",
      "¡Feliz cumpleaños! Te deseo un día genial.",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 7,
    description: "Escribí mensajes de dos oraciones, con todos sus signos.",
  }),
];

/* World 14 — Isla de atajos avanzados (engine de atajos). */
const world14: Activity[] = [
  makeActivity({
    worldId: "island14",
    levelNumber: 1,
    title: "Repaso de atajos",
    subtitle: "Ctrl + C / V",
    instruction: "Hacé cada atajo que aparece.",
    listenText: "Hacé cada atajo que aparece en pantalla.",
    targets: ["Ctrl+C", "Ctrl+V", "Ctrl+A"],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 3,
    description: "Repasá los atajos que ya conocés.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 2,
    title: "Rehacer",
    subtitle: "Ctrl + Y",
    instruction: "Hacé el atajo para rehacer.",
    listenText: "Mantené Control y apretá Y para rehacer.",
    targets: ["Ctrl+Y", "Ctrl+Z", "Ctrl+Y"],
    mode: "assisted",
    inputType: "shortcut",
    difficulty: 4,
    description: "Aprendé a rehacer con Ctrl + Y.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 3,
    title: "Guardar",
    subtitle: "Ctrl + S",
    instruction: "Hacé el atajo para guardar.",
    listenText: "Mantené Control y apretá S para guardar.",
    targets: ["Ctrl+S", "Ctrl+S", "Ctrl+S"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 4,
    description: "Guardá tu trabajo con Ctrl + S.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 4,
    title: "Pestaña anterior",
    subtitle: "Ctrl + Shift + Tab",
    instruction: "Hacé el atajo de tres teclas.",
    /* Reservado por el navegador, igual que los de la isla 12: se pide el
       teclado del juego y no el real. */
    listenText: "Tocá Control, Shift y Tab en el teclado del juego.",
    targets: ["Ctrl+Shift+Tab", "Ctrl+Shift+Tab"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 5,
    description: "Volvé a la pestaña anterior con tres teclas.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 5,
    title: "Combinaciones largas",
    subtitle: "Tres teclas",
    instruction: "Hacé cada atajo de tres teclas.",
    listenText: "Hacé cada atajo de tres teclas.",
    targets: ["Ctrl+Shift+T", "Ctrl+Shift+Tab", "Ctrl+Shift+N"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 6,
    description: "Practicá combinaciones de tres teclas.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 6,
    title: "Reto experto",
    subtitle: "Todos los atajos",
    instruction: "Hacé cada atajo que aparece.",
    listenText: "Hacé cada atajo que aparece en pantalla.",
    /* Sin Alt+Tab: lo maneja el sistema operativo y no hay forma de
       capturarlo, así que sacaba al alumno del juego (ver la nota del nivel 4
       de la isla 12). Lo reemplaza Ctrl+Shift+N, que ya es de esta isla. */
    targets: ["Ctrl+C", "Ctrl+Shift+Tab", "Ctrl+Shift+N", "Ctrl+S", "Ctrl+Z"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 6,
    description: "Cerrá la isla como un experto en atajos.",
  }),
  makeActivity({
    worldId: "island14",
    levelNumber: 7,
    title: "Maestro de atajos",
    subtitle: "El reto más difícil",
    instruction: "Hacé cada atajo que aparece, sin equivocarte.",
    listenText: "Hacé cada atajo que aparece en pantalla.",
    /* Un escalón sobre "Reto experto": tanda más larga y cargada de atajos de
       TRES teclas, que son los que más cuestan. */
    targets: ["Ctrl+Shift+T", "Ctrl+Y", "Ctrl+Shift+N", "Ctrl+S", "Ctrl+Shift+Tab", "Ctrl+T"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 7,
    description: "Cerrá el juego encadenando los atajos más difíciles.",
  }),
];

/* World 15 — Isla del gran reto: mezcla final de todo lo aprendido. */
const world15: Activity[] = [
  makeActivity({
    worldId: "island15",
    levelNumber: 1,
    title: "Letras veloces",
    subtitle: "Calentamiento",
    instruction: "Presioná rápido cada letra.",
    listenText: "Presioná rápido cada letra que aparece.",
    targets: ["q", "p", "z", "m", "x", "b", "ñ", "v"],
    mode: "independent",
    inputType: "letter",
    difficulty: 3,
    description: "Calentá los dedos para el gran reto.",
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 2,
    title: "Palabras del reto",
    subtitle: "Velocidad",
    instruction: "Escribí cada palabra rápido y bien.",
    listenText: "Escribí cada palabra rápido y bien.",
    targets: ["aventura", "tesoro", "victoria", "campeon"],
    mode: "independent",
    inputType: "word",
    difficulty: 4,
    description: "Escribí palabras con velocidad.",
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 3,
    title: "Frases del reto",
    subtitle: "Frases completas",
    instruction: "Escribí la frase completa.",
    listenText: "Escribí la frase completa.",
    targets: ["soy un gran escritor", "llegue muy lejos", "casi gano el reto"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Escribí frases completas sin errores.",
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 4,
    title: "Signos del reto",
    subtitle: "Puntuación",
    instruction: "Escribí cada frase con todos sus signos.",
    listenText: "Escribí cada frase con todos sus signos.",
    targets: ["¡Qué genial!", "¿Estás listo?", "Hola, amigo."],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Combiná signos y tildes.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 5,
    title: "Correo del reto",
    subtitle: "Email completo",
    instruction: "Escribí la dirección de correo completa.",
    listenText: "Escribí la dirección de correo completa.",
    targets: ["campeon@gmail.com", "ganador@escuela.edu"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Escribí un correo sin errores.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 6,
    title: "Atajos del reto",
    subtitle: "Comandos",
    instruction: "Hacé cada atajo que aparece.",
    listenText: "Hacé cada atajo que aparece en pantalla.",
    targets: ["Ctrl+C", "Ctrl+V", "Ctrl+Z", "Enter"],
    mode: "independent",
    inputType: "shortcut",
    difficulty: 6,
    description: "Demostrá que dominás los atajos.",
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 7,
    title: "Búsqueda del reto",
    subtitle: "Buscar como experto",
    instruction: "Escribí la búsqueda completa y apretá Enter.",
    listenText: "Escribí la búsqueda completa y apretá Enter.",
    targets: ["como ser un campeon de mecanografia", "los mejores juegos de teclado"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Buscá información como un experto.",
  }),
  makeActivity({
    worldId: "island15",
    levelNumber: 8,
    title: "¡Gran final!",
    subtitle: "Todo junto",
    instruction: "Escribí cada frase exactamente como aparece.",
    listenText: "Escribí cada frase exactamente como aparece.",
    targets: [
      "¡Lo logré! Soy un campeón.",
      "Mi correo es campeon@gmail.com.",
      "¿Listo para el final? ¡Vamos!",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "El gran final: todo lo que aprendiste, junto.",
    requiresAccent: true,
    requiresShift: true,
  }),
];

export const activities: Activity[] = [
  ...world1,
  ...world2,
  ...world3,
  ...world4,
  ...world5,
  ...world6,
  ...world7,
  ...world8,
  ...world9,
  ...world10,
  ...world11,
  ...world12,
  ...world13,
  ...world14,
  ...world15,
];

export const activitiesByWorld: Record<Activity["worldId"], Activity[]> = {
  island1: world1,
  island2: world2,
  island3: world3,
  island4: world4,
  island5: world5,
  island6: world6,
  island7: world7,
  island8: world8,
  island9: world9,
  island10: world10,
  island11: world11,
  island12: world12,
  island13: world13,
  island14: world14,
  island15: world15,
};

export const levelActivityIds = activities.map((activity) => activity.id);

export function getActivityById(id?: string): Activity {
  return activities.find((activity) => activity.id === id) ?? activities[0];
}

export function getActivitiesForWorld(worldId: Activity["worldId"]): Activity[] {
  return activitiesByWorld[worldId];
}
