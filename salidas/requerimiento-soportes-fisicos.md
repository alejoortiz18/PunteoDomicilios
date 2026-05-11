# Requerimiento: Módulo de Procesamiento de Soportes Físicos

**Proyecto:** PunteoDomicilios.Web  
**Fecha:** 2026-05-11  
**Estado:** Revisado y consolidado

---

## 1. Contexto del Sistema Actual

El proyecto `PunteoDomicilios.Web` es una aplicación ASP.NET Core MVC que gestiona el punteo (reconciliación) de domicilios para Helpharma. Actualmente cuenta con:

- **Dashboard**: resumen mensual por mensajero, con estados de soportes consultados vía API interna.
- **Detalle**: vista detallada de planillas y registros individuales.
- **Login / Sesión**: control de acceso básico por usuario.
- **`SoporteApiService`** (existente): consulta el soporte por número de documento a `intranet.helpharma.com/api/v1/consultasoporte/{nrodcto}` (GET, Bearer token).

La nueva funcionalidad agrega un módulo **independiente** para el procesamiento manual por lotes de soportes físicos (documentos PDF), integrando dos APIs externas distintas a las ya existentes.

---

## 2. Descripción de la Nueva Funcionalidad

Se requiere un módulo que permita a los operadores:

1. Cargar manualmente una lista de soportes clínicos (ID + archivo PDF).
2. Validar los datos de cada soporte consultando la **API de Soportes Helpharma**.
3. Enviar el archivo PDF junto con los metadatos clínicos completos a la **API de Soporte Físico**.
4. Ver los resultados de cada ítem procesado (éxito o error detallado).

---

## 3. Componentes a Crear

### 3.1 Controlador: `SoportesFisicosController`

> **Nota de nomenclatura:** El nombre `SoportesFisicosController` evita el conflicto con el `SoporteApiService` existente, el cual atiende una API diferente.

| Acción | Verbo HTTP | Descripción |
|--------|-----------|-------------|
| `Index()` | GET | Renderiza el formulario de carga de soportes |
| `Procesar(ProcesarManualDto)` | POST | Procesa el lote y retorna resultados en `ViewBag.Resultados` |

### 3.2 Servicio: `SoporteDatosService` (NUEVO)

Consulta los datos clínicos del soporte a la API externa de soportes.

- **Interfaz:** `ISoporteDatosService`
- **Endpoint:** `POST https://api-soportes.helpharma.com.co/api/DocSoporte/soportes/DatosSoportes`
- **Header:** `X-API-KEY: {valor desde configuración}`
- **Body JSON:** `{ "soporte": "<id_soporte>" }`
- **Retorno:** `(SoporteClinicoDto? datos, string mensaje)`

### 3.3 Servicio: `SoporteFisicoService` (NUEVO)

Envía el archivo PDF con todos los metadatos clínicos.

- **Interfaz:** `ISoporteFisicoService`
- **Endpoint:** `POST https://intranet.helpharma.com/api/v1/soporte/fisico`  
  *(misma `BaseUrl` que `ApiInterna` ya configurada)*
- **Auth:** `Authorization: Bearer {token desde configuración}`
- **Content-Type:** `multipart/form-data`
- **Retorno:** `(bool exito, string mensaje)`

---

## 4. Modelos de Datos

### 4.1 DTO de entrada: `ProcesarManualDto`

```csharp
public class ProcesarManualDto
{
    public List<ItemSoporteDto> Items { get; set; } = new();
}

public class ItemSoporteDto
{
    public string Soporte { get; set; } = string.Empty;   // ID del soporte, obligatorio
    public IFormFile? Archivo { get; set; }               // PDF del soporte, obligatorio
}
```

### 4.2 DTO de respuesta de API #1: `SoporteClinicoDto`

Captura TODOS los campos que devuelve la API de soportes:

```
Convenio:         IdConvenio (string→int), NombreConvenio
Temporal:         Fecha (DateTime, formato "yyyy-MM-dd HH:mm:ss")
Sede/Bodega:      IdBodega, NombreSede
Atención:         NombreActividad, TipoEntrega, TipoPlan, IdCartera
Paciente:         NombrePaciente, IdTipoId, IdPaciente (int), Celular,
                  Telefono, Direccion, Complemento, Observacion
Financiero:       ValorCM (string, default "0")
Medicamentos:     List<MedicamentoDto>
```

