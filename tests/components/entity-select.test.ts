import { getQuery } from 'h3';
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { beforeEach, expect, it, vi } from 'vitest';
import EntitySelect from '../../app/components/common/EntitySelect.vue';

const queries: Array<Record<string, unknown>> = [];
let resolveOld: ((result: object) => void) | undefined;
const selected = { id: 'selected-150', name: 'Selected outside first page', archivedAt: null };
const created = { id: 'created', name: 'New customer', archivedAt: null };
registerEndpoint('/api/customers/selected-150', () => selected);
registerEndpoint('/api/customers/created', () => created);
registerEndpoint('/api/customers', (event) => {
  const query = getQuery(event);
  queries.push(query);
  if (query.search === 'old')
    return new Promise<object>((resolve) => {
      resolveOld = resolve;
    });
  const page = Number(query.page);
  const items = query.search
    ? [{ id: 'match-200', name: String(query.search), archivedAt: null }]
    : Array.from({ length: 25 }, (_, index) => ({
        id: `customer-${(page - 1) * 25 + index}`,
        name: `Customer ${(page - 1) * 25 + index}`,
        archivedAt: null,
      }));
  return { items, total: query.search ? 1 : 200, page, pageSize: 25 };
});
beforeEach(() => {
  queries.length = 0;
  resolveOld = undefined;
});

it('searches the server, retains selected labels and ignores stale responses', async () => {
  const wrapper = await mountSuspended(EntitySelect, {
    props: { resource: 'customers', modelValue: selected.id },
  });
  const select = wrapper.findComponent({ name: 'USelectMenu' });
  await vi.waitFor(() =>
    expect(select.props('items')).toContainEqual(expect.objectContaining({ value: selected.id })),
  );
  expect(select.props('ignoreFilter')).toBe(true);
  select.vm.$emit('update:searchTerm', 'old');
  await vi.waitFor(() => expect(resolveOld).toBeTypeOf('function'));
  select.vm.$emit('update:searchTerm', 'rare');
  await vi.waitFor(() =>
    expect(select.props('items')).toContainEqual(expect.objectContaining({ label: 'rare' })),
  );
  resolveOld!({ items: [{ id: 'old-result', name: 'Stale' }], total: 1, page: 1, pageSize: 25 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(select.props('items')).not.toContainEqual(expect.objectContaining({ label: 'Stale' }));
  expect(wrapper.get('button[aria-haspopup="listbox"]').text()).toContain(selected.name);
  expect(queries.at(-1)).toMatchObject({ search: 'rare', page: '1', pageSize: '25' });
  wrapper.unmount();
});

it('loads another server page without preloading all records', async () => {
  const wrapper = await mountSuspended(EntitySelect, { props: { resource: 'customers', modelValue: '' } });
  const select = wrapper.findComponent({ name: 'USelectMenu' });
  await vi.waitFor(() => expect(select.props('items')).toHaveLength(25));
  await wrapper.get('button[aria-haspopup="listbox"]').trigger('click');
  await vi.waitFor(() =>
    expect(
      wrapper.findAllComponents({ name: 'UButton' }).some((button) => button.props('label') === 'Mehr laden'),
    ).toBe(true),
  );
  wrapper
    .findAllComponents({ name: 'UButton' })
    .find((button) => button.props('label') === 'Mehr laden')!
    .vm.$emit('click', new MouseEvent('click'));
  await vi.waitFor(() => expect(select.props('items')).toHaveLength(50));
  expect(queries.map((query) => query.page)).toEqual(['1', '2']);
  wrapper.unmount();
});

it('keeps the selection on cancel and appends a created record to multiple selection', async () => {
  const wrapper = await mountSuspended(EntitySelect, {
    props: { resource: 'customers', modelValue: [selected.id], multiple: true },
    global: {
      stubs: {
        CommonEntityCreateDialog: {
          name: 'CommonEntityCreateDialog',
          props: ['open'],
          emits: ['created', 'update:open'],
          template: '<div />',
        },
      },
    },
  });
  await wrapper.get('button[title="Kunden erstellen"]').trigger('click');
  let dialog = wrapper.findComponent({ name: 'CommonEntityCreateDialog' });
  dialog.vm.$emit('update:open', false);
  await wrapper.vm.$nextTick();
  expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  await wrapper.get('button[title="Kunden erstellen"]').trigger('click');
  dialog = wrapper.findComponent({ name: 'CommonEntityCreateDialog' });
  dialog.vm.$emit('created', created.id);
  await vi.waitFor(() => expect(wrapper.emitted('update:modelValue')).toEqual([[[selected.id, created.id]]]));
  await vi.waitFor(() => expect(queries.length).toBeGreaterThanOrEqual(2));
  wrapper.unmount();
});
