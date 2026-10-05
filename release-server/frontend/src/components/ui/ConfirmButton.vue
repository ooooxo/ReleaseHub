<!--
  确认层（CONTEXT.md）：库级或不可逆操作的按钮。按下长出浮层写清后果，再按「确认」才 emit confirm。
  用法：<ConfirmButton label="删除资源库" title="删除整个资源库？" detail="…" confirm-label="删除" danger @confirm="…" />
-->
<template>
  <Layer v-model:open="open" :align="align">
    <template #trigger="{ toggle }">
      <button type="button" :class="btnClass" :disabled="busy" @click="toggle">{{ label }}</button>
    </template>
    <p class="cf-title">{{ title }}</p>
    <p v-if="detail" class="cf-detail">{{ detail }}</p>
    <div class="cf-actions">
      <button type="button" class="btn btn-ghost btn-sm" @click="open = false">取消</button>
      <button type="button" class="btn btn-sm" :class="danger ? 'btn-danger' : 'btn-primary'" autofocus @click="onConfirm">
        {{ confirmLabel }}
      </button>
    </div>
  </Layer>
</template>

<script setup>
import { ref } from 'vue';
import Layer from './Layer.vue';

defineProps({
  label: { type: String, required: true },
  title: { type: String, required: true },
  detail: { type: String, default: '' },
  confirmLabel: { type: String, default: '确认' },
  danger: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  align: { type: String, default: 'end' },
  btnClass: { type: [String, Array, Object], default: 'btn btn-ghost btn-sm' },
});
const emit = defineEmits(['confirm']);
const open = ref(false);

function onConfirm() {
  open.value = false;
  emit('confirm');
}
</script>

<style scoped>
.cf-title { margin: 0 0 6px; font-size: 0.9rem; font-weight: 650; color: var(--text); }
.cf-detail { margin: 0; font-size: 0.78rem; line-height: 1.6; color: var(--text2); }
.cf-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
</style>
