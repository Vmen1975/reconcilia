'use client';

import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui";
import { 
  Search, 
  Filter, 
  Calendar, 
  Eye, 
  FileText,
  Info,
  User,
  Database,
  Clock
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { ActivityLog, ActivityFilter, activityService } from '@/services/activityService';
import { useUserCompanies } from '@/hooks/useUserCompanies';

export default function ActivityLogsPage() {
  const { companies, selectedCompany, setSelectedCompany } = useUserCompanies();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [viewLogDetail, setViewLogDetail] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>({
    companyId: '',
    startDate: undefined,
    endDate: undefined,
    entityType: undefined,
    action: undefined,
    limit: 10,
    offset: 0
  });

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (selectedCompany) {
      setFilter(prev => ({
        ...prev,
        companyId: selectedCompany.id
      }));
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (filter.companyId) {
      loadActivityLogs();
    }
  }, [filter]);

  const loadActivityLogs = async () => {
    setLoading(true);
    try {
      const result = await activityService.getActivityLogs({
        ...filter,
        offset: (page - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE
      });
      setLogs(result.data);
      setTotalLogs(result.count);
    } catch (error) {
      console.error("Error cargando registros de actividad:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setFilter(prev => ({
      ...prev,
      offset: (newPage - 1) * ITEMS_PER_PAGE
    }));
  };

  const totalPages = Math.ceil(totalLogs / ITEMS_PER_PAGE);

  const viewLogDetails = async (logId: string) => {
    try {
      const logDetail = await activityService.getActivityDetail(logId);
      if (logDetail) {
        setSelectedLog(logDetail);
        setViewLogDetail(true);
      }
    } catch (error) {
      console.error("Error al obtener detalle del log:", error);
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case 'INSERT':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "dd MMM yyyy, HH:mm:ss", { locale: es });
  };

  const getEntityLabel = (entityType: string) => {
    const entities: Record<string, string> = {
      'companies': 'Empresa',
      'bank_accounts': 'Cuenta bancaria',
      'bank_transactions': 'Transacción bancaria',
      'accounting_entries': 'Registro contable',
      'reconciliations': 'Conciliación',
      'reconciliation_rules': 'Regla de conciliación',
      'imported_files': 'Archivo importado'
    };
    
    return entities[entityType] || entityType;
  };

  const renderLogDetailContent = () => {
    if (!selectedLog) return null;
    
    const details = selectedLog.details || {};
    const oldData = details.old || {};
    const newData = details.new || {};
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-muted-foreground">Usuario</Label>
            <div className="flex items-center mt-1">
              <User className="h-4 w-4 mr-2" />
              <span>{selectedLog.user_name || 'N/A'}</span>
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Fecha</Label>
            <div className="flex items-center mt-1">
              <Clock className="h-4 w-4 mr-2" />
              <span>{formatDate(selectedLog.created_at)}</span>
            </div>
          </div>
        </div>
        
        <div>
          <Label className="text-sm text-muted-foreground">Entidad</Label>
          <div className="flex items-center mt-1">
            <Database className="h-4 w-4 mr-2" />
            <span>{getEntityLabel(selectedLog.entity_type)}</span>
          </div>
        </div>
        
        <div>
          <Label className="text-sm text-muted-foreground">Acción</Label>
          <div className="mt-1">
            <Badge className={getActionColor(selectedLog.action)}>
              {selectedLog.action.toUpperCase()}
            </Badge>
          </div>
        </div>
        
        <Separator />
        
        {selectedLog.action === 'UPDATE' && (
          <div>
            <h4 className="font-medium mb-2">Cambios realizados</h4>
            <div className="rounded border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead>Valor anterior</TableHead>
                    <TableHead>Nuevo valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.keys(newData).map(key => {
                    // Mostrar solo los campos que cambiaron
                    if (JSON.stringify(oldData[key]) === JSON.stringify(newData[key])) {
                      return null;
                    }
                    
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell className="text-sm">
                          {JSON.stringify(oldData[key])}
                        </TableCell>
                        <TableCell className="text-sm">
                          {JSON.stringify(newData[key])}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        
        {selectedLog.action === 'INSERT' && (
          <div>
            <h4 className="font-medium mb-2">Datos creados</h4>
            <div className="rounded border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(newData)
                    .filter(([key, value]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
                    .map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell className="text-sm">{JSON.stringify(value)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        
        {selectedLog.action === 'DELETE' && (
          <div>
            <h4 className="font-medium mb-2">Datos eliminados</h4>
            <div className="rounded border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(oldData)
                    .filter(([key, value]) => key !== 'created_at' && key !== 'updated_at')
                    .map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{key}</TableCell>
                        <TableCell className="text-sm">{JSON.stringify(value)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Registro de Actividades</h1>
        <div className="flex gap-4 items-center">
          <div className="flex items-center">
            <Label className="mr-2">Empresa:</Label>
            <Select 
              value={selectedCompany?.id || ''} 
              onValueChange={(value) => {
                const company = companies.find(c => c.id === value);
                if (company) setSelectedCompany(company);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Seleccionar empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Filtre los registros de actividad por diferentes criterios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de entidad</Label>
              <Select 
                value={filter.entityType || ''} 
                onValueChange={(value) => {
                  setFilter(prev => ({
                    ...prev,
                    entityType: value || undefined
                  }));
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los tipos</SelectItem>
                  <SelectItem value="companies">Empresas</SelectItem>
                  <SelectItem value="bank_accounts">Cuentas bancarias</SelectItem>
                  <SelectItem value="bank_transactions">Transacciones bancarias</SelectItem>
                  <SelectItem value="accounting_entries">Registros contables</SelectItem>
                  <SelectItem value="reconciliations">Conciliaciones</SelectItem>
                  <SelectItem value="reconciliation_rules">Reglas de conciliación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Acción</Label>
              <Select 
                value={filter.action || ''} 
                onValueChange={(value) => {
                  setFilter(prev => ({
                    ...prev,
                    action: value || undefined
                  }));
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las acciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las acciones</SelectItem>
                  <SelectItem value="INSERT">Creación</SelectItem>
                  <SelectItem value="UPDATE">Actualización</SelectItem>
                  <SelectItem value="DELETE">Eliminación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Label>Fecha inicio</Label>
                  <DatePicker
                    selected={filter.startDate}
                    onSelect={(date) => {
                      setFilter(prev => ({
                        ...prev,
                        startDate: date
                      }));
                      setPage(1);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Label>Fecha fin</Label>
                  <DatePicker
                    selected={filter.endDate}
                    onSelect={(date) => {
                      setFilter(prev => ({
                        ...prev,
                        endDate: date
                      }));
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de actividades</CardTitle>
          <CardDescription>
            Registro de todas las acciones realizadas en el sistema para esta empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-6">
              <p className="text-muted-foreground">No hay registros de actividad con los filtros seleccionados.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead className="text-right">Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDate(log.created_at)}</TableCell>
                      <TableCell>{log.user_name || log.user_email || 'N/A'}</TableCell>
                      <TableCell>{getEntityLabel(log.entity_type)}</TableCell>
                      <TableCell>
                        <Badge className={getActionColor(log.action)}>
                          {log.action.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewLogDetails(log.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      {page > 1 && (
                        <PaginationItem>
                          <PaginationPrevious onClick={() => handlePageChange(page - 1)} />
                        </PaginationItem>
                      )}
                      
                      {Array.from({ length: Math.min(5, totalPages) }).map((_, index) => {
                        let pageNumber: number;
                        
                        if (totalPages <= 5) {
                          pageNumber = index + 1;
                        } else if (page <= 3) {
                          pageNumber = index + 1;
                        } else if (page >= totalPages - 2) {
                          pageNumber = totalPages - 4 + index;
                        } else {
                          pageNumber = page - 2 + index;
                        }
                        
                        if (pageNumber > 0 && pageNumber <= totalPages) {
                          return (
                            <PaginationItem key={pageNumber}>
                              <Button
                                variant={pageNumber === page ? "default" : "outline"}
                                size="icon"
                                onClick={() => handlePageChange(pageNumber)}
                              >
                                {pageNumber}
                              </Button>
                            </PaginationItem>
                          );
                        }
                        return null;
                      })}
                      
                      {page < totalPages && (
                        <PaginationItem>
                          <PaginationNext onClick={() => handlePageChange(page + 1)} />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={viewLogDetail} onOpenChange={setViewLogDetail}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalle de Actividad</DialogTitle>
          </DialogHeader>
          {renderLogDetailContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
} 