<template>
  <div class="home">
    <!-- 背景液体：与入口页同一个库，随选中的库流动，压暗当底 -->
    <div class="bg" aria-hidden="true"><canvas ref="bgCanvas" /></div>

    <Teleport defer to="#topbar-actions">
      <Layer v-model:open="showCreate" :guard="createDirty">
        <template #trigger="{ toggle }">
          <button type="button" class="btn btn-ghost btn-sm" :aria-expanded="showCreate" @click="toggle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            新建
          </button>
        </template>
        <div v-if="!createMode" class="pick">
          <button type="button" class="opt" @click="createMode = 'app'">
            <span class="opt-k k-app" />
            <span class="opt-t"><b>应用</b><small>有版本线：按版本发布安装包，客户端可自动更新</small></span>
          </button>
          <button type="button" class="opt" @click="createMode = 'resource'">
            <span class="opt-k k-res" />
            <span class="opt-t"><b>资源库</b><small>无版本线：放多个独立文件，可分目录、打包 ZIP</small></span>
          </button>
        </div>
        <form v-else-if="createMode === 'app'" class="lform" @submit.prevent="createApp">
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
        <form v-else class="lform" @submit.prevent="createLibrary">
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
    </Teleport>

    <p v-if="loading" class="state">加载中…</p>
    <p v-else-if="loadError" class="state err">
      加载失败：{{ loadError }}
      <button type="button" class="btn btn-ghost btn-sm" @click="load">重试</button>
    </p>

    <div v-else class="wrap">
      <nav class="idx" aria-label="临时文件与所有库">
        <!-- 临时文件：名单顶上一条——投放入口 + 有效期 + 每个临时文件一枚（剩余时间环） -->
        <div v-if="!tempDisabled" id="temp-hub" class="tstrip">
          <FolderAwareDropzone class="tdz" @items="onTempItems">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" /></svg>
            <span><span class="drag-only">拖文件到这里 · </span>选文件</span>
          </FolderAwareDropzone>
          <Layer v-model:open="showTtl" align="start">
            <template #trigger="{ toggle }">
              <button type="button" class="tttl" :aria-expanded="showTtl" v-tip="'临时文件的有效期'" @click="toggle">{{ formatTtl(ttlMinutes) }}后删</button>
            </template>
            <div class="ttl-pick" role="radiogroup" aria-label="有效期">
              <button
                v-for="m in allowedTtls"
                :key="m"
                type="button"
                role="radio"
                :aria-checked="ttlMinutes === m"
                :class="{ on: ttlMinutes === m }"
                @click="ttlMinutes = m; showTtl = false"
              >{{ formatTtl(m) }}</button>
            </div>
          </Layer>
          <button
            v-for="it in tempItems"
            :key="it.id"
            type="button"
            class="tc"
            :class="{ on: selKey === `temp:${it.id}`, 'is-fresh': it.id === freshId }"
            @mouseenter="hoverPick(`temp:${it.id}`)"
            @mouseleave="hoverCancel"
            @focus="pick(`temp:${it.id}`)"
            @click="activate(`temp:${it.id}`)"
          >
            <i class="ring" :class="{ warn: tempWarn(it) }" :style="{ '--p': `${ringPct(it)}%` }" />
            <span class="tn">{{ it.originalName || '未命名' }}</span>
            <small :class="{ warn: tempWarn(it) }">{{ remShort(it) }}</small>
          </button>
        </div>
        <p v-else class="temp-off">本服务器未启用临时文件（TEMP_TRANSFER_ENABLED）</p>

        <template v-for="g in groups" :key="g.label">
          <div class="grp">{{ g.label }}</div>
          <button
            v-for="it in g.items"
            :key="it.key"
            type="button"
            class="it"
            :class="{ on: selKey === it.key }"
            @mouseenter="hoverPick(it.key)"
            @mouseleave="hoverCancel"
            @focus="pick(it.key)"
            @click="activate(it.key)"
          >
            <b>{{ it.displayLabel || it.name }}</b>
            <span class="num">{{ it.kind === 'app' ? it.latestVersion || '尚未发布' : `${it.itemCount} 个文件` }}</span>
          </button>
        </template>
        <p v-if="!allItems.length" class="empty">还没有库。右上角「新建」一个应用或资源库。</p>
      </nav>

      <aside class="pane">
        <LibraryPeek
          v-if="selTarget"
          :target="selTarget"
          :public-base="publicBase"
          :remaining="selTarget.kind === 'temp' ? remShort(selTarget.item) : ''"
          :warn="selTarget.kind === 'temp' && tempWarn(selTarget.item)"
        />
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api, uploadTemp } from '@/api/client';
import { useUploads } from '@/stores/uploads';
import { describeUploadBatch } from '@/composables/useFolderUpload';
import FolderAwareDropzone from '@/components/FolderAwareDropzone.vue';
import Layer from '@/components/ui/Layer.vue';
import { useToast } from '@/composables/useToast';
import { liquidEntry, mountLiquidBackground } from '@/composables/useLiquid';
import { usePublicBase } from '@/composables/usePublicBase';
import LibraryPeek from '@/components/LibraryPeek.vue';

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
const showCreate = ref(false);
/** 「新建」浮层里选的是哪一种；null = 还在选 */
const createMode = ref(null);
watch(showCreate, v => {
  if (!v) createMode.value = null;
});
const showTtl = ref(false);
const { publicBase, loadPublicBase } = usePublicBase();
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
const groups = computed(() =>
  [
    { label: '应用', items: allItems.value.filter(x => x.kind === 'app') },
    { label: '资源库', items: allItems.value.filter(x => x.kind === 'resource') },
  ].filter(g => g.items.length),
);

