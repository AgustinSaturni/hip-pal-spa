'use client';

import { useState, useRef, useEffect } from 'react';

// Muestra y permite corregir los resultados de una medicion: las tablas de
// angulos, el modal de imagenes y el editor de puntos sobre la imagen. Se
// maneja solo: recibe el id del estudio y se encarga de traer los datos y de
// persistir las correcciones.
export default function ResultadosMedicion({ estudioId }: { estudioId: number | null }) {
  const [resultados, setResultados] = useState<any>(null);
  const [loadingResultados, setLoadingResultados] = useState(false);
  const [resultadosError, setResultadosError] = useState<string | null>(null);


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
  const [editorPlano, setEditorPlano] = useState<'axial' | 'sagital' | 'coronal' | 'alfa'>('axial')
  const [editorLado, setEditorLado] = useState<'der' | 'izq'>('der')
  // Coronal tiene dos imagenes horneadas distintas que comparten los mismos puntos.
  const [editorVariante, setEditorVariante] = useState<'lateral' | 'inclinacion'>('lateral')
  const [editorHora, setEditorHora] = useState('')
  const [editorPuntos, setEditorPuntos] = useState<Record<string, { x: number; y: number } | null>>({})
  const [editorOriginalPuntos, setEditorOriginalPuntos] = useState<Record<string, { x: number; y: number } | null>>({})
  const [editorAngulos, setEditorAngulos] = useState<Record<string, number>>({})
  const [editorOriginalAngulos, setEditorOriginalAngulos] = useState<Record<string, number>>({})
  // Dimensiones naturales de la imagen: sagital (512x437) y coronal (512x438) no son
  // cuadradas, y medir angulos sobre coordenadas normalizadas ahi desvia ~5 grados.
  const [editorImgDims, setEditorImgDims] = useState<{ w: number; h: number } | null>(null)
  const [editorDragging, setEditorDragging] = useState<string | null>(null)
  const [savingEditor, setSavingEditor] = useState(false)
  const [editorSaveError, setEditorSaveError] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const handleVerImagen = async (clave: string, label: string, valores?: { izq?: number | string; der?: number | string }, tablaValores?: Array<{ label: string; der?: number | string; izq?: number | string }>) => {
    setLoadingImagen(true);
    setImagenUrl(null);
    setImagenLabel(label);
    setImagenValores(valores ?? null);
    setImagenTablaValores(tablaValores ?? null);
    try {
      const response = await fetch(`/mediciones/${estudioId}/imagen?clave=${encodeURIComponent(clave)}`);
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
        const response = await fetch(`/mediciones/${estudioId}/imagen?clave=${encodeURIComponent(resultados.imagenes[firstTab.clave])}`);
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
        const response = await fetch(`/mediciones/${estudioId}/imagen?clave=${encodeURIComponent(resultados.imagenes[tab.clave])}`);
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
  type Pt = { x: number; y: number }
  type Dims = { w: number; h: number }

  // Las coordenadas se guardan normalizadas [0,1]. Hay que desnormalizarlas con
  // las dimensiones reales antes de medir cualquier angulo: sagital (512x437) y
  // coronal (512x438) no son cuadradas y medir sobre normalizadas desvia ~5°.
  const vecPx = (a: Pt, b: Pt, d: Dims): Pt => ({ x: (b.x - a.x) * d.w, y: (b.y - a.y) * d.h })

  // Direccion de a->b en grados, con y hacia abajo (mismo convenio que
  // linea_toca_blanco en el backend, que usa y + sin).
  const angDir = (a: Pt, b: Pt, d: Dims) => {
    const v = vecPx(a, b, d)
    return Math.atan2(v.y, v.x) * 180 / Math.PI
  }

  // Angulo entre dos vectores (arccos), en grados.
  const angEntre = (v1: Pt, v2: Pt) => {
    const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)
    if (m === 0) return 0
    return Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / m))) * 180 / Math.PI
  }

  const r2 = (n: number) => Math.round(n * 100) / 100

  // Signo con que un giro del handle afecta al angulo publicado. No es uniforme:
  // el backend aplica correcciones por lado y por nivel (ver calcular_angulos_axiales),
  // asi que aasa_der se invierte y pasa_izq se invierte salvo en ecuatorial.
  const signoAxial = (key: string, nivel: string) => {
    if (key === 'aasa_der') return -1
    if (key === 'pasa_izq') return nivel === 'ecuatorial' ? 1 : -1
    return 1
  }

  // Recalcula por delta respecto de la posicion original. Se usa cuando la formula
  // absoluta no reproduce el valor guardado: el punto es un pixel rasterizado sobre
  // un rayo de grado entero, asi que reconstruirlo desvia ~1° y el angulo saltaria
  // apenas se abre el editor, sin que el usuario toque nada.
  const anguloPorDelta = (
    c: Pt | null, orig: Pt | null, curr: Pt | null,
    origAngulo: number, signo: number, d: Dims
  ) => {
    if (!c || !orig || !curr) return origAngulo
    let delta = angDir(c, curr, d) - angDir(c, orig, d)
    while (delta > 180) delta -= 360
    while (delta < -180) delta += 360
    return r2(origAngulo + signo * delta)
  }

  const computeAxialAngulos = (
    puntos: Record<string, Pt | null>,
    origPuntos: Record<string, Pt | null>,
    origAngulos: Record<string, number>,
    nivel: string,
    dims: Dims
  ) => {
    const result = { ...origAngulos }
    for (const key of ['aasa_der', 'aasa_izq', 'pasa_der', 'pasa_izq']) {
      const cKey = key.endsWith('_der') ? 'centroide_der' : 'centroide_izq'
      result[key] = anguloPorDelta(
        puntos[cKey], origPuntos[key], puntos[key],
        origAngulos[key] ?? 0, signoAxial(key, nivel), dims
      )
    }
    return result
  }

  // Normaliza a [-180, 180] y toma magnitud, igual que el backend.
  const normAbs = (a: number) => {
    while (a > 180) a -= 360
    while (a < -180) a += 360
    return Math.abs(a)
  }

  // Ancla el recalculo en el valor que guardo el backend: evalua la formula en
  // los puntos actuales y en los originales, y aplica la diferencia. Asi no hay
  // salto al abrir el editor (los puntos son pixeles rasterizados sobre un rayo
  // de grado entero, y reconstruir la formula de cero desvia hasta ~1.7°) y el
  // arrastre sigue la formula real, sin suponer en que rama cae el valor.
  const anclado = (guardado: number, actual: number, original: number) => r2(guardado + (actual - original))

  // Sagital: |90 - direccion|. El backend mide con y hacia arriba, de ahi el
  // signo invertido respecto de angDir.
  const computeSagitalAngulos = (
    puntos: Record<string, Pt | null>,
    origPuntos: Record<string, Pt | null>,
    origAngulos: Record<string, number>,
    dims: Dims
  ) => {
    const f = (p: Record<string, Pt | null>) => {
      const c = p['centroide'], q = p['punto_filo']
      return (c && q) ? Math.abs(90 - (-angDir(c, q, dims))) : null
    }
    const a = f(puntos), o = f(origPuntos)
    const g = origAngulos['centro_borde_anterior'] ?? 0
    return { ...origAngulos, centro_borde_anterior: (a === null || o === null) ? g : anclado(g, a, o) }
  }

  // Alfa: anterior y posterior se miden entre la bisectriz del cuello y cada
  // recta limite. Mover la bisectriz afecta a los dos; cada recta limite, solo
  // al suyo. El signo depende del lado (ver calcular_alfa en el backend).
  const computeAlfaAngulos = (
    puntos: Record<string, Pt | null>,
    origPuntos: Record<string, Pt | null>,
    origAngulos: Record<string, number>,
    dims: Dims,
    lado: 'der' | 'izq'
  ) => {
    const s = lado === 'der' ? 1 : -1
    const f = (p: Record<string, Pt | null>) => {
      const c = p['centroide'], h = p['punto_horario']
      const ah = p['punto_antihorario'], b = p['punto_bisectriz']
      if (!c || !h || !ah || !b) return null
      const aH = angDir(c, h, dims), aAH = angDir(c, ah, dims), aB = angDir(c, b, dims)
      return { anterior: normAbs(s * (aH - aB)), posterior: normAbs(s * (aB - aAH)) }
    }
    const a = f(puntos), o = f(origPuntos)
    if (!a || !o) return origAngulos
    return {
      anterior: anclado(origAngulos.anterior ?? 0, a.anterior, o.anterior),
      posterior: anclado(origAngulos.posterior ?? 0, a.posterior, o.posterior),
    }
  }

  // Coronal: ambas formulas absolutas reproducen exacto el valor del backend
  // (verificado, error 0.00), asi que no hace falta delta.
  const computeCoronalAngulos = (puntos: Record<string, Pt | null>, dims: Dims) => {
    const result: Record<string, number> = {}
    const cd = puntos['centroide_der'], ci = puntos['centroide_izq']
    for (const lado of ['der', 'izq']) {
      const c = puntos[`centroide_${lado}`]
      const fs = puntos[`filo_superior_${lado}`]
      const fi = puntos[`filo_inferior_${lado}`]
      if (cd && ci && c && fs) {
        // Perpendicular a la linea de centroides, rotada 90° antihorario.
        const vc = vecPx(ci, cd, dims)
        result[`centroBordeLateral_${lado}`] = r2(angEntre({ x: -vc.y, y: vc.x }, vecPx(c, fs, dims)))
      }
      if (fs && fi) {
        result[`inclinacionAcetabular_${lado}`] = r2(angEntre({ x: 0, y: -1 }, vecPx(fi, fs, dims)))
      }
    }
    return result
  }

  // Que dibuja y que se puede arrastrar en cada plano. `extend` replica la
  // extension que el backend le da a la recta al dibujarla sobre la imagen:
  // sin eso quedaria media recta horneada sin tapar por el overlay.
  const editorGeometria = (): {
    lineas: { from: string; to: string; color: string; extend?: number }[]
    handles: { key: string; color: string; extend?: number; desde?: string }[]
    fijos: string[]
  } => {
    if (editorPlano === 'sagital') return {
      lineas: [{ from: 'centroide', to: 'punto_filo', color: '#ef4444', extend: 2 }],
      handles: [{ key: 'punto_filo', color: '#ef4444', extend: 2, desde: 'centroide' }],
      fijos: ['centroide'],
    }
    // El backend dibuja las tres rectas desde el centroide hasta el punto guardado,
    // sin extension. Los colores horneados se invierten segun el lado; el overlay
    // usa siempre rojo=anterior y verde=posterior, que es mas legible.
    if (editorPlano === 'alfa') return {
      lineas: [
        { from: 'centroide', to: 'punto_horario', color: '#ef4444' },
        { from: 'centroide', to: 'punto_antihorario', color: '#22c55e' },
        { from: 'centroide', to: 'punto_bisectriz', color: '#3b82f6' },
      ],
      handles: [
        { key: 'punto_horario', color: '#ef4444' },
        { key: 'punto_antihorario', color: '#22c55e' },
        { key: 'punto_bisectriz', color: '#3b82f6' },
      ],
      fijos: ['centroide'],
    }
    if (editorPlano === 'coronal') return editorVariante === 'inclinacion'
      ? {
        lineas: [
          { from: 'filo_inferior_der', to: 'filo_superior_der', color: '#eab308' },
          { from: 'filo_inferior_izq', to: 'filo_superior_izq', color: '#eab308' },
        ],
        handles: [
          { key: 'filo_superior_der', color: '#ef4444' }, { key: 'filo_superior_izq', color: '#ef4444' },
          { key: 'filo_inferior_der', color: '#eab308' }, { key: 'filo_inferior_izq', color: '#eab308' },
        ],
        fijos: ['centroide_der', 'centroide_izq'],
      }
      : {
        lineas: [
          { from: 'centroide_der', to: 'filo_superior_der', color: '#ef4444' },
          { from: 'centroide_izq', to: 'filo_superior_izq', color: '#ef4444' },
        ],
        handles: [
          { key: 'filo_superior_der', color: '#ef4444' }, { key: 'filo_superior_izq', color: '#ef4444' },
        ],
        fijos: ['centroide_der', 'centroide_izq'],
      }
    return {
      lineas: [
        { from: 'centroide_der', to: 'aasa_der', color: '#ef4444' },
        { from: 'centroide_der', to: 'pasa_der', color: '#3b82f6' },
        { from: 'centroide_izq', to: 'aasa_izq', color: '#ef4444' },
        { from: 'centroide_izq', to: 'pasa_izq', color: '#3b82f6' },
      ],
      handles: [
        { key: 'aasa_der', color: '#ef4444' }, { key: 'pasa_der', color: '#3b82f6' },
        { key: 'aasa_izq', color: '#ef4444' }, { key: 'pasa_izq', color: '#3b82f6' },
      ],
      fijos: ['centroide_der', 'centroide_izq'],
    }
  }

  // Valores que se estan editando, en primer plano.
  const editorMetricas = (): { key: string; label: string; color: string }[] => {
    if (editorPlano === 'sagital') return [
      { key: 'centro_borde_anterior', label: 'Centro-Borde Ant.', color: 'text-red-600' },
    ]
    if (editorPlano === 'alfa') return [
      { key: 'anterior', label: 'Alfa Anterior', color: 'text-red-600' },
      { key: 'posterior', label: 'Alfa Posterior', color: 'text-green-600' },
    ]
    if (editorPlano === 'coronal') return editorVariante === 'inclinacion'
      ? [
        { key: 'inclinacionAcetabular_der', label: 'Inclinación Der', color: 'text-yellow-600' },
        { key: 'inclinacionAcetabular_izq', label: 'Inclinación Izq', color: 'text-yellow-600' },
      ]
      : [
        { key: 'centroBordeLateral_der', label: 'C-Borde Lat. Der', color: 'text-red-600' },
        { key: 'centroBordeLateral_izq', label: 'C-Borde Lat. Izq', color: 'text-red-600' },
      ]
    return [
      { key: 'aasa_der', label: 'AASA Der', color: 'text-red-600' },
      { key: 'pasa_der', label: 'PASA Der', color: 'text-blue-600' },
      { key: 'aasa_izq', label: 'AASA Izq', color: 'text-red-600' },
      { key: 'pasa_izq', label: 'PASA Izq', color: 'text-blue-600' },
    ]
  }

  // Valores que cambian como consecuencia, mostrados apagados: no se editan
  // directamente pero dependen de los mismos puntos, asi que conviene verlos.
  const editorMetricasSecundarias = (): { label: string; valor: number }[] => {
    if (editorPlano === 'axial') return [
      { label: 'HASA Der', valor: r2((editorAngulos.aasa_der ?? 0) + (editorAngulos.pasa_der ?? 0)) },
      { label: 'HASA Izq', valor: r2((editorAngulos.aasa_izq ?? 0) + (editorAngulos.pasa_izq ?? 0)) },
    ]
    // Ambos angulos coronales dependen de filo_superior: mover ese punto cambia
    // los dos del mismo lado. Se muestran para que el acoplamiento no sorprenda.
    if (editorPlano === 'coronal') return editorVariante === 'inclinacion'
      ? [
        { label: 'C-Borde Lat. Der', valor: editorAngulos.centroBordeLateral_der ?? 0 },
        { label: 'C-Borde Lat. Izq', valor: editorAngulos.centroBordeLateral_izq ?? 0 },
      ]
      : [
        { label: 'Inclinación Der', valor: editorAngulos.inclinacionAcetabular_der ?? 0 },
        { label: 'Inclinación Izq', valor: editorAngulos.inclinacionAcetabular_izq ?? 0 },
      ]
    return []
  }

  // Leyenda del pie del editor, segun lo que se dibuja en cada plano.
  const editorLeyenda = (): { color: string; texto: string }[] => {
    if (editorPlano === 'sagital') return [
      { color: 'bg-red-500', texto: 'Centro-Borde Anterior' },
    ]
    if (editorPlano === 'alfa') return [
      { color: 'bg-red-500', texto: 'Límite anterior' },
      { color: 'bg-green-500', texto: 'Límite posterior' },
      { color: 'bg-blue-500', texto: 'Bisectriz del cuello (afecta a ambos)' },
    ]
    if (editorPlano === 'coronal') return editorVariante === 'inclinacion'
      ? [{ color: 'bg-yellow-500', texto: 'Techo acetabular (borde inferior → superior)' }]
      : [{ color: 'bg-red-500', texto: 'Centro-Borde Lateral (centroide → borde superior)' }]
    return [
      { color: 'bg-red-500', texto: 'AASA' },
      { color: 'bg-blue-500', texto: 'PASA' },
    ]
  }

  const handleOpenEditorSagital = async (lado: 'der' | 'izq') => {
    const sag = resultados?.angulos_sagitales
    const puntos = sag?.puntos?.[lado] as Record<string, Pt | null> | undefined
    if (!puntos) return
    const angulos = { centro_borde_anterior: sag.centro_borde_anterior?.[lado] ?? 0 }
    setEditorPlano('sagital')
    setEditorLado(lado)
    setEditorImgDims(null)
    setEditorLabel(`Plano Sagital — ${lado === 'der' ? 'Derecho' : 'Izquierdo'}`)
    setEditorPuntos(puntos)
    setEditorOriginalPuntos(puntos)
    setEditorAngulos(angulos)
    setEditorOriginalAngulos(angulos)
    setEditorOpen(true)
    setEditorLoadingImage(true)
    setEditorImageUrl(null)
    setEditorSaveError(null)
    try {
      const clave = resultados.imagenes?.[`angulo_centro_borde_anterior_${lado === 'der' ? 'derecho' : 'izquierdo'}`]
      if (!clave) throw new Error()
      const res = await fetch(`/mediciones/${estudioId}/imagen?clave=${encodeURIComponent(clave)}`)
      setEditorImageUrl((await res.json()).url)
    } catch { setEditorImageUrl(null) }
    finally { setEditorLoadingImage(false) }
  }

  const handleOpenEditorAlfa = async (hora: string, lado: 'der' | 'izq') => {
    const h = resultados?.angulos_alfa?.[hora]?.[lado]
    const puntos = h?.puntos as Record<string, Pt | null> | undefined
    if (!puntos) return
    const angulos = { anterior: h.anterior ?? 0, posterior: h.posterior ?? 0 }
    setEditorPlano('alfa')
    setEditorHora(hora)
    setEditorLado(lado)
    setEditorImgDims(null)
    setEditorLabel(`Ángulo Alfa — ${hora.replace('_', ' ')} ${lado === 'der' ? 'Derecho' : 'Izquierdo'}`)
    setEditorPuntos(puntos)
    setEditorOriginalPuntos(puntos)
    setEditorAngulos(angulos)
    setEditorOriginalAngulos(angulos)
    setEditorOpen(true)
    setEditorLoadingImage(true)
    setEditorImageUrl(null)
    setEditorSaveError(null)
    try {
      const clave = resultados.imagenes?.[`alfa_${hora}_${lado === 'der' ? 'derecho' : 'izquierdo'}`]
      if (!clave) throw new Error()
      const res = await fetch(`/mediciones/${estudioId}/imagen?clave=${encodeURIComponent(clave)}`)
      setEditorImageUrl((await res.json()).url)
    } catch { setEditorImageUrl(null) }
    finally { setEditorLoadingImage(false) }
  }

  const handleOpenEditorCoronal = async (variante: 'lateral' | 'inclinacion') => {
    const cor = resultados?.angulos_coronales
    const puntos = cor?.puntos as Record<string, Pt | null> | undefined
    if (!puntos) return
    const angulos = {
      centroBordeLateral_der: cor.centroBordeLateral?.der ?? 0,
      centroBordeLateral_izq: cor.centroBordeLateral?.izq ?? 0,
      inclinacionAcetabular_der: cor.inclinacionAcetabular?.der ?? 0,
      inclinacionAcetabular_izq: cor.inclinacionAcetabular?.izq ?? 0,
    }
    setEditorPlano('coronal')
    setEditorVariante(variante)
    setEditorImgDims(null)
    setEditorLabel(variante === 'inclinacion'
      ? 'Plano Coronal — Inclinación Acetabular'
      : 'Plano Coronal — Centro-Borde Lateral')
    setEditorPuntos(puntos)
    setEditorOriginalPuntos(puntos)
    setEditorAngulos(angulos)
    setEditorOriginalAngulos(angulos)
    setEditorOpen(true)
    setEditorLoadingImage(true)
    setEditorImageUrl(null)
    setEditorSaveError(null)
    try {
      const clave = resultados.imagenes?.[
        variante === 'inclinacion' ? 'inclinacion_acetabular' : 'angulo_centro_borde_lateral'
      ]
      if (!clave) throw new Error()
      const res = await fetch(`/mediciones/${estudioId}/imagen?clave=${encodeURIComponent(clave)}`)
      setEditorImageUrl((await res.json()).url)
    } catch { setEditorImageUrl(null) }
    finally { setEditorLoadingImage(false) }
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
    setEditorPlano('axial')
    setEditorImgDims(null)
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
      const res = await fetch(`/mediciones/${estudioId}/imagen?clave=${encodeURIComponent(clave)}`)
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
    let x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    let y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    // El handle se dibuja en la punta de la recta extendida, pero lo que se guarda
    // es el punto real (el borde detectado), asi que hay que deshacer la extension.
    const h = editorGeometria().handles.find(h => h.key === editorDragging)
    const o = h?.desde ? editorPuntos[h.desde] : null
    if (o && h?.extend) {
      x = o.x + (x - o.x) / h.extend
      y = o.y + (y - o.y) / h.extend
    }
    const newPuntos = { ...editorPuntos, [editorDragging]: { x, y } }
    setEditorPuntos(newPuntos)
    setEditorAngulos(recalcularAngulos(newPuntos))
  }

  // Sin dimensiones todavia no se puede medir: las imagenes no cuadradas
  // distorsionarian el angulo. Se rellenan en el onLoad de la imagen.
  const recalcularAngulos = (puntos: Record<string, Pt | null>) => {
    const d = editorImgDims
    if (!d) return editorAngulos
    if (editorPlano === 'sagital') return computeSagitalAngulos(puntos, editorOriginalPuntos, editorOriginalAngulos, d)
    if (editorPlano === 'coronal') return computeCoronalAngulos(puntos, d)
    if (editorPlano === 'alfa') return computeAlfaAngulos(puntos, editorOriginalPuntos, editorOriginalAngulos, d, editorLado)
    return computeAxialAngulos(puntos, editorOriginalPuntos, editorOriginalAngulos, editorNivel, d)
  }

  const handleEditorSvgMouseUp = () => setEditorDragging(null)

  const handleSaveEditor = async () => {
    if (!resultados || !estudioId) return
    setSavingEditor(true)
    setEditorSaveError(null)
    const updated = JSON.parse(JSON.stringify(resultados))
    if (editorPlano === 'sagital') {
      updated.angulos_sagitales.centro_borde_anterior[editorLado] = editorAngulos.centro_borde_anterior
      updated.angulos_sagitales.puntos[editorLado] = editorPuntos
    } else if (editorPlano === 'alfa') {
      const h = updated.angulos_alfa[editorHora][editorLado]
      h.anterior = editorAngulos.anterior
      h.posterior = editorAngulos.posterior
      h.puntos = editorPuntos
    } else if (editorPlano === 'coronal') {
      const c = updated.angulos_coronales
      for (const lado of ['der', 'izq'] as const) {
        c.centroBordeLateral[lado] = editorAngulos[`centroBordeLateral_${lado}`]
        c.inclinacionAcetabular[lado] = editorAngulos[`inclinacionAcetabular_${lado}`]
      }
      c.puntos = editorPuntos
    } else {
      const nivel = updated.angulos_axiales[editorNivel]
      nivel.aasa.der = editorAngulos.aasa_der
      nivel.aasa.izq = editorAngulos.aasa_izq
      nivel.pasa.der = editorAngulos.pasa_der
      nivel.pasa.izq = editorAngulos.pasa_izq
      nivel.hasa.der = r2(editorAngulos.aasa_der + editorAngulos.pasa_der)
      nivel.hasa.izq = r2(editorAngulos.aasa_izq + editorAngulos.pasa_izq)
      nivel.puntos = editorPuntos
    }
    try {
      const res = await fetch(`/mediciones/${estudioId}`, {
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

  // Contenido de los resultados de una medicion. Vive en la pestaña Mediciones,
  // a ancho completo; antes estaba embutido en un modal de 3xl.
  const renderResultados = () => (
    <div className="p-6">
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

                      const BtnCorregir = ({ onClick }: { onClick: () => void }) => (
                        <button
                          onClick={onClick}
                          className="p-1 text-gray-300 hover:text-amber-500 transition-colors"
                          title="Corregir ángulos"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
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
                                        <td className="px-4 py-2 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <OjoBtn clave="angulo_centro_borde_lateral" label="Centro-Borde Lateral" valores={{ izq: resultados.angulos_coronales.centroBordeLateral.izq, der: resultados.angulos_coronales.centroBordeLateral.der }} />
                                            {resultados.angulos_coronales?.puntos && <BtnCorregir onClick={() => handleOpenEditorCoronal('lateral')} />}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                    {resultados.angulos_coronales.inclinacionAcetabular && (
                                      <tr>
                                        <td className="px-4 py-2 text-gray-700">Inclinacion Acetabular</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{resultados.angulos_coronales.inclinacionAcetabular.izq}°</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{resultados.angulos_coronales.inclinacionAcetabular.der}°</td>
                                        <td className="px-4 py-2 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <OjoBtn clave="inclinacion_acetabular" label="Inclinación Acetabular" valores={{ izq: resultados.angulos_coronales.inclinacionAcetabular.izq, der: resultados.angulos_coronales.inclinacionAcetabular.der }} />
                                            {resultados.angulos_coronales?.puntos && <BtnCorregir onClick={() => handleOpenEditorCoronal('inclinacion')} />}
                                          </div>
                                        </td>
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
                                    {Object.entries(resultados.angulos_sagitales).filter(([k]) => k !== 'puntos').map(([key, val]: [string, any]) => (
                                      <tr key={key}>
                                        <td className="px-4 py-2 text-gray-700">
                                          {key === 'centro_borde_anterior' ? 'Centro-Borde Anterior' : key}
                                        </td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{val.izq}°</td>
                                        <td className="px-4 py-2 text-center text-gray-900 font-medium">{val.der}°</td>
                                        <td className="px-4 py-2 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <OjoBtnTabs
                                              label="Centro-Borde Anterior"
                                              tabs={[
                                                { clave: 'angulo_centro_borde_anterior_derecho', tabLabel: 'Derecho', valor: val.der },
                                                { clave: 'angulo_centro_borde_anterior_izquierdo', tabLabel: 'Izquierdo', valor: val.izq },
                                              ]}
                                            />
                                            {resultados.angulos_sagitales?.puntos && (['der', 'izq'] as const).map(lado => (
                                              <button
                                                key={lado}
                                                onClick={() => handleOpenEditorSagital(lado)}
                                                className="px-1 text-[10px] font-semibold text-gray-300 hover:text-amber-500 transition-colors"
                                                title={`Corregir ángulo ${lado === 'der' ? 'derecho' : 'izquierdo'}`}
                                              >
                                                {lado === 'der' ? 'D' : 'I'}
                                              </button>
                                            ))}
                                          </div>
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
                                          <div className="flex items-center justify-center gap-1">
                                            <OjoBtnTabs
                                              label={`Ángulo Alfa ${hora.replace('_', ' ')}`}
                                              tabs={[
                                                { clave: `alfa_${hora}_derecho`, tabLabel: 'Derecho', valor: val.der?.anterior },
                                                { clave: `alfa_${hora}_izquierdo`, tabLabel: 'Izquierdo', valor: val.izq?.anterior },
                                              ]}
                                            />
                                            {(['der', 'izq'] as const).filter(l => val[l]?.puntos).map(l => (
                                              <button
                                                key={l}
                                                onClick={() => handleOpenEditorAlfa(hora, l)}
                                                className="px-1 text-[10px] font-semibold text-gray-300 hover:text-amber-500 transition-colors"
                                                title={`Corregir ${l === 'der' ? 'derecho' : 'izquierdo'}`}
                                              >
                                                {l === 'der' ? 'D' : 'I'}
                                              </button>
                                            ))}
                                          </div>
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
  );


  useEffect(() => {
    // Cambiar de estudio tiene que cerrar lo que este abierto: si no, el modal
    // de imagen o el editor quedarian mostrando datos del estudio anterior.
    handleCerrarImagen();
    setEditorOpen(false);
    if (!estudioId) { setResultados(null); return; }
    let cancelado = false;
    (async () => {
      setLoadingResultados(true);
      setResultadosError(null);
      setResultados(null);
      try {
        const res = await fetch(`/mediciones/${estudioId}`);
        if (!res.ok) throw new Error('No se encontraron resultados para este estudio');
        const data = await res.json();
        if (!cancelado) setResultados(data.resultados);
      } catch (err) {
        if (!cancelado) setResultadosError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        if (!cancelado) setLoadingResultados(false);
      }
    })();
    return () => { cancelado = true; };
  }, [estudioId]);

  return (
    <>
      {renderResultados()}

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
                {editorMetricas().map(({ key, label, color }) => (
                  <div key={key} className="text-center">
                    <p className={`text-xs font-medium ${color} uppercase tracking-wide`}>{label}</p>
                    <p className="text-xl font-bold text-gray-900">{editorAngulos[key] ?? 0}°</p>
                  </div>
                ))}
                {editorMetricasSecundarias().map(({ label, valor }, i) => (
                  <div key={label} className={`text-center ${i === 0 ? 'ml-4 pl-4 border-l border-gray-200' : ''}`}>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-xl font-bold text-gray-500">{valor}°</p>
                  </div>
                ))}
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
                    {/* inline-block wrapper shrinks to img size; SVG absolute covers it exactly */}
                    <div style={{ display: 'inline-block', position: 'relative', maxHeight: '75vh', maxWidth: '100%', lineHeight: 0 }}>
                      <img
                        src={editorImageUrl}
                        alt={editorLabel}
                        style={{ display: 'block', maxHeight: '75vh', maxWidth: '100%' }}
                        draggable={false}
                        onLoad={(e) => setEditorImgDims({
                          w: e.currentTarget.naturalWidth,
                          h: e.currentTarget.naturalHeight,
                        })}
                      />
                      {/* SVG overlay — position absolute garantiza que cubre exactamente la imagen */}
                      <svg
                        ref={svgRef}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: editorDragging ? 'grabbing' : 'default' }}
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        onMouseMove={handleEditorSvgMouseMove}
                        onMouseUp={handleEditorSvgMouseUp}
                        onMouseLeave={handleEditorSvgMouseUp}
                      >

                        {/* Rectas: origen → punto, extendidas si el backend las dibuja así */}
                        {editorGeometria().lineas.map(({ from, to, color, extend }) => {
                          const c = editorPuntos[from]
                          const p = editorPuntos[to]
                          if (!c || !p) return null
                          const k = extend ?? 1
                          return (
                            <line
                              key={`${from}-${to}`}
                              x1={c.x * 100} y1={c.y * 100}
                              x2={(c.x + (p.x - c.x) * k) * 100} y2={(c.y + (p.y - c.y) * k) * 100}
                              stroke={color}
                              strokeWidth="0.6"
                              opacity="0.9"
                            />
                          )
                        })}

                        {/* Puntos fijos (no arrastrables) */}
                        {editorGeometria().fijos.map(key => {
                          const p = editorPuntos[key]
                          if (!p) return null
                          return <circle key={`dot-${key}`} cx={p.x * 100} cy={p.y * 100} r="0.8" fill="#22c55e" opacity="0.9" />
                        })}

                        {/* Handles arrastrables */}
                        {editorGeometria().handles.map(({ key, color, extend, desde }) => {
                          const p = editorPuntos[key]
                          if (!p) return null
                          const isDragging = editorDragging === key
                          // Si la recta se dibuja extendida, el handle va en la punta:
                          // agarrar el medio de la recta es confuso y da poco brazo.
                          const o = desde ? editorPuntos[desde] : null
                          const v = (o && extend)
                            ? { x: o.x + (p.x - o.x) * extend, y: o.y + (p.y - o.y) * extend }
                            : p
                          return (
                            <circle
                              key={key}
                              cx={v.x * 100}
                              cy={v.y * 100}
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
                {editorLeyenda().map(({ color, texto }) => (
                  <span key={texto} className="flex items-center gap-1.5"><span className={`w-3 h-0.5 ${color} inline-block`}></span>{texto}</span>
                ))}
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
    </>
  );
}
