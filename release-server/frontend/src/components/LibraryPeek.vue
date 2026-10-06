<!--
  总览右侧的「内容物」：选中的库（或临时文件）里现在有什么——不进详情页就能看、复制、下载。
  应用：当前发布（版本 / 日期 / 说明 / 各平台包）+ 最近几个版本；资源库：文件；临时文件：剩余时间与分享链。
  用法：<LibraryPeek :target="{ kind: 'app' | 'resource', item }" :public-base="..." />
       <LibraryPeek :target="{ kind: 'temp', item }" :remaining="'剩 2 小时'" :warn="false" />
  取数按库缓存在本实例里（总览重新进来就重取，不会拿到改动前的旧数据）。
-->
<template>
  <div class="peek">
    <header class="ph">
      <div class="chips">
        <span class="chip" :class="kindCls">{{ kindLabel }}</span>
        <template v-if="target.kind === 'app'">
          <span class="chip num">{{ item.latestVersion || '尚未发布' }}</span>
          <span class="chip">{{ item.versionCount }} 个版本</span>
        </template>
        <span v-else-if="target.kind === 'resource'" class="chip">{{ item.itemCount }} 个文件</span>
        <template v-else>
          <span class="chip" :class="{ warn }">{{ remaining }}</span>
          <span class="chip">{{ item.kind === 'folder' ? `文件夹 · ${item.fileCount || 0} 个文件` : '单文件' }}</span>
        </template>
      </div>
      <h2 :class="{ long: [...title].length > LONG_TITLE }">{{ title }}</h2>
      <p v-if="detail?.description" class="desc">{{ detail.description }}</p>
      <div class="acts">
        <template v-if="target.kind === 'temp'">
          <button v-if="item.landingUrl" type="button" class="btn btn-primary" :class="{ 'done-pop': copiedKey === 'share' }" @click="copy(item.landingUrl, 'share')">
            <svg v-if="copiedKey === 'share'" class="check-draw" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
            {{ copiedKey === 'share' ? '已复制' : '复制分享链' }}
          </button>
          <RouterLink class="btn btn-ghost" :to="manageTo">详情</RouterLink>
        </template>
        <template v-else>
          <RouterLink class="btn btn-primary" :to="manageTo">
            管理
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
          </RouterLink>
          <button v-if="publicUrl" type="button" class="btn btn-ghost" @click="copy(publicUrl, 'pub')">
            <svg v-if="copiedKey === 'pub'" class="check-draw" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
            {{ copiedKey === 'pub' ? '已复制' : '复制公开页' }}
          </button>
          <a v-if="publicUrl" class="btn btn-ghost" :href="publicUrl" target="_blank" rel="noopener noreferrer">打开公开页</a>
        </template>
      </div>
    </header>

    <p v-if="loading" class="muted">读取中…</p>
    <p v-else-if="error" class="err">
      读取失败：{{ error }}
      <button type="button" class="btn btn-ghost btn-sm" @click="fetchDetail(true)">重试</button>
    </p>

    <!-- 应用 -->
    <template v-else-if="target.kind === 'app'">
      <section v-if="!published" class="blk">
        <h4>当前发布</h4>
        <p class="muted">还没有发布任何版本。进「管理」新建版本、上传安装包后发布。</p>
      </section>
      <section v-else class="blk">
        <h4>当前发布</h4>
        <div class="pub"><span class="pv num">{{ published.version }}</span><span v-if="pubDate" class="dt">{{ pubDate }}</span></div>
        <p v-if="published.notes" class="notes">{{ published.notes }}</p>
        <ul class="rows">
          <li v-for="f in latestFiles" :key="f.name" class="row">
            <span class="chip">{{ platformOf(f.name) }}</span>
            <span class="fn" v-tip="f.name">{{ f.name }}</span>
            <span class="sz num">{{ formatBytes(f.size) }}</span>
            <button type="button" class="gl" :aria-label="`复制 ${f.name} 直链`" v-tip="'复制直链'" @click="copy(f.url, f.url)">
              <svg v-if="copiedKey === f.url" class="check-draw" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
            </button>
            <a class="gl" :href="f.url" download :aria-label="`下载 ${f.name}`" v-tip="'下载'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>
            </a>
          </li>
        </ul>
      </section>
      <section v-if="versions.length" class="blk">
        <h4>版本 <b class="num">{{ versions.length }}</b></h4>
        <ul class="rows">
          <li v-for="v in versions.slice(0, RECENT_VERSIONS)" :key="v.version" class="row">
            <span class="vv num">{{ v.version }}</span>
            <span v-if="v.isLatest" class="lt">当前</span>
            <span class="sp" />
            <span class="dt">{{ versionDate(v) }}</span>
            <span class="sz">{{ v.files.length }} 个文件</span>
          </li>
        </ul>
        <RouterLink v-if="versions.length > RECENT_VERSIONS" class="more" :to="manageTo">还有 {{ versions.length - RECENT_VERSIONS }} 个更早的版本</RouterLink>
      </section>
    </template>

    <!-- 资源库 -->
    <section v-else-if="target.kind === 'resource'" class="blk">
      <h4>文件 <b class="num">{{ resItems.length }}</b></h4>
      <p v-if="!resItems.length" class="muted">还没有文件。进「管理」上传。</p>
      <ul v-else class="rows">
        <li v-for="it in resItems.slice(0, RECENT_FILES)" :key="it.id || it.fileName" class="row">
          <span class="fn" v-tip="it.fileName">{{ it.displayName || it.fileName }}</span>
          <span v-if="it.version" class="chip num">{{ it.version }}</span>
          <span class="sz num">{{ formatBytes(it.size) }}</span>
          <button type="button" class="gl" :aria-label="`复制 ${it.fileName} 直链`" v-tip="'复制直链'" @click="copy(it.downloadUrl, it.downloadUrl)">
            <svg v-if="copiedKey === it.downloadUrl" class="check-draw" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          </button>
          <a class="gl" :href="it.downloadUrl" download :aria-label="`下载 ${it.fileName}`" v-tip="'下载'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>
          </a>
        </li>
      </ul>
      <RouterLink v-if="resItems.length > RECENT_FILES" class="more" :to="manageTo">还有 {{ resItems.length - RECENT_FILES }} 个文件</RouterLink>
    </section>

    <!-- 临时文件 -->
    <section v-else class="blk">
      <h4>到期</h4>
      <p class="notes">{{ expireText }}，到期后链接失效、文件从服务器删除。</p>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { api } from '@/api/client';
