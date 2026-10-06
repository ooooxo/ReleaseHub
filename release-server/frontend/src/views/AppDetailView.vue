<template>
  <div class="app-detail">
    <!-- 背景液体：这个应用自己的那一幅（与入口页、总览同一个库） -->
    <LiquidBackdrop :entry="bgEntry" />

    <div class="ix-wrap">
      <!-- 左：应用名大字 + 版本索引 + 设置索引 -->
      <nav class="ix-idx" aria-label="版本与设置">
        <RouterLink to="/" class="ix-crumb">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          总览
        </RouterLink>
        <div class="ix-chips">
          <span class="chip" :class="repoType === 'tauri' ? 'tauri' : 'general'">{{ repoType === 'tauri' ? 'Tauri' : '通用' }}</span>
          <span class="chip num">{{ published?.version || '尚未发布' }}</span>
          <span class="chip">{{ versions.length }} 个版本</span>
        </div>
        <h1 class="ix-title">{{ displayLabel }}</h1>
        <span class="ix-sub">{{ appName }}</span>
        <div class="ix-acts">
        <Layer v-model:open="showNewVer" :guard="!!newVerInput.trim()">
          <template #trigger="{ toggle }">
            <button type="button" class="btn btn-primary btn-sm" :aria-expanded="showNewVer" @click="toggle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
              新建版本
            </button>
          </template>
          <form class="lform" @submit.prevent="createVersion">
            <p class="l-title">新建版本</p>
            <p v-if="repoType === 'tauri'" class="hint sm">须为 SemVer 2.0 三段式，如 v1.0.0</p>
            <p v-else class="hint sm">目录名即版本标识（字母数字、点、下划线、连字符），如 <code>2.0.2</code>、<code>1.0-beta</code></p>
            <input v-model="newVerInput" class="input" :placeholder="repoType === 'tauri' ? 'v1.0.0' : '例如 2.0.2'" autofocus />
            <p v-if="newVerErr" class="err">{{ newVerErr }}</p>
            <div class="row">
              <button type="button" class="btn btn-ghost btn-sm" @click="closeNewVer">取消</button>
              <button type="submit" class="btn btn-primary btn-sm" :disabled="creatingVer">创建</button>
            </div>
          </form>
        </Layer>
          <button v-if="latestAppShortcutUrl" type="button" class="btn btn-ghost btn-sm" @click="copy(latestAppShortcutUrl)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
            复制最新版本页
          </button>
        </div>

        <div class="ix-grp">版本</div>
        <p v-if="loading" class="muted">加载中…</p>
        <p v-else-if="!versions.length" class="muted">还没有任何版本，点「新建版本」开始。</p>
        <button
          v-for="v in versions"
          :key="v.version"
          type="button"
          class="ix-it sm"
          :class="{ on: openVer === v.version }"
          @click="selectVer(v.version)"
        >
          <b class="num">{{ v.version }}</b>
          <span><em v-if="v.isLatest" class="lt">当前</em>{{ realFiles(v).length }} 个文件</span>
        </button>

        <div class="ix-grp">设置</div>
        <button type="button" class="ix-it sm" :class="{ on: infoOpen }" @click="selectPane('info')">
          <b>基本信息</b><span>包名 · 展示名 · 简介 · 对外接口</span>
        </button>
        <button type="button" class="ix-it sm" :class="{ on: advOpen }" @click="selectPane('adv')">
          <b>高级 / 危险</b><span>{{ jsonField }} JSON · 重建 · 删除应用</span>
        </button>
      </nav>

      <!-- 右：选中项的内容（版本的展开态 / 基本信息 / 高级）；什么都没选时是当前发布 -->
      <aside class="ix-pane">
        <section v-if="openV" :key="openV.version" class="ix-sec" @keydown.esc="selectPane(null)">
          <div class="ix-chips">
            <span v-if="openV.isLatest" class="latest">当前发布</span>
            <span v-else class="chip">未发布</span>
            <span class="chip">{{ realFiles(openV).length }} 个文件</span>
          </div>
          <h2 class="num">{{ openV.version }}</h2>
        <!-- 说明：已发布版本改的是线上更新清单，其余是说明草稿 -->
        <div>
          <span class="field-label">{{ openV.isLatest ? '更新说明（线上，已安装客户端下一次检查即可见）' : '说明草稿（发布时写入更新清单）' }}</span>
          <textarea v-model="verEdit.model.notes" class="textarea" rows="3" placeholder="更新说明…" />
        </div>

        <!-- 上传投放区：交给上传托盘 -->
        <div
          class="dropmini"
          :class="{ drag: dragVer === openV.version }"
          role="button"
          tabindex="0"
          @dragover.prevent="dragVer = openV.version"
          @dragleave="e => !e.currentTarget.contains(e.relatedTarget) && (dragVer = null)"
          @drop.prevent="onDrop($event, openV.version)"
          @click="fileInputs[openV.version]?.click()"
          @keydown.enter.self.prevent="fileInputs[openV.version]?.click()"
        >
          <input
            :ref="el => el && (fileInputs[openV.version] = el)"
            type="file"
            multiple
            class="hidden-input"
            @click.stop
            @change="onFileChange(openV.version, $event)"
          />
          <b>{{ repoType === 'tauri' ? '拖各平台包及对应 .sig 到此' : '拖文件到此处' }}</b>
          或点击选文件
        </div>

        <!-- 文件列表 -->
        <div v-if="realFiles(openV).length">
          <span class="field-label">文件 · {{ realFiles(openV).length }}</span>
          <TransitionGroup name="slide-up" tag="div" class="filelist">
            <div v-for="f in realFiles(openV)" :key="f.name" class="frow">
              <span class="fi" :class="{ sig: isSig(f.name) }">
                <svg v-if="isSig(f.name)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 6v6c0 5 3.4 8 8 10 4.6-2 8-5 8-10V6z" /></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              </span>
              <a class="fname" :href="fileLandingUrl(openV.version, f.name)" target="_blank" rel="noopener">{{ f.name }}</a>
              <span class="fsize">{{ formatBytes(f.size) }}</span>
              <TwoStepButton
                label="×"
                armed-label="再按删除"
                :aria-label="`删除 ${f.name}`"
                btn-class="fdel"
                :busy="deletingFile === `${openV.version}/${f.name}`"
                @confirm="deleteFile(openV.version, f.name)"
              />
            </div>
          </TransitionGroup>
        </div>

        <!-- 缺 .sig 时就地拦一下，写清缺了哪些 -->
        <div v-if="sigWarn && sigWarn.ver === openV.version" class="danger-zone">
          <span class="dz-t"><b>缺少 .sig：{{ sigWarn.miss.join('、') }}</b> — 这些平台的客户端将无法校验更新</span>
          <div class="vactions">
            <button type="button" class="btn btn-ghost btn-sm" @click="sigWarn = null">取消</button>
            <button type="button" class="btn btn-danger btn-sm" :disabled="publishing" @click="publishVersion(openV.version, true)">仍要发布</button>
          </div>
        </div>

        <!-- 版本操作 -->
        <div class="vactions">
          <button type="button" class="btn btn-sm" :class="openV.isLatest ? 'btn-ghost' : 'btn-primary'" :disabled="publishing" @click="publishVersion(openV.version)">
            {{ (verEdit.dirty ? '保存并' : '') + (openV.isLatest ? '重新发布' : '设为最新发布') }}
          </button>
          <button v-if="publicBase" type="button" class="btn btn-ghost btn-sm" @click="copy(versionPageUrl(openV.version))">复制版本页</button>
          <ConfirmButton
            v-if="openV.isLatest"
            label="删除此版本"
            :title="`删除当前发布的 ${openV.version}？`"
            detail="目录下全部文件永久删除，更新清单随之清空——已安装客户端将查不到更新。"
            confirm-label="删除"
            danger
            align="start"
            btn-class="btn btn-danger btn-sm"
            @confirm="deleteVersion(openV.version)"
          />
          <TwoStepButton v-else label="删除此版本" armed-label="再按删除" btn-class="btn btn-danger btn-sm" @confirm="deleteVersion(openV.version)" />
        </div>
        <SaveBar
          ref="verBar"
          :dirty="verEdit.dirty"
          :busy="savingNotes"
          :save-label="openV.isLatest ? '保存并更新线上' : '保存'"
          @save="saveVersionNotes"
          @discard="verEdit.discard()"
        />
        </section>

        <section v-else-if="infoOpen" class="ix-sec">
          <h2>基本信息</h2>
        <div class="adv-group">
          <label class="sub-label">包名（目录与 URL；修改后 latest.json、直链与公开页路径全部变为新包名）</label>
          <div class="row-input">
            <input v-model="packageNameEdit" class="input code" spellcheck="false" :placeholder="appName" />
            <ConfirmButton
              label="改包名"
              :title="`包名改为「${packageNameEdit.trim()}」？`"
              detail="releases 目录、更新清单内的 URL、公开链接中的包名段都会变化，已安装客户端按旧地址检查更新将失效。"
              confirm-label="改包名"
              danger
              :busy="savingPackageName || !packageChanged"
              btn-class="btn btn-primary btn-sm"
              @confirm="savePackageRename"
            />
          </div>
          <label class="sub-label">软件名（对外展示；留空则仅显示包名）</label>
          <input v-model="metaEdit.model.displayName" class="input" :placeholder="appName" />
          <label class="sub-label">软件简介（可选，显示在对外版本页；不展示包名）</label>
          <textarea v-model="metaEdit.model.description" class="textarea" rows="4" placeholder="一句话或简短介绍，支持换行" />
          <SaveBar ref="metaBar" :dirty="metaEdit.dirty" :busy="savingMeta" @save="saveMeta" @discard="metaEdit.discard()" />
        </div>

        <div v-if="publicBase" class="adv-group">
          <span class="field-label">对外接口</span>
          <p class="hint sm">旧版 Tauri / 脚本继续用 <code>latest.json</code>，行为不变。</p>
          <ShareLinkRow v-if="latestAppShortcutUrl" label="最新版本页（推荐）" :url="latestAppShortcutUrl" />
          <ShareLinkRow v-if="publishedVersionPageUrl" label="当前发布版本页" :url="publishedVersionPageUrl" />
          <ShareLinkRow label="latest.json" :url="latestJsonUrl" />
          <ShareLinkRow label="JSON 摘要" :url="downloadInfoUrl" />
          <ShareLinkRow label="直链跳转" :url="downloadRedirectUrl" />
          <p class="hint sm">
            <code>/app/{{ appName }}/latest</code> 302 到当前已发布目录；带 <code>?redirect=1</code> 的直链跳转到当前发布的主安装包（Tauri 排除 <code>.sig</code>）。
          </p>
        </div>
        </section>

        <section v-else-if="advOpen" class="ix-sec">
          <h2>高级 / 危险</h2>
        <template v-if="latestLoaded && published">
          <div class="adv-group">
            <span class="field-label">发布时间 pub_date（ISO 字符串，可选）</span>
            <input v-model="advEdit.model.pub_date" class="input code" placeholder="2025-01-01T12:00:00.000Z" />
          </div>
          <div class="adv-group">
            <span class="field-label">已发布 {{ jsonField }}（JSON，高级）</span>
            <textarea v-model="advEdit.model[jsonField]" class="textarea code-ta" rows="12" spellcheck="false" />
          </div>
          <SaveBar
            ref="advBar"
            :dirty="advEdit.dirty"
            :busy="savingAdv"
            save-label="保存并更新线上"
            confirm-title="直接改写线上更新清单？"
            :confirm-detail="`手改的 ${jsonField} 一旦写错，所有已安装客户端的自动更新都会失败。`"
            @save="saveAdvanced"
            @discard="advEdit.discard()"
          />

          <div class="adv-group">
            <span class="field-label">下载链接维护</span>
            <div class="adv-btns">
              <button type="button" class="btn btn-ghost btn-sm" :disabled="refreshingUrls" @click="refreshPublishedUrls('merge')">刷新下载链接（合并磁盘）</button>
            </div>
            <p class="adv-hint">合并：只更新磁盘上能匹配到的文件的 URL / 签名，保留手工平台或条目。</p>
          </div>

          <div class="danger-zone">
            <span class="dz-t"><b>从磁盘完全重建</b> — 仅用磁盘扫描结果覆盖 {{ jsonField }}，可能丢失手工数据</span>
            <ConfirmButton
              label="完全重建"
              title="用磁盘扫描结果覆盖更新清单？"
              :detail="`手工维护的 ${jsonField} 条目会丢失。`"
              confirm-label="重建"
              danger
              :busy="refreshingUrls"
              btn-class="btn btn-danger btn-sm"
              @confirm="refreshPublishedUrls('replace')"
            />
          </div>
        </template>

        <div class="danger-zone">
          <span class="dz-t"><b>删除应用</b> — 移除该应用及全部版本、更新清单、说明草稿与元数据，不可恢复</span>
          <ConfirmButton
            label="删除应用"
            :title="`删除应用「${displayLabel}」？`"
            :detail="`包名 ${appName} 下 ${versions.length} 个版本全部删除，已安装客户端将查不到更新。不可恢复。`"
            confirm-label="删除"
            danger
            btn-class="btn btn-danger btn-sm"
            @confirm="deleteApp"
          />
        </div>
        </section>

        <section v-else-if="latestLoaded && published" class="ix-sec">
          <span class="pub-label">当前发布</span>
          <!-- 发布成功的结果时刻：换了版本号才弹一下，首屏不动 -->
          <Transition name="ver-swap" mode="out-in">
            <h2 :key="published.version" class="num">{{ published.version }}</h2>
          </Transition>
          <div class="pub-meta">
            <template v-if="published.pub_date">发布于 {{ fmtDate(published.pub_date) }} · </template>{{ versions.length }} 个历史版本
          </div>
          <div v-if="published.notes" class="pub-notes">{{ published.notes }}</div>
          <div class="vactions">
            <button v-if="publishedVersionDir" type="button" class="btn btn-ghost" @click="editPublishedNotes">编辑发布说明</button>
            <button v-if="publishedVersionDir" type="button" class="btn btn-ghost" @click="selectVer(publishedVersionDir)">管理这个版本的文件</button>
          </div>
        </section>
        <section v-else-if="latestLoaded" class="ix-sec">
          <span class="pub-label muted-label">尚未发布</span>
          <h2>还没有发布</h2>
          <p class="pub-empty-text">在左侧选一个版本，上传文件后点「设为最新发布」。</p>
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
import { api, uploadWithProgress, uploadAppVersion } from '@/api/client';
import { useToast } from '@/composables/useToast';
import { useUnsaved } from '@/composables/useUnsaved';
import { useUploads } from '@/stores/uploads';
import { ingestFromDataTransfer, describeUploadBatch } from '@/composables/useFolderUpload';
import ShareLinkRow from '@/components/ShareLinkRow.vue';
import Layer from '@/components/ui/Layer.vue';
import SaveBar from '@/components/ui/SaveBar.vue';
import ConfirmButton from '@/components/ui/ConfirmButton.vue';
import TwoStepButton from '@/components/ui/TwoStepButton.vue';
import { copyText } from '@/utils/copy-text';
import { formatBytes } from '@/utils/format-bytes';
import { joinReleaseArtifactUrl } from '@/utils/public-url';
import { usePublicBase } from '@/composables/usePublicBase';

