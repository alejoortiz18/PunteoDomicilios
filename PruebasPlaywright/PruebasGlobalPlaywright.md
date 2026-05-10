# Plan de Pruebas Global — Punteo de Domicilios
**Herramienta:** Playwright (Chromium)  
**Usuario de prueba:** `MMUNOZ`  
**URL base:** `http://localhost:5125`  
**Fecha del plan:** Mayo 2026  

---

## Contexto de la aplicación

| Elemento | Detalle |
|---|---|
| Framework | .NET 10 MVC |
| Base de datos | SQL Server `192.168.1.22`, DB `HELPHARMA`, tabla `MvMensajer` |
| API externa | `https://intranet.helpharma.com/api/v1/consultasoporte/{Nrodcto}` |
| Sesión | ASP.NET Core `ISession` (cookie `.PunteoDomicilios.Session`, 8 h idle) |
| Rutas principales | `GET /login`, `POST /login`, `GET /` (dashboard), `GET /detalle?mes=YYYY-MM` |

---

## Prerequisitos de ejecución

1. La aplicación debe estar corriendo en `http://localhost:5125` antes de iniciar las pruebas:
   ```powershell
   cd "Proyecto-MVC\PunteoDomicilios.Web"
   dotnet run --launch-profile http
   ```
2. El usuario `MMUNOZ` debe existir en la tabla `MvMensajer` (campo `Usuario = 'MMUNOZ'`).
3. Debe haber acceso a la red interna de HELPHARMA (para las pruebas de soporte API).
4. Playwright debe estar instalado con el navegador Chromium:
   ```bash
   npm init playwright@latest
   npx playwright install chromium
   ```

---

## Configuración Playwright recomendada

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5125',
    browserName: 'chromium',
    headless: false,         // siempre visible — se requiere ver el navegador en todas las pruebas
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['html', { open: 'on-failure' }]],
});
```

---

## Suite 1 — Autenticación y sesión

### PT-01 · Redirección sin sesión activa
**Objetivo:** Verificar que cualquier ruta protegida redirige a `/login` si no hay sesión.  
**Pasos:**
1. Abrir Chromium en modo incógnito (sin cookies previas).
2. Navegar directamente a `http://localhost:5125/`.
3. Verificar que el navegador redirige a `http://localhost:5125/login`.
4. Verificar que la URL final es `/login`.
5. Verificar que la página muestra el elemento `<select>` con opciones de usuarios.

**Resultado esperado:** Redirección automática a `/login`. El `<select>` contiene al menos la opción `MMUNOZ`.

**Playwright (referencia):**
```typescript
test('PT-01 redirección sin sesión', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('**/login');
  await expect(page).toHaveURL(/login/);
  await expect(page.locator('select[name="usuario"]')).toBeVisible();
  await expect(page.locator('select[name="usuario"] option[value="MMUNOZ"]')).toBeAttached();
});
```

---

### PT-02 · Login vacío muestra error
**Objetivo:** Verificar validación al intentar entrar sin seleccionar usuario.  
**Pasos:**
1. Navegar a `http://localhost:5125/login`.
2. No seleccionar nada en el `<select>`.
3. Hacer clic en el botón "Entrar al sistema →".
4. Verificar que el formulario no envía (validación HTML5 `required`).

**Resultado esperado:** El navegador impide el envío. No hay redirección a `/`.

**Playwright (referencia):**
```typescript
test('PT-02 login vacío no redirige', async ({ page }) => {
  await page.goto('/login');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/login/);
});
```

---

### PT-03 · Login exitoso con MMUNOZ
**Objetivo:** Verificar que seleccionar `MMUNOZ` e iniciar sesión redirige al dashboard.  
**Pasos:**
1. Navegar a `http://localhost:5125/login`.
2. Seleccionar `MMUNOZ` en el `<select>`.
3. Hacer clic en "Entrar al sistema →".
4. Verificar redirección a `http://localhost:5125/`.
5. Verificar que el sidebar muestra el nombre `MMUNOZ` en el user chip.
6. Verificar que el topbar muestra `MMUNOZ`.

**Resultado esperado:** URL es `/`. Sidebar contiene `MMUNOZ`. No hay errores en consola.

