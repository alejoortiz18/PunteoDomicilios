# Pitch: Caché Persistente de Soportes Documentales

> Formato: Shape Up — Capítulo 6 "Write the Pitch"  
> Ciclo sugerido: Small Batch · 2 semanas  
> Fecha: Mayo 2026

---

## 1. Problema

**Historia específica (baseline):**

MMUNOZ abre la vista Detalle, selecciona el día 8 de mayo y espera. El sistema
consulta los 23 registros del día al API externo de soportes, uno por uno, de
forma secuencial controlada por un semáforo de concurrencia. Cada llamada tarda
entre 2 y 8 segundos. El total puede superar los 60 segundos antes de que la
tabla muestre si cada documento existe o no.

Al día siguiente, MMUNOZ vuelve a consultar el mismo día. El sistema repite el
proceso completo: los mismos 23 documentos, las mismas 23 llamadas al API
externo. El caché en memoria existe (`IMemoryCache`, 30 min TTL) pero se destruye
cuando la aplicación se reinicia o cuando expira la sesión.

**Consecuencia medible:**
- Cada búsqueda por fecha tarda decenas de segundos aunque los documentos ya
  fueron consultados antes.
- El API externo recibe llamadas repetidas e innecesarias (riesgo de rate-limit).
- La experiencia del usuario es lenta en cada sesión nueva.

**Contexto técnico actual:**
La capa `SoporteApiService.ConsultarAsync` ya tiene un caché L1 en memoria
(`IMemoryCache`) que funciona correctamente dentro de la misma sesión. El problema
es que este caché es **volátil**: no sobrevive reinicios de la app ni sesiones
del día siguiente.

---

## 2. Appetite

**Small Batch: 2 semanas.**

No buscamos rediseñar la arquitectura de caché ni agregar infraestructura externa
(Redis, Distributed Cache). La solución debe ser simple, local y caber dentro de
lo que ya existe en el proyecto. Si la solución necesita más de 2 semanas, es
señal de que se está sobrediseñando.

---

## 3. Solución

### Idea central: Caché L2 persistente con SQL LocalDB

Añadir una **segunda capa de caché** (L2) usando `(localdb)\MSSQLLocalDB`,
que persiste entre sesiones y reinicios. La capa L1 existente (`IMemoryCache`)
no cambia: sigue siendo el caché rápido de la sesión activa.

### Flujo de consulta (Cache-Aside)

```
ConsultarAsync(nrodcto)
  │
  ├─► L1: IMemoryCache → HIT → retornar
  │
  ├─► L2: SQL LocalDB (DocumentosIndexados)
  │     → HIT y success=true → poblar L1 → retornar
  │
  └─► API externo
        → success=true → guardar en L2 → guardar en L1 → retornar
        → success=false → guardar solo en L1 (temporal) → retornar
```

> **Regla clave:** Solo se persiste en SQL cuando `success == true` y
> `data != null`. Los documentos "no encontrados" se cachean solo en memoria
> (30 min), por si el archivo aparece pronto.

### Base de datos

- **Servidor:** `(localdb)\MSSQLLocalDB`
- **Autenticación:** Windows Authentication
- **Nombre de BD:** `DocumentCacheDB`

### Tabla: `DocumentosIndexados`

| Campo            | Tipo          | Descripción                                       |
|------------------|---------------|---------------------------------------------------|
| `Id`             | int PK        | Autoincremental                                   |
| `NumeroDocumento`| varchar(50)   | Número del soporte (`nrodcto`), índice único      |
| `FechaRegistro`  | varchar(50)   | `SoporteDataItem.FechaRegistro` de la API         |
| `StorageDisk`    | varchar(100)  | `SoporteDataItem.Storage_Disk` de la API          |
| `StoragePath`    | varchar(500)  | `SoporteDataItem.Storage_Path` — usada en descarga|
| `FechaIndexacion`| datetime2     | Cuándo se guardó en caché local                   |