### 4.3 DTO medicamentos: `MedicamentoDto`

```csharp
public class MedicamentoDto
{
    public string Ordenes   { get; set; } = string.Empty;
    public string Producto  { get; set; } = string.Empty;
    public string Nombre    { get; set; } = string.Empty;
    public int    Cantidad  { get; set; }
}
```

---

## 5. Flujo de Procesamiento (Método `Procesar`)

```
Para cada ItemSoporteDto en ProcesarManualDto.Items:
│
├─ VALIDACIÓN
│   ¿Soporte vacío/nulo o Archivo nulo?
│   ├─ SÍ → resultado = "Fila inválida" → siguiente ítem
│   └─ NO → continuar
│
├─ ALMACENAMIENTO TEMPORAL
│   • Guardar IFormFile en Path.GetTempPath() con nombre original
│   • Registrar ruta temporal
│
├─ FASE 1: Consulta API de Datos (SoporteDatosService)
│   ├─ Éxito (2xx)  → deserializar SoporteClinicoDto → continuar a Fase 2
│   └─ Error (4xx/5xx) → resultado = "{soporte} → Error LEER DATOS: {msn}" → siguiente
│
├─ FASE 2: Envío de archivo (SoporteFisicoService)
│   • Construir multipart/form-data con TODOS los campos de SoporteClinicoDto
│   • Campo "idUsuario" = "system" (valor fijo)
│   • Campo "medicamentos" = array serializado a JSON
│   • Campo "anexo" = bytes del PDF (Content-Type: application/pdf)
│   ├─ Éxito (2xx)  → resultado = "{soporte} → OK"
│   └─ Error (4xx/5xx) → resultado = "{soporte} → Error ENVIANDO ARCHIVO: {msn}"
│
└─ LIMPIEZA (siempre, en bloque finally)
    • Si el archivo temporal existe → eliminarlo
    • Si falla la eliminación → LogWarning, no lanzar excepción
```

### Tabla de resultados posibles

| Escenario | Mensaje al usuario |
|-----------|-------------------|
| Soporte/Archivo nulos | `Fila inválida` |
| API #1 falla | `{soporte} → Error LEER DATOS: {detalle}` |
| API #2 falla | `{soporte} → Error ENVIANDO ARCHIVO: {detalle}` |
| Excepción no manejada | `{soporte} → Error interno` |
| Éxito completo | `{soporte} → OK` |

---

## 6. Configuración Requerida (`appsettings.json`)

Agregar una nueva sección (las credenciales **no deben ir hardcodeadas** en código):

```json
"ApiSoportes": {
  "BaseUrl": "https://api-soportes.helpharma.com.co",
  "ApiKey": "ABC123456789",
  "TimeoutSeconds": 30
}
```

El token Bearer para `SoporteFisicoService` reutiliza la sección existente `ApiInterna`, que debe quedar así (ajustar `TimeoutSeconds` para uploads de PDF):

```json
"ApiInterna": {
  "BaseUrl": "https://intranet.helpharma.com",
  "Token": "4050281|BTH7oV8sR3n5pc4Ko8LHxpnhbWiJKga8p6M3IAjw",
  "TimeoutSeconds": 120
}
```

**Endpoint API #2:** `POST https://intranet.helpharma.com/api/v1/soporte/fisico`  
**Header:** `Authorization: Bearer 4050281|BTH7oV8sR3n5pc4Ko8LHxpnhbWiJKga8p6M3IAjw`

---

## 7. Logging

Formato estructurado con Serilog (consistente con el patrón del proyecto):

| Evento | Nivel | Mensaje |
|--------|-------|---------|
| Consulta exitosa API #1 | Info | `SoporteDatosOK \| Soporte={id} \| Paciente={nombre}` |
| Error API #1 | Error | `SoporteDatosError \| Soporte={id} \| Status={code} \| Resp={body}` |
| Excepción API #1 | Error | `SoporteDatosException \| Soporte={id}` |
| Envío exitoso API #2 | Info | `SoporteFisicoOK \| Soporte={id}` |
| Error API #2 | Error | `SoporteFisicoError \| Soporte={id} \| Status={code} \| Resp={body}` |
| Excepción API #2 | Error | `SoporteFisicoException \| Soporte={id}` |

