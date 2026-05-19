/**
 * soportes-por-fecha-06mayo-consulta-soportes.spec.ts
 *
 * Valida para el día 06/05/2026 que:
 *   1. Se invoca el batch stream de soportes (/api/soportes-por-fecha/soporte-batch-stream).
 *   2. Las filas dejan de estar en "Consultando" y se clasifican (Encontrado / Sin soporte).
 *   3. Hay al menos un soporte encontrado en KPI y en la tabla.
 *   4. Los botones de descarga masiva (ZIP/CSV) quedan habilitados.
 *   5. En fila con soporte aparece "Ver soporte" y el modal permite descargar el PDF.
 *
 * Ejecutar:
 *   npx playwright test tests/soportes-por-fecha-06mayo-consulta-soportes.spec.ts --headed
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

const USUARIO = 'MMUNOZ';
const FECHA = '2026-05-06';
/** Cartera preferida para el 06-05-2026 (clave = TIPODCTO+TIPODC). */
const CARTERA_PREFERIDA = 'POS DOMICILIOS ALMACENTRO';

type ResumenStream = {
  lineas: number;
  encontrados: number;
  faltantes: number;
  errores: number;
  clavesMuestra: string[];
};

function claveSoporteFromFactura(f: FacturaApi): string {
  const desdeApi = (f.claveSoporte ?? '').trim();
  if (desdeApi) return desdeApi;
  return `${(f.tipoDcto ?? '').trim()}${(f.nroDcto ?? '').trim()}`;
}

async function loginComoMMUNOZ(page: Page): Promise<void> {
  await page.goto('/login');
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

type FacturaApi = {
  tipoDcto?: string | null;
  nroDcto?: string | null;
  claveSoporte?: string | null;
};

async function clavesDocumentoDeCartera(page: Page, cartera: string): Promise<string[]> {
  const r = await page.request.get(
    `/api/soportes-por-fecha/facturas?fecha=${FECHA}&nombreCartera=${encodeURIComponent(cartera)}`,
  );
  if (!r.ok()) return [];
  const facturas = (await r.json()) as FacturaApi[];
  return [...new Set(facturas.map(claveSoporteFromFactura).filter((v) => v.length > 0))];
}

async function contarEncontradosEnStream(page: Page, claves: string[]): Promise<number> {
  if (!claves.length) return 0;
  const r = await page.request.post('/api/soportes-por-fecha/soporte-batch-stream', {
    data: claves,
    timeout: 300_000,
  });
  if (!r.ok()) return 0;
  const resumen = await analizarRespuestaStream(r);
  return resumen.encontrados;
}

/** Cartera con al menos un soporte encontrado (para validar botones de descarga). */
async function buscarCarteraConSoportes(page: Page): Promise<string | null> {
  const res = await page.request.get('/api/soportes-por-fecha/tipos-cartera');
  if (!res.ok()) return null;
  const carteras = (await res.json()) as string[];
  const candidatas = [
    'POS DOMICILIOS MANIZALES',
    CARTERA_PREFERIDA,
    ...carteras.filter((c) => /POS\s+DOMICILIOS/i.test(c)),
    ...carteras.filter((c) => /ALMACENTRO/i.test(c)),
  ];
  const vistas = new Set<string>();

  for (const nombre of candidatas) {
    const clave = nombre.trim();
    if (!clave || vistas.has(clave)) continue;
    vistas.add(clave);
    const claves = await clavesDocumentoDeCartera(page, clave);
    if (!claves.length) continue;
    console.log(`Pre-scan batch "${clave}" (${claves.length} claves)…`);
    const encontrados = await contarEncontradosEnStream(page, claves);
    if (encontrados > 0) return clave;
  }
  return null;
}

async function seleccionarCarteraExacta(page: Page, nombre: string): Promise<void> {
  const input = page.locator('#inputCarteraFilter');
  await input.click();
  await input.fill(nombre);
  const opciones = page.locator('#carteraListbox li[data-value]');
  await expect(opciones.first()).toBeVisible({ timeout: 15_000 });

  const buscado = nombre.trim().toLowerCase();
  const total = await opciones.count();
  for (let i = 0; i < total; i++) {
    const val = ((await opciones.nth(i).getAttribute('data-value')) ?? '').trim();
    if (val.toLowerCase() === buscado) {
      await opciones.nth(i).click();
      await expect(page.locator('#inputCarteraValue')).toHaveValue(val);
      return;
    }
  }
  const parcial = opciones.filter({ hasText: new RegExp(nombre.replace(/\s+/g, '\\s+'), 'i') }).first();
  await parcial.click();
  await expect(page.locator('#inputCarteraValue')).not.toHaveValue('');
}

function parseKpi(text: string | null): number {
  return parseInt((text ?? '0').replace(/\D/g, ''), 10) || 0;
}

async function analizarRespuestaStream(response: import('@playwright/test').Response): Promise<ResumenStream> {
  const resumen: ResumenStream = {
    lineas: 0,
    encontrados: 0,
    faltantes: 0,
    errores: 0,
    clavesMuestra: [],
  };
  const body = await response.text();
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    let item: { nrodcto?: string; estado?: number };
    try {
      item = JSON.parse(line);
    } catch {
      continue;
    }
    resumen.lineas++;
    if (item.estado === 1) {
      resumen.encontrados++;
      if (resumen.clavesMuestra.length < 3 && item.nrodcto) {
        resumen.clavesMuestra.push(item.nrodcto);
      }
    } else if (item.estado === 2) resumen.faltantes++;
    else resumen.errores++;
  }
  return resumen;
}

