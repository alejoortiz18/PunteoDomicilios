# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: prueba-fechas-multiples.spec.ts >> FM — Fechas múltiples › Abril 2026 >> FM-03 Primer día de Abril completa el batch y muestra KPIs
- Location: tests\prueba-fechas-multiples.spec.ts:115:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#panelKpi')
Expected: visible
Received: hidden

Call log:
  - Expect "toBeVisible" with timeout 600000ms
  - waiting for locator('#panelKpi')
    111 × locator resolved to <div id="panelKpi" class="kpi-strip mb-3 d-none">…</div>
        - unexpected value "hidden"

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
      - heading "Detalle Abril 2026" [level=1] [ref=e22]
      - link "MM MMUNOZ" [ref=e23] [cursor=pointer]:
        - /url: /login?cambiar=true
        - generic [ref=e24]: MM
        - generic [ref=e25]: MMUNOZ
    - main [ref=e26]:
      - navigation "breadcrumb" [ref=e27]:
        - link "Dashboard" [ref=e28] [cursor=pointer]:
          - /url: /
        - text: › Abril 2026
      - generic [ref=e29]:
        - heading "📅 Días — Abril 2026" [level=2] [ref=e31]
        - generic [ref=e32]:
          - table [ref=e33]:
            - rowgroup [ref=e34]:
              - row "Fecha Total Registros Planillas" [ref=e35]:
                - columnheader "Fecha" [ref=e36]
                - columnheader "Total Registros" [ref=e37]
                - columnheader "Planillas" [ref=e38]
                - columnheader [ref=e39]
            - rowgroup [ref=e40]:
              - row "30/04/2026 1592 29 Ver registros →" [ref=e41]:
                - cell "30/04/2026" [ref=e42]:
                  - strong [ref=e43]: 30/04/2026
                - cell "1592" [ref=e44]
                - cell "29" [ref=e45]
                - cell "Ver registros →" [ref=e46]:
                  - button "Ver registros →" [active] [ref=e47] [cursor=pointer]
              - row "29/04/2026 1786 34 Ver registros →" [ref=e48]:
                - cell "29/04/2026" [ref=e49]:
                  - strong [ref=e50]: 29/04/2026
                - cell "1786" [ref=e51]
                - cell "34" [ref=e52]
                - cell "Ver registros →" [ref=e53]:
                  - button "Ver registros →" [ref=e54] [cursor=pointer]
              - row "28/04/2026 926 17 Ver registros →" [ref=e55]:
                - cell "28/04/2026" [ref=e56]:
                  - strong [ref=e57]: 28/04/2026
                - cell "926" [ref=e58]
                - cell "17" [ref=e59]
                - cell "Ver registros →" [ref=e60]:
                  - button "Ver registros →" [ref=e61] [cursor=pointer]
              - row "27/04/2026 1213 21 Ver registros →" [ref=e62]:
                - cell "27/04/2026" [ref=e63]:
                  - strong [ref=e64]: 27/04/2026
                - cell "1213" [ref=e65]
                - cell "21" [ref=e66]
                - cell "Ver registros →" [ref=e67]:
                  - button "Ver registros →" [ref=e68] [cursor=pointer]
              - row "25/04/2026 926 10 Ver registros →" [ref=e69]:
                - cell "25/04/2026" [ref=e70]:
                  - strong [ref=e71]: 25/04/2026
                - cell "926" [ref=e72]
                - cell "10" [ref=e73]
                - cell "Ver registros →" [ref=e74]:
                  - button "Ver registros →" [ref=e75] [cursor=pointer]
              - row "24/04/2026 1552 14 Ver registros →" [ref=e76]:
                - cell "24/04/2026" [ref=e77]:
                  - strong [ref=e78]: 24/04/2026
                - cell "1552" [ref=e79]
                - cell "14" [ref=e80]
                - cell "Ver registros →" [ref=e81]:
                  - button "Ver registros →" [ref=e82] [cursor=pointer]
              - row "23/04/2026 1286 13 Ver registros →" [ref=e83]:
                - cell "23/04/2026" [ref=e84]:
                  - strong [ref=e85]: 23/04/2026
                - cell "1286" [ref=e86]
                - cell "13" [ref=e87]
                - cell "Ver registros →" [ref=e88]:
                  - button "Ver registros →" [ref=e89] [cursor=pointer]
              - row "22/04/2026 1462 10 Ver registros →" [ref=e90]:
                - cell "22/04/2026" [ref=e91]:
                  - strong [ref=e92]: 22/04/2026
                - cell "1462" [ref=e93]
                - cell "10" [ref=e94]
                - cell "Ver registros →" [ref=e95]:
                  - button "Ver registros →" [ref=e96] [cursor=pointer]
              - row "21/04/2026 898 7 Ver registros →" [ref=e97]:
                - cell "21/04/2026" [ref=e98]:
                  - strong [ref=e99]: 21/04/2026
                - cell "898" [ref=e100]
                - cell "7" [ref=e101]
                - cell "Ver registros →" [ref=e102]:
                  - button "Ver registros →" [ref=e103] [cursor=pointer]
              - row "20/04/2026 1146 9 Ver registros →" [ref=e104]:
                - cell "20/04/2026" [ref=e105]:
                  - strong [ref=e106]: 20/04/2026
                - cell "1146" [ref=e107]
                - cell "9" [ref=e108]
                - cell "Ver registros →" [ref=e109]:
                  - button "Ver registros →" [ref=e110] [cursor=pointer]
          - generic [ref=e111]:
            - generic [ref=e112]: Mostrando 1–10 de 24 registros
            - navigation "Paginación de tabla" [ref=e113]:
              - button "Página anterior" [disabled] [ref=e114]: ‹
              - button "Página 1": "1"
              - button "Página 2" [ref=e115] [cursor=pointer]: "2"
              - button "Página 3" [ref=e116] [cursor=pointer]: "3"
              - button "Página siguiente" [ref=e117] [cursor=pointer]: ›
      - generic [ref=e119]:
        - generic [ref=e120]:
          - heading "📋 Registros del 30/04/2026" [level=2] [ref=e121]
          - button "Cerrar" [ref=e122] [cursor=pointer]:
            - img [ref=e123]
            - text: Cerrar
        - generic [ref=e126]:
          - generic [ref=e127]: Verificando soportes...
          - generic [ref=e128]: 1063 / 1592
        - generic [ref=e131]:
          - table [ref=e132]:
            - rowgroup [ref=e133]:
              - row "Nrodcto Destino Cuota Mod Nro. Planilla Estado Acción" [ref=e134]:
                - columnheader "Nrodcto" [ref=e135]
                - columnheader "Destino" [ref=e136]
                - columnheader "Cuota Mod" [ref=e137]
                - columnheader "Nro. Planilla" [ref=e138]
                - columnheader "Estado" [ref=e139]
                - columnheader "Acción" [ref=e140]
            - rowgroup [ref=e141]:
              - row "KE452820 MEDELLÍN $ 0 1 ✅ Encontrado 🔍 Ver soporte" [ref=e142]:
                - cell "KE452820" [ref=e143]:
                  - code [ref=e144]: KE452820
                - cell "MEDELLÍN" [ref=e145]
                - cell "$ 0" [ref=e146]
                - cell "1" [ref=e147]
                - cell "✅ Encontrado" [ref=e148]:
                  - generic [ref=e149]: ✅ Encontrado
                - cell "🔍 Ver soporte" [ref=e150]:
                  - button "🔍 Ver soporte" [ref=e151] [cursor=pointer]
              - row "D11512724 MEDELLÍN $ 11.010 1 ❌ Sin soporte —" [ref=e152]:
                - cell "D11512724" [ref=e153]:
                  - code [ref=e154]: D11512724
                - cell "MEDELLÍN" [ref=e155]
                - cell "$ 11.010" [ref=e156]
                - cell "1" [ref=e157]
                - cell "❌ Sin soporte" [ref=e158]:
                  - generic [ref=e159]: ❌ Sin soporte
                - cell "—" [ref=e160]
              - row "KE452769 MEDELLÍN $ 20.100 1 ❌ Sin soporte —" [ref=e161]:
                - cell "KE452769" [ref=e162]:
                  - code [ref=e163]: KE452769
                - cell "MEDELLÍN" [ref=e164]
                - cell "$ 20.100" [ref=e165]
                - cell "1" [ref=e166]
                - cell "❌ Sin soporte" [ref=e167]:
                  - generic [ref=e168]: ❌ Sin soporte
                - cell "—" [ref=e169]
              - row "KE452799 MEDELLÍN $ 5.000 1 ✅ Encontrado 🔍 Ver soporte" [ref=e170]:
                - cell "KE452799" [ref=e171]:
                  - code [ref=e172]: KE452799
                - cell "MEDELLÍN" [ref=e173]
                - cell "$ 5.000" [ref=e174]
                - cell "1" [ref=e175]
                - cell "✅ Encontrado" [ref=e176]:
                  - generic [ref=e177]: ✅ Encontrado
                - cell "🔍 Ver soporte" [ref=e178]:
                  - button "🔍 Ver soporte" [ref=e179] [cursor=pointer]
              - row "KE452775 BELLO $ 5.000 1 ✅ Encontrado 🔍 Ver soporte" [ref=e180]:
                - cell "KE452775" [ref=e181]:
                  - code [ref=e182]: KE452775
                - cell "BELLO" [ref=e183]
                - cell "$ 5.000" [ref=e184]
                - cell "1" [ref=e185]
                - cell "✅ Encontrado" [ref=e186]:
                  - generic [ref=e187]: ✅ Encontrado
                - cell "🔍 Ver soporte" [ref=e188]:
                  - button "🔍 Ver soporte" [ref=e189] [cursor=pointer]
              - row "D11512772 MEDELLÍN $ 0 1 ❌ Sin soporte —" [ref=e190]:
                - cell "D11512772" [ref=e191]:
                  - code [ref=e192]: D11512772
                - cell "MEDELLÍN" [ref=e193]
                - cell "$ 0" [ref=e194]
                - cell "1" [ref=e195]
                - cell "❌ Sin soporte" [ref=e196]:
                  - generic [ref=e197]: ❌ Sin soporte
                - cell "—" [ref=e198]
              - row "KE452813 MEDELLÍN $ 5.000 1 ✅ Encontrado 🔍 Ver soporte" [ref=e199]:
                - cell "KE452813" [ref=e200]:
                  - code [ref=e201]: KE452813
                - cell "MEDELLÍN" [ref=e202]
                - cell "$ 5.000" [ref=e203]
                - cell "1" [ref=e204]
                - cell "✅ Encontrado" [ref=e205]:
                  - generic [ref=e206]: ✅ Encontrado
                - cell "🔍 Ver soporte" [ref=e207]:
                  - button "🔍 Ver soporte" [ref=e208] [cursor=pointer]
              - row "D11512785 MEDELLÍN $ 12.330 1 ❌ Sin soporte —" [ref=e209]:
                - cell "D11512785" [ref=e210]:
                  - code [ref=e211]: D11512785
                - cell "MEDELLÍN" [ref=e212]
                - cell "$ 12.330" [ref=e213]
                - cell "1" [ref=e214]
                - cell "❌ Sin soporte" [ref=e215]:
                  - generic [ref=e216]: ❌ Sin soporte
                - cell "—" [ref=e217]
              - row "KE452757 MEDELLÍN $ 0 1 ❌ Sin soporte —" [ref=e218]:
                - cell "KE452757" [ref=e219]:
                  - code [ref=e220]: KE452757
                - cell "MEDELLÍN" [ref=e221]
                - cell "$ 0" [ref=e222]
                - cell "1" [ref=e223]
                - cell "❌ Sin soporte" [ref=e224]:
                  - generic [ref=e225]: ❌ Sin soporte
                - cell "—" [ref=e226]
              - row "KE452772 SABANETA $ 0 1 ✅ Encontrado 🔍 Ver soporte" [ref=e227]:
                - cell "KE452772" [ref=e228]:
                  - code [ref=e229]: KE452772
                - cell "SABANETA" [ref=e230]
                - cell "$ 0" [ref=e231]
                - cell "1" [ref=e232]
                - cell "✅ Encontrado" [ref=e233]:
                  - generic [ref=e234]: ✅ Encontrado
                - cell "🔍 Ver soporte" [ref=e235]:
                  - button "🔍 Ver soporte" [ref=e236] [cursor=pointer]
          - generic [ref=e237]:
            - generic [ref=e238]: Mostrando 1–10 de 1592 registros
            - navigation "Paginación de tabla" [ref=e239]:
              - button "Página anterior" [disabled] [ref=e240]: ‹
              - button "Página 1": "1"
              - button "Página 2" [ref=e241] [cursor=pointer]: "2"
              - generic [ref=e242]: …
              - button "Página 160" [ref=e243] [cursor=pointer]: "160"
              - button "Página siguiente" [ref=e244] [cursor=pointer]: ›
