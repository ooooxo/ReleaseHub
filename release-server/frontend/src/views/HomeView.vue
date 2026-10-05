<template>
  <div class="layout-max home">
    <header class="page-head">
      <h1>总览</h1>
      <p class="stat-line">
        <b>{{ apps.length }}</b> 应用<span class="dot">·</span><b>{{ libraries.length }}</b> 资源库<span class="dot">·</span><b>{{ tempItems.length }}</b> 临时分享
      </p>
    </header>

    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="loadError" class="empty-hint">
      加载失败：{{ loadError }}
      <button type="button" class="btn btn-ghost btn-sm" @click="load">重试</button>
    </p>

    <template v-else>
      <!-- 临时分享：投放格 + 流动临时卡 -->
      <section id="temp-hub" class="section">
        <div class="section-bar">
          <div class="sb-l"><h2>临时分享</h2><span class="sb-count">到期自删</span></div>
        </div>
        <div class="bento">
          <div class="temp-cell">
            <p v-if="tempDisabled" class="temp-off">本服务器未启用临时文件（TEMP_TRANSFER_ENABLED）</p>
            <template v-else>
              <FolderAwareDropzone class="dropzone" @items="onTempItems">
                <svg class="dz-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 16V4M7 9l5-5 5 5" />
                  <path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
                </svg>
                <span class="dz-strong">拖文件 / 文件夹到此</span>
                或点击选文件 · 传完就地出分享链
              </FolderAwareDropzone>
              <div class="ttl-row" role="radiogroup" aria-label="有效期">
                <button
                  v-for="m in allowedTtls"
                  :key="m"
                  type="button"
                  role="radio"
                  class="ttl"
                  :class="{ on: ttlMinutes === m }"
                  :aria-checked="ttlMinutes === m"
                  @click="ttlMinutes = m"
                  v-tip="formatTtl(m)"
                >{{ shortTtl(m) }}</button>
              </div>
            </template>
          </div>

          <div
            v-for="it in tempItems"
            :key="it.id"
            class="temp-tile"
            :class="{ 'is-fresh': it.id === freshId }"
            role="button"
            tabindex="0"
            @click="goTemp(it)"
            @keydown.enter.self.prevent="goTemp(it)"
          >
            <div class="tt-head">
              <div class="ring" :class="{ warn: tempWarn(it) }">
                <svg width="46" height="46" viewBox="0 0 46 46">
                  <circle class="ring-track" cx="23" cy="23" r="19.5" />
                  <circle
                    class="ring-arc"
                    cx="23"
                    cy="23"
                    r="19.5"
                    stroke-dasharray="122.5"
                    :stroke-dashoffset="ringOffset(it)"
                    transform="rotate(-90 23 23)"
                  />
                </svg>
                <span class="rtxt">{{ tempRingText(it) }}</span>
              </div>
              <div class="tt-body">
                <span class="tt-name" v-tip="it.originalName || '未命名'">{{ it.originalName || '未命名' }}</span>
                <span class="tt-meta">{{ tempMeta(it) }}</span>
              </div>
            </div>
            <div class="tt-foot">
              <span class="mini-tag" :class="{ folder: it.kind === 'folder' }">{{ it.kind === 'folder' ? '文件夹' : '单文件' }}</span>
              <span class="tt-rem">{{ remLabel(it) }}</span>
              <button v-if="it.landingUrl" type="button" class="tt-copy" v-tip="'复制分享链'" @click.stop="copyLink(it.landingUrl)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 所有库 -->
      <section id="library-grid" class="section">
        <div class="section-bar">
          <div class="sb-l"><h2>所有库</h2><span class="sb-count">{{ allItems.length }} 个</span></div>
          <div class="sb-actions">
            <Layer v-model:open="showCreateApp" :guard="appFormDirty">
              <template #trigger="{ toggle }">
                <button type="button" class="btn btn-ghost btn-sm" :aria-expanded="showCreateApp" @click="toggle">新建应用</button>
              </template>
              <form class="lform" @submit.prevent="createApp">
                <p class="l-title">新建应用</p>
                <label class="lbl">包名（目录与 URL，仅字母数字、_ -）</label>
                <input v-model="newAppName" class="input" placeholder="my-app" autofocus />
                <label class="lbl">软件名（可选，用于展示）</label>
                <input v-model="newAppDisplayName" class="input" placeholder="例如：闪电助手" />
                <label class="lbl">类型</label>
                <div class="seg" role="radiogroup" aria-label="类型">
                  <button type="button" role="radio" :aria-checked="newAppRepoType === 'general'" :class="{ on: newAppRepoType === 'general' }" @click="newAppRepoType = 'general'">通用</button>
                  <button type="button" role="radio" :aria-checked="newAppRepoType === 'tauri'" :class="{ on: newAppRepoType === 'tauri' }" @click="newAppRepoType = 'tauri'">Tauri</button>
                </div>
                <div class="row">
                  <button type="button" class="btn btn-ghost btn-sm" @click="resetAppForm">取消</button>
                  <button type="submit" class="btn btn-primary btn-sm" :disabled="creatingApp">创建</button>
                </div>
              </form>
            </Layer>
            <Layer v-model:open="showCreateResource" :guard="resFormDirty">
              <template #trigger="{ toggle }">
                <button type="button" class="btn btn-primary btn-sm" :aria-expanded="showCreateResource" @click="toggle">新建资源库</button>
              </template>
              <form class="lform" @submit.prevent="createLibrary">
                <p class="l-title">新建资源库</p>
                <label class="lbl">资源库标识（目录与 URL，仅字母数字、_ -）</label>
                <input v-model="newResName" class="input" placeholder="my-resources" autofocus />
                <label class="lbl">展示名（可选）</label>
                <input v-model="newResDisplayName" class="input" placeholder="例如：常用工具合集" />
                <label class="lbl">资源库简介（可选）</label>
                <textarea v-model="newResDescription" class="textarea" rows="3" placeholder="对外下载页顶部说明" />
                <div class="row">
                  <button type="button" class="btn btn-ghost btn-sm" @click="resetResForm">取消</button>
                  <button type="submit" class="btn btn-primary btn-sm" :disabled="creatingRes">创建</button>
                </div>
              </form>
            </Layer>
          </div>
        </div>

        <p v-if="!allItems.length" class="empty-hint">暂无库。可新建「应用」（多版本发版）或「资源库」（多文件无版本线）</p>

        <TransitionGroup v-else name="slide-up" tag="div" class="bento">
          <button
            v-for="it in allItems"
            :key="it.key"
            type="button"
            class="tile"
            @click="goItem(it)"
          >
            <div class="t-head">
              <span class="ico" :class="it.kind === 'resource' ? 'is-green' : it.repoType === 'tauri' ? '' : 'is-indigo'">
                <svg v-if="it.kind === 'resource'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </span>
              <div class="t-titles">
                <span class="t-name">{{ it.displayLabel || it.name }}</span>
                <span v-if="it.displayName" class="t-pkg">{{ it.name }}</span>
              </div>
              <span class="t-count">{{ it.kind === 'app' ? `${it.versionCount} 版本` : `${it.itemCount} 文件` }}</span>
            </div>
            <div class="t-foot">
              <div class="ver-block" :class="{ none: !(it.kind === 'app' && it.latestVersion) }">
                <span class="ver-label">{{ it.kind === 'app' ? '最新' : '类型' }}</span>
                <span class="ver-val">{{ it.kind === 'app' ? it.latestVersion || '尚未发布' : '无版本线' }}</span>
              </div>
              <span
                class="chip"
                :class="it.kind === 'app' ? (it.repoType === 'tauri' ? 'tauri' : 'general') : 'resource'"
              >{{ it.kind === 'app' ? (it.repoType === 'tauri' ? 'Tauri' : '通用') : '资源库' }}</span>
            </div>
          </button>
        </TransitionGroup>
      </section>
    </template>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api, uploadTemp } from '@/api/client';