const route = useRoute();
const router = useRouter();
const { toast } = useToast();
const uploads = useUploads();

const appName = computed(() => decodeURIComponent(route.params.name || ''));
const loading = ref(true);
const repoType = ref('general');
const meta = ref({ displayName: '', description: '' });
const savingMeta = ref(false);
const packageNameEdit = ref('');
const savingPackageName = ref(false);
const versions = ref([]);
const notesDraft = ref({});
const { publicBase, loadPublicBase } = usePublicBase();
const published = ref(null);
const latestLoaded = ref(false);
const savingNotes = ref(false);
const savingAdv = ref(false);
const refreshingUrls = ref(false);
const showNewVer = ref(false);
const newVerInput = ref('');
const newVerErr = ref('');
const creatingVer = ref(false);
const dragVer = ref(null);
const fileInputs = {};
const deletingFile = ref('');
const publishing = ref(false);
const sigWarn = ref(null);

// 右侧同时只摆一样：某个版本 / 基本信息 / 高级；都没选时是当前发布
const openVer = ref(null);
const advOpen = ref(false);
const infoOpen = ref(false);
const metaBar = ref(null);
const advBar = ref(null);
const verBar = ref(null);

const jsonField = computed(() => (repoType.value === 'tauri' ? 'platforms' : 'files'));
const displayLabel = computed(() => meta.value.displayName?.trim() || appName.value);
// 背景液体：与入口页、总览里这个应用的那一幅同源
const bgEntry = computed(() =>
  liquidEntry({ kind: 'app', name: appName.value, displayLabel: displayLabel.value, description: meta.value.description }),
);
const packageChanged = computed(() => !!packageNameEdit.value.trim() && packageNameEdit.value.trim() !== appName.value);

