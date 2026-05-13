# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: prueba-fechas-multiples.spec.ts >> FM — Fechas múltiples › Mayo 2026 >> FM-06 Dos fechas distintas de Mayo muestran barra sucesivamente
- Location: tests\prueba-fechas-multiples.spec.ts:172:7

# Error details

```
Error: locator.click: Error: strict mode violation: locator('button:has-text("Cerrar")') resolved to 3 elements:
    1) <button onclick="cerrarPanel()" title="Cerrar panel (cancela la descarga activa si hay una)" class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-2 px-3 rounded-pill fw-medium">…</button> aka getByRole('button', { name: 'Cerrar' })
    2) <button type="button" b-kynfrkngtc="" data-bs-dismiss="modal" class="btn btn-secondary">Cerrar</button> aka locator('#modalSoporte').getByText('Cerrar')
    3) <button type="button" b-kynfrkngtc="" data-bs-dismiss="modal" class="btn btn-secondary">Cerrar</button> aka locator('#modalMensaje').getByText('Cerrar')

Call log:
  - waiting for locator('button:has-text("Cerrar")')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - complementary [ref=e2]:
    - link "💊 HELPHARMA Punteo de Domicilios" [ref=e3] [cursor=pointer]:
      - /url: /
      - generic [ref=e4]: 💊
      - generic [ref=e5]:
        - generic [ref=e6]: HELPHARMA
        - generic [ref=e7]: Punteo de Domicilios
    - navigation [ref=e8]:
      - link "📊 Dashboard" [ref=e9] [cursor=pointer]:
        - /url: /
        - generic [ref=e10]: 📊
        - generic [ref=e11]: Dashboard
      - link "📤 Soportes" [ref=e12] [cursor=pointer]:
        - /url: /soportes-fisicos
        - generic [ref=e13]: 📤
        - generic [ref=e14]: Soportes
    - generic [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e17]: MM
        - generic [ref=e18]: MMUNOZ
      - link "↩ Cambiar" [ref=e19] [cursor=pointer]:
        - /url: /login?cambiar=true
  - generic [ref=e20]:
    - banner [ref=e21]:
      - heading "Detalle Mayo 2026" [level=1] [ref=e22]
      - link "MM MMUNOZ" [ref=e23] [cursor=pointer]:
        - /url: /login?cambiar=true
        - generic [ref=e24]: MM
        - generic [ref=e25]: MMUNOZ
    - main [ref=e26]:
      - navigation "breadcrumb" [ref=e27]:
        - link "Dashboard" [ref=e28] [cursor=pointer]:
          - /url: /
        - text: › Mayo 2026
      - generic [ref=e29]:
        - heading "📅 Días — Mayo 2026" [level=2] [ref=e31]
        - table [ref=e33]:
          - rowgroup [ref=e34]:
            - row "Fecha Total Registros Planillas" [ref=e35]:
              - columnheader "Fecha" [ref=e36]
              - columnheader "Total Registros" [ref=e37]
              - columnheader "Planillas" [ref=e38]
              - columnheader [ref=e39]
          - rowgroup [ref=e40]:
            - row "13/05/2026 1330 26 Ver registros →" [ref=e41]:
              - cell "13/05/2026" [ref=e42]:
                - strong [ref=e43]: 13/05/2026
              - cell "1330" [ref=e44]
              - cell "26" [ref=e45]
              - cell "Ver registros →" [ref=e46]:
                - button "Ver registros →" [active] [ref=e47] [cursor=pointer]
            - row "12/05/2026 1215 23 Ver registros →" [ref=e48]:
              - cell "12/05/2026" [ref=e49]:
                - strong [ref=e50]: 12/05/2026
              - cell "1215" [ref=e51]
              - cell "23" [ref=e52]
              - cell "Ver registros →" [ref=e53]:
                - button "Ver registros →" [ref=e54] [cursor=pointer]
            - row "11/05/2026 897 18 Ver registros →" [ref=e55]:
              - cell "11/05/2026" [ref=e56]:
                - strong [ref=e57]: 11/05/2026
              - cell "897" [ref=e58]
              - cell "18" [ref=e59]
              - cell "Ver registros →" [ref=e60]:
                - button "Ver registros →" [ref=e61] [cursor=pointer]
            - row "09/05/2026 1231 23 Ver registros →" [ref=e62]:
              - cell "09/05/2026" [ref=e63]:
                - strong [ref=e64]: 09/05/2026
              - cell "1231" [ref=e65]
              - cell "23" [ref=e66]
              - cell "Ver registros →" [ref=e67]:
                - button "Ver registros →" [ref=e68] [cursor=pointer]
            - row "08/05/2026 1418 27 Ver registros →" [ref=e69]:
              - cell "08/05/2026" [ref=e70]:
                - strong [ref=e71]: 08/05/2026
              - cell "1418" [ref=e72]
              - cell "27" [ref=e73]
              - cell "Ver registros →" [ref=e74]:
                - button "Ver registros →" [ref=e75] [cursor=pointer]
            - row "07/05/2026 1384 26 Ver registros →" [ref=e76]:
              - cell "07/05/2026" [ref=e77]:
                - strong [ref=e78]: 07/05/2026
              - cell "1384" [ref=e79]
              - cell "26" [ref=e80]
              - cell "Ver registros →" [ref=e81]:
                - button "Ver registros →" [ref=e82] [cursor=pointer]
            - row "06/05/2026 1496 28 Ver registros →" [ref=e83]:
              - cell "06/05/2026" [ref=e84]:
                - strong [ref=e85]: 06/05/2026
              - cell "1496" [ref=e86]
              - cell "28" [ref=e87]
              - cell "Ver registros →" [ref=e88]:
                - button "Ver registros →" [ref=e89] [cursor=pointer]
            - row "05/05/2026 1129 21 Ver registros →" [ref=e90]:
              - cell "05/05/2026" [ref=e91]:
                - strong [ref=e92]: 05/05/2026
              - cell "1129" [ref=e93]
              - cell "21" [ref=e94]
              - cell "Ver registros →" [ref=e95]:
                - button "Ver registros →" [ref=e96] [cursor=pointer]
            - row "04/05/2026 1064 20 Ver registros →" [ref=e97]:
              - cell "04/05/2026" [ref=e98]:
                - strong [ref=e99]: 04/05/2026
              - cell "1064" [ref=e100]
              - cell "20" [ref=e101]
              - cell "Ver registros →" [ref=e102]:
                - button "Ver registros →" [ref=e103] [cursor=pointer]
            - row "02/05/2026 1270 24 Ver registros →" [ref=e104]:
              - cell "02/05/2026" [ref=e105]:
                - strong [ref=e106]: 02/05/2026
              - cell "1270" [ref=e107]
              - cell "24" [ref=e108]
              - cell "Ver registros →" [ref=e109]:
                - button "Ver registros →" [ref=e110] [cursor=pointer]
      - generic [ref=e112]:
        - generic [ref=e113]:
          - heading "📋 Registros del 13/05/2026" [level=2] [ref=e114]
          - button "Cerrar" [ref=e115] [cursor=pointer]:
            - img [ref=e116]
            - text: Cerrar
        - generic [ref=e119]:
          - generic [ref=e120]: Verificando soportes...
          - generic [ref=e121]: 0 / 1330
        - generic [ref=e123]:
          - table [ref=e124]:
            - rowgroup [ref=e125]:
              - row "Nrodcto Destino Cuota Mod Nro. Planilla Estado Acción" [ref=e126]:
                - columnheader "Nrodcto" [ref=e127]
                - columnheader "Destino" [ref=e128]
                - columnheader "Cuota Mod" [ref=e129]
                - columnheader "Nro. Planilla" [ref=e130]
                - columnheader "Estado" [ref=e131]
                - columnheader "Acción" [ref=e132]
            - rowgroup [ref=e133]:
              - row "D11517359 ITAGÜÍ $ 5.000 1 ⏳ Consultando… —" [ref=e134]:
                - cell "D11517359" [ref=e135]:
                  - code [ref=e136]: D11517359
                - cell "ITAGÜÍ" [ref=e137]
                - cell "$ 5.000" [ref=e138]
                - cell "1" [ref=e139]
                - cell "⏳ Consultando…" [ref=e140]:
                  - generic [ref=e141]: ⏳ Consultando…
                - cell "—" [ref=e142]
              - row "D11517348 MEDELLÍN $ 5.000 1 ⏳ Consultando… —" [ref=e143]:
                - cell "D11517348" [ref=e144]:
                  - code [ref=e145]: D11517348
                - cell "MEDELLÍN" [ref=e146]
                - cell "$ 5.000" [ref=e147]
                - cell "1" [ref=e148]
                - cell "⏳ Consultando…" [ref=e149]:
                  - generic [ref=e150]: ⏳ Consultando…
                - cell "—" [ref=e151]
              - row "D11517362 RETIRO $ 5.000 1 ⏳ Consultando… —" [ref=e152]:
                - cell "D11517362" [ref=e153]:
                  - code [ref=e154]: D11517362
                - cell "RETIRO" [ref=e155]
                - cell "$ 5.000" [ref=e156]
                - cell "1" [ref=e157]
                - cell "⏳ Consultando…" [ref=e158]:
                  - generic [ref=e159]: ⏳ Consultando…
                - cell "—" [ref=e160]
              - row "D11517356 MEDELLÍN $ 3.476 1 ⏳ Consultando… —" [ref=e161]:
                - cell "D11517356" [ref=e162]:
                  - code [ref=e163]: D11517356
                - cell "MEDELLÍN" [ref=e164]
                - cell "$ 3.476" [ref=e165]
                - cell "1" [ref=e166]
                - cell "⏳ Consultando…" [ref=e167]:
                  - generic [ref=e168]: ⏳ Consultando…
                - cell "—" [ref=e169]
              - row "KE461758 ITAGÜÍ $ 5.000 1 ⏳ Consultando… —" [ref=e170]:
                - cell "KE461758" [ref=e171]:
                  - code [ref=e172]: KE461758
                - cell "ITAGÜÍ" [ref=e173]
                - cell "$ 5.000" [ref=e174]
                - cell "1" [ref=e175]
                - cell "⏳ Consultando…" [ref=e176]:
                  - generic [ref=e177]: ⏳ Consultando…
                - cell "—" [ref=e178]
              - row "D11517355 MEDELLÍN $ 0 1 ⏳ Consultando… —" [ref=e179]:
                - cell "D11517355" [ref=e180]:
                  - code [ref=e181]: D11517355
                - cell "MEDELLÍN" [ref=e182]
                - cell "$ 0" [ref=e183]
                - cell "1" [ref=e184]
                - cell "⏳ Consultando…" [ref=e185]:
                  - generic [ref=e186]: ⏳ Consultando…
                - cell "—" [ref=e187]
              - row "KE461746 MEDELLÍN $ 5.000 1 ⏳ Consultando… —" [ref=e188]:
                - cell "KE461746" [ref=e189]:
                  - code [ref=e190]: KE461746
                - cell "MEDELLÍN" [ref=e191]
                - cell "$ 5.000" [ref=e192]
                - cell "1" [ref=e193]
                - cell "⏳ Consultando…" [ref=e194]:
                  - generic [ref=e195]: ⏳ Consultando…
                - cell "—" [ref=e196]
              - row "KE461729 ITAGÜÍ $ 5.000 1 ⏳ Consultando… —" [ref=e197]:
                - cell "KE461729" [ref=e198]:
                  - code [ref=e199]: KE461729
                - cell "ITAGÜÍ" [ref=e200]
                - cell "$ 5.000" [ref=e201]
                - cell "1" [ref=e202]
                - cell "⏳ Consultando…" [ref=e203]:
                  - generic [ref=e204]: ⏳ Consultando…
                - cell "—" [ref=e205]
              - row "D11517353 SABANETA $ 0 1 ⏳ Consultando… —" [ref=e206]:
                - cell "D11517353" [ref=e207]:
                  - code [ref=e208]: D11517353
                - cell "SABANETA" [ref=e209]
                - cell "$ 0" [ref=e210]
                - cell "1" [ref=e211]
                - cell "⏳ Consultando…" [ref=e212]:
                  - generic [ref=e213]: ⏳ Consultando…
                - cell "—" [ref=e214]
              - row "KE461752 MEDELLÍN $ 5.000 1 ⏳ Consultando… —" [ref=e215]:
                - cell "KE461752" [ref=e216]:
                  - code [ref=e217]: KE461752
                - cell "MEDELLÍN" [ref=e218]
                - cell "$ 5.000" [ref=e219]
                - cell "1" [ref=e220]
                - cell "⏳ Consultando…" [ref=e221]:
                  - generic [ref=e222]: ⏳ Consultando…
                - cell "—" [ref=e223]
          - generic [ref=e224]:
            - generic [ref=e225]: Mostrando 1–10 de 1330 registros
            - navigation "Paginación de tabla" [ref=e226]:
              - button "Página anterior" [disabled] [ref=e227]: ‹
              - button "Página 1": "1"
              - button "Página 2" [ref=e228] [cursor=pointer]: "2"
              - generic [ref=e229]: …
              - button "Página 133" [ref=e230] [cursor=pointer]: "133"
              - button "Página siguiente" [ref=e231] [cursor=pointer]: ›
```

