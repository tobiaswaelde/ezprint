import type { DateFormat, DurationFormat, TimeFormat } from '~/utils/display-formatting';
import { DATE_FORMATS, TIME_FORMATS } from '~/utils/display-formatting';
import type { ApplicationSettingsDto } from '#shared/types/settings';

export function useApplicationSettings() {
  const { t, setLocale } = useI18n();
  const colorMode = useColorMode();
  const { user, updateLocale } = useAuth();
  const { dateFormat, timeFormat, durationFormat, setDateFormat, setTimeFormat, setDurationFormat } =
    useFormatting();
  const { setEnabled: setSpoolManagementEnabled } = useSpoolManagement();
  const pending = ref(false);
  const message = ref('');
  const messageColor = ref<'success' | 'error'>('success');
  const form = reactive({
    currency: 'EUR',
    defaultLocale: 'de-DE' as 'de-DE' | 'en-US',
    electricityPricePerKwh: '0',
    spoolManagementEnabled: true,
    theme: 'system' as 'light' | 'dark' | 'system',
    dateFormat: 'DD.MM.YYYY' as DateFormat,
    timeFormat: 'HH:mm' as TimeFormat,
    durationFormat: 'human' as DurationFormat,
  });
  const localeOptions = computed(() => [
    { label: 'Deutsch', value: 'de-DE' },
    { label: 'English', value: 'en-US' },
  ]);
  const themeOptions = computed(() =>
    (['light', 'dark', 'system'] as const).map((value) => ({ label: t(`common.${value}`), value })),
  );
  const dateFormatOptions = DATE_FORMATS.map((value) => ({ label: value, value }));
  const timeFormatOptions = TIME_FORMATS.map((value) => ({ label: value, value }));
  const durationFormatOptions = computed<Array<{ label: string; value: DurationFormat }>>(() => [
    { label: t('settings.durationFormatHuman'), value: 'human' },
    { label: t('settings.durationFormatCompact'), value: 'compact' },
    { label: t('settings.durationFormatClock'), value: 'clock' },
    { label: t('settings.durationFormatDecimal'), value: 'decimal' },
  ]);

  async function load() {
    Object.assign(form, await $fetch<ApplicationSettingsDto>('/api/settings'));
    setSpoolManagementEnabled(form.spoolManagementEnabled);
    form.defaultLocale = user.value?.locale ?? form.defaultLocale;
    if (colorMode.preference === 'light' || colorMode.preference === 'dark')
      form.theme = colorMode.preference;
    else form.theme = 'system';
    form.dateFormat = dateFormat.value;
    form.timeFormat = timeFormat.value;
    form.durationFormat = durationFormat.value;
  }

  async function save() {
    pending.value = true;
    message.value = '';
    try {
      Object.assign(
        form,
        await $fetch<ApplicationSettingsDto>('/api/settings', {
          method: 'PATCH',
          body: {
            currency: form.currency,
            defaultLocale: form.defaultLocale,
            electricityPricePerKwh: form.electricityPricePerKwh,
            spoolManagementEnabled: form.spoolManagementEnabled,
          },
        }),
      );
      setSpoolManagementEnabled(form.spoolManagementEnabled);
      await setLocale(form.defaultLocale);
      localStorage.setItem('print-cost-locale', form.defaultLocale);
      await updateLocale(form.defaultLocale);
      colorMode.preference = form.theme;
      setDateFormat(form.dateFormat);
      setTimeFormat(form.timeFormat);
      setDurationFormat(form.durationFormat);
      messageColor.value = 'success';
      message.value = t('settings.saved');
    } catch (reason) {
      messageColor.value = 'error';
      message.value = reason instanceof Error ? reason.message : String(reason);
    } finally {
      pending.value = false;
    }
  }

  return {
    dateFormatOptions,
    durationFormatOptions,
    form,
    load,
    localeOptions,
    message,
    messageColor,
    pending,
    save,
    themeOptions,
    timeFormatOptions,
  };
}
