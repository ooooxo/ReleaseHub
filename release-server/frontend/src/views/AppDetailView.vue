<template>
  <div class="layout-max">
    <!-- 顶栏 -->
    <div class="appbar">
      <button type="button" class="back" title="返回总览" @click="router.push('/')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div class="ab-titles">
        <h1>
          {{ displayLabel }}
          <span class="chip" :class="repoType === 'tauri' ? 'tauri' : 'general'">{{ repoType === 'tauri' ? 'Tauri' : 'General' }}</span>
        </h1>
        <span class="pkg">{{ appName }}</span>
      </div>
      <div class="ab-actions">
        <button v-if="publicBase" type="button" class="btn btn-ghost btn-sm" @click="showApi = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
          对外接口
        </button>
        <button type="button" class="btn btn-primary btn-sm" @click="showNewVer = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
          新建版本
        </button>
      </div>
    </div>

    <!-- 基本信息（包名 / 展示名 / 简介），独立于危险操作 -->
    <div class="adv info-adv" :class="{ open: infoOpen }">
      <div class="adv-head" @click="infoOpen = !infoOpen">
        <span class="adv-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
        </span>
        <div class="adv-t">
          <h3>基本信息</h3>
          <p>包名 / 展示名 / 简介</p>
        </div>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </div>
      <div class="adv-body">
        <div class="adv-group">
          <label class="sub-label">包名（目录与 URL；修改后 latest.json、直链与公开页路径全部变为新包名）</label>
          <div class="row-input">
            <input v-model="packageNameEdit" class="input code" spellcheck="false" :placeholder="appName" />
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="savingPackageName || packageNameEdit.trim() === appName || !packageNameEdit.trim()"
              @click="savePackageRename"
            >
              保存包名
            </button>
          </div>
          <label class="sub-label">软件名（对外展示；留空则仅显示包名）</label>
          <input v-model="displayNameEdit" class="input" :placeholder="appName" />
          <label class="sub-label">软件简介（可选，显示在对外版本页；不展示包名）</label>
          <textarea v-model="descriptionEdit" class="textarea" rows="4" placeholder="一句话或简短介绍，支持换行" />
          <div class="adv-btns">
            <button type="button" class="btn btn-primary btn-sm" :disabled="savingPublicDisplay" @click="savePublicDisplay">保存名称与简介</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 当前发布 hero -->
    <div v-if="latestLoaded && published" class="published">
      <div class="pub-main">
        <span class="pub-label">当前发布</span>
        <div class="pub-ver">{{ published.version }}</div>
        <div class="pub-meta">
          <template v-if="publishedPubDate">发布于 {{ fmtDate(publishedPubDate) }} · </template>{{ versions.length }} 个历史版本
        </div>
        <div v-if="published.notes" class="pub-notes">{{ published.notes }}</div>
      </div>
      <div class="pub-actions">
        <button v-if="latestAppShortcutUrl" type="button" class="btn btn-primary" @click="copy(latestAppShortcutUrl)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          复制最新版本页
        </button>
        <button type="button" class="btn btn-ghost" @click="showPubNotes = true">编辑发布说明</button>
      </div>
    </div>
    <div v-else-if="latestLoaded && !published" class="published empty-pub">
      <div class="pub-main">
        <span class="pub-label muted-label">尚未发布</span>
        <div class="pub-empty-text">上传文件后，在某一版本上点击「设为最新发布」。</div>
      </div>
    </div>

    <!-- 版本列表 -->
    <div class="section-bar">
      <div class="sb-l"><h2>版本</h2><span class="sb-count">{{ versions.length }} 个</span></div>
    </div>

    <div v-if="loading" class="muted">加载中…</div>
    <div v-else-if="!versions.length" class="muted empty-v">还没有任何版本，点击右上角「新建版本」开始。</div>
    <div v-else class="vlist">
      <article v-for="v in versions" :key="v.version" class="vcard" :class="{ open: openVer === v.version }">
        <div class="vhead" @click="toggleVer(v.version)">
          <span class="vnum">{{ v.version }}</span>
          <span v-if="v.isLatest" class="latest">当前最新</span>
          <div class="vplats">
            <span v-for="c in versionChips(v)" :key="c" class="vchip">{{ c }}</span>
          </div>
          <span class="vfiles-n">{{ realFiles(v).length }} 文件</span>
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </div>
        <div class="vbody">
          <div class="vbody-inner">
            <!-- 草稿 -->
            <div>
              <span class="field-label">此版本说明草稿（仅草稿；发布时会写入 latest）</span>
              <textarea
                v-model="notesDraft[v.version]"
                class="textarea"
                rows="3"
                placeholder="更新说明草稿…"
                @blur="saveDraft(v.version)"
              />
              <div class="draft-actions">
                <button type="button" class="btn btn-ghost btn-sm" @click="saveDraft(v.version)">保存草稿</button>
              </div>
            </div>

            <!-- 上传投放区 -->
            <div>
              <div
                class="dropmini"
                :class="{ drag: dragVer === v.version }"
                @dragover.prevent="dragVer = v.version"
                @dragleave="dragVer = null"
                @drop.prevent="onDrop($event, v.version)"
                @click="triggerFile(v.version)"
              >
                <input
                  :ref="el => setFileInput(v.version, el)"
                  type="file"
                  multiple
                  class="hidden-input"
                  @change="onFileChange(v.version, $event)"
                />
                <b>{{ repoType === 'tauri' ? '拖拽各平台包及对应 .sig 到此' : '拖拽文件到此处' }}</b>
                或点击上传
              </div>
              <div v-if="uploadProgress[v.version] != null && uploadProgress[v.version] >= 0" class="prog">
                <div class="prog-bar"><div class="prog-fill" :style="{ width: uploadProgress[v.version] + '%' }" /></div>
                <span class="prog-txt">{{ uploadProgress[v.version] }}%</span>
              </div>
              <div v-else-if="uploadProgress[v.version] === -1" class="prog-indet">上传中（无法计算进度）…</div>
            </div>

            <!-- 文件列表 -->
            <div v-if="realFiles(v).length">
              <span class="field-label">文件 · {{ realFiles(v).length }}</span>
              <div class="filelist">
                <div v-for="f in realFiles(v)" :key="f.name" class="frow">
                  <span class="fi" :class="{ sig: isSig(f.name) }">
                    <svg v-if="isSig(f.name)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 6v6c0 5 3.4 8 8 10 4.6-2 8-5 8-10V6z" /></svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                  </span>
                  <a class="fname" :href="fileLandingUrl(v.version, f.name)" target="_blank" rel="noopener">{{ f.name }}</a>
                  <span class="fsize">{{ fmtSize(f.size) }}</span>
                  <button type="button" class="fdel" title="删除文件" @click.stop="deleteFile(v.version, f.name)">×</button>
                </div>
              </div>
            </div>

            <!-- 版本操作 -->
            <div class="vactions">
              <button v-if="!v.isLatest" type="button" class="btn btn-primary btn-sm" @click="quickPublish(v.version)">设为最新发布</button>
              <button v-else type="button" class="btn btn-ghost btn-sm" @click="republish(v.version)">重新发布</button>
              <button v-if="publicBase" type="button" class="btn btn-ghost btn-sm" @click="copy(versionPageUrl(v.version))">复制版本页</button>
              <button type="button" class="btn btn-danger btn-sm" @click="confirmDeleteVersion(v.version)">删除此版本</button>
            </div>
          </div>
        </div>
      </article>
    </div>

    <!-- 高级 / 危险操作 -->
    <div class="adv" :class="{ open: advOpen }">
      <div class="adv-head" @click="advOpen = !advOpen">
        <span class="adv-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z" /></svg>
        </span>
        <div class="adv-t">
          <h3>高级 / 危险操作</h3>
          <p>{{ repoType === 'tauri' ? 'platforms' : 'files' }} JSON、发布时间、从磁盘重建、删除应用 — 默认收起</p>
        </div>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </div>
      <div class="adv-body">
        <!-- 已发布管理 -->
        <template v-if="latestLoaded && published">
          <div class="adv-group">
            <span class="field-label">发布时间 pub_date（ISO 字符串，可选）</span>
            <div class="row-input">
              <input v-model="publishedPubDate" class="input code" placeholder="2025-01-01T12:00:00.000Z" />
              <button type="button" class="btn btn-ghost btn-sm" :disabled="savingPubDate" @click="savePublishedPubDate">保存时间</button>
            </div>
          </div>

          <div class="adv-group">
            <span class="field-label">已发布更新说明（保存后直接写 latest.json，无需重新发布）</span>
            <textarea v-model="publishedNotes" class="textarea" rows="4" placeholder="更新说明…" />
            <div class="adv-btns">
              <button type="button" class="btn btn-primary btn-sm" :disabled="savingPub" @click="savePublishedNotes">保存说明</button>
            </div>
          </div>

          <div v-if="repoType === 'tauri'" class="adv-group">
            <span class="field-label">已发布 platforms（JSON，高级）</span>
            <textarea v-model="publishedPlatformsJson" class="textarea code-ta" rows="12" spellcheck="false" />
            <div class="adv-btns">
              <button type="button" class="btn btn-ghost btn-sm" :disabled="savingPlatforms" @click="savePublishedPlatforms">保存 platforms</button>
            </div>
          </div>
          <div v-else class="adv-group">
            <span class="field-label">已发布 files（JSON 数组，高级）</span>
            <textarea v-model="publishedFilesJson" class="textarea code-ta" rows="12" spellcheck="false" />
            <div class="adv-btns">
              <button type="button" class="btn btn-ghost btn-sm" :disabled="savingFiles" @click="savePublishedFiles">保存 files</button>
            </div>
          </div>

          <div class="adv-group">
            <span class="field-label">下载链接维护</span>
            <div class="adv-btns">
              <button type="button" class="btn btn-ghost btn-sm" :disabled="refreshingUrls" @click="refreshPublishedUrls">刷新下载链接（合并磁盘）</button>
            </div>
            <p class="adv-hint">合并：只更新磁盘上能匹配到的文件的 URL / 签名，保留手工平台或条目。</p>
          </div>

          <div class="danger-zone">
            <span class="dz-t"><b>从磁盘完全重建</b> — 仅用磁盘扫描结果覆盖 {{ repoType === 'tauri' ? 'platforms' : 'files' }}，可能丢失手工数据</span>
            <button type="button" class="btn btn-danger btn-sm" :disabled="refreshingUrls" @click="refreshPublishedUrlsReplace">完全重建…</button>
          </div>
        </template>

        <div class="danger-zone">
          <span class="dz-t"><b>删除应用</b> — 移除该应用及全部版本、latest.json、草稿与元数据，不可恢复</span>
          <button type="button" class="btn btn-danger btn-sm" @click="confirmDeleteApp">删除应用…</button>
        </div>
      </div>
    </div>

    <!-- 对外接口弹层 -->
    <teleport to="body">
      <div v-if="showApi && publicBase" class="modal-back" @click.self="showApi = false">
        <div class="modal card modal-wide">
          <div class="modal-head">
            <h2>对外接口</h2>
            <button type="button" class="modal-x" @click="showApi = false">×</button>
          </div>
          <div class="modal-body">
            <p class="hint">旧版 Tauri / 脚本请继续使用 <code>latest.json</code>，行为不变。</p>
            <ShareLinkRow v-if="latestAppShortcutUrl" label="最新版本页（推荐）" :url="latestAppShortcutUrl" />
            <ShareLinkRow v-if="publishedVersionPageUrl" label="当前发布版本页" :url="publishedVersionPageUrl" />
            <p v-if="latestAppShortcutUrl" class="hint sm">
              <code>/app/{{ appName }}/latest</code> 会 302 到当前已发布目录；固定版本链接为 <code>/app/{{ appName }}/&lt;目录名&gt;</code>。版本页：<strong>点击文件名</strong>进入单文件说明页，右侧<strong>下载</strong>为直链；列表不展示 <code>.sig</code>。
            </p>
            <ShareLinkRow label="latest.json" :url="latestJsonUrl" />
            <ShareLinkRow label="JSON 摘要" :url="downloadInfoUrl" />
            <ShareLinkRow label="直链跳转" :url="downloadRedirectUrl" />
            <p class="hint sm">
              带 <code>?redirect=1</code> 时 302 到<strong>当前已发布</strong>主安装包直链（按磁盘 + BASE_URL）。<strong>Tauri</strong> 会排除 <code>.sig</code>，只选 exe/msi/dmg/AppImage 等本体。
            </p>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 编辑发布说明弹层 -->
    <teleport to="body">
      <div v-if="showPubNotes && published" class="modal-back" @click.self="showPubNotes = false">
        <div class="modal card">
          <div class="modal-head">
            <h2>编辑发布说明</h2>
            <button type="button" class="modal-x" @click="showPubNotes = false">×</button>
          </div>
          <div class="modal-body">
            <p class="hint sm">保存后直接写入 latest.json，无需重新发布。</p>
            <textarea v-model="publishedNotes" class="textarea" rows="6" placeholder="更新说明…" />
          </div>
          <div class="row">
            <button type="button" class="btn btn-ghost" @click="showPubNotes = false">取消</button>
            <button type="button" class="btn btn-primary" :disabled="savingPub" @click="savePublishedNotesModal">保存说明</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 新建版本弹层 -->
    <teleport to="body">
      <div v-if="showNewVer" class="modal-back" @click.self="showNewVer = false">
        <div class="modal card">
          <div class="modal-head">
            <h2>新建版本</h2>
            <button type="button" class="modal-x" @click="showNewVer = false">×</button>
          </div>
          <div class="modal-body">
            <p v-if="repoType === 'tauri'" class="hint sm">Tauri：须为 SemVer 2.0 三段式，如 v1.0.0</p>
            <p v-else class="hint sm">
              通用：目录名即版本标识（字母数字、点、下划线、连字符），如 <code>2.0.2</code>、<code>2024-01</code>、<code>1.0-beta</code>，不强制 <code>v</code> 前缀。
            </p>
            <input v-model="newVerInput" class="input" :placeholder="repoType === 'tauri' ? 'v1.0.0' : '例如 2.0.2 或 1.0-beta'" @keyup.enter="createVersion" />
            <p v-if="newVerErr" class="err">{{ newVerErr }}</p>
          </div>
          <div class="row">
            <button type="button" class="btn btn-ghost" @click="showNewVer = false">取消</button>
            <button type="button" class="btn btn-primary" :disabled="creatingVer" @click="createVersion">创建</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, uploadWithProgress } from '@/api/client';
