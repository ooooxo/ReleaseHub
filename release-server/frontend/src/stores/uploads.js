/**
 * 上传托盘（CONTEXT.md）：全站唯一的在传任务清单。上传属于整个管理端而不属于某一页——
 * 换页不中断，传完只在托盘里出「完成」行（带去处 / 复制链接），不改变用户所在的页。
 * 用法：useUploads().start({ key, group, title, target, to, run, linkOf })
 *   key   同一目标同时只许一个在传（如 res:lib、app:pkg:v1）
 *   group 完成信号：视图 watch(() => uploads.doneAt[group]) 刷新自己的列表
 *   run   ({ onProgress, signal }) => Promise<result>
 *   linkOf(result) 可选：完成行上「复制链接」的地址
 */
import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import { useToast } from '@/composables/useToast';

const DONE_LINGER_MS = 8000;

export const useUploads = defineStore('uploads', () => {
  const { toast } = useToast();
  const tasks = ref([]);
  const doneAt = reactive({});
  let seq = 0;

  const running = computed(() => tasks.value.some(t => t.status === 'running'));

  function dismiss(id) {
    tasks.value = tasks.value.filter(t => t.id !== id);
  }

  function launch(t) {
    t.status = 'running';
    t.pct = 0;
    t.error = '';
    t.ctrl = new AbortController();
    t.run({ onProgress: p => { t.pct = p; }, signal: t.ctrl.signal }).then(
      result => {
        t.status = 'done';
        t.pct = 100;
        t.link = t.linkOf?.(result) || '';
        t.result = result;
        doneAt[t.group] = Date.now();
        setTimeout(() => dismiss(t.id), DONE_LINGER_MS);
      },
      e => {
        t.status = e?.name === 'AbortError' || e?.aborted ? 'paused' : 'error';
        t.error = t.status === 'paused' ? '已暂停 · 重试即从断点续传' : e?.message || '上传失败';
      },
    );
  }

  function start({ key, group, title, target, to = null, run, linkOf = null }) {
    if (tasks.value.some(t => t.key === key && t.status === 'running')) {
      toast(`${target} 已有上传在进行，等它传完或先取消`, 'error');
      return false;
    }
    tasks.value = tasks.value.filter(t => t.key !== key);
    const t = reactive({ id: ++seq, key, group: group || key, title, target, to, run, linkOf, link: '' });
    tasks.value.push(t);
    launch(t);
    return true;
  }

  function retry(id) {
    const t = tasks.value.find(x => x.id === id);
    if (t && t.status !== 'running') launch(t);
  }
  function cancel(id) {
    tasks.value.find(x => x.id === id)?.ctrl.abort();
  }

  window.addEventListener('beforeunload', e => {
    if (running.value) e.preventDefault();
  });

  return { tasks, doneAt, running, start, retry, cancel, dismiss };
});