import { useUploads } from '@/stores/uploads';
import { describeUploadBatch } from '@/composables/useFolderUpload';
import { copyText } from '@/utils/copy-text';
import FolderAwareDropzone from '@/components/FolderAwareDropzone.vue';
import Layer from '@/components/ui/Layer.vue';
import { useToast } from '@/composables/useToast';
import { formatRemainingSec } from '@/utils/format-remaining';

const router = useRouter();
const { toast } = useToast();
const apps = ref([]);
const libraries = ref([]);
const tempItems = ref([]);
const loading = ref(true);
const loadError = ref('');
const tempTick = ref(0);
const uploads = useUploads();
const allowedTtls = ref([]);
const ttlMinutes = ref(1440);
const tempDisabled = ref(false);
/** 刚传完的那张临时卡：就地亮一下，人一眼找到自己的分享链 */
const freshId = ref(null);
let tempListTimer = null;
let tempTickTimer = null;
const showCreateApp = ref(false);
const showCreateResource = ref(false);
const newAppName = ref('');
const newAppDisplayName = ref('');
const newAppRepoType = ref('general');
const creatingApp = ref(false);
const newResName = ref('');
const newResDisplayName = ref('');
const newResDescription = ref('');
const creatingRes = ref(false);

const allItems = computed(() => {
  const a = apps.value.map(x => ({ kind: 'app', key: `app:${x.name}`, ...x }));
  const r = libraries.value.map(x => ({ kind: 'resource', key: `res:${x.name}`, ...x }));
  return [...a, ...r];
});

