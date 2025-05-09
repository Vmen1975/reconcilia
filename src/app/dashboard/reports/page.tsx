'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportsService, ReportFilters } from '@/services/reports';
import { getBankAccounts } from '@/services/bankAccounts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Layout } from '@/components/Layout';

const reportsService = new ReportsService();

export default function ReportsPage() {
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [reportType, setReportType] = useState<'reconciliation' | 'status'>('reconciliation');

  const { data: bankAccounts } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => getBankAccounts('company_id'), // TODO: Obtener company_id del contexto
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', selectedBankAccount, dateRange, reportType],
    queryFn: async () => {
      if (!selectedBankAccount) return null;

      const filters: ReportFilters = {
        bankAccountId: selectedBankAccount,
        startDate: dateRange.from,
        endDate: dateRange.to,
      };

      if (reportType === 'reconciliation') {
        return reportsService.generateReconciliationReport(filters);
      } else {
        return reportsService.generateBankAccountStatusReport(selectedBankAccount);
      }
    },
    enabled: !!selectedBankAccount,
  });

  const handleExportExcel = async () => {
    if (!report) return;
    await reportsService.exportToExcel(
      report,
      `${reportType}_report_${selectedBankAccount}`
    );
  };

  const handleExportPDF = async () => {
    if (!report) return;
    await reportsService.exportToPDF(
      report,
      `${reportType}_report_${selectedBankAccount}`
    );
  };

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-6">Reportes de Conciliación</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Select
            value={selectedBankAccount}
            onValueChange={setSelectedBankAccount}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cuenta bancaria" />
            </SelectTrigger>
            <SelectContent>
              {bankAccounts?.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={reportType} onValueChange={(value: 'reconciliation' | 'status') => setReportType(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo de reporte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reconciliation">Reporte de Conciliación</SelectItem>
              <SelectItem value="status">Estado de Cuenta</SelectItem>
            </SelectContent>
          </Select>

          <DatePickerWithRange
            value={dateRange}
            onChange={setDateRange}
          />
        </div>

        <div className="flex gap-4 mb-6">
          <Button onClick={handleExportExcel}>
            Exportar a Excel
          </Button>
          <Button onClick={handleExportPDF}>
            Exportar a PDF
          </Button>
        </div>

        {isLoading ? (
          <div>Cargando...</div>
        ) : report ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reportType === 'status' ? (
              <>
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Resumen de Conciliación</h3>
                  <div className="space-y-2">
                    <p>Total Conciliado: {(report as any).totalReconciled}</p>
                    <p>Total Pendiente: {(report as any).totalPending}</p>
                    <p>Monto Conciliado: ${(report as any).reconciledAmount.toFixed(2)}</p>
                    <p>Monto Pendiente: ${(report as any).pendingAmount.toFixed(2)}</p>
                  </div>
                </Card>
              </>
            ) : (
              <div className="col-span-2">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Detalle de Conciliaciones</h3>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Fecha</th>
                        <th className="text-left">Descripción</th>
                        <th className="text-right">Monto</th>
                        <th className="text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report as any[])?.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="py-2">{new Date(item.created_at).toLocaleDateString()}</td>
                          <td>{item.description}</td>
                          <td className="text-right">${item.amount.toFixed(2)}</td>
                          <td className="text-center">{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500">
            Selecciona una cuenta bancaria y un tipo de reporte para comenzar
          </div>
        )}
      </div>
    </Layout>
  );
} 