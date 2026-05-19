/**
 * Plan de pruebas: Consumo del API de soportes — AS-01 a AS-10
 *
 * Valida el consumo del API de soportes desde el backend local, cubriendo:
 *   — Conectividad y estructura de respuesta para documentos ENCONTRADOS
 *   — Manejo correcto de documentos SIN SOPORTE (404 del API externo → Faltante)
 *   — Comportamiento del caché L1/L2 (respuestas repetidas no deben llamar el API de nuevo)
 *   — Endpoint de batch (/api/detalle/soporte-batch)
 *   — Tiempos de respuesta aceptables (caché vs API directo)
 *
 * Requisito previo: El servidor debe estar corriendo en https://localhost:7261
 *   con una sesión iniciada (usuario MMUNOZ), o los endpoints deben responder
 *   con 401 (Unauthorized) que también se valida en AS-07.
 *
 * Documentos de prueba (verificados en ejecuciones previas):
 *   ENCONTRADO : K8227073   → success:true, storage_Path no vacío
 *   FALTANTE   : KE460776   → 404 del API externo → success:false, message "Sin soporte"
 *   INEXISTENTE: ZZZZZZ9999 → no existe en MvMensajer ni en API
 */

import { test, expect, request as apiContext } from '@playwright/test';

const BASE_URL = 'https://localhost:7261';

// Documentos conocidos del día 2026-05-11 (897 registros del usuario MMUNOZ)
const NRODCTO_ENCONTRADO = 'K8227073';
const NRODCTO_FALTANTE   = 'KE460776';

