import React from 'react';

interface DocumentTypeTagProps {
  documentType: string;
  direction?: string;
}

/**
 * Componente para mostrar el tipo de documento con un estilo visual distintivo
 * Usa colores diferentes según la dirección: emitida (azul) o recibida (verde)
 */
export function DocumentTypeTag({ documentType, direction }: DocumentTypeTagProps) {
  // Configurar colores según dirección del documento
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-800';
  let label = 'Documento';
  
  // Normalizar el tipo para la visualización
  const type = documentType?.toLowerCase() || '';
  
  // Determinar el tipo de documento para la etiqueta específica
  let docTypeText = 'Documento';
  
  if (type === 'invoice' || type.includes('factura')) {
    docTypeText = 'Factura';
  } else if (type === 'credit_note' || type.includes('credito') || type === 'nc') {
    docTypeText = 'Nota de Crédito';
  } else if (type === 'debit_note' || type.includes('debito') || type === 'nd') {
    docTypeText = 'Nota de Débito';
  } else if (type === 'receipt' || type === 'receipt invoice' || type.includes('boleta')) {
    docTypeText = 'Boleta';
  } else if (type === 'bill' || type.includes('cuenta')) {
    docTypeText = 'Cuenta';
  } else if (type === 'payment' || type.includes('pago')) {
    docTypeText = 'Pago';
  } else if (type === 'transfer' || type.includes('transferencia')) {
    docTypeText = 'Transferencia';
  } else if (type === 'deposit' || type.includes('deposito')) {
    docTypeText = 'Depósito';
  } else if (type === 'withdrawal' || type.includes('retiro')) {
    docTypeText = 'Retiro';
  } else if (type === 'fee' || type.includes('comision')) {
    docTypeText = 'Comisión';
  } else if (type === 'tax' || type.includes('impuesto')) {
    docTypeText = 'Impuesto';
  } else if (type === 'payroll' || type.includes('nomina')) {
    docTypeText = 'Nómina';
  } else if (type === 'expense' || type.includes('gasto')) {
    docTypeText = 'Gasto';
  } else if (type === 'income' || type.includes('ingreso')) {
    docTypeText = 'Ingreso';
  }
  
  // Asignar colores y texto basado en la dirección (emitida/recibida)
  if (direction === 'emitida') {
    bgColor = 'bg-blue-100';
    textColor = 'text-blue-800';
    label = `${docTypeText} Emitida`;
  } else if (direction === 'recibida') {
    bgColor = 'bg-green-100';
    textColor = 'text-green-800';
    label = `${docTypeText} Recibida`;
  } else {
    // Si no hay dirección pero hay tipo de documento
    if (type === 'invoice' || type.includes('factura')) {
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-800';
      label = 'Factura';
    } else if (type === 'credit_note' || type.includes('credito') || type === 'nc') {
      bgColor = 'bg-green-100';
      textColor = 'text-green-800';
      label = 'Nota de Crédito';
    } else if (type === 'debit_note' || type.includes('debito') || type === 'nd') {
      bgColor = 'bg-orange-100';
      textColor = 'text-orange-800';
      label = 'Nota de Débito';
    } else if (type === 'receipt' || type === 'receipt invoice' || type.includes('boleta')) {
      bgColor = 'bg-purple-100';
      textColor = 'text-purple-800';
      label = 'Boleta';
    } else if (type === 'payment' || type.includes('pago')) {
      bgColor = 'bg-indigo-100';
      textColor = 'text-indigo-800';
      label = 'Pago';
    } else if (type === 'transfer' || type.includes('transferencia')) {
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-800';
      label = 'Transferencia';
    } else {
      label = docTypeText;
    }
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
      {label}
    </span>
  );
} 