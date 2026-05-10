# 📐 PITCH — Sistema de Punteo de Domicilios
> Metodología Shape Up · Basecamp  
> Refinamiento UX/UI incluido  
> Versión: 2.0 · Actualizado: 2026-05-08  
> **Prototipo funcional completado** — MVC en semanas 1–6

---

## 🎯 1. PROBLEMA

### Historia real que motiva este trabajo

El equipo de coordinación de mensajería revisa diariamente el estado de soporte de los
domicilios despachados. Hoy el proceso es 100% manual:

1. El coordinador descarga el reporte de `MvMensajer` en Excel.
2. Copia cada `Nrodcto` y consulta la API interna uno por uno desde el navegador.
3. Anota en una hoja de cálculo cuáles tienen soporte y cuáles no.
4. Al final del día no sabe qué mensajero tiene más faltantes sin revisar la hoja manualmente.

**El dolor concreto:** Un coordinador puede tener 120+ documentos por revisar en un solo
día. El proceso tarda entre 40 minutos y 2 horas. Los errores de copiado son frecuentes.
No existe visibilidad histórica para saber si un mensajero tiene un patrón de faltantes.

### Por qué es urgente

- Los soportes faltantes generan glosas y devoluciones de cartera.
- No hay alerta temprana: el faltante se descubre días después.
- La carga operativa impide escalar el equipo de mensajería.

---

## ⏱️ 2. APETITO

**Ciclo:** 6 semanas (proyecto estándar Shape Up)

| Módulo | Semanas estimadas |
|--------|------------------|
| Infraestructura base (.NET 10, BD, API) | 1 |
| Dashboard + consulta batch | 2 |
| Timeline + tabla detalle | 1 |
| Vista detalle archivos + descarga | 1 |
| Pulido UX, errores, caché, pruebas | 1 |

> **Restricción de apetito:** Si algo no cabe en 6 semanas, se recorta alcance — no se
> extiende el tiempo. El sistema debe ser útil sin login de usuarios, sin administración de
> roles, sin reportes históricos multiperiodo en v1.

---

## 💡 3. SOLUCIÓN

### 3.1 Flujo general del usuario

> ✅ El flujo completo está implementado en el prototipo (`prototipo/`). El MVC reproducirá el mismo flujo con datos reales (SQL Server + API).

```
Usuario llega → login.html
        │
        ▼
┌──────────────────────────────────┐
│   Ingresa código de usuario      │  ← MMUNOZ, JGARCIA, etc.
│   (sin contraseña en prototipo)  │
└──────────────────────────────────┘
        │
        ▼
  Sesión guardada en sessionStorage
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  Dashboard (index.html):                              │
│   • Resumen mensual: tabla Mes/Año | Registros |      │
│     Planillas | Ver detalle →                        │
│   • Consulta por fecha: selector + barra de progreso │
│   • KPIs + gráficos Chart.js                         │
└──────────────────────────────────────────────────────┘
        │ clic en "Ver detalle →" (fila del mes)
        ▼
┌──────────────────────────────────────────────────────┐
│  Detalle de mes (detalle.html?mes=YYYY-MM):           │
│   Nivel 1 — Días del mes:                            │
│     Fecha | Total | Entregados ✅ | Faltantes ❌       │
│             │ clic en "Ver detalle →"                │
│             ▼                                        │
│   Nivel 2 — Registros del día (panel inline):        │
│     Nrodcto | Destino | Cuota | Planilla | Estado    │
│     Botón "Ver soporte" → modal con storage_path     │
└──────────────────────────────────────────────────────┘
```

---

### 3.2 Dashboard — Arquitectura visual (fat-marker)

> ✅ Implementado en `prototipo/index.html`

