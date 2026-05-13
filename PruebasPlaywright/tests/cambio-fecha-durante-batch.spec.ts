/**
 * cambio-fecha-durante-batch.spec.ts
 *
 * CB — Comportamiento de botones de fecha durante / después de un batch
 *
 * Valida el fix implementado:
 *   - Durante un batch activo los botones de otras fechas se deshabilitan
 *     (UX lock) para que el usuario no pueda lanzar un segundo batch.
 *   - Al terminar el batch los botones se re-habilitan.
 *   - El botón "Cerrar" cancela el batch en vuelo y re-habilita los botones.
 *   - Después de Cerrar se puede seleccionar otra fecha sin problemas.
 *
 * Tests:
 *   CB-01  Durante el batch, todos los otros botones de fecha están disabled.
 *   CB-02  Al terminar el batch los botones vuelven a habilitarse.
 *   CB-03  "Cerrar" cancela el batch y re-habilita los botones de inmediato.
 *   CB-04  Después de Cerrar se puede seleccionar otra fecha y su batch completa.
 */

import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL = 'http://localhost:5125';
const MES_MAYO = '2026-05';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL(/localhost.*\/$/);
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 20_000 });
}

async function irADetalleMayo(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/detalle?mes=${MES_MAYO}`);
  await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
}

/** Devuelve hasta `n` fechas disponibles en la tabla de días. */
async function fechasDisponibles(page: Page, n = 2): Promise<string[]> {
  const filas = page.locator('#diasTbody tr');
  const count = await filas.count();
  const result: string[] = [];
  for (let i = 0; i < Math.min(count, n); i++) {
    const id = await filas.nth(i).getAttribute('id');
    if (id) result.push(id.replace('fila-', ''));
  }
  return result;
}

/**
 * Instala un route handler que retarda artificialmente el PRIMER batch
 * para que esté activo en el momento de la verificación.
 * NOTA: response.headers() ya devuelve un objeto plano en Playwright.
 */
async function instalarDemoraEnBatchUnico(page: Page, delayMs = 5_000): Promise<void> {
  let intercepted = false;
  await page.route('**/api/detalle/soporte-batch-stream', async (route: Route) => {
    if (intercepted) {
      await route.continue();
      return;
    }
    intercepted = true;
    const response = await route.fetch();
    const body     = await response.text();
    const lines    = body.split('\n').filter(l => l.trim().length > 0);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.fulfill({
      status:  response.status(),
      headers: response.headers(),   // ya es objeto plano, NO usar Object.fromEntries
      body:    lines.join('\n'),
    });
  });
}

// ── Suite principal ───────────────────────────────────────────────────────────

test.describe('CB — Comportamiento de botones durante batch', () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await login(page);
    await irADetalleMayo(page);
  });

  // ── CB-01 ─────────────────────────────────────────────────────────────────
  test('CB-01 Durante el batch, los otros botones de fecha están deshabilitados', async ({ page }) => {
    const fechas = await fechasDisponibles(page, 3);
    expect(fechas.length, 'Se necesitan al menos 2 días en Mayo').toBeGreaterThanOrEqual(2);

    const [fecha1, fecha2] = fechas;
    console.log(`CB-01 → Fecha activa: ${fecha1}  |  Fecha a verificar: ${fecha2}`);

    // Instalar demora para que el batch siga activo mientras verificamos
    await instalarDemoraEnBatchUnico(page, 8_000);

    // Clic en fecha1 — inicia batch con demora artificial
    await page.locator(`#fila-${fecha1} button`).click();
    await expect(page.locator('#panelProgreso'), 'Barra de progreso debe aparecer').toBeVisible({ timeout: 15_000 });

    // Verificar que el botón de fecha2 está DESHABILITADO
    const boton2 = page.locator(`#fila-${fecha2} button`);
    await expect(boton2, 'Otros botones deben estar disabled durante el batch').toBeDisabled({ timeout: 5_000 });

    // Verificar que el botón activo muestra "⏳ Buscando…"
    const botonActivo = page.locator(`#fila-${fecha1} button`);
    await expect(botonActivo).toContainText('Buscando', { timeout: 5_000 });
    console.log(`CB-01 → boton2 disabled=${await boton2.isDisabled()}, botonActivo="${await botonActivo.textContent()?.then(t => t?.trim())}"`);

    // Todos los botones de la tabla deben estar deshabilitados
    const todosDeshabilitados = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('#diasTbody button'));
      return btns.every(b => b.disabled);
    });
    expect(todosDeshabilitados, 'Todos los botones deben estar disabled').toBe(true);
    console.log('CB-01 ✅ Todos los botones deshabilitados durante batch activo');

    // Limpiar routes pendientes antes de que el test termine
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  // ── CB-02 ─────────────────────────────────────────────────────────────────
  test('CB-02 Al terminar el batch, los botones se re-habilitan', async ({ page }) => {
    const fechas = await fechasDisponibles(page, 2);
    expect(fechas.length).toBeGreaterThanOrEqual(2);

    const [fecha1] = fechas;
    console.log(`CB-02 → Fecha: ${fecha1}`);

    // Clic en fecha1 — batch real (sin demora artificial)
    await page.locator(`#fila-${fecha1} button`).click();
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 15_000 });

    // Verificar que los botones están deshabilitados mientras corre
    const deshabilitadosDuranteBatch = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('#diasTbody button'));
      return btns.every(b => b.disabled);
    });
    expect(deshabilitadosDuranteBatch, 'Deben estar disabled durante el batch').toBe(true);
    console.log('CB-02 → Botones deshabilitados durante batch: ✅');

    // Esperar que el batch complete (KPI visible)
    await expect(page.locator('#panelKpi')).toBeVisible({ timeout: 90_000 });

    // Dar tiempo al re-enable (desbloquearBotonesFechas se llama al finalizar)
    await page.waitForTimeout(500);

    // Verificar que todos los botones volvieron a habilitarse
    const habilitadosDespues = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('#diasTbody button'));
      return btns.every(b => !b.disabled);
    });
    expect(habilitadosDespues, 'Todos los botones deben re-habilitarse al terminar').toBe(true);

    // El texto del botón activo debe restaurarse (ya no "⏳ Buscando…")
    const textoBtnActivo = await page.locator(`#fila-${fecha1} button`).textContent();
    expect(textoBtnActivo?.trim(), 'Texto del botón debe restaurarse').not.toContain('Buscando');
    console.log(`CB-02 ✅ Botones re-habilitados. Texto botón: "${textoBtnActivo?.trim()}"`);
  });

  // ── CB-03 ─────────────────────────────────────────────────────────────────
  test('CB-03 El botón Cerrar cancela el batch y re-habilita los botones', async ({ page }) => {
    const fechas = await fechasDisponibles(page, 2);
    expect(fechas.length).toBeGreaterThanOrEqual(1);

    const [fecha1] = fechas;
    console.log(`CB-03 → Fecha activa: ${fecha1}`);

    // Instalar demora para que el batch siga activo cuando hagamos Cerrar
    await instalarDemoraEnBatchUnico(page, 10_000);

    // Clic en fecha1
    await page.locator(`#fila-${fecha1} button`).click();
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 15_000 });

    // Verificar botones deshabilitados
    await expect(page.locator(`#fila-${fecha1} button`)).toContainText('Buscando', { timeout: 5_000 });
    console.log('CB-03 → Batch activo con botones deshabilitados: ✅');

    // ── Clic en Cerrar ────────────────────────────────────────────────────
    const btnCerrar = page.locator('#panelDia').getByRole('button', { name: /cerrar/i });
    await btnCerrar.click();

    // El panel debe ocultarse
    await expect(page.locator('#panelDia')).toBeHidden({ timeout: 5_000 });
    console.log('CB-03 → Panel cerrado: ✅');

    // Todos los botones deben re-habilitarse inmediatamente
    const todosHabilitados = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('#diasTbody button'));
      return btns.every(b => !b.disabled);
    });
    expect(todosHabilitados, 'Botones deben re-habilitarse al cerrar').toBe(true);

    // Los textos deben estar restaurados
    const textosRestaurados = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('#diasTbody button'));
      return btns.every(b => !b.textContent?.includes('Buscando'));
    });
    expect(textosRestaurados, 'Textos de botones deben restaurarse').toBe(true);
    console.log('CB-03 ✅ Botones re-habilitados y textos restaurados tras Cerrar');

    // Limpiar routes pendientes
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  // ── CB-04 ─────────────────────────────────────────────────────────────────
  test('CB-04 Después de Cerrar se puede seleccionar otra fecha correctamente', async ({ page }) => {
    const fechas = await fechasDisponibles(page, 2);
    expect(fechas.length, 'Se necesitan al menos 2 fechas').toBeGreaterThanOrEqual(2);

    const [fecha1, fecha2] = fechas;
    console.log(`CB-04 → Fecha1: ${fecha1}  |  Fecha2: ${fecha2}`);

    // Instalar demora en el PRIMER batch para que siga activo cuando hagamos Cerrar
    await instalarDemoraEnBatchUnico(page, 8_000);

    // Clic en fecha1 — batch arranca con demora
    await page.locator(`#fila-${fecha1} button`).click();
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`#fila-${fecha1} button`)).toContainText('Buscando', { timeout: 5_000 });
    console.log(`CB-04 → Batch de ${fecha1} activo con demora: ✅`);

    // Cerrar panel — cancela el batch y re-habilita botones
    const btnCerrar = page.locator('#panelDia').getByRole('button', { name: /cerrar/i });
    await btnCerrar.click();
    await expect(page.locator('#panelDia')).toBeHidden({ timeout: 5_000 });

    // El botón de fecha2 debe estar habilitado ahora
    const boton2 = page.locator(`#fila-${fecha2} button`);
    await expect(boton2, 'Botón fecha2 debe estar habilitado tras Cerrar').toBeEnabled({ timeout: 5_000 });
    console.log(`CB-04 → Botón fecha2 habilitado tras Cerrar: ✅`);

    // ── Ahora seleccionar fecha2 (sin demora) ─────────────────────────────
    await boton2.click();
    await expect(page.locator('#panelDia')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 15_000 });

    // Esperar que el batch de fecha2 complete
    await expect(page.locator('#panelKpi')).toBeVisible({ timeout: 90_000 });

    const kpiTotal = parseInt(
      (await page.locator('#kpiTotal').textContent())?.trim() ?? '0', 10
    );
    expect(kpiTotal, 'KPI de fecha2 debe ser positivo').toBeGreaterThan(0);
    console.log(`CB-04 ✅ Batch de fecha2 completó correctamente — KPI total=${kpiTotal}`);
  });
});
