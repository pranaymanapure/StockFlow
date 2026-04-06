-- 1. Companies
CREATE TABLE companies (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 2. Warehouses
CREATE TABLE warehouses (
    id          SERIAL PRIMARY KEY,
    company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    location    TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 3. Products
CREATE TABLE products (
    id                  SERIAL PRIMARY KEY,
    company_id          INT NOT NULL REFERENCES companies(id),
    name                VARCHAR(255) NOT NULL,
    sku                 VARCHAR(100) NOT NULL,
    price               NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    product_type        VARCHAR(50) DEFAULT 'simple',
    low_stock_threshold INT DEFAULT 10,
    created_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE (company_id, sku)
);

-- 4. Inventory
CREATE TABLE inventory (
    id           SERIAL PRIMARY KEY,
    product_id   INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity     INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE (product_id, warehouse_id)
);

-- 5. Inventory Logs (audit trail)
CREATE TABLE inventory_logs (
    id              SERIAL PRIMARY KEY,
    inventory_id    INT NOT NULL REFERENCES inventory(id),
    change_type     VARCHAR(50) NOT NULL,
    quantity_before INT NOT NULL,
    quantity_after  INT NOT NULL,
    note            TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 6. Suppliers
CREATE TABLE suppliers (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    created_at    TIMESTAMP DEFAULT NOW()
);

-- 7. Supplier <-> Product (many-to-many)
CREATE TABLE supplier_products (
    id            SERIAL PRIMARY KEY,
    supplier_id   INT NOT NULL REFERENCES suppliers(id),
    product_id    INT NOT NULL REFERENCES products(id),
    unit_cost     NUMERIC(10,2),
    lead_time_days INT,
    UNIQUE (supplier_id, product_id)
);

-- 8. Bundle Products (self-referencing)
CREATE TABLE product_bundles (
    bundle_id    INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    component_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity     INT NOT NULL DEFAULT 1,
    PRIMARY KEY (bundle_id, component_id)
);
