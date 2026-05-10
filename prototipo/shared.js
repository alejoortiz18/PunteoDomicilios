// ═══════════════════════════════════════════════════════════════
//   HELPHARMA · Punteo de Domicilios — Shared JS
// ═══════════════════════════════════════════════════════════════

// ── Mock data ─────────────────────────────────────────────────
const MENSAJEROS_LIST = [
  'GARCIA CARLOS', 'MARTINEZ PEDRO', 'LOPEZ JUAN',
  'RODRIGUEZ MARIA', 'SANCHEZ ANDRES', 'TORRES LUISA',
];

// ── Bodegas / User session ─────────────────────────────────────
const BODEGAS = [
  { code: 'MMUNOZ',    name: 'M. Muñoz',    initial: 'MM', color: '#2563eb' },
  { code: 'JGARCIA',   name: 'J. García',   initial: 'JG', color: '#16a34a' },
  { code: 'CMARTINEZ', name: 'C. Martínez', initial: 'CM', color: '#0891b2' },
  { code: 'PRODRIGO',  name: 'P. Rodrigo',  initial: 'PR', color: '#d97706' },
  { code: 'ASANCHEZ',  name: 'A. Sánchez',  initial: 'AS', color: '#7c3aed' },
  { code: 'LTORRES',   name: 'L. Torres',   initial: 'LT', color: '#dc2626' },
];
const SESSION_USER_KEY = 'punteo_usuario';
function getCurrentUser()   { return sessionStorage.getItem(SESSION_USER_KEY) || null; }
function setCurrentUser(c)  { sessionStorage.setItem(SESSION_USER_KEY, c); }
function clearCurrentUser() { sessionStorage.removeItem(SESSION_USER_KEY); }
function getBodega(code)    {
  return BODEGAS.find(b => b.code === code) ||
         { code, name: code, initial: (code || '?').slice(0, 2).toUpperCase(), color: '#6b7280' };
}

/**
 * Ensures a user is authenticated.
 * If a user is stored in sessionStorage, calls onReady(user) immediately.
 * Otherwise redirects to login.html.
 */
function requireUser(onReady) {
  const user = getCurrentUser();
  if (user) { onReady(user); return; }
  if (!window.location.pathname.toLowerCase().endsWith('login.html')) {
    window.location.replace('login.html');
  }
}

const DESTINOS = [
  'BARRIO EL PRADO CL 53 #15-20', 'AV AMERICAS CRA 68 #24-50',
  'CENTRO HISTORICO CL 10 #2-30', 'CHAPINERO CRA 7 #53-42',
  'BELLO HORIZONTE CL 127 #6-30', 'KENNEDY CL 42SUR #80-15',
  'USAQUEN CRA 6 #118-26',        'SUBA CL 128 #91-22',
  'FONTIBON CRA 99 #17-20',       'ENGATIVA CL 80 #73-61',
];

const OBSERVACIONES = [
  'Entregado titular', 'Firmado portería', 'Recibido familiar',
  'Entregado vecino', 'Sin novedad', '', '',
];

// ── Helpers ───────────────────────────────────────────────────
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

