-- schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users and Roles
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'cashier',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    purchase_count INT DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    last_purchase_date TIMESTAMP,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    purchase_count INT DEFAULT 0,
    total_purchased DECIMAL(10, 2) DEFAULT 0,
    last_purchase_date TIMESTAMP,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    cost DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    reorder_level INT DEFAULT 10,
    unit VARCHAR(20),
    expiry_date DATE,
    supplier_id INT REFERENCES suppliers(id),
    status VARCHAR(20) DEFAULT 'active',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT REFERENCES customers(id),
    user_id INT REFERENCES users(id),
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    discount_type VARCHAR(20) DEFAULT 'fixed',
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    amount_tendered DECIMAL(10, 2) DEFAULT 0,
    change_returned DECIMAL(10, 2) DEFAULT 0,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    payment_notes TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    original_sale_id INT REFERENCES sales(id),
    returned_items BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sale Items
CREATE TABLE sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    cost_snapshot DECIMAL(10, 2) NOT NULL,
    price_snapshot DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0,
    discount_type VARCHAR(20) DEFAULT 'fixed',
    total DECIMAL(10, 2) NOT NULL,
    name VARCHAR(150),
    sku VARCHAR(50)
);

-- Purchases
CREATE TABLE purchases (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INT REFERENCES suppliers(id),
    user_id INT REFERENCES users(id),
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'received',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Items
CREATE TABLE purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INT REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    cost DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    name VARCHAR(150),
    sku VARCHAR(50)
);

-- Expenses
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference VARCHAR(100),
    description TEXT,
    user_id INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings
CREATE TABLE settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Audit Logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    username VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Returns
CREATE TABLE returns (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(50) UNIQUE NOT NULL,
    sale_id INT REFERENCES sales(id),
    user_id INT REFERENCES users(id),
    customer_id INT REFERENCES customers(id),
    subtotal DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL,
    refund_method VARCHAR(50) DEFAULT 'cash',
    refund_reference VARCHAR(100),
    reason TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Return Items
CREATE TABLE return_items (
    id SERIAL PRIMARY KEY,
    return_id INT REFERENCES returns(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    cost_snapshot DECIMAL(10, 2) NOT NULL
);

-- Inventory movements
CREATE TABLE inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id),
    user_id INT REFERENCES users(id),
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'sale', 'purchase', 'return', 'adjustment', 'correction'
    reference_id INT, -- links to sale_id, purchase_id, etc.
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Admin
-- Password is 'owner123'
INSERT INTO users (username, password_hash, name, role) 
VALUES ('owner', '$2b$10$1hAoHf5hR8JbHcKQbLx/euJ5/iaizbHJveYSIHUzStu.f8DF2Mq/a', 'System Owner', 'owner') 
ON CONFLICT DO NOTHING;

-- Insert Walk-in Customer
INSERT INTO customers (id, name, phone, email, address)
VALUES (1, 'Walk-in Customer', '', '', '')
ON CONFLICT DO NOTHING;

-- Insert Default Settings
INSERT INTO settings (key, value) VALUES ('currency', '"TSHS"') ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('currencySymbol', '"TSh"') ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('storeName', '"POS.com"') ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('storeAddress', '""') ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('storePhone', '""') ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('taxRate', '10') ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('receiptFooter', '"Thank you for your business!"') ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('theme', '"dark"') ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('expenseCategories', '["Rent", "Utilities", "Salaries", "Maintenance", "Office Supplies", "Marketing", "Other"]') ON CONFLICT DO NOTHING;
