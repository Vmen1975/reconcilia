import { useState, useEffect } from 'react';
import { companyService } from '@/services/company';

export interface Company {
  id: string;
  name: string;
  rut?: string;
  address?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  is_primary?: boolean;
}

export function useUserCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    // Guardar la selección en localStorage para persistencia
    try {
      localStorage.setItem('selectedCompanyId', company.id);
    } catch (e) {
      console.warn('No se pudo guardar la empresa seleccionada en localStorage', e);
    }
  };
  
  useEffect(() => {
    const fetchUserCompanies = async () => {
      setLoading(true);
      setError(null);
      try {
        // Obtener las empresas del usuario a través del servicio
        const userCompanies = await companyService.getUserCompanies();
        
        if (userCompanies.length > 0) {
          console.log(`Se encontraron ${userCompanies.length} empresas para el usuario`);
          setCompanies(userCompanies);
          
          // Intentar recuperar la empresa seleccionada anteriormente de localStorage
          let companyToSelect = userCompanies[0]; // Por defecto, la primera
          try {
            const savedCompanyId = localStorage.getItem('selectedCompanyId');
            if (savedCompanyId) {
              const savedCompany = userCompanies.find(c => c.id === savedCompanyId);
              if (savedCompany) {
                companyToSelect = savedCompany;
              }
            } else {
              // Si no hay empresa guardada, preferir la empresa primaria
              const primaryCompany = userCompanies.find(c => c.is_primary);
              if (primaryCompany) {
                companyToSelect = primaryCompany;
              }
            }
          } catch (e) {
            console.warn('Error al recuperar empresa seleccionada de localStorage', e);
          }
          
          setSelectedCompany(companyToSelect);
        } else {
          console.warn('No se encontraron empresas para el usuario');
          setCompanies([]);
          setSelectedCompany(null);
        }
      } catch (err) {
        console.error('Error al obtener empresas del usuario:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar empresas');
        setCompanies([]);
        setSelectedCompany(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserCompanies();
  }, []);
  
  return { 
    companies, 
    selectedCompany, 
    setSelectedCompany: handleSelectCompany, 
    loading, 
    error 
  };
} 