<template>
  <div class="layout-max home" id="library-grid">
    <header class="page-head">
      <h1>总览</h1>
      <p class="stat-line">
        <b>{{ apps.length }}</b> 应用<span class="dot">·</span><b>{{ libraries.length }}</b> 资源库<span class="dot">·</span><b>{{ tempItems.length }}</b> 临时分享
      </p>
    </header>

    <p v-if="loading" class="muted">加载中…</p>

    <template v-else>
      <!-- 临时分享：投放格 + 流动临时卡 -->
      <section id="temp-hub" class="section">
        <div class="section-bar">
          <div class="sb-l"><h2>临时分享</h2><span class="sb-count">到期自删</span></div>
        </div>
        <div class="bento">
          <button
            type="button"
            class="dropzone"
            :class="{ drag: dzDrag }"
            @click="newTemp"
            @dragover.prevent="dzDrag = true"
            @dragleave="dzDrag = false"
            @drop.prevent="onDzDrop"
          >
            <svg class="dz-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
            </svg>
            <span class="dz-strong">拖文件 / 文件夹到此</span>
            或点击新建 · 到期自删
          </button>

          <button
            v-for="it in tempItems"
            :key="it.id"
            type="button"
            class="temp-tile"
            @click="goTemp(it)"
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
                <span class="tt-name" :title="it.originalName || '未命名'">{{ it.originalName || '未命名' }}</span>
                <span class="tt-meta">{{ tempMeta(it) }}</span>
              </div>
            </div>
            <div class="tt-foot">
              <span class="mini-tag" :class="{ folder: it.kind === 'folder' }">{{ it.kind === 'folder' ? '文件夹' : '单文件' }}</span>
              <span class="tt-rem">{{ remLabel(it) }}</span>
            </div>
          </button>
        </div>
      </section>

      <!-- 所有库 -->
      <section class="section">
        <div class="section-bar">
          <div class="sb-l"><h2>所有库</h2><span class="sb-count">{{ allItems.length }} 个</span></div>
          <div class="sb-actions">
            <button type="button" class="btn btn-ghost btn-sm" @click="showCreateApp = true">新建应用</button>
            <button type="button" class="btn btn-primary btn-sm" @click="showCreateResource = true">新建资源库</button>
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

    <teleport to="body">
      <div v-if="showCreateApp" class="modal-back" @click.self="showCreateApp = false">
        <div class="modal card">
          <h2>新建应用</h2>
          <label class="lbl">软件名（可选，用于展示）</label>
          <input v-model="newAppDisplayName" class="input" placeholder="例如：闪电助手" />
          <label class="lbl">包名（目录与 URL，仅字母数字、_ -）</label>
          <input v-model="newAppName" class="input" placeholder="my-app" />
          <label class="lbl">类型</label>
          <select v-model="newAppRepoType" class="input">
            <option value="general">通用</option>
            <option value="tauri">Tauri</option>
          </select>
          <div class="row">
            <button type="button" class="btn btn-ghost" @click="showCreateApp = false">取消</button>
            <button type="button" class="btn btn-primary" :disabled="creatingApp" @click="createApp">创建</button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="showCreateResource" class="modal-back" @click.self="showCreateResource = false">
        <div class="modal card">
          <h2>新建资源库</h2>
          <label class="lbl">展示名（可选）</label>
          <input v-model="newResDisplayName" class="input" placeholder="例如：常用工具合集" />
          <label class="lbl">资源库标识（目录与 URL，仅字母数字、_ -）</label>
          <input v-model="newResName" class="input" placeholder="my-resources" />
          <label class="lbl">资源库简介（可选）</label>
          <textarea v-model="newResDescription" class="textarea" rows="3" placeholder="对外下载页顶部说明" />
          <div class="row">
            <button type="button" class="btn btn-ghost" @click="showCreateResource = false">取消</button>
            <button type="button" class="btn btn-primary" :disabled="creatingRes" @click="createLibrary">创建</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/client';
import { useToast } from '@/composables/useToast';
import { formatRemainingSec } from '@/utils/format-remaining';

const router = useRouter();
const { toast } = useToast();
const apps = ref([]);
const libraries = ref([]);
const tempItems = ref([]);
const loading = ref(true);
const tempTick = ref(0);
const dzDrag = ref(false);
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

function newTemp() {
  router.push('/temp-transfer');
}

// 就地拖拽上传为后续增强（需移植 useFolderUpload）；当前先进入创建页
function onDzDrop() {
  dzDrag.value = false;
  router.push('/temp-transfer');
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
  } catch {
    tempItems.value = [];
  }
}

async function load() {
  loading.value = true;
  try {
    const [a, r] = await Promise.all([api('GET', '/api/apps'), api('GET', '/api/resources')]);
    apps.value = a;
    libraries.value = r;
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    loading.value = false;
  }
  await loadTempList();
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
    showCreateApp.value = false;
    newAppName.value = '';
    newAppDisplayName.value = '';
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
    showCreateResource.value = false;
    newResName.value = '';
    newResDisplayName.value = '';
    newResDescription.value = '';
    await load();
    router.push(`/resources/${encodeURIComponent(name)}`);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    creatingRes.value = false;
  }
}

onMounted(async () => {
  await load();
  tempTickTimer = setInterval(() => {
    tempTick.value += 1;
  }, 1000);
  tempListTimer = setInterval(() => {
    loadTempList();
  }, 40000);
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
  transition: box-shadow 0.18s var(--ease), border-color 0.18s var(--ease), transform 0.18s var(--ease);
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

/* 投放格 */
.dropzone {
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius);
  padding: 17px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text2);
  font-size: 0.8rem;
  min-height: 148px;
  cursor: pointer;
  font-family: inherit;
  background: transparent;
  transition: border-color 0.18s var(--ease), background 0.18s var(--ease), color 0.18s var(--ease);
}
.dropzone:hover,
.dropzone.drag {
  border-color: var(--accent);
  background: var(--accent-tint);
  color: var(--accent);
}
.dz-ico {
  width: 34px;
  height: 34px;
  margin-bottom: 9px;
  color: var(--accent);
  opacity: 0.85;
}
.dz-strong {
  display: block;
  color: var(--text);
  font-weight: 600;
  margin-bottom: 3px;
}
.dropzone.drag .dz-strong {
  color: var(--accent);
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
  transition: box-shadow 0.18s var(--ease), border-color 0.18s var(--ease), transform 0.18s var(--ease);
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
  transition: stroke-dashoffset 0.4s var(--ease);
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
  justify-content: space-between;
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
  font-size: 0.72rem;
  color: var(--text2);
  font-family: var(--font-mono);
}

/* modal */
.modal-back {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 8000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal {
  width: 100%;
  max-width: 420px;
  padding: 24px;
}
.modal h2 {
  margin: 0 0 16px;
  font-size: 1.15rem;
  font-weight: 700;
}
.lbl {
  display: block;
  font-size: 12px;
  color: var(--text2);
  margin-bottom: 6px;
  margin-top: 12px;
}
.lbl:first-of-type {
  margin-top: 0;
}
.input,
.textarea {
  width: 100%;
  margin-bottom: 0;
}
.textarea {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  margin-top: 4px;
}
.row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style>
