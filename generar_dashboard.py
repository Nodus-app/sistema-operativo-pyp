#!/usr/bin/env python3
"""
generar_dashboard.py - PYP Logistica Dashboard Operativo
Consulta directo la base BI de GesCom (Postgres) y regenera index.html.
Credenciales por variables de entorno: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PGTENANT.
"""
import json, os, sys, math
from datetime import datetime, timedelta, timezone
import psycopg2
import psycopg2.extras

print("=" * 60)
print("PYP Logistica - Generador Dashboard Operativo")
print("=" * 60)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TENANT_ID = int(os.environ.get("PGTENANT", "9"))

MES_NOMBRE = {1:'Enero',2:'Febrero',3:'Marzo',4:'Abril',5:'Mayo',6:'Junio',
              7:'Julio',8:'Agosto',9:'Septiembre',10:'Octubre',11:'Noviembre',12:'Diciembre'}


def sf(v, d=0.0):
    try:
        if v is None:
            return d
        f = float(v)
        return d if math.isnan(f) else f
    except Exception:
        return d


def si(v, d=0):
    try:
        return d if v is None else int(v)
    except Exception:
        return d


def connect():
    return psycopg2.connect(
        host=os.environ["PGHOST"],
        port=int(os.environ.get("PGPORT", "5432")),
        dbname=os.environ["PGDATABASE"],
        user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        connect_timeout=15,
    )


MESES_HISTORIAL = int(os.environ.get("MESES_HISTORIAL", "12"))


def rango_historial():
    """Desde el primer dia del mes que quedo MESES_HISTORIAL atras, hasta hoy."""
    hoy = datetime.now(timezone.utc).replace(tzinfo=None)
    mes_inicio = hoy.month - (MESES_HISTORIAL - 1)
    anio_inicio = hoy.year + (mes_inicio - 1) // 12
    mes_inicio = (mes_inicio - 1) % 12 + 1
    desde = hoy.replace(year=anio_inicio, month=mes_inicio, day=1, hour=0, minute=0, second=0, microsecond=0)
    hasta = hoy + timedelta(days=1)
    return desde, hasta, hoy


def mes_key(fecha):
    return f"{fecha.year:04d}-{fecha.month:02d}"


def make_json(var_name, data):
    return f"var {var_name}={json.dumps(data, ensure_ascii=True, separators=(',', ':'), default=str)};"


# Solo documentos que representan movimiento de $ real (se excluyen remitos REME/REMI, sin importe,
# y notas de debito NDB, poco frecuentes y no ligadas a rechazos/cambios).
TIPOS_VALIDOS = ('FAC-A', 'FAC-B', 'NCR-A', 'NCR-B')


def fetch_ordenes(cur, desde, hasta):
    cur.execute(
        """
        SELECT v.id, v.reparto_id, v.reparto_codigo,
               v.empleado_chofer_id, v.empleado_chofer_nombre,
               v.vehiculo_id, v.vehiculo_codigo, v.vehiculo_descripcion,
               v.cliente_id, v.razon_social,
               ch.direccion, ch.localidad,
               v.fecha_comprobante, v.numero_comprobante, v.tipo_comprobante_codigo,
               v.motivo_rechazo_codigo, v.motivo_rechazo_desc,
               v.motivo_cambio_codigo, v.motivo_cambio_desc,
               v.importe_total, v.importe_neto,
               v.vendedor_codigo, v.vendedor_nombre
        FROM venta v
        LEFT JOIN cliente_hist ch ON ch.hist_id = v.cliente_hist_id AND ch.tenant_id = v.tenant_id
        WHERE v.tenant_id = %(tenant)s
          AND v.fecha_comprobante >= %(desde)s AND v.fecha_comprobante < %(hasta)s
          AND v.tipo_comprobante_codigo IN %(tipos)s
        ORDER BY v.fecha_comprobante
        """,
        {"tenant": TENANT_ID, "desde": desde, "hasta": hasta, "tipos": TIPOS_VALIDOS},
    )
    return cur.fetchall()


