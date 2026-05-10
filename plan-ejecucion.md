# 📋 PLAN DE EJECUCIÓN — Sistema de Punteo de Domicilios
> Metodología Shape Up · Ciclo de 6 semanas  
> Stack: .NET 10 MVC · SQL Server · Dapper · Chart.js · Bootstrap 5.3  
> Proyecto: `PunteoDomicilios.Web` · Tests: Playwright E2E · Deploy: IIS Windows  
> Fecha inicio: 2026-05-08

---

## ✅ Estado actual del prototipo (completado antes de Semana 1)

Antes de comenzar el ciclo MVC se construyó un prototipo funcional en Vanilla JS que valida el flujo completo con datos reales.

### Archivos del prototipo (`prototipo/`)

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `login.html` | ✅ | Login por código de usuario, sesión en `sessionStorage` |
| `index.html` | ✅ | Resumen mensual + consulta por fecha + KPIs + Charts |
| `detalle.html` | ✅ | Drill-down: días del mes → registros + modal "Ver soporte" |
| `shared.js` | ✅ | Session mgmt, `getResumenMensual`, `getDatosDelDia`, `getFechasDelMes`, `mockConsultaSoporte` |
| `shared.css` | ✅ | Design system custom (sidebar 2 ítems, topbar, cards, badges, modal) |
| `datos-reales.js` | ✅ | 179,683 registros usuario `MMUNOZ` exportados desde Excel (7.2 MB) |

Archivos eliminados del prototipo (ya no están en la navegación):
- ~~`historial.html`~~ · ~~`mensajeros.html`~~ · ~~`configuracion.html`~~ · ~~`logs.html`~~

### Funcionalidades validadas en el prototipo
- ✅ Login por código de usuario (6 bodegas hardcoded)
- ✅ Tabla de resumen mensual con total registros + planillas
- ✅ Consulta de día: selector de fecha + barra de progreso animada
- ✅ KPIs: Total Registros, Total Cuota Mod, Planillas Distintas, % Con Soporte
- ✅ Gráficos: barras 7 días (Entregados/Faltantes) + donut Con/Sin Soporte
- ✅ Detalle de mes: tabla de días con Entregados/Faltantes
- ✅ Detalle de día: panel inline con registros + badge de estado
- ✅ Modal "Ver soporte" con `storage_path` y enlace de descarga
- ✅ `mockConsultaSoporte()`: determinista por nrodcto (~80% éxito)
- ✅ Datos reales para MMUNOZ; mock automático para otros usuarios

### Script de conversión (`Entradas/convert-excel.ps1`)
- ✅ Fijo y funcional: auto-detecta separador CSV (`;` para locale español)
- ✅ Procesa `datos-ejemplo.xlsx` → `prototipo/datos-reales.js`
- Reejecutar si cambia el archivo Excel fuente

---

## Estado actual del workspace

```
PunteoDomicilios/
├── PunteoDomicilios.slnx          ✅ Existe
├── Entradas/
│   ├── requerimiento.md           ✅ Actualizado (refleja prototipo + MVC)
│   ├── convert-excel.ps1          ✅ Funcional (auto-detecta separador CSV)
│   └── datos-ejemplo.xlsx         ✅ Fuente: 179,684 filas exportadas
├── Salidas/
│   └── pitch-punteo-domicilios.md ✅ Actualizado (v2.0)
├── prototipo/
│   ├── login.html                 ✅ Completo
│   ├── index.html                 ✅ Completo
│   ├── detalle.html               ✅ Completo
│   ├── shared.js                  ✅ Completo
│   ├── shared.css                 ✅ Completo
│   └── datos-reales.js            ✅ Generado (7.2 MB, MMUNOZ)
├── plan-ejecucion.md              ✅ Actualizado
├── Proyecto-MVC/                  ❌ Pendiente — se crea en Semana 1
└── tests/PunteoDomicilios.Tests/  ✅ Existe (Playwright + NUnit configurado)
```

---

## Semana 1 — Infraestructura base

**Objetivo:** El proyecto compila, conecta a la BD y devuelve datos reales.

> ⚠️ **Referencia UX**: el MVC debe reproducir el mismo flujo del prototipo (`prototipo/`). El prototipo ya valida login, resumen mensual, consulta por día y drill-down de detalle.

