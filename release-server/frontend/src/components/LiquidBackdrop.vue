<!--
  整页背景液体（入口页同一个 liquid.js）：压暗当底，entry 变了就按入口页的节奏流过去。
  用法：<LiquidBackdrop :entry="liquidEntry(lib)" />；entry 为 null 时显示中性的「流动」。
  页面被 KeepAlive 缓存时自动停掉渲染，回来接着跑；卸载时释放 WebGL 上下文。
-->
<template>
  <div class="ix-bg" aria-hidden="true"><canvas ref="canvas" /></div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue';
import { mountLiquidBackground } from '@/composables/useLiquid';

const NEUTRAL = { name: 'Release Hub', description: '', url: '', motif: 'flow' };

const props = defineProps({
  entry: { type: Object, default: null },
});

const canvas = ref(null);
let bg = null;
const keyOf = e => (e ? `${e.name}|${e.url}|${e.description}` : '');

onMounted(() => {
  bg = mountLiquidBackground(canvas.value, props.entry || NEUTRAL);
});
watch(
  () => keyOf(props.entry),
  (k, prev) => {
    if (bg && k && k !== prev) bg.flowTo(props.entry);
  },
);
onDeactivated(() => bg?.pause());
onActivated(() => bg?.resume());
onUnmounted(() => bg?.stop());
</script>
