import type { BankAccount, CreateBankAccountDTO, UpdateBankAccountDTO } from '@/types';

export async function getBankAccounts(companyId: string): Promise<BankAccount[]> {
  try {
    const response = await fetch(`/api/bank-accounts?companyId=${encodeURIComponent(companyId)}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error al obtener cuentas bancarias:', errorData);
      throw new Error(errorData.error || 'Error al obtener cuentas bancarias');
    }
    
    const data = await response.json();
    return data as BankAccount[];
  } catch (error) {
    console.error('Excepción al obtener cuentas bancarias:', error);
    throw error;
  }
}

export async function getBankAccount(id: string): Promise<BankAccount> {
  try {
    const response = await fetch(`/api/bank-accounts/${id}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Error al obtener cuenta bancaria ${id}:`, errorData);
      throw new Error(errorData.error || 'Error al obtener cuenta bancaria');
    }
    
    const data = await response.json();
    return data as BankAccount;
  } catch (error) {
    console.error(`Excepción al obtener cuenta bancaria ${id}:`, error);
    throw error;
  }
}

export async function createBankAccount(bankAccount: CreateBankAccountDTO): Promise<BankAccount> {
  try {
    const response = await fetch('/api/bank-accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bankAccount),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error al crear cuenta bancaria:', errorData);
      throw new Error(errorData.error || 'Error al crear cuenta bancaria');
    }
    
    const data = await response.json();
    return data as BankAccount;
  } catch (error) {
    console.error('Excepción al crear cuenta bancaria:', error);
    throw error;
  }
}

export async function updateBankAccount(id: string, bankAccount: UpdateBankAccountDTO): Promise<BankAccount> {
  try {
    const response = await fetch(`/api/bank-accounts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bankAccount),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Error al actualizar cuenta bancaria ${id}:`, errorData);
      throw new Error(errorData.error || 'Error al actualizar cuenta bancaria');
    }
    
    const data = await response.json();
    return data as BankAccount;
  } catch (error) {
    console.error(`Excepción al actualizar cuenta bancaria ${id}:`, error);
    throw error;
  }
}

export async function deleteBankAccount(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/bank-accounts/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Error al eliminar cuenta bancaria ${id}:`, errorData);
      throw new Error(errorData.error || 'Error al eliminar cuenta bancaria');
    }
  } catch (error) {
    console.error(`Excepción al eliminar cuenta bancaria ${id}:`, error);
    throw error;
  }
} 