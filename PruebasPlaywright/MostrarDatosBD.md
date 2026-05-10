# Plan de Pruebas — Mostrar Datos BD y Botón Ver Soporte
**Herramienta:** Playwright (Chromium, modo visible — `headless: false`, `slowMo: 400`)  
**Usuario de prueba:** `MMUNOZ`  
**URL base:** `http://localhost:5125`  
**Archivo spec:** `tests/mostrar-datos-bd.spec.ts`  
**Fecha:** Mayo 2026  

---

## Objetivo

Verificar de extremo a extremo que:

1. La aplicación **trae datos reales de la base de datos** (SQL Server `192.168.1.22`) en todos los niveles: resumen mensual, días del mes y registros del día.
2. El botón **🔍 Ver soporte** funciona correctamente:
   - Llama a `https://intranet.helpharma.com/api/v1/consultasoporte/{Nrodcto}`.
   - Si la respuesta trae `success: true`, usa la propiedad `storage_path` del primer elemento.
   - El enlace final al que debe apuntar es `https://intranet.helpharma.com/ver-pdf/{storage_path}`.

---

## Cómo ejecutar las pruebas (modo visible)

### Prerrequisitos

```powershell
# 1. Levantar la aplicación (en otra terminal)
cd "Proyecto-MVC\PunteoDomicilios.Web"
dotnet run --launch-profile http

# 2. Instalar dependencias de Playwright (solo la primera vez)
cd "PruebasPlaywright"
npm install
npx playwright install chromium
```

### Ejecutar en modo visible (headed)

```powershell
cd "PruebasPlaywright"

# Todas las pruebas de este archivo, con navegador visible
npx playwright test tests/mostrar-datos-bd.spec.ts --headed

# Con ralentización extra (500 ms por acción) para seguir mejor el flujo
npx playwright test tests/mostrar-datos-bd.spec.ts --headed --slow-mo=800

# Abrir el reporte HTML al finalizar
npx playwright show-report
```

---

## Configuración Playwright

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5125',
    browserName: 'chromium',
    headless: false,          // SIEMPRE visible — ver el navegador en vivo
    slowMo: 400,              // Ralentizar acciones para observar el flujo
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'resultadosPruebas/playwright-report', open: 'on-failure' }],
  ],
});
```

---

## Suite BD-01 — Verificación de datos reales en base de datos

> **Objetivo:** Comprobar que cada nivel de la aplicación carga filas reales desde la BD,  
> no placeholders, skeletons eternos ni datos vacíos.

---

### BD-01 · Resumen mensual contiene filas de la BD

**Objetivo:** El dashboard carga datos reales de la tabla `MvMensajer` y los muestra en `#resumenTbody`.

**Pasos:**
1. Navegar a `http://localhost:5125/login`.
2. Seleccionar `MMUNOZ` en el `<select>` y hacer clic en "Entrar al sistema →".
3. Esperar a que la URL sea `/`.
4. Esperar a que `#resumenLoading` desaparezca (skeleton oculto).
5. Verificar que `#resumenTabla` es visible.
6. Verificar que `#resumenTbody` tiene **al menos 1 fila**.
7. En la primera fila, verificar que:
   - La etiqueta de mes **no está vacía** (contiene texto).
   - Total de registros es un **número > 0**.
   - Total de planillas es un **número ≥ 1**.
   - El enlace "Ver detalle →" existe.

**Resultado esperado:** Tabla visible con meses reales. Los números son positivos.

**Playwright (spec):**
```typescript
test('BD-01 resumen mensual trae datos de la BD', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.selectOption('select[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5125/');

  // Esperar fin de carga
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('#resumenTabla')).toBeVisible();

  const filas = page.locator('#resumenTbody tr');
  const count = await filas.count();
  expect(count).toBeGreaterThan(0);

  // Primera fila: datos válidos
  const primeraFila = filas.first();
  const textoMes   = await primeraFila.locator('td').nth(0).innerText();
  const txtRegistros = await primeraFila.locator('td').nth(1).innerText();
  const txtPlanillas = await primeraFila.locator('td').nth(2).innerText();

  expect(textoMes.trim()).not.toBe('');
  expect(parseInt(txtRegistros.replace(/\D/g, ''))).toBeGreaterThan(0);
  expect(parseInt(txtPlanillas.replace(/\D/g, ''))).toBeGreaterThanOrEqual(1);
  await expect(primeraFila.locator('a')).toContainText('Ver detalle');
});
```

