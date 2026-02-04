'use client';

import { useState } from 'react';
import { Patient, SearchResponse, Series, SeriesResponse } from './types';

export default function Home() {
  const [searchNombre, setSearchNombre] = useState('');
  const [searchApellido, setSearchApellido] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        nombre: searchNombre,
        apellido: searchApellido,
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

  const handlePatientClick = async (patient: Patient) => {
    setSelectedPatient(patient);
    setLoadingSeries(true);
    setSeriesError(null);
    setSeries([]);

    try {
      const response = await fetch(`/api/pacs/patients/${patient.patient_id}/series`);

      if (!response.ok) {
        throw new Error('Error al cargar las series del paciente');
      }

      const data: SeriesResponse = await response.json();
      setSeries(data.series);
    } catch (err) {
      setSeriesError(err instanceof Error ? err.message : 'Error desconocido');
      setSeries([]);
    } finally {
      setLoadingSeries(false);
    }
  };

  const parsePatientName = (patientName: string) => {
    const [apellido, nombre] = patientName.split('^');
    return { nombre: nombre || '', apellido: apellido || '' };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Buscador de Pacientes</h1>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                value={searchNombre}
                onChange={(e) => setSearchNombre(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="apellido" className="block text-sm font-medium text-gray-700 mb-2">
                Apellido
              </label>
              <input
                id="apellido"
                type="text"
                value={searchApellido}
                onChange={(e) => setSearchApellido(e.target.value)}
                placeholder="Buscar por apellido..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={loading}
              />
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID Paciente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Apellido
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad de Estudios
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!hasSearched ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    Ingrese los criterios de búsqueda y presione el botón Buscar
                  </td>
                </tr>
              ) : patients.length > 0 ? (
                patients.map((patient) => {
                  const { nombre, apellido } = parsePatientName(patient.patient_name);
                  const isSelected = selectedPatient?.patient_id === patient.patient_id;
                  return (
                    <tr
                      key={patient.patient_id}
                      onClick={() => handlePatientClick(patient)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 hover:bg-blue-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {patient.patient_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {apellido}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {patient.num_studies}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
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

        {/* Tabla de Series del Paciente */}
        {selectedPatient && (
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow p-6 mb-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Series del Paciente
              </h2>
              <p className="text-sm text-gray-600">
                {parsePatientName(selectedPatient.patient_name).nombre}{' '}
                {parsePatientName(selectedPatient.patient_name).apellido} (ID: {selectedPatient.patient_id})
              </p>
            </div>

            {seriesError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                {seriesError}
              </div>
            )}

            {loadingSeries ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-600">Cargando series...</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Serie #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Descripción
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Modalidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        # Instancias
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {series.length > 0 ? (
                      series.map((seriesItem) => (
                        <tr key={seriesItem.uuid} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {seriesItem.series_number}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {seriesItem.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {seriesItem.modality}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {seriesItem.num_instances}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                          No se encontraron series para este paciente
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {series.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                Total: {series.length} series
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
