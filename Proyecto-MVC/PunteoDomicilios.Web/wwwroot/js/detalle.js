// detalle.js — Punteo de Domicilios MVC
'use strict';

const fmtCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
const fmtFecha = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

let diaActivo          = null;
let modalSoporte       = null;
let pagDias            = null;
let pagPanel           = null;
let consultaController = null;  // AbortController de la consulta activa
let soportesPaths       = [];    // paths encontrados en el último batch
let soportesNrodctoPath = new Map(); // nrodcto → path para documentos encontrados
let faltantesNrodctos   = [];    // nrodctos sin soporte en el último batch
let todosRowItems      = [];    // todos los items del batch activo
let modoFiltroFaltantes = false;

// ── Al cargar ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    modalSoporte = new bootstrap.Modal(document.getElementById('modalSoporte'));
    if (typeof MES_ACTUAL !== 'undefined' && MES_ACTUAL) {
        cargarDias(MES_ACTUAL);
    }
});

// ── Nivel 1: Días del mes ──────────────────────────────────────
async function cargarDias(mes) {
    try {
        const res = await fetch(`/api/detalle/dias?mes=${encodeURIComponent(mes)}`);
        document.getElementById('diasLoading').classList.add('d-none');

        if (!res.ok) { mostrarModal('Error', 'Error al cargar los días.', 'error'); return; }

        const dias = await res.json();

        if (!dias || dias.length === 0) {
            mostrarVacioDias('No hay registros para este mes.');
            return;
        }

        if (!pagDias) pagDias = new Paginador('diasTbody', 'pagDias');
        pagDias.setData(dias, d => `
            <tr id="fila-${d.fecha}">
                <td><strong>${fmtFecha(d.fecha)}</strong></td>
                <td class="text-end">${d.totalRegistros}</td>
                <td class="text-end">${d.totalPlanillas}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary"
                            onclick="verDia('${esc(d.fecha)}')">
                        Ver registros →
                    </button>
                </td>
            </tr>`);

        document.getElementById('diasTabla').classList.remove('d-none');
    } catch (e) {
        console.error(e);
        document.getElementById('diasLoading').classList.add('d-none');
        mostrarModal('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
    }
}

function mostrarVacioDias(msg) {
    const v = document.getElementById('diasVacio');
    v.querySelector('p').textContent = msg;
    v.classList.remove('d-none');
}

// ── Nivel 2: Registros del día ─────────────────────────────────
async function verDia(fecha) {
    if (diaActivo === fecha) { cerrarPanel(); return; }

    // Cancelar consulta anterior si sigue en vuelo
    if (consultaController) {
        consultaController.abort();
    }
    const controller = new AbortController();
    consultaController = controller;
    const signal = controller.signal;

    diaActivo = fecha;

    const panel   = document.getElementById('panelDia');
    const titulo  = document.getElementById('panelDiaTitulo');
    const loading = document.getElementById('panelLoading');
    const tabla   = document.getElementById('panelTabla');
    const progCnt = document.getElementById('panelProgContador');
    const progFill= document.getElementById('panelProgFill');
    const progBar = document.getElementById('panelProgreso');

    titulo.textContent = `📋 Registros del ${fmtFecha(fecha)}`;
    tabla.classList.add('d-none');
    loading.classList.remove('d-none');
    progBar.classList.add('d-none');
    panel.classList.remove('d-none');

    // Resetear KPI y ZIP de consultas anteriores
    soportesPaths       = [];
    soportesNrodctoPath = new Map();
    faltantesNrodctos   = [];
    todosRowItems       = [];
    modoFiltroFaltantes = false;
    document.getElementById('panelKpi').classList.add('d-none');
    document.getElementById('zipProgreso').classList.add('d-none');

    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

    try {
        const res = await fetch(`/api/detalle/registros?fecha=${encodeURIComponent(fecha)}`, { signal });
        loading.classList.add('d-none');

        if (!res.ok) { mostrarModal('Error', 'Error al cargar los registros.', 'error'); return; }

        const data      = await res.json();
        const registros = data.registros ?? [];
        const nrodctos  = data.nrodctos  ?? [];

        if (registros.length === 0) {
            mostrarModal('Sin resultados', 'No hay registros para esta fecha.', 'info');
            return;
        }

        // Estado inicial de cada fila con soporte pendiente
        const rowItems = registros.map(r => ({
            nrodcto:     r.nrodcto,
            destino:     r.destino     ?? '—',
            cuotaMod:    r.cuotaMod    ?? 0,
            nroPlanilla: r.nroPlanilla ?? '—',
            estadoHtml:  '<span class="tag tag-blue">⏳ Consultando…</span>',
            accionHtml:  '—'
        }));

        const renderFila = renderFilaRegistro;

        if (!pagPanel) pagPanel = new Paginador('panelTbody', 'pagPanel');
        pagPanel.setData(rowItems, renderFila);
        tabla.classList.remove('d-none');

        // Progreso animado mientras se espera la respuesta del servidor
        progCnt.textContent = `0 / ${nrodctos.length}`;
        progFill.style.width = '0%';
        progBar.classList.remove('d-none');

        // Consultar soportes en lote (1 llamada al servidor en vez de N)
        let fakeCount = 0;
        const fakeInterval = setInterval(() => {
            const inc = Math.ceil(nrodctos.length * 0.02) + Math.floor(Math.random() * 3);
            fakeCount = Math.min(fakeCount + inc, Math.floor(nrodctos.length * 0.88));
            progFill.style.width = ((fakeCount / nrodctos.length) * 100) + '%';
            progCnt.textContent  = `${fakeCount} / ${nrodctos.length}`;
        }, 400);

        try {
            const batchRes = await fetch('/api/detalle/soporte-batch', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(nrodctos),
                signal
            });

            clearInterval(fakeInterval);
            if (signal.aborted) return;

            const items = batchRes.ok ? await batchRes.json() : [];

            // Mapa nrodcto → resultado del batch
            const soporteMap = {};
            for (const item of items) soporteMap[item.nrodcto] = item;

            // Actualizar cada fila usando el nrodcto como clave (cubre duplicados)
            rowItems.forEach((row, i) => {
                const item = soporteMap[row.nrodcto];
                let estadoHtml = '<span class="tag tag-yellow">⚠ Error API</span>';
                let accionHtml = '—';

                if (item) {
                    if (item.estado === 1) { // Encontrado
                        estadoHtml = '<span class="tag tag-green">✅ Encontrado</span>';
                        const path = item.storagePath ?? '';
                        const fReg = item.fechaRegistro ?? '';
                        if (path && !soportesPaths.includes(path)) soportesPaths.push(path);
                        if (path) soportesNrodctoPath.set(row.nrodcto, path);
                        accionHtml = path
                            ? `<button class="btn btn-sm btn-outline-success"
                                      onclick='verSoporte(${JSON.stringify(row.nrodcto)}, ${JSON.stringify(fReg)}, ${JSON.stringify(path)})'>
                                   🔍 Ver soporte
                               </button>`
                            : '<span class="text-muted small">Sin archivo</span>';
                    } else if (item.estado === 2) { // Faltante
                        estadoHtml = '<span class="tag tag-red">❌ Sin soporte</span>';
                        if (!faltantesNrodctos.includes(row.nrodcto))
                            faltantesNrodctos.push(row.nrodcto);
                    }
                    // estado 3 (Error): mantiene el yellow tag
                }

                const updated = { ...row, estadoHtml, accionHtml };
                rowItems[i]   = updated;
                pagPanel.updateItem(i, updated);
            });

            progFill.style.width = '100%';
            progCnt.textContent  = `${nrodctos.length} / ${nrodctos.length}`;
            todosRowItems = [...rowItems];
            setTimeout(() => progBar.classList.add('d-none'), 800);
            setTimeout(() => actualizarKpi(nrodctos.length, soportesPaths.length), 900);
            consultaController = null;

        } catch (e) {
            clearInterval(fakeInterval);
            if (e.name === 'AbortError') return;
            console.error('Error en consulta batch:', e);
            progFill.style.width = '100%';
            progCnt.textContent  = `0 / ${nrodctos.length}`;
            setTimeout(() => progBar.classList.add('d-none'), 800);
            setTimeout(() => actualizarKpi(nrodctos.length, 0), 900);
            consultaController = null;
        }

    } catch (e) {
        if (e.name === 'AbortError') return; // nueva consulta iniciada — ignorar silenciosamente
        console.error(e);
        loading.classList.add('d-none');
        mostrarModal('Error inesperado', 'Error inesperado al consultar los registros.', 'error');
    }
}

