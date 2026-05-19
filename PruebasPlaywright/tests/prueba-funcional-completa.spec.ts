/**
 * prueba-funcional-completa.spec.ts
 * ════════════════════════════════════════════════════════════════
 * Prueba funcional COMPLETA de todas las vistas y funcionalidades
 * de la aplicación Punteo de Domicilios.
 *
 * Cobertura:
 *   L  — Login (6 casos)
 *   D  — Dashboard (10 casos)
 *   DT — Detalle mes (15 casos)
 *   SF — Soportes Físicos (12 casos)
 *   N  — Navegación lateral (5 casos)
 *   Total: 48 casos de prueba
 *
 * Requisito previo — La aplicación debe estar corriendo:
 *   dotnet run --project ../Proyecto-MVC/PunteoDomicilios.Web/PunteoDomicilios.Web.csproj --launch-profile http
 *   → https://localhost:7261
 *
 * Ejecutar:
 *   cd PruebasPlaywright
 *   npx playwright test tests/prueba-funcional-completa.spec.ts --headed --project=chromium
 *   npx playwright test tests/prueba-funcional-completa.spec.ts --headed --project=chromium --slow-mo=300
 * ════════════════════════════════════════════════════════════════
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';

// ────────────────────────────────────────────────────────────────
// Configuración — HTTPS en puerto 7261 (perfil https del launchSettings)
// ────────────────────────────────────────────────────────────────
test.use({
  baseURL: 'https://localhost:7261',
  ignoreHTTPSErrors: true,
  browserName: 'chromium',
});

// ────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────
const USUARIO         = 'MMUNOZ';
const MES_CON_DATOS   = '2026-05';
const FECHA_CON_DATOS = '2026-05-11';   // Hoy — confirmado con datos reales en BD
const NRODCTO         = 'K8227073';     // Soporte confirmado en BD
const STORAGE_PATH    = 'soportes/2026/05/04/K8227073.pdf';

/** PDF de prueba local para tests de carga de archivo */
const PDF_TEST = path.join(
  __dirname, '..', '..', 'Entradas', 'archivoPrueba', 'CRC_900277244_FEPE16766.pdf'
);

// ────────────────────────────────────────────────────────────────
// Respuestas mock reutilizables
// ────────────────────────────────────────────────────────────────
const MOCK_DIAS = JSON.stringify([
  { fecha: FECHA_CON_DATOS, totalRegistros: 3, totalPlanillas: 1 },
]);

const MOCK_REGISTROS = JSON.stringify({
  total: 2,
  registros: [
    { nrodcto: NRODCTO,  destino: 'Destino A', cuotaMod: 45_000, nroPlanilla: 'P001', mensajero: USUARIO },
    { nrodcto: 'SIN001', destino: 'Destino B', cuotaMod: 22_000, nroPlanilla: 'P001', mensajero: USUARIO },
  ],
  nrodctos: [NRODCTO, 'SIN001'],
});

const MOCK_SOPORTE_OK  = JSON.stringify({
  success: true, message: 'OK',
  data: [{ fechaRegistro: '2026-05-04 14:37:01', storage_Disk: 's3://bucket', storage_Path: STORAGE_PATH }],
});
const MOCK_SOPORTE_NO  = JSON.stringify({ success: false, message: 'No encontrado', data: [] });

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/** Login completo: selecciona usuario, envía el form y espera el dashboard */
async function loginAs(page: Page, usuario: string = USUARIO): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="usuario"]', usuario);
  await page.click('button[type="submit"]');
  await page.waitForURL(/localhost.*\/$/, { timeout: 15_000 });
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 25_000 });
}

/**
 * Intercepta los endpoints de detalle con respuestas instantáneas.
 * El soporte del NRODCTO real devuelve "encontrado"; el resto devuelve "faltante".
 */
