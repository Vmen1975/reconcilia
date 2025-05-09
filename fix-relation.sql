-- Script para insertar directamente la relación entre el usuario y la empresa
INSERT INTO user_companies (
  user_id,
  company_id,
  is_active,
  is_primary,
  created_at,
  updated_at
) VALUES (
  -- ID del usuario (vmena@itglobal.cl)
  '7a52b984-7426-4c49-92f7-497dd0bb72fe',
  -- ID de la empresa (Dammaq Ltda.)
  'd2c3a65b-b118-4909-a62e-15e10be19e16',
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (user_id, company_id) 
DO UPDATE SET
  is_active = true,
  is_primary = true,
  updated_at = NOW(); 