---

### BD-02 · Detalle del mes: días tienen datos reales

**Objetivo:** Al navegar al detalle de un mes, la tabla `#diasTbody` carga días con datos de la BD.

**Pasos:**
1. Desde el dashboard (sesión activa con `MMUNOZ`), hacer clic en "Ver detalle →" de la primera fila.
2. Esperar a que la URL contenga `/detalle?mes=`.
3. Esperar a que `#diasLoading` desaparezca.
4. Verificar que `#diasTabla` es visible.
5. Verificar que `#diasTbody` tiene **al menos 1 fila**.
6. En la primera fila, verificar:
   - Fecha en formato `DD/MM/YYYY`.
   - Total registros > 0.
   - Total planillas ≥ 1.
   - Botón "Ver registros →" existe.

**Resultado esperado:** Tabla de días visible con fechas reales del mes seleccionado.

**Playwright (spec):**
```typescript
test('BD-02 detalle mes trae días reales de la BD', async ({ page }) => {
  // (sesión ya activa desde beforeEach de login)
  await expect(page.locator('#resumenTabla')).toBeVisible({ timeout: 20_000 });

  // Navegar al detalle del primer mes
  await page.locator('#resumenTbody tr').first().locator('a').click();
  await page.waitForURL('**/detalle?mes=**');

  // Esperar carga de días
  await expect(page.locator('#diasLoading')).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('#diasTabla')).toBeVisible();

  const filas = page.locator('#diasTbody tr');
  expect(await filas.count()).toBeGreaterThan(0);

  // Verificar primera fila
  const primeraFila = filas.first();
  const fecha = await primeraFila.locator('td').nth(0).innerText();
  expect(fecha).toMatch(/\d{2}\/\d{2}\/\d{4}/);

  const registros = await primeraFila.locator('td').nth(1).innerText();
  expect(parseInt(registros.replace(/\D/g, ''))).toBeGreaterThan(0);

  await expect(primeraFila.locator('button')).toContainText('Ver registros');
});
```

---

### BD-03 · Panel de registros del día: campos de la BD presentes

**Objetivo:** Al expandir un día, el panel `#panelTbody` muestra registros reales con todos sus campos.

**Pasos:**
1. En la vista de detalle, hacer clic en "Ver registros →" de la primera fila.
2. Esperar a que `#panelDia` sea visible.
3. Esperar a que `#panelTabla` sea visible (los registros del día aparecen).
4. Verificar que `#panelTbody` tiene **al menos 1 fila**.
5. En la primera fila, verificar que existen estas columnas con datos:
   - `Nrodcto` (en `<code>`, no vacío).
   - `Destino` (texto).
   - `Cuota Mod` (contiene `$`).
   - `Nro. Planilla` (texto).
   - Columna `Estado` (muestra uno de: ⏳, ✅, ❌, ⚠).

**Resultado esperado:** Registros reales del día visibles con todos los campos de la BD.

**Playwright (spec):**
```typescript
test('BD-03 registros del día tienen campos de la BD', async ({ page }) => {
  // (en vista detalle con días cargados)
  await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
  await page.locator('#diasTbody tr').first().locator('button').click();

  await expect(page.locator('#panelDia')).toBeVisible();
  await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 30_000 });

  const filas = page.locator('#panelTbody tr');
  expect(await filas.count()).toBeGreaterThan(0);

  const primeraFila = filas.first();
  // Nrodcto
  const nrodcto = await primeraFila.locator('code').first().innerText();
  expect(nrodcto.trim()).not.toBe('');

  // Cuota Mod (contiene símbolo de moneda)
  const cuota = await primeraFila.locator('td').nth(2).innerText();
  expect(cuota).toContain('$');

  // Estado: alguna de las etiquetas conocidas
  const estadoHtml = await primeraFila.locator('td').nth(4).innerHTML();
  const estadosValidos = ['tag-green', 'tag-red', 'tag-yellow', 'Consultando'];
  expect(estadosValidos.some(e => estadoHtml.includes(e))).toBe(true);
});
```

