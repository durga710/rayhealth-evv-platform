import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names safely. Resolves utility conflicts (e.g.
 * `px-2 px-4` collapses to `px-4`) and accepts conditional inputs via clsx.
 *
 * Use anywhere a component composes className from props + internal defaults.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