import { useCopied } from '@/composables/useCopied';
import { formatBytes } from '@/utils/format-bytes';

const RECENT_VERSIONS = 4;   // 右侧只列最近几个版本，其余进管理页看
const RECENT_FILES = 8;      // 资源库右侧最多列几个文件
const LONG_TITLE = 18;       // 超过这么多字的标题（多是临时文件名）降一档字号

const props = defineProps({
  target: { type: Object, required: true },   // { kind: 'app' | 'resource' | 'temp', item }
  publicBase: { type: String, default: '' },
  remaining: { type: String, default: '' },   // 临时文件：剩余时间文案（父级每秒算）
  warn: { type: Boolean, default: false },    // 临时文件：快到期
  refreshKey: { type: Number, default: 0 },   // 变了就清缓存重取（总览从详情页回来时）
});

const { copiedKey, copy } = useCopied();
const item = computed(() => props.target.item);
const title = computed(() =>
  props.target.kind === 'temp' ? item.value.originalName || '未命名' : item.value.displayLabel || item.value.name,
);
const kindLabel = computed(() =>
  props.target.kind === 'temp' ? '临时文件' : props.target.kind === 'resource' ? '资源库' : item.value.repoType === 'tauri' ? 'Tauri' : '通用',
);
const kindCls = computed(() =>
  props.target.kind === 'temp' ? 'temp' : props.target.kind === 'resource' ? 'resource' : item.value.repoType === 'tauri' ? 'tauri' : 'general',
);
const manageTo = computed(() => {
  const n = encodeURIComponent(props.target.kind === 'temp' ? item.value.id : item.value.name);
  return props.target.kind === 'temp' ? `/temp-transfer/${n}` : props.target.kind === 'resource' ? `/resources/${n}` : `/app/${n}`;
});
const publicUrl = computed(() => {
  if (!props.publicBase || props.target.kind === 'temp') return '';
  const n = encodeURIComponent(item.value.name);
  return props.target.kind === 'resource' ? `${props.publicBase}/r/${n}` : `${props.publicBase}/app/${n}/latest`;
});

/* ---- 取数：按库缓存 ---- */
const cache = new Map();
const detail = ref(null);
const loading = ref(false);
const error = ref('');
const keyOf = t => `${t.kind}:${t.kind === 'temp' ? t.item.id : t.item.name}`;

