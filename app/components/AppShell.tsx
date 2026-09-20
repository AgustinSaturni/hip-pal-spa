'use client';

import { useState, useEffect } from 'react';
import { Patient, SearchResponse, Series, SeriesResponse } from '../types';
import VisorDicom from './VisorDicom';
import ResultadosMedicion from './ResultadosMedicion';
import { useCierreDeFondo } from './useCierreDeFondo';
import { useBreadcrumb } from './Breadcrumb';

const angleGroups = [
  {
    name: 'Plano Coronal',
    angles: [
      { id: 'centro_borde_lateral', label: 'Centro-Borde Lateral (Wiberg)' },
      { id: 'inclinacion_acetabular', label: 'Inclinación Acetabular (Sharp/Tönnis)' },
    ],
  },
  {
    name: 'Plano Axial',
    angles: [
      { id: 'axial_proximal', label: 'AASA / PASA / HASA — Proximal' },
      { id: 'axial_intermedio', label: 'AASA / PASA / HASA — Intermedio' },
      { id: 'axial_ecuatorial', label: 'AASA / PASA / HASA — Ecuatorial' },
    ],
  },
  {
    name: 'Plano Sagital',
    angles: [
      { id: 'centro_borde_anterior', label: 'Centro-Borde Anterior' },
    ],
  },
  {
    name: 'Ángulo Alfa',
    angles: [
      { id: 'alfa_hora_12', label: 'Hora 12' },
      { id: 'alfa_hora_1', label: 'Hora 1' },
      { id: 'alfa_hora_2', label: 'Hora 2' },
      { id: 'alfa_hora_3', label: 'Hora 3' },
      { id: 'alfa_hora_4', label: 'Hora 4' },
      { id: 'alfa_hora_5', label: 'Hora 5' },
    ],
  },
];

const allAngleIds = angleGroups.flatMap((g) => g.angles.map((a) => a.id));

// Un analisis tarda minutos, asi que 5s alcanza para que se sienta vivo sin
// castigar al backend.
const INTERVALO_REFRESCO_MS = 5000;

