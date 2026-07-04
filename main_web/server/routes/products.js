const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get all products (including soft-deleted if specifically querying, but default active)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products WHERE deleted = false ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create product
router.post('/', authenticateToken, async (req, res) => {
  const { sku, barcode, name, category, description, price, cost, stock, reorder_level, unit, expiry_date, supplier_id, status } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO products (sku, barcode, name, category, description, price, cost, stock, reorder_level, unit, expiry_date, supplier_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [sku, barcode, name, category, description, price, cost, stock, reorder_level || 10, unit, expiry_date || null, supplier_id || null, status || 'active']
    );
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'Create Product', `Created product ${name} (SKU: ${sku})`]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.code === '23505') return res.status(400).json({ error: 'SKU or Barcode already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { sku, barcode, name, category, description, price, cost, stock, reorder_level, unit, expiry_date, supplier_id, status } = req.body;
  try {
    const result = await db.query(
      `UPDATE products 
       SET sku = $1, barcode = $2, name = $3, category = $4, description = $5, price = $6, cost = $7, stock = $8, reorder_level = $9, unit = $10, expiry_date = $11, supplier_id = $12, status = $13, updated_at = CURRENT_TIMESTAMP
       WHERE id = $14 AND deleted = false RETURNING *`,
      [sku, barcode, name, category, description, price, cost, stock, reorder_level, unit, expiry_date || null, supplier_id || null, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'Edit Product', `Edited product ${name} (ID: ${id})`]);
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'SKU or Barcode already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete (soft delete) product
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('UPDATE products SET deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING name', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'Delete Product', `Deleted product ${result.rows[0].name} (ID: ${id})`]);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore product
router.post('/:id/restore', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('UPDATE products SET deleted = false, deleted_at = null WHERE id = $1 RETURNING name', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'PRODUCT_RESTORE', `Restored product ${result.rows[0].name}`]);
    res.json({ message: 'Product restored' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanent Delete product
router.delete('/:id/permanent', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING name', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'PRODUCT_PERMANENT_DELETE', `Permanently deleted product ${result.rows[0].name}`]);
    res.json({ message: 'Product permanently deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
