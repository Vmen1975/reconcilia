import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { BankAccount } from '@/types';

// Esquema validación que coincide con la estructura de la tabla
const bankAccountSchema = z.object({
  company_id: z.string().min(1, 'La empresa es requerida'),
  bank_name: z.string().min(1, 'El nombre del banco es requerido'),
  name: z.string().min(1, 'El nombre de la cuenta es requerido'),
  account_number: z.string().min(1, 'El número de cuenta es requerido'),
  account_type: z.string().min(1, 'El tipo de cuenta es requerido'),
  currency: z.string().min(1, 'La moneda es requerida'),
  description: z.string().optional(),
  current_balance: z.number().optional().default(0),
});

type BankAccountFormData = z.infer<typeof bankAccountSchema>;

interface BankAccountFormProps {
  initialData?: Partial<BankAccount>;
  companyId: string;
  onSubmit: (data: BankAccountFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function BankAccountForm({ 
  initialData, 
  companyId, 
  onSubmit, 
  onCancel, 
  isLoading 
}: BankAccountFormProps) {
  // Procesar los valores iniciales para asegurar que coincidan con el esquema
  const getDefaultValues = (): Partial<BankAccountFormData> => {
    return {
      company_id: companyId,
      bank_name: initialData?.bank_name || '',
      name: initialData?.name || '',
      account_number: initialData?.account_number || '',
      account_type: initialData?.account_type || '',
      currency: initialData?.currency || '',
      description: initialData?.description || '',
      current_balance: initialData?.current_balance || 0,
    };
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: getDefaultValues(),
  });

  // Función para manejar el envío del formulario con logging
  const processSubmit = (data: BankAccountFormData) => {
    console.log('Enviando datos del formulario:', data);
    try {
      return onSubmit(data);
    } catch (error) {
      console.error('Error en procesamiento del formulario:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-4">
      <input type="hidden" {...register('company_id')} value={companyId} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="col-span-2">
          <label htmlFor="bank_name" className="block text-base font-medium text-gray-700 mb-1">
            Nombre del Banco
          </label>
          <input
            type="text"
            id="bank_name"
            {...register('bank_name')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
            placeholder="Ej: Banco Santander"
          />
          {errors.bank_name && (
            <p className="mt-1 text-sm text-red-600">{errors.bank_name.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <label htmlFor="name" className="block text-base font-medium text-gray-700 mb-1">
            Nombre de la Cuenta
          </label>
          <input
            type="text"
            id="name"
            {...register('name')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
            placeholder="Ej: Cuenta Principal"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="account_number" className="block text-base font-medium text-gray-700 mb-1">
            Número de Cuenta
          </label>
          <input
            type="text"
            id="account_number"
            {...register('account_number')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
            placeholder="Ej: 0123456789"
          />
          {errors.account_number && (
            <p className="mt-1 text-sm text-red-600">{errors.account_number.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="account_type" className="block text-base font-medium text-gray-700 mb-1">
            Tipo de Cuenta
          </label>
          <select
            id="account_type"
            {...register('account_type')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
          >
            <option value="">Seleccione un tipo</option>
            <option value="corriente">Cuenta Corriente</option>
            <option value="ahorro">Cuenta de Ahorro</option>
            <option value="vista">Cuenta Vista</option>
          </select>
          {errors.account_type && (
            <p className="mt-1 text-sm text-red-600">{errors.account_type.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="currency" className="block text-base font-medium text-gray-700 mb-1">
            Moneda
          </label>
          <select
            id="currency"
            {...register('currency')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
          >
            <option value="">Seleccione una moneda</option>
            <option value="CLP">Peso Chileno (CLP)</option>
            <option value="USD">Dólar Estadounidense (USD)</option>
            <option value="EUR">Euro (EUR)</option>
          </select>
          {errors.currency && (
            <p className="mt-1 text-sm text-red-600">{errors.currency.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="current_balance" className="block text-base font-medium text-gray-700 mb-1">
            Saldo Actual
          </label>
          <input
            type="number"
            id="current_balance"
            step="0.01"
            {...register('current_balance', { valueAsNumber: true })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
            placeholder="0.00"
          />
        </div>

        <div className="col-span-2">
          <label htmlFor="description" className="block text-base font-medium text-gray-700 mb-1">
            Descripción / Referencia
          </label>
          <input
            type="text"
            id="description"
            {...register('description')}
            placeholder="Ej: Cuenta principal, Gastos, etc."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-base"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-6 mt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-5 py-2.5 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {isLoading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
} 