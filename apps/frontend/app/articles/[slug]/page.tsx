'use client';

import React, { useState, useEffect, useCallback } from 'react';
import nextDynamic from 'next/dynamic';
import { usePost } from '@/hooks/use-posts';

// Disable static generation for this page (requires IPFS/Arweave client-side)
export const dynamic = 'force-dynamic';
import { format } from 'date-fns';
import Paywall from '@/components/paywall/Paywall';
import { ArticleDetailSkeleton } from '@/components/ui/Skeleton';
import Link from 'next/link';
import { getProfile, formatAddress, getDisplayName, toAddressString } from '@/lib/profiles';
import { type AuthorProfile } from '@vauban/shared-types';
import TableOfContents from '@/components/article/TableOfContents';
import JsonLd from '@/components/seo/JsonLd';
import { generateArticleJsonLd, generateBreadcrumbJsonLd } from '@/lib/seo';
import ReadingProgress from '@/components/article/ReadingProgress';
import ArticleContent from '@/components/article/ArticleContent';
import Image from 'next/image';
import { getPublicEnv } from '@/lib/public-env';

// Dynamic imports for heavy components (reduces initial bundle by ~200KB)
const CommentSection = nextDynamic(() => import('@/components/comments/CommentSection'), { ssr: false });
const LikeButton = nextDynamic(() => import('@/components/social/LikeButton'), { ssr: false });
const RelatedArticles = nextDynamic(() => import('@/components/article/RelatedArticles'), { ssr: false });
const ShareButtons = nextDynamic(() => import('@/components/social/ShareButtons'), { ssr: false });
const ReadAloudButton = nextDynamic(() => import('@/components/article/ReadAloudButton'), { ssr: false });

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  // Extract ID from params promise (Next.js 15)
  // Note: using [slug] folder name but actually passing post ID
  const { slug: postId } = React.use(params);

  // Fetch post by numeric ID
  const { post, isLoading, error } = usePost(postId);
  const [authorProfile, setAuthorProfile] = useState<AuthorProfile | null>(null);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);

  // Handle sentence change from TTS
  const handleSentenceChange = useCallback((index: number, _total: number) => {
    void _total; // Unused but required by callback signature
    setCurrentSentenceIndex(index);
  }, []);

  // Load author profile
  useEffect(() => {
    if (post?.author) {
      const authorAddress = toAddressString(post.author);
      const profile = getProfile(authorAddress);
      setAuthorProfile(profile);
    }
  }, [post?.author]);

  if (isLoading) {
    return <ArticleDetailSkeleton />;
  }

  if (error || !post) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          <h2 className="font-bold mb-2">Error</h2>
          <p>{error || 'Article not found'}</p>
        </div>
      </div>
    );
  }

  // Generate SEO data
  const siteUrl = getPublicEnv('NEXT_PUBLIC_SITE_URL') || 'https://vauban.blog';
  const articleUrl = `${siteUrl}/articles/${postId}`;
  const authorName = getDisplayName(post.author, authorProfile);

  const articleTitle = post.title || 'Untitled';
  const articleExcerpt = post.excerpt || '';

  const articleJsonLd = generateArticleJsonLd({
    title: articleTitle,
    description: articleExcerpt,
    content: post.content,
    url: articleUrl,
    image: post.coverImage,
    publishedTime: post.createdAt.toISOString(),
    author: {
      name: authorName,
      url: `${siteUrl}/authors/${toAddressString(post.author)}`,
    },
    tags: post.tags,
  });

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: siteUrl },
    { name: 'Articles', url: `${siteUrl}/articles` },
    { name: articleTitle, url: articleUrl },
  ]);

  return (
    <>
      {/* Reading Progress Indicator */}
      <ReadingProgress />

      {/* SEO Structured Data */}
      <JsonLd data={articleJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <article className="container mx-auto px-4 py-12 max-w-4xl">
        {post.coverImage && (
        <div className="relative w-full h-96 rounded-lg overflow-hidden mb-8">
          <Image
            src={post.coverImage}
            alt={post.title ?? ''}
            fill
            sizes="(max-width: 768px) 100vw, 896px"
            className="object-cover"
            priority
          />
        </div>
      )}

      <header className="mb-6 sm:mb-8">
        <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
          {(post.tags ?? []).map((tag) => (
            <span
              key={tag}
              className="px-2 sm:px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs sm:text-sm rounded"
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">{post.title}</h1>

        {/* Author info */}
        <Link href={`/authors/${toAddressString(post.author)}`} className="flex items-center gap-3 mb-4 group">
          {authorProfile?.avatar ? (
            <Image
              src={authorProfile.avatar}
              alt={getDisplayName(post.author, authorProfile)}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {getDisplayName(post.author, authorProfile).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {getDisplayName(post.author, authorProfile)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {formatAddress(post.author)}
            </div>
          </div>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-gray-600 dark:text-gray-400">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm sm:text-base">
            <time dateTime={post.createdAt.toISOString()}>
              {format(post.createdAt, 'MMM d, yyyy')}
            </time>
            {post.readingTimeMinutes && (
              <span>{post.readingTimeMinutes} min read</span>
            )}
            <LikeButton targetId={post.id} targetType="post" size="md" />
          </div>

          {post.isPaid && (
            <span className="self-start sm:self-auto px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded font-semibold text-sm">
              {post.price} STRK
            </span>
          )}
        </div>

        {/* Share Buttons + Read Aloud */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
          <ShareButtons
            url={typeof window !== 'undefined' ? window.location.href : `https://vauban.blog/articles/${post.id}`}
            title={articleTitle}
            excerpt={articleExcerpt}
          />
          <ReadAloudButton content={post.content} onSentenceChange={handleSentenceChange} />
        </div>
      </header>

      {/* Table of Contents */}
      <TableOfContents content={post.content} />

      {/* Article Content - wrapped in Paywall if paid */}
      {post.isPaid ? (
        <Paywall postId={post.id} price={post.price.toString()}>
          <ArticleContent content={post.content} className="mb-12" currentSentenceIndex={currentSentenceIndex} />
        </Paywall>
      ) : (
        <ArticleContent content={post.content} className="mb-12" currentSentenceIndex={currentSentenceIndex} />
      )}

      {/* Content Verification + Storage Info */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-12">
        {/* Verification Badge */}
        <div className="mb-4">
          {post.isVerified ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Content Verified (SHA256)
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-sm font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {post.verificationError || 'Verification pending'}
            </div>
          )}
        </div>

        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Storage</h3>
        <div className="grid gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-semibold">Arweave:</span>{' '}
            {post.arweaveTxId.startsWith('ar_') ? (
              <span className="text-gray-400 dark:text-gray-500">{post.arweaveTxId} (simulated)</span>
            ) : (
              <a
                href={`https://arweave.net/${post.arweaveTxId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {post.arweaveTxId}
              </a>
            )}
          </div>
          <div>
            <span className="font-semibold">IPFS:</span>{' '}
            <a
              href={`${getPublicEnv('NEXT_PUBLIC_IPFS_GATEWAY_URL') || 'http://localhost:8005'}/ipfs/${post.ipfsCid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {post.ipfsCid}
            </a>
          </div>
        </div>
      </div>

      {/* Related Articles */}
      <RelatedArticles currentPostId={post.id} tags={post.tags || []} />

      {/* Comments Section - Phase 5 Integration */}
      <CommentSection postId={post.id} />
    </article>
    </>
  );
}