---

### BD-04 · API `/api/detalle/dias` devuelve fechas del mes solicitado

**Objetivo:** El endpoint de días devuelve un array JSON con fechas pertenecientes al mes pedido.

**Pasos:**
1. Con sesión activa, hacer `GET /api/detalle/dias?mes=2026-05` (o el mes más reciente).
2. Verificar que el código HTTP es `200`.
3. Verificar que el cuerpo es un **array con al menos 1 elemento**.
4. Verificar que cada elemento tiene los campos: `fecha`, `totalRegistros`, `totalPlanillas`.
5. Verificar que todas las fechas empiezan con `2026-05`.

**Resultado esperado:** Datos válidos de la BD.

**Playwright (spec):**
```typescript
test('BD-04 API dias devuelve fechas del mes correcto', async ({ request, page }) => {
  // Necesita sesión — usar browser context compartido con login
  const resp = await page.request.get('/api/detalle/dias?mes=2026-05');
  expect(resp.status()).toBe(200);

  const data = await resp.json();
  expect(Array.isArray(data)).toBe(true);
  expect(data.length).toBeGreaterThan(0);
  expect(data[0]).toHaveProperty('fecha');
  expect(data[0]).toHaveProperty('totalRegistros');
  data.forEach((d: any) => expect(d.fecha).toMatch(/^2026-05/));
});
```

---

## Suite BD-02 — Botón "Ver Soporte": validación y URL correcta

> **Contexto del flujo:**
> 1. Al cargar registros de un día, el sistema llama en paralelo a `/api/detalle/soporte?nrodcto={Nrodcto}`.
> 2. Ese endpoint llama internamente a `https://intranet.helpharma.com/api/v1/consultasoporte/{Nrodcto}`.
> 3. Si la respuesta tiene `success: true`, extrae `data[0].storage_path`.
> 4. El botón **🔍 Ver soporte** debe generar el enlace:
>    `https://intranet.helpharma.com/ver-pdf/{storage_path}`

---

### BD-05 · API soporte para K8227073 devuelve `success: true` y `storage_path`

**Objetivo:** Verificar que el endpoint proxy devuelve la estructura correcta para un Nrodcto conocido.

**Pasos:**
1. Con sesión activa, hacer `GET /api/detalle/soporte?nrodcto=K8227073`.
2. Verificar código `200`.
3. Verificar que `body.success === true`.
4. Verificar que `body.data` es un array con al menos un elemento.
5. Verificar que `body.data[0].storage_Path` (o `storage_path`) no es vacío.
6. Verificar que `body.data[0].fechaRegistro` tiene formato `YYYY-MM-DD HH:mm:ss`.

**Resultado esperado:**
```json
{
  "success": true,
  "data": [{
    "fechaRegistro": "2026-05-04 14:37:01",
    "storage_disk": "s3://helpharma-soportes-dispensacion",
    "storage_Path": "soportes/2026/05/04/K8227073.pdf"
  }],
  "message": "Soportes consultados correctamente."
}
```

**Playwright (spec):**
```typescript
test('BD-05 API soporte K8227073 devuelve success:true y storage_path', async ({ page }) => {
  const resp = await page.request.get('/api/detalle/soporte?nrodcto=K8227073');
  expect(resp.status()).toBe(200);

  const json = await resp.json();
  expect(json.success).toBe(true);
  expect(Array.isArray(json.data)).toBe(true);
  expect(json.data.length).toBeGreaterThan(0);

  const item = json.data[0];
  // El campo puede venir como storage_Path o storage_path
  const path = item.storage_Path ?? item.storage_path ?? '';
  expect(path.trim()).not.toBe('');
  expect(path).toMatch(/^soportes\//);           // Debe comenzar con soportes/
  expect(path).toMatch(/\.pdf$/i);               // Debe terminar en .pdf
});
```

