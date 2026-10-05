<!--
  「放弃 · 保存」条：只在有未存改动时浮出，一次交 / 一次丢（ADR-0006，源自 Hrige 0067）。
  用法：<SaveBar ref="bar" :dirty="edit.dirty" :busy="saving" save-label="保存并更新线上" @save="…" @discard="edit.discard()" />
  别处拦下操作时调 bar.nudge() 抖一下，告诉人「先处理这里」。
-->
<template>
  <Transition name="savebar">
    <div v-if="dirty" ref="barRef" class="savebar" :class="{ 'is-nudged': nudged }" role="status">
      <span class="sb-msg">{{ message }}</span>
      <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="$emit('discard')">放弃</button>
      <button type="button" class="btn btn-primary btn-sm" :disabled="busy" @click="$emit('save')">
        {{ busy ? '保存中…' : saveLabel }}
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue';
import { restartNudge } from '@/utils/restart-nudge';

defineProps({
  dirty: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  saveLabel: { type: String, default: '保存' },
  message: { type: String, default: '有未保存的改动' },
});
defineEmits(['save', 'discard']);

const nudged = ref(false);
const barRef = ref(null);
function nudge() {
  restartNudge(nudged, barRef);
}
defineExpose({ nudge });
</script>

<style scoped>
.savebar {
  position: sticky;
  bottom: 14px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 9px 9px 9px 15px;
  background: var(--surface2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}
.sb-msg {
  flex: 1;
  font-size: 0.78rem;
  color: var(--text2);
}
.sb-msg::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 8px;
  border-radius: 99px;
  background: var(--amber);
  vertical-align: 1px;
}
.savebar.is-nudged { animation: savebar-nudge var(--t-slow) var(--ease-out); }

.savebar-enter-active,
.savebar-leave-active { transition: opacity var(--t-med) var(--ease-out), transform var(--t-med) var(--ease-out); }
.savebar-enter-from,
.savebar-leave-to { opacity: 0; transform: translateY(var(--shift)); }

@keyframes savebar-nudge {
  20% { transform: translateX(-5px); }
  45% { transform: translateX(4px); }
  70% { transform: translateX(-2px); }
}
@media (prefers-reduced-motion: reduce) {
  .savebar.is-nudged { animation: none; border-color: var(--amber); }
}
</style>
