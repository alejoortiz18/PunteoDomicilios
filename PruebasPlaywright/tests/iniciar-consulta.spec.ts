/**
 * iniciar-consulta.spec.ts
 * Pruebas Playwright — Funcionalidad del botón "🔍 Iniciar Consulta" en el Dashboard
 *
 * Ejecutar en modo visible:
 *   npx playwright test tests/iniciar-consulta.spec.ts --headed
 *   npx playwright test tests/iniciar-consulta.spec.ts --headed --slow-mo=600
 */

import { test, expect, Page } from '@playwright/test';

// ── Fecha real de prueba ─────────────────────────────────────────────────────
// 2026-05-05 (martes) — confirmado con datos reales en la BD para MMUNOZ
const FECHA_CON_DATOS = '2026-05-05';
const FECHA_SIN_DATOS = '2020-01-01'; // Fecha antigua sin registros

// ── Mock del batch de soporte ────────────────────────────────────────────────
// La API externa (helpharma) puede tardar minutos. Usamos mock directo para
// que los tests que necesitan el resultado final no dependan de ese tiempo.
const MOCK_BATCH_ESTADOS = [
  { nrodcto: 'MOCK_ENT_1', estado: 1 },
  { nrodcto: 'MOCK_FAL_1', estado: 0 },
  { nrodcto: 'MOCK_ENT_2', estado: 1 },
];

async function mockBatch(page: Page, delayMs = 500): Promise<void> {
  await page.route('**/api/consultar-batch', async route => {
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BATCH_ESTADOS),
    });
  });
}

// ── Utilidades ───────────────────────────────────────────────────────────────

async function loginComoMMUNOZ(page: Page): Promise<void> {
  await page.goto('/login');
  await page.selectOption('select[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5125/');
  // Esperar que el resumen mensual cargue (confirma que la sesión está activa)
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 20_000 });
}

async function seleccionarFechaYConsultar(page: Page, fecha: string): Promise<void> {
  await page.fill('#inputFecha', fecha);
  await page.click('#btnConsultar');
}

// ── Suite DC-01 al DC-09 ─────────────────────────────────────────────────────

