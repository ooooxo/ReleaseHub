/**
 * 对外链接的根地址：取后台「设置」里的 BASE_URL，读不到或为空时退回按当前访问地址推断的值。
 * 用法：const { publicBase, loadPublicBase } = usePublicBase(); await loadPublicBase();
 */
import { ref } from 'vue';
import { api } from '@/api/client';
import { suggestedPublicBaseFromVite } from '@/utils/public-url';

export function usePublicBase() {
  const publicBase = ref('');
  async function loadPublicBase() {
    try {
      const s = await api('GET', '/api/settings');
      publicBase.value = (s.baseUrl || '').replace(/\/$/, '') || suggestedPublicBaseFromVite();
    } catch {
      publicBase.value = suggestedPublicBaseFromVite();
    }
  }
  return { publicBase, loadPublicBase };
}
