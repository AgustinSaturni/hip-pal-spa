// Definicion de las rectas que se dibujan sobre las imagenes de los angulos, y
// el overlay que las pinta.
//
// Vive aparte porque lo comparten el visor y el reporte imprimible: si cada uno
// tuviera su propia copia, el PDF podria terminar mostrando rectas distintas de
// las que se ven en pantalla.

export type Pt = { x: number; y: number }

export type Recta = { from: string; to: string; color: string; extend?: number }

// Las rectas de los angulos axiales. El editor las hace arrastrables; el modal
// de visualizacion las dibuja igual pero sin handles.
export const RECTAS_AXIAL: Recta[] = [
  { from: 'centroide_der', to: 'aasa_der', color: '#ef4444' },
  { from: 'centroide_der', to: 'pasa_der', color: '#3b82f6' },
  { from: 'centroide_izq', to: 'aasa_izq', color: '#ef4444' },
  { from: 'centroide_izq', to: 'pasa_izq', color: '#3b82f6' },
]

// La recta del centro-borde anterior. El backend la dibujaba extendida al
// doble, asi que el overlay hace lo mismo para caer donde estaba.
export const RECTAS_SAGITAL: Recta[] = [
  { from: 'centroide', to: 'punto_filo', color: '#ef4444', extend: 2 },
]

// Coronal hornea dos imagenes distintas que comparten los mismos puntos: una
// por angulo.
export const RECTAS_CORONAL_LATERAL: Recta[] = [
  { from: 'centroide_der', to: 'filo_superior_der', color: '#ef4444' },
  { from: 'centroide_izq', to: 'filo_superior_izq', color: '#ef4444' },
]
export const RECTAS_CORONAL_INCLINACION: Recta[] = [
  { from: 'filo_inferior_der', to: 'filo_superior_der', color: '#eab308' },
  { from: 'filo_inferior_izq', to: 'filo_superior_izq', color: '#eab308' },
]

// Alfa: los colores horneados se invertian segun el lado; el overlay usa
// siempre rojo = anterior y verde = posterior, que es mas legible.
export const RECTAS_ALFA: Recta[] = [
  { from: 'centroide', to: 'punto_horario', color: '#ef4444' },
  { from: 'centroide', to: 'punto_antihorario', color: '#22c55e' },
  { from: 'centroide', to: 'punto_bisectriz', color: '#3b82f6' },
]

// Overlay de solo lectura sobre una imagen ya renderizada. Desde que el backend
// dejo de hornear las rectas en el PNG, esta es la unica forma de verlas fuera
// del editor. pointer-events none para no comerse los clicks del modal.
export function OverlayRectas({ puntos, rectas }: { puntos: Record<string, Pt | null>; rectas: Recta[] }) {
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {rectas.map(({ from, to, color, extend }) => {
        const c = puntos[from]
        const q = puntos[to]
        if (!c || !q) return null
        const k = extend ?? 1
        return (
          <line
            key={`${from}-${to}`}
            x1={c.x * 100} y1={c.y * 100}
            x2={(c.x + (q.x - c.x) * k) * 100} y2={(c.y + (q.y - c.y) * k) * 100}
            stroke={color}
            strokeWidth="0.6"
            opacity="0.9"
          />
        )
      })}
    </svg>
  )
}
