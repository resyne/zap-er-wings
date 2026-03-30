
CREATE TABLE warehouse_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE warehouse_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES warehouse_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE warehouse_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage warehouse_categories" ON warehouse_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage warehouse_subcategories" ON warehouse_subcategories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed initial data
INSERT INTO warehouse_categories (id, name, sort_order) VALUES 
  ('a1000000-0000-0000-0000-000000000001', 'Materiale di assemblaggio', 1),
  ('a1000000-0000-0000-0000-000000000002', 'Materiale di consumo', 2);

INSERT INTO warehouse_subcategories (category_id, name, supplier_id, sort_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Elettropompe', '0a348318-6673-4122-a8e1-b2d7477af721', 1),
  ('a1000000-0000-0000-0000-000000000001', 'Vasche', 'f68ad624-666e-466b-8910-7b1b53e8d7f0', 2),
  ('a1000000-0000-0000-0000-000000000002', 'Prodotti', 'ea9c4fb8-9ccf-4754-b11d-ed865303dde2', 1);
