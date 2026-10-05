/**
 * 未存改动（CONTEXT.md）：展开态里尚未交的改动，叠在已存数据之上。
 * 用法：const edit = useUnsaved(() => savedObj, { onBlocked });
 *       模板里 v-model="edit.model.displayName"；edit.dirty / edit.values() / edit.discard()。
 * 列表重载换掉 savedObj 时，改过的字段仍保留用户的值、没改过的跟着新数据走（审计 #10 的根）。
 * 有改动时：离页被拦（调 onBlocked）、关标签页浏览器会问。
 */
import { reactive, computed, onUnmounted } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

const norm = v => (v == null ? '' : v);

export function useUnsaved(source, { onBlocked } = {}) {
  const patch = reactive({});
  const saved = key => norm(source()?.[key]);

  const model = new Proxy(
    {},
    {
      get: (_, key) => (key in patch ? patch[key] : saved(key)),
      set: (_, key, v) => {
        if (v === saved(key)) delete patch[key];
        else patch[key] = v;
        return true;
      },
    },
  );

  const dirty = computed(() => Object.keys(patch).some(k => patch[k] !== saved(k)));

  function values() {
    return { ...source(), ...patch };
  }
  function discard() {
    for (const k of Object.keys(patch)) delete patch[k];
  }

  onBeforeRouteLeave(() => {
    if (!dirty.value) return true;
    onBlocked?.();
    return false;
  });
  const onBeforeUnload = e => {
    if (dirty.value) e.preventDefault();
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload));

  return reactive({ model, dirty, values, discard });
}
