import { createError, readBody } from 'h3';
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkflowActions from '../../app/components/modules/prints/WorkflowActions.vue';
import { printStatuses } from '../../shared/schemas/prints';

const print = { id: 'synthetic-print', status: 'DRAFT' as const, paidAt: null, archivedAt: null };
const global = { stubs: { UTooltip: { inheritAttrs: false, template: '<slot />' } } };
const request = vi.fn();
registerEndpoint('/api/prints/synthetic-print', {
  method: 'PATCH',
  handler: async (event) =>
    request('/api/prints/synthetic-print', { method: event.method, body: await readBody(event) }),
});
beforeEach(() => {
  request.mockReset().mockResolvedValue({});
});

describe('print workflow row actions', () => {
  it.each(printStatuses)('offers only the next status for %s', async (status) => {
    const wrapper = await mountSuspended(WorkflowActions, { props: { print: { ...print, status } }, global });
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(status === 'DONE' ? 1 : 2);
    if (status === 'DRAFT') {
      expect(request).not.toHaveBeenCalled();
      wrapper.findComponent({ name: 'CommonConfirmButton' }).vm.$emit('confirm');
    } else if (status !== 'DONE') await buttons[0]!.trigger('click');
    await flushPromises();
    if (status !== 'DONE') {
      await vi.waitFor(() => expect(wrapper.emitted('updated')).toHaveLength(1));
      expect(request).toHaveBeenCalledExactlyOnceWith('/api/prints/synthetic-print', {
        method: 'PATCH',
        body: { status: printStatuses[printStatuses.indexOf(status) + 1] },
      });
      expect(wrapper.emitted('updated')).toHaveLength(1);
    } else expect(request).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('marks payment once, locks while pending, and refreshes after success', async () => {
    let resolve!: (value: object) => void;
    request.mockImplementation(
      () =>
        new Promise<object>((done) => {
          resolve = done;
        }),
    );
    const wrapper = await mountSuspended(WorkflowActions, {
      props: { print: { ...print, status: 'PRINTING' } },
      global,
    });
    await wrapper.findAll('button')[1]!.trigger('click');
    expect(wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined)).toBe(
      true,
    );
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/prints/synthetic-print', {
      method: 'PATCH',
      body: { paid: true },
    });
    expect(wrapper.emitted('updated')).toBeUndefined();
    resolve({});
    await vi.waitFor(() => expect(wrapper.emitted('updated')).toHaveLength(1));
    expect(wrapper.emitted('updated')).toHaveLength(1);
    await wrapper.setProps({ print: { ...print, status: 'PRINTING', paidAt: '2026-09-21T00:00:00Z' } });
    expect(wrapper.findAll('button')).toHaveLength(1);
    await wrapper.setProps({ print: { ...print, archivedAt: '2026-09-21T00:00:00Z' } });
    expect(wrapper.findAll('button')).toHaveLength(0);
    wrapper.unmount();
  });

  it('reports failed changes without requesting a refresh', async () => {
    request.mockRejectedValue(createError({ statusCode: 409, statusMessage: 'Synthetic failure' }));
    const wrapper = await mountSuspended(WorkflowActions, {
      props: { print: { ...print, status: 'DONE' } },
      global,
    });
    await wrapper.get('button').trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.emitted('error')?.[0]?.[0]).toContain('Synthetic failure'));
    expect(wrapper.emitted('updated')).toBeUndefined();
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });
});
