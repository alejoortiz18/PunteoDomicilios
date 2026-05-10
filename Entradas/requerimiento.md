# Requerimiento — Sistema de Punteo de Domicilios
> Actualizado: 2026-05-08 · Refleja el estado real del prototipo y el alcance del MVC

---

## 1. Problema

El equipo de coordinación de mensajería revisa diariamente el estado de soporte de los domicilios despachados. El proceso es 100% manual:

1. El coordinador descarga el reporte de `MvMensajer` en Excel.
2. Consulta la API interna uno por uno para saber cuáles tienen soporte físico.
3. Anota manualmente cuáles tienen soporte y cuáles no.

Con 120+ documentos por revisar en un solo día, el proceso tarda entre 40 minutos y 2 horas, es propenso a errores y no ofrece visibilidad histórica.

---

## 2. Enfoque de entrega: Prototipo → MVC

El proyecto sigue un enfoque en dos fases:

| Fase | Descripción | Stack |
|------|-------------|-------|
| **Prototipo** ✅ | Interfaz funcional con datos reales, sin backend | Vanilla JS + Chart.js |
| **MVC** 🔜 | Sistema completo con SQL Server, API real y proxy | .NET 10 MVC + Dapper |

El prototipo valida el flujo UX y los datos antes de construir el backend. Se encuentra en la carpeta `prototipo/`.

---

## 3. Contexto: fuentes de datos

### 3.1 Base de datos SQL Server

- **BD:** HELPHARMA  
- **Tabla:** `MvMensajer`  
- **Campos:** `Mensajero, Fecha, Nrodcto, Destino, Refrigera, CuotaMod, Domicilio, Observacio, NroConsig, VlrConsig, NroPlanilla, Usuario, id`

```sql
-- Registros por usuario y fecha
SELECT * FROM MvMensajer
WHERE Fecha = @Fecha AND Usuario = @Usuario

-- Usuarios únicos para selector
SELECT DISTINCT Usuario FROM MvMensajer ORDER BY Usuario
```

> El campo `Usuario` identifica al mensajero (bodega). En el prototipo se usan 6 usuarios fijos (`MMUNOZ`, `JGARCIA`, `CMARTINEZ`, `PRODRIGO`, `ASANCHEZ`, `LTORRES`). Solo `MMUNOZ` tiene datos reales cargados (179,683 registros exportados de Excel).

### 3.2 API de consulta de soportes

```
GET https://intranet.helpharma.com/api/v1/consultasoporte/{Nrodcto}
Authorization: Bearer {TOKEN}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": [{
    "fechaRegistro": "2026-05-04 14:37:01",
    "storage_disk": "s3://helpharma-soportes-dispensacion",
    "storage_path": "soportes/2026/05/04/K8227073.pdf"
  }]
}
```

**Respuesta negativa:**
```json
{ "success": false, "message": "No se encontraron soportes" }
```

> En el prototipo, `mockConsultaSoporte(nrodcto)` simula esta API con resultado determinístico (~80% éxito, consistente por nrodcto).

### 3.3 Descarga de archivos

```
GET https://intranet.helpharma.com/ver-pdf/{storage_path}
```

Requiere sesión autenticada (Basic Auth o cookies). El MVC actuará como proxy para no exponer credenciales al cliente.

---

## 4. Usuarios del sistema (Bodegas)

Los usuarios no tienen contraseña. El sistema identifica al mensajero por su código de usuario:

| Código | Nombre |
|--------|--------|
| `MMUNOZ` | M. Muñoz *(datos reales disponibles)* |
| `JGARCIA` | J. García |
| `CMARTINEZ` | C. Martínez |
| `PRODRIGO` | P. Rodrigo |
| `ASANCHEZ` | A. Sánchez |
| `LTORRES` | L. Torres |

En el prototipo: login por código de texto simple, sin contraseña, sesión en `sessionStorage`. En el MVC: autenticación a definir (Windows Auth o similar).

---

## 5. Funcionalidades implementadas (Prototipo)

### 5.1 Login (`login.html`)
- Campo de texto para ingresar el código de usuario.
- Valida contra la lista de BODEGAS hardcoded.
- Guarda sesión en `sessionStorage` (`punteo_usuario`).
- URL param `?cambiar=1` permite cambiar de usuario.
- Código inválido muestra modal de error con ejemplos.

### 5.2 Dashboard (`index.html`)
- Resumen mensual: tabla **Mes/Año | Total Registros | Planillas | Ver detalle →**.
- Cada fila enlaza a `detalle.html?mes=YYYY-MM`.
- Consulta por fecha: selector de fecha + botón "Iniciar Consulta".
- Barra de progreso animada mientras se procesan registros (mock).
- KPIs: Total Registros | Total Cuota Mod (COP) | Planillas Distintas | % Con Soporte.
- Gráficos Chart.js:
  - Barras apiladas: timeline de 7 días (Entregados / Faltantes).
  - Donut: proporción Con Soporte / Sin Soporte del día consultado.