### Tareas

#### 1.1 Crear proyecto MVC
- [ ] Crear `PunteoDomicilios.Web` con `dotnet new mvc` dentro de `Proyecto-MVC/`
- [ ] Agregar al `PunteoDomicilios.slnx`
- [ ] Agregar referencia al proyecto de tests

**Paquetes NuGet requeridos:**
| Paquete | Propósito |
|---------|-----------|
| `Dapper` | ORM ligero para consultas SQL |
| `Microsoft.Data.SqlClient` | Conector SQL Server |
| `Microsoft.Extensions.Caching.Memory` | Caché en memoria |
| `Polly` / `Microsoft.Extensions.Http.Resilience` | Retry + timeout en HttpClient |
| `Serilog.AspNetCore` | Logging estructurado |

#### 1.2 Configurar `appsettings.json`
```json
{
  "ConnectionStrings": {
    "Helpharma": "PENDIENTE — se provee en semana 1"
  },
  "ApiInterna": {
    "BaseUrl": "https://intranet.helpharma.com",
    "Token": "PENDIENTE — se provee en semana 1",
    "TimeoutSeconds": 10,
    "RetryCount": 2,
    "CacheMinutes": 30,
    "MaxConcurrentRequests": 5
  },
  "DescargaInterna": {
    "BaseUrl": "https://intranet.helpharma.com",
    "Usuario": "PENDIENTE",
    "Password": "PENDIENTE"
  },
  "Cache": {
    "HabilitarCache": true,
    "ExpirationMinutes": 30
  }
}
```
> ⚠️ **Credencial requerida en este punto:** `ConnectionStrings.Helpharma`

#### 1.3 Modelos y DTOs
Crear en orden (sin dependencias entre sí — se puede paralelizar):

