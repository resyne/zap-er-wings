-- Remove old test orders and add new ones for current week (2025) with correct status
DELETE FROM work_orders WHERE number LIKE 'WO-2024-%';

-- Insert new work orders for current week in 2025 with valid status values
INSERT INTO work_orders (number, title, status, scheduled_date, location) VALUES 
('WO-2025-0001', 'Produzione Forno Combinato FC101', 'planned', '2025-09-01 09:00:00+00', 'Reparto A'),
('WO-2025-0002', 'Assemblaggio Abbattitore AB205', 'in_progress', '2025-09-02 14:00:00+00', 'Reparto B'),
('WO-2025-0003', 'Test Qualità Forno FC102', 'testing', '2025-09-03 10:30:00+00', 'Lab Qualità'),
('WO-2025-0004', 'Produzione Blast Chiller BC301', 'planned', '2025-09-04 08:00:00+00', 'Reparto C'),
('WO-2025-0005', 'Controllo Finale Sistema XYZ', 'closed', '2025-09-05 16:00:00+00', 'Area Controlli');