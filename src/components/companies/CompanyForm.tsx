import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Company } from '@/types';

const companySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  rut: z.string()
    .min(1, 'El RUT es requerido')
    .transform(value => {
      // Eliminar puntos y guiones para normalizar
      const normalized = value.replace(/\./g, '').replace('-', '');
      // Insertar puntos y guiones en el formato correcto
      if (normalized.length >= 2) {
        const dv = normalized.slice(-1);
        const num = normalized.slice(0, -1);
        
        // Formatear con puntos de miles
        let formatted = '';
        let length = num.length;
        
        if (length <= 3) {
          formatted = num;
        } else if (length <= 6) {
          formatted = `${num.slice(0, length - 3)}.${num.slice(length - 3)}`;
        } else {
          formatted = `${num.slice(0, length - 6)}.${num.slice(length - 6, length - 3)}.${num.slice(length - 3)}`;
        }
        
        return `${formatted}-${dv}`;
      }
      return value;
    })
    .refine(value => {
      // Verificar el formato básico después de la normalización
      const rutRegex = /^(\d{1,2}\.)?(\d{3}\.)?(\d{1,3})\-[\dkK]$/;
      return rutRegex.test(value);
    }, { message: 'Formato de RUT inválido. Ingrese como 12.345.678-9' }),
  address: z.string().min(1, 'La dirección es requerida'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  email: z.string().min(1, 'El email es requerido').email('Email inválido'),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface CompanyFormProps {
  initialData?: Company;
  onSubmit: (data: CompanyFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function CompanyForm({ initialData, onSubmit, onCancel, isLoading }: CompanyFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: initialData,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Nombre
        </label>
        <input
          type="text"
          id="name"
          {...register('name')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="rut" className="block text-sm font-medium text-gray-700">
          RUT
        </label>
        <input
          type="text"
          id="rut"
          {...register('rut')}
          placeholder="12.345.678-9"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.rut && (
          <p className="mt-1 text-sm text-red-600">{errors.rut.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
          Dirección
        </label>
        <input
          type="text"
          id="address"
          {...register('address')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.address && (
          <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Teléfono
        </label>
        <input
          type="tel"
          id="phone"
          {...register('phone')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          id="email"
          {...register('email')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {isLoading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
} 