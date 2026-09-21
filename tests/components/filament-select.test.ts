import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import FilamentSelect from '../../app/components/common/FilamentSelect.vue';

const filament = {
  id: 'filament-1',
  name: 'Maker PLA - Ocean Blue',
  colorName: 'Ocean Blue',
  colorHex: '#112233',
  archivedAt: null,
};
registerEndpoint('/api/filaments', () => ({ items: [filament], total: 1, page: 1, pageSize: 25 }));
registerEndpoint('/api/filaments/filament-1', () => filament);

describe('FilamentSelect', () => {
  it('shows the selected filament color as an avatar', async () => {
    const wrapper = await mountSuspended(FilamentSelect, {
      props: {
        modelValue: 'filament-1',
      },
    });

    const selectMenu = wrapper.findComponent({ name: 'USelectMenu' });
    expect(selectMenu.exists()).toBe(true);
    await vi.waitFor(() =>
      expect(wrapper.get('[data-slot="filamentColor"]').attributes('style')).toContain(
        'background-color: #112233',
      ),
    );

    selectMenu.vm.$emit('update:modelValue', 'filament-2');
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')).toEqual([['filament-2']]);
  });
});
