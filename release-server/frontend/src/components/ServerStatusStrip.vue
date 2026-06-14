<template>
  <aside class="disk-rail" :class="{ collapsed }" aria-label="Releases 所在磁盘与导航">
    <div class="rail-inner">
      <div class="rail-head">
        <RouterLink to="/" class="rail-brand" title="返回总览">
          <span class="rail-bd">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 21V9" /></svg>
          </span>
          <span class="rail-bt"><b>ReleaseHub</b><span>releases 卷</span></span>
        </RouterLink>
        <button type="button" class="rail-collapse" title="收起侧栏" @click="toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
      </div>

      <div v-if="error" class="rail-state err">{{ error }}</div>

      <div v-else-if="disk" class="rail-disk">
        <span class="rail-label">剩余</span>
        <div class="rail-hero">{{ freeMain }}<em>{{ freeUnit }}</em></div>
        <div class="rail-meter" role="img" :aria-label="`已用 ${usedPct}%，剩余 ${formatBytes(disk.free)}`">
          <div class="rail-fill" :class="meterState" :style="{ width: `${usedPct}%` }" />
        </div>
        <div class="rail-pct">{{ usedPct }}% 已用</div>
        <div class="rail-sub">
          <div><span>已用</span><b>{{ formatBytes(disk.used) }}</b></div>
          <div><span>容量</span><b>{{ formatBytes(disk.total) }}</b></div>
        </div>
      </div>

      <div v-else-if="loaded" class="rail-state muted">无法读取该卷磁盘统计</div>
      <div v-else class="rail-state muted">读取中…</div>

      <nav class="rail-foot" aria-label="系统">
        <RouterLink to="/temp-transfer" class="rail-link" :class="{ 'rail-link--active': isTempTransfer }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" /></svg>临时传输
        </RouterLink>
        <RouterLink to="/settings" class="rail-link" :class="{ 'rail-link--active': isSettings }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z" /></svg>设置
        </RouterLink>
      </nav>
    </div>
  </aside>

  <button v-if="collapsed" type="button" class="rail-expand" title="展开侧栏" @click="toggle">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
  </button>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { api } from '@/api/client';
import { formatBytes } from '@/utils/format-bytes';

const route = useRoute();
const isSettings = computed(() => route.name === 'settings');
const isTempTransfer = computed(
  () => route.name === 'temp-transfer' || route.name === 'temp-item',
);

const disk = ref(null);
const error = ref('');
const loaded = ref(false);

const collapsed = ref(localStorage.getItem('rail-collapsed') === '1');
function toggle() {
  collapsed.value = !collapsed.value;
  localStorage.setItem('rail-collapsed', collapsed.value ? '1' : '0');
}

const usedPct = computed(() => {
  const d = disk.value;
  if (!d?.total) return 0;
  return Math.min(100, Math.max(0, Math.round((d.used / d.total) * 100)));
});
const meterState = computed(() => (usedPct.value >= 90 ? 'crit' : usedPct.value >= 75 ? 'warn' : ''));

// 把「123.8 GB」拆成主数与单位，便于排版
const freeParts = computed(() => {
  const s = disk.value ? formatBytes(disk.value.free) : '';
  const m = s.match(/^([\d.,]+)\s*(.*)$/);
  return m ? { main: m[1], unit: m[2] } : { main: s, unit: '' };
});
const freeMain = computed(() => freeParts.value.main);
const freeUnit = computed(() => freeParts.value.unit);

let timer = null;
async function pull() {
  try {
    const s = await api('GET', '/api/system');
    disk.value = s?.disk || null;
    error.value = '';
  } catch (e) {
    if (e.message !== '未授权') {
      error.value = e.message || '无法读取磁盘信息';
    }
    disk.value = null;
  } finally {
    loaded.value = true;
  }
}

onMounted(() => {
  pull();
  timer = setInterval(pull, 45000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.disk-rail {
  flex-shrink: 0;
  width: 248px;
  min-height: 100vh;
  min-height: 100dvh;
  position: sticky;
  top: 0;
  align-self: flex-start;
  z-index: 2;
  background: var(--surface);
  border-right: 1px solid var(--border);
  box-sizing: border-box;
  overflow: hidden;
  transition: width 0.26s var(--ease, ease);
}
.disk-rail.collapsed {
  width: 0;
  border-right: none;
}
.rail-inner {
  width: 248px;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 22px 16px 24px;
  box-sizing: border-box;
}

.rail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 22px;
}
.rail-brand {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 11px;
  text-decoration: none;
  color: inherit;
  min-width: 0;
}
.rail-bd {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-tint);
  color: var(--accent);
  display: grid;
  place-items: center;
}
.rail-bd svg {
  width: 20px;
  height: 20px;
}
.rail-bt {
  min-width: 0;
}
.rail-bt b {
  display: block;
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.01em;
  color: var(--text);
}
.rail-bt span {
  display: block;
  font-size: 0.66rem;
  color: var(--text3);
  font-family: var(--font-mono);
  margin-top: 2px;
}
.rail-collapse {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.rail-collapse:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--surface2);
}
.rail-collapse svg {
  width: 16px;
  height: 16px;
}

.rail-disk {
  background: var(--inset);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 15px 15px 14px;
}
.rail-label {
  font-size: 0.62rem;
  font-weight: 650;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text3);
}
.rail-hero {
  font-family: var(--font-mono);
  font-size: 1.7rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
  margin: 7px 0 0;
  color: var(--text);
}
.rail-hero em {
  font-style: normal;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text3);
  margin-left: 4px;
}
.rail-meter {
  height: 7px;
  background: rgba(242, 243, 245, 0.08);
  border-radius: 99px;
  overflow: hidden;
  margin: 14px 0 8px;
}
.rail-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 99px;
  transition: width 0.4s var(--ease, ease);
}
.rail-fill.warn {
  background: var(--amber);
}
.rail-fill.crit {
  background: var(--danger);
}
.rail-pct {
  font-size: 0.68rem;
  color: var(--text2);
  font-family: var(--font-mono);
}
.rail-sub {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid var(--border);
}
.rail-sub div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rail-sub span {
  font-size: 0.6rem;
  color: var(--text3);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.rail-sub b {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
}

.rail-state {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  padding: 12px 13px;
  border-radius: var(--radius-sm);
  background: var(--inset);
}
.rail-state.muted {
  color: var(--text3);
}
.rail-state.err {
  color: var(--danger);
}

.rail-foot {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rail-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text2);
  text-decoration: none;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.rail-link svg {
  width: 17px;
  height: 17px;
  flex: none;
  opacity: 0.9;
}
.rail-link:hover {
  color: var(--text);
  background: var(--surface2);
}
.rail-link--active {
  color: var(--accent-text);
  background: var(--accent-tint);
  border-color: rgba(56, 189, 248, 0.25);
}

.rail-expand {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 50;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text2);
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  transition: color 0.15s, border-color 0.15s;
}
.rail-expand:hover {
  color: var(--accent-text);
  border-color: rgba(56, 189, 248, 0.4);
}
.rail-expand svg {
  width: 19px;
  height: 19px;
}

@media (max-width: 768px) {
  .disk-rail {
    width: 100%;
    min-height: 0;
    position: static;
  }
  .rail-inner {
    width: 100%;
    min-height: 0;
  }
  .disk-rail.collapsed {
    width: 100%;
  }
  .disk-rail.collapsed .rail-inner {
    display: none;
  }
  .rail-expand {
    position: static;
    box-shadow: none;
    margin: 10px;
  }
}
</style>
