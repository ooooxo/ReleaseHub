<template>
  <div class="layout-max">
    <div class="appbar" :class="{ 'section-dim': pageLoading }">
      <button
        type="button"
        class="back"
        v-tip="'返回总览'"
        @click="router.push({ path: '/', hash: '#library-grid' })"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div class="ab-titles">
        <h1>
          {{ displayLabel }}
          <span class="chip resource">资源库</span>
          <span v-if="pageLoading" class="loading-pill">载入中…</span>
        </h1>
        <span class="pkg">标识 {{ libraryName }}<template v-if="items.length"> · {{ items.length }} 文件</template></span>
      </div>
      <div class="ab-actions">
        <a
          v-if="publicPageUrl"
          class="btn btn-ghost btn-sm"
          :href="publicPageUrl"
          target="_blank"
          rel="noopener noreferrer"
        >打开公开页</a>
        <button type="button" class="btn btn-primary btn-sm" :disabled="pageLoading" @click="scrollToUpload">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
          上传文件
        </button>
      </div>
    </div>

    <!-- 全宽投放区：上传交给上传托盘，换页不断 -->
    <div ref="uploadRef" class="dz-wrap" :class="{ 'section-dim': pageLoading }">
      <FolderAwareDropzone
        :disabled="pageLoading"
        hint="拖文件或文件夹到此处，或点击选文件（同名覆盖并保留元数据）"
        @items="onUploadItems"
      />
    </div>

    <!-- 基本信息：标识 / 展示名 / 简介 / 对外接口 -->
    <div class="adv" :class="{ open: advOpen, 'section-dim': pageLoading }" style="margin-top: 0; margin-bottom: 18px">
      <button type="button" class="adv-head" :aria-expanded="advOpen" @click="advOpen = !advOpen">
        <span class="adv-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z" /></svg>
        </span>
        <span class="adv-t">
          <b>基本信息</b>
          <small>标识 / 展示名 / 简介 / 对外接口</small>
        </span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div class="adv-body">
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
      </div>
    </div>

    <template v-if="items.length">
      <div class="section-bar" :class="{ 'section-dim': pageLoading }">
        <div class="sb-l">
          <h2>文件</h2>
          <span class="sb-count">{{ displayItems.length }} 个</span>
        </div>
        <div v-if="hasNestedPaths" class="sb-actions">
          <button type="button" class="btn btn-sm btn-ghost" @click="setFolderBrowse(!folderBrowse)">
            {{ folderBrowse ? '显示全部卡片' : '按文件夹浏览' }}
          </button>
        </div>
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
        <ul v-if="browseFolders.length" class="folder-list">
          <li v-for="f in browseFolders" :key="f.path">
            <button type="button" class="folder-row" @click="setBrowsePath(f.path)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
              {{ f.name }}
            </button>
          </li>
        </ul>
      </template>

      <!-- 卡网格：卡留原位，展开时详情带从该行下方长出（CSS order 把带插到行尾之后） -->
      <TransitionGroup
        ref="gridRef"
        name="res-card"
        tag="div"
        class="bento fgrid"
        :class="{ 'section-dim': pageLoading }"
      >
        <div
          v-for="(it, idx) in displayItems"
          :key="it.id"
          class="fcard"
          :class="{ open: openId === it.id }"
          :style="{ order: idx * 2 }"
          role="button"
          tabindex="0"
          :aria-expanded="openId === it.id"
          @click="toggleOpen(it.id)"
          @keydown.enter.self.prevent="toggleOpen(it.id)"
          @keydown.space.self.prevent="toggleOpen(it.id)"
        >
          <div class="fc-head">
            <span class="ico is-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 3v5h5M14 3l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /></svg>
            </span>
            <div class="fc-titles">
              <span class="fc-name" :class="{ 'path-font': folderBrowse && hasNestedPaths }" v-tip="it.fileName">{{ itemCardTitle(it) }}</span>
              <span v-if="it.version" class="fc-ver">{{ it.version }}</span>
            </div>
            <span class="fc-size">{{ formatBytes(it.size) }}</span>
          </div>
          <p v-if="it.description || itemCardSubtitle(it)" class="fc-desc">{{ it.description || itemCardSubtitle(it) }}</p>
          <div class="fc-foot">
            <a class="btn btn-primary btn-sm" :href="it.downloadUrl" target="_blank" rel="noopener noreferrer" @click.stop>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              下载
            </a>
            <button type="button" class="btn btn-ghost btn-sm" @click.stop="copy(it.downloadUrl)">复制直链</button>
            <span class="fc-hint">
              {{ openId === it.id ? '收起' : '展开' }}
              <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </div>
        </div>

        <section
          v-if="openItem"
          key="band"
          class="band"
          :style="{ order: bandOrder, '--cols': cols, '--col': openCol }"
          :aria-label="`${itemCardTitle(openItem)} 详情`"
          @keydown.esc="toggleOpen(openItem.id)"
        >
          <div class="band-clip">
            <div class="band-pad">
            <div class="band-inner">
              <div class="fc-col">
                <h4>文件信息</h4>
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
              </div>
              <div class="fc-col">
                <h4>编辑</h4>
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
              </div>
            </div>
            <SaveBar ref="itemBar" :dirty="itemEdit.dirty" :busy="savingItem" @save="saveItem" @discard="itemEdit.discard()" />
            </div>
          </div>
        </section>
      </TransitionGroup>
    </template>
    <p v-if="!pageLoading && !items.length" class="empty-hint">暂无文件，请上传。</p>

    <!-- 危险操作：与基本信息分开，置于页面底部 -->
    <div class="adv danger-adv" :class="{ open: dangerOpen }">
      <button type="button" class="adv-head" :aria-expanded="dangerOpen" @click="dangerOpen = !dangerOpen">
        <span class="adv-ico danger-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
        </span>
        <span class="adv-t">
          <b>危险操作</b>
          <small>删除资源库 — 不可恢复</small>
        </span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div class="adv-body">
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
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
import { suggestedPublicBaseFromVite } from '@/utils/public-url';
import { copyText } from '@/utils/copy-text';
import { formatBytes } from '@/utils/format-bytes';

