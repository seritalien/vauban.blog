'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-gray-200 dark:bg-gray-700',
        className
      )}
    />
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* Cover image skeleton */}
      <Skeleton className="w-full h-48" />

      <div className="p-6">
        {/* Tags */}
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-6 w-16 rounded" />
          <Skeleton className="h-6 w-20 rounded" />
        </div>

        {/* Title */}
        <Skeleton className="h-8 w-3/4 mb-2" />

        {/* Excerpt */}
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>

        {/* Reading time */}
        <Skeleton className="h-4 w-20 mt-2" />
      </div>
    </div>
  );
}

export function ArticleDetailSkeleton() {
  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Cover image */}
      <Skeleton className="w-full h-96 rounded-lg mb-8" />

      <header className="mb-8">
        {/* Tags */}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-7 w-20 rounded" />
          <Skeleton className="h-7 w-24 rounded" />
          <Skeleton className="h-7 w-16 rounded" />
        </div>

        {/* Title */}
        <Skeleton className="h-14 w-4/5 mb-4" />

        {/* Meta info */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </header>

      {/* Content */}
      <div className="space-y-4 mb-12">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-40 w-full rounded-lg mt-6" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
      </div>

      {/* Storage info */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-12">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-8 w-48 rounded-full mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      {/* Comments section skeleton */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-12">
        <Skeleton className="h-9 w-40 mb-8" />
        <Skeleton className="h-32 w-full rounded mb-4" />
        <Skeleton className="h-10 w-32 rounded" />
      </div>
    </article>
  );
}

export function CommentSkeleton() {
  return (
    <div className="border-l-2 border-gray-200 dark:border-gray-600 pl-4">
      {/* Author and date */}
      <div className="flex items-center gap-3 mb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Content */}
      <div className="space-y-2 mb-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      {/* Like button */}
      <Skeleton className="h-7 w-16 rounded-full" />
    </div>
  );
}

export function CommentsSectionSkeleton() {
  return (
    <section className="border-t border-gray-200 dark:border-gray-700 pt-12">
      <Skeleton className="h-9 w-40 mb-8" />

      {/* Comment form placeholder */}
      <div className="mb-12">
        <Skeleton className="h-32 w-full rounded mb-4" />
        <Skeleton className="h-10 w-32 rounded" />
      </div>

      {/* Comments list */}
      <div className="space-y-6">
        <CommentSkeleton />
        <CommentSkeleton />
        <CommentSkeleton />
      </div>
    </section>
  );
}
