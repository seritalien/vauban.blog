# Améliorations UI/UX Immédiates

## Statut Actuel

### Composants déjà créés
- [x] `FieldWithAI` - Champs avec bouton AI intégré
- [x] `FloatingAIToolbar` - Toolbar flottante sur sélection de texte
- [x] `ArticleContent` - Rendu Markdown amélioré avec copy, anchors, zoom
- [x] `ReadingProgress` - Barre de progression de lecture
- [x] `JsonLd` - SEO structured data

### Intégrations terminées
- [x] FieldWithAI intégré dans PostEditor (Title, Excerpt)
- [x] FloatingAIToolbar intégré dans PostEditor
- [x] ReadingProgress + ArticleContent dans page article
- [x] JSON-LD SEO dans page article

---

## Améliorations à Implémenter

### 1. Micro-interactions & Animations

```tsx
// components/ui/AnimatedButton.tsx
import { motion } from 'framer-motion';

export const AnimatedButton = ({ children, ...props }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    {...props}
  >
    {children}
  </motion.button>
);
```

**Fichiers à créer**:
- `components/ui/AnimatedButton.tsx`
- `components/ui/AnimatedCard.tsx`
- `components/ui/Skeleton.tsx`
- `components/ui/Toast.tsx`

### 2. Skeleton Loaders

```tsx
// components/ui/Skeleton.tsx
export const ArticleSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4" />
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
  </div>
);

export const EditorSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
  </div>
);
```

### 3. Toast Notifications

