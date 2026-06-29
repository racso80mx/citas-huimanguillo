
import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/layout/header';
import { SiteFooter } from '@/components/layout/footer';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { PT_Sans } from 'next/font/google';
import { getModuleSettings } from '@/lib/data';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-pt-sans',
});

export const metadata: Metadata = {
  title: 'Hospital General Huimanguillo',
  description:
    'Portal de servicios médicos y citas del Hospital General de Huimanguillo, Tabasco.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const moduleSettings = await getModuleSettings();
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${ptSans.variable} font-body antialiased min-h-screen bg-background p-0 m-0`}
      >
        <FirebaseClientProvider>
          <SidebarProvider defaultOpen={false}>
            <AppSidebar moduleSettings={moduleSettings} />
            <SidebarInset className="flex flex-col m-0 p-0 rounded-none border-none shadow-none bg-background w-full max-w-none">
              <SiteHeader moduleSettings={moduleSettings} />
              <main className="flex-1 w-full p-0 m-0 overflow-x-hidden bg-background">
                {children}
              </main>
              <SiteFooter />
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
