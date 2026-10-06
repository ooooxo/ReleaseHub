<!--
  顶栏（取代原来的左侧栏，与 ooooxo.com 入口页同一枚字标）：左字标回总览，右侧磁盘占用 · 页面自己的动作位 · 设置。
  页面往 #topbar-actions 里 Teleport 自己的顶栏动作（总览的「新建」）。
-->
<template>
  <header class="topbar">
    <RouterLink to="/" class="brand" v-tip="'回总览'"><span class="wm">ooooxo</span><span class="name">Release Hub</span></RouterLink>
    <span class="sp" />
    <span v-if="disk" class="disk" :class="{ warn: usedPct >= 90 }" v-tip="`已用 ${formatBytes(disk.used)} / 容量 ${formatBytes(disk.total)}`">
      磁盘 {{ usedPct }}% · 剩 {{ formatBytes(disk.free) }}
    </span>
    <span v-else-if="diskError" class="disk warn">{{ diskError }}</span>
    <div id="topbar-actions" class="acts" />
    <RouterLink to="/settings" class="gl" aria-label="设置" v-tip="'设置'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z" /></svg>
    </RouterLink>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { api } from '@/api/client';
import { formatBytes } from '@/utils/format-bytes';

const DISK_POLL_MS = 45000;

const disk = ref(null);
const diskError = ref('');
const usedPct = computed(() => {
  const d = disk.value;
  if (!d?.total) return 0;
  return Math.min(100, Math.max(0, Math.round((d.used / d.total) * 100)));
});

let timer = null;
async function pull() {
  try {
    const s = await api('GET', '/api/system');
    disk.value = s?.disk || null;
    diskError.value = '';
  } catch (e) {
    disk.value = null;
    if (e.status !== 401) diskError.value = `磁盘读取失败：${e.message}`;
  }
}
onMounted(() => {
  pull();
  timer = setInterval(pull, DISK_POLL_MS);
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 22px 40px;
  background: linear-gradient(var(--bg) 55%, rgba(12, 12, 14, 0));
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: inherit;
  text-decoration: none;
}
.wm {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}
.name {
  font-size: 13px;
  color: var(--text3);
}
.sp {
  flex: 1;
}
.disk {
  font-size: 12px;
  color: var(--text3);
  white-space: nowrap;
  margin-right: 6px;
}
.disk.warn {
  color: var(--amber);
}
.acts {
  display: flex;
  align-items: center;
  gap: 8px;
}
.acts:empty {
  display: none;
}
.gl {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: var(--text3);
  transition: color var(--t-fast) var(--ease-hover), background var(--t-fast) var(--ease-hover);
}
.gl:hover,
.gl.router-link-active {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}
.gl svg {
  width: 18px;
  height: 18px;
}
@media (max-width: 760px) {
  .topbar {
    padding: 16px 16px 16px 22px;
  }
  .name,
  .disk {
    display: none;
  }
}
</style>
