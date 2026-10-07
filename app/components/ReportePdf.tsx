'use client';

import {
  Pt, Recta, OverlayRectas,
  RECTAS_AXIAL, RECTAS_SAGITAL, RECTAS_CORONAL_LATERAL, RECTAS_CORONAL_INCLINACION, RECTAS_ALFA,
} from './rectas';

// Version imprimible del reporte de una medicion.
//
// En pantalla el reporte muestra solo las tablas: las imagenes viven en el
// modal y se cargan de una a la vez. Para imprimir hay que tener las 19 en el
// documento a la vez, con sus rectas encima, asi que esto arma un documento
// aparte en vez de reusar el de pantalla.
//
// Queda oculto con display:none (ver #reporte-impresion en globals.css) y solo
// aparece en @media print. La ventaja de imprimir el DOM en lugar de generar el
// PDF nosotros es que el texto sale como texto —seleccionable, buscable— y no
// hace falta ninguna dependencia nueva: el "Guardar como PDF" del navegador
// hace el resto.

const gr = (v: unknown) => (v === undefined || v === null ? '—' : `${v}°`)

export type ItemImpresion = {
  id: string
  titulo: string
  src: string
  valores: Array<{ label: string; valor: string }>
  puntos: Record<string, Pt | null> | null
  rectas: Recta[]
}

/**
 * Enumera las imagenes del estudio con sus valores y sus rectas.
 *
 * Deja afuera las que no tienen imagen guardada en MinIO: un plano puede haber
 * fallado y el reporte no tiene por que mostrar un hueco.
 *
 * `urlDe` lo inyecta quien llama para no duplicar la ruta del endpoint.
 */
export function armarItemsImpresion(
  resultados: any,
  urlDe: (clave: string) => string | null,
): ItemImpresion[] {
  if (!resultados) return []
  const imagenes = resultados.imagenes ?? {}
  const items: ItemImpresion[] = []

  const agregar = (
    nombre: string,
    titulo: string,
    valores: Array<{ label: string; valor: string }>,
    puntos: Record<string, Pt | null> | null | undefined,
    rectas: Recta[],
  ) => {
    const clave = imagenes[nombre]
    if (!clave) return
    const src = urlDe(clave)
    if (!src) return
    items.push({ id: nombre, titulo, src, valores, puntos: puntos ?? null, rectas })
  }

  const cor = resultados.angulos_coronales
  if (cor) {
    if (cor.centroBordeLateral) {
      agregar('angulo_centro_borde_lateral', 'Plano Coronal · Centro-Borde Lateral', [
        { label: 'Izquierdo', valor: gr(cor.centroBordeLateral.izq) },
        { label: 'Derecho', valor: gr(cor.centroBordeLateral.der) },
      ], cor.puntos, RECTAS_CORONAL_LATERAL)
    }
    if (cor.inclinacionAcetabular) {
      agregar('inclinacion_acetabular', 'Plano Coronal · Inclinación Acetabular', [
        { label: 'Izquierdo', valor: gr(cor.inclinacionAcetabular.izq) },
        { label: 'Derecho', valor: gr(cor.inclinacionAcetabular.der) },
      ], cor.puntos, RECTAS_CORONAL_INCLINACION)
    }
  }

  const sag = resultados.angulos_sagitales
  if (sag?.centro_borde_anterior) {
    for (const [lado, nombreLado] of [['der', 'Derecho'], ['izq', 'Izquierdo']] as const) {
      agregar(
        `angulo_centro_borde_anterior_${lado === 'der' ? 'derecho' : 'izquierdo'}`,
        `Plano Sagital · Centro-Borde Anterior · ${nombreLado}`,
        [{ label: nombreLado, valor: gr(sag.centro_borde_anterior[lado]) }],
        sag.puntos?.[lado],
        RECTAS_SAGITAL,
      )
    }
  }

  const ax = resultados.angulos_axiales
  if (ax) {
    for (const nivel of ['proximal', 'intermedio', 'ecuatorial'] as const) {
      const d = ax[nivel]
      if (!d) continue
      const valores = Object.entries(d)
        .filter(([k]) => k !== 'puntos')
        .flatMap(([ang, v]: [string, any]) => [
          { label: `${ang.toUpperCase()} Izq`, valor: gr(v?.izq) },
          { label: `${ang.toUpperCase()} Der`, valor: gr(v?.der) },
        ])
      agregar(
        `angulos_axiales_${nivel}_aasa_pasa`,
        `Plano Axial · ${nivel.charAt(0).toUpperCase()}${nivel.slice(1)}`,
        valores, d.puntos, RECTAS_AXIAL,
      )
    }
  }

  const alfa = resultados.angulos_alfa
  if (alfa) {
    for (const [hora, val] of Object.entries(alfa) as [string, any][]) {
      for (const [lado, nombreLado] of [['der', 'Derecho'], ['izq', 'Izquierdo']] as const) {
        const h = val?.[lado]
        if (!h) continue
        agregar(
          `alfa_${hora}_${lado === 'der' ? 'derecho' : 'izquierdo'}`,
          `Ángulo Alfa · ${hora.replace('_', ' ')} · ${nombreLado}`,
          [
            { label: 'Anterior', valor: gr(h.anterior) },
            { label: 'Posterior', valor: gr(h.posterior) },
          ],
          h.puntos, RECTAS_ALFA,
        )
      }
    }
  }

  return items
}

