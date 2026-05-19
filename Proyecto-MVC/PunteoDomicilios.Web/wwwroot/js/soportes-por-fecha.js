// soportes-por-fecha.js — Punteo de Domicilios MVC
'use strict';

// ── Estado del módulo ────────────────────────────────────────────────────────
let soportesPaths       = [];          // storage_paths de soportes encontrados
let soportesDctoprvPath = new Map();   // dctoprv → storagePath
let faltantesDctoprv   = [];           // DCTPRVs sin soporte
let todosRowItems      = [];           // todos los ítems del batch activo
let consultaController  = null;        // AbortController de la consulta activa
let descargaController  = null;        // AbortController de la descarga ZIP activa
let fechaActiva         = null;        // fecha en curso (string "yyyy-MM-dd")
let pagResultados       = null;        // instancia de Paginador
let _progresoTimer1     = null;
let _progresoTimer2     = null;
let carterasCatalogo    = [];          // nombres desde TIPOCAR
let carteraHighlight    = -1;
let filtradosActuales   = [];          // filas visibles según filtro activo
let modoFiltroFaltantes = false;

const fmtFecha = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

// ── Inicialización ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const inputFecha = document.getElementById('inputFecha');
    if (inputFecha && !inputFecha.value) {
        inputFecha.value = new Date().toISOString().split('T')[0];
    }
    inputFecha?.addEventListener('keydown', e => { if (e.key === 'Enter') buscarFacturas(); });
    inputFecha?.addEventListener('change', validarFormularioBusqueda);

    initCarteraCombobox();
    cargarTiposCartera();
});

