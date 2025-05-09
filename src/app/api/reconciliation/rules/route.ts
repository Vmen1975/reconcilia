import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/reconciliation/rules?companyId=XYZ
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener el companyId de los query params
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'Se requiere el ID de la empresa' },
        { status: 400 }
      );
    }
    
    // Verificar si el usuario tiene acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', companyId)
      .maybeSingle();
      
    if (userCompanyError) {
      console.error('Error al verificar relación usuario-empresa:', userCompanyError);
    }
    
    if (!userCompany) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta empresa' },
        { status: 403 }
      );
    }
    
    // Obtener las reglas de reconciliación de la empresa
    const { data, error } = await supabase
      .from('reconciliation_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('rule_priority', { ascending: true });
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    // Transformar los datos para la respuesta
    const transformedData = data.map(rule => ({
      id: rule.id,
      company_id: rule.company_id,
      rule_name: rule.rule_name,
      description_pattern: rule.description_pattern,
      amount_pattern: rule.amount_pattern,
      transaction_type: rule.transaction_type,
      rule_priority: rule.rule_priority,
      is_active: rule.is_active,
      created_by: rule.created_by,
      created_at: rule.created_at,
      updated_at: rule.updated_at
    }));
    
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error al obtener reglas de reconciliación:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/reconciliation/rules
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener los datos de la solicitud
    const requestData = await request.json();
    const { 
      company_id, 
      rule_name, 
      description_pattern, 
      amount_pattern, 
      transaction_type, 
      rule_priority = 10, 
      is_active = true 
    } = requestData;
    
    if (!company_id || !rule_name) {
      return NextResponse.json(
        { error: 'Se requieren los campos company_id y rule_name' },
        { status: 400 }
      );
    }
    
    // Verificar si el usuario tiene acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', company_id)
      .maybeSingle();
      
    if (userCompanyError) {
      console.error('Error al verificar relación usuario-empresa:', userCompanyError);
    }
    
    if (!userCompany) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta empresa' },
        { status: 403 }
      );
    }
    
    // Crear la regla de reconciliación
    const { data, error } = await supabase
      .from('reconciliation_rules')
      .insert({
        company_id,
        rule_name,
        description_pattern,
        amount_pattern,
        transaction_type,
        rule_priority,
        is_active,
        created_by: session.user.id
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error al crear regla de reconciliación:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PATCH /api/reconciliation/rules?id=xxx
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener el ID de la regla
    const searchParams = request.nextUrl.searchParams;
    const ruleId = searchParams.get('id');
    
    if (!ruleId) {
      return NextResponse.json(
        { error: 'Se requiere el ID de la regla' },
        { status: 400 }
      );
    }
    
    // Obtener los datos de la solicitud
    const requestData = await request.json();
    
    // Verificar si la regla existe y si el usuario tiene acceso a la empresa asociada
    const { data: existingRule, error: ruleError } = await supabase
      .from('reconciliation_rules')
      .select('*, companies!inner(id)')
      .eq('id', ruleId)
      .single();
      
    if (ruleError || !existingRule) {
      return NextResponse.json(
        { error: 'Regla no encontrada' },
        { status: 404 }
      );
    }
    
    // Verificar si el usuario tiene acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', existingRule.company_id)
      .single();
      
    if (userCompanyError || !userCompany) {
      return NextResponse.json(
        { error: 'No tiene acceso a esta empresa' },
        { status: 403 }
      );
    }
    
    // Actualizar la regla
    const { data: updatedRule, error } = await supabase
      .from('reconciliation_rules')
      .update({
        rule_name: requestData.rule_name,
        description_pattern: requestData.description_pattern,
        amount_pattern: requestData.amount_pattern,
        transaction_type: requestData.transaction_type,
        rule_priority: requestData.rule_priority,
        is_active: requestData.is_active !== undefined ? requestData.is_active : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', ruleId)
      .select()
      .single();
      
    if (error) {
      console.error('Error al actualizar regla:', error);
      return NextResponse.json(
        { error: 'Error al actualizar regla' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error('Error en PATCH /api/reconciliation/rules:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/reconciliation/rules?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener el ID de la regla
    const searchParams = request.nextUrl.searchParams;
    const ruleId = searchParams.get('id');
    
    if (!ruleId) {
      return NextResponse.json(
        { error: 'Se requiere el ID de la regla' },
        { status: 400 }
      );
    }
    
    // Verificar si la regla existe y si el usuario tiene acceso a la empresa asociada
    const { data: existingRule, error: ruleError } = await supabase
      .from('reconciliation_rules')
      .select('*, companies!inner(id)')
      .eq('id', ruleId)
      .single();
      
    if (ruleError || !existingRule) {
      return NextResponse.json(
        { error: 'Regla no encontrada' },
        { status: 404 }
      );
    }
    
    // Verificar si el usuario tiene acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', existingRule.company_id)
      .single();
      
    if (userCompanyError || !userCompany) {
      return NextResponse.json(
        { error: 'No tiene acceso a esta empresa' },
        { status: 403 }
      );
    }
    
    // Eliminar la regla
    const { error } = await supabase
      .from('reconciliation_rules')
      .delete()
      .eq('id', ruleId);
      
    if (error) {
      console.error('Error al eliminar regla:', error);
      return NextResponse.json(
        { error: 'Error al eliminar regla' },
        { status: 500 }
      );
    }
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error en DELETE /api/reconciliation/rules:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 