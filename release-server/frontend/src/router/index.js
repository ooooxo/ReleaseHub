import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const LoginView = () => import('@/views/LoginView.vue');
const HomeView = () => import('@/views/HomeView.vue');
const AppDetailView = () => import('@/views/AppDetailView.vue');
const SettingsView = () => import('@/views/SettingsView.vue');
const ResourceDetailView = () => import('@/views/ResourceDetailView.vue');

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // 滚动容器是 .app-main 不是 window，路由自带的滚动够不着：hash 自己 scrollIntoView（首屏未渲染时由 HomeView 加载完再滚）
  scrollBehavior(to) {
    if (to.hash) document.querySelector(to.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else document.querySelector('.app-main')?.scrollTo({ top: 0 });
    return false;
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
