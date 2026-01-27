import { redirect } from 'next/navigation';

/**
 * /blog redirects to the homepage which serves as the blog view.
 * The timeline/social view lives at /feed.
 */
export default function BlogPage() {
  redirect('/');
}