/* ── 未存改动：三处各一份，都叠在已存数据之上 ── */
const metaEdit = useUnsaved(() => meta.value, {
  onBlocked: () => {
    showPane('info');
    nextTick(() => metaBar.value?.nudge());
  },
});
const openV = computed(() => versions.value.find(v => v.version === openVer.value) || null);
/* 已发布版本的说明就是线上那份；其余版本是说明草稿 */
function savedNotes(v) {
  if (v.isLatest && published.value) return published.value.notes || '';
  return notesDraft.value[v.version] || '';
}
const verEdit = useUnsaved(() => (openV.value ? { notes: savedNotes(openV.value) } : null), {
  onBlocked: () => verBar.value?.nudge(),
});
const advSaved = computed(() =>
  published.value
    ? {
        pub_date: published.value.pub_date || '',
        platforms: JSON.stringify(published.value.platforms || {}, null, 2),
        files: JSON.stringify(published.value.files || [], null, 2),
      }
    : null,
);
const advEdit = useUnsaved(() => advSaved.value, {
  onBlocked: () => {
    showPane('adv');
    nextTick(() => advBar.value?.nudge());
  },
});

const publishedVersionDir = computed(() => versions.value.find(v => v.isLatest)?.version ?? null);
const publishedVersionPageUrl = computed(() => {
  if (!publicBase.value || !publishedVersionDir.value) return '';
  return `${publicBase.value}/app/${encodeURIComponent(appName.value)}/${encodeURIComponent(publishedVersionDir.value)}`;
});
const latestAppShortcutUrl = computed(() =>
  publicBase.value && appName.value ? `${publicBase.value}/app/${encodeURIComponent(appName.value)}/latest` : '',
);
const latestJsonUrl = computed(() => `${publicBase.value}/releases/${appName.value}/latest.json`);
const downloadInfoUrl = computed(() => `${publicBase.value}/api/public/${encodeURIComponent(appName.value)}/latest/download`);
const downloadRedirectUrl = computed(() => `${downloadInfoUrl.value}?redirect=1`);

