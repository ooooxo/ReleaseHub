<template>
  <div class="res-detail">
    <!-- 背景液体：这个资源库自己的那一幅（与入口页、总览同一个库） -->
    <LiquidBackdrop :entry="bgEntry" />

    <div class="ix-wrap" :class="{ 'section-dim': pageLoading }">
      <!-- 左：资源库名大字 + 上传 + 文件索引 + 设置索引 -->
      <nav class="ix-idx" aria-label="文件与设置">
        <RouterLink to="/" class="ix-crumb">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          总览
        </RouterLink>
        <div class="ix-chips">
          <span class="chip resource">资源库</span>
          <span class="chip">{{ items.length }} 个文件</span>
          <span v-if="pageLoading" class="chip">载入中…</span>
        </div>
        <h1 class="ix-title">{{ displayLabel }}</h1>
        <span class="ix-sub">{{ libraryName }}</span>
        <div class="ix-acts">
          <!-- 上传交给上传托盘，换页不断；同名覆盖并保留元数据 -->
          <FolderAwareDropzone variant="pill" :disabled="pageLoading" @items="onUploadItems">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" /></svg>
            <span><span class="drag-only">拖文件到这里 · </span>选文件</span>
          </FolderAwareDropzone>
          <a v-if="publicPageUrl" class="btn btn-ghost btn-sm" :href="publicPageUrl" target="_blank" rel="noopener noreferrer">打开公开页</a>
        </div>

        <div class="ix-grp grp-row">
          文件
          <button v-if="hasNestedPaths" type="button" class="grp-toggle" @click="setFolderBrowse(!folderBrowse)">
            {{ folderBrowse ? '平铺全部' : '按文件夹浏览' }}
          </button>
        </div>
        <template v-if="folderBrowse && hasNestedPaths">
          <nav class="crumbs" aria-label="路径">
            <button
              v-for="(c, i) in browseCrumbs"
              :key="c.path"
              type="button"
              class="crumb"
              :class="{ current: i === browseCrumbs.length - 1 }"
              @click="setBrowsePath(c.path)"
            >
              {{ c.label }}
            </button>
            <button v-if="browseArchiveUrl" type="button" class="crumb-zip" @click="copy(browseArchiveUrl)">复制当前目录 ZIP 直链</button>
          </nav>
          <button v-for="f in browseFolders" :key="f.path" type="button" class="ix-it sm" @click="setBrowsePath(f.path)">
            <b>{{ f.name }}/</b><span>文件夹</span>
          </button>
        </template>
        <p v-if="!pageLoading && !items.length" class="muted">还没有文件，拖进来就上传。</p>
        <button
          v-for="it in displayItems"
          :key="it.id"
          type="button"
          class="ix-it sm"
          :class="{ on: openId === it.id }"
          v-tip="it.fileName"
          @click="selectItem(it.id)"
        >
          <b :class="{ 'path-font': folderBrowse && hasNestedPaths }">{{ itemCardTitle(it) }}</b>
          <span class="num">{{ it.version ? `${it.version} · ` : '' }}{{ formatBytes(it.size) }}</span>
        </button>

        <div class="ix-grp">设置</div>
        <button type="button" class="ix-it sm" :class="{ on: advOpen }" @click="selectPane('info')">
          <b>基本信息</b><span>标识 · 展示名 · 简介 · 对外接口</span>
        </button>
        <button type="button" class="ix-it sm" :class="{ on: dangerOpen }" @click="selectPane('danger')">
          <b>危险操作</b><span>删除资源库</span>
        </button>
      </nav>

      <!-- 右：选中项的内容（某个文件 / 基本信息 / 危险操作）；什么都没选时是上传与对外链接 -->
      <aside class="ix-pane">
        <section v-if="openItem" :key="openItem.id" class="ix-sec" :aria-label="`${itemCardTitle(openItem)} 详情`" @keydown.esc="selectPane(null)">
          <h2>{{ itemCardTitle(openItem) }}</h2>
          <ul class="kv">
            <li><span class="k">大小</span><span class="v mono">{{ formatBytes(openItem.size) }}</span></li>
            <li v-if="openItem.version"><span class="k">版本</span><span class="v mono">{{ openItem.version }}</span></li>
            <li><span class="k">路径</span><span class="v mono">{{ openItem.fileName }}</span></li>
          </ul>
          <div class="fc-actions">
            <a class="btn btn-ghost btn-sm" :href="openItem.downloadUrl" target="_blank" rel="noopener noreferrer">下载</a>
            <button type="button" class="btn btn-ghost btn-sm" @click="copy(openItem.landingHref)">复制说明页</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="copy(openItem.downloadUrl)">复制直链</button>
            <button v-if="itemInSubfolder(openItem)" type="button" class="btn btn-ghost btn-sm" @click="copy(itemFolderZip(openItem))">复制所在文件夹 ZIP</button>
          </div>
          <span class="field-label">编辑</span>
          <div class="fc-form">
            <div>
              <span class="field-label">显示名（可选）</span>
              <input v-model="itemEdit.model.displayName" class="input" :disabled="pageLoading" />
            </div>
            <div>
              <span class="field-label">版本号（可选，公开页显示在名称右侧）</span>
              <input v-model="itemEdit.model.version" class="input" :disabled="pageLoading" placeholder="如 v1.2.0" />
            </div>
            <div>
              <span class="field-label">简介（可选）</span>
              <textarea v-model="itemEdit.model.description" class="textarea" rows="3" :disabled="pageLoading" />
            </div>
            <div class="fc-actions">
              <TwoStepButton
                label="删除文件"
                armed-label="再按删除"
                btn-class="btn btn-ghost btn-sm"
                :busy="deletingItem === openItem.id"
                @confirm="deleteItem(openItem)"
              />
            </div>
          </div>
          <SaveBar ref="itemBar" :dirty="itemEdit.dirty" :busy="savingItem" @save="saveItem" @discard="itemEdit.discard()" />
        </section>

        <section v-else-if="advOpen" class="ix-sec">
          <h2>基本信息</h2>
          <div>
            <span class="field-label">标识（修改后公开 URL 中的路径段会变化）</span>
            <div class="row-input">
              <input v-model="idEdit" class="input code" spellcheck="false" :placeholder="libraryName" :disabled="pageLoading" />
              <ConfirmButton
                label="改标识"
                :title="`标识改为「${idEdit.trim()}」？`"
                detail="公开 URL 中的路径段随之变化，旧链接全部失效。"
                confirm-label="改标识"
                danger
                :busy="savingId || pageLoading || !idChanged"
                btn-class="btn btn-primary btn-sm"
                @confirm="saveRename"
              />
            </div>
          </div>
          <div>
            <span class="field-label">展示名（可选）</span>
            <input v-model="metaEdit.model.displayName" class="input" :placeholder="libraryName" :disabled="pageLoading" />
          </div>
          <div>
            <span class="field-label">资源库简介（可选，显示在公开下载页顶部）</span>
            <textarea v-model="metaEdit.model.description" class="textarea" rows="4" placeholder="支持换行" :disabled="pageLoading" />
          </div>
          <SaveBar ref="metaBar" :dirty="metaEdit.dirty" :busy="savingMeta" @save="saveMeta" @discard="metaEdit.discard()" />

          <template v-if="publicBase">
            <div class="settings-sep">对外接口</div>
            <ShareLinkRow v-if="publicPageUrl" label="公开浏览页" :url="publicPageUrl" />
            <ShareLinkRow v-if="publicArchiveRootUrl" label="根目录 ZIP 直链" :url="publicArchiveRootUrl" />
            <ShareLinkRow v-if="publicJsonUrl" label="JSON" :url="publicJsonUrl" />
            <p class="settings-note">公开页为卡片网格展示简介与版本；含子目录时可进入文件夹浏览或打包 ZIP。</p>
          </template>
        </section>

        <section v-else-if="dangerOpen" class="ix-sec">
          <h2>危险操作</h2>
          <div class="danger-zone">
            <span class="dz-t"><b>删除资源库</b> — 连同全部文件不可恢复</span>
            <ConfirmButton
              label="删除资源库"
              :title="`删除整个资源库「${displayLabel}」？`"
              :detail="`${items.length} 个文件与公开链接一并删除，不可恢复。`"
              confirm-label="删除"
              danger
              btn-class="btn btn-danger btn-sm"
              @confirm="deleteLibrary"
            />
          </div>
        </section>

        <section v-else class="ix-sec">
          <h2>上传</h2>
          <FolderAwareDropzone
            class="dropzone dz-big"
            :disabled="pageLoading"
            hint="拖文件或文件夹到此处，或点击选文件（同名覆盖并保留元数据）"
            @items="onUploadItems"
          />
          <template v-if="publicBase">
            <span class="field-label">对外链接</span>
            <ShareLinkRow v-if="publicPageUrl" label="公开浏览页" :url="publicPageUrl" />
            <ShareLinkRow v-if="publicArchiveRootUrl" label="根目录 ZIP 直链" :url="publicArchiveRootUrl" />
          </template>
          <p class="muted">在左侧选一个文件查看与编辑。</p>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { liquidEntry } from '@/composables/useLiquid';
