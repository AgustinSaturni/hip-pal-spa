'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAnalisisEnCurso, AnalisisTerminado } from './AnalisisEnCurso';

/**
 * Avisos de fin de analisis, abajo a la derecha.
 *
 * Son efimeros: se van solos a los 10 segundos. Cerrarlos -o dejar que se
 * vayan- no descarta nada, la notificacion sigue en la campana del Topbar. El
 * aviso es para enterarte en el momento; la campana es el registro de lo que
 * todavia no miraste.
 */

const DURACION_MS = 10000;

function Aviso({
  aviso, onCerrar, onAbrir,
}: {
  aviso: AnalisisTerminado;
  onCerrar: (estudioId: number) => void;
  onAbrir: (a: AnalisisTerminado) => void;
}) {
  useEffect(() => {
    const id = setTimeout(() => onCerrar(aviso.estudioId), DURACION_MS);
    return () => clearTimeout(id);
  }, [aviso.estudioId, onCerrar]);

  const fallo = aviso.estado === 'Error';

  return (
    <div
      style={{ animation: 'aviso-entra 200ms ease-out' }}
      className="w-80 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden flex items-start gap-3 px-4 py-3"
    >
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${fallo ? 'bg-red-500' : 'bg-green-500'}`} />

      <button
        onClick={() => !fallo && onAbrir(aviso)}
        disabled={fallo}
        className={`min-w-0 flex-1 text-left ${fallo ? 'cursor-default' : ''}`}
        title={fallo ? undefined : 'Ver resultados'}
      >
        <p className="text-sm font-semibold text-gray-900 truncate">
          {fallo ? 'Falló el análisis' : 'Análisis terminado'}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {aviso.patientName} · {aviso.descripcion}
        </p>
        {!fallo && <p className="text-xs text-blue-600 mt-0.5">Ver resultados</p>}
      </button>

      <button
        onClick={() => onCerrar(aviso.estudioId)}
        title="Cerrar"
        className="p-1 text-gray-300 hover:text-gray-600 shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function AvisosAnalisis() {
  const { terminados, pedirAbrir } = useAnalisisEnCurso();
  const [cerrados, setCerrados] = useState<number[]>([]);

  const cerrar = useCallback((estudioId: number) => {
    setCerrados(prev => (prev.includes(estudioId) ? prev : [...prev, estudioId]));
  }, []);

  // Si el estudio ya no esta en terminados -se abrio o se descarto desde la
  // campana- no hace falta seguir recordando que su aviso estaba cerrado.
  useEffect(() => {
    setCerrados(prev => prev.filter(id => terminados.some(t => t.estudioId === id)));
  }, [terminados]);

  const visibles = terminados.filter(t => !cerrados.includes(t.estudioId));
  if (!visibles.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {visibles.map(t => (
        <Aviso key={t.estudioId} aviso={t} onCerrar={cerrar} onAbrir={pedirAbrir} />
      ))}
    </div>
  );
}
