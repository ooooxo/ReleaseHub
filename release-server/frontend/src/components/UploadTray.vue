<!--
  上传托盘的界面：右下角一列任务行。进行中可取消，暂停/失败可重试，完成行带「查看 / 复制链接」并在片刻后自行退场。
  挂在 App.vue 的已登录外壳里，全站一份。
-->
<template>
  <div class="tray" aria-live="polite">
    <TransitionGroup name="tray-row">
      <div v-for="t in uploads.tasks" :key="t.id" class="row" :class="`is-${t.status}`">
        <div class="r-head">
          <span class="r-dot" />
          <span class="r-title" v-tip="t.title">{{ t.title }}</span>
          <span class="r-pct">{{ statusText(t) }}</span>
        </div>
        <div class="r-target">{{ t.target }}</div>
        <div v-if="t.status === 'running'" class="r-bar">
          <div class="r-fill" :class="{ indet: t.pct < 0 }" :style="{ width: (t.pct < 0 ? 100 : t.pct) + '%' }" />
        </div>
        <p v-if="t.error" class="r-err">{{ t.error }}</p>
        <div class="r-actions">
          <button v-if="t.status === 'running'" type="button" class="btn btn-ghost btn-sm" @click="uploads.cancel(t.id)">取消</button>
          <template v-else-if="t.status === 'done'">
            <button v-if="t.link" type="button" class="btn btn-primary btn-sm" @click="copyLink(t.link)">复制链接</button>
            <button v-if="t.to && !isHere(t.to)" type="button" class="btn btn-ghost btn-sm" @click="go(t)">查看</button>
          </template>
          <template v-else>
            <button type="button" class="btn btn-primary btn-sm" @click="uploads.retry(t.id)">重试</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="uploads.dismiss(t.id)">关闭</button>
          </template>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';
import { useUploads } from '@/stores/uploads';
import { useToast } from '@/composables/useToast';
import { copyText } from '@/utils/copy-text';

const uploads = useUploads();
const route = useRoute();
const router = useRouter();
const { toast } = useToast();

function statusText(t) {
  if (t.status === 'running') return t.pct < 0 ? '上传中' : `${t.pct}%`;
  if (t.status === 'done') return '完成';
  if (t.status === 'paused') return '已暂停';
  return '失败';
}
function isHere(to) {
  return route.path === to;
}
function go(t) {
  router.push(t.to);
  uploads.dismiss(t.id);
}
function copyLink(url) {
  copyText(url).then(
    () => toast('已复制'),
    () => toast('复制失败', 'error'),
  );
}
</script>

<style scoped>
.tray {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 80;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  padding: 11px 13px 12px;
  background: var(--surface2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
}
.r-head { display: flex; align-items: center; gap: 8px; }
.r-dot { width: 7px; height: 7px; border-radius: 99px; background: var(--accent); flex: none; }
.is-done .r-dot { background: var(--green); }
.is-paused .r-dot { background: var(--amber); }
.is-error .r-dot { background: var(--danger); }
.r-title {
  flex: 1;
  min-width: 0;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.r-pct { flex: none; font-family: var(--font-mono); font-size: 0.72rem; color: var(--text2); }
.is-done .r-pct { color: var(--green); }
.r-target { margin: 2px 0 0 15px; font-size: 0.7rem; color: var(--text3); }
.r-bar { margin-top: 9px; height: 4px; border-radius: 99px; background: var(--inset); overflow: hidden; }
.r-fill { height: 100%; border-radius: 99px; background: var(--accent); transition: width var(--t-med) var(--ease-out); }
.r-fill.indet { opacity: 0.5; animation: tray-pulse 1.2s var(--ease-in-out) infinite alternate; }
.r-err { margin: 7px 0 0 15px; font-size: 0.72rem; color: var(--text2); }
.is-error .r-err { color: var(--danger-text); }
.r-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
.r-actions:empty { display: none; }

.tray-row-enter-active,
.tray-row-leave-active { transition: opacity var(--t-med) var(--ease-out), transform var(--t-med) var(--ease-out); }
.tray-row-move { transition: transform var(--t-med) var(--ease-in-out); }
.tray-row-enter-from,
.tray-row-leave-to { opacity: 0; transform: translateY(var(--shift)); }
.tray-row-leave-active { position: absolute; width: 100%; }

@keyframes tray-pulse { to { opacity: 0.2; } }
@media (max-width: 640px) {
  .tray { left: 12px; right: 12px; width: auto; bottom: 12px; }
}
</style>
