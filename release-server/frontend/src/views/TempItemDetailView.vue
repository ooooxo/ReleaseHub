<template>
  <div class="layout-max">
    <div class="appbar">
      <button
        type="button"
        class="back"
        aria-label="返回总览"
        @click="router.push({ path: '/', hash: '#temp-hub' })"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div class="ab-titles">
        <h1>
          {{ item?.originalName || '临时文件' }}
          <span class="chip temp">临时</span>
          <span v-if="pageLoading" class="loading-pill">载入中…</span>
        </h1>
        <span class="pkg">
          {{ item?.kind === 'folder' ? `文件夹 · ${item.fileCount || 0} 个文件` : '单文件' }}
          · 到期即删 · #{{ itemIdShort }}
        </span>
      </div>
      <div class="ab-actions">
        <button
          type="button"
          class="btn btn-danger btn-sm"
          :disabled="pageLoading || !item"
          @click="confirmCancel"
        >取消传输</button>
      </div>
    </div>

    <p v-if="errMsg" class="card err-c">{{ errMsg }}</p>

    <template v-else-if="item">
      <div class="card block timer-card">
        <div class="bigring" :class="{ warn: nearExpiry }">
          <svg width="150" height="150" viewBox="0 0 150 150">
            <circle cx="75" cy="75" r="66" fill="none" stroke="var(--inset)" stroke-width="8" />
            <circle
              cx="75"
              cy="75"
              r="66"
              fill="none"
              :stroke="nearExpiry ? 'var(--amber)' : 'var(--accent)'"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="RING_C"
              :stroke-dashoffset="ringOffset"
              transform="rotate(-90 75 75)"
            />
          </svg>
          <div class="bt" aria-live="polite">
            <span class="bv mono">{{ liveRemaining }}</span>
            <span class="bl">剩余</span>
          </div>
        </div>
        <div class="timer-info">
          <span class="field-label">到期时间</span>
          <p class="expire-at mono">{{ expireLocal }}</p>
          <p class="hint sm">到期后文件与分享链自动失效并删除，不可恢复。</p>
        </div>
      </div>

      <template v-if="publicBase">
        <div class="section-bar"><div class="sb-l"><h2>对外链接</h2></div></div>
        <div class="card block links-card" :class="{ 'section-dim': pageLoading }">
          <ShareLinkRow v-if="item.landingUrl" :label="item.kind === 'folder' ? '浏览页' : '分享页'" :url="item.landingUrl" />
          <ShareLinkRow v-if="item.archiveUrl" label="根目录 ZIP 直链" :url="item.archiveUrl" />
          <ShareLinkRow
            v-if="item.kind !== 'folder' && item.downloadUrl"
            label="直链（下载）"
            :url="item.downloadUrl"
          />
          <ShareLinkRow v-if="item.metaUrl" label="JSON 元信息" :url="item.metaUrl" />
        </div>
      </template>

      <div class="section-bar"><div class="sb-l"><h2>{{ item.kind === 'folder' ? '文件夹信息' : '文件信息' }}</h2></div></div>
      <div class="card block">
        <ul class="kv">
          <li><span class="k">大小</span><span class="v mono">{{ fmtSize(item.size) }}</span></li>
          <li><span class="k">类型</span><span class="v">{{ item.kind === 'folder' ? '文件夹' : '单文件' }}</span></li>
          <li v-if="item.kind === 'folder'">
            <span class="k">文件数</span><span class="v mono">{{ item.fileCount || (item.entries || []).length }}</span>
          </li>
          <li><span class="k">下载次数</span><span class="v mono">{{ item.downloadCount ?? 0 }}</span></li>
          <li v-if="item.mimeType"><span class="k">MIME 类型</span><span class="v mono">{{ item.mimeType }}</span></li>
          <li><span class="k">创建时间</span><span class="v mono">{{ item.createdAt }}</span></li>
        </ul>
      </div>

      <template v-if="item.kind === 'folder' && entryList.length">
        <div class="section-bar"><div class="sb-l"><h2>文件树</h2><span class="sb-count">{{ entryList.length }}</span></div></div>
        <div class="card block">
          <ul class="entry-list">
            <li v-for="ent in entryList" :key="ent.relativePath" class="entry-row">
              <span class="entry-path">{{ ent.relativePath }}</span>
              <span class="entry-size mono">{{ fmtSize(ent.size) }}</span>
              <button type="button" class="btn btn-ghost btn-sm" @click="copyEntryLink(ent)">复制直链</button>
            </li>
          </ul>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client';
import { useToast } from '@/composables/useToast';
import { formatBytes } from '@/utils/format-bytes';
import { formatRemainingSec } from '@/utils/format-remaining';
import ShareLinkRow from '@/components/ShareLinkRow.vue';
import { suggestedPublicBaseFromVite } from '@/utils/public-url';
import { encodePathForUrl } from '@/utils/file-tree';

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const pageLoading = ref(true);
const errMsg = ref('');
const item = ref(null);
const publicBase = ref('');

const itemId = computed(() => {
  const id = String(route.params.id || '').trim();
  return /^[0-9a-f]{16}$/.test(id) ? id : '';
});
const itemIdShort = computed(() => (itemId.value ? itemId.value.slice(0, 8) : '—'));

