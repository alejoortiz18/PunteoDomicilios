/**
 * diagnostico-12mayo.mjs
 * Prueba de carga para la fecha 2026-05-12 (1215 registros).
 * Ejecutar con: node diagnostico-12mayo.mjs
 */
import { chromium } from './node_modules/playwright/index.mjs';

const BASE_URL   = 'http://localhost:5125';
const FECHA      = '2026-05-12';
const USUARIO    = 'MMUNOZ';
// Timeout generoso: si el L2 está frío el batch tarda ~10 min
const BATCH_TIMEOUT_MS = 700_000;

(async () => {
  console.log('════════════════════════════════════════════════════');
  console.log(' DIAGNÓSTICO — Fecha: ' + FECHA);
  console.log('════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  // ── PASO 1 · LOGIN ─────────────────────────────────────────
  console.log('PASO 1 · Login como ' + USUARIO + '...');
  await page.goto(BASE_URL + '/login');
  await page.fill('input[name="usuario"]', USUARIO);
  await page.click('button[type="submit"]');
  await page.waitForURL(/localhost.*\//);
  console.log('         ✅ Login OK\n');

  // ── PASO 2 · REGISTROS DEL DÍA ─────────────────────────────
  console.log('PASO 2 · Consultando registros del ' + FECHA + ' (BD SQL Server)...');
  const t1 = Date.now();
  const r1  = await page.request.get(BASE_URL + '/api/detalle/registros?fecha=' + FECHA);
  const data = await r1.json();
  const registros = data.registros ?? [];
  const nrodctos  = data.nrodctos  ?? [];
  const t1ms = Date.now() - t1;
  console.log('         Filas en tabla   : ' + registros.length);
  console.log('         Nrodctos únicos  : ' + nrodctos.length);
  console.log('         Tiempo BD        : ' + (t1ms / 1000).toFixed(2) + 's\n');

  if (nrodctos.length === 0) {
    console.log('❌ No hay registros para ' + FECHA + '. Verifica la BD.');
    await browser.close();
    process.exit(1);
  }

  // ── PASO 3 · PRE-CALENTAMIENTO L2 ──────────────────────────
  console.log('PASO 3 · Consultando estado caché L2 (SQL LocalDB)...');
  console.log('         (el servidor verifica cuántos docs ya están en caché local)');
  // El pre-calentamiento ocurre internamente dentro del endpoint soporte-batch.
  // Mostramos al usuario lo que esperamos que haga el servidor.
  console.log('         Esperado: buscar ' + nrodctos.length + ' docs en DocumentCacheDB\n');

  // ── PASO 4 · BATCH API EXTERNA ─────────────────────────────
  console.log('PASO 4 · Ejecutando soporte-batch (' + nrodctos.length + ' nrodctos)...');
  console.log('         (docs sin caché → API externa intranet.helpharma.com, 5 concurrentes)');
  const t2 = Date.now();
  let batchOk = false;
  let items   = [];
  try {
    const r2 = await page.request.post(BASE_URL + '/api/detalle/soporte-batch', {
      data   : nrodctos,
      headers: { 'Content-Type': 'application/json' },
      timeout: BATCH_TIMEOUT_MS,
    });
    items  = await r2.json();
    batchOk = true;
  } catch (e) {
    const elapsed = ((Date.now() - t2) / 1000).toFixed(1);
    console.log('\n❌ TIMEOUT o ERROR en soporte-batch tras ' + elapsed + 's');
    console.log('   Mensaje: ' + e.message);
    console.log('\n   Causa probable: L2 frío para esta fecha (1215 docs × ~3s ÷ 5 concurrentes ≈ 12 min)');
    console.log('   El batch SIGUE CORRIENDO en el servidor — espera y reintenta.\n');
    await browser.close();
    process.exit(1);
  }

  const elapsed = ((Date.now() - t2) / 1000).toFixed(1);

  // ── PASO 5 · RESULTADOS ────────────────────────────────────
  const encontrados = items.filter(i => i.estado === 1).length;
  const faltantes   = items.filter(i => i.estado === 2).length;
  const errores     = items.filter(i => i.estado === 3).length;

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  RESULTADO — ' + FECHA + '  (' + elapsed + 's)');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Total procesados : ' + items.length);
  console.log('║  ✅ Encontrados   : ' + encontrados);
  console.log('║  ❌ Sin soporte   : ' + faltantes);
  console.log('║  ⚠️  Errores API  : ' + errores);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (errores > 0) {
    console.log('Primeros 10 con error:');
    items.filter(i => i.estado === 3).slice(0, 10).forEach(i =>
      console.log('  ' + i.nrodcto + ': ' + (i.mensaje ?? 'sin mensaje'))
    );
    console.log();
  }

  if (encontrados > 0) {
    const ej = items.find(i => i.estado === 1);
    console.log('Ejemplo encontrado : ' + ej.nrodcto + ' → ' + ej.storagePath);
  }

  console.log('\n' + (encontrados > 0
    ? '✅ PASS — encontrados (' + encontrados + ') > 0'
    : '❌ FAIL — encontrados === 0'));

  // ── PASO 6 · VERIFICAR KPIs ───────────────────────────────
  console.log('\nPASO 5 · Verificando endpoint KPI del día...');
  const r3 = await page.request.get(BASE_URL + '/api/detalle/kpi?fecha=' + FECHA);
  if (r3.ok()) {
    const kpi = await r3.json();
    console.log('         Total     : ' + kpi.total);
    console.log('         ConSoporte: ' + kpi.conSoporte);
    console.log('         SinSoporte: ' + kpi.sinSoporte);
  } else {
    console.log('         KPI endpoint: HTTP ' + r3.status());
  }

  await browser.close();
  console.log('\n✅ Diagnóstico completo.\n');
})();
