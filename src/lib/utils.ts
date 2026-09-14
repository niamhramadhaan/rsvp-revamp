import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// The `@/lib/utils` → `cn()` convention shadcn/21st.dev components expect
// (see src/components/ui/*). Both deps were already installed; this one
// helper is the entire missing piece, so there's no reason to run the full
// shadcn CLI init (which would also drop components.json, themes, and radix
// deps this app doesn't use) just to get it.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