import { useToast } from '@/composables/useToast';
import ShareLinkRow from '@/components/ShareLinkRow.vue';
import { joinReleaseArtifactUrl, suggestedPublicBaseFromVite } from '@/utils/public-url';

const route = useRoute();
const router = useRouter();
const { toast } = useToast();

const appName = computed(() => decodeURIComponent(route.params.name || ''));
const loading = ref(true);
const repoType = ref('general');
const displayNameEdit = ref('');
const descriptionEdit = ref('');
const savingPublicDisplay = ref(false);
const packageNameEdit = ref('');
const savingPackageName = ref(false);
const versions = ref([]);
const notesDraft = ref({});
const publicBase = ref('');
const published = ref(null);
const latestLoaded = ref(false);
const publishedNotes = ref('');
const publishedPubDate = ref('');
const publishedPlatformsJson = ref('{}');
const publishedFilesJson = ref('[]');
const savingPub = ref(false);
const savingPubDate = ref(false);
const savingPlatforms = ref(false);
const savingFiles = ref(false);
const refreshingUrls = ref(false);
const showNewVer = ref(false);
const newVerInput = ref('');
const newVerErr = ref('');
const creatingVer = ref(false);
const dragVer = ref(null);
const uploadProgress = ref({});
const fileInputs = ref({});

