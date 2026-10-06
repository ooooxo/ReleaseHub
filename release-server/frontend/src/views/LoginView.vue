<template>
  <div class="gate">
    <span class="wm">ooooxo</span>
    <div class="art"><canvas ref="canvas" /></div>
    <div class="side">
      <div class="eyebrow">管理后台</div>
      <h1>Release Hub</h1>
      <form @submit.prevent="submit">
        <input
          v-model="password"
          type="password"
          class="input"
          placeholder="管理密码"
          aria-label="管理密码"
          autocomplete="current-password"
          :disabled="loading"
        />
        <p class="err" role="alert">{{ err }}</p>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? '验证中…' : '进入' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/api/client';
import { useToast } from '@/composables/useToast';
import { mountLiquid } from '@/composables/useLiquid';

const password = ref('');
const err = ref('');
const loading = ref(false);
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { toast } = useToast();
const canvas = ref(null);
// 登录页的液面压进服务名，形态取「流动」——与入口管理页的登录页同一种画法
let stopLiquid = () => {};
onMounted(() => {
  stopLiquid = mountLiquid(canvas.value, { name: 'Release Hub', description: '', url: '', motif: 'flow' });
});
onUnmounted(() => stopLiquid());

async function submit() {
  err.value = '';
  if (!password.value.trim()) {
    err.value = '请输入密码';
    return;
  }
  loading.value = true;
  try {
    const data = await api('POST', '/api/login', { password: password.value });
    auth.setToken(data.token);
    toast('登录成功');
    const redirect = route.query.redirect || '/';
    router.replace(typeof redirect === 'string' ? redirect : '/');
  } catch (e) {
    err.value = e.message || '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
/* 与入口管理页的登录页同一构图：左侧标题与表单，右侧 62% 实时液体，左上角字标 */
.gate {
  position: fixed;
  inset: 0;
}
.art {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 62%;
  overflow: hidden;
}
.art canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
/* 遮罩从一段实底起、往左多盖 2px：画布左缘落在小数像素上会抗锯齿出一道亮线 */
.art::after {
  content: '';
  position: absolute;
  inset: 0 0 0 -2px;
  pointer-events: none;
  background: linear-gradient(90deg, var(--bg) 0%, var(--bg) 3%, rgba(12, 12, 14, 0) 32%);
}
.wm {
  position: absolute;
  left: 40px;
  top: 28px;
  z-index: 2;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.side {
  position: absolute;
  left: 7%;
  top: 0;
  bottom: 0;
  width: min(380px, 80vw);
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
}
.eyebrow {
  font-size: 14px;
  color: var(--text3);
}
h1 {
  margin: 0 0 18px;
  font-size: clamp(40px, 4.6vw, 68px);
  line-height: 1.04;
  font-weight: 650;
  letter-spacing: -0.04em;
}
form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.err {
  margin: 0;
  min-height: 20px;
  font-size: 13px;
  color: var(--danger-text);
}
@media (max-width: 900px) {
  .art {
    width: 100%;
    opacity: 0.55;
  }
  .art::after {
    background: linear-gradient(180deg, rgba(12, 12, 14, 0.2), var(--bg) 85%);
  }
  .side {
    left: 24px;
    right: 24px;
    width: auto;
    justify-content: flex-end;
    padding-bottom: 12vh;
  }
  .wm {
    left: 24px;
  }
}
</style>
