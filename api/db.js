import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {

    // ── GET PRODUCTS ──────────────────────────────────────
    if (action === 'products') {
      const rows = await sql`SELECT * FROM products ORDER BY id DESC`;
      return res.json(rows);
    }

    // ── ADD PRODUCT ───────────────────────────────────────
    if (action === 'add_product' && req.method === 'POST') {
      const d = req.body;
      const r = await sql`
        INSERT INTO products (name, category, price, offer_price, emoji, photo_url, description, stock)
        VALUES (
          ${d.name},
          ${d.category},
          ${d.price},
          ${d.offer_price || null},
          ${d.emoji || '🎂'},
          ${d.photo_url || ''},
          ${d.desc || ''},
          ${d.stock || 50}
        )
        RETURNING id`;
      return res.json({ ok: true, id: r[0].id });
    }

    // ── GET SETTINGS ──────────────────────────────────────
    if (action === 'get_settings') {
      const rows = await sql`SELECT key, value FROM settings`;
      const obj = {};
      rows.forEach(r => { try { obj[r.key] = JSON.parse(r.value); } catch { obj[r.key] = r.value; } });
      return res.json(obj);
    }

    // ── SAVE SETTING ──────────────────────────────────────
    if (action === 'save_setting' && req.method === 'POST') {
      const { key, value } = req.body;
      await sql`
        INSERT INTO settings (key, value, updated_at)
        VALUES (${key}, ${JSON.stringify(value)}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}, updated_at = NOW()`;
      return res.json({ ok: true });
    }

    // ── UPDATE PHOTO ──────────────────────────────────────
    if (action === 'update_photo' && req.method === 'POST') {
      const { id, photo_url } = req.body;
      await sql`UPDATE products SET photo_url = ${photo_url} WHERE id = ${id}`;
      return res.json({ ok: true });
    }

    // ── DELETE PRODUCT ────────────────────────────────────
    if (action === 'delete_product' && req.method === 'POST') {
      const { id } = req.body;
      await sql`DELETE FROM products WHERE id = ${id}`;
      return res.json({ ok: true });
    }

    // ── PLACE ORDER ───────────────────────────────────────
    if (action === 'place_order' && req.method === 'POST') {
      const d = req.body;
      await sql`
        INSERT INTO orders (id, customer_name, phone, address, items, total, coins_earned, payment_method)
        VALUES (
          ${d.id},
          ${d.name},
          ${d.phone},
          ${d.address || ''},
          ${JSON.stringify(d.items)},
          ${d.total},
          ${d.coins || 0},
          ${d.paymentMethod || 'upi'}
        )
        ON CONFLICT (id) DO NOTHING`;

      // Upsert customer
      await sql`
        INSERT INTO customers (name, phone, total_coins, total_spent, order_count, last_order)
        VALUES (${d.name}, ${d.phone}, ${d.coins || 0}, ${d.total}, 1, NOW())
        ON CONFLICT (phone) DO UPDATE SET
          name         = EXCLUDED.name,
          total_coins  = customers.total_coins + ${d.coins || 0},
          total_spent  = customers.total_spent + ${d.total},
          order_count  = customers.order_count + 1,
          last_order   = NOW()`;

      return res.json({ ok: true });
    }

    // ── GET ORDERS ────────────────────────────────────────
    if (action === 'orders') {
      const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`;
      return res.json(rows);
    }

    // ── GET CUSTOMERS ─────────────────────────────────────
    if (action === 'customers') {
      const rows = await sql`SELECT * FROM customers ORDER BY total_spent DESC`;
      return res.json(rows);
    }

    // ── UPDATE PAYMENT STATUS ─────────────────────────────
    if (action === 'update_payment' && req.method === 'POST') {
      const { order_id, status } = req.body;
      await sql`
        UPDATE orders
        SET payment_status = ${status},
            status = CASE WHEN ${status} = 'confirmed' THEN 'confirmed' ELSE status END
        WHERE id = ${order_id}`;
      return res.json({ ok: true });
    }

    // ── ADD REVIEW ────────────────────────────────────────
    if (action === 'add_review' && req.method === 'POST') {
      const d = req.body;
      await sql`
        INSERT INTO reviews (product_id, product_name, reviewer_name, rating, review_text)
        VALUES (
          ${d.product_id},
          ${d.product_name || ''},
          ${d.reviewer_name || 'Anonymous'},
          ${d.rating || 5},
          ${d.text}
        )`;
      return res.json({ ok: true });
    }

    // ── GET REVIEWS ───────────────────────────────────────
    if (action === 'reviews') {
      const rows = await sql`SELECT * FROM reviews ORDER BY created_at DESC LIMIT 50`;
      return res.json(rows);
    }

    // ── TRACK ORDER ───────────────────────────────────────
    if (action === 'track_order') {
      const { order_id, phone } = req.query;
      let rows;
      if (order_id) {
        rows = await sql`SELECT * FROM orders WHERE id = ${order_id} LIMIT 1`;
      } else if (phone) {
        rows = await sql`SELECT * FROM orders WHERE phone = ${phone} ORDER BY created_at DESC LIMIT 5`;
      } else {
        return res.status(400).json({ error: 'order_id or phone required' });
      }
      return res.json(rows);
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });

  } catch (e) {
    console.error('[DB Error]', action, e.message);
    return res.status(500).json({ error: e.message });
  }
}
