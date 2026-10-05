<!--
  浮层（CONTEXT.md）：从触发按钮处长出的小层，承载短表单或确认。不盖幕布、不锁全页。
  用法：<Layer v-model:open="x" :guard="dirty"><template #trigger="{ toggle }">…</template>…</Layer>
  guard=true（有未存改动）时，点外面与 Esc 都不收，只抖一下提示。
-->
<template>
  <span ref="anchorRef" class="layer-anchor">
    <slot name="trigger" :open="open" :toggle="toggle" />
    <Transition name="layer">
      <div
        v-if="open"
        ref="panelRef"
        class="layer"
        :class="[`layer--${align}`, { 'is-nudged': nudged, 'layer--up': up }]"
        role="dialog"
        @keydown.esc.stop="tryClose"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </span>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue';
import { restartNudge } from '@/utils/restart-nudge';

const props = defineProps({
  open: { type: Boolean, default: false },
  align: { type: String, default: 'end' }, // end：右缘对齐触发钮；start：左缘
  guard: { type: Boolean, default: false },
});
const emit = defineEmits(['update:open']);

const anchorRef = ref(null);
const panelRef = ref(null);
const nudged = ref(false);
const up = ref(false);

function toggle() {
  if (props.open) tryClose();
  else emit('update:open', true);
}
function close() {
  emit('update:open', false);
}
function tryClose() {
  if (!props.guard) {
    close();
    return;
  }
  restartNudge(nudged, panelRef);
}

/* 用 pointerdown 判「点在外面」：在层里按下、拖选文字到外面松手，不会误关 */
function onPointerDown(e) {
  if (!anchorRef.value?.contains(e.target)) tryClose();
}
/* 焦点在层里时由层自己接 Esc 并截住，不让它冒泡去收起外面的卡；这里只管焦点在层外的情况 */
function onKeydown(e) {
  if (e.key === 'Escape' && !panelRef.value?.contains(e.target)) tryClose();
}

watch(
  () => props.open,
  async open => {
    if (open) {
      nudged.value = false;
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('keydown', onKeydown);
      up.value = false;
      await nextTick();
      /* 下方放不下、上方放得下就朝上长 */
      const r = panelRef.value?.getBoundingClientRect();
      const a = anchorRef.value?.getBoundingClientRect();
      if (r && a && r.bottom > window.innerHeight - 8 && a.top - r.height - 16 > 0) up.value = true;
      panelRef.value?.querySelector('[autofocus], input, textarea, button')?.focus();
    } else {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeydown);
      if (anchorRef.value?.contains(document.activeElement) || document.activeElement === document.body) {
        anchorRef.value?.querySelector('button')?.focus();
      }
    }
  },
);
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.layer-anchor {
  position: relative;
  display: inline-flex;
}
.layer {
  position: absolute;
  top: calc(100% + 8px);
  z-index: 60;
  min-width: 300px;
  max-width: min(420px, calc(100vw - 32px));
  padding: 16px;
  background: var(--surface2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
  text-align: left;
}
.layer--end { right: 0; transform-origin: top right; }
.layer--start { left: 0; transform-origin: top left; }
.layer--up { top: auto; bottom: calc(100% + 8px); }
.layer--up.layer--end { transform-origin: bottom right; }
.layer--up.layer--start { transform-origin: bottom left; }
.layer.is-nudged { animation: layer-nudge var(--t-slow) var(--ease-out); }

.layer-enter-active { transition: opacity var(--t-med) var(--ease-out), transform var(--t-med) var(--ease-out); }
.layer-leave-active { transition: opacity var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out); }
.layer-enter-from,
.layer-leave-to {
  opacity: 0;
  transform: translateY(calc(var(--shift) * -0.5)) scale(var(--pop));
}

@keyframes layer-nudge {
  20% { transform: translateX(-5px); }
  45% { transform: translateX(4px); }
  70% { transform: translateX(-2px); }
}
@media (prefers-reduced-motion: reduce) {
  .layer.is-nudged { animation: none; border-color: var(--amber); }
}
</style>