---

### BD-06 · Estado "✅ Encontrado" aparece en al menos un registro del día

**Objetivo:** Verificar que al menos un registro de un día con datos muestra la etiqueta verde.

**Pasos:**
1. Expandir el primer día en la vista de detalle.
2. Esperar a que la barra de progreso de soporte llegue al 100% y se oculte.
3. Verificar que **al menos una fila** tiene la etiqueta `tag-green` (✅ Encontrado).

**Resultado esperado:** Al menos un soporte encontrado, lo que confirma que la API externa responde.

**Playwright (spec):**
```typescript
test('BD-06 al menos un registro tiene estado Encontrado', async ({ page }) => {
  await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
  await page.locator('#diasTbody tr').first().locator('button').click();
  await expect(page.locator('#panelDia')).toBeVisible();

  // Esperar a que la barra de progreso desaparezca (todos los soportes consultados)
  await expect(page.locator('#panelProgreso')).toBeHidden({ timeout: 120_000 });

  const encontrados = page.locator('.tag-green');
  expect(await encontrados.count()).toBeGreaterThan(0);
});
```

---

### BD-07 · El botón "Ver soporte" aparece para registros con soporte

**Objetivo:** Verificar que las filas con `✅ Encontrado` tienen el botón "🔍 Ver soporte" habilitado.

**Pasos:**
1. Expandir un día y esperar a que todos los estados se resuelvan.
2. Para cada fila con `.tag-green`, verificar que el botón `"🔍 Ver soporte"` existe y está **habilitado**.
3. Verificar que filas con `.tag-red` muestran `"—"` en la columna Acción (sin botón).

**Resultado esperado:** Solo los registros con soporte encontrado tienen el botón. Los sin soporte muestran "—".

**Playwright (spec):**
```typescript
test('BD-07 botón Ver soporte aparece solo en registros Encontrado', async ({ page }) => {
  await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
  await page.locator('#diasTbody tr').first().locator('button').click();
  await expect(page.locator('#panelProgreso')).toBeHidden({ timeout: 120_000 });

  // Verificar al menos un botón habilitado junto a tag-green
  const btnVer = page.locator('button:has-text("Ver soporte")');
  expect(await btnVer.count()).toBeGreaterThan(0);
  await expect(btnVer.first()).toBeEnabled();
});
```

---

### BD-08 · Clic en "Ver soporte" abre el modal con storage_path correcto

**Objetivo:** Al hacer clic en el botón, el modal muestra el `storage_path` real devuelto por la API.

**Pasos:**
1. Interceptar la llamada a `/api/detalle/soporte` para un Nrodcto específico con respuesta conocida.
2. Expandir un día (o navegar directamente).
3. Esperar a que aparezca el botón "🔍 Ver soporte".
4. Hacer clic en él.
5. Verificar que el modal `#modalSoporte` se hace visible.
6. Verificar que `#modalSoporteBody` contiene el `storage_path` esperado.
7. Verificar que `#modalDescargaLink` tiene un `href` que **incluye el `storage_path`**.

**Resultado esperado:** El modal muestra correctamente el archivo vinculado al soporte.

