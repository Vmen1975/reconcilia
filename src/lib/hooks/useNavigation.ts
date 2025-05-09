import { usePathname } from 'next/navigation';

export const useNavigation = () => {
  const pathname = usePathname();

  const isCurrentPath = (path: string) => {
    return pathname === path;
  };

  return {
    pathname,
    isCurrentPath,
  };
}; 