import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// Obtener los valores por defecto
function getDefaultReconciliationParams(companyId: string) {
  return {
    company_id: companyId,
    tolerance_days: 7,
    amount_tolerance: 1,
    dateWeight: 30,
    amountWeight: 50,
    descriptionWeight: 20,
    minMatchScore: 70,
    enableAutoReconciliation: true
  };
}

// GET /api/reconciliation/params
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookieStore 
    });
    
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener el ID de la empresa desde la query
    const companyId = request.nextUrl.searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'ID de empresa no proporcionado' },
        { status: 400 }
      );
    }
    
    // Verificar si el usuario tiene acceso a la empresa
    const { data: userCompanies, error: userCompaniesError } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', session.user.id)
      .eq('company_id', companyId);
    
    if (userCompaniesError) {
      console.error('Error al verificar acceso a la empresa:', userCompaniesError);
      return NextResponse.json(
        { error: userCompaniesError.message },
        { status: 500 }
      );
    }
    
    if (!userCompanies || userCompanies.length === 0) {
      return NextResponse.json(
        { error: 'No tiene acceso a esta empresa' },
        { status: 403 }
      );
    }
    
    try {
      // Buscar en system_config por la configuración específica de la empresa
      const { data, error } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'reconciliation_params')
        .single();
      
      if (error) {
        console.error('Error al obtener parámetros de conciliación:', error);
        // Si no encontramos configuración, retornamos valores por defecto
        return NextResponse.json(getDefaultReconciliationParams(companyId));
      }
      
      // Intentar parsear el JSON de la configuración
      try {
        const configValue = JSON.parse(data.config_value);
        
        // Si existe configuración específica para esta empresa, la retornamos
        if (configValue[companyId]) {
          // Asegurarse de que todos los parámetros tengan valores
          const params = {
            ...getDefaultReconciliationParams(companyId),
            ...configValue[companyId]
          };
          
          return NextResponse.json({
            company_id: companyId,
            ...params
          });
        } else {
          // Si no hay configuración para esta empresa específica, retornamos valores por defecto
          return NextResponse.json(getDefaultReconciliationParams(companyId));
        }
      } catch (parseError) {
        console.error('Error al parsear config_value:', parseError);
        return NextResponse.json(getDefaultReconciliationParams(companyId));
      }
    } catch (error) {
      // En caso de error, retornamos valores por defecto
      console.error('Error al acceder a la tabla system_config:', error);
      return NextResponse.json(getDefaultReconciliationParams(companyId));
    }
  } catch (error) {
    console.error('Error en la obtención de parámetros de conciliación:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/reconciliation/params
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookieStore 
    });
    
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener los datos del cuerpo de la solicitud
    const requestData = await request.json();
    
    if (!requestData.company_id) {
      return NextResponse.json(
        { error: 'ID de empresa no proporcionado' },
        { status: 400 }
      );
    }
    
    // Verificar si el usuario tiene acceso a la empresa
    const { data: userCompanies, error: userCompaniesError } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', session.user.id)
      .eq('company_id', requestData.company_id);
    
    if (userCompaniesError) {
      console.error('Error al verificar acceso a la empresa:', userCompaniesError);
      return NextResponse.json(
        { error: userCompaniesError.message },
        { status: 500 }
      );
    }
    
    if (!userCompanies || userCompanies.length === 0) {
      return NextResponse.json(
        { error: 'No tiene acceso a esta empresa' },
        { status: 403 }
      );
    }
    
    // Sanitizar los datos
    const companyId = requestData.company_id;
    
    // Definir el tipo de parámetros para evitar errores de TypeScript
    interface ParamsData {
      tolerance_days: number;
      amount_tolerance: number;
      updated_at: string;
      dateWeight?: number;
      amountWeight?: number;
      descriptionWeight?: number;
      minMatchScore?: number;
      enableAutoReconciliation?: boolean;
    }
    
    const paramsData: ParamsData = {
      tolerance_days: parseInt(requestData.tolerance_days) || 7,
      amount_tolerance: parseFloat(requestData.amount_tolerance) || 1,
      updated_at: new Date().toISOString()
    };
    
    // Añadir parámetros avanzados si están presentes
    if (requestData.dateWeight !== undefined) {
      paramsData.dateWeight = parseInt(requestData.dateWeight) || 30;
    }
    
    if (requestData.amountWeight !== undefined) {
      paramsData.amountWeight = parseInt(requestData.amountWeight) || 50;
    }
    
    if (requestData.descriptionWeight !== undefined) {
      paramsData.descriptionWeight = parseInt(requestData.descriptionWeight) || 20;
    }
    
    if (requestData.minMatchScore !== undefined) {
      paramsData.minMatchScore = parseInt(requestData.minMatchScore) || 70;
    }
    
    if (requestData.enableAutoReconciliation !== undefined) {
      paramsData.enableAutoReconciliation = Boolean(requestData.enableAutoReconciliation);
    }
    
    try {
      // Primero obtenemos la configuración actual
      const { data: currentConfig, error: getError } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'reconciliation_params')
        .single();
      
      let allParamsData = {};
      
      if (!getError && currentConfig) {
        try {
          allParamsData = JSON.parse(currentConfig.config_value);
        } catch (parseError) {
          console.warn('Error al parsear config_value, se creará nueva configuración:', parseError);
        }
      }
      
      // Actualizamos los parámetros de la empresa específica
      allParamsData = {
        ...allParamsData,
        [companyId]: paramsData
      };
      
      // Insertamos o actualizamos en system_config
      const { data: updateData, error: updateError } = await supabase
        .from('system_config')
        .upsert({
          config_key: 'reconciliation_params',
          config_value: JSON.stringify(allParamsData)
        }, {
          onConflict: 'config_key'
        })
        .select()
        .single();
      
      if (updateError) {
        console.error('Error al guardar parámetros de conciliación:', updateError);
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }
      
      // Retornamos los parámetros actualizados para esta empresa
      return NextResponse.json({
        company_id: companyId,
        ...paramsData
      });
    } catch (error) {
      console.error('Error al acceder a la tabla system_config:', error);
      return NextResponse.json(
        { error: 'Error al guardar parámetros de conciliación' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error al guardar parámetros de conciliación:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 