```
╔══════════════════════════════════════════════════════════════════╗
║  SIDEBAR     │  🏥 HELPHARMA · Punteo de Domicilios             ║
║  📊 Dashboard│                               [Chip usuario MM]  ║
║  📄 Detalle  ╠══════════════════════════════════════════════════╣
║              ║  ─── Resumen mensual ───────────────────────     ║
║  [↩ Cambiar] ║  ┌─────────────────────────────────────────┐    ║
║  [MM] M.Muñoz║  │ Mes/Año    │ Registros │ Planillas │ Ir  │    ║
╚══════════════╣  │ Mayo 2026  │  179.683  │     12    │  →  │    ║
               ║  │ Abril 2026 │   142.000 │     10    │  →  │    ║
               ║  └─────────────────────────────────────────┘    ║
               ║                                                  ║
               ║  ─── Consulta por fecha ──────────────────────  ║
               ║  📅 [2026-05-08]  [🔍 Iniciar Consulta]         ║
               ║  ████████████████░░░░░  Procesando... 60/120    ║
               ║                                                  ║
               ║  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────┐ ║
               ║  │  TOTAL   │ │CUOTA MOD │ │PLANILLAS │ │ CON │ ║
               ║  │   120    │ │$480.000  │ │    3     │ │SOPO │ ║
               ║  │ registros│ │    COP   │ │distintas │ │ 82% │ ║
               ║  └──────────┘ └──────────┘ └──────────┘ └─────┘ ║
               ║                                                  ║
               ║  [ Barras 7 días: Entregados/Faltantes ]         ║
               ║  [ Donut: Con Soporte / Sin Soporte    ]         ║
               ╚══════════════════════════════════════════════════╝
```

---

### 3.3 Mejoras UX/UI del Dashboard (detalle)

> ✅ Implementado en `prototipo/index.html` + `prototipo/shared.js`

#### A. Login (`login.html`) — Nuevo respecto al diseño original

- Campo de texto para ingresar el código de usuario (MMUNOZ, JGARCIA, etc.).
- Valida contra la lista de `BODEGAS` hardcoded en `shared.js`.
- Error: modal con ejemplos de códigos válidos.
- URL param `?cambiar=1` limpia la sesión (link en sidebar/topbar).
- Sesión almacenada en `sessionStorage` con clave `punteo_usuario`.

#### B. Resumen mensual — Vista principal del Dashboard

Antes de cualquier consulta por fecha, el dashboard muestra inmediatamente una tabla con el historial mensual del usuario:

| Mes/Año | Total Registros | Planillas | Ver detalle |
|---------|-----------------|-----------|-------------|
| Mayo 2026 | 179.683 | 12 | → |
| Abril 2026 | 142.000 | 10 | → |

- Datos de `window.DATOS_REALES[usuario]` (datos reales para MMUNOZ; mock para otros).
- El botón "→" enlaza a `detalle.html?mes=YYYY-MM`.
- Función: `getResumenMensual(usuario)` en `shared.js`.

#### C. Tarjetas KPI — Estado dinámico

Cuatro tarjetas del día consultado (se animan con contador desde 0):

| Tarjeta | Métrica |
|---------|----------|
| Total Registros | Total de filas del día |
| Total Cuota Mod | Suma de cuotaMod en COP |
| Planillas Distintas | Conteo de NroPlanilla únicos |
| Con Soporte | % de Nrodctos con `mockConsultaSoporte() → success` |

#### D. Barra de progreso del batch

Durante la consulta a la API, una barra de progreso visible debajo de los filtros:

```
┌─────────────────────────────────────────────────────────────┐
│  Consultando soportes...  [████████████░░░░░░░░]  60 / 120  │
│  ✅ 58 encontrados  ❌ 2 faltantes  ⏳ 60 pendientes         │
└─────────────────────────────────────────────────────────────┘
```

- Implementada con `<progress>` nativo + JavaScript vanilla (SignalR opcional en v2).
- Si la API falla para un Nrodcto, se marca rojo inmediatamente sin bloquear los demás.
- Timeout por llamada: 10 segundos. Si supera, marca como "Error de red" con icono `⚠️`.

#### E. Línea de tiempo (Timeline)

Componente: **Chart.js** — tipo `bar` apilado horizontal o vertical.

**Comportamiento:**
- Por defecto muestra los últimos 7 días disponibles para el mensajero seleccionado.
- Cada barra tiene dos segmentos: verde (encontrados) y rojo (faltantes).
- Hover muestra tooltip:
  ```
  📅 07/05/2026
  ──────────────
  Total:      120
  ✅ Con soporte: 98
  ❌ Sin soporte: 22
  📊 Cobertura:  81.7%
  ```
- Clic en una barra carga la tabla detalle para esa fecha específica.
- La barra del día activo tiene un borde punteado para indicar selección.

#### F. Vista Detalle de mes (`detalle.html`) — Reemplaza tabla inline del Dashboard

> ✅ Implementado en `prototipo/detalle.html`

**Nivel 1 — Días del mes** (parámetro URL `mes=YYYY-MM`):

| Fecha | Total Soportes | Entregados ✅ | Faltantes ❌ | Acción |
|-------|---------------|--------------|-------------|--------|
| 2026-05-08 | 120 | 96 | 24 | Ver detalle → |

