/**
 * v-tip：替代原生 title 的自绘提示（ADR-0006，源自 Hrige 0064）。全站共用一枚签。
 * 用法：<button v-tip="'返回总览'">；值为空则不显示。悬停 / 键盘聚焦 400ms 后出现，按下即收。
 * 需要：main.js 里 app.directive('tip', vTip)；样式在 global.css 的 .tip。
 */
const DELAY_MS = 400;
const GAP = 8;

let tipEl = null;
let timer = null;
let current = null;

function ensureEl() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'tip';
  tipEl.setAttribute('role', 'tooltip');
  document.body.appendChild(tipEl);
  return tipEl;
}

function place(el) {
  const t = ensureEl();
  t.textContent = el._tip;
  t.classList.remove('is-shown');
  const r = el.getBoundingClientRect();
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  const below = r.top - h - GAP < 4;
  const left = Math.min(Math.max(4, r.left + r.width / 2 - w / 2), window.innerWidth - w - 4);
  t.style.left = `${left}px`;
  t.style.top = `${below ? r.bottom + GAP : r.top - h - GAP}px`;
  t.dataset.side = below ? 'below' : 'above';
  void t.offsetWidth; // 先落定起始态，再加 is-shown 才有过渡
  t.classList.add('is-shown');
}

function show(e) {
  const el = e.currentTarget;
  if (!el._tip) return;
  clearTimeout(timer);
  current = el;
  timer = setTimeout(() => place(el), DELAY_MS);
}

function hide() {
  clearTimeout(timer);
  current = null;
  tipEl?.classList.remove('is-shown');
}

export const vTip = {
  mounted(el, { value }) {
    el._tip = value;
    if (!el.hasAttribute('aria-label') && value) el.setAttribute('aria-label', value);
    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('blur', hide);
    el.addEventListener('pointerdown', hide);
  },
  updated(el, { value }) {
    el._tip = value;
    if (current === el && tipEl) tipEl.textContent = value;
  },
  unmounted(el) {
    if (current === el) hide();
    el.removeEventListener('mouseenter', show);
    el.removeEventListener('focus', show);
    el.removeEventListener('mouseleave', hide);
    el.removeEventListener('blur', hide);
    el.removeEventListener('pointerdown', hide);
  },
};
