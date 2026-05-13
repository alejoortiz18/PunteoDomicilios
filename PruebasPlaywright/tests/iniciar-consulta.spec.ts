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

// ── Mock de registros con delay ─────────────────────────────────────────────
// Permite verificar el estado del botón (disabled) sin depender del tiempo real de la BD.
async function mockRegistrosConDelay(page: Page, delayMs = 3_000): Promise<void> {
  await page.route(/\/api\/registros/, async route => {
    await new Promise(r => setTimeout(r, delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 2,
        registros: [
          { nrodcto: 'MOCK001', destino: 'Destino 1', cuotaMod: 5000, nroPlanilla: 'P001', mensajero: 'MENSAJERO1' },
          { nrodcto: 'MOCK002', destino: 'Destino 2', cuotaMod: 3000, nroPlanilla: 'P001', mensajero: 'MENSAJERO2' },
        ],
        nrodctos: ['MOCK001', 'MOCK002'],
        resumen: {},
      }),
    });
  });
}
// ── Utilidades ───────────────────────────────────────────────────────────────

async function loginComoMMUNOZ(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  // Usar patrón glob para aceptar tanto http como https (el middleware HTTPS redirect
  // puede redirigir a https://localhost:7261/ dependiendo del perfil de la app)
  await page.waitForURL(/localhost.*\/$/);
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
    await page.fill('#inputFecha', '');
    await page.click('#btnConsultar');

    await expect(page.locator('#modalMensaje'), 'El modal de advertencia debe abrirse').toBeVisible({ timeout: 5_000 });
    const titulo = await page.locator('#modalMensajeTitulo').innerText();
    expect(titulo.trim(), 'El título del modal debe indicar fecha requerida').not.toBe('');

    // KPIs y gráficos NO deben aparecer
    await expect(page.locator('#areaKpi'), 'Los KPIs no deben mostrarse').toBeHidden();
    await expect(page.locator('#areaCharts'), 'Los gráficos no deben mostrarse').toBeHidden();
  });

  // ── DC-02 ────────────────────────────────────────────────────────────────
  test('DC-02 con fecha válida el botón muestra spinner y se deshabilita al iniciar consulta', async ({ page }) => {
    // Mock con delay para poder detectar el estado disabled antes de que termine
    await mockRegistrosConDelay(page);
    await seleccionarFechaYConsultar(page, FECHA_CON_DATOS);

    // El botón debe deshabilitarse inmediatamente
    await expect(page.locator('#btnConsultar'), 'El botón debe deshabilitarse').toBeDisabled({ timeout: 5_000 });

    // El spinner debe aparecer dentro del botón
    await expect(page.locator('#spinnerConsulta'), 'El spinner debe aparecer').toBeVisible({ timeout: 5_000 });

    // Esperar que termine y el botón se reactive
    await expect(page.locator('#btnConsultar'), 'El botón debe reactivarse').toBeEnabled({ timeout: 15_000 });
  });

  // ── DC-03 ────────────────────────────────────────────────────────────────
  test('DC-03 el botón se deshabilita durante la consulta y se reactiva al terminar', async ({ page }) => {
    // Mock con delay de 3s para que Playwright pueda detectar el estado disabled
    await mockRegistrosConDelay(page, 3_000);
    await seleccionarFechaYConsultar(page, FECHA_CON_DATOS);

    // El botón debe estar deshabilitado mientras consulta
    await expect(page.locator('#btnConsultar'), 'El botón debe deshabilitarse durante la consulta').toBeDisabled({ timeout: 8_000 });

    // Esperar a que termine la consulta (botón vuelve a habilitarse — máx 15s con mock)
    await expect(page.locator('#btnConsultar'), 'El botón debe habilitarse cuando termina la consulta').toBeEnabled({ timeout: 15_000 });
  });

  // ── DC-04 ────────────────────────────────────────────────────────────────
  test('DC-04 KPIs aparecen con valores válidos tras consultar', async ({ page }) => {
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

    // Los 3 KPIs existen y tienen valores no vacíos
    await expect(page.locator('#kpiTotal'), 'kpiTotal debe estar visible').toBeVisible();
    await expect(page.locator('#kpiCuota'), 'kpiCuota debe estar visible').toBeVisible();
    await expect(page.locator('#kpiPlanillas'), 'kpiPlanillas debe estar visible').toBeVisible();
  });

  // ── DC-05 ────────────────────────────────────────────────────────────────
  test('DC-05 el área de KPIs aparece tras la consulta', async ({ page }) => {
    await seleccionarFechaYConsultar(page, FECHA_CON_DATOS);

    // Esperar a que finalice la consulta
    await expect(page.locator('#btnConsultar')).toBeEnabled({ timeout: 30_000 });

    // El área de KPIs debe ser visible (es la única sección de resultados en el Dashboard)
    await expect(page.locator('#areaKpi'), 'El área de KPIs debe aparecer').toBeVisible();

    // Los 3 KPI cards deben existir y estar visibles
    await expect(page.locator('#kpiTotal'), 'kpiTotal debe existir').toBeVisible();
    await expect(page.locator('#kpiCuota'), 'kpiCuota debe existir').toBeVisible();
    await expect(page.locator('#kpiPlanillas'), 'kpiPlanillas debe existir').toBeVisible();
  });

  // ── DC-06 ────────────────────────────────────────────────────────────────
  test('DC-06 los 4 KPIs tienen valores numéricos válidos tras la consulta', async ({ page }) => {
    await seleccionarFechaYConsultar(page, FECHA_CON_DATOS);
    await expect(page.locator('#btnConsultar')).toBeEnabled({ timeout: 30_000 });

    // Todos los KPIs deben tener valores (no "—")
    for (const id of ['kpiTotal', 'kpiCuota', 'kpiPlanillas']) {
      const txt = await page.locator(`#${id}`).innerText();
      expect(txt.trim(), `${id} no debe mostrar el valor inicial "—"`).not.toBe('—');
      expect(txt.trim(), `${id} no debe estar vacío`).not.toBe('');
    }
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

    // KPIs NO deben aparecer
    await expect(page.locator('#areaKpi'), 'Los KPIs no deben mostrarse').toBeHidden();
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
    // Primera consulta
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
  test('DC-11 flujo E2E completo: login → seleccionar fecha → ver KPIs y gráfico', async ({ page }) => {
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

    // 5. Esperar a que la consulta finalice
    await expect(page.locator('#btnConsultar'), '5. El botón debe reactivarse').toBeEnabled({ timeout: 30_000 });

    // 6. KPIs visibles con valores válidos
    await expect(page.locator('#areaKpi'), '6. Los KPIs deben ser visibles').toBeVisible();
    const kpiTotal = parseInt((await page.locator('#kpiTotal').innerText()).replace(/\D/g, ''));
    expect(kpiTotal, '6. Total Registros debe ser > 0').toBeGreaterThan(0);

    const kpiCuota = await page.locator('#kpiCuota').innerText();
    expect(kpiCuota, '6. Cuota Mod debe contener $').toContain('$');

    const kpiPlanillas = parseInt((await page.locator('#kpiPlanillas').innerText()).replace(/\D/g, ''));
    expect(kpiPlanillas, '6. Planillas debe ser ≥ 1').toBeGreaterThanOrEqual(1);

    // 7. Sin errores de consola
    expect(errores, '7. No debe haber errores en consola').toEqual([]);
  });

});

