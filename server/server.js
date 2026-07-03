const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { authenticateToken } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const path = require('path');

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/sync', require('./routes/sync'));

// Audit Logs Endpoints (Direct)
app.post('/api/audit-logs', authenticateToken, async (req, res) => {
  const { action, details } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, req.user.username, action, details]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`POS API Server running on port ${PORT}`);
});