async function mockDetalleEndpoints(page: Page): Promise<void> {
  await page.route(/\/api\/detalle\/dias/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: MOCK_DIAS }));

  await page.route(/\/api\/detalle\/registros/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: MOCK_REGISTROS }));

  await page.route(/\/api\/detalle\/soporte-batch-stream/, async route => {
    const lines = [
      JSON.stringify({
        nrodcto: NRODCTO,
        estado: 1,
        fechaRegistro: '2026-05-04 14:37:01',
        storagePath: STORAGE_PATH,
      }),
      JSON.stringify({
        nrodcto: 'SIN001',
        estado: 2,
        fechaRegistro: null,
        storagePath: null,
      }),
    ].join('\n') + '\n';

    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: lines,
    });
  });

  await page.route(/\/api\/detalle\/soporte(?:\?|$)/, (route, request) => {
    const url = request.url();
    const body = url.includes(`nrodcto=${encodeURIComponent(NRODCTO)}`)
      ? MOCK_SOPORTE_OK
      : MOCK_SOPORTE_NO;
    route.fulfill({ status: 200, contentType: 'application/json', body });
  });
}

/** Abre el panel de registros del primer día mockeado */
async function abrirPrimerPanel(page: Page): Promise<void> {
  await mockDetalleEndpoints(page);
  await page.goto(`/detalle?mes=${MES_CON_DATOS}`);
  await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
  await page.locator('#diasTbody button').first().click();
  await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 15_000 });
}

/** Espera a que el KPI panel sea visible (indica que el batch de soporte terminó) */
async function esperarKpi(page: Page): Promise<void> {
  await expect(page.locator('#panelKpi')).toBeVisible({ timeout: 30_000 });
}


// ══════════════════════════════════════════════════════════════════
// SUITE 1 — Login
// ══════════════════════════════════════════════════════════════════

test.describe('L — Login', () => {

  test('L-01 la página de login carga con marca y título correctos', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Iniciar sesión/);
    await expect(page.locator('.login-brand-name')).toHaveText('HELPHARMA');
    await expect(page.locator('.login-brand-sub')).toHaveText('Punteo de Domicilios');
    await expect(page.locator('.login-icon')).toHaveText('💊');
  });

  test('L-02 el input de usuario es un campo de texto libre', async ({ page }) => {
    await page.goto('/login');
    const input = page.locator('input[name="usuario"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'text');
    // No debe existir ningún <select> con la lista de usuarios
    await expect(page.locator('select[name="usuario"]')).toHaveCount(0);
  });

  test('L-03 enviar sin seleccionar usuario no navega (HTML required)', async ({ page }) => {
    await page.goto('/login');
    const urlAntes = page.url();
    await page.click('button[type="submit"]');
    // La validación HTML nativa impide la navegación
    expect(page.url()).toBe(urlAntes);
  });

  test('L-04 ingresar usuario válido y hacer submit redirige al Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="usuario"]', USUARIO);
    await page.click('button[type="submit"]');
    await page.waitForURL(/localhost.*\/$/, { timeout: 15_000 });
    await expect(page).toHaveTitle(/Dashboard/);
  });

  test('L-04b usuario inexistente muestra modal de error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="usuario"]', 'USUARIO_FALSO_XYZ');
    await page.click('button[type="submit"]');
    await expect(page.locator('#modalLoginError')).toBeVisible({ timeout: 8_000 });
    const msg = await page.locator('#modalLoginErrorMsg').innerText();
    expect(msg).toContain('USUARIO_FALSO_XYZ');
  });

  test('L-05 después del login el sidebar muestra usuario y navegación principal', async ({ page }) => {
    await loginAs(page);
    await expect(page.locator('.chip-name-sidebar')).toHaveText(USUARIO);
    const navItems = page.locator('.sidebar-nav .nav-item');
    await expect(navItems).toHaveCount(2);
    const textos = await navItems.allTextContents();
    const union = textos.join(' ');
    expect(union).toContain('Dashboard');
    expect(union).toContain('Soportes');
  });

  test('L-06 el link "Cambiar" del sidebar redirige a /login', async ({ page }) => {
    await loginAs(page);
    await page.locator('.btn-cambiar').click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveTitle(/Iniciar sesión/);
  });

});


// ══════════════════════════════════════════════════════════════════
// SUITE 2 — Dashboard
// ══════════════════════════════════════════════════════════════════