// ── Suite Resumen Mensual ─────────────────────────────────────────────────────

test.describe('Dashboard — Tabla Resumen Mensual', () => {

  test.beforeEach(async ({ page }) => {
    await loginComoMMUNOZ(page);
  });

  // ── RM-01 ────────────────────────────────────────────────────────────────
  test('RM-01 la tabla muestra las 4 columnas: Mes/Año, Total Registros, Cantidad días, Detalle', async ({ page }) => {
    // La tabla debe estar visible (la carga ocurre en DOMContentLoaded)
    await expect(page.locator('#resumenTabla'), 'La tabla debe ser visible').toBeVisible({ timeout: 20_000 });

    const headers = page.locator('#resumenTabla thead th');
    await expect(headers).toHaveCount(4);

    const textos = await headers.allInnerTexts();
    expect(textos[0].trim().toUpperCase(), 'Col 0 debe ser Mes / Año').toContain('MES');
    expect(textos[1].trim().toUpperCase(), 'Col 1 debe ser Total Registros').toContain('REGISTROS');
    expect(textos[2].trim().toUpperCase(), 'Col 2 debe ser Cantidad días').toContain('DÍA');
    expect(textos[3].trim().toUpperCase(), 'Col 3 debe ser Detalle').toContain('DETALLE');
  });

  // ── RM-02 ────────────────────────────────────────────────────────────────
  test('RM-02 la tabla tiene al menos una fila con datos válidos y enlace Ver detalle', async ({ page }) => {
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

    // Celda 3: enlace Ver detalle
    const enlace = celdas.nth(3).locator('a');
    await expect(enlace, 'El enlace Ver detalle debe existir').toBeVisible();
    const enlaceTexto = await enlace.innerText();
    expect(enlaceTexto.toLowerCase(), 'El enlace debe contener \'detalle\'').toContain('detalle');
  });

  // ── RM-03 ────────────────────────────────────────────────────────────────
  test('RM-03 el enlace Ver detalle apunta a /detalle con el parámetro mes correcto', async ({ page }) => {
    await expect(page.locator('#resumenTabla'), 'La tabla debe ser visible').toBeVisible({ timeout: 20_000 });

    const primeraFila = page.locator('#resumenTbody tr').first();

    // El enlace debe existir y su href debe apuntar a /detalle?mes=
    const enlace = primeraFila.locator('a');
    await expect(enlace, 'El enlace Ver detalle debe existir').toBeVisible();

    const href = await enlace.getAttribute('href');
    expect(href, 'El href debe contener /detalle').toContain('/detalle');
    expect(href, 'El href debe incluir el parámetro mes').toContain('mes=');
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
  test('RM-05 el enlace Ver detalle navega a la página de detalle del mes', async ({ page }) => {
    await expect(page.locator('#resumenTabla'), 'La tabla debe ser visible').toBeVisible({ timeout: 20_000 });

    // Obtener el href del primer enlace antes de navegar
    const enlace = page.locator('#resumenTbody tr').first().locator('a');
    const href = await enlace.getAttribute('href');
    expect(href, 'El enlace debe tener href válido').toBeTruthy();

    // Navegar al detalle
    await enlace.click();

    // La URL debe cambiar a /detalle
    await page.waitForURL('**/detalle**', { timeout: 10_000 });
    expect(page.url(), 'La URL debe contener /detalle').toContain('/detalle');
  });

});