**Playwright (referencia):**
```typescript
test('PT-03 login exitoso MMUNOZ', async ({ page }) => {
  await page.goto('/login');
  await page.selectOption('select[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5125/');
  await expect(page.locator('.chip-name')).toContainText('MMUNOZ');
});
```

---

### PT-04 · Sesión persiste al navegar entre páginas
**Objetivo:** Verificar que la sesión no se pierde al navegar a `/detalle`.  
**Pasos:**
1. Iniciar sesión con `MMUNOZ` (PT-03 completado).
2. Hacer clic en "Detalle mes" en el sidebar.
3. Navegar manualmente a `http://localhost:5125/`.
4. Verificar que en ningún momento redirige a `/login`.

**Resultado esperado:** La sesión persiste. No hay redirección involuntaria.

---

### PT-05 · Cambiar usuario
**Objetivo:** Verificar que "↩ Cambiar" invalida la sesión actual.  
**Pasos:**
1. Iniciar sesión con `MMUNOZ`.
2. Hacer clic en "↩ Cambiar" en el sidebar (o en el topbar).
3. Verificar redirección a `/login`.
4. Verificar que el `<select>` vuelve a estar disponible.
5. Navegar directamente a `/` sin loguearse nuevamente.
6. Verificar que redirige a `/login` (sesión limpiada).

**Resultado esperado:** Sesión destruida. Acceso directo a `/` redirige a `/login`.

**Playwright (referencia):**
```typescript
test('PT-05 cambiar usuario limpia sesión', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.selectOption('select[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
  // Cambiar
  await page.click('a[href*="cambiar=true"]');
  await page.waitForURL('**/login');
  // Navegar a / sin sesión
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
});
```

---

## Suite 2 — Dashboard

> **Precondición:** Sesión iniciada con `MMUNOZ` para todos los casos de esta suite.

### PT-06 · Carga del resumen mensual
**Objetivo:** Verificar que la tabla de resumen mensual se carga correctamente.  
**Pasos:**
1. Iniciar sesión con `MMUNOZ` y navegar a `/`.
2. Esperar a que desaparezca el skeleton loader (`#resumenLoading`).
3. Verificar que aparece la tabla `#resumenTabla` (visible).
4. Verificar que al menos una fila existe en `#resumenTbody`.
5. Verificar que cada fila tiene: etiqueta de mes, total de registros (número), planillas (número), y enlace "Ver detalle →".

**Resultado esperado:** Tabla visible con datos reales de la BD. Los valores de registros y planillas son números positivos.

**Playwright (referencia):**
```typescript
test('PT-06 resumen mensual carga', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.selectOption('select[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');

  // Esperar carga
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#resumenTabla')).toBeVisible();
  const filas = page.locator('#resumenTbody tr');
  await expect(filas).toHaveCount({ minimum: 1 });
  // Verificar que el enlace "Ver detalle" existe en la primera fila
  await expect(filas.first().locator('a')).toContainText('Ver detalle');
});
```

---

### PT-07 · Estado vacío si no hay registros
**Objetivo:** Si `MMUNOZ` no tiene datos en la BD, mostrar estado vacío.  
**Pasos:**
1. Iniciar sesión con un usuario que no tenga registros (si aplica en el ambiente de prueba).
2. Verificar que aparece `#resumenVacio` en lugar de `#resumenTabla`.

**Resultado esperado:** Elemento `#resumenVacio` visible con mensaje apropiado. `#resumenTabla` oculto.

*Nota: Esta prueba puede omitirse si `MMUNOZ` siempre tiene datos.*

---

### PT-08 · Selector de fecha tiene valor por defecto
**Objetivo:** Verificar que `#inputFecha` tiene como valor predeterminado la fecha de hoy.  
**Pasos:**
1. Navegar al dashboard con sesión activa.
2. Leer el valor del `input[type="date"]#inputFecha`.
3. Comparar con la fecha actual en formato `YYYY-MM-DD`.

**Resultado esperado:** El valor del input coincide con la fecha de hoy.

**Playwright (referencia):**
```typescript
test('PT-08 fecha por defecto es hoy', async ({ page }) => {
  // (asumiendo login ya realizado)
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  await expect(page.locator('#inputFecha')).toHaveValue(today);
});
```

