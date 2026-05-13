/**
 * cambio-fecha-durante-batch.spec.ts
 *
 * CB — Cambio de fecha durante batch activo
 *
 * Reproduce y valida el bug donde seleccionar una fecha mientras
 * el batch anterior sigue corriendo deja el sistema bloqueado.
 *
 * Estrategia de prueba:
 *   Se intercepta POST /api/detalle/soporte-batch-stream con page.route()
 *   para inyectar una demora artificial entre cada línea NDJSON.
 *   Esto garantiza que el batch anterior siga activo cuando se hace clic
 *   en la segunda fecha, reproduciendo el race condition de forma fiable.
 *
 * Tests:
 *   CB-01  Verificar que el sistema NO se bloquea al cambiar de fecha
 *          durante un batch activo (barra llega al 100% para la 2.ª fecha).
 *   CB-02  La barra de progreso se resetea a 0/N al seleccionar nueva fecha
 *          (no conserva valores del lote anterior).
 *   CB-03  Los KPIs reflejan los datos de la ÚLTIMA fecha seleccionada
 *          (no los del lote anterior).
 *   CB-04  Cambio rápido entre tres fechas — el sistema se recupera y muestra
 *          los datos de la tercera fecha correctamente.
 */

import { test, expect, type Page, type Route } from '@playwright/test';

const BASE_URL   = 'http://localhost:5125';
const MES_MAYO   = '2026-05';
// Demora en ms entre cada chunk NDJSON del stream simulado.
// Lo suficientemente grande para que el test pueda hacer clic en
// otra fecha mientras el batch sigue en vuelo.
const CHUNK_DELAY_MS = 120;

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
 * Instala un route handler que intercepta el endpoint de streaming y
 * reenvía cada línea NDJSON con una demora artificial.
 *
 * La intercepción se activa UNA SOLA VEZ (para el primer batch solicitado)
 * y luego se elimina, de modo que el segundo batch pasa sin demora.
 * Esto simula el caso real: batch A está a mitad de proceso cuando llega B.
 */
async function instalarDemoraEnBatchUnico(page: Page): Promise<void> {
  let intercepted = false;

  await page.route('**/api/detalle/soporte-batch-stream', async (route: Route) => {
    if (intercepted) {
      // Solicitudes posteriores pasan sin demora
      await route.continue();
      return;
    }
    intercepted = true;

    // Obtener la respuesta real del servidor
    const response = await route.fetch();
    const body     = await response.text();

    // Dividir el NDJSON en líneas y re-emitirlas con demora
    const lines = body.split('\n').filter(l => l.trim().length > 0);

    // Construir cuerpo de respuesta con demoras simuladas línea a línea.
    // Playwright no soporta streaming chunked en route.fulfill, por lo que
    // entregamos todo el body pero con un retraso global proporcional al
    // número de líneas, simulando que el servidor tardó en responder.
    const delayTotal = lines.length * CHUNK_DELAY_MS;

    await new Promise(resolve => setTimeout(resolve, Math.min(delayTotal, 4_000)));

    await route.fulfill({
      status:  response.status(),
      headers: Object.fromEntries(response.headers()),
      body:    lines.join('\n'),
    });
  });
}

// ── Suite principal ───────────────────────────────────────────────────────────

