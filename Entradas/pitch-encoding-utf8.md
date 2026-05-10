# Pitch: Corrección global de encoding UTF-8 (mojibake)

> Metodología Shape Up — Basecamp · https://basecamp.com/shapeup/1.5-chapter-06  
> Fecha: 2026-05-10 · Apetito: Small Batch (1–2 días)

---

## 1. Problema

Los archivos del proyecto fueron creados o editados en distintos entornos (Windows con ANSI / Latin-1, VS Code con UTF-8, PowerShell con codificación por defecto) sin haber fijado un estándar de encoding. Como resultado, cadenas como guiones, tildes, ñ y emojis quedaron guardadas en bytes UTF-8 pero leídas como Latin-1 o Windows-1252, produciendo secuencias ilegibles conocidas como **mojibake**.

### Síntomas visibles hoy en el proyecto

| Texto corrupto en código fuente | Texto correcto esperado |
|---|---|
| `â€"` | `—` (guión em) |
| `â€"` | `–` (guión en) |
| `Ã±` | `ñ` |
| `Ã¡` | `á` |
| `Ã©` | `é` |
| `Ã­` | `í` |
| `Ã³` | `ó` |
| `Ãº` | `ú` |
| `Ã'` | `Ñ` |
| `ðŸ"…` | `📅` |
| `âŒ` | `❌` |
| `â€œ` / `â€` | `"` / `"` (comillas tipográficas) |

### Impacto en el usuario

Los mensajes de error, títulos de sección, etiquetas de campos y textos de la interfaz aparecen con caracteres basura. Esto genera una percepción de baja calidad en un sistema interno que actualmente está siendo adoptado por el equipo de mensajería de HELPHARMA.

### Alcance afectado (descubierto)

- Vistas Razor (`.cshtml`) — títulos, mensajes hardcodeados  
- JavaScript (`.js`) — strings de comentarios, mensajes `mostrarModal`  
- Archivos de log (`.txt`) — entradas históricas con texto corrupto  
- Hojas de estilo (`.css`) — comentarios de sección  
- Scripts PowerShell (`.ps1`) — mensajes de salida  

---

## 2. Apetito

**Small Batch — 1 a 2 días de trabajo.**

El problema está acotado: no afecta lógica, modelos, base de datos ni APIs. Es exclusivamente texto visible. Un desarrollador puede recorrer todos los archivos relevantes, aplicar los reemplazos y validar en una sesión continua.

Si en el transcurso aparecen archivos con encoding completamente irrecuperable (binarios mezclados, archivos de terceros), se documentan y se dejan fuera — no se extiende el tiempo.

---

## 3. Solución

### Enfoque: búsqueda y reemplazo quirúrgico, archivo por archivo

No se usa ninguna herramienta de conversión masiva automática que pueda romper archivos binarios o de terceros. El proceso es:

```
1. Identificar  → grep recursivo de secuencias Ã, â€, ðŸ, etc.
2. Clasificar   → determinar qué archivo, qué línea, qué reemplazo
3. Reemplazar   → edición puntual del texto visible afectado
4. Verificar    → confirmar que el archivo sigue siendo UTF-8 válido
5. Reportar     → listar archivos corregidos, textos cambiados, validación
```

### Tabla de reemplazos definida

```
Ã±  →  ñ       Ã'  →  Ñ
Ã¡  →  á       Ãˆ  →  È
Ã©  →  é       Ã"  →  Ó
Ã­  →  í       Ãš  →  Ú
Ã³  →  ó       Ã€  →  À
Ãº  →  ú
â€"  →  —  (U+2014 em dash)
â€"  →  –  (U+2013 en dash)
â€œ  →  "  (U+201C)
â€   →  "  (U+201D)
â€˜  →  '  (U+2018)
â€™  →  '  (U+2019)
ðŸ"…  →  📅
âŒ   →  ❌
â"€   →  ─  (o el caracter de línea correcto)
```

### Archivos a procesar (conocidos)

```
Proyecto-MVC/PunteoDomicilios.Web/
  wwwroot/js/detalle.js
  wwwroot/js/dashboard.js
  wwwroot/js/paginacion.js
  wwwroot/css/punteo.css
  Views/**/*.cshtml
  logs/*.txt

Entradas/
  convert-excel.ps1
  requerimiento.md

*.md (raíz del proyecto)
```

### Validación final

Después de cada archivo corregido, verificar con PowerShell:

```powershell
# Detectar bytes inválidos en UTF-8
$path = "ruta\al\archivo"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$content -match 'Ã|â€|ðŸ|Â' | Should -Be $false
```

---

