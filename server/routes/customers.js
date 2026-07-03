const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM customers WHERE deleted = false ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const { name, phone, email, address } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO customers (name, phone, email, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, phone, email, address]
    );
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'CUSTOMER_CREATE', `Created customer ${name}`]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address } = req.body;
  try {
    const result = await db.query(
      'UPDATE customers SET name = $1, phone = $2, email = $3, address = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND deleted = false RETURNING *',
      [name, phone, email, address, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE customers SET deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
