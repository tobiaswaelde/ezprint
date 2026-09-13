export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  if (!navigator.onLine) {
    if (to.path === '/offline') return;
    return navigateTo({ path: '/offline', query: { redirect: to.fullPath } }, { replace: true });
  }

  const publicRoutes = new Set(['/setup', '/login', '/offline']);
  const { user, refresh } = useAuth();
  const { $i18n } = useNuxtApp();
  const { initialized } = await $fetch<{ initialized: boolean }>('/api/auth/setup-status');

  if (!initialized && to.path !== '/setup') return navigateTo('/setup');
  if (initialized && to.path === '/setup') return navigateTo('/login');

  if (!publicRoutes.has(to.path) && !user.value) {
    await refresh().catch(() => null);
    if (!user.value) return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }

  if (user.value && $i18n.locale.value !== user.value.locale) await $i18n.setLocale(user.value.locale);

  if (to.path === '/login' && user.value) return navigateTo('/');
});