---

### PT-09 · Consulta por fecha devuelve registros y activa KPIs
**Objetivo:** Verificar el flujo completo de consulta por fecha.  
**Pasos:**
1. Iniciar sesión con `MMUNOZ`.
2. Seleccionar una fecha con datos conocidos (ej. un día del mes más reciente en el resumen).
3. Hacer clic en "🔍 Iniciar Consulta".
4. Verificar que aparece `#areaProgreso` con la barra de progreso.
5. Esperar hasta que la barra llegue a 100% y `#areaProgreso` se oculte.
6. Verificar que `#areaKpi` es visible.
7. Verificar que `#kpiTotal` tiene un número mayor que 0.
8. Verificar que `#kpiCuota` contiene el símbolo `$`.
9. Verificar que `#kpiPlanillas` tiene un número ≥ 1.
10. Verificar que `#kpiSoporte` muestra un porcentaje (termina en `%`).

**Resultado esperado:** Todos los KPIs muestran valores válidos. No hay errores en consola.

**Playwright (referencia):**
```typescript
test('PT-09 consulta por fecha activa KPIs', async ({ page }) => {
  // Usar interceptor para capturar errores de red
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  // Poner una fecha con datos (ajustar según datos reales de MMUNOZ)
  await page.fill('#inputFecha', '2026-04-15');
  await page.click('#btnConsultar');

  // Esperar progreso y luego KPIs
  await expect(page.locator('#areaProgreso')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('#areaKpi')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#kpiTotal')).not.toHaveText('—');
  await expect(page.locator('#kpiSoporte')).toContainText('%');

  expect(errors.length).toBe(0);
});
```

---

### PT-10 · Consulta fecha sin datos muestra alerta
**Objetivo:** Verificar el comportamiento cuando la fecha seleccionada no tiene registros.  
**Pasos:**
1. Iniciar sesión con `MMUNOZ`.
2. Seleccionar una fecha futura o sin datos (ej. `2099-01-01`).
3. Hacer clic en "🔍 Iniciar Consulta".
4. Verificar que aparece una alerta informando la ausencia de registros.
5. Verificar que `#areaKpi` sigue oculto.

**Resultado esperado:** Se muestra `alert()` o mensaje informativo. Los KPIs no se muestran.

---

### PT-11 · Gráfica de los últimos 7 días (Timeline)
**Objetivo:** Verificar que se renderiza la gráfica de barras apiladas.  
**Pasos:**
1. Completar el flujo de PT-09.
2. Verificar que `#areaCharts` es visible.
3. Verificar que el `<canvas id="chartTimeline">` tiene dimensiones positivas (ancho > 0).
4. Verificar que el `<canvas id="chartDonut">` tiene dimensiones positivas.

**Resultado esperado:** Ambas gráficas renderizadas con Chart.js. No se muestra canvas vacío.

**Playwright (referencia):**
```typescript
test('PT-11 gráficas visibles tras consulta', async ({ page }) => {
  // (después de PT-09)
  await expect(page.locator('#areaCharts')).toBeVisible();
  const w = await page.locator('#chartTimeline').evaluate(el => el.clientWidth);
  expect(w).toBeGreaterThan(0);
});
```

---

### PT-12 · Botón "Iniciar Consulta" se deshabilita durante la petición
**Objetivo:** Verificar que el botón y el spinner funcionan correctamente.  
**Pasos:**
1. Iniciar sesión con `MMUNOZ`.
2. Seleccionar una fecha con datos.
3. Hacer clic en "🔍 Iniciar Consulta".
4. Inmediatamente verificar que `#btnConsultar` está deshabilitado.
5. Esperar a que la consulta termine.
6. Verificar que `#btnConsultar` vuelve a estar habilitado.

**Resultado esperado:** El botón se deshabilita durante la consulta y se reactiva al terminar.

---

## Suite 3 — Navegación al Detalle del Mes

> **Precondición:** Sesión iniciada con `MMUNOZ`. El resumen mensual tiene al menos un mes.

