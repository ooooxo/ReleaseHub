<template>
  <div class="layout-max">
    <div class="appbar" :class="{ 'section-dim': pageLoading }">
      <button
        type="button"
        class="back"
        title="返回总览"
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

    <!-- 全宽投放区 -->
    <div ref="uploadRef" class="dz-wrap" :class="{ 'section-dim': pageLoading }">
      <FolderAwareDropzone
        :disabled="pageLoading || uploading"
        :hint="
          uploading
            ? '正在上传…'
            : '拖拽文件或文件夹到此处，或点击选择（自动识别目录结构；同名覆盖并保留元数据）'
        "
        @items="onUploadItems"
      />
      <div v-if="uploadPct != null && uploadPct >= 0" class="prog">
        <div class="prog-bar">
          <div class="prog-fill" :style="{ width: uploadPct + '%' }" />
        </div>
        <span class="prog-txt">{{ uploadPct }}%</span>
      </div>
      <div v-else-if="uploadPct === -1" class="prog-txt indet">上传中（无法计算进度）…</div>
      <button v-if="uploading" type="button" class="btn btn-sm btn-ghost" @click="cancelUpload">取消</button>
    </div>

    <!-- 库设置：折叠区，位于投放区下方、文件区上方 -->
    <div class="adv" :class="{ open: advOpen, 'section-dim': pageLoading }" style="margin-top: 0; margin-bottom: 18px">
      <div class="adv-head" @click="advOpen = !advOpen">
        <span class="adv-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z" /></svg>
        </span>
        <div class="adv-t">
          <h3>基本信息</h3>
          <p>标识 / 展示名 / 简介 / 对外接口 — 默认收起</p>
        </div>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </div>
      <div class="adv-body">
        <div>
          <span class="field-label">标识（修改后公开 URL 中的路径段会变化）</span>
          <div class="row-input">
            <input
              v-model="idEdit"
              class="input code"
              spellcheck="false"
              :placeholder="libraryName"
              :disabled="pageLoading"
            />
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="savingId || pageLoading || idEdit.trim() === libraryName || !idEdit.trim()"
              @click="saveRename"
            >
              保存标识
            </button>
          </div>
        </div>
        <div>
          <span class="field-label">展示名（可选）</span>
          <input v-model="displayNameEdit" class="input" :placeholder="libraryName" :disabled="pageLoading" />
        </div>
        <div>
          <span class="field-label">资源库简介（可选，显示在公开下载页顶部）</span>
          <textarea
            v-model="descriptionEdit"
            class="textarea"
            rows="4"
            placeholder="支持换行"
            :disabled="pageLoading"
          />
        </div>
        <div class="vactions">
          <button type="button" class="btn btn-primary btn-sm" :disabled="savingMeta || pageLoading" @click="saveMeta">
            保存名称与简介
          </button>
        </div>

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
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            @click="folderBrowse = !folderBrowse"
          >
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
            @click="browsePath = c.path"
          >
            {{ c.label }}
          </button>
          <button
            v-if="browseArchiveUrl"
            type="button"
            class="crumb-zip"
            @click="copy(browseArchiveUrl)"
          >复制当前目录 ZIP 直链</button>
        </nav>
        <ul v-if="browseFolders.length" class="folder-list">
          <li v-for="f in browseFolders" :key="f.path">
            <button type="button" class="folder-row" @click="browsePath = f.path">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
              {{ f.name }}
            </button>
          </li>
        </ul>
      </template>

      <transition-group name="res-card" tag="div" class="bento" :class="{ 'section-dim': pageLoading }">
        <div
          v-for="it in displayItems"
          :key="it.id"
          class="fcard"
          :class="{ open: openId === it.id }"
          @click="toggleOpen(it.id)"
        >
          <div class="fc-head">
            <span class="ico is-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 3v5h5M14 3l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /></svg>
            </span>
            <div class="fc-titles">
              <span
                class="fc-name"
                :class="{ 'path-font': folderBrowse && hasNestedPaths }"
                :title="it.fileName"
              >{{ itemCardTitle(it) }}</span>
              <span v-if="itemEdits[it.id]?.version?.trim()" class="fc-ver">{{ itemEdits[it.id].version.trim() }}</span>
            </div>
            <span class="fc-size">{{ fmtSize(it.size) }}</span>
          </div>
          <p v-if="itemCardSubtitle(it) || itemEdits[it.id]?.description?.trim()" class="fc-desc">
            {{ itemEdits[it.id]?.description?.trim() || itemCardSubtitle(it) }}
          </p>
          <div class="fc-foot">
            <a
              class="btn btn-primary btn-sm"
              :href="itemDirect(it)"
              target="_blank"
              rel="noopener noreferrer"
              @click.stop
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              下载
            </a>
            <button type="button" class="btn btn-ghost btn-sm" @click.stop="copy(itemDirect(it))">复制直链</button>
            <span class="fc-hint">
              {{ openId === it.id ? '收起' : '展开' }}
              <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </div>

          <div class="fc-detail" @click.stop>
            <div class="fc-col">
              <h4>文件信息</h4>
              <ul class="kv">
                <li><span class="k">大小</span><span class="v mono">{{ fmtSize(it.size) }}</span></li>
                <li v-if="itemEdits[it.id]?.version?.trim()"><span class="k">版本</span><span class="v mono">{{ itemEdits[it.id].version.trim() }}</span></li>
                <li><span class="k">路径</span><span class="v mono">{{ it.fileName }}</span></li>
              </ul>
              <div class="fc-actions">
                <a
                  class="btn btn-ghost btn-sm"
                  :href="itemDirect(it)"
                  target="_blank"
                  rel="noopener noreferrer"
                >下载</a>
                <button type="button" class="btn btn-ghost btn-sm" @click="copy(itemLanding(it))">复制说明页</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="copy(itemDirect(it))">复制直链</button>
                <button
                  v-if="itemInSubfolder(it)"
                  type="button"
                  class="btn btn-ghost btn-sm"
                  @click="copy(itemFolderZip(it))"
                >复制所在文件夹 ZIP</button>
              </div>
            </div>
            <div class="fc-col">
              <h4>编辑</h4>
              <div class="fc-form">
                <div>
                  <span class="field-label">显示名（可选）</span>
                  <input v-model="itemEdits[it.id].displayName" class="input" :disabled="pageLoading" />
                </div>
                <div>
                  <span class="field-label">版本号（可选，公开页显示在名称右侧）</span>
                  <input v-model="itemEdits[it.id].version" class="input" :disabled="pageLoading" placeholder="如 v1.2.0" />
                </div>
                <div>
                  <span class="field-label">简介（可选）</span>
                  <textarea v-model="itemEdits[it.id].description" class="textarea" rows="3" :disabled="pageLoading" />
                </div>
                <div class="fc-actions">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    :disabled="savingItem === it.id || deletingItem === it.id || pageLoading"
                    @click="saveItem(it.id)"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger btn-sm"
                    :disabled="deletingItem === it.id || savingItem === it.id || pageLoading"
                    @click="confirmDeleteItem(it)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition-group>
    </template>
    <p v-if="!pageLoading && !items.length" class="empty-hint">暂无文件，请上传。</p>

    <!-- 危险操作：与基本信息分开，置于页面底部 -->
    <div class="adv danger-adv" :class="{ open: dangerOpen }">
      <div class="adv-head" @click="dangerOpen = !dangerOpen">
        <span class="adv-ico danger-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
        </span>
        <div class="adv-t">
          <h3>危险操作</h3>
          <p>删除资源库 — 不可恢复，默认收起</p>
        </div>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </div>
      <div class="adv-body">
        <div class="danger-zone">
          <span class="dz-t"><b>删除资源库</b> — 连同全部文件不可恢复</span>
          <button type="button" class="btn btn-danger btn-sm" @click="confirmDeleteLibrary">删除资源库…</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, uploadResource } from '@/api/client';
