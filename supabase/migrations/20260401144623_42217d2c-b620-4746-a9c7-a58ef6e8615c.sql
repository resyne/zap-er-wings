
UPDATE lead_automation_executions 
SET status = 'cancelled', 
    error_message = 'Cancelled: mass email prevention for Vesuviano pipeline'
WHERE status = 'pending' 
  AND lead_id IN (SELECT id FROM leads WHERE pipeline = 'Vesuviano');
