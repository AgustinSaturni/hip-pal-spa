'use client';

import { useEffect, useRef, useState } from 'react';

interface Instancia {
  id: string;
  instance_number: string | null;
}

// Cuantos cortes vecinos se piden por adelantado. Chico a proposito: el
// navegador abre ~6 conexiones por origen, asi que una ventana grande no
// acelera nada y encima demora el corte que el usuario esta mirando.
const VECINOS_PRECARGA = 3;

const urlCorte = (id: string) => `/api/pacs/instances/${id}/preview`;

export default function VisorDicom({
  seriesUuid,
  descripcion,
  onClose,
}: {
  seriesUuid: string;
  descripcion?: string;
  onClose: () => void;
}) {
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [idx, setIdx] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [primerCorteListo, setPrimerCorteListo] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await fetch(`/api/pacs/series/${seriesUuid}/instances`);
        if (!res.ok) throw new Error('No se pudieron cargar los cortes');
        const data = await res.json();
        if (cancelado) return;
        setInstancias(data.instances ?? []);
        setIdx(Math.floor((data.instances?.length ?? 1) / 2));
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [seriesUuid]);

  // Precarga de vecinos: el navegador las deja en su cache HTTP, asi que al
  // llegar a ese corte el <img> lo resuelve sin pedir nada.
  useEffect(() => {
    if (!instancias.length) return;
    for (let d = 1; d <= VECINOS_PRECARGA; d++) {
      for (const j of [idx - d, idx + d]) {
        if (j >= 0 && j < instancias.length) new Image().src = urlCorte(instancias[j].id);
      }
    }
  }, [idx, instancias]);

  // Teclado: flechas para moverse de a un corte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      const paso = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1
        : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!paso) return;
      e.preventDefault();
      setIdx((i) => Math.min(instancias.length - 1, Math.max(0, i + paso)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [instancias.length, onClose]);

  const actual = instancias[idx];

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[85]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Visor</p>
            <h3 className="text-base font-bold text-gray-900 truncate">{descripcion || 'Serie'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          ref={contenedorRef}
          className="bg-black flex items-center justify-center relative"
          style={{ minHeight: 360 }}
          onWheel={(e) => {
            if (!instancias.length) return;
            setIdx((i) => Math.min(instancias.length - 1, Math.max(0, i + (e.deltaY > 0 ? 1 : -1))));
          }}
        >
          {cargando ? (
            <p className="text-gray-400 text-sm py-24">Cargando cortes...</p>
          ) : error ? (
            <p className="text-red-400 text-sm py-24">{error}</p>
          ) : !actual ? (
            <p className="text-gray-400 text-sm py-24">La serie no tiene cortes</p>
          ) : (
            <>
              {/* Un solo <img> que cambia de src: el navegador deja ver el corte
                  anterior hasta que el nuevo decodifica, asi no parpadea. */}
              <img
                src={urlCorte(actual.id)}
                alt={`Corte ${idx + 1}`}
                draggable={false}
                onLoad={() => setPrimerCorteListo(true)}
                style={{ maxHeight: '62vh', maxWidth: '100%', display: 'block' }}
              />
              {!primerCorteListo && (
                <p className="absolute text-gray-400 text-sm">Cargando corte...</p>
              )}
              <span className="absolute top-2 right-3 text-[11px] text-gray-300 font-mono bg-black/50 px-2 py-0.5 rounded">
                {idx + 1} / {instancias.length}
              </span>
            </>
          )}
        </div>

        {instancias.length > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={instancias.length - 1}
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <span className="text-xs text-gray-500 font-mono w-20 text-right shrink-0">
              #{actual?.instance_number ?? idx + 1}
            </span>
          </div>
        )}

        <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400">
          Rueda del mouse o flechas para recorrer los cortes · Esc para cerrar
        </div>
      </div>
    </div>
  );
}