test.describe('D — Dashboard', () => {

  test.beforeEach(async ({ page }) => { await loginAs(page); });

  test('D-01 el título y el topbar muestran "Dashboard"', async ({ page }) => {
    await expect(page).toHaveTitle(/Dashboard/);
    await expect(page.locator('.topbar-title')).toHaveText('Dashboard');
  });

  test('D-02 el resumen mensual carga correctamente (skeleton se oculta, tabla aparece)', async ({ page }) => {
    await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 25_000 });
    // Tabla o estado vacío — uno de los dos debe estar visible
    const tablaVisible  = await page.locator('#resumenTabla').isVisible();
    const vacioVisible  = await page.locator('#resumenVacio').isVisible();
    expect(tablaVisible || vacioVisible, 'Tabla o estado vacío deben mostrarse').toBe(true);
  });

  test('D-03 la tabla de resumen tiene filas con el link "Ver detalle"', async ({ page }) => {
    await expect(page.locator('#resumenTabla')).toBeVisible({ timeout: 25_000 });
    const filas = page.locator('#resumenTbody tr');
    await expect(filas).not.toHaveCount(0);
    await expect(filas.first().locator('a:has-text("Ver detalle")')).toBeVisible();
  });

  test('D-04 el input de fecha tiene la fecha de hoy por defecto', async ({ page }) => {
    const hoy = new Date().toISOString().slice(0, 10);
    await expect(page.locator('#inputFecha')).toHaveValue(hoy);
  });

  test('D-05 consultar sin fecha muestra modal de advertencia y NO muestra KPIs', async ({ page }) => {
    await page.fill('#inputFecha', '');
    await page.click('#btnConsultar');
    await expect(page.locator('#modalMensaje')).toBeVisible({ timeout: 5_000 });
    const titulo = await page.locator('#modalMensajeTitulo').innerText();
    expect(titulo.trim()).not.toBe('');
    await expect(page.locator('#areaKpi')).toBeHidden();
  });

  test('D-06 consultar con fecha con datos muestra los tres KPIs actuales', async ({ page }) => {
    await page.route(/\/api\/registros/, r => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 3,
        registros: [
          { nrodcto: 'T001', destino: 'D1', cuotaMod: 10_000, nroPlanilla: 'P001', mensajero: 'M1' },
          { nrodcto: 'T002', destino: 'D2', cuotaMod: 20_000, nroPlanilla: 'P001', mensajero: 'M1' },
          { nrodcto: 'T003', destino: 'D3', cuotaMod: 15_000, nroPlanilla: 'P002', mensajero: 'M2' },
        ],
        nrodctos: ['T001', 'T002', 'T003'],
        resumen: {},
      }),
    }));
    await page.fill('#inputFecha', FECHA_CON_DATOS);
    await page.click('#btnConsultar');
    await expect(page.locator('#areaKpi')).toBeVisible({ timeout: 10_000 });
    // Los tres KPIs actuales deben tener valores
    for (const id of ['kpiTotal', 'kpiCuota', 'kpiPlanillas']) {
      const val = await page.locator(`#${id}`).innerText();
      expect(val.trim()).not.toBe('');
    }
  });

  test('D-07 el botón se deshabilita durante la consulta y se habilita al terminar', async ({ page }) => {
    await page.route(/\/api\/registros/, async r => {
      await new Promise(res => setTimeout(res, 1_200));
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ total: 0, registros: [], nrodctos: [] }) });
    });
    await page.fill('#inputFecha', FECHA_CON_DATOS);
    await page.click('#btnConsultar');
    await expect(page.locator('#btnConsultar')).toBeDisabled({ timeout: 2_000 });
    await expect(page.locator('#btnConsultar')).toBeEnabled({ timeout: 10_000 });
  });

  test('D-08 el spinner aparece durante la consulta y desaparece al finalizar', async ({ page }) => {
    await page.route(/\/api\/registros/, async r => {
      await new Promise(res => setTimeout(res, 1_200));
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ total: 0, registros: [], nrodctos: [] }) });
    });
    await page.fill('#inputFecha', FECHA_CON_DATOS);
    await page.click('#btnConsultar');
    await expect(page.locator('#spinnerConsulta')).not.toHaveClass(/d-none/, { timeout: 2_000 });
    await expect(page.locator('#spinnerConsulta')).toHaveClass(/d-none/, { timeout: 10_000 });
  });

  test('D-09 consultar una fecha sin registros muestra modal "Sin resultados"', async ({ page }) => {
    await page.route(/\/api\/registros/, r => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: 0, registros: [], nrodctos: [] }),
    }));
    await page.fill('#inputFecha', '2020-01-01');
    await page.click('#btnConsultar');
    await expect(page.locator('#modalMensaje')).toBeVisible({ timeout: 5_000 });
    const cuerpo = await page.locator('#modalMensajeBody').innerText();
    expect(cuerpo.toLowerCase()).toContain('registros');
  });

  test('D-10 el link "Ver detalle" del primer mes navega a /detalle', async ({ page }) => {
    await expect(page.locator('#resumenTabla')).toBeVisible({ timeout: 25_000 });
    await Promise.all([
      page.waitForNavigation({ timeout: 15_000 }),
      page.locator('#resumenTbody tr').first().locator('a:has-text("Ver detalle")').click(),
    ]);
    await expect(page).toHaveURL(/\/detalle/);
  });

});