// ── Búsqueda principal ────────────────────────────────────────────────────────
async function buscarFacturas() {
    const fecha = document.getElementById('inputFecha')?.value?.trim();
    const cartera = document.getElementById('inputCarteraValue')?.value?.trim();
    if (!fecha) {
        mostrarModal('Fecha requerida', 'Selecciona una fecha de facturación para buscar.', 'warning');
        return;
    }
    if (!cartera) {
        mostrarModal('Cartera requerida', 'Selecciona un tipo de cartera en el listado.', 'warning');
        document.getElementById('inputCarteraFilter')?.focus();
        return;
    }

    // Cancelar consulta anterior si sigue en vuelo
    if (consultaController) {
        consultaController.abort();
        consultaController = null;
    }
    if (_progresoTimer1 !== null) { clearTimeout(_progresoTimer1); _progresoTimer1 = null; }
    if (_progresoTimer2 !== null) { clearTimeout(_progresoTimer2); _progresoTimer2 = null; }

    fechaActiva         = fecha;
    soportesPaths       = [];
    soportesDctoprvPath = new Map();
    faltantesDctoprv   = [];
    todosRowItems       = [];
    filtradosActuales   = [];
    modoFiltroFaltantes = false;
    const inputBuscar = document.getElementById('inputBuscarTabla');
    if (inputBuscar) inputBuscar.value = '';

    // UI: mostrar sección y resetear elementos
    document.getElementById('seccionResultados').classList.remove('d-none');
    document.getElementById('tituloResultados').textContent = `📋 Facturas del ${fmtFecha(fecha)}`;
    document.getElementById('panelKpi').classList.add('d-none');
    document.getElementById('zipProgreso').classList.add('d-none');
    document.getElementById('panelProgreso').classList.add('d-none');
    document.getElementById('panelTabla').classList.add('d-none');
    document.getElementById('panelVacio').classList.add('d-none');

    const loadingEl = document.getElementById('panelLoading');
    loadingEl.classList.remove('d-none');

    const btnBuscar = document.getElementById('btnBuscar');
    const spinner   = document.getElementById('spinnerBuscar');
    btnBuscar.disabled = true;
    spinner.classList.remove('d-none');

    const controller = new AbortController();
    consultaController = controller;
    const signal = controller.signal;

    try {
        // ── FASE 1: obtener facturas del día ──────────────────────────────────
        const res = await fetch(
            `/api/soportes-por-fecha/facturas?fecha=${encodeURIComponent(fecha)}&nombreCartera=${encodeURIComponent(cartera)}`,
            { signal });

        loadingEl.classList.add('d-none');

        if (!res.ok) {
            mostrarModal('Error', `No se pudieron cargar las facturas. (${res.status})`, 'error');
            return;
        }

        const facturas = await res.json();

        if (!facturas || facturas.length === 0) {
            const vacio = document.getElementById('panelVacio');
            vacio.querySelector('p').textContent =
                `No se encontraron facturas para el ${fmtFecha(fecha)} en la cartera seleccionada.`;
            vacio.classList.remove('d-none');
            actualizarKpi(0, 0);
            return;
        }

        // ── FASE 2: construir filas con estado pendiente ──────────────────────
        const rowItems = facturas.map((f, i) => ({
            idx:          i + 1,
            dctoprv:      f.dctoPrv       ?? '',
            ordenEntMv:   f.ordenEntMv    ?? '—',
            tipoFactura:  f.tipoFactura   ?? '—',
            prefijo:      f.prefijo       ?? '—',
            nroDcto:      f.nroDcto       ?? '—',
            fechaFactura: f.fechaFactura  ?? '—',
            nombreCartera: f.nombreCartera ?? '—',
            estadoHtml:   f.dctoPrv
                ? '<span class="tag tag-blue">⏳ Consultando…</span>'
                : '<span class="tag tag-yellow">⚠ Sin DCTOPRV</span>',
            accionHtml:   '—',
        }));

        todosRowItems = [...rowItems];

        if (!pagResultados) pagResultados = new Paginador('resultadosTbody', 'pagResultados');
        pagResultados.setData(rowItems, renderFilaFactura);
        document.getElementById('panelTabla').classList.remove('d-none');
        actualizarKpi(rowItems.length, 0);

        // DCTPRVs únicos con valor (son las claves para consultar soportes)
        const dctoprvs = [...new Set(
            facturas.map(f => f.dctoPrv).filter(v => v && v.trim())
        )];

        if (!dctoprvs.length) {
            // Sin DCTPRVs — mostrar KPI con cero encontrados y salir
            actualizarKpi(rowItems.length, 0);
            consultaController = null;
            return;
        }

        // ── FASE 3: consultar soportes en streaming ───────────────────────────
        const progBar  = document.getElementById('panelProgreso');
        const progCnt  = document.getElementById('panelProgContador');
        const progFill = document.getElementById('panelProgFill');

        progCnt.textContent = `0 / ${dctoprvs.length}`;
        progFill.style.width = '0%';
        progBar.classList.remove('d-none');

        const streamRes = await fetch('/api/soportes-por-fecha/soporte-batch-stream', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(dctoprvs),
            signal,
        });

        if (!streamRes.ok) {
            // Error de API — marcar todas las filas con valor DCTOPRV como error
            rowItems.forEach((row, i) => {
                if (!row.dctoprv) return;
                rowItems[i] = {
                    ...row,
                    estadoHtml: '<span class="tag tag-yellow">⚠ Error API</span>',
                    accionHtml: '—',
                };
                pagResultados.updateItem(i, rowItems[i]);
            });
            progFill.style.width = '100%';
            _progresoTimer1 = setTimeout(() => { progBar.classList.add('d-none'); _progresoTimer1 = null; }, 800);
            _progresoTimer2 = setTimeout(() => { actualizarKpi(rowItems.length, 0); _progresoTimer2 = null; }, 900);
            consultaController = null;
            return;
        }

        // Mapa dctoprv → índices de filas (puede haber duplicados)
        const rowIndexMap = new Map();
        rowItems.forEach((row, i) => {
            if (!row.dctoprv) return;
            if (!rowIndexMap.has(row.dctoprv)) rowIndexMap.set(row.dctoprv, []);
            rowIndexMap.get(row.dctoprv).push(i);
        });

        const reader  = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = '';
        let procesados = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (signal.aborted) { reader.cancel(); return; }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // última línea incompleta

                for (const line of lines) {
                    if (signal.aborted) { reader.cancel(); return; }
                    if (!line.trim()) continue;
                    let item;
                    try { item = JSON.parse(line); } catch { continue; }

                    procesados++;
                    const indices = rowIndexMap.get(item.nrodcto) ?? [];
                    for (const i of indices) {
                        const { estadoHtml, accionHtml } = procesarEstadoItem(rowItems[i], item);
                        rowItems[i] = { ...rowItems[i], estadoHtml, accionHtml };
                        pagResultados.updateItem(i, rowItems[i]);
                    }

                    progCnt.textContent = `${procesados} / ${dctoprvs.length}`;
                    progFill.style.width = ((procesados / dctoprvs.length) * 100) + '%';
                    actualizarKpi(rowItems.length, contarFilasConSoporte(rowItems));
                }
            }
        } catch (e) {
            if (e.name === 'AbortError') return;
            console.error('Error leyendo stream de soportes:', e);
        }

        // ── FASE 4: finalizar UI ──────────────────────────────────────────────
        progFill.style.width  = '100%';
        progCnt.textContent   = `${dctoprvs.length} / ${dctoprvs.length}`;
        todosRowItems = [...rowItems];

        _progresoTimer1 = setTimeout(() => { progBar.classList.add('d-none'); _progresoTimer1 = null; }, 800);
        _progresoTimer2 = setTimeout(() => {
            actualizarKpi(rowItems.length, contarFilasConSoporte(rowItems));
            _progresoTimer2 = null;
        }, 900);
        consultaController = null;

    } catch (e) {
        if (e.name === 'AbortError') return;
        console.error(e);
        document.getElementById('panelLoading').classList.add('d-none');
        mostrarModal('Error inesperado', 'Ocurrió un error al consultar las facturas.', 'error');
    } finally {
        btnBuscar.disabled = false;
        spinner.classList.add('d-none');
    }
}

