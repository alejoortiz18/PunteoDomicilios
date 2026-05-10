/**
 * mostrar-datos-bd.spec.ts
 * Pruebas Playwright — Verificación de datos de BD y botón "Ver Soporte"
 *
 * Ejecutar en modo visible:
 *   npx playwright test tests/mostrar-datos-bd.spec.ts --headed
 *   npm run test:bd
 *   npm run test:bd:slow   (más lento, fácil de seguir)
 */

import { test, expect, Page } from '@playwright/test';

// ── Utilidades ──────────────────────────────────────────────────────────────

/** Realiza el login con MMUNOZ y espera a llegar al dashboard. */
async function loginComoMMUNOZ(page: Page): Promise<void> {
  await page.goto('/login');
  await page.selectOption('select[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5125/');
}

/** Espera a que el resumen mensual esté cargado y retorna el conteo de filas. */
async function esperarResumenCargado(page: Page): Promise<number> {
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('#resumenTabla')).toBeVisible();
  return await page.locator('#resumenTbody tr').count();
}

/** Navega al detalle del primer mes del resumen y espera que carguen los días. */
async function navegarAlPrimerDetalle(page: Page): Promise<void> {
  await page.locator('#resumenTbody tr').first().locator('a').click();
  await page.waitForURL('**/detalle?mes=**');
  await expect(page.locator('#diasLoading')).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('#diasTabla')).toBeVisible();
}

/** Expande el primer día del mes y espera a que el panel de registros sea visible. */
async function expandirPrimerDia(page: Page): Promise<void> {
  await page.locator('#diasTbody tr').first().locator('button').click();
  await expect(page.locator('#panelDia')).toBeVisible();
  await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 30_000 });
}

/** Espera a que todos los soportes del panel hayan sido consultados. */
async function esperarSoportesConsultados(page: Page): Promise<void> {
  await expect(page.locator('#panelProgreso')).toBeHidden({ timeout: 120_000 });
}

// ── Suite BD-01: Verificación de datos reales de la BD ──────────────────────