/* ---- 选中：指上去（稍停一下）或聚焦就换右侧内容；手机没有右侧，点了直接进详情 ---- */
const HOVER_MS = 70;
const mobile = matchMedia('(max-width: 760px)');
const selKey = ref('');
const selTarget = computed(() => {
  const k = selKey.value;
  if (k.startsWith('temp:')) {
    const it = tempItems.value.find(x => `temp:${x.id}` === k);
    if (it) return { kind: 'temp', item: it };
  }
  const lib = allItems.value.find(x => x.key === k) || allItems.value[0];
  return lib ? { kind: lib.kind, item: lib } : null;
});
function pick(key) {
  selKey.value = key;
}
let hoverT = null;
function hoverPick(key) {
  clearTimeout(hoverT);
  hoverT = setTimeout(() => pick(key), HOVER_MS);
}
function hoverCancel() {
  clearTimeout(hoverT);
}
function activate(key) {
  if (!mobile.matches) return pick(key);
  if (key.startsWith('temp:')) router.push(`/temp-transfer/${encodeURIComponent(key.slice(5))}`);
  else goItem(allItems.value.find(x => x.key === key));
}

/* ---- 背景液体：选中的库变了就流过去；选中临时文件时保持上一幅 ---- */
const bgCanvas = ref(null);
let bg = null;
const NEUTRAL_LIQUID = { name: 'Release Hub', description: '', url: '', motif: 'flow' };
watch(
  () => (selTarget.value?.kind === 'temp' ? null : selTarget.value?.item.key),
  key => {
    if (!bg || !key) return;
    bg.flowTo(liquidEntry(selTarget.value.item));
  },
);

function goItem(it) {
  if (it.kind === 'app') {
    router.push(`/app/${encodeURIComponent(it.name)}`);
  } else {
    router.push(`/resources/${encodeURIComponent(it.name)}`);
  }
}