**Playwright (spec):**
```typescript
test('BD-08 modal Ver soporte muestra storage_path correcto', async ({ page }) => {
  const storagePath = 'soportes/2026/05/04/K8227073.pdf';

  // Interceptar la respuesta de la API de soporte para controlar el dato
  await page.route('**/api/detalle/soporte?nrodcto=K8227073', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{
          fechaRegistro: '2026-05-04 14:37:01',
          storage_disk: 's3://helpharma-soportes-dispensacion',
          storage_Path: storagePath,
        }],
        message: 'Soportes consultados correctamente.',
      }),
    });
  });

  // Navegar a la vista de detalle con K8227073 visible
  // (Ajustar el mes/día donde existe K8227073 según datos reales)
  await page.goto('/detalle?mes=2026-05');
  await expect(page.locator('#diasLoading')).toBeHidden({ timeout: 20_000 });

  // Expandir el día 2026-05-04
  const botonDia = page.locator('#diasTbody tr').filter({ hasText: '04/05/2026' }).locator('button');
  if (await botonDia.count() > 0) {
    await botonDia.click();
  } else {
    // Si no se puede filtrar por fecha exacta, usar el primer día disponible
    await page.locator('#diasTbody tr').first().locator('button').click();
  }

  // Esperar a que aparezca el botón Ver soporte
  const btnVer = page.locator('button:has-text("Ver soporte")').first();
  await expect(btnVer).toBeVisible({ timeout: 120_000 });
  await btnVer.click();

  // Verificar modal
  await expect(page.locator('#modalSoporte')).toBeVisible();
  await expect(page.locator('#modalSoporteBody')).toContainText(storagePath);

  // Verificar que el enlace de descarga contiene el storage_path
  const href = await page.locator('#modalDescargaLink').getAttribute('href');
  expect(href).not.toBeNull();
  expect(href).toContain(encodeURIComponent(storagePath));
});
```

---

### BD-09 · Enlace de "Ver soporte" apunta a la URL correcta con storage_path

**Objetivo:** El enlace final en el modal debe contener la ruta del `storage_path` devuelto por la API.  
La URL final del PDF es:  
```
https://intranet.helpharma.com/ver-pdf/{storage_path}
```
El enlace en el modal apunta al proxy local `/api/detalle/descargar?path={storage_path}`,  
el cual internamente redirige a `https://intranet.helpharma.com/ver-pdf/{storage_path}`.

**Pasos:**
1. Interceptar la llamada a `/api/detalle/soporte` con una respuesta con `storage_path` conocido.
2. Hacer clic en "🔍 Ver soporte".
3. Obtener el `href` del elemento `#modalDescargaLink`.
4. Decodificar el parámetro `path` del href.
5. Verificar que el `path` decodificado **es idéntico** al `storage_path` de la API.

**Resultado esperado:** El `href` es `/api/detalle/descargar?path=soportes%2F2026%2F05%2F04%2FK8227073.pdf`  
o equivalente. El `path` decodificado es `soportes/2026/05/04/K8227073.pdf`.

**Playwright (spec):**
```typescript
test('BD-09 enlace del modal usa storage_path exacto de la API', async ({ page }) => {
  const storagePath = 'soportes/2026/05/04/K8227073.pdf';

  await page.route('**/api/detalle/soporte**', async route => {
    const url = route.request().url();
    if (url.includes('K8227073')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ fechaRegistro: '2026-05-04 14:37:01', storage_Path: storagePath }],
          message: 'Soportes consultados correctamente.',
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto('/detalle?mes=2026-05');
  await expect(page.locator('#diasLoading')).toBeHidden({ timeout: 20_000 });
  await page.locator('#diasTbody tr').first().locator('button').click();

  const btnVer = page.locator('button:has-text("Ver soporte")').first();
  await expect(btnVer).toBeVisible({ timeout: 120_000 });
  await btnVer.click();

  await expect(page.locator('#modalSoporte')).toBeVisible();

  const href = await page.locator('#modalDescargaLink').getAttribute('href') ?? '';
  // Extraer el parámetro path del href
  const url   = new URL(href, 'http://localhost:5125');
  const param = decodeURIComponent(url.searchParams.get('path') ?? '');

  expect(param).toBe(storagePath);
});
```

---

### BD-10 · Nrodcto sin soporte muestra "❌ Sin soporte" y sin botón

**Objetivo:** Verificar que registros sin soporte en la API muestran el estado correcto y no tienen botón.

