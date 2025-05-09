import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// POST /api/reconciliation/rules/:id/priority
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere ID de regla' },
        { status: 400 }
      );
    }
    
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
    
    // Obtener la regla actual para verificar permisos
    const { data: rule, error: ruleError } = await supabase
      .from('reconciliation_rules')
      .select('company_id')
      .eq('id', id)
      .single();
    
    if (ruleError || !rule) {
      return NextResponse.json(
        { error: ruleError?.message || 'Regla no encontrada' },
        { status: 404 }
      );
    }
    
    // Verificar si el usuario tiene acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', rule.company_id)
      .maybeSingle();
      
    if (userCompanyError) {
      console.error('Error al verificar relación usuario-empresa:', userCompanyError);
    }
    
    if (!userCompany) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta regla de conciliación' },
        { status: 403 }
      );
    }
    
    // Obtener la nueva prioridad
    const requestData = await request.json();
    const { rule_priority } = requestData;
    
    if (rule_priority === undefined || rule_priority < 1) {
      return NextResponse.json(
        { error: 'La prioridad debe ser un número mayor a 0' },
        { status: 400 }
      );
    }
    
    // Actualizar la prioridad de la regla
    const { data: updatedRule, error } = await supabase
      .from('reconciliation_rules')
      .update({
        rule_priority,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error('Error al cambiar prioridad de regla de conciliación:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 