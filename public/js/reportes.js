// ============================================
// REPORTES SEMANALES - JavaScript (Standalone)
// ============================================

let oficinasDisponibles = [];
let intervaloActualizacion = null;
let totalReportesAnterior = 0;
let ultimaActualizacion = null;
let ultimaActualizacionForzada = null;
let reportesActuales = [];

const PDF_LOGO_URL = "/img/logo-arica.png";
let _pdfLogoDataUrl = null;

// Función auxiliar para escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function _getLogoDataUrl() {
    if (_pdfLogoDataUrl) return _pdfLogoDataUrl;
    try {
        const res = await fetch(PDF_LOGO_URL, { cache: 'force-cache' });
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        _pdfLogoDataUrl = dataUrl;
        return _pdfLogoDataUrl;
    } catch (e) {
        console.warn('No se pudo cargar logo para PDF:', e);
        return null;
    }
}

function _formatoRangoFechasEs(inicioISO, finISO) {
    try {
        if (!inicioISO || !finISO) return '-';
        const [y1, m1, d1] = inicioISO.split('-').map(Number);
        const [y2, m2, d2] = finISO.split('-').map(Number);
        const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        if (y1 === y2 && m1 === m2) {
            return `${d1} al ${d2} de ${meses[m1 - 1]} ${y1}`;
        }
        return `${d1}/${m1}/${y1} al ${d2}/${m2}/${y2}`;
    } catch {
        return `${inicioISO} al ${finISO}`;
    }
}

function _formatearActividadesConNegrita(texto) {
    if (!texto || !texto.trim()) return '-';
    const escaped = escapeHtml(texto);
    let resultado = escaped.replace(/^(\d+\.\s+.+)$/gm, '<strong>$1</strong>');
    const patrones = [
        /(\d+)[\.\\)\s-]+([^<\n]*)/g,
        /([•\-\*])\s+([^<\n]*)/g,
        /\((\d+)\)\s+([^<\n]*)/g
    ];
    patrones.forEach(patron => {
        resultado = resultado.replace(patron, (match, prefijo, contenido) => {
            if (contenido && contenido.trim() && !contenido.includes('<strong>')) {
                return `${prefijo} <strong>${contenido.trim()}</strong>`;
            }
            return match;
        });
    });
    return resultado;
}

function _contarAccionesDesdeTexto(texto) {
    const raw = (texto || '').toString();
    if (!raw.trim()) return 0;
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return 0;
    const bulletLike = lines.filter(l =>
        l.startsWith('-') || l.startsWith('•') ||
        /^[0-9]+[\)\.\\-]/.test(l) ||
        /^[A-Za-zÁÉÍÓÚÑáéíóúñ]+\s*:\s*\d+/.test(l)
    );
    return Math.max(bulletLike.length, Math.min(lines.length, 50));
}

function _normalizarTextoReporte(reporte) {
    const actividades = (reporte.Actividades || reporte['Actividades Realizadas'] || '').toString().trim();
    const comentarios = (reporte.Comentarios || '').toString().trim();
    const responsable = (reporte.Responsable || reporte['Nombre del Responsable'] || '').toString().trim();
    const fecha = (reporte.Fecha || '').toString().trim();
    let out = '';
    if (fecha || responsable) out += `${fecha || '-'}${responsable ? ' · ' + responsable : ''}\n`;
    out += (actividades || '-');
    if (comentarios) out += `\n\nObs: ${comentarios}`;
    return out.trim();
}

function _agruparPorOficina(reportes) {
    const map = new Map();
    (reportes || []).forEach(r => {
        const oficina = (r.Oficina || 'Sin Oficina').toString().trim() || 'Sin Oficina';
        const actividades = (r.Actividades || r['Actividades Realizadas'] || '').toString();
        const acciones = _contarAccionesDesdeTexto(actividades);
        if (!map.has(oficina)) {
            map.set(oficina, { oficina, acciones: 0, textos: [] });
        }
        const item = map.get(oficina);
        item.acciones += acciones;
        item.textos.push(_normalizarTextoReporte(r));
    });
    const rows = Array.from(map.values());
    rows.sort((a, b) => a.oficina.localeCompare(b.oficina, 'es', { sensitivity: 'base' }));
    return rows;
}

