'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { VerifiedPost } from '@/hooks/use-posts';
import { getProfile, getDisplayName, toAddressString } from '@/lib/profiles';

interface SidebarProps {
  posts: VerifiedPost[];
  selectedTag?: string | null;
  onTagSelect?: (tag: string | null) => void;
}

interface TagCount {
  tag: string;
  count: number;
}

interface AuthorStats {
  address: string;
  postCount: number;
  displayName: string;
  avatar?: string;
}

export default function Sidebar({ posts, selectedTag, onTagSelect }: SidebarProps) {
  // Calculate tag counts
  const tagCounts = useMemo<TagCount[]>(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      post.tags?.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [posts]);

  // Calculate top authors
  const topAuthors = useMemo<AuthorStats[]>(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      if (post.author) {
        const addr = toAddressString(post.author);
        counts[addr] = (counts[addr] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([address, postCount]) => {
        const profile = getProfile(address);
        return {
          address,
          postCount,
          displayName: getDisplayName(address, profile),
          avatar: profile?.avatar,
        };
      })
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 5);
  }, [posts]);

  return (
    <aside className="space-y-8">
      {/* Categories/Tags Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Popular Topics
        </h3>

        {tagCounts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No topics yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedTag && (
              <button
                onClick={() => onTagSelect?.(null)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Clear filter
              </button>
            )}
            {tagCounts.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => onTagSelect?.(tag === selectedTag ? null : tag)}
                className={`
                  px-3 py-1.5 text-sm rounded-full transition-colors
                  ${tag === selectedTag
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300'
                  }
                `}
              >
                {tag}
                <span className={`ml-1.5 ${tag === selectedTag ? 'text-blue-200' : 'text-gray-400'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Top Authors Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Top Authors
        </h3>

        {topAuthors.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No authors yet</p>
        ) : (
          <div className="space-y-3">
            {topAuthors.map((author, index) => (
              <Link
                key={author.address}
                href={`/authors/${author.address}`}
                className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
              >
                {/* Rank badge */}
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${index === 0
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : index === 1
                      ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      : index === 2
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                  }
                `}>
                  {index + 1}
                </div>

                {/* Avatar */}
                {author.avatar ? (
                  <img
                    src={author.avatar}
                    alt={author.displayName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                    {author.displayName[0].toUpperCase()}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {author.displayName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {author.postCount} {author.postCount === 1 ? 'article' : 'articles'}
                  </div>
                </div>
              </Link>
            ))}

            <Link
              href="/authors"
              className="block text-center text-sm text-blue-600 dark:text-blue-400 hover:underline mt-4"
            >
              View all authors &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* Newsletter Section */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <h3 className="text-lg font-bold mb-2">Stay Updated</h3>
        <p className="text-sm text-blue-100 mb-4">
          Get the latest articles delivered to your inbox.
        </p>
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder="your@email.com"
            className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 placeholder-blue-200 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
          />
          <button
            type="submit"
            className="w-full px-4 py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
          >
            Subscribe
          </button>
        </form>
        <p className="text-xs text-blue-200 mt-3">
          No spam. Unsubscribe anytime.
        </p>
      </div>

      {/* Quick Links */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Links</h3>
        <nav className="space-y-2">
          <Link
            href="/feed"
            className="flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Timeline Feed
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Write an Article
          </Link>
          <a
            href="https://github.com/vauban-blog"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            GitHub
          </a>
        </nav>
      </div>
    </aside>
  );
}