function goItem(it) {
  if (it.kind === 'app') {
    router.push(`/app/${encodeURIComponent(it.name)}`);
  } else {
    router.push(`/resources/${encodeURIComponent(it.name)}`);
  }
}

function goTemp(it) {
  router.push(`/temp-transfer/${encodeURIComponent(it.id)}`);
}

function formatTtl(m) {
  if (m < 60) return `${m} 分钟`;
  if (m % 1440 === 0) return `${m / 1440} 天`;
  if (m % 60 === 0) return `${m / 60} 小时`;
  return `${m} 分钟`;
}

function shortTtl(m) {
  if (m % 1440 === 0) return `${m / 1440}d`;
  if (m % 60 === 0) return `${m / 60}h`;
  return `${m}m`;
}

async function loadTtls() {
  try {
    const d = await api('GET', '/api/temp-transfer/allowed-ttls');
    allowedTtls.value = d.allowedTtlsMinutes || [];
    ttlMinutes.value = allowedTtls.value.includes(d.defaultTtlMinutes) ? d.defaultTtlMinutes : allowedTtls.value[0];
  } catch (e) {
    if (e.status === 404) tempDisabled.value = true;
    else if (e.status !== 401) toast(e.message, 'error');
  }
}

/* 临时文件就地闭环（ADR-0003）：拖进来 → 交给上传托盘 → 传完这一格出新卡、可一键复制 */
function onTempItems(list) {
  const desc = describeUploadBatch(list);
  const isFolder = list.length > 1 || list.some(it => it.relativePath.includes('/'));
  if (isFolder && list.length > 100) {
    toast('临时文件夹一次最多 100 个文件', 'error');
    return;
  }
  const ttl = ttlMinutes.value;
  uploads.start({
    key: `temp:${Date.now()}`,
    group: 'temp',
    title: desc.isFolder ? desc.rootName : list[0].file.name,
    target: `临时文件 · ${formatTtl(ttl)}`,
    to: '/',
    run: ({ onProgress, signal }) =>
      uploadTemp({ items: list, ttlMinutes: ttl, folderName: desc.rootName, onProgress, signal }),
    linkOf: rec => rec?.landingUrl || '',
  });
}
watch(
  () => uploads.doneAt.temp,
  async () => {
    const done = [...uploads.tasks].reverse().find(t => t.group === 'temp' && t.status === 'done');
    freshId.value = done?.result?.id ?? null;
    await loadTempList();
  },
);

