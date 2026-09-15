import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import FilamentSelect from '../../app/components/common/FilamentSelect.vue';

describe('FilamentSelect', () => {
  it('shows the selected filament color as an avatar', async () => {
    const wrapper = await mountSuspended(FilamentSelect, {
      props: {
        modelValue: 'filament-1',
        items: [
          {
            label: 'Maker PLA - Ocean Blue',
            value: 'filament-1',
            colorName: 'Ocean Blue',
            colorHex: '#112233',
          },
        ],
      },
    });

    const selectMenu = wrapper.findComponent({ name: 'USelectMenu' });
    expect(selectMenu.exists()).toBe(true);
    expect(wrapper.get('[data-slot="filamentColor"]').attributes('style')).toContain(
      'background-color: #112233',
    );

    selectMenu.vm.$emit('update:modelValue', 'filament-2');
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('update:modelValue')).toEqual([['filament-2']]);
  });
});
