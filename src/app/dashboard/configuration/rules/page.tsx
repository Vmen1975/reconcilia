'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/shared/Layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  PlusCircle, 
  Check, 
  ArrowUpDown, 
  Edit, 
  Trash, 
  Info 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useUserCompanies } from '@/hooks/useUserCompanies';
import { ReconciliationRule, rulesService } from '@/services/rulesService';

// Componente principal
export default function ReconciliationRulesPage() {
  return (
    <Layout>
      <ReconciliationRulesContent />
    </Layout>
  );
}

// Componente de contenido separado
function ReconciliationRulesContent() {
  const { companies, selectedCompany, setSelectedCompany, loading: loadingCompanies, error: companiesError } = useUserCompanies();
  const [rules, setRules] = useState<ReconciliationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<ReconciliationRule | null>(null);
  const [formData, setFormData] = useState({
    rule_name: '',
    description_pattern: '',
    amount_pattern: '',
    transaction_type: '',
    rule_priority: 10
  });

  // Parámetros de conciliación
  const [toleranceDays, setToleranceDays] = useState(7);
  const [amountTolerance, setAmountTolerance] = useState(1);
  
  // Parámetros avanzados
  const [dateWeight, setDateWeight] = useState(30);
  const [amountWeight, setAmountWeight] = useState(50);
  const [descriptionWeight, setDescriptionWeight] = useState(20); 
  const [minMatchScore, setMinMatchScore] = useState(70);
  const [enableAutoReconciliation, setEnableAutoReconciliation] = useState(true);
  
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [savingParams, setSavingParams] = useState(false);
  const [paramsMessage, setParamsMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    if (selectedCompany) {
      loadRules();
      loadReconciliationParams();
    }
  }, [selectedCompany]);

  const loadRules = async () => {
    if (!selectedCompany) return;
    
    setLoading(true);
    try {
      const rulesData = await rulesService.getRules(selectedCompany.id);
      setRules(rulesData);
    } catch (error) {
      console.error("Error cargando reglas de conciliación:", error);
      alert("No se pudieron cargar las reglas de conciliación.");
    } finally {
      setLoading(false);
    }
  };
  
  const loadReconciliationParams = async () => {
    if (!selectedCompany) return;
    
    try {
      // Intentar cargar los valores desde localStorage primero
      const localParams = localStorage.getItem(`reconciliation_params_${selectedCompany.id}`);
      if (localParams) {
        const params = JSON.parse(localParams);
        setToleranceDays(params.tolerance_days);
        setAmountTolerance(params.amount_tolerance);
        
        // Cargar parámetros avanzados si existen
        if (params.dateWeight !== undefined) setDateWeight(params.dateWeight);
        if (params.amountWeight !== undefined) setAmountWeight(params.amountWeight);
        if (params.descriptionWeight !== undefined) setDescriptionWeight(params.descriptionWeight);
        if (params.minMatchScore !== undefined) setMinMatchScore(params.minMatchScore);
        if (params.enableAutoReconciliation !== undefined) setEnableAutoReconciliation(params.enableAutoReconciliation);
      }
      
      // Luego intentar cargar desde la API
      const params = await rulesService.getReconciliationParams(selectedCompany.id);
      if (params) {
        setToleranceDays(params.tolerance_days);
        setAmountTolerance(params.amount_tolerance);
        
        // Cargar parámetros avanzados
        if (params.dateWeight !== undefined) setDateWeight(params.dateWeight);
        if (params.amountWeight !== undefined) setAmountWeight(params.amountWeight);
        if (params.descriptionWeight !== undefined) setDescriptionWeight(params.descriptionWeight);
        if (params.minMatchScore !== undefined) setMinMatchScore(params.minMatchScore);
        if (params.enableAutoReconciliation !== undefined) setEnableAutoReconciliation(params.enableAutoReconciliation);
        
        // Guardar en localStorage para uso futuro
        localStorage.setItem(`reconciliation_params_${selectedCompany.id}`, JSON.stringify({
          tolerance_days: params.tolerance_days,
          amount_tolerance: params.amount_tolerance,
          dateWeight: params.dateWeight,
          amountWeight: params.amountWeight,
          descriptionWeight: params.descriptionWeight,
          minMatchScore: params.minMatchScore,
          enableAutoReconciliation: params.enableAutoReconciliation
        }));
      }
    } catch (error) {
      console.error("Error cargando parámetros de conciliación:", error);
      // Mostrar el mensaje de error
      setParamsMessage({
        type: 'error',
        text: "Error cargando parámetros de conciliación. Se usarán valores por defecto."
      });
      
      // Ocultar el mensaje después de 5 segundos
      setTimeout(() => {
        setParamsMessage(null);
      }, 5000);
    }
  };

  const handleCreateRule = async () => {
    if (!selectedCompany) return;
    
    try {
      const newRule = await rulesService.createRule({
        company_id: selectedCompany.id,
        rule_name: formData.rule_name,
        description_pattern: formData.description_pattern || undefined,
        amount_pattern: formData.amount_pattern || undefined,
        transaction_type: formData.transaction_type || undefined,
        rule_priority: formData.rule_priority
      });
      
      setRules(prev => [...prev, newRule]);
      resetForm();
      setOpenDialog(false);
      
      alert("Regla creada correctamente");
    } catch (error) {
      console.error("Error creando regla:", error);
      alert("No se pudo crear la regla de conciliación.");
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;
    
    try {
      const updatedRule = await rulesService.updateRule({
        id: editingRule.id,
        rule_name: formData.rule_name,
        description_pattern: formData.description_pattern || undefined,
        amount_pattern: formData.amount_pattern || undefined,
        transaction_type: formData.transaction_type || undefined,
        rule_priority: formData.rule_priority
      });
      
      setRules(prev => prev.map(rule => 
        rule.id === updatedRule.id ? updatedRule : rule
      ));
      
      resetForm();
      setOpenDialog(false);
      setEditingRule(null);
      
      alert("Regla actualizada correctamente");
    } catch (error) {
      console.error("Error actualizando regla:", error);
      alert("No se pudo actualizar la regla de conciliación.");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("¿Está seguro que desea eliminar esta regla? Esta acción no se puede deshacer.")) {
      return;
    }
    
    try {
      await rulesService.deleteRule(ruleId);
      setRules(prev => prev.filter(rule => rule.id !== ruleId));
      
      alert("Regla eliminada correctamente");
    } catch (error) {
      console.error("Error eliminando regla:", error);
      alert("No se pudo eliminar la regla de conciliación.");
    }
  };

  const handleToggleStatus = async (ruleId: string, isActive: boolean) => {
    try {
      const updatedRule = await rulesService.toggleRuleStatus(ruleId, !isActive);
      setRules(prev => prev.map(rule => 
        rule.id === updatedRule.id ? updatedRule : rule
      ));
    } catch (error) {
      console.error("Error cambiando estado de la regla:", error);
      alert("No se pudo cambiar el estado de la regla.");
    }
  };

  const openEditDialog = (rule: ReconciliationRule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      description_pattern: rule.description_pattern || '',
      amount_pattern: rule.amount_pattern || '',
      transaction_type: rule.transaction_type || '',
      rule_priority: rule.rule_priority
    });
    setOpenDialog(true);
  };

  const resetForm = () => {
    setFormData({
      rule_name: '',
      description_pattern: '',
      amount_pattern: '',
      transaction_type: 'any',
      rule_priority: 10
    });
  };

  // Resetear a valores predeterminados
  const resetToDefaults = () => {
    setToleranceDays(7);
    setAmountTolerance(1);
    setDateWeight(30);
    setAmountWeight(50);
    setDescriptionWeight(20);
    setMinMatchScore(70);
    setEnableAutoReconciliation(true);
    
    setParamsMessage({
      type: 'success',
      text: "Parámetros restablecidos a valores predeterminados. Haga clic en Guardar para aplicar los cambios."
    });
    
    // Ocultar el mensaje después de 5 segundos
    setTimeout(() => {
      setParamsMessage(null);
    }, 5000);
  };

  // Guardar parámetros generales de conciliación
  const saveParams = async () => {
    if (!selectedCompany) return;
    
    setSavingParams(true);
    setParamsMessage(null);
    
    try {
      // Guardar en localStorage primero como respaldo
      localStorage.setItem(`reconciliation_params_${selectedCompany.id}`, JSON.stringify({
        tolerance_days: toleranceDays,
        amount_tolerance: amountTolerance,
        dateWeight: dateWeight,
        amountWeight: amountWeight,
        descriptionWeight: descriptionWeight,
        minMatchScore: minMatchScore,
        enableAutoReconciliation: enableAutoReconciliation
      }));
      
      const params = await rulesService.saveReconciliationParams({
        company_id: selectedCompany.id,
        tolerance_days: toleranceDays,
        amount_tolerance: amountTolerance,
        dateWeight: dateWeight,
        amountWeight: amountWeight,
        descriptionWeight: descriptionWeight,
        minMatchScore: minMatchScore,
        enableAutoReconciliation: enableAutoReconciliation
      });
      
      setParamsMessage({
        type: 'success',
        text: `Parámetros guardados correctamente`
      });
      
      // Actualizar los valores locales por si la API los modificó
      setToleranceDays(params.tolerance_days);
      setAmountTolerance(params.amount_tolerance);
      if (params.dateWeight !== undefined) setDateWeight(params.dateWeight);
      if (params.amountWeight !== undefined) setAmountWeight(params.amountWeight);
      if (params.descriptionWeight !== undefined) setDescriptionWeight(params.descriptionWeight);
      if (params.minMatchScore !== undefined) setMinMatchScore(params.minMatchScore);
      if (params.enableAutoReconciliation !== undefined) setEnableAutoReconciliation(params.enableAutoReconciliation);
    } catch (error) {
      console.error("Error guardando parámetros de conciliación:", error);
      setParamsMessage({
        type: 'error',
        text: "No se pudieron guardar los parámetros de conciliación en el servidor, pero se guardaron localmente."
      });
    } finally {
      setSavingParams(false);
      
      // Ocultar el mensaje después de 5 segundos
      setTimeout(() => {
        setParamsMessage(null);
      }, 5000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {loadingCompanies && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                Cargando empresas...
              </p>
            </div>
          </div>
        </div>
      )}
      
      {companiesError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                No se pudieron cargar las empresas: {companiesError}
              </p>
              <p className="mt-2 text-sm">
                Intente abrir la página nuevamente. Si el problema persiste, contacte al administrador.
              </p>
              <p className="mt-1 text-xs text-red-500">
                Nota técnica: Verifique si está accediendo a través del puerto correcto.
                La URL del servidor es: http://localhost:3001
              </p>
            </div>
          </div>
        </div>
      )}
      
      {companies.length === 0 && !loadingCompanies && !companiesError && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 011 1v4a1 1 0 11-2 0V7a1 1 0 011-1zm0 8a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                No hay empresas disponibles
              </p>
              <p className="mt-2 text-sm">
                No se encontraron empresas asociadas a su cuenta. Contacte al administrador para solicitar acceso.
              </p>
              <p className="mt-1 text-xs text-yellow-600">
                Si acaba de crear una empresa, intente refrescar la página.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedCompany && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                Empresa seleccionada: {selectedCompany.name}
              </p>
              <p className="mt-1 text-xs">
                ID: {selectedCompany.id}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reglas de Conciliación</h1>
        <div className="flex gap-4 items-center">
          <div className="flex items-center">
            <Label className="mr-2">Empresa:</Label>
            <Select 
              value={selectedCompany?.id || ''}
              onValueChange={(value) => {
                const company = companies.find(c => c.id === value);
                if (company) setSelectedCompany(company);
              }}
              disabled={loadingCompanies || companies.length === 0}
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
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button 
                disabled={!selectedCompany}
                onClick={() => {
                  setEditingRule(null);
                  resetForm();
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Nueva Regla
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>{editingRule ? 'Editar Regla' : 'Crear Regla de Conciliación'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="rule_name">Nombre de la regla *</Label>
                  <Input
                    id="rule_name"
                    value={formData.rule_name}
                    onChange={(e) => setFormData({...formData, rule_name: e.target.value})}
                    placeholder="Ej: Regla para pagos a proveedores"
                    required
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="description_pattern">Patrón de descripción</Label>
                  <Input
                    id="description_pattern"
                    value={formData.description_pattern}
                    onChange={(e) => setFormData({...formData, description_pattern: e.target.value})}
                    placeholder="Ej: PAGO FACTURA|TRANSFERENCIA A"
                  />
                  <p className="text-sm text-gray-500">
                    Patrón o fragmentos separados por | que deben estar en la descripción de la transacción.
                  </p>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="amount_pattern">Patrón de monto</Label>
                  <Input
                    id="amount_pattern"
                    value={formData.amount_pattern}
                    onChange={(e) => setFormData({...formData, amount_pattern: e.target.value})}
                    placeholder="Ej: >1000|<100000"
                  />
                  <p className="text-sm text-gray-500">
                    Condiciones de monto separadas por |. Ejemplo: &gt;1000|&lt;100000
                  </p>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="transaction_type">Tipo de transacción</Label>
                  <Select 
                    value={formData.transaction_type} 
                    onValueChange={(value) => setFormData({...formData, transaction_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Cualquier tipo</SelectItem>
                      <SelectItem value="deposit">Depósito</SelectItem>
                      <SelectItem value="withdrawal">Retiro</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                      <SelectItem value="payment">Pago</SelectItem>
                      <SelectItem value="fee">Comisión</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="rule_priority">Prioridad</Label>
                  <Input
                    id="rule_priority"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.rule_priority}
                    onChange={(e) => setFormData({...formData, rule_priority: Number(e.target.value)})}
                  />
                  <p className="text-sm text-gray-500">
                    Las reglas con menor número tienen mayor prioridad.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setOpenDialog(false);
                  resetForm();
                  setEditingRule(null);
                }}>
                  Cancelar
                </Button>
                <Button onClick={editingRule ? handleUpdateRule : handleCreateRule}>
                  {editingRule ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Parámetros de conciliación</CardTitle>
          <CardDescription>
            Estos parámetros controlan la lógica de conciliación automática.
          </CardDescription>
        </CardHeader>
        {loadingCompanies ? (
          <CardContent>
            <div className="flex justify-center p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="ml-3">Cargando empresas...</p>
            </div>
          </CardContent>
        ) : companiesError ? (
          <CardContent>
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
              <p className="font-bold">Error</p>
              <p>{companiesError}</p>
              <p className="mt-2">Revise su conexión a internet y vuelva a intentarlo. Si el problema persiste, contacte al administrador.</p>
            </div>
          </CardContent>
        ) : companies.length === 0 ? (
          <CardContent>
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded">
              <p className="font-bold">No hay empresas disponibles</p>
              <p>No se encontraron empresas asociadas a su cuenta. Contacte al administrador para solicitar acceso.</p>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="tolerance_days">Tolerancia de días</Label>
                  <Input
                    id="tolerance_days"
                    type="number"
                    min="0"
                    max="30"
                    value={toleranceDays}
                    onChange={(e) => setToleranceDays(Number(e.target.value))}
                  />
                  <p className="text-sm text-gray-500">
                    Número máximo de días de diferencia permitidos entre fechas para considerar una coincidencia.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount_tolerance">Tolerancia de monto (%)</Label>
                  <Input
                    id="amount_tolerance"
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={amountTolerance}
                    onChange={(e) => setAmountTolerance(Number(e.target.value))}
                  />
                  <p className="text-sm text-gray-500">
                    Porcentaje máximo de diferencia permitido entre montos para considerar una coincidencia.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                >
                  {showAdvancedParams ? 'Ocultar parámetros avanzados' : 'Mostrar parámetros avanzados'}
                </Button>
                {showAdvancedParams && (
                  <Button 
                    variant="outline" 
                    type="button" 
                    onClick={resetToDefaults}
                  >
                    Restablecer valores predeterminados
                  </Button>
                )}
              </div>
              
              {showAdvancedParams && (
                <div className="border p-4 rounded-md bg-gray-50">
                  <h3 className="font-medium text-lg mb-4">Parámetros avanzados de conciliación</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="date_weight">Peso de coincidencia de fecha</Label>
                      <Input
                        id="date_weight"
                        type="number"
                        min="0"
                        max="100"
                        value={dateWeight}
                        onChange={(e) => setDateWeight(Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500">
                        Importancia relativa de la fecha al buscar coincidencias (mayor valor = más importante).
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="amount_weight">Peso de coincidencia de monto</Label>
                      <Input
                        id="amount_weight"
                        type="number"
                        min="0"
                        max="100"
                        value={amountWeight}
                        onChange={(e) => setAmountWeight(Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500">
                        Importancia relativa del monto al buscar coincidencias (mayor valor = más importante).
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description_weight">Peso de coincidencia de descripción</Label>
                      <Input
                        id="description_weight"
                        type="number"
                        min="0"
                        max="100"
                        value={descriptionWeight}
                        onChange={(e) => setDescriptionWeight(Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500">
                        Importancia relativa de la descripción al buscar coincidencias (mayor valor = más importante).
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="min_match_score">Puntuación mínima de coincidencia</Label>
                      <Input
                        id="min_match_score"
                        type="number"
                        min="0"
                        max="100"
                        value={minMatchScore}
                        onChange={(e) => setMinMatchScore(Number(e.target.value))}
                      />
                      <p className="text-sm text-gray-500">
                        Puntuación mínima requerida para considerar una coincidencia (0-100).
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="auto_reconciliation"
                          checked={enableAutoReconciliation}
                          onCheckedChange={setEnableAutoReconciliation}
                        />
                        <Label htmlFor="auto_reconciliation">Habilitar conciliación automática</Label>
                      </div>
                      <p className="text-sm text-gray-500">
                        Si está habilitado, el sistema intentará conciliar automáticamente las transacciones que cumplan con los criterios.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-sm text-amber-600">
                      <strong>Nota:</strong> La suma de los pesos (fecha, monto, descripción) debería ser 100 para resultados óptimos.
                      Actualmente: {dateWeight + amountWeight + descriptionWeight}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end mt-6">
                {paramsMessage && (
                  <div className={`mr-4 px-4 py-2 rounded text-sm ${
                    paramsMessage.type === 'success' 
                      ? 'bg-green-100 text-green-800 border border-green-300' 
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                    {paramsMessage.text}
                  </div>
                )}
                <Button 
                  onClick={saveParams} 
                  disabled={savingParams || !selectedCompany}
                >
                  {savingParams ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    'Guardar parámetros'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas configuradas</CardTitle>
          <CardDescription>
            Las reglas de conciliación ayudan a automatizar el proceso de coincidencia entre transacciones bancarias y registros contables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center p-6">
              <p className="text-gray-500">No hay reglas configuradas. Cree una nueva regla para comenzar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.rule_priority}</TableCell>
                    <TableCell className="font-medium">{rule.rule_name}</TableCell>
                    <TableCell>{rule.description_pattern || "-"}</TableCell>
                    <TableCell>{rule.amount_pattern || "-"}</TableCell>
                    <TableCell>{rule.transaction_type || "Cualquiera"}</TableCell>
                    <TableCell>
                      <Switch 
                        checked={rule.is_active} 
                        onCheckedChange={() => handleToggleStatus(rule.id, rule.is_active)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm" 
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            Ayuda sobre reglas de conciliación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">¿Qué son las reglas de conciliación?</h3>
              <p className="text-sm text-gray-500">
                Las reglas de conciliación son criterios personalizados que el sistema utiliza para mejorar
                el proceso automático de coincidencia entre transacciones bancarias y registros contables.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-1">Patrones de descripción</h3>
              <p className="text-sm text-gray-500">
                Puede especificar palabras clave o fragmentos que suelen aparecer en las descripciones de 
                transacciones. Separe múltiples patrones con "|". Ejemplo: "PAGO|TRANSFERENCIA".
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-1">Patrones de monto</h3>
              <p className="text-sm text-gray-500">
                Defina condiciones para los montos utilizando los símbolos "&gt;" (mayor que), "&lt;" (menor que)
                o rangos. Ejemplos: "&gt;1000" (más de 1000), "&lt;5000" (menos de 5000), "=15000" (exactamente 15000).
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-1">Prioridad</h3>
              <p className="text-sm text-gray-500">
                Las reglas se aplican en orden de prioridad (números más bajos tienen mayor prioridad).
                Si una transacción coincide con varias reglas, se aplicará la de mayor prioridad.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 