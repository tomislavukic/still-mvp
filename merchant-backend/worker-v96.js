import app from './worker-v95.js';

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const uid = prefix => `${prefix}${crypto.randomUUID().replaceAll('-', '')}`;
const publicId = prefix => `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
const clean = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const safeDate = value => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10)) ? clean(value, 10) : null;
const whole = (value, max = 100000000) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Math.round(Number(value)))) : 0;
const signedWhole = (value, max = 100000000) => Number.isFinite(Number(value)) ? Math.max(-max, Math.min(max, Math.round(Number(value)))) : 0;
const cents = value => whole(value, 1000000000);
let schemaReady;

async function sha(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function cookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

const schema = [
  `CREATE TABLE IF NOT EXISTS ops_locations(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,name TEXT NOT NULL,code TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(organization_id,code))`,
  `CREATE TABLE IF NOT EXISTS ops_products(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,sku TEXT NOT NULL,barcode TEXT, name TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'product',unit TEXT NOT NULL DEFAULT 'pcs',reorder_level INTEGER NOT NULL DEFAULT 0,cost_cents INTEGER NOT NULL DEFAULT 0,price_cents INTEGER NOT NULL DEFAULT 0,warranty_months INTEGER NOT NULL DEFAULT 0,tracked_by TEXT NOT NULL DEFAULT 'quantity',active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(organization_id,sku),UNIQUE(organization_id,barcode))`,
  `CREATE TABLE IF NOT EXISTS ops_stock_balances(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,product_id TEXT NOT NULL,location_id TEXT NOT NULL,quantity INTEGER NOT NULL DEFAULT 0,reserved INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,UNIQUE(product_id,location_id))`,
  `CREATE TABLE IF NOT EXISTS ops_stock_lots(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,product_id TEXT NOT NULL,location_id TEXT NOT NULL,batch_no TEXT,serial_no TEXT,expires_on TEXT,quantity INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'available',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(organization_id,serial_no))`,
  `CREATE TABLE IF NOT EXISTS ops_stock_movements(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,product_id TEXT NOT NULL,location_id TEXT NOT NULL,lot_id TEXT,quantity_delta INTEGER NOT NULL,reason TEXT NOT NULL,reference_type TEXT,reference_id TEXT,actor_member_id TEXT NOT NULL,created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_product_parts(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,parent_product_id TEXT NOT NULL,part_product_id TEXT NOT NULL,quantity_required INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,UNIQUE(parent_product_id,part_product_id))`,
  `CREATE TABLE IF NOT EXISTS ops_suppliers(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,name TEXT NOT NULL,email TEXT,phone TEXT,lead_days INTEGER NOT NULL DEFAULT 0,min_order_cents INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_purchase_orders(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,supplier_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ordered',expected_on TEXT,received_on TEXT,notes TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_purchase_order_items(id TEXT PRIMARY KEY,purchase_order_id TEXT NOT NULL,product_id TEXT NOT NULL,location_id TEXT NOT NULL,quantity_ordered INTEGER NOT NULL,quantity_received INTEGER NOT NULL DEFAULT 0,unit_cost_cents INTEGER NOT NULL DEFAULT 0,batch_no TEXT,expires_on TEXT)`,
  `CREATE TABLE IF NOT EXISTS ops_passport_inventory(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,passport_id TEXT NOT NULL,product_id TEXT NOT NULL,lot_id TEXT,quantity INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'assigned',assigned_by_member_id TEXT NOT NULL,assigned_at TEXT NOT NULL,UNIQUE(passport_id,product_id,lot_id))`,
  `CREATE TABLE IF NOT EXISTS ops_repair_jobs(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,passport_id TEXT,product_id TEXT,subject TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'received',priority TEXT NOT NULL DEFAULT 'normal',diagnosis TEXT,estimate_cents INTEGER NOT NULL DEFAULT 0,actual_cost_cents INTEGER NOT NULL DEFAULT 0,scheduled_on TEXT,completed_on TEXT,technician_member_id TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_repair_parts(id TEXT PRIMARY KEY,repair_job_id TEXT NOT NULL,product_id TEXT NOT NULL,location_id TEXT NOT NULL,quantity INTEGER NOT NULL,unit_cost_cents INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_rmas(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,passport_id TEXT,product_id TEXT,lot_id TEXT,status TEXT NOT NULL DEFAULT 'requested',reason TEXT NOT NULL,condition_grade TEXT,disposition TEXT,refund_cents INTEGER NOT NULL DEFAULT 0,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_reservations(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,product_id TEXT NOT NULL,location_id TEXT NOT NULL,passport_id TEXT,order_reference TEXT,quantity INTEGER NOT NULL,fulfillment_method TEXT,tracking_number TEXT,status TEXT NOT NULL DEFAULT 'reserved',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_agreements(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,agreement_type TEXT NOT NULL,passport_id TEXT,product_id TEXT,title TEXT NOT NULL,customer_label TEXT,start_on TEXT,end_on TEXT,renewal_on TEXT,quantity INTEGER NOT NULL DEFAULT 1,recurring_cents INTEGER NOT NULL DEFAULT 0,deposit_cents INTEGER NOT NULL DEFAULT 0,usage_limit INTEGER,condition_notes TEXT,status TEXT NOT NULL DEFAULT 'active',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_staff(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,name TEXT NOT NULL,email TEXT,skills TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_appointments(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,staff_id TEXT,passport_id TEXT,repair_job_id TEXT,title TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,location_text TEXT,status TEXT NOT NULL DEFAULT 'scheduled',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_crm_contacts(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,name TEXT NOT NULL,email TEXT,phone TEXT,company_name TEXT,stage TEXT NOT NULL DEFAULT 'lead',last_contact_at TEXT,notes TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_quotes(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,contact_id TEXT,title TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',valid_until TEXT,currency TEXT NOT NULL DEFAULT 'EUR',total_cents INTEGER NOT NULL DEFAULT 0,terms TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_quote_items(id TEXT PRIMARY KEY,quote_id TEXT NOT NULL,product_id TEXT,description TEXT NOT NULL,quantity INTEGER NOT NULL,unit_price_cents INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_recall_campaigns(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,product_id TEXT NOT NULL,batch_no TEXT,serial_no TEXT,severity TEXT NOT NULL DEFAULT 'critical',title TEXT NOT NULL,detail TEXT NOT NULL,action_url TEXT,status TEXT NOT NULL DEFAULT 'active',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_recall_deliveries(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,campaign_id TEXT NOT NULL,passport_id TEXT NOT NULL,alert_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'delivered',delivered_at TEXT NOT NULL,acknowledged_at TEXT,completed_at TEXT,UNIQUE(campaign_id,passport_id))`,
  `CREATE TABLE IF NOT EXISTS ops_audit_log(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,member_id TEXT NOT NULL,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,details_json TEXT,created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ops_idempotency(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,key_hash TEXT NOT NULL,response_body TEXT NOT NULL,response_status INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(organization_id,key_hash))`,
  `CREATE TABLE IF NOT EXISTS passport_alerts(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,passport_id TEXT NOT NULL,organization_id TEXT NOT NULL,severity TEXT NOT NULL,title TEXT NOT NULL,detail TEXT NOT NULL,action_url TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS passport_service_events(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,passport_id TEXT NOT NULL,organization_id TEXT NOT NULL,buyer_account_id TEXT,event_type TEXT NOT NULL,title TEXT NOT NULL,provider_name TEXT,occurred_on TEXT NOT NULL,cost_cents INTEGER,notes TEXT,is_public INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_products_org ON ops_products(organization_id,active,name)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_balance_org ON ops_stock_balances(organization_id,product_id,location_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_lots_product ON ops_stock_lots(product_id,location_id,status)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_movements_product ON ops_stock_movements(product_id,created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_po_org_status ON ops_purchase_orders(organization_id,status,expected_on)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_passport_inventory_passport ON ops_passport_inventory(passport_id,status)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_repairs_org_status ON ops_repair_jobs(organization_id,status,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_rma_org_status ON ops_rmas(organization_id,status,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_reservation_order ON ops_reservations(organization_id,order_reference,status)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_agreements_org ON ops_agreements(organization_id,status,renewal_on)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_appointments_staff ON ops_appointments(staff_id,starts_at,ends_at)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_contacts_org_stage ON ops_crm_contacts(organization_id,stage,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_quotes_org_status ON ops_quotes(organization_id,status,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_recall_org ON ops_recall_campaigns(organization_id,status,created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_recall_delivery_passport ON ops_recall_deliveries(passport_id,status)`,
  `CREATE INDEX IF NOT EXISTS idx_ops_audit_org ON ops_audit_log(organization_id,created_at DESC)`,
  `DELETE FROM ops_idempotency WHERE created_at < datetime('now','-30 day')`,
  `PRAGMA optimize`
];

async function ensureSchema(env) {
  if (!schemaReady) schemaReady = env.DB.batch(schema.map(statement => env.DB.prepare(statement))).catch(error => { schemaReady = undefined; throw error; });
  await schemaReady;
}

async function companySession(request, env) {
  const raw = cookie(request, 'still_company');
  if (!raw) return null;
  return await env.DB.prepare(`SELECT m.id member_id,m.role,o.id organization_id,o.name organization_name,o.status organization_status
    FROM merchant_sessions s JOIN merchant_members m ON m.id=s.member_id JOIN merchant_organizations o ON o.id=m.organization_id
    WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'`).bind(await sha(raw), now()).first() || null;
}

async function buyerSession(request, env) {
  const raw = cookie(request, 'still_buyer');
  if (!raw) return null;
  return await env.DB.prepare(`SELECT a.id buyer_account_id FROM buyer_sessions s JOIN buyer_accounts a ON a.id=s.buyer_account_id WHERE s.token_hash=? AND s.expires_at>? AND a.status='active'`).bind(await sha(raw), now()).first() || null;
}

async function audit(env, company, action, entityType, entityId, details = {}) {
  await env.DB.prepare('INSERT INTO ops_audit_log(id,organization_id,member_id,action,entity_type,entity_id,details_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(uid('oal_'), company.organization_id, company.member_id, action, entityType, entityId, JSON.stringify(details).slice(0, 2000), now()).run();
}

async function idempotent(request, env, company, handler) {
  const key = clean(request.headers.get('idempotency-key'), 160);
  if (!key || request.method === 'GET') return handler();
  const keyHash = await sha(`${company.organization_id}:${key}`);
  const prior = await env.DB.prepare('SELECT response_body,response_status FROM ops_idempotency WHERE organization_id=? AND key_hash=?').bind(company.organization_id, keyHash).first();
  if (prior) return new Response(prior.response_body, { status: prior.response_status, headers: HEADERS });
  const response = await handler();
  if (response.status < 500) {
    const body = await response.clone().text();
    await env.DB.prepare('INSERT OR IGNORE INTO ops_idempotency(id,organization_id,key_hash,response_body,response_status,created_at) VALUES(?,?,?,?,?,?)').bind(uid('oid_'), company.organization_id, keyHash, body, response.status, now()).run();
  }
  return response;
}

async function byPublic(env, table, organizationId, id) {
  return await env.DB.prepare(`SELECT * FROM ${table} WHERE public_id=? AND organization_id=?`).bind(id, organizationId).first() || null;
}

function safeUrl(value) {
  const raw = clean(value, 500); if (!raw) return null;
  try { const url = new URL(raw); return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}

async function adjustStock(env, company, input) {
  const product = await byPublic(env, 'ops_products', company.organization_id, input.productId);
  const location = await byPublic(env, 'ops_locations', company.organization_id, input.locationId);
  const delta = signedWhole(input.quantity);
  if (!product || !location || !delta) throw Object.assign(new Error('invalid_stock_adjustment'), { status: 422 });
  const timestamp = now();
  let balance = await env.DB.prepare('SELECT * FROM ops_stock_balances WHERE product_id=? AND location_id=?').bind(product.id, location.id).first();
  if (!balance) {
    await env.DB.prepare('INSERT OR IGNORE INTO ops_stock_balances(id,organization_id,product_id,location_id,quantity,reserved,updated_at) VALUES(?,?,?,?,0,0,?)').bind(uid('osb_'), company.organization_id, product.id, location.id, timestamp).run();
    balance = await env.DB.prepare('SELECT * FROM ops_stock_balances WHERE product_id=? AND location_id=?').bind(product.id, location.id).first();
  }
  let lot = null;
  if (input.lotId) lot = await byPublic(env, 'ops_stock_lots', company.organization_id, input.lotId);
  if (delta < 0) {
    const changed = await env.DB.prepare('UPDATE ops_stock_balances SET quantity=quantity+?,updated_at=? WHERE id=? AND quantity+?>=reserved').bind(delta, timestamp, balance.id, delta).run();
    if (!changed.meta?.changes) throw Object.assign(new Error('insufficient_stock'), { status: 409 });
    if (lot) {
      const lotChanged = await env.DB.prepare('UPDATE ops_stock_lots SET quantity=quantity+?,updated_at=? WHERE id=? AND quantity+?>=0').bind(delta, timestamp, lot.id, delta).run();
      if (!lotChanged.meta?.changes) {
        await env.DB.prepare('UPDATE ops_stock_balances SET quantity=quantity-?,updated_at=? WHERE id=?').bind(delta, timestamp, balance.id).run();
        throw Object.assign(new Error('insufficient_lot_stock'), { status: 409 });
      }
    }
  } else {
    await env.DB.prepare('UPDATE ops_stock_balances SET quantity=quantity+?,updated_at=? WHERE id=?').bind(delta, timestamp, balance.id).run();
    if (input.serialNo || input.batchNo) {
      if (input.serialNo) lot = await env.DB.prepare('SELECT * FROM ops_stock_lots WHERE organization_id=? AND serial_no=?').bind(company.organization_id, clean(input.serialNo, 120)).first();
      if (lot) await env.DB.prepare('UPDATE ops_stock_lots SET quantity=quantity+?,status=\'available\',updated_at=? WHERE id=?').bind(delta, timestamp, lot.id).run();
      else {
        const lotId = publicId('LOT');
        const internalId = uid('osl_');
        await env.DB.prepare('INSERT INTO ops_stock_lots(id,public_id,organization_id,product_id,location_id,batch_no,serial_no,expires_on,quantity,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(internalId, lotId, company.organization_id, product.id, location.id, clean(input.batchNo, 120) || null, clean(input.serialNo, 120) || null, safeDate(input.expiresOn), delta, 'available', timestamp, timestamp).run();
        lot = { id: internalId, public_id: lotId };
      }
    }
  }
  try {
    await env.DB.prepare('INSERT INTO ops_stock_movements(id,public_id,organization_id,product_id,location_id,lot_id,quantity_delta,reason,reference_type,reference_id,actor_member_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(uid('osm_'), publicId('MOV'), company.organization_id, product.id, location.id, lot?.id || null, delta, clean(input.reason, 80) || 'adjustment', clean(input.referenceType, 60) || null, clean(input.referenceId, 120) || null, company.member_id, timestamp).run();
  } catch (error) {
    await env.DB.prepare('UPDATE ops_stock_balances SET quantity=quantity-?,updated_at=? WHERE id=?').bind(delta, timestamp, balance.id).run();
    if (lot) await env.DB.prepare('UPDATE ops_stock_lots SET quantity=quantity-?,updated_at=? WHERE id=?').bind(delta, timestamp, lot.id).run().catch(() => {});
    throw error;
  }
  await audit(env, company, 'stock_adjusted', 'product', product.public_id, { location: location.public_id, delta, reason: input.reason });
  return { product, location, lot, delta };
}

async function analytics(env, organizationId) {
  const [inventory, low, repairs, rmas, passports, warranties, fulfillment, purchases, contacts, commerce] = await Promise.all([
    env.DB.prepare(`SELECT COALESCE(SUM(b.quantity*p.cost_cents),0) inventory_value,COALESCE(SUM(b.quantity),0) units,COALESCE(SUM(b.reserved),0) reserved FROM ops_stock_balances b JOIN ops_products p ON p.id=b.product_id WHERE b.organization_id=?`).bind(organizationId).first(),
    env.DB.prepare(`SELECT COUNT(*) count FROM ops_products p WHERE p.organization_id=? AND p.active=1 AND (SELECT COALESCE(SUM(quantity-reserved),0) FROM ops_stock_balances b WHERE b.product_id=p.id)<=p.reorder_level`).bind(organizationId).first(),
    env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) open,COALESCE(SUM(actual_cost_cents),0) cost FROM ops_repair_jobs WHERE organization_id=?`).bind(organizationId).first(),
    env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN disposition='refund' THEN 1 ELSE 0 END) refunds FROM ops_rmas WHERE organization_id=?`).bind(organizationId).first(),
    env.DB.prepare("SELECT COUNT(*) total,COUNT(DISTINCT buyer_account_id) buyers FROM ownership_passports WHERE organization_id=? AND status<>'archived'").bind(organizationId).first(),
    env.DB.prepare("SELECT COUNT(*) count FROM ownership_passports WHERE organization_id=? AND warranty_until BETWEEN ? AND date(?, '+90 day') AND status<>'archived'").bind(organizationId, today(), today()).first(),
    env.DB.prepare("SELECT AVG(julianday(updated_at)-julianday(created_at)) days FROM ops_reservations WHERE organization_id=? AND status='fulfilled'").bind(organizationId).first(),
    env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN received_on IS NOT NULL AND expected_on IS NOT NULL AND received_on<=expected_on THEN 1 ELSE 0 END) on_time FROM ops_purchase_orders WHERE organization_id=? AND status='received'").bind(organizationId).first(),
    env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN stage='customer' THEN 1 ELSE 0 END) customers FROM ops_crm_contacts WHERE organization_id=?").bind(organizationId).first(),
    env.DB.prepare("SELECT COUNT(*) paid,SUM(CASE WHEN passport_id IS NOT NULL THEN 1 ELSE 0 END) activated FROM commerce_orders WHERE organization_id=? AND status IN ('paid','accepted','in_progress','completed')").bind(organizationId).first()
  ]);
  const passportCount = Number(passports?.total || 0);
  const repairCount = Number(repairs?.total || 0);
  return {
    inventoryValueCents: Number(inventory?.inventory_value || 0), units: Number(inventory?.units || 0), reserved: Number(inventory?.reserved || 0), lowStockProducts: Number(low?.count || 0),
    repairJobs: repairCount, openRepairs: Number(repairs?.open || 0), warrantyServiceCostCents: Number(repairs?.cost || 0), returnCount: Number(rmas?.total || 0), refundCount: Number(rmas?.refunds || 0),
    activePassports: passportCount, warrantiesEnding90Days: Number(warranties?.count || 0), repairRate: passportCount ? Math.round(repairCount / passportCount * 1000) / 10 : 0,
    averageFulfillmentDays: Number(fulfillment?.days || 0), supplierOnTimeRate: Number(purchases?.total || 0) ? Math.round(Number(purchases.on_time || 0) / Number(purchases.total) * 100) : null,
    crmContacts: Number(contacts?.total || 0), crmCustomers: Number(contacts?.customers || 0), passportActivationRate: Number(commerce?.paid || 0) ? Math.round(Number(commerce.activated || 0) / Number(commerce.paid) * 100) : null
  };
}

async function dashboard(env, company) {
  const queries = [
    env.DB.prepare('SELECT public_id,name,code,active FROM ops_locations WHERE organization_id=? ORDER BY active DESC,name').bind(company.organization_id),
    env.DB.prepare(`SELECT p.public_id,p.sku,p.barcode,p.name,p.kind,p.unit,p.reorder_level,p.cost_cents,p.price_cents,p.warranty_months,p.tracked_by,p.active,COALESCE(SUM(b.quantity),0) quantity,COALESCE(SUM(b.reserved),0) reserved FROM ops_products p LEFT JOIN ops_stock_balances b ON b.product_id=p.id WHERE p.organization_id=? GROUP BY p.id ORDER BY p.active DESC,p.name LIMIT 500`).bind(company.organization_id),
    env.DB.prepare(`SELECT b.quantity,b.reserved,p.public_id product_public_id,p.name product_name,l.public_id location_public_id,l.name location_name FROM ops_stock_balances b JOIN ops_products p ON p.id=b.product_id JOIN ops_locations l ON l.id=b.location_id WHERE b.organization_id=? ORDER BY p.name,l.name`).bind(company.organization_id),
    env.DB.prepare(`SELECT x.public_id,x.batch_no,x.serial_no,x.expires_on,x.quantity,x.status,p.public_id product_public_id,p.name product_name,l.public_id location_public_id,l.name location_name FROM ops_stock_lots x JOIN ops_products p ON p.id=x.product_id JOIN ops_locations l ON l.id=x.location_id WHERE x.organization_id=? ORDER BY x.created_at DESC LIMIT 500`).bind(company.organization_id),
    env.DB.prepare('SELECT public_id,name,email,phone,lead_days,min_order_cents,active FROM ops_suppliers WHERE organization_id=? ORDER BY active DESC,name').bind(company.organization_id),
    env.DB.prepare(`SELECT po.public_id,po.status,po.expected_on,po.received_on,po.created_at,s.public_id supplier_public_id,s.name supplier_name,(SELECT SUM(quantity_ordered*unit_cost_cents) FROM ops_purchase_order_items i WHERE i.purchase_order_id=po.id) total_cents FROM ops_purchase_orders po JOIN ops_suppliers s ON s.id=po.supplier_id WHERE po.organization_id=? ORDER BY po.created_at DESC LIMIT 300`).bind(company.organization_id),
    env.DB.prepare(`SELECT r.public_id,r.subject,r.status,r.priority,r.estimate_cents,r.actual_cost_cents,r.scheduled_on,r.completed_on,p.public_id passport_public_id,p.title passport_title,pr.public_id product_public_id,pr.name product_name FROM ops_repair_jobs r LEFT JOIN ownership_passports p ON p.id=r.passport_id LEFT JOIN ops_products pr ON pr.id=r.product_id WHERE r.organization_id=? ORDER BY r.updated_at DESC LIMIT 300`).bind(company.organization_id),
    env.DB.prepare(`SELECT r.public_id,r.status,r.reason,r.condition_grade,r.disposition,r.refund_cents,r.created_at,p.public_id passport_public_id,p.title passport_title,pr.public_id product_public_id,pr.name product_name FROM ops_rmas r LEFT JOIN ownership_passports p ON p.id=r.passport_id LEFT JOIN ops_products pr ON pr.id=r.product_id WHERE r.organization_id=? ORDER BY r.updated_at DESC LIMIT 300`).bind(company.organization_id),
    env.DB.prepare(`SELECT r.public_id,r.order_reference,r.quantity,r.fulfillment_method,r.tracking_number,r.status,r.created_at,p.public_id product_public_id,p.name product_name,l.public_id location_public_id,l.name location_name FROM ops_reservations r JOIN ops_products p ON p.id=r.product_id JOIN ops_locations l ON l.id=r.location_id WHERE r.organization_id=? ORDER BY r.updated_at DESC LIMIT 300`).bind(company.organization_id),
    env.DB.prepare('SELECT public_id,agreement_type,title,customer_label,start_on,end_on,renewal_on,quantity,recurring_cents,deposit_cents,usage_limit,condition_notes,status FROM ops_agreements WHERE organization_id=? ORDER BY status,renewal_on LIMIT 300').bind(company.organization_id),
    env.DB.prepare('SELECT public_id,name,email,skills,active FROM ops_staff WHERE organization_id=? ORDER BY active DESC,name').bind(company.organization_id),
    env.DB.prepare(`SELECT a.public_id,a.title,a.starts_at,a.ends_at,a.location_text,a.status,s.public_id staff_public_id,s.name staff_name FROM ops_appointments a LEFT JOIN ops_staff s ON s.id=a.staff_id WHERE a.organization_id=? ORDER BY a.starts_at LIMIT 400`).bind(company.organization_id),
    env.DB.prepare('SELECT public_id,name,email,phone,company_name,stage,last_contact_at FROM ops_crm_contacts WHERE organization_id=? ORDER BY updated_at DESC LIMIT 500').bind(company.organization_id),
    env.DB.prepare(`SELECT q.public_id,q.title,q.status,q.valid_until,q.currency,q.total_cents,q.created_at,c.public_id contact_public_id,c.name contact_name FROM ops_quotes q LEFT JOIN ops_crm_contacts c ON c.id=q.contact_id WHERE q.organization_id=? ORDER BY q.updated_at DESC LIMIT 300`).bind(company.organization_id),
    env.DB.prepare(`SELECT c.public_id,c.batch_no,c.serial_no,c.severity,c.title,c.status,c.created_at,p.public_id product_public_id,p.name product_name,(SELECT COUNT(*) FROM ops_recall_deliveries d WHERE d.campaign_id=c.id) targeted,(SELECT COUNT(*) FROM ops_recall_deliveries d WHERE d.campaign_id=c.id AND d.status IN ('acknowledged','completed')) acknowledged FROM ops_recall_campaigns c JOIN ops_products p ON p.id=c.product_id WHERE c.organization_id=? ORDER BY c.created_at DESC LIMIT 200`).bind(company.organization_id),
    env.DB.prepare("SELECT public_id,title FROM ownership_passports WHERE organization_id=? AND status<>'archived' ORDER BY updated_at DESC LIMIT 500").bind(company.organization_id),
    env.DB.prepare('SELECT action,entity_type,entity_id,details_json,created_at FROM ops_audit_log WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').bind(company.organization_id)
  ];
  const results = await env.DB.batch(queries);
  const names = ['locations','products','balances','lots','suppliers','purchaseOrders','repairs','returns','reservations','agreements','staff','appointments','contacts','quotes','recalls','passports','audit'];
  const output = { organization: { name: company.organization_name }, analytics: await analytics(env, company.organization_id) };
  names.forEach((name, index) => { output[name] = results[index].results || []; });
  return json(output);
}

async function createLocation(env, company, body) {
  const name = clean(body.name, 120), code = clean(body.code, 30).toUpperCase(); if (name.length < 2 || !code) return json({ error: 'invalid_location' }, 422);
  const id = publicId('LOC'), timestamp = now();
  await env.DB.prepare('INSERT INTO ops_locations(id,public_id,organization_id,name,code,active,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)').bind(uid('olc_'), id, company.organization_id, name, code, timestamp, timestamp).run();
  await audit(env, company, 'created', 'location', id, { name, code }); return json({ ok: true, publicId: id }, 201);
}

async function createProduct(env, company, body) {
  const name = clean(body.name, 180), sku = clean(body.sku, 80).toUpperCase(); if (name.length < 2 || !sku) return json({ error: 'invalid_product' }, 422);
  const id = publicId('SKU'), timestamp = now();
  await env.DB.prepare('INSERT INTO ops_products(id,public_id,organization_id,sku,barcode,name,kind,unit,reorder_level,cost_cents,price_cents,warranty_months,tracked_by,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)')
    .bind(uid('opr_'), id, company.organization_id, sku, clean(body.barcode, 120) || null, name, ['product','part','consumable','asset'].includes(body.kind) ? body.kind : 'product', clean(body.unit, 20) || 'pcs', whole(body.reorderLevel), cents(body.costCents), cents(body.priceCents), whole(body.warrantyMonths, 240), ['quantity','batch','serial'].includes(body.trackedBy) ? body.trackedBy : 'quantity', timestamp, timestamp).run();
  await audit(env, company, 'created', 'product', id, { sku, name }); return json({ ok: true, publicId: id }, 201);
}

async function importProducts(env, company, body) {
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
  if (!rows.length) return json({ error: 'rows_required' }, 422);
  const timestamp = now(), statements = [], accepted = [];
  for (const row of rows) {
    const name = clean(row.name, 180), sku = clean(row.sku, 80).toUpperCase();
    if (!sku || name.length < 2) continue;
    accepted.push(sku);
    statements.push(env.DB.prepare(`INSERT INTO ops_products(id,public_id,organization_id,sku,barcode,name,kind,unit,reorder_level,cost_cents,price_cents,warranty_months,tracked_by,active,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?) ON CONFLICT(organization_id,sku) DO UPDATE SET barcode=excluded.barcode,name=excluded.name,kind=excluded.kind,unit=excluded.unit,reorder_level=excluded.reorder_level,cost_cents=excluded.cost_cents,price_cents=excluded.price_cents,warranty_months=excluded.warranty_months,tracked_by=excluded.tracked_by,active=1,updated_at=excluded.updated_at`)
      .bind(uid('opr_'), publicId('SKU'), company.organization_id, sku, clean(row.barcode,120)||null, name, ['product','part','consumable','asset'].includes(row.kind)?row.kind:'product', clean(row.unit,20)||'pcs', whole(row.reorderLevel), cents(row.costCents), cents(row.priceCents), whole(row.warrantyMonths,240), ['quantity','batch','serial'].includes(row.trackedBy)?row.trackedBy:'quantity', timestamp, timestamp));
  }
  if (!statements.length) return json({ error: 'no_valid_rows' }, 422);
  await env.DB.batch(statements); await audit(env, company, 'imported', 'products', 'bulk', { count: statements.length, skus: accepted.slice(0, 20) });
  return json({ ok: true, imported: statements.length });
}

async function createCompatibility(env, company, body) {
  const parent = await byPublic(env, 'ops_products', company.organization_id, body.parentProductId), part = await byPublic(env, 'ops_products', company.organization_id, body.partProductId);
  if (!parent || !part || parent.id === part.id) return json({ error: 'invalid_compatibility' }, 422);
  await env.DB.prepare('INSERT INTO ops_product_parts(id,organization_id,parent_product_id,part_product_id,quantity_required,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(parent_product_id,part_product_id) DO UPDATE SET quantity_required=excluded.quantity_required').bind(uid('opp_'), company.organization_id, parent.id, part.id, Math.max(1, whole(body.quantityRequired, 1000)), now()).run();
  await audit(env, company, 'linked_part', 'product', parent.public_id, { part: part.public_id }); return json({ ok: true }, 201);
}

async function assignPassport(env, company, body) {
  const passport = await env.DB.prepare("SELECT * FROM ownership_passports WHERE public_id=? AND organization_id=? AND status<>'archived'").bind(clean(body.passportId, 80), company.organization_id).first();
  const product = await byPublic(env, 'ops_products', company.organization_id, body.productId); const location = await byPublic(env, 'ops_locations', company.organization_id, body.locationId);
  const lot = body.lotId ? await byPublic(env, 'ops_stock_lots', company.organization_id, body.lotId) : null; const quantity = Math.max(1, whole(body.quantity, 100000));
  if (!passport || !product || !location || (body.lotId && !lot)) return json({ error: 'invalid_assignment' }, 422);
  if (product.tracked_by === 'serial' && (!lot?.serial_no || quantity !== 1)) return json({ error: 'serial_required' }, 422);
  await adjustStock(env, company, { productId: product.public_id, locationId: location.public_id, lotId: lot?.public_id, quantity: -quantity, reason: 'passport_assignment', referenceType: 'passport', referenceId: passport.public_id });
  const id = publicId('ASN');
  await env.DB.prepare('INSERT INTO ops_passport_inventory(id,public_id,organization_id,passport_id,product_id,lot_id,quantity,status,assigned_by_member_id,assigned_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(uid('opi_'), id, company.organization_id, passport.id, product.id, lot?.id || null, quantity, 'assigned', company.member_id, now()).run();
  await audit(env, company, 'assigned', 'passport_inventory', id, { passport: passport.public_id, product: product.public_id, lot: lot?.public_id }); return json({ ok: true, publicId: id }, 201);
}

async function createSupplier(env, company, body) {
  const name = clean(body.name, 180); if (name.length < 2) return json({ error: 'invalid_supplier' }, 422); const id = publicId('SUP'), timestamp = now();
  await env.DB.prepare('INSERT INTO ops_suppliers(id,public_id,organization_id,name,email,phone,lead_days,min_order_cents,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)').bind(uid('osu_'), id, company.organization_id, name, clean(body.email, 254) || null, clean(body.phone, 80) || null, whole(body.leadDays, 3650), cents(body.minOrderCents), timestamp, timestamp).run();
  await audit(env, company, 'created', 'supplier', id, { name }); return json({ ok: true, publicId: id }, 201);
}

async function createPurchaseOrder(env, company, body) {
  const supplier = await byPublic(env, 'ops_suppliers', company.organization_id, body.supplierId); const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  if (!supplier || !items.length) return json({ error: 'invalid_purchase_order' }, 422);
  const resolved = [];
  for (const item of items) { const product = await byPublic(env, 'ops_products', company.organization_id, item.productId), location = await byPublic(env, 'ops_locations', company.organization_id, item.locationId); if (!product || !location || whole(item.quantity) < 1) return json({ error: 'invalid_purchase_item' }, 422); resolved.push({ item, product, location }); }
  const internal = uid('opo_'), id = publicId('PO'), timestamp = now();
  const statements = [env.DB.prepare('INSERT INTO ops_purchase_orders(id,public_id,organization_id,supplier_id,status,expected_on,notes,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(internal, id, company.organization_id, supplier.id, 'ordered', safeDate(body.expectedOn), clean(body.notes, 1500) || null, company.member_id, timestamp, timestamp)];
  for (const { item, product, location } of resolved) statements.push(env.DB.prepare('INSERT INTO ops_purchase_order_items(id,purchase_order_id,product_id,location_id,quantity_ordered,quantity_received,unit_cost_cents,batch_no,expires_on) VALUES(?,?,?,?,?,0,?,?,?)').bind(uid('opi_'), internal, product.id, location.id, whole(item.quantity), cents(item.unitCostCents), clean(item.batchNo, 120) || null, safeDate(item.expiresOn)));
  await env.DB.batch(statements); await audit(env, company, 'created', 'purchase_order', id, { supplier: supplier.public_id, items: resolved.length }); return json({ ok: true, publicId: id }, 201);
}

async function receivePurchaseOrder(env, company, orderId) {
  const order = await byPublic(env, 'ops_purchase_orders', company.organization_id, orderId); if (!order || !['ordered','partially_received'].includes(order.status)) return json({ error: 'invalid_purchase_order' }, 409);
  const items = await env.DB.prepare(`SELECT i.*,p.public_id product_public_id,l.public_id location_public_id FROM ops_purchase_order_items i JOIN ops_products p ON p.id=i.product_id JOIN ops_locations l ON l.id=i.location_id WHERE i.purchase_order_id=?`).bind(order.id).all();
  for (const item of items.results || []) { const remaining = Number(item.quantity_ordered)-Number(item.quantity_received); if (remaining > 0) { await adjustStock(env, company, { productId: item.product_public_id, locationId: item.location_public_id, quantity: remaining, reason: 'purchase_receive', referenceType: 'purchase_order', referenceId: order.public_id, batchNo: item.batch_no, expiresOn: item.expires_on }); await env.DB.prepare('UPDATE ops_purchase_order_items SET quantity_received=quantity_ordered WHERE id=?').bind(item.id).run(); } }
  await env.DB.prepare("UPDATE ops_purchase_orders SET status='received',received_on=?,updated_at=? WHERE id=?").bind(today(), now(), order.id).run(); await audit(env, company, 'received', 'purchase_order', order.public_id); return json({ ok: true, status: 'received' });
}

async function createRepair(env, company, body) {
  const passport = body.passportId ? await env.DB.prepare("SELECT * FROM ownership_passports WHERE public_id=? AND organization_id=? AND status<>'archived'").bind(body.passportId, company.organization_id).first() : null;
  const product = body.productId ? await byPublic(env, 'ops_products', company.organization_id, body.productId) : null; const subject = clean(body.subject, 180);
  if (subject.length < 2 || (body.passportId && !passport) || (body.productId && !product)) return json({ error: 'invalid_repair' }, 422);
  const id = publicId('REP'), timestamp = now();
  await env.DB.prepare('INSERT INTO ops_repair_jobs(id,public_id,organization_id,passport_id,product_id,subject,status,priority,diagnosis,estimate_cents,actual_cost_cents,scheduled_on,technician_member_id,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(uid('orj_'), id, company.organization_id, passport?.id || null, product?.id || null, subject, 'received', ['low','normal','high','urgent'].includes(body.priority) ? body.priority : 'normal', clean(body.diagnosis, 2000) || null, cents(body.estimateCents), 0, safeDate(body.scheduledOn), clean(body.technicianMemberId, 80) || null, company.member_id, timestamp, timestamp).run();
  await audit(env, company, 'created', 'repair', id, { passport: passport?.public_id, product: product?.public_id }); return json({ ok: true, publicId: id }, 201);
}

async function useRepairPart(env, company, repairId, body) {
  const repair = await byPublic(env, 'ops_repair_jobs', company.organization_id, repairId); const product = await byPublic(env, 'ops_products', company.organization_id, body.productId); const location = await byPublic(env, 'ops_locations', company.organization_id, body.locationId); const quantity = Math.max(1, whole(body.quantity, 100000));
  if (!repair || !product || !location || ['completed','cancelled'].includes(repair.status)) return json({ error: 'invalid_repair_part' }, 422);
  await adjustStock(env, company, { productId: product.public_id, locationId: location.public_id, quantity: -quantity, reason: 'repair_part', referenceType: 'repair', referenceId: repair.public_id });
  await env.DB.prepare('INSERT INTO ops_repair_parts(id,repair_job_id,product_id,location_id,quantity,unit_cost_cents,created_at) VALUES(?,?,?,?,?,?,?)').bind(uid('orp_'), repair.id, product.id, location.id, quantity, product.cost_cents, now()).run();
  await env.DB.prepare('UPDATE ops_repair_jobs SET actual_cost_cents=actual_cost_cents+?,status=CASE WHEN status=\'received\' THEN \'in_progress\' ELSE status END,updated_at=? WHERE id=?').bind(product.cost_cents*quantity, now(), repair.id).run(); await audit(env, company, 'part_used', 'repair', repair.public_id, { product: product.public_id, quantity }); return json({ ok: true }, 201);
}

async function updateRepair(env, company, repairId, body) {
  const repair = await byPublic(env, 'ops_repair_jobs', company.organization_id, repairId); if (!repair || !['received','diagnosing','waiting_approval','in_progress','completed','cancelled'].includes(body.status)) return json({ error: 'invalid_status' }, 422);
  await env.DB.prepare('UPDATE ops_repair_jobs SET status=?,diagnosis=COALESCE(?,diagnosis),actual_cost_cents=CASE WHEN ?>=0 THEN ? ELSE actual_cost_cents END,completed_on=CASE WHEN ?=\'completed\' THEN ? ELSE completed_on END,updated_at=? WHERE id=?').bind(body.status, clean(body.diagnosis, 2000) || null, Number(body.actualCostCents ?? -1), cents(body.actualCostCents), body.status, today(), now(), repair.id).run();
  if (body.status === 'completed' && repair.passport_id) await env.DB.prepare('INSERT INTO passport_service_events(id,public_id,passport_id,organization_id,buyer_account_id,event_type,title,provider_name,occurred_on,cost_cents,notes,is_public,created_by,created_at) SELECT ?,?,p.id,p.organization_id,p.buyer_account_id,\'repair\',?,o.name,?, ?,NULL,1,\'company\',? FROM ownership_passports p JOIN merchant_organizations o ON o.id=p.organization_id WHERE p.id=?').bind(uid('pse_'), publicId('HIS'), repair.subject, today(), cents(body.actualCostCents ?? repair.actual_cost_cents), now(), repair.passport_id).run();
  await audit(env, company, 'status_changed', 'repair', repair.public_id, { status: body.status }); return json({ ok: true, status: body.status });
}

async function createRma(env, company, body) {
  const passport = body.passportId ? await env.DB.prepare("SELECT * FROM ownership_passports WHERE public_id=? AND organization_id=? AND status<>'archived'").bind(body.passportId, company.organization_id).first() : null; const product = body.productId ? await byPublic(env, 'ops_products', company.organization_id, body.productId) : null; const reason = clean(body.reason, 1000);
  if (reason.length < 2 || (body.passportId && !passport) || (body.productId && !product)) return json({ error: 'invalid_return' }, 422); const id = publicId('RMA'), timestamp = now();
  await env.DB.prepare('INSERT INTO ops_rmas(id,public_id,organization_id,passport_id,product_id,status,reason,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,\'requested\',?,?,?,?)').bind(uid('orm_'), id, company.organization_id, passport?.id || null, product?.id || null, reason, company.member_id, timestamp, timestamp).run(); await audit(env, company, 'created', 'return', id); return json({ ok: true, publicId: id }, 201);
}

async function disposeRma(env, company, rmaId, body) {
  const rma = await byPublic(env, 'ops_rmas', company.organization_id, rmaId); if (!rma || rma.status === 'completed' || !['restock','refurbish','repair','replace','refund','recycle','discard'].includes(body.disposition)) return json({ error: 'invalid_disposition' }, 422);
  if (['restock','refurbish'].includes(body.disposition)) { const product = await env.DB.prepare('SELECT public_id FROM ops_products WHERE id=? AND organization_id=?').bind(rma.product_id, company.organization_id).first(); if (!product || !body.locationId) return json({ error: 'stock_target_required' }, 422); await adjustStock(env, company, { productId: product.public_id, locationId: body.locationId, quantity: Math.max(1, whole(body.quantity, 100000)), reason: body.disposition, referenceType: 'return', referenceId: rma.public_id, batchNo: body.disposition === 'refurbish' ? `REFURB-${rma.public_id}` : body.batchNo, serialNo: clean(body.serialNo, 120) || null }); }
  await env.DB.prepare("UPDATE ops_rmas SET status='completed',condition_grade=?,disposition=?,refund_cents=?,updated_at=? WHERE id=?").bind(clean(body.conditionGrade, 30) || null, body.disposition, cents(body.refundCents), now(), rma.id).run(); await audit(env, company, 'completed', 'return', rma.public_id, { disposition: body.disposition }); return json({ ok: true, status: 'completed' });
}

async function createReservation(env, company, body) {
  const product = await byPublic(env, 'ops_products', company.organization_id, body.productId), location = await byPublic(env, 'ops_locations', company.organization_id, body.locationId), quantity = Math.max(1, whole(body.quantity, 100000)); if (!product || !location) return json({ error: 'invalid_reservation' }, 422);
  const balance = await env.DB.prepare('SELECT * FROM ops_stock_balances WHERE product_id=? AND location_id=?').bind(product.id, location.id).first(); if (!balance) return json({ error: 'insufficient_stock' }, 409);
  const changed = await env.DB.prepare('UPDATE ops_stock_balances SET reserved=reserved+?,updated_at=? WHERE id=? AND quantity-reserved>=?').bind(quantity, now(), balance.id, quantity).run(); if (!changed.meta?.changes) return json({ error: 'insufficient_stock' }, 409);
  const passport = body.passportId ? await env.DB.prepare('SELECT id FROM ownership_passports WHERE public_id=? AND organization_id=?').bind(body.passportId, company.organization_id).first() : null; const id = publicId('RSV'), timestamp = now();
  await env.DB.prepare('INSERT INTO ops_reservations(id,public_id,organization_id,product_id,location_id,passport_id,order_reference,quantity,fulfillment_method,tracking_number,status,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?, ?,?,?)').bind(uid('ors_'), id, company.organization_id, product.id, location.id, passport?.id || null, clean(body.orderReference, 120) || null, quantity, clean(body.fulfillmentMethod, 40) || null, clean(body.trackingNumber, 120) || null, 'reserved', company.member_id, timestamp, timestamp).run(); await audit(env, company, 'created', 'reservation', id, { product: product.public_id, quantity }); return json({ ok: true, publicId: id }, 201);
}

async function updateReservation(env, company, reservationId, status, details = {}) {
  const reservation = await byPublic(env, 'ops_reservations', company.organization_id, reservationId); if (!reservation || reservation.status !== 'reserved' || !['fulfilled','released'].includes(status)) return json({ error: 'invalid_reservation_status' }, 409);
  const balance = await env.DB.prepare('SELECT * FROM ops_stock_balances WHERE product_id=? AND location_id=?').bind(reservation.product_id, reservation.location_id).first(); if (!balance) return json({ error: 'balance_not_found' }, 409);
  if (status === 'fulfilled') {
    const changed = await env.DB.prepare('UPDATE ops_stock_balances SET quantity=quantity-?,reserved=reserved-?,updated_at=? WHERE id=? AND quantity>=? AND reserved>=?').bind(reservation.quantity, reservation.quantity, now(), balance.id, reservation.quantity, reservation.quantity).run(); if (!changed.meta?.changes) return json({ error: 'stock_conflict' }, 409);
    await env.DB.prepare('INSERT INTO ops_stock_movements(id,public_id,organization_id,product_id,location_id,quantity_delta,reason,reference_type,reference_id,actor_member_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(uid('osm_'), publicId('MOV'), company.organization_id, reservation.product_id, reservation.location_id, -reservation.quantity, 'fulfillment', 'reservation', reservation.public_id, company.member_id, now()).run();
  } else await env.DB.prepare('UPDATE ops_stock_balances SET reserved=MAX(0,reserved-?),updated_at=? WHERE id=?').bind(reservation.quantity, now(), balance.id).run();
  await env.DB.prepare('UPDATE ops_reservations SET status=?,fulfillment_method=COALESCE(?,fulfillment_method),tracking_number=COALESCE(?,tracking_number),updated_at=? WHERE id=?').bind(status, clean(details.fulfillmentMethod,40)||null, clean(details.trackingNumber,120)||null, now(), reservation.id).run(); await audit(env, company, status, 'reservation', reservation.public_id, { trackingNumber: clean(details.trackingNumber,120)||null }); return json({ ok: true, status });
}

async function createAgreement(env, company, body) {
  const type = ['rental','subscription','service_contract'].includes(body.type) ? body.type : ''; const title = clean(body.title, 180); if (!type || title.length < 2) return json({ error: 'invalid_agreement' }, 422);
  const passport = body.passportId ? await env.DB.prepare('SELECT id FROM ownership_passports WHERE public_id=? AND organization_id=?').bind(body.passportId, company.organization_id).first() : null; const product = body.productId ? await byPublic(env, 'ops_products', company.organization_id, body.productId) : null; const id = publicId('AGR'), timestamp = now();
  await env.DB.prepare('INSERT INTO ops_agreements(id,public_id,organization_id,agreement_type,passport_id,product_id,title,customer_label,start_on,end_on,renewal_on,quantity,recurring_cents,deposit_cents,usage_limit,condition_notes,status,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(uid('oag_'), id, company.organization_id, type, passport?.id || null, product?.id || null, title, clean(body.customerLabel, 180) || null, safeDate(body.startOn), safeDate(body.endOn), safeDate(body.renewalOn), Math.max(1, whole(body.quantity, 100000)), cents(body.recurringCents), cents(body.depositCents), whole(body.usageLimit) || null, clean(body.conditionNotes,1500)||null, 'active', company.member_id, timestamp, timestamp).run(); await audit(env, company, 'created', 'agreement', id, { type }); return json({ ok: true, publicId: id }, 201);
}

async function updateAgreement(env, company, agreementId, body) {
  const agreement = await byPublic(env,'ops_agreements',company.organization_id,agreementId), status = clean(body.status,30);
  if (!agreement || !['active','paused','completed','cancelled'].includes(status)) return json({error:'invalid_status'},422);
  await env.DB.prepare('UPDATE ops_agreements SET status=?,renewal_on=COALESCE(?,renewal_on),updated_at=? WHERE id=?').bind(status,safeDate(body.renewalOn),now(),agreement.id).run(); await audit(env,company,'status_changed','agreement',agreement.public_id,{status}); return json({ok:true,status});
}

async function createStaff(env, company, body) {
  const name = clean(body.name, 140); if (name.length < 2) return json({ error: 'invalid_staff' }, 422); const id = publicId('STF'), timestamp = now(); await env.DB.prepare('INSERT INTO ops_staff(id,public_id,organization_id,name,email,skills,active,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)').bind(uid('ost_'), id, company.organization_id, name, clean(body.email, 254) || null, clean(body.skills, 500) || null, timestamp, timestamp).run(); await audit(env, company, 'created', 'staff', id); return json({ ok: true, publicId: id }, 201);
}

async function createAppointment(env, company, body) {
  const title = clean(body.title, 180), starts = clean(body.startsAt, 35), ends = clean(body.endsAt, 35); if (title.length < 2 || !starts || !ends || Date.parse(starts) >= Date.parse(ends)) return json({ error: 'invalid_appointment' }, 422);
  const staff = body.staffId ? await byPublic(env, 'ops_staff', company.organization_id, body.staffId) : null; if (body.staffId && !staff) return json({ error: 'staff_not_found' }, 404);
  if (staff) { const conflict = await env.DB.prepare("SELECT id FROM ops_appointments WHERE staff_id=? AND status IN ('scheduled','confirmed','in_progress') AND starts_at<? AND ends_at>? LIMIT 1").bind(staff.id, ends, starts).first(); if (conflict) return json({ error: 'schedule_conflict' }, 409); }
  const passport = body.passportId ? await env.DB.prepare('SELECT id FROM ownership_passports WHERE public_id=? AND organization_id=?').bind(body.passportId, company.organization_id).first() : null; const repair = body.repairId ? await byPublic(env, 'ops_repair_jobs', company.organization_id, body.repairId) : null; const id = publicId('APT'), timestamp = now();
  await env.DB.prepare('INSERT INTO ops_appointments(id,public_id,organization_id,staff_id,passport_id,repair_job_id,title,starts_at,ends_at,location_text,status,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,\'scheduled\',?,?,?)').bind(uid('oap_'), id, company.organization_id, staff?.id || null, passport?.id || null, repair?.id || null, title, starts, ends, clean(body.location, 180) || null, company.member_id, timestamp, timestamp).run(); await audit(env, company, 'created', 'appointment', id, { staff: staff?.public_id }); return json({ ok: true, publicId: id }, 201);
}

async function updateAppointment(env, company, appointmentId, body) {
  const appointment = await byPublic(env,'ops_appointments',company.organization_id,appointmentId), status=clean(body.status,30);
  if (!appointment || !['scheduled','confirmed','in_progress','completed','cancelled'].includes(status)) return json({error:'invalid_status'},422);
  await env.DB.prepare('UPDATE ops_appointments SET status=?,updated_at=? WHERE id=?').bind(status,now(),appointment.id).run(); await audit(env,company,'status_changed','appointment',appointment.public_id,{status}); return json({ok:true,status});
}

async function createContact(env, company, body) {
  const name = clean(body.name, 160); if (name.length < 2) return json({ error: 'invalid_contact' }, 422); const id = publicId('CRM'), timestamp = now(); await env.DB.prepare('INSERT INTO ops_crm_contacts(id,public_id,organization_id,name,email,phone,company_name,stage,last_contact_at,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(uid('occ_'), id, company.organization_id, name, clean(body.email, 254) || null, clean(body.phone, 80) || null, clean(body.companyName, 180) || null, ['lead','qualified','proposal','customer','inactive'].includes(body.stage) ? body.stage : 'lead', timestamp, clean(body.notes, 1500) || null, timestamp, timestamp).run(); await audit(env, company, 'created', 'contact', id); return json({ ok: true, publicId: id }, 201);
}

async function createQuote(env, company, body) {
  const title = clean(body.title, 180), items = Array.isArray(body.items) ? body.items.slice(0, 100) : []; if (title.length < 2 || !items.length) return json({ error: 'invalid_quote' }, 422); const contact = body.contactId ? await byPublic(env, 'ops_crm_contacts', company.organization_id, body.contactId) : null; if (body.contactId && !contact) return json({ error: 'contact_not_found' }, 404);
  let total = 0; const resolved = [];
  for (const item of items) { const quantity = Math.max(1, whole(item.quantity, 100000)), unitPrice = cents(item.unitPriceCents), description = clean(item.description, 300); if (!description) return json({ error: 'invalid_quote_item' }, 422); const product = item.productId ? await byPublic(env, 'ops_products', company.organization_id, item.productId) : null; total += quantity*unitPrice; resolved.push({ quantity, unitPrice, description, product }); }
  const internal = uid('oqu_'), id = publicId('QUO'), timestamp = now(); const statements = [env.DB.prepare('INSERT INTO ops_quotes(id,public_id,organization_id,contact_id,title,status,valid_until,currency,total_cents,terms,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,\'draft\',?,?,?,?,?,?,?)').bind(internal, id, company.organization_id, contact?.id || null, title, safeDate(body.validUntil), clean(body.currency,3).toUpperCase() || 'EUR', total, clean(body.terms,2000) || null, company.member_id, timestamp, timestamp)];
  resolved.forEach(item => statements.push(env.DB.prepare('INSERT INTO ops_quote_items(id,quote_id,product_id,description,quantity,unit_price_cents) VALUES(?,?,?,?,?,?)').bind(uid('oqi_'), internal, item.product?.id || null, item.description, item.quantity, item.unitPrice))); await env.DB.batch(statements); await audit(env, company, 'created', 'quote', id, { total }); return json({ ok: true, publicId: id, totalCents: total }, 201);
}

async function updateQuote(env, company, quoteId, body) {
  const quote = await byPublic(env, 'ops_quotes', company.organization_id, quoteId); if (!quote || !['draft','sent','accepted','rejected','expired'].includes(body.status)) return json({ error: 'invalid_status' }, 422); await env.DB.prepare('UPDATE ops_quotes SET status=?,updated_at=? WHERE id=?').bind(body.status, now(), quote.id).run(); if (quote.contact_id && body.status === 'accepted') await env.DB.prepare("UPDATE ops_crm_contacts SET stage='customer',updated_at=? WHERE id=?").bind(now(), quote.contact_id).run(); await audit(env, company, 'status_changed', 'quote', quote.public_id, { status: body.status }); return json({ ok: true, status: body.status });
}

async function createRecall(env, company, body) {
  const product = await byPublic(env, 'ops_products', company.organization_id, body.productId), title = clean(body.title, 180), detail = clean(body.detail, 2000); if (!product || title.length < 2 || detail.length < 2) return json({ error: 'invalid_recall' }, 422);
  const internal = uid('orc_'), id = publicId('RCL'), timestamp = now(), batch = clean(body.batchNo,120), serial = clean(body.serialNo,120);
  await env.DB.prepare('INSERT INTO ops_recall_campaigns(id,public_id,organization_id,product_id,batch_no,serial_no,severity,title,detail,action_url,status,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,\'active\',?,?,?)').bind(internal,id,company.organization_id,product.id,batch||null,serial||null,['notice','warning','critical'].includes(body.severity)?body.severity:'critical',title,detail,safeUrl(body.actionUrl),company.member_id,timestamp,timestamp).run();
  const assignments = await env.DB.prepare(`SELECT DISTINCT a.passport_id FROM ops_passport_inventory a LEFT JOIN ops_stock_lots l ON l.id=a.lot_id WHERE a.organization_id=? AND a.product_id=? AND a.status='assigned' AND (?='' OR l.batch_no=?) AND (?='' OR l.serial_no=?)`).bind(company.organization_id, product.id, batch, batch, serial, serial).all();
  for (const item of assignments.results || []) {
    const alertId=uid('pal_'),alertPublic=publicId('ALT'),deliveryPublic=publicId('RDL');
    await env.DB.batch([
      env.DB.prepare('INSERT INTO passport_alerts(id,public_id,passport_id,organization_id,severity,title,detail,action_url,created_by_member_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(alertId,alertPublic,item.passport_id,company.organization_id,['notice','warning','critical'].includes(body.severity)?body.severity:'critical',title,detail,safeUrl(body.actionUrl),company.member_id,timestamp),
      env.DB.prepare('INSERT OR IGNORE INTO ops_recall_deliveries(id,public_id,campaign_id,passport_id,alert_id,status,delivered_at) VALUES(?,?,?,?,?,\'delivered\',?)').bind(uid('ord_'),deliveryPublic,internal,item.passport_id,alertId,timestamp)
    ]);
  }
  await audit(env, company, 'launched', 'recall', id, { product: product.public_id, targeted: (assignments.results||[]).length }); return json({ ok:true, publicId:id, targeted:(assignments.results||[]).length },201);
}

async function updateRecall(env, company, recallId, body) {
  const recall = await byPublic(env,'ops_recall_campaigns',company.organization_id,recallId), status=clean(body.status,30);
  if (!recall || !['active','completed','cancelled'].includes(status)) return json({error:'invalid_status'},422);
  await env.DB.prepare('UPDATE ops_recall_campaigns SET status=?,updated_at=? WHERE id=?').bind(status,now(),recall.id).run();
  if (status === 'completed') await env.DB.prepare("UPDATE ops_recall_deliveries SET status='completed',completed_at=? WHERE campaign_id=? AND status='acknowledged'").bind(now(),recall.id).run();
  await audit(env,company,'status_changed','recall',recall.public_id,{status}); return json({ok:true,status});
}

async function buyerRecalls(request, env, response) {
  if (!response.ok) return response; const buyer = await buyerSession(request, env); if (!buyer) return response;
  const data = await response.json();
  const recalls = await env.DB.prepare(`SELECT d.public_id delivery_public_id,d.status delivery_status,d.acknowledged_at,c.public_id,c.severity,c.title,c.detail,c.action_url,c.created_at,p.public_id passport_public_id,p.title passport_title,o.name business_name FROM ops_recall_deliveries d JOIN ops_recall_campaigns c ON c.id=d.campaign_id JOIN ownership_passports p ON p.id=d.passport_id JOIN merchant_organizations o ON o.id=c.organization_id WHERE p.buyer_account_id=? AND c.status='active' ORDER BY c.created_at DESC`).bind(buyer.buyer_account_id).all();
  data.recalls = recalls.results || []; return json(data);
}

async function acknowledgeRecall(request, env, recallId) {
  const buyer = await buyerSession(request, env); if (!buyer) return json({ error:'unauthorized' },401);
  const result = await env.DB.prepare(`UPDATE ops_recall_deliveries SET status='acknowledged',acknowledged_at=? WHERE id IN (SELECT d.id FROM ops_recall_deliveries d JOIN ops_recall_campaigns c ON c.id=d.campaign_id JOIN ownership_passports p ON p.id=d.passport_id WHERE c.public_id=? AND p.buyer_account_id=?)`).bind(now(),recallId,buyer.buyer_account_id).run();
  return result.meta?.changes?json({ok:true,status:'acknowledged'}):json({error:'not_found'},404);
}

async function routeOps(request, env, company, path) {
  if (path === '/api/v1/business/ops/dashboard' && request.method === 'GET') return dashboard(env, company);
  if (!['owner','admin','manager','agent'].includes(company.role)) return json({ error:'forbidden' },403);
  const body = request.method === 'GET' ? {} : await request.json().catch(()=>({}));
  if (path === '/api/v1/business/ops/locations' && request.method === 'POST') return createLocation(env, company, body);
  if (path === '/api/v1/business/ops/products' && request.method === 'POST') return createProduct(env, company, body);
  if (path === '/api/v1/business/ops/products/import' && request.method === 'POST') return importProducts(env, company, body);
  if (path === '/api/v1/business/ops/parts/compatibility' && request.method === 'POST') return createCompatibility(env, company, body);
  if (path === '/api/v1/business/ops/stock/adjust' && request.method === 'POST') { try { const result=await adjustStock(env,company,body); return json({ok:true,lotId:result.lot?.public_id||null},201); } catch(error){return json({error:error.message},error.status||500);} }
  if (path === '/api/v1/business/ops/stock/assign-passport' && request.method === 'POST') return assignPassport(env,company,body);
  if (path === '/api/v1/business/ops/suppliers' && request.method === 'POST') return createSupplier(env,company,body);
  if (path === '/api/v1/business/ops/purchase-orders' && request.method === 'POST') return createPurchaseOrder(env,company,body);
  let match=path.match(/^\/api\/v1\/business\/ops\/purchase-orders\/([^/]+)\/receive$/); if(match&&request.method==='POST')return receivePurchaseOrder(env,company,decodeURIComponent(match[1]));
  if (path === '/api/v1/business/ops/repairs' && request.method === 'POST') return createRepair(env,company,body);
  match=path.match(/^\/api\/v1\/business\/ops\/repairs\/([^/]+)\/parts$/); if(match&&request.method==='POST')return useRepairPart(env,company,decodeURIComponent(match[1]),body);
  match=path.match(/^\/api\/v1\/business\/ops\/repairs\/([^/]+)$/); if(match&&request.method==='PATCH')return updateRepair(env,company,decodeURIComponent(match[1]),body);
  if (path === '/api/v1/business/ops/returns' && request.method === 'POST') return createRma(env,company,body);
  match=path.match(/^\/api\/v1\/business\/ops\/returns\/([^/]+)\/disposition$/); if(match&&request.method==='POST')return disposeRma(env,company,decodeURIComponent(match[1]),body);
  if (path === '/api/v1/business/ops/reservations' && request.method === 'POST') return createReservation(env,company,body);
  match=path.match(/^\/api\/v1\/business\/ops\/reservations\/([^/]+)$/); if(match&&request.method==='PATCH')return updateReservation(env,company,decodeURIComponent(match[1]),body.status,body);
  if (path === '/api/v1/business/ops/agreements' && request.method === 'POST') return createAgreement(env,company,body);
  match=path.match(/^\/api\/v1\/business\/ops\/agreements\/([^/]+)$/); if(match&&request.method==='PATCH')return updateAgreement(env,company,decodeURIComponent(match[1]),body);
  if (path === '/api/v1/business/ops/staff' && request.method === 'POST') return createStaff(env,company,body);
  if (path === '/api/v1/business/ops/appointments' && request.method === 'POST') return createAppointment(env,company,body);
  match=path.match(/^\/api\/v1\/business\/ops\/appointments\/([^/]+)$/); if(match&&request.method==='PATCH')return updateAppointment(env,company,decodeURIComponent(match[1]),body);
  if (path === '/api/v1/business/ops/contacts' && request.method === 'POST') return createContact(env,company,body);
  if (path === '/api/v1/business/ops/quotes' && request.method === 'POST') return createQuote(env,company,body);
  match=path.match(/^\/api\/v1\/business\/ops\/quotes\/([^/]+)$/); if(match&&request.method==='PATCH')return updateQuote(env,company,decodeURIComponent(match[1]),body);
  if (path === '/api/v1/business/ops/recalls' && request.method === 'POST') return createRecall(env,company,body);
  match=path.match(/^\/api\/v1\/business\/ops\/recalls\/([^/]+)$/); if(match&&request.method==='PATCH')return ['owner','admin','manager'].includes(company.role)?updateRecall(env,company,decodeURIComponent(match[1]),body):json({error:'forbidden'},403);
  return json({error:'not_found'},404);
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const ops = path.startsWith('/api/v1/business/ops/');
    const recallAck = path.match(/^\/api\/v1\/ops\/recalls\/([^/]+)\/ack$/);
    const buyerDashboard = path === '/api/v1/lifecycle/dashboard' && request.method === 'GET';
    const commerceOrder = path.match(/^\/api\/v1\/business\/commerce\/orders\/([^/]+)$/) && request.method === 'PATCH';
    if (!ops && !recallAck && !buyerDashboard && !commerceOrder) return app.fetch(request,env);
    if (!env.DB) return json({error:'database_not_configured'},503);
    try {
      await ensureSchema(env);
      if (request.method !== 'GET' && request.method !== 'HEAD') { const origin=request.headers.get('origin'); if(origin && origin!==new URL(request.url).origin)return json({error:'origin_not_allowed'},403); }
      if (buyerDashboard) return buyerRecalls(request,env,await app.fetch(request,env));
      if (recallAck && request.method==='POST') return acknowledgeRecall(request,env,decodeURIComponent(recallAck[1]));
      if (commerceOrder) {
        const clone=request.clone(),body=await clone.json().catch(()=>({})),company=await companySession(request,env),response=await app.fetch(request,env);
        if(response.ok&&company&&body.status==='completed') try { const reservations=await env.DB.prepare("SELECT public_id FROM ops_reservations WHERE organization_id=? AND order_reference=? AND status='reserved'").bind(company.organization_id,decodeURIComponent(path.split('/').pop())).all();for(const item of reservations.results||[])await updateReservation(env,company,item.public_id,'fulfilled',{}); } catch(error) { console.error('order_stock_sync_error',error); }
        return response;
      }
      const company=await companySession(request,env); if(!company)return json({error:'unauthorized'},401); if(company.organization_status!=='verified')return json({error:'verification_required'},403);
      if (path === '/api/v1/business/ops/recalls' && request.method === 'POST' && !['owner','admin','manager'].includes(company.role)) return json({error:'forbidden'},403);
      return idempotent(request,env,company,()=>routeOps(request,env,company,path));
    } catch(error) { console.error('company_operations_error',error); const status=error.status&&error.status>=400&&error.status<600?error.status:/UNIQUE constraint/i.test(error.message||'')?409:500; return json({error:error.message||'internal_error'},status); }
  }
};