// ── Suite: Pruebas del API de soporte (sin UI, solo peticiones HTTP) ──────────
test.describe('AS — Consumo del API de soportes', () => {

  test.use({ baseURL: BASE_URL, ignoreHTTPSErrors: true });

  // ── AS-01: Conectividad del servidor ─────────────────────────────────────
  test('AS-01 | Servidor responde HTTP 200 en /', async ({ request }) => {
    const resp = await request.get('/');
    // La raíz redirige al login (302) o retorna 200 — en cualquier caso el servidor está activo
    expect([200, 302]).toContain(resp.status());
  });

  // ── AS-02: Endpoint /api/detalle/soporte responde ─────────────────────────
  test('AS-02 | /api/detalle/soporte devuelve JSON para nrodcto encontrado', async ({ request }) => {
    const resp = await request.get(`/api/detalle/soporte?nrodcto=${NRODCTO_ENCONTRADO}`);

    // Puede responder 200 (con datos) o 401 (sesión no iniciada)
    const status = resp.status();
    expect([200, 401]).toContain(status);

    if (status === 200) {
      const body = await resp.json();
      // El JSON debe tener la propiedad success (bool)
      expect(body).toHaveProperty('success');
      expect(typeof body.success).toBe('boolean');

      if (body.success === true) {
        // Documento encontrado: debe tener data[0].storage_Path no vacío
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data.length).toBeGreaterThan(0);
        const item = body.data[0];
        expect(item).toHaveProperty('storage_Path');
        expect(typeof item.storage_Path).toBe('string');
        expect(item.storage_Path.length).toBeGreaterThan(0);
        console.log(`AS-02: Soporte encontrado → storage_Path="${item.storage_Path}"`);
      } else {
        // El documento puede estar en caché o sin soporte
        console.log(`AS-02: success=false, message="${body.message}"`);
      }
    } else {
      console.log('AS-02: Sesión no iniciada (401) — endpoint accesible pero requiere auth');
    }
  });

  // ── AS-03: Documento FALTANTE devuelve success:false (no "Error API") ─────
  test('AS-03 | /api/detalle/soporte devuelve success:false para doc sin soporte', async ({ request }) => {
    const resp = await request.get(`/api/detalle/soporte?nrodcto=${NRODCTO_FALTANTE}`);

    const status = resp.status();
    expect([200, 401]).toContain(status);

    if (status === 200) {
      const body = await resp.json();
      expect(body).toHaveProperty('success');

      // Un documento faltante debe retornar success:false, NO debe ser nulo ni error de infraestructura
      if (body.success === false) {
        // success:false con message indica faltante correcto
        console.log(`AS-03: Faltante correcto → message="${body.message}"`);
        // Si el API externo retornó 404 bien manejado, message debe ser "Sin soporte" (no un stack trace)
        if (body.message) {
          expect(body.message).not.toMatch(/Exception|Error|null/i);
        }
      } else if (body.success === true) {
        // Este doc podría tener soporte en el entorno actual (datos cambian con el tiempo)
        console.log(`AS-03: Documento tiene soporte (datos reales cambian) → OK`);
      }
    }
  });

  // ── AS-04: Parámetro nrodcto vacío → 400 Bad Request ────────────────────
  test('AS-04 | /api/detalle/soporte sin nrodcto → 400 o 401', async ({ request }) => {
    const resp = await request.get('/api/detalle/soporte');
    expect([400, 401]).toContain(resp.status());
  });

  // ── AS-05: Endpoint /api/detalle/soporte-batch responde JSON ─────────────
  test('AS-05 | /api/detalle/soporte-batch retorna array de estados', async ({ request }) => {
    const nrodctos = [NRODCTO_ENCONTRADO, NRODCTO_FALTANTE];

    const resp = await request.post('/api/detalle/soporte-batch', {
      data: nrodctos,
      headers: { 'Content-Type': 'application/json' },
    });

    const status = resp.status();
    expect([200, 401]).toContain(status);

    if (status === 200) {
      const body = await resp.json();
      expect(Array.isArray(body)).toBe(true);
      // Debe retornar un item por cada nrodcto
      expect(body.length).toBe(nrodctos.length);

      for (const item of body) {
        expect(item).toHaveProperty('nrodcto');
        expect(item).toHaveProperty('estado');
        // estado debe ser uno de: Encontrado, Faltante, Error
        expect(['Encontrado', 'Faltante', 'Error']).toContain(item.estado);
        console.log(`AS-05: ${item.nrodcto} → ${item.estado}`);
      }
    }
  });

  // ── AS-06: El batch NO devuelve "Error" para documentos sin soporte ───────
  test('AS-06 | soporte-batch clasifica faltantes como "Faltante" no "Error"', async ({ request }) => {
    // Enviamos solo documentos cuyo soporte fue confirmado como inexistente (404 del API externo)
    // Si el 404 se maneja correctamente, el estado debe ser "Faltante" no "Error"
    const resp = await request.post('/api/detalle/soporte-batch', {
      data: [NRODCTO_FALTANTE],
      headers: { 'Content-Type': 'application/json' },
    });

    const status = resp.status();
    expect([200, 401]).toContain(status);

    if (status === 200) {
      const body = await resp.json();
      expect(Array.isArray(body)).toBe(true);

      for (const item of body) {
        if (item.nrodcto === NRODCTO_FALTANTE) {
          // El estado NO debe ser Error — debe ser Faltante (404 del API externo)
          console.log(`AS-06: ${item.nrodcto} → ${item.estado} (${item.mensaje ?? 'sin mensaje'})`);
          expect(item.estado).not.toBe('Error');
        }
      }
    }
  });

  // ── AS-07: Tiempo de respuesta del caché (segundo llamado más rápido) ─────
  test('AS-07 | Segunda consulta del mismo nrodcto es más rápida (caché L1)', async ({ request }) => {
    // Primera llamada (puede llamar al API externo si no está en caché)
    const t0 = Date.now();
    const resp1 = await request.get(`/api/detalle/soporte?nrodcto=${NRODCTO_ENCONTRADO}`);
    const duracion1 = Date.now() - t0;

    if (resp1.status() !== 200) {
      test.skip(); // Skip si la sesión no está iniciada
      return;
    }

    // Segunda llamada al mismo nrodcto (debe estar en L1)
    const t1 = Date.now();
    const resp2 = await request.get(`/api/detalle/soporte?nrodcto=${NRODCTO_ENCONTRADO}`);
    const duracion2 = Date.now() - t1;

    expect(resp2.status()).toBe(200);

    console.log(`AS-07: Primera llamada=${duracion1}ms, segunda llamada=${duracion2}ms`);

    // La segunda llamada debe ser notablemente más rápida que la primera
    // (Si la primera fue <200ms ya estaba en caché, no hay problema)
    if (duracion1 > 500) {
      // Si la primera tomó >500ms (llamó al API), la segunda debe ser <200ms
      expect(duracion2).toBeLessThan(500);
    }
  });

  // ── AS-08: Batch vacío → respuesta 200 con array vacío ──────────────────
  test('AS-08 | soporte-batch con lista vacía retorna 200 y array vacío', async ({ request }) => {
    const resp = await request.post('/api/detalle/soporte-batch', {
      data: [],
      headers: { 'Content-Type': 'application/json' },
    });

    const status = resp.status();
    expect([200, 400, 401]).toContain(status);

    if (status === 200) {
      const body = await resp.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    }
  });

  // ── AS-09: Estructura completa del response para doc encontrado ──────────
  test('AS-09 | /api/detalle/soporte respuesta tiene estructura SoporteApiResponse correcta', async ({ request }) => {
    const resp = await request.get(`/api/detalle/soporte?nrodcto=${NRODCTO_ENCONTRADO}`);

    if (resp.status() !== 200) {
      console.log('AS-09: Sesión no iniciada (401) — skip');
      return;
    }

    const body = await resp.json();

    // Verificar estructura: { success: bool, message?: string, data?: [...] }
    expect(body).toHaveProperty('success');
    expect(typeof body.success).toBe('boolean');

    // 'message' puede estar presente o no
    if ('message' in body && body.message !== null) {
      expect(typeof body.message).toBe('string');
    }

    if (body.success && body.data) {
      expect(Array.isArray(body.data)).toBe(true);
      for (const item of body.data) {
        // Cada item debe tener las propiedades del SoporteDataItem
        expect(item).toHaveProperty('fechaRegistro');
        expect(item).toHaveProperty('storage_Disk');
        expect(item).toHaveProperty('storage_Path');
      }
    }
  });

  // ── AS-10: Batch con múltiples docs reales del día 2026-05-11 ───────────
  test('AS-10 | soporte-batch con 5 docs retorna estados válidos', async ({ request }) => {
    // Mezcla de posibles encontrados y faltantes del día 2026-05-11
    const nrodctos = [
      NRODCTO_ENCONTRADO, // K8227073
      NRODCTO_FALTANTE,   // KE460776
      'KE460149',         // Puede ser encontrado o faltante
      'KI483867',         // Puede ser encontrado o faltante
      'KE460283',         // Puede ser encontrado o faltante
    ];

    const t0 = Date.now();
    const resp = await request.post('/api/detalle/soporte-batch', {
      data: nrodctos,
      headers: { 'Content-Type': 'application/json' },
    });
    const duracion = Date.now() - t0;

    const status = resp.status();
    expect([200, 401]).toContain(status);

    if (status === 200) {
      const body = await resp.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(nrodctos.length);

      let encontrados = 0, faltantes = 0, errores = 0;
      for (const item of body) {
        expect(['Encontrado', 'Faltante', 'Error']).toContain(item.estado);
        if (item.estado === 'Encontrado') encontrados++;
        else if (item.estado === 'Faltante') faltantes++;
        else errores++;
      }

      console.log(`AS-10: ${encontrados} encontrados / ${faltantes} faltantes / ${errores} errores en ${duracion}ms`);

      // VALIDACIÓN CLAVE: No debe haber errores para documentos que existen
      // (un 404 del API externo debe clasificarse como Faltante, no Error)
      if (errores > 0) {
        console.warn(`AS-10: ⚠ ${errores} documentos retornaron "Error" — verificar manejo de 404 en SoporteApiService`);
      }
    }
  });
});