// ── Interpreta un NrodctoEstadoDto y actualiza la fila ───────────────────────
function procesarEstadoItem(row, item) {
    // estado 3 = Error
    if (!item || item.estado === 3) {
        return {
            estadoHtml: '<span class="tag tag-yellow">⚠ Error API</span>',
            accionHtml: '—',
        };
    }
    // estado 1 = Encontrado
    if (item.estado === 1) {
        const path = item.storagePath ?? '';
        const fReg = item.fechaRegistro ?? '';
        if (path && !soportesPaths.includes(path)) soportesPaths.push(path);
        if (path) soportesDctoprvPath.set(row.dctoprv, path);
        return {
            estadoHtml: '<span class="tag tag-green">✅ Encontrado</span>',
            accionHtml: path
                ? `<button class="btn btn-sm btn-outline-success"
                          onclick='verSoporte(${JSON.stringify(row.dctoprv)}, ${JSON.stringify(fReg)}, ${JSON.stringify(path)})'>
                       🔍 Ver soporte
                   </button>`
                : '<span class="text-muted small">Sin archivo</span>',
        };
    }
    // estado 2 = Faltante
    if (item.estado === 2) {
        if (!faltantesDctoprv.includes(row.dctoprv))
            faltantesDctoprv.push(row.dctoprv);
        return {
            estadoHtml: '<span class="tag tag-red">❌ Sin soporte</span>',
            accionHtml: '—',
        };
    }
    return { estadoHtml: '<span class="tag tag-yellow">⚠ Error API</span>', accionHtml: '—' };
}

// ── Render de una fila de la tabla de facturas ───────────────────────────────
function renderFilaFactura(r) {
    return `
        <tr>
            <td class="text-muted small">${r.idx}</td>
            <td><code>${esc(r.dctoprv || '—')}</code></td>
            <td><span class="badge ${r.tipoFactura === 'DIRECTA' ? 'bg-primary' : 'bg-secondary'}">${esc(r.tipoFactura)}</span></td>
            <td>${esc(r.prefijo)}</td>
            <td>${esc(r.nroDcto)}</td>
            <td class="small text-muted">${esc(r.ordenEntMv)}</td>
            <td class="small">${fmtFecha(r.fechaFactura)}</td>
            <td class="small">${esc(r.nombreCartera)}</td>
            <td>${r.estadoHtml}</td>
            <td>${r.accionHtml}</td>
        </tr>`;
}