import { useToast } from '@/composables/useToast';
import ShareLinkRow from '@/components/ShareLinkRow.vue';
import FolderAwareDropzone from '@/components/FolderAwareDropzone.vue';
import { describeUploadBatch } from '@/composables/useFolderUpload';
import { listDirectoryLevel, breadcrumbSegments, encodePathForUrl } from '@/utils/file-tree';
import { suggestedPublicBaseFromVite } from '@/utils/public-url';

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const libraryName = computed(() => decodeURIComponent(route.params.name || ''));
const pageLoading = ref(true);
const publicBase = ref('');
const displayNameEdit = ref('');
const descriptionEdit = ref('');
const idEdit = ref('');
const savingMeta = ref(false);
const savingId = ref(false);
const savingItem = ref(null);
const deletingItem = ref(null);
const uploading = ref(false);
const items = ref([]);
/** 每项编辑草稿；键与 items[].id 对齐，模板 v-model 依赖此对象已存在 */
const itemEdits = reactive({});
const uploadPct = ref(null);
const browsePath = ref('');
const folderBrowse = ref(false);
const advOpen = ref(false);
const dangerOpen = ref(false);
const openId = ref(null);
const uploadRef = ref(null);

function toggleOpen(id) {
  openId.value = openId.value === id ? null : id;
}

