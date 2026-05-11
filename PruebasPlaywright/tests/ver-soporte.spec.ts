/**
 * Plan de pruebas: Botón "Ver soporte" y descarga de PDF — Página Detalle
 *
 * Flujo esperado:
 *   1. El panel de un día carga los registros y consulta /api/detalle/soporte por cada nrodcto.
 *   2. Si hay soporte, aparece el botón "🔍 Ver soporte".
 *   3. Al hacer click, se abre el modal #modalSoporte con info del documento.
 *   4. El modal muestra un link "⬇ Descargar PDF" que apunta a /api/detalle/descargar?path=...
 *   5. El endpoint proxy descarga el PDF desde https://intranet.helpharma.com/ver-pdf/{storage_path}.
 *
 * Casos:
 *   VS-01  API: /api/detalle/soporte devuelve success:true y storage_Path no vacío (API real)
 *   VS-02  API: /api/detalle/descargar retorna HTTP 200 y content-type application/pdf (API real)
 *   VS-03  UI:  Botón "Ver soporte" aparece en la tabla de registros (mock)
 *   VS-04  UI:  Al hacer click, el modal #modalSoporte se abre (mock)
 *   VS-05  UI:  El link de descarga en el modal apunta a /api/detalle/descargar?path=... (mock)
 *   VS-06  UI:  El link de descarga NO tiene la clase "disabled" (mock)
 *   VS-07  E2E: El endpoint de descarga retorna un PDF válido con storage_path conocido (mock UI + real descarga)
 *
 * Nota sobre mocks (VS-03..VS-07):
 *   Las pruebas de UI mockean /api/detalle/registros, /api/detalle/soporte y /api/detalle/dias
 *   para evitar dependencia del número de registros reales y de la latencia de la API externa
 *   (~10s por llamada). VS-01 y VS-02 ya validan la API real de extremo a extremo.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Constantes ────────────────────────────────────────────────────────────────
const FECHA_CON_DATOS = '2026-05-05';
// Nrodcto con soporte confirmado (verificado en VS-01).
const NRODCTO_EJEMPLO = 'K8227073';
// storage_path real confirmado por VS-01 en ejecución previa.
const STORAGE_PATH_REAL = 'soportes/2026/05/04/K8227073.pdf';

// ── Respuestas mock ───────────────────────────────────────────────────────────
const MOCK_DIAS = JSON.stringify([
  { fecha: FECHA_CON_DATOS, totalRegistros: 1, totalPlanillas: 1 },
]);

const MOCK_REGISTROS = JSON.stringify({
  total: 1,
  registros: [
    { nrodcto: NRODCTO_EJEMPLO, destino: 'Destino Test', cuotaMod: 50000, nroPlanilla: 'P001', mensajero: 'MMUNOZ' },
  ],
  nrodctos: [NRODCTO_EJEMPLO],
});

const MOCK_SOPORTE = JSON.stringify({
  success: true,
  message: 'Soportes consultados correctamente.',
  data: [
    {
      fechaRegistro: '2026-05-04 14:37:01',
      storage_Disk: 's3://helpharma-soportes-dispensacion',
      storage_Path: STORAGE_PATH_REAL,
    },
  ],
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function loginComoMMUNOZ(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL(/localhost.*\/$/);
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 20_000 });
}

/**
 * Intercepta /api/detalle/dias, /api/detalle/registros y /api/detalle/soporte
 * con respuestas instantáneas para que las pruebas de UI no dependan
 * del número de registros reales ni de la latencia de la API externa.
 */
async function mockDetalleEndpoints(page: Page): Promise<void> {
  await page.route(/\/api\/detalle\/dias/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: MOCK_DIAS })
  );
  await page.route(/\/api\/detalle\/registros/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: MOCK_REGISTROS })
  );
  await page.route(/\/api\/detalle\/soporte/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: MOCK_SOPORTE })
  );
}

/**
 * Navega a la página de detalle, espera que cargue la tabla de días
 * y hace click en el botón "Ver registros →" del día indicado.
 */
async function abrirPanelDia(page: Page, fecha: string): Promise<void> {
  const mes = fecha.substring(0, 7);
  await page.goto(`/detalle?mes=${mes}`);
  await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
  // El row del día tiene id="fila-{fecha}" generado por detalle.js
  await page.locator(`#fila-${fecha} button`).click();
  await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 20_000 });
}

/**
 * Espera a que la barra de progreso de soporte se oculte y luego
 * hace click en el primer botón "Ver soporte" visible.
 */
