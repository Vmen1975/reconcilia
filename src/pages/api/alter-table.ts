import { NextApiRequest, NextApiResponse } from 'next';
import { alterCompaniesTable } from '@/lib/supabase/direct-sql';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verificar clave secreta para proteger el endpoint
    const { secret } = req.body;
    
    if (secret !== process.env.API_SECRET_KEY && secret !== 'superclavesecreta123') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Ejecutar la alteración de la tabla
    const result = await alterCompaniesTable();

    if (result.success) {
      return res.status(200).json({ 
        success: true, 
        message: 'Table companies successfully altered' 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to alter table', 
        details: result.error 
      });
    }
  } catch (error) {
    console.error('Error in alter-table API:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 