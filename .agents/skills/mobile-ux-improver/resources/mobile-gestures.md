# Mobile Gestures Guide

Comprehensive guide for implementing touch gestures and mobile-specific interactions.

## Table of Contents

1. [Touch Events](#touch-events)
2. [Swipe Gestures](#swipe-gestures)
3. [Horizontal Scrolling](#horizontal-scrolling)
4. [Pull-to-Refresh](#pull-to-refresh)
5. [Long Press](#long-press)
6. [Pinch-to-Zoom](#pinch-to-zoom)
7. [Drag & Drop](#drag--drop)
8. [Scroll Behavior](#scroll-behavior)

---

## Touch Events

### Basic Touch Events

**Available events:**
- `touchstart`: Finger touches screen
- `touchmove`: Finger moves while touching
- `touchend`: Finger lifts off screen
- `touchcancel`: Touch interrupted

### Touch vs Mouse Events

```typescript
// ✅ Support both touch and mouse
function Button() {
  const handleInteraction = () => {
    console.log('Interacted');
  };

  return (
    <button
      onClick={handleInteraction}        // Works for both
      onTouchStart={() => {}}            // Touch-specific feedback
      className="active:bg-gray-100"     // Visual feedback
    >
      Tap Me
    </button>
  );
}
```

**Key Points:**
- `onClick` fires on touch devices
- `touchstart` provides faster feedback
- Use CSS `:active` for visual touch feedback
- Avoid `:hover` on touch devices

### Preventing Default Behavior

```typescript
// Prevent scroll while interacting
<div
  onTouchMove={(e) => {
    e.preventDefault();  // Prevent scroll
    handleMove(e);
  }}
  className="touch-none"  // Tailwind: touch-action: none
>
  Drag area
</div>
```

---

## Swipe Gestures

### Basic Swipe Detection

```typescript
interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

function useSwipe(handlers: SwipeHandlers, threshold = 50) {
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    // Determine swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          handlers.onSwipeRight?.();
        } else {
          handlers.onSwipeLeft?.();
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > threshold) {
        if (deltaY > 0) {
          handlers.onSwipeDown?.();
        } else {
          handlers.onSwipeUp?.();
        }
      }
    }
  };

  return { onTouchStart, onTouchEnd };
}
```

### Usage Example

```typescript
function SwipeCard() {
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => console.log('Swiped left'),
    onSwipeRight: () => console.log('Swiped right'),
  });

  return (
    <div
      {...swipeHandlers}
      className="bg-white p-6 rounded-lg shadow-md"
    >
      Swipe me left or right
    </div>
  );
}
```

### Dismissible Card with Swipe

```typescript
function DismissibleCard({ onDismiss }: { onDismiss: () => void }) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0];
      setOffset(touch.clientX - e.currentTarget.getBoundingClientRect().left);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(offset) > 100) {
      onDismiss();
    } else {
      setOffset(0);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${offset}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s'
      }}
      className="bg-white p-4 rounded-lg shadow-md"
    >
      Card content - swipe to dismiss
    </div>
  );
}
```

---

## Horizontal Scrolling

### Swipeable Carousel

```typescript
<div className="
  flex gap-4
  overflow-x-auto           /* Enable horizontal scroll */
  snap-x snap-mandatory     /* Snap to items */
  scrollbar-hide            /* Hide scrollbar on mobile */
  pb-4                      /* Space for scroll indicator */
  -mx-4 px-4                /* Edge-to-edge on mobile */
  md:mx-0 md:px-0           /* Contained on desktop */
">
  {items.map((item, index) => (
    <div
      key={index}
      className="
        flex-shrink-0         /* Prevent shrinking */
        w-72                  /* Fixed width */
        snap-center           /* Snap to center */
      "
    >
      <Card {...item} />
    </div>
  ))}
</div>
```

### Hide Scrollbar (CSS)

```css
/* Tailwind plugin or custom CSS */
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;     /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;             /* Chrome, Safari */
}
```

### Scroll Snap Types

```typescript
// Snap to center of container
<div className="snap-x snap-center">

// Snap to start of container
<div className="snap-x snap-start">

// Mandatory snapping (always snaps)
<div className="snap-mandatory">

// Proximity snapping (optional)
<div className="snap-proximity">
```

### Full-Width Cards Carousel

```typescript
<div className="
  flex overflow-x-auto snap-x snap-mandatory
  scrollbar-hide
  -mx-4                     /* Bleed to edges */
">
  {items.map((item, index) => (
    <div
      key={index}
      className="
        flex-shrink-0
        w-[calc(100vw-2rem)]  /* Full viewport minus padding */
        px-4
        snap-center
      "
    >
      <Card {...item} />
    </div>
  ))}
</div>
```

---

## Pull-to-Refresh

### Basic Implementation

```typescript
function PullToRefresh({ onRefresh, children }: {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStart, setTouchStart] = useState(0);

  const PULL_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow pull at top of page
    if (window.scrollY === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === 0) return;

    const distance = e.touches[0].clientY - touchStart;
    if (distance > 0) {
      setPullDistance(Math.min(distance, PULL_THRESHOLD * 1.5));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > PULL_THRESHOLD) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
    setTouchStart(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="overscroll-contain"
    >
      {/* Refresh indicator */}
      <div
        style={{ height: pullDistance }}
        className="flex items-center justify-center transition-all"
      >
        {isRefreshing ? (
          <LoadingSpinner />
        ) : pullDistance > PULL_THRESHOLD ? (
          <span>Release to refresh</span>
        ) : pullDistance > 0 ? (
          <span>Pull to refresh</span>
        ) : null}
      </div>

      {children}
    </div>
  );
}
```

### Prevent Overscroll Chain

```typescript
// Prevent scroll chaining to parent
<div className="overscroll-contain overflow-y-auto">
  {content}
</div>

// Prevent overscroll bounce
<div className="overscroll-none">
  {content}
</div>
```

---

## Long Press

### Long Press Hook

```typescript
function useLongPress(
  callback: () => void,
  duration = 500
) {
  const [isPressed, setIsPressed] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const start = useCallback(() => {
    setIsPressed(true);
    timeoutRef.current = setTimeout(() => {
      callback();
    }, duration);
  }, [callback, duration]);

  const clear = useCallback(() => {
    setIsPressed(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    isPressed
  };
}
```

### Usage Example

```typescript
function LongPressButton() {
  const longPressProps = useLongPress(
    () => alert('Long pressed!'),
    500
  );

  return (
    <button
      {...longPressProps}
      className={`
        px-6 py-3 rounded-lg
        ${longPressProps.isPressed ? 'bg-blue-600' : 'bg-blue-500'}
      `}
    >
      Long press me
    </button>
  );
}
```

---

## Pinch-to-Zoom

### Basic Pinch Zoom

```typescript
function PinchZoom({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  const [lastDistance, setLastDistance] = useState(0);

  const getDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setLastDistance(getDistance(e.touches));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getDistance(e.touches);
      const ratio = distance / lastDistance;
      setScale(prevScale => Math.max(1, Math.min(4, prevScale * ratio)));
      setLastDistance(distance);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      className="overflow-hidden touch-none"
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          transition: 'transform 0.1s'
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

### Image Pinch Zoom

```typescript
// Use native browser zoom for images
<img
  src="/image.jpg"
  alt="Zoomable"
  style={{ touchAction: 'pinch-zoom' }}
  className="w-full h-auto"
/>
```

---

## Drag & Drop

### Draggable Item

```typescript
function DraggableItem({ id, children }: {
  id: string;
  children: React.ReactNode;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    setOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - offset.x,
        y: touch.clientY - offset.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: isDragging
          ? `translate(${position.x}px, ${position.y}px)`
          : 'none',
        transition: isDragging ? 'none' : 'transform 0.3s'
      }}
      className={`
        touch-none
        ${isDragging ? 'opacity-75 scale-105' : 'opacity-100'}
      `}
    >
      {children}
    </div>
  );
}
```

---

## Scroll Behavior

### Smooth Scrolling

```typescript
// Global smooth scroll
<html className="scroll-smooth">

// Component-level
<div className="overflow-y-auto scroll-smooth">
  {content}
</div>

// Programmatic scroll
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};
```

### Scroll to Element

```typescript
function ScrollToSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  const scrollToSection = () => {
    sectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  return (
    <>
      <button onClick={scrollToSection}>
        Scroll to Section
      </button>
      <div ref={sectionRef}>
        Target section
      </div>
    </>
  );
}
```

### Infinite Scroll

```typescript
function InfiniteScroll({ loadMore }: { loadMore: () => Promise<void> }) {
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div>
      {items.map(item => (
        <Item key={item.id} {...item} />
      ))}
      <div ref={loaderRef} className="py-4 text-center">
        <LoadingSpinner />
      </div>
    </div>
  );
}
```

### Sticky Headers

```typescript
<div className="
  sticky top-0 z-10
  bg-white border-b border-gray-200
  px-4 py-3
">
  Sticky Header
</div>
```

---

## Touch Feedback

### Visual Feedback Patterns

```typescript
// Active state (instant feedback)
<button className="
  bg-blue-500
  active:bg-blue-600        /* Touch feedback */
  transition-colors
">
  Tap me
</button>

// Scale feedback
<button className="
  active:scale-95
  transition-transform
">
  Tap me
</button>

// Opacity feedback
<button className="
  active:opacity-75
  transition-opacity
">
  Tap me
</button>
```

### Ripple Effect (Material Design)

```typescript
function RippleButton({ children, onClick }: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples(prev => [...prev, { x, y, id: Date.now() }]);
    onClick();

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.slice(1));
    }, 600);
  };

  return (
    <button
      onClick={handleClick}
      className="relative overflow-hidden px-6 py-3 bg-blue-500 text-white rounded-lg"
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          style={{
            left: ripple.x,
            top: ripple.y
          }}
          className="
            absolute w-0 h-0
            bg-white rounded-full
            animate-ripple
          "
        />
      ))}
    </button>
  );
}

