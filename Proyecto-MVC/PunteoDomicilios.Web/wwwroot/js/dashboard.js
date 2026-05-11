// dashboard.js — Punteo de Domicilios MVC
'use strict';

const fmtCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('es-CO');

let chartTimeline = null;
let pagResumen    = null;

// ── Al cargar la página ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cargarResumenMensual();
});

// ── Resumen mensual ────────────────────────────────────────────
async function cargarResumenMensual() {
    try {
        const res = await fetch('/api/resumen-mensual');
        if (!res.ok) { document.getElementById('resumenLoading').classList.add('d-none'); mostrarModal('Error', 'Error al cargar el resumen.', 'error'); return; }

        const data = await res.json();

        document.getElementById('resumenLoading').classList.add('d-none');

        if (!data || data.length === 0) {
            document.getElementById('resumenVacio').classList.remove('d-none');
            return;
        }

        if (!pagResumen) pagResumen = new Paginador('resumenTbody', 'pagResumen');
        pagResumen.setData(data, m => `
            <tr>
                <td><strong>${esc(m.label)}</strong></td>
                <td class="text-end">${fmtNum.format(m.totalRegistros)}</td>
                <td class="text-end">${fmtNum.format(m.cantidadDias)}</td>
                <td class="text-end">
                    <a href="/detalle?mes=${esc(m.mes)}" class="btn btn-sm btn-outline-primary">
                        📋 Ver detalle
                    </a>
                </td>
            </tr>`);

        document.getElementById('resumenTabla').classList.remove('d-none');
    } catch (e) {
        document.getElementById('resumenLoading').classList.add('d-none');
        mostrarModal('Error de conexión', 'No se pudo conectar con el servidor.', 'error');
        console.error(e);
    }
}

// ── Consulta por fecha ─────────────────────────────────────────
async function iniciarConsulta() {
    const fecha = document.getElementById('inputFecha').value;
    if (!fecha) { mostrarModal('Fecha requerida', 'Selecciona una fecha.', 'warning'); return; }

    setBusy(true);
    resetKpis();
    ocultarCharts();

    try {
        // Obtener registros del día
        const res = await fetch(`/api/registros?fecha=${encodeURIComponent(fecha)}`);
        if (!res.ok) { const e = await res.json().catch(()=>({})); mostrarModal('Error del servidor', e.error ?? 'Error del servidor.', 'error'); return; }

        const data = await res.json();
        const registros = data.registros ?? [];

        if (registros.length === 0) {
            mostrarModal('Sin resultados', 'No hay registros para esta fecha.', 'info');
            return;
        }

        // KPIs
        const totalCuota     = registros.reduce((s, r) => s + (r.cuotaMod || 0), 0);
        const planillasSet   = new Set(registros.map(r => r.nroPlanilla).filter(Boolean));
        const mensajerosSet  = new Set(registros.map(r => r.mensajero).filter(Boolean));
        actualizarKpi('kpiTotal',     registros.length, '');
        actualizarKpi('kpiCuota',     totalCuota, '', true);
        actualizarKpi('kpiPlanillas', planillasSet.size, '');
        actualizarKpi('kpiSoporte',   mensajerosSet.size, '');
        document.getElementById('areaKpi').classList.remove('d-none');

        // Timeline
        await cargarTimeline();
        document.getElementById('areaCharts').classList.remove('d-none');

    } catch (e) {
        console.error(e);
        mostrarModal('Error inesperado', 'Error inesperado. Revisa la consola.', 'error');
    } finally {
        setBusy(false);
    }
}

// ── KPIs ────────────────────────────────────────────────────────
function actualizarKpi(id, valor, sufijo = '', esCOP = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const duracion = 700;
    const inicio   = performance.now();
    function step(now) {
        const p    = Math.min((now - inicio) / duracion, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        const v    = valor * ease;
        el.textContent = esCOP
            ? fmtCOP.format(Math.round(v))
            : Math.round(v) + sufijo;
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function resetKpis() {
    ['kpiTotal','kpiCuota','kpiPlanillas','kpiSoporte'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
    });
}

function ocultarCharts() {
    document.getElementById('areaCharts').classList.add('d-none');
}

// ── Timeline Chart ──────────────────────────────────────────────
async function cargarTimeline() {
    try {
        const res = await fetch('/api/timeline?dias=7');
        if (!res.ok) return;
        const dias = await res.json();

        const labels     = dias.map(d => d.fecha);
        const encontrados = dias.map(d => d.encontrados);
        const faltantes   = dias.map(d => d.faltantes);
        const totales     = dias.map(d => d.total);

        const ctx = document.getElementById('chartTimeline').getContext('2d');
        if (chartTimeline) chartTimeline.destroy();

        chartTimeline = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Entregados',
                        data: encontrados,
                        backgroundColor: '#16a34a',
                        borderRadius: 4,
                    },
                    {
                        label: 'Faltantes',
                        data: faltantes,
                        backgroundColor: '#dc2626',
                        borderRadius: 4,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            afterBody: (items) => {
                                const idx = items[0].dataIndex;
                                return `Total: ${totales[idx]}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                }
            }
        });
    } catch (e) {
        console.warn('No se pudo cargar el timeline:', e);
    }
}

// ── Helpers ──────────────────────────────────────────────────────
function setBusy(busy) {
    const btn = document.getElementById('btnConsultar');
    const sp  = document.getElementById('spinnerConsulta');
    if (btn) btn.disabled = busy;
    if (sp)  sp.classList.toggle('d-none', !busy);
}

function esc(v) {
    if (v == null) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}