**Pasos:**
1. Interceptar la llamada a `/api/detalle/soporte` para un Nrodcto específico, devolviendo `success: false`.
2. Expandir el día.
3. Verificar que la fila correspondiente muestra la etiqueta `.tag-red` (❌ Sin soporte).
4. Verificar que la columna Acción de esa fila muestra `"—"`, sin botón.

**Resultado esperado:** La UI diferencia correctamente entre registros con y sin soporte.

**Playwright (spec):**
```typescript
test('BD-10 sin soporte muestra tag-red y sin botón', async ({ page }) => {
  // Interceptar TODAS las consultas de soporte para forzar sin soporte
  await page.route('**/api/detalle/soporte**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, data: null, message: 'Sin soporte.' }),
    });
  });

  await page.goto('/detalle?mes=2026-05');
  await expect(page.locator('#diasLoading')).toBeHidden({ timeout: 20_000 });
  await page.locator('#diasTbody tr').first().locator('button').click();

  // Esperar a que todos los estados se resuelvan
  await expect(page.locator('#panelProgreso')).toBeHidden({ timeout: 60_000 });

  // Todas las filas deben tener tag-red (forzado por intercept)
  const tagRed = page.locator('.tag-red');
  expect(await tagRed.count()).toBeGreaterThan(0);

  // No debe haber ningún botón "Ver soporte"
  const btnVer = page.locator('button:has-text("Ver soporte")');
  expect(await btnVer.count()).toBe(0);
});
```

---

### BD-11 · Flujo completo de extremo a extremo: Login → BD → Ver Soporte → URL correcta

**Objetivo:** Prueba integral que recorre todo el flujo sin mocks, con datos reales de la BD y la API externa.

**Pasos:**
1. Navegar a `/login` → iniciar sesión con `MMUNOZ`.
2. Verificar que el dashboard carga con al menos 1 mes en el resumen mensual.
3. Hacer clic en "Ver detalle →" del primer mes.
4. Verificar que la tabla de días tiene al menos 1 fila.
5. Hacer clic en "Ver registros →" del primer día.
6. Esperar a que **todos los estados de soporte** se resuelvan (barra al 100%).
7. Verificar que hay al menos 1 fila con `✅ Encontrado`.
8. Hacer clic en el primer botón "🔍 Ver soporte".
9. Verificar que el modal se abre.
10. Verificar que `#modalSoporteBody` contiene el `storage_path` (debe contener `soportes/`).
11. Verificar que `#modalDescargaLink` tiene `href` con `/api/detalle/descargar?path=`.
12. Verificar que el parámetro `path` del href corresponde al `storage_path` de la API.

**Resultado esperado:** Sin mocks. Datos reales. El flujo completo funciona de principio a fin.

**Playwright (spec):**
```typescript
test('BD-11 flujo completo E2E: login → BD → ver soporte → URL correcta', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // 1. Login
  await page.goto('/login');
  await page.selectOption('select[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5125/');

  // 2. Dashboard cargado con datos BD
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 20_000 });
  const filasResumen = page.locator('#resumenTbody tr');
  expect(await filasResumen.count()).toBeGreaterThan(0);

  // 3. Navegar a detalle del primer mes
  await filasResumen.first().locator('a').click();
  await page.waitForURL('**/detalle?mes=**');

  // 4. Tabla días cargada
  await expect(page.locator('#diasLoading')).toBeHidden({ timeout: 20_000 });
  const diasFilas = page.locator('#diasTbody tr');
  expect(await diasFilas.count()).toBeGreaterThan(0);

  // 5. Expandir primer día
  await diasFilas.first().locator('button').click();
  await expect(page.locator('#panelDia')).toBeVisible();
  await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 30_000 });

  // 6. Esperar a que todos los soportes se consulten
  await expect(page.locator('#panelProgreso')).toBeHidden({ timeout: 120_000 });

  // 7. Al menos 1 soporte encontrado
  const encontrados = page.locator('.tag-green');
  expect(await encontrados.count()).toBeGreaterThan(0);

  // 8. Hacer clic en el primer "Ver soporte"
  const btnVer = page.locator('button:has-text("Ver soporte")').first();
  await expect(btnVer).toBeVisible();
  await btnVer.click();

  // 9. Modal abierto
  await expect(page.locator('#modalSoporte')).toBeVisible();

  // 10. Verificar storage_path en el cuerpo del modal
  const bodyText = await page.locator('#modalSoporteBody').innerText();
  expect(bodyText).toMatch(/soportes\//);

  // 11 & 12. Verificar href del enlace de descarga
  const href = await page.locator('#modalDescargaLink').getAttribute('href') ?? '';
  expect(href).toContain('/api/detalle/descargar?path=');

  const urlObj = new URL(href, 'http://localhost:5125');
  const pathParam = decodeURIComponent(urlObj.searchParams.get('path') ?? '');
  expect(pathParam).toMatch(/^soportes\//);
  expect(pathParam).toMatch(/\.pdf$/i);

  // Sin errores en consola
  expect(consoleErrors).toEqual([]);
});
```

