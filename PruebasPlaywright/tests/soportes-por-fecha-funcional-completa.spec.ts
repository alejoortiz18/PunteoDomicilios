/**
 * soportes-por-fecha-funcional-completa.spec.ts
 * ═══════════════════════════════════════════════════════════════════
 * Prueba funcional COMPLETA de la vista Soportes por Fecha.
 *
 * Cobertura:
 *   SPF-F01–F12  Formulario, combobox cartera, validaciones, APIs
 *   SPF-F13–F18  Búsqueda, progreso, tabla, estado vacío
 *   SPF-F20–F36  KPIs, filtros, paginación, modales, CSV y ZIP
 *
 * Requisito: aplicación en https://localhost:7261
 *
 * Ejecutar:
 *   cd PruebasPlaywright
 *   npx playwright test tests/soportes-por-fecha-funcional-completa.spec.ts --headed
 *   npx playwright test tests/soportes-por-fecha-funcional-completa.spec.ts --grep "SPF-F20"
 * ═══════════════════════════════════════════════════════════════════
 */

import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test';

// ── Constantes ───────────────────────────────────────────────────────────────
const USUARIO = 'MMUNOZ';
const BASE_URL = 'https://localhost:7261';
const FECHA_CON_DATOS = '2026-05-06';
const CARTERA_CON_DATOS = 'POS DOMICILIOS ALMACENTRO';
const FECHA_SIN_DATOS = '2099-12-31';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginComoMMUNOZ(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="usuario"]', USUARIO);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/, { timeout: 20_000 });
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 25_000 });
}

async function irASoportesPorFecha(page: Page): Promise<void> {
  await page.locator('.sidebar-nav .nav-item').filter({ hasText: 'Soportes por Fecha' }).click();
  await expect(page).toHaveURL(/\/soportes-por-fecha/);
  await expect(page.locator('#inputCarteraFilter')).toBeEnabled({ timeout: 30_000 });
}

async function seleccionarCartera(page: Page, textoBusqueda: string): Promise<string> {
  const input = page.locator('#inputCarteraFilter');
  await input.click();
  await input.fill(textoBusqueda);
  const opciones = page.locator('#carteraListbox li[data-value]');
  await expect(opciones.first()).toBeVisible({ timeout: 15_000 });

  const buscado = textoBusqueda.trim().toLowerCase();
  const total = await opciones.count();
  let nombre = '';
  for (let i = 0; i < total; i++) {
    const val = ((await opciones.nth(i).getAttribute('data-value')) ?? '').trim();
    if (val.toLowerCase() === buscado) {
      nombre = val;
      await opciones.nth(i).click();
      break;
    }
  }
  if (!nombre) {
    await opciones.first().click();
    nombre = ((await page.locator('#inputCarteraValue').inputValue()) ?? '').trim();
  }
  await expect(page.locator('#inputCarteraValue')).not.toHaveValue('');
  return nombre;
}

async function descargarCsvYVerificar(
  page: Page,
  selector: string,
  patronNombre: RegExp,
): Promise<void> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 45_000 }),
    page.locator(selector).click(),
  ]);
  const name = download.suggestedFilename();
  expect(name).toMatch(patronNombre);
  console.log(`CSV descargado: ${name}`);
}

async function llenarFormularioBusqueda(
  page: Page,
  fecha: string = FECHA_CON_DATOS,
  cartera: string = CARTERA_CON_DATOS,
): Promise<void> {
  await page.fill('#inputFecha', fecha);
  await seleccionarCartera(page, cartera);
  await expect(page.locator('#btnBuscar')).toBeEnabled();
}

async function clickBuscar(page: Page): Promise<void> {
  await page.click('#btnBuscar');
  await expect(page.locator('#seccionResultados')).toBeVisible({ timeout: 15_000 });
}

/** Espera fin de carga de facturas (skeleton oculto). */
async function esperarCargaFacturas(page: Page): Promise<void> {
  await expect(page.locator('#panelLoading')).toBeHidden({ timeout: 90_000 });
  await expect(async () => {
    const tabla = await page.locator('#panelTabla').isVisible();
    const vacio = await page.locator('#panelVacio').isVisible();
    expect(tabla || vacio).toBe(true);
  }).toPass({ timeout: 20_000 });
}

