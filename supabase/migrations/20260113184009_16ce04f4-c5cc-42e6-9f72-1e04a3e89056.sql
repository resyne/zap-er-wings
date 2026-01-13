-- Move all messages from duplicate conversations to the lead's conversation
UPDATE wasender_messages 
SET conversation_id = 'c4f8725f-8d3b-4856-b570-436290dc2cbb'
WHERE conversation_id IN ('9f27b344-2529-4a9c-a5f4-0e4482693b75', 'bfd86a47-5e33-4eb2-ab5d-d30ebc455b39', 'dc72bbce-16ef-4fed-847b-8fad5dab9297');

-- Delete the duplicate conversations
DELETE FROM wasender_conversations 
WHERE id IN ('9f27b344-2529-4a9c-a5f4-0e4482693b75', 'bfd86a47-5e33-4eb2-ab5d-d30ebc455b39', 'dc72bbce-16ef-4fed-847b-8fad5dab9297');