async function load(t) {
  const n = encodeURIComponent(t.item.name);
  if (t.kind === 'resource') return api('GET', `/api/resources/${n}`);
  const [published, versions, meta] = await Promise.all([
    api('GET', `/api/apps/${n}/latest`).catch(e => {
      if (e.status === 404) return null;   // 还没发布：正常状态，不是错误
      throw e;
    }),
    api('GET', `/api/apps/${n}/versions`),
    api('GET', `/api/apps/${n}/meta`),
  ]);
  return { published, versions, description: meta.description || '' };
}
async function fetchDetail(force = false) {
  const t = props.target;
  if (t.kind === 'temp') {
    detail.value = null;
    return;
  }
  const key = keyOf(t);
  error.value = '';
  if (!force && cache.has(key)) {
    detail.value = cache.get(key);
    return;
  }
  loading.value = true;
  try {
    const d = await load(t);
    cache.set(key, d);
    if (keyOf(props.target) === key) detail.value = d;   // 取回来时已经换了库：丢弃
  } catch (e) {
    if (keyOf(props.target) === key) error.value = e.message;
  } finally {
    if (keyOf(props.target) === key) loading.value = false;
  }
}
watch(() => keyOf(props.target), () => fetchDetail(), { immediate: true });
watch(
  () => props.refreshKey,
  () => {
    cache.clear();
    fetchDetail(true);
  },
);

/* ---- 应用 ---- */
const published = computed(() => detail.value?.published || null);
// 隐藏文件（.gitkeep 之类）与签名不是给人下载的，不列
const shown = files => files.filter(f => !f.name.startsWith('.') && !f.name.endsWith('.sig'));
const versions = computed(() => (detail.value?.versions || []).map(v => ({ ...v, files: shown(v.files) })));
const latestFiles = computed(() => versions.value.find(v => v.isLatest)?.files || []);
const fmtDate = ms => new Date(ms).toISOString().slice(0, 10);
const pubDate = computed(() => (published.value?.pub_date ? fmtDate(published.value.pub_date) : ''));
function versionDate(v) {
  const ts = v.files.map(f => new Date(f.updatedAt).getTime()).filter(Number.isFinite);
  return ts.length ? fmtDate(Math.max(...ts)) : '';
}
/* 与服务端 fileBadgeLabel 同一套判断：认得出平台才标，认不出标「文件」 */
function platformOf(name) {
  const f = name.toLowerCase();
  if (f.endsWith('.msi') || f.endsWith('.exe')) return 'WIN';
  if (f.endsWith('.dmg') || f.endsWith('.app.tar.gz')) return 'MAC';
  if (f.endsWith('.appimage') || f.endsWith('.appimage.tar.gz') || f.endsWith('.deb') || f.endsWith('.rpm')) return 'LINUX';
  return '文件';
}

/* ---- 资源库 ---- */
const resItems = computed(() => detail.value?.items || []);

/* ---- 临时文件 ---- */
const expireText = computed(() => {
  const d = item.value.expireAt ? new Date(item.value.expireAt) : null;
  return d ? `${d.toLocaleString('zh-CN', { hour12: false })} 到期（${props.remaining}）` : props.remaining;
});
</script>

<style scoped>
.peek {
  display: flex;
  flex-direction: column;
  gap: 26px;
}
.ph {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip.warn {
  color: var(--amber);
  background: var(--amber-tint);
}
h2 {
  margin: 0;
  font-size: 44px;
  line-height: 1.05;
  font-weight: 650;
  letter-spacing: -0.04em;
  overflow-wrap: anywhere;
}
h2.long {
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: -0.025em;
}
.desc {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: var(--text2);
  white-space: pre-line;
}
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.blk {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text3);
  display: flex;
  gap: 8px;
  align-items: baseline;
}
h4 b {
  color: var(--text2);
  font-weight: 500;
}
.pub {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.pv {
  font-size: 34px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.dt {
  font-size: 12px;
  color: var(--text3);
  white-space: nowrap;
}
.notes {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--text2);
  white-space: pre-line;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  border-top: 1px solid var(--border);
}
.row:first-child {
  border-top: 0;
}
.fn {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sz {
  font-size: 12px;
  color: var(--text3);
  white-space: nowrap;
}
.vv {
  font-size: 14px;
  min-width: 64px;
}
.lt {
  font-size: 12px;
  color: var(--green);
}
.sp {
  flex: 1;
}
.gl {
  flex: none;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 16px;
  background: none;
  color: var(--text3);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease-hover), background var(--t-fast) var(--ease-hover);
}
.gl:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.07);
}
.gl:active {
  transform: scale(var(--press));
}
.gl svg {
  width: 16px;
  height: 16px;
}
.more {
  font-size: 13px;
  color: var(--text3);
  text-decoration: none;
  align-self: flex-start;
}
.more:hover {
  color: var(--text);
}
.muted {
  margin: 0;
  font-size: 14px;
  color: var(--text3);
}
.err {
  margin: 0;
  font-size: 14px;
  color: var(--danger-text);
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