function _buildHtmlPlantilla({ titulo, rangoFechas, rows }) {
    const logoAbs = new URL(PDF_LOGO_URL, window.location.origin).toString();
    const esc = (s) => escapeHtml((s ?? '').toString());
    const bodyRows = (rows || []).map(r => {
        const left = `${r.oficina}\n\nTotal de acciones en general: ${r.acciones}`;
        const right = (r.textos || []).join('\n\n');
        return `<tr><td class="col-oficina"><div class="pre">${esc(left)}</div></td><td class="col-reporte"><div class="pre">${esc(right)}</div></td></tr>`;
    }).join('');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${esc(titulo || 'REPORTE SEMANAL')}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#111}.header{display:flex;align-items:center;gap:12px;margin-bottom:8px}.logo{width:90px;height:90px;object-fit:contain}.brand h1{margin:0;font-size:22px;letter-spacing:.5px}.brand p{margin:2px 0 0;font-size:12px;color:#555}.title{text-align:center;font-weight:700;margin:10px 0 6px}.meta{width:100%;border-collapse:collapse;margin:10px 0 18px;font-size:12px}.meta td{border:1px solid #111;padding:6px 8px}.meta td.label{width:20%;font-weight:700}.main{width:100%;border-collapse:collapse;font-size:12px}.main th,.main td{border:1px solid #111;padding:8px 10px;vertical-align:top}.main th{font-weight:700;text-align:center}.col-oficina{width:28%}.col-reporte{width:72%}.pre{white-space:pre-wrap;line-height:1.35}.no-print{margin-top:10px;color:#666;font-size:12px}.table-header{display:flex;border-bottom:1px solid #111;margin-bottom:10px;padding-bottom:5px}.header-cell{font-weight:700;text-align:center;flex:1}.header-cell:first-child{flex:0 0 28%;text-align:left}.header-cell:last-child{flex:0 0 72%;text-align:left}@media print{.no-print{display:none}}</style></head><body><div class="header"><img class="logo" src="${logoAbs}" alt="DIPRESEH"/><div class="brand"><h1>DIPRESEH</h1><p>Municipalidad de Arica</p></div></div><div class="title">${esc(titulo || 'REPORTE SEMANAL')}</div><table class="meta"><tr><td class="label">Fecha:</td><td>${esc(rangoFechas || '-')}</td></tr><tr><td class="label">Dirección:</td><td>Dirección de Seguridad Pública IMA</td></tr><tr><td class="label">Director:</td><td>Esteban Maldonado Ayala</td></tr></table><div class="table-header"><div class="header-cell">OFICINAS</div><div class="header-cell">REPORTES SEMANALES</div></div><table class="main"><tbody>${bodyRows || ''}</tbody></table><div class="no-print">Sugerencia: en la ventana de impresión puedes elegir "Guardar como PDF".</div></body></html>`.trim();
}

function _abrirImpresion(html) {
    try {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open(); doc.write(html); doc.close();
        const cw = iframe.contentWindow;
        setTimeout(() => { try { cw.focus(); cw.print(); } finally { setTimeout(() => iframe.remove(), 2000); } }, 350);
    } catch (e) {
        console.error('No se pudo imprimir:', e);
        alert('No se pudo abrir la vista previa de impresión en este navegador.');
    }
}

