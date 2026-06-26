export const RAYHEALTH_FOREGROUND_EVENT = 'rayhealth:foreground';

export function emitRayHealthForegroundEvent(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(RAYHEALTH_FOREGROUND_EVENT));
  }
}