const expireLocal = computed(() => {
  if (!item.value?.expireAt) return '—';
  try {
    return new Date(item.value.expireAt).toLocaleString();
  } catch {
    return item.value.expireAt;
  }
});

let tickTimer = null;
const nowTick = ref(Date.now());
function fmtSize(n) {
  return formatBytes(n);
}

const entryList = computed(() => {
  const ents = item.value?.entries;
  if (!Array.isArray(ents)) return [];
  return [...ents].sort((a, b) =>
    String(a.relativePath).localeCompare(String(b.relativePath), undefined, { numeric: true }),
  );
});

function copyEntryLink(ent) {
  if (!item.value?.token || !publicBase.value) return;
  const url = `${publicBase.value}/tt/${encodeURIComponent(item.value.token)}/files/${encodePathForUrl(ent.relativePath)}`;
  navigator.clipboard.writeText(url).then(
    () => toast('已复制'),
    () => toast('复制失败', 'error'),
  );
}

const liveRemaining = computed(() => {
  if (!item.value?.expireAt) return '—';
  const ms = new Date(item.value.expireAt).getTime() - nowTick.value;
  const sec = Math.max(0, Math.floor(ms / 1000));
  return formatRemainingSec(sec);
});

// 倒计时大环：半径 66 → 周长 2π·66 ≈ 414.69；以 24h 为满环基准映射进度
const RING_C = 2 * Math.PI * 66;
const RING_BASE_MS = 24 * 60 * 60 * 1000;
const remainingMs = computed(() => {
  if (!item.value?.expireAt) return 0;
  return Math.max(0, new Date(item.value.expireAt).getTime() - nowTick.value);
});
const nearExpiry = computed(() => remainingMs.value > 0 && remainingMs.value < 60 * 60 * 1000);
const ringOffset = computed(() => {
  const frac = Math.min(1, remainingMs.value / RING_BASE_MS);
  return RING_C * (1 - frac);
});

async function loadBase() {
  try {
    const s = await api('GET', '/api/settings');
    publicBase.value = (s.baseUrl || '').replace(/\/$/, '') || suggestedPublicBaseFromVite();
  } catch {
    publicBase.value = suggestedPublicBaseFromVite();
  }
}

async function load() {
  if (!itemId.value) {
    errMsg.value = '无效的 ID';
    pageLoading.value = false;
    return;
  }
  pageLoading.value = true;
  errMsg.value = '';
  try {
    const d = await api('GET', `/api/temp-transfer/item/${encodeURIComponent(itemId.value)}`);
    item.value = d;
  } catch (e) {
    if (e.status === 404) errMsg.value = '记录不存在。';
    else if (e.status === 410) errMsg.value = '已过期或已删除。';
    else errMsg.value = e.message || '加载失败';
    item.value = null;
  } finally {
    pageLoading.value = false;
  }
}

function startTick() {
  stopTick();
  tickTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
}
function stopTick() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

watch(
  () => item.value?.expireAt,
  () => {
    nowTick.value = Date.now();
  },
);

async function confirmCancel() {
  if (!itemId.value) return;
  if (!window.confirm('确定要取消此临时传输？文件将立即从服务器删除，链接全部失效。')) return;
  try {
    await api('DELETE', `/api/temp-transfer/item/${encodeURIComponent(itemId.value)}`);
    toast('已取消');
    router.push({ path: '/', hash: '#temp-hub' });
  } catch (e) {
    toast(e.message || '操作失败', 'error');
  }
}

onMounted(async () => {
  await loadBase();
  await load();
  startTick();
});

onUnmounted(() => {
  stopTick();
});
</script>

<style scoped>
/* 仅页面特有样式；通用类（.appbar/.card/.bigring/.kv/.section-bar/.link-row 等）来自 global.css */
.loading-pill {
  font-size: 0.66rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-tint);
  padding: 3px 10px;
  border-radius: 999px;
  letter-spacing: 0.04em;
}
.err-c {
  padding: 18px 20px;
  margin-bottom: 18px;
  color: var(--danger);
  font-size: 0.88rem;
  line-height: 1.5;
  box-sizing: border-box;
}

/* 倒计时卡片 */
.timer-card {
  display: flex;
  gap: 26px;
  align-items: center;
  flex-wrap: wrap;
}
.timer-info {
  flex: 1;
  min-width: 180px;
}
.expire-at {
  margin: 0;
  font-size: 0.92rem;
  color: var(--text);
}
.hint {
  font-size: 0.84rem;
  color: var(--text2);
  line-height: 1.5;
  margin: 0;
}
.hint.sm {
  font-size: 0.78rem;
  margin: 9px 0 0;
}

.section-dim {
  opacity: 0.55;
  pointer-events: none;
}

/* 文件树 */
.entry-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 360px;
  overflow-y: auto;
}
.entry-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 9px 0;
  border-top: 1px solid var(--border);
  font-size: 0.8rem;
}
.entry-row:first-child {
  border-top: none;
}
.entry-path {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--text2);
  overflow-wrap: anywhere;
}
.entry-size {
  font-size: 0.72rem;
  color: var(--text3);
}
</style>