---

## 8. Consideraciones de Integración con el Proyecto Existente

| Ítem | Detalle |
|------|---------|
| **Conflicto de nombres** | El `SoporteApiService` existente tiene un propósito distinto (consulta Dashboard). Los nuevos servicios deben llamarse `SoporteDatosService` y `SoporteFisicoService` para no generar confusión. |
| **HttpClient de API #2** | Puede reutilizar el `HttpClient` ya configurado para `ApiInterna` (mismo `BaseUrl` e `intranet.helpharma.com`). Evaluar si conviene un cliente dedicado o el compartido. |
| **HttpClient de API #1** | Requiere un nuevo `HttpClient` apuntando a `api-soportes.helpharma.com.co` con header `X-API-KEY` (no Bearer). |
| **Archivos temporales** | Usar `Path.GetTempPath()` del sistema operativo. Garantizar limpieza en bloque `finally`. |
| **Sesión / Autenticación** | El controlador debe verificar sesión activa antes de procesar (igual que los controladores existentes). |
| **Vista** | Formulario con lista dinámica de filas (soporte + PDF), similar al prototipo en `/prototipo/`. |

---

## 9. Campos del Formulario Multipart (API #2) — Referencia Completa

Todos los campos son obligatorios en el request. Los valores nulos de `SoporteClinicoDto` se convierten a vacío `""` o `0` según el tipo:

| Campo | Origen | Conversión nulo |
|-------|--------|----------------|
| `soporte` | `ItemSoporteDto.Soporte` | — |
| `idConvenio` | `SoporteClinicoDto.IdConvenio` (string→int) | `0` |
| `nombreConvenio` | `SoporteClinicoDto.NombreConvenio` | `""` |
| `fecha` | `SoporteClinicoDto.Fecha` (formato `yyyy-MM-dd HH:mm:ss`) | `""` |
| `idBodega` | `SoporteClinicoDto.IdBodega` | `""` |
| `nombreSede` | `SoporteClinicoDto.NombreSede` | `""` |
| `nombreActividad` | `SoporteClinicoDto.NombreActividad` | `""` |
| `tipoEntrega` | `SoporteClinicoDto.TipoEntrega` | `""` |
| `tipoPlan` | `SoporteClinicoDto.TipoPlan` | `""` |
| `idCartera` | `SoporteClinicoDto.IdCartera` | `""` |
| `nombrePaciente` | `SoporteClinicoDto.NombrePaciente` | `""` |
| `idTipoId` | `SoporteClinicoDto.IdTipoId` | `""` |
| `idPaciente` | `SoporteClinicoDto.IdPaciente` (int) | `0` |
| `celular` | `SoporteClinicoDto.Celular` | `""` |
| `telefono` | `SoporteClinicoDto.Telefono` | `""` |
| `direccion` | `SoporteClinicoDto.Direccion` | `""` |
| `complemento` | `SoporteClinicoDto.Complemento` | `""` |
| `observacion` | `SoporteClinicoDto.Observacion` | `""` |
| `valorCM` | `SoporteClinicoDto.ValorCM` | `"0"` |
| `idUsuario` | Fijo: `"system"` | — |
| `medicamentos` | `SoporteClinicoDto.Medicamentos` serializado a JSON | `"[]"` |
| `anexo` | Bytes del PDF, `Content-Type: application/pdf` | — |

---

## 10. Casos de Prueba Clave

- [ ] Ítem con soporte vacío → `Fila inválida`
- [ ] Ítem con archivo nulo → `Fila inválida`
- [ ] API #1 devuelve 404 → `{soporte} → Error LEER DATOS: ...`
- [ ] API #1 OK, API #2 devuelve 500 → `{soporte} → Error ENVIANDO ARCHIVO: ...`
- [ ] Flujo completo exitoso → `{soporte} → OK`
- [ ] Lote de 5 ítems válidos + 2 inválidos → **7 resultados** sin interrupción
- [ ] Error en 1 ítem no detiene el procesamiento del resto
- [ ] Archivo temporal siempre eliminado, incluso si API falla
- [ ] Sin sesión activa → redirección a Login