def fetch_items(cur, desde, hasta):
    cur.execute(
        """
        SELECT v.id AS venta_id, v.reparto_id, v.empleado_chofer_nombre,
               v.tipo_comprobante_codigo, v.motivo_cambio_codigo,
               v.motivo_rechazo_desc, v.fecha_comprobante,
               v.vendedor_codigo, v.vendedor_nombre,
               i.prov_razonsocial, i.prov_codigo,
               vi.importe_total_c_imp, vi.cantidad, vi.unidades
        FROM venta v
        JOIN venta_item vi ON vi.venta_id = v.id AND vi.tenant_id = v.tenant_id
        LEFT JOIN item i ON i.codigo = vi.item_codigo AND i.tenant_id = v.tenant_id
        WHERE v.tenant_id = %(tenant)s
          AND v.fecha_comprobante >= %(desde)s AND v.fecha_comprobante < %(hasta)s
          AND v.tipo_comprobante_codigo IN %(tipos)s
        """,
        {"tenant": TENANT_ID, "desde": desde, "hasta": hasta, "tipos": TIPOS_VALIDOS},
    )
    return cur.fetchall()


def es_devolucion(row):
    return (row.get("tipo_comprobante_codigo") or "").startswith("NCR")


def es_cambio(row):
    return es_devolucion(row) and row.get("motivo_cambio_codigo") is not None


def es_rechazo_puro(row):
    return es_devolucion(row) and not es_cambio(row)


def build_kpis(ordenes):
    venta_neta = sum(sf(o["importe_total"]) for o in ordenes if not es_devolucion(o))
    rechazo = sum(sf(o["importe_total"]) for o in ordenes if es_rechazo_puro(o))
    cambio = sum(sf(o["importe_total"]) for o in ordenes if es_cambio(o))
    bruta = venta_neta + rechazo + cambio
    comprobantes = len(ordenes)
    clientes = len({o["cliente_id"] for o in ordenes if o["cliente_id"] is not None})
    choferes = len({o["empleado_chofer_id"] for o in ordenes if o["empleado_chofer_id"] is not None})
    repartos = len({o["reparto_id"] for o in ordenes if o["reparto_id"] is not None})
    rechazados = sum(1 for o in ordenes if es_rechazo_puro(o))
    cambios_cant = sum(1 for o in ordenes if es_cambio(o))
    return {
        "venta_neta": round(venta_neta, 2),
        "rechazo_monto": round(rechazo, 2),
        "cambio_monto": round(cambio, 2),
        "pct_rechazo": round((rechazo / bruta * 100) if bruta else 0, 2),
        "pct_cambio": round((cambio / bruta * 100) if bruta else 0, 2),
        "comprobantes": comprobantes,
        "rechazados": rechazados,
        "cambios_cant": cambios_cant,
        "clientes": clientes,
        "choferes": choferes,
        "repartos": repartos,
    }


def build_prov(items):
    agg = {}
    for it in items:
        prov = it["prov_razonsocial"] or "Sin proveedor"
        a = agg.setdefault(prov, {"proveedor": prov, "venta": 0.0, "rechazo": 0.0, "cambio": 0.0, "unidades": 0})
        # a nivel de linea el signo no es confiable (puede venir negativo tanto en
        # facturas como en notas de credito); el total de cabecera si es siempre positivo.
        monto = abs(sf(it["importe_total_c_imp"]))
        if es_rechazo_puro(it):
            a["rechazo"] += monto
        elif es_cambio(it):
            a["cambio"] += monto
        elif not es_devolucion(it):
            a["venta"] += monto
        a["unidades"] += si(sf(it["cantidad"]))
    out = list(agg.values())
    for a in out:
        bruta = a["venta"] + a["rechazo"] + a["cambio"]
        a["pct_rechazo"] = round((a["rechazo"] / bruta * 100) if bruta else 0, 2)
        a["pct_cambio"] = round((a["cambio"] / bruta * 100) if bruta else 0, 2)
        a["venta"] = round(a["venta"], 2)
        a["rechazo"] = round(a["rechazo"], 2)
        a["cambio"] = round(a["cambio"], 2)
    out.sort(key=lambda a: -a["venta"])
    return out