/** Espera fin del batch de soportes (barra progreso oculta + KPI visible). */
async function esperarBatchSoportes(page: Page, timeoutMs = 600_000): Promise<void> {
  await esperarCargaFacturas(page);
  const vacio = await page.locator('#panelVacio').isVisible();
  if (vacio) return;
  await expect(page.locator('#panelTabla')).toBeVisible();
  await expect(page.locator('#panelProgreso')).toBeHidden({ timeout: timeoutMs });
  await expect(page.locator('#panelKpi')).toBeVisible({ timeout: 15_000 });
}

async function cerrarModalMensaje(page: Page): Promise<void> {
  const modal = page.locator('#modalMensaje');
  if (await modal.isVisible()) {
    await page.locator('#modalMensaje .btn-close, #modalMensaje button').first().click();
    await expect(modal).toBeHidden({ timeout: 5_000 });
  }
}

function parseKpi(text: string | null): number {
  return parseInt((text ?? '0').replace(/\D/g, ''), 10) || 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// SUITE A — Formulario, combobox y validaciones (rápida)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('SPF-F — Formulario y combobox', () => {
  test.use({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

  test.beforeEach(async ({ page }) => {
    await loginComoMMUNOZ(page);
    await irASoportesPorFecha(page);
  });

  test('SPF-F01 estructura inicial de la vista', async ({ page }) => {
    await expect(page.locator('.topbar-title')).toHaveText(/Soportes por Fecha/);
    await expect(page.locator('.section-card').first().locator('h2.section-title'))
      .toContainText(/Soportes por Fecha/);
    await expect(page.locator('#inputFecha')).toBeVisible();
    await expect(page.locator('#inputCarteraFilter')).toBeVisible();
    await expect(page.locator('#carteraListbox')).toHaveClass(/d-none/);
    await expect(page.locator('#btnBuscar')).toBeVisible();
    await expect(page.locator('#seccionResultados')).toBeHidden();
    await expect(page.locator('#panelKpi')).toBeHidden();
  });

  test('SPF-F02 enlace del menú lateral activo y URL correcta', async ({ page }) => {
    const nav = page.locator('.sidebar-nav .nav-item').filter({ hasText: 'Soportes por Fecha' });
    await expect(nav).toHaveClass(/active/);
    await expect(page).toHaveURL(/\/soportes-por-fecha$/);
  });

  test('SPF-F03 fecha de facturación precargada con el día actual', async ({ page }) => {
    const hoy = new Date().toISOString().split('T')[0];
    await expect(page.locator('#inputFecha')).toHaveValue(hoy);
  });

  test('SPF-F04 combobox de cartera: carga catálogo y habilita el input', async ({ page }) => {
    await expect(page.locator('#carteraLoading')).toBeHidden({ timeout: 30_000 });
    await expect(page.locator('#carteraError')).toBeHidden();
    await expect(page.locator('#inputCarteraFilter')).toBeEnabled();
    const opciones = page.locator('#carteraListbox li[data-value]');
    await page.locator('#inputCarteraFilter').click();
    await expect(opciones.first()).toBeVisible({ timeout: 10_000 });
    const count = await opciones.count();
    expect(count, 'Debe haber al menos un tipo de cartera').toBeGreaterThan(0);
  });

  test('SPF-F05 API tipos-cartera devuelve arreglo JSON', async ({ page }) => {
    const res = await page.request.get('/api/soportes-por-fecha/tipos-cartera');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const unicos = new Set(data as string[]);
    expect(unicos.size).toBe(data.length);
  });

  test('SPF-F06 combobox filtra opciones al escribir', async ({ page }) => {
    await page.locator('#inputCarteraFilter').fill('POS DOMICILIOS');
    const opciones = page.locator('#carteraListbox li[data-value]');
    await expect(opciones.first()).toBeVisible({ timeout: 10_000 });
    const count = await opciones.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(opciones.nth(i)).toContainText(/POS DOMICILIOS/i);
    }
  });

  test('SPF-F07 combobox muestra "Sin coincidencias" si no hay match', async ({ page }) => {
    await page.locator('#inputCarteraFilter').fill('ZZZ_CARTERA_INEXISTENTE_XYZ');
    await expect(page.locator('#carteraListbox .combobox-empty')).toContainText(/Sin coincidencias/i);
    await expect(page.locator('#btnBuscar')).toBeDisabled();
  });

  test('SPF-F08 combobox: teclado ArrowDown + Enter selecciona opción', async ({ page }) => {
    const input = page.locator('#inputCarteraFilter');
    await input.click();
    await input.fill('POS');
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page.locator('#inputCarteraValue')).not.toHaveValue('');
    await expect(page.locator('#btnBuscar')).toBeEnabled();
  });

  test('SPF-F09 combobox se cierra al hacer clic fuera', async ({ page }) => {
    await page.locator('#inputCarteraFilter').click();
    await expect(page.locator('#carteraListbox')).not.toHaveClass(/d-none/);
    await page.locator('h2.section-title').first().click();
    await expect(page.locator('#carteraListbox')).toHaveClass(/d-none/);
  });

  test('SPF-F10 botón Buscar deshabilitado sin cartera seleccionada', async ({ page }) => {
    await page.fill('#inputFecha', FECHA_CON_DATOS);
    await expect(page.locator('#btnBuscar')).toBeDisabled();
  });

  test('SPF-F11 modal si se busca sin cartera', async ({ page }) => {
    await page.fill('#inputFecha', FECHA_CON_DATOS);
    await page.evaluate(() => {
      const btn = document.getElementById('btnBuscar') as HTMLButtonElement | null;
      if (btn) btn.disabled = false;
      (window as unknown as { buscarFacturas: () => void }).buscarFacturas?.();
    });
    await expect(page.locator('#modalMensaje')).toBeVisible();
    await expect(page.locator('#modalMensajeBody')).toContainText(/cartera/i);
    await cerrarModalMensaje(page);
  });

  test('SPF-F12 modal si se busca sin fecha', async ({ page }) => {
    await seleccionarCartera(page, CARTERA_CON_DATOS);
    await page.evaluate(() => {
      const fecha = document.getElementById('inputFecha') as HTMLInputElement | null;
      if (fecha) fecha.value = '';
      (window as unknown as { buscarFacturas: () => void }).buscarFacturas?.();
    });
    await expect(page.locator('#modalMensaje')).toBeVisible();
    await expect(page.locator('#modalMensajeBody')).toContainText(/fecha/i);
    await cerrarModalMensaje(page);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE B — Búsqueda, progreso y estados de resultados
// ══════════════════════════════════════════════════════════════════════════════
test.describe('SPF-F — Búsqueda y estados', () => {
  test.use({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

  test.beforeEach(async ({ page }) => {
    await loginComoMMUNOZ(page);
    await irASoportesPorFecha(page);
  });

  test('SPF-F13 búsqueda actualiza título de resultados', async ({ page }) => {
    await llenarFormularioBusqueda(page);
    await clickBuscar(page);
    await expect(page.locator('#tituloResultados')).toContainText(/06\/05\/2026/);
  });

  test('SPF-F14 skeleton y spinner durante la carga de facturas', async ({ page }) => {
    await llenarFormularioBusqueda(page);
    await page.click('#btnBuscar');
    await expect(page.locator('#seccionResultados')).toBeVisible();
    await expect(async () => {
      const spinner = await page.locator('#spinnerBuscar').isVisible();
      const skeleton = await page.locator('#panelLoading').isVisible();
      const listo = await page.locator('#panelTabla, #panelVacio').first().isVisible();
      expect(spinner || skeleton || listo).toBe(true);
    }).toPass({ timeout: 30_000 });
    await esperarCargaFacturas(page);
    await expect(page.locator('#spinnerBuscar')).toHaveClass(/d-none/);
  });

  test('SPF-F15 barra de progreso durante verificación de soportes', async ({ page }) => {
    await llenarFormularioBusqueda(page);
    await page.click('#btnBuscar');
    await expect(page.locator('#seccionResultados')).toBeVisible({ timeout: 15_000 });

    // La barra puede ocultarse rápido; aceptamos verla en algún momento o KPI al finalizar
    await expect(async () => {
      const progreso = await page.locator('#panelProgreso').isVisible();
      const kpi = await page.locator('#panelKpi').isVisible();
      const vacio = await page.locator('#panelVacio').isVisible();
      expect(progreso || kpi || vacio).toBe(true);
    }).toPass({ timeout: 120_000 });

    if (await page.locator('#panelVacio').isVisible()) return;

    const progresoVisible = await page.locator('#panelProgreso').isVisible();
    if (progresoVisible) {
      await expect(page.locator('#panelProgContador')).not.toBeEmpty();
      await expect(page.locator('#panelProgFill')).toBeVisible();
    } else {
      await expect(page.locator('#panelKpi')).toBeVisible();
      expect(parseKpi(await page.locator('#kpiTotal').textContent())).toBeGreaterThan(0);
    }
  });

  test('SPF-F16 tabla con columnas esperadas', async ({ page }) => {
    await llenarFormularioBusqueda(page);
    await clickBuscar(page);
    await esperarBatchSoportes(page, 120_000);
    if (await page.locator('#panelVacio').isVisible()) {
      test.skip(true, 'Sin facturas en BD para fecha de prueba');
      return;
    }
    const headers = page.locator('.punteo-table thead th');
    await expect(headers).toHaveCount(12);
    for (const texto of ['OrdenEntMV', 'TIPODCTO', 'NRODCTO', 'Fecha orden', 'TipoCar', 'Estado', 'Acción']) {
      await expect(page.locator('.punteo-table thead')).toContainText(texto);
    }
    await expect(page.locator('.punteo-table thead')).not.toContainText('DCTOPRV');
    await expect(page.locator('#resultadosTbody tr').first()).toBeVisible();
  });

  test('SPF-F17 estado vacío cuando no hay facturas para la fecha', async ({ page }) => {
    await page.fill('#inputFecha', FECHA_SIN_DATOS);
    await seleccionarCartera(page, CARTERA_CON_DATOS);
    await clickBuscar(page);
    await esperarCargaFacturas(page);
    await expect(page.locator('#panelVacio')).toBeVisible();
    await expect(page.locator('#panelVacio')).toContainText(/No se encontraron facturas/i);
    await expect(page.locator('#panelTabla')).toBeHidden();
    await expect(page.locator('#kpiTotal')).toHaveText('0');
  });

  test('SPF-F18 Enter en el campo fecha dispara búsqueda', async ({ page }) => {
    await llenarFormularioBusqueda(page);
    await page.locator('#inputFecha').press('Enter');
    await expect(page.locator('#seccionResultados')).toBeVisible({ timeout: 15_000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE C — KPIs, filtros, paginación, modales y descargas (post-batch)
// Una sola sesión: el batch se espera UNA vez en beforeAll.
// ══════════════════════════════════════════════════════════════════════════════
test.describe('SPF-F — KPIs, filtros y descargas (post-batch)', () => {
  test.use({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
  test.setTimeout(900_000);

  let sharedPage: Page;
  let sharedContext: BrowserContext;
  let kpiTotal = 0;
  let kpiEncontrados = 0;
  let kpiFaltantes = 0;
  let terminoFiltro = '';

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    sharedContext = await browser.newContext({ ignoreHTTPSErrors: true });
    sharedPage = await sharedContext.newPage();

    await loginComoMMUNOZ(sharedPage);
    await irASoportesPorFecha(sharedPage);
    await llenarFormularioBusqueda(sharedPage);
    await clickBuscar(sharedPage);

    console.log('beforeAll → Esperando fin del batch de soportes (hasta 10 min)...');
    await esperarBatchSoportes(sharedPage, 600_000);

    if (await sharedPage.locator('#panelVacio').isVisible()) {
      throw new Error(
        `Sin facturas para ${FECHA_CON_DATOS} / ${CARTERA_CON_DATOS}. ` +
          'Ajuste FECHA_CON_DATOS o CARTERA_CON_DATOS en el spec.',
      );
    }

    kpiTotal = parseKpi(await sharedPage.locator('#kpiTotal').textContent());
    if (kpiTotal < 2) {
      console.warn(
        `beforeAll → Solo ${kpiTotal} factura(s) para la cartera seleccionada. ` +
          'Algunos casos (paginación, ZIP masivo) se omitirán.',
      );
    }
    kpiEncontrados = parseKpi(await sharedPage.locator('#kpiEncontrados').textContent());
    kpiFaltantes = parseKpi(await sharedPage.locator('#kpiFaltantes').textContent());

      const primerCodigo = await sharedPage.locator('#resultadosTbody tr code').first().textContent();
      terminoFiltro = (primerCodigo ?? '').trim().replace(/—/g, '').slice(0, 6);
    if (!terminoFiltro) terminoFiltro = 'FR';

    console.log(`beforeAll → KPI total=${kpiTotal} encontrados=${kpiEncontrados} faltantes=${kpiFaltantes}`);
  });

  test.afterAll(async () => {
    await sharedContext?.close();
  });

  test('SPF-F20 panel KPI visible y valores coherentes', async () => {
    await expect(sharedPage.locator('#panelKpi')).toBeVisible();
    expect(kpiTotal).toBeGreaterThan(0);
    expect(kpiEncontrados + kpiFaltantes).toBe(kpiTotal);
    await expect(sharedPage.locator('#inputBuscarTabla')).toBeVisible();
    await expect(sharedPage.locator('#btnDescargarFiltrados')).toBeVisible();
    await expect(sharedPage.locator('#btnDescargarListaFiltrados')).toBeVisible();
    await expect(sharedPage.locator('#btnDescargarTodos')).toBeVisible();
    await expect(sharedPage.locator('#btnDescargarListaEncontrados')).toBeVisible();
    await expect(sharedPage.locator('#btnVerFaltantes')).toBeVisible();
    await expect(sharedPage.locator('#btnDescargarLista')).toBeVisible();
  });

  test('SPF-F21 filas con etiquetas de estado (encontrado / faltante / pendiente)', async () => {
    const tags = sharedPage.locator('#resultadosTbody .tag');
    await expect(tags.first()).toBeVisible();
    const totalTags = await tags.count();
    expect(totalTags).toBeGreaterThan(0);
    const hayVerde = await sharedPage.locator('#resultadosTbody .tag-green').count();
    const hayRojo = await sharedPage.locator('#resultadosTbody .tag-red').count();
    const hayAmarillo = await sharedPage.locator('#resultadosTbody .tag-yellow').count();
    const hayAzul = await sharedPage.locator('#resultadosTbody .tag-blue').count();
    console.log(
      `SPF-F21 → tags: ${totalTags}, verde: ${hayVerde}, rojo: ${hayRojo}, amarillo: ${hayAmarillo}, azul: ${hayAzul}`,
    );
    expect(hayVerde + hayRojo + hayAmarillo + hayAzul).toBeGreaterThan(0);
  });

  test('SPF-F22 botones de descarga según KPIs', async () => {
    if (kpiEncontrados > 0) {
      await expect(sharedPage.locator('#btnDescargarTodos')).toBeEnabled();
      await expect(sharedPage.locator('#btnDescargarListaEncontrados')).toBeEnabled();
    } else {
      await expect(sharedPage.locator('#btnDescargarTodos')).toBeDisabled();
    }
    if (kpiFaltantes > 0) {
      await expect(sharedPage.locator('#btnVerFaltantes')).toBeEnabled();
      await expect(sharedPage.locator('#btnDescargarLista')).toBeEnabled();
    } else {
      await expect(sharedPage.locator('#btnVerFaltantes')).toBeDisabled();
    }
    await expect(sharedPage.locator('#btnDescargarFiltrados')).toBeDisabled();
    await expect(sharedPage.locator('#btnDescargarListaFiltrados')).toBeDisabled();
  });

  test('SPF-F23 filtrar tabla por texto reduce filas visibles', async () => {
    const filasAntes = await sharedPage.locator('#resultadosTbody tr').count();
    await sharedPage.fill('#inputBuscarTabla', terminoFiltro);
    await expect(sharedPage.locator('#resultadosTbody tr').first()).toBeVisible();
    const filasDespues = await sharedPage.locator('#resultadosTbody tr').count();
    expect(filasDespues).toBeLessThanOrEqual(filasAntes);
    expect(filasDespues).toBeGreaterThan(0);
    if (kpiEncontrados > 0) {
      await expect(sharedPage.locator('#btnDescargarFiltrados')).toBeEnabled();
    }
    await expect(sharedPage.locator('#btnDescargarListaFiltrados')).toBeEnabled();
  });

  test('SPF-F24 limpiar búsqueda restaura todas las filas de la página', async () => {
    await sharedPage.fill('#inputBuscarTabla', '');
    const filas = await sharedPage.locator('#resultadosTbody tr').count();
    expect(filas).toBeGreaterThan(0);
    expect(filas).toBeLessThanOrEqual(10);
    await expect(sharedPage.locator('#btnDescargarFiltrados')).toBeDisabled();
  });

  test('SPF-F25 Ver faltantes filtra solo registros sin soporte', async () => {
    const rojosAntes = await sharedPage.locator('#resultadosTbody .tag-red').count();
    test.skip(rojosAntes === 0, 'No hay filas con estado Sin soporte (tag-red)');
    await sharedPage.locator('#btnVerFaltantes').click();
    await expect(sharedPage.locator('#btnVerFaltantes')).toContainText(/Ver todos/i);
    const rojos = await sharedPage.locator('#resultadosTbody .tag-red').count();
    const filas = await sharedPage.locator('#resultadosTbody tr').count();
    expect(rojos).toBe(filas);
    expect(rojos).toBeGreaterThan(0);
  });

  test('SPF-F26 Ver todos restaura la tabla completa', async () => {
    test.skip(kpiFaltantes === 0, 'No hay faltantes en los datos de prueba');
    if (!(await sharedPage.locator('#btnVerFaltantes').textContent())?.includes('todos')) {
      await sharedPage.locator('#btnVerFaltantes').click();
    }
    await sharedPage.locator('#btnVerFaltantes').click();
    await expect(sharedPage.locator('#btnVerFaltantes')).toContainText(/^🔍 Ver$/);
    const filas = await sharedPage.locator('#resultadosTbody tr').count();
    expect(filas).toBeGreaterThan(0);
  });

  test('SPF-F27 escribir en buscar tabla sale del modo Ver faltantes', async () => {
    test.skip(
      (await sharedPage.locator('#resultadosTbody .tag-red').count()) === 0,
      'No hay filas tag-red',
    );
    await sharedPage.locator('#btnVerFaltantes').click();
    await sharedPage.fill('#inputBuscarTabla', 'x');
    await expect(sharedPage.locator('#btnVerFaltantes')).toContainText(/^🔍 Ver$/);
    await sharedPage.fill('#inputBuscarTabla', '');
  });

  test('SPF-F28 paginación visible y navegación a página 2', async () => {
    test.skip(kpiTotal <= 10, 'Menos de 11 registros: no hay paginación');
    await expect(sharedPage.locator('#pagResultados')).toBeVisible();
    await expect(sharedPage.locator('#pagResultados .pag-info')).toContainText(/Mostrando/);
    const primeraFilaP1 = await sharedPage.locator('#resultadosTbody tr').first().textContent();
    await sharedPage.locator('#pagResultados .pag-nav button[aria-label="Página siguiente"]').click();
    const primeraFilaP2 = await sharedPage.locator('#resultadosTbody tr').first().textContent();
    expect(primeraFilaP2).not.toBe(primeraFilaP1);
    await sharedPage.locator('#pagResultados .pag-nav button[aria-label="Página anterior"]').click();
  });

  test('SPF-F29 modal Ver soporte en fila encontrada', async () => {
    test.skip(kpiEncontrados === 0, 'No hay soportes encontrados');
    const btnVer = sharedPage.locator('#resultadosTbody button', { hasText: /Ver soporte/i }).first();
    await expect(btnVer).toBeVisible({ timeout: 10_000 });
    await btnVer.click();
    await expect(sharedPage.locator('#modalSoporte')).toBeVisible();
    await expect(sharedPage.locator('#modalSoporteBody')).toContainText(/Clave documento/i);
    await expect(sharedPage.locator('#modalDescargaLink')).toBeVisible();
    await sharedPage.locator('#modalSoporte .btn-close').click();
    await expect(sharedPage.locator('#modalSoporte')).toBeHidden();
  });

  test('SPF-F30 descarga CSV de encontrados', async () => {
    test.skip(kpiEncontrados === 0, 'No hay soportes encontrados');
    await descargarCsvYVerificar(
      sharedPage,
      '#btnDescargarListaEncontrados',
      /encontrados_.*\.csv$/i,
    );
  });

  test('SPF-F31 descarga CSV de faltantes', async () => {
    test.skip(
      (await sharedPage.locator('#resultadosTbody .tag-red').count()) === 0,
      'No hay filas marcadas como Sin soporte',
    );
    await descargarCsvYVerificar(sharedPage, '#btnDescargarLista', /faltantes_.*\.csv$/i);
  });

  test('SPF-F32 descarga CSV de filtrados', async () => {
    await sharedPage.fill('#inputBuscarTabla', terminoFiltro);
    await descargarCsvYVerificar(
      sharedPage,
      '#btnDescargarListaFiltrados',
      /lista_.*\.csv$/i,
    );
    await sharedPage.fill('#inputBuscarTabla', '');
  });

  test('SPF-F33 descarga ZIP de todos los encontrados', async () => {
    test.skip(kpiEncontrados === 0, 'No hay soportes para ZIP');
    const [download] = await Promise.all([
      sharedPage.waitForEvent('download', { timeout: 120_000 }),
      sharedPage.locator('#btnDescargarTodos').click(),
    ]);
    await expect(sharedPage.locator('#zipProgreso')).toBeVisible({ timeout: 10_000 });
    const name = download.suggestedFilename();
    expect(name).toMatch(/soportes_fecha_.*\.zip$/i);
    console.log(`SPF-F33 → ZIP: ${name}`);
  });

  test('SPF-F34 descarga ZIP de filtrados con soporte', async () => {
    test.skip(kpiEncontrados === 0, 'No hay soportes para ZIP filtrado');
    await sharedPage.fill('#inputBuscarTabla', terminoFiltro);
    const btnZip = sharedPage.locator('#btnDescargarFiltrados');
    const habilitado = await btnZip.isEnabled();
    if (!habilitado) {
      test.skip(true, 'El filtro actual no incluye filas con soporte');
      return;
    }
    const [download] = await Promise.all([
      sharedPage.waitForEvent('download', { timeout: 120_000 }),
      btnZip.click(),
    ]);
    const name = download.suggestedFilename();
    expect(name).toMatch(/soportes_.*\.zip$/i);
    await sharedPage.fill('#inputBuscarTabla', '');
  });

  test('SPF-F35 descargar filtrados sin soportes muestra modal informativo', async () => {
    await sharedPage.fill('#inputBuscarTabla', 'ZZZ_SIN_SOPORTE_XYZ_999');
    await expect(sharedPage.locator('#resultadosTbody tr')).toHaveCount(0);
    await sharedPage.evaluate(() => {
      (window as unknown as { descargarFiltrados: () => void }).descargarFiltrados?.();
    });
    await expect(sharedPage.locator('#modalMensaje')).toBeVisible({ timeout: 5_000 });
    await expect(sharedPage.locator('#modalMensajeBody')).toContainText(/registros|soportes|resultados/i);
    await cerrarModalMensaje(sharedPage);
    await sharedPage.fill('#inputBuscarTabla', '');
  });

  test('SPF-F36 API facturas responde con arreglo para fecha y cartera', async () => {
    const cartera = await sharedPage.locator('#inputCarteraValue').inputValue();
    const res = await sharedPage.request.get(
      `/api/soportes-por-fecha/facturas?fecha=${FECHA_CON_DATOS}&nombreCartera=${encodeURIComponent(cartera)}`,
    );
    expect(res.ok()).toBeTruthy();
    const facturas = await res.json();
    expect(Array.isArray(facturas)).toBe(true);
    expect(facturas.length).toBe(kpiTotal);
    if (facturas.length > 0) {
      expect(facturas[0]).toHaveProperty('tipoDcto');
      expect(facturas[0]).toHaveProperty('tipoDc');
      expect(facturas[0]).toHaveProperty('claveSoporte');
      expect(facturas[0]).toHaveProperty('tipoFactura');
    }
  });
});
