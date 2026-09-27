'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

/**
 * Sigue los analisis lanzados hasta que terminan, aunque el usuario cierre el
 * modal y se vaya a otra pantalla.
 *
 * El polling del listado de estudios solo corre con el modal abierto, asi que
 * lanzar un analisis y seguir trabajando dejaba al usuario sin forma de
 * enterarse. Esto vive en el layout, por encima de las pantallas, para
 * sobrevivir a la navegacion.
 *
 * No se persiste a proposito: recargar la pagina pierde el seguimiento, pero
 * guardarlo obligaria a limpiar entradas viejas o se acumularian analisis
 * fantasma de sesiones anteriores que nunca se resuelven.
 */

export type AnalisisPendiente = {
  estudioId: number;
  patientId: string;
  patientName: string;
  descripcion: string;
};

export type AnalisisTerminado = AnalisisPendiente & {
  /** 'Finalizado' si salio bien, 'Error' si el procesamiento fallo. */
  estado: string;
  /** Lo genera el front: no hay marca de tiempo confiable del backend. */
  terminadoEn: number;
};

type Contexto = {
  pendientes: AnalisisPendiente[];
  terminados: AnalisisTerminado[];
  registrar: (a: AnalisisPendiente) => void;
  descartar: (estudioId: number) => void;
  descartarTodos: () => void;
  /**
   * Pedido de abrir un reporte, dejado por el Topbar y atendido por AppShell.
   *
   * El Topbar vive en el layout y el reporte es estado de AppShell, asi que no
   * puede abrirlo directo. Va por aca en vez de por la URL para no reintroducir
   * la ruta que sacamos: volver de un reporte abierto asi tiene que dejar al
   * usuario donde estaba, no remontar la pantalla.
   */
  aAbrir: AnalisisTerminado | null;
  pedirAbrir: (a: AnalisisTerminado) => void;
  abierto: () => void;
};

const Ctx = createContext<Contexto>({
  pendientes: [],
  terminados: [],
  registrar: () => {},
  descartar: () => {},
  descartarTodos: () => {},
  aAbrir: null,
  pedirAbrir: () => {},
  abierto: () => {},
});

const INTERVALO_MS = 5000;
const TERMINALES = ['Finalizado', 'Error'];

export function AnalisisEnCursoProvider({ children }: { children: ReactNode }) {
  const [pendientes, setPendientes] = useState<AnalisisPendiente[]>([]);
  const [terminados, setTerminados] = useState<AnalisisTerminado[]>([]);
  const [aAbrir, setAAbrir] = useState<AnalisisTerminado | null>(null);

  const registrar = useCallback((a: AnalisisPendiente) => {
    setPendientes(prev => (prev.some(p => p.estudioId === a.estudioId) ? prev : [...prev, a]));
  }, []);

  const descartar = useCallback((estudioId: number) => {
    setTerminados(prev => prev.filter(t => t.estudioId !== estudioId));
  }, []);

  const descartarTodos = useCallback(() => setTerminados([]), []);

  // Abrirlo lo saca de la lista: ya lo viste, la notificacion cumplio.
  const pedirAbrir = useCallback((a: AnalisisTerminado) => {
    setTerminados(prev => prev.filter(t => t.estudioId !== a.estudioId));
    setAAbrir(a);
  }, []);

  const abierto = useCallback(() => setAAbrir(null), []);

  useEffect(() => {
    if (!pendientes.length) return;
    let cancelado = false;

    const revisar = async () => {
      if (document.visibilityState !== 'visible') return;

      // Un analisis por paciente es lo normal, pero si hay varios del mismo
      // paciente una sola consulta los resuelve a todos.
      const porPaciente = [...new Set(pendientes.map(p => p.patientId))];
      const estados = new Map<number, string>();

      await Promise.all(
        porPaciente.map(async (patientId) => {
          try {
            const res = await fetch(`/estudios/${patientId}`);
            if (!res.ok) return;
            const data = await res.json();
            for (const e of data.estudios as any[]) estados.set(e.estudio_id, e.estado);
          } catch {
            // Un ciclo fallido no molesta: el proximo reintenta.
          }
        })
      );
      if (cancelado || !estados.size) return;

      const recienTerminados = pendientes.filter(
        p => TERMINALES.includes(estados.get(p.estudioId) ?? '')
      );
      if (!recienTerminados.length) return;

      setTerminados(prev => [
        ...prev,
        ...recienTerminados.map(p => ({
          ...p,
          estado: estados.get(p.estudioId)!,
          terminadoEn: Date.now(),
        })),
      ]);
      setPendientes(prev =>
        prev.filter(p => !recienTerminados.some(r => r.estudioId === p.estudioId))
      );
    };

    const id = setInterval(revisar, INTERVALO_MS);
    document.addEventListener('visibilitychange', revisar);
    return () => {
      cancelado = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, [pendientes]);

  return (
    <Ctx.Provider
      value={{ pendientes, terminados, registrar, descartar, descartarTodos, aAbrir, pedirAbrir, abierto }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAnalisisEnCurso = () => useContext(Ctx);