import LiquidBackdrop from '@/components/LiquidBackdrop.vue';
import { useRoute, useRouter } from 'vue-router';
import { api, uploadResource } from '@/api/client';
import { useToast } from '@/composables/useToast';
import { useUnsaved } from '@/composables/useUnsaved';
import { useUploads } from '@/stores/uploads';
import ShareLinkRow from '@/components/ShareLinkRow.vue';
import FolderAwareDropzone from '@/components/FolderAwareDropzone.vue';
import SaveBar from '@/components/ui/SaveBar.vue';
import TwoStepButton from '@/components/ui/TwoStepButton.vue';
import ConfirmButton from '@/components/ui/ConfirmButton.vue';
import { describeUploadBatch } from '@/composables/useFolderUpload';
import { listDirectoryLevel, breadcrumbSegments, encodePathForUrl } from '@/utils/file-tree';
import { usePublicBase } from '@/composables/usePublicBase';
import { copyText } from '@/utils/copy-text';
import { formatBytes } from '@/utils/format-bytes';

const route = useRoute();
const router = useRouter();
const { toast } = useToast();
const uploads = useUploads();

const libraryName = computed(() => decodeURIComponent(route.params.name || ''));
const pageLoading = ref(true);
const { publicBase, loadPublicBase } = usePublicBase();
const meta = ref({ displayName: '', description: '' });
const idEdit = ref('');
const savingMeta = ref(false);
const savingId = ref(false);
const savingItem = ref(false);
const deletingItem = ref(null);
const items = ref([]);
const browsePath = ref('');
const folderBrowse = ref(false);
const advOpen = ref(false);
const dangerOpen = ref(false);
const openId = ref(null);
const metaBar = ref(null);
const itemBar = ref(null);