test.describe('CB — Cambio de fecha durante batch activo', () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await login(page);
    await irADetalleMayo(page);
  });

  // ── CB-01 ─────────────────────────────────────────────────────────────────
  test('CB-01 El sistema NO se bloquea al cambiar de fecha durante batch activo', async ({ page }) => {
    const fechas = await fechasDisponibles(page, 2);
    expect(fechas.length, 'Se necesitan al menos 2 días en Mayo').toBeGreaterThanOrEqual(2);

    const [fecha1, fecha2] = fechas;
    console.log(`CB-01 → Fecha A: ${fecha1}  |  Fecha B: ${fecha2}`);

    // Instalar demora en el PRIMER batch (fecha1) para que siga activo
    // cuando se haga clic en fecha2.
    await instalarDemoraEnBatchUnico(page);

    // ── Abrir fecha1 (batch A arranca con demora artificial) ──────────────
    await page.locator(`#fila-${fecha1} button`).click();
    await expect(page.locator('#panelDia'),     'Panel debe abrirse').toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#panelProgreso'),'Barra de progreso debe aparecer').toBeVisible({ timeout: 15_000 });

    // Verificar que el batch A está en vuelo (contador no vacío)
    await expect(page.locator('#panelProgContador')).not.toBeEmpty({ timeout: 5_000 });
    const contadorA = await page.locator('#panelProgContador').textContent();
    console.log(`CB-01 → Batch A iniciado, contador="${contadorA}"`);

    // ── Clic en fecha2 MIENTRAS el batch A sigue activo ──────────────────
    await page.locator(`#fila-${fecha2} button`).click();

    // El panel debe seguir visible (no cerrarse)
    await expect(page.locator('#panelDia')).toBeVisible({ timeout: 5_000 });

    // El título del panel debe cambiar a fecha2
    const titulo = page.locator('#panelDiaTitulo');
    const partesFecha2 = fecha2.split('-');   // ['2026','05','09']
    const labelFecha2  = `${partesFecha2[2]}/${partesFecha2[1]}/${partesFecha2[0]}`;
    await expect(titulo).toContainText(labelFecha2, { timeout: 10_000 });
    console.log(`CB-01 → Panel cambió a fecha2 (${fecha2}): OK`);

    // La barra de progreso debe reaparecer para el batch B
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 15_000 });

    // ── Esperar que el batch B complete (KPI debe aparecer) ───────────────
    await expect(page.locator('#panelKpi')).toBeVisible({ timeout: 90_000 });
    console.log('CB-01 ✅ Batch B completó — sistema no bloqueado');

    // El total de KPI debe ser > 0
    const totalKpi = parseInt(
      (await page.locator('#kpiTotal').textContent())?.trim() ?? '0', 10
    );
    expect(totalKpi, 'KPI total debe ser positivo').toBeGreaterThan(0);
  });

  // ── CB-02 ─────────────────────────────────────────────────────────────────
  test('CB-02 La barra de progreso se resetea al seleccionar nueva fecha', async ({ page }) => {
    const fechas = await fechasDisponibles(page, 2);
    expect(fechas.length, 'Se necesitan al menos 2 días en Mayo').toBeGreaterThanOrEqual(2);

    const [fecha1, fecha2] = fechas;

    // Instalar demora para que batch A esté activo cuando se pida batch B
    await instalarDemoraEnBatchUnico(page);

    // Abrir fecha1 y esperar que la barra muestre avance
    await page.locator(`#fila-${fecha1} button`).click();
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#panelProgContador')).not.toBeEmpty({ timeout: 5_000 });

    // Capturar total de fecha1 antes del cambio
    const textoA = await page.locator('#panelProgContador').textContent() ?? '';
    const totalA = parseInt(textoA.split('/').pop()?.trim() ?? '0', 10);
    console.log(`CB-02 → Batch A: contador="${textoA}", total=${totalA}`);

    // ── Clic en fecha2 ────────────────────────────────────────────────────
    await page.locator(`#fila-${fecha2} button`).click();
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 15_000 });

    // El contador debe iniciar con "0 /" (reset), no con el valor previo de A
    const textoB = await page.locator('#panelProgContador').textContent() ?? '';
    console.log(`CB-02 → Batch B inmediato: contador="${textoB}"`);

    // El total del batch B puede ser distinto a A; la clave es que
    // el procesados (parte izquierda) sea 0 o muy bajo al inicio
    const procesadosB = parseInt(textoB.split('/')[0]?.trim() ?? '0', 10);
    const totalB      = parseInt(textoB.split('/').pop()?.trim() ?? '0', 10);

    expect(procesadosB, 'Batch B debe iniciar desde 0 (no acumular del batch A)')
      .toBeLessThanOrEqual(5);  // Pequeña tolerancia por velocidad de render
    expect(totalB, 'Total del batch B debe ser >= 0').toBeGreaterThanOrEqual(0);

    console.log(`CB-02 ✅ Barra resetea: ${procesadosB}/${totalB}`);
  });

  // ── CB-03 ─────────────────────────────────────────────────────────────────
  test('CB-03 Los KPIs reflejan la ÚLTIMA fecha seleccionada, no el lote anterior', async ({ page }) => {
    const fechas = await fechasDisponibles(page, 2);
    expect(fechas.length, 'Se necesitan al menos 2 días en Mayo').toBeGreaterThanOrEqual(2);

    const [fecha1, fecha2] = fechas;

    // Obtener el total de registros de cada fecha desde la tabla de días
    const totalRegistrosFecha1 = parseInt(
      (await page.locator(`#fila-${fecha1} td`).nth(1).textContent() ?? '0'), 10
    );
    const totalRegistrosFecha2 = parseInt(
      (await page.locator(`#fila-${fecha2} td`).nth(1).textContent() ?? '0'), 10
    );
    console.log(`CB-03 → Fecha1=${fecha1}(${totalRegistrosFecha1}) | Fecha2=${fecha2}(${totalRegistrosFecha2})`);

    // Instalar demora para que batch A esté activo al lanzar batch B
    await instalarDemoraEnBatchUnico(page);

    // Abrir fecha1 y esperar inicio del batch
    await page.locator(`#fila-${fecha1} button`).click();
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 15_000 });

    // Cambiar a fecha2 mientras batch A sigue activo
    await page.locator(`#fila-${fecha2} button`).click();

    // Esperar que batch B complete
    await expect(page.locator('#panelKpi')).toBeVisible({ timeout: 90_000 });

    const kpiTotalFinal = parseInt(
      (await page.locator('#kpiTotal').textContent())?.trim() ?? '0', 10
    );

    // El KPI total debe corresponder a la cantidad de registros de fecha2
    // (se consultan todos los nrodctos únicos de esa fecha)
    expect(kpiTotalFinal, 'KPI total debe ser > 0 y corresponder al lote de fecha2')
      .toBeGreaterThan(0);

    // Si los totales son distintos entre fechas, podemos verificar que
    // el KPI NO refleja el total de fecha1
    if (totalRegistrosFecha1 !== totalRegistrosFecha2 && totalRegistrosFecha1 > 0) {
      expect(kpiTotalFinal, 'KPI total NO debe ser el total de fecha1 (lote cancelado)')
        .not.toBe(totalRegistrosFecha1);
      console.log(`CB-03 ✅ KPI refleja fecha2 (total=${kpiTotalFinal}), no fecha1 (${totalRegistrosFecha1})`);
    } else {
      console.log(`CB-03 → Fechas con mismo total (${kpiTotalFinal}), no se puede distinguir — OK si batch terminó`);
    }
  });

  // ── CB-04 ─────────────────────────────────────────────────────────────────
  test('CB-04 Cambio rápido entre tres fechas — el sistema se recupera', async ({ page }) => {
    const fechas = await fechasDisponibles(page, 3);
    if (fechas.length < 3) {
      console.log('CB-04 → Menos de 3 fechas disponibles, prueba omitida');
      test.skip();
      return;
    }

    const [fecha1, fecha2, fecha3] = fechas;
    console.log(`CB-04 → Fechas: ${fecha1} → ${fecha2} → ${fecha3}`);

    // Instalar demora en los primeros DOS batches para simular el escenario
    let interceptCount = 0;
    await page.route('**/api/detalle/soporte-batch-stream', async (route: Route) => {
      if (interceptCount >= 2) {
        await route.continue();
        return;
      }
      interceptCount++;
      const response = await route.fetch();
      const body     = await response.text();
      const lines    = body.split('\n').filter(l => l.trim().length > 0);
      // Retraso proporcional pero acotado a 2s por batch
      const delay    = Math.min(lines.length * CHUNK_DELAY_MS, 2_000);
      await new Promise(resolve => setTimeout(resolve, delay));
      await route.fulfill({
        status:  response.status(),
        headers: Object.fromEntries(response.headers()),
        body:    lines.join('\n'),
      });
    });

    // Clic rápido en fecha1 → fecha2 → fecha3
    await page.locator(`#fila-${fecha1} button`).click();
    await expect(page.locator('#panelDia')).toBeVisible({ timeout: 10_000 });

    // Clic en fecha2 sin esperar
    await page.locator(`#fila-${fecha2} button`).click();

    // Clic en fecha3 sin esperar
    await page.locator(`#fila-${fecha3} button`).click();

    // El sistema debe recuperarse y mostrar los datos de fecha3
    const partesFecha3  = fecha3.split('-');
    const labelFecha3   = `${partesFecha3[2]}/${partesFecha3[1]}/${partesFecha3[0]}`;
    await expect(page.locator('#panelDiaTitulo'))
      .toContainText(labelFecha3, { timeout: 15_000 });

    // Esperar que el batch de fecha3 complete
    await expect(page.locator('#panelKpi')).toBeVisible({ timeout: 90_000 });
    const kpiTotal = parseInt(
      (await page.locator('#kpiTotal').textContent())?.trim() ?? '0', 10
    );
    expect(kpiTotal, 'KPI de fecha3 debe ser positivo').toBeGreaterThan(0);
    console.log(`CB-04 ✅ Sistema recuperado — fecha3 KPI total=${kpiTotal}`);
  });
});
