# Hip-Pal SPA

Aplicación web para la gestión y análisis de tomografías de cadera. Permite buscar pacientes desde un servidor PACS (Orthanc), seleccionar series DICOM, configurar ángulos de medición y enviar análisis para procesamiento.

## Stack Tecnológico

- **Next.js 16** (App Router) con output `standalone` para Docker
- **React 19** con TypeScript
- **Tailwind CSS v4**

## Funcionalidades

### Buscador de Pacientes
Busca pacientes por nombre en el servidor PACS (Orthanc). Muestra una tabla con ID, nombre, cantidad de estudios, y accesos rápidos a series y mediciones.

### Series del Paciente (Modal)
Al hacer clic en "Ver series", se consultan las series DICOM del paciente. Se filtran automáticamente las series que contengan "bone" o "hueso" en la descripción. Muestra número de serie, descripción, modalidad y cantidad de instancias.

### Selección de Ángulos y Análisis
Al seleccionar una serie, se presenta un selector de ángulos agrupados por plano:
- **Plano Coronal**: AASA, PASA, HASA, Centro-Borde Lateral, Inclinación Acetabular
- **Plano Axial**: AASA/PASA/HASA en cortes Proximal, Intermedio, Ecuatorial
- **Plano Sagital**: Centro-Borde Anterior
- **Ángulo Alfa**: Horas 12 a 5

Todos los ángulos vienen seleccionados por defecto. Se pueden activar/desactivar individualmente o por grupo.

Al confirmar, se envía un POST a `/serie` con los datos de la serie, paciente, ángulos seleccionados, descripción e instancias. Esto crea un registro de estudio en la base de datos (estado: Pendiente) y publica el trabajo en RabbitMQ.

### Mediciones del Paciente (Modal)
Al hacer clic en "Ver mediciones", se consultan los estudios registrados del paciente vía GET `/estudios/{patient_id}`. Muestra una tabla con ID, descripción, instancias y estado (Pendiente, Procesando, Finalizado, Error) con badges de colores.

## Estructura del Proyecto

```
app/
├── page.tsx           # Página principal (búsqueda, modales, lógica)
├── types.ts           # Interfaces TypeScript (Patient, Series, etc.)
├── layout.tsx         # Layout con Sidebar y Topbar
├── globals.css        # Estilos globales
├── components/
│   ├── Sidebar.tsx    # Barra lateral de navegación
│   └── Topbar.tsx     # Barra superior
```

## Configuración

### Variables de Entorno

| Variable  | Descripción                        | Default                 |
|-----------|------------------------------------|-------------------------|
| `API_URL` | URL del backend (gestor-service)   | `http://localhost:8000` |

### Rewrites (Proxy)

La app usa rewrites de Next.js para redirigir las llamadas al backend:

| Ruta en SPA            | Destino en Backend           |
|------------------------|------------------------------|
| `/api/pacs/:path*`     | `{API_URL}/api/pacs/:path*`  |
| `/serie`               | `{API_URL}/serie`            |
| `/estudios/:path*`     | `{API_URL}/estudios/:path*`  |

## Desarrollo

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Docker

La imagen usa un build multi-stage con Node 20 Alpine:

```bash
docker build --build-arg API_URL=http://gestor-service:8000 -t hip-pal-spa .
```

El contenedor expone el puerto `3000`.