function formatTtl(m) {
  if (m < 60) return `${m} 分钟`;
  if (m % 1440 === 0) return `${m / 1440} 天`;
  if (m % 60 === 0) return `${m / 60} 小时`;
  return `${m} 分钟`;
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
    if (freshId.value) pick(`temp:${freshId.value}`);   // 刚传完的那个直接摆到右侧，分享链一键复制
  },
);


function tempSec(it) {
  void tempTick.value;
  const exp = it.expireAt ? new Date(it.expireAt).getTime() : 0;
  if (!exp) return it.secondsRemaining || 0;
  return Math.max(0, Math.floor((exp - Date.now()) / 1000));
}

function tempWarn(it) {
  return tempSec(it) < 3600;
}

/** 剩余时间环：按一天满格（与原来的大环同一把尺） */
function ringPct(it) {
  return Math.round(Math.max(0, Math.min(1, tempSec(it) / 86400)) * 100);
}
/** 胶囊里的短文案：剩 2 小时 / 剩 4 分钟 */
function remShort(it) {
  const s = tempSec(it);
  if (s >= 86400) return `剩 ${Math.floor(s / 86400)} 天`;
  if (s >= 3600) return `剩 ${Math.floor(s / 3600)} 小时`;
  if (s >= 60) return `剩 ${Math.floor(s / 60)} 分钟`;
  return s > 0 ? `剩 ${s} 秒` : '已过期';
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
const createDirty = computed(() => (createMode.value === 'app' ? appFormDirty.value : createMode.value === 'resource' ? resFormDirty.value : false));
function resetAppForm() {
  newAppName.value = '';
  newAppDisplayName.value = '';
  newAppRepoType.value = 'general';
  showCreate.value = false;
}
function resetResForm() {
  newResName.value = '';
  newResDisplayName.value = '';
  newResDescription.value = '';
  showCreate.value = false;
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
  loadPublicBase();
  await load();
  if (!selKey.value && allItems.value.length) pick(allItems.value[0].key);
  bg = mountLiquidBackground(bgCanvas.value, selTarget.value && selTarget.value.kind !== 'temp' ? liquidEntry(selTarget.value.item) : NEUTRAL_LIQUID);
});

onUnmounted(() => {
  if (tempListTimer) clearInterval(tempListTimer);
  if (tempTickTimer) clearInterval(tempTickTimer);
  clearTimeout(hoverT);
  bg?.stop();
});
</script>

<style scoped>
.home {
  position: relative;
}
/* 背景液体：整页一幅，压暗到三成；左侧再压一道，让大字名单读得清 */
.bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.bg canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0.32;
}
.bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--bg) 0%, rgba(12, 12, 14, 0.7) 45%, rgba(12, 12, 14, 0.35) 100%);
}
.state {
  position: relative;
  z-index: 1;
  padding: 40px 6%;
  color: var(--text3);
  display: flex;
  gap: 12px;
  align-items: center;
}
.state.err {
  color: var(--danger-text);
}

.wrap {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: 56px;
  max-width: 1480px;
  margin: 0 auto;
  padding: 12px 40px 72px 6%;
}

