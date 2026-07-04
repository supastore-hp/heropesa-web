const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const products = await db.query('SELECT * FROM products WHERE deleted = false');
    const customers = await db.query('SELECT * FROM customers WHERE deleted = false');
    const suppliers = await db.query('SELECT * FROM suppliers WHERE deleted = false');
    const sales = await db.query("SELECT * FROM sales WHERE status != 'suspended'");
    const suspendedSales = await db.query("SELECT * FROM sales WHERE status = 'suspended'");
    const purchases = await db.query('SELECT * FROM purchases');
    const expenses = await db.query('SELECT * FROM expenses');
    const users = await db.query('SELECT id, username, name, role, enabled FROM users');
    const auditLogs = await db.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200');
    const returns = await db.query('SELECT * FROM returns');
    const inventoryMovements = await db.query(`
      SELECT im.*, p.name as product_name, p.sku, u.username
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      LEFT JOIN users u ON im.user_id = u.id
      ORDER BY im.id DESC
      LIMIT 200
    `);
    const adjustments = await db.query(`
      SELECT im.*, p.name as product_name, p.sku, u.username as username
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      LEFT JOIN users u ON im.user_id = u.id
      WHERE im.type = 'adjustment'
      ORDER BY im.id DESC
    `);
    
    const settingsRows = await db.query('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.rows.forEach(r => {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch (e) {
        settings[r.key] = r.value;
      }
    });
    
    // Convert property names from snake_case to camelCase
    const toCamel = (arr) => arr.map(obj => {
      const newObj = {};
      for (const key in obj) {
        const camelKey = key.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
        newObj[camelKey] = obj[key];
      }
      return newObj;
    });

    const fullState = {
      products: toCamel(products.rows),
      customers: toCamel(customers.rows),
      suppliers: toCamel(suppliers.rows),
      sales: toCamel(sales.rows),
      suspendedSales: toCamel(suspendedSales.rows),
      purchases: toCamel(purchases.rows),
      expenses: toCamel(expenses.rows),
      users: toCamel(users.rows),
      auditLogs: toCamel(auditLogs.rows),
      returns: toCamel(returns.rows),
      inventoryMovements: toCamel(inventoryMovements.rows),
      adjustments: toCamel(adjustments.rows),
      settings: settings,
      expenseCategories: settings.expenseCategories || ['Rent', 'Utilities', 'Salaries', 'Maintenance', 'Office Supplies', 'Marketing', 'Other']
    };
    
    // Fill in sale items
    for (const sale of fullState.sales) {
        const items = await db.query('SELECT * FROM sale_items WHERE sale_id = $1', [sale.id]);
        sale.items = toCamel(items.rows);
        
        // Load returned items if any
        if (sale.status === 'returned') {
          const retRes = await db.query('SELECT id FROM returns WHERE sale_id = $1 LIMIT 1', [sale.id]);
          if (retRes.rows.length > 0) {
            const retItems = await db.query('SELECT * FROM return_items WHERE return_id = $1', [retRes.rows[0].id]);
            sale.returnedItems = toCamel(retItems.rows);
          }
        }
    }
    
    // Fill in suspended sale items
    for (const sale of fullState.suspendedSales) {
        const items = await db.query('SELECT * FROM sale_items WHERE sale_id = $1', [sale.id]);
        sale.items = toCamel(items.rows);
    }
    
    // Fill in purchase items
    for (const purchase of fullState.purchases) {
        const items = await db.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [purchase.id]);
        purchase.items = toCamel(items.rows);
    }

    // Fill in return items
    for (const ret of fullState.returns) {
        const items = await db.query('SELECT * FROM return_items WHERE return_id = $1', [ret.id]);
        ret.items = toCamel(items.rows);
    }

    // Calculate dynamic nextIds to prevent duplicate primary keys in client counters
    const maxProduct = await db.query('SELECT COALESCE(MAX(id), 0) as max_id FROM products');
    const maxSale = await db.query('SELECT COALESCE(MAX(id), 0) as max_id FROM sales');
    const maxPurchase = await db.query('SELECT COALESCE(MAX(id), 0) as max_id FROM purchases');
    const maxCustomer = await db.query('SELECT COALESCE(MAX(id), 0) as max_id FROM customers');
    const maxSupplier = await db.query('SELECT COALESCE(MAX(id), 0) as max_id FROM suppliers');
    const maxExpense = await db.query('SELECT COALESCE(MAX(id), 0) as max_id FROM expenses');
    const maxReturn = await db.query('SELECT COALESCE(MAX(id), 0) as max_id FROM returns');
    const maxMovement = await db.query('SELECT COALESCE(MAX(id), 0) as max_id FROM inventory_movements');

    fullState.nextIds = {
      product: parseInt(maxProduct.rows[0].max_id) + 1,
      sale: parseInt(maxSale.rows[0].max_id) + 1,
      purchase: parseInt(maxPurchase.rows[0].max_id) + 1,
      customer: parseInt(maxCustomer.rows[0].max_id) + 1,
      supplier: parseInt(maxSupplier.rows[0].max_id) + 1,
      expense: parseInt(maxExpense.rows[0].max_id) + 1,
      return: parseInt(maxReturn.rows[0].max_id) + 1,
      movement: parseInt(maxMovement.rows[0].max_id) + 1,
      adjustment: parseInt(maxMovement.rows[0].max_id) + 1
    };

    fullState.lastBackup = settings.lastBackup || new Date().toISOString();

    res.json(fullState);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during state sync' });
  }
});

module.exports = router;