- Entregados = registros donde `mockConsultaSoporte(nrodcto).success === true`.
- Función: `getFechasDelMes(usuario, mes)` + `getDatosDelDia(usuario, fecha)`.

**Nivel 2 — Registros del día** (panel inline expandible):

| Columna | Detalle |
|---------|----------|
| Nrodcto | Código del documento |
| Destino | Dirección de entrega |
| Cuota Mod | Valor en COP formateado |
| Nro. Planilla | Código de planilla |
| Estado | Badge `✅ Entregado` / `❌ Faltante` |
| Acción | Botón "Ver soporte" (solo si éxito) → modal |

**Modal "Ver soporte":**
- Muestra `storage_path` del documento.
- Botón de descarga: enlace a `https://intranet.helpharma.com/ver-pdf/{storage_path}`.
- Se cierra con clic en backdrop o tecla Escape.

#### G. Estados especiales del Dashboard

| Estado | UI |
|--------|----|
| Sin selección inicial | Pantalla de bienvenida con ilustración simple y flecha apuntando a los filtros |
| Cargando registros BD | Skeleton loader (barras grises animadas) en lugar de la tabla |
| 0 resultados | Empty state: ícono de caja vacía + texto *"No hay domicilios para esta fecha"* |
| Error de conexión BD | Banner rojo sticky: *"No se pudo conectar a la base de datos. Reintentando..."* |
| Error de API (token) | Alerta naranja: *"Token de API inválido. Contacta al administrador."* |
| Todos encontrados | Confetti sutil (CSS puro) + badge verde `¡Punteo completo! 🎉` |

---

### 3.4 Vista Detalle de Archivos (MVC — Semana 5)

```
╔══════════════════════════════════════════════════════════╗
║  ← Volver    Detalle: K8227073 · JUAN PÉREZ             ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  📋 INFORMACIÓN DEL DOCUMENTO                           ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  Nrodcto:       K8227073                         │   ║
║  │  Fecha Reg.:    2026-05-04 14:37:01              │   ║
║  │  Almacenamiento: s3://helpharma-soportes-...     │   ║
║  │  Ruta:          soportes/2026/05/04/K8227073.pdf │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  📥 ARCHIVOS DISPONIBLES                                ║
║  ┌──────────────────────────────────────────────────┐   ║
║  │  📄 K8227073.pdf          [👁 Ver]  [⬇ Descargar] │   ║
║  └──────────────────────────────────────────────────┘   ║
║                                                          ║
║  🔄 Última consulta: hace 3 minutos  [↻ Actualizar]     ║
╚══════════════════════════════════════════════════════════╝
```

**Flujo de descarga:**
1. Usuario hace clic en `Descargar`.
2. El botón muestra `⏳ Descargando...` y se deshabilita.
3. El servidor actúa como proxy: autentica con cookies/credentials contra
   `https://intranet.helpharma.com/ver-pdf/{path}` y hace stream del PDF al cliente.
4. Al terminar, el botón vuelve a estado normal.
5. Si falla: toast rojo *"No se pudo descargar el archivo. Verifica tu conexión."*

---

### 3.5 Breadcrumb de navegación

```
Punteo Domicilios  >  JUAN PÉREZ · 07/05/2026  >  K8227073
```

Siempre visible para dar contexto y permitir navegación rápida.

---

---

### 3.6 Estado actual del prototipo

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `prototipo/login.html` | ✅ Completo | Login por código de usuario, sin contraseña |
| `prototipo/index.html` | ✅ Completo | Resumen mensual + consulta por fecha + KPIs + Charts |
| `prototipo/detalle.html` | ✅ Completo | Drill-down 2 niveles: días → registros + modal soporte |
| `prototipo/shared.js` | ✅ Completo | Session mgmt, helpers reales, mockConsultaSoporte |
| `prototipo/shared.css` | ✅ Completo | Design system custom (tokens CSS, sidebar, cards, tags) |
| `prototipo/datos-reales.js` | ✅ Generado | 179,683 registros MMUNOZ desde Excel (7.2 MB) |

Archivos eliminados (estaban en nav antiguo, ya no se usan):
- ~~`historial.html`~~ · ~~`mensajeros.html`~~ · ~~`configuracion.html`~~ · ~~`logs.html`~~

---

## 🏗️ 4. ARQUITECTURA — Estructura del Proyecto (MVC)

