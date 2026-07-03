const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get all returns
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM returns ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Process a return (Requires Transaction)
router.post('/', authenticateToken, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { saleId, subtotal, total, refundAmount, refundMethod, refundReference, reason, notes, items } = req.body;
    
    // Fetch original sale to get customer_id
    const saleRes = await client.query('SELECT * FROM sales WHERE id = $1', [saleId]);
    if (saleRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Original sale not found' });
    }
    const sale = saleRes.rows[0];
    
    // Generate reference
    const refResult = await client.query("SELECT nextval('returns_id_seq') AS next_id");
    const nextId = refResult.rows[0].next_id;
    const year = new Date().getFullYear();
    const reference = `RET-${year}-${String(nextId).padStart(6, '0')}`;
    
    // Insert Return
    const returnResult = await client.query(
      `INSERT INTO returns (id, reference, sale_id, user_id, customer_id, subtotal, total, refund_amount, refund_method, refund_reference, reason, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'completed') RETURNING *`,
      [nextId, reference, saleId, req.user.id, sale.customer_id, subtotal, total, refundAmount, refundMethod || 'cash', refundReference || '', reason || 'Return', notes || '', 'completed']
    );
    const returnRecord = returnResult.rows[0];
    
    // Insert Return Items & Adjust Stock
    for (const item of items) {
      const prodId = item.productId || item.product_id;
      const qty = item.qty || item.quantity;
      const price = item.price;
      const costSnapshot = item.costSnapshot || item.cost_snapshot || 0;
      
      await client.query(
        `INSERT INTO return_items (return_id, product_id, quantity, price, cost_snapshot)
         VALUES ($1, $2, $3, $4, $5)`,
        [returnRecord.id, prodId, qty, price, costSnapshot]
      );
      
      // Update Product Stock
      const pRes = await client.query('SELECT stock FROM products WHERE id = $1', [prodId]);
      if (pRes.rows.length > 0) {
        const oldStock = pRes.rows[0].stock;
        const newStock = oldStock + qty;
        
        await client.query('UPDATE products SET stock = $1 WHERE id = $2', [newStock, prodId]);
        
        // Log Movement
        await client.query(
          `INSERT INTO inventory_movements (product_id, user_id, quantity, previous_stock, new_stock, type, reference_id, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [prodId, req.user.id, qty, oldStock, newStock, 'return', returnRecord.id, `Return for Sale ${sale.reference}`]
        );
      }
    }
    
    // Update original sale status
    await client.query(
      "UPDATE sales SET status = 'returned', returned_items = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [saleId]
    );
    
    // Deduct from customer stats
    if (sale.customer_id) {
      await client.query(
        'UPDATE customers SET total_spent = GREATEST(0.00, total_spent - $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [total, sale.customer_id]
      );
    }
    
    // Audit Log
    await client.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'RETURN', `Return #${returnRecord.id} for sale ${sale.reference} - Total: ${total}`]);
      
    await client.query('COMMIT');
    res.status(201).json(returnRecord);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Server error during return transaction' });
  } finally {
    client.release();
  }
});

module.exports = router;
