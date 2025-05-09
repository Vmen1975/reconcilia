-- Script SQL para crear la relación entre usuario y empresa
-- Se puede ejecutar directamente en el editor SQL de Supabase

-- Valores específicos
-- USER_ID: ID del usuario vmena@itglobal.cl
-- COMPANY_ID: ID de la empresa Dammaq Ltda.

-- Verificar si la relación ya existe
DO $$
DECLARE
    user_id_var UUID := '7a52b984-7426-4c49-92f7-497dd0bb72fe'; -- ID de usuario vmena@itglobal.cl
    company_id_var UUID := 'd2c3a65b-b118-4909-a62e-15e10be19e16'; -- ID de Dammaq Ltda.
    relation_exists BOOLEAN;
BEGIN
    -- Verificar si la relación ya existe
    SELECT EXISTS (
        SELECT 1 FROM user_companies 
        WHERE user_id = user_id_var AND company_id = company_id_var
    ) INTO relation_exists;
    
    -- Si ya existe, actualizar
    IF relation_exists THEN
        UPDATE user_companies
        SET is_active = true,
            is_primary = true,
            updated_at = NOW()
        WHERE user_id = user_id_var AND company_id = company_id_var;
        
        RAISE NOTICE 'Relación actualizada correctamente';
    -- Si no existe, crear nueva
    ELSE
        INSERT INTO user_companies (
            user_id,
            company_id,
            is_active,
            is_primary,
            created_at,
            updated_at
        ) VALUES (
            user_id_var,
            company_id_var,
            true,
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Relación creada correctamente';
    END IF;
END $$; 