### PT-13 · Enlace "Ver detalle" navega a /detalle
**Objetivo:** Verificar que el enlace del resumen mensual navega correctamente.  
**Pasos:**
1. Navegar al dashboard y esperar que cargue el resumen.
2. Hacer clic en el botón "Ver detalle →" de la primera fila.
3. Verificar que la URL cambia a `/detalle?mes=YYYY-MM`.
4. Verificar que el título de la página contiene el nombre del mes (ej. "Mayo 2026").
5. Verificar que el breadcrumb muestra "Dashboard › [MesLabel]".

**Resultado esperado:** Navegación exitosa. La URL contiene el mes correcto. El breadcrumb es correcto.

**Playwright (referencia):**
```typescript
test('PT-13 navegar a detalle desde resumen', async ({ page }) => {
  await expect(page.locator('#resumenTabla')).toBeVisible({ timeout: 15_000 });
  const enlace = page.locator('#resumenTbody tr').first().locator('a');
  const href = await enlace.getAttribute('href');
  await enlace.click();
  await page.waitForURL('**/detalle**');
  expect(page.url()).toContain('/detalle?mes=');
  await expect(page.locator('.breadcrumb-punteo')).toContainText('Dashboard');
});
```

---

### PT-14 · Sidebar: navegación directa a Detalle sin mes redirige al dashboard
**Objetivo:** Si se accede a `/detalle` sin parámetro `mes`, debe redirigir al dashboard.  
**Pasos:**
1. Navegar a `http://localhost:5125/detalle` (sin parámetro).
2. Verificar redirección a `/`.

**Resultado esperado:** Redirige automáticamente al dashboard.

---

### PT-15 · Detalle con mes inválido redirige al dashboard
**Objetivo:** Verificar robustez ante mes malformado.  
**Pasos:**
1. Navegar a `http://localhost:5125/detalle?mes=INVALIDO`.
2. Verificar redirección a `/`.

**Resultado esperado:** Redirige al dashboard. No se muestra error 500.

---

## Suite 4 — Vista Detalle: Días del Mes

> **Precondición:** Sesión con `MMUNOZ`. Navegar a `/detalle?mes=<mes-con-datos>`.

### PT-16 · Carga de días del mes
**Objetivo:** Verificar que la tabla de días se carga correctamente.  
**Pasos:**
1. Navegar a `/detalle?mes=<mes-con-datos>` (ej. el mes más reciente del resumen).
2. Esperar a que desaparezca el skeleton loader (`#diasLoading`).
3. Verificar que `#diasTabla` es visible.
4. Verificar que `#diasTbody` tiene al menos una fila.
5. Verificar que cada fila muestra: fecha (formato DD/MM/YYYY), total registros, planillas y botón "Ver registros →".

**Resultado esperado:** Tabla visible con días que pertenecen al mes indicado en la URL.

**Playwright (referencia):**
```typescript
test('PT-16 carga días del mes', async ({ page }) => {
  await page.goto('/detalle?mes=2026-04'); // ajustar según datos reales
  await expect(page.locator('#diasLoading')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#diasTabla')).toBeVisible();
  await expect(page.locator('#diasTbody tr')).toHaveCount({ minimum: 1 });
});
```

---

### PT-17 · Expandir día muestra registros (Nivel 2)
**Objetivo:** Verificar el drill-down al hacer clic en "Ver registros →".  
**Pasos:**
1. En la vista de detalle, hacer clic en "Ver registros →" de la primera fila.
2. Verificar que `#panelDia` se hace visible.
3. Verificar que `#panelDiaTitulo` contiene la fecha del día seleccionado.
4. Esperar a que `#panelProgreso` (barra de progreso soporte) complete.
5. Verificar que `#panelTabla` es visible.
6. Verificar que `#panelTbody` tiene al menos una fila.
7. Verificar que cada fila tiene: Nrodcto (en `<code>`), Destino, CuotaMod (con `$`), Nro Planilla, columna Estado.

**Resultado esperado:** Panel de registros visible con datos del día. El estado de cada registro es uno de: ✅ Encontrado, ❌ Sin soporte, ⚠ Error API.

**Playwright (referencia):**
```typescript
test('PT-17 drill-down día', async ({ page }) => {
  await page.goto('/detalle?mes=2026-04');
  await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 15_000 });
  await page.locator('#diasTbody tr').first().locator('button').click();

  await expect(page.locator('#panelDia')).toBeVisible();
  await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#panelTbody tr')).toHaveCount({ minimum: 1 });
});
```

