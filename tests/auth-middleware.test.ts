import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('redirects to the offline route without requesting authentication state', async () => {
  const navigateTo = vi.fn((target) => target);
  const fetch = vi.fn();
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('$fetch', fetch);
  vi.stubGlobal('navigateTo', navigateTo);
  vi.stubGlobal('defineNuxtRouteMiddleware', (middleware: unknown) => middleware);

  const { default: middleware } = await import('../app/middleware/auth.global');
  const result = await middleware({ path: '/prints', fullPath: '/prints?page=2' } as never, {} as never);

  expect(navigateTo).toHaveBeenCalledWith(
    { path: '/offline', query: { redirect: '/prints?page=2' } },
    { replace: true },
  );
  expect(fetch).not.toHaveBeenCalled();
  expect(result).toEqual({ path: '/offline', query: { redirect: '/prints?page=2' } });
});
