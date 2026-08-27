import { useId } from "react";

/* Estrellas de puntuación con look de juego premium: relleno dorado con
   gradiente, halo cálido suave y un brillo (glint) arriba para un toque 3D.
   Las vacías quedan como una estrella de vidrio translúcida — legible sobre
   el arte sin verse "apagada". Reemplaza a las estrellas planas de lucide. */

const STAR_PATH =
  "M12 2.1l2.96 6 6.62.97-4.79 4.67 1.13 6.6L12 18.2 6.08 20.34l1.13-6.6L2.42 9.07l6.62-.97z";

function Star({ filled, size }: { filled: boolean; size: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{
        display: "block",
        filter: filled
          ? "drop-shadow(0 1px 2px rgba(245,170,30,0.55))"
          : "drop-shadow(0 1px 1px rgba(40,70,120,0.18))",
      }}
    >
      <defs>
        <linearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6cf" />
          <stop offset="42%" stopColor="#ffd64f" />
          <stop offset="100%" stopColor="#f5a51c" />
        </linearGradient>
      </defs>
      <path
        d={STAR_PATH}
        fill={filled ? `url(#fill${id})` : "rgba(255,255,255,0.32)"}
        stroke={filled ? "#e08c12" : "rgba(255,255,255,0.7)"}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {filled && (
        /* Glint: pequeño reflejo curvo arriba a la izquierda para el toque 3D. */
        <path
          d="M9.4 6.2c.7-.9 1.7-1.5 2.6-1.6"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function LevelStars({
  earned,
  total = 3,
  size = 16,
  gap = 1,
  className = "",
}: {
  earned: number;
  total?: number;
  size?: number;
  /** Separación entre estrellas en px. */
  gap?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ gap: `${gap}px` }}
      aria-label={`${earned} de ${total} estrellas`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <Star key={i} filled={i < earned} size={size} />
      ))}
    </span>
  );
}
