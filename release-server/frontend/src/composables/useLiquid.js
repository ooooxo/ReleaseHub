/**
 * 液体封面：用 ooooxo.com 入口页的同一个库（/liquid.js，index.html 里引入，挂在 window.HP）。
 * 同名的库在入口页和这里出同一族液体（种子取名称、色调取类型、液面压进名字）。
 * 没加载到它（本地没起入口页）或 WebGL 不可用时只报错不出图，页面照常可用——与入口页自己的约定一致。
 */
const LIQUID_RES = 0.6;   // 实时画布分辨率（相对 CSS 像素）：液体本身就柔，0.6 足够且省电

const HP = window.HP;
if (!HP) console.error('liquid.js 未加载：液体封面不渲染（线上由入口页 /liquid.js 提供）');

/** 库 → 液体的入参。url 只用来让 liquid.js 判类型（/app/ 天蓝、/r/ 绿），与入口页里同一个库的链接同形 */
export function liquidEntry({ kind, name, displayLabel, description }) {
  return {
    name: displayLabel || name,
    description: description || '',
    url: kind === 'resource' ? `/r/${name}` : `/app/${name}`,
  };
}

/** 一批静态封面（data URL）。整批一次生成：每生成一次开一个 WebGL 上下文，逐张调会顶到浏览器上限 */
export function liquidCovers(entries) {
  return HP ? HP.covers(entries) : entries.map(() => '');
}

/** 在 canvas 上跑实时液体；返回停止函数（卸载时必须调用，释放 WebGL 上下文） */
export function mountLiquid(canvas, entry) {
  if (!HP) return () => {};
  const fit = () => {
    const k = Math.min(devicePixelRatio || 1, 1.5) * LIQUID_RES;
    canvas.width = Math.round(canvas.clientWidth * k);
    canvas.height = Math.round(canvas.clientHeight * k);
  };
  fit();
  const L = HP.liquid(canvas);
  if (!L) {
    console.error('WebGL 不可用：液体不渲染');
    return () => {};
  }
  const p = L.params(entry);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stop = HP.loop((_dt, now) => L.draw(reduced ? 20 : now / 1000, p, p, 0));
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  return () => {
    stop();
    ro.disconnect();
    L.dispose();
  };
}
