import { redirect } from 'next/navigation';

// Redirect to unified profile page
export default function DashboardPage() {
  redirect('/profile');
}
