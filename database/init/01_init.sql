-- =============================================================================
-- Omni-Channel Pharmacy Operations Platform
-- Master Database Initialization Script
-- Creates all databases and applies schema
-- =============================================================================

-- Create all service databases
CREATE DATABASE pharma_inventory_db;
CREATE DATABASE pharma_billing_db;
CREATE DATABASE pharma_reporting_db;
CREATE DATABASE pharma_audit_db;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE pharma_auth_db TO pharma_admin;
GRANT ALL PRIVILEGES ON DATABASE pharma_inventory_db TO pharma_admin;
GRANT ALL PRIVILEGES ON DATABASE pharma_billing_db TO pharma_admin;
GRANT ALL PRIVILEGES ON DATABASE pharma_reporting_db TO pharma_admin;
GRANT ALL PRIVILEGES ON DATABASE pharma_audit_db TO pharma_admin;

-- Enable extensions in auth db
\c pharma_auth_db;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Seed initial roles
INSERT INTO roles (name, display_name, permissions) VALUES
  ('HEAD_ADMIN', 'Head Office Administrator', '["admin:all","users:create","users:read","users:update","products:create","products:read","products:update","inventory:read","inventory:update","billing:create","billing:read","reports:read","ai:access","audit:read","branches:manage"]'),
  ('BRANCH_MANAGER', 'Branch Manager', '["users:read","products:read","inventory:read","inventory:update","billing:create","billing:read","reports:read","ai:access","audit:read","replenishment:create","replenishment:read"]'),
  ('COUNTER_STAFF', 'Counter Staff', '["products:read","inventory:read","billing:create","billing:read","prescriptions:create","prescriptions:read"]')
ON CONFLICT (name) DO NOTHING;

-- Seed sample branches (pilot stores)
INSERT INTO branches (code, name, city, state, pincode, is_pilot, is_active) VALUES
  ('HO001', 'Head Office', 'Mumbai', 'Maharashtra', '400001', FALSE, TRUE),
  ('MUM001', 'Andheri West Branch', 'Mumbai', 'Maharashtra', '400058', TRUE, TRUE),
  ('MUM002', 'Bandra Branch', 'Mumbai', 'Maharashtra', '400050', TRUE, TRUE),
  ('DEL001', 'Connaught Place Branch', 'New Delhi', 'Delhi', '110001', TRUE, TRUE),
  ('DEL002', 'Lajpat Nagar Branch', 'New Delhi', 'Delhi', '110024', TRUE, TRUE),
  ('BLR001', 'Koramangala Branch', 'Bengaluru', 'Karnataka', '560034', TRUE, TRUE),
  ('BLR002', 'Indiranagar Branch', 'Bengaluru', 'Karnataka', '560038', TRUE, TRUE),
  ('HYD001', 'Banjara Hills Branch', 'Hyderabad', 'Telangana', '500034', TRUE, TRUE),
  ('CHE001', 'Anna Nagar Branch', 'Chennai', 'Tamil Nadu', '600040', TRUE, TRUE),
  ('PUN001', 'Kothrud Branch', 'Pune', 'Maharashtra', '411038', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Seed default Head Admin user (password: Admin@1234)
INSERT INTO users (username, email, password_hash, full_name, employee_id, role_id, branch_id, is_active, is_verified)
SELECT 'admin', 'admin@pharmaops.in',
  crypt('Admin@1234', gen_salt('bf', 12)),
  'System Administrator', 'EMP001',
  (SELECT id FROM roles WHERE name = 'HEAD_ADMIN'),
  NULL, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- Switch to inventory db for schema
\c pharma_inventory_db;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Seed product categories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  parent_id INTEGER REFERENCES categories(id),
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO categories (name) VALUES
  ('Tablets & Capsules'), ('Syrups & Liquids'), ('Injections & Vials'),
  ('Topical Creams & Ointments'), ('Eye Drops'), ('Ear Drops'),
  ('Surgical & Disposables'), ('Vitamins & Supplements'),
  ('Ayurvedic & Herbal'), ('Baby Care'), ('Diabetic Care'),
  ('Cardiac Care'), ('Orthopedic'), ('Dermatology'), ('Oncology')
ON CONFLICT (name) DO NOTHING;

-- Switch to billing db
\c pharma_billing_db;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
