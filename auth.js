// PYP Logistica - Dashboard Operativo - app.js
// Login cosmetico (protege por UX, no es seguridad real: repo publico, todos los
// datos de todos los vendedores viajan igual en el HTML sea cual sea el login usado).
var USERS = { 'sup': { pass: 'PypSup2026!', name: 'Supervisor' } };
var ROLE = 'sup';       // 'sup' | 'vendedor'
var VEND_COD = null;
var TABS_VENDEDOR = ['ventas', 'rechazos', 'rentabilidad', 'descuentos', 'objetivo', 'clientes', 'producto'];  // unicas visibles para rol vendedor (evolucion queda solo para supervisor)

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
  var uRaw = (document.getElementById('lu').value || '').trim();
  var u = uRaw.toLowerCase();
  var p = (document.getElementById('lp').value || '').trim();
  var usr = USERS[u];

  if (usr && p === usr.pass) {
    ROLE = 'sup'; VEND_COD = null;
    sessionStorage.setItem('pyp_auth', 'sup');
    entrar();
    return;
  }

  // Vendedor: usuario = numero de vendedor, clave = numero repetido (ej. vendedor 3 -> "33")
  if (/^\d+$/.test(uRaw) && D_VVALIDOS.indexOf(uRaw) !== -1 && p === uRaw + uRaw) {
    ROLE = 'vendedor'; VEND_COD = uRaw;
    sessionStorage.setItem('pyp_auth', 'vendedor:' + uRaw);
    entrar();
    return;
  }

  document.getElementById('lerr').style.display = 'block';
}
function entrar() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  initApp();
}
function doLogout() {
  sessionStorage.removeItem('pyp_auth');
  location.reload();
}

// ---------- PERIODO (mes) ----------
var MES_ACTIVO = null;
function curData() {
  var fuente = ROLE === 'vendedor' ? ((D_VEND_DATA[VEND_COD] || {})[MES_ACTIVO]) : D_DATA[MES_ACTIVO];
  return fuente || {
    kpis: {}, prov: [], chofer: [], camion: [],
    kpis_camion: {}, prov_camion: {}, chofer_camion: {}, chofer_prov_camion: {},
    motivo: [], motivo_prov: {}, chofer_prov: {}, routes: [], cli: {},
    rent_prov: [], rent_chofer: [], desc_prov: [], desc_chofer: [], geo: [],
    vendedor: [], producto: [], rubro: [], clientes: [],
    provs: [], chs: [], camiones: [],
  };
}

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
  if (CURRENT_TAB === 'rentabilidad') renderRentabilidad();
  if (CURRENT_TAB === 'descuentos') renderDescuentos();
  if (CURRENT_TAB === 'geografia') renderGeografia();
  if (CURRENT_TAB === 'objetivo') renderObjetivo();
  if (CURRENT_TAB === 'evolucion') renderEvolucion();
  if (CURRENT_TAB === 'interanual') renderInteranual();
  if (CURRENT_TAB === 'clientes') renderClientes();
  if (CURRENT_TAB === 'producto') renderProducto();
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
    if (id === 'rentabilidad') renderRentabilidad();
    if (id === 'descuentos') renderDescuentos();
    if (id === 'geografia') renderGeografia();
    if (id === 'objetivo') renderObjetivo();
    if (id === 'evolucion') renderEvolucion();
    if (id === 'interanual') renderInteranual();
    if (id === 'clientes') renderClientes();
    if (id === 'producto') renderProducto();
  }
}

function initApp() {
  applyRoleUI();
  initMesSelector();
  renderVentas();
  TAB_INIT = { ventas: true };
  CURRENT_TAB = 'ventas';
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('on'); });
  document.querySelectorAll('.sec').forEach(function (s) { s.classList.remove('on'); });
  document.getElementById('sec-ventas').classList.add('on');
  var firstTab = document.querySelector('.tabs .tab:not([style*="display: none"])');
  if (firstTab) firstTab.classList.add('on');
}

