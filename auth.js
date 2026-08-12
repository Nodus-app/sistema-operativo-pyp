// PYP Logistica - Dashboard Operativo - app.js
// Login cosmetico (protege por UX, no es seguridad real: repo/sitio es privado).
var USERS = { 'sup': { pass: 'PypSup2026!', name: 'Supervisor' } };

function F(n) {
  n = Number(n) || 0;
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function FI(n) { return (Number(n) || 0).toLocaleString('es-AR'); }
function P(n) { return (Number(n) || 0).toFixed(1) + '%'; }

function pctClass(pct) {
  if (pct >= 15) return 'br';
  if (pct >= 7) return 'by';
  return 'bg';
}

function KPI(label, value, cls) {
  return '<div class="kpi"><div class="kpi-v" style="color:' + (cls || '#e3ecf7') + '">' + value + '</div><div class="kpi-l">' + label + '</div></div>';
}

function doLogin() {
  var u = (document.getElementById('lu').value || '').trim().toLowerCase();
  var p = (document.getElementById('lp').value || '').trim();
  var usr = USERS[u];
  if (usr && p === usr.pass) {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    sessionStorage.setItem('pyp_auth', '1');
    initApp();
  } else {
    document.getElementById('lerr').style.display = 'block';
  }
}
function doLogout() {
  sessionStorage.removeItem('pyp_auth');
  location.reload();
}

// ---------- PERIODO (mes) ----------
var MES_ACTIVO = null;
function curData() { return D_DATA[MES_ACTIVO] || { kpis: {}, prov: [], chofer: [], motivo: [], routes: [], cli: {}, provs: [], chs: [] }; }

function initMesSelector() {
  var sel = document.getElementById('hdr-mes');
  sel.innerHTML = D_MESES.map(function (m) {
    return '<option value="' + m + '">' + (D_MES_LABEL[m] || m) + '</option>';
  }).join('');
  MES_ACTIVO = D_MES_ACTUAL || (D_MESES[0] || null);
  sel.value = MES_ACTIVO;
}
function onMesChange() {
  MES_ACTIVO = document.getElementById('hdr-mes').value;
  RUTA_SEL = null;
  TAB_INIT = {};
  var activeBtn = document.querySelector('.tab.on');
  if (CURRENT_TAB === 'ventas') renderVentas();
  if (CURRENT_TAB === 'ruta') initRuta();
  if (CURRENT_TAB === 'rechazos') renderRechazos();
  TAB_INIT[CURRENT_TAB] = true;
}

// ---------- TABS ----------
var CURRENT_TAB = 'ventas';
var TAB_INIT = {};
function goTab(id, btn) {
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('on'); });
  document.querySelectorAll('.sec').forEach(function (s) { s.classList.remove('on'); });
  btn.classList.add('on');
  document.getElementById('sec-' + id).classList.add('on');
  CURRENT_TAB = id;
  if (!TAB_INIT[id]) {
    TAB_INIT[id] = true;
    if (id === 'ventas') renderVentas();
    if (id === 'ruta') initRuta();
    if (id === 'rechazos') renderRechazos();
  }
}

function initApp() {
  initMesSelector();
  renderVentas();
  TAB_INIT['ventas'] = true;
}

// ---------- VENTAS ----------
function renderVentas() {
  var d = curData();
  var k = d.kpis || {};
  document.getElementById('ven-kpis').innerHTML =
    KPI('Venta Neta', '$' + F(k.venta_neta), '#00e5ff') +
    KPI('Rechazado', '$' + F(k.rechazo_monto), '#ff5252') +
    KPI('Cambios', '$' + F(k.cambio_monto), '#ffab40') +
    KPI('% Rechazo', P(k.pct_rechazo), '#ff5252') +
    KPI('Comprobantes', FI(k.comprobantes), '#e3ecf7') +
    KPI('Clientes', FI(k.clientes), '#e3ecf7') +
    KPI('Choferes', FI(k.choferes), '#e3ecf7') +
    KPI('Repartos', FI(k.repartos), '#e3ecf7');

  var provSel = document.getElementById('ven-prov-f');
  var prevSel = provSel.value;
  provSel.innerHTML = '<option value="">Todos</option>' + d.provs.map(function (p) {
    return '<option value="' + p + '">' + p + '</option>';
  }).join('');
  if (d.provs.indexOf(prevSel) !== -1) provSel.value = prevSel;
  var prov = provSel.value;

  var provTb = document.getElementById('ven-prov-tb');
  provTb.innerHTML = d.prov.length ? d.prov.map(function (p) {
    return '<tr' + (p.proveedor === prov ? ' style="background:#0f1a2a"' : '') + '><td>' + p.proveedor + '</td><td>$' + F(p.venta) + '</td><td>$' + F(p.rechazo) + '</td>' +
      '<td><span class="' + pctClass(p.pct_rechazo) + '">' + P(p.pct_rechazo) + '</span></td>' +
      '<td>$' + F(p.cambio) + '</td><td><span class="' + pctClass(p.pct_cambio) + '">' + P(p.pct_cambio) + '</span></td>' +
      '<td>' + FI(p.unidades) + '</td></tr>';
  }).join('') : '<tr><td colspan="7" class="empty">Sin datos en el período</td></tr>';

  var chofer = prov ? (d.chofer_prov[prov] || []) : d.chofer;
  document.getElementById('ven-ch-titulo').textContent = prov ? ('— ' + prov) : '';
  var chTb = document.getElementById('ven-ch-tb');
  chTb.innerHTML = chofer.length ? chofer.map(function (c) {
    return '<tr><td>' + c.chofer + '</td><td>$' + F(c.venta) + '</td><td>$' + F(c.rechazo) + '</td>' +
      '<td><span class="' + pctClass(c.pct_rechazo) + '">' + P(c.pct_rechazo) + '</span></td>' +
      '<td>$' + F(c.cambio) + '</td><td><span class="' + pctClass(c.pct_cambio) + '">' + P(c.pct_cambio) + '</span></td>' +
      '<td><div class="pw"><div class="pb"><div class="pf" style="width:' + c.efectividad + '%;background:#00e5ff"></div></div>' + P(c.efectividad) + '</div></td></tr>';
  }).join('') : '<tr><td colspan="7" class="empty">Sin datos en el período</td></tr>';
}