// --- Piezas del documento ---

const Seccion = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginBottom: '5mm' }}>
    <h2 style={{
      fontSize: '8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
      color: '#334155', borderBottom: '1px solid #cbd5e1', paddingBottom: '1mm', marginBottom: '1.5mm',
    }}>
      {titulo}
    </h2>
    {children}
  </section>
)

const tablaEstilo: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }
const th: React.CSSProperties = { textAlign: 'left', fontWeight: 600, color: '#64748b', padding: '1mm 2mm 1mm 0', fontSize: '7.5pt', textTransform: 'uppercase', letterSpacing: '.04em' }
const thN: React.CSSProperties = { ...th, textAlign: 'center' }
const td: React.CSSProperties = { padding: '1mm 2mm 1mm 0', borderTop: '1px solid #e2e8f0', color: '#334155' }
const tdN: React.CSSProperties = { ...td, textAlign: 'center', fontWeight: 600, color: '#0f172a' }

/** Tarjeta de una imagen con sus rectas y sus valores. */
function TarjetaImagen({ item, onLista }: { item: ItemImpresion; onLista: () => void }) {
  return (
    <figure style={{ margin: 0, border: '1px solid #e2e8f0', borderRadius: '2mm', overflow: 'hidden' }}>
      <figcaption style={{
        fontSize: '7.5pt', fontWeight: 700, color: '#334155', padding: '1.5mm 2mm',
        background: '#f1f5f9', borderBottom: '1px solid #e2e8f0',
      }}>
        {item.titulo}
      </figcaption>

      {/* El contenedor tiene que medir exactamente la imagen renderizada: el
          overlay se posiciona en % sobre el, asi que cualquier espacio de mas
          (letterboxing por max-height, o el hueco de lineHeight) corre las
          rectas respecto de la anatomia. De ahi el width 100% / height auto sin
          object-fit, que deja la caja con el aspecto exacto del PNG. */}
      <div style={{ position: 'relative', background: '#000', lineHeight: 0 }}>
        <img
          src={item.src}
          alt={item.titulo}
          onLoad={onLista}
          onError={onLista}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
        {item.puntos && <OverlayRectas puntos={item.puntos} rectas={item.rectas} />}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: item.valores.length > 2 ? '1fr 1fr' : '1fr',
        gap: '0 3mm', padding: '1.5mm 2mm', fontSize: '8pt',
      }}>
        {item.valores.map((v) => (
          <div key={v.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '2mm' }}>
            <span style={{ color: '#64748b' }}>{v.label}</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{v.valor}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}

export default function ReportePdf({
  resultados, items, paciente, fecha, descripcion, estudioId, onImagenLista,
}: {
  resultados: any
  items: ItemImpresion[]
  paciente: string
  fecha: string | null
  descripcion?: string | null
  estudioId: number | null
  onImagenLista: () => void
}) {
  if (!resultados) return null

  const cor = resultados.angulos_coronales
  const sag = resultados.angulos_sagitales
  const ax = resultados.angulos_axiales
  const alfa = resultados.angulos_alfa
  const fallidas: Record<string, any> = resultados.secciones_fallidas ?? {}

  const cabecera = (
    <header style={{ borderBottom: '2px solid #0f172a', paddingBottom: '2mm', marginBottom: '4mm' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '4mm' }}>
        <div>
          <p style={{ fontSize: '7pt', fontWeight: 700, letterSpacing: '.12em', color: '#2563eb', textTransform: 'uppercase', margin: 0 }}>
            Hip-Pal · Reporte de mediciones
          </p>
          <h1 style={{ fontSize: '14pt', fontWeight: 700, color: '#0f172a', margin: '1mm 0 0' }}>{paciente}</h1>
        </div>
        <div style={{ textAlign: 'right', fontSize: '8pt', color: '#475569', lineHeight: 1.5 }}>
          {fecha && <div>Fecha del estudio: <strong style={{ color: '#0f172a' }}>{fecha}</strong></div>}
          {estudioId !== null && <div>Estudio #{estudioId}</div>}
          <div>Emitido: {new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
      {descripcion && (
        <p style={{ fontSize: '8pt', color: '#475569', margin: '1.5mm 0 0' }}>Descripción: {descripcion}</p>
      )}
    </header>
  )

  return (
    <div id="reporte-impresion">
      {cabecera}

      {Object.keys(fallidas).length > 0 && (
        <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', padding: '2mm 3mm', borderRadius: '2mm', marginBottom: '4mm' }}>
          <p style={{ fontSize: '8.5pt', fontWeight: 700, color: '#78350f', margin: 0 }}>
            Algunas mediciones no se pudieron realizar
          </p>
          <ul style={{ margin: '1mm 0 0', paddingLeft: '5mm', fontSize: '8pt', color: '#92400e' }}>
            {Object.entries(fallidas).map(([seccion, motivo]) => (
              <li key={seccion}>{seccion.replace(/_/g, ' ')} — {String(motivo)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Valores calculados */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8mm', alignItems: 'start' }}>
        {cor && (
          <Seccion titulo="Plano Coronal">
            <table style={tablaEstilo}>
              <thead>
                <tr><th style={th}>Ángulo</th><th style={thN}>Izq</th><th style={thN}>Der</th></tr>
              </thead>
              <tbody>
                {cor.centroBordeLateral && (
                  <tr>
                    <td style={td}>Centro-Borde Lateral</td>
                    <td style={tdN}>{gr(cor.centroBordeLateral.izq)}</td>
                    <td style={tdN}>{gr(cor.centroBordeLateral.der)}</td>
                  </tr>
                )}
                {cor.inclinacionAcetabular && (
                  <tr>
                    <td style={td}>Inclinación Acetabular</td>
                    <td style={tdN}>{gr(cor.inclinacionAcetabular.izq)}</td>
                    <td style={tdN}>{gr(cor.inclinacionAcetabular.der)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Seccion>
        )}

        {sag && (
          <Seccion titulo="Plano Sagital">
            <table style={tablaEstilo}>
              <thead>
                <tr><th style={th}>Ángulo</th><th style={thN}>Izq</th><th style={thN}>Der</th></tr>
              </thead>
              <tbody>
                {(Object.entries(sag).filter(([k]) => k !== 'puntos') as [string, any][]).map(([key, val]) => (
                  <tr key={key}>
                    <td style={td}>{key === 'centro_borde_anterior' ? 'Centro-Borde Anterior' : key}</td>
                    <td style={tdN}>{gr(val?.izq)}</td>
                    <td style={tdN}>{gr(val?.der)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Seccion>
        )}

        {ax && (
          <Seccion titulo="Plano Axial">
            <table style={tablaEstilo}>
              <thead>
                <tr>
                  <th style={th}>Nivel</th><th style={th}>Ángulo</th><th style={thN}>Izq</th><th style={thN}>Der</th>
                </tr>
              </thead>
              <tbody>
                {(['proximal', 'intermedio', 'ecuatorial'] as const).filter(n => ax[n]).flatMap((nivel) => {
                  const entradas = Object.entries(ax[nivel]).filter(([k]) => k !== 'puntos') as [string, any][]
                  return entradas.map(([ang, v], i) => (
                    <tr key={`${nivel}-${ang}`}>
                      {i === 0 && <td style={{ ...td, textTransform: 'capitalize' }} rowSpan={entradas.length}>{nivel}</td>}
                      <td style={{ ...td, textTransform: 'uppercase' }}>{ang}</td>
                      <td style={tdN}>{gr(v?.izq)}</td>
                      <td style={tdN}>{gr(v?.der)}</td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          </Seccion>
        )}

        {alfa && (
          <Seccion titulo="Ángulo Alfa">
            <table style={tablaEstilo}>
              <thead>
                <tr>
                  <th style={th}>Hora</th>
                  <th style={thN}>Izq Ant</th><th style={thN}>Izq Post</th>
                  <th style={thN}>Der Ant</th><th style={thN}>Der Post</th>
                </tr>
              </thead>
              <tbody>
                {(Object.entries(alfa) as [string, any][]).map(([hora, val]) => (
                  <tr key={hora}>
                    <td style={{ ...td, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{hora.replace('_', ' ')}</td>
                    <td style={tdN}>{gr(val?.izq?.anterior)}</td>
                    <td style={tdN}>{gr(val?.izq?.posterior)}</td>
                    <td style={tdN}>{gr(val?.der?.anterior)}</td>
                    <td style={tdN}>{gr(val?.der?.posterior)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Seccion>
        )}
      </div>

      {/* Imagenes. Arrancan en pagina nueva: los valores entran en la primera y
          asi el informe se puede leer sin pasar hojas. */}
      {items.length > 0 && (
        <div style={{ breakBefore: 'page', pageBreakBefore: 'always' }}>
          <h2 style={{
            fontSize: '8pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
            color: '#334155', borderBottom: '1px solid #cbd5e1', paddingBottom: '1mm', marginBottom: '3mm',
          }}>
            Imágenes · {paciente}
          </h2>
          <div style={{ fontSize: 0, marginLeft: '-2mm', marginRight: '-2mm' }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'inline-block', verticalAlign: 'top', width: '50%',
                  padding: '0 2mm 4mm', boxSizing: 'border-box', fontSize: '8pt',
                  breakInside: 'avoid', pageBreakInside: 'avoid',
                }}
              >
                <TarjetaImagen item={item} onLista={onImagenLista} />
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ marginTop: '5mm', fontSize: '7pt', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '1.5mm' }}>
        Generado por Hip-Pal. Las mediciones pueden haber sido corregidas manualmente.
      </p>
    </div>
  )
}