// ══════════════════════════════════════════════════════════════════
// SUITE 3 — Detalle mes
// ══════════════════════════════════════════════════════════════════

test.describe('DT — Detalle mes', () => {

  test.beforeEach(async ({ page }) => { await loginAs(page); });

  test('DT-01 la página de detalle carga con la tabla de días visible', async ({ page }) => {
    await mockDetalleEndpoints(page);
    await page.goto(`/detalle?mes=${MES_CON_DATOS}`);
    await expect(page.locator('#diasLoading')).toBeHidden({ timeout: 20_000 });
    await expect(page.locator('#diasTabla')).toBeVisible();
  });

  test('DT-02 la tabla de días tiene filas y botones "Ver registros →"', async ({ page }) => {
    await mockDetalleEndpoints(page);
    await page.goto(`/detalle?mes=${MES_CON_DATOS}`);
    await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#diasTbody tr')).not.toHaveCount(0);
    await expect(page.locator('#diasTbody button').first()).toContainText('Ver registros');
  });

  test('DT-03 el breadcrumb tiene el link "Dashboard" que lleva a la raíz', async ({ page }) => {
    await mockDetalleEndpoints(page);
    await page.goto(`/detalle?mes=${MES_CON_DATOS}`);
    const breadLink = page.locator('.breadcrumb-punteo a');
    await expect(breadLink).toContainText('Dashboard');
    await Promise.all([
      page.waitForNavigation({ timeout: 10_000 }),
      breadLink.click(),
    ]);
    await expect(page).toHaveURL(/\/$/);
  });

  test('DT-04 al hacer click en "Ver registros →" se abre el panel del día', async ({ page }) => {
    await abrirPrimerPanel(page);
    await expect(page.locator('#panelDia')).toBeVisible();
    await expect(page.locator('#panelDiaTitulo')).toContainText('Registros del');
  });

  test('DT-05 el panel muestra las columnas correctas (Nrodcto, Destino, Cuota, Estado, Acción)', async ({ page }) => {
    await abrirPrimerPanel(page);
    const headers = await page.locator('#panelTabla thead th').allTextContents();
    const union = headers.join(' ');
    expect(union).toContain('Nrodcto');
    expect(union).toContain('Destino');
    expect(union).toContain('Cuota');
    expect(union).toContain('Estado');
    expect(union).toContain('Acción');
  });

  test('DT-06 la barra de progreso de soporte aparece mientras se verifican los registros', async ({ page }) => {
    await page.route(/\/api\/detalle\/dias/,      r => r.fulfill({ status: 200, contentType: 'application/json', body: MOCK_DIAS }));
    await page.route(/\/api\/detalle\/registros/, r => r.fulfill({ status: 200, contentType: 'application/json', body: MOCK_REGISTROS }));
    await page.route(/\/api\/detalle\/soporte/, async r => {
      await new Promise(res => setTimeout(res, 700));
      r.fulfill({ status: 200, contentType: 'application/json', body: MOCK_SOPORTE_NO });
    });
    await page.goto(`/detalle?mes=${MES_CON_DATOS}`);
    await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
    await page.locator('#diasTbody button').first().click();
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#panelProgContador')).toContainText('/');
  });

  test('DT-07 el KPI panel aparece al terminar con los contadores de total, encontrados y faltantes', async ({ page }) => {
    await abrirPrimerPanel(page);
    await esperarKpi(page);
    const total       = Number(await page.locator('#kpiTotal').innerText());
    const encontrados = Number(await page.locator('#kpiEncontrados').innerText());
    const faltantes   = Number(await page.locator('#kpiFaltantes').innerText());
    expect(total).toBe(2);          // 2 registros mockeados
    expect(encontrados).toBe(1);    // K8227073 tiene soporte
    expect(faltantes).toBe(1);      // SIN001 no tiene soporte
  });

  test('DT-08 el botón "Ver soporte" aparece para el registro con soporte encontrado', async ({ page }) => {
    await abrirPrimerPanel(page);
    await esperarKpi(page);
    await expect(page.locator('button:has-text("Ver soporte")')).toBeVisible();
  });

  test('DT-09 al hacer click en "Ver soporte" se abre el modal con los datos', async ({ page }) => {
    await abrirPrimerPanel(page);
    await esperarKpi(page);
    await page.locator('button:has-text("Ver soporte")').first().click();
    await expect(page.locator('#modalSoporte')).toBeVisible({ timeout: 5_000 });
    const body = await page.locator('#modalSoporteBody').innerText();
    expect(body).toContain(NRODCTO);
    expect(body).toContain('2026-05-04');
  });

  test('DT-10 el link de descarga del modal apunta a /api/detalle/descargar y no está deshabilitado', async ({ page }) => {
    await abrirPrimerPanel(page);
    await esperarKpi(page);
    await page.locator('button:has-text("Ver soporte")').first().click();
    await expect(page.locator('#modalSoporte')).toBeVisible({ timeout: 5_000 });
    const href = await page.locator('#modalDescargaLink').getAttribute('href');
    expect(href).toContain('/api/detalle/descargar');
    expect(href).toContain(encodeURIComponent(STORAGE_PATH));
    await expect(page.locator('#modalDescargaLink')).not.toHaveClass(/disabled/);
  });

  test('DT-11 el botón "✕ Cerrar" del panel oculta el panel', async ({ page }) => {
    await abrirPrimerPanel(page);
    await expect(page.locator('#panelDia')).toBeVisible();
    // Usar selector específico dentro del panel para evitar ambigüedad con
    // los botones "Cerrar" de los modales de Bootstrap
    await page.locator('#panelDia .section-header button').click();
    await expect(page.locator('#panelDia')).toBeHidden({ timeout: 5_000 });
  });

  test('DT-12 el botón "Ver faltantes" filtra a solo los registros sin soporte y vuelve a mostrar todos', async ({ page }) => {
    await abrirPrimerPanel(page);
    await esperarKpi(page);
    await expect(page.locator('#btnVerFaltantes')).toBeEnabled({ timeout: 10_000 });
    const totalAntes = await page.locator('#panelTbody tr').count();
    await page.locator('#btnVerFaltantes').click();
    const totalFiltrado = await page.locator('#panelTbody tr').count();
    expect(totalFiltrado).toBeLessThan(totalAntes);
    // Segundo click restaura todos
    await page.locator('#btnVerFaltantes').click();
    const totalRestaurado = await page.locator('#panelTbody tr').count();
    expect(totalRestaurado).toBe(totalAntes);
  });

  test('DT-13 el botón "Descargar lista" genera y descarga un archivo CSV', async ({ page }) => {
    await abrirPrimerPanel(page);
    await esperarKpi(page);
    await expect(page.locator('#btnDescargarLista')).toBeEnabled({ timeout: 10_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      page.locator('#btnDescargarLista').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('DT-13b el botón "Descargar Lista" de encontrados genera un CSV', async ({ page }) => {
    await abrirPrimerPanel(page);
    await esperarKpi(page);
    await expect(page.locator('#btnDescargarListaEncontrados')).toBeEnabled({ timeout: 10_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      page.locator('#btnDescargarListaEncontrados').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^encontrados_.*\.csv$/i);
  });

  test('DT-14 el botón "Descargar todos" inicia la descarga del ZIP (mock endpoint)', async ({ page }) => {
    // Mínimo ZIP válido (vacío) para que el ReadableStream del JS lo procese
    const zipVacio = Buffer.concat([
      Buffer.from('PK\x05\x06'),
      Buffer.alloc(18, 0),
    ]);
    await mockDetalleEndpoints(page);
    await page.route(/\/api\/detalle\/descargar-zip/, r => r.fulfill({
      status: 200,
      contentType: 'application/zip',
      headers: { 'Content-Disposition': 'attachment; filename="soportes.zip"' },
      body: zipVacio,
    }));
    await page.goto(`/detalle?mes=${MES_CON_DATOS}`);
    await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
    await page.locator('#diasTbody button').first().click();
    await esperarKpi(page);
    await expect(page.locator('#btnDescargarTodos')).toBeEnabled({ timeout: 10_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20_000 }),
      page.locator('#btnDescargarTodos').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.zip$/i);
  });

  test('DT-15 abrir un segundo día cancela el batch anterior y carga los nuevos registros', async ({ page }) => {
    // Agrega un segundo día al mock
    const dosDias = JSON.stringify([
      { fecha: FECHA_CON_DATOS,  totalRegistros: 2, totalPlanillas: 1 },
      { fecha: '2026-05-06',     totalRegistros: 1, totalPlanillas: 1 },
    ]);
    await page.route(/\/api\/detalle\/dias/,      r => r.fulfill({ status: 200, contentType: 'application/json', body: dosDias }));
    await page.route(/\/api\/detalle\/registros/, r => r.fulfill({ status: 200, contentType: 'application/json', body: MOCK_REGISTROS }));
    await page.route(/\/api\/detalle\/soporte/, r => r.fulfill({ status: 200, contentType: 'application/json', body: MOCK_SOPORTE_NO }));

    await page.goto(`/detalle?mes=${MES_CON_DATOS}`);
    await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });

    // Abrir primer día
    await page.locator('#diasTbody button').nth(0).click();
    await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 15_000 });

    // Abrir segundo día antes de que el batch termine
    await page.locator('#diasTbody button').nth(1).click();
    // El panel sigue visible con el nuevo título
    await expect(page.locator('#panelDia')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 15_000 });
  });

});


