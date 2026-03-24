'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  FlaskConical,
  Stethoscope,
  Waves,
  ShieldPlus,
  Archive,
  Search,
  Pill,
  BarChart3,
  LayoutGrid,
  ChevronRight,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import type { ModuleSettings } from '@/lib/definitions';

export function AppSidebar({ moduleSettings, ...props }: React.ComponentProps<typeof Sidebar> & { moduleSettings: ModuleSettings }) {
  const pathname = usePathname();

  const menuItems = [
    {
      title: 'Cita Médica',
      url: '/citas-medicas',
      icon: Home,
      enabled: moduleSettings.citasMedicasEnabled,
    },
    {
      title: 'Laboratorio',
      url: '/laboratorio',
      icon: FlaskConical,
      enabled: moduleSettings.laboratorioEnabled,
    },
    {
      title: 'Rayos X',
      url: '/rayos-x',
      icon: Stethoscope,
      enabled: moduleSettings.rayosXEnabled,
    },
    {
      title: 'Ultrasonidos',
      url: '/ultrasonidos',
      icon: Waves,
      enabled: moduleSettings.ultrasoundEnabled,
    },
    {
      title: 'Vacunas',
      url: '/vacunas',
      icon: ShieldPlus,
      enabled: moduleSettings.vacunasEnabled,
    },
    {
      title: 'Archivo (Gestión)',
      url: '/archivo',
      icon: Archive,
      enabled: moduleSettings.archivoEnabled,
    },
    {
      title: 'Consulta Padrón',
      url: '/archivo-consulta',
      icon: Search,
      enabled: moduleSettings.archivoConsultaEnabled,
    },
    {
      title: 'Farmacia',
      url: '/farmacia',
      icon: Pill,
      enabled: moduleSettings.farmaciaEnabled,
    },
    {
      title: 'Business Intelligence',
      url: '/bi',
      icon: BarChart3,
      enabled: true,
    },
    {
      title: 'Reportes Médicos',
      url: '/reports',
      icon: BarChart3,
      enabled: true,
    },
  ];

  const enabledItems = menuItems.filter((item) => item.enabled);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Image
                    src={logoBase64}
                    alt="Logo"
                    width={24}
                    height={24}
                    className="rounded-sm"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold font-headline">CitaMedicaFacil</span>
                  <span className="truncate text-xs text-muted-foreground">Huimanguillo, Tabasco</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos de Atención</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {enabledItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/admin'} tooltip="Administración">
              <Link href="/admin">
                <LayoutGrid />
                <span>Panel Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
