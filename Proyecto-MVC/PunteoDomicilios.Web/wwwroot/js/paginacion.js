// paginacion.js — Paginador reutilizable · Punteo de Domicilios
'use strict';

/**
 * Paginador — maneja paginación de cualquier tabla.
 *
 * @param {string} tbodyId      — id del <tbody> donde se renderizan filas
 * @param {string} containerId  — id del div footer (se inyecta .pag-info y .pag-nav)
 * @param {number} pageSize     — filas por página (default 10)
 *
 * API pública:
 *   setData(items, renderFn)   — carga datos y renderiza página 1
 *                                renderFn(item, globalIndex) => string HTML de <tr>
 *   updateItem(index, item)    — actualiza un ítem y re-renderiza si está en página activa
 *   irA(pagina)                — navega a una página
 */
class Paginador {
    constructor(tbodyId, containerId, pageSize = 10) {
        this._tbody     = document.getElementById(tbodyId);
        this._container = document.getElementById(containerId);
        this._pageSize  = pageSize;
        this._items     = [];
        this._renderFn  = null;
        this._pagina    = 1;
    }

    setData(items, renderFn) {
        this._items   = items.slice();
        this._renderFn = renderFn;
        this._pagina  = 1;
        this._render();
    }

    updateItem(index, item) {
        if (index < 0 || index >= this._items.length) return;
        this._items[index] = item;
        const desde = (this._pagina - 1) * this._pageSize;
        const hasta = desde + this._pageSize;
        if (index >= desde && index < hasta) {
            this._render();
        }
    }

    irA(p) {
        const total = this._totalPaginas();
        if (p < 1 || p > total) return;
        this._pagina = p;
        this._render();
    }

    // ── Internos ──────────────────────────────────────────────

    _totalPaginas() {
        return Math.max(1, Math.ceil(this._items.length / this._pageSize));
    }

    _render() {
        if (!this._renderFn || !this._tbody) return;

        const total     = this._items.length;
        const totalPags = this._totalPaginas();
        const desde     = (this._pagina - 1) * this._pageSize;
        const hasta     = Math.min(desde + this._pageSize, total);

        // Filas visibles
        this._tbody.innerHTML = this._items
            .slice(desde, hasta)
            .map((item, i) => this._renderFn(item, desde + i))
            .join('');

        if (!this._container) return;

        // Ocultar footer si cabe en una sola página
        if (total <= this._pageSize) {
            this._container.classList.add('d-none');
            return;
        }
        this._container.classList.remove('d-none');

        // Info: "Mostrando X–Y de Z registros"
        let infoEl = this._container.querySelector('.pag-info');
        if (!infoEl) {
            infoEl = document.createElement('span');
            infoEl.className = 'tabla-info pag-info';
            this._container.appendChild(infoEl);
        }
        infoEl.textContent = `Mostrando ${desde + 1}–${hasta} de ${total} registros`;

        // Nav de páginas
        let navEl = this._container.querySelector('.pag-nav');
        if (!navEl) {
            navEl = document.createElement('nav');
            navEl.className = 'paginador pag-nav';
            navEl.setAttribute('aria-label', 'Paginación de tabla');
            this._container.appendChild(navEl);
        }
        this._renderControls(navEl, this._pagina, totalPags);
    }

    _renderControls(navEl, pagina, totalPags) {
        const self = this;
        navEl.innerHTML = '';

        navEl.appendChild(this._makeBtn('‹', pagina === 1,
            () => self.irA(pagina - 1), 'Página anterior'));

        this._windowedPages(pagina, totalPags).forEach(p => {
            if (p === '…') {
                const el = document.createElement('span');
                el.className = 'pag-ellipsis';
                el.textContent = '…';
                navEl.appendChild(el);
            } else {
                const btn = this._makeBtn(String(p), false,
                    () => self.irA(p), `Página ${p}`);
                if (p === pagina) {
                    btn.classList.add('activo');
                    btn.setAttribute('aria-current', 'page');
                }
                navEl.appendChild(btn);
            }
        });

        navEl.appendChild(this._makeBtn('›', pagina === totalPags,
            () => self.irA(pagina + 1), 'Página siguiente'));
    }

    _makeBtn(label, disabled, onClick, ariaLabel) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pag-btn';
        btn.innerHTML = label;
        btn.disabled = disabled;
        btn.setAttribute('aria-label', ariaLabel);
        if (!disabled) btn.addEventListener('click', onClick);
        return btn;
    }

    _windowedPages(current, total) {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages = [1];
        if (current > 3) pages.push('…');
        const lo = Math.max(2, current - 1);
        const hi = Math.min(total - 1, current + 1);
        for (let i = lo; i <= hi; i++) pages.push(i);
        if (current < total - 2) pages.push('…');
        pages.push(total);
        return pages;
    }
}