const route = useRoute();
const router = useRouter();
const { toast } = useToast();
const uploads = useUploads();

const libraryName = computed(() => decodeURIComponent(route.params.name || ''));
const pageLoading = ref(true);
const publicBase = ref('');
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
const uploadRef = ref(null);
const metaBar = ref(null);
const itemBar = ref(null);

const openItem = computed(() => items.value.find(it => it.id === openId.value) || null);
const itemEdit = useUnsaved(() => openItem.value, { onBlocked: () => itemBar.value?.nudge() });
const metaEdit = useUnsaved(() => meta.value, {
  onBlocked: () => {
    advOpen.value = true;
    metaBar.value?.nudge();
  },
});

const idChanged = computed(() => !!idEdit.value.trim() && idEdit.value.trim() !== libraryName.value);
const displayLabel = computed(() => meta.value.displayName?.trim() || libraryName.value);

/* 同一页同时只开一张；有未存改动时不换卡，抖一下保存条 */
function toggleOpen(id) {
  if (itemEdit.dirty) {
    itemBar.value?.nudge();
    return;
  }
  openId.value = openId.value === id ? null : id;
}
function setFolderBrowse(v) {
  if (itemEdit.dirty) return itemBar.value?.nudge();
  openId.value = null;
  folderBrowse.value = v;
}
function setBrowsePath(p) {
  if (itemEdit.dirty) return itemBar.value?.nudge();
  openId.value = null;
  browsePath.value = p;
}

function scrollToUpload() {
  uploadRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

/* ── 详情带的位置：网格列数随宽度变，带插在被点卡所在行的行尾之后 ── */
const gridRef = ref(null);
const cols = ref(1);
const ro = new ResizeObserver(() => measureCols());
function gridEl() {
  return gridRef.value?.$el || null;
}
function measureCols() {
  const g = gridEl();
  if (g) cols.value = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
}
watch(gridRef, () => {
  ro.disconnect();
  const g = gridEl();
  if (g) {
    ro.observe(g);
    measureCols();
  }
});
onUnmounted(() => ro.disconnect());
const openIndex = computed(() => displayItems.value.findIndex(it => it.id === openId.value));
const openCol = computed(() => (openIndex.value < 0 ? 0 : openIndex.value % cols.value));
const bandOrder = computed(() => {
  const i = openIndex.value;
  const rowEnd = Math.min(Math.ceil((i + 1) / cols.value) * cols.value - 1, displayItems.value.length - 1);
  return rowEnd * 2 + 1;
});
/* 展开的卡因删除 / 换目录不在当前列表里了，就收起 */
watch(openIndex, i => {
  if (i < 0 && openId.value) openId.value = null;
});

async function loadSettingsBase() {
  try {
    const s = await api('GET', '/api/settings');
    publicBase.value = (s.baseUrl || '').replace(/\/$/, '') || suggestedPublicBaseFromVite();
  } catch {
    publicBase.value = suggestedPublicBaseFromVite();
  }
}

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
    await loadSettingsBase();
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
.section-dim {
  opacity: 0.55;
  pointer-events: none;
}
.loading-pill {
  font-size: 0.66rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-tint);
  padding: 3px 9px;
  border-radius: 999px;
  letter-spacing: 0.04em;
}