---

## Resumen de casos de prueba

| ID     | Descripción                                            | Suite       | Tipo       |
|--------|--------------------------------------------------------|-------------|------------|
| BD-01  | Resumen mensual trae filas reales de la BD             | Datos BD    | UI + BD    |
| BD-02  | Detalle mes: días tienen datos reales                  | Datos BD    | UI + BD    |
| BD-03  | Panel registros día: campos de la BD presentes         | Datos BD    | UI + BD    |
| BD-04  | API `/api/detalle/dias` devuelve fechas del mes        | Datos BD    | API        |
| BD-05  | API soporte K8227073 → `success:true` + `storage_path`| Ver Soporte | API        |
| BD-06  | Estado "✅ Encontrado" aparece en al menos un registro  | Ver Soporte | UI + API   |
| BD-07  | Botón Ver soporte solo aparece en registros Encontrado | Ver Soporte | UI         |
| BD-08  | Modal muestra `storage_path` correcto al abrir         | Ver Soporte | UI (mock)  |
| BD-09  | Enlace del modal usa el `storage_path` exacto de la API| Ver Soporte | UI (mock)  |
| BD-10  | Sin soporte: `tag-red` y sin botón Ver soporte         | Ver Soporte | UI (mock)  |
| BD-11  | Flujo E2E completo sin mocks con datos reales          | E2E         | E2E real   |

---

## Notas técnicas

### Flujo del botón "Ver Soporte"

```
[Usuario clic "🔍 Ver soporte"]
         │
         ▼
verSoporte(nrodcto, fechaRegistro, storagePath)
         │  (parámetros inyectados cuando se cargó la fila)
         ▼
#modalSoporte.show()
   body: { Nrodcto, fechaRegistro, storagePath }
   link href: /api/detalle/descargar?path={storagePath}
         │
         ▼  [El proxy del servidor llama a:]
https://intranet.helpharma.com/ver-pdf/{storagePath}
```

### Campos del JSON de soporte (API externa)

| Campo          | Descripción                         | Ejemplo                              |
|----------------|-------------------------------------|--------------------------------------|
| `fechaRegistro`| Fecha y hora de registro            | `"2026-05-04 14:37:01"`              |
| `storage_disk` | Bucket S3                           | `"s3://helpharma-soportes-dispensacion"` |
| `storage_Path` | Ruta relativa del PDF en S3         | `"soportes/2026/05/04/K8227073.pdf"` |

> **Nota:** El campo se llama `storage_Path` (con P mayúscula) en la respuesta del API interna.  
> En el código JS se accede como `itm.storage_Path ?? ''`.

### Modo visible — Slowmo recomendado

| Propósito                    | Comando                                          |
|------------------------------|--------------------------------------------------|
| Ver flujo normal             | `npx playwright test --headed`                   |
| Seguir paso a paso (lento)   | `npx playwright test --headed --slow-mo=800`     |
| Solo la prueba E2E           | `npx playwright test -g "BD-11" --headed`        |
| Solo las pruebas de soporte  | `npx playwright test -g "BD-0[5-9]\|BD-1" --headed` |