// ── Modal soporte (reutiliza el modal global del layout) ─────────────────────
function verSoporte(dctoprv, fechaRegistro, storagePath) {
    const body = document.getElementById('modalSoporteBody');
    const link = document.getElementById('modalDescargaLink');

    body.innerHTML = `
        <dl class="row mb-0">
            <dt class="col-5">DCTOPRV</dt>
            <dd class="col-7"><code>${esc(dctoprv)}</code></dd>
            <dt class="col-5">Fecha registro</dt>
            <dd class="col-7">${esc(fechaRegistro || '—')}</dd>
            <dt class="col-5">Archivo</dt>
            <dd class="col-7"><small class="text-muted">${esc(storagePath)}</small></dd>
        </dl>`;

    link.href = storagePath
        ? `/api/soportes-por-fecha/descargar?path=${encodeURIComponent(storagePath)}`
        : '#';
    link.classList.toggle('disabled', !storagePath);

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalSoporte')).show();
}

function contarFilasConSoporte(rowItems) {
    return rowItems.filter(r => r.estadoHtml && r.estadoHtml.includes('tag-green')).length;
}

function textoPlanoEstado(html) {
    const tmp = document.createElement('span');
    tmp.innerHTML = html;
    return (tmp.textContent ?? '').trim();
}

// ── KPI (misma lógica que detalle.js) ─────────────────────────────────────────
function actualizarKpi(total, encontrados) {
    const faltantes = Math.max(0, total - encontrados);
    document.getElementById('kpiTotal').textContent       = total;
    document.getElementById('kpiEncontrados').textContent = encontrados;
    document.getElementById('kpiFaltantes').textContent   = faltantes;
    document.getElementById('btnDescargarTodos').disabled          = encontrados === 0;
    document.getElementById('btnDescargarListaEncontrados').disabled = encontrados === 0;
    document.getElementById('btnVerFaltantes').disabled            = faltantes === 0;
    document.getElementById('btnDescargarLista').disabled          = faltantes === 0;
    filtradosActuales = [...todosRowItems];
    actualizarBtnDescargarFiltrados();
    document.getElementById('panelKpi').classList.remove('d-none');
}

function actualizarBtnDescargarFiltrados() {
    const btn      = document.getElementById('btnDescargarFiltrados');
    const btnLista = document.getElementById('btnDescargarListaFiltrados');
    const termino  = (document.getElementById('inputBuscarTabla')?.value ?? '').trim();
    const hayFiltro      = termino.length > 0;
    const hayEncontrados = filtradosActuales.some(r => soportesDctoprvPath.has(r.dctoprv));
    const hayFilas       = filtradosActuales.length > 0;
    if (btn)      btn.disabled      = !(hayFiltro && hayEncontrados);
    if (btnLista) btnLista.disabled = !(hayFiltro && hayFilas);
}

// ── Buscar / filtrar tabla ────────────────────────────────────────────────────
function filtrarTabla(termino) {
    if (!pagResultados || !todosRowItems.length) return;

    if (modoFiltroFaltantes) {
        modoFiltroFaltantes = false;
        const btn = document.getElementById('btnVerFaltantes');
        if (btn) {
            btn.textContent = '🔍 Ver';
            btn.classList.replace('btn-danger', 'btn-outline-danger');
        }
    }

    const q = termino.trim().toLowerCase();
    if (!q) {
        filtradosActuales = [...todosRowItems];
        pagResultados.setData(todosRowItems, renderFilaFactura);
        actualizarBtnDescargarFiltrados();
        return;
    }

    const filtrados = todosRowItems.filter(r =>
        String(r.dctoprv).toLowerCase().includes(q) ||
        String(r.tipoFactura).toLowerCase().includes(q) ||
        String(r.prefijo).toLowerCase().includes(q) ||
        String(r.nroDcto).toLowerCase().includes(q) ||
        String(r.ordenEntMv).toLowerCase().includes(q) ||
        String(r.nombreCartera).toLowerCase().includes(q) ||
        String(r.fechaFactura).toLowerCase().includes(q) ||
        textoPlanoEstado(r.estadoHtml).toLowerCase().includes(q)
    );

    filtradosActuales = filtrados;
    pagResultados.setData(filtrados, renderFilaFactura);
    actualizarBtnDescargarFiltrados();
}