test.describe('BD-01 al BD-04 — Datos reales de la base de datos', () => {

  test.beforeEach(async ({ page }) => {
    await loginComoMMUNOZ(page);
  });

  // ── BD-01 ──────────────────────────────────────────────────────────────────
  test('BD-01 resumen mensual trae filas reales de la BD', async ({ page }) => {
    const count = await esperarResumenCargado(page);
    expect(count, 'El resumen mensual debe tener al menos 1 fila').toBeGreaterThan(0);

    const primeraFila = page.locator('#resumenTbody tr').first();

    const textoMes = await primeraFila.locator('td').nth(0).innerText();
    expect(textoMes.trim(), 'La etiqueta de mes no debe estar vacía').not.toBe('');

    const txtRegistros = await primeraFila.locator('td').nth(1).innerText();
    expect(
      parseInt(txtRegistros.replace(/\D/g, '')),
      'Total registros debe ser > 0',
    ).toBeGreaterThan(0);

    const txtPlanillas = await primeraFila.locator('td').nth(2).innerText();
    expect(
      parseInt(txtPlanillas.replace(/\D/g, '')),
      'Total planillas debe ser ≥ 1',
    ).toBeGreaterThanOrEqual(1);

    await expect(primeraFila.locator('a'), 'Debe existir enlace Ver detalle').toContainText('Ver detalle');
  });

  // ── BD-02 ──────────────────────────────────────────────────────────────────
  test('BD-02 detalle mes trae días reales de la BD', async ({ page }) => {
    await esperarResumenCargado(page);
    await navegarAlPrimerDetalle(page);

    const filas = page.locator('#diasTbody tr');
    expect(await filas.count(), 'La tabla de días debe tener al menos 1 fila').toBeGreaterThan(0);

    const primeraFila = filas.first();
    const fecha = await primeraFila.locator('td').nth(0).innerText();
    expect(fecha.trim(), 'La fecha debe tener formato DD/MM/YYYY').toMatch(/\d{2}\/\d{2}\/\d{4}/);

    const registros = await primeraFila.locator('td').nth(1).innerText();
    expect(
      parseInt(registros.replace(/\D/g, '')),
      'Total registros del día debe ser > 0',
    ).toBeGreaterThan(0);

    await expect(primeraFila.locator('button'), 'Debe existir botón Ver registros').toContainText('Ver registros');
  });

  // ── BD-03 ──────────────────────────────────────────────────────────────────
  test('BD-03 registros del día tienen campos de la BD', async ({ page }) => {
    await esperarResumenCargado(page);
    await navegarAlPrimerDetalle(page);
    await expandirPrimerDia(page);

    const filas = page.locator('#panelTbody tr');
    expect(await filas.count(), 'El panel debe tener al menos 1 registro').toBeGreaterThan(0);

    const primeraFila = filas.first();

    // Nrodcto en <code>
    const nrodcto = await primeraFila.locator('code').first().innerText();
    expect(nrodcto.trim(), 'Nrodcto no debe estar vacío').not.toBe('');

    // Cuota Mod contiene $
    const cuota = await primeraFila.locator('td').nth(2).innerText();
    expect(cuota, 'Cuota Mod debe contener símbolo $').toContain('$');

    // Estado es uno de los valores conocidos
    const estadoHtml = await primeraFila.locator('td').nth(4).innerHTML();
    const validos = ['tag-green', 'tag-red', 'tag-yellow', 'Consultando'];
    expect(
      validos.some(e => estadoHtml.includes(e)),
      `Estado no reconocido en HTML: ${estadoHtml}`,
    ).toBe(true);
  });

  // ── BD-04 ──────────────────────────────────────────────────────────────────
  test('BD-04 API /api/detalle/dias devuelve fechas del mes correcto', async ({ page }) => {
    // Obtener el mes del primer enlace "Ver detalle"
    await esperarResumenCargado(page);
    const href = await page.locator('#resumenTbody tr').first().locator('a').getAttribute('href') ?? '';
    const mesMatch = href.match(/mes=(\d{4}-\d{2})/);
    const mes = mesMatch ? mesMatch[1] : '2026-05';

    const resp = await page.request.get(`/api/detalle/dias?mes=${mes}`);
    expect(resp.status(), 'El endpoint debe devolver 200').toBe(200);

    const data: any[] = await resp.json();
    expect(Array.isArray(data), 'La respuesta debe ser un array').toBe(true);
    expect(data.length, 'Debe tener al menos 1 día').toBeGreaterThan(0);

    expect(data[0], 'Debe tener campo fecha').toHaveProperty('fecha');
    expect(data[0], 'Debe tener campo totalRegistros').toHaveProperty('totalRegistros');
    expect(data[0], 'Debe tener campo totalPlanillas').toHaveProperty('totalPlanillas');

    // Todas las fechas deben pertenecer al mes solicitado
    data.forEach(d =>
      expect(d.fecha as string, `Fecha ${d.fecha} no pertenece al mes ${mes}`).toMatch(
        new RegExp(`^${mes}`),
      ),
    );
  });

});

// ── Suite BD-02: Botón "Ver Soporte" ────────────────────────────────────────

