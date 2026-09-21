export function useBreadcrumbItems(detailTitle?: () => string | undefined) {
  const route = useRoute();
  const { t } = useI18n();
  return computed(() => {
    const path = route.path.replace(/\/$/, '') || '/';
    const home = mainNavigation.find((item) => item.to === '/')!;
    const items: Array<{ label: string; icon: string; to?: string }> = [
      { label: t(home.labelKey), icon: home.icon, ...(path === '/' ? {} : { to: '/' }) },
    ];
    if (path === '/') return items;
    const parent = mainNavigation.find(
      (item) => item.to !== '/' && (path === item.to || path.startsWith(`${item.to}/`)),
    );
    if (!parent) return items;
    items.push({
      label: t(parent.labelKey),
      icon: parent.icon,
      ...(path === parent.to ? {} : { to: parent.to }),
    });
    if (path !== parent.to) {
      const settings = settingsNavigation.find((item) => item.to === path);
      items.push({
        label: settings ? t(settings.labelKey) : detailTitle?.() || t('common.loading'),
        icon: settings?.icon ?? parent.icon,
      });
    }
    return items;
  });
}