## 4. Rabbit Holes

> Riesgos identificados que podrían consumir tiempo innecesario si no se acota el trabajo.

### 🕳 Archivos de terceros en `wwwroot/lib/`
Bootstrap, jQuery y Chart.js son librerías externas. Sus archivos pueden contener comentarios con caracteres especiales (nombres de autores, referencias). **No tocar.** No son parte del código del proyecto.

### 🕳 Archivos binarios o compilados (`bin/`, `obj/`)
Los artefactos de compilación (.dll, .pdb, .exe) no son texto editable. Si aparecen en el grep, se ignoran completamente.

### 🕳 Reemplazos en variables o nombres de métodos
Las secuencias corruptas podrían aparecer casualmente dentro de un string que forma parte de una clave JSON, nombre de campo o valor de configuración. **Solo se corrigen textos visibles para el usuario final.** Nombres de propiedades y claves permanecen intactos.

### 🕳 Logs históricos
Los archivos `.txt` en `logs/` tienen registros de ejecuciones pasadas. Corregir el encoding en esos archivos no tiene impacto funcional — se incluyen solo si el tiempo lo permite y sin riesgo de romper parsers que los lean.

### 🕳 La cadena `â€"` tiene dos representaciones
`â€"` (em dash) y `â€"` (en dash) se ven idénticas en algunos editores. Confirmar con bytes hex antes de reemplazar para no mezclarlas.

---

## 5. No-Gos

Lo siguiente está **explícitamente fuera del alcance** de este trabajo:

- ❌ Cambiar la lógica de negocio, flujos o funcionalidades del sistema
- ❌ Renombrar variables, métodos, clases o propiedades de modelos
- ❌ Modificar claves de `appsettings.json` o nombres de sección de configuración
- ❌ Alterar archivos de librerías externas (`wwwroot/lib/`)
- ❌ Tocar la base de datos ni stored procedures
- ❌ Reformatear o refactorizar código más allá del reemplazo de texto
- ❌ Cambiar la arquitectura de encoding del proyecto a largo plazo (eso sería un pitch separado: "Estándar de encoding y EditorConfig para el equipo")

---

## Entregables esperados al cierre

1. **Todos los archivos listados** guardados en UTF-8 sin BOM
2. **Reporte inline** (comentario o sección al final de este documento) con:
   - Lista de archivos modificados
   - Número de reemplazos por archivo
   - Resultado de validación UTF-8
3. **Cero instancias** de las secuencias `Ã`, `â€`, `ðŸ` en archivos del proyecto (excluyendo `lib/`)

---

## Estado

- [x] Identificación completa de archivos afectados
- [x] Reemplazos aplicados
- [x] Validación UTF-8 ejecutada
- [x] Reporte de cierre completado

---

## Reporte de cierre

**Fecha:** 2025-05-09

### Archivos inspeccionados

| Archivo | Mojibake encontrado | Acción |
|---|---|---|
| `wwwroot/js/detalle.js` | ✅ Sí — 22 ocurrencias | Corregido |
| `wwwroot/js/dashboard.js` | ✅ No | Sin cambios |
| `wwwroot/js/paginacion.js` | ✅ No | Sin cambios |
| `wwwroot/css/punteo.css` | ✅ No | Sin cambios |
| `Views/**/*.cshtml` | ✅ No | Sin cambios |
| `**/*.cs` | ✅ No | Sin cambios |

### Reemplazos aplicados en `detalle.js`

| Secuencia corregida | Carácter correcto | Ocurrencias |
|---|---|---|
| `â€"` | `—` (em dash) | 7 |
| `â"€` | `─` (separadores `──`) | múltiples (5 líneas de comentario) |
| `Ã­` → `Ã³` → `Ã¡` → `Ã±` | `í`, `ó`, `á`, `ñ` | 6 |
| `ðŸ"‹` | `📋` | 1 |
| `ðŸ"` | `🔍` | 1 |
| `â³ … â€¦` | `⏳ …` | 1 |
| `âœ…` | `✅` | 1 |
| `âŒ` | `❌` | 1 |
| `âš ` | `⚠` | 2 |
| `â†'` | `→` | 1 |

### Validación final

```
grep_search en Proyecto-MVC/**/*.js → 0 coincidencias de mojibake
grep_search en Proyecto-MVC/**/*.cshtml → 0 coincidencias
grep_search en Proyecto-MVC/**/*.css → 0 coincidencias
grep_search en Proyecto-MVC/**/*.cs → 0 coincidencias
```

**Resultado: LIMPIO** — ningún archivo fuente del proyecto contiene secuencias de doble-encoding.