```
PunteoDomicilios/
├── Controllers/
│   ├── DashboardController.cs        ← Vista principal + consulta batch
│   ├── DetalleController.cs          ← Vista detalle + descarga proxy
│   └── ApiController.cs              ← Endpoints JSON para AJAX/fetch
│
├── Services/
│   ├── IMensajeroService.cs
│   ├── MensajeroService.cs           ← Lógica BD (Dapper)
│   ├── ISoporteApiService.cs
│   ├── SoporteApiService.cs          ← HttpClient → API interna
│   ├── IDescargaService.cs
│   ├── DescargaService.cs            ← Proxy descarga autenticada
│   └── CacheService.cs               ← Wrapper IMemoryCache
│
├── Repositories/
│   ├── IMensajeroRepository.cs
│   └── MensajeroRepository.cs        ← Consultas SQL (Dapper)
│
├── Models/
│   ├── MvMensajer.cs                 ← Entidad BD
│   └── SoporteApiResponse.cs         ← Deserialización API
│
├── DTOs/
│   ├── ConsultaFiltroDto.cs          ← Fecha + Usuario
│   ├── ResultadoConsultaDto.cs       ← Total/Encontrado/Faltante
│   ├── MensajeroResumenDto.cs        ← Para tarjetas KPI
│   ├── NrodctoEstadoDto.cs           ← Estado por documento
│   └── DetalleArchivoDto.cs          ← Para vista detalle
│
├── Views/
│   ├── Shared/
│   │   ├── _Layout.cshtml            ← Bootstrap 5.3 + Chart.js + Tom Select
│   │   ├── _KpiCards.cshtml          ← Partial: 4 tarjetas
│   │   ├── _ProgressBar.cshtml       ← Partial: barra de progreso batch
│   │   └── _EmptyState.cshtml        ← Partial: estado vacío reutilizable
│   ├── Dashboard/
│   │   └── Index.cshtml              ← Vista principal
│   └── Detalle/
│       └── Index.cshtml              ← Vista detalle archivo
│
├── wwwroot/
│   ├── css/
│   │   └── punteo.css                ← Variables CSS, tokens de diseño
│   └── js/
│       ├── dashboard.js              ← Lógica batch + Chart.js init
│       ├── tabla.js                  ← Filtro/orden de tabla inline
│       └── descarga.js               ← Flujo descarga con feedback
│
├── Middleware/
│   └── GlobalExceptionMiddleware.cs  ← Manejo global de errores
│
├── appsettings.json
├── appsettings.Development.json
└── Program.cs
```

---

## ⚙️ 5. CONFIGURACIÓN — appsettings.json

```json
{
  "ConnectionStrings": {
    "Helpharma": "Server=<SERVER>;Database=HELPHARMA;User Id=<USER>;Password=<PASS>;TrustServerCertificate=true;"
  },
  "ApiInterna": {
    "BaseUrl": "https://intranet.helpharma.com",
    "Token": "<TOKEN_BEARER>",
    "TimeoutSeconds": 10,
    "RetryCount": 2,
    "CacheMinutes": 30
  },
  "DescargaInterna": {
    "BaseUrl": "https://intranet.helpharma.com",
    "Usuario": "<USUARIO_SESION>",
    "Password": "<PASSWORD_SESION>",
    "CookieName": ".AspNetCore.Session"
  },
  "Cache": {
    "HabilitarCache": true,
    "ExpirationMinutes": 30
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "PunteoDomicilios": "Debug"
    }
  }
}
```

---

## 🔑 6. MODELOS Y DTOs

### MvMensajer.cs (Entidad BD)
```csharp
public class MvMensajer
{
    public string Mensajero    { get; set; } = string.Empty;
    public DateTime Fecha      { get; set; }
    public string Nrodcto      { get; set; } = string.Empty;
    public string Destino      { get; set; } = string.Empty;
    public string Refrigera    { get; set; } = string.Empty;
    public decimal CuotaMod    { get; set; }
    public decimal Domicilio   { get; set; }
    public string Observacio   { get; set; } = string.Empty;
    public string NroConsig    { get; set; } = string.Empty;
    public decimal VlrConsig   { get; set; }
    public string NroPlanilla  { get; set; } = string.Empty;
    public string Usuario      { get; set; } = string.Empty;
    public int Id              { get; set; }
}
```

### DTOs principales