// ── Ver solo faltantes ────────────────────────────────────────────────────────
function verFaltantes() {
    if (!pagResultados) return;

    const btn = document.getElementById('btnVerFaltantes');

    if (modoFiltroFaltantes) {
        modoFiltroFaltantes = false;
        btn.textContent = '🔍 Ver';
        btn.classList.replace('btn-danger', 'btn-outline-danger');
        filtradosActuales = [...todosRowItems];
        pagResultados.setData(todosRowItems, renderFilaFactura);
    } else {
        modoFiltroFaltantes = true;
        btn.textContent = '🔍 Ver todos';
        btn.classList.replace('btn-outline-danger', 'btn-danger');
        const faltantes = todosRowItems.filter(r => faltantesDctoprv.includes(r.dctoprv));
        filtradosActuales = faltantes;
        pagResultados.setData(faltantes, renderFilaFactura);
    }
    actualizarBtnDescargarFiltrados();
}

// ── Descargas CSV ─────────────────────────────────────────────────────────────
function descargarListaFiltrados() {
    if (!filtradosActuales.length) {
        mostrarModal('Sin resultados', 'No existen registros filtrados para exportar.', 'info');
        return;
    }

    const encabezado = 'DCTOPRV,Tipo,Prefijo,Nro. Dcto,OrdenEntMV,Fecha Factura,Cartera,Estado';
    const filas = filtradosActuales.map(r => [
        `"${r.dctoprv}"`,
        `"${r.tipoFactura}"`,
        `"${r.prefijo}"`,
        `"${r.nroDcto}"`,
        `"${r.ordenEntMv}"`,
        `"${fmtFecha(r.fechaFactura)}"`,
        `"${r.nombreCartera}"`,
        `"${textoPlanoEstado(r.estadoHtml)}"`,
    ].join(','));

    const sufijo = (document.getElementById('inputBuscarTabla')?.value ?? '').trim().replace(/\s+/g, '_') || 'filtro';
    descargarCsv([encabezado, ...filas], `lista_${sufijo}_${fechaActiva ?? 'descarga'}.csv`);
}

function descargarListaEncontrados() {
    const encontrados = todosRowItems.filter(r => soportesDctoprvPath.has(r.dctoprv));
    if (!encontrados.length) return;

    const encabezado = 'DCTOPRV,Tipo,Prefijo,Nro. Dcto,OrdenEntMV,Storage Path';
    const filas = encontrados.map(r => [
        `"${r.dctoprv}"`,
        `"${r.tipoFactura}"`,
        `"${r.prefijo}"`,
        `"${r.nroDcto}"`,
        `"${r.ordenEntMv}"`,
        `"${soportesDctoprvPath.get(r.dctoprv) ?? ''}"`,
    ].join(','));

    descargarCsv([encabezado, ...filas], `encontrados_${fechaActiva ?? 'lista'}.csv`);
}

function descargarListaFaltantes() {
    if (!faltantesDctoprv.length) return;

    const encabezado = 'DCTOPRV,Tipo,Prefijo,Nro. Dcto,OrdenEntMV';
    const filas = todosRowItems
        .filter(r => faltantesDctoprv.includes(r.dctoprv))
        .map(r => [
            `"${r.dctoprv}"`,
            `"${r.tipoFactura}"`,
            `"${r.prefijo}"`,
            `"${r.nroDcto}"`,
            `"${r.ordenEntMv}"`,
        ].join(','));

    descargarCsv([encabezado, ...filas], `faltantes_${fechaActiva ?? 'lista'}.csv`);
}