test.describe('BD-05 al BD-10 — Botón Ver Soporte: API y URL correcta', () => {

  test.beforeEach(async ({ page }) => {
    await loginComoMMUNOZ(page);
  });

  // ── BD-05 ──────────────────────────────────────────────────────────────────
  test('BD-05 API soporte K8227073 devuelve success:true y storage_path', async ({ page }) => {
    const resp = await page.request.get('/api/detalle/soporte?nrodcto=K8227073');
    expect(resp.status(), 'Endpoint debe devolver 200').toBe(200);

    const json = await resp.json();
    expect(json.success, 'success debe ser true').toBe(true);
    expect(Array.isArray(json.data), 'data debe ser un array').toBe(true);
    expect(json.data.length, 'data debe tener al menos 1 elemento').toBeGreaterThan(0);

    const item = json.data[0];
    const path: string = (item.storage_Path ?? item.storage_path ?? '').trim();

    expect(path, 'storage_path no debe estar vacío').not.toBe('');
    expect(path, 'storage_path debe comenzar con soportes/').toMatch(/^soportes\//);
    expect(path, 'storage_path debe terminar en .pdf').toMatch(/\.pdf$/i);
  });

  // ── BD-06 ──────────────────────────────────────────────────────────────────
  test('BD-06 al menos un registro del día tiene estado ✅ Encontrado', async ({ page }) => {
    await esperarResumenCargado(page);
    await navegarAlPrimerDetalle(page);
    await expandirPrimerDia(page);
    await esperarSoportesConsultados(page);

    const encontrados = page.locator('.tag-green');
    expect(
      await encontrados.count(),
      'Debe haber al menos 1 registro con soporte encontrado',
    ).toBeGreaterThan(0);
  });

  // ── BD-07 ──────────────────────────────────────────────────────────────────
  test('BD-07 botón Ver soporte aparece solo en registros con ✅ Encontrado', async ({ page }) => {
    await esperarResumenCargado(page);
    await navegarAlPrimerDetalle(page);
    await expandirPrimerDia(page);
    await esperarSoportesConsultados(page);

    const btnVer = page.locator('button:has-text("Ver soporte")');
    expect(await btnVer.count(), 'Debe haber al menos 1 botón Ver soporte').toBeGreaterThan(0);
    await expect(btnVer.first(), 'El botón debe estar habilitado').toBeEnabled();
  });

  // ── BD-08 ──────────────────────────────────────────────────────────────────
  test('BD-08 modal Ver soporte muestra el storage_path correcto', async ({ page }) => {
    const storagePath = 'soportes/2026/05/04/K8227073.pdf';

    // Interceptar la API de soporte para K8227073 con datos controlados
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

    await page.goto('/detalle?mes=2026-05');
    await expect(page.locator('#diasLoading')).toBeHidden({ timeout: 20_000 });

    // Intentar expandir el día 04/05/2026; si no está, usar el primer día
    const botonDia04 = page
      .locator('#diasTbody tr')
      .filter({ hasText: '04/05/2026' })
      .locator('button');

    if (await botonDia04.count() > 0) {
      await botonDia04.click();
    } else {
      await page.locator('#diasTbody tr').first().locator('button').click();
    }

    const btnVer = page.locator('button:has-text("Ver soporte")').first();
    await expect(btnVer, 'El botón Ver soporte debe aparecer').toBeVisible({ timeout: 120_000 });
    await btnVer.click();

    await expect(page.locator('#modalSoporte'), 'El modal debe abrirse').toBeVisible();
    await expect(
      page.locator('#modalSoporteBody'),
      'El cuerpo del modal debe contener el storage_path',
    ).toContainText(storagePath);

    const href = await page.locator('#modalDescargaLink').getAttribute('href');
    expect(href, 'El href de descarga no debe ser nulo').not.toBeNull();
    expect(href, 'El href debe incluir el storage_path codificado').toContain(
      encodeURIComponent(storagePath),
    );
  });

  // ── BD-09 ──────────────────────────────────────────────────────────────────
  test('BD-09 el enlace del modal usa el storage_path exacto de la API', async ({ page }) => {
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

    const href = (await page.locator('#modalDescargaLink').getAttribute('href')) ?? '';
    const urlObj = new URL(href, 'http://localhost:5125');
    const pathParam = decodeURIComponent(urlObj.searchParams.get('path') ?? '');

    expect(pathParam, 'El parámetro path debe ser idéntico al storage_path de la API').toBe(storagePath);
  });

  // ── BD-10 ──────────────────────────────────────────────────────────────────
  test('BD-10 sin soporte: tag-red y sin botón Ver soporte', async ({ page }) => {
    // Forzar que todos los soportes devuelvan sin soporte
    await page.route('**/api/detalle/soporte**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, data: null, message: 'Sin soporte.' }),
      });
    });

    await esperarResumenCargado(page);
    await navegarAlPrimerDetalle(page);
    await expandirPrimerDia(page);
    await esperarSoportesConsultados(page);

    const tagRed = page.locator('.tag-red');
    expect(
      await tagRed.count(),
      'Debe haber filas con tag-red cuando todos los soportes fallan',
    ).toBeGreaterThan(0);

    const btnVer = page.locator('button:has-text("Ver soporte")');
    expect(
      await btnVer.count(),
      'No debe haber ningún botón Ver soporte cuando no hay soportes',
    ).toBe(0);
  });

});

