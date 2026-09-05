'use client';

import { useState, useRef } from 'react';
import { Patient, SearchResponse, Series, SeriesResponse } from './types';

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

export default function Home() {
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
  const [showMedicionesModal, setShowMedicionesModal] = useState(false);
  const [medicionesPatient, setMedicionesPatient] = useState<Patient | null>(null);
  const [estudios, setEstudios] = useState<any[]>([]);
  const [loadingEstudios, setLoadingEstudios] = useState(false);
  const [estudiosError, setEstudiosError] = useState<string | null>(null);
  const [deletingEstudioId, setDeletingEstudioId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [showResultadosModal, setShowResultadosModal] = useState(false);
  const [resultados, setResultados] = useState<any>(null);
  const [loadingResultados, setLoadingResultados] = useState(false);
  const [resultadosError, setResultadosError] = useState<string | null>(null);
  const [resultadosEstudioId, setResultadosEstudioId] = useState<number | null>(null);

  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [loadingImagen, setLoadingImagen] = useState(false);
  const [imagenLabel, setImagenLabel] = useState<string>('');
  const [imagenValores, setImagenValores] = useState<{ izq?: number | string; der?: number | string } | null>(null);
  const [imagenTablaValores, setImagenTablaValores] = useState<Array<{ label: string; der?: number | string; izq?: number | string }> | null>(null);
  const [imagenTabs, setImagenTabs] = useState<Array<{ clave: string; tabLabel: string; valor?: number | string }> | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Editor SVG interactivo de ángulos
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null)
  const [editorLoadingImage, setEditorLoadingImage] = useState(false)
  const [editorLabel, setEditorLabel] = useState('')
  const [editorNivel, setEditorNivel] = useState('')
  const [editorPuntos, setEditorPuntos] = useState<Record<string, { x: number; y: number } | null>>({})
  const [editorOriginalPuntos, setEditorOriginalPuntos] = useState<Record<string, { x: number; y: number } | null>>({})
  const [editorAngulos, setEditorAngulos] = useState<{ aasa_der: number; aasa_izq: number; pasa_der: number; pasa_izq: number }>({ aasa_der: 0, aasa_izq: 0, pasa_der: 0, pasa_izq: 0 })
  const [editorOriginalAngulos, setEditorOriginalAngulos] = useState<{ aasa_der: number; aasa_izq: number; pasa_der: number; pasa_izq: number }>({ aasa_der: 0, aasa_izq: 0, pasa_der: 0, pasa_izq: 0 })
  const [editorDragging, setEditorDragging] = useState<string | null>(null)
  const [savingEditor, setSavingEditor] = useState(false)
  const [editorSaveError, setEditorSaveError] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

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

  const handleMedicionesClick = async (patient: Patient) => {
    setMedicionesPatient(patient);
    setShowMedicionesModal(true);
    setLoadingEstudios(true);
    setEstudiosError(null);
    setEstudios([]);

    try {
      const response = await fetch(`/estudios/${patient.patient_id}`);
      if (!response.ok) throw new Error('Error al cargar estudios');
      const data = await response.json();
      setEstudios(data.estudios);
    } catch (err) {
      setEstudiosError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoadingEstudios(false);
    }
  };

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
    } catch (err) {
      setEstudiosError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setDeletingEstudioId(null);
    }
  };

  const handleVerResultados = async (estudioId: number) => {
    setResultadosEstudioId(estudioId);
    setShowResultadosModal(true);
    setLoadingResultados(true);
    setResultadosError(null);
    setResultados(null);

    try {
      const response = await fetch(`/mediciones/${estudioId}`);
      if (!response.ok) throw new Error('No se encontraron resultados para este estudio');
      const data = await response.json();
      setResultados(data.resultados);
    } catch (err) {
      setResultadosError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoadingResultados(false);
    }
  };

  const handleCloseResultadosModal = () => {
    setShowResultadosModal(false);
    setResultados(null);
    setResultadosEstudioId(null);
    setImagenUrl(null);
    setImagenLabel('');
    setImagenValores(null);
    setImagenTablaValores(null);
    setImagenTabs(null);
    setActiveTab(0);
  };

  const handleVerImagen = async (clave: string, label: string, valores?: { izq?: number | string; der?: number | string }, tablaValores?: Array<{ label: string; der?: number | string; izq?: number | string }>) => {
    setLoadingImagen(true);
    setImagenUrl(null);
    setImagenLabel(label);
    setImagenValores(valores ?? null);
    setImagenTablaValores(tablaValores ?? null);
    try {
      const response = await fetch(`/mediciones/${resultadosEstudioId}/imagen?clave=${encodeURIComponent(clave)}`);
      if (!response.ok) throw new Error('No se pudo obtener la imagen');
      const data = await response.json();
      setImagenUrl(data.url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingImagen(false);
    }
  };

  const handleVerImagenesTabs = async (label: string, tabs: Array<{ clave: string; tabLabel: string; valor?: number | string }>) => {
    setImagenLabel(label);
    setImagenTabs(tabs);
    setImagenValores(null);
    setActiveTab(0);
    setLoadingImagen(true);
    setImagenUrl(null);
    const firstTab = tabs[0];
    if (resultados?.imagenes && resultados.imagenes[firstTab.clave]) {
      try {
        const response = await fetch(`/mediciones/${resultadosEstudioId}/imagen?clave=${encodeURIComponent(resultados.imagenes[firstTab.clave])}`);
        if (!response.ok) throw new Error('No se pudo obtener la imagen');
        const data = await response.json();
        setImagenUrl(data.url);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingImagen(false);
      }
    } else {
      setLoadingImagen(false);
    }
  };

  const handleTabChange = async (tabIndex: number) => {
    if (!imagenTabs) return;
    setActiveTab(tabIndex);
    setLoadingImagen(true);
    const tab = imagenTabs[tabIndex];
    if (resultados?.imagenes && resultados.imagenes[tab.clave]) {
      try {
        const response = await fetch(`/mediciones/${resultadosEstudioId}/imagen?clave=${encodeURIComponent(resultados.imagenes[tab.clave])}`);
        if (!response.ok) throw new Error('No se pudo obtener la imagen');
        const data = await response.json();
        setImagenUrl(data.url);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingImagen(false);
      }
    } else {
      setLoadingImagen(false);
    }
  };

  const handleCerrarImagen = () => {
    setImagenUrl(null);
    setImagenLabel('');
    setImagenValores(null);
    setImagenTablaValores(null);
    setImagenTabs(null);
    setActiveTab(0);
  };

  // ---- Editor SVG ----
  const computeAxialAngulos = (
    puntos: Record<string, { x: number; y: number } | null>,
    origPuntos: Record<string, { x: number; y: number } | null>,
    origAngulos: { aasa_der: number; aasa_izq: number; pasa_der: number; pasa_izq: number }
  ) => {
    const result = { ...origAngulos }
    const keys = ['aasa_der', 'aasa_izq', 'pasa_der', 'pasa_izq'] as const
    for (const key of keys) {
      const cKey = key.endsWith('_der') ? 'centroide_der' : 'centroide_izq'
      const c = puntos[cKey]; const orig = origPuntos[key]; const curr = puntos[key]
      if (!c || !orig || !curr) continue
      const angOrig = Math.atan2(orig.y - c.y, orig.x - c.x) * 180 / Math.PI
      const angCurr = Math.atan2(curr.y - c.y, curr.x - c.x) * 180 / Math.PI
      let delta = angCurr - angOrig
      while (delta > 180) delta -= 360
      while (delta < -180) delta += 360
      result[key] = Math.round((origAngulos[key] + delta) * 100) / 100
    }
    return result
  }

  const handleOpenEditor = async (nivel: string, imageKey: string) => {
    if (!resultados?.angulos_axiales?.[nivel]?.puntos) return
    const nivelData = resultados.angulos_axiales[nivel]
    const puntos = nivelData.puntos as Record<string, { x: number; y: number } | null>
    const angulos = {
      aasa_der: nivelData.aasa?.der ?? 0,
      aasa_izq: nivelData.aasa?.izq ?? 0,
      pasa_der: nivelData.pasa?.der ?? 0,
      pasa_izq: nivelData.pasa?.izq ?? 0,
    }
    setEditorNivel(nivel)
    setEditorLabel(`Plano Axial — ${nivel.charAt(0).toUpperCase() + nivel.slice(1)}`)
    setEditorPuntos(puntos)
    setEditorOriginalPuntos(puntos)
    setEditorAngulos(angulos)
    setEditorOriginalAngulos(angulos)
    setEditorOpen(true)
    setEditorLoadingImage(true)
    setEditorImageUrl(null)
    setEditorSaveError(null)
    try {
      const clave = resultados.imagenes?.[imageKey]
      if (!clave) throw new Error()
      const res = await fetch(`/mediciones/${resultadosEstudioId}/imagen?clave=${encodeURIComponent(clave)}`)
      const data = await res.json()
      setEditorImageUrl(data.url)
    } catch { setEditorImageUrl(null) }
    finally { setEditorLoadingImage(false) }
  }

  const handleEditorPointMouseDown = (key: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditorDragging(key)
  }

  const handleEditorSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!editorDragging || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const newPuntos = { ...editorPuntos, [editorDragging]: { x, y } }
    setEditorPuntos(newPuntos)
    setEditorAngulos(computeAxialAngulos(newPuntos, editorOriginalPuntos, editorOriginalAngulos))
  }

  const handleEditorSvgMouseUp = () => setEditorDragging(null)

  const handleSaveEditor = async () => {
    if (!resultados || !resultadosEstudioId) return
    setSavingEditor(true)
    setEditorSaveError(null)
    const updated = JSON.parse(JSON.stringify(resultados))
    const nivel = updated.angulos_axiales[editorNivel]
    nivel.aasa.der = editorAngulos.aasa_der
    nivel.aasa.izq = editorAngulos.aasa_izq
    nivel.pasa.der = editorAngulos.pasa_der
    nivel.pasa.izq = editorAngulos.pasa_izq
    nivel.hasa.der = Math.round((editorAngulos.aasa_der + editorAngulos.pasa_der) * 100) / 100
    nivel.hasa.izq = Math.round((editorAngulos.aasa_izq + editorAngulos.pasa_izq) * 100) / 100
    nivel.puntos = editorPuntos
    try {
      const res = await fetch(`/mediciones/${resultadosEstudioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultados: updated }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      setResultados(updated)
      setEditorOpen(false)
    } catch (err) {
      setEditorSaveError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSavingEditor(false)
    }
  }

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

  const formatPatientName = (patientName: string) => {
    return patientName.replace(/\^/g, ' ').trim();
  };

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
                  ID Paciente
                </th>
                <th className="w-1/5 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="w-1/5 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad de Estudios
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
                        {patient.patient_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {formatPatientName(patient.patient_name)}
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
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
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
                              Serie #
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Descripción
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Modalidad
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              # Instancias
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {seriesItem.series_number}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 text-center">
                                  {seriesItem.description}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {seriesItem.modality}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                  {seriesItem.num_instances}
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
                      <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                      </div>
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
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                {!selectedSeries ? (
                  <>
                    <span className="text-sm text-gray-500">
                      {series.length} {series.length === 1 ? 'serie' : 'series'}
                    </span>
                    <button
                      onClick={handleCloseSeriesModal}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cerrar
                    </button>
                  </>
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
                ) : (
                  <>
                    <span />
                    <button
                      onClick={handleCloseSeriesModal}
                      className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
                    >
                      Cerrar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Mediciones del Paciente */}
        {showMedicionesModal && medicionesPatient && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
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
                          Resultados
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Eliminar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {estudios.map((estudio) => (
                        <tr key={estudio.estudio_id} className="hover:bg-gray-50 transition-colors">
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
                            {estudio.estado === 'Finalizado' ? (
                              <button
                                onClick={() => handleVerResultados(estudio.estudio_id)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Ver resultados"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                              </button>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            {estudio.estado !== 'Procesando' && (
                              <button
                                onClick={() => setConfirmDeleteId(estudio.estudio_id)}
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
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {estudios.length} {estudios.length === 1 ? 'estudio' : 'estudios'}
                </span>
                <button
                  onClick={handleCloseMedicionesModal}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>

              {/* Modal de confirmación de borrado */}
              {confirmDeleteId !== null && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg z-10">
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

        {/* Modal de Resultados de Medicion */}
        {showResultadosModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Resultados de Medicion</h2>
                  <p className="text-sm text-gray-500">Estudio #{resultadosEstudioId}</p>
                </div>
                <button
                  onClick={handleCloseResultadosModal}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingResultados ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">Cargando resultados...</p>
                  </div>
                ) : resultadosError ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {resultadosError}
                  </div>
                ) : resultados ? (
                  <div className="space-y-6">

                    {/* Modal de imagen */}
                    {(imagenUrl || loadingImagen) && (
                      <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[70]" onClick={handleCerrarImagen}>
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                          {/* Header */}
                          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-0.5">Visualización</p>
                              <h3 className="text-base font-bold text-gray-900">{imagenLabel || 'Imagen del ángulo'}</h3>
                            </div>
                            <button
                              onClick={handleCerrarImagen}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          {/* Tabs, Tabla, o Valores simples */}
                          {imagenTablaValores ? (
                            <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr>
                                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-2 font-medium">Ángulo</th>
                                    <th className="text-center text-xs text-gray-400 uppercase tracking-wide pb-2 font-medium">Derecho</th>
                                    <th className="text-center text-xs text-gray-400 uppercase tracking-wide pb-2 font-medium">Izquierdo</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {imagenTablaValores.map((row) => (
                                    <tr key={row.label}>
                                      <td className="py-1.5 text-gray-600 font-medium">{row.label}</td>
                                      <td className="py-1.5 text-center text-gray-900 font-bold">{row.der !== undefined ? `${row.der}°` : '—'}</td>
                                      <td className="py-1.5 text-center text-gray-900 font-bold">{row.izq !== undefined ? `${row.izq}°` : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : imagenTabs && imagenTabs.length > 1 ? (
                            <div className="flex border-b border-gray-100">
                              {imagenTabs.map((tab, i) => (
                                <button
                                  key={tab.clave}
                                  onClick={() => handleTabChange(i)}
                                  className={`flex-1 px-6 py-3 text-center transition-colors border-b-2 ${
                                    activeTab === i
                                      ? 'border-blue-500 bg-white'
                                      : 'border-transparent bg-gray-50 hover:bg-gray-100'
                                  }`}
                                >
                                  <p className={`text-xs uppercase tracking-wide mb-1 ${activeTab === i ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>{tab.tabLabel}</p>
                                  {tab.valor !== undefined && (
                                    <p className={`text-2xl font-bold ${activeTab === i ? 'text-gray-900' : 'text-gray-400'}`}>{tab.valor}°</p>
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : imagenValores && (imagenValores.izq !== undefined || imagenValores.der !== undefined) ? (
                            <div className="flex divide-x divide-gray-100 bg-gray-50 border-b border-gray-100">
                              {imagenValores.der !== undefined && (
                                <div className="flex-1 px-6 py-3 text-center">
                                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Derecho</p>
                                  <p className="text-2xl font-bold text-gray-900">{imagenValores.der}°</p>
                                </div>
                              )}
                              {imagenValores.izq !== undefined && (
                                <div className="flex-1 px-6 py-3 text-center">
                                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Izquierdo</p>
                                  <p className="text-2xl font-bold text-gray-900">{imagenValores.izq}°</p>
                                </div>
                              )}
                            </div>
                          ) : null}

                          {/* Imagen */}
                          <div className="relative p-4 bg-black flex items-center justify-center min-h-48">
                            {imagenUrl && (
                              <img src={imagenUrl} alt={imagenLabel} className="max-h-[55vh] object-contain" />
                            )}
                            {loadingImagen && (
                              <div className={`${imagenUrl ? 'absolute inset-0 bg-black/60' : ''} flex items-center justify-center`}>
                                <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="px-5 py-3 flex justify-end border-t border-gray-100">
                            <button
                              onClick={handleCerrarImagen}
                              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                              Cerrar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ojito helper */}
                    {(() => {
                      const eyeIcon = (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      );

                      const OjoBtn = ({ clave, label, valores }: { clave: string; label: string; valores?: { izq?: number | string; der?: number | string } }) => {
                        const tiene = resultados.imagenes && resultados.imagenes[clave];
                        if (!tiene) return null;
                        return (
                          <button
                            onClick={() => handleVerImagen(resultados.imagenes[clave], label, valores)}
                            className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                            title="Ver imagen"
                          >
                            {eyeIcon}
                          </button>
                        );
                      };

                      const OjoBtnTabla = ({ clave, label, tabla }: { clave: string; label: string; tabla: Array<{ label: string; der?: number | string; izq?: number | string }> }) => {
                        const tiene = resultados.imagenes && resultados.imagenes[clave];
                        if (!tiene) return null;
                        return (
                          <button
                            onClick={() => handleVerImagen(resultados.imagenes[clave], label, undefined, tabla)}
                            className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                            title="Ver imagen"
                          >
                            {eyeIcon}
                          </button>
                        );
                      };

                      const OjoBtnTabs = ({ label, tabs }: { label: string; tabs: Array<{ clave: string; tabLabel: string; valor?: number | string }> }) => {
                        const tieneAlguna = tabs.some(t => resultados.imagenes && resultados.imagenes[t.clave]);
                        if (!tieneAlguna) return null;
                        return (
                          <button
                            onClick={() => handleVerImagenesTabs(label, tabs)}
                            className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                            title="Ver imágenes"
                          >
                            {eyeIcon}
                          </button>
                        );
                      };

                      return (
                        <>
                          {/* Angulos Coronales */}
                          {resultados.angulos_coronales && (
                            <div>
                              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                Plano Coronal
                              </h3>
                              <div className="bg-gray-50 rounded-lg overflow-hidden">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Angulo</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Izq</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Der</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Imagen</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {resultados.angulos_coronales.centroBordeLateral && (
                                      <tr>
                                        <td className="px-4 py-2 text-gray-700">Centro-Borde Lateral</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{resultados.angulos_coronales.centroBordeLateral.izq}°</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{resultados.angulos_coronales.centroBordeLateral.der}°</td>
                                        <td className="px-4 py-2 text-center"><OjoBtn clave="angulo_centro_borde_lateral" label="Centro-Borde Lateral" valores={{ izq: resultados.angulos_coronales.centroBordeLateral.izq, der: resultados.angulos_coronales.centroBordeLateral.der }} /></td>
                                      </tr>
                                    )}
                                    {resultados.angulos_coronales.inclinacionAcetabular && (
                                      <tr>
                                        <td className="px-4 py-2 text-gray-700">Inclinacion Acetabular</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{resultados.angulos_coronales.inclinacionAcetabular.izq}°</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{resultados.angulos_coronales.inclinacionAcetabular.der}°</td>
                                        <td className="px-4 py-2 text-center"><OjoBtn clave="inclinacion_acetabular" label="Inclinación Acetabular" valores={{ izq: resultados.angulos_coronales.inclinacionAcetabular.izq, der: resultados.angulos_coronales.inclinacionAcetabular.der }} /></td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Angulos Axiales */}
                          {resultados.angulos_axiales && (
                            <div>
                              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Plano Axial
                              </h3>
                              <div className="bg-gray-50 rounded-lg overflow-hidden">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nivel</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Angulo</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Izq</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Der</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Imagen</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {(['proximal', 'intermedio', 'ecuatorial'] as const).filter(n => resultados.angulos_axiales[n]).flatMap((nivel) => {
                                      const nivelData: any = resultados.angulos_axiales[nivel];
                                      const angleEntries = Object.entries(nivelData).filter(([k]) => k !== 'puntos') as [string, any][];
                                      const hasPuntos = !!nivelData.puntos;
                                      return angleEntries.map(([angulo, val]: [string, any], i) => (
                                        <tr key={`${nivel}-${angulo}`}>
                                          {i === 0 && (
                                            <td className="px-4 py-2 text-gray-700 font-medium capitalize align-middle" rowSpan={angleEntries.length}>
                                              {nivel}
                                            </td>
                                          )}
                                          <td className="px-4 py-2 text-gray-700 uppercase">{angulo}</td>
                                          <td className="px-4 py-2 text-center text-gray-900 font-medium">{val.izq}°</td>
                                          <td className="px-4 py-2 text-center text-gray-900 font-medium">{val.der}°</td>
                                          {i === 0 ? (
                                            <td className="px-4 py-2 text-center align-middle" rowSpan={angleEntries.length}>
                                              <div className="flex items-center justify-center gap-1">
                                                <OjoBtnTabla
                                                  clave={`angulos_axiales_${nivel}_aasa_pasa`}
                                                  label={`Plano Axial — ${nivel}`}
                                                  tabla={angleEntries.map(([ang, v]: [string, any]) => ({
                                                    label: ang.toUpperCase(),
                                                    der: v.der,
                                                    izq: v.izq,
                                                  }))}
                                                />
                                                {hasPuntos && (
                                                  <button
                                                    onClick={() => handleOpenEditor(nivel, `angulos_axiales_${nivel}_aasa_pasa`)}
                                                    className="p-1 text-gray-300 hover:text-amber-500 transition-colors"
                                                    title="Corregir ángulos"
                                                  >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                                    </svg>
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          ) : null}
                                        </tr>
                                      ));
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Angulos Sagitales */}
                          {resultados.angulos_sagitales && (
                            <div>
                              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                Plano Sagital
                              </h3>
                              <div className="bg-gray-50 rounded-lg overflow-hidden">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Angulo</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Izq</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Der</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Imagen</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {Object.entries(resultados.angulos_sagitales).map(([key, val]: [string, any]) => (
                                      <tr key={key}>
                                        <td className="px-4 py-2 text-gray-700">
                                          {key === 'centro_borde_anterior' ? 'Centro-Borde Anterior' : key}
                                        </td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{val.izq}°</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{val.der}°</td>
                                        <td className="px-4 py-2 text-center">
                                          <OjoBtnTabs
                                            label="Centro-Borde Anterior"
                                            tabs={[
                                              { clave: 'angulo_centro_borde_anterior_derecho', tabLabel: 'Derecho', valor: val.der },
                                              { clave: 'angulo_centro_borde_anterior_izquierdo', tabLabel: 'Izquierdo', valor: val.izq },
                                            ]}
                                          />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Angulo Alfa */}
                          {resultados.angulos_alfa && (
                            <div>
                              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                                Angulo Alfa
                              </h3>
                              <div className="bg-gray-50 rounded-lg overflow-hidden">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Hora</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500" colSpan={2}>Izq</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500" colSpan={2}>Der</th>
                                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Imagen</th>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                      <th></th>
                                      <th className="px-4 py-1 text-center text-xs text-gray-400">Ant</th>
                                      <th className="px-4 py-1 text-center text-xs text-gray-400">Post</th>
                                      <th className="px-4 py-1 text-center text-xs text-gray-400">Ant</th>
                                      <th className="px-4 py-1 text-center text-xs text-gray-400">Post</th>
                                      <th></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {Object.entries(resultados.angulos_alfa).map(([hora, val]: [string, any]) => (
                                      <tr key={hora}>
                                        <td className="px-4 py-2 text-gray-700 capitalize">{hora.replace('_', ' ')}</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{val.izq?.anterior}°</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{val.izq?.posterior}°</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{val.der?.anterior}°</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{val.der?.posterior}°</td>
                                        <td className="px-4 py-2 text-center">
                                          <OjoBtnTabs
                                            label={`Ángulo Alfa ${hora.replace('_', ' ')}`}
                                            tabs={[
                                              { clave: `alfa_${hora}_derecho`, tabLabel: 'Derecho', valor: val.der?.anterior },
                                              { clave: `alfa_${hora}_izquierdo`, tabLabel: 'Izquierdo', valor: val.izq?.anterior },
                                            ]}
                                          />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleCloseResultadosModal}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editor SVG de ángulos */}
        {editorOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col overflow-hidden max-h-[95vh]">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-0.5">Corrección Manual</p>
                  <h3 className="text-base font-bold text-gray-900">{editorLabel}</h3>
                </div>
                <button onClick={() => setEditorOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Angle values panel */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex gap-6 flex-wrap">
                {[
                  { key: 'aasa_der', label: 'AASA Der', color: 'text-red-600' },
                  { key: 'pasa_der', label: 'PASA Der', color: 'text-blue-600' },
                  { key: 'aasa_izq', label: 'AASA Izq', color: 'text-red-600' },
                  { key: 'pasa_izq', label: 'PASA Izq', color: 'text-blue-600' },
                ].map(({ key, label, color }) => (
                  <div key={key} className="text-center">
                    <p className={`text-xs font-medium ${color} uppercase tracking-wide`}>{label}</p>
                    <p className="text-xl font-bold text-gray-900">{editorAngulos[key as keyof typeof editorAngulos]}°</p>
                  </div>
                ))}
                <div className="text-center ml-4 pl-4 border-l border-gray-200">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">HASA Der</p>
                  <p className="text-xl font-bold text-gray-500">{Math.round((editorAngulos.aasa_der + editorAngulos.pasa_der) * 100) / 100}°</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">HASA Izq</p>
                  <p className="text-xl font-bold text-gray-500">{Math.round((editorAngulos.aasa_izq + editorAngulos.pasa_izq) * 100) / 100}°</p>
                </div>
              </div>

              {/* Image + SVG overlay */}
              <div className="flex-1 bg-black flex items-center justify-center" style={{ minHeight: 400 }}>
                {editorLoadingImage ? (
                  <div className="flex items-center justify-center h-64">
                    <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : editorImageUrl ? (
                  <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    {/* CSS grid stacks img + SVG in the same cell — guaranteed pixel-perfect overlay */}
                    <div style={{ display: 'grid', maxHeight: '75vh', maxWidth: '100%' }}>
                      <img
                        src={editorImageUrl}
                        alt={editorLabel}
                        style={{ gridArea: '1/1', display: 'block', maxHeight: '75vh', maxWidth: '100%' }}
                        draggable={false}
                        onLoad={(e) => {
                          const img = e.currentTarget
                          console.log('=== Editor Debug ===')
                          console.log('naturalWidth:', img.naturalWidth, 'naturalHeight:', img.naturalHeight)
                          console.log('clientWidth:', img.clientWidth, 'clientHeight:', img.clientHeight)
                          console.log('puntos:', JSON.stringify(editorPuntos, null, 2))
                        }}
                      />
                      {/* SVG overlay — CSS grid guarantees it covers exactly the img */}
                      <svg
                        ref={svgRef}
                        style={{ gridArea: '1/1', width: '100%', height: '100%', cursor: editorDragging ? 'grabbing' : 'default' }}
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        onMouseMove={handleEditorSvgMouseMove}
                        onMouseUp={handleEditorSvgMouseUp}
                        onMouseLeave={handleEditorSvgMouseUp}
                      >
                        {/* Centroid circles (fixed) */}
                        {(['centroide_der', 'centroide_izq'] as const).map(key => {
                          const p = editorPuntos[key]
                          const r = (typeof editorPuntos[key === 'centroide_der' ? 'radio_der' : 'radio_izq'] === 'number'
                            ? (editorPuntos[key === 'centroide_der' ? 'radio_der' : 'radio_izq'] as unknown as number) * 100
                            : 5)
                          if (!p) return null
                          return (
                            <circle
                              key={key}
                              cx={p.x * 100}
                              cy={p.y * 100}
                              r={r}
                              fill="none"
                              stroke="#22c55e"
                              strokeWidth="0.5"
                              opacity="0.7"
                            />
                          )
                        })}

                        {/* Lines: centroid → endpoint */}
                        {[
                          { ptKey: 'aasa_der', cKey: 'centroide_der', color: '#ef4444' },
                          { ptKey: 'pasa_der', cKey: 'centroide_der', color: '#3b82f6' },
                          { ptKey: 'aasa_izq', cKey: 'centroide_izq', color: '#ef4444' },
                          { ptKey: 'pasa_izq', cKey: 'centroide_izq', color: '#3b82f6' },
                        ].map(({ ptKey, cKey, color }) => {
                          const c = editorPuntos[cKey]
                          const p = editorPuntos[ptKey]
                          if (!c || !p) return null
                          return (
                            <line
                              key={ptKey}
                              x1={c.x * 100} y1={c.y * 100}
                              x2={p.x * 100} y2={p.y * 100}
                              stroke={color}
                              strokeWidth="0.6"
                              opacity="0.9"
                            />
                          )
                        })}

                        {/* Centroid dots */}
                        {(['centroide_der', 'centroide_izq'] as const).map(key => {
                          const p = editorPuntos[key]
                          if (!p) return null
                          return <circle key={`dot-${key}`} cx={p.x * 100} cy={p.y * 100} r="0.8" fill="#22c55e" opacity="0.9" />
                        })}

                        {/* Draggable endpoint circles */}
                        {[
                          { key: 'aasa_der', color: '#ef4444' },
                          { key: 'pasa_der', color: '#3b82f6' },
                          { key: 'aasa_izq', color: '#ef4444' },
                          { key: 'pasa_izq', color: '#3b82f6' },
                        ].map(({ key, color }) => {
                          const p = editorPuntos[key]
                          if (!p) return null
                          const isDragging = editorDragging === key
                          return (
                            <circle
                              key={key}
                              cx={p.x * 100}
                              cy={p.y * 100}
                              r={isDragging ? '1.8' : '1.4'}
                              fill={color}
                              stroke="white"
                              strokeWidth="0.4"
                              opacity="0.95"
                              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                              onMouseDown={(e) => handleEditorPointMouseDown(key, e)}
                            />
                          )
                        })}
                      </svg>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No se pudo cargar la imagen</p>
                )}
              </div>

              {/* Legend */}
              <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-500 inline-block"></span>AASA</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block"></span>PASA</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-green-500 inline-block"></span>Centroide (cabeza femoral)</span>
                <span className="ml-2 text-gray-400">Arrastrá los puntos de color para ajustar las líneas</span>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  {editorSaveError && <p className="text-sm text-red-600">{editorSaveError}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditorPuntos(editorOriginalPuntos); setEditorAngulos(editorOriginalAngulos); }}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Restablecer
                  </button>
                  <button
                    onClick={() => setEditorOpen(false)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEditor}
                    disabled={savingEditor}
                    className="px-4 py-2 text-sm bg-amber-500 text-white font-medium rounded-md hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingEditor ? 'Guardando...' : 'Guardar corrección'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}