```csharp
// Filtro de entrada desde el dashboard
public record ConsultaFiltroDto(string Usuario, DateOnly Fecha);

// Estado de un documento individual
public record NrodctoEstadoDto(
    string Nrodcto,
    EstadoSoporte Estado,        // Encontrado | Faltante | Error | Pendiente
    string? FechaRegistro,
    string? StoragePath,
    string? MensajeError
);

public enum EstadoSoporte { Pendiente, Encontrado, Faltante, Error }

// Resumen para tarjetas KPI
public record MensajeroResumenDto(
    string Usuario,
    DateOnly Fecha,
    int Total,
    int Encontrados,
    int Faltantes,
    int Errores
)
{
    public decimal PorcentajeCobertura =>
        Total == 0 ? 0 : Math.Round((decimal)Encontrados / Total * 100, 1);
}

// Respuesta de la API interna
public record SoporteApiResponse(
    bool Success,
    string? Message,
    List<SoporteDataItem>? Data
);

public record SoporteDataItem(
    string FechaRegistro,
    string StorageDisk,
    string StoragePath
);
```

---

## 🔧 7. SERVICIOS CLAVE

### SoporteApiService — Consulta con caché y retry

```csharp
public class SoporteApiService : ISoporteApiService
{
    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly ILogger<SoporteApiService> _logger;
    private readonly int _cacheMinutes;

    public async Task<SoporteApiResponse?> ConsultarAsync(string nrodcto, CancellationToken ct = default)
    {
        var cacheKey = $"soporte:{nrodcto}";

        if (_cache.TryGetValue(cacheKey, out SoporteApiResponse? cached))
        {
            _logger.LogDebug("Cache hit para {Nrodcto}", nrodcto);
            return cached;
        }

        try
        {
            var response = await _http.GetFromJsonAsync<SoporteApiResponse>(
                $"/api/v1/consultasoporte/{nrodcto}", ct);

            if (response is not null)
                _cache.Set(cacheKey, response, TimeSpan.FromMinutes(_cacheMinutes));

            return response;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Error consultando soporte para {Nrodcto}", nrodcto);
            return null;
        }
    }

    // Consulta en paralelo con semáforo para no saturar la API
    public async Task<IEnumerable<NrodctoEstadoDto>> ConsultarBatchAsync(
        IEnumerable<string> nrodctos, IProgress<int>? progreso = null, CancellationToken ct = default)
    {
        var lista = nrodctos.Distinct().ToList();
        var resultados = new ConcurrentBag<NrodctoEstadoDto>();
        var semaforo = new SemaphoreSlim(5); // máx 5 llamadas simultáneas
        int procesados = 0;

        await Parallel.ForEachAsync(lista, ct, async (nrodcto, token) =>
        {
            await semaforo.WaitAsync(token);
            try
            {
                var resp = await ConsultarAsync(nrodcto, token);
                NrodctoEstadoDto estado;

                if (resp is null)
                    estado = new(nrodcto, EstadoSoporte.Error, null, null, "Sin respuesta de API");
                else if (resp.Success && resp.Data?.Count > 0)
                    estado = new(nrodcto, EstadoSoporte.Encontrado,
                        resp.Data[0].FechaRegistro, resp.Data[0].StoragePath, null);
                else
                    estado = new(nrodcto, EstadoSoporte.Faltante, null, null, resp.Message);

                resultados.Add(estado);
                progreso?.Report(Interlocked.Increment(ref procesados));
            }
            finally { semaforo.Release(); }
        });

        return resultados;
    }
}
```

### DescargaService — Proxy autenticado

```csharp
public class DescargaService : IDescargaService
{
    private readonly HttpClient _http;
    private readonly ILogger<DescargaService> _logger;

    public async Task<Stream?> ObtenerArchivoAsync(string storagePath, CancellationToken ct = default)
    {
        try
        {
            var url = $"/ver-pdf/{Uri.EscapeDataString(storagePath)}";
            var response = await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStreamAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error descargando archivo {Path}", storagePath);
            return null;
        }
    }
}
```

---

## 🎮 8. CONTROLADORES

### DashboardController

```csharp
[Route("")]
public class DashboardController : Controller
{
    [HttpGet("")]
    public async Task<IActionResult> Index()
    {
        var usuarios = await _mensajeroService.ObtenerUsuariosAsync();
        ViewBag.Usuarios = usuarios;
        return View();
    }

    // Endpoint AJAX: carga registros de BD
    [HttpGet("api/registros")]
    public async Task<IActionResult> ObtenerRegistros(string usuario, DateOnly fecha)
    {
        var registros = await _mensajeroService.ObtenerRegistrosAsync(usuario, fecha);
        var nrodctos = registros.Select(r => r.Nrodcto).Distinct();
        var resumen = new MensajeroResumenDto(usuario, fecha, registros.Count(), 0, 0, 0);
        return Json(new { resumen, nrodctos });
    }

    // Endpoint AJAX: consulta soporte para lista de Nrodcto
    [HttpPost("api/consultar-batch")]
    public async Task<IActionResult> ConsultarBatch([FromBody] List<string> nrodctos)
    {
        var resultados = await _soporteApiService.ConsultarBatchAsync(nrodctos);
        return Json(resultados);
    }

    // Endpoint AJAX: timeline histórico
    [HttpGet("api/timeline")]
    public async Task<IActionResult> ObtenerTimeline(string usuario, int dias = 7)
    {
        var datos = await _mensajeroService.ObtenerTimelineAsync(usuario, dias);
        return Json(datos);
    }
}
```

