const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get all sales
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sales ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create sale (Requires Transaction)
router.post('/', authenticateToken, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { customer_id, subtotal, tax, discount, discount_type, discount_amount, total, amount_tendered, change_returned, payment_method, payment_reference, payment_notes, status, items } = req.body;
    
    const saleStatus = status || 'completed';

    // Generate reference
    const refResult = await client.query("SELECT nextval('sales_id_seq') AS next_id");
    const nextId = refResult.rows[0].next_id;
    const year = new Date().getFullYear();
    const reference = `INV-${year}-${String(nextId).padStart(6, '0')}`;
    
    // Insert sale (using the sequence next_id for ID)
    const saleResult = await client.query(
      `INSERT INTO sales (id, reference, customer_id, user_id, subtotal, tax, discount, discount_type, discount_amount, total, amount_tendered, change_returned, payment_method, payment_reference, payment_notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [nextId, reference, customer_id || null, req.user.id, subtotal, tax || 0, discount || 0, discount_type || 'fixed', discount_amount || 0, total, amount_tendered || 0, change_returned || 0, payment_method, payment_reference, payment_notes, saleStatus]
    );
    const sale = saleResult.rows[0];

    // Insert sale items and deduct stock if completed
    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, price, cost_snapshot, price_snapshot, discount, discount_type, total, name, sku)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [sale.id, item.productId || item.product_id, item.qty || item.quantity, item.price, item.costSnapshot || item.cost_snapshot || 0, item.priceSnapshot || item.price_snapshot || item.price, item.discount || 0, item.discountType || item.discount_type || 'fixed', item.total || (item.qty * item.price), item.name || '', item.sku || '']
      );

      if (saleStatus === 'completed') {
        const prodId = item.productId || item.product_id;
        const qty = item.qty || item.quantity;
        
        // Fetch current stock
        const pRes = await client.query('SELECT stock FROM products WHERE id = $1', [prodId]);
        if (pRes.rows.length > 0) {
          const oldStock = pRes.rows[0].stock;
          const newStock = oldStock - qty;
          
          // Deduct stock
          await client.query('UPDATE products SET stock = $1 WHERE id = $2', [newStock, prodId]);
          
          // Log movement
          await client.query(
            `INSERT INTO inventory_movements (product_id, user_id, quantity, previous_stock, new_stock, type, reference_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [prodId, req.user.id, -qty, oldStock, newStock, 'sale', sale.id, `Sale ${reference}`]
          );
        }
      }
    }

    // Update customer stats
    if (saleStatus === 'completed' && customer_id) {
      await client.query(
        'UPDATE customers SET purchase_count = purchase_count + 1, total_spent = total_spent + $1, last_purchase_date = CURRENT_TIMESTAMP WHERE id = $2',
        [total, customer_id]
      );
    }

    await client.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, saleStatus === 'suspended' ? 'SUSPEND' : 'Create Sale', 
       saleStatus === 'suspended' ? `Suspended sale #${sale.id}` : `Created sale ${reference} for ${total}`]);

    await client.query('COMMIT');
    res.status(201).json(sale);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Internal server error during sale transaction' });
  } finally {
    client.release();
  }
});

// Delete suspended sale
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM sales WHERE id = $1 RETURNING status', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sale not found' });
    
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'DELETE_SUSPENDED', `Deleted suspended sale #${id}`]);
      
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
