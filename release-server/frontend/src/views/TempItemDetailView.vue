<template>
  <div class="temp-detail">
    <LiquidBackdrop :entry="bgEntry" />

    <div class="ix-wrap">
      <!-- 左：文件名大字 + 剩余时间（这一页最要紧的状态）+ 动作 -->
      <div class="ix-idx">
        <RouterLink to="/" class="ix-crumb">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          总览
        </RouterLink>
        <div class="ix-chips">
          <span class="chip temp">临时文件</span>
          <span v-if="item" class="chip">{{ item.kind === 'folder' ? `文件夹 · ${item.fileCount || 0} 个文件` : '单文件' }}</span>
          <span class="chip num">#{{ itemIdShort }}</span>
          <span v-if="pageLoading" class="chip">载入中…</span>
        </div>
        <h1 class="ix-title" :class="{ long: titleLong }">{{ item?.originalName || '临时文件' }}</h1>

        <p v-if="errMsg" class="err-c">{{ errMsg }}</p>
        <template v-else-if="item">
          <div class="timer">
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
                <span class="bv mono">{{ ringRemaining }}</span>
                <span class="bl">剩余</span>
              </div>
            </div>
            <div class="timer-info">
              <span class="field-label">到期时间</span>
              <p class="expire-at mono">{{ expireLocal }}</p>
              <p class="remain-line" :class="{ warn: nearExpiry, expired: isExpired }">
                <span class="rl-v mono">{{ liveRemaining }}</span>
                <span v-if="!isExpired" class="rl-suffix">后到期</span>
              </p>
            </div>
          </div>
          <div class="ix-acts">
            <button v-if="item.landingUrl" type="button" class="btn btn-primary" @click="copyShare">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              复制分享链
            </button>
            <TwoStepButton
              label="取消分享"
              armed-label="再按：立即删除文件"
              btn-class="btn btn-danger"
              :busy="pageLoading || !item"
              @confirm="cancelItem"
            />
          </div>
          <p class="hint sm">到期后文件与分享链自动失效并删除，不可恢复。</p>
        </template>
      </div>

      <!-- 右：对外链接 · 信息 · 文件树 -->
      <aside v-if="item" class="ix-pane">
        <section v-if="publicBase" class="ix-sec">
          <span class="field-label">对外链接</span>
          <ShareLinkRow v-if="item.landingUrl" :label="item.kind === 'folder' ? '浏览页' : '分享页'" :url="item.landingUrl" />
          <ShareLinkRow v-if="item.archiveUrl" label="根目录 ZIP 直链" :url="item.archiveUrl" />
          <ShareLinkRow
            v-if="item.kind !== 'folder' && item.downloadUrl"
            label="直链（下载）"
            :url="item.downloadUrl"
          />
          <ShareLinkRow v-if="item.metaUrl" label="JSON 元信息" :url="item.metaUrl" />
        </section>
        <section class="ix-sec">
          <span class="field-label">{{ item.kind === 'folder' ? '文件夹信息' : '文件信息' }}</span>
          <ul class="kv">
            <li><span class="k">大小</span><span class="v mono">{{ formatBytes(item.size) }}</span></li>
            <li><span class="k">类型</span><span class="v">{{ item.kind === 'folder' ? '文件夹' : '单文件' }}</span></li>
            <li v-if="item.kind === 'folder'">
              <span class="k">文件数</span><span class="v mono">{{ item.fileCount || (item.entries || []).length }}</span>
            </li>
            <li><span class="k">下载次数</span><span class="v mono">{{ item.downloadCount ?? 0 }}</span></li>
            <li v-if="item.mimeType"><span class="k">MIME 类型</span><span class="v mono">{{ item.mimeType }}</span></li>
            <li><span class="k">创建时间</span><span class="v mono">{{ item.createdAt }}</span></li>
          </ul>
        </section>
        <section v-if="item.kind === 'folder' && entryList.length" class="ix-sec">
          <span class="field-label">文件树 · {{ entryList.length }}</span>
          <ul class="entry-list">
            <li v-for="ent in entryList" :key="ent.relativePath" class="entry-row">
              <span class="entry-path">{{ ent.relativePath }}</span>
              <span class="entry-size mono">{{ formatBytes(ent.size) }}</span>
              <button type="button" class="btn btn-ghost btn-sm" @click="copyEntryLink(ent)">复制直链</button>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import TwoStepButton from '@/components/ui/TwoStepButton.vue';
