/**
 * detalle-documentos.spec.ts
 * Prueba funcional — Tabla de registros en Detalle, barra de progreso,
 * descarga total y descarga por prefijo.
 *
 * Ejecutar:
 *   npx playwright test tests/detalle-documentos.spec.ts --headed
 *
 * Usa datos REALES del día 2026-05-11 (usuario MMUNOZ).
 * DT-01 a DT-03: tests rápidos (no esperan fin del batch).
 * DT-04 a DT-08: comparten una sola sesión donde el batch se espera
 *                UNA SOLA VEZ en beforeAll — evita repetir los ~5 min.
 */

import { test, expect, type Page, type BrowserContext, type Browser } from '@playwright/test';

// ── Constantes ────────────────────────────────────────────────────────────────
const FECHA_DIA  = '2026-05-11';
const MES        = '2026-05';
const PREFIJO_KI = 'Ki';
const BASE_URL   = 'http://localhost:5125';

// ── Helper: login ─────────────────────────────────────────────────────────────
async function loginComoMMUNOZ(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL(/localhost.*\/$/);
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 20_000 });
}

// ── Helper: navegar a Detalle mes ─────────────────────────────────────────────
async function irADetalleMes(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/detalle?mes=${MES}`);
  await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
}

// ──────────────────────────────────────────────────────────────────────────────
// SUITE A: Tests rápidos (DT-01 a DT-03) — no esperan fin del batch
// ──────────────────────────────────────────────────────────────────────────────
test.describe('DT — Detalle: días, progreso y tabla', () => {
  test.use({ baseURL: BASE_URL });

  test.beforeEach(async ({ page }) => {
    await loginComoMMUNOZ(page);
    await irADetalleMes(page);
  });

  // ── DT-01: El día 11-05-2026 aparece en la tabla ──────────────────────────
  test('DT-01 La tabla de días lista el día 11-05-2026', async ({ page }) => {
    const filaDia = page.locator(`#fila-${FECHA_DIA}`);
    await expect(filaDia, `La fila para ${FECHA_DIA} debe existir`).toBeVisible();
    const totalCell = filaDia.locator('td').nth(1);
    const total = parseInt((await totalCell.textContent())?.trim() ?? '0', 10);
    expect(total, 'El día debe tener al menos 1 registro').toBeGreaterThan(0);
    console.log(`DT-01 → Día ${FECHA_DIA}: ${total} registros`);
  });

  // ── DT-02: Al abrir el día, la barra de progreso aparece ─────────────────
  test('DT-02 La barra de progreso aparece al abrir el panel del día', async ({ page }) => {
    await page.locator(`#fila-${FECHA_DIA} button`).click();
    await expect(page.locator('#panelDia'), 'El panel del día debe abrirse').toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#panelProgreso'), 'La barra de progreso debe ser visible').toBeVisible({ timeout: 10_000 });
    const contador = page.locator('#panelProgContador');
    await expect(contador).not.toBeEmpty({ timeout: 5_000 });
    console.log(`DT-02 → Progreso: ${await contador.textContent()}`);
  });

  // ── DT-03: La tabla muestra filas mientras el batch procesa ──────────────
  test('DT-03 La tabla de registros muestra documentos consultados', async ({ page }) => {
    await page.locator(`#fila-${FECHA_DIA} button`).click();
    await expect(page.locator('#panelTabla'), 'La tabla del panel debe ser visible').toBeVisible({ timeout: 10_000 });
    const tbody = page.locator('#panelTbody');
    await expect(tbody, 'El tbody debe tener al menos una fila').not.toBeEmpty({ timeout: 15_000 });
    const filas = await tbody.locator('tr').count();
    expect(filas, 'Debe haber al menos 1 fila de registros').toBeGreaterThan(0);
    console.log(`DT-03 → Filas visibles en tabla: ${filas} (batch puede seguir en segundo plano)`);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SUITE B: Tests post-batch (DT-04 a DT-08) — comparten una sola sesión
// El beforeAll espera el batch UNA SOLA VEZ (hasta 10 min).
// ──────────────────────────────────────────────────────────────────────────────
test.describe('DT — Detalle: KPIs y descargas (post-batch)', () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(900_000);

  let sharedPage: Page;
  let sharedContext: BrowserContext;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    sharedContext = await browser.newContext({ ignoreHTTPSErrors: true });
    sharedPage = await sharedContext.newPage();

    await sharedPage.goto(`${BASE_URL}/login`);
    await sharedPage.fill('input[name="usuario"]', 'MMUNOZ');
    await sharedPage.click('button[type="submit"]');
    await sharedPage.waitForURL(/localhost.*\/$/);
    await expect(sharedPage.locator('#resumenLoading')).toBeHidden({ timeout: 20_000 });

    await sharedPage.goto(`${BASE_URL}/detalle?mes=${MES}`);
    await expect(sharedPage.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });

    await sharedPage.locator(`#fila-${FECHA_DIA} button`).click();
    await expect(sharedPage.locator('#panelTabla')).toBeVisible({ timeout: 10_000 });
    console.log('beforeAll → Esperando fin del batch (hasta 10 min)...');
    await expect(sharedPage.locator('#panelProgreso')).toBeHidden({ timeout: 600_000 });
    console.log('beforeAll → Batch completado. Página lista para tests DT-04 a DT-08.');
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  // ── DT-04: KPI panel visible con encontrados > 0 ─────────────────────────
  test('DT-04 KPIs visibles y botón "Descargar todos" habilitado', async () => {
    await expect(sharedPage.locator('#panelKpi'), 'El panel de KPIs debe ser visible').toBeVisible();
    const encontrados = parseInt((await sharedPage.locator('#kpiEncontrados').textContent()) ?? '0', 10);
    expect(encontrados, 'Debe haber al menos 1 documento encontrado').toBeGreaterThan(0);
    console.log(`DT-04 → Encontrados: ${encontrados}`);
    const btnTodos = sharedPage.locator('#btnDescargarTodos');
    await expect(btnTodos, '"Descargar todos" debe estar visible').toBeVisible();
    await expect(btnTodos, '"Descargar todos" debe estar habilitado').toBeEnabled();
  });

  // ── DT-05: Sección "Descargar por prefijo" existe y es visible ───────────
  test('DT-05 La sección de prefijo existe en la tarjeta ENCONTRADOS', async () => {
    await expect(sharedPage.locator('#inputPrefijo'), 'El campo de prefijo debe ser visible').toBeVisible();
    const btnPrefijo = sharedPage.locator('#btnDescargarPrefijo');
    await expect(btnPrefijo, 'El botón Prefijo debe ser visible').toBeVisible();
    await expect(btnPrefijo, 'El botón Prefijo debe estar habilitado').toBeEnabled();
    console.log('DT-05 → Sección prefijo visible y botón habilitado');
  });

  // ── DT-06: Descargar por prefijo "Ki" inicia descarga ZIP ────────────────
  test('DT-06 Descargar por prefijo "Ki" genera y descarga un ZIP', async () => {
    const tagEncontrado = sharedPage.locator('tr').filter({ hasText: 'KI483867' }).locator('.tag-green');
    if (await tagEncontrado.count() > 0) {
      console.log('DT-06 → KI483867 aparece como ✅ Encontrado');
    } else {
      console.log('DT-06 → KI483867 no está en la página actual del paginador');
    }

    await sharedPage.locator('#inputPrefijo').fill(PREFIJO_KI);
    console.log(`DT-06 → Prefijo ingresado: "${PREFIJO_KI}"`);

    const [download] = await Promise.all([
      sharedPage.waitForEvent('download', { timeout: 60_000 }),
      sharedPage.locator('#btnDescargarPrefijo').click(),
    ]);

    const filename = download.suggestedFilename();
    console.log(`DT-06 → Archivo descargado: "${filename}"`);
    expect(filename, 'El nombre debe contener el prefijo KI').toMatch(/KI/i);
    expect(filename, 'Debe ser un archivo .zip').toMatch(/\.zip$/);
    console.log('DT-06 → Descarga ZIP por prefijo "Ki" completada exitosamente');
  });

  // ── DT-07: Prefijo vacío muestra modal de validación ─────────────────────
  test('DT-07 Prefijo vacío muestra modal de validación', async () => {
    await sharedPage.locator('#inputPrefijo').fill('');
    await sharedPage.locator('#btnDescargarPrefijo').click();
    const modal = sharedPage.locator('#modalMensaje');
    await expect(modal, 'Debe abrirse un modal de validación').toBeVisible({ timeout: 5_000 });
    const titulo = await sharedPage.locator('#modalMensajeTitulo').textContent();
    console.log(`DT-07 → Modal de validación: "${titulo}"`);
    expect(titulo, 'El título debe indicar que el prefijo es requerido').toContain('Prefijo');
    // Cerrar modal para el siguiente test
    const btnCerrar = sharedPage.locator('#modalMensaje').getByRole('button').first();
    if (await btnCerrar.isVisible()) await btnCerrar.click();
  });

  // ── DT-08: Prefijo sin resultados muestra modal informativo ──────────────
  test('DT-08 Prefijo sin coincidencias muestra modal informativo', async () => {
    await sharedPage.locator('#inputPrefijo').fill('ZZZZZZZ');
    await sharedPage.locator('#btnDescargarPrefijo').click();
    const modal = sharedPage.locator('#modalMensaje');
    await expect(modal, 'Debe abrirse un modal de sin resultados').toBeVisible({ timeout: 5_000 });
    const titulo = await sharedPage.locator('#modalMensajeTitulo').textContent();
    console.log(`DT-08 → Modal sin resultados: "${titulo}"`);
    expect(titulo).toContain('Sin resultados');
  });
});