// 渐进披露：版本卡展开态、高级折叠态、弹层
const openVer = ref(null);
const advOpen = ref(false);
const infoOpen = ref(false);
const showApi = ref(false);
const showPubNotes = ref(false);

const displayLabel = computed(() => displayNameEdit.value.trim() || appName.value);

const publishedVersionDir = computed(() => versions.value.find(v => v.isLatest)?.version ?? null);

const publishedVersionPageUrl = computed(() => {
  if (!publicBase.value || !publishedVersionDir.value) return '';
  return `${publicBase.value}/app/${encodeURIComponent(appName.value)}/${encodeURIComponent(publishedVersionDir.value)}`;
});

const latestAppShortcutUrl = computed(() =>
  publicBase.value && appName.value ? `${publicBase.value}/app/${encodeURIComponent(appName.value)}/latest` : '',
);

const latestJsonUrl = computed(() => `${publicBase.value}/releases/${appName.value}/latest.json`);
const downloadInfoUrl = computed(
  () => `${publicBase.value}/api/public/${encodeURIComponent(appName.value)}/latest/download`,
);
const downloadRedirectUrl = computed(
  () =>
    `${publicBase.value}/api/public/${encodeURIComponent(appName.value)}/latest/download?redirect=1`,
);

function suggestedBase() {
  return suggestedPublicBaseFromVite();
}

