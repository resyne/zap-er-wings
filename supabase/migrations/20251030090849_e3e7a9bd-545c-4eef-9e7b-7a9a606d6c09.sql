-- Make pdf_data nullable since we're now using html_content
ALTER TABLE ddts
ALTER COLUMN pdf_data DROP NOT NULL;