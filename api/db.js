import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, key } = req.query;
  if (key !== process.env.SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GET PRODUCTS
    if (action === 'products') {
      const rows = await sql`SELECT * FROM products ORDER BY id DESC`;
      return res.json(rows);
    }

    // ADD PRODUCT
    if (action === 'add_product' && req.method === 'POST') {
      const d = req.body;
      const r = await sql`
        INSERT INTO products (name, category, price, offer_price, emoji, photo_url, description, stock)
        VALUES (${d.name}, ${d.category}, ${d.price}, ${d.offer_price||null}, ${d.emoji}, ${d.photo_url||''}, ${d.desc}, ${d.stock||50})
        RETURNING id`;
      return res.json({ ok: true, id: r[0].id });
    }

    // DELETE PRODUCT
    if (action === 'delete_product' && req.method === 'POST') {
      const d = req.body;
      await sql`DELETE FROM products WHERE id = ${d.id}`;
      return res.json({ ok: true });
    }

    // PLACE ORDER
    if (action === 'place_order' && req.method === 'POST') {
      const d = req.body;
      await sql`
        INSERT INTO orders (id, customer_name, phone, address, items, total, coins_earned, payment_method)
        VALUES (${d.id}, ${d.name}, ${d.phone}, ${d.address||''}, ${JSON.stringify(d.items)}, ${d.total}, ${d.coins}, ${d.paymentMethod||'upi'})
        ON CONFLICT (id) DO NOTHING`;
      await sql`
        INSERT INTO customers (name, phone, total_coins, total_spent, order_count, last_order)
        VALUES (${d.name}, ${d.phone}, ${d.coins}, ${d.total}, 1, NOW())
        ON CONFLICT (phone) DO UPDATE SET
          total_coins = customers.total_coins + ${d.coins},
          total_spent = customers.total_spent + ${d.total},
          order_count = customers.order_count + 1,
          last_order = NOW()`;
      return res.json({ ok: true });
    }

    // GET ORDERS
    if (action === 'orders') {
      const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 100`;
      return res.json(rows);
    }

    // GET CUSTOMERS
    if (action === 'customers') {
      const rows = await sql`SELECT * FROM customers ORDER BY total_spent DESC`;
      return res.json(rows);
    }

    // UPDATE PAYMENT STATUS
    if (action === 'update_payment' && req.method === 'POST') {
      const d = req.body;
      await sql`UPDATE orders SET payment_status = ${d.status} WHERE id = ${d.order_id}`;
      return res.json({ ok: true });
    }

    // ADD REVIEW
    if (action === 'add_review' && req.method === 'POST') {
      const d = req.body;
      await sql`
        INSERT INTO reviews (product_id, product_name, reviewer_name, rating, review_text)
        VALUES (${d.product_id}, ${d.product_name}, ${d.reviewer_name}, ${d.rating}, ${d.text})`;
      return res.json({ ok: true });
    }

    // GET REVIEWS
    if (action === 'reviews') {
      const rows = await sql`SELECT * FROM reviews ORDER BY created_at DESC LIMIT 50`;
      return res.json(rows);
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