El `StoragePath` se persiste explícitamente porque es el dato que necesita la
acción de descarga (`/api/detalle/descargar?path={storagePath}`). Al leer de
SQL, el sistema puede construir un `SoporteApiResponse` completo sin tocar el
API externo.

### Piezas de código nuevas

1. **`IDocumentoCacheRepository`** / **`SqlDocumentoCacheRepository`**  
   Encapsula las operaciones sobre `DocumentosIndexados`:
   `ObtenerAsync(nrodcto)` y `GuardarAsync(nrodcto, item)`.

2. **`SoporteApiService.ConsultarAsync`** — se modifica para:
   - Consultar L2 (SQL) si no hay hit en L1
   - Persistir en L2 después de un hit exitoso del API

3. **`appsettings.json`** — nueva sección:
   ```json
   "CacheLocal": {
     "Habilitado": true,
     "ConnectionString": "Server=(localdb)\\MSSQLLocalDB;Database=DocumentCacheDB;Integrated Security=true;"
   }
   ```

4. **Script SQL de inicialización** (`sql/init-document-cache.sql`)  
   `CREATE DATABASE DocumentCacheDB` + `CREATE TABLE DocumentosIndexados`.

### Lo que NO cambia

- El flujo de descarga (`/api/detalle/descargar`) no se toca.
- La vista Detalle y su JavaScript no cambian.
- El `IMemoryCache` (L1) sigue funcionando exactamente igual.
- El resto de servicios (`MensajeroService`, `DescargaService`) no se modifican.

---

## 4. Rabbit Holes

### LocalDB no disponible o caído
**Riesgo:** `SqlDocumentoCacheRepository` lanza excepción → toda la consulta falla.  
**Parche:** `try/catch` en el repositorio; si falla L2, la consulta continúa al API
como si el caché no existiera. Se loguea como `Warning`, no como `Error`.

```csharp
// Si LocalDB falla, degradamos silenciosamente a la cadena L1 → API
try { resultado = await _cacheRepo.ObtenerAsync(nrodcto); }
catch (Exception ex) { _logger.LogWarning(ex, "L2 cache no disponible"); }
```

### Datos desactualizados en SQL (documento reemplazado/movido)
**Riesgo:** El `StoragePath` almacenado ya no existe en el servidor de archivos.  
**Decisión acotada:** Si la descarga falla con 404, el sistema ya maneja ese caso
en `DescargaService`. No se necesita invalidación activa del caché en este ciclo.

### Inicialización de la base de datos
**Riesgo:** La app arranca y `DocumentCacheDB` no existe → excepción en startup.  
**Parche:** `SqlDocumentoCacheRepository` verifica con `IF NOT EXISTS` antes de
cada operación, o se crea automáticamente en el startup con el script SQL. No
se usará EF Core Migrations para esto (innecesario en una tabla local simple).

### Dapper vs. Entity Framework
**Decisión:** Usar **Dapper** directamente. No vale la pena configurar un
`DbContext` adicional para una sola tabla. Dapper ya es compatible con el estilo
del proyecto.

---

## 5. No-Gos

- ❌ No se cachean en SQL los documentos con `success: false` (evita datos obsoletos).
- ❌ No se construye interfaz de gestión del caché (no hay pantalla para ver/borrar).
- ❌ No se implementa limpieza automática de registros en este ciclo.
- ❌ No se usa Redis, SQL Server remoto ni ningún otro proveedor externo.
- ❌ No se modifica la vista Detalle, el JavaScript ni los endpoints de descarga.
- ❌ No se migra ni altera la base de datos `HELPHARMA` en producción.
- ❌ No se construye revalidación periódica (puede ser un ciclo futuro).

---

## Resultado esperado

El usuario hace la misma búsqueda del día 8 de mayo al día siguiente. El sistema
encuentra los 23 documentos directamente en `DocumentosIndexados` (SQL local) sin
una sola llamada al API externo. La tabla carga en menos de 2 segundos. El botón
de descarga funciona exactamente igual que siempre porque `StoragePath` ya está
disponible en la respuesta reconstruida desde SQL.
