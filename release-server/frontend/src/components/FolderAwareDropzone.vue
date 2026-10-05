<template>
  <div
    class="drop-zone"
    :class="{ drag: dragActive, disabled }"
    @dragover.prevent="!disabled && (dragActive = true)"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
    @click="!disabled && fileInputRef.click()"
  >
    <input ref="fileInputRef" type="file" multiple class="hidden-input" :disabled="disabled" @click.stop @change="onInputChange" />
    <input ref="dirInputRef" type="file" webkitdirectory class="hidden-input" :disabled="disabled" @click.stop @change="onInputChange" />
    <span>{{ hint }}</span>
    <button type="button" class="dir-link" :disabled="disabled" @click.stop="dirInputRef.click()">选文件夹</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ingestFromDataTransfer, ingestFromFileList } from '@/composables/useFolderUpload';

const props = defineProps({
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '拖文件或文件夹到此处，或点击选文件' },
});

const emit = defineEmits(['items']);

const fileInputRef = ref(null);
const dirInputRef = ref(null);
const dragActive = ref(false);

/** 指针进入子元素也会触发 dragleave：只在真正离开整个区域时熄灭 */
function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) dragActive.value = false;
}

async function onDrop(e) {
  dragActive.value = false;
  if (props.disabled) return;
  const list = await ingestFromDataTransfer(e.dataTransfer);
  if (list.length) emit('items', list);
}

async function onInputChange(e) {
  const list = await ingestFromFileList(e.target.files);
  e.target.value = '';
  if (list.length) emit('items', list);
}
</script>

<style scoped>
.drop-zone {
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius);
  padding: 28px 20px;
  text-align: center;
  color: var(--text2);
  cursor: pointer;
  transition: border-color 0.18s var(--ease), background 0.18s var(--ease), color 0.18s var(--ease);
  font-size: 14px;
  line-height: 1.55;
}
.drop-zone:hover,
.drop-zone.drag {
  border-color: var(--accent);
  background: var(--accent-tint);
  color: var(--accent);
}
.drop-zone.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dir-link {
  display: block;
  margin: 6px auto 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 12px;
  color: var(--text3);
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: pointer;
}
.dir-link:hover { color: var(--accent); }
.hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
