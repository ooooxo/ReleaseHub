/**
 * 复制并在原地打勾：成功后 copiedKey 置为 key，片刻后回落；失败弹错误 toast。
 * 用法：const { copiedKey, copy } = useCopied(); copy(url, it.id)；模板里 copiedKey === it.id 时换成勾。
 */
import { ref, onUnmounted } from 'vue';
import { copyText } from '@/utils/copy-text';
import { useToast } from '@/composables/useToast';

const SHOW_MS = 1400;

export function useCopied() {
  const { toast } = useToast();
  const copiedKey = ref(null);
  let timer = null;
  function copy(text, key = true) {
    copyText(text).then(
      () => {
        copiedKey.value = key;
        clearTimeout(timer);
        timer = setTimeout(() => { copiedKey.value = null; }, SHOW_MS);
      },
      () => toast('复制失败', 'error'),
    );
  }
  onUnmounted(() => clearTimeout(timer));
  return { copiedKey, copy };
}
