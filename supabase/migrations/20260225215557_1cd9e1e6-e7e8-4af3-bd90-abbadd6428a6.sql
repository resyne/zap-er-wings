
CREATE OR REPLACE FUNCTION public.update_commessa_status_from_phases()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    total_phases INTEGER;
    completed_phases INTEGER;
    blocked_phases INTEGER;
BEGIN
    -- Count phase statuses (pronto counts as completed for produzione)
    SELECT COUNT(*), 
           COUNT(*) FILTER (WHERE status IN ('completata', 'completato', 'spedito', 'pronto')),
           COUNT(*) FILTER (WHERE status = 'bloccato')
    INTO total_phases, completed_phases, blocked_phases
    FROM public.commessa_phases
    WHERE commessa_id = NEW.commessa_id;

    IF blocked_phases > 0 THEN
        UPDATE public.commesse SET status = 'bloccata', current_phase = NEW.phase_order WHERE id = NEW.commessa_id;
    ELSIF completed_phases = total_phases THEN
        UPDATE public.commesse SET status = 'completata', current_phase = total_phases WHERE id = NEW.commessa_id;
    ELSIF completed_phases > 0 THEN
        UPDATE public.commesse SET status = 'in_corso', current_phase = completed_phases + 1 WHERE id = NEW.commessa_id;
    ELSE
        IF NEW.status NOT IN ('da_fare', 'da_preparare', 'da_programmare') THEN
            UPDATE public.commesse SET status = 'in_corso', current_phase = NEW.phase_order WHERE id = NEW.commessa_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
