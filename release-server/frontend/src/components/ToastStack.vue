<template>
  <div class="stack" aria-live="polite">
    <transition-group name="slide-up">
      <div v-for="t in toasts" :key="t.id" class="item" :class="t.type">
        {{ t.message }}
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useToast } from '@/composables/useToast';

const { toasts } = useToast();
</script>

<style scoped>
.stack {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}
.item {
  pointer-events: none;
  padding: 12px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border);
  max-width: 360px;
}
.item.success {
  background: var(--surface2);
  color: var(--green);
  border-color: var(--green-tint);
}
.item.error {
  background: var(--surface2);
  color: var(--danger-text);
  border-color: var(--danger-tint);
}
</style>