function rewritePreviewUrls(preview, base) {
  const b = base.replace(/\/$/, '');
  if (!b || !preview.vdir) return;
  const vdir = preview.vdir;
  const app = appName.value;
  if (preview.platforms) {
    for (const p of Object.values(preview.platforms)) {
      if (p?.fileName) p.url = joinReleaseArtifactUrl(b, app, vdir, p.fileName);
    }
  }
  if (preview.files) {
    for (const f of preview.files) {
      if (f?.name) f.url = joinReleaseArtifactUrl(b, app, vdir, f.name);
    }
  }
}

function isSemVer2CoreWithVPrefix(v) {
  return /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v);
}

const GENERAL_VER_MAX = 120;
function normalizeGeneralVersionForClient(raw) {
  const s = String(raw || '').trim();
  if (!s) return { error: '请填写版本号' };
  if (s.length > GENERAL_VER_MAX) return { error: '版本目录名过长' };
  if (s.includes('..') || /[/\\]/.test(s)) return { error: '不可含路径字符或 ..' };
  if (!/^[a-zA-Z0-9._-]+$/.test(s)) return { error: '仅允许字母、数字、点、下划线、连字符' };
  return { ver: s };
}

function versionPageUrl(ver) {
  return `${publicBase.value}/app/${encodeURIComponent(appName.value)}/${encodeURIComponent(ver)}`;
}