/* 全宽投放区 */
.dz-wrap {
  width: 100%;
  margin-bottom: 16px;
}
.dz-wrap :deep(.drop-zone) {
  width: 100%;
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius);
  padding: 26px 17px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 104px;
  color: var(--text2);
  font-size: 0.84rem;
  cursor: pointer;
  background: transparent;
  transition: border-color var(--t-fast) var(--ease-out), background var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out);
}
.dz-wrap :deep(.drop-zone:hover),
.dz-wrap :deep(.drop-zone.drag) {
  border-color: var(--accent);
  background: var(--accent-tint);
  color: var(--accent);
}
.dz-wrap :deep(.drop-zone.disabled) {
  cursor: not-allowed;
  opacity: 0.65;
}
.prog-txt.indet {
  margin-top: 10px;
}

/* 库设置内分隔 */
.settings-sep {
  margin-top: 4px;
  font-size: 0.66rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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
.folder-list {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.folder-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 13px;
  color: var(--text);
  cursor: pointer;
  font-size: 0.86rem;
  font-family: inherit;
  transition: border-color var(--t-fast) var(--ease-out), background var(--t-fast) var(--ease-out);
}
.folder-row:hover {
  border-color: var(--border-strong);
  background: var(--surface2);
}
.folder-row svg {
  width: 17px;
  height: 17px;
  color: var(--accent);
  flex: none;
}

/* 文件卡：折叠 / 展开两态（参考蓝本 .fcard） */
.fcard {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: box-shadow var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out);
}
.fcard:hover {
  border-color: var(--border-strong);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}
/* 来源抬起：被展开的卡留在原位，亮一圈强调边、底下长出详情带 */
.fcard.open {
  border-color: rgba(56, 189, 248, 0.55);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25), 0 10px 30px rgba(0, 0, 0, 0.45);
}
.fcard:focus-visible {
  outline: 2px solid rgba(56, 189, 248, 0.6);
  outline-offset: 2px;
}
.fc-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.fc-titles {
  flex: 1;
  min-width: 0;
}
.fc-name {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fc-name.path-font {
  font-family: var(--font-mono);
  font-size: 0.84rem;
  font-weight: 600;
}
.fc-ver {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-tint);
  padding: 2px 7px;
  border-radius: 5px;
  margin-top: 5px;
}
.fc-size {
  flex: none;
  font-size: 0.72rem;
  color: var(--text3);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  margin-top: 3px;
}
.fc-desc {
  font-size: 0.78rem;
  color: var(--text2);
  margin: 11px 0 0;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fc-foot {
  display: flex;
  gap: 8px;
  margin-top: 13px;
  align-items: center;
}
.fc-foot .btn svg {
  width: 15px;
  height: 15px;
}
.fc-hint {
  font-size: 0.66rem;
  color: var(--text3);
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.fcard.open .fc-hint {
  color: var(--accent);
}
.fc-hint .chev {
  width: 14px;
  height: 14px;
  transition: transform var(--t-med) var(--ease-out);
}
.fcard.open .fc-hint .chev {
  transform: rotate(180deg);
}

/* 详情带：通栏，插在被点卡所在行之后；尖角指回那张卡（--cols / --col 由脚本给） */
.band {
  grid-column: 1 / -1;
  display: grid;
  grid-template-rows: 1fr;
  position: relative;
  margin-top: 2px;
}
.band::before {
  content: '';
  position: absolute;
  top: -7px;
  left: calc((100% - (var(--cols) - 1) * 13px) / var(--cols) * (var(--col) + 0.5) + var(--col) * 13px - 7px);
  width: 14px;
  height: 14px;
  background: var(--surface2);
  border-left: 1px solid rgba(56, 189, 248, 0.35);
  border-top: 1px solid rgba(56, 189, 248, 0.35);
  transform: rotate(45deg);
  transition: left var(--t-med) var(--ease-in-out);
  z-index: 1;
}
.band-clip {
  min-height: 0;
  background: var(--surface2);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: var(--radius);
  cursor: default;
}
.band-pad {
  padding: 18px;
}
.band-inner {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 22px;
}
/* 长出 / 收回：行高从 0fr 到 1fr，内容不缩放、只被裁 */
.band.res-card-enter-active,
.band.res-card-leave-active {
  transition: grid-template-rows var(--t-slow) var(--ease-out), opacity var(--t-med) var(--ease-out);
}
.band.res-card-enter-active .band-clip,
.band.res-card-leave-active .band-clip {
  overflow: hidden;
}
.band.res-card-enter-from,
.band.res-card-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
  transform: none;
}
.fc-col h4 {
  margin: 0 0 11px;
  font-size: 0.66rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text3);
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
@media (max-width: 680px) {
  .band-inner {
    grid-template-columns: 1fr;
  }
}

.empty-hint {
  padding: 28px;
  text-align: center;
  color: var(--text2);
  font-size: 0.86rem;
}

/* 列表过渡 */
.res-card-enter-active,
.res-card-leave-active {
  transition: opacity var(--t-med) var(--ease-out), transform var(--t-med) var(--ease-out);
}
.res-card-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.res-card-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
.res-card-move {
  transition: transform var(--t-med) var(--ease-out);
}
</style>