function imprimirReporte(reporte) {
    const fechaInicio = document.getElementById('fecha-inicio')?.value || '';
    const fechaFin = document.getElementById('fecha-fin')?.value || '';
    const rango = _formatoRangoFechasEs(fechaInicio, fechaFin);
    const oficina = (reporte.Oficina || 'reporte').toString().trim();
    const actividades = (reporte.Actividades || reporte['Actividades Realizadas'] || '').toString();
    const rows = [{ oficina, acciones: _contarAccionesDesdeTexto(actividades), textos: [_normalizarTextoReporte(reporte)] }];
    _abrirImpresion(_buildHtmlPlantilla({ titulo: 'REPORTE SEMANAL', rangoFechas: rango, rows }));
}

function imprimirSemana() {
    if (!window.reportesActuales || window.reportesActuales.length === 0) { alert('No hay reportes para imprimir con los filtros actuales.'); return; }
    const fechaInicio = document.getElementById('fecha-inicio')?.value || '';
    const fechaFin = document.getElementById('fecha-fin')?.value || '';
    const rango = _formatoRangoFechasEs(fechaInicio, fechaFin);
    const rows = _agruparPorOficina(window.reportesActuales);
    _abrirImpresion(_buildHtmlPlantilla({ titulo: 'REPORTE SEMANAL', rangoFechas: rango, rows }));
}

async function _buildPdfPlantilla({ titulo, rangoFechas, rows }) {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert('No se pudo cargar jsPDF.'); return null; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const logo = await _getLogoDataUrl();
    if (logo) { try { doc.addImage(logo, 'PNG', 12, 10, 28, 28); } catch (e) { console.warn('Logo error:', e); } }
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('DIPRESEH', 45, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('Municipalidad de Arica', 45, 24);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(titulo || 'REPORTE SEMANAL', 105, 45, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setDrawColor(0);
    doc.rect(20, 52, 170, 18); doc.line(55, 58, 190, 58); doc.line(55, 64, 190, 64); doc.line(55, 70, 190, 70); doc.line(55, 52, 55, 70);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', 23, 56); doc.text('Dirección:', 23, 62); doc.text('Director:', 23, 68);
    doc.setFont('helvetica', 'normal');
    doc.text(rangoFechas || '-', 58, 56); doc.text('Dirección de Seguridad Pública IMA', 58, 62); doc.text('Esteban Maldonado Ayala', 58, 68);
    const body = (rows || []).map(r => [`${r.oficina}\n\nTotal de acciones en general: ${r.acciones}`, (r.textos || []).join('\n\n')]);
    doc.autoTable({ startY: 80, head: [['OFICINAS', 'REPORTES SEMANALES']], body, theme: 'grid', showHead: 'firstPage', styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 3, valign: 'top', overflow: 'linebreak', lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0] }, headStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: 'bold', halign: 'center' }, columnStyles: { 0: { cellWidth: 55, fontStyle: 'normal' }, 1: { cellWidth: 115 } }, margin: { left: 20, right: 20 } });
    return doc;
}

function exportarReportePDF(reporte) {
    const fechaInicio = document.getElementById('fecha-inicio')?.value || '';
    const fechaFin = document.getElementById('fecha-fin')?.value || '';
    const rango = _formatoRangoFechasEs(fechaInicio, fechaFin);
    const oficina = (reporte.Oficina || 'reporte').toString().trim();
    const actividades = (reporte.Actividades || reporte['Actividades Realizadas'] || '').toString();
    const rows = [{ oficina, acciones: _contarAccionesDesdeTexto(actividades), textos: [_normalizarTextoReporte(reporte)] }];
    _buildPdfPlantilla({ titulo: 'REPORTE SEMANAL', rangoFechas: rango, rows }).then(doc => { if (!doc) return; doc.save(`reporte_${oficina.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'reporte'}.pdf`); });
}

