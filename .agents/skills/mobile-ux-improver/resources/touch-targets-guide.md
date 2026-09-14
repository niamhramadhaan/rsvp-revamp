# Touch Targets Guide

Comprehensive guide for implementing touch-friendly interactive elements in mobile web applications.

## Table of Contents

1. [Why Touch Targets Matter](#why-touch-targets-matter)
2. [Size Standards](#size-standards)
3. [Spacing Guidelines](#spacing-guidelines)
4. [Component Patterns](#component-patterns)
5. [Platform-Specific Considerations](#platform-specific-considerations)
6. [Testing Touch Targets](#testing-touch-targets)

---

## Why Touch Targets Matter

### The Fat Finger Problem

Human fingers are significantly larger than mouse cursors:
- **Average finger pad**: 10-14mm (38-53px)
- **Mouse cursor**: 1-2px precision
- **Touch accuracy**: ±2-3mm variance

### Consequences of Small Touch Targets

**UX Issues:**
- Missed taps → frustration
- Accidental taps → errors
- Multiple attempts → slower task completion
- User fatigue → abandonment

**Accessibility Issues:**
- Difficult for users with:
  - Motor disabilities
  - Tremors
  - Large fingers
  - Elderly users

---

## Size Standards

### Official Guidelines

| Organization | Minimum Size | Recommended Size |
|--------------|--------------|------------------|
| **Apple HIG** | 44pt (44px) | 44pt+ |
| **Material Design** | 48dp (48px) | 48dp |
| **WCAG 2.1** | 24×24 CSS px | 44×44 CSS px |
| **Microsoft** | 34px | 44px |

**Industry Consensus:** **48×48px** for primary touch targets

### When to Use Each Size

**48×48px (Recommended):**
- Primary action buttons
- Navigation items
- Icon buttons
- Form controls
- FABs (Floating Action Buttons)

**44×44px (Minimum Acceptable):**
- Secondary actions
- Less critical interactions
- Constrained space situations

**Larger than 48px:**
- Primary CTAs (Call to Action)
- Emergency buttons
- Accessibility-critical actions

---

## Spacing Guidelines

### Minimum Spacing Between Targets

**Why spacing matters:**
- Prevents accidental taps on adjacent elements
- Reduces cognitive load
- Improves visual hierarchy

### Spacing Standards

| Context | Minimum Spacing | Recommended Spacing |
|---------|-----------------|---------------------|
| **Icon buttons** | 8px | 12px |
| **Text links** | 8px vertical | 12px vertical |
| **Form inputs** | 16px vertical | 24px vertical |
| **List items** | 4px | 8px |
| **Action buttons** | 12px | 16px |

### Spacing Patterns in Tailwind

```typescript
// Minimum spacing (8px = gap-2)
<div className="flex gap-2">
  <IconButton />
  <IconButton />
</div>

// Recommended spacing (12px = gap-3)
<div className="flex gap-3">
  <IconButton />
  <IconButton />
</div>

// Form spacing (24px = space-y-6)
<form className="space-y-6">
  <Input />
  <Input />
</form>
```

---

## Component Patterns

### Buttons

#### Primary Button

```typescript
<button className="
  w-full px-6 py-4                  /* Full width on mobile */
  md:w-auto md:px-8                 /* Auto width on desktop */
  min-h-[48px]                      /* Touch-friendly height */
  text-lg font-semibold rounded-lg
  bg-brand-blue text-white
  hover:bg-blue-600                 /* Desktop hover */
  active:bg-blue-700                /* Touch feedback */
  transition-colors duration-150
  focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2
">
  Continue
</button>
```

**Key Features:**
- ✅ 48px minimum height
- ✅ Full width on mobile for easy tapping
- ✅ Active state for touch feedback
- ✅ Focus ring for keyboard navigation

#### Icon Button

```typescript
<button
  className="
    p-3                             /* 12px padding */
    min-h-[48px] min-w-[48px]      /* Explicit touch target */
    flex items-center justify-center
    rounded-full
    hover:bg-gray-100 active:bg-gray-200
    transition-colors duration-150
    focus:outline-none focus:ring-2 focus:ring-blue-500
  "
  aria-label="Close"
>
  <XIcon className="w-6 h-6" />     /* 24px icon */
</button>
```

**Calculation:**
- Padding: 12px × 2 = 24px
- Icon: 24px
- Total: 48px ✅

#### Secondary/Ghost Button

```typescript
<button className="
  px-6 py-3 min-h-[48px]
  border-2 border-gray-300
  text-gray-700 font-medium rounded-lg
  hover:border-gray-400 hover:bg-gray-50
  active:border-gray-500 active:bg-gray-100
  transition-all duration-150
">
  Cancel
</button>
```

### Navigation

#### Mobile Navigation Bar

```typescript
<nav className="
  fixed bottom-0 left-0 right-0     /* Bottom bar on mobile */
  bg-white border-t border-gray-200
  safe-area-inset-bottom            /* Account for iOS home indicator */
  md:relative md:border-0           /* Normal position on desktop */
">
  <ul className="flex justify-around">
    {navItems.map(item => (
      <li key={item.id}>
        <a
          href={item.href}
          className="
            flex flex-col items-center gap-1
            px-4 py-3 min-h-[56px]   /* Slightly larger for bottom nav */
            hover:bg-gray-50 active:bg-gray-100
            transition-colors
          "
        >
          <item.Icon className="w-6 h-6" />
          <span className="text-xs">{item.label}</span>
        </a>
      </li>
    ))}
  </ul>
</nav>
```

**Why 56px height:**
- More comfortable thumb reach at bottom of screen
- Matches iOS tab bar height (49pt + safe area)

#### Navigation Links

```typescript
<nav className="space-y-2">
  {links.map(link => (
    <a
      key={link.id}
      href={link.url}
      className="
        block px-4 py-3              /* Ample padding */
        min-h-[48px]
        text-base font-medium
        rounded-lg
        hover:bg-gray-50 active:bg-gray-100
        transition-colors
      "
    >
      {link.label}
    </a>
  ))}
</nav>
```

### Forms

#### Text Input

```typescript
<div className="space-y-2">
  <label
    htmlFor="email"
    className="block text-sm font-medium text-gray-700"
  >
    Email Address
  </label>
  <input
    type="email"
    id="email"
    className="
      w-full px-4 py-3              /* Generous padding */
      min-h-[48px]
      text-base                     /* Prevent iOS zoom */
      border border-gray-300 rounded-lg
      focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent
    "
    placeholder="you@example.com"
  />
</div>
```

**Key Point:** `font-size: 16px` prevents iOS Safari auto-zoom on focus.

#### Checkbox/Radio

```typescript
<label className="
  flex items-center gap-3
  px-4 py-3 min-h-[48px]           /* Touch-friendly area */
  rounded-lg cursor-pointer
  hover:bg-gray-50 active:bg-gray-100
">
  <input
    type="checkbox"
    className="
      w-6 h-6                        /* Larger checkbox */
      rounded border-gray-300
      text-brand-blue
      focus:ring-2 focus:ring-brand-blue focus:ring-offset-0
    "
  />
  <span className="text-base">
    I agree to the terms and conditions
  </span>
</label>
```

**Pattern:** Entire label is clickable, not just checkbox.

#### Select Dropdown

```typescript
<select className="
  w-full px-4 py-3
  min-h-[48px]
  text-base                         /* Prevent iOS zoom */
  border border-gray-300 rounded-lg
  bg-white
  appearance-none                   /* Custom arrow styling */
  bg-[url('data:image/svg+xml;...')] bg-no-repeat bg-right
  focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent
">
  <option>Select an option</option>
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

### Lists & Cards

#### Interactive List Item

```typescript
<button className="
  w-full flex items-center justify-between
  px-4 py-4 min-h-[56px]           /* Slightly larger for content */
  border-b border-gray-200
  text-left
  hover:bg-gray-50 active:bg-gray-100
  transition-colors
">
  <div className="flex items-center gap-3">
    <Avatar src={user.avatar} size={40} />
    <div>
      <p className="font-medium">{user.name}</p>
      <p className="text-sm text-gray-500">{user.email}</p>
    </div>
  </div>
  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
</button>
```

#### Card Actions

```typescript
<div className="bg-white rounded-lg shadow-sm p-4">
  {/* Card content */}

  <div className="flex gap-3 mt-4">
    <button className="
      flex-1 px-4 py-3 min-h-[48px]
      border border-gray-300 rounded-lg
      font-medium
      hover:bg-gray-50 active:bg-gray-100
    ">
      Cancel
    </button>
    <button className="
      flex-1 px-4 py-3 min-h-[48px]
      bg-brand-blue text-white rounded-lg
      font-medium
      hover:bg-blue-600 active:bg-blue-700
    ">
      Confirm
    </button>
  </div>
</div>
```

---

## Platform-Specific Considerations

### iOS

**Safe Area Insets:**

```css
/* Account for iPhone notch/home indicator */
.ios-safe {
  padding-bottom: env(safe-area-inset-bottom);
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

**Tailwind Plugin:**

```typescript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      }
    }
  }
}
```

### Android

**Ripple Effect:**

```typescript
// Material-style ripple feedback
<button className="
  relative overflow-hidden
  px-6 py-3 min-h-[48px]
  active:bg-gray-100
  after:content-['']
  after:absolute after:inset-0
  after:bg-white after:opacity-0
  active:after:opacity-20
  after:transition-opacity
">
  Tap Me
</button>
```

---

## Testing Touch Targets

### Manual Testing

**Physical Device Testing:**
1. Test on real phones (various sizes)
2. Use thumb navigation
3. Test with one hand
4. Try landscape mode
5. Test with gloves (if applicable)

**What to Check:**
- Can you tap every button accurately?
- Do you accidentally tap adjacent elements?
- Is text readable without zooming?
- Are forms easy to complete?

### Browser DevTools

**Chrome DevTools:**
1. Open DevTools (F12)
2. Toggle device toolbar (Cmd+Shift+M)
3. Enable "Show rulers"
4. Enable "Show device frame"
5. Use inspector to measure elements

**Firefox DevTools:**
1. Open DevTools
2. Responsive Design Mode (Cmd+Opt+M)
3. Select "Touch simulation"
4. Inspect element dimensions

### Automated Tools

**Lighthouse:**
```bash
npm install -g lighthouse
lighthouse https://yoursite.com --preset=mobile
```

Check for:
- "Tap targets are not sized appropriately"
- Touch target overlap warnings

**Pa11y:**
```bash
npm install -g pa11y
pa11y https://yoursite.com --standard WCAG2AA
```

---

## Common Mistakes

### ❌ Icon-Only Buttons Without Padding

```typescript
// ❌ WRONG - Only 24px total
<button>
  <Icon className="w-6 h-6" />
</button>

// ✅ CORRECT - 48px total
<button className="p-3">
  <Icon className="w-6 h-6" />
</button>
```

### ❌ Inline Links Too Close Together

```typescript
// ❌ WRONG - Links too close
<p>
  Read our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>
</p>

// ✅ CORRECT - Adequate spacing
<div className="space-y-3">
  <a href="/terms" className="block py-2">Terms of Service</a>
  <a href="/privacy" className="block py-2">Privacy Policy</a>
</div>
```

### ❌ Small Checkbox with Tiny Label

```typescript
// ❌ WRONG - Hard to tap
<label>
  <input type="checkbox" className="w-4 h-4" />
  <span className="text-xs">Agree</span>
</label>

// ✅ CORRECT - Touch-friendly
<label className="flex items-center gap-3 py-3 cursor-pointer">
  <input type="checkbox" className="w-6 h-6" />
  <span className="text-base">I agree to terms</span>
</label>
```

---

## Quick Reference Table

| Element | Min Height | Min Width | Padding | Gap |
|---------|-----------|-----------|---------|-----|
| Primary Button | 48px | 100% (mobile) | 16-24px | - |
| Icon Button | 48px | 48px | 12px | - |
| Text Input | 48px | 100% | 12-16px | - |
| Checkbox | 24px | 24px | 12px around | - |
| Nav Link | 48px | - | 12-16px | 8-12px |
| List Item | 56px | 100% | 16px | 4-8px |
| FAB | 56px | 56px | 16px | - |

---

## Related Resources

- [Responsive Patterns](./responsive-patterns.md)
- [Mobile Gestures](./mobile-gestures.md)
- [Mobile Performance](./mobile-performance.md)
