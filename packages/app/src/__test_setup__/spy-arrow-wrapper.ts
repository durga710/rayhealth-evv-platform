/**
 * Vitest 4 enforces JS spec for `new <fn>()` — arrow functions can't be
 * invoked with `new`. Many existing route tests pass an arrow impl to
 * `vi.spyOn(core, 'XRepository').mockImplementation(() => ({ ... }))`
 * and then the route does `new core.XRepository(db).method(...)`. This
 * threw post-vitest-4 upgrade, surfacing as 500s in test responses.
 *
 * Rewriting every call site to use a regular function expression would
 * be ~16+ mechanical edits across multiple files. This setup patches
 * `vi.spyOn` once: when the mock impl is an arrow function, wrap it in
 * a regular function whose explicit return is the arrow's return value.
 * JS `new` of a regular function that returns an object yields that
 * object as the instance — restoring the pre-4 behavior without
 * touching any test source.
 *
 * Detection of arrow-vs-regular: only arrow functions lack a
 * `.prototype` property in modern JS engines.
 */
import { vi } from 'vitest';

const realSpyOn = vi.spyOn.bind(vi);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(vi as any).spyOn = function patchedSpyOn(this: unknown, ...spyArgs: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spy = realSpyOn(...(spyArgs as [any, any]));
  const originalMockImpl = spy.mockImplementation.bind(spy);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spy.mockImplementation = function patchedMockImpl(fn: any) {
    if (typeof fn === 'function' && !fn.prototype) {
      // Arrow function — wrap so `new` works.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalMockImpl(function wrapped(this: unknown, ...args: any[]) {
        return fn(...args);
      });
    }
    return originalMockImpl(fn);
  };
  return spy;
};
