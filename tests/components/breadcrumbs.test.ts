import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { defineComponent, h } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useBreadcrumbItems } from '../../app/composables/useBreadcrumbItems';

const { currentRoute } = vi.hoisted(() => ({ currentRoute: { path: '/' } }));
mockNuxtImport('useRoute', () => () => currentRoute);

const BreadcrumbProbe = defineComponent({
  props: { title: String },
  setup(props) {
    const items = useBreadcrumbItems(() => props.title);
    return () => h('pre', JSON.stringify(items.value));
  },
});

describe('navigation breadcrumbs', () => {
  it.each([
    ['/', ['/']],
    ['/prints', ['/', '/prints']],
    ['/prints/example', ['/', '/prints', undefined]],
    ['/customers/example', ['/', '/customers', undefined]],
    ['/series/example', ['/', '/series', undefined]],
    ['/spools/example', ['/', '/spools', undefined]],
    ['/settings/calculation', ['/', '/settings', '/settings/calculation']],
  ])('builds the hierarchy for %s', async (route, paths) => {
    currentRoute.path = route;
    const wrapper = await mountSuspended(BreadcrumbProbe, { props: { title: 'Example record' } });
    const items = JSON.parse(wrapper.text()) as Array<{ label: string; to?: string }>;
    expect(items).toHaveLength(paths.length);
    expect(items.slice(0, -1).map((item) => item.to)).toEqual(paths.slice(0, -1));
    expect(items.at(-1)?.to).toBeUndefined();
    if (route.endsWith('/example')) {
      expect(items.at(-1)?.label).toBe('Example record');
      await wrapper.setProps({ title: 'Updated name' });
      expect(JSON.parse(wrapper.text()).at(-1).label).toBe('Updated name');
    }
    wrapper.unmount();
  });
});
