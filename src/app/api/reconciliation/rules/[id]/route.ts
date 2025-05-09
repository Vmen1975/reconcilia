import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// GET /api/reconciliation/rules/:id
export async function GET(
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
    
    // Obtener la regla de conciliación
    const { data, error } = await supabase
      .from('reconciliation_rules')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'Regla de conciliación no encontrada' },
        { status: 404 }
      );
    }
    
    // Verificar si el usuario tiene acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', data.company_id)
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
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error al obtener regla de conciliación:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT /api/reconciliation/rules/:id
export async function PUT(
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
    
    // Obtener los datos a actualizar
    const requestData = await request.json();
    
    // Eliminar campos que no se deben modificar
    delete requestData.id;
    delete requestData.company_id; // No permitir cambiar la empresa asociada
    delete requestData.created_by;
    delete requestData.created_at;
    
    // Actualizar la regla
    const { data: updatedRule, error } = await supabase
      .from('reconciliation_rules')
      .update({
        ...requestData,
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
    console.error('Error al actualizar regla de conciliación:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/reconciliation/rules/:id
export async function DELETE(
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
    
    // Eliminar la regla
    const { error } = await supabase
      .from('reconciliation_rules')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar regla de conciliación:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 