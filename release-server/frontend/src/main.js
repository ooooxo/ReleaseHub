import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './styles/global.css';
import { vTip } from './directives/tip';

// 文件落在投放区之外时，浏览器默认会跳到 file://，把整个管理端连同在传上传一起丢掉
window.addEventListener('dragover', e => {
  if (!e.defaultPrevented) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'none';
  }
});
window.addEventListener('drop', e => e.preventDefault());

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.directive('tip', vTip);
app.mount('#app');
