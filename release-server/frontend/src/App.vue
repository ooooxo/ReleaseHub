<template>
  <ToastStack />
  <div class="app-root" :class="{ 'app-root--shelled': shelled }">
    <div v-if="shelled" class="app-shelled-wrap">
      <TopBar v-if="showTopBar" />
      <UploadTray />
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <!-- 总览缓存住：进详情再返回不重新加载，回来时自己在后台刷新 -->
            <KeepAlive include="HomeView">
              <component :is="Component" />
            </KeepAlive>
          </transition>
        </router-view>
      </main>
    </div>
    <main v-else class="app-main app-main--auth">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import ToastStack from '@/components/ToastStack.vue';
import TopBar from '@/components/TopBar.vue';
import UploadTray from '@/components/UploadTray.vue';

const route = useRoute();
const auth = useAuthStore();
const showTopBar = computed(() => !!auth.token && route.name !== 'login');
// 只看路由不看 token：登出那一刻不能先把当前页重挂一遍（会再打一轮 401）
const shelled = computed(() => !!route.meta.requiresAuth);
</script>

<style scoped>
.app-root {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.app-shelled-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}
.app-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.app-main--auth {
  width: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--t-med) var(--ease-out);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
