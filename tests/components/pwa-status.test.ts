import { useNuxtApp } from '#app';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, expect, it, vi } from 'vitest';
import PwaStatus from '../../app/components/common/PwaStatus.client.vue';

const install = vi.fn();
const cancelInstall = vi.fn();
const updateServiceWorker = vi.fn();
const cancelPrompt = vi.fn();
let pwa: NonNullable<ReturnType<typeof useNuxtApp>['$pwa']>;

beforeEach(() => {
  pwa = useNuxtApp().$pwa!;
  Object.assign(pwa, {
    needRefresh: false,
    showInstallPrompt: false,
    isPWAInstalled: false,
    install,
    cancelInstall,
    updateServiceWorker,
    cancelPrompt,
  });
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

it('offers installation and persists dismissal through the PWA client', async () => {
  pwa.showInstallPrompt = true;
  const wrapper = await mountSuspended(PwaStatus);

  expect(wrapper.text()).toContain('ezPrint installieren');
  await wrapper.get('button').trigger('click');
  expect(install).toHaveBeenCalledOnce();

  pwa.showInstallPrompt = true;
  await wrapper.vm.$nextTick();
  await wrapper.findAll('button')[1]!.trigger('click');
  expect(cancelInstall).toHaveBeenCalledOnce();
});

it('prioritizes a pending update and activates it only after confirmation', async () => {
  pwa.showInstallPrompt = true;
  pwa.needRefresh = true;
  const wrapper = await mountSuspended(PwaStatus);

  expect(wrapper.text()).toContain('Update verfügbar');
  await wrapper.get('button').trigger('click');
  expect(updateServiceWorker).toHaveBeenCalledWith(true);
  expect(install).not.toHaveBeenCalled();

  await wrapper.findAll('button')[1]!.trigger('click');
  expect(cancelPrompt).toHaveBeenCalledOnce();
});

it('prioritizes the offline warning over PWA prompts', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  pwa.needRefresh = true;
  const wrapper = await mountSuspended(PwaStatus);

  expect(wrapper.text()).toContain('Keine Verbindung');
  expect(wrapper.text()).not.toContain('Update verfügbar');
});
