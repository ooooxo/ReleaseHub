<template>
  <div class="settings">
    <LiquidBackdrop :entry="null" />

    <div class="ix-wrap">
      <!-- 左：设置的分区索引 -->
      <nav class="ix-idx" aria-label="设置分区">
        <RouterLink to="/" class="ix-crumb">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          总览
        </RouterLink>
        <h1 class="ix-title idx-title">设置</h1>
        <button type="button" class="ix-it sm" :class="{ on: sec === 'base' }" @click="sec = 'base'">
          <b>对外地址</b><span>下载直链与公开页的根地址</span>
        </button>
        <button type="button" class="ix-it sm" :class="{ on: sec === 'pwd' }" @click="sec = 'pwd'">
          <b>修改密码</b><span>管理员登录密码</span>
        </button>
        <button type="button" class="ix-it sm" :class="{ on: sec === 'disk' }" @click="sec = 'disk'">
          <b>磁盘空间</b><span>releases 卷的占用</span>
        </button>
        <button type="button" class="ix-it sm" :class="{ on: sec === 'dirs' }" @click="sec = 'dirs'">
          <b>数据目录</b><span>应用 · 资源库 · 临时文件的落盘路径</span>
        </button>
        <div class="ix-acts">
          <button type="button" class="btn btn-ghost" @click="logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            退出登录
          </button>
        </div>
      </nav>

      <!-- 右：选中的那个分区 -->
      <aside class="ix-pane">
        <section v-if="sec === 'base'" class="ix-sec">
          <h2>对外地址</h2>
          <p class="hint">下载直链与 latest.json 内 url 依赖此项。修改后可用应用页的「刷新下载链接」批量更新已发布 URL。</p>
          <div class="row-input">
            <input v-model="baseUrl" class="input" placeholder="https://example.com/releasehub" />
            <button type="button" class="btn btn-primary" :disabled="savingBase" @click="saveBase">保存</button>
          </div>
        </section>
        <section v-else-if="sec === 'pwd'" class="ix-sec">
          <h2>修改密码</h2>
          <div class="pwd-form">
            <div>
              <span class="field-label">当前密码</span>
              <input v-model="oldPwd" type="password" class="input" autocomplete="current-password" />
            </div>
            <div>
              <span class="field-label">新密码（至少 5 位）</span>
              <input v-model="newPwd" type="password" class="input" autocomplete="new-password" />
            </div>
            <div>
              <span class="field-label">确认新密码</span>
              <input v-model="newPwd2" type="password" class="input" autocomplete="new-password" />
            </div>
            <button type="button" class="btn btn-primary pwd-submit" :disabled="changingPwd" @click="changePwd">更新密码</button>
          </div>
        </section>
        <section v-else-if="sec === 'disk'" class="ix-sec">
          <h2>磁盘空间</h2>
          <p v-if="diskError" class="disk-err">{{ diskError }}</p>
          <p v-else-if="!disk" class="hint">当前环境无法读取磁盘统计（不支持 statfs 或路径不可用）</p>
          <template v-else>
            <div class="prog">
              <div class="prog-bar"><div class="prog-fill" :style="{ width: usedPct + '%' }" /></div>
              <span class="prog-txt">{{ usedPct }}%</span>
            </div>
            <p class="hint sm">
              已用 <b>{{ formatBytes(disk.used) }}</b> / 共 {{ formatBytes(disk.total) }} · 剩余 {{ formatBytes(disk.free) }}
            </p>
          </template>
        </section>
        <section v-else-if="sec === 'dirs'" class="ix-sec">
          <h2>数据目录</h2>
          <p class="hint">
            Tauri / 通用库只读 <strong>应用目录</strong>，与资源库无关。若升级后列表空了，多半是服务读到的路径下没有旧数据：请核对
            <code>RELEASES_DIR</code> 是否仍指向你以前放包的目录（可在部署环境 <code>.env</code> 里设置）。
          </p>
          <p v-if="releasesDir" class="mono-path"><span class="lbl-inline">应用（releases）</span>{{ releasesDir }}</p>
          <p v-if="resourceLibrariesDir" class="mono-path">
            <span class="lbl-inline">资源库</span>{{ resourceLibrariesDir }}
          </p>
          <template v-if="tempTransferEnabled && tempRoot">
            <p class="mono-path">
              <span class="lbl-inline">临时文件根目录</span>{{ tempRoot }}
            </p>
            <p class="hint sm path-hint">
              与「应用 / 资源库」同级，默认名为 <code>temp-transfers</code>。实体文件在 <code>blobs/</code> 内，文件名为
              <code>{id}.bin</code> 而非原始名；上传中在 <code>pending/</code>；元数据 <code>meta/</code>；分享索引
              <code>token-index/</code>。
            </p>
            <p v-for="(p, k) in tempSubdirs" :key="k" class="mono-path sub-indent">
              <span class="lbl-inline">{{ k }}</span>{{ p }}
            </p>
            <p v-if="tempFileCounts" class="hint sm">
              文件数 — pending {{ tempFileCounts.pending }} · blobs {{ tempFileCounts.blobs }} · meta {{ tempFileCounts.meta }} · token-index {{ tempFileCounts.tokenIndex }}
            </p>
            <p v-if="tempSweep" class="hint sm">
              最近清扫：{{ tempSweep.at }} · 已删记录 {{ tempSweep.removed }} · 已清 pending
              {{ tempSweep.pendingRemoved }} · 旧墓碑 {{ tempSweep.legacyTokensRemoved }} · 错误
              {{ tempSweep.errorCount }} · {{ tempSweep.durationMs }}ms（定时约每 {{ tempSweepIntervalSec }}s）
            </p>
          </template>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/api/client';