```tsx
// components/ui/Toast.tsx
import { motion, AnimatePresence } from 'framer-motion';

export const Toast = ({ message, type, onClose }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        'bg-blue-500'
      } text-white`}
    >
      {message}
    </motion.div>
  </AnimatePresence>
);
```

### 4. Améliorations Header

```tsx
// Scroll-aware header avec blur
const Header = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`
      fixed top-0 w-full z-50 transition-all duration-300
      ${scrolled
        ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg shadow-sm'
        : 'bg-transparent'
      }
    `}>
      {/* ... */}
    </header>
  );
};
```

### 5. Article Cards Améliorées

```tsx
// components/article/ArticleCard.tsx
export const ArticleCard = ({ article }) => (
  <motion.article
    whileHover={{ y: -4 }}
    className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-xl transition-shadow"
  >
    {/* Cover image avec overlay */}
    <div className="relative h-48 overflow-hidden">
      <img
        src={article.coverImage}
        alt={article.title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Tags overlay */}
      <div className="absolute bottom-2 left-2 flex gap-1">
        {article.tags.slice(0, 2).map(tag => (
          <span key={tag} className="px-2 py-1 text-xs bg-white/20 backdrop-blur rounded-full text-white">
            {tag}
          </span>
        ))}
      </div>
    </div>

    <div className="p-4">
      <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
        {article.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4">
        {article.excerpt}
      </p>

      {/* Footer avec author et read time */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <img src={article.author.avatar} className="w-6 h-6 rounded-full" />
          <span>{article.author.name}</span>
        </div>
        <span>{article.readTime} min read</span>
      </div>
    </div>

    {/* Hover border effect */}
    <div className="absolute inset-0 border-2 border-transparent group-hover:border-purple-500/50 rounded-xl transition-colors pointer-events-none" />
  </motion.article>
);
```

### 6. Dark Mode Toggle Amélioré

```tsx
// components/ui/ThemeToggle.tsx
export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <motion.button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="relative w-14 h-7 rounded-full bg-gray-200 dark:bg-gray-700"
    >
      <motion.div
        className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center"
        animate={{ left: theme === 'dark' ? 'calc(100% - 24px)' : '4px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        {theme === 'dark' ? '🌙' : '☀️'}
      </motion.div>
    </motion.button>
  );
};
```

### 7. Command Palette (Cmd+K)

```tsx
// components/ui/CommandPalette.tsx
import { Dialog } from '@headlessui/react';

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const commands = [
    { id: 'new', name: 'New Article', icon: '📝', action: () => router.push('/admin') },
    { id: 'search', name: 'Search Articles', icon: '🔍', action: () => {} },
    { id: 'drafts', name: 'View Drafts', icon: '📋', action: () => router.push('/admin/drafts') },
    { id: 'settings', name: 'Settings', icon: '⚙️', action: () => router.push('/admin/settings') },
    { id: 'theme', name: 'Toggle Theme', icon: '🌓', action: () => toggleTheme() },
  ];

  return (
    <Dialog open={open} onClose={() => setOpen(false)} className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" />
      <div className="fixed inset-x-4 top-20 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden"
        >
          <input
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-3 border-b dark:border-gray-700 bg-transparent focus:outline-none"
          />
          <ul className="max-h-80 overflow-auto py-2">
            {commands
              .filter(cmd => cmd.name.toLowerCase().includes(query.toLowerCase()))
              .map(cmd => (
                <li
                  key={cmd.id}
                  onClick={() => { cmd.action(); setOpen(false); }}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-3"
                >
                  <span>{cmd.icon}</span>
                  <span>{cmd.name}</span>
                </li>
              ))
            }
          </ul>
        </motion.div>
      </div>
    </Dialog>
  );
};
```

### 8. Table of Contents Flottante

```tsx
// components/article/TableOfContents.tsx
export const TableOfContents = ({ headings }) => {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0% -35% 0%' }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  return (
    <nav className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-auto">
      <h4 className="text-sm font-semibold mb-4 text-gray-500 uppercase tracking-wide">
        On this page
      </h4>
      <ul className="space-y-2">
        {headings.map(({ id, text, level }) => (
          <li key={id} style={{ paddingLeft: `${(level - 2) * 12}px` }}>
            <a
              href={`#${id}`}
              className={`
                text-sm block py-1 border-l-2 pl-3 transition-colors
                ${activeId === id
                  ? 'text-purple-600 border-purple-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
```

### 9. Infinite Scroll avec Virtualization

```tsx
// components/article/ArticleList.tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';

export const ArticleList = () => {
  const parentRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['articles'],
    queryFn: ({ pageParam = 0 }) => fetchArticles(pageParam),
    getNextPageParam: (lastPage, pages) => lastPage.nextCursor,
  });

  const allArticles = data?.pages.flatMap(page => page.articles) ?? [];

  const virtualizer = useVirtualizer({
    count: hasNextPage ? allArticles.length + 1 : allArticles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 350,
    overscan: 5,
  });

  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1);
    if (lastItem && lastItem.index >= allArticles.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), hasNextPage, isFetchingNextPage, fetchNextPage, allArticles.length]);

  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {virtualRow.index < allArticles.length ? (
              <ArticleCard article={allArticles[virtualRow.index]} />
            ) : (
              <div className="p-4 text-center">Loading more...</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 10. Form Validation Améliorée

```tsx
// hooks/useFormValidation.ts
export const useFormValidation = (schema: ZodSchema) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validate = (data: unknown) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const path = issue.path.join('.');
        newErrors[path] = issue.message;
      });
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const getFieldError = (field: string) => touched[field] ? errors[field] : undefined;

  const handleBlur = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  return { validate, getFieldError, handleBlur, errors, setErrors };
};

// Usage in form
<input
  onBlur={() => handleBlur('title')}
  className={getFieldError('title') ? 'border-red-500' : ''}
/>
{getFieldError('title') && (
  <motion.p
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-red-500 text-sm mt-1"
  >
    {getFieldError('title')}
  </motion.p>
)}
```

---

## Installation des dépendances nécessaires

```bash
pnpm add framer-motion @headlessui/react @tanstack/react-virtual @tanstack/react-query
```

---

## Priorité d'implémentation

### Haute priorité (cette semaine)
1. Skeleton loaders
2. Toast notifications
3. Micro-interactions (boutons, cards)
4. Header scroll-aware

### Moyenne priorité (semaine prochaine)
5. Command palette (Cmd+K)
6. Article cards améliorées
7. Table of contents flottante
8. Dark mode toggle amélioré

### Basse priorité (plus tard)
9. Infinite scroll virtualisé
10. Form validation améliorée