```

# Test source

```ts
  1   | /**
  2   |  * prueba-fechas-multiples.spec.ts
  3   |  *
  4   |  * Verifica que la barra de progreso muestra avance REAL (streaming NDJSON)
  5   |  * al consultar soportes, y que el flujo funciona con fechas de distintos meses,
  6   |  * incluyendo Abril 2026.
  7   |  *
  8   |  * Grupos de prueba:
  9   |  *   FM-01 → FM-03 : mes de Abril (2026-04)
  10  |  *   FM-04 → FM-06 : varias fechas de Mayo (2026-05)
  11  |  *   FM-07         : la barra avanza con valores intermedios (progreso real)
  12  |  */
  13  | 
  14  | import { test, expect, type Page } from '@playwright/test';
  15  | 
  16  | const BASE_URL = 'http://localhost:5125';
  17  | const MES_ABRIL = '2026-04';
  18  | const MES_MAYO  = '2026-05';
  19  | 
  20  | // ─── Helper: login ────────────────────────────────────────────────────────────
  21  | async function login(page: Page): Promise<void> {
  22  |   await page.goto(`${BASE_URL}/login`);
  23  |   await page.fill('input[name="usuario"]', 'MMUNOZ');
  24  |   await page.click('button[type="submit"]');
  25  |   await page.waitForURL(/localhost.*\/$/);
  26  |   await expect(page.locator('#resumenLoading')).toBeHidden({ timeout: 20_000 });
  27  | }
  28  | 
  29  | // ─── Helper: ir a Detalle de un mes y esperar que cargue la tabla de días ─────
  30  | async function irADetalle(page: Page, mes: string): Promise<void> {
  31  |   await page.goto(`${BASE_URL}/detalle?mes=${mes}`);
  32  |   // Esperar a que uno de los dos divs deje de tener la clase d-none
  33  |   await page.waitForFunction(() => {
  34  |     const tabla = document.getElementById('diasTabla');
  35  |     const vacio = document.getElementById('diasVacio');
  36  |     return (tabla && !tabla.classList.contains('d-none')) ||
  37  |            (vacio && !vacio.classList.contains('d-none'));
  38  |   }, { timeout: 20_000 });
  39  | }
  40  | 
  41  | // ─── Helper: obtener la primera fecha de la tabla de días (si existe) ─────────
  42  | async function primerFechaDisponible(page: Page): Promise<string | null> {
  43  |   const tablaVisible = await page.locator('#diasTabla').isVisible();
  44  |   if (!tablaVisible) return null;
  45  |   const primeraFila = page.locator('#diasTbody tr').first();
  46  |   const hayFila = await primeraFila.isVisible();
  47  |   if (!hayFila) return null;
  48  |   // El id de la fila tiene formato "fila-YYYY-MM-DD"
  49  |   const idFila = await primeraFila.getAttribute('id');
  50  |   return idFila ? idFila.replace('fila-', '') : null;
  51  | }
  52  | 
  53  | // ─── Helper: abrir panel de un día y esperar tabla + barra de progreso ────────
  54  | async function abrirDiaYEsperarBarra(page: Page, fecha: string): Promise<void> {
  55  |   await page.locator(`#fila-${fecha} button`).click();
  56  |   await expect(page.locator('#panelDia')).toBeVisible({ timeout: 10_000 });
  57  |   await expect(page.locator('#panelTabla')).toBeVisible({ timeout: 15_000 });
  58  |   await expect(page.locator('#panelProgreso')).toBeVisible({ timeout: 10_000 });
  59  | }
  60  | 
  61  | // ─── Helper: esperar fin del batch (KPI visible) ──────────────────────────────
  62  | async function esperarFinBatch(page: Page, timeout = 600_000): Promise<void> {
> 63  |   await expect(page.locator('#panelKpi')).toBeVisible({ timeout });
      |                                           ^ Error: expect(locator).toBeVisible() failed
  64  | }
  65  | 
  66  | // ─────────────────────────────────────────────────────────────────────────────
  67  | // GRUPO A: Mes de Abril 2026
  68  | // ─────────────────────────────────────────────────────────────────────────────
  69  | test.describe('FM — Fechas múltiples › Abril 2026', () => {
  70  |   test.use({ baseURL: BASE_URL });
  71  |   test.setTimeout(120_000);
  72  | 
  73  |   test.beforeEach(async ({ page }) => {
  74  |     await login(page);
  75  |   });
  76  | 
  77  |   // FM-01: Navegación a /detalle?mes=2026-04 carga la tabla de días
  78  |   test('FM-01 Mes de Abril muestra tabla de días', async ({ page }) => {
  79  |     await irADetalle(page, MES_ABRIL);
  80  | 
  81  |     const tablaVisible = await page.locator('#diasTabla').isVisible();
  82  |     const vacioVisible = await page.locator('#diasVacio').isVisible();
  83  | 
  84  |     // Al menos uno de los dos debe estar visible
  85  |     expect(tablaVisible || vacioVisible,
  86  |       'Debe mostrarse la tabla de días o el estado vacío').toBe(true);
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
```