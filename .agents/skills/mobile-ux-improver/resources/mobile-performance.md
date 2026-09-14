# Mobile Performance Guide

Comprehensive guide for optimizing mobile web performance, Core Web Vitals, and creating fast experiences on constrained devices.

## Table of Contents

1. [Core Web Vitals](#core-web-vitals)
2. [Image Optimization](#image-optimization)
3. [Lazy Loading](#lazy-loading)
4. [Code Splitting](#code-splitting)
5. [Font Loading](#font-loading)
6. [Network Optimization](#network-optimization)
7. [Bundle Size Optimization](#bundle-size-optimization)
8. [Performance Monitoring](#performance-monitoring)

---

## Core Web Vitals

### The Three Metrics

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | 2.5-4.0s | > 4.0s |
| **FID** (First Input Delay) | ≤ 100ms | 100-300ms | > 300ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | 0.1-0.25 | > 0.25 |

### Largest Contentful Paint (LCP)

**What it measures:** Time until largest content element is visible.

**Common LCP elements:**
- Hero images
- Video thumbnails
- Large text blocks
- Background images

**How to improve:**

```typescript
// 1. Preload critical images
<link
  rel="preload"
  as="image"
  href="/hero.jpg"
  fetchpriority="high"
/>

// 2. Optimize image formats
<img
  src="/hero.webp"
  alt="Hero"
  fetchpriority="high"
  loading="eager"  /* Don't lazy load LCP image */
/>

// 3. Use responsive images
<img
  srcSet="
    /hero-mobile.webp 640w,
    /hero-tablet.webp 1024w,
    /hero-desktop.webp 1920w
  "
  sizes="100vw"
  src="/hero-desktop.webp"
  alt="Hero"
/>
```

### First Input Delay (FID)

**What it measures:** Time from user interaction to browser response.

**How to improve:**

```typescript
// 1. Code splitting - load less JS
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// 2. Debounce expensive operations
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    performSearch(query);
  }, 300),
  []
);

// 3. Use web workers for heavy computation
const worker = new Worker('/worker.js');
worker.postMessage({ data: heavyCalculation });
```

### Cumulative Layout Shift (CLS)

**What it measures:** Visual stability (unexpected layout shifts).

**How to improve:**

```typescript
// 1. Reserve space for images
<img
  src="/image.jpg"
  alt="Description"
  width={800}
  height={600}
  className="w-full h-auto"  /* Maintain aspect ratio */
/>

// 2. Reserve space for dynamic content
<div className="min-h-[200px]">
  {isLoading ? <Skeleton /> : <Content />}
</div>

// 3. Avoid inserting content above existing content
// ❌ WRONG
{newContent && <div>{newContent}</div>}
<ExistingContent />

// ✅ CORRECT
<ExistingContent />
{newContent && <div>{newContent}</div>}

// 4. Use transform instead of layout properties
// ❌ WRONG - Causes layout shift
<div style={{ top: isOpen ? '0' : '-100px' }}>

// ✅ CORRECT - No layout shift
<div style={{ transform: isOpen ? 'translateY(0)' : 'translateY(-100%)' }}>
```

---

## Image Optimization

### Format Selection

| Format | Use Case | Browser Support |
|--------|----------|-----------------|
| **WebP** | General use, best compression | Chrome, Firefox, Edge, Safari 14+ |
| **AVIF** | Even better compression | Chrome 85+, Firefox 93+ |
| **JPEG** | Photos, fallback | Universal |
| **PNG** | Transparency needed | Universal |
| **SVG** | Logos, icons, illustrations | Universal |

### Responsive Images

**Multiple resolutions:**

```typescript
<img
  srcSet="
    /product-small.webp 400w,
    /product-medium.webp 800w,
    /product-large.webp 1200w
  "
  sizes="
    (max-width: 640px) 100vw,
    (max-width: 1024px) 50vw,
    33vw
  "
  src="/product-large.webp"
  alt="Product"
  loading="lazy"
  className="w-full h-auto"
/>
```

### Picture Element (Format Fallback)

```typescript
<picture>
  <source
    srcSet="/hero.avif"
    type="image/avif"
  />
  <source
    srcSet="/hero.webp"
    type="image/webp"
  />
  <img
    src="/hero.jpg"
    alt="Hero"
    className="w-full h-auto"
  />
</picture>
```

### Image Dimensions

**Always specify width and height:**

```typescript
// ✅ CORRECT - Prevents CLS
<img
  src="/image.jpg"
  alt="Description"
  width={800}
  height={600}
  className="w-full h-auto"
/>

// ❌ WRONG - Causes CLS
<img
  src="/image.jpg"
  alt="Description"
  className="w-full"
/>
```

### Lazy Loading

```typescript
// Native lazy loading
<img
  src="/image.jpg"
  alt="Description"
  loading="lazy"
  className="w-full h-auto"
/>

// Don't lazy load above-the-fold images
<img
  src="/hero.jpg"
  alt="Hero"
  loading="eager"
  fetchpriority="high"
/>
```

---

## Lazy Loading

### Component Lazy Loading

**React.lazy:**

```typescript
import { lazy, Suspense } from 'react';

// Lazy load heavy components
const DataGrid = lazy(() => import('./DataGrid'));
const Chart = lazy(() => import('./Chart'));
const VideoPlayer = lazy(() => import('./VideoPlayer'));

function Dashboard() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DataGrid />
      <Chart />
      <VideoPlayer />
    </Suspense>
  );
}
```

### Route-Based Code Splitting

```typescript
// TanStack Router
import { lazy } from 'react';
import { createFileRoute } from '@tanstack/react-router';

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));

export const Route = createFileRoute('/dashboard/')({
  component: DashboardPage,
});
```

### Intersection Observer (Advanced)

```typescript
function LazyImage({ src, alt }: { src: string; alt: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }  // Load 50px before entering viewport
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : undefined}
      alt={alt}
      className="w-full h-auto"
    />
  );
}
```

---

## Code Splitting

### Dynamic Imports

```typescript
// Heavy library - load only when needed
async function handleExport() {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  // ... export logic
}
```

### Vendor Splitting

**Vite config:**

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@mui/material', '@mui/icons-material'],
          'router-vendor': ['@tanstack/react-router'],

          // Feature chunks
          'dashboard': ['./src/features/dashboard'],
          'auth': ['./src/features/auth'],
        }
      }
    }
  }
});
```

### Bundle Analysis

```bash
# Analyze bundle size
npm install -D vite-bundle-visualizer
npx vite-bundle-visualizer
```

---

## Font Loading

### Font Display Strategy

```css
@font-face {
  font-family: 'Custom Font';
  src: url('/fonts/custom-font.woff2') format('woff2');
  font-display: swap;  /* Show fallback, swap when loaded */
  font-weight: 400;
  font-style: normal;
}
```

**Font-display values:**
- `swap`: Show fallback immediately, swap when loaded (recommended)
- `block`: Block up to 3s, swap when loaded
- `fallback`: Block 100ms, swap within 3s, else use fallback
- `optional`: Let browser decide based on connection speed

### Preload Critical Fonts

```html
<link
  rel="preload"
  href="/fonts/custom-font.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
```

### Variable Fonts

**Single file, multiple weights:**

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Variable.woff2') format('woff2');
  font-weight: 100 900;  /* All weights in one file */
  font-display: swap;
}
```

### System Font Stack (Zero Network Cost)

```typescript
// Tailwind config
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      }
    }
  }
}
```

---

## Network Optimization

### Resource Hints

```html
<!-- Preconnect to external domains -->
<link rel="preconnect" href="https://api.example.com">
<link rel="dns-prefetch" href="https://analytics.example.com">

<!-- Preload critical resources -->
<link rel="preload" href="/hero.jpg" as="image">
<link rel="preload" href="/app.css" as="style">
<link rel="preload" href="/app.js" as="script">

<!-- Prefetch resources for next navigation -->
<link rel="prefetch" href="/dashboard">
```

### API Request Optimization

**Batch requests:**

```typescript
// ❌ WRONG - Multiple requests
const user = await fetch('/api/user');
const posts = await fetch('/api/posts');
const comments = await fetch('/api/comments');

// ✅ CORRECT - Single request
const data = await fetch('/api/dashboard-data');
```

**Request caching:**

```typescript
// TanStack Query - automatic caching
const { data } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 30 * 60 * 1000,  // 30 minutes
});
```

### Service Worker (Offline Support)

```typescript
// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

// sw.js - Basic cache strategy
const CACHE_NAME = 'v1';

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

---

## Bundle Size Optimization

### Tree Shaking

**Import only what you need:**

```typescript
// ❌ WRONG - Imports entire library
import _ from 'lodash';
const result = _.debounce(fn, 300);

// ✅ CORRECT - Imports only debounce
import debounce from 'lodash/debounce';
const result = debounce(fn, 300);
```

### Minification

**Vite automatically minifies production builds:**

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'esbuild',  // Fast minification
    sourcemap: false,   // Disable sourcemaps in production
  }
});
```

### Compression

**Enable Gzip/Brotli on server:**

```typescript
// vite-plugin-compression
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    })
  ]
});
```

### Remove Unused CSS

**PurgeCSS with Tailwind:**

```typescript
// tailwind.config.ts
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],  // Automatically removes unused classes
}
```

---

## Performance Monitoring

### Lighthouse

```bash
# Run Lighthouse audit
npm install -g lighthouse
lighthouse https://yoursite.com --preset=mobile --view
```

**Focus areas:**
- Performance score
- First Contentful Paint
- Largest Contentful Paint
- Total Blocking Time
- Cumulative Layout Shift

### Web Vitals Monitoring

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric: any) {
  // Send to analytics service
  console.log(metric);
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### Real User Monitoring (RUM)

```typescript
// Performance Observer
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Performance entry:', entry);
  }
});

observer.observe({ entryTypes: ['navigation', 'resource', 'paint'] });
```

### Chrome DevTools

**Performance tab:**
1. Open DevTools (F12)
2. Go to Performance tab
3. Click Record
4. Interact with page
5. Stop recording
6. Analyze timeline

**Key metrics to watch:**
- Scripting time
- Rendering time
- Painting time
- Idle time

---

## Performance Budget

### Set Targets

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        chunkSizeWarningLimit: 500,  // 500KB warning
      }
    }
  }
});
```

### Budget Guidelines

| Resource Type | Budget (Mobile) | Budget (Desktop) |
|---------------|-----------------|------------------|
| **HTML** | < 30 KB | < 50 KB |
| **CSS** | < 50 KB | < 100 KB |
| **JavaScript** | < 150 KB | < 300 KB |
| **Images** | < 500 KB total | < 1 MB total |
| **Fonts** | < 100 KB | < 200 KB |
| **Total Page** | < 1 MB | < 2 MB |

---

## Quick Wins Checklist

**Images:**
- [ ] Use WebP/AVIF format
- [ ] Specify width and height
- [ ] Lazy load below-the-fold images
- [ ] Use responsive images (srcSet)
- [ ] Compress images (80-85% quality)

**JavaScript:**
- [ ] Code split by route
- [ ] Lazy load heavy components
- [ ] Tree shake unused code
- [ ] Minify production build
- [ ] Use production React build

**CSS:**
- [ ] Remove unused Tailwind classes
- [ ] Minify CSS
- [ ] Inline critical CSS
- [ ] Load non-critical CSS async

**Fonts:**
- [ ] Use font-display: swap
- [ ] Preload critical fonts
- [ ] Subset fonts (remove unused glyphs)
- [ ] Use WOFF2 format

**Network:**
- [ ] Enable Brotli/Gzip compression
- [ ] Preconnect to external domains
- [ ] Cache API responses
- [ ] Use CDN for static assets

---

## Common Performance Mistakes

### ❌ Loading Everything Upfront

```typescript
// ❌ WRONG - Loads all features immediately
import Dashboard from './Dashboard';
import Profile from './Profile';
import Settings from './Settings';

// ✅ CORRECT - Lazy load features
const Dashboard = lazy(() => import('./Dashboard'));
const Profile = lazy(() => import('./Profile'));
const Settings = lazy(() => import('./Settings'));
```

### ❌ Not Specifying Image Dimensions

```typescript
// ❌ WRONG - Causes CLS
<img src="/image.jpg" alt="Image" />

// ✅ CORRECT - Prevents CLS
<img
  src="/image.jpg"
  alt="Image"
  width={800}
  height={600}
  className="w-full h-auto"
/>
```

### ❌ Blocking Main Thread

```typescript
// ❌ WRONG - Blocks UI
function heavyCalculation() {
  let result = 0;
  for (let i = 0; i < 1000000000; i++) {
    result += i;
  }
  return result;
}

// ✅ CORRECT - Use web worker
const worker = new Worker('/worker.js');
worker.postMessage({ action: 'calculate' });
worker.onmessage = (e) => {
  console.log('Result:', e.data);
};
```

---

## Related Resources

- [Touch Targets Guide](./touch-targets-guide.md)
- [Responsive Patterns](./responsive-patterns.md)
- [Mobile Gestures](./mobile-gestures.md)
- [Web Vitals Documentation](https://web.dev/vitals/)
- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