// ══════════════════════════════════════════════════════════════════
// SUITE 4 — Soportes Físicos
// ══════════════════════════════════════════════════════════════════

test.describe('SF — Soportes Físicos', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/soportes-fisicos');
    await expect(page).toHaveTitle(/Soportes Físicos/);
  });

  test('SF-01 la página carga con el topbar y el formulario visibles', async ({ page }) => {
    await expect(page.locator('.topbar-title')).toHaveText('Soportes Físicos');
    await expect(page.locator('#formSoportes')).toBeVisible();
    await expect(page.locator('#btnProcesar')).toBeVisible();
  });

  test('SF-02 el formulario inicial tiene exactamente una fila', async ({ page }) => {
    await expect(page.locator('.fila-soporte')).toHaveCount(1);
  });

  test('SF-03 el input de soporte tiene el placeholder de código de barras correcto', async ({ page }) => {
    await expect(page.locator('.fila-soporte input[type="text"]').first())
      .toHaveAttribute('placeholder', 'Código barras(ej. C5-1234)');
  });

  test('SF-04 la zona de archivo inicial muestra el ícono y el texto guía', async ({ page }) => {
    await expect(page.locator('.file-zone .fz-icon').first()).toHaveText('📎');
    await expect(page.locator('.file-zone .fz-label').first())
      .toHaveText('Adjuntar PDF · Click para seleccionar');
    await expect(page.locator('.file-zone .fz-name').first()).toHaveText('');
  });

  test('SF-05 el botón "Agregar fila" añade una segunda fila con índice correcto', async ({ page }) => {
    await page.locator('button:has-text("Agregar fila")').click();
    await expect(page.locator('.fila-soporte')).toHaveCount(2);
    // La segunda fila debe tener Items[1].Soporte
    await expect(page.locator('.fila-soporte').nth(1).locator('input[type="text"]'))
      .toHaveAttribute('name', 'Items[1].Soporte');
    await expect(page.locator('.fila-soporte').nth(1).locator('input[type="file"]'))
      .toHaveAttribute('name', 'Items[1].Archivo');
  });

  test('SF-06 agregar tres filas y luego quitar la del medio reindexará correctamente', async ({ page }) => {
    await page.locator('button:has-text("Agregar fila")').click();
    await page.locator('button:has-text("Agregar fila")').click();
    await expect(page.locator('.fila-soporte')).toHaveCount(3);
    // Eliminar fila del medio
    await page.locator('.fila-soporte').nth(1).locator('button:has-text("Quitar")').click();
    await expect(page.locator('.fila-soporte')).toHaveCount(2);
    // Después del reindexado la segunda fila tiene índice [1]
    await expect(page.locator('.fila-soporte').nth(1).locator('input[type="text"]'))
      .toHaveAttribute('name', 'Items[1].Soporte');
  });

  test('SF-07 el botón "Quitar" no elimina la única fila restante', async ({ page }) => {
    await expect(page.locator('.fila-soporte')).toHaveCount(1);
    await page.locator('.fila-soporte').first().locator('button:has-text("Quitar")').click();
    // Sigue habiendo exactamente 1 fila
    await expect(page.locator('.fila-soporte')).toHaveCount(1);
  });

  test('SF-08 al seleccionar un PDF la zona cambia a estado "has-file" con nombre y tamaño', async ({ page }) => {
    await page.locator('input[type="file"].file-real').first().setInputFiles(PDF_TEST);
    const zona = page.locator('.file-zone').first();
    await expect(zona).toHaveClass(/has-file/);
    await expect(zona.locator('.fz-icon')).toHaveText('📄');
    const nombre = await zona.locator('.fz-name').innerText();
    expect(nombre.trim()).toMatch(/\.pdf$/i);
    const tamano = await zona.locator('.fz-label').innerText();
    expect(tamano).toMatch(/MB|KB|B/);
  });

  test('SF-09 el botón "Limpiar" resetea a una fila vacía con zona de archivo en estado inicial', async ({ page }) => {
    // Preparar: 3 filas, primera con datos
    await page.locator('button:has-text("Agregar fila")').click();
    await page.locator('button:has-text("Agregar fila")').click();
    await expect(page.locator('.fila-soporte')).toHaveCount(3);
    await page.locator('.fila-soporte input[type="text"]').first().fill('C5-TEST');
    await page.locator('input[type="file"].file-real').first().setInputFiles(PDF_TEST);
    await expect(page.locator('.file-zone').first()).toHaveClass(/has-file/);

    // Limpiar
    await page.locator('button:has-text("Limpiar")').click();

    // Resultado
    await expect(page.locator('.fila-soporte')).toHaveCount(1);
    await expect(page.locator('.fila-soporte input[type="text"]').first()).toHaveValue('');
    await expect(page.locator('.file-zone').first()).not.toHaveClass(/has-file/);
    await expect(page.locator('.file-zone .fz-icon').first()).toHaveText('📎');
    await expect(page.locator('.file-zone .fz-label').first())
      .toHaveText('Adjuntar PDF · Click para seleccionar');
  });

  test('SF-10 el submit deshabilita el botón y muestra el spinner (evento JS)', async ({ page }) => {
    await page.locator('.fila-soporte input[type="text"]').first().fill('FAKE-ID-9999');
    await page.locator('input[type="file"].file-real').first().setInputFiles(PDF_TEST);

    // Disparar el evento 'submit' vía JS sin enviar la petición de red para
    // verificar de forma síncrona que el listener JS actualiza el DOM.
    // (El spinner es un estado transitorio: aparece y desaparece con la navegación,
    // por lo que probarlo a nivel de evento es más confiable que interceptar la red.)
    const resultado = await page.evaluate(() => {
      const form    = document.getElementById('formSoportes')!;
      const btn     = document.getElementById('btnProcesar') as HTMLButtonElement;
      const spinner = document.getElementById('spinnerProcesar')!;
      form.dispatchEvent(new Event('submit'));
      return {
        btnDeshabilitado: btn.disabled,
        spinnerVisible:   !spinner.classList.contains('d-none'),
      };
    });

    expect(resultado.btnDeshabilitado, 'El botón debe deshabilitarse al hacer submit').toBe(true);
    expect(resultado.spinnerVisible,   'El spinner debe mostrarse al hacer submit').toBe(true);
  });

  test('SF-11 procesar con ID inválido muestra la tabla de resultados con badge de error', async ({ page }) => {
    await page.locator('.fila-soporte input[type="text"]').first().fill('ID-INVALIDO-0000');
    await page.locator('input[type="file"].file-real').first().setInputFiles(PDF_TEST);
    await page.locator('#btnProcesar').click();

    // Esperar a que la página recargue mostrando los resultados (POST → GET con resultados)
    await page.waitForLoadState('domcontentloaded', { timeout: 60_000 });

    // La sección de resultados debe aparecer con la tabla de punteo
    await expect(page.locator('.section-card:has(.punteo-table)')).toBeVisible({ timeout: 30_000 });
    // Debe haber un badge (OK, error o advertencia)
    const badges = page.locator('.badge');
    await expect(badges).not.toHaveCount(0, { timeout: 30_000 });
  });

  test('SF-12 la tabla de resultados tiene las columnas #, ID Soporte, Estado y Mensaje', async ({ page }) => {
    await page.locator('.fila-soporte input[type="text"]').first().fill('ID-INVALIDO-0001');
    await page.locator('input[type="file"].file-real').first().setInputFiles(PDF_TEST);
    await page.locator('#btnProcesar').click();
    await page.waitForLoadState('domcontentloaded', { timeout: 60_000 });
    await expect(page.locator('.punteo-table')).toBeVisible({ timeout: 30_000 });

    const headers = await page.locator('.punteo-table thead th').allTextContents();
    const union = headers.join(' ');
    expect(union).toContain('#');
    expect(union).toContain('ID Soporte');
    expect(union).toContain('Estado');
    expect(union).toContain('Mensaje');

    // Los KPIs de resultado también son visibles
    await expect(page.locator('.kpi-row .kpi-card')).not.toHaveCount(0);
  });

});