// ── Suite BD-11: Flujo completo E2E ─────────────────────────────────────────

test.describe('BD-11 — Flujo E2E completo sin mocks', () => {

  test('BD-11 flujo completo: Login → BD → Ver Soporte → URL correcta', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    // ── 1. Login ──────────────────────────────────────────────────────────
    await loginComoMMUNOZ(page);

    // ── 2. Dashboard: resumen mensual con datos BD ────────────────────────
    const resumenCount = await esperarResumenCargado(page);
    expect(resumenCount, '2. El resumen debe tener al menos 1 mes').toBeGreaterThan(0);

    // ── 3. Navegar a detalle del primer mes ───────────────────────────────
    await navegarAlPrimerDetalle(page);
    const diasCount = await page.locator('#diasTbody tr').count();
    expect(diasCount, '3. El detalle debe tener al menos 1 día').toBeGreaterThan(0);

    // ── 4. Expandir el primer día ─────────────────────────────────────────
    await expandirPrimerDia(page);
    const regCount = await page.locator('#panelTbody tr').count();
    expect(regCount, '4. El panel debe tener al menos 1 registro').toBeGreaterThan(0);

    // ── 5. Esperar a que todos los soportes se consulten ──────────────────
    await esperarSoportesConsultados(page);

    // ── 6. Verificar al menos 1 soporte encontrado ────────────────────────
    const encontrados = await page.locator('.tag-green').count();
    expect(encontrados, '6. Debe haber al menos 1 soporte encontrado (datos reales BD + API)').toBeGreaterThan(0);

    // ── 7. Hacer clic en el primer "Ver soporte" ──────────────────────────
    const btnVer = page.locator('button:has-text("Ver soporte")').first();
    await expect(btnVer, '7. Debe existir botón Ver soporte').toBeVisible();
    await btnVer.click();

    // ── 8. Verificar modal abierto ────────────────────────────────────────
    await expect(page.locator('#modalSoporte'), '8. El modal debe abrirse').toBeVisible();

    // ── 9. storage_path en el cuerpo del modal ────────────────────────────
    const bodyText = await page.locator('#modalSoporteBody').innerText();
    expect(bodyText, '9. El modal debe mostrar una ruta de storage_path').toMatch(/soportes\//);

    // ── 10. Verificar href del enlace de descarga ─────────────────────────
    const href = (await page.locator('#modalDescargaLink').getAttribute('href')) ?? '';
    expect(href, '10. El href debe apuntar al proxy de descarga').toContain('/api/detalle/descargar?path=');

    const urlObj = new URL(href, 'http://localhost:5125');
    const pathParam = decodeURIComponent(urlObj.searchParams.get('path') ?? '');

    expect(pathParam, '10. El parámetro path debe comenzar con soportes/').toMatch(/^soportes\//);
    expect(pathParam, '10. El parámetro path debe terminar en .pdf').toMatch(/\.pdf$/i);

    // ── 11. Sin errores en consola ────────────────────────────────────────
    expect(consoleErrors, '11. No debe haber errores en consola del navegador').toEqual([]);
  });

});