def build_chofer(ordenes):
    agg = {}
    for o in ordenes:
        ch = o["empleado_chofer_nombre"] or "Sin asignar"
        a = agg.setdefault(ch, {"chofer": ch, "venta": 0.0, "rechazo": 0.0, "cambio": 0.0, "entregas": 0, "rechazos": 0, "cambios": 0})
        monto = sf(o["importe_total"])
        if es_rechazo_puro(o):
            a["rechazo"] += monto
            a["rechazos"] += 1
        elif es_cambio(o):
            a["cambio"] += monto
            a["cambios"] += 1
        elif not es_devolucion(o):
            a["venta"] += monto
            a["entregas"] += 1
    out = list(agg.values())
    for a in out:
        total = a["entregas"] + a["rechazos"] + a["cambios"]
        bruta = a["venta"] + a["rechazo"] + a["cambio"]
        a["pct_rechazo"] = round((a["rechazo"] / bruta * 100) if bruta else 0, 2)
        a["pct_cambio"] = round((a["cambio"] / bruta * 100) if bruta else 0, 2)
        a["efectividad"] = round((a["entregas"] / total * 100) if total else 0, 2)
        a["venta"] = round(a["venta"], 2)
        a["rechazo"] = round(a["rechazo"], 2)
        a["cambio"] = round(a["cambio"], 2)
    out.sort(key=lambda a: -a["venta"])
    return out


def build_camion(ordenes):
    agg = {}
    for o in ordenes:
        cam = o["vehiculo_descripcion"] or o["vehiculo_codigo"] or "Sin asignar"
        a = agg.setdefault(cam, {"camion": cam, "venta": 0.0, "rechazo": 0.0, "cambio": 0.0, "entregas": 0, "rechazos": 0, "cambios": 0})
        monto = sf(o["importe_total"])
        if es_rechazo_puro(o):
            a["rechazo"] += monto
            a["rechazos"] += 1
        elif es_cambio(o):
            a["cambio"] += monto
            a["cambios"] += 1
        elif not es_devolucion(o):
            a["venta"] += monto
            a["entregas"] += 1
    out = list(agg.values())
    for a in out:
        total = a["entregas"] + a["rechazos"] + a["cambios"]
        bruta = a["venta"] + a["rechazo"] + a["cambio"]
        a["pct_rechazo"] = round((a["rechazo"] / bruta * 100) if bruta else 0, 2)
        a["pct_cambio"] = round((a["cambio"] / bruta * 100) if bruta else 0, 2)
        a["efectividad"] = round((a["entregas"] / total * 100) if total else 0, 2)
        a["venta"] = round(a["venta"], 2)
        a["rechazo"] = round(a["rechazo"], 2)
        a["cambio"] = round(a["cambio"], 2)
    out.sort(key=lambda a: -a["venta"])
    return out


def build_motivo(ordenes):
    agg = {}
    for o in ordenes:
        if not es_rechazo_puro(o):
            continue
        motivo = o["motivo_rechazo_desc"] or "Sin especificar"
        a = agg.setdefault(motivo, {"motivo": motivo, "cantidad": 0, "importe": 0.0})
        a["cantidad"] += 1
        a["importe"] += sf(o["importe_total"])
    total = sum(a["importe"] for a in agg.values()) or 1
    out = list(agg.values())
    for a in out:
        a["pct"] = round(a["importe"] / total * 100, 2)
        a["importe"] = round(a["importe"], 2)
    out.sort(key=lambda a: -a["importe"])
    return out


def build_motivo_por_prov(items):
    """Motivo de rechazo desglosado por proveedor, para el filtro de la pestana Rechazos."""
    by_prov = {}
    for it in items:
        if not es_rechazo_puro(it):
            continue
        prov = it["prov_razonsocial"] or "Sin proveedor"
        motivo = it["motivo_rechazo_desc"] or "Sin especificar"
        agg = by_prov.setdefault(prov, {})
        a = agg.setdefault(motivo, {"motivo": motivo, "cantidad": 0, "importe": 0.0})
        a["cantidad"] += 1
        a["importe"] += abs(sf(it["importe_total_c_imp"]))
    out = {}
    for prov, agg in by_prov.items():
        total = sum(a["importe"] for a in agg.values()) or 1
        rows = list(agg.values())
        for a in rows:
            a["pct"] = round(a["importe"] / total * 100, 2)
            a["importe"] = round(a["importe"], 2)
        rows.sort(key=lambda a: -a["importe"])
        out[prov] = rows
    return out


