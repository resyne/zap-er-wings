-- Insert Pasquale Elefante as a technician
INSERT INTO technicians (
  first_name, 
  last_name, 
  employee_code, 
  department, 
  position, 
  active,
  certification_level,
  specializations
) VALUES (
  'Pasquale',
  'Elefante',
  'T003',
  'technical',
  'Tecnico Specializzato',
  true,
  'senior',
  ARRAY['Installazione', 'Manutenzione', 'Riparazione']
);