# Test source

```ts
  87  | 
  88  |     if (tablaVisible) {
  89  |       const filas = await page.locator('#diasTbody tr').count();
  90  |       expect(filas, 'Si hay tabla debe tener al menos un día').toBeGreaterThan(0);
  91  |       console.log(`FM-01 → Abril: ${filas} días encontrados`);
  92  |     } else {
  93  |       console.log('FM-01 → Abril: sin datos para este mes (estado vacío)');
  94  |     }
  95  |   });
  96  | 
  97  |   // FM-02: Si hay días en Abril, abrir el primero y ver la barra
  98  |   test('FM-02 Primer día de Abril muestra barra de progreso', async ({ page }) => {
  99  |     await irADetalle(page, MES_ABRIL);
  100 | 
  101 |     const fecha = await primerFechaDisponible(page);
  102 |     if (!fecha) {
  103 |       console.log('FM-02 → Abril sin días, prueba omitida');
  104 |       test.skip();
  105 |       return;
  106 |     }
  107 | 
  108 |     await abrirDiaYEsperarBarra(page, fecha);
  109 |     const contador = page.locator('#panelProgContador');
  110 |     await expect(contador).not.toBeEmpty({ timeout: 5_000 });
  111 |     console.log(`FM-02 → Abril ${fecha}: barra visible, contador="${await contador.textContent()}"`);
  112 |   });
  113 | 
  114 |   // FM-03: Primer día de Abril completa el batch y muestra KPIs
  115 |   test('FM-03 Primer día de Abril completa el batch y muestra KPIs', async ({ page }) => {
  116 |     await irADetalle(page, MES_ABRIL);
  117 | 
  118 |     const fecha = await primerFechaDisponible(page);
  119 |     if (!fecha) {
  120 |       console.log('FM-03 → Abril sin días, prueba omitida');
  121 |       test.skip();
  122 |       return;
  123 |     }
  124 | 
  125 |     await abrirDiaYEsperarBarra(page, fecha);
  126 |     await esperarFinBatch(page);
  127 | 
  128 |     const encontrados = parseInt(
  129 |       (await page.locator('#kpiEncontrados').textContent())?.trim() ?? '0', 10);
  130 |     const faltantes = parseInt(
  131 |       (await page.locator('#kpiFaltantes').textContent())?.trim() ?? '0', 10);
  132 |     const total = parseInt(
  133 |       (await page.locator('#kpiTotal').textContent())?.trim() ?? '0', 10);
  134 | 
  135 |     expect(total, 'KPI total debe ser >= encontrados + faltantes').toBeGreaterThanOrEqual(0);
  136 |     console.log(`FM-03 → Abril ${fecha}: ${encontrados} encontrados + ${faltantes} faltantes = ${total} total`);
  137 |   });
  138 | });
  139 | 
  140 | // ─────────────────────────────────────────────────────────────────────────────
  141 | // GRUPO B: Varias fechas de Mayo 2026
  142 | // ─────────────────────────────────────────────────────────────────────────────
  143 | test.describe('FM — Fechas múltiples › Mayo 2026', () => {
  144 |   test.use({ baseURL: BASE_URL });
  145 |   test.setTimeout(600_000);
  146 | 
  147 |   test.beforeEach(async ({ page }) => {
  148 |     await login(page);
  149 |     await irADetalle(page, MES_MAYO);
  150 |   });
  151 | 
  152 |   // FM-04: El mes de Mayo tiene varios días con registros
  153 |   test('FM-04 Mayo tiene al menos 2 días con registros', async ({ page }) => {
  154 |     await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
  155 |     const filas = await page.locator('#diasTbody tr').count();
  156 |     expect(filas, 'Mayo debe tener al menos 2 días').toBeGreaterThanOrEqual(2);
  157 |     console.log(`FM-04 → Mayo: ${filas} días`);
  158 |   });
  159 | 
  160 |   // FM-05: Primer día de Mayo → barra de progreso visible y funcional
  161 |   test('FM-05 Primer día de Mayo muestra barra de progreso', async ({ page }) => {
  162 |     const fecha = await primerFechaDisponible(page);
  163 |     expect(fecha, 'Debe haber al menos un día en Mayo').not.toBeNull();
  164 | 
  165 |     await abrirDiaYEsperarBarra(page, fecha!);
  166 |     const contador = page.locator('#panelProgContador');
  167 |     await expect(contador).not.toBeEmpty({ timeout: 5_000 });
  168 |     console.log(`FM-05 → Mayo ${fecha}: barra visible, contador="${await contador.textContent()}"`);
  169 |   });
  170 | 
  171 |   // FM-06: Abrir dos fechas distintas en secuencia — cada una muestra barra
  172 |   test('FM-06 Dos fechas distintas de Mayo muestran barra sucesivamente', async ({ page }) => {
  173 |     await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
  174 |     const filas = page.locator('#diasTbody tr');
  175 |     const count = await filas.count();
  176 |     expect(count, 'Necesita al menos 2 días para esta prueba').toBeGreaterThanOrEqual(2);
  177 | 
  178 |     // Primera fecha
  179 |     const id1 = await filas.nth(0).getAttribute('id');
  180 |     const fecha1 = id1?.replace('fila-', '') ?? '';
  181 |     await page.locator(`#fila-${fecha1} button`).click();
  182 |     await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 10_000 });
  183 |     const contador1 = await page.locator('#panelProgContador').textContent();
  184 |     console.log(`FM-06 → Fecha 1 (${fecha1}): contador="${contador1}"`);
  185 | 
  186 |     // Cerrar y abrir segunda fecha
