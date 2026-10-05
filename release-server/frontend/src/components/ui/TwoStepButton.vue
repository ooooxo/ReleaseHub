<!--
  两步确认（CONTEXT.md）：条目级删除 / 取消。按一下进待确认态（变红、换字），再按才 emit confirm；
  3 秒不按或焦点离开自动回落。用法：<TwoStepButton label="删除" armed-label="再按删除" @confirm="…" />
-->
<template>
  <button
    type="button"
    class="two-step"
    :class="[btnClass, { armed }]"
    :disabled="busy"
    :aria-label="armed ? armedLabel : (ariaLabel || label)"
    @click.stop="onClick"
    @blur="disarm"
  >
    <slot :armed="armed">{{ armed ? armedLabel : label }}</slot>
  </button>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';

defineProps({
  label: { type: String, default: '删除' },
  armedLabel: { type: String, default: '再按删除' },
  ariaLabel: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  btnClass: { type: [String, Array, Object], default: 'btn btn-ghost btn-sm' },
});
const emit = defineEmits(['confirm']);

const ARM_MS = 3000;
const armed = ref(false);
let timer = null;

function disarm() {
  armed.value = false;
  clearTimeout(timer);
}
function onClick() {
  if (armed.value) {
    disarm();
    emit('confirm');
    return;
  }
  armed.value = true;
  clearTimeout(timer);
  timer = setTimeout(disarm, ARM_MS);
}
onUnmounted(() => clearTimeout(timer));
</script>

<style scoped>
.two-step.armed,
.two-step.armed:hover:not(:disabled) {
  color: var(--danger-text);
  background: var(--danger-tint);
  border-color: rgba(232, 98, 79, 0.45);
}
</style>
