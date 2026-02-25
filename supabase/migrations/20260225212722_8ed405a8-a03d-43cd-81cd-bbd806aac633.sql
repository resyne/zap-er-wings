
-- Archivia le commesse vecchie di Martin e Batek che sono ancora in stato da_fare
UPDATE work_orders SET archived = true WHERE id IN ('e4d35a7e-81ab-4d4c-bee6-1505ed0220f5', '6143ebfd-1d07-4364-a9f1-d561adc8bd81');
UPDATE service_work_orders SET archived = true WHERE id IN ('345d7945-aa87-45a2-84cb-dff8f08a9d0f', '40a049d3-472c-415a-8f66-4c3eb0c82255', '7608e464-859b-47c4-a519-f99c9d6ad271');
