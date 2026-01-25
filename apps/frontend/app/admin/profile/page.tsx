import { redirect } from 'next/navigation';

// Redirect to unified profile page (settings tab)
export default function ProfileSettingsPage() {
  redirect('/profile?tab=settings');
}