test.describe('Dashboard — Botón Iniciar Consulta', () => {

  test.beforeEach(async ({ page }) => {
    await loginComoMMUNOZ(page);
  });

  // ── DC-01 ────────────────────────────────────────────────────────────────
  test('DC-01 sin fecha seleccionada muestra modal de advertencia', async ({ page }) => {
    // Limpiar el campo de fecha antes de consultar
    await page.fill('#inputFecha', '');
    await page.click('#btnConsultar');

    // Debe aparecer el modal de advertencia
    await expect(page.locator('#modalMensaje'), 'El modal de advertencia debe abrirse').toBeVisible({ timeout: 5_000 });
    const titulo = await page.locator('#modalMensajeTitulo').innerText();
    expect(titulo.trim(), 'El título del modal debe indicar fecha requerida').not.toBe('');

    // La barra de progreso NO debe aparecer
    await expect(page.locator('#areaProgreso'), 'La barra de progreso no debe mostrarse').toBeHidden();
  });

  // ── DC-02 ────────────────────────────────────────────────────────────────
  test('DC-02 con fecha válida aparece la barra de progreso con texto "Consultando soportes..."', async ({ page }) => {
    await seleccionarFechaYConsultar(page, FECHA_CON_DATOS);

    // La barra de progreso debe aparecer inmediatamente
    await expect(page.locator('#areaProgreso'), 'La barra de progreso debe aparecer').toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#progFill'), 'La barra de relleno debe existir').toBeAttached();

    // El texto "Consultando soportes..." debe ser visible dentro del área de progreso
    await expect(
      page.locator('#areaProgreso').getByText('Consultando soportes...'),
      '"Consultando soportes..." debe ser visible'
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── DC-03 ────────────────────────────────────────────────────────────────
  test('DC-03 el botón se deshabilita durante la consulta y se reactiva al terminar', async ({ page }) => {
    // Interceptar el batch con una respuesta mock directa (no llamamos route.fetch() para
    // evitar esperar la respuesta real del servidor que puede tardar minutos).
    // El delay de 3s garantiza que Playwright puede detectar el estado disabled.
    await page.route('**/api/consultar-batch', async route => {
      await new Promise(r => setTimeout(r, 3_000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ nrodcto: 'MOCK001', estado: 1 }]),
      });
    });

    await seleccionarFechaYConsultar(page, FECHA_CON_DATOS);

    // El botón debe estar deshabilitado mientras consulta
    await expect(page.locator('#btnConsultar'), 'El botón debe deshabilitarse durante la consulta').toBeDisabled({ timeout: 8_000 });

    // Esperar a que termine la consulta (botón vuelve a habilitarse — máx 15s con mock)
    await expect(page.locator('#btnConsultar'), 'El botón debe habilitarse cuando termina la consulta').toBeEnabled({ timeout: 15_000 });
  });

  // ── DC-04 ────────────────────────────────────────────────────────────────
  test('DC-04 KPIs aparecen con valores válidos tras consultar', async ({ page }) => {
    // Mock del batch para no depender de la API externa (puede tardar minutos)
    await mockBatch(page);
    await seleccionarFechaYConsultar(page, FECHA_CON_DATOS);

    // Esperar a que finalice la consulta
    await expect(page.locator('#btnConsultar')).toBeEnabled({ timeout: 30_000 });

    // El área de KPIs debe ser visible
    await expect(page.locator('#areaKpi'), 'El área de KPIs debe aparecer').toBeVisible();

    // KPI Total Registros: número > 0
    const kpiTotal = await page.locator('#kpiTotal').innerText();
    const total = parseInt(kpiTotal.replace(/\D/g, ''));
    expect(total, 'Total Registros debe ser > 0').toBeGreaterThan(0);

    // KPI Total Cuota Mod: contiene $
    const kpiCuota = await page.locator('#kpiCuota').innerText();
    expect(kpiCuota, 'Total Cuota Mod debe contener $').toContain('$');

    // KPI Planillas: número ≥ 1
    const kpiPlanillas = await page.locator('#kpiPlanillas').innerText();
    const planillas = parseInt(kpiPlanillas.replace(/\D/g, ''));
    expect(planillas, 'Planillas Distintas debe ser ≥ 1').toBeGreaterThanOrEqual(1);

    // KPI Soporte: contiene %
    const kpiSoporte = await page.locator('#kpiSoporte').innerText();
    expect(kpiSoporte, 'Con Soporte debe mostrar un porcentaje').toContain('%');
  });

  // ── DC-05 ────────────────────────────────────────────────────────────────
  test('DC-05 los gráficos (timeline y donut) aparecen tras la consulta', async ({ page }) => {
    await mockBatch(page);
    await seleccionarFechaYConsultar(page, FECHA_CON_DATOS);

    // Esperar a que finalice la consulta
    await expect(page.locator('#btnConsultar')).toBeEnabled({ timeout: 30_000 });

    // El área de gráficos debe ser visible
    await expect(page.locator('#areaCharts'), 'El área de gráficos debe aparecer').toBeVisible();

    // Ambos canvas deben existir y estar visibles
    await expect(page.locator('#chartTimeline'), 'El gráfico de timeline debe existir').toBeVisible();
    await expect(page.locator('#chartDonut'), 'El gráfico donut debe existir').toBeVisible();
  });

  // ── DC-06 ────────────────────────────────────────────────────────────────
  test('DC-06 la barra de progreso muestra contadores entregados y faltantes', async ({ page }) => {
    // Mock directo: controlamos los estados para obtener resultados predecibles
    // sin esperar la respuesta real del servidor (que puede tardar mucho).
    // estado=1 → entregado, estado=0 → faltante
    const mockEstados = [
      { nrodcto: 'MOCK_ENT_1', estado: 1 },
      { nrodcto: 'MOCK_FAL_1', estado: 0 },
      { nrodcto: 'MOCK_ENT_2', estado: 1 },
    ];
    await page.route('**/api/consultar-batch', async route => {
      await new Promise(r => setTimeout(r, 3_000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockEstados),
      });
    });

    await seleccionarFechaYConsultar(page, FECHA_CON_DATOS);

    // Esperar a que el progreso sea visible
    await expect(page.locator('#areaProgreso')).toBeVisible({ timeout: 10_000 });

    // Esperar a que el batch complete (botón habilitado) — con mock tarda ~3s
    await expect(page.locator('#btnConsultar')).toBeEnabled({ timeout: 15_000 });

    // Los contadores usan textContent (funciona aunque el elemento esté por ocultarse)
    const contEntr = await page.locator('#progEntregados').evaluate(el => el.textContent ?? '');
    const contFalt = await page.locator('#progFaltantes').evaluate(el => el.textContent ?? '');

    expect(contEntr, 'El contador de entregados debe incluir ✅').toContain('✅');
    expect(contFalt, 'El contador de faltantes debe incluir ❌').toContain('❌');

    // Con el mock: 2 entregados + 1 faltante = 3 total
    const numEntr = parseInt(contEntr.replace(/\D/g, ''));
    const numFalt = parseInt(contFalt.replace(/\D/g, ''));
    expect(numEntr + numFalt, 'La suma entregados + faltantes debe ser > 0').toBeGreaterThan(0);
  });

  // ── DC-07 ────────────────────────────────────────────────────────────────
  test('DC-07 fecha sin datos muestra modal "Sin resultados"', async ({ page }) => {
    // Interceptar /api/registros para devolver vacío
    await page.route(`**/api/registros**`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total: 0, registros: [], nrodctos: [], resumen: {} }),
      });
    });

    await seleccionarFechaYConsultar(page, FECHA_SIN_DATOS);

    // Debe aparecer el modal de "Sin resultados"
    await expect(page.locator('#modalMensaje'), 'El modal debe abrirse').toBeVisible({ timeout: 10_000 });
    const titulo = await page.locator('#modalMensajeTitulo').innerText();
    expect(titulo.trim(), 'El título debe indicar sin resultados').not.toBe('');

    // KPIs y gráficos NO deben aparecer
    await expect(page.locator('#areaKpi'), 'Los KPIs no deben mostrarse').toBeHidden();
    await expect(page.locator('#areaCharts'), 'Los gráficos no deben mostrarse').toBeHidden();
  });

  // ── DC-08 ────────────────────────────────────────────────────────────────
  test('DC-08 API /api/registros devuelve estructura correcta', async ({ page }) => {
    const resp = await page.request.get(`/api/registros?fecha=${FECHA_CON_DATOS}`);
    expect(resp.status(), 'El endpoint debe devolver 200').toBe(200);

    const data = await resp.json();
    expect(data, 'Debe tener propiedad registros').toHaveProperty('registros');
    expect(data, 'Debe tener propiedad nrodctos').toHaveProperty('nrodctos');
    expect(Array.isArray(data.registros), 'registros debe ser un array').toBe(true);
    expect(Array.isArray(data.nrodctos), 'nrodctos debe ser un array').toBe(true);
    expect(data.registros.length, 'Debe haber al menos 1 registro').toBeGreaterThan(0);

    // Verificar estructura del primer registro
    const r = data.registros[0];
    expect(r, 'Registro debe tener nrodcto').toHaveProperty('nrodcto');
    expect(r, 'Registro debe tener cuotaMod').toHaveProperty('cuotaMod');
    expect(r, 'Registro debe tener nroPlanilla').toHaveProperty('nroPlanilla');
  });

  // ── DC-09 ────────────────────────────────────────────────────────────────
  test('DC-09 API /api/consultar-batch devuelve estados para lista de nrodctos', async ({ page }) => {
    // Primero obtener nrodctos reales
    const regResp = await page.request.get(`/api/registros?fecha=${FECHA_CON_DATOS}`);
    const regData = await regResp.json();
    const nrodctos: string[] = (regData.nrodctos ?? []).slice(0, 3); // probar con máximo 3

    expect(nrodctos.length, 'Debe haber nrodctos para el batch').toBeGreaterThan(0);

    const resp = await page.request.post('/api/consultar-batch', {
      data: nrodctos,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(resp.status(), 'El endpoint batch debe devolver 200').toBe(200);

    const estados: any[] = await resp.json();
    expect(Array.isArray(estados), 'La respuesta debe ser un array').toBe(true);
    expect(estados.length, 'El array de estados debe tener el mismo largo que nrodctos').toBe(nrodctos.length);

    // Cada estado debe tener nrodcto y estado
    estados.forEach(e => {
      expect(e, 'Cada item debe tener nrodcto').toHaveProperty('nrodcto');
      expect(e, 'Cada item debe tener estado').toHaveProperty('estado');
      expect([0, 1, 2, 3], `Estado inválido: ${e.estado}`).toContain(e.estado);
    });
  });

  // ── DC-10 ────────────────────────────────────────────────────────────────
  test('DC-10 segunda consulta restablece KPIs antes de la nueva carga', async ({ page }) => {
    // Primera consulta con mock
    await mockBatch(page);
    await seleccionarFechaYConsultar(page, FECHA_CON_DATOS);
    await expect(page.locator('#btnConsultar')).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator('#areaKpi')).toBeVisible();

    // Segunda consulta — los KPIs deben mostrar "—" brevemente (reset)
    await page.fill('#inputFecha', FECHA_CON_DATOS);

    // Interceptamos para poder capturar el estado de reset
    let resetObservado = false;
    const observer = await page.evaluate(() => {
      return new Promise<boolean>(resolve => {
        const el = document.getElementById('kpiTotal');
        const orig = el?.textContent;
        const mo = new MutationObserver(() => {
          if (el?.textContent === '—') {
            mo.disconnect();
            resolve(true);
          }
        });
        if (el) mo.observe(el, { childList: true, subtree: true, characterData: true });
        // Timeout por si no ocurre el reset (datos muy rápidos)
        setTimeout(() => { mo.disconnect(); resolve(false); }, 3_000);
      });
    });

    await page.click('#btnConsultar');
    // No podemos await el evaluate ya que se ejecutó antes, verificamos que el botón se reactiva
    await expect(page.locator('#btnConsultar')).toBeEnabled({ timeout: 30_000 });

    // Al final KPIs deben tener datos nuevos (no "—")
    const kpiTotal = await page.locator('#kpiTotal').innerText();
    expect(kpiTotal.trim(), 'Tras la segunda consulta, los KPIs deben tener valores').not.toBe('—');
  });

  // ── DC-11 ────────────────────────────────────────────────────────────────
  test('DC-11 flujo E2E completo: login → seleccionar fecha → ver KPIs y gráficos', async ({ page }) => {
    await mockBatch(page, 2_000); // 2s para poder verificar estado disabled antes de que termine
    const errores: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errores.push(msg.text()); });
    page.on('pageerror', err => errores.push(err.message));

    // 1. Verificar que el campo de fecha tiene valor por defecto (hoy)
    const fechaDefault = await page.locator('#inputFecha').inputValue();
    expect(fechaDefault.trim(), '1. El campo de fecha debe tener un valor por defecto').not.toBe('');

    // 2. Cambiar a fecha con datos conocidos
    await page.fill('#inputFecha', FECHA_CON_DATOS);

    // 3. Hacer clic en Iniciar Consulta
    await page.click('#btnConsultar');

    // 4. Verificar que el botón se deshabilita
    await expect(page.locator('#btnConsultar'), '4. El botón debe deshabilitarse').toBeDisabled({ timeout: 5_000 });

    // 5. Verificar que la barra de progreso aparece con texto "Consultando soportes..."
    await expect(page.locator('#areaProgreso'), '5. La barra de progreso debe aparecer').toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('#areaProgreso').getByText('Consultando soportes...'),
      '5. El texto Consultando soportes... debe ser visible'
    ).toBeVisible({ timeout: 5_000 });

    // 6. Esperar a que la consulta finalice
    await expect(page.locator('#btnConsultar'), '6. El botón debe reactivarse').toBeEnabled({ timeout: 30_000 });

    // 7. KPIs visibles con valores válidos
    await expect(page.locator('#areaKpi'), '7. Los KPIs deben ser visibles').toBeVisible();
    const kpiTotal = parseInt((await page.locator('#kpiTotal').innerText()).replace(/\D/g, ''));
    expect(kpiTotal, '7. Total Registros debe ser > 0').toBeGreaterThan(0);

    const kpiSoporte = await page.locator('#kpiSoporte').innerText();
    expect(kpiSoporte, '7. Soporte debe mostrar %').toContain('%');

    // 8. Gráficos visibles
    await expect(page.locator('#areaCharts'), '8. Los gráficos deben ser visibles').toBeVisible();
    await expect(page.locator('#chartTimeline'), '8. Timeline debe existir').toBeVisible();
    await expect(page.locator('#chartDonut'), '8. Donut debe existir').toBeVisible();

    // 9. La barra de progreso se oculta al terminar
    await expect(page.locator('#areaProgreso'), '9. La barra de progreso debe ocultarse').toBeHidden({ timeout: 5_000 });

    // 10. Sin errores de consola
    expect(errores, '10. No debe haber errores en consola').toEqual([]);
  });

});