function scrollToUpload() {
  uploadRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const displayLabel = computed(() => displayNameEdit.value.trim() || libraryName.value);

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

function suggestedBase() {
  return suggestedPublicBaseFromVite();
}

async function loadSettingsBase() {
  try {
    const s = await api('GET', '/api/settings');
    publicBase.value = (s.baseUrl || '').replace(/\/$/, '') || suggestedBase();
  } catch {
    publicBase.value = suggestedBase();
  }
}

function enrichItem(it) {
  const name = libraryName.value;
  const base = publicBase.value;
  const encPath = encodePathForUrl(it.fileName);
  return {
    ...it,
    landingHref: `${base}/rd/${encodeURIComponent(name)}/${encPath}`,
    downloadUrl: `${base}/r/${encodeURIComponent(name)}/files/${encPath}`,
  };
}

function fileBaseName(path) {
  const s = String(path || '');
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

function itemCardTitle(it) {
  const dn = itemEdits[it.id]?.displayName?.trim();
  if (dn) return dn;
  return fileBaseName(it.fileName) || it.fileName;
}

function itemCardSubtitle(it) {
  const path = String(it.fileName || '');
  const dn = itemEdits[it.id]?.displayName?.trim();
  if (dn && dn !== fileBaseName(path)) return path;
  if (path.includes('/')) return path;
  return '';
}

function itemInSubfolder(it) {
  return String(it.fileName || '').includes('/');
}

function itemFolderZip(it) {
  const base = publicBase.value;
  const name = libraryName.value;
  if (!base || !name) return '';
  const parts = String(it.fileName).split('/');
  parts.pop();
  const dir = parts.join('/');
  const q = dir ? `?path=${encodeURIComponent(dir)}` : '';
  return `${base}/r/${encodeURIComponent(name)}/archive${q}`;
}

function primeItemEdits(list) {
  const ids = new Set((list || []).map(x => x.id));
  for (const k of Object.keys(itemEdits)) {
    if (!ids.has(k)) delete itemEdits[k];
  }
  for (const it of list || []) {
    if (!itemEdits[it.id]) {
      itemEdits[it.id] = {
        displayName: it.displayName || '',
        version: it.version || '',
        description: it.description || '',
      };
    }
  }
}

function applyDetail(d) {
  displayNameEdit.value = d.displayName != null ? String(d.displayName) : '';
  descriptionEdit.value = d.description != null ? String(d.description) : '';
  idEdit.value = libraryName.value;
  const raw = d.items || [];
  items.value = raw.map(enrichItem);
  primeItemEdits(raw);
}

async function loadPage() {
  pageLoading.value = true;
  try {
    await loadSettingsBase();
    const d = await api('GET', `/api/resources/${encodeURIComponent(libraryName.value)}`);
    applyDetail(d);
  } catch (e) {
    toast(e.message, 'error');
    items.value = [];
    for (const k of Object.keys(itemEdits)) delete itemEdits[k];
  } finally {
    pageLoading.value = false;
  }
}

function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function itemLanding(it) {
  return (
    it.landingHref ||
    `${publicBase.value}/rd/${encodeURIComponent(libraryName.value)}/${encodeURIComponent(it.fileName)}`
  );
}
function itemDirect(it) {
  return (
    it.downloadUrl ||
    `${publicBase.value}/r/${encodeURIComponent(libraryName.value)}/files/${encodeURIComponent(it.fileName)}`
  );
}

function copy(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => toast('已复制'),
    () => toast('复制失败', 'error'),
  );
}

async function saveMeta() {
  if (descriptionEdit.value.length > 6000) {
    toast('简介过长（最多 6000 字）', 'error');
    return;
  }
  savingMeta.value = true;
  try {
    const idx = await api('PATCH', `/api/resources/${encodeURIComponent(libraryName.value)}`, {
      displayName: displayNameEdit.value.trim(),
      description: descriptionEdit.value.trim(),
    });
    displayNameEdit.value = idx.displayName != null ? String(idx.displayName) : '';
    descriptionEdit.value = idx.description != null ? String(idx.description) : '';
    toast('已保存');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingMeta.value = false;
  }
}

async function saveRename() {
  const next = idEdit.value.trim();
  if (!next || !/^[a-zA-Z0-9_-]+$/.test(next)) {
    toast('标识只能包含字母、数字、下划线和连字符', 'error');
    return;
  }
  if (next === libraryName.value) return;
  if (
    !window.confirm(
      `将资源库标识「${libraryName.value}」改为「${next}」：公开 URL 路径会变化，旧链接将失效。确定继续？`,
    )
  )
    return;
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

async function saveItem(id) {
  const ed = itemEdits[id];
  if (!ed) return;
  if ((ed.description || '').length > 6000) {
    toast('简介过长', 'error');
    return;
  }
  savingItem.value = id;
  try {
    const r = await api('PATCH', `/api/resources/${encodeURIComponent(libraryName.value)}/items/${encodeURIComponent(id)}`, {
      displayName: ed.displayName,
      version: ed.version,
      description: ed.description,
    });
    const updated = enrichItem(r.item);
    const i = items.value.findIndex(x => x.id === updated.id);
    if (i >= 0) items.value[i] = updated;
    itemEdits[id] = {
      displayName: updated.displayName || '',
      version: updated.version || '',
      description: updated.description || '',
    };
    toast('已保存');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingItem.value = null;
  }
}

async function confirmDeleteItem(it) {
  if (!window.confirm(`删除文件「${it.fileName}」？磁盘文件与列表项都会删除。`)) return;
  deletingItem.value = it.id;
  try {
    await api('DELETE', `/api/resources/${encodeURIComponent(libraryName.value)}/items/${encodeURIComponent(it.id)}`);
    items.value = items.value.filter(x => x.id !== it.id);
    delete itemEdits[it.id];
    toast('已删除');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    deletingItem.value = null;
  }
}

async function confirmDeleteLibrary() {
  if (!window.confirm(`删除整个资源库「${libraryName.value}」？此操作不可恢复。`)) return;
  try {
    await api('DELETE', `/api/resources/${encodeURIComponent(libraryName.value)}`);
    toast('已删除资源库');
    router.push({ path: '/', hash: '#library-grid' });
  } catch (e) {
    toast(e.message, 'error');
  }
}

const uploadAbort = ref(null);

async function doUploadItems(uploadItems) {
  if (!uploadItems?.length || pageLoading.value) return;
  const desc = describeUploadBatch(uploadItems);
  const ctrl = new AbortController();
  uploadAbort.value = ctrl;
  uploading.value = true;
  uploadPct.value = 0;
  try {
    const data = await uploadResource({
      name: libraryName.value,
      items: uploadItems,
      onProgress: pct => {
        uploadPct.value = pct < 0 ? -1 : pct;
      },
      signal: ctrl.signal,
    });
    const uploaded = data?.uploaded || [];
    for (const u of uploaded) {
      const e = enrichItem(u);
      const ix = items.value.findIndex(x => x.fileName === e.fileName);
      if (ix >= 0) items.value.splice(ix, 1);
      items.value.push(e);
      itemEdits[u.id] = {
        displayName: u.displayName || '',
        version: u.version || '',
        description: u.description || '',
      };
    }
    items.value.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
    toast(`${desc.label}：已上传 ${uploaded.length} 个文件`);
  } catch (e) {
    if (e.name === 'AbortError' || e.aborted) toast('已暂停 · 重传同名文件可断点续传');
    else toast(e.message || '上传失败', 'error');
  } finally {
    uploading.value = false;
    uploadPct.value = null;
    uploadAbort.value = null;
  }
}

function cancelUpload() {
  if (uploadAbort.value) uploadAbort.value.abort();
}

function onUploadItems(list) {
  doUploadItems(list);
}

watch(
  () => route.params.name,
  (name, oldName) => {
    if (oldName !== undefined && name !== oldName) {
      items.value = [];
      for (const k of Object.keys(itemEdits)) delete itemEdits[k];
      displayNameEdit.value = '';
      descriptionEdit.value = '';
      idEdit.value = decodeURIComponent(name || '');
    }
    loadPage();
  },
  { immediate: true },
);

/** 防止异步或边界情况下 v-model 读到未初始化的 id */
watch(
  items,
  arr => {
    for (const it of arr) {
      if (it?.id && !itemEdits[it.id]) {
        itemEdits[it.id] = {
          displayName: it.displayName || '',
          version: it.version || '',
          description: it.description || '',
        };
      }
    }
  },
  { deep: true },
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

/* 危险按钮（页面级，token 化） */
.btn-danger {
  color: var(--danger);
  background: transparent;
  border-color: var(--border-strong);
}
.btn-danger:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--danger);
  background: rgba(232, 98, 79, 0.1);
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
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 104px;
  color: var(--text2);
  font-size: 0.84rem;
  cursor: pointer;
  background: transparent;
  transition: border-color 0.18s var(--ease), background 0.18s var(--ease), color 0.18s var(--ease);
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
  transition: border-color 0.18s var(--ease);
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
  transition: color 0.18s var(--ease), border-color 0.18s var(--ease);
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
  transition: border-color 0.18s var(--ease), background 0.18s var(--ease);
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
  transition: box-shadow 0.18s var(--ease), border-color 0.18s var(--ease);
}
.fcard:hover {
  border-color: var(--border-strong);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}
.fcard.open {
  border-color: var(--border-strong);
  grid-column: 1 / -1;
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
.fcard.open .fc-desc {
  display: none;
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
  transition: transform 0.2s var(--ease);
}
.fcard.open .fc-hint .chev {
  transform: rotate(180deg);
}

/* 展开全宽：左右两栏 */
.fc-detail {
  display: none;
  margin-top: 15px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  grid-template-columns: 1.1fr 1fr;
  gap: 22px;
  cursor: default;
}
.fcard.open .fc-detail {
  display: grid;
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
  .fc-detail {
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
  transition: opacity 0.22s var(--ease), transform 0.22s var(--ease);
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
  transition: transform 0.22s var(--ease);
}
</style>