function fileLandingUrl(ver, filename) {
  return `${publicBase.value}/d/${[appName.value, ver, filename].map(encodeURIComponent).join('/')}`;
}

function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function fmtDate(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isSig(name) {
  return /\.sig$/i.test(name);
}

// 折叠态展示：过滤占位文件
function realFiles(v) {
  return (v.files || []).filter(x => x.name !== '.gitkeep');
}

// 折叠态平台/文件概况 chips（按扩展名归类）
function versionChips(v) {
  const counts = { win: 0, mac: 0, linux: 0, other: 0 };
  for (const f of realFiles(v)) {
    if (isSig(f.name)) continue;
    const n = f.name.toLowerCase();
    if (/\.(exe|msi)$/.test(n)) counts.win += 1;
    else if (/\.(dmg|pkg)$/.test(n)) counts.mac += 1;
    else if (/\.(appimage|deb|rpm)$/.test(n)) counts.linux += 1;
    else counts.other += 1;
  }
  const out = [];
  if (counts.win) out.push(`win ×${counts.win}`);
  if (counts.mac) out.push(`mac ×${counts.mac}`);
  if (counts.linux) out.push(`linux ×${counts.linux}`);
  if (counts.other) out.push(`其他 ×${counts.other}`);
  return out;
}

function toggleVer(ver) {
  openVer.value = openVer.value === ver ? null : ver;
}

function setFileInput(ver, el) {
  if (el) fileInputs.value[ver] = el;
}

function triggerFile(ver) {
  fileInputs.value[ver]?.click();
}

async function loadMeta() {
  const m = await api('GET', `/api/apps/${encodeURIComponent(appName.value)}/meta`);
  repoType.value = m.repoType === 'tauri' ? 'tauri' : 'general';
  displayNameEdit.value = m.displayName != null ? String(m.displayName) : '';
  descriptionEdit.value = m.description != null ? String(m.description) : '';
}

async function savePublicDisplay() {
  if (descriptionEdit.value.length > 6000) {
    toast('软件简介过长（最多 6000 字）', 'error');
    return;
  }
  savingPublicDisplay.value = true;
  try {
    await api('PATCH', `/api/apps/${encodeURIComponent(appName.value)}/meta`, {
      displayName: displayNameEdit.value.trim(),
      description: descriptionEdit.value.trim(),
    });
    toast('已保存名称与简介');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingPublicDisplay.value = false;
  }
}

async function savePackageRename() {
  const next = packageNameEdit.value.trim();
  if (!next || !/^[a-zA-Z0-9_-]+$/.test(next)) {
    toast('包名只能包含字母、数字、下划线和连字符', 'error');
    return;
  }
  if (next === appName.value) return;
  if (
    !window.confirm(
      `将包名「${appName.value}」改为「${next}」：releases 目录、latest.json 内 URL、公开链接中的包名段都会变化，旧链接将失效。确定继续？`,
    )
  )
    return;
  savingPackageName.value = true;
  try {
    await api('POST', `/api/apps/${encodeURIComponent(appName.value)}/rename`, { newName: next });
    toast('已修改包名');
    await router.replace(`/app/${encodeURIComponent(next)}`);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingPackageName.value = false;
  }
}

async function loadSettingsBase() {
  try {
    const s = await api('GET', '/api/settings');
    publicBase.value = (s.baseUrl || '').replace(/\/$/, '') || suggestedBase();
  } catch {
    publicBase.value = suggestedBase();
  }
}

function syncPublishedEditors(d) {
  if (!d) {
    publishedPubDate.value = '';
    publishedPlatformsJson.value = '{}';
    publishedFilesJson.value = '[]';
    return;
  }
  publishedPubDate.value = d.pub_date || '';
  try {
    publishedPlatformsJson.value = JSON.stringify(d.platforms || {}, null, 2);
  } catch {
    publishedPlatformsJson.value = '{}';
  }
  try {
    publishedFilesJson.value = JSON.stringify(d.files || [], null, 2);
  } catch {
    publishedFilesJson.value = '[]';
  }
}

async function loadLatest() {
  latestLoaded.value = false;
  try {
    const d = await api('GET', `/api/apps/${encodeURIComponent(appName.value)}/latest`);
    published.value = d;
    publishedNotes.value = d.notes || '';
    syncPublishedEditors(d);
  } catch (e) {
    if (e.status === 404) {
      published.value = null;
      syncPublishedEditors(null);
    } else toast(e.message, 'error');
  } finally {
    latestLoaded.value = true;
  }
}

async function loadVersions() {
  const v = await api('GET', `/api/apps/${encodeURIComponent(appName.value)}/versions`);
  versions.value = v;
}

async function loadDrafts() {
  const r = await api('GET', `/api/apps/${encodeURIComponent(appName.value)}/notes-drafts`);
  notesDraft.value = { ...(r.drafts || {}) };
}

async function loadAll() {
  loading.value = true;
  try {
    await loadSettingsBase();
    await loadMeta();
    await loadVersions();
    await loadDrafts();
    await loadLatest();
  } catch (e) {
    toast(e.message, 'error');
    router.push('/');
  } finally {
    loading.value = false;
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制');
  } catch {
    toast('复制失败', 'error');
  }
}

async function saveDraft(ver) {
  const text = notesDraft.value[ver] ?? '';
  try {
    await api('PUT', `/api/apps/${encodeURIComponent(appName.value)}/versions/${encodeURIComponent(ver)}/notes`, {
      text,
    });
    toast('草稿已保存');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function savePublishedNotes() {
  savingPub.value = true;
  try {
    await api('PATCH', `/api/apps/${encodeURIComponent(appName.value)}/latest`, {
      notes: publishedNotes.value,
    });
    toast('已更新已发布说明');
    await loadLatest();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingPub.value = false;
  }
}

async function savePublishedNotesModal() {
  await savePublishedNotes();
  if (!savingPub.value) showPubNotes.value = false;
}

async function savePublishedPubDate() {
  savingPubDate.value = true;
  try {
    await api('PATCH', `/api/apps/${encodeURIComponent(appName.value)}/latest`, {
      pub_date: publishedPubDate.value.trim() || '',
    });
    toast('已更新 pub_date');
    await loadLatest();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingPubDate.value = false;
  }
}

async function savePublishedPlatforms() {
  let parsed;
  try {
    parsed = JSON.parse(publishedPlatformsJson.value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('须为 JSON 对象');
  } catch (e) {
    toast(e.message || 'JSON 无效', 'error');
    return;
  }
  savingPlatforms.value = true;
  try {
    await api('PATCH', `/api/apps/${encodeURIComponent(appName.value)}/latest`, { platforms: parsed });
    toast('已更新 platforms');
    await loadLatest();
    await loadVersions();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingPlatforms.value = false;
  }
}

async function savePublishedFiles() {
  let parsed;
  try {
    parsed = JSON.parse(publishedFilesJson.value || '[]');
    if (!Array.isArray(parsed)) throw new Error('须为 JSON 数组');
  } catch (e) {
    toast(e.message || 'JSON 无效', 'error');
    return;
  }
  savingFiles.value = true;
  try {
    await api('PATCH', `/api/apps/${encodeURIComponent(appName.value)}/latest`, { files: parsed });
    toast('已更新 files');
    await loadLatest();
    await loadVersions();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingFiles.value = false;
  }
}

async function refreshPublishedUrls() {
  refreshingUrls.value = true;
  try {
    await api('POST', `/api/apps/${encodeURIComponent(appName.value)}/latest/refresh-urls`, { mode: 'merge' });
    toast('已合并刷新下载链接');
    await loadLatest();
    await loadVersions();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    refreshingUrls.value = false;
  }
}

async function refreshPublishedUrlsReplace() {
  if (!window.confirm('将仅用磁盘扫描结果覆盖 platforms 或 files，手工条目可能丢失。确定？')) return;
  refreshingUrls.value = true;
  try {
    await api('POST', `/api/apps/${encodeURIComponent(appName.value)}/latest/refresh-urls`, { mode: 'replace' });
    toast('已从磁盘完全重建发布条目');
    await loadLatest();
    await loadVersions();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    refreshingUrls.value = false;
  }
}

async function runPublish(ver, { allowMissingSig = false } = {}) {
  await saveDraft(ver);
  let preview = await api(
    'GET',
    `/api/apps/${encodeURIComponent(appName.value)}/versions/${encodeURIComponent(ver)}/preview-release`,
  );
  const k = notesDraft.value[ver] ?? '';
  preview = { ...preview, notes: k };
  rewritePreviewUrls(preview, publicBase.value);

  if (repoType.value === 'tauri') {
    const miss = Object.entries(preview.platforms || {}).filter(([, p]) =>
      String(p.signature || '').includes('未找到'),
    );
    if (miss.length && !allowMissingSig) {
      const ok = window.confirm(`缺少 .sig：${miss.map(([x]) => x).join(', ')}。仍要发布？`);
      if (!ok) return;
    }
  }

  await api('POST', `/api/apps/${encodeURIComponent(appName.value)}/publish`, preview);
  toast(`✓ ${ver} 已发布`);
  await loadVersions();
  await loadLatest();
  await loadDrafts();
}

function quickPublish(ver) {
  runPublish(ver).catch(e => toast(e.message, 'error'));
}
function republish(ver) {
  runPublish(ver).catch(e => toast(e.message, 'error'));
}

async function deleteFile(ver, name) {
  try {
    await api(
      'DELETE',
      `/api/apps/${encodeURIComponent(appName.value)}/versions/${encodeURIComponent(ver)}/files/${encodeURIComponent(name)}`,
    );
    toast(`已删除 ${name}`);
    await loadVersions();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function confirmDeleteVersion(ver) {
  if (
    !window.confirm(
      `删除版本「${ver}」将永久移除该目录下全部文件；若当前已发布指向此版本，latest.json 会被清空。不可恢复，确定继续？`,
    )
  )
    return;
  api('DELETE', `/api/apps/${encodeURIComponent(appName.value)}/versions/${encodeURIComponent(ver)}`)
    .then(async () => {
      toast(`版本 ${ver} 已删除`);
      delete notesDraft.value[ver];
      await loadVersions();
      await loadLatest();
    })
    .catch(e => toast(e.message, 'error'));
}

function confirmDeleteApp() {
  if (
    !window.confirm(
      `将删除应用「${displayLabel.value}」（包名 ${appName.value}）及 releases 下全部版本、latest.json、草稿与元数据。不可恢复，确定继续？`,
    )
  )
    return;
  api('DELETE', `/api/apps/${encodeURIComponent(appName.value)}`)
    .then(() => {
      toast('已删除');
      router.push('/');
    })
    .catch(e => toast(e.message, 'error'));
}

async function onFileChange(ver, ev) {
  const files = ev.target.files;
  if (files?.length) await doUpload(ver, files);
  ev.target.value = '';
}

async function onDrop(ev, ver) {
  dragVer.value = null;
  const files = ev.dataTransfer?.files;
  if (files?.length) await doUpload(ver, files);
}

async function doUpload(ver, files) {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  uploadProgress.value = { ...uploadProgress.value, [ver]: 0 };
  try {
    await uploadWithProgress({
      method: 'POST',
      path: `/api/apps/${encodeURIComponent(appName.value)}/versions/${encodeURIComponent(ver)}/upload`,
      formData: fd,
      onProgress: pct => {
        uploadProgress.value = { ...uploadProgress.value, [ver]: pct < 0 ? -1 : pct };
      },
    });
    toast('上传完成');
    await loadVersions();
  } catch (e) {
    toast(e.message || '上传失败', 'error');
  } finally {
    const next = { ...uploadProgress.value };
    delete next[ver];
    uploadProgress.value = next;
  }
}

async function createVersion() {
  newVerErr.value = '';
  let ver = newVerInput.value.trim();
  if (!ver) return;
  if (repoType.value === 'tauri') {
    if (!ver.startsWith('v')) ver = `v${ver}`;
    if (!isSemVer2CoreWithVPrefix(ver)) {
      newVerErr.value = '须为 SemVer 2.0 三段式，如 v1.0.0';
      return;
    }
  } else {
    const r = normalizeGeneralVersionForClient(ver);
    if (r.error) {
      newVerErr.value = r.error;
      return;
    }
    ver = r.ver;
  }
  creatingVer.value = true;
  try {
    const fd = new FormData();
    fd.append('files', new File([''], '.gitkeep'));
    await uploadWithProgress({
      method: 'POST',
      path: `/api/apps/${encodeURIComponent(appName.value)}/versions/${encodeURIComponent(ver)}/upload`,
      formData: fd,
      onProgress: () => {},
    });
    toast(`版本 ${ver} 已创建`);
    showNewVer.value = false;
    newVerInput.value = '';
    await loadVersions();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    creatingVer.value = false;
  }
}

watch(
  () => route.params.name,
  () => {
    packageNameEdit.value = appName.value;
    openVer.value = null;
    loadAll();
  },
  { immediate: true },
);
</script>

<style scoped>
/* 顶栏标题里的 chip 与系统字体对齐 */
.ab-titles h1 {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* hero 发布说明摘要 */
.pub-notes {
  margin-top: 11px;
  font-size: 0.8rem;
  color: var(--text2);
  line-height: 1.5;
  white-space: pre-wrap;
  max-width: 640px;
}
.empty-pub {
  align-items: flex-start;
}
.muted-label {
  color: var(--text3);
}
.muted-label::before {
  background: var(--text3);
  box-shadow: none;
}
.pub-empty-text {
  font-size: 0.85rem;
  color: var(--text2);
  margin-top: 4px;
}

.muted {
  color: var(--text2);
  font-size: 0.85rem;
}
.empty-v {
  padding: 18px 0;
}

/* 版本卡内：草稿与无进度提示 */
.hidden-input {
  display: none;
}
.dropmini.drag {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-tint);
}
.draft-actions {
  margin-top: 8px;
}
.prog-indet {
  margin-top: 10px;
  font-size: 0.74rem;
  color: var(--text3);
}

/* 高级区分组 */
.adv-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.adv-group .row-input {
  margin: 0;
}
.sub-label {
  display: block;
  font-size: 0.72rem;
  color: var(--text2);
  margin-top: 4px;
}
.adv-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}
.adv-hint {
  margin: 2px 0 0;
  font-size: 0.72rem;
  color: var(--text3);
  line-height: 1.5;
}

/* 弹层 */
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
  max-width: 440px;
  padding: 22px;
}
.modal-wide {
  max-width: 620px;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.modal-head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
}
.modal-x {
  border: none;
  background: transparent;
  color: var(--text3);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-xs);
}
.modal-x:hover {
  color: var(--text);
  background: var(--surface2);
}
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.hint {
  margin: 0 0 12px;
  font-size: 0.82rem;
  color: var(--text2);
  line-height: 1.55;
}
.hint.sm {
  font-size: 0.74rem;
  margin: 8px 0 0;
}
.err {
  color: var(--danger);
  font-size: 0.82rem;
  margin: 8px 0 0;
}
code {
  background: var(--inset);
  padding: 1px 5px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.85em;
}

/* 危险按钮（global.css 未定义，页面内补充，遵循 morii 危险色） */
.btn-danger {
  background: var(--danger-tint);
  color: var(--danger-text);
  border: 1px solid transparent;
}
.btn-danger:hover:not(:disabled) {
  border-color: var(--danger);
  color: var(--danger);
}
</style>
