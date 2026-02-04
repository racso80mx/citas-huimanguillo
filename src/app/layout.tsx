import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/layout/header';
import { SiteFooter } from '@/components/layout/footer';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { PT_Sans } from 'next/font/google';
import { getModuleSettings } from '@/lib/data';

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-pt-sans',
});

export const metadata: Metadata = {
  title: 'CitaMedicaFacil',
  description:
    'Agenda tu cita médica de forma fácil y rápida en Huimanguillo, Tabasco.',
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
        className={`${ptSans.variable} font-body antialiased min-h-screen bg-background flex flex-col`}
      >
        <FirebaseClientProvider>
          <SiteHeader moduleSettings={moduleSettings} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
