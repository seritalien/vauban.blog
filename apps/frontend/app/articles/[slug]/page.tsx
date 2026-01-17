'use client';

import { usePost } from '@/hooks/use-posts';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import CommentSection from '@/components/comments/CommentSection';

export default function ArticlePage({ params }: { params: { slug: string } }) {
  // In real app, we'd need to map slug to postId
  // For now, we'll use a hook that fetches by slug
  const { post, isLoading, error } = usePost(params.slug);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading article...</p>
        </div>
      </div>
    );
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

  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      {post.coverImage && (
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full h-96 object-cover rounded-lg mb-8"
        />
      )}

      <header className="mb-8">
        <div className="flex gap-2 mb-4">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded"
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="text-5xl font-bold mb-4">{post.title}</h1>

        <div className="flex items-center justify-between text-gray-600">
          <div className="flex items-center gap-4">
            <time dateTime={post.createdAt.toISOString()}>
              {format(post.createdAt, 'MMMM d, yyyy')}
            </time>
            {post.readingTimeMinutes && (
              <span>{post.readingTimeMinutes} min read</span>
            )}
          </div>

          {post.isPaid && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded font-semibold">
              {post.price} STRK
            </span>
          )}
        </div>
      </header>

      <div className="prose prose-lg max-w-none mb-12">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {post.content}
        </ReactMarkdown>
      </div>

      {/* Arweave + IPFS Info */}
      <div className="border-t pt-6 mb-12">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Storage</h3>
        <div className="grid gap-2 text-sm text-gray-600">
          <div>
            <span className="font-semibold">Arweave:</span>{' '}
            <a
              href={`https://arweave.net/${post.arweaveTxId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {post.arweaveTxId}
            </a>
          </div>
          <div>
            <span className="font-semibold">IPFS:</span>{' '}
            <a
              href={`http://localhost:8080/ipfs/${post.ipfsCid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {post.ipfsCid}
            </a>
          </div>
        </div>
      </div>

      {/* Comments Section - Phase 5 Integration */}
      <CommentSection postId={post.id} />
    </article>
  );
}
