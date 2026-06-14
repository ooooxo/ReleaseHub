<template>
  <div class="login">
    <div class="card panel">
      <div class="lbrand">
        <span class="lbadge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        </span>
        <span class="lbrand-t">Release Hub</span>
      </div>
      <h1>管理后台</h1>
      <p class="hint">输入管理员密码登录</p>
      <form @submit.prevent="submit">
        <div>
          <span class="field-label">密码</span>
          <input
            v-model="password"
            type="password"
            class="input"
            placeholder="••••••••"
            autocomplete="current-password"
            :disabled="loading"
          />
        </div>
        <p v-if="err" class="err">{{ err }}</p>
        <button type="submit" class="btn btn-primary full" :disabled="loading">
          {{ loading ? '验证中…' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/api/client';
import { useToast } from '@/composables/useToast';

const password = ref('');
const err = ref('');
const loading = ref(false);
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { toast } = useToast();

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
.login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.panel {
  width: 100%;
  max-width: 380px;
  padding: 38px 34px;
}
.lbrand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 22px;
}
.lbadge {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--accent-tint);
  color: var(--accent);
  display: grid;
  place-items: center;
}
.lbadge svg {
  width: 19px;
  height: 19px;
}
.lbrand-t {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent-text);
}
h1 {
  margin: 0 0 6px;
  font-size: 1.4rem;
}
.hint {
  margin: 0;
  color: var(--text2);
  font-size: 14px;
}
form {
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.full {
  width: 100%;
  padding: 12px;
}
.err {
  margin: 0;
  color: var(--danger);
  font-size: 13px;
}
</style>
