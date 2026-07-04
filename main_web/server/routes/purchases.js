const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM purchases ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { supplier_id, subtotal, tax, discount, total, payment_method, notes, status, items } = req.body;
    
    const purchaseStatus = status || 'received';

    // Generate reference
    const refResult = await client.query("SELECT nextval('purchases_id_seq') AS next_id");
    const nextId = refResult.rows[0].next_id;
    const year = new Date().getFullYear();
    const reference = `PUR-${year}-${String(nextId).padStart(6, '0')}`;
    
    // Insert purchase
    const purchaseResult = await client.query(
      `INSERT INTO purchases (id, reference, supplier_id, user_id, subtotal, tax, discount, total, payment_method, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [nextId, reference, supplier_id || null, req.user.id, subtotal, tax || 0, discount || 0, total, payment_method, notes, purchaseStatus]
    );
    const purchase = purchaseResult.rows[0];

    // Insert purchase items and add stock if received
    for (const item of items) {
      const prodId = item.productId || item.product_id;
      const qty = item.qty || item.quantity;
      const cost = item.cost;

      await client.query(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, cost, total, name, sku)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [purchase.id, prodId, qty, cost, qty * cost, item.name || '', item.sku || '']
      );

      if (purchaseStatus === 'received') {
        const pRes = await client.query('SELECT stock FROM products WHERE id = $1', [prodId]);
        if (pRes.rows.length > 0) {
          const oldStock = pRes.rows[0].stock;
          const newStock = oldStock + qty;
          
          await client.query('UPDATE products SET stock = $1, cost = $2 WHERE id = $3', [newStock, cost, prodId]);
          
          await client.query(
            `INSERT INTO inventory_movements (product_id, user_id, quantity, previous_stock, new_stock, type, reference_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [prodId, req.user.id, qty, oldStock, newStock, 'purchase', purchase.id, `Purchase ${reference}`]
          );
        }
      }
    }
    
    if (purchaseStatus === 'received' && supplier_id) {
        await client.query(
          'UPDATE suppliers SET purchase_count = purchase_count + 1, total_purchased = total_purchased + $1, last_purchase_date = CURRENT_TIMESTAMP WHERE id = $2',
          [total, supplier_id]
        );
    }

    await client.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'PURCHASE', `Purchase ${reference}`]);

    await client.query('COMMIT');
    res.status(201).json(purchase);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Internal server error during purchase transaction' });
  } finally {
    client.release();
  }
});

// Update purchase status or edit draft
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { supplier_id, subtotal, tax, discount, total, payment_method, notes, status, items } = req.body;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const curPurchase = await client.query('SELECT * FROM purchases WHERE id = $1', [id]);
    if (curPurchase.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase not found' });
    }
    
    const oldStatus = curPurchase.rows[0].status;
    
    // 1. Update purchase columns
    await client.query(
      `UPDATE purchases 
       SET supplier_id = COALESCE($1, supplier_id), 
           subtotal = COALESCE($2, subtotal), 
           tax = COALESCE($3, tax), 
           discount = COALESCE($4, discount), 
           total = COALESCE($5, total), 
           payment_method = COALESCE($6, payment_method), 
           notes = COALESCE($7, notes), 
           status = COALESCE($8, status), 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $9`,
      [supplier_id, subtotal, tax, discount, total, payment_method, notes, status, id]
    );

    // 2. Update purchase items if provided (and was draft)
    if (items && items.length > 0 && oldStatus !== 'received') {
      await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [id]);
      for (const item of items) {
        const prodId = item.productId || item.product_id;
        const qty = item.qty || item.quantity;
        const cost = item.cost;
        
        await client.query(
          `INSERT INTO purchase_items (purchase_id, product_id, quantity, cost, total, name, sku)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, prodId, qty, cost, qty * cost, item.name || '', item.sku || '']
        );
      }
    }

    // Fetch the updated purchase
    const updatedRes = await client.query('SELECT * FROM purchases WHERE id = $1', [id]);
    const purchase = updatedRes.rows[0];

    // 3. Handle stock movement if transitioning to received
    if (oldStatus !== 'received' && status === 'received') {
      const itemsRes = await client.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [id]);
      for (const item of itemsRes.rows) {
        const pRes = await client.query('SELECT stock FROM products WHERE id = $1', [item.product_id]);
        if (pRes.rows.length > 0) {
          const oldStock = pRes.rows[0].stock;
          const newStock = oldStock + item.quantity;
          
          await client.query('UPDATE products SET stock = $1, cost = $2 WHERE id = $3', [newStock, item.cost, item.product_id]);
          
          await client.query(
            `INSERT INTO inventory_movements (product_id, user_id, quantity, previous_stock, new_stock, type, reference_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [item.product_id, req.user.id, item.quantity, oldStock, newStock, 'purchase', id, `Purchase received: ${purchase.reference}`]
          );
        }
      }
      
      if (purchase.supplier_id) {
        await client.query(
          'UPDATE suppliers SET purchase_count = purchase_count + 1, total_purchased = total_purchased + $1, last_purchase_date = CURRENT_TIMESTAMP WHERE id = $2',
          [purchase.total, purchase.supplier_id]
        );
      }
    }
    
    // Transition from received to cancelled: Reverse stock
    if (oldStatus === 'received' && status === 'cancelled') {
      const itemsRes = await client.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [id]);
      for (const item of itemsRes.rows) {
        const pRes = await client.query('SELECT stock FROM products WHERE id = $1', [item.product_id]);
        if (pRes.rows.length > 0) {
          const oldStock = pRes.rows[0].stock;
          const newStock = Math.max(0, oldStock - item.quantity);
          
          await client.query('UPDATE products SET stock = $1 WHERE id = $2', [newStock, item.product_id]);
          
          await client.query(
            `INSERT INTO inventory_movements (product_id, user_id, quantity, previous_stock, new_stock, type, reference_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [item.product_id, req.user.id, -item.quantity, oldStock, newStock, 'correction', id, `Purchase cancelled: ${purchase.reference}`]
          );
        }
      }
      
      if (purchase.supplier_id) {
        await client.query(
          'UPDATE suppliers SET purchase_count = GREATEST(0, purchase_count - 1), total_purchased = GREATEST(0.00, total_purchased - $1) WHERE id = $2',
          [purchase.total, purchase.supplier_id]
        );
      }
    }
    
    await client.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'PURCHASE_UPDATE', `Updated purchase ${purchase.reference} (Status: ${status})`]);
      
    await client.query('COMMIT');
    res.json(purchase);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Delete purchase
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM purchases WHERE id = $1 RETURNING reference', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Purchase not found' });
    
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'PURCHASE_DELETE', `Deleted purchase ${result.rows[0].reference}`]);
      
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
