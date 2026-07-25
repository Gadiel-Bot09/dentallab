CREATE OR REPLACE FUNCTION generate_radicado()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_val INTEGER;
    year_str TEXT;
BEGIN
    year_str := to_char(CURRENT_DATE, 'YY');
    
    INSERT INTO custom_sequences (sequence_key, last_value)
    VALUES ('radicado_' || year_str, 1)
    ON CONFLICT (sequence_key) DO UPDATE 
    SET last_value = custom_sequences.last_value + 1
    RETURNING last_value INTO next_val;
    
    RETURN 'ORD-' || year_str || '-' || lpad(next_val::TEXT, 5, '0');
END;
$$;