/* ---- 左：临时文件条 + 大字名单 ---- */
.idx {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
.tstrip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 34px;
  scroll-margin-top: 90px;
}
.tdz {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 6px 0 16px;
  border-radius: 20px;
  border: 1.5px dashed var(--border-strong);
  color: var(--text2);
  font-size: 13px;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease-hover), color var(--t-fast) var(--ease-hover), background var(--t-fast) var(--ease-hover);
}
.tdz > svg {
  width: 16px;
  height: 16px;
  color: var(--amber);
}
.tdz:hover,
.tdz.drag {
  border-color: var(--amber);
  color: var(--text);
  background: var(--amber-tint);
}
.tdz :deep(.hidden-input) {
  display: none;
}
.tdz :deep(.dir-link) {
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.tdz :deep(.dir-link:hover) {
  color: var(--text);
}
.tttl {
  height: 40px;
  padding: 0 14px;
  border: 0;
  border-radius: 20px;
  background: none;
  color: var(--text3);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.tttl:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}
.ttl-pick {
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 4px;
  padding: 2px;
}
.ttl-pick button {
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--text2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.ttl-pick button:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}
.ttl-pick button.on {
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
  font-weight: 600;
}
.tc {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  max-width: 280px;
  padding: 0 14px 0 12px;
  border: 0;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease-hover), box-shadow var(--t-fast) var(--ease-hover);
}
.tc:hover {
  background: rgba(255, 255, 255, 0.09);
}
.tc.on {
  background: rgba(255, 255, 255, 0.11);
  box-shadow: inset 0 0 0 1.5px var(--amber);
}
.tc.is-fresh {
  animation: done-pop var(--t-slow) var(--spring-soft);
}
.tc .tn {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tc small {
  flex: none;
  font-size: 12px;
  font-weight: 500;
  color: var(--text3);
}
.tc small.warn {
  color: var(--amber);
}
.ring {
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: conic-gradient(var(--accent) var(--p), rgba(255, 255, 255, 0.12) 0);
}
.ring.warn {
  background: conic-gradient(var(--amber) var(--p), rgba(255, 255, 255, 0.12) 0);
}
.temp-off {
  margin: 0 0 34px;
  font-size: 13px;
  color: var(--text3);
}
.grp {
  margin: 30px 0 6px;
  font-size: 13px;
  color: var(--text3);
}
.tstrip + .grp,
.temp-off + .grp {
  margin-top: 0;
}
.it {
  display: flex;
  align-items: baseline;
  gap: 14px;
  max-width: 100%;
  padding: 5px 0;
  border: 0;
  background: none;
  text-align: left;
  font: inherit;
  color: var(--text3);
  cursor: pointer;
}
.it b {
  font-size: 40px;
  line-height: 1.1;
  font-weight: 650;
  letter-spacing: -0.04em;
  overflow-wrap: anywhere;
  transition: color var(--t-fast) var(--ease-hover);
}
.it span {
  flex: none;
  font-size: 13px;
  transition: color var(--t-fast) var(--ease-hover);
}
.it:hover b,
.it.on b,
.it:focus-visible b {
  color: var(--text);
}
.it.on span {
  color: var(--text2);
}
.it:focus-visible {
  outline: none;
}
.empty {
  margin: 0;
  font-size: 15px;
  color: var(--text2);
}

/* ---- 右：选中项的内容物，跟着滚动停在视口里 ---- */
.pane {
  position: sticky;
  top: 92px;
  align-self: start;
  max-height: calc(100vh - 110px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 24px;
}

/* ---- 「新建」浮层 ---- */
.pick {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 320px;
}
.opt {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.opt:hover {
  background: rgba(255, 255, 255, 0.06);
}
.opt-k {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 7px;
  border-radius: 50%;
}
.opt-k.k-app {
  background: var(--accent);
}
.opt-k.k-res {
  background: var(--green);
}
.opt-t b {
  display: block;
  font-size: 15px;
  font-weight: 650;
}
.opt-t small {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text3);
}
.lform {
  width: 320px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.l-title {
  margin: 0 0 4px;
  font-weight: 650;
}
.lbl {
  font-size: 12px;
  color: var(--text2);
}
.seg {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 0 0 1px var(--border);
}
.seg button {
  flex: 1;
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: var(--text3);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.seg button.on {
  color: var(--text);
  background: rgba(255, 255, 255, 0.09);
  font-weight: 600;
}
.row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

@media (max-width: 760px) {
  .wrap {
    grid-template-columns: minmax(0, 1fr);
    padding: 0 22px 56px;
  }
  .pane {
    display: none;
  }
  .it b {
    font-size: 32px;
  }
  .drag-only {
    display: none;
  }
  .bg::after {
    background: linear-gradient(180deg, rgba(12, 12, 14, 0.3) 0%, var(--bg) 70%);
  }
}
</style>