async function abrirModalSoporte(page: Page): Promise<void> {
  // Con 1 registro mockeado, la barra desaparece en < 2s
  await expect(page.locator('#panelProgreso')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#modalSoporte')).toBeHidden();
  await page.locator('button:has-text("Ver soporte")').first().click();
  await expect(page.locator('#modalSoporte')).toBeVisible({ timeout: 5_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
test.describe('VS — Detalle: Botón Ver Soporte y Descarga de PDF', () => {

  // ── VS-01: La API proxy devuelve el storage_Path del soporte ───────────────
  // (API real — sin mock)
  test('VS-01 /api/detalle/soporte retorna success:true y storage_Path no vacío', async ({ page }) => {
    await loginComoMMUNOZ(page);

    const resp = await page.request.get(`/api/detalle/soporte?nrodcto=${NRODCTO_EJEMPLO}`);

    expect(resp.status(), 'El endpoint debe retornar HTTP 200').toBe(200);

    const body = await resp.json();
    console.log('Respuesta soporte completa:', JSON.stringify(body));

    expect(body.success, 'success debe ser true').toBe(true);
    expect(body.data, 'data no debe ser null').not.toBeNull();
    expect(body.data.length, 'data debe tener al menos 1 item').toBeGreaterThan(0);

    const item = body.data[0];
    // El controller serializa Storage_Path (C#) como "storage_Path" (camelCase).
    console.log('Claves del item recibido:', Object.keys(item));
    console.log('storage_Path:', item.storage_Path);

    expect(item.storage_Path, 'storage_Path debe tener valor no vacío').toBeTruthy();
  });

  // ── VS-02: El proxy de descarga retorna un PDF ─────────────────────────────
  // (API real — sin mock)
  test('VS-02 /api/detalle/descargar retorna HTTP 200 y content-type application/pdf', async ({ page }) => {
    await loginComoMMUNOZ(page);

    // Paso 1: obtener el storage_path real desde la API de soporte
    const soporteResp = await page.request.get(`/api/detalle/soporte?nrodcto=${NRODCTO_EJEMPLO}`);
    const soporteBody = await soporteResp.json();

    const storagePath: string | undefined = soporteBody?.data?.[0]?.storage_Path;
    if (!soporteBody.success || !storagePath) {
      test.skip(true, `VS-01 falló o "${NRODCTO_EJEMPLO}" no tiene soporte — revisar VS-01 primero`);
      return;
    }

    console.log('Descargando storage_Path:', storagePath);

    // Paso 2: llamar al proxy de descarga (encodeURIComponent como lo hace el JS del frontend)
    const descResp = await page.request.get(
      `/api/detalle/descargar?path=${encodeURIComponent(storagePath)}`
    );

    console.log('HTTP status descarga:', descResp.status());
    console.log('Content-Type descarga:', descResp.headers()['content-type']);

    expect(descResp.status(), 'El proxy debe retornar HTTP 200').toBe(200);
    expect(descResp.headers()['content-type'], 'Content-Type debe ser application/pdf')
      .toContain('application/pdf');
  });

  // ── VS-03..VS-07: pruebas de UI con mock ──────────────────────────────────
  // Los endpoints de detalle son interceptados; solo /api/detalle/descargar usa la red real.

  test('VS-03 UI al menos un botón "Ver soporte" aparece en la tabla de registros', async ({ page }) => {
    await mockDetalleEndpoints(page);
    await loginComoMMUNOZ(page);
    await abrirPanelDia(page, FECHA_CON_DATOS);

    await expect(page.locator('#panelProgreso')).toBeHidden({ timeout: 15_000 });

    const botones = page.locator('button:has-text("Ver soporte")');
    const cantidad = await botones.count();
    console.log(`Botones "Ver soporte" encontrados: ${cantidad}`);

    expect(cantidad, 'Debe haber al menos 1 botón "Ver soporte" en la tabla').toBeGreaterThan(0);
  });

  test('VS-04 UI al hacer click en "Ver soporte" el modal #modalSoporte se abre', async ({ page }) => {
    await mockDetalleEndpoints(page);
    await loginComoMMUNOZ(page);
    await abrirPanelDia(page, FECHA_CON_DATOS);
    await abrirModalSoporte(page);

    const bodyText = await page.locator('#modalSoporteBody').textContent();
    console.log('Contenido del modal:', bodyText);
    expect(bodyText, 'El modal body debe tener contenido').toBeTruthy();
  });

  test('VS-05 UI el link de descarga apunta a /api/detalle/descargar?path=...', async ({ page }) => {
    await mockDetalleEndpoints(page);
    await loginComoMMUNOZ(page);
    await abrirPanelDia(page, FECHA_CON_DATOS);
    await abrirModalSoporte(page);

    const href = await page.locator('#modalDescargaLink').getAttribute('href');
    console.log('href del link de descarga:', href);

    expect(href, 'href debe contener /api/detalle/descargar?path=').toContain('/api/detalle/descargar?path=');
    expect(href, 'href no debe ser solo "#" (storagePath vacío)').not.toBe('#');
  });

  test('VS-06 UI el link de descarga no tiene clase "disabled"', async ({ page }) => {
    await mockDetalleEndpoints(page);
    await loginComoMMUNOZ(page);
    await abrirPanelDia(page, FECHA_CON_DATOS);
    await abrirModalSoporte(page);

    await expect(
      page.locator('#modalDescargaLink'),
      'El link NO debe tener la clase "disabled" (storage_Path no debe estar vacío)'
    ).not.toHaveClass(/disabled/);
  });

  test('VS-07 E2E el endpoint de descarga retorna un PDF válido desde el href del modal', async ({ page }) => {
    await mockDetalleEndpoints(page);
    await loginComoMMUNOZ(page);
    await abrirPanelDia(page, FECHA_CON_DATOS);
    await abrirModalSoporte(page);

    // El href contiene el storage_path del mock (= STORAGE_PATH_REAL confirmado en VS-01)
    const href = await page.locator('#modalDescargaLink').getAttribute('href');
    expect(href, 'El href debe estar definido').toBeTruthy();

    // /api/detalle/descargar NO está mockeado — llama a la red real
    const descResp = await page.request.get(href!);

    console.log('VS-07 HTTP status:', descResp.status());
    console.log('VS-07 Content-Type:', descResp.headers()['content-type']);

    expect(descResp.status(), 'El endpoint de descarga debe retornar HTTP 200').toBe(200);
    expect(descResp.headers()['content-type'], 'La respuesta debe ser un PDF')
      .toContain('application/pdf');
  });
});
