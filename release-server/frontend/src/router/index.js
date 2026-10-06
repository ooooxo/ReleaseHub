import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const LoginView = () => import('@/views/LoginView.vue');
const HomeView = () => import('@/views/HomeView.vue');
const AppDetailView = () => import('@/views/AppDetailView.vue');
const SettingsView = () => import('@/views/SettingsView.vue');
const ResourceDetailView = () => import('@/views/ResourceDetailView.vue');

const PAGE_SWAP_MS = 240;   // 与 App.vue 的换页过渡同长（--t-med 220ms + 余量）

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // 后退回到离开时的位置；等换页过渡（out-in，--t-med）走完再滚，否则旧页还在、滚了也白滚
  scrollBehavior(to, _from, saved) {
    const target = saved || (to.hash ? { el: to.hash, behavior: 'smooth' } : { top: 0 });
    return new Promise(resolve => setTimeout(() => resolve(target), PAGE_SWAP_MS));
  },
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { guest: true } },
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    { path: '/app/:name', name: 'app-detail', component: AppDetailView, meta: { requiresAuth: true } },
    { path: '/resources', redirect: { path: '/', hash: '#library-grid' } },
    { path: '/resources/:name', name: 'resource-detail', component: ResourceDetailView, meta: { requiresAuth: true } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { requiresAuth: true } },
    // 新建临时文件已并进总览的投放格（ADR-0003 / 0006），旧地址落回那一格
    { path: '/temp-transfer', redirect: { path: '/', hash: '#temp-hub' } },
    {
      path: '/temp-transfer/:id',
      name: 'temp-item',
      component: () => import('@/views/TempItemDetailView.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.token) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.guest && auth.token) {
    return { name: 'home' };
  }
  return true;
});

export default router;