def build_chofer_por_prov(items):
    """Venta/rechazo/cambio por chofer desglosado por proveedor.
    Se usa para el filtro de proveedor tanto en Ventas como en Rechazos."""
    by_prov = {}
    for it in items:
        prov = it["prov_razonsocial"] or "Sin proveedor"
        ch = it["empleado_chofer_nombre"] or "Sin asignar"
        agg = by_prov.setdefault(prov, {})
        a = agg.setdefault(ch, {"chofer": ch, "venta": 0.0, "rechazo": 0.0, "cambio": 0.0})
        monto = abs(sf(it["importe_total_c_imp"]))
        if es_rechazo_puro(it):
            a["rechazo"] += monto
        elif es_cambio(it):
            a["cambio"] += monto
        elif not es_devolucion(it):
            a["venta"] += monto
    out = {}
    for prov, agg in by_prov.items():
        rows = list(agg.values())
        for a in rows:
            bruta = a["venta"] + a["rechazo"] + a["cambio"]
            a["pct_rechazo"] = round((a["rechazo"] / bruta * 100) if bruta else 0, 2)
            a["pct_cambio"] = round((a["cambio"] / bruta * 100) if bruta else 0, 2)
            # aproximacion $-ponderada de efectividad (no hay conteo de comprobantes a nivel de linea)
            a["efectividad"] = round((a["venta"] / bruta * 100) if bruta else 0, 2)
            a["venta"] = round(a["venta"], 2)
            a["rechazo"] = round(a["rechazo"], 2)
            a["cambio"] = round(a["cambio"], 2)
        rows.sort(key=lambda a: -a["venta"])
        out[prov] = rows
    return out


def build_routes_and_clientes(ordenes, items):
    prov_por_reparto = {}
    for it in items:
        rid = it["reparto_id"]
        if rid is None:
            continue
        prov = it["prov_razonsocial"] or "Sin proveedor"
        d = prov_por_reparto.setdefault(rid, {})
        d[prov] = d.get(prov, 0.0) + abs(sf(it["importe_total_c_imp"]))

    reparto_agg = {}
    clientes = {}
    for o in ordenes:
        rid = o["reparto_id"]
        if rid is None:
            continue
        r = reparto_agg.setdefault(rid, {
            "reparto_id": rid,
            "reparto_codigo": o["reparto_codigo"],
            "fecha": o["fecha_comprobante"].strftime("%Y-%m-%d") if o["fecha_comprobante"] else None,
            "chofer": o["empleado_chofer_nombre"] or "Sin asignar",
            "vehiculo": o["vehiculo_descripcion"] or o["vehiculo_codigo"] or "",
            "total": 0.0, "rechazado": 0.0, "clientes": 0,
        })
        r["total"] += sf(o["importe_total"])
        if es_rechazo_puro(o):
            r["rechazado"] += sf(o["importe_total"])
        r["clientes"] += 1

        flag = 3 if es_cambio(o) else (1 if es_rechazo_puro(o) else 0)
        clientes.setdefault(str(rid), []).append([
            o["cliente_id"], o["razon_social"], o["direccion"], o["localidad"],
            o["numero_comprobante"], round(sf(o["importe_total"]), 2), flag,
        ])

    routes = list(reparto_agg.values())
    for r in routes:
        top = sorted(prov_por_reparto.get(r["reparto_id"], {}).items(), key=lambda kv: -kv[1])[:3]
        r["top_prov"] = [{"proveedor": p, "importe": round(v, 2)} for p, v in top]
        bruta = r["total"]
        r["pct_rechazo"] = round((r["rechazado"] / bruta * 100) if bruta else 0, 2)
        r["total"] = round(r["total"], 2)
        r["rechazado"] = round(r["rechazado"], 2)
    routes.sort(key=lambda r: (r["fecha"] or "", r["chofer"]))
    return routes, clientes


def inject_data(html, data_js):
    start_marker = "<script><!-- DATA_START -->"
    end_marker = "<!-- DATA_END --></script>"
    start = html.find(start_marker)
    end = html.find(end_marker)
    if start == -1 or end == -1:
        raise RuntimeError("No se encontraron los marcadores DATA_START/DATA_END en index.html")
    start += len(start_marker)
    return html[:start] + "\n" + data_js + "\n" + html[end:]