### DetalleController

```csharp
[Route("detalle")]
public class DetalleController : Controller
{
    [HttpGet("{nrodcto}")]
    public async Task<IActionResult> Index(string nrodcto)
    {
        var soporte = await _soporteApiService.ConsultarAsync(nrodcto);
        if (soporte is null || !soporte.Success)
            return View("SinSoporte", nrodcto);

        var dto = new DetalleArchivoDto(nrodcto, soporte.Data!);
        return View(dto);
    }

    [HttpGet("descargar")]
    public async Task<IActionResult> Descargar(string path)
    {
        var stream = await _descargaService.ObtenerArchivoAsync(path);
        if (stream is null)
            return BadRequest("No se pudo obtener el archivo.");

        var fileName = Path.GetFileName(path);
        return File(stream, "application/pdf", fileName);
    }
}
```

---

## 🎨 9. FRONTEND — Tokens de Diseño

> **Prototipo**: usa `prototipo/shared.css` — sistema de diseño custom con variables CSS, sidebar, topbar, cards, badges (`tag-green`, `tag-red`), modales.
> **MVC**: usa Bootstrap 5.3 + `wwwroot/css/punteo.css` con las mismas variables semánticas.

### Variables CSS (punteo.css — MVC)

```css
:root {
  /* Colores semánticos */
  --color-encontrado:     #10B981;
  --color-encontrado-bg:  #ECFDF5;
  --color-faltante:       #EF4444;
  --color-faltante-bg:    #FEF2F2;
  --color-pendiente:      #F59E0B;
  --color-pendiente-bg:   #FFFBEB;
  --color-error:          #8B5CF6;
  --color-neutro:         #3B82F6;
  --color-neutro-bg:      #EFF6FF;

  /* Cobertura dinámica (se setea por JS) */
  --color-cobertura:      #EF4444;    /* < 70% */

  /* Tipografía */
  --font-base: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Espaciado */
  --radius-card: 12px;
  --shadow-card: 0 1px 3px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.05);
}

/* KPI Cards */
.kpi-card {
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  transition: transform .15s ease, box-shadow .15s ease;
}
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0,0,0,.12);
}

/* Badges de estado */
.badge-encontrado { background: var(--color-encontrado-bg); color: var(--color-encontrado); }
.badge-faltante   { background: var(--color-faltante-bg);   color: var(--color-faltante);   }
.badge-pendiente  { background: var(--color-pendiente-bg);  color: var(--color-pendiente);  }

/* Barra de progreso animada */
.progress-batch {
  height: 8px;
  border-radius: 99px;
  background: #E5E7EB;
  overflow: hidden;
}
.progress-batch__fill {
  height: 100%;
  background: linear-gradient(90deg, #10B981, #3B82F6);
  transition: width .3s ease;
}

/* Skeleton loader */
.skeleton {
  background: linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%);
  background-size: 200% 100%;
  animation: skeleton-wave 1.4s infinite;
  border-radius: 6px;
}
@keyframes skeleton-wave {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 🖼️ 10. VISTAS RAZOR

### Dashboard/Index.cshtml — Estructura

```html
@model DashboardViewModel
@{
    ViewData["Title"] = "Punteo de Domicilios";
    Layout = "_Layout";
}

