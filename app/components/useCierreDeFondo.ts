import { useRef, MouseEvent } from 'react';

/**
 * Cierra un modal cuando se hace click sobre el fondo oscuro.
 *
 * Exige que el gesto haya empezado tambien en el fondo. Sin eso, soltar ahi un
 * arrastre que empezo adentro -los puntos del editor de angulos, el slider del
 * visor- contaria como click afuera y cerraria el modal a mitad de la edicion.
 *
 * Se aplica al div del fondo: <div className="fixed inset-0 ..." {...cierre}>.
 * No hace falta stopPropagation en el contenido: el click solo cuenta si el
 * target es el fondo mismo.
 */
export function useCierreDeFondo(onClose: () => void) {
  const desdeElFondo = useRef(false);
  return {
    onMouseDown: (e: MouseEvent) => {
      desdeElFondo.current = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent) => {
      if (desdeElFondo.current && e.target === e.currentTarget) onClose();
    },
  };
}