---

### PT-18 · Estado de soporte en registros del día
**Objetivo:** Verificar que cada registro muestra el estado correcto tras la consulta a la API.  
**Pasos:**
1. Expandir un día (PT-17).
2. Esperar a que todos los registros salgan del estado "⏳ Consultando…".
3. Para cada fila: verificar que el badge de estado es uno de `.tag-green`, `.tag-red` o `.tag-yellow`.
4. Verificar que las filas con `.tag-green` tienen un botón "🔍 Ver soporte" o el texto "Sin archivo".
5. Verificar que las filas con `.tag-red` muestran "—" en la columna Acción.

**Resultado esperado:** Ninguna fila queda en estado "⏳ Consultando…" indefinidamente. Los estados son coherentes con la respuesta de la API.

---

### PT-19 · Cerrar panel del día
**Objetivo:** Verificar que el botón "✕ Cerrar" oculta el panel de nivel 2.  
**Pasos:**
1. Expandir un día (PT-17).
2. Hacer clic en el botón "✕ Cerrar".
3. Verificar que `#panelDia` se oculta.

**Resultado esperado:** Panel oculto. No queda estado residual.

---

### PT-20 · Expandir/colapsar el mismo día
**Objetivo:** Verificar que hacer clic dos veces en el mismo día lo cierra.  
**Pasos:**
1. Hacer clic en "Ver registros →" de la primera fila.
2. Verificar que `#panelDia` es visible.
3. Hacer clic nuevamente en el mismo botón de la primera fila.
4. Verificar que `#panelDia` se oculta.

**Resultado esperado:** Comportamiento de toggle al hacer clic en el mismo día dos veces.

---

## Suite 5 — Modal de Soporte

> **Precondición:** Tener al menos un registro en el Nivel 2 con estado "✅ Encontrado" y botón "🔍 Ver soporte".

### PT-21 · Abrir modal "Ver soporte"
**Objetivo:** Verificar que el modal se abre con datos correctos.  
**Pasos:**
1. Encontrar una fila con estado ✅ y botón "🔍 Ver soporte".
2. Hacer clic en el botón.
3. Verificar que el modal `#modalSoporte` se hace visible.
4. Verificar que `#modalSoporteBody` contiene: el Nrodcto, la fecha de registro y la ruta del archivo.
5. Verificar que `#modalDescargaLink` tiene un `href` con `/api/detalle/descargar?path=`.

**Resultado esperado:** Modal visible con información correcta del soporte. El enlace de descarga apunta al endpoint correcto.

**Playwright (referencia):**
```typescript
test('PT-21 modal soporte se abre', async ({ page }) => {
  // (después de expandir un día con soporte encontrado)
  const btnVerSoporte = page.locator('button:has-text("Ver soporte")').first();
  await expect(btnVerSoporte).toBeVisible({ timeout: 60_000 });
  await btnVerSoporte.click();

  await expect(page.locator('#modalSoporte')).toBeVisible();
  await expect(page.locator('#modalSoporteBody')).not.toBeEmpty();
  const href = await page.locator('#modalDescargaLink').getAttribute('href');
  expect(href).toContain('/api/detalle/descargar?path=');
});
```

---

### PT-22 · Cerrar modal con botón "Cerrar"
**Objetivo:** Verificar que el modal se puede cerrar.  
**Pasos:**
1. Abrir el modal (PT-21).
2. Hacer clic en el botón "Cerrar".
3. Verificar que `#modalSoporte` se oculta.

**Resultado esperado:** Modal cerrado. La tabla de registros sigue visible debajo.

---

### PT-23 · Cerrar modal con tecla ESC
**Objetivo:** Verificar comportamiento estándar de Bootstrap modal.  
**Pasos:**
1. Abrir el modal (PT-21).
2. Presionar la tecla `Escape`.
3. Verificar que `#modalSoporte` se oculta.

**Resultado esperado:** Modal cerrado al presionar ESC.

---

## Suite 6 — API endpoints (pruebas de integración)

> Estas pruebas validan los endpoints directamente mediante `fetch` / `request` de Playwright, sin necesidad de UI completa.