import { copyText } from '@/utils/copy-text';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client';
import { useToast } from '@/composables/useToast';
import { formatBytes } from '@/utils/format-bytes';
import { formatRemainingSec } from '@/utils/format-remaining';
import ShareLinkRow from '@/components/ShareLinkRow.vue';
import { usePublicBase } from '@/composables/usePublicBase';
import { encodePathForUrl } from '@/utils/file-tree';
import LiquidBackdrop from '@/components/LiquidBackdrop.vue';

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const pageLoading = ref(true);
const errMsg = ref('');
const item = ref(null);
const { publicBase, loadPublicBase } = usePublicBase();

const itemId = computed(() => {
  const id = String(route.params.id || '').trim();
  return /^[0-9a-f]{16}$/.test(id) ? id : '';
});
const itemIdShort = computed(() => (itemId.value ? itemId.value.slice(0, 8) : '—'));
const LONG_TITLE = 18;   // 超过这么多字的文件名做标题时降一档
const titleLong = computed(() => [...(item.value?.originalName || '')].length > LONG_TITLE);
// 背景液体：以文件名为种子（临时文件没有入口页里的对应项，色调走中性）
const bgEntry = computed(() => (item.value ? { name: item.value.originalName || '临时文件', description: '', url: '' } : null));
function copyShare() {
  copyText(item.value.landingUrl).then(
    () => toast('已复制分享链'),
    () => toast('复制失败', 'error'),
  );
}

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
  copyText(url).then(
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

/** 环内紧凑定宽倒计时：≥1 天 `Nd HH:MM`，否则 `HH:MM:SS`，单行不溢出 */
const ringRemaining = computed(() => {
  if (!item.value?.expireAt) return '—';
  let s = Math.max(0, Math.floor((new Date(item.value.expireAt).getTime() - nowTick.value) / 1000));
  if (s <= 0) return '00:00';
  const p = (n) => String(n).padStart(2, '0');
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return d > 0 ? `${d}d ${p(h)}:${p(m)}` : `${p(h)}:${p(m)}:${p(r)}`;
});

// 倒计时大环：半径 66 → 周长 2π·66 ≈ 414.69；以 24h 为满环基准映射进度
const RING_C = 2 * Math.PI * 66;
const RING_BASE_MS = 24 * 60 * 60 * 1000;
const remainingMs = computed(() => {
  if (!item.value?.expireAt) return 0;
  return Math.max(0, new Date(item.value.expireAt).getTime() - nowTick.value);
});
const nearExpiry = computed(() => remainingMs.value > 0 && remainingMs.value < 60 * 60 * 1000);
const isExpired = computed(() => !!item.value?.expireAt && remainingMs.value <= 0);
const ringOffset = computed(() => {
  const frac = Math.min(1, remainingMs.value / RING_BASE_MS);
  return RING_C * (1 - frac);
});

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

async function cancelItem() {
  try {
    await api('DELETE', `/api/temp-transfer/item/${encodeURIComponent(itemId.value)}`);
    toast('已取消');
    router.push({ path: '/', hash: '#temp-hub' });
  } catch (e) {
    toast(e.message || '操作失败', 'error');
  }
}

onMounted(async () => {
  startTick();
  await loadPublicBase();
  await load();
});

onUnmounted(() => {
  stopTick();
});
</script>

<style scoped>
/* 仅页面特有样式；布局来自 global.css 的索引布局（ix-*），.bigring/.kv 也在那里 */
.temp-detail {
  --drop-c: var(--amber);
}
/* 文件名做标题：长名降一档，免得断成好几行 */
.ix-title.long {
  font-size: clamp(28px, 2.6vw, 40px);
  line-height: 1.15;
  letter-spacing: -0.025em;
}
.err-c {
  margin: 12px 0 0;
  color: var(--danger);
  font-size: 0.88rem;
  line-height: 1.5;
  box-sizing: border-box;
}

/* 剩余时间：环 + 到期时间，标题下的主状态 */
.timer {
  display: flex;
  gap: 26px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 22px;
}
.ix-acts {
  margin-bottom: 0;
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

/* 环内倒计时：定宽单行，绝不换行溢出环边 */
.timer .bigring .bt .bv {
  white-space: nowrap;
  font-size: 1.4rem;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}

/* 到期时间下方的精确剩余（口语化），与环色一致：常态 accent，临期 amber */
.remain-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  margin: 7px 0 0;
  font-size: 0.82rem;
}
.remain-line .rl-v {
  font-weight: 600;
  color: var(--accent);
}
.remain-line .rl-suffix {
  color: var(--text3);
}
.remain-line.warn .rl-v {
  color: var(--amber);
}
.remain-line.expired .rl-v {
  color: var(--danger);
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