// ---------- HOJA DE RUTA ----------
var RUTA_SEL = null;
function initRuta() {
  var d = curData();
  var chSel = document.getElementById('ruta-ch');
  chSel.innerHTML = '<option value="">Todos</option>';
  d.chs.forEach(function (c) { chSel.innerHTML += '<option value="' + c + '">' + c + '</option>'; });
  filtRuta();
}
function filtRuta() {
  var d = curData();
  var ch = document.getElementById('ruta-ch').value;
  var q = (document.getElementById('ruta-q').value || '').toLowerCase();
  var list = d.routes.filter(function (r) { return !ch || r.chofer === ch; });
  if (q) {
    list = list.filter(function (r) {
      var clientes = d.cli[String(r.reparto_id)] || [];
      return clientes.some(function (c) {
        return (String(c[1]) + ' ' + String(c[2])).toLowerCase().indexOf(q) !== -1;
      });
    });
  }
  var wrap = document.getElementById('rsl');
  if (!list.length) {
    wrap.innerHTML = '<div class="empty">Sin repartos en el período</div>';
    return;
  }
  wrap.innerHTML = list.map(function (r) {
    return '<div class="ri' + (RUTA_SEL === r.reparto_id ? ' on' : '') + '" onclick="selRuta(' + r.reparto_id + ')">' +
      '<div class="ri-top"><span class="ri-ch">' + r.chofer + '</span><span class="ri-rep">Rep. ' + (r.reparto_codigo || r.reparto_id) + '</span></div>' +
      '<div class="ri-meta"><span>' + (r.fecha || '') + '</span><span>' + r.vehiculo + '</span><span>$' + F(r.total) + '</span>' +
      '<span class="' + pctClass(r.pct_rechazo) + '">' + P(r.pct_rechazo) + '</span></div></div>';
  }).join('');
  if (RUTA_SEL && list.some(function (r) { return r.reparto_id === RUTA_SEL; })) selRuta(RUTA_SEL);
}
function selRuta(id) {
  var d = curData();
  RUTA_SEL = id;
  filtRuta();
  var route = d.routes.find(function (r) { return r.reparto_id === id; });
  var clientes = d.cli[String(id)] || [];
  var det = document.getElementById('rdet');
  if (!route) { det.innerHTML = '<div style="color:#5c7ba8;padding:20px">Seleccion&aacute; un reparto</div>'; return; }
  var provRows = (route.top_prov || []).map(function (p) {
    return '<span class="bp">' + p.proveedor + ': $' + F(p.importe) + '</span>';
  }).join(' ');
  det.innerHTML = '<h3 style="margin-bottom:10px;color:#00e5ff">' + route.chofer + ' &mdash; Reparto ' + (route.reparto_codigo || route.reparto_id) + '</h3>' +
    '<div style="margin-bottom:14px">' + provRows + '</div>' +
    clientes.map(function (c) {
      var flag = c[6];
      var badge = flag === 1 ? '<span class="br">Rechazado</span>' : flag === 3 ? '<span class="by">Cambio</span>' : '<span class="bg">OK</span>';
      return '<div class="cli-row"><div><div class="cli-name">' + (c[1] || '') + '</div>' +
        '<div class="cli-addr">' + (c[2] || '') + (c[3] ? ' &middot; ' + c[3] : '') + '</div>' +
        '<div class="cli-meta">' + badge + '</div></div>' +
        '<div class="cli-right">$' + F(c[5]) + '<br><span style="color:#5c7ba8">Comp. ' + (c[4] || '') + '</span></div></div>';
    }).join('');
}