<!-- ── FILTROS ─────────────────────────────────── -->
<section class="bg-white border-b sticky top-0 z-10 shadow-sm">
  <div class="container-xl py-3">
    <div class="row g-2 align-items-end">
      <div class="col-md-4">
        <label class="form-label fw-semibold">👤 Mensajero</label>
        <select id="sel-usuario" class="form-select tom-select">
          <option value="">— Seleccionar —</option>
          @foreach (var u in Model.Usuarios)
          {
            <option value="@u">@u</option>
          }
        </select>
      </div>
      <div class="col-md-3">
        <label class="form-label fw-semibold">📅 Fecha</label>
        <input type="date" id="inp-fecha" class="form-control"
               value="@DateTime.Today.ToString("yyyy-MM-dd")" />
      </div>
      <div class="col-md-2">
        <button id="btn-consultar" class="btn btn-primary w-100">
          <span id="btn-texto">🔍 Consultar</span>
          <span id="btn-spinner" class="spinner-border spinner-border-sm d-none"></span>
        </button>
      </div>
      <div class="col-md-3">
        <!-- Banner "cambios sin aplicar" -->
        <div id="banner-cambios" class="alert alert-warning py-2 mb-0 d-none small">
          ⚠️ Hay cambios sin aplicar
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── CONTEXTO ACTIVO ──────────────────────────── -->
<div id="contexto-header" class="container-xl mt-3 d-none">
  <p class="text-muted mb-0">
    Resultados para: <strong id="ctx-usuario"></strong> · <strong id="ctx-fecha"></strong>
  </p>
</div>

<!-- ── BARRA DE PROGRESO BATCH ──────────────────── -->
<div id="area-progreso" class="container-xl mt-2 d-none">
  <div class="card border-0 bg-light p-3">
    <div class="d-flex justify-content-between mb-1 small">
      <span>Consultando soportes...</span>
      <span id="prog-contador">0 / 0</span>
    </div>
    <div class="progress-batch">
      <div id="prog-fill" class="progress-batch__fill" style="width: 0%"></div>
    </div>
    <div class="mt-2 small text-muted">
      <span id="prog-encontrados">✅ 0 encontrados</span>&nbsp;
      <span id="prog-faltantes">❌ 0 faltantes</span>&nbsp;
      <span id="prog-pendientes">⏳ 0 pendientes</span>
    </div>
  </div>
</div>

<!-- ── TARJETAS KPI ─────────────────────────────── -->
<section id="area-kpi" class="container-xl mt-4 d-none">
  <div class="row g-3">
    <partial name="_KpiCards" />
  </div>
</section>

<!-- ── TIMELINE ─────────────────────────────────── -->
<section id="area-timeline" class="container-xl mt-4 d-none">
  <div class="card shadow-sm border-0">
    <div class="card-body">
      <h6 class="card-title fw-semibold mb-3">📊 Línea de tiempo</h6>
      <canvas id="chart-timeline" height="100"></canvas>
    </div>
  </div>
</section>

<!-- ── TABLA DETALLE ─────────────────────────────── -->
<section id="area-tabla" class="container-xl mt-4 mb-5 d-none">
  <div class="card shadow-sm border-0">
    <div class="card-header bg-white d-flex justify-content-between align-items-center">
      <h6 class="mb-0 fw-semibold">📋 Detalle del día</h6>
      <div class="d-flex gap-2">
        <input type="search" id="tabla-buscar" class="form-control form-control-sm"
               placeholder="Buscar Nrodcto..." style="width:180px">
        <button id="btn-exportar" class="btn btn-sm btn-outline-secondary">
          ⬇ Exportar CSV
        </button>
      </div>
    </div>
    <div class="table-responsive">
      <table id="tabla-detalle" class="table table-hover table-sm mb-0">
        <thead class="table-light">
          <tr>
            <th data-sort="nrodcto">Nrodcto ↕</th>
            <th data-sort="estado">Estado ↕</th>
            <th data-sort="fechaReg">Fecha Registro ↕</th>
            <th>Ruta Archivo</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody id="tabla-body">
          <!-- Renderizado por dashboard.js -->
        </tbody>
      </table>
    </div>
  </div>
</section>

<!-- ── EMPTY STATE ──────────────────────────────── -->
<div id="area-empty" class="container-xl mt-5 text-center d-none">
  <partial name="_EmptyState" model="new EmptyStateModel('sin-resultados')" />
</div>

