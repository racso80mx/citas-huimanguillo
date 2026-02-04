'use server';
import HomePageContent from './page-content';
import { getModuleSettings } from '@/lib/data';

export default async function HomePage() {
  const moduleSettings = await getModuleSettings();
  return <HomePageContent moduleSettings={moduleSettings} />;
}
