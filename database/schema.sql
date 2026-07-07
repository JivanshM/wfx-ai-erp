-- ============================================================
-- WFX AI ERP - Database Schema (PostgreSQL / Supabase)
-- Paste this file into the Supabase SQL Editor and run it.
-- Table order matters: master tables first (suppliers, buyers),
-- then the tables that reference them (foreign keys).
-- ============================================================

-- Suppliers: the factories that manufacture our garments
create table suppliers (
    supplier_id    text primary key,      -- e.g. 'SUP-001'
    company_name   text not null unique,  -- factory name (unique because CSVs reference by name)
    country        text not null,
    contact        text,                  -- email address
    lead_time_days integer,               -- days from placing an order to delivery
    rating         numeric(2,1)           -- factory rating (0 to 5)
);

-- Buyers: the companies that purchase garments from us
create table buyers (
    buyer_id       text primary key,      -- e.g. 'BUY-001'
    company_name   text not null unique,
    country        text not null,
    buyer_category text                   -- e.g. 'Department Store', 'Specialty Retailer'
);

-- Finished Goods: the master record of manufactured garments (products)
create table finished_goods (
    style_number  text primary key,       -- e.g. 'WFX-2501', unique product code
    style_name    text not null,          -- product name
    category      text not null,          -- Shirt, Hoodie, Jeans, etc.
    fabric        text,                   -- fabric type (Cotton Twill, Chambray...)
    gsm           integer,                -- grams per square meter = fabric weight/thickness
    color         text,
    print         text,                   -- Solid, Printed, Striped...
    season        text,                   -- AW25 = Autumn/Winter 2025, SS26 = Spring/Summer 2026
    brand         text,
    supplier_id   text references suppliers(supplier_id),  -- foreign key: which factory made it
    cost          numeric(10,2),          -- what it costs us to make
    selling_price numeric(10,2),          -- what we sell it for
    image_url     text                    -- link to the product photo
);

-- Sales Orders: orders placed by buyers
create table sales_orders (
    order_number  text primary key,       -- e.g. 'SO-00001'
    buyer_id      text references buyers(buyer_id),             -- who placed the order
    style_number  text references finished_goods(style_number), -- which product was ordered
    quantity      integer,                -- number of pieces
    unit_price    numeric(10,2),          -- price per piece
    shipment_date date,                   -- when it must ship
    status        text                    -- Confirmed, In Production, Shipped, Delivered, Cancelled
);

-- Sales Invoices: bills raised against orders
create table sales_invoices (
    invoice_number text primary key,      -- e.g. 'INV-00001'
    order_number   text references sales_orders(order_number),  -- which order this bill belongs to
    amount         numeric(12,2),
    currency       text,                  -- INR, USD, EUR, GBP (the data has mixed currencies!)
    payment_status text                   -- Paid, Pending, Partially Paid, Overdue
);

-- Tech Packs: the technical specification sheet for each garment
create table tech_packs (
    tech_pack_id      text primary key,   -- e.g. 'TP-WFX-2501'
    style_number      text references finished_goods(style_number), -- which product it specifies
    fabric_details    text,               -- full fabric description in one field
    construction      text,               -- how it is made (weave/knit type)
    wash_instructions text                -- care instructions
);

-- ============================================================
-- Indexes: columns we filter/join on frequently get an index
-- so those queries run fast.
-- ============================================================
create index idx_fg_category  on finished_goods(category);
create index idx_fg_color     on finished_goods(color);
create index idx_fg_season    on finished_goods(season);
create index idx_fg_supplier  on finished_goods(supplier_id);
create index idx_so_buyer     on sales_orders(buyer_id);
create index idx_so_style     on sales_orders(style_number);
create index idx_so_status    on sales_orders(status);
create index idx_inv_order    on sales_invoices(order_number);
create index idx_inv_status   on sales_invoices(payment_status);
create index idx_tp_style     on tech_packs(style_number);
