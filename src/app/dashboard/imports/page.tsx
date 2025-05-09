'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { fileService } from '@/services/fileService';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText, Trash2, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { ImportedFile } from '@/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';

export default function ImportsPage() {
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<ImportedFile | null>(null);
  const [importSummary, setImportSummary] = useState<{
    totalBankTransactions: number;
    totalAccountingEntries: number;
  } | null>(null);
  const { session, userCompanies } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session && userCompanies.length > 0) {
      loadImportedFiles();
    }
  }, [session, userCompanies]);

  const loadImportedFiles = async () => {
    try {
      setLoading(true);
      // Si hay más de una empresa, podríamos implementar un selector
      const companyId = userCompanies[0]?.id;
      if (!companyId) return;

      const files = await fileService.getImportedFiles(companyId);
      console.log('Archivos importados:', files);
      setImportedFiles(files);
    } catch (error) {
      console.error('Error al cargar archivos importados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: ImportedFile) => {
    setSelectedFile(file);
    try {
      const summary = await fileService.getImportSummary(file.id);
      setImportSummary({
        totalBankTransactions: summary.totalBankTransactions,
        totalAccountingEntries: summary.totalAccountingEntries
      });
    } catch (error) {
      console.error('Error al obtener resumen de importación:', error);
    }
  };

  const handleFileDelete = async (fileId: string, deleteRecords: boolean) => {
    try {
      await fileService.deleteImportedFile(fileId, deleteRecords);
      setSelectedFile(null);
      setImportSummary(null);
      loadImportedFiles();
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100">Pendiente</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-100">Procesando</Badge>;
      case 'processed':
        return <Badge variant="outline" className="bg-green-100">Procesado</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-100">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const viewTransactions = (fileId: string, fileType: string) => {
    if (fileType === 'bank') {
      router.push(`/dashboard/reconciliation/bank?importId=${fileId}`);
    } else {
      router.push(`/dashboard/reconciliation/accounting?importId=${fileId}`);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Archivos Importados</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Lista de Importaciones</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadImportedFiles}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : importedFiles.length === 0 ? (
                <p className="text-center text-muted-foreground p-6">No hay archivos importados</p>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Archivo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedFiles.map((file) => (
                        <TableRow 
                          key={file.id}
                          className={`cursor-pointer ${selectedFile?.id === file.id ? 'bg-muted' : ''}`}
                          onClick={() => handleFileSelect(file)}
                        >
                          <TableCell className="font-medium">{file.file_name}</TableCell>
                          <TableCell>
                            {file.file_type === 'bank' ? 'Banco' : 'Contabilidad'}
                          </TableCell>
                          <TableCell>{getStatusBadge(file.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          {selectedFile ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Detalle de Importación</h2>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => viewTransactions(selectedFile.id, selectedFile.file_type)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Ver Registros
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Eliminar importación</DialogTitle>
                          <DialogDescription>
                            ¿Deseas eliminar también los registros asociados a esta importación?
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-2 justify-end">
                          <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button 
                              variant="default"
                              onClick={() => handleFileDelete(selectedFile.id, false)}
                            >
                              Solo el archivo
                            </Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button 
                              variant="destructive"
                              onClick={() => handleFileDelete(selectedFile.id, true)}
                            >
                              Archivo y registros
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Información del archivo</h3>
                    <dl className="grid grid-cols-[100px_1fr] gap-1 text-sm">
                      <dt className="font-medium">Nombre:</dt>
                      <dd>{selectedFile.file_name}</dd>
                      <dt className="font-medium">Tipo:</dt>
                      <dd>{selectedFile.file_type === 'bank' ? 'Bancario' : 'Contable'}</dd>
                      <dt className="font-medium">Fecha:</dt>
                      <dd>{formatDate(selectedFile.import_date || selectedFile.created_at)}</dd>
                      <dt className="font-medium">Estado:</dt>
                      <dd>{getStatusBadge(selectedFile.status)}</dd>
                      {selectedFile.error_message && (
                        <>
                          <dt className="font-medium">Error:</dt>
                          <dd className="text-red-500">{selectedFile.error_message}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Estadísticas</h3>
                    {importSummary ? (
                      <dl className="grid grid-cols-[160px_1fr] gap-1 text-sm">
                        <dt className="font-medium">Registros bancarios:</dt>
                        <dd>{importSummary.totalBankTransactions}</dd>
                        <dt className="font-medium">Registros contables:</dt>
                        <dd>{importSummary.totalAccountingEntries}</dd>
                        <dt className="font-medium">Total registros:</dt>
                        <dd>{importSummary.totalBankTransactions + importSummary.totalAccountingEntries}</dd>
                      </dl>
                    ) : (
                      <div className="flex justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-center text-muted-foreground">
                  Selecciona un archivo para ver su detalle
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
} 