function cerrarPanel() {
    if (consultaController) {
        consultaController.abort();
        consultaController = null;
    }
    diaActivo           = null;
    soportesPaths       = [];
    soportesNrodctoPath = new Map();
    faltantesNrodctos   = [];
    todosRowItems       = [];
    modoFiltroFaltantes = false;
    document.getElementById('panelDia').classList.add('d-none');
    document.getElementById('panelKpi').classList.add('d-none');
    document.getElementById('zipProgreso').classList.add('d-none');
}

// ── Modal Soporte ──────────────────────────────────────────────
function verSoporte(nrodcto, fechaRegistro, storagePath) {
    const body = document.getElementById('modalSoporteBody');
    const link = document.getElementById('modalDescargaLink');

    body.innerHTML = `
        <dl class="row mb-0">
            <dt class="col-5">Nro. Dcto</dt>
            <dd class="col-7"><code>${esc(nrodcto)}</code></dd>
            <dt class="col-5">Fecha registro</dt>
            <dd class="col-7">${esc(fechaRegistro || '—')}</dd>
            <dt class="col-5">Archivo</dt>
            <dd class="col-7"><small class="text-muted">${esc(storagePath)}</small></dd>
        </dl>`;

    link.href = storagePath
        ? `/api/detalle/descargar?path=${encodeURIComponent(storagePath)}`
        : '#';
    link.classList.toggle('disabled', !storagePath);

    modalSoporte.show();
}