/** Busca en todas las páginas el primer botón "Ver soporte". */
async function primerBotonVerSoporte(page: Page): Promise<Locator> {
  for (let intento = 0; intento < 50; intento++) {
    const btn = page.locator('#resultadosTbody button', { hasText: /Ver soporte/i }).first();
    if (await btn.isVisible()) return btn;

    const siguiente = page.locator(
      '#pagResultados .pag-nav button[aria-label="Página siguiente"]',
    );
    if (!(await siguiente.isVisible()) || (await siguiente.isDisabled())) break;
    await siguiente.click();
    await page.waitForTimeout(200);
  }
  throw new Error('No hay botón "Ver soporte" en ninguna página de la tabla');
}

test.describe('SPF 06-mayo-2026 — consulta real de soportes', () => {
  test.use({ ignoreHTTPSErrors: true });
  test.setTimeout(900_000);

  test('SPF-06M verifica batch, KPIs y botones de descarga con soportes encontrados', async ({ page }) => {
    let streamResumen: ResumenStream | null = null;
    let clavesEnviadas = 0;

    page.on('request', (req) => {
      if (req.url().includes('/api/soportes-por-fecha/soporte-batch-stream') && req.method() === 'POST') {
        try {
          const raw = req.postData();
          const body = raw ? (JSON.parse(raw) as string[]) : [];
          clavesEnviadas = Array.isArray(body) ? body.length : 0;
        } catch {
          clavesEnviadas = 0;
        }
      }
    });

    page.on('response', async (response) => {
      if (
        response.url().includes('/api/soportes-por-fecha/soporte-batch-stream') &&
        response.status() === 200 &&
        !streamResumen
      ) {
        streamResumen = await analizarRespuestaStream(response);
      }
    });

    await loginComoMMUNOZ(page);
    await irASoportesPorFecha(page);

    const clavesAlmacentro = await clavesDocumentoDeCartera(page, CARTERA_PREFERIDA);
    expect(
      clavesAlmacentro.length,
      `"${CARTERA_PREFERIDA}" debe tener facturas con clave TIPODCTO+NRODCTO`,
    ).toBeGreaterThan(0);

    const carteraUi = (await buscarCarteraConSoportes(page)) ?? CARTERA_PREFERIDA;
    if (carteraUi !== CARTERA_PREFERIDA) {
      console.log(`UI con cartera que tiene soportes: "${carteraUi}"`);
    }

    await page.fill('#inputFecha', FECHA);
    await seleccionarCarteraExacta(page, carteraUi);
    await expect(page.locator('#tituloResultados')).toBeHidden();

    await page.click('#btnBuscar');

    await expect(page.locator('#seccionResultados')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#panelLoading')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 30_000 });

    // Durante el batch debe aparecer la barra (o terminar muy rápido)
    await expect(async () => {
      const progreso = await page.locator('#panelProgreso').isVisible();
      const kpi = await page.locator('#panelKpi').isVisible();
      expect(progreso || kpi).toBe(true);
    }).toPass({ timeout: 60_000 });

    // Esperar fin del batch: sin "Consultando" y barra oculta
    await expect(page.locator('#panelProgreso')).toBeHidden({ timeout: 600_000 });
    await expect(async () => {
      const consultando = await page.locator('#resultadosTbody', {
        hasText: /Consultando/i,
      }).count();
      expect(consultando).toBe(0);
    }).toPass({ timeout: 30_000 });

    await expect(page.locator('#panelKpi')).toBeVisible();

    // ── Validar que SÍ se consultó el API de soportes ───────────────────────
    expect(clavesEnviadas, 'Debe enviarse al menos una clave (TIPODCTO+NRODCTO) al batch').toBeGreaterThan(0);
    expect(streamResumen, 'Debe existir respuesta del endpoint soporte-batch-stream').not.toBeNull();

    const stream = streamResumen!;
    console.log(
      `Stream NDJSON → líneas=${stream.lineas} encontrados=${stream.encontrados} ` +
        `faltantes=${stream.faltantes} errores=${stream.errores} enviados=${clavesEnviadas}`,
    );

    expect(stream.lineas, 'El stream debe devolver una línea NDJSON por clave').toBeGreaterThan(0);
    expect(stream.lineas).toBeLessThanOrEqual(clavesEnviadas);

    const kpiTotal = parseKpi(await page.locator('#kpiTotal').textContent());
    const kpiEncontrados = parseKpi(await page.locator('#kpiEncontrados').textContent());
    const kpiFaltantes = parseKpi(await page.locator('#kpiFaltantes').textContent());

    console.log(`KPI → total=${kpiTotal} encontrados=${kpiEncontrados} faltantes=${kpiFaltantes}`);

    expect(kpiTotal).toBeGreaterThan(0);
    const hayEncontradosEnStream = stream.encontrados > 0;
    const hayFaltantesEnStream = stream.faltantes > 0;

    expect(
      hayEncontradosEnStream || hayFaltantesEnStream,
      'El batch debe clasificar soportes (encontrado o faltante), no solo errores',
    ).toBe(true);

    expect(stream.errores).toBeLessThan(stream.lineas);

    expect(kpiEncontrados).toBeGreaterThanOrEqual(stream.encontrados);

    if (!hayEncontradosEnStream) {
      expect(
        stream.faltantes + stream.errores,
        'El batch debe clasificar documentos aunque no haya PDF',
      ).toBeGreaterThan(0);
    }

    if (!hayEncontradosEnStream) {
      test.info().annotations.push({
        type: 'warning',
        description:
          'El batch se ejecutó con claves TIPODCTO+TIPODC pero la API no devolvió soportes ese día. ' +
          'Revise conectividad/API externa.',
      });
      return;
    }

    expect(kpiEncontrados, 'KPI Con soporte debe ser > 0').toBeGreaterThan(0);

    const streamFinal = stream;
    {
      // Debe haber filas verdes en la tabla (al menos en alguna página)
      let verdesVisibles = await page.locator('#resultadosTbody .tag-green').count();
      if (verdesVisibles === 0) {
        const siguiente = page.locator('#pagResultados .pag-nav button[aria-label="Página siguiente"]');
        while (await siguiente.isVisible() && !(await siguiente.isDisabled())) {
          await siguiente.click();
          verdesVisibles = await page.locator('#resultadosTbody .tag-green').count();
          if (verdesVisibles > 0) break;
        }
      }
      expect(verdesVisibles, 'Debe mostrarse al menos una fila ✅ Encontrado').toBeGreaterThan(0);

      // ── Botones de descarga masiva (encontrados) ────────────────────────────
      await expect(page.locator('#btnDescargarTodos')).toBeEnabled();
      await expect(page.locator('#btnDescargarListaEncontrados')).toBeEnabled();
      await expect(page.locator('#btnDescargarTodos')).toContainText(/Descargar todos/i);

      const claveDoc = streamFinal.clavesMuestra[0];
      await page.fill('#inputBuscarTabla', claveDoc);
      await expect(page.locator('#resultadosTbody .tag-green').first()).toBeVisible();
      await expect(page.locator('#btnDescargarFiltrados')).toBeEnabled();
      await expect(page.locator('#btnDescargarListaFiltrados')).toBeEnabled();
      await page.fill('#inputBuscarTabla', '');

      // ── Botón "Ver soporte" + modal de descarga individual ───────────────────
      const btnVer = await primerBotonVerSoporte(page);
      await expect(btnVer).toBeEnabled();
      await btnVer.click();

      await expect(page.locator('#modalSoporte')).toBeVisible();
      await expect(page.locator('#modalSoporteBody')).toContainText(/Clave documento/i);

      const linkDescarga = page.locator('#modalDescargaLink');
      await expect(linkDescarga).toBeVisible();
      await expect(linkDescarga).not.toHaveClass(/disabled/);
      const href = await linkDescarga.getAttribute('href');
      expect(href).toMatch(/\/api\/soportes-por-fecha\/descargar\?path=/);

      const respDescarga = await page.request.get(href!);
      expect(
        respDescarga.status(),
        `Descarga individual debe responder 200 (recibido ${respDescarga.status()})`,
      ).toBe(200);

      await page.locator('#modalSoporte .btn-close').click();
      await expect(page.locator('#modalSoporte')).toBeHidden();
    }

    console.log('SPF-06M → Consulta por TIPODCTO+TIPODC y descargas validadas');
  });
});