function copyLink(url) {
  copyText(url).then(
    () => toast('已复制分享链'),
    () => toast('复制失败', 'error'),
  );
}

function tempSec(it) {
  void tempTick.value;
  const exp = it.expireAt ? new Date(it.expireAt).getTime() : 0;
  if (!exp) return it.secondsRemaining || 0;
  return Math.max(0, Math.floor((exp - Date.now()) / 1000));
}

function tempWarn(it) {
  return tempSec(it) < 3600;
}

const RING_C = 122.5;
function ringOffset(it) {
  const frac = Math.max(0, Math.min(1, tempSec(it) / 86400));
  return (RING_C * (1 - frac)).toFixed(1);
}

function tempRingText(it) {
  const s = tempSec(it);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 1) return `${h}h`;
  if (m >= 1) return `${m}m`;
  return `${s}s`;
}

function tempMeta(it) {
  return it.kind === 'folder' ? `文件夹 · ${it.fileCount || 0} 文件` : '单文件';
}

function remLabel(it) {
  void tempTick.value;
  const exp = it.expireAt ? new Date(it.expireAt).getTime() : 0;
  const sec = Math.max(0, Math.floor((exp - Date.now()) / 1000));
  if (!exp) return formatRemainingSec(it.secondsRemaining || 0);
  return `剩余 ${formatRemainingSec(sec)}`;
}

async function loadTempList() {
  try {
    const t = await api('GET', '/api/temp-transfer/list');
    tempItems.value = t?.items || [];
  } catch (e) {
    // 轮询失败保留上一份列表，别把「拉取失败」画成「没有临时文件」
    if (e.status === 404) tempItems.value = []; // 服务端未启用临时文件
    else if (e.status !== 401) toast(`临时文件列表刷新失败：${e.message}`, 'error');
  }
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const [a, r] = await Promise.all([api('GET', '/api/apps'), api('GET', '/api/resources')]);
    apps.value = a;
    libraries.value = r;
  } catch (e) {
    loadError.value = e.message;
  } finally {
    loading.value = false;
  }
  await loadTempList();
}

/* 浮层里填了东西就算未存改动：点外面不收，免得一下手滑丢掉 */
const appFormDirty = computed(() => !!(newAppName.value.trim() || newAppDisplayName.value.trim()));
const resFormDirty = computed(() => !!(newResName.value.trim() || newResDisplayName.value.trim() || newResDescription.value.trim()));
function resetAppForm() {
  newAppName.value = '';
  newAppDisplayName.value = '';
  newAppRepoType.value = 'general';
  showCreateApp.value = false;
}
function resetResForm() {
  newResName.value = '';
  newResDisplayName.value = '';
  newResDescription.value = '';
  showCreateResource.value = false;
}

async function createApp() {
  const name = newAppName.value.trim();
  if (!name) {
    toast('请填写包名', 'error');
    return;
  }
  creatingApp.value = true;
  try {
    const body = { name, repoType: newAppRepoType.value };
    const dn = newAppDisplayName.value.trim();
    if (dn) body.displayName = dn;
    await api('POST', '/api/apps', body);
    toast('已创建');
    resetAppForm();
    await load();
    router.push(`/app/${encodeURIComponent(name)}`);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    creatingApp.value = false;
  }
}

async function createLibrary() {
  const name = newResName.value.trim();
  if (!name) {
    toast('请填写资源库标识', 'error');
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    toast('标识只能包含字母、数字、下划线和连字符', 'error');
    return;
  }
  creatingRes.value = true;
  try {
    const body = { name };
    const dn = newResDisplayName.value.trim();
    if (dn) body.displayName = dn;
    const desc = newResDescription.value.trim();
    if (desc) body.description = desc;
    await api('POST', '/api/resources', body);
    toast('已创建');
    resetResForm();
    await load();
    router.push(`/resources/${encodeURIComponent(name)}`);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    creatingRes.value = false;
  }
}

