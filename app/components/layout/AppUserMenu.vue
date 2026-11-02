<template>
  <UDropdownMenu :items="items" :content="{ align: 'end', sideOffset: 8 }">
    <UButton color="neutral" variant="ghost" class="max-w-56 px-2" :aria-label="userMenuLabel">
      <UAvatar :text="initials" color="primary" size="sm" aria-hidden="true" />{{ ' ' }}
      <span class="hidden min-w-0 text-left sm:block">
        <span class="block truncate text-sm font-medium text-highlighted">{{ user?.displayName }}</span>
      </span>
      <UIcon name="i-tabler-selector" class="hidden size-4 text-muted sm:block" />
    </UButton>
  </UDropdownMenu>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

const { t, locales: localeDefinitions, setLocale } = useI18n();
const colorMode = useColorMode();
const { user, logout, updateLocale } = useAuth();
const shortcutsOpen = useState('shortcuts-open', () => false);
const userMenuLabel = computed(
  () =>
    `${t('user.openMenu')}: ${initials.value}${user.value?.displayName ? ` ${user.value.displayName}` : ''}`,
);

const themes = ['light', 'dark', 'system'] as const;
const locales = computed(() =>
  localeDefinitions.value.map((entry) =>
    typeof entry === 'string'
      ? { code: entry, name: entry }
      : { code: entry.code, name: entry.name ?? entry.code },
  ),
);
const initials = computed(() =>
  (user.value?.displayName ?? '?')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
);
const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: t('common.language'),
      icon: 'i-tabler-language',
      children: locales.value.map((option) => ({
        label: option.name,
        icon: user.value?.locale === option.code ? 'i-tabler-check' : undefined,
        onSelect: () => setLanguage(option.code),
      })),
    },
    {
      label: t('common.theme'),
      icon: 'i-tabler-sun-moon',
      children: themes.map((theme) => ({
        label: t(`common.${theme}`),
        icon: colorMode.preference === theme ? 'i-tabler-check' : undefined,
        onSelect: () => {
          colorMode.preference = theme;
        },
      })),
    },
  ],
  [
    {
      label: t('shortcuts.open'),
      icon: 'i-tabler-keyboard',
      kbds: ['?'],
      onSelect: () => {
        shortcutsOpen.value = true;
      },
    },
    {
      label: t('auth.logout'),
      icon: 'i-tabler-logout',
      color: 'error',
      onSelect: () => logout(),
    },
  ],
]);

async function setLanguage(value: string) {
  if (value !== 'de-DE' && value !== 'en-US') return;
  await setLocale(value);
  localStorage.setItem('print-cost-locale', value);
  await updateLocale(value);
}
</script>
