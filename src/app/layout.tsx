import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Reconcilia - Sistema de Conciliación Bancaria',
  description: 'Sistema de conciliación bancaria para empresas',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full bg-white">
      <body className={`${inter.className} h-full`}>{children}</body>
    </html>
  );
}