onMounted(async () => {
  // 计时器先于 await 起：页面在加载中就被离开时，onUnmounted 才清得到
  tempTickTimer = setInterval(() => {
    tempTick.value += 1;
  }, 1000);
  tempListTimer = setInterval(() => {
    loadTempList();
  }, 40000);
  loadTtls();
  await load();
  if (
    window.location.hash === '#section-resources' ||
    window.location.hash === '#library-grid' ||
    window.location.hash === '#temp-hub'
  ) {
    const id = window.location.hash === '#temp-hub' ? 'temp-hub' : 'library-grid';
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
});

onUnmounted(() => {
  if (tempListTimer) clearInterval(tempListTimer);
  if (tempTickTimer) clearInterval(tempTickTimer);
});
</script>

<style scoped>
.home {
  padding-bottom: 40px;
}
.page-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
h1 {
  margin: 0;
  font-size: 1.9rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}
.stat-line {
  margin: 0;
  font-size: 0.86rem;
  color: var(--text2);
}
.stat-line b {
  color: var(--text);
  font-weight: 650;
}
.stat-line .dot {
  margin: 0 8px;
  color: var(--text3);
}
.muted {
  color: var(--text2);
}

/* 分区 */
.section {
  margin-top: 4px;
}
.section-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 26px 0 13px;
}
.sb-l {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.section-bar h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.sb-count {
  font-size: 0.76rem;
  color: var(--text3);
  font-family: var(--font-mono);
}
.sb-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.empty-hint {
  margin: 0 0 12px;
  font-size: 0.9rem;
  color: var(--text3);
}

/* 流动 bento：等高卡，数量多自然换行 */
.bento {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(245px, 1fr));
  gap: 13px;
  align-content: start;
}

/* 库卡 */
.tile {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 17px;
  display: flex;
  flex-direction: column;
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: box-shadow var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out);
  min-height: 148px;
}
.tile:hover {
  border-color: var(--border-strong);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}
.tile:active {
  transform: scale(0.985);
}
.ico {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--accent-tint);
  color: var(--accent);
  display: grid;
  place-items: center;
  flex: none;
}
.ico svg {
  width: 20px;
  height: 20px;
}
.ico.is-indigo {
  background: var(--indigo-tint);
  color: var(--indigo);
}
.ico.is-green {
  background: var(--green-tint);
  color: var(--green);
}
.t-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.t-titles {
  min-width: 0;
  flex: 1;
}
.t-name {
  display: block;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--text);
  margin: 1px 0 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.t-pkg {
  display: inline-block;
  max-width: 100%;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.02em;
  color: var(--text3);
  background: var(--inset);
  padding: 2px 7px;
  border-radius: var(--radius-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.t-count {
  flex: none;
  font-size: 0.76rem;
  color: var(--text2);
  font-weight: 500;
  margin-top: 3px;
}
.t-foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
  padding-top: 14px;
}
.ver-block .ver-label {
  display: block;
  font-size: 0.62rem;
  font-weight: 650;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text3);
  margin-bottom: 2px;
}
.ver-block .ver-val {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--accent);
}
.ver-block.none .ver-val {
  color: var(--text3);
  font-family: var(--font);
  font-size: 0.82rem;
}
.chip {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  border-radius: 999px;
  line-height: 1.2;
  flex: none;
}
.chip.tauri {
  color: var(--accent);
  background: var(--accent-tint);
}
.chip.general {
  color: var(--indigo);
  background: var(--indigo-tint);
}
.chip.resource {
  color: var(--green);
  background: var(--green-tint);
}

