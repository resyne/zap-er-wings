UPDATE scraping_results 
SET email_generated = false, 
    generated_email_subject = NULL, 
    generated_email_body = NULL 
WHERE mission_id = '0d25055c-4e49-403d-9370-1655c0423576' 
AND email_generated = true;

UPDATE scraping_missions 
SET email_generation_status = 'pending',
    email_generation_processed = 0
WHERE id = '0d25055c-4e49-403d-9370-1655c0423576';