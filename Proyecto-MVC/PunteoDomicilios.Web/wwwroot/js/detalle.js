// detalle.js — Punteo de Domicilios MVC
'use strict';

const fmtCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
const fmtFecha = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

let diaActivo         = null;
let modalSoporte      = null;
let pagDias           = null;
let pagPanel          = null;
let consultaController = null;  // AbortController de la consulta activa

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

        const renderFila = r => `
            <tr>
                <td><code>${esc(r.nrodcto)}</code></td>
                <td>${esc(r.destino)}</td>
                <td class="text-end">${fmtCOP.format(r.cuotaMod)}</td>
                <td>${esc(r.nroPlanilla)}</td>
                <td>${r.estadoHtml}</td>
                <td>${r.accionHtml}</td>
            </tr>`;

        if (!pagPanel) pagPanel = new Paginador('panelTbody', 'pagPanel');
        pagPanel.setData(rowItems, renderFila);
        tabla.classList.remove('d-none');

        // Progreso
        progCnt.textContent = `0 / ${nrodctos.length}`;
        progFill.style.width = '0%';
        progBar.classList.remove('d-none');

        // Consultar soporte en paralelo; actualizar paginador reactivamente
        let done = 0;
        await Promise.all(nrodctos.map(async (nrodcto, i) => {
            let estadoHtml = '<span class="tag tag-yellow">⚠ Error API</span>';
            let accionHtml = '—';

            try {
                const sr      = await fetch(`/api/detalle/soporte?nrodcto=${encodeURIComponent(nrodcto)}`, { signal });
                const soporte = sr.ok ? await sr.json() : null;

                if (!soporte) {
                    estadoHtml = '<span class="tag tag-yellow">⚠ Error API</span>';
                    accionHtml = '—';
                } else if (!soporte.success || !soporte.data || soporte.data.length === 0) {
                    estadoHtml = '<span class="tag tag-red">❌ Sin soporte</span>';
                    accionHtml = '—';
                } else {
                    estadoHtml = '<span class="tag tag-green">✅ Encontrado</span>';
                    const itm   = soporte.data[0];
                    const path  = itm.storage_Path  ?? '';
                    const fReg  = itm.fechaRegistro ?? '';
                    accionHtml  = path
                        ? `<button class="btn btn-sm btn-outline-success"
                                  onclick='verSoporte(${JSON.stringify(nrodcto)}, ${JSON.stringify(fReg)}, ${JSON.stringify(path)})'>
                               🔍 Ver soporte
                           </button>`
                        : '<span class="text-muted small">Sin archivo</span>';
                }
            } catch (e) {
                if (e.name === 'AbortError') return; // consulta cancelada — no actualizar UI
                // error de red u otro: dejar estado de error por defecto
            }

            // Si se inició una nueva consulta mientras esta corría, no tocar la UI
            if (signal.aborted) return;

            const updated = { ...rowItems[i], estadoHtml, accionHtml };
            rowItems[i]   = updated;
            pagPanel.updateItem(i, updated);

            done++;
            const pct = Math.round((done / nrodctos.length) * 100);
            progFill.style.width = pct + '%';
            progCnt.textContent  = `${done} / ${nrodctos.length}`;
            if (done === nrodctos.length) {
                setTimeout(() => progBar.classList.add('d-none'), 800);
                consultaController = null;
            }
        }));

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
    diaActivo = null;
    document.getElementById('panelDia').classList.add('d-none');
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

// ── Helpers ──────────────────────────────────────────────────────
function esc(v) {
    if (v == null) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