function descargarCsv(lineas, filename) {
    const csv  = lineas.join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Descargar ZIP de filtrados / todos ────────────────────────────────────────
function descargarFiltrados() {
    if (!filtradosActuales.length) {
        mostrarModal('Sin resultados', 'No existen registros para descargar.', 'info');
        return;
    }

    const vistos = new Set();
    const paths  = [];
    for (const r of filtradosActuales) {
        const path = soportesDctoprvPath.get(r.dctoprv);
        if (path && !vistos.has(path)) {
            paths.push(path);
            vistos.add(path);
        }
    }

    if (!paths.length) {
        mostrarModal('Sin soportes', 'Los registros filtrados no tienen soportes disponibles.', 'info');
        return;
    }

    const sufijo = (document.getElementById('inputBuscarTabla')?.value ?? '').trim().replace(/\s+/g, '_') || 'filtro';
    ejecutarDescargaZip(paths, `soportes_${sufijo}_${fechaActiva ?? 'descarga'}.zip`);
}

async function descargarTodos() {
    const paths = [...soportesPaths];
    if (!paths.length) return;
    await ejecutarDescargaZip(paths, `soportes_fecha_${fechaActiva ?? 'descarga'}.zip`);
}

async function ejecutarDescargaZip(paths, filename) {
    const progBar   = document.getElementById('zipProgreso');
    const progLabel = document.getElementById('zipProgresoLabel');
    const progPct   = document.getElementById('zipProgresoPct');
    const progFill  = document.getElementById('zipProgresoFill');

    const btnTodos          = document.getElementById('btnDescargarTodos');
    const btnListaEnc       = document.getElementById('btnDescargarListaEncontrados');
    const btnFiltrados      = document.getElementById('btnDescargarFiltrados');
    const btnListaFiltrados = document.getElementById('btnDescargarListaFiltrados');
    if (btnTodos)          btnTodos.disabled          = true;
    if (btnListaEnc)       btnListaEnc.disabled       = true;
    if (btnFiltrados)      btnFiltrados.disabled      = true;
    if (btnListaFiltrados) btnListaFiltrados.disabled = true;

    progLabel.textContent = 'Preparando ZIP...';
    progPct.textContent   = '';
    progFill.style.width  = '4%';
    progBar.classList.remove('d-none');

    descargaController = new AbortController();

    try {
        const resp = await fetch('/api/soportes-por-fecha/descargar-zip', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(paths),
            signal:  descargaController.signal,
        });

        if (!resp.ok) {
            mostrarModal('Error', `No se pudo generar el ZIP. (${resp.status})`, 'error');
            return;
        }

        const total  = parseInt(resp.headers.get('Content-Length') || '0', 10);
        const reader = resp.body.getReader();
        const chunks = [];
        let received = 0;

        progLabel.textContent = 'Descargando ZIP...';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;

            if (total > 0) {
                const pct = Math.min(Math.round((received / total) * 100), 99);
                progFill.style.width = pct + '%';
                progPct.textContent  = pct + '%';
            } else {
                const mb = (received / 1024 / 1024).toFixed(1);
                progLabel.textContent = `Descargando... ${mb} MB`;
            }
        }

        const blob = new Blob(chunks, { type: 'application/zip' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        progFill.style.width  = '100%';
        progPct.textContent   = '100%';
        progLabel.textContent = '✅ Descarga completada';
        setTimeout(() => progBar.classList.add('d-none'), 2500);

    } catch (e) {
        if (e.name === 'AbortError') {
            console.info('Descarga ZIP cancelada.');
        } else {
            console.error(e);
            mostrarModal('Error', 'Error al descargar el ZIP.', 'error');
        }
        progBar.classList.add('d-none');
    } finally {
        descargaController = null;
        const hayEncontrados = soportesPaths.length > 0;
        if (btnTodos)    btnTodos.disabled    = !hayEncontrados;
        if (btnListaEnc) btnListaEnc.disabled = !hayEncontrados;
        actualizarBtnDescargarFiltrados();
    }
}

// ── Combobox tipo cartera ─────────────────────────────────────────────────────
async function cargarTiposCartera() {
    const loading = document.getElementById('carteraLoading');
    const errorEl = document.getElementById('carteraError');
    const input   = document.getElementById('inputCarteraFilter');

    loading?.classList.remove('d-none');
    errorEl?.classList.add('d-none');

    try {
        const res = await fetch('/api/soportes-por-fecha/tipos-cartera');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        carterasCatalogo = await res.json();
        if (!Array.isArray(carterasCatalogo)) carterasCatalogo = [];
        input.disabled = false;
        renderCarteraOpciones(input?.value ?? '');
    } catch (e) {
        console.error(e);
        if (errorEl) {
            errorEl.textContent = 'No se pudieron cargar los tipos de cartera.';
            errorEl.classList.remove('d-none');
        }
        input.disabled = true;
    } finally {
        loading?.classList.add('d-none');
        validarFormularioBusqueda();
    }
}

function initCarteraCombobox() {
    const input    = document.getElementById('inputCarteraFilter');
    const hidden   = document.getElementById('inputCarteraValue');
    const listbox  = document.getElementById('carteraListbox');
    const combobox = document.getElementById('carteraCombobox');
    if (!input || !hidden || !listbox) return;

    input.addEventListener('focus', () => {
        renderCarteraOpciones(input.value);
        abrirListbox(true);
    });

    input.addEventListener('input', () => {
        hidden.value = '';
        carteraHighlight = -1;
        renderCarteraOpciones(input.value);
        abrirListbox(true);
        validarFormularioBusqueda();
    });

    input.addEventListener('keydown', e => {
        const items = listbox.querySelectorAll('li:not(.combobox-empty)');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            carteraHighlight = Math.min(carteraHighlight + 1, items.length - 1);
            marcarCarteraHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            carteraHighlight = Math.max(carteraHighlight - 1, 0);
            marcarCarteraHighlight(items);
        } else if (e.key === 'Enter') {
            if (carteraHighlight >= 0 && items[carteraHighlight]) {
                e.preventDefault();
                seleccionarCartera(items[carteraHighlight].dataset.value);
            } else if (!hidden.value) {
                e.preventDefault();
                buscarFacturas();
            }
        } else if (e.key === 'Escape') {
            abrirListbox(false);
        }
    });

    listbox.addEventListener('click', e => {
        const li = e.target.closest('li[data-value]');
        if (li) seleccionarCartera(li.dataset.value);
    });

    document.addEventListener('click', e => {
        if (!combobox?.contains(e.target)) abrirListbox(false);
    });
}

