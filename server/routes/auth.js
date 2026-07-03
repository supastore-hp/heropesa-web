const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Login Route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1 AND enabled = true', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials or user disabled' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Log the action
    await db.query(
      'INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
      [user.id, user.username, 'Login', 'User logged in successfully']
    );

    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.json({
      token: accessToken,
      user: tokenPayload
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Current User
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, name, role, enabled FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