import { useToast } from '@/composables/useToast';
import { formatBytes } from '@/utils/format-bytes';
import LiquidBackdrop from '@/components/LiquidBackdrop.vue';

const router = useRouter();
const auth = useAuthStore();
const { toast } = useToast();
/** 右侧摆哪个分区；默认对外地址（最常改的那项） */
const sec = ref('base');

const baseUrl = ref('');
const releasesDir = ref('');
const resourceLibrariesDir = ref('');
const tempTransferEnabled = ref(false);
const tempRoot = ref('');
const tempSubdirs = ref(/** @type {Record<string, string>} */ ({}));
const tempFileCounts = ref(/** @type {null | { pending: number, blobs: number, meta: number, tokenIndex: number }} */ (null));
const tempSweep = ref(/** @type {null | { at: string, removed: number, pendingRemoved: number, legacyTokensRemoved: number, errorCount: number, durationMs: number }} */ (null));
const tempSweepIntervalSec = ref(60);
const savingBase = ref(false);
const disk = ref(null);
const diskError = ref('');
const oldPwd = ref('');
const newPwd = ref('');
const newPwd2 = ref('');
const changingPwd = ref(false);

const usedPct = computed(() => {
  const d = disk.value;
  if (!d || !d.total) return 0;
  return Math.min(100, Math.round((d.used / d.total) * 100));
});

async function load() {
  try {
    const s = await api('GET', '/api/settings');
    baseUrl.value = s.baseUrl || '';
    releasesDir.value = s.releasesDir || '';
    resourceLibrariesDir.value = s.resourceLibrariesDir || '';
    const tt = s.tempTransfer;
    if (tt && tt.enabled) {
      tempTransferEnabled.value = true;
      tempRoot.value = tt.rootDir || '';
      tempSubdirs.value = tt.subdirs || {};
      tempFileCounts.value = tt.fileCounts || null;
      tempSweep.value = tt.lastSweep || null;
      if (tt.sweepIntervalSeconds != null) tempSweepIntervalSec.value = tt.sweepIntervalSeconds;
    } else {
      tempTransferEnabled.value = false;
      tempRoot.value = '';
      tempSubdirs.value = {};
      tempFileCounts.value = null;
      tempSweep.value = null;
    }
  } catch (e) {
    toast(e.message, 'error');
  }
  diskError.value = '';
  try {
    const sys = await api('GET', '/api/system');
    disk.value = sys?.disk ?? null;
  } catch (e) {
    disk.value = null;
    if (e.message !== '未授权') {
      diskError.value = e.message || '无法读取磁盘信息';
    }
  }
}

async function saveBase() {
  savingBase.value = true;
  try {
    const r = await api('POST', '/api/base-url', { baseUrl: baseUrl.value.trim() });
    baseUrl.value = r.baseUrl;
    toast('已保存 BASE_URL');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingBase.value = false;
  }
}

async function changePwd() {
  if (newPwd.value !== newPwd2.value) {
    toast('两次新密码不一致', 'error');
    return;
  }
  changingPwd.value = true;
  try {
    await api('POST', '/api/change-password', { oldPassword: oldPwd.value, newPassword: newPwd.value });
    toast('密码已更新，请重新登录');
    auth.logout();
    router.replace('/login');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    changingPwd.value = false;
  }
}

function logout() {
  auth.logout();
  router.replace('/login');
}

onMounted(load);
</script>

<style scoped>
.idx-title {
  margin-bottom: 30px;
}
.hint {
  margin: 0;
  font-size: 14px;
  color: var(--text2);
  line-height: 1.55;
}
.hint:last-child {
  margin-bottom: 0;
}
.hint.sm {
  font-size: 12px;
}
.hint b {
  color: var(--text);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.hint code {
  font-family: var(--font-mono);
  font-size: 0.92em;
  color: var(--accent-text);
}
.path-hint {
  margin-top: 8px;
}
.sub-indent {
  margin-left: 10px;
}
.row-input .input {
  flex: 1;
  min-width: 200px;
}
.pwd-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 4px;
  max-width: 360px;
}
.pwd-submit {
  align-self: flex-start;
  margin-top: 4px;
}
.disk-err {
  margin: 0;
  font-size: 0.82rem;
  color: var(--danger);
  line-height: 1.5;
}
.prog {
  margin-top: 4px;
}
.prog-txt {
  font-variant-numeric: tabular-nums;
}
</style>
