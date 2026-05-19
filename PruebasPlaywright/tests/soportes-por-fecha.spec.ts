import { test, expect, type Page } from '@playwright/test';

const USUARIO = 'MMUNOZ';
const FECHA_PRUEBA = '2026-05-06';
/** Cartera usada en la consulta de negocio de prueba (6 mayo 2026). */
const CARTERA_PRUEBA = 'POS DOMICILIOS ALMACENTRO';

async function loginComoMMUNOZ(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="usuario"]', USUARIO);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$/, { timeout: 15000 });
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 25000 });
}

async function irASoportesPorFecha(page: Page): Promise<void> {
  await page.locator('.sidebar-nav .nav-item').filter({ hasText: 'Soportes por Fecha' }).click();
  await expect(page).toHaveURL(/\/soportes-por-fecha/);
  await expect(page.locator('#inputCarteraFilter')).toBeEnabled({ timeout: 30000 });
}

async function seleccionarCartera(page: Page, textoBusqueda: string): Promise<void> {
  const input = page.locator('#inputCarteraFilter');
  await input.click();
  await input.fill(textoBusqueda);
  const opcion = page.locator('#carteraListbox li[data-value]').filter({
    hasText: new RegExp(textoBusqueda.replace(/\s+/g, '\\s+'), 'i'),
  }).first();
  await expect(opcion).toBeVisible({ timeout: 15000 });
  await opcion.click();
  await expect(page.locator('#inputCarteraValue')).not.toHaveValue('');
}

test.describe('Soportes por Fecha', () => {
  test.beforeEach(async ({ page }) => {
    await loginComoMMUNOZ(page);
    await irASoportesPorFecha(page);
  });

  test('SPF-01 buscar 2026-05-06 con cartera POS DOMICILIOS ALMACENTRO', async ({ page }) => {
    await expect(page.locator('.topbar-title')).toHaveText(/Soportes por Fecha/);

    await page.fill('#inputFecha', FECHA_PRUEBA);
    await seleccionarCartera(page, CARTERA_PRUEBA);

    await expect(page.locator('#btnBuscar')).toBeEnabled();
    await page.click('#btnBuscar');

    await expect(page.locator('#seccionResultados')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#panelLoading')).toBeHidden({ timeout: 60000 });
    await expect(page.locator('#modalMensaje')).toBeHidden({ timeout: 30000 });

    await expect(async () => {
      const isTabla = await page.locator('#panelTabla').isVisible();
      const isVacio = await page.locator('#panelVacio').isVisible();
      expect(isTabla || isVacio).toBe(true);
    }).toPass({ timeout: 15000 });

    await expect(page.locator('#panelKpi')).toBeVisible({ timeout: 15000 });

    const tablaVisible = await page.locator('#panelTabla').isVisible();
    if (tablaVisible) {
      const filas = await page.locator('#resultadosTbody tr').count();
      expect(filas, 'La tabla debe contener al menos una fila de facturas').toBeGreaterThan(0);
      const kpiTotal = parseInt((await page.locator('#kpiTotal').innerText()).replace(/\D/g, ''), 10);
      expect(kpiTotal, 'KPI Total facturas debe ser mayor que 0').toBeGreaterThan(0);

      // Mismos controles KPI que Detalle › registros
      await expect(page.locator('#inputBuscarTabla')).toBeVisible();
      await expect(page.locator('#btnDescargarFiltrados')).toBeVisible();
      await expect(page.locator('#btnDescargarListaEncontrados')).toBeVisible();
      await expect(page.locator('#btnVerFaltantes')).toBeVisible();

      await page.fill('#inputBuscarTabla', 'POS');
      await expect(page.locator('#resultadosTbody tr').first()).toBeVisible();
    } else {
      await expect(page.locator('#panelVacio')).toContainText(/No se encontraron facturas/i);
    }
  });

  test('SPF-02 exige seleccionar cartera antes de buscar', async ({ page }) => {
    await page.fill('#inputFecha', FECHA_PRUEBA);
    await expect(page.locator('#btnBuscar')).toBeDisabled();
    await page.evaluate(() => {
      const btn = document.getElementById('btnBuscar') as HTMLButtonElement | null;
      if (btn) btn.disabled = false;
    });
    await page.click('#btnBuscar');
    await expect(page.locator('#modalMensaje')).toBeVisible();
    await expect(page.locator('#modalMensajeBody')).toContainText(/cartera/i);
  });

  test('SPF-03 el dropdown de cartera filtra al escribir', async ({ page }) => {
    await page.locator('#inputCarteraFilter').fill('POS DOMICILIOS');
    const opciones = page.locator('#carteraListbox li[data-value]');
    await expect(opciones.first()).toBeVisible({ timeout: 10000 });
    const count = await opciones.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(opciones.nth(i)).toContainText(/POS DOMICILIOS/i);
    }
  });
});