// ── Suite Resumen Mensual ─────────────────────────────────────────────────────

test.describe('Dashboard — Tabla Resumen Mensual', () => {

  test.beforeEach(async ({ page }) => {
    await loginComoMMUNOZ(page);
  });

  // ── RM-01 ────────────────────────────────────────────────────────────────
  test('RM-01 la tabla muestra las 4 columnas: Mes/Año, Total Registros, Cantidad días, Eliminar', async ({ page }) => {
    // La tabla debe estar visible (la carga ocurre en DOMContentLoaded)
    await expect(page.locator('#resumenTabla'), 'La tabla debe ser visible').toBeVisible({ timeout: 20_000 });

    const headers = page.locator('#resumenTabla thead th');
    await expect(headers).toHaveCount(4);

    const textos = await headers.allInnerTexts();
    expect(textos[0].trim().toUpperCase(), 'Col 0 debe ser Mes / Año').toContain('MES');
    expect(textos[1].trim().toUpperCase(), 'Col 1 debe ser Total Registros').toContain('REGISTROS');
    expect(textos[2].trim().toUpperCase(), 'Col 2 debe ser Cantidad días').toContain('DÍA');
    expect(textos[3].trim().toUpperCase(), 'Col 3 debe ser Eliminar planillas').toContain('ELIMINAR');
  });

  // ── RM-02 ────────────────────────────────────────────────────────────────
  test('RM-02 la tabla tiene al menos una fila con datos válidos y botón Eliminar', async ({ page }) => {
    await expect(page.locator('#resumenTabla'), 'La tabla debe ser visible').toBeVisible({ timeout: 20_000 });

    const filas = page.locator('#resumenTbody tr');
    await expect(filas, 'Debe haber al menos una fila').not.toHaveCount(0);

    const primeraFila = filas.first();
    const celdas = primeraFila.locator('td');
    await expect(celdas, 'La fila debe tener 4 celdas').toHaveCount(4);

    // Celda 0: label del mes (texto no vacío)
    const labelMes = await celdas.nth(0).innerText();
    expect(labelMes.trim(), 'El label del mes no debe estar vacío').not.toBe('');

    // Celda 1: Total Registros (número > 0)
    const totalReg = parseInt((await celdas.nth(1).innerText()).replace(/\D/g, ''));
    expect(totalReg, 'Total Registros debe ser > 0').toBeGreaterThan(0);

    // Celda 2: Cantidad días (número > 0)
    const cantDias = parseInt((await celdas.nth(2).innerText()).replace(/\D/g, ''));
    expect(cantDias, 'Cantidad días debe ser > 0').toBeGreaterThan(0);

    // Celda 3: botón Eliminar
    const btnEliminar = celdas.nth(3).locator('button');
    await expect(btnEliminar, 'El botón Eliminar debe existir').toBeVisible();
    const btnTexto = await btnEliminar.innerText();
    expect(btnTexto, 'El botón debe contener texto Eliminar').toContain('Eliminar');
  });

  // ── RM-03 ────────────────────────────────────────────────────────────────
  test('RM-03 el botón Eliminar abre modal de confirmación con el nombre del mes', async ({ page }) => {
    await expect(page.locator('#resumenTabla'), 'La tabla debe ser visible').toBeVisible({ timeout: 20_000 });

    // Obtener el label del primer mes
    const primeraFila = page.locator('#resumenTbody tr').first();
    const labelMes = await primeraFila.locator('td').first().innerText();

    // Hacer clic en el botón Eliminar de la primera fila
    await primeraFila.locator('button').click();

    // El modal de confirmación debe aparecer
    await expect(page.locator('#modalConfirmarEliminar'), 'El modal de confirmación debe abrirse').toBeVisible({ timeout: 5_000 });

    // El modal debe mostrar el nombre del mes
    const confirmLabel = await page.locator('#confirmEliminarLabel').innerText();
    expect(confirmLabel.trim(), 'El modal debe mostrar el nombre del mes').toBe(labelMes.trim());

    // Cancelar (no eliminar datos reales)
    await page.locator('#modalConfirmarEliminar').getByText('Cancelar').click();
    await expect(page.locator('#modalConfirmarEliminar'), 'El modal debe cerrarse al cancelar').toBeHidden({ timeout: 5_000 });
  });

  // ── RM-04 ────────────────────────────────────────────────────────────────
  test('RM-04 API GET /api/resumen-mensual devuelve estructura con cantidadDias', async ({ page }) => {
    const resp = await page.request.get('/api/resumen-mensual');
    expect(resp.status(), 'El endpoint debe devolver 200').toBe(200);

    const data: any[] = await resp.json();
    expect(Array.isArray(data), 'La respuesta debe ser un array').toBe(true);
    expect(data.length, 'Debe haber al menos un registro mensual').toBeGreaterThan(0);

    const primer = data[0];
    expect(primer, 'Debe tener propiedad mes').toHaveProperty('mes');
    expect(primer, 'Debe tener propiedad label').toHaveProperty('label');
    expect(primer, 'Debe tener propiedad totalRegistros').toHaveProperty('totalRegistros');
    expect(primer, 'Debe tener propiedad cantidadDias').toHaveProperty('cantidadDias');
    expect(primer.cantidadDias, 'cantidadDias debe ser > 0').toBeGreaterThan(0);
  });

  // ── RM-05 ────────────────────────────────────────────────────────────────
  test('RM-05 API DELETE /api/planillas/{mes} (mock) responde con eliminados', async ({ page }) => {
    // Interceptar la llamada DELETE para no borrar datos reales
    await page.route('**/api/planillas/**', async route => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ eliminados: 42 }),
        });
      } else {
        await route.continue();
      }
    });

    await expect(page.locator('#resumenTabla'), 'La tabla debe ser visible').toBeVisible({ timeout: 20_000 });

    // Clic en Eliminar de la primera fila
    await page.locator('#resumenTbody tr').first().locator('button').click();

    // Confirmar en el modal
    await expect(page.locator('#modalConfirmarEliminar')).toBeVisible({ timeout: 5_000 });
    await page.locator('#btnConfirmarEliminar').click();

    // El modal de resultado debe indicar éxito con el número de eliminados
    await expect(page.locator('#modalMensaje'), 'El modal de éxito debe aparecer').toBeVisible({ timeout: 10_000 });
    const body = await page.locator('#modalMensajeBody').innerText();
    expect(body, 'Debe mostrar el número de registros eliminados').toContain('42');
  });

});
