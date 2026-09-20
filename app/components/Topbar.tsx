'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useBreadcrumb } from './Breadcrumb';
import { useAnalisisEnCurso } from './AnalisisEnCurso';
import { useCierreDeFondo } from './useCierreDeFondo';

const titulos: Record<string, string> = {
  '/': 'Buscar Paciente',
};

export default function Topbar() {
  const pathname = usePathname();
  const { detalle } = useBreadcrumb();
  const { pendientes, terminados, descartar, descartarTodos, pedirAbrir } = useAnalisisEnCurso();
  const [abierto, setAbierto] = useState(false);
  const cierrePanel = useCierreDeFondo(() => setAbierto(false));
  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-30">
      {/* Breadcrumb / Page title */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Hip-Pal</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">
          {detalle ?? titulos[pathname] ?? 'Hip-Pal'}
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notificaciones de analisis */}
        <div className="relative">
          <button
            onClick={() => setAbierto(v => !v)}
            disabled={!pendientes.length && !terminados.length}
            className={`relative p-2 rounded-lg transition-colors ${
              terminados.length
                ? 'text-gray-600 hover:bg-gray-100'
                : pendientes.length
                ? 'text-gray-500 hover:bg-gray-100'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            title={
              terminados.length
                ? `${terminados.length} análisis terminado(s)`
                : pendientes.length
                ? `${pendientes.length} análisis en curso`
                : 'Sin notificaciones'
            }
          >
            <BellIcon />
            {terminados.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                {terminados.length}
              </span>
            )}
            {/* En curso: un punto que late, sin numero, para no competir con el
                contador de los que si requieren atencion. */}
            {!terminados.length && pendientes.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </button>

          {abierto && (
            <>
              <div className="fixed inset-0 z-40" {...cierrePanel} />
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Análisis
                  </span>
                  {terminados.length > 1 && (
                    <button onClick={descartarTodos} className="text-xs text-gray-400 hover:text-gray-700">
                      Limpiar
                    </button>
                  )}
                </div>

                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {terminados.map((t) => {
                    const abrible = t.estado !== 'Error';
                    return (
                    <li
                      key={t.estudioId}
                      className={`px-4 py-3 flex items-start gap-3 ${abrible ? 'hover:bg-blue-50 transition-colors' : ''}`}
                    >
                      <span
                        className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                          t.estado === 'Error' ? 'bg-red-500' : 'bg-green-500'
                        }`}
                      />
                      <button
                        onClick={() => { if (abrible) { setAbierto(false); pedirAbrir(t); } }}
                        disabled={!abrible}
                        title={abrible ? 'Ver resultados' : undefined}
                        className={`min-w-0 flex-1 text-left ${abrible ? '' : 'cursor-default'}`}
                      >
                        <p className="text-sm font-medium text-gray-900 truncate">{t.patientName}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {t.descripcion} · {t.estado === 'Error' ? 'Falló el análisis' : 'Ver resultados'}
                        </p>
                      </button>
                      <button
                        onClick={() => descartar(t.estudioId)}
                        title="Descartar"
                        className="p-1 text-gray-300 hover:text-gray-600 shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                    );
                  })}

                  {pendientes.map((p) => (
                    <li key={p.estudioId} className="px-4 py-3 flex items-start gap-3">
                      <svg className="mt-0.5 animate-spin w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{p.patientName}</p>
                        <p className="text-xs text-gray-400 truncate">{p.descripcion} · Procesando</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* Doctor profile */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">Dr. Martínez</p>
            <p className="text-[11px] text-gray-500">Traumatología</p>
          </div>
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-blue-600">DM</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}
