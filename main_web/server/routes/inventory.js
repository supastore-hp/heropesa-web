const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/movements', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT im.*, p.name as product_name, p.sku, u.username
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      LEFT JOIN users u ON im.user_id = u.id
      ORDER BY im.id DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/adjust', authenticateToken, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { product_id, current_stock, new_stock, reason } = req.body;
    const diff = new_stock - current_stock;
    
    await client.query('UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [new_stock, product_id]);
    
    const imResult = await client.query(
      `INSERT INTO inventory_movements (product_id, user_id, quantity, previous_stock, new_stock, type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [product_id, req.user.id, diff, current_stock, new_stock, 'adjustment', reason]
    );
    const movementId = imResult.rows[0].id;

    const pResult = await client.query('SELECT name FROM products WHERE id = $1', [product_id]);
    const pName = pResult.rows[0].name;

    await client.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'INVENTORY_ADJUST', `Adjusted stock for ${pName} to ${new_stock}`]);
    
    await client.query('COMMIT');
    res.json({ message: 'Stock adjusted', movementId: movementId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