function renderCarteraOpciones(filtro) {
    const listbox = document.getElementById('carteraListbox');
    const input   = document.getElementById('inputCarteraFilter');
    if (!listbox || !input) return;

    const q = (filtro ?? '').trim().toLowerCase();
    const coincidencias = carterasCatalogo.filter(n =>
        !q || n.toLowerCase().includes(q)
    );

    listbox.innerHTML = '';
    if (!coincidencias.length) {
        const li = document.createElement('li');
        li.className = 'combobox-empty';
        li.textContent = q ? 'Sin coincidencias' : 'No hay carteras disponibles';
        listbox.appendChild(li);
        return;
    }

    coincidencias.forEach((nombre, i) => {
        const li = document.createElement('li');
        li.textContent = nombre;
        li.dataset.value = nombre;
        li.setAttribute('role', 'option');
        if (i === carteraHighlight) li.setAttribute('aria-selected', 'true');
        listbox.appendChild(li);
    });
}

function marcarCarteraHighlight(items) {
    items.forEach((li, i) => {
        if (i === carteraHighlight) li.setAttribute('aria-selected', 'true');
        else li.removeAttribute('aria-selected');
    });
    items[carteraHighlight]?.scrollIntoView({ block: 'nearest' });
}

function seleccionarCartera(nombre) {
    const input  = document.getElementById('inputCarteraFilter');
    const hidden = document.getElementById('inputCarteraValue');
    if (!input || !hidden || !nombre) return;
    hidden.value = nombre;
    input.value = nombre;
    carteraHighlight = -1;
    abrirListbox(false);
    validarFormularioBusqueda();
}

function abrirListbox(open) {
    const listbox = document.getElementById('carteraListbox');
    const input   = document.getElementById('inputCarteraFilter');
    if (!listbox || !input) return;
    listbox.classList.toggle('d-none', !open);
    input.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function validarFormularioBusqueda() {
    const fecha   = document.getElementById('inputFecha')?.value?.trim();
    const cartera = document.getElementById('inputCarteraValue')?.value?.trim();
    const btn     = document.getElementById('btnBuscar');
    if (btn) btn.disabled = !(fecha && cartera);
}

// ── Escape HTML ───────────────────────────────────────────────────────────────
function esc(v) {
    if (v == null) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