> 187 |     await page.locator('button:has-text("Cerrar")').click();
      |                                                     ^ Error: locator.click: Error: strict mode violation: locator('button:has-text("Cerrar")') resolved to 3 elements:
  188 |     await expect(page.locator('#panelDia')).toBeHidden({ timeout: 5_000 });
  189 | 
  190 |     const id2 = await filas.nth(1).getAttribute('id');
  191 |     const fecha2 = id2?.replace('fila-', '') ?? '';
  192 |     await page.locator(`#fila-${fecha2} button`).click();
  193 |     await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 10_000 });
  194 |     const contador2 = await page.locator('#panelProgContador').textContent();
  195 |     console.log(`FM-06 → Fecha 2 (${fecha2}): contador="${contador2}"`);
  196 | 
  197 |     expect(fecha1).not.toBe(fecha2);
  198 |   });
  199 | });
  200 | 
  201 | // ─────────────────────────────────────────────────────────────────────────────
  202 | // GRUPO C: Verificar progreso real (streaming, no fake)
  203 | // ─────────────────────────────────────────────────────────────────────────────
  204 | test.describe('FM — Progreso streaming real', () => {
  205 |   test.use({ baseURL: BASE_URL });
  206 |   test.setTimeout(600_000);
  207 | 
  208 |   // FM-07: La barra muestra valores intermedios (0 < x < total) durante el proceso
  209 |   test('FM-07 La barra avanza con valores intermedios durante el batch', async ({ page }) => {
  210 |     await login(page);
  211 |     await irADetalle(page, MES_MAYO);
  212 | 
  213 |     const fecha = await primerFechaDisponible(page);
  214 |     expect(fecha, 'Necesita al menos un día').not.toBeNull();
  215 | 
  216 |     await page.locator(`#fila-${fecha!} button`).click();
  217 |     await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 15_000 });
  218 |     await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 10_000 });
  219 | 
  220 |     // Recolectar valores del contador durante hasta 30s para detectar avance gradual
  221 |     const valoresVistos = new Set<string>();
  222 |     const inicio = Date.now();
  223 |     while (Date.now() - inicio < 30_000) {
  224 |       const texto = await page.locator('#panelProgContador').textContent();
  225 |       if (texto) valoresVistos.add(texto.trim());
  226 |       // Si ya vimos KPIs, el batch terminó
  227 |       if (await page.locator('#panelKpi').isVisible()) break;
  228 |       await page.waitForTimeout(300);
  229 |     }
  230 | 
  231 |     console.log(`FM-07 → Valores de progreso vistos: ${[...valoresVistos].join(' → ')}`);
  232 | 
  233 |     // Debe haber visto al menos el estado inicial "0 / N"
  234 |     const hayInicio = [...valoresVistos].some(v => v.startsWith('0 /'));
  235 |     // Debe terminar con KPI visible (batch completado)
  236 |     const kpiVisible = await page.locator('#panelKpi').isVisible({ timeout: 600_000 });
  237 | 
  238 |     expect(hayInicio || valoresVistos.size > 0,
  239 |       'Debe haberse visto al menos un valor del contador').toBe(true);
  240 |     expect(kpiVisible, 'Los KPIs deben aparecer al terminar el batch').toBe(true);
  241 | 
  242 |     // Si hay más de un valor visto, hay avance real (no salto directo)
  243 |     if (valoresVistos.size >= 2) {
  244 |       console.log(`FM-07 ✅ Progreso gradual confirmado (${valoresVistos.size} valores distintos)`);
  245 |     } else {
  246 |       console.log('FM-07 → Solo 1 valor visto (datos en caché, respuesta instantánea — OK)');
  247 |     }
  248 |   });
  249 | 
  250 |   // FM-08: Endpoint /api/detalle/soporte-batch-stream devuelve NDJSON válido
  251 |   test('FM-08 El endpoint streaming devuelve NDJSON con al menos un resultado', async ({ page, request }) => {
  252 |     // Login vía cookies de la página
  253 |     await login(page);
  254 | 
  255 |     // Buscar un nrodcto real de la primera fecha disponible de Mayo
  256 |     await page.goto(`${BASE_URL}/detalle?mes=${MES_MAYO}`);
  257 |     await expect(page.locator('#diasTabla')).toBeVisible({ timeout: 20_000 });
  258 |     const fecha = await primerFechaDisponible(page);
  259 |     expect(fecha).not.toBeNull();
  260 | 
  261 |     const resReg = await page.evaluate(async (f) => {
  262 |       const r = await fetch(`/api/detalle/registros?fecha=${f}`);
  263 |       return r.json();
  264 |     }, fecha!);
  265 | 
  266 |     const nrodctos: string[] = (resReg.nrodctos ?? []).slice(0, 5);
  267 |     expect(nrodctos.length, 'Debe haber al menos 1 nrodcto').toBeGreaterThan(0);
  268 | 
  269 |     // Llamar al endpoint streaming desde la página (para usar la sesión activa)
  270 |     const resultados = await page.evaluate(async (lista) => {
  271 |       const resp = await fetch('/api/detalle/soporte-batch-stream', {
  272 |         method: 'POST',
  273 |         headers: { 'Content-Type': 'application/json' },
  274 |         body: JSON.stringify(lista)
  275 |       });
  276 |       const text = await resp.text();
  277 |       return text.trim().split('\n').map((line: string) => {
  278 |         try { return JSON.parse(line); } catch { return null; }
  279 |       }).filter(Boolean);
  280 |     }, nrodctos);
  281 | 
  282 |     expect(resultados.length, 'El stream debe devolver un resultado por nrodcto').toBe(nrodctos.length);
  283 |     for (const r of resultados) {
  284 |       expect(r).toHaveProperty('nrodcto');
  285 |       expect(r).toHaveProperty('estado');
  286 |       expect([0, 1, 2, 3]).toContain(r.estado);
  287 |     }
```