const openItem = computed(() => items.value.find(it => it.id === openId.value) || null);
const itemEdit = useUnsaved(() => openItem.value, { onBlocked: () => itemBar.value?.nudge() });
const metaEdit = useUnsaved(() => meta.value, {
  onBlocked: () => {
    showPane('info');
    nextTick(() => metaBar.value?.nudge());
  },
});

const idChanged = computed(() => !!idEdit.value.trim() && idEdit.value.trim() !== libraryName.value);
const displayLabel = computed(() => meta.value.displayName?.trim() || libraryName.value);
// 背景液体：与入口页、总览里这个资源库的那一幅同源
const bgEntry = computed(() =>
  liquidEntry({ kind: 'resource', name: libraryName.value, displayLabel: displayLabel.value, description: meta.value.description }),
);

/* 右侧同时只摆一样：某个文件 / 基本信息 / 危险操作；换之前当前那份有未存改动就不换，抖一下保存条 */
function canLeavePane() {
  if (openId.value && itemEdit.dirty) {
    itemBar.value?.nudge();
    return false;
  }
  if (advOpen.value && metaEdit.dirty) {
    metaBar.value?.nudge();
    return false;
  }
  return true;
}
function showPane(name, id = null) {
  openId.value = name === 'item' ? id : null;
  advOpen.value = name === 'info';
  dangerOpen.value = name === 'danger';
}
/* 手机上右侧排在索引下面：选中后滚到内容处 */
const narrow = matchMedia('(max-width: 760px)');
function revealPane() {
  if (narrow.matches) nextTick(() => document.querySelector('.ix-pane')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
/** 再点一次已选中的那项 = 收起回到「上传」 */
function selectPane(name) {
  const same = (name === 'info' && advOpen.value) || (name === 'danger' && dangerOpen.value);
  if (!canLeavePane()) return;
  showPane(same ? null : name);
  revealPane();
}
function selectItem(id) {
  if (!canLeavePane()) return;
  showPane(openId.value === id ? null : 'item', id);
  revealPane();
}
function setFolderBrowse(v) {
  if (!canLeavePane()) return;
  showPane(null);
  folderBrowse.value = v;
}
function setBrowsePath(p) {
  if (!canLeavePane()) return;
  showPane(null);
  browsePath.value = p;
}

const publicPageUrl = computed(() =>
  publicBase.value && libraryName.value ? `${publicBase.value}/r/${encodeURIComponent(libraryName.value)}` : '',
);
const publicJsonUrl = computed(() =>
  publicBase.value && libraryName.value
    ? `${publicBase.value}/api/public/resources/${encodeURIComponent(libraryName.value)}`
    : '',
);
const publicArchiveRootUrl = computed(() =>
  publicBase.value && libraryName.value
    ? `${publicBase.value}/r/${encodeURIComponent(libraryName.value)}/archive`
    : '',
);
const browseCrumbs = computed(() => breadcrumbSegments(browsePath.value));
const browseListing = computed(() => listDirectoryLevel(items.value, browsePath.value));
const browseFolders = computed(() => browseListing.value.folders);
const browseFiles = computed(() => browseListing.value.files);
const hasNestedPaths = computed(() => items.value.some(it => String(it.fileName || '').includes('/')));
const displayItems = computed(() =>
  folderBrowse.value && hasNestedPaths.value ? browseFiles.value : items.value,
);
const browseArchiveUrl = computed(() => {
  if (!publicBase.value || !libraryName.value) return '';
  const q = browsePath.value ? `?path=${encodeURIComponent(browsePath.value)}` : '';
  return `${publicBase.value}/r/${encodeURIComponent(libraryName.value)}/archive${q}`;
});

/* 选中的文件因删除 / 换目录不在当前列表里了，就收起 */
watch(
  () => !openId.value || displayItems.value.some(it => it.id === openId.value),
  present => {
    if (!present) openId.value = null;
  },
);

function enrichItem(it) {
  const encPath = encodePathForUrl(it.fileName);
  const name = encodeURIComponent(libraryName.value);
  return {
    ...it,
    displayName: it.displayName || '',
    version: it.version || '',
    description: it.description || '',
    landingHref: `${publicBase.value}/rd/${name}/${encPath}`,
    downloadUrl: `${publicBase.value}/r/${name}/files/${encPath}`,
  };
}

function fileBaseName(path) {
  const s = String(path || '');
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}
/* 卡面只读已存的值：未存改动只活在详情带里 */
function itemCardTitle(it) {
  return it.displayName?.trim() || fileBaseName(it.fileName) || it.fileName;
}
function itemCardSubtitle(it) {
  const path = String(it.fileName || '');
  const dn = it.displayName?.trim();
  if (dn && dn !== fileBaseName(path)) return path;
  if (path.includes('/')) return path;
  return '';
}
function itemInSubfolder(it) {
  return String(it.fileName || '').includes('/');
}
function itemFolderZip(it) {
  const parts = String(it.fileName).split('/');
  parts.pop();
  const dir = parts.join('/');
  const q = dir ? `?path=${encodeURIComponent(dir)}` : '';
  return `${publicBase.value}/r/${encodeURIComponent(libraryName.value)}/archive${q}`;
}

function applyDetail(d) {
  meta.value = { displayName: d.displayName || '', description: d.description || '' };
  items.value = (d.items || []).map(enrichItem);
}

async function loadPage() {
  pageLoading.value = true;
  try {
    await loadPublicBase();
    applyDetail(await api('GET', `/api/resources/${encodeURIComponent(libraryName.value)}`));
  } catch (e) {
    toast(e.message, 'error');
    items.value = [];
  } finally {
    pageLoading.value = false;
  }
}

/* 上传完成后静默刷新：不压暗页面，未存改动叠在新数据上照旧保留 */
async function refreshItems() {
  try {
    applyDetail(await api('GET', `/api/resources/${encodeURIComponent(libraryName.value)}`));
  } catch (e) {
    toast(e.message, 'error');
  }
}


function copy(text) {
  if (!text) return;
  copyText(text).then(
    () => toast('已复制'),
    () => toast('复制失败', 'error'),
  );
}

async function saveMeta() {
  const v = metaEdit.values();
  if (v.description.length > 6000) {
    toast('简介过长（最多 6000 字）', 'error');
    return;
  }
  savingMeta.value = true;
  try {
    const idx = await api('PATCH', `/api/resources/${encodeURIComponent(libraryName.value)}`, {
      displayName: v.displayName.trim(),
      description: v.description.trim(),
    });
    meta.value = { displayName: idx.displayName || '', description: idx.description || '' };
    metaEdit.discard();
    toast('已保存');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingMeta.value = false;
  }
}

async function saveRename() {
  const next = idEdit.value.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(next)) {
    toast('标识只能包含字母、数字、下划线和连字符', 'error');
    return;
  }
  savingId.value = true;
  try {
    await api('POST', `/api/resources/${encodeURIComponent(libraryName.value)}/rename`, { newName: next });
    toast('已修改标识');
    await router.replace(`/resources/${encodeURIComponent(next)}`);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingId.value = false;
  }
}

async function saveItem() {
  const it = openItem.value;
  const v = itemEdit.values();
  if (v.description.length > 6000) {
    toast('简介过长', 'error');
    return;
  }
  savingItem.value = true;
  try {
    const r = await api('PATCH', `/api/resources/${encodeURIComponent(libraryName.value)}/items/${encodeURIComponent(it.id)}`, {
      displayName: v.displayName,
      version: v.version,
      description: v.description,
    });
    const i = items.value.findIndex(x => x.id === it.id);
    if (i >= 0) items.value[i] = enrichItem(r.item);
    itemEdit.discard();
    toast('已保存');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingItem.value = false;
  }
}

async function deleteItem(it) {
  deletingItem.value = it.id;
  try {
    await api('DELETE', `/api/resources/${encodeURIComponent(libraryName.value)}/items/${encodeURIComponent(it.id)}`);
    itemEdit.discard();
    openId.value = null;
    items.value = items.value.filter(x => x.id !== it.id);
    toast('已删除');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    deletingItem.value = null;
  }
}

async function deleteLibrary() {
  try {
    await api('DELETE', `/api/resources/${encodeURIComponent(libraryName.value)}`);
    itemEdit.discard();
    metaEdit.discard();
    toast('已删除资源库');
    router.push({ path: '/', hash: '#library-grid' });
  } catch (e) {
    toast(e.message, 'error');
  }
}

const uploadGroup = computed(() => `res:${libraryName.value}`);
function onUploadItems(list) {
  if (!list?.length || pageLoading.value) return;
  const name = libraryName.value;
  uploads.start({
    key: `res:${name}`,
    title: describeUploadBatch(list).label,
    target: `资源库 · ${displayLabel.value}`,
    to: `/resources/${encodeURIComponent(name)}`,
    run: ({ onProgress, signal }) => uploadResource({ name, items: list, onProgress, signal }),
  });
}
watch(() => uploads.doneAt[uploadGroup.value], t => t && refreshItems());

watch(
  () => route.params.name,
  () => {
    items.value = [];
    openId.value = null;
    idEdit.value = libraryName.value;
    loadPage();
  },
  { immediate: true },
);
</script>

<style scoped>
/* 资源库的投放胶囊用资源库的绿 */
.res-detail {
  --drop-c: var(--green);
}
.section-dim {
  opacity: 0.55;
  pointer-events: none;
}
.prog-txt.indet {
  margin-top: 10px;
}
/* 库设置内分隔 */
.settings-sep {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 650;
  color: var(--text3);
}
.settings-note {
  margin: 4px 0 0;
  font-size: 0.74rem;
  color: var(--text3);
  line-height: 1.5;
}
/* 文件夹浏览：面包屑 mono chip 行 + 文件夹列表 */
.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
.crumb {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
  background: var(--accent-tint);
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  padding: 3px 9px;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease-out);
}
.crumb:hover {
  border-color: var(--accent);
}
.crumb.current {
  color: var(--text2);
  background: var(--inset);
  cursor: default;
}
.crumb-zip {
  margin-left: auto;
  font-size: 0.72rem;
  color: var(--text3);
  background: none;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xs);
  padding: 3px 10px;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out);
}
.crumb-zip:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.fc-col .kv .v.mono {
  overflow-wrap: anywhere;
}
.fc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.fc-form {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.fc-col .kv .v.mono,
.kv .v.mono {
  overflow-wrap: anywhere;
}
/* 「文件」分组标题右侧的视图切换 */
.grp-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.grp-toggle {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--text3);
  cursor: pointer;
}
.grp-toggle:hover {
  color: var(--text);
}
.path-font {
  font-family: var(--font-mono);
  letter-spacing: 0;
}
.dz-big {
  min-height: 160px;
}
.muted {
  margin: 0;
  font-size: 14px;
  color: var(--text3);
}
@media (max-width: 760px) {
  .drag-only {
    display: none;
  }
}

</style>
