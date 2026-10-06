<template>
  <div
    class="drop-zone"
    :class="[variant, { drag: dragActive, disabled }]"
    @dragover.prevent="!disabled && (dragActive = true)"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
    @click="!disabled && fileInputRef.click()"
  >
    <input ref="fileInputRef" type="file" multiple class="hidden-input" :disabled="disabled" @click.stop @change="onInputChange" />
    <input ref="dirInputRef" type="file" webkitdirectory class="hidden-input" :disabled="disabled" @click.stop @change="onInputChange" />
    <slot><span>{{ hint }}</span></slot>
    <button type="button" class="dir-link" :disabled="disabled" @click.stop="dirInputRef.click()">选文件夹</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ingestFromDataTransfer, ingestFromFileList } from '@/composables/useFolderUpload';

const props = defineProps({
  disabled: { type: Boolean, default: false },
  hint: { type: String, default: '拖文件或文件夹到此处，或点击选文件' },
  // block：整块投放区；pill：一枚胶囊（总览的临时文件条、资源库详情的上传）。胶囊的类型色读父级的 --drop-c，默认琥珀
  variant: { type: String, default: 'block' },
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
  transition: border-color var(--t-fast) var(--ease-out), background var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out);
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
/* 胶囊形态：一行高，选文件夹是胶囊里的一枚小钮 */
.drop-zone.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 6px 0 16px;
  border-radius: 20px;
  font-size: 13px;
  line-height: 1;
  text-align: left;
}
.drop-zone.pill > :slotted(svg) {
  width: 16px;
  height: 16px;
  color: var(--drop-c, var(--amber));
}
.drop-zone.pill:hover,
.drop-zone.pill.drag {
  border-color: var(--drop-c, var(--amber));
  background: color-mix(in srgb, var(--drop-c, var(--amber)) 13%, transparent);
  color: var(--text);
}
.drop-zone.pill .dir-link {
  display: inline-flex;
  align-items: center;
  height: 28px;
  margin: 0;
  padding: 0 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text2);
  text-decoration: none;
}
.drop-zone.pill .dir-link:hover {
  color: var(--text);
}
.hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
