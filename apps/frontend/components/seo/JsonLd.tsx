import type { FC } from 'react';

export interface JsonLdProps {
  data: Record<string, unknown>;
}

/**
 * Component to embed JSON-LD structured data in a page.
 * This improves SEO by providing search engines with rich metadata.
 */
export const JsonLd: FC<JsonLdProps> = ({ data }) => {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
};

export default JsonLd;
