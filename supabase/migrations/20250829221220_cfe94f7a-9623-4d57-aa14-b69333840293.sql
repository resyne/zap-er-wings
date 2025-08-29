-- Insert some sample work orders with scheduled dates for testing the calendar
INSERT INTO work_orders (number, title, status, scheduled_date, location) VALUES 
('WO-2024-0001', 'Produzione Forno Combinato FC101', 'planned', '2024-09-02 09:00:00+00', 'Reparto A'),
('WO-2024-0002', 'Assemblaggio Abbattitore AB205', 'in_progress', '2024-09-03 14:00:00+00', 'Reparto B'),
('WO-2024-0003', 'Test Qualità Forno FC102', 'testing', '2024-09-04 10:30:00+00', 'Lab Qualità'),
('WO-2024-0004', 'Produzione Blast Chiller BC301', 'planned', '2024-09-05 08:00:00+00', 'Reparto C');