// ---------- RECHAZOS ----------
function renderRechazos() {
  var d = curData();
  var k = d.kpis || {};
  document.getElementById('rej-kpis').innerHTML =
    KPI('Rechazado', '$' + F(k.rechazo_monto), '#ff5252') +
    KPI('% Rechazo', P(k.pct_rechazo), '#ff5252') +
    KPI('Comprobantes rechazados', FI(k.rechazados), '#ff5252') +
    KPI('Cambios', '$' + F(k.cambio_monto), '#ffab40') +
    KPI('% Cambio', P(k.pct_cambio), '#ffab40') +
    KPI('Comprobantes con cambio', FI(k.cambios_cant), '#ffab40');

  var provSel = document.getElementById('rej-prov-f');
  var prevSel = provSel.value;
  provSel.innerHTML = '<option value="">Todos</option>' + d.provs.map(function (p) {
    return '<option value="' + p + '">' + p + '</option>';
  }).join('');
  if (d.provs.indexOf(prevSel) !== -1) provSel.value = prevSel;
  var prov = provSel.value;

  var provTb = document.getElementById('rej-prov-tb');
  provTb.innerHTML = d.prov.length ? d.prov.map(function (p) {
    return '<tr><td>' + p.proveedor + '</td><td>$' + F(p.rechazo) + '</td>' +
      '<td><span class="' + pctClass(p.pct_rechazo) + '">' + P(p.pct_rechazo) + '</span></td>' +
      '<td>$' + F(p.cambio) + '</td><td><span class="' + pctClass(p.pct_cambio) + '">' + P(p.pct_cambio) + '</span></td></tr>';
  }).join('') : '<tr><td colspan="5" class="empty">Sin datos en el período</td></tr>';

  var motivo = prov ? (d.motivo_prov[prov] || []) : d.motivo;
  var motTb = document.getElementById('rej-mot-tb');
  motTb.innerHTML = motivo.length ? motivo.map(function (m) {
    return '<tr><td>' + m.motivo + '</td><td>' + FI(m.cantidad) + '</td><td>$' + F(m.importe) + '</td><td>' + P(m.pct) + '</td></tr>';
  }).join('') : '<tr><td colspan="4" class="empty">Sin rechazos en el período</td></tr>';

  var chList = prov
    ? (d.chofer_prov[prov] || []).filter(function (c) { return c.rechazo > 0; }).sort(function (a, b) { return b.rechazo - a.rechazo; })
    : d.chofer.filter(function (c) { return c.rechazos > 0; }).sort(function (a, b) { return b.rechazo - a.rechazo; });
  var chTb = document.getElementById('rej-ch-tb');
  chTb.innerHTML = chList.length ? chList.map(function (c) {
    return '<tr><td>' + c.chofer + '</td><td>' + FI(c.rechazos || '') + '</td><td>$' + F(c.rechazo) + '</td>' +
      '<td><span class="' + pctClass(c.pct_rechazo) + '">' + P(c.pct_rechazo) + '</span></td></tr>';
  }).join('') : '<tr><td colspan="4" class="empty">Sin rechazos en el período</td></tr>';
}

// ---------- EXPORT EXCEL ----------
function dl(rows, filename) {
  var ws = XLSX.utils.json_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, filename);
}
function dlProv() { dl(curData().prov, 'pyp_ventas_por_proveedor_' + MES_ACTIVO + '.xlsx'); }
function dlChofer() {
  var d = curData();
  var prov = document.getElementById('ven-prov-f').value;
  var rows = prov ? (d.chofer_prov[prov] || []) : d.chofer;
  dl(rows, 'pyp_ventas_por_chofer_' + (prov ? prov.replace(/[^a-z0-9]+/gi, '_') + '_' : '') + MES_ACTIVO + '.xlsx');
}
function dlMotivo() { dl(curData().motivo, 'pyp_rechazos_por_motivo_' + MES_ACTIVO + '.xlsx'); }
function dlProvRech() { dl(curData().prov, 'pyp_rechazos_por_proveedor_' + MES_ACTIVO + '.xlsx'); }
function dlRuta() {
  var d = curData();
  var rows = [];
  d.routes.forEach(function (r) {
    (d.cli[String(r.reparto_id)] || []).forEach(function (c) {
      rows.push({
        reparto: r.reparto_codigo || r.reparto_id, chofer: r.chofer, fecha: r.fecha,
        cliente_id: c[0], razon_social: c[1], direccion: c[2], localidad: c[3],
        comprobante: c[4], importe: c[5], estado: c[6] === 1 ? 'Rechazado' : (c[6] === 3 ? 'Cambio' : 'OK'),
      });
    });
  });
  dl(rows, 'pyp_hoja_de_ruta_' + MES_ACTIVO + '.xlsx');
}

// ---------- INIT / SESSION / SW ----------
window.addEventListener('load', function () {
  if (sessionStorage.getItem('pyp_auth') === '1') {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initApp();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(function () {});
  }
});