**Models/**
- [ ] `MvMensajer.cs` — mapeo directo de la tabla BD

**DTOs/**
- [ ] `ConsultaFiltroDto.cs` — `{ string Usuario, DateOnly Fecha }`
- [ ] `NrodctoEstadoDto.cs` — `{ Nrodcto, Estado, FechaRegistro, StoragePath, MensajeError }`
- [ ] `MensajeroResumenDto.cs` — KPIs: Total, Encontrados, Faltantes, % Cobertura
- [ ] `DetalleArchivoDto.cs` — datos para vista detalle
- [ ] `TimelineItemDto.cs` — `{ Fecha, Total, Encontrados, Faltantes }`

**Enums/**
- [ ] `EstadoSoporte.cs` — `Pendiente | Encontrado | Faltante | Error`

**Respuestas API externa/**
- [ ] `SoporteApiResponse.cs` — deserialización JSON de `consultasoporte`

#### 1.4 Capa de datos (Repository)
- [ ] `IMensajeroRepository.cs`
- [ ] `MensajeroRepository.cs` — Dapper sobre SQL Server

Consultas SQL a implementar:
```sql
-- Usuarios únicos (para el selector)
SELECT DISTINCT Usuario FROM MvMensajer ORDER BY Usuario

-- Registros del día
SELECT * FROM MvMensajer
WHERE Fecha = @Fecha AND Usuario = @Usuario

-- Timeline (últimos N días, con agregación en servidor)
SELECT CAST(Fecha AS DATE) AS Fecha,
       COUNT(DISTINCT Nrodcto) AS Total
FROM MvMensajer
WHERE Usuario = @Usuario
  AND Fecha >= DATEADD(DAY, -@Dias, CAST(GETDATE() AS DATE))
GROUP BY CAST(Fecha AS DATE)
ORDER BY Fecha ASC
```

**Índice recomendado** (ejecutar en BD una sola vez):
```sql
CREATE INDEX IX_MvMensajer_UsuarioFecha ON MvMensajer (Usuario, Fecha);
```

#### 1.5 Servicios
- [ ] `IMensajeroService.cs` + `MensajeroService.cs` — orquesta repositorio
- [ ] `ISoporteApiService.cs` + `SoporteApiService.cs` — HttpClient + caché + semáforo
- [ ] `IDescargaService.cs` + `DescargaService.cs` — proxy con Basic Auth
- [ ] `CacheService.cs` — wrapper de `IMemoryCache`

**Autenticación descarga** (Basic Auth):
```csharp
// En Program.cs al registrar HttpClient de descarga
builder.Services.AddHttpClient<IDescargaService, DescargaService>(client =>
{
    client.BaseAddress = new Uri(config["DescargaInterna:BaseUrl"]!);
})
.ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
{
    Credentials = new NetworkCredential(
        config["DescargaInterna:Usuario"],
        config["DescargaInterna:Password"]
    )
});
```

#### 1.6 `Program.cs` — Registro de dependencias
- [ ] `IDbConnection` con Dapper (factory por request)
- [ ] HttpClient para API interna con Polly (retry 2 veces, timeout 10s)
- [ ] HttpClient para descarga con Basic Auth
- [ ] `IMemoryCache`
- [ ] Serilog
- [ ] `GlobalExceptionMiddleware`

#### 1.7 Middleware
- [ ] `GlobalExceptionMiddleware.cs` — captura excepciones no manejadas, retorna JSON o vista de error

#### ✅ Verificación semana 1
- La app compila y arranca en `https://localhost:5001`
- `GET /api/usuarios` devuelve lista de usuarios de la BD real
- `GET /api/registros?usuario=X&fecha=2026-05-07` devuelve registros reales

---

## Semana 2-3 — Dashboard + Consulta Batch

**Objetivo:** El coordinador puede seleccionar mensajero y fecha, lanzar el batch y ver el progreso en tiempo real.

### Semana 2 — Backend del dashboard

#### 2.1 `DashboardController.cs`
- [ ] `GET /` → carga lista de usuarios, retorna vista `Dashboard/Index.cshtml`
- [ ] `GET /api/registros` → devuelve `{ resumen, nrodctos[] }` (JSON)
- [ ] `POST /api/consultar-batch` → recibe `string[]`, devuelve `NrodctoEstadoDto[]` (JSON)
- [ ] `GET /api/timeline` → devuelve `TimelineItemDto[]` para los últimos 7 días

#### 2.2 Lógica del batch en `SoporteApiService`
- [ ] `ConsultarAsync(nrodcto)` — consulta individual con caché
- [ ] `ConsultarBatchAsync(nrodctos[], progress)` — paralelo con `SemaphoreSlim(maxConcurrent)`
  - Máximo de llamadas simultáneas configurable desde `appsettings.json`
  - Si la API responde error → estado `Error`, continúa con los demás
  - Si timeout → estado `Error` con mensaje "Timeout"
  - Deduplica Nrodctos antes de consultar

#### 2.3 Layout base `_Layout.cshtml`
- [ ] Bootstrap 5.3 (CDN)
- [ ] Chart.js 4.x (CDN)
- [ ] Tom Select (CDN) — selector con búsqueda incremental
- [ ] Font Awesome 6 (CDN) — iconos
- [ ] Inter font (Google Fonts)
- [ ] `<link>` a `~/css/punteo.css`

### Semana 3 — Frontend del dashboard

> ✅ **Referencia visual**: el prototipo `prototipo/index.html` + `prototipo/detalle.html` definen el diseño objetivo. El MVC debe replicar el layout y flujo de usuario ya validados.

#### 3.1 `Dashboard/Index.cshtml`
Secciones a implementar en orden:

| Sección | ID | Comportamiento |
|---------|----| --------------|
| Resumen mensual | `resumen-card` | Tabla Mes/Año \| Registros \| Planillas \| Ver detalle → |
| Consulta por fecha | `area-filtros` | Date input + botón Iniciar Consulta |
| Barra de progreso batch | `area-progreso` | Visible solo durante batch |
| Tarjetas KPI | `area-kpi` | Total Registros \| Total Cuota Mod \| Planillas \| % Con Soporte |
| Timeline Chart.js | `area-timeline` | Barras apiladas verde/rojo (7 días) |
| Donut Chart.js | `area-donut` | Con Soporte vs Sin Soporte del día |
| Empty state | `area-empty` | Cuando no hay resultados |

#### 3.2 `wwwroot/css/punteo.css`
- [ ] Variables CSS (tokens de diseño, colores semánticos)
- [ ] `.kpi-card` con hover effect
- [ ] `.badge-encontrado`, `.badge-faltante`, `.badge-pendiente`, `.badge-error`
- [ ] `.progress-batch` con animación gradient
- [ ] `.skeleton` con animación wave para loading
- [ ] Utilidades de estado visual

#### 3.3 `wwwroot/js/dashboard.js`
Flujo JavaScript:

```
[click Consultar]
      │
      ▼
1. Deshabilitar botón, mostrar spinner
2. fetch GET /api/registros?usuario=X&fecha=Y
3. Mostrar área KPI (Total inmediato), área progreso
4. fetch POST /api/consultar-batch con nrodctos[]
5. Mientras responde: polling GET /api/progreso cada 500ms → actualizar barras
6. Al terminar: actualizar KPIs finales, renderizar tabla, inicializar Chart.js
7. Re-habilitar botón
```

> **Nota v1:** El progreso del batch se calcula client-side (respuesta única del batch).  
> SignalR (streaming real) queda para v2.

- [ ] Inicialización de Tom Select en `#sel-usuario`
- [ ] Detección de cambios en filtros → mostrar `banner-cambios`
- [ ] Función `renderTabla(resultados[])` — genera filas HTML con badges
- [ ] Función `actualizarKpis(resumen)` — anima contador de cobertura
- [ ] Inicialización de Chart.js con datos del timeline
- [ ] Evento clic en barra del chart → filtra tabla al día seleccionado

#### 3.4 `wwwroot/js/tabla.js`
- [ ] Búsqueda inline en `#tabla-buscar` (filtra sin ir al servidor)
- [ ] Ordenamiento por clic en `<th data-sort="...">` (asc/desc toggle)
- [ ] Exportar CSV: genera `Blob` desde datos actuales en memoria, dispara descarga

#### 3.5 Partials
- [ ] `Shared/_KpiCards.cshtml` — 4 tarjetas con IDs para actualización JS
- [ ] `Shared/_ProgressBar.cshtml` — barra de progreso del batch
- [ ] `Shared/_EmptyState.cshtml` — reutilizable con modelo de tipo de estado

#### ✅ Verificación semanas 2-3
- Flujo completo: login → dashboard → resumen mensual visible de inmediato
- Consulta por fecha: seleccionar fecha → ver progreso → ver KPIs + charts
- Tabla de días en `detalle.html` muestra Entregados/Faltantes correcto
- Panel de registros del día se expande correctamente
- Modal "Ver soporte" muestra `storage_path` y enlace de descarga

---

## Semana 4 — Timeline + Tabla Detalle refinada

**Objetivo:** El timeline es interactivo y la tabla tiene todas sus funcionalidades.

#### 4.1 Timeline Chart.js
- [ ] Tipo `bar` apilado, eje X = fechas, verde = encontrados, rojo = faltantes
- [ ] Tooltip personalizado con Total / Con soporte / Sin soporte / % Cobertura
- [ ] Clic en barra → carga tabla del día seleccionado (sin recargar página)
- [ ] Barra activa con borde punteado
- [ ] Por defecto: últimos 7 días disponibles del mensajero

#### 4.2 Tabla detalle — columnas finales

| Columna | Implementación |
|---------|---------------|
| Nrodcto | Link `<a href="/detalle/{nrodcto}">` |
| Estado | Badge con color semántico |
| Fecha Registro | ISO → formato `dd/MM/yyyy HH:mm` vía JS |
| Ruta archivo | `text-truncate` con `title` tooltip |
| Acción | `Ver detalle` (Encontrado) o `Reintentar` (Faltante/Error) |

#### 4.3 Estados especiales del dashboard
- [ ] **Pantalla bienvenida** — cuando no se ha consultado aún (ilustración + flecha)
- [ ] **Skeleton loader** — reemplaza la tabla durante carga de registros
- [ ] **0 resultados** — empty state con caja vacía
- [ ] **Error de BD** — banner rojo sticky
- [ ] **Error de API (token)** — alerta naranja
- [ ] **Todos encontrados** — badge verde `¡Punteo completo! 🎉` (animación CSS)

#### ✅ Verificación semana 4
- Clic en barra del timeline filtra la tabla correctamente
- Todos los estados especiales se muestran en el escenario correcto
- Los badges tienen los colores correctos en todos los estados
- Búsqueda inline y ordenamiento de tabla funcionan sin recargar

---

## Semana 5 — Vista Detalle + Descarga Proxy

**Objetivo:** El usuario puede ver el detalle de un documento y descargar el PDF.

#### 5.1 `DetalleController.cs`
- [ ] `GET /detalle/{nrodcto}` → consulta API, retorna vista `Detalle/Index.cshtml`
  - Si API retorna `success: false` → retorna vista `SinSoporte.cshtml`
- [ ] `GET /detalle/descargar?path={storagePath}` → proxy autenticado, stream PDF

**Proxy de descarga (streaming sin cargar en memoria):**
```
Cliente → GET /detalle/descargar?path=soportes/2026/05/04/K8227073.pdf
              │
              ▼
         .NET Controller
              │── GET https://intranet.helpharma.com/ver-pdf/{path}
              │   (con Basic Auth: usuario + contraseña de appsettings)
              │
              ▼
         Stream → Response (PDF)
```

> ⚠️ **Credencial requerida en este punto:** `DescargaInterna.Usuario` y `DescargaInterna.Password`

#### 5.2 `Detalle/Index.cshtml`
- [ ] Breadcrumb: `Punteo Domicilios > {Usuario} · {Fecha} > {Nrodcto}`
- [ ] Card con información del documento (Nrodcto, FechaRegistro, StorageDisk, StoragePath)
- [ ] Botón `Ver` (abre PDF en nueva pestaña)
- [ ] Botón `Descargar` con feedback de progreso
- [ ] Texto "Última consulta: hace X minutos" + botón Actualizar
- [ ] Vista `SinSoporte.cshtml` para documentos sin soporte

#### 5.3 `wwwroot/js/descarga.js`
- [ ] Al click Descargar:
  1. Botón → `⏳ Descargando...` + deshabilitar
  2. `fetch GET /detalle/descargar?path=...`
  3. Si OK → crear `Blob`, disparar descarga con nombre del archivo
  4. Si error → toast rojo
  5. Restaurar botón
- [ ] Toast de error con auto-dismiss

#### ✅ Verificación semana 5
- Navegar a `/detalle/K8227073` muestra la información correcta
- Botón Descargar descarga el PDF real desde la intranet
- La descarga no consume memoria excesiva (streaming verificado en logs)
- Vista SinSoporte se muestra para Nrodctos sin soporte

---

## Semana 6 — Pulido UX, Caché, Resiliencia y Tests E2E

**Objetivo:** Sistema listo para producción en IIS.

#### 6.1 Caché y resiliencia
- [ ] Verificar que IMemoryCache funciona (mismo Nrodcto no consulta API dos veces en 30 min)
- [ ] Polly: retry 2 veces con backoff exponencial para API interna
- [ ] Timeout configurable desde `appsettings.json`
- [ ] `SemaphoreSlim` configurable desde `appsettings.json` (`ApiInterna:MaxConcurrentRequests`)
- [ ] Manejo de rate limiting: si API devuelve 429 → esperar y reintentar

#### 6.2 Logging con Serilog
- [ ] Configurar Serilog con sinks: Console + File (`logs/punteo-.txt`)
- [ ] Log de cada consulta API (Nrodcto, tiempo respuesta, resultado)
- [ ] Log de cada descarga (path, éxito/error)
- [ ] Log de errores de BD con contexto completo

#### 6.3 Seguridad básica (OWASP)
- [ ] `storagePath` en descarga: validar que no contiene `../` (path traversal)
- [ ] `nrodcto` en detalle: validar formato antes de consultar API
- [ ] Headers de seguridad en `Program.cs`:
  ```csharp
  app.UseXContentTypeOptions();
  app.UseXXssProtection(options => options.EnabledWithBlockMode());
  app.UseXfo(options => options.Deny());
  ```
- [ ] Token Bearer no expuesto en respuestas al cliente
- [ ] `appsettings.json` excluido de Git (`.gitignore`)

#### 6.4 Configuración IIS
- [ ] Crear `web.config` para IIS con `aspNetCore` module
- [ ] Configurar Application Pool con .NET CLR version: No Managed Code
- [ ] Script de publicación: `dotnet publish -c Release -o ./publish`

#### 6.5 Tests Playwright E2E
El proyecto `tests/PunteoDomicilios.Tests/` ya tiene Playwright + NUnit configurado.

**Escenarios a cubrir:**

| Test | Descripción |
|------|-------------|
| `T01_DashboardCarga` | La página principal carga y muestra el selector de usuarios |
| `T02_FiltrosHabilitados` | El botón Consultar está habilitado solo cuando hay usuario + fecha |
| `T03_ConsultaRetornaResultados` | Consultar muestra tarjetas KPI con valores numéricos |
| `T04_TablaDetalleTieneFilas` | La tabla detalle tiene al menos 1 fila tras la consulta |
| `T05_BusquedaInlineFiltra` | Escribir en el buscador reduce las filas de la tabla |
| `T06_ExportarCSV` | El botón Exportar CSV dispara una descarga |
| `T07_NavegaADetalle` | Clic en "Ver detalle" navega a `/detalle/{nrodcto}` |
| `T08_VolverDesdDetalle` | El botón "← Volver" regresa al dashboard |

**Configuración Playwright:**
- URL base configurada en `playwright.runsettings` apuntando a `http://localhost:5001`
- La app debe estar corriendo antes de ejecutar los tests

#### ✅ Verificación semana 6 (criterios de "Done")
- [ ] Todos los tests E2E pasan en verde
- [ ] App publicada y corriendo en IIS sin errores
- [ ] Logs en archivo sin excepciones no manejadas
- [ ] Caché verificado: segunda consulta del mismo Nrodcto no llama a la API (log lo confirma)
- [ ] Descarga de un PDF real funciona en el servidor IIS

---

## Resumen de credenciales necesarias por semana

| Semana | Credencial | Para qué |
|--------|-----------|---------|
| 1 | `ConnectionStrings.Helpharma` | Conectar a SQL Server HELPHARMA |
| 1 | `ApiInterna.Token` | Bearer token para `consultasoporte` |
| 5 | `DescargaInterna.Usuario` | Basic Auth para proxy descarga |
| 5 | `DescargaInterna.Password` | Basic Auth para proxy descarga |

---

## Orden de trabajo por archivo (referencia rápida)

```
Semana 1:
  Proyecto-MVC/PunteoDomicilios.Web/
  ├── PunteoDomicilios.Web.csproj       (+ paquetes NuGet)
  ├── Program.cs
  ├── appsettings.json
  ├── appsettings.Development.json
  ├── Middleware/GlobalExceptionMiddleware.cs
  ├── Models/MvMensajer.cs
  ├── Models/SoporteApiResponse.cs
  ├── Models/EstadoSoporte.cs
  ├── DTOs/ (5 archivos)
  ├── Repositories/IMensajeroRepository.cs
  ├── Repositories/MensajeroRepository.cs
  └── Services/ (6 archivos)

Semana 2-3:
  ├── Controllers/DashboardController.cs
  ├── Views/Shared/_Layout.cshtml
  ├── Views/Shared/_KpiCards.cshtml
  ├── Views/Shared/_ProgressBar.cshtml
  ├── Views/Shared/_EmptyState.cshtml
  ├── Views/Dashboard/Index.cshtml
  ├── wwwroot/css/punteo.css
  ├── wwwroot/js/dashboard.js
  └── wwwroot/js/tabla.js

Semana 4:
  └── (refinamiento de Views/Dashboard/Index.cshtml + dashboard.js)

Semana 5:
  ├── Controllers/DetalleController.cs
  ├── Views/Detalle/Index.cshtml
  ├── Views/Detalle/SinSoporte.cshtml
  └── wwwroot/js/descarga.js

Semana 6:
  ├── web.config
  ├── logs/ (carpeta, generada por Serilog)
  └── tests/PunteoDomicilios.Tests/
      ├── DashboardTests.cs
      └── DetalleTests.cs
```

---

## Dependencias bloqueantes identificadas

| Dependencia | Bloquea | Mitigación |
|-------------|---------|-----------|
| Acceso a SQL Server HELPHARMA | Semana 1 — repositorios | Usar datos mock para avanzar en UI |
| Token Bearer API interna | Semana 2 — batch | Usar mock de `ISoporteApiService` para tests |
| Credenciales intranet descarga | Semana 5 — proxy | Servicio stub que retorna PDF de prueba |
| IIS disponible para deploy | Semana 6 — publicación | Probar con Kestrel local antes |

---

*Plan generado siguiendo la metodología **Shape Up** de Basecamp.*  
*Cada semana produce funcionalidad verificable y entregable.*