### PT-24 · GET /api/resumen-mensual sin sesión → 401
**Objetivo:** Verificar que el endpoint protege correctamente sin sesión.  
**Pasos:**
1. Sin iniciar sesión, hacer `GET http://localhost:5125/api/resumen-mensual`.
2. Verificar que el código HTTP de respuesta es `401`.

**Playwright (referencia):**
```typescript
test('PT-24 resumen-mensual sin sesión devuelve 401', async ({ request }) => {
  const resp = await request.get('/api/resumen-mensual');
  expect(resp.status()).toBe(401);
});
```

---

### PT-25 · GET /api/resumen-mensual con sesión → 200 + array
**Objetivo:** Verificar que el endpoint devuelve datos válidos.  
**Pasos:**
1. Iniciar sesión con `MMUNOZ` (via browser context / storage state).
2. Hacer `GET /api/resumen-mensual`.
3. Verificar respuesta `200` con body JSON: array con objetos `{ mes, label, totalRegistros, totalPlanillas }`.
4. Verificar que `totalRegistros > 0` en al menos un elemento.

---

### PT-26 · GET /api/registros?fecha=YYYY-MM-DD con sesión → 200
**Objetivo:** Verificar estructura de respuesta del endpoint de registros.  
**Pasos:**
1. Con sesión de `MMUNOZ`, hacer `GET /api/registros?fecha=<fecha-con-datos>`.
2. Verificar respuesta `200` con body `{ total, registros: [...], nrodctos: [...] }`.
3. Verificar que `registros[0]` tiene los campos: `nrodcto`, `destino`, `cuotaMod`, `nroPlanilla`.

---

### PT-27 · POST /api/consultar-batch con lista de Nrodctos
**Objetivo:** Verificar que el batch endpoint procesa y devuelve estados.  
**Pasos:**
1. Con sesión de `MMUNOZ`, hacer `POST /api/consultar-batch` con body `["NRODCTO1", "NRODCTO2"]`.
2. Verificar respuesta `200` con array de `{ nrodcto, estado, fechaRegistro, storagePath, mensajeError }`.
3. Verificar que cada `estado` es: `0` (Pendiente), `1` (Encontrado), `2` (Faltante) o `3` (Error).

---

### PT-28 · GET /api/detalle/dias?mes=YYYY-MM con sesión → 200
**Objetivo:** Verificar el endpoint de días del mes.  
**Pasos:**
1. Con sesión de `MMUNOZ`, hacer `GET /api/detalle/dias?mes=<mes-con-datos>`.
2. Verificar `200` con array de `{ fecha, totalRegistros, totalPlanillas }`.
3. Verificar que todas las fechas pertenecen al mes solicitado.

---

### PT-29 · GET /api/detalle/soporte?nrodcto=X devuelve estructura válida
**Objetivo:** Verificar la respuesta del endpoint de soporte individual.  
**Pasos:**
1. Sin sesión requerida (no está protegido por sesión), hacer `GET /api/detalle/soporte?nrodcto=<nrodcto-válido>`.
2. Verificar `200` con body `{ success: bool, message: string|null, data: [...] }`.
3. Si `success = true`: `data` tiene al menos un elemento con `fechaRegistro`, `storage_Disk`, `storage_Path`.
4. Si `success = false`: `data` es `null` y `message` es informativo.

---

### PT-30 · GET /api/detalle/descargar?path=.. → 400 (path traversal bloqueado)
**Objetivo:** Verificar la protección contra path traversal.  
**Pasos:**
1. Hacer `GET /api/detalle/descargar?path=../../../etc/passwd`.
2. Verificar que el código de respuesta es `400`.
3. Hacer `GET /api/detalle/descargar?path=soportes\..\..\config`.
4. Verificar que el código de respuesta es `400`.

