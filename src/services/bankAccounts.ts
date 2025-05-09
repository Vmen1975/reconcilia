import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const bankAccountsService = {
  async getBankAccounts(companyId: string) {
    const supabase = createClientComponentClient();
    
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
      
    if (error) {
      console.error('Error al obtener cuentas bancarias:', error);
      throw error;
    }
    
    return data || [];
  },
  
  async getBankAccountById(id: string) {
    const supabase = createClientComponentClient();
    
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) {
      console.error('Error al obtener cuenta bancaria:', error);
      throw error;
    }
    
    return data;
  }
}; 