def build_mes(ordenes, items):
    kpis = build_kpis(ordenes)
    d_prov = build_prov(items)
    d_chofer = build_chofer(ordenes)
    d_camion = build_camion(ordenes)
    d_motivo = build_motivo(ordenes)
    d_motivo_prov = build_motivo_por_prov(items)
    d_chofer_prov = build_chofer_por_prov(items)
    d_routes, d_cli = build_routes_and_clientes(ordenes, items)
    return {
        "kpis": kpis,
        "prov": d_prov,
        "chofer": d_chofer,
        "camion": d_camion,
        "motivo": d_motivo,
        "motivo_prov": d_motivo_prov,
        "chofer_prov": d_chofer_prov,
        "routes": d_routes,
        "cli": d_cli,
        "provs": [p["proveedor"] for p in d_prov],
        "chs": [c["chofer"] for c in d_chofer],
        "camiones": [c["camion"] for c in d_camion],
    }


def main():
    desde, hasta, ahora = rango_historial()
    print(f"Rango: {desde.date()} a {hasta.date()} ({MESES_HISTORIAL} meses)")

    conn = connect()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        ordenes = fetch_ordenes(cur, desde, hasta)
        items = fetch_items(cur, desde, hasta)
    finally:
        conn.close()

    print(f"Ordenes: {len(ordenes)} | Lineas: {len(items)}")

    ordenes_por_mes = {}
    for o in ordenes:
        ordenes_por_mes.setdefault(mes_key(o["fecha_comprobante"]), []).append(o)
    items_por_mes = {}
    for it in items:
        items_por_mes.setdefault(mes_key(it["fecha_comprobante"]), []).append(it)

    meses = sorted(set(ordenes_por_mes) | set(items_por_mes), reverse=True)
    d_data = {}
    d_mes_label = {}
    for m in meses:
        anio, mes_num = m.split("-")
        d_mes_label[m] = f"{MES_NOMBRE[int(mes_num)]} {anio}"
        d_data[m] = build_mes(ordenes_por_mes.get(m, []), items_por_mes.get(m, []))
        print(f"  {m}: {len(ordenes_por_mes.get(m, []))} ordenes, {len(items_por_mes.get(m, []))} lineas")

    mes_actual = meses[0] if meses else mes_key(ahora)

    # ---- datos por vendedor (login individual) ----
    vnom = {}
    for o in ordenes:
        cod = o["vendedor_codigo"]
        if cod:
            vnom[str(cod)] = o["vendedor_nombre"] or ("Vendedor " + str(cod))
    vvalidos = sorted(vnom.keys(), key=lambda c: (len(c), c))
    print(f"Vendedores activos: {vvalidos}")

    d_vend_data = {}
    for cod in vvalidos:
        ord_v = [o for o in ordenes if str(o["vendedor_codigo"]) == cod]
        it_v = [it for it in items if str(it["vendedor_codigo"]) == cod]
        ord_v_por_mes = {}
        for o in ord_v:
            ord_v_por_mes.setdefault(mes_key(o["fecha_comprobante"]), []).append(o)
        it_v_por_mes = {}
        for it in it_v:
            it_v_por_mes.setdefault(mes_key(it["fecha_comprobante"]), []).append(it)
        meses_v = sorted(set(ord_v_por_mes) | set(it_v_por_mes), reverse=True)
        d_vend_data[cod] = {
            m: build_mes(ord_v_por_mes.get(m, []), it_v_por_mes.get(m, []))
            for m in meses_v
        }

    blocks = [
        make_json("D_MESES", meses),
        make_json("D_MES_LABEL", d_mes_label),
        make_json("D_MES_ACTUAL", mes_actual),
        make_json("D_DATA", d_data),
        make_json("D_VVALIDOS", vvalidos),
        make_json("D_VNOM", vnom),
        make_json("D_VEND_DATA", d_vend_data),
    ]
    data_js = "\n".join(blocks)

    html_path = os.path.join(BASE_DIR, "index.html")
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    html = inject_data(html, data_js)
    html = html.replace(
        'id="hdr-build-ts"></span>',
        f'id="hdr-build-ts">{ahora.strftime("%d/%m/%Y %H:%M")}</span>',
    )

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    print("index.html actualizado correctamente.")


if __name__ == "__main__":
    main()
