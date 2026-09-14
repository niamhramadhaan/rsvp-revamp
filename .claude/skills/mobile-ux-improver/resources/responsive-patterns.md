# Responsive Design Patterns

Comprehensive guide for implementing responsive, mobile-first web layouts using Tailwind CSS.

## Table of Contents

1. [Mobile-First Philosophy](#mobile-first-philosophy)
2. [Breakpoint Strategy](#breakpoint-strategy)
3. [Layout Patterns](#layout-patterns)
4. [Typography Scaling](#typography-scaling)
5. [Spacing & Sizing](#spacing--sizing)
6. [Navigation Patterns](#navigation-patterns)
7. [Content Prioritization](#content-prioritization)

---

## Mobile-First Philosophy

### Why Mobile-First?

**Constraints Drive Better Design:**
- Smaller screen = focus on essentials
- Limited space = clearer hierarchy
- Touch interaction = simpler UI
- Slower connections = performance focus

**Progressive Enhancement:**
- Start with core experience
- Add features for larger screens
- Easier than removing features
- Better performance baseline

### Mobile-First CSS

```typescript
// ✅ CORRECT - Mobile first, enhance for desktop
<div className="
  text-base                /* Mobile: 16px */
  md:text-lg              /* Tablet: 18px */
  lg:text-xl              /* Desktop: 20px */
">

// ❌ WRONG - Desktop first, reduce for mobile
<div className="
  text-xl                 /* Desktop: 20px */
  md:text-lg              /* Tablet: 18px */
  sm:text-base            /* Mobile: 16px */
">
```

**Mental Model:**
1. Write mobile styles (no prefix)
2. Add tablet enhancements (`md:`)
3. Add desktop enhancements (`lg:`, `xl:`)

---

## Breakpoint Strategy

### Tailwind Breakpoints

| Prefix | Min Width | Device Type | Description |
|--------|-----------|-------------|-------------|
| *none* | 0px | Mobile | Default (mobile-first) |
| `sm:` | 640px | Large mobile | Large phones, portrait tablets |
| `md:` | 768px | Tablet | iPads, Android tablets |
| `lg:` | 1024px | Laptop | Small laptops, desktops |
| `xl:` | 1280px | Desktop | Standard desktops |
| `2xl:` | 1536px | Large desktop | Large monitors |

### Common Device Dimensions

**Mobile Phones:**
- iPhone SE: 375×667
- iPhone 12/13/14: 390×844
- iPhone Pro Max: 428×926
- Samsung Galaxy: 360×740
- Small Android: 320×568

**Tablets:**
- iPad Mini: 768×1024
- iPad Air: 820×1180
- iPad Pro: 1024×1366

**Strategy:**
- Design for 360px width minimum (small Android)
- Test at 375px (iPhone)
- Enhance at 768px+ (tablets)

### Viewport Configuration

**Required meta tag:**

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=5"
>
```

**Parameters:**
- `width=device-width`: Match screen width
- `initial-scale=1`: No initial zoom
- `maximum-scale=5`: Allow zoom for accessibility

---

## Layout Patterns

### 1. Stack-to-Row Pattern

**Most common responsive pattern:**

```typescript
// Mobile: Stack vertically
// Desktop: Horizontal row
<div className="
  flex flex-col gap-4
  md:flex-row md:gap-6
">
  <div className="w-full md:w-1/3">Sidebar</div>
  <div className="w-full md:w-2/3">Content</div>
</div>
```

**Use Cases:**
- Sidebar + main content
- Form label + input
- Image + text
- Card layout

### 2. Grid Layout Pattern

**Responsive grid columns:**

```typescript
<div className="
  grid grid-cols-1 gap-4          /* Mobile: 1 column */
  sm:grid-cols-2 sm:gap-6         /* Tablet: 2 columns */
  lg:grid-cols-3 lg:gap-8         /* Desktop: 3 columns */
  xl:grid-cols-4                  /* Large: 4 columns */
">
  {items.map(item => (
    <Card key={item.id} {...item} />
  ))}
</div>
```

**Auto-fit grid (more flexible):**

```typescript
<div className="
  grid gap-4
  grid-cols-[repeat(auto-fit,minmax(280px,1fr))]
">
  {items.map(item => (
    <Card key={item.id} {...item} />
  ))}
</div>
```

### 3. Container Pattern

**Centered, max-width container:**

```typescript
<div className="
  w-full px-4                     /* Mobile: full width, padding */
  md:px-6                         /* Tablet: more padding */
  lg:max-w-7xl lg:mx-auto lg:px-8 /* Desktop: centered, max width */
">
  {content}
</div>
```

**Container sizes:**
- `max-w-sm`: 384px (narrow content)
- `max-w-md`: 448px (forms)
- `max-w-lg`: 512px (articles)
- `max-w-xl`: 576px (blog posts)
- `max-w-2xl`: 672px (wide content)
- `max-w-4xl`: 896px (dashboards)
- `max-w-7xl`: 1280px (full layouts)

### 4. Hero Section Pattern

```typescript
<section className="
  px-4 py-12                      /* Mobile: moderate padding */
  md:px-6 md:py-16                /* Tablet: more padding */
  lg:px-8 lg:py-24                /* Desktop: generous padding */
">
  <div className="max-w-7xl mx-auto">
    <div className="
      flex flex-col gap-8
      lg:flex-row lg:items-center lg:gap-12
    ">
      {/* Text content */}
      <div className="
        w-full text-center
        lg:w-1/2 lg:text-left
      ">
        <h1 className="
          text-4xl font-bold
          md:text-5xl
          lg:text-6xl
        ">
          Headline
        </h1>
        <p className="
          mt-4 text-lg text-gray-600
          md:text-xl
        ">
          Description text
        </p>
      </div>

      {/* Image */}
      <div className="w-full lg:w-1/2">
        <img
          src="/hero.jpg"
          alt="Hero"
          className="w-full h-auto rounded-lg"
        />
      </div>
    </div>
  </div>
</section>
```

### 5. Two-Column Form Pattern

```typescript
<form className="space-y-6">
  <div className="
    grid grid-cols-1 gap-6
    md:grid-cols-2
  ">
    <div>
      <label>First Name</label>
      <input type="text" />
    </div>
    <div>
      <label>Last Name</label>
      <input type="text" />
    </div>
  </div>

  {/* Full-width fields */}
  <div>
    <label>Email</label>
    <input type="email" />
  </div>

  <div>
    <label>Message</label>
    <textarea rows={4} />
  </div>

  <button className="w-full md:w-auto">
    Submit
  </button>
</form>
```

### 6. Sidebar Layout Pattern

**Mobile: Stacked, Desktop: Sidebar**

```typescript
<div className="
  flex flex-col
  lg:flex-row lg:gap-8
">
  {/* Sidebar */}
  <aside className="
    w-full mb-6
    lg:w-64 lg:mb-0 lg:sticky lg:top-4 lg:self-start
  ">
    <nav className="space-y-2">
      {navItems.map(item => (
        <NavLink key={item.id} {...item} />
      ))}
    </nav>
  </aside>

  {/* Main content */}
  <main className="flex-1 min-w-0">
    {content}
  </main>
</div>
```

**Key Pattern:** `min-w-0` on flex item prevents overflow.

---

## Typography Scaling

### Responsive Font Sizes

**Tailwind text utilities:**

```typescript
<h1 className="
  text-3xl font-bold             /* Mobile: 30px */
  md:text-4xl                    /* Tablet: 36px */
  lg:text-5xl                    /* Desktop: 48px */
  xl:text-6xl                    /* Large: 60px */
">
  Heading
</h1>

<p className="
  text-base leading-relaxed      /* Mobile: 16px */
  md:text-lg                     /* Tablet: 18px */
">
  Body text
</p>
```

### Font Size Scale

| Class | Mobile | Tablet (md:) | Desktop (lg:) |
|-------|--------|--------------|---------------|
| `text-sm` | 14px | 14px | 14px |
| `text-base` | 16px | 16px | 16px |
| `text-lg` | 18px | 20px | 20px |
| `text-xl` | 20px | 24px | 24px |
| `text-2xl` | 24px | 28px | 30px |
| `text-3xl` | 30px | 36px | 36px |
| `text-4xl` | 36px | 42px | 48px |

### Line Height (Leading)

```typescript
// Adjust line height for readability
<p className="
  text-base leading-relaxed      /* 1.625 line height */
  md:text-lg md:leading-loose    /* 2.0 line height */
">
  Long form content benefits from generous line height.
</p>
```

### Prevent iOS Zoom on Input Focus

**Critical:** Use minimum 16px font size on inputs:

```typescript
<input className="
  text-base                      /* 16px - NO zoom */
  px-4 py-3
" />

// ❌ WRONG - Causes zoom on iOS
<input className="
  text-sm                        /* 14px - ZOOMS! */
  px-3 py-2
" />
```

---

## Spacing & Sizing

### Responsive Padding

```typescript
<section className="
  px-4 py-8                      /* Mobile: 16px / 32px */
  md:px-6 md:py-12               /* Tablet: 24px / 48px */
  lg:px-8 lg:py-16               /* Desktop: 32px / 64px */
">
  {content}
</section>
```

### Responsive Margins

```typescript
<div className="
  mb-6                           /* Mobile: 24px */
  md:mb-8                        /* Tablet: 32px */
  lg:mb-12                       /* Desktop: 48px */
">
  {section}
</div>
```

### Responsive Gaps

```typescript
<div className="
  flex gap-4                     /* Mobile: 16px */
  md:gap-6                       /* Tablet: 24px */
  lg:gap-8                       /* Desktop: 32px */
">
  {items}
</div>
```

### Width Constraints

```typescript
// Image containers
<div className="
  w-full                         /* Mobile: full width */
  md:w-2/3                       /* Tablet: 66% */
  lg:w-1/2                       /* Desktop: 50% */
">
  <img src="/image.jpg" className="w-full h-auto" />
</div>
```

---

## Navigation Patterns

### 1. Mobile Hamburger Menu

```typescript
function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden p-3"
        aria-label="Toggle menu"
      >
        {isOpen ? <XIcon /> : <MenuIcon />}
      </button>

      {/* Mobile menu */}
      <nav className={`
        fixed inset-0 bg-white z-50
        transform transition-transform
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        md:hidden
      `}>
        <ul className="p-6 space-y-4">
          {navItems.map(item => (
            <li key={item.id}>
              <a
                href={item.href}
                className="block py-3 text-lg"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop menu */}
      <nav className="hidden md:flex gap-6">
        {navItems.map(item => (
          <a key={item.id} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    </>
  );
}
```

### 2. Bottom Tab Bar (Mobile)

```typescript
<nav className="
  fixed bottom-0 left-0 right-0
  bg-white border-t border-gray-200
  pb-safe-bottom                 /* iOS safe area */
  md:hidden                      /* Hide on desktop */
">
  <ul className="flex justify-around">
    {tabs.map(tab => (
      <li key={tab.id}>
        <a
          href={tab.href}
          className="
            flex flex-col items-center
            px-4 py-3 min-h-[56px]
          "
        >
          <tab.Icon className="w-6 h-6" />
          <span className="text-xs mt-1">{tab.label}</span>
        </a>
      </li>
    ))}
  </ul>
</nav>
```

### 3. Responsive Header

```typescript
<header className="
  sticky top-0 z-50
  bg-white border-b border-gray-200
  px-4 py-3                      /* Mobile */
  md:px-6                        /* Tablet */
  lg:px-8                        /* Desktop */
">
  <div className="
    flex items-center justify-between
    max-w-7xl mx-auto
  ">
    {/* Logo */}
    <Logo className="h-8 md:h-10" />

    {/* Desktop nav */}
    <nav className="hidden md:flex gap-6">
      {navItems.map(item => (
        <NavLink key={item.id} {...item} />
      ))}
    </nav>

    {/* Mobile menu button */}
    <MobileMenuButton className="md:hidden" />
  </div>
</header>
```

---

## Content Prioritization

### Hide/Show Content

```typescript
// Show only on mobile
<div className="md:hidden">
  Mobile-only content
</div>

// Show only on tablet and up
<div className="hidden md:block">
  Desktop content
</div>

// Show only on desktop
<div className="hidden lg:block">
  Large screen content
</div>
```

### Reorder Content

```typescript
<div className="
  flex flex-col
  lg:flex-row
">
  {/* Image first on mobile, second on desktop */}
  <div className="
    order-1                      /* Mobile: first */
    lg:order-2                   /* Desktop: second */
    w-full lg:w-1/2
  ">
    <img src="/image.jpg" />
  </div>

  {/* Text second on mobile, first on desktop */}
  <div className="
    order-2                      /* Mobile: second */
    lg:order-1                   /* Desktop: first */
    w-full lg:w-1/2
  ">
    <h2>Heading</h2>
    <p>Text content</p>
  </div>
</div>
```

### Truncate Text

```typescript
// Single line truncate
<p className="truncate">
  Long text that gets cut off with ellipsis...
</p>

// Multi-line clamp
<p className="line-clamp-3">
  Long text that gets clamped to 3 lines with ellipsis
  at the end of the third line...
</p>

// Responsive truncation
<h3 className="
  truncate                       /* Mobile: 1 line */
  md:line-clamp-2                /* Desktop: 2 lines */
">
  Responsive heading truncation
</h3>
```

---

## Testing Responsive Designs

### Browser DevTools

**Chrome DevTools:**
1. Open DevTools (F12)
2. Toggle device toolbar (Cmd+Shift+M / Ctrl+Shift+M)
3. Test preset devices or custom dimensions
4. Enable "Show media queries" for breakpoint visualization

**Responsive Testing Checklist:**
- [ ] 320px (small Android)
- [ ] 375px (iPhone)
- [ ] 768px (iPad)
- [ ] 1024px (laptop)
- [ ] 1280px (desktop)
- [ ] Portrait and landscape modes

### Real Device Testing

**Essential Devices:**
- iPhone (any recent model)
- Android phone (Samsung or Google Pixel)
- iPad or Android tablet

**What to Test:**
- Tap targets (44px minimum)
- Text readability (no zoom required)
- Scrolling performance
- Touch gestures
- Form interactions

---

## Common Mistakes

### ❌ Not Using Mobile-First Approach

```typescript
// ❌ WRONG - Desktop first (hard to maintain)
<div className="text-xl md:text-lg sm:text-base">

// ✅ CORRECT - Mobile first
<div className="text-base md:text-lg lg:text-xl">
```

### ❌ Fixed Widths on Mobile

```typescript
// ❌ WRONG - Breaks on small screens
<div className="w-[800px]">

// ✅ CORRECT - Responsive width
<div className="w-full lg:w-[800px] lg:mx-auto">
```

### ❌ Forgetting Touch Targets

```typescript
// ❌ WRONG - Too small for touch
<button className="p-1 text-sm">Tap</button>

// ✅ CORRECT - Touch-friendly
<button className="px-6 py-3 min-h-[48px] text-base">Tap</button>
```

### ❌ Horizontal Overflow

```typescript
// ❌ WRONG - Can cause horizontal scroll
<div className="flex gap-4 w-[1200px]">

// ✅ CORRECT - Responsive flex
<div className="flex flex-wrap gap-4">
// OR
<div className="flex gap-4 overflow-x-auto">
```

---

## Quick Reference

### Common Responsive Patterns

```typescript
// Stack to row
flex flex-col md:flex-row

// 1 to 2 to 3 columns
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3

// Full width to centered
w-full lg:max-w-7xl lg:mx-auto

// Hide on mobile
hidden md:block

// Show only on mobile
md:hidden

// Responsive padding
px-4 md:px-6 lg:px-8

// Responsive text
text-base md:text-lg lg:text-xl
```

---

## Related Resources

- [Touch Targets Guide](./touch-targets-guide.md)
- [Mobile Gestures](./mobile-gestures.md)
- [Mobile Performance](./mobile-performance.md)
