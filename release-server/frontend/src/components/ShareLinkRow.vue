<template>
  <div v-if="url" class="share-link-row">
    <span class="share-lbl">{{ label }}</span>
    <a class="share-url" :href="url" target="_blank" rel="noopener noreferrer" v-tip="url">{{ url }}</a>
    <button type="button" class="btn btn-sm btn-ghost share-copy" :class="{ 'is-copied done-pop': copied }" @click="onCopy">
      <template v-if="copied"><svg class="check-draw" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>已复制</template>
      <template v-else>复制</template>
    </button>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import { copyText } from '@/utils/copy-text';
import { useToast } from '@/composables/useToast';

const props = defineProps({
  label: { type: String, required: true },
  url: { type: String, default: '' },
});

const { toast } = useToast();

/* 复制成功就在按钮上原地打勾，不另弹 toast：结果出现在动作发生的地方 */
const copied = ref(false);
let timer = null;
function onCopy() {
  if (!props.url) return;
  copyText(props.url).then(
    () => {
      copied.value = true;
      clearTimeout(timer);
      timer = setTimeout(() => { copied.value = false; }, 1400);
    },
    () => toast('复制失败', 'error'),
  );
}
onUnmounted(() => clearTimeout(timer));
</script>

<style scoped>
.share-link-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 10px;
  font-size: 13px;
}
.share-lbl {
  min-width: 88px;
  flex-shrink: 0;
  color: var(--text3);
  font-size: 12px;
}
.share-url {
  flex: 1;
  min-width: 120px;
  color: var(--accent);
  text-decoration: none;
  font-size: 12px;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.share-url:hover {
  text-decoration: underline;
}
.share-copy {
  flex-shrink: 0;
  min-width: 76px;
}
.share-copy.is-copied,
.share-copy.is-copied:hover:not(:disabled) {
  color: var(--green);
  border-color: rgba(52, 211, 153, 0.4);
}
.share-copy svg {
  width: 14px;
  height: 14px;
}
</style>