function rewritePreviewUrls(preview, base) {
  const b = base.replace(/\/$/, '');
  if (!b || !preview.vdir) return;
  for (const p of Object.values(preview.platforms || {})) {
    if (p?.fileName) p.url = joinReleaseArtifactUrl(b, appName.value, preview.vdir, p.fileName);
  }
  for (const f of preview.files || []) {
    if (f?.name) f.url = joinReleaseArtifactUrl(b, appName.value, preview.vdir, f.name);
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

/* 右侧换内容前：当前那份有未存改动就不换，抖一下它的保存条（同一页只有一份展开态） */
function canLeavePane() {
  if (openVer.value && verEdit.dirty) {
    verBar.value?.nudge();
    return false;
  }
  if (infoOpen.value && metaEdit.dirty) {
    metaBar.value?.nudge();
    return false;
  }
  if (advOpen.value && advEdit.dirty) {
    advBar.value?.nudge();
    return false;
  }
  return true;
}
function showPane(name, ver = null) {
  sigWarn.value = null;
  openVer.value = name === 'ver' ? ver : null;
  infoOpen.value = name === 'info';
  advOpen.value = name === 'adv';
}
/* 手机上右侧排在索引下面：选中后滚到内容处，不然点了看不出变化 */
const narrow = matchMedia('(max-width: 760px)');
function revealPane() {
  if (narrow.matches) nextTick(() => document.querySelector('.ix-pane')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
/** 再点一次已选中的那项 = 收起回到「当前发布」 */
function selectPane(name) {
  const same = (name === 'info' && infoOpen.value) || (name === 'adv' && advOpen.value);
  if (!canLeavePane()) return;
  showPane(same ? null : name);
  revealPane();
}
function selectVer(ver) {
  if (!canLeavePane()) return;
  showPane(openVer.value === ver ? null : 'ver', ver);
  revealPane();
}
async function editPublishedNotes() {
  if (openVer.value !== publishedVersionDir.value) selectVer(publishedVersionDir.value);
  if (openVer.value !== publishedVersionDir.value) return;
  await nextTick();
  document.querySelector('.ix-pane textarea')?.focus();
}

async function loadMeta() {
  const m = await api('GET', `/api/apps/${encodeURIComponent(appName.value)}/meta`);
  repoType.value = m.repoType === 'tauri' ? 'tauri' : 'general';
  meta.value = { displayName: m.displayName || '', description: m.description || '' };
}

async function saveMeta() {
  const v = metaEdit.values();
  if (v.description.length > 6000) {
    toast('软件简介过长（最多 6000 字）', 'error');
    return;
  }
  savingMeta.value = true;
  try {
    const next = { displayName: v.displayName.trim(), description: v.description.trim() };
    await api('PATCH', `/api/apps/${encodeURIComponent(appName.value)}/meta`, next);
    meta.value = next;
    metaEdit.discard();
    toast('已保存名称与简介');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingMeta.value = false;
  }
}

async function savePackageRename() {
  const next = packageNameEdit.value.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(next)) {
    toast('包名只能包含字母、数字、下划线和连字符', 'error');
    return;
  }
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

/* 只在首次加载时标「未载入」：之后的刷新原地换数据，不让发布区闪没 */
async function loadLatest() {
  try {
    published.value = await api('GET', `/api/apps/${encodeURIComponent(appName.value)}/latest`);
  } catch (e) {
    if (e.status === 404) published.value = null;
    else toast(e.message, 'error');
  } finally {
    latestLoaded.value = true;
  }
}
async function loadVersions() {
  versions.value = await api('GET', `/api/apps/${encodeURIComponent(appName.value)}/versions`);
}
async function loadDrafts() {
  const r = await api('GET', `/api/apps/${encodeURIComponent(appName.value)}/notes-drafts`);
  notesDraft.value = { ...(r.drafts || {}) };
}

async function loadAll() {
  loading.value = true;
  latestLoaded.value = false;
  try {
    await loadPublicBase();
    await loadMeta();
    await loadVersions();
    await loadDrafts();
    await loadLatest();
  } catch (e) {
    if (e.status === 401) return;
    toast(e.message, 'error');
    router.push('/');
  } finally {
    loading.value = false;
  }
}

async function copy(text) {
  try {
    await copyText(text);
    toast('已复制');
  } catch {
    toast('复制失败', 'error');
  }
}

function notesUrl(ver) {
  return `/api/apps/${encodeURIComponent(appName.value)}/versions/${encodeURIComponent(ver)}/notes`;
}

/* 已发布版本：改线上更新清单并同步说明草稿（重新发布时不会被旧草稿覆盖回去）；其余版本只写说明草稿 */
async function saveVersionNotes() {
  const v = openV.value;
  const text = verEdit.values().notes;
  savingNotes.value = true;
  try {
    if (v.isLatest && published.value) {
      await api('PATCH', `/api/apps/${encodeURIComponent(appName.value)}/latest`, { notes: text });
      published.value = { ...published.value, notes: text };
    }
    await api('PUT', notesUrl(v.version), { text });
    notesDraft.value = { ...notesDraft.value, [v.version]: text };
    verEdit.discard();
    toast(v.isLatest ? '已更新线上说明' : '说明草稿已保存');
    return true;
  } catch (e) {
    toast(e.message, 'error');
    return false;
  } finally {
    savingNotes.value = false;
  }
}

async function saveAdvanced() {
  const v = advEdit.values();
  let parsed;
  try {
    parsed = JSON.parse(v[jsonField.value] || (jsonField.value === 'files' ? '[]' : '{}'));
    if (jsonField.value === 'files' && !Array.isArray(parsed)) throw new Error('files 须为 JSON 数组');
    if (jsonField.value === 'platforms' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
      throw new Error('platforms 须为 JSON 对象');
    }
  } catch (e) {
    toast(e.message || 'JSON 无效', 'error');
    return;
  }
  savingAdv.value = true;
  try {
    await api('PATCH', `/api/apps/${encodeURIComponent(appName.value)}/latest`, {
      pub_date: v.pub_date.trim(),
      [jsonField.value]: parsed,
    });
    advEdit.discard();
    toast('已更新线上更新清单');
    await loadLatest();
    await loadVersions();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingAdv.value = false;
  }
}

async function refreshPublishedUrls(mode) {
  if (advEdit.dirty) {
    advBar.value?.nudge();
    return;
  }
  refreshingUrls.value = true;
  try {
    await api('POST', `/api/apps/${encodeURIComponent(appName.value)}/latest/refresh-urls`, { mode });
    toast(mode === 'replace' ? '已从磁盘完全重建发布条目' : '已合并刷新下载链接');
    await loadLatest();
    await loadVersions();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    refreshingUrls.value = false;
  }
}

/* 有未存改动时「发布」= 保存并发布（按钮文案同步写明），不静默代存 */
async function publishVersion(ver, allowMissingSig = false) {
  if (publishing.value) return;
  publishing.value = true;
  try {
    if (verEdit.dirty && openVer.value === ver && !(await saveVersionNotes())) return;
    const preview = await api('GET', `/api/apps/${encodeURIComponent(appName.value)}/versions/${encodeURIComponent(ver)}/preview-release`);
    // 发出去的就是屏上那份：已发布版本取线上说明，其余取说明草稿（旧数据里二者可能不一致）
    preview.notes = savedNotes(versions.value.find(x => x.version === ver));
    rewritePreviewUrls(preview, publicBase.value);
    if (repoType.value === 'tauri' && !allowMissingSig) {
      const miss = Object.entries(preview.platforms || {})
        .filter(([, p]) => String(p.signature || '').includes('未找到'))
        .map(([k]) => k);
      if (miss.length) {
        sigWarn.value = { ver, miss };
        return;
      }
    }
    await api('POST', `/api/apps/${encodeURIComponent(appName.value)}/publish`, preview);
    sigWarn.value = null;
    toast(`✓ ${ver} 已发布`);
    await loadVersions();
    await loadLatest();
    await loadDrafts();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    publishing.value = false;
  }
}

async function deleteFile(ver, name) {
  deletingFile.value = `${ver}/${name}`;
  try {
    await api('DELETE', `/api/apps/${encodeURIComponent(appName.value)}/versions/${encodeURIComponent(ver)}/files/${encodeURIComponent(name)}`);
    toast(`已删除 ${name}`);
    await loadVersions();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    deletingFile.value = '';
  }
}

async function deleteVersion(ver) {
  try {
    await api('DELETE', `/api/apps/${encodeURIComponent(appName.value)}/versions/${encodeURIComponent(ver)}`);
    if (openVer.value === ver) {
      verEdit.discard();
      openVer.value = null;
    }
    toast(`版本 ${ver} 已删除`);
    const next = { ...notesDraft.value };
    delete next[ver];
    notesDraft.value = next;
    await loadVersions();
    await loadLatest();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteApp() {
  try {
    await api('DELETE', `/api/apps/${encodeURIComponent(appName.value)}`);
    metaEdit.discard();
    verEdit.discard();
    advEdit.discard();
    toast('已删除');
    router.push('/');
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ── 上传：交给上传托盘，换页不断；传完按 group 信号刷新版本列表 ── */
function startVersionUpload(ver, items) {
  if (!items.length) return;
  const app = appName.value;
  uploads.start({
    key: `app:${app}:${ver}`,
    group: `app:${app}`,
    title: describeUploadBatch(items).label,
    target: `${displayLabel.value} · ${ver}`,
    to: `/app/${encodeURIComponent(app)}`,
    run: ({ onProgress, signal }) => uploadAppVersion({ app, version: ver, items, onProgress, signal }),
  });
}
function onFileChange(ver, ev) {
  const items = Array.from(ev.target.files || [], f => ({ file: f, relativePath: f.name }));
  ev.target.value = '';
  startVersionUpload(ver, items);
}
async function onDrop(ev, ver) {
  dragVer.value = null;
  const items = await ingestFromDataTransfer(ev.dataTransfer);
  if (items.some(it => it.relativePath.includes('/'))) {
    toast('版本只收平铺文件，不收文件夹', 'error');
    return;
  }
  startVersionUpload(ver, items);
}
watch(() => uploads.doneAt[`app:${appName.value}`], t => t && loadVersions().catch(e => toast(e.message, 'error')));

function closeNewVer() {
  newVerInput.value = '';
  newVerErr.value = '';
  showNewVer.value = false;
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
    closeNewVer();
    await loadVersions();
    if (canLeavePane()) showPane('ver', ver);
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
    showPane(null);
    loadAll();
  },
  { immediate: true },
);
</script>

<style scoped>
/* 左侧版本索引里的「当前」标记 */
.lt {
  font-style: normal;
  color: var(--green);
  margin-right: 8px;
}
.pub-meta {
  font-size: 13px;
  color: var(--text2);
}

/* 发布说明摘要 */
.pub-notes {
  font-size: 14px;
  color: var(--text2);
  line-height: 1.5;
  white-space: pre-wrap;
  max-width: 640px;
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

/* 版本卡内：草稿与无进度提示 */
.hidden-input {
  display: none;
}
.dropmini.drag {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-tint);
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
.ver-swap-enter-active { transition: opacity var(--t-med) var(--ease-out), transform var(--t-slow) var(--spring-soft); }
.ver-swap-leave-active { transition: opacity var(--t-fast) var(--ease-out); }
.ver-swap-enter-from { opacity: 0; transform: translateY(var(--shift)) scale(var(--pop)); }
.ver-swap-leave-to { opacity: 0; }

/* 新建版本浮层 */
.lform { width: 320px; max-width: 100%; }
.l-title { margin: 0 0 8px; font-size: 0.95rem; font-weight: 700; }
.lform .input { padding: 9px 12px; font-size: 14px; }

.dropmini:focus-visible { outline: 2px solid rgba(56, 189, 248, 0.6); outline-offset: 2px; }
.fdel.armed { width: auto; padding: 0 8px; font-size: 0.7rem; }

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

</style>
