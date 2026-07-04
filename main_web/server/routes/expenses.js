const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM expenses ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const { category, description, amount, reference } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO expenses (category, description, amount, reference, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [category, description, amount, reference, req.user.id]
    );
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'EXPENSE_CREATE', `Created expense ${category}`]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { category, description, amount, reference } = req.body;
  try {
    const result = await db.query(
      'UPDATE expenses SET category = $1, description = $2, amount = $3, reference = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [category, description, amount, reference, id]
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
    await db.query('DELETE FROM expenses WHERE id = $1', [id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
