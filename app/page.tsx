'use client';

import { useState } from 'react';
import { Patient, SearchResponse, Series, SeriesResponse } from './types';

const angleGroups = [
  {
    name: 'Plano Coronal',
    angles: [
      { id: 'aasa', label: 'AASA (Ángulo del Sector Acetabular Anterior)' },
      { id: 'pasa', label: 'PASA (Ángulo del Sector Acetabular Posterior)' },
      { id: 'hasa', label: 'HASA (Ángulo del Sector Acetabular Horizontal)' },
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

  const handleMedicionesClick = (patient: Patient) => {
    setMedicionesPatient(patient);
    setShowMedicionesModal(true);
  };

  const handleCloseMedicionesModal = () => {
    setShowMedicionesModal(false);
    setMedicionesPatient(null);
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
          apellido: '',
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Buscador de Pacientes</h1>

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
                        const someSelected = groupIds.some((id) => selectedAngles.includes(id));
                        return (
                          <div key={group.name} className="bg-gray-50 rounded-lg p-3">
                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                onChange={() => toggleGroup(group)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300"
                              />
                              <span className="text-xs font-bold text-gray-800 uppercase tracking-wide">{group.name}</span>
                            </label>
                            <div className="ml-6 space-y-1">
                              {group.angles.map((angle) => (
                                <label key={angle.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedAngles.includes(angle.id)}
                                    onChange={() => toggleAngle(angle.id)}
                                    className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300"
                                  />
                                  <span className="text-xs text-gray-600">{angle.label}</span>
                                </label>
                              ))}
                            </div>
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
                      disabled={isAnalyzing || selectedAngles.length === 0}
                      className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAnalyzing ? 'Procesando...' : `Analizar (${selectedAngles.length})`}
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
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
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                  <p className="text-sm font-medium">No hay mediciones registradas</p>
                  <p className="text-xs mt-1">Las mediciones aparecerán aquí una vez procesadas</p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleCloseMedicionesModal}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}