// Add to tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      keyframes: {
        ripple: {
          '0%': { width: '0', height: '0', opacity: '0.5' },
          '100%': { width: '500px', height: '500px', opacity: '0' }
        }
      },
      animation: {
        ripple: 'ripple 0.6s ease-out'
      }
    }
  }
}
```

---

## Common Mistakes

### ❌ Using Hover on Touch Devices

```typescript
// ❌ WRONG - No hover on touch
<div className="hidden hover:block">

// ✅ CORRECT - Click/tap to show
<div className={isVisible ? 'block' : 'hidden'}>
```

### ❌ Not Preventing Default on Touch Events

```typescript
// ❌ WRONG - Scroll interferes with drag
<div onTouchMove={handleDrag}>

// ✅ CORRECT - Prevent scroll during drag
<div onTouchMove={(e) => {
  e.preventDefault();
  handleDrag(e);
}} className="touch-none">
```

### ❌ Small Swipe Threshold

```typescript
// ❌ WRONG - Too sensitive
const THRESHOLD = 10;  // Accidental swipes

// ✅ CORRECT - Appropriate threshold
const THRESHOLD = 50;  // Intentional swipes
```

---

## Related Resources

- [Touch Targets Guide](./touch-targets-guide.md)
- [Responsive Patterns](./responsive-patterns.md)
- [Mobile Performance](./mobile-performance.md)
