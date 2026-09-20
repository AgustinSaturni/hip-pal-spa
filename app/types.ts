export interface Patient {
  patient_id: string;
  patient_name: string;
  num_studies: number;
  study_ids: string[];
}

export interface SearchResponse {
  total: number;
  patients: Patient[];
  search_params: {
    nombre: string;
    apellido: string;
  };
}

export interface Series {
  uuid: string;
  patient_id: string;
  patient_name: string;
  study_id: string;
  series_number: string;
  description: string;
  modality: string;
  num_instances: number;
  /** 'Original' si es la adquisicion, 'Derivada' si es una reconstruccion de
   *  la estacion. null cuando la serie no declara ImageType. */
  origen: 'Original' | 'Derivada' | null;
}

export interface SeriesResponse {
  total: number;
  patient_id: string;
  series: Series[];
}