export default function AppShell() {
  const [searchName, setSearchName] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSuccess, setAnalysisSuccess] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedAngles, setSelectedAngles] = useState<string[]>([...allAngleIds]);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        nombre: searchName,
        apellido: '',
      });

      const response = await fetch(`/api/pacs/patients/search?${params}`);

      if (!response.ok) {
        throw new Error('Error al buscar pacientes');
      }

      const data: SearchResponse = await response.json();
      setPatients(data.patients);
      setTotal(data.total);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setPatients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [visorSerie, setVisorSerie] = useState<Series | null>(null);
  const [showMedicionesModal, setShowMedicionesModal] = useState(false);
  const [medicionesPatient, setMedicionesPatient] = useState<Patient | null>(null);
  const [estudios, setEstudios] = useState<any[]>([]);
  const [loadingEstudios, setLoadingEstudios] = useState(false);
  const [estudiosError, setEstudiosError] = useState<string | null>(null);
  const [deletingEstudioId, setDeletingEstudioId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [resultadosEstudioId, setResultadosEstudioId] = useState<number | null>(null);

  const handlePatientClick = async (patient: Patient) => {
    setSelectedPatient(patient);
    setLoadingSeries(true);
    setSeriesError(null);
    setSeries([]);
    setShowSeriesModal(true);
    setSelectedSeries(null);
    setAnalysisSuccess(false);
    setAnalysisError(null);

    try {
      const response = await fetch(`/api/pacs/patients/${patient.patient_id}/series`);

      if (!response.ok) {
        throw new Error('Error al cargar las series del paciente');
      }

      const data: SeriesResponse = await response.json();
      const filteredSeries = data.series.filter((s) => {
        const desc = s.description.toLowerCase();
        return desc.includes('bone') || desc.includes('hueso');
      });
      setSeries(filteredSeries);
    } catch (err) {
      setSeriesError(err instanceof Error ? err.message : 'Error desconocido');
      setSeries([]);
    } finally {
      setLoadingSeries(false);
    }
  };

  const handleSeriesClick = (seriesItem: Series) => {
    setSelectedSeries(seriesItem);
    setAnalysisSuccess(false);
    setAnalysisError(null);
    setSelectedAngles([...allAngleIds]);
  };

  const toggleAngle = (id: string) => {
    setSelectedAngles((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const toggleGroup = (group: typeof angleGroups[number]) => {
    const groupIds = group.angles.map((a) => a.id);
    const allSelected = groupIds.every((id) => selectedAngles.includes(id));
    if (allSelected) {
      setSelectedAngles((prev) => prev.filter((id) => !groupIds.includes(id)));
    } else {
      setSelectedAngles((prev) => [...new Set([...prev, ...groupIds])]);
    }
  };

  const handleBackToSeries = () => {
    setSelectedSeries(null);
    setAnalysisSuccess(false);
    setAnalysisError(null);
  };

  const traerEstudios = async (patientId: string) => {
    const response = await fetch(`/estudios/${patientId}`);
    if (!response.ok) throw new Error('Error al cargar estudios');
    return (await response.json()).estudios as any[];
  };

  const handleMedicionesClick = async (patient: Patient) => {
    setMedicionesPatient(patient);
    setShowMedicionesModal(true);
    setLoadingEstudios(true);
    setEstudiosError(null);
    setEstudios([]);

    try {
      setEstudios(await traerEstudios(patient.patient_id));
    } catch (err) {
      setEstudiosError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoadingEstudios(false);
    }
  };

  // Un estudio deja de moverse cuando termina, con o sin exito. Sin contar
  // 'Error' como terminal, el polling quedaria girando para siempre sobre algo
  // que ya no va a cambiar.
  const enCurso = (estado: string) => estado !== 'Finalizado' && estado !== 'Error';

  const hayEnCurso = estudios.some(e => enCurso(e.estado));

  // Refresca el listado mientras haya algo procesandose. Antes se cargaba una
  // sola vez al abrir el modal y quedaba congelado: un estudio que terminaba
  // seguia figurando 'Procesando' hasta cerrar y volver a abrir.
  //
  // Las tres condiciones importan: sin la de estudios en curso quedaria
  // consultando para siempre un listado que ya no cambia, y sin la de
  // visibilidad seguiria pegandole al backend con la pestaña en segundo plano.
  useEffect(() => {
    const patientId = medicionesPatient?.patient_id;
    if (!showMedicionesModal || !patientId) return;
    if (!hayEnCurso) return;

    let cancelado = false;

    const refrescar = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const frescos = await traerEstudios(patientId);
        // El usuario pudo cerrar el modal o borrar un estudio mientras la
        // request estaba en vuelo; sin esto la respuesta vieja lo resucita.
        if (!cancelado) setEstudios(frescos);
      } catch {
        // Un tick fallido no molesta al usuario: el proximo reintenta.
      }
    };

    const id = setInterval(refrescar, INTERVALO_REFRESCO_MS);
    // Volver a la pestaña no deberia esperar al proximo tick.
    document.addEventListener('visibilitychange', refrescar);

    return () => {
      cancelado = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', refrescar);
    };
    // Depende de si hay algo en curso y no del array: 'estudios' cambia de
    // identidad en cada refresco y el intervalo se estaria recreando en cada
    // tick.
  }, [showMedicionesModal, medicionesPatient?.patient_id, hayEnCurso]);

  const handleCloseMedicionesModal = () => {
    setShowMedicionesModal(false);
    setMedicionesPatient(null);
    setConfirmDeleteId(null);
  };

  const handleDeleteEstudio = async (estudioId: number) => {
    setDeletingEstudioId(estudioId);
    setConfirmDeleteId(null);
    try {
      const response = await fetch(`/estudios/${estudioId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Error al eliminar el estudio');
      setEstudios(prev => prev.filter(e => e.estudio_id !== estudioId));
      return true;
    } catch (err) {
      setEstudiosError(err instanceof Error ? err.message : 'Error desconocido');
      return false;
    } finally {
      setDeletingEstudioId(null);
    }
  };

  // Borrado desde la vista de resultados: si el estudio borrado era el que se
  // estaba viendo, hay que vaciar el detalle.
  const borrarDesdeResultados = async (estudioId: number) => {
    const ok = await handleDeleteEstudio(estudioId);
    if (ok && resultadosEstudioId === estudioId) setResultadosEstudioId(null);
  };

  // El ojito reemplaza la vista de busqueda por los resultados a pantalla
  // completa. No es una ruta aparte a proposito: al volver, el modal de
  // estudios y la busqueda de pacientes siguen como estaban.
  const irAResultados = (estudioId: number) => setResultadosEstudioId(estudioId);

  const volverDeResultados = () => {
    setResultadosEstudioId(null);
    setConfirmDeleteId(null);
  };


  const handleCloseSeriesModal = () => {
    setShowSeriesModal(false);
    setSelectedSeries(null);
    setAnalysisSuccess(false);
    setAnalysisError(null);
  };

  const handleAnalyze = async () => {
    if (!selectedSeries || !selectedPatient) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/serie', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serie: selectedSeries.uuid,
          patient_id: selectedPatient.patient_id,
          nombre: formatPatientName(selectedPatient.patient_name),
          angulos: selectedAngles,
          descripcion: selectedSeries.description,
          instancias: selectedSeries.num_instances,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar la serie');
      }

      setAnalysisSuccess(true);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // El breadcrumb del Topbar no puede deducir esta vista del pathname: la
  // navegacion a los resultados es estado local, no una ruta.
  const { setDetalle } = useBreadcrumb();
  useEffect(() => {
    setDetalle(resultadosEstudioId ? 'Resultados de Medición' : null);
    return () => setDetalle(null);
  }, [resultadosEstudioId, setDetalle]);

  const cierreSeries = useCierreDeFondo(handleCloseSeriesModal);
  const cierreMediciones = useCierreDeFondo(handleCloseMedicionesModal);
  const cierreConfirmar = useCierreDeFondo(() => setConfirmDeleteId(null));
  const cierreConfirmarModal = useCierreDeFondo(() => setConfirmDeleteId(null));

  const formatPatientName = (patientName: string) => {
    return patientName.replace(/\^/g, ' ').trim();
  };

  const estudioActual = estudios.find((e) => e.estudio_id === resultadosEstudioId);

  const fmtFecha = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;

  // Los resultados reemplazan la vista de busqueda en lugar de vivir en una
  // pestaña propia: se llega desde el modal de estudios del paciente y se
  // vuelve ahi mismo, con la busqueda y el modal intactos.
  const vistaResultados = medicionesPatient && (
    <div className="space-y-5">
      {/* Cabecera en una sola barra: volver, de quien es el estudio que se esta
          viendo, y borrarlo. Para cambiar de estudio se vuelve al modal. */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 flex items-center gap-4">
        <button
          onClick={volverDeResultados}
          className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 text-sm font-medium text-gray-500 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Volver
        </button>

        <div className="h-9 w-px bg-gray-200 shrink-0" />

        <div className="min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate leading-tight">
            {formatPatientName(medicionesPatient.patient_name)}
          </h1>
          <p className="text-xs truncate">
            <span className="text-gray-400">Fecha:</span>{' '}
            <span className="text-gray-600">{fmtFecha(estudioActual?.created_at) ?? '—'}</span>
            {estudioActual?.descripcion && (
              <>
                <span className="mx-2 text-gray-300">·</span>
                <span className="text-gray-400">Descripción:</span>{' '}
                <span className="text-gray-600">{estudioActual.descripcion}</span>
              </>
            )}
          </p>
        </div>

        {estudioActual && estudioActual.estado !== 'Procesando' && (
          <button
            onClick={() => setConfirmDeleteId(estudioActual.estudio_id)}
            disabled={deletingEstudioId === estudioActual.estudio_id}
            title="Eliminar estudio"
            className="ml-auto shrink-0 p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:text-gray-200"
          >
            {deletingEstudioId === estudioActual.estudio_id ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            )}
          </button>
        )}
      </div>

      {estudiosError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {estudiosError}
        </div>
      )}

      <ResultadosMedicion estudioId={resultadosEstudioId!} />

      {confirmDeleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[80]" {...cierreConfirmar}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-6 overflow-hidden">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Eliminar estudio</h3>
                  <p className="text-sm text-gray-500">Estudio #{confirmDeleteId}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Esta acción eliminará el estudio, sus mediciones e imágenes permanentemente. No se puede deshacer.
              </p>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => borrarDesdeResultados(confirmDeleteId)}
                className="px-4 py-2 text-sm bg-red-600 text-white font-medium rounded-md hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (resultadosEstudioId && vistaResultados) return vistaResultados;

  return (
    <div className="max-w-5xl mx-auto">
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del paciente
              </label>
              <input
                id="nombre"
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="Buscar por nombre..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Tabla de resultados */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-1/5 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="w-1/5 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID Paciente
                </th>
                <th className="w-1/5 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estudios
                </th>
                <th className="w-1/5 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Series
                </th>
                <th className="w-1/5 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mediciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!hasSearched ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    Ingrese los criterios de búsqueda y presione el botón Buscar
                  </td>
                </tr>
              ) : patients.length > 0 ? (
                patients.map((patient) => (
                    <tr
                      key={patient.patient_id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {formatPatientName(patient.patient_name)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {patient.patient_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {patient.num_studies}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => handlePatientClick(patient)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Ver series"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => handleMedicionesClick(patient)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="Ver mediciones"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No se encontraron pacientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasSearched && !error && (
          <div className="mt-4 text-sm text-gray-600">
            Mostrando {patients.length} de {total} pacientes
          </div>
        )}

        {/* Modal de Series del Paciente */}
        {showSeriesModal && selectedPatient && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" {...cierreSeries}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {!selectedSeries ? 'Series del Paciente' : analysisSuccess ? 'Análisis Enviado' : 'Confirmar Análisis'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {formatPatientName(selectedPatient.patient_name)} (ID: {selectedPatient.patient_id})
                  </p>
                </div>
                <button
                  onClick={handleCloseSeriesModal}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                {!selectedSeries ? (
                  <>
                    {seriesError && (
                      <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                        {seriesError}
                      </div>
                    )}

                    {loadingSeries ? (
                      <div className="p-8 text-center">
                        <p className="text-gray-500">Cargando series...</p>
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Descripción
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Modalidad
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Origen
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Instancias
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ver
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {series.length > 0 ? (
                            series.map((seriesItem) => (
                              <tr
                                key={seriesItem.uuid}
                                onClick={() => handleSeriesClick(seriesItem)}
                                className="hover:bg-blue-50 cursor-pointer transition-colors"
                              >
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">
                                  {seriesItem.description}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {seriesItem.modality}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                  {seriesItem.origen ? (
                                    <span
                                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                        seriesItem.origen === 'Original'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}
                                      title={seriesItem.origen === 'Original'
                                        ? 'Adquisición original del tomógrafo'
                                        : 'Reconstrucción de la estación: puede traer cortes vacíos'}
                                    >
                                      {seriesItem.origen}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {seriesItem.num_instances}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setVisorSerie(seriesItem); }}
                                    title="Ver cortes"
                                    className="p-1 text-gray-300 hover:text-blue-600 transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                No se encontraron series para este paciente
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </>
                ) : !analysisSuccess ? (
                  <div className="p-6">
                    {/* Serie info compacta */}
                    <div className="flex items-center gap-3 mb-5 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{selectedSeries.description}</p>
                        <div className="flex gap-4 mt-0.5">
                          <span className="text-xs text-gray-500">Serie #{selectedSeries.series_number}</span>
                          <span className="text-xs text-gray-500">{selectedSeries.modality}</span>
                          <span className="text-xs text-gray-500">{selectedSeries.num_instances} instancias</span>
                        </div>
                      </div>
                    </div>

                    {/* Ángulos */}
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Seleccione los ángulos a medir:
                    </p>

                    <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                      {angleGroups.map((group) => {
                        const groupIds = group.angles.map((a) => a.id);
                        const allSelected = groupIds.every((id) => selectedAngles.includes(id));
                        return (
                          <div key={group.name} className="bg-gray-50 rounded-lg p-3">
                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() => toggleGroup(group)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300"
                              />
                              <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">{group.name}</span>
                            </label>
                            <ul className="ml-6 space-y-1">
                              {group.angles.map((angle) => (
                                <li key={angle.id} className="flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0"></span>
                                  <span className="text-xs text-gray-500">{angle.label}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>

                    {analysisError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mt-4 text-sm">
                        {analysisError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      ¡Procesamiento Iniciado!
                    </h3>
                    <p className="text-gray-600">
                      La tomografía está siendo procesada. Recibirás una notificación cuando esté lista.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {!(selectedSeries && analysisSuccess) && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                {!selectedSeries ? (
                  <span className="text-sm text-gray-500">
                    {series.length} {series.length === 1 ? 'serie' : 'series'}
                  </span>
                ) : !analysisSuccess ? (
                  <>
                    <button
                      onClick={handleBackToSeries}
                      disabled={isAnalyzing}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Volver
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || selectedAngles.length === 0 || angleGroups.every(g => !g.angles.some(a => selectedAngles.includes(a.id)))}
                      className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAnalyzing ? 'Procesando...' : `Analizar (${angleGroups.filter(g => g.angles.every(a => selectedAngles.includes(a.id))).length} secciones)`}
                    </button>
                  </>
                ) : null}
              </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Mediciones del Paciente */}
        {showMedicionesModal && medicionesPatient && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" {...cierreMediciones}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col relative">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Mediciones del Paciente</h2>
                  <p className="text-sm text-gray-500">
                    {formatPatientName(medicionesPatient.patient_name)} (ID: {medicionesPatient.patient_id})
                  </p>
                </div>
                <button
                  onClick={handleCloseMedicionesModal}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto">
                {estudiosError && (
                  <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {estudiosError}
                  </div>
                )}

                {loadingEstudios ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">Cargando estudios...</p>
                  </div>
                ) : estudios.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Descripción
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Instancias
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Eliminar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {estudios.map((estudio) => (
                        <tr
                          key={estudio.estudio_id}
                          onClick={() => estudio.estado === 'Finalizado' && irAResultados(estudio.estudio_id)}
                          title={estudio.estado === 'Finalizado' ? 'Ver resultados' : undefined}
                          className={`transition-colors ${
                            estudio.estado === 'Finalizado' ? 'hover:bg-blue-50 cursor-pointer' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {estudio.created_at ? new Date(estudio.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 text-center">
                            {estudio.descripcion || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {estudio.instancias || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              estudio.estado === 'Finalizado' ? 'bg-green-100 text-green-700' :
                              estudio.estado === 'Procesando' ? 'bg-blue-100 text-blue-700' :
                              estudio.estado === 'Error' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {estudio.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            {estudio.estado !== 'Procesando' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(estudio.estudio_id); }}
                                disabled={deletingEstudioId === estudio.estudio_id}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                title="Eliminar estudio"
                              >
                                {deletingEstudioId === estudio.estudio_id ? (
                                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                    </svg>
                    <p className="text-sm font-medium">No hay estudios registrados</p>
                    <p className="text-xs mt-1">Los estudios aparecerán aquí una vez procesados</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  {estudios.length} {estudios.length === 1 ? 'estudio' : 'estudios'}
                </span>
              </div>

              {/* Modal de confirmación de borrado */}
              {confirmDeleteId !== null && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg z-10" {...cierreConfirmarModal}>
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-6 overflow-hidden">
                    <div className="px-6 py-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full shrink-0">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">Eliminar estudio</h3>
                          <p className="text-sm text-gray-500">Estudio #{confirmDeleteId}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        Esta acción eliminará el estudio, sus mediciones e imágenes permanentemente. No se puede deshacer.
                      </p>
                    </div>
                    <div className="px-6 pb-5 flex justify-end gap-2">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleDeleteEstudio(confirmDeleteId)}
                        className="px-4 py-2 text-sm bg-red-600 text-white font-medium rounded-md hover:bg-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


        {visorSerie && (
          <VisorDicom
            seriesUuid={visorSerie.uuid}
            descripcion={visorSerie.description}
            onClose={() => setVisorSerie(null)}
          />
        )}


    </div>
  );
}