**Resultado esperado:** El endpoint rechaza rutas con `..` o `\`.

**Playwright (referencia):**
```typescript
test('PT-30 path traversal bloqueado', async ({ request }) => {
  const r1 = await request.get('/api/detalle/descargar?path=../../../etc/passwd');
  expect(r1.status()).toBe(400);
  const r2 = await request.get('/api/detalle/descargar?path=soportes\\..\\config');
  expect(r2.status()).toBe(400);
});
```

---

## Suite 7 — Diseño, layout y navegación visual

### PT-31 · Sidebar visible en todas las páginas
**Objetivo:** Verificar que el sidebar aparece correctamente en dashboard y detalle.  
**Pasos:**
1. Navegar al dashboard → verificar `.punteo-sidebar` visible.
2. Navegar a detalle → verificar `.punteo-sidebar` visible.
3. Verificar que el ítem activo del sidebar tiene clase `.active`.

**Resultado esperado:** Sidebar presente y el ítem de navegación activo es correcto en cada página.

---

### PT-32 · Topbar muestra título y usuario
**Objetivo:** Verificar la barra superior.  
**Pasos:**
1. En el dashboard: verificar que `.topbar-title` contiene "Dashboard".
2. En el detalle: verificar que `.topbar-title` contiene el nombre del mes.
3. Verificar que `.topbar-user` o `.chip-name` contiene "MMUNOZ".

**Resultado esperado:** Título dinámico correcto en cada vista. El usuario se muestra siempre.

---

### PT-33 · Login no muestra sidebar
**Objetivo:** Verificar que la página de login tiene layout independiente.  
**Pasos:**
1. Navegar a `/login`.
2. Verificar que `.punteo-sidebar` NO existe en el DOM.
3. Verificar que `.login-card` es visible y centrado.

**Resultado esperado:** La página de login tiene su propio layout sin sidebar.

---

### PT-34 · Responsive: sidebar visible en escritorio
**Objetivo:** Verificar comportamiento del layout a distintas resoluciones.  
**Pasos:**
1. A resolución 1280×800: verificar que `.punteo-sidebar` es visible.
2. A resolución 480×800: verificar comportamiento (según CSS el sidebar se oculta).
3. En escritorio: verificar que `.punteo-main` tiene `margin-left` de `220px`.

---

## Suite 8 — Errores y casos borde

### PT-35 · Manejo de error de red en resumen mensual
**Objetivo:** Verificar degradación elegante cuando el servidor no responde.  
**Pasos:**
1. Interceptar con Playwright la llamada a `/api/resumen-mensual` y abortar.
2. Verificar que `#resumenLoading` se oculta.
3. Verificar que `#resumenVacio` aparece con mensaje de error, sin excepción no controlada.

**Playwright (referencia):**
```typescript
test('PT-35 error de red en resumen', async ({ page }) => {
  await page.route('/api/resumen-mensual', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#resumenVacio')).toBeVisible({ timeout: 10_000 });
});
```

---

### PT-36 · Sin errores en consola del navegador en flujo normal
**Objetivo:** Verificar que el flujo completo no genera errores en consola.  
**Pasos:**
1. Iniciar sesión con `MMUNOZ`.
2. Navegar al dashboard → esperar resumen → hacer consulta por fecha.
3. Navegar al detalle → expandir un día.
4. Abrir y cerrar el modal.
5. Recopilar todos los mensajes de consola del navegador durante el flujo.
6. Verificar que **no hay mensajes de tipo `error`**.

**Resultado esperado:** Cero errores en consola de Chrome durante el flujo completo.

**Playwright (referencia):**
```typescript
test('PT-36 sin errores en consola flujo completo', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  // Flujo completo...
  await page.goto('/login');
  await page.selectOption('select[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
  // ... continuar flujo ...

  expect(errors).toHaveLength(0);
});
```

---

## Resumen de casos de prueba

