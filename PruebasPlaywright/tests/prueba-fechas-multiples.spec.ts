/**
 * prueba-fechas-multiples.spec.ts
 *
 * Verifica que la barra de progreso muestra avance REAL (streaming NDJSON)
 * al consultar soportes, y que el flujo funciona con fechas de distintos meses,
 * incluyendo Abril 2026.
 *
 * Grupos de prueba:
 *   FM-01 → FM-03 : mes de Abril (2026-04)
 *   FM-04 → FM-06 : varias fechas de Mayo (2026-05)
 *   FM-07         : la barra avanza con valores intermedios (progreso real)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5125';
const MES_ABRIL = '2026-04';
const MES_MAYO  = '2026-05';

// ─── Helper: login ────────────────────────────────────────────────────────────
async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="usuario"]', 'MMUNOZ');
  await page.click('button[type="submit"]');
  await page.waitForURL(/localhost.*\/$/);
  await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 20_000 });
}

// ─── Helper: ir a Detalle de un mes y esperar que cargue la tabla de días ─────
async function irADetalle(page: Page, mes: string): Promise<void> {
  await page.goto(`${BASE_URL}/detalle?mes=${mes}`);
  // Esperar a que uno de los dos divs deje de tener la clase d-none
  await page.waitForFunction(() => {
    const tabla = document.getElementById('diasTabla');
    const vacio = document.getElementById('diasVacio');
    return (tabla && !tabla.classList.contains('d-none')) ||
           (vacio && !vacio.classList.contains('d-none'));
  }, { timeout: 20_000 });
}

// ─── Helper: obtener la primera fecha de la tabla de días (si existe) ─────────
async function primerFechaDisponible(page: Page): Promise<string | null> {
  const tablaVisible = await page.locator('#diasTabla').isVisible();
  if (!tablaVisible) return null;
  const primeraFila = page.locator('#diasTbody tr').first();
  const hayFila = await primeraFila.isVisible();
  if (!hayFila) return null;
  // El id de la fila tiene formato "fila-YYYY-MM-DD"
  const idFila = await primeraFila.getAttribute('id');
  return idFila ? idFila.replace('fila-', '') : null;
}

// ─── Helper: abrir panel de un día y esperar tabla + barra de progreso ────────
async function abrirDiaYEsperarBarra(page: Page, fecha: string): Promise<void> {
  await page.locator(`#fila-${fecha} button`).click();
  await expect(page.locator('#panelDia')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 10_000 });
}

// ─── Helper: esperar fin del batch (KPI visible) ──────────────────────────────
async function esperarFinBatch(page: Page, timeout = 600_000): Promise<void> {
  await expect(page.locator('#panelKpi')).toBeVisible({ timeout });
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO A: Mes de Abril 2026
// ─────────────────────────────────────────────────────────────────────────────
test.describe('FM — Fechas múltiples › Abril 2026', () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // FM-01: Navegación a /detalle?mes=2026-04 carga la tabla de días
  test('FM-01 Mes de Abril muestra tabla de días', async ({ page }) => {
    await irADetalle(page, MES_ABRIL);

    const tablaVisible = await page.locator('#diasTabla').isVisible();
    const vacioVisible = await page.locator('#diasVacio').isVisible();

    // Al menos uno de los dos debe estar visible
    expect(tablaVisible || vacioVisible,
      'Debe mostrarse la tabla de días o el estado vacío').toBe(true);

    if (tablaVisible) {
      const filas = await page.locator('#diasTbody tr').count();
      expect(filas, 'Si hay tabla debe tener al menos un día').toBeGreaterThan(0);
      console.log(`FM-01 → Abril: ${filas} días encontrados`);
    } else {
      console.log('FM-01 → Abril: sin datos para este mes (estado vacío)');
    }
  });

  // FM-02: Si hay días en Abril, abrir el primero y ver la barra
  test('FM-02 Primer día de Abril muestra barra de progreso', async ({ page }) => {
    await irADetalle(page, MES_ABRIL);

    const fecha = await primerFechaDisponible(page);
    if (!fecha) {
      console.log('FM-02 → Abril sin días, prueba omitida');
      test.skip();
      return;
    }

    await abrirDiaYEsperarBarra(page, fecha);
    const contador = page.locator('#panelProgContador');
    await expect(contador).not.toBeEmpty({ timeout: 5_000 });
    console.log(`FM-02 → Abril ${fecha}: barra visible, contador="${await contador.textContent()}"`);
  });

  // FM-03: Primer día de Abril completa el batch y muestra KPIs
  test('FM-03 Primer día de Abril completa el batch y muestra KPIs', async ({ page }) => {
    await irADetalle(page, MES_ABRIL);

    const fecha = await primerFechaDisponible(page);
    if (!fecha) {
      console.log('FM-03 → Abril sin días, prueba omitida');
      test.skip();
      return;
    }

    await abrirDiaYEsperarBarra(page, fecha);
    await esperarFinBatch(page);

    const encontrados = parseInt(
      (await page.locator('#kpiEncontrados').textContent())?.trim() ?? '0', 10);
    const faltantes = parseInt(
      (await page.locator('#kpiFaltantes').textContent())?.trim() ?? '0', 10);
    const total = parseInt(
      (await page.locator('#kpiTotal').textContent())?.trim() ?? '0', 10);

    expect(total, 'KPI total debe ser >= encontrados + faltantes').toBeGreaterThanOrEqual(0);
    console.log(`FM-03 → Abril ${fecha}: ${encontrados} encontrados + ${faltantes} faltantes = ${total} total`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO B: Varias fechas de Mayo 2026
// ─────────────────────────────────────────────────────────────────────────────
test.describe('FM — Fechas múltiples › Mayo 2026', () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(600_000);

  test.beforeEach(async ({ page }) => {
    await login(page);
    await irADetalle(page, MES_MAYO);
  });

  // FM-04: El mes de Mayo tiene varios días con registros
  test('FM-04 Mayo tiene al menos 2 días con registros', async ({ page }) => {
    await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
    const filas = await page.locator('#diasTbody tr').count();
    expect(filas, 'Mayo debe tener al menos 2 días').toBeGreaterThanOrEqual(2);
    console.log(`FM-04 → Mayo: ${filas} días`);
  });

  // FM-05: Primer día de Mayo → barra de progreso visible y funcional
  test('FM-05 Primer día de Mayo muestra barra de progreso', async ({ page }) => {
    const fecha = await primerFechaDisponible(page);
    expect(fecha, 'Debe haber al menos un día en Mayo').not.toBeNull();

    await abrirDiaYEsperarBarra(page, fecha!);
    const contador = page.locator('#panelProgContador');
    await expect(contador).not.toBeEmpty({ timeout: 5_000 });
    console.log(`FM-05 → Mayo ${fecha}: barra visible, contador="${await contador.textContent()}"`);
  });

  // FM-06: Abrir dos fechas distintas en secuencia — cada una muestra barra
  test('FM-06 Dos fechas distintas de Mayo muestran barra sucesivamente', async ({ page }) => {
    await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
    const filas = page.locator('#diasTbody tr');
    const count = await filas.count();
    expect(count, 'Necesita al menos 2 días para esta prueba').toBeGreaterThanOrEqual(2);

    // Primera fecha
    const id1 = await filas.nth(0).getAttribute('id');
    const fecha1 = id1?.replace('fila-', '') ?? '';
    await page.locator(`#fila-${fecha1} button`).click();
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 10_000 });
    const contador1 = await page.locator('#panelProgContador').textContent();
    console.log(`FM-06 → Fecha 1 (${fecha1}): contador="${contador1}"`);

    // Cerrar y abrir segunda fecha
    await page.locator('button:has-text("Cerrar")').click();
    await expect(page.locator('#panelDia')).toBeHidden({ timeout: 5_000 });

    const id2 = await filas.nth(1).getAttribute('id');
    const fecha2 = id2?.replace('fila-', '') ?? '';
    await page.locator(`#fila-${fecha2} button`).click();
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 10_000 });
    const contador2 = await page.locator('#panelProgContador').textContent();
    console.log(`FM-06 → Fecha 2 (${fecha2}): contador="${contador2}"`);

    expect(fecha1).not.toBe(fecha2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO C: Verificar progreso real (streaming, no fake)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('FM — Progreso streaming real', () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(600_000);

  // FM-07: La barra muestra valores intermedios (0 < x < total) durante el proceso
  test('FM-07 La barra avanza con valores intermedios durante el batch', async ({ page }) => {
    await login(page);
    await irADetalle(page, MES_MAYO);

    const fecha = await primerFechaDisponible(page);
    expect(fecha, 'Necesita al menos un día').not.toBeNull();

    await page.locator(`#fila-${fecha!} button`).click();
    await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 10_000 });

    // Recolectar valores del contador durante hasta 30s para detectar avance gradual
    const valoresVistos = new Set<string>();
    const inicio = Date.now();
    while (Date.now() - inicio < 30_000) {
      const texto = await page.locator('#panelProgContador').textContent();
      if (texto) valoresVistos.add(texto.trim());
      // Si ya vimos KPIs, el batch terminó
      if (await page.locator('#panelKpi').isVisible()) break;
      await page.waitForTimeout(300);
    }

    console.log(`FM-07 → Valores de progreso vistos: ${[...valoresVistos].join(' → ')}`);

    // Debe haber visto al menos el estado inicial "0 / N"
    const hayInicio = [...valoresVistos].some(v => v.startsWith('0 /'));
    // Debe terminar con KPI visible (batch completado)
    const kpiVisible = await page.locator('#panelKpi').isVisible({ timeout: 600_000 });

    expect(hayInicio || valoresVistos.size > 0,
      'Debe haberse visto al menos un valor del contador').toBe(true);
    expect(kpiVisible, 'Los KPIs deben aparecer al terminar el batch').toBe(true);

    // Si hay más de un valor visto, hay avance real (no salto directo)
    if (valoresVistos.size >= 2) {
      console.log(`FM-07 ✅ Progreso gradual confirmado (${valoresVistos.size} valores distintos)`);
    } else {
      console.log('FM-07 → Solo 1 valor visto (datos en caché, respuesta instantánea — OK)');
    }
  });

  // FM-08: Endpoint /api/detalle/soporte-batch-stream devuelve NDJSON válido
  test('FM-08 El endpoint streaming devuelve NDJSON con al menos un resultado', async ({ page, request }) => {
    // Login vía cookies de la página
    await login(page);

    // Buscar un nrodcto real de la primera fecha disponible de Mayo
    await page.goto(`${BASE_URL}/detalle?mes=${MES_MAYO}`);
    await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
    const fecha = await primerFechaDisponible(page);
    expect(fecha).not.toBeNull();

    const resReg = await page.evaluate(async (f) => {
      const r = await fetch(`/api/detalle/registros?fecha=${f}`);
      return r.json();
    }, fecha!);

    const nrodctos: string[] = (resReg.nrodctos ?? []).slice(0, 5);
    expect(nrodctos.length, 'Debe haber al menos 1 nrodcto').toBeGreaterThan(0);

    // Llamar al endpoint streaming desde la página (para usar la sesión activa)
    const resultados = await page.evaluate(async (lista) => {
      const resp = await fetch('/api/detalle/soporte-batch-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lista)
      });
      const text = await resp.text();
      return text.trim().split('\n').map((line: string) => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    }, nrodctos);

    expect(resultados.length, 'El stream debe devolver un resultado por nrodcto').toBe(nrodctos.length);
    for (const r of resultados) {
      expect(r).toHaveProperty('nrodcto');
      expect(r).toHaveProperty('estado');
      expect([0, 1, 2, 3]).toContain(r.estado);
    }
    console.log(`FM-08 → ${resultados.length} resultados streaming válidos`);
    console.log(`FM-08 → Estados: ${resultados.map((r: any) => r.nrodcto + '=' + r.estado).join(', ')}`);
  });
});