// ── Render fila de registro (global para reutilizar en filtros) ────────
function renderFilaRegistro(r) {
    return `
        <tr>
            <td><code>${esc(r.nrodcto)}</code></td>
            <td>${esc(r.destino)}</td>
            <td class="text-end">${fmtCOP.format(r.cuotaMod)}</td>
            <td>${esc(r.nroPlanilla)}</td>
            <td>${r.estadoHtml}</td>
            <td>${r.accionHtml}</td>
        </tr>`;
}

// ── KPI ─────────────────────────────────────────────────────────
function actualizarKpi(total, encontrados) {
    const faltantes = total - encontrados;
    document.getElementById('kpiTotal').textContent       = total;
    document.getElementById('kpiEncontrados').textContent = encontrados;
    document.getElementById('kpiFaltantes').textContent   = faltantes;
    document.getElementById('btnDescargarTodos').disabled    = encontrados === 0;
    document.getElementById('btnDescargarPrefijo').disabled  = encontrados === 0;
    document.getElementById('btnVerFaltantes').disabled      = faltantes === 0;
    document.getElementById('btnDescargarLista').disabled = faltantes === 0;
    document.getElementById('panelKpi').classList.remove('d-none');
}

// ── Ver solo faltantes en la tabla ──────────────────────────────
function verFaltantes() {
    if (!pagPanel) return;

    const btn = document.getElementById('btnVerFaltantes');

    if (modoFiltroFaltantes) {
        // Restaurar todos los registros
        modoFiltroFaltantes = false;
        btn.textContent = '🔍 Ver';
        btn.classList.replace('btn-danger', 'btn-outline-danger');
        pagPanel.setData(todosRowItems, renderFilaRegistro);
    } else {
        // Filtrar a solo los faltantes
        modoFiltroFaltantes = true;
        btn.textContent = '🔍 Ver todos';
        btn.classList.replace('btn-outline-danger', 'btn-danger');
        const faltantes = todosRowItems.filter(r =>
            faltantesNrodctos.includes(r.nrodcto)
        );
        pagPanel.setData(faltantes, renderFilaRegistro);
    }
}

// ── Descargar lista de faltantes (CSV) ────────────────────────
function descargarListaFaltantes() {
    if (!faltantesNrodctos.length) return;

    const encabezado = 'Nrodcto,Destino,Nro. Planilla';
    const filas = todosRowItems
        .filter(r => faltantesNrodctos.includes(r.nrodcto))
        .map(r => [
            `"${r.nrodcto}"`,
            `"${r.destino}"`,
            `"${r.nroPlanilla}"`
        ].join(','));

    const csv  = [encabezado, ...filas].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `faltantes_${diaActivo ?? 'lista'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Descargar ZIP (helper compartido) ────────────────────────
async function ejecutarDescargaZip(paths, btnEl, filename) {
    const progBar   = document.getElementById('zipProgreso');
    const progLabel = document.getElementById('zipProgresoLabel');
    const progPct   = document.getElementById('zipProgresoPct');
    const progFill  = document.getElementById('zipProgresoFill');

    btnEl.disabled = true;
    progLabel.textContent = 'Preparando ZIP...';
    progPct.textContent   = '';
    progFill.style.width  = '4%';
    progBar.classList.remove('d-none');

    try {
        const resp = await fetch('/api/detalle/descargar-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paths)
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
        console.error(e);
        mostrarModal('Error', 'Error al descargar el ZIP.', 'error');
        progBar.classList.add('d-none');
    } finally {
        btnEl.disabled = false;
    }
}

// ── Descargar todos los soportes encontrados ──────────────────
async function descargarTodos() {
    const paths = [...soportesPaths];
    if (!paths.length) return;
    const btn = document.getElementById('btnDescargarTodos');
    await ejecutarDescargaZip(paths, btn, `soportes_${diaActivo ?? 'descarga'}.zip`);
}

// ── Descargar soportes filtrados por prefijo de NRODCTO ───────
async function descargarPorPrefijo() {
    const input   = document.getElementById('inputPrefijo');
    const prefijo = (input?.value ?? '').trim().toUpperCase();

    if (!prefijo) {
        mostrarModal('Prefijo requerido', 'Ingresa un prefijo para filtrar los documentos.', 'info');
        return;
    }

    const vistos = new Set();
    const paths  = [];
    for (const [nrodcto, path] of soportesNrodctoPath) {
        if (nrodcto.toUpperCase().startsWith(prefijo) && path && !vistos.has(path)) {
            paths.push(path);
            vistos.add(path);
        }
    }

    if (!paths.length) {
        mostrarModal('Sin resultados',
            `No hay documentos encontrados cuyo NRODCTO inicie con "${prefijo}".`, 'info');
        return;
    }

    const btn = document.getElementById('btnDescargarPrefijo');
    await ejecutarDescargaZip(paths, btn, `soportes_${prefijo}_${diaActivo ?? 'descarga'}.zip`);
}

// ── Helpers ──────────────────────────────────────────────────────
function esc(v) {
    if (v == null) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
