import { nextTick } from 'vue';

/** 重放一次「抖一下」动画：先摘 class 落一次样式，再挂回去。连续触发也每次都抖 */
export async function restartNudge(flagRef, elRef) {
  flagRef.value = false;
  await nextTick();
  void elRef.value?.offsetWidth;
  flagRef.value = true;
}