@section Scripts {
  <script src="~/js/dashboard.js"></script>
}
```

---

## 🕳️ 11. AGUJEROS DE CONEJO (Rabbit Holes)

Estos son los puntos técnicos que podrían convertirse en bloqueos si no se definen ahora:

| Riesgo | Decisión tomada |
|--------|-----------------|
| **La API interna puede estar caída** | Timeout de 10s por llamada. Si falla, marcar como `Error` y continuar. No bloquear el batch. |
| **El token Bearer puede vencer** | El token se configura en `appsettings.json`. Cambio manual por ahora. En v2 implementar renovación automática. |
| **Múltiples consultas simultáneas a la API pueden generar rate-limiting** | Usar `SemaphoreSlim(5)` para máximo 5 llamadas concurrentes. Ajustable vía config. |
| **El campo Nrodcto puede tener duplicados en MvMensajer** | Usar `DISTINCT` en la consulta. El batch consulta la API una sola vez por Nrodcto único (caché incluido). |
| **La descarga proxy puede consumir mucha memoria con PDFs grandes** | Usar `HttpCompletionOption.ResponseHeadersRead` + streaming. No cargar en memoria. |
| **La conexión a la intranet para descargas puede requerir autenticación por cookies de sesión** | Configurar `HttpClientHandler` con `CookieContainer` o autenticación básica, según lo que requiera el endpoint. El mecanismo exacto se define cuando se obtenga acceso de prueba. |
| **El timeline de 7 días puede ser lento si hay muchos registros** | Consulta SQL con agregación en servidor, no en aplicación. Índice recomendado: `IX_MvMensajer_UsuarioFecha (Usuario, Fecha)`. |
| **Actualización en tiempo real del progreso del batch** | En v1 usamos polling cada 500ms con un endpoint JSON liviano. SignalR es v2. |

---

## 🚫 12. NO-GOES (Explícitamente fuera de alcance en v1)

| Funcionalidad | Razón |
|---------------|-------|
| Login / autenticación de usuarios | Explícitamente excluido por requerimiento. |
| Administración de mensajeros o usuarios | No es el objetivo del sistema. |
| Reportes históricos multiusuario o multipériodo en paralelo | Requeriría arquitectura de reportes. Queda para v2. |
| Edición o corrección de registros en BD | Solo lectura. |
| Notificaciones automáticas por email/WhatsApp | Fuera del alcance de este ciclo. |
| Preview del PDF embebido en la misma página | Complejidad innecesaria para v1. El botón descarga el archivo. |
| WYSIWYG de configuración del token desde UI | El token se gestiona en `appsettings.json`. No hay panel de configuración en v1. |
| Multiidioma (i18n) | Sistema interno en español únicamente. |
| App móvil nativa | El sistema es web responsivo — debe funcionar en tablet, no requiere app nativa. |

---

## 📋 13. RESUMEN EJECUTIVO

| Ítem | Detalle |
|------|---------|
| **Nombre** | Sistema de Punteo de Domicilios |
| **Stack** | .NET 10 MVC · SQL Server · Dapper · Chart.js · Bootstrap 5.3 |
| **Apetito** | 6 semanas |
| **Usuarios** | Coordinadores de mensajería (sin login) |
| **Valor** | Elimina proceso manual de 40-120 min/día · Visibilidad en tiempo real de faltantes |
| **Riesgo mayor** | Disponibilidad de la API interna (mitigado con cache + retry + timeout) |
| **Dependencia crítica** | Acceso de prueba a `intranet.helpharma.com` para validar autenticación de descarga |

---

## 📎 ANEXO — Flujo de datos completo

```
Usuario                    Servidor (.NET 10)               Infraestructura
   │                             │                               │
   │── GET / ──────────────────►│                               │
   │                             │── SELECT Usuario DISTINCT ──►│ SQL Server
   │◄─ HTML Dashboard ──────────│◄─ Lista usuarios ────────────│
   │                             │                               │
   │── [Consultar] ─────────────►│                               │
   │  { usuario, fecha }         │── SELECT * FROM MvMensajer ─►│ SQL Server
   │                             │◄─ Registros ─────────────────│
   │◄─ { resumen, nrodctos } ───│                               │
   │                             │                               │
   │── POST /api/consultar-batch►│                               │
   │  [ "K8227073", "K8227074" ] │                               │
   │                             │── Para cada Nrodcto:          │
   │                             │   Check cache ────────────────│ IMemoryCache
   │                             │   GET /api/v1/consultasoporte/│ API Interna
   │                             │◄──────────────────────────────│
   │◄─ [ { estado, path } ] ────│                               │
   │                             │                               │
   │── GET /detalle/K8227073 ───►│                               │
   │◄─ Vista detalle ────────────│                               │
   │                             │                               │
   │── GET /detalle/descargar ──►│                               │
   │  ?path=soportes/...pdf      │── GET /ver-pdf/... ──────────►│ Intranet
   │                             │◄─ Stream PDF ─────────────────│
   │◄─ PDF descargado ───────────│                               │
```

---

*Documento generado siguiendo la metodología **Shape Up** de Basecamp.*  
*Problema + Apetito + Solución + Agujeros de conejo + No-Goes.*  
*Nivel de detalle: suficiente para implementar sin especificar cada pixel.*
