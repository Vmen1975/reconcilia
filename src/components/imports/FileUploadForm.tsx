import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import type { BankAccount } from '@/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const uploadSchema = z.object({
  file_type: z.enum(['bank', 'accounting'], {
    required_error: 'El tipo de archivo es requerido',
  }),
  bank_account_id: z.string().optional(),
  document_direction: z.enum(['emitida', 'recibida']).optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface FileUploadFormProps {
  companyId: string;
  bankAccounts: BankAccount[];
  onSubmit: (data: UploadFormData & { file: File }) => Promise<void>;
  isLoading?: boolean;
}

export default function FileUploadForm({ 
  companyId, 
  bankAccounts, 
  onSubmit, 
  isLoading 
}: FileUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
  });

  const fileType = watch('file_type');
  const documentDirection = watch('document_direction');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      alert('El archivo es demasiado grande. El tamaño máximo es 10MB.');
      return;
    }
    setSelectedFile(file);
  };

  const handleFormSubmit = async (data: UploadFormData) => {
    if (!selectedFile) {
      alert('Por favor selecciona un archivo');
      return;
    }
    await onSubmit({ ...data, file: selectedFile });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Tipo de Archivo
        </label>
        <select
          {...register('file_type')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">Selecciona un tipo</option>
          <option value="bank">Extracto Bancario</option>
          <option value="accounting">Registro Contable</option>
        </select>
        {errors.file_type && (
          <p className="mt-1 text-sm text-red-600">{errors.file_type.message}</p>
        )}
      </div>

      {fileType === 'bank' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Cuenta Bancaria
          </label>
          <select
            {...register('bank_account_id')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Selecciona una cuenta</option>
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bank_name} - {account.account_number}
              </option>
            ))}
          </select>
          {errors.bank_account_id && (
            <p className="mt-1 text-sm text-red-600">{errors.bank_account_id.message}</p>
          )}
        </div>
      )}

      {fileType === 'accounting' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Tipo de Documento
          </label>
          <select
            {...register('document_direction')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required={fileType === 'accounting'}
          >
            <option value="">Selecciona tipo de documento</option>
            <option value="emitida">Documentos Emitidos (Ventas)</option>
            <option value="recibida">Documentos Recibidos (Compras)</option>
          </select>
          {errors.document_direction && (
            <p className="mt-1 text-sm text-red-600">{errors.document_direction.message}</p>
          )}
        </div>
      )}

      <div
        className={`mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10 ${
          dragActive ? 'border-indigo-500 bg-indigo-50' : ''
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <ArrowUpTrayIcon
            className="mx-auto h-12 w-12 text-gray-300"
            aria-hidden="true"
          />
          <div className="mt-4 flex text-sm leading-6 text-gray-600">
            <label
              htmlFor="file-upload"
              className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500"
            >
              <span>Sube un archivo</span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                accept=".csv,.xlsx,.xls"
              />
            </label>
            <p className="pl-1">o arrastra y suelta</p>
          </div>
          <p className="text-xs leading-5 text-gray-600">
            CSV, Excel hasta 10MB
          </p>
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">
              Archivo seleccionado: {selectedFile.name}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isLoading || !selectedFile}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isLoading ? 'Subiendo...' : 'Subir Archivo'}
        </button>
      </div>
    </form>
  );
} 