function exportarSemanaPDF() {
    if (!window.reportesActuales || window.reportesActuales.length === 0) { alert('No hay reportes para exportar.'); return; }
    const fechaInicio = document.getElementById('fecha-inicio')?.value || '';
    const fechaFin = document.getElementById('fecha-fin')?.value || '';
    const rango = _formatoRangoFechasEs(fechaInicio, fechaFin);
    const rows = _agruparPorOficina(window.reportesActuales);
    _buildPdfPlantilla({ titulo: 'REPORTE SEMANAL', rangoFechas: rango, rows }).then(doc => { if (!doc) return; doc.save('reporte_semanal_oficinas.pdf'); });
}

// Lista base de oficinas
const OFICINAS_BASE = [
    'OF. Resolución de Conflictos en Seguridad', 'OF. Prevención Consumo Alcohol y Drogas',
    'OF. Recuperación y Seguridad BNUP', 'Patrullaje Preventivo', 'Monitoreo Integrado y Drones',
    'Inspecciones Especializadas (UDIEM)', 'Formulación de Proyectos', 'OF. Convenios y Fondos a Terceros',
    'OF. Control de Presupuesto y Compras', 'OF. Observatorio Seguridad Pública', 'OF. Difusión a la Comunidad',
    'OF. Asesoría Técnica', 'OF. Partes', 'Mediación Vecinal', 'Prevención del Consumo de Alcohol y Otras Drogas',
    'Senda Previene', 'Recuperación de Espacios Públicos', 'Central de Cámaras', 'Call Center', 'UDIEM',
    'Lazos', 'Observatorio', 'Somos Barrio', 'Somos Barrio Comercial', 'Oficina de Vigilancia Aérea',
    'Gestión Operativa y Procesos Estratégicos', 'Borde Costero'
];

function poblarSelectOficinas(oficinas = []) {
    const select = document.getElementById('filtro-oficina');
    if (!select) return;
    const selectedBefore = select.value;
    const merged = [...OFICINAS_BASE, ...(oficinas || [])].map(o => (o ?? '').toString().trim()).filter(Boolean);
    const unique = Array.from(new Set(merged));
    unique.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    select.innerHTML = '';
    const optTodas = document.createElement('option');
    optTodas.value = 'todas'; optTodas.textContent = 'Todas las Oficinas';
    select.appendChild(optTodas);
    unique.forEach(oficina => {
        const option = document.createElement('option');
        option.value = oficina; option.textContent = oficina;
        select.appendChild(option);
    });
    if (selectedBefore && Array.from(select.options).some(o => o.value === selectedBefore)) {
        select.value = selectedBefore;
    }
}

