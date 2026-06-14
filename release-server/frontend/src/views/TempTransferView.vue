<template>
  <div class="layout-max">
    <div class="appbar">
      <button
        type="button"
        class="back"
        aria-label="返回总览"
        @click="router.push({ path: '/', hash: '#temp-hub' })"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div class="ab-titles">
        <h1>新的临时文件 <span class="chip temp">临时</span></h1>
        <span class="pkg">单文件或文件夹 · 到期自动删除</span>
      </div>
    </div>

    <p v-if="loadError" class="card err-line">{{ loadError }}</p>

    <template v-else>
      <div class="dz-wrap" :class="{ 'section-dim': uploading }">
        <FolderAwareDropzone
          :disabled="uploading"
          :hint="
            uploading
              ? '正在上传…'
              : `拖拽文件 / 文件夹到此 · 点击选择 · 自动识别目录结构 · 单文件最大 ${maxFileSizeMb} MB`
          "
          @items="onUploadItems"
        />
      </div>

      <div class="card block" :class="{ 'section-dim': uploading }">
        <span class="field-label">有效期</span>
        <div class="ttl-group">
          <button
            v-for="m in allowedTtls"
            :key="m"
            type="button"
            class="btn btn-sm ttl"
            :class="ttlMinutes === m ? 'btn-primary' : 'btn-ghost'"
            :disabled="uploading"
            @click="ttlMinutes = m"
          >
            {{ formatTtl(m) }}
          </button>
        </div>

        <p v-if="pickedName" class="hint sm pick-hint">已选择：{{ pickedName }}</p>

        <div v-if="uploadPct != null && uploadPct >= 0" class="prog">
          <div class="prog-bar">
            <div class="prog-fill" :style="{ width: uploadPct + '%' }" />
          </div>
          <span class="prog-txt">{{ uploadPct }}%</span>
        </div>
        <div v-else-if="uploadPct === -1" class="prog indet">
          <span class="prog-txt">上传中（无法计算进度）…</span>
        </div>
        <button v-if="uploading" type="button" class="btn btn-sm btn-ghost" @click="cancelUpload">取消</button>

        <p class="hint sm note">上传完成后立即生成分享链与倒计时。</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, uploadTemp } from '@/api/client';
import { useToast } from '@/composables/useToast';
import FolderAwareDropzone from '@/components/FolderAwareDropzone.vue';
import { describeUploadBatch } from '@/composables/useFolderUpload';

const router = useRouter();
const { toast } = useToast();

const pickedName = ref('');
const allowedTtls = ref([]);
const maxFileSizeMb = ref(100);
const loadError = ref('');

const ttlMinutes = ref(1440);
const uploading = ref(false);
const uploadAbort = ref(null);
const uploadPct = ref(/** @type {number | null} */ (null));
function formatTtl(m) {
  if (m === 1440) return '24 小时';
  if (m < 60) return `${m} 分钟`;
  if (m % 60 === 0) return `${m / 60} 小时`;
  return `${m} 分钟`;
}

async function onUploadItems(list) {
  if (!list?.length || loadError.value) return;
  const desc = describeUploadBatch(list);
  pickedName.value = desc.label || list[0].file.name;
  await doUpload(list, desc);
}

async function loadAllowed() {
  loadError.value = '';
  try {
    const d = await api('GET', '/api/temp-transfer/allowed-ttls');
    allowedTtls.value = d.allowedTtlsMinutes || [];
    if (d.defaultTtlMinutes != null && allowedTtls.value.includes(d.defaultTtlMinutes)) {
      ttlMinutes.value = d.defaultTtlMinutes;
    } else {
      ttlMinutes.value = allowedTtls.value[0] ?? 1440;
    }
    if (d.maxFileSizeMb != null) maxFileSizeMb.value = d.maxFileSizeMb;
  } catch (e) {
    if (e.status === 404) {
      loadError.value = '本服务器未启用「临时传输」。可在 .env 中设置 TEMP_TRANSFER_ENABLED。';
    } else {
      loadError.value = e.message || '无法读取配置';
    }
  }
}

async function doUpload(list, desc) {
  if (!list?.length || loadError.value) return;
  const isFolder = list.length > 1 || list.some(it => it.relativePath.includes('/'));
  if (isFolder && list.length > 100) {
    toast('临时文件夹一次最多 100 个文件', 'error');
    return;
  }
  const ctrl = new AbortController();
  uploadAbort.value = ctrl;
  uploading.value = true;
  uploadPct.value = 0;
  try {
    const lastData = await uploadTemp({
      items: list,
      ttlMinutes: ttlMinutes.value,
      folderName: desc?.rootName,
      onProgress: n => {
        uploadPct.value = n;
      },
      signal: ctrl.signal,
    });
    toast(desc?.isFolder ? `已创建临时文件夹（${desc.label}）` : '已创建临时文件');
    if (lastData?.id) {
      router.push(`/temp-transfer/${encodeURIComponent(lastData.id)}`);
    } else {
      router.push({ path: '/', hash: '#temp-hub' });
    }
  } catch (e) {
    if (e.name === 'AbortError' || e.aborted) toast('已暂停 · 重传同名文件可断点续传');
    else toast(e.message || '上传失败', 'error');
  } finally {
    uploading.value = false;
    uploadPct.value = null;
    pickedName.value = '';
    uploadAbort.value = null;
  }
}

function cancelUpload() {
  if (uploadAbort.value) uploadAbort.value.abort();
}

onMounted(() => {
  loadAllowed();
});
</script>

<style scoped>
/* 全宽投放区：让 FolderAwareDropzone 顶满容器宽度 */
.dz-wrap {
  width: 100%;
  margin-bottom: 14px;
}
.dz-wrap :deep(.drop-zone) {
  width: 100%;
  min-height: 190px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 上传中弱化交互 */
.section-dim {
  opacity: 0.55;
  pointer-events: none;
}

/* 有效期段选 */
.ttl-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.hint {
  font-size: 0.8rem;
  color: var(--text2);
  line-height: 1.5;
}
.hint.sm {
  font-size: 0.74rem;
  margin: 10px 0 0;
}
.hint.note {
  color: var(--text3);
}
.pick-hint {
  word-break: break-all;
}

.err-line {
  padding: 20px;
  color: var(--danger);
  font-size: 0.86rem;
  line-height: 1.55;
}
</style>
