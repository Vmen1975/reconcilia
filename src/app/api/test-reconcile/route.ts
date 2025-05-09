import { NextResponse } from 'next/server';
import { reconciliationService } from '@/services/reconciliation';

export async function GET(request: Request) {
  try {
    // Obtener el ID de la cuenta bancaria y el rango de fechas de los parámetros de la URL
    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get('bankAccountId');
    
    if (!bankAccountId) {
      return NextResponse.json(
        { error: 'Se requiere bankAccountId como parámetro' },
        { status: 400 }
      );
    }

    console.log('🧪 TEST DIRECTO de autoReconcile para cuenta:', bankAccountId);
    
    // Crear objeto de rango de fechas si se proporcionan parámetros
    let dateRange = undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate),
        end: new Date(endDate)
      };
      console.log('🧪 Usando rango de fechas:', dateRange);
    }

    // Ejecutar la conciliación automática
    console.log('🧪 Iniciando conciliación de prueba...');
    const matches = await reconciliationService.autoReconcile(bankAccountId, dateRange);
    
    console.log(`🧪 Conciliación completada. Matches encontrados: ${matches.length}`);
    
    // Devolver los resultados
    return NextResponse.json({
      success: true,
      matches,
      count: matches.length
    });
  } catch (error: any) {
    console.error('❌ Error en test-reconcile:', error);
    return NextResponse.json(
      { error: error.message || 'Error en la conciliación automática' },
      { status: 500 }
    );
  }
} 