---

## 11. Requisitos No-Funcionales

### Seguridad
- Credenciales almacenadas en `appsettings.json`, nunca hardcodeadas en código.
- Todas las comunicaciones sobre HTTPS.
- Validar entrada del usuario antes de procesar.
- Manejar errores sin revelar información sensible en la respuesta.

### Logging y Auditoría
- Loguear cada operación: entrada, salida y errores.
- Incluir contexto: ID soporte, status HTTP, timestamp.
- Diferenciar niveles: `Information`, `Warning`, `Error`.
- Mantener trazas de auditoría para seguimiento posterior.

### Rendimiento
- Procesar múltiples ítems secuencialmente sin bloquear el hilo (operaciones `async/await`).
- No retener archivos temporales en disco más de lo necesario.
- Usar `CancellationToken` donde sea aplicable.

### Robustez
- Manejar excepciones de red y timeout en ambas APIs.
- Validar que la respuesta JSON sea parseable antes de deserializar.
- La limpieza de archivos temporales **siempre** se ejecuta (bloque `finally`).
- Un fallo en un ítem no interrumpe el procesamiento de los demás.

---

## 12. Notas Técnicas Importantes

### Manejo de Tipos Nulos
- `string` nulo → `""` (cadena vacía) antes de enviar al multipart.
- `int` nulo → `0` antes de enviar al multipart.
- No omitir campos del formulario multipart aunque sean nulos.

### Serialización JSON
- Usar deserialización case-insensitive (`PropertyNameCaseInsensitive = true`).
- Manejar fechas en formato `yyyy-MM-dd HH:mm:ss`.
- Serializar `medicamentos` como array JSON válido (usar `"[]"` si la lista es nula o vacía).

### Archivos Temporales
- Usar `Path.GetTempPath()` del sistema operativo.
- Generar nombres únicos para evitar conflictos entre peticiones concurrentes (ej. `Guid.NewGuid() + extension`).
- Limpiar **siempre** en bloque `finally`, incluso si ocurrió una excepción.
- Si la eliminación falla → `LogWarning`, no relanzar excepción.

### Manejo de Errores en Respuesta JSON
- Prioridad de parseo del mensaje de error: `"message"` → `"errors"` → contenido completo de la respuesta.
- Si la respuesta no es JSON válido, usar el contenido raw como mensaje de error.

### Flujo de Excepción en Fase 1 (API de Datos)
- Si la API #1 lanza una excepción no controlada → registrar `{soporte} → Error interno`, limpiar temp y **pasar al siguiente ítem**. **No** intentar llamar a la API #2 sin datos clínicos.

---

## 13. Decisiones de Diseño Tomadas

| # | Decisión | Justificación |
|---|----------|---------------|
| 1 | **Controlador:** `SoportesFisicosController` | Nombre descriptivo, sin conflicto con el `SoporteApiService` existente. Ruta sugerida: `/soportes-fisicos`. |
| 2 | **HttpClient dedicado por servicio** | `SoporteDatosService` necesita `X-API-KEY` y apunta a otro host (`api-soportes.helpharma.com.co`). `SoporteFisicoService` sube PDFs y necesita timeout mayor (~120s). Ambos siguen el mismo patrón `AddHttpClient<TInterface, TImpl>` que ya usa el proyecto (`SoporteApiService`, `DescargaService`). |
| 3 | **Acceso:** todos los usuarios autenticados | El sistema no tiene roles actualmente. Se valida sesión activa igual que en `DashboardController` (`HttpContext.Session.GetString(SessionKeys.Usuario)`). |
| 4 | **UI:** vista nueva `/Views/SoportesFisicos/Index.cshtml`| Sigue el estilo CSS/Inter/shared del proyecto existente. No se parte del prototipo `/prototipo/` (es solo referencia visual). |
| 5 | **Timeout para SoporteFisicoService:** 120 s | Subir PDFs sobre HTTPS puede tardar más que las consultas ligeras del Dashboard (actualmente 10 s). Se configura en `appsettings.json`. |


