import { Fragment, ReactNode, useState, useEffect } from 'react';
import { Dialog, Menu, Transition } from '@headlessui/react';
import {
  Bars3Icon,
  HomeIcon,
  XMarkIcon,
  BanknotesIcon,
  DocumentTextIcon,
  CogIcon,
  UserGroupIcon,
  AdjustmentsHorizontalIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useNavigation } from '@/lib/hooks/useNavigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>;
  children?: NavigationItem[];
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { 
    name: 'Conciliación', 
    href: '/dashboard/reconciliation', 
    icon: BanknotesIcon, 
    children: [
      { name: 'Conciliaciones Realizadas', href: '/dashboard/reconciliation/reconciled', icon: CheckCircleIcon }
    ]
  },
  { name: 'Transacciones', href: '/dashboard/transactions', icon: DocumentTextIcon },
  { name: 'Empresas', href: '/dashboard/companies', icon: UserGroupIcon },
  { name: 'Parámetros Conciliación', href: '/dashboard/configuration/rules', icon: AdjustmentsHorizontalIcon },
  { name: 'Configuración', href: '/settings', icon: CogIcon },
];

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { isCurrentPath } = useNavigation();
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        setUserEmail(user.email);
      }
    };
    
    getUser();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      <div>
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-900/80" />
            </Transition.Child>

            <div className="fixed inset-0 flex">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                  <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
                    <div className="flex h-16 shrink-0 items-center">
                      <img
                        className="h-8 w-auto"
                        src="/logo.svg"
                        alt="Reconcilia"
                      />
                    </div>
                    <nav className="flex flex-1 flex-col">
                      <ul role="list" className="flex flex-1 flex-col gap-y-7">
                        <li>
                          <ul role="list" className="-mx-2 space-y-1">
                            {navigation.map((item) => (
                              <li key={item.name}>
                                <Link
                                  href={item.href}
                                  className={`
                                    group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
                                    ${isCurrentPath(item.href)
                                      ? 'bg-gray-50 text-indigo-600'
                                      : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                    }
                                  `}
                                >
                                  <item.icon
                                    className={`
                                      h-6 w-6 shrink-0
                                      ${isCurrentPath(item.href)
                                        ? 'text-indigo-600'
                                        : 'text-gray-400 group-hover:text-indigo-600'
                                      }
                                    `}
                                    aria-hidden="true"
                                  />
                                  {item.name}
                                </Link>
                                {item.children && (
                                  <ul className="mt-1 ml-8 space-y-1">
                                    {item.children.map((child) => (
                                      <li key={child.name}>
                                        <Link
                                          href={child.href}
                                          className={`
                                            group flex gap-x-3 rounded-md p-2 text-sm leading-6
                                            ${isCurrentPath(child.href)
                                              ? 'font-semibold bg-gray-50 text-indigo-600'
                                              : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                            }
                                          `}
                                        >
                                          <child.icon
                                            className={`
                                              h-5 w-5 shrink-0
                                              ${isCurrentPath(child.href)
                                                ? 'text-indigo-600'
                                                : 'text-gray-400 group-hover:text-indigo-600'
                                              }
                                            `}
                                            aria-hidden="true"
                                          />
                                          <span className="truncate">{child.name}</span>
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                        </li>
                      </ul>
                    </nav>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Static sidebar for desktop */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
          <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center">
              <img
                className="h-8 w-auto"
                src="/logo.svg"
                alt="Reconcilia"
              />
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {navigation.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={`
                            group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
                            ${isCurrentPath(item.href)
                              ? 'bg-gray-50 text-indigo-600'
                              : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                            }
                          `}
                        >
                          <item.icon
                            className={`
                              h-6 w-6 shrink-0
                              ${isCurrentPath(item.href)
                                ? 'text-indigo-600'
                                : 'text-gray-400 group-hover:text-indigo-600'
                              }
                            `}
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                        {item.children && (
                          <ul className="mt-1 ml-8 space-y-1">
                            {item.children.map((child) => (
                              <li key={child.name}>
                                <Link
                                  href={child.href}
                                  className={`
                                    group flex gap-x-3 rounded-md p-2 text-sm leading-6
                                    ${isCurrentPath(child.href)
                                      ? 'font-semibold bg-gray-50 text-indigo-600'
                                      : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
                                    }
                                  `}
                                >
                                  <child.icon
                                    className={`
                                      h-5 w-5 shrink-0
                                      ${isCurrentPath(child.href)
                                        ? 'text-indigo-600'
                                        : 'text-gray-400 group-hover:text-indigo-600'
                                      }
                                    `}
                                    aria-hidden="true"
                                  />
                                  <span className="truncate">{child.name}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="lg:pl-72">
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <button
              type="button"
              className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Abrir menú</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Separator */}
            <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1" />
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                {/* Profile dropdown */}
                <Menu as="div" className="relative">
                  <Menu.Button className="-m-1.5 flex items-center p-1.5">
                    <span className="sr-only">Abrir menú de usuario</span>
                    <img
                      className="h-8 w-8 rounded-full bg-gray-50"
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                      alt=""
                    />
                    <span className="hidden lg:flex lg:items-center">
                      <span className="ml-4 text-sm font-semibold leading-6 text-gray-900" aria-hidden="true">
                        {userEmail || "Usuario"}
                      </span>
                    </span>
                  </Menu.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                      <Menu.Item>
                        {({ active }) => (
                          <a
                            href="#"
                            className={`
                              block px-3 py-1 text-sm leading-6
                              ${active ? 'bg-gray-50' : ''}
                              text-gray-900
                            `}
                          >
                            Mi perfil
                          </a>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <a
                            href="#"
                            onClick={handleSignOut}
                            className={`
                              block px-3 py-1 text-sm leading-6
                              ${active ? 'bg-gray-50' : ''}
                              text-gray-900
                            `}
                          >
                            Cerrar sesión
                          </a>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>
              </div>
            </div>
          </div>

          <main className="py-10">
            <div className="px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
} 