/* 投放格：拖进来就交给上传托盘，下面一排挑有效期 */
.temp-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 148px;
}
.temp-cell .dropzone {
  flex: 1;
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text2);
  font-size: 0.78rem;
  cursor: pointer;
  background: transparent;
}
.temp-cell .dropzone:hover,
.temp-cell .dropzone.drag {
  border-color: var(--accent);
  background: var(--accent-tint);
  color: var(--accent);
}
.dz-ico {
  width: 30px;
  height: 30px;
  margin-bottom: 7px;
  color: var(--accent);
  opacity: 0.85;
}
.dz-strong {
  display: block;
  color: var(--text);
  font-weight: 600;
  margin-bottom: 3px;
}
.temp-cell .dropzone.drag .dz-strong {
  color: var(--accent);
}
.ttl-row {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: var(--inset);
  border-radius: var(--radius-sm);
}
.ttl,
.seg button {
  flex: 1;
  white-space: nowrap;
  padding: 5px 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text3);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease-hover), background var(--t-fast) var(--ease-hover);
}
.ttl { font-family: var(--font-mono); }
.ttl:hover,
.seg button:hover { color: var(--text); }
.ttl.on,
.seg button.on {
  color: var(--accent);
  background: rgba(242, 243, 245, 0.08);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
.temp-off {
  margin: 0;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.76rem;
  color: var(--text3);
  text-align: center;
}

/* 临时卡 */
.temp-tile {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  min-height: 148px;
  display: flex;
  flex-direction: column;
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: box-shadow var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out);
}
.temp-tile:hover {
  border-color: var(--border-strong);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}
.temp-tile:active {
  transform: scale(0.985);
}
.tt-head {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 13px;
}
.ring {
  flex: none;
  width: 46px;
  height: 46px;
  position: relative;
  color: var(--accent);
}
.ring.warn {
  color: var(--amber);
}
.ring-track {
  fill: none;
  stroke: rgba(242, 243, 245, 0.1);
  stroke-width: 3.2;
}
.ring-arc {
  fill: none;
  stroke: currentColor;
  stroke-width: 3.2;
  stroke-linecap: round;
  transition: stroke-dashoffset var(--t-slow) var(--ease-out);
}
.rtxt {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 600;
  color: currentColor;
  letter-spacing: -0.02em;
}
.tt-body {
  min-width: 0;
  flex: 1;
}
.tt-name {
  display: block;
  font-size: 0.94rem;
  font-weight: 650;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tt-meta {
  font-size: 0.7rem;
  color: var(--text2);
  font-family: var(--font-mono);
}
.tt-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}
.mini-tag {
  flex: none;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--accent);
  background: var(--accent-tint);
  padding: 4px 9px;
  border-radius: 999px;
  line-height: 1.2;
}
.mini-tag.folder {
  color: var(--indigo);
  background: var(--indigo-tint);
}
.tt-rem {
  margin-left: auto;
  font-size: 0.72rem;
  color: var(--text2);
  font-family: var(--font-mono);
}

/* 新建浮层里的短表单 */
.lform { width: 320px; max-width: 100%; }
.l-title { margin: 0 0 12px; font-size: 0.95rem; font-weight: 700; }
.lbl {
  display: block;
  font-size: 12px;
  color: var(--text2);
  margin: 12px 0 6px;
}
.l-title + .lbl { margin-top: 0; }
.lform .input { padding: 9px 12px; font-size: 14px; background: var(--surface); }
.lform .textarea { background: var(--surface); }
.seg {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: var(--inset);
  border-radius: var(--radius-sm);
}
.seg button { padding: 7px 0; font-size: 0.78rem; }
.row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

/* 临时卡上的复制钮：纯字形按钮，hover 只动墨阶不铺底（Hrige 纯字形按钮） */
.tt-copy {
  flex: none;
  width: 26px;
  height: 26px;
  margin-left: 6px;
  display: grid;
  place-items: center;
  border: 0;
  background: none;
  color: var(--text3);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease-hover);
}
.tt-copy:hover { color: var(--accent); }
.tt-copy svg { width: 15px; height: 15px; }
.temp-tile.is-fresh {
  border-color: rgba(52, 211, 153, 0.5);
}
</style>
