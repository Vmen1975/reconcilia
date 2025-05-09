import { CompanyDetailsClient } from './client';

// Este es un componente del lado del servidor
export default async function CompanyDetailsPage({ params }: { params: { id: string } }) {
  // En un componente de servidor, podemos acceder a params.id directamente sin problemas
  // Y luego pasarlo como prop a un componente cliente
  const id = params.id;
  
  return <CompanyDetailsClient id={id} />;
} 