| ID | Suite | Nombre | Crítico |
|---|---|---|---|
| PT-01 | Autenticación | Redirección sin sesión | ✅ |
| PT-02 | Autenticación | Login vacío muestra error | ✅ |
| PT-03 | Autenticación | Login exitoso con MMUNOZ | ✅ |
| PT-04 | Autenticación | Sesión persiste al navegar | ✅ |
| PT-05 | Autenticación | Cambiar usuario limpia sesión | ✅ |
| PT-06 | Dashboard | Carga resumen mensual | ✅ |
| PT-07 | Dashboard | Estado vacío sin registros | ⬜ |
| PT-08 | Dashboard | Fecha por defecto es hoy | ✅ |
| PT-09 | Dashboard | Consulta fecha activa KPIs | ✅ |
| PT-10 | Dashboard | Fecha sin datos muestra alerta | ✅ |
| PT-11 | Dashboard | Gráficas visibles tras consulta | ✅ |
| PT-12 | Dashboard | Botón se deshabilita durante petición | ⬜ |
| PT-13 | Detalle | Enlace "Ver detalle" navega a /detalle | ✅ |
| PT-14 | Detalle | Sin mes redirige al dashboard | ✅ |
| PT-15 | Detalle | Mes inválido redirige al dashboard | ✅ |
| PT-16 | Detalle-Días | Carga días del mes | ✅ |
| PT-17 | Detalle-Días | Drill-down día muestra registros | ✅ |
| PT-18 | Detalle-Días | Estado de soporte en registros | ✅ |
| PT-19 | Detalle-Días | Cerrar panel del día | ⬜ |
| PT-20 | Detalle-Días | Expandir/colapsar mismo día | ⬜ |
| PT-21 | Modal | Abrir modal "Ver soporte" | ✅ |
| PT-22 | Modal | Cerrar modal con botón | ⬜ |
| PT-23 | Modal | Cerrar modal con ESC | ⬜ |
| PT-24 | API | resumen-mensual sin sesión → 401 | ✅ |
| PT-25 | API | resumen-mensual con sesión → 200 | ✅ |
| PT-26 | API | registros por fecha → 200 | ✅ |
| PT-27 | API | consultar-batch → estados | ✅ |
| PT-28 | API | detalle/dias → 200 | ✅ |
| PT-29 | API | detalle/soporte → estructura | ✅ |
| PT-30 | API | Path traversal bloqueado → 400 | ✅ |
| PT-31 | Layout | Sidebar en todas las páginas | ⬜ |
| PT-32 | Layout | Topbar muestra título y usuario | ⬜ |
| PT-33 | Layout | Login sin sidebar | ⬜ |
| PT-34 | Layout | Responsive escritorio | ⬜ |
| PT-35 | Errores | Error de red degradación elegante | ✅ |
| PT-36 | Errores | Sin errores en consola flujo normal | ✅ |

**Total:** 36 casos — **Críticos (✅):** 22 — **Complementarios (⬜):** 14

---

## Bugs encontrados durante la elaboración del plan

| # | Archivo | Descripción | Estado |
|---|---|---|---|
| BUG-01 | `wwwroot/js/dashboard.js` | Comparaba `e.estado === 0` para detectar "Encontrado", pero el enum `EstadoSoporte.Encontrado = 1`. Conteo de entregados/faltantes siempre incorrecto. | ✅ Corregido |
| BUG-02 | `wwwroot/js/detalle.js` | `actualizarFilaSoporte` comparaba `soporte.estado` (propiedad de `NrodctoEstadoDto`) pero el endpoint `/api/detalle/soporte` devuelve `SoporteApiResponse` (que no tiene `estado`, tiene `success` + `data`). Ningún soporte se mostraba como "Encontrado". | ✅ Corregido |

---

## Notas de ejecución

- **Orden recomendado:** Suite 1 → Suite 2 → Suite 3 → Suite 4 → Suite 5 → Suite 6 → Suite 7 → Suite 8.
- **Dependencia de datos reales:** Las pruebas PT-09, PT-16, PT-17, PT-18 y PT-21 requieren que `MMUNOZ` tenga registros en la BD. Verificar en SQL Server antes de ejecutar:
  ```sql
  SELECT FORMAT(Fecha,'yyyy-MM') AS Mes, COUNT(*) AS Total
  FROM MvMensajer WHERE Usuario = 'MMUNOZ'
  GROUP BY FORMAT(Fecha,'yyyy-MM') ORDER BY Mes DESC
  ```
- **API externa:** Las pruebas de soporte (PT-09, PT-18, PT-21, PT-27, PT-29) requieren acceso a `https://intranet.helpharma.com`. Si la red interna no está disponible, el estado esperado será "⚠ Error API" o "❌ Sin soporte" para todos los registros, lo cual también es válido.
- **Token API:** Si `ApiInterna:Token` está vacío en `appsettings.json`, las llamadas a la API pueden devolver `401`. Configurar el token antes de ejecutar las pruebas de soporte.