// Cargar reportes
async function cargarReportes(forceRefresh = false) {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('content');
    const errorEl = document.getElementById('error');
    const refreshBtn = document.getElementById('btn-refresh');
    const refreshIcon = document.getElementById('refresh-icon');
    const refreshText = document.getElementById('refresh-text');

    if (forceRefresh && refreshBtn && refreshIcon) {
        refreshBtn.disabled = true; refreshIcon.classList.add('spinning');
        if (refreshText) refreshText.textContent = 'Actualizando...';
    }
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (contentEl) contentEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');

    try {
        const oficina = document.getElementById('filtro-oficina').value;
        const fechaInicio = document.getElementById('fecha-inicio').value;
        const fechaFin = document.getElementById('fecha-fin').value;

        let url = '/api/datos';
        const params = new URLSearchParams();
        if (oficina && oficina !== 'todas') params.append('oficina', oficina);
        if (fechaInicio && fechaFin) { params.append('start', fechaInicio); params.append('end', fechaFin); }
        params.append('t', Date.now().toString());
        if (forceRefresh) params.append('refresh', '1');
        if (params.toString()) url += '?' + params.toString();

        const fetchOptions = forceRefresh ? { cache: 'no-store', headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } } : { cache: 'no-cache' };
        const response = await fetch(url, fetchOptions);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        if (oficinasDisponibles.length === 0) {
            oficinasDisponibles = data.oficinas || [];
            poblarSelectOficinas(oficinasDisponibles);
        }

        const totalActual = data.total || 0;
        const hayNuevosReportes = totalActual > totalReportesAnterior && totalReportesAnterior > 0;
        document.getElementById('total-reportes').textContent = totalActual;
        if (hayNuevosReportes && !forceRefresh) mostrarNotificacionNuevosReportes(totalActual - totalReportesAnterior);
        totalReportesAnterior = totalActual;
        ultimaActualizacion = new Date();
        if (forceRefresh) ultimaActualizacionForzada = new Date();
        actualizarIndicadorUltimaActualizacion();

        const tbody = document.getElementById('tabla-reportes');
        if (!tbody) return;
        window.reportesActuales = data.reportes || [];

        if (data.reportes && data.reportes.length > 0) {
            tbody.innerHTML = data.reportes.map(reporte => {
                const fecha = escapeHtml(reporte.Fecha || '-');
                const responsable = escapeHtml(reporte.Responsable || reporte['Nombre del Responsable'] || '-');
                const oficina = escapeHtml(reporte.Oficina || '-');
                const semana = escapeHtml(reporte.Semana || '-');
                const actividadesRaw = (reporte.Actividades || reporte['Actividades Realizadas'] || '');
                const actividades = _formatearActividadesConNegrita(actividadesRaw.substring(0, 150) + (actividadesRaw.length > 150 ? '...' : ''));
                const comentariosRaw = (reporte.Comentarios || '');
                const comentarios = escapeHtml(comentariosRaw.substring(0, 100) + (comentariosRaw.length > 100 ? '...' : ''));
                const fechaRegistro = escapeHtml(reporte.Fecha_Registro || reporte['Fecha de Registro'] || '-');
                const reporteEncoded = encodeURIComponent(JSON.stringify(reporte));
                return `<tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${fecha}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${responsable}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">${oficina}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${semana}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${actividades || '-'}</td>
                    <td class="px-4 py-3 text-sm text-gray-900">${comentarios || '-'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${fechaRegistro}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm space-y-2">
                        <button class="btn-presentar w-full justify-center px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition text-xs font-medium flex items-center gap-1 shadow-md" data-reporte="${reporteEncoded}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Presentar
                        </button>
                        <button class="btn-exportar-reporte w-full justify-center px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs font-medium flex items-center gap-1 shadow-md" data-reporte="${reporteEncoded}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8m4-4H8m9-10H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2z"/></svg> PDF reporte
                        </button>
                        <button class="btn-imprimir-reporte w-full justify-center px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-xs font-medium flex items-center gap-1 shadow-md" data-reporte="${reporteEncoded}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/></svg> Imprimir
                        </button>
                    </td></tr>`;
            }).join('');

            tbody.querySelectorAll('.btn-presentar').forEach(btn => {
                btn.addEventListener('click', function() { presentarReporte(JSON.parse(decodeURIComponent(this.getAttribute('data-reporte') || ''))); });
            });
            tbody.querySelectorAll('.btn-exportar-reporte').forEach(btn => {
                btn.addEventListener('click', function() { exportarReportePDF(JSON.parse(decodeURIComponent(this.getAttribute('data-reporte') || ''))); });
            });
            tbody.querySelectorAll('.btn-imprimir-reporte').forEach(btn => {
                btn.addEventListener('click', function() { imprimirReporte(JSON.parse(decodeURIComponent(this.getAttribute('data-reporte') || ''))); });
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-500">No hay reportes disponibles para los filtros seleccionados</td></tr>';
        }

        if (loadingEl) loadingEl.classList.add('hidden');
        if (contentEl) contentEl.classList.remove('hidden');
        if (forceRefresh && refreshBtn && refreshIcon) { refreshBtn.disabled = false; refreshIcon.classList.remove('spinning'); if (refreshText) refreshText.textContent = 'Actualizar'; }
    } catch (error) {
        console.error('Error cargando reportes:', error);
        if (loadingEl) loadingEl.classList.add('hidden');
        if (errorEl) errorEl.classList.remove('hidden');
        if (forceRefresh && refreshBtn && refreshIcon) { refreshBtn.disabled = false; refreshIcon.classList.remove('spinning'); if (refreshText) refreshText.textContent = 'Actualizar'; }
    }
}

function aplicarFiltro() { cargarReportes(); }

function mostrarNotificacionNuevosReportes(cantidad) {
    let notificacion = document.getElementById('notificacion-nuevos-reportes');
    if (!notificacion) {
        notificacion = document.createElement('div');
        notificacion.id = 'notificacion-nuevos-reportes';
        notificacion.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-slide-in';
        document.body.appendChild(notificacion);
    }
    notificacion.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span class="font-semibold">${cantidad} nuevo${cantidad > 1 ? 's' : ''} reporte${cantidad > 1 ? 's' : ''}</span><button onclick="this.parentElement.remove()" class="ml-2 hover:text-gray-200"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>`;
    setTimeout(() => { if (notificacion && notificacion.parentElement) { notificacion.style.animation = 'slideOutRight 0.3s ease-out'; setTimeout(() => notificacion.remove(), 300); } }, 5000);
}

function iniciarActualizacionAutomatica() {
    if (intervaloActualizacion) clearInterval(intervaloActualizacion);
    intervaloActualizacion = setInterval(() => {
        const presentacionView = document.getElementById('presentacion-view');
        if (presentacionView && !presentacionView.classList.contains('hidden')) return;
        const loadingEl = document.getElementById('loading');
        if (loadingEl && !loadingEl.classList.contains('hidden')) return;
        const ahora = new Date();
        const debeForzarRefresh = !ultimaActualizacionForzada || (ahora - ultimaActualizacionForzada) >= 120000;
        if (debeForzarRefresh) ultimaActualizacionForzada = ahora;
        cargarReportes(debeForzarRefresh);
    }, 30000);
}

function detenerActualizacionAutomatica() {
    if (intervaloActualizacion) { clearInterval(intervaloActualizacion); intervaloActualizacion = null; }
}

function actualizarIndicadorUltimaActualizacion() {
    const indicador = document.getElementById('indicador-actualizacion');
    const texto = document.getElementById('ultima-actualizacion-texto');
    if (indicador && ultimaActualizacion) {
        indicador.classList.remove('hidden');
        const diffSegundos = Math.floor((new Date() - ultimaActualizacion) / 1000);
        if (texto) {
            if (diffSegundos < 5) texto.textContent = '(hace unos segundos)';
            else if (diffSegundos < 60) texto.textContent = `(hace ${diffSegundos}s)`;
            else texto.textContent = `(hace ${Math.floor(diffSegundos / 60)}m)`;
        }
    }
}

function presentarReporte(reporte) {
    try {
        if (!reporte) return;
        const fechaEl = document.getElementById('presentacion-fecha');
        const responsableEl = document.getElementById('presentacion-responsable');
        const oficinaEl = document.getElementById('presentacion-oficina');
        const semanaEl = document.getElementById('presentacion-semana');
        const actividadesEl = document.getElementById('presentacion-actividades');
        const comentariosEl = document.getElementById('presentacion-comentarios');
        const fechaRegistroEl = document.getElementById('presentacion-fecha-registro');

        if (fechaEl) fechaEl.textContent = reporte.Fecha || '-';
        if (responsableEl) responsableEl.textContent = reporte.Responsable || reporte['Nombre del Responsable'] || '-';
        if (oficinaEl) oficinaEl.textContent = reporte.Oficina || '-';
        if (semanaEl) semanaEl.textContent = reporte.Semana || '-';
        if (actividadesEl) actividadesEl.innerHTML = _formatearActividadesConNegrita(reporte.Actividades || reporte['Actividades Realizadas'] || '-');
        if (comentariosEl) comentariosEl.textContent = reporte.Comentarios || '-';
        if (fechaRegistroEl) fechaRegistroEl.textContent = reporte.Fecha_Registro || reporte['Fecha de Registro'] || '-';

        const presentacionView = document.getElementById('presentacion-view');
        if (!presentacionView) return;
        moverFondoAlModoPresentacion();
        detenerActualizacionAutomatica();
        presentacionView.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (presentacionView.requestFullscreen) presentacionView.requestFullscreen().catch(() => {});
    } catch (error) {
        console.error('Error al presentar reporte:', error);
    }
}

let _fondoOriginal = null;

function moverFondoAlModoPresentacion() {
    const canvas = document.querySelector('#gradient-background canvas');
    const destino = document.getElementById('presentacion-gradient-background');
    if (!canvas || !destino) return;
    if (!_fondoOriginal) _fondoOriginal = { parent: canvas.parentNode, nextSibling: canvas.nextSibling };
    if (canvas.parentNode === destino) return;
    destino.appendChild(canvas);
}

function restaurarFondoSitio() {
    const canvas = document.querySelector('#presentacion-gradient-background canvas');
    if (!canvas || !_fondoOriginal || !_fondoOriginal.parent) return;
    if (_fondoOriginal.nextSibling) _fondoOriginal.parent.insertBefore(canvas, _fondoOriginal.nextSibling);
    else _fondoOriginal.parent.appendChild(canvas);
}

function cerrarPresentacion() {
    const presentacionView = document.getElementById('presentacion-view');
    presentacionView.classList.add('hidden');
    document.body.style.overflow = 'auto';
    restaurarFondoSitio();
    iniciarActualizacionAutomatica();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

document.addEventListener('keydown', function(e) { if (e.key === 'Escape') cerrarPresentacion(); });
document.addEventListener('fullscreenchange', function() {
    const presentacionView = document.getElementById('presentacion-view');
    if (!document.fullscreenElement && presentacionView && !presentacionView.classList.contains('hidden')) restaurarFondoSitio();
});

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    poblarSelectOficinas([]);

    try {
        const qs = new URLSearchParams(window.location.search || '');
        const oficinaQS = qs.get('oficina');
        if (oficinaQS) {
            const selectOficina = document.getElementById('filtro-oficina');
            if (selectOficina) {
                const exists = Array.from(selectOficina.options).some(o => o.value === oficinaQS);
                if (!exists) { const opt = document.createElement('option'); opt.value = oficinaQS; opt.textContent = oficinaQS; selectOficina.appendChild(opt); }
                selectOficina.value = oficinaQS;
            }
        }
    } catch (e) { console.warn('No se pudo leer querystring oficina:', e); }

    const hoy = new Date();
    const hace30Dias = new Date(hoy); hace30Dias.setDate(hace30Dias.getDate() - 30);
    const fechaInicio = document.getElementById('fecha-inicio');
    const fechaFin = document.getElementById('fecha-fin');
    if (fechaInicio && fechaFin) {
        const fmt = (f) => `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')}`;
        fechaInicio.value = fmt(hace30Dias); fechaFin.value = fmt(hoy);
    }

    document.getElementById('filtro-oficina').addEventListener('change', () => cargarReportes());
    if (fechaInicio) fechaInicio.addEventListener('change', () => cargarReportes());
    if (fechaFin) fechaFin.addEventListener('change', () => cargarReportes());

    const btnExportarSemana = document.getElementById('btn-exportar-semana');
    if (btnExportarSemana) btnExportarSemana.addEventListener('click', () => exportarSemanaPDF());

    const btnImprimirSemana = document.getElementById('btn-imprimir-semana');
    if (btnImprimirSemana) btnImprimirSemana.addEventListener('click', () => imprimirSemana());

    ultimaActualizacionForzada = new Date();
    cargarReportes(true).then(() => iniciarActualizacionAutomatica());
});
