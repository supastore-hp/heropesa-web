const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, name, role, enabled FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user (owner only)
router.post('/', authenticateToken, requireRole(['owner']), async (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    const checkUser = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (username, password_hash, name, role, enabled) VALUES ($1, $2, $3, $4, true) RETURNING id, username, name, role, enabled',
      [username, hash, name, role]
    );
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'USER_CREATE', `Created user ${username}`]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user (owner only)
router.put('/:id', authenticateToken, requireRole(['owner']), async (req, res) => {
  const { id } = req.params;
  const { username, password, name, role } = req.body;
  try {
    let result;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      result = await db.query(
        'UPDATE users SET username = $1, password_hash = $2, name = $3, role = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING id, username, name, role, enabled',
        [username, hash, name, role, id]
      );
    } else {
      result = await db.query(
        'UPDATE users SET username = $1, name = $2, role = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING id, username, name, role, enabled',
        [username, name, role, id]
      );
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'USER_UPDATE', `Updated user ${username}`]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle user status (owner only)
router.post('/:id/toggle', authenticateToken, requireRole(['owner']), async (req, res) => {
  const { id } = req.params;
  try {
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot disable yourself' });
    }
    const result = await db.query('UPDATE users SET enabled = NOT enabled, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, username, enabled', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'USER_TOGGLE', `Toggled enabled state for user ${result.rows[0].username}`]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user (owner only)
router.delete('/:id', authenticateToken, requireRole(['owner']), async (req, res) => {
  const { id } = req.params;
  try {
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING username', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)', 
      [req.user.id, req.user.username, 'USER_DELETE', `Deleted user ${result.rows[0].username}`]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