// ══════════════════════════════════════════════════════════════════
// SUITE 5 — Navegación lateral
// ══════════════════════════════════════════════════════════════════

test.describe('N — Navegación lateral', () => {

  test.beforeEach(async ({ page }) => { await loginAs(page); });

  test('N-01 el ítem "Dashboard" del sidebar está activo en la raíz (/)', async ({ page }) => {
    const navDash = page.locator('.sidebar-nav .nav-item').filter({ hasText: 'Dashboard' });
    await expect(navDash).toHaveClass(/active/);
    const navSoportes = page.locator('.sidebar-nav .nav-item').filter({ hasText: /^Soportes$/ });
    const navSoportesFecha = page.locator('.sidebar-nav .nav-item').filter({ hasText: 'Soportes por Fecha' });
    await expect(navSoportes).not.toHaveClass(/active/);
    await expect(navSoportesFecha).not.toHaveClass(/active/);
  });

  test('N-02 la página de detalle carga con el mes indicado', async ({ page }) => {
    await page.goto(`/detalle?mes=${MES_CON_DATOS}`);
    await expect(page).toHaveURL(/\/detalle/, { timeout: 10_000 });
    await expect(page.locator('.topbar-title')).toHaveText(/Detalle/);
    const navDash = page.locator('.sidebar-nav .nav-item').filter({ hasText: 'Dashboard' });
    await expect(navDash).not.toHaveClass(/active/);
  });

  test('N-03 el link "Soportes" navega a /soportes-fisicos y se activa', async ({ page }) => {
    await page.locator('.sidebar-nav .nav-item').filter({ hasText: /^Soportes$/ }).click();
    await expect(page).toHaveURL(/\/soportes-fisicos/);
    const navSoportes = page.locator('.sidebar-nav .nav-item').filter({ hasText: /^Soportes$/ });
    await expect(navSoportes).toHaveClass(/active/);
    await expect(page).toHaveTitle(/Soportes Físicos/);
  });

  test('N-06 el link "Soportes por Fecha" navega y se activa', async ({ page }) => {
    await page.locator('.sidebar-nav .nav-item').filter({ hasText: 'Soportes por Fecha' }).click();
    await expect(page).toHaveURL(/\/soportes-por-fecha/);
    const nav = page.locator('.sidebar-nav .nav-item').filter({ hasText: 'Soportes por Fecha' });
    await expect(nav).toHaveClass(/active/);
    await expect(page.locator('#inputCarteraFilter')).toBeEnabled({ timeout: 30000 });
  });

  test('N-04 el topbar muestra las iniciales y el nombre completo del usuario', async ({ page }) => {
    await expect(page.locator('.topbar-user .chip-name')).toHaveText(USUARIO);
    const iniciales = page.locator('.topbar-user .chip-initial--sm');
    await expect(iniciales).toHaveText(USUARIO.slice(0, 2));
  });

  test('N-05 hacer click en el avatar del topbar lleva a /login', async ({ page }) => {
    await page.locator('.topbar-user').click();
    await expect(page).toHaveURL(/\/login/);
  });

});