- Usa datos reales de `datos-reales.js` para `MMUNOZ`; mock generado para otros usuarios.

### 5.3 Detalle de mes (`detalle.html`)
- URL param: `mes=YYYY-MM`.
- **Nivel 1 — días del mes:** tabla con Fecha | Total Soportes | Entregados ✅ | Faltantes ❌ | "Ver detalle →".
- **Nivel 2 — registros del día:** panel expandible con columnas Nrodcto | Destino | Cuota Mod | Nro. Planilla | Estado | Acción.
  - Estado: badge verde "Entregado" / rojo "Faltante" (calculado con `mockConsultaSoporte`).
  - Botón "Ver soporte" (solo si éxito) → modal con `storage_path` + enlace de descarga.
- Modal se cierra con clic en backdrop o tecla Escape.
- Si no hay datos reales para un día, cae al mock `generateDataset()`.

### 5.4 Datos reales (`datos-reales.js`)
- Generado con `Entradas/convert-excel.ps1` desde `Entradas/datos-ejemplo.xlsx`.
- 179,683 registros exportados, usuario `MMUNOZ`, múltiples fechas.
- Estructura: `window.DATOS_REALES["MMUNOZ"]["YYYY-MM-DD"] = [[nrodcto,destino,cuotaMod,nroPlanilla,id],...]`
- Tamaño: 7.2 MB (uso aceptable para prototipo; el MVC usará SQL + API en su lugar).

---

## 6. Funcionalidades del MVC (alcance Semanas 1–6)

Las siguientes funcionalidades **no están en el prototipo** y serán implementadas en el MVC:

| Funcionalidad | Semana |
|---------------|--------|
| Conexión real a SQL Server (Dapper) | 1 |
| Consulta real a API `consultasoporte` (HttpClient + Polly) | 2 |
| Proxy autenticado para descarga de PDFs | 5 |
| Caché en memoria (`IMemoryCache`, 30 min por Nrodcto) | 2 |
| Semáforo de concurrencia (máx. 5 llamadas simultáneas a la API) | 2 |
| Autenticación de usuarios (roles, contraseñas) | fuera de v1 |
| Reportes históricos multiperiodo | fuera de v1 |
| Logging estructurado (Serilog) | 6 |
| Tests E2E (Playwright + NUnit) | 6 |

---

## 7. API de consultasoporte — Contratos definitivos

### Consulta individual
```
GET /api/v1/consultasoporte/{Nrodcto}
Authorization: Bearer {TOKEN}
Timeout: 10 segundos
Retry: 2 veces con backoff exponencial
```

### Batch
El MVC consultará en paralelo con `SemaphoreSlim(maxConcurrent: 5)`. Cada Nrodcto se deduplica antes de consultar. Resultado cacheado 30 minutos.

---

## 8. Arquitectura MVC (.NET 10)

```
Proyecto-MVC/PunteoDomicilios.Web/
├── Controllers/   DashboardController · DetalleController
├── Services/      MensajeroService · SoporteApiService · DescargaService · CacheService
├── Repositories/  MensajeroRepository (Dapper)
├── Models/        MvMensajer · SoporteApiResponse · EstadoSoporte
├── DTOs/          ConsultaFiltroDto · NrodctoEstadoDto · MensajeroResumenDto · DetalleArchivoDto · TimelineItemDto
├── Views/         Dashboard/Index · Detalle/Index · Detalle/SinSoporte · Shared/_Layout
├── Middleware/    GlobalExceptionMiddleware
├── wwwroot/       css/punteo.css · js/dashboard.js · js/tabla.js · js/descarga.js
└── appsettings.json
```

Frontend MVC: Bootstrap 5.3 + Chart.js 4.x + Tom Select. El diseño visual toma como referencia el prototipo (`shared.css`).

---

## 9. Credenciales requeridas

| Credencial | Cuándo se necesita |
|------------|--------------------|
| `ConnectionStrings.Helpharma` | Semana 1 — conexión SQL Server |
| `ApiInterna.Token` | Semana 2 — consulta API soporte |
| `DescargaInterna.Usuario` | Semana 5 — proxy PDF |
| `DescargaInterna.Password` | Semana 5 — proxy PDF |

---

## 10. Seguridad (OWASP)

- `storagePath` en descarga: validar que no contiene `../` (path traversal).
- `nrodcto`: validar formato antes de consultar API.
- Token Bearer nunca expuesto al cliente.
- `appsettings.json` excluido de Git.
- Headers de seguridad: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection.