function formatDate(d) {
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function formatDatetime(d) {
  return d.toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function formatDateInput(d) { return d.toISOString().split('T')[0]; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function animateCounter(el, target, suffix = '', isFloat = false) {
  const duration = 900;
  const startTime = performance.now();
  function update(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = target * eased;
    el.textContent = (isFloat ? v.toFixed(1) : Math.round(v)) + suffix;
    if (p < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

const MENSAJEROS_NOMBRES = [
  'GARCIA CARLOS', 'MARTINEZ PEDRO', 'LOPEZ JUAN',
  'RODRIGUEZ MARIA', 'SANCHEZ ANDRES', 'TORRES LUISA',
];

function randomRecord(usuario) {
  const id = 'K' + (8000000 + rnd(0, 999999));
  const hasSupport = Math.random() > 0.20;
  const d = new Date();
  d.setMinutes(d.getMinutes() - rnd(0, 600));
  return {
    id:          id,
    nrodcto:     id,
    mensajero:   pick(MENSAJEROS_NOMBRES),
    fecha:       formatDateInput(d),
    destino:     pick(DESTINOS),
    observacio:  pick(OBSERVACIONES),
    refrigera:   Math.random() > 0.85 ? 'SÍ' : 'NO',
    cuotaMod:    rnd(2000, 8000),
    domicilio:   rnd(3000, 15000),
    vlrConsig:   rnd(10000, 200000),
    nroConsig:   'C' + rnd(1000000, 9999999),
    nroPlanilla: 'P' + rnd(100000, 999999),
    usuario,
    // extra para features de API (fase 2)
    estado:        hasSupport ? 'found' : 'missing',
    fechaRegistro: hasSupport ? formatDatetime(d) : null,
    storagePath:   hasSupport ? `soportes/2026/05/${String(d.getDate()).padStart(2,'0')}/${id}.pdf` : null,
  };
}

function generateDataset(usuario, n) {
  return Array.from({ length: n || rnd(18, 38) }, () => randomRecord(usuario));
}

function generateTimeline(mensajero, days = 7) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const total   = rnd(12, 45);
    const found   = Math.floor(total * (0.58 + Math.random() * 0.38));
    const missing = total - found;
    result.push({ fecha: formatDate(d), dateObj: new Date(d), total, found, missing });
  }
  return result;
}

// ── Real-data helpers (require datos-reales.js) ───────────────

/** Convert "2025-07" -> "Julio 2025" */
function formatMesLabel(mesISO) {
  const [y, m] = mesISO.split('-');
  const names = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return names[parseInt(m, 10)] + ' ' + y;
}

/** Monthly summary for a user: [{mes, label, totalReg, planillas}] sorted newest first */
function getResumenMensual(usuario) {
  const data = ((window.DATOS_REALES || {})[usuario]) || {};
  const meses = {};
  for (const [fecha, registros] of Object.entries(data)) {
    const mes = fecha.substring(0, 7);
    if (!meses[mes]) meses[mes] = { totalReg: 0, planillas: new Set() };
    meses[mes].totalReg += registros.length;
    registros.forEach(r => { if (r[3]) meses[mes].planillas.add(r[3]); });
  }
  return Object.entries(meses)
    .map(([mes, v]) => ({ mes, label: formatMesLabel(mes), totalReg: v.totalReg, planillas: v.planillas.size }))
    .sort((a, b) => b.mes.localeCompare(a.mes));
}

/** Records for a specific ISO date: [[nrodcto,destino,cuotaMod,nroPlanilla,id],...] */
function getDatosDelDia(usuario, fecha) {
  return (((window.DATOS_REALES || {})[usuario]) || {})[fecha] || [];
}

/** Sorted list of ISO dates within a month (newest first) */
function getFechasDelMes(usuario, mes) {
  const data = (((window.DATOS_REALES || {})[usuario]) || {});
  return Object.keys(data).filter(f => f.startsWith(mes)).sort().reverse();
}

/**
 * Mock API for consultasoporte — deterministic per nrodcto (~80% success).
 * Returns same result every time for the same nrodcto.
 */
function mockConsultaSoporte(nrodcto) {
  let hash = 0;
  for (let i = 0; i < nrodcto.length; i++) {
    hash = ((hash * 31) + nrodcto.charCodeAt(i)) & 0xFFFFFF;
  }
  if ((hash % 10) >= 8) return { success: false, message: 'No se encontraron soportes' };
  const d = new Date();
  d.setHours(14, 37, 1, 0);
  return {
    success: true,
    data: [{
      fechaRegistro: d.toISOString().replace('T', ' ').substring(0, 19),
      storage_disk:  's3://helpharma-soportes-dispensacion',
      storage_path:  'soportes/' + d.getFullYear() + '/' +
                     String(d.getMonth()+1).padStart(2,'0') + '/' +
                     String(d.getDate()).padStart(2,'0') + '/' + nrodcto + '.pdf',
    }]
  };
}

// ── Sidebar builder ───────────────────────────────────────────
function buildSidebar(active) {
  const nav = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard',      href: 'index.html' },
    { id: 'detalle',   icon: '📄', label: 'Detalle Archivo', href: 'detalle.html' },
  ];
  let html = `
    <aside class="sidebar">
      <a class="sidebar-brand" href="index.html">
        <div class="brand-icon">💊</div>
        <div>
          <div class="brand-name">HELPHARMA</div>
          <div class="brand-sub">Punteo Domicilios</div>
        </div>
      </a>
      <nav class="sidebar-nav">
        <div class="nav-section-title">Principal</div>`;
  nav.forEach(item => {
    if (item.section) html += `<div class="nav-section-title" style="margin-top:8px">${item.section}</div>`;
    html += `<a class="nav-item${item.id === active ? ' active' : ''}" href="${item.href}">
      <span class="nav-icon">${item.icon}</span>${item.label}${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
    </a>`;
  });
  html += `</nav>
      <div class="sidebar-footer" style="align-items:center;gap:10px;padding:14px 16px;flex-wrap:nowrap">
        ${(function() {
          const cu = getCurrentUser();
          const cb = cu ? getBodega(cu) : null;
          if (cb) return `
            <div style="width:34px;height:34px;border-radius:9px;flex-shrink:0;
                        background:${cb.color};display:flex;align-items:center;
                        justify-content:center;color:#fff;font-size:11px;font-weight:700">
              ${cb.initial}
            </div>
            <div style="flex:1;min-width:0">
              <div class="user-name">${cb.code}</div>
              <div class="user-role" style="color:#94a3b8">Bodega activa</div>
            </div>
            <button onclick="window.location.href='login.html?cambiar=1'" title="Cambiar de usuario"
              style="background:rgba(255,255,255,.08);border:none;color:#94a3b8;border-radius:6px;
                     padding:4px 8px;font-size:11px;cursor:pointer;font-family:inherit;
                     white-space:nowrap;transition:background .15s"
              onmouseover="this.style.background='rgba(255,255,255,.2)'"
              onmouseout="this.style.background='rgba(255,255,255,.08)'">↩ Cambiar</button>`;
          return `
            <div class="avatar">?</div>
            <div>
              <div class="user-name">Sin bodega</div>
              <div class="user-role">Selecciona para continuar</div>
            </div>`;
        })()}
      </div>
    </aside>`;
  document.body.insertAdjacentHTML('afterbegin', html);
}

// ── Topbar builder ────────────────────────────────────────────
function buildTopbar(title, breadcrumb, actions = '') {
  const now = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const tu = getCurrentUser();
  const tb = tu ? getBodega(tu) : null;
  const userChip = tb
    ? `<div style="display:flex;align-items:center;gap:7px;background:${tb.color}16;
                  border:1px solid ${tb.color}38;border-radius:20px;padding:5px 11px 5px 6px;
                  cursor:pointer;transition:opacity .15s" title="Cambiar bodega"
            onclick="window.location.href='login.html?cambiar=1'">
         <div style="width:22px;height:22px;border-radius:5px;background:${tb.color};
                     display:flex;align-items:center;justify-content:center;
                     color:#fff;font-size:10px;font-weight:700">${tb.initial}</div>
         <span style="font-size:12px;font-weight:600;color:${tb.color}">${tb.code}</span>
       </div>`
    : '';
  document.querySelector('.main').insertAdjacentHTML('afterbegin', `
    <div class="topbar">
      <div class="topbar-left">
        <div class="topbar-title">
          <span>${title}</span>
          ${breadcrumb ? `<span class="breadcrumb">/ ${breadcrumb}</span>` : ''}
        </div>
      </div>
      <div class="topbar-actions">
        ${userChip}
        <span class="topbar-date">${now}</span>
        ${actions}
      </div>
    </div>`);
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3500);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
function initModalClose(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', e => { if (e.target === el) closeModal(id); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(id); });
}

// ── Table pagination helpers ──────────────────────────────────
function buildPagination(container, current, total, onPage) {
  container.innerHTML = '';
  const add = (label, page, disabled, active) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (active ? ' active' : '');
    b.textContent = label; b.disabled = disabled;
    b.onclick = () => onPage(page);
    container.appendChild(b);
  };
  add('‹', current - 1, current === 1);
  const s = Math.max(1, current - 2), e = Math.min(total, current + 2);
  for (let p = s; p <= e; p++) add(p, p, false, p === current);
  add('›', current + 1, current === total);
}