function applyRoleUI() {
  var badge = document.getElementById('hdr-rol');
  document.querySelectorAll('.tabs .tab').forEach(function (btn) {
    var id = (btn.getAttribute('onclick') || '').match(/goTab\('(\w+)'/);
    id = id ? id[1] : null;
    var visible = ROLE === 'sup' || TABS_VENDEDOR.indexOf(id) !== -1;
    btn.style.display = visible ? '' : 'none';
  });
  if (ROLE === 'vendedor') {
    badge.textContent = '— ' + (D_VNOM[VEND_COD] || ('Vendedor ' + VEND_COD));
  } else {
    badge.textContent = '— Supervisor';
  }
}

// ---------- VENTAS ----------

// Helpers para el filtro "Excluir Camion": los datos vienen precalculados por camion
// desde Python (d.kpis_camion / d.prov_camion / d.chofer_camion / d.chofer_prov_camion) y
// acá se suman todos los camiones MENOS el excluido. Venta/rechazo/cambio/unidades/entregas
// son sumas -> se pueden acumular camion por camion. clientes/choferes/repartos son conteos
// DISTINCT -> hay que unionar los sets de ids (no alcanza con restar el conteo del camion excluido,
// porque un mismo cliente puede haber sido atendido por más de un camion en el mes).
function camKpisExcluyendo(kpisCamion, excl) {
  var venta_neta = 0, rechazo_monto = 0, cambio_monto = 0, comprobantes = 0, rechazados = 0, cambios_cant = 0;
  var cli = {}, cho = {}, rep = {};
  Object.keys(kpisCamion || {}).forEach(function (cam) {
    if (cam === excl) return;
    var k = kpisCamion[cam];
    venta_neta += k.venta_neta; rechazo_monto += k.rechazo_monto; cambio_monto += k.cambio_monto;
    comprobantes += k.comprobantes; rechazados += k.rechazados; cambios_cant += k.cambios_cant;
    (k.clientes || []).forEach(function (id) { cli[id] = 1; });
    (k.choferes || []).forEach(function (id) { cho[id] = 1; });
    (k.repartos || []).forEach(function (id) { rep[id] = 1; });
  });
  var bruta = venta_neta + rechazo_monto + cambio_monto;
  return {
    venta_neta: venta_neta, rechazo_monto: rechazo_monto, cambio_monto: cambio_monto,
    pct_rechazo: bruta ? (rechazo_monto / bruta * 100) : 0,
    pct_cambio: bruta ? (cambio_monto / bruta * 100) : 0,
    comprobantes: comprobantes, rechazados: rechazados, cambios_cant: cambios_cant,
    clientes: Object.keys(cli).length, choferes: Object.keys(cho).length, repartos: Object.keys(rep).length,
  };
}

// byCamion: {camion: {grupo: {venta,rechazo,cambio,...extraKeys}}} -> suma todos los camiones
// menos "excl" y devuelve {grupo: {venta,rechazo,cambio,...}} (sin ordenar).
function camAggExcluyendo(byCamion, excl, extraKeys) {
  var agg = {};
  Object.keys(byCamion || {}).forEach(function (cam) {
    if (cam === excl) return;
    var grupos = byCamion[cam];
    Object.keys(grupos).forEach(function (g) {
      var c = grupos[g];
      var a = agg[g];
      if (!a) {
        a = agg[g] = { venta: 0, rechazo: 0, cambio: 0 };
        (extraKeys || []).forEach(function (k) { a[k] = 0; });
      }
      a.venta += c.venta || 0; a.rechazo += c.rechazo || 0; a.cambio += c.cambio || 0;
      (extraKeys || []).forEach(function (k) { a[k] += c[k] || 0; });
    });
  });
  return agg;
}

function camProvListExcluyendo(provCamion, excl) {
  var agg = camAggExcluyendo(provCamion, excl, ['unidades']);
  var out = Object.keys(agg).map(function (p) {
    var a = agg[p], bruta = a.venta + a.rechazo + a.cambio;
    return {
      proveedor: p, venta: a.venta, rechazo: a.rechazo, cambio: a.cambio, unidades: a.unidades,
      pct_rechazo: bruta ? (a.rechazo / bruta * 100) : 0, pct_cambio: bruta ? (a.cambio / bruta * 100) : 0,
    };
  });
  out.sort(function (a, b) { return b.venta - a.venta; });
  return out;
}

function camChoferListExcluyendo(choferCamion, excl) {
  var agg = camAggExcluyendo(choferCamion, excl, ['entregas', 'rechazos', 'cambios']);
  var out = Object.keys(agg).map(function (c) {
    var a = agg[c], bruta = a.venta + a.rechazo + a.cambio, total = a.entregas + a.rechazos + a.cambios;
    return {
      chofer: c, venta: a.venta, rechazo: a.rechazo, cambio: a.cambio,
      pct_rechazo: bruta ? (a.rechazo / bruta * 100) : 0, pct_cambio: bruta ? (a.cambio / bruta * 100) : 0,
      efectividad: total ? (a.entregas / total * 100) : 0,
    };
  });
  out.sort(function (a, b) { return b.venta - a.venta; });
  return out;
}

// filas actualmente mostradas en cada tabla de la pestana Ventas, usadas por los botones de Excel
// para que la descarga coincida con lo que se ve en pantalla (incluida la exclusion de camion)
var VEN_TB_ACTUAL = { prov: [], chofer: [], camion: [] };

function renderVentas() {
  var d = curData();

  // el select de camion se arma primero porque KPIs/Proveedor/Chofer dependen de el
  var camSel = document.getElementById('ven-cam-f');
  var prevCam = camSel.value;
  camSel.innerHTML = '<option value="">Ninguno excluido</option>' + d.camiones.map(function (c) {
    return '<option value="' + c + '">' + c + '</option>';
  }).join('');
  if (d.camiones.indexOf(prevCam) !== -1) camSel.value = prevCam;
  var camExcl = camSel.value;

  var k = camExcl ? camKpisExcluyendo(d.kpis_camion, camExcl) : (d.kpis || {});
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

  var provList = camExcl ? camProvListExcluyendo(d.prov_camion, camExcl) : d.prov;
  VEN_TB_ACTUAL.prov = provList;
  var provTb = document.getElementById('ven-prov-tb');
  provTb.innerHTML = provList.length ? provList.map(function (p) {
    return '<tr' + (p.proveedor === prov ? ' style="background:#0f1a2a"' : '') + '><td>' + p.proveedor + '</td><td>$' + F(p.venta) + '</td><td>$' + F(p.rechazo) + '</td>' +
      '<td><span class="' + pctClass(p.pct_rechazo) + '">' + P(p.pct_rechazo) + '</span></td>' +
      '<td>$' + F(p.cambio) + '</td><td><span class="' + pctClass(p.pct_cambio) + '">' + P(p.pct_cambio) + '</span></td>' +
      '<td>' + FI(p.unidades) + '</td></tr>';
  }).join('') : '<tr><td colspan="7" class="empty">Sin datos en el período</td></tr>';

  var chofer;
  if (camExcl) {
    chofer = prov
      ? camChoferListExcluyendo((d.chofer_prov_camion || {})[prov] || {}, camExcl)
      : camChoferListExcluyendo(d.chofer_camion, camExcl);
  } else {
    chofer = prov ? (d.chofer_prov[prov] || []) : d.chofer;
  }
  VEN_TB_ACTUAL.chofer = chofer;
  document.getElementById('ven-ch-titulo').textContent = prov ? ('— ' + prov) : '';
  var chTb = document.getElementById('ven-ch-tb');
  chTb.innerHTML = chofer.length ? chofer.map(function (c) {
    return '<tr><td>' + c.chofer + '</td><td>$' + F(c.venta) + '</td><td>$' + F(c.rechazo) + '</td>' +
      '<td><span class="' + pctClass(c.pct_rechazo) + '">' + P(c.pct_rechazo) + '</span></td>' +
      '<td>$' + F(c.cambio) + '</td><td><span class="' + pctClass(c.pct_cambio) + '">' + P(c.pct_cambio) + '</span></td>' +
      '<td><div class="pw"><div class="pb"><div class="pf" style="width:' + c.efectividad + '%;background:#00e5ff"></div></div>' + P(c.efectividad) + '</div></td></tr>';
  }).join('') : '<tr><td colspan="7" class="empty">Sin datos en el período</td></tr>';

  // tabla Ventas por Camion: lista todos menos el excluido (ya no filtra a "solo este")
  var camiones = camExcl ? d.camion.filter(function (c) { return c.camion !== camExcl; }) : d.camion;
  VEN_TB_ACTUAL.camion = camiones;
  var camTb = document.getElementById('ven-cam-tb');
  camTb.innerHTML = camiones.length ? camiones.map(function (c) {
    return '<tr><td>' + c.camion + '</td><td>$' + F(c.venta) + '</td><td>$' + F(c.rechazo) + '</td>' +
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

// ---------- RENTABILIDAD ----------
function rentRow(a) {
  return '<tr><td>' + a.grupo + '</td><td>$' + F(a.venta) + '</td><td>$' + F(a.costo) + '</td>' +
    '<td>$' + F(a.rentabilidad) + '</td><td><span class="' + (a.pct_rentabilidad < 0 ? 'br' : (a.pct_rentabilidad < 10 ? 'by' : 'bg')) + '">' + P(a.pct_rentabilidad) + '</span></td></tr>';
}
function renderRentabilidad() {
  var d = curData();
  var totVenta = d.rent_prov.reduce(function (s, a) { return s + a.venta; }, 0);
  var totCosto = d.rent_prov.reduce(function (s, a) { return s + a.costo; }, 0);
  var totRent = totVenta - totCosto;
  document.getElementById('rent-kpis').innerHTML =
    KPI('Venta', '$' + F(totVenta), '#00e5ff') +
    KPI('Costo', '$' + F(totCosto), '#ffab40') +
    KPI('Rentabilidad', '$' + F(totRent), totRent >= 0 ? '#69f0ae' : '#ff5252') +
    KPI('% Rentabilidad', P(totVenta ? totRent / totVenta * 100 : 0), totRent >= 0 ? '#69f0ae' : '#ff5252');

  document.getElementById('rent-prov-tb').innerHTML = d.rent_prov.length
    ? d.rent_prov.map(rentRow).join('') : '<tr><td colspan="5" class="empty">Sin datos en el período</td></tr>';
  document.getElementById('rent-ch-tb').innerHTML = d.rent_chofer.length
    ? d.rent_chofer.map(rentRow).join('') : '<tr><td colspan="5" class="empty">Sin datos en el período</td></tr>';
}

// ---------- DESCUENTOS ----------
function descRow(a) {
  return '<tr><td>' + a.grupo + '</td><td>$' + F(a.venta_sin_desc) + '</td><td>$' + F(a.descuento) + '</td>' +
    '<td><span class="' + pctClass(a.pct_descuento) + '">' + P(a.pct_descuento) + '</span></td></tr>';
}
function renderDescuentos() {
  var d = curData();
  var totDesc = d.desc_prov.reduce(function (s, a) { return s + a.descuento; }, 0);
  var totSinDesc = d.desc_prov.reduce(function (s, a) { return s + a.venta_sin_desc; }, 0);
  document.getElementById('desc-kpis').innerHTML =
    KPI('Venta sin Dto.', '$' + F(totSinDesc), '#e3ecf7') +
    KPI('Descuento', '$' + F(totDesc), '#ffab40') +
    KPI('% Descuento', P(totSinDesc ? totDesc / totSinDesc * 100 : 0), '#ffab40');

  document.getElementById('desc-prov-tb').innerHTML = d.desc_prov.length
    ? d.desc_prov.map(descRow).join('') : '<tr><td colspan="4" class="empty">Sin datos en el período</td></tr>';
  document.getElementById('desc-ch-tb').innerHTML = d.desc_chofer.length
    ? d.desc_chofer.map(descRow).join('') : '<tr><td colspan="4" class="empty">Sin datos en el período</td></tr>';
}

// ---------- GEOGRAFIA ----------
function renderGeografia() {
  var d = curData();
  document.getElementById('geo-tb').innerHTML = d.geo.length ? d.geo.map(function (g) {
    return '<tr><td>' + g.localidad + '</td><td>$' + F(g.venta) + '</td><td>$' + F(g.rechazo) + '</td>' +
      '<td><span class="' + pctClass(g.pct_rechazo) + '">' + P(g.pct_rechazo) + '</span></td>' +
      '<td>$' + F(g.cambio) + '</td><td>' + FI(g.clientes) + '</td></tr>';
  }).join('') : '<tr><td colspan="6" class="empty">Sin datos en el período</td></tr>';
}

// ---------- OBJETIVO DEL MES ----------
function renderObjetivo() {
  var d = curData();
  var totObj = d.vendedor.reduce(function (s, a) { return s + a.objetivo; }, 0);
  var totVenta = d.vendedor.reduce(function (s, a) { return s + a.venta; }, 0);
  document.getElementById('obj-kpis').innerHTML =
    KPI('Objetivo', '$' + F(totObj), '#e3ecf7') +
    KPI('Venta', '$' + F(totVenta), '#00e5ff') +
    KPI('% Cumplimiento', P(totObj ? totVenta / totObj * 100 : 0), totVenta >= totObj ? '#69f0ae' : '#ffab40');

  document.getElementById('obj-tb').innerHTML = d.vendedor.length ? d.vendedor.map(function (v) {
    return '<tr><td>' + v.vendedor + '</td><td>$' + F(v.objetivo) + '</td><td>$' + F(v.venta) + '</td>' +
      '<td><div class="pw"><div class="pb"><div class="pf" style="width:' + Math.min(v.pct_cumplimiento, 100) + '%;background:' + (v.pct_cumplimiento >= 100 ? '#69f0ae' : '#ffab40') + '"></div></div>' + P(v.pct_cumplimiento) + '</div></td>' +
      '<td>$' + F(v.rechazo) + '</td><td>$' + F(v.cambio) + '</td></tr>';
  }).join('') : '<tr><td colspan="6" class="empty">Sin objetivo cargado para este período</td></tr>';
}

// ---------- EVOLUCION MENSUAL ----------
function renderEvolucion() {
  document.getElementById('evo-tb').innerHTML = D_EVOLUCION.length ? D_EVOLUCION.map(function (e) {
    return '<tr><td>' + e.mes_label + '</td><td>$' + F(e.venta) + '</td><td>$' + F(e.rechazo) + '</td>' +
      '<td><span class="' + pctClass(e.pct_rechazo) + '">' + P(e.pct_rechazo) + '</span></td>' +
      '<td>$' + F(e.rentabilidad) + '</td><td>' + P(e.pct_rentabilidad) + '</td></tr>';
  }).join('') : '<tr><td colspan="6" class="empty">Sin datos</td></tr>';
}

// ---------- EVOLUCION INTERANUAL ----------
function interVarCls(v) { return (v === null || v === undefined) ? '' : (v < 0 ? 'br' : (v > 0 ? 'bg' : 'by')); }
function interVarTxt(v) { return (v === null || v === undefined) ? 's/d' : ((v >= 0 ? '+' : '') + v.toFixed(1) + '%'); }
function interFila(r) {
  return '<tr><td>' + r.proveedor + '</td>' +
    '<td>' + FI(r.unidades_actual) + '</td><td>' + FI(r.unidades_anterior) + '</td>' +
    '<td><span class="' + interVarCls(r.var_unidades) + '">' + interVarTxt(r.var_unidades) + '</span></td>' +
    '<td>' + FI(r.peso_actual) + '</td><td>' + FI(r.peso_anterior) + '</td>' +
    '<td><span class="' + interVarCls(r.var_peso) + '">' + interVarTxt(r.var_peso) + '</span></td>' +
    '<td>$' + F(r.venta_actual) + '</td><td>$' + F(r.venta_anterior) + '</td>' +
    '<td><span class="' + interVarCls(r.var_venta) + '">' + interVarTxt(r.var_venta) + '</span></td></tr>';
}
function interRenderTabla(tbId, periodoElId, rows, total, periodo) {
  document.getElementById(periodoElId).textContent =
    (periodo && periodo.actual) ? ('(' + periodo.actual + ' vs ' + periodo.anterior + ')') : '';
  var html = (rows && rows.length) ? rows.map(interFila).join('') : '<tr><td colspan="10" class="empty">Sin datos</td></tr>';
  if (rows && rows.length && total) {
    html += interFila(total).replace('<tr>', '<tr style="font-weight:700;border-top:2px solid #1c2e47">');
  }
  document.getElementById(tbId).innerHTML = html;
}
function renderInteranual() {
  interRenderTabla('inter-mes-tb', 'inter-mes-periodo', D_INTERANUAL_MES, D_INTERANUAL_MES_TOTAL, D_INTERANUAL_MES_PERIODO);
  interRenderTabla('inter-tb', 'inter-periodo', D_INTERANUAL, D_INTERANUAL_TOTAL, D_INTERANUAL_PERIODO);
}
function dlInteranual() {
  var rows = (D_INTERANUAL || []).concat(D_INTERANUAL_TOTAL ? [D_INTERANUAL_TOTAL] : []);
  dl(rows, 'pyp_evolucion_interanual_acumulado.xlsx');
}
function dlInteranualMes() {
  var rows = (D_INTERANUAL_MES || []).concat(D_INTERANUAL_MES_TOTAL ? [D_INTERANUAL_MES_TOTAL] : []);
  dl(rows, 'pyp_evolucion_interanual_mes.xlsx');
}

// ---------- CLIENTES (tendencia) ----------
function renderClientes() {
  var d = curData();
  document.getElementById('cli-tend-tb').innerHTML = d.clientes.length ? d.clientes.map(function (c) {
    var cls = c.variacion < 0 ? 'br' : (c.variacion > 0 ? 'bg' : 'by');
    return '<tr><td>' + (c.razon_social || c.cliente_id) + '</td><td>$' + F(c.venta) + '</td><td>$' + F(c.venta_mes_anterior) + '</td>' +
      '<td><span class="' + cls + '">$' + F(c.variacion) + '</span></td><td>' + P(c.pct_variacion) + '</td></tr>';
  }).join('') : '<tr><td colspan="5" class="empty">Sin datos comparables (falta mes anterior)</td></tr>';
}

// ---------- POR PRODUCTO ----------
function renderProducto() {
  var d = curData();
  document.getElementById('prod-tb').innerHTML = d.producto.length ? d.producto.map(function (p) {
    return '<tr><td>' + p.producto + '</td><td>$' + F(p.venta) + '</td><td>' + FI(p.unidades) + '</td></tr>';
  }).join('') : '<tr><td colspan="3" class="empty">Sin datos en el período</td></tr>';
  document.getElementById('rubro-tb').innerHTML = d.rubro.length ? d.rubro.map(function (r) {
    return '<tr><td>' + r.rubro + '</td><td>$' + F(r.venta) + '</td><td>' + FI(r.unidades) + '</td></tr>';
  }).join('') : '<tr><td colspan="3" class="empty">Sin datos en el período</td></tr>';
}

// ---------- EXPORT EXCEL ----------
function dl(rows, filename) {
  var ws = XLSX.utils.json_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, filename);
}
function dlProv() { dl(VEN_TB_ACTUAL.prov, 'pyp_ventas_por_proveedor_' + MES_ACTIVO + '.xlsx'); }
function dlChofer() {
  var prov = document.getElementById('ven-prov-f').value;
  dl(VEN_TB_ACTUAL.chofer, 'pyp_ventas_por_chofer_' + (prov ? prov.replace(/[^a-z0-9]+/gi, '_') + '_' : '') + MES_ACTIVO + '.xlsx');
}
function dlMotivo() { dl(curData().motivo, 'pyp_rechazos_por_motivo_' + MES_ACTIVO + '.xlsx'); }
function dlProvRech() { dl(curData().prov, 'pyp_rechazos_por_proveedor_' + MES_ACTIVO + '.xlsx'); }
function dlCamion() { dl(VEN_TB_ACTUAL.camion, 'pyp_ventas_por_camion_' + MES_ACTIVO + '.xlsx'); }
function dlRentProv() { dl(curData().rent_prov, 'pyp_rentabilidad_por_proveedor_' + MES_ACTIVO + '.xlsx'); }
function dlRentChofer() { dl(curData().rent_chofer, 'pyp_rentabilidad_por_chofer_' + MES_ACTIVO + '.xlsx'); }
function dlDescProv() { dl(curData().desc_prov, 'pyp_descuentos_por_proveedor_' + MES_ACTIVO + '.xlsx'); }
function dlDescChofer() { dl(curData().desc_chofer, 'pyp_descuentos_por_chofer_' + MES_ACTIVO + '.xlsx'); }
function dlGeo() { dl(curData().geo, 'pyp_geografia_' + MES_ACTIVO + '.xlsx'); }
function dlObjetivo() { dl(curData().vendedor, 'pyp_objetivo_' + MES_ACTIVO + '.xlsx'); }
function dlEvolucion() { dl(D_EVOLUCION, 'pyp_evolucion_mensual.xlsx'); }
function dlClientes() { dl(curData().clientes, 'pyp_clientes_tendencia_' + MES_ACTIVO + '.xlsx'); }
function dlProducto() { dl(curData().producto, 'pyp_por_producto_' + MES_ACTIVO + '.xlsx'); }
function dlRubro() { dl(curData().rubro, 'pyp_por_rubro_' + MES_ACTIVO + '.xlsx'); }
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
  var saved = sessionStorage.getItem('pyp_auth');
  if (saved === 'sup') {
    ROLE = 'sup'; VEND_COD = null;
    entrar();
  } else if (saved && saved.indexOf('vendedor:') === 0) {
    ROLE = 'vendedor'; VEND_COD = saved.split(':')[1];
    entrar();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(function () {});
  }
});
