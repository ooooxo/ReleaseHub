/**
 * 对外分享页（应用版本 / 单文件落地 / 资源库 / 目录浏览 / 临时文件 / 404）的服务端渲染。
 * 风格与 ooooxo.com 入口页同一套：中性夜色、墨色三级、左对齐大标题、数据成胶囊、白色胶囊主按钮。
 * 全部页面共用 PAGE_CSS + shell()；每个 render* 只写自己的内容。系统字体栈，不连外部 CDN（ADR-0001）。
 */
const { fmtBytesServer, fileBadgeLabel } = require('./download-utils');

/* 类型色：与入口页、管理端胶囊同色——应用天蓝、资源库绿、临时文件琥珀（有期限） */
const KIND = {
  app: { label: '应用', color: '#38bdf8' },
  resource: { label: '资源库', color: '#34d399' },
  temp: { label: '临时文件', color: '#fbbf24' },
};

const PAGE_CSS = `
:root {
  --night: #0c0c0e; --ink: #f2f3f5; --ink-2: #9ba1ac; --ink-3: #5d646f; --line: rgba(242, 243, 245, .09);
  --raise: rgba(255, 255, 255, .03); --raise-hover: rgba(255, 255, 255, .055);
  --font: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif;
  --mono: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1); --ease-hover: cubic-bezier(0.4, 0, 0.2, 1);
  --pad: 40px; --radius: 14px;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--night); color: var(--ink); font-family: var(--font); -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: none; }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; border-radius: 6px; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; }

.page { max-width: 1120px; margin: 0 auto; padding: 0 var(--pad) 64px; min-height: 100vh; display: flex; flex-direction: column; }
.brandrow { padding: 28px 0; }
.wm { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }
.main { flex: 1; display: flex; flex-direction: column; gap: 44px; padding-top: 7vh; }
.page.single .main { justify-content: center; padding: 0 0 12vh; }

.hero { display: flex; flex-direction: column; gap: 18px; max-width: 760px; }
h1 { margin: 0; font-size: clamp(40px, 5.2vw, 76px); line-height: 1.04; font-weight: 650; letter-spacing: -0.045em; overflow-wrap: anywhere; }
/* 标题是长文件名时降一档：大字号只给短名字，长串在手机上会断成五六行 */
h1.long { font-size: clamp(28px, 3.2vw, 44px); line-height: 1.18; letter-spacing: -0.025em; }
.desc { font-size: 16px; line-height: 1.7; color: var(--ink-2); max-width: 620px; }
.fname { font-family: var(--mono); font-size: 13px; color: var(--ink-3); overflow-wrap: anywhere; }

.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font-size: 12px; line-height: 1.5; padding: 4px 10px; border-radius: 99px; background: rgba(255, 255, 255, .06); color: var(--ink-2); white-space: nowrap; }
.chip.k { color: var(--kc); background: color-mix(in srgb, var(--kc) 14%, transparent); }

.acts { display: flex; flex-wrap: wrap; gap: 10px; }
.btn { height: 44px; padding: 0 20px; border-radius: 22px; border: 0; display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex: none;
  font: inherit; font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer;
  transition: background .16s var(--ease-hover), color .16s var(--ease-hover), opacity .16s var(--ease-hover), transform .12s var(--ease-out); }
.btn:active { transform: scale(.97); }
.btn.p { background: var(--ink); color: var(--night); }
.btn.p:hover { opacity: .88; }
.btn.g { background: rgba(255, 255, 255, .06); color: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line); }
.btn.g:hover { color: var(--ink); background: rgba(255, 255, 255, .09); }
.btn.sm { height: 34px; padding: 0 14px; border-radius: 17px; font-size: 13px; }
.btn svg { width: 14px; height: 14px; }

/* 版本页的文件清单：一行一个文件，行与行之间一条线 */
.files { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.file { display: flex; align-items: center; gap: 12px 16px; padding: 16px 0; border-bottom: 1px solid var(--line); }
.file .nm { flex: 1; min-width: 0; font-size: 15px; font-weight: 550; overflow-wrap: anywhere; transition: color .16s var(--ease-hover); }
.file .nm:hover { color: var(--ink-2); }

/* 资源库 / 目录：一项一卡 */
.bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 16px; }
.crumbs { font-size: 14px; color: var(--ink-3); overflow-wrap: anywhere; line-height: 1.6; }
.crumbs a { color: var(--ink-2); transition: color .16s var(--ease-hover); }
.crumbs a:hover { color: var(--ink); }
.crumbs .cur { color: var(--ink); font-weight: 600; }
.crumbs .sep { margin: 0 6px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.card { display: flex; flex-direction: column; gap: 10px; padding: 18px 18px 14px; border-radius: var(--radius); background: var(--raise); box-shadow: inset 0 0 0 1px var(--line);
  transition: background .16s var(--ease-hover); }
.card:hover { background: var(--raise-hover); }
.card .top { display: flex; align-items: baseline; gap: 10px; }
.card .ttl { flex: 1; min-width: 0; font-size: 17px; font-weight: 650; letter-spacing: -0.015em; line-height: 1.3; overflow-wrap: anywhere; }
.card .ttl:hover { color: var(--ink-2); }
.card .ver { font-family: var(--mono); font-size: 12px; color: var(--ink-3); flex: none; }
.card .cdesc { font-size: 14px; line-height: 1.65; color: var(--ink-2); }
.card .foot { margin-top: auto; padding-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card .sz { font-family: var(--mono); font-size: 13px; color: var(--ink-3); }
.folder { display: flex; align-items: center; gap: 12px; }
.folder svg { width: 22px; height: 22px; color: var(--kc); flex: none; }
.empty { padding: 40px 0; color: var(--ink-3); font-size: 14px; border-top: 1px solid var(--line); }

@media (max-width: 760px) {
  :root { --pad: 22px; }
  .brandrow { padding: 20px 0; }
  .main { gap: 32px; padding-top: 3vh; }
  .page.single .main { padding-bottom: 8vh; }
  h1 { font-size: clamp(34px, 10vw, 46px); }
  h1.long { font-size: 26px; }
  .desc { font-size: 15px; }
  .page.single .acts .btn { flex: 1; }
  .file { flex-wrap: wrap; }
  .file .nm { flex-basis: 100%; }
  .file .chips { flex: 1; }
  .grid { grid-template-columns: 1fr; }
}
`;

const GLYPH = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6a2 2 0 0 1 1.5.68L12 7.2h6.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>',
};

function htmlEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 多行纯文本：先 HTML 转义再换行变 br */
function formatPlainMultiline(s) {
  return htmlEsc(String(s || ''))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br />');
}

const descHtml = s => (s && String(s).trim() ? `<div class="desc">${formatPlainMultiline(String(s).trim())}</div>` : '');
const chip = (text, cls = '') => `<span class="chip${cls ? ` ${cls}` : ''}">${htmlEsc(text)}</span>`;
const kindChip = kind => `<span class="chip k">${KIND[kind].label}</span>`;
const sizeChip = size => chip(fmtBytesServer(size), 'num');
// 平台胶囊只在能认出平台时出现（WIN / MAC / LINUX / SIG）；认不出的 FILE 不带信息
const platformChip = badge => (badge.cls === 'file' ? '' : chip(badge.label));
const LONG_TITLE = 24;   // 超过这么多字的标题按 h1.long 排
const titleH1 = t => `<h1${[...String(t)].length > LONG_TITLE ? ' class="long"' : ''}>${htmlEsc(t)}</h1>`;
const verChip = v => (v != null && String(v).trim() ? chip(String(v).trim(), 'num') : '');

/** favicon：夜色方块 + 类型色首字（支持中文等多字节） */
function faviconHref(label, kind) {
  const first = [...String(label || '').trim()][0] || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0c0c0e"/><rect x=".5" y=".5" width="31" height="31" rx="7.5" fill="none" stroke="#ffffff" stroke-opacity=".1"/><text x="16" y="21.5" text-anchor="middle" fill="${KIND[kind].color}" font-size="16" font-weight="700" font-family="system-ui,sans-serif">${htmlEsc(first)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** 所有分享页的外壳：顶部字标 + 主区。layout = 'single'（单幅，竖向居中）| 'list'（标题区 + 列表） */
function shell({ title, kind, iconLabel, layout, main, script = '' }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<link rel="icon" href="${faviconHref(iconLabel, kind)}" type="image/svg+xml">
<title>${htmlEsc(title)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="page ${layout}" style="--kc:${KIND[kind].color}">
  <header class="brandrow"><span class="wm">ooooxo</span></header>
  <main class="main">${main}</main>
</div>
${script}
</body>
</html>`;
}

const dlButton = (href, cls, label = '下载') =>
  `<a class="btn ${cls}" href="${htmlEsc(href)}" download rel="noopener">${GLYPH.arrow}${label}</a>`;

function renderNotice(title, text, kind = 'app') {
  return shell({
    title: `${title} — ooooxo`,
    kind,
    iconLabel: '!',
    layout: 'single',
    main: `<section class="hero"><h1>${htmlEsc(title)}</h1><div class="desc">${htmlEsc(text)}</div></section>`,
  });
}

function renderDownload404Html() {
  return renderNotice('文件不存在', '它可能已被删除，或者链接有误。');
}

/** 应用单文件落地页 */
function renderDownloadPageHtml(opts) {
  const { displayLabel, version, filename, size, badge, downloadHref } = opts;
  return shell({
    title: `${displayLabel} · ${version} — ${filename}`,
    kind: 'app',
    iconLabel: displayLabel,
    layout: 'single',
    main: `<section class="hero">
    <div class="chips">${kindChip('app')}${verChip(version)}${platformChip(badge)}${sizeChip(size)}</div>
    <h1>${htmlEsc(displayLabel)}</h1>
    <div class="fname">${htmlEsc(filename)}</div>
    <div class="acts">${dlButton(downloadHref, 'p', '立即下载')}</div>
  </section>`,
  });
}

/** 公开「应用 + 版本」页：文件名进落地页，行尾直链下载；不展示包名，可展示简介 */
function renderVersionBrowserHtml(opts) {
  const { displayLabel, version, files, description } = opts;
  const list = files || [];
  // 只有一个文件时它就是本页唯一的主操作；多个文件时每行平级
  const btnCls = list.length === 1 ? 'p sm' : 'g sm';
  const rows = list
    .map(
      f => `<li class="file">
      <a class="nm" href="${htmlEsc(f.landingHref)}">${htmlEsc(f.name)}</a>
      <span class="chips">${platformChip(fileBadgeLabel(f.name))}${sizeChip(f.size)}</span>
      ${dlButton(f.directHref, btnCls)}
    </li>`,
    )
    .join('');
  return shell({
    title: `${displayLabel} · ${version}`.trim(),
    kind: 'app',
    iconLabel: displayLabel,
    layout: 'list',
    main: `<section class="hero">
    <div class="chips">${kindChip('app')}${verChip(version)}</div>
    <h1>${htmlEsc(displayLabel)}</h1>
    ${descHtml(description)}
  </section>
  ${rows ? `<ul class="files">${rows}</ul>` : '<div class="empty">这个版本还没有文件</div>'}`,
  });
}

function buildResourceFileCardHtml(it) {
  const title = (it.displayName && String(it.displayName).trim()) || it.fileName;
  const ver = it.version != null && String(it.version).trim() ? `<span class="ver">${htmlEsc(String(it.version).trim())}</span>` : '';
  const fname = it.fileName && String(title) !== String(it.fileName) ? `<div class="fname">${htmlEsc(it.fileName)}</div>` : '';
  const desc = it.description && String(it.description).trim() ? `<div class="cdesc">${formatPlainMultiline(String(it.description).trim())}</div>` : '';
  return `<article class="card">
    <div class="top"><a class="ttl" href="${htmlEsc(it.landingHref || it.directHref || '#')}">${htmlEsc(title)}</a>${ver}</div>
    ${fname}${desc}
    <div class="foot"><span class="sz">${htmlEsc(fmtBytesServer(it.size))}</span>${dlButton(it.directHref, 'g sm')}</div>
  </article>`;
}

function buildFolderCardHtml(f) {
  return `<article class="card">
    <div class="top"><a class="folder ttl" href="${htmlEsc(f.browseUrl || '#')}">${GLYPH.folder}<span>${htmlEsc(f.name)}</span></a></div>
    <div class="foot"><span class="sz">文件夹</span><a class="btn g sm" href="${htmlEsc(f.archiveUrl || '#')}">打包 ZIP</a></div>
  </article>`;
}

/** 资源库公开页：一项一卡 */
function renderResourceLibraryHtml(opts) {
  const { displayLabel, description, items } = opts;
  const list = items || [];
  return shell({
    title: `${displayLabel} — 资源库`,
    kind: 'resource',
    iconLabel: displayLabel,
    layout: 'list',
    main: `<section class="hero">
    <div class="chips">${kindChip('resource')}${list.length ? chip(`${list.length} 个文件`) : ''}</div>
    <h1>${htmlEsc(displayLabel)}</h1>
    ${descHtml(description)}
  </section>
  ${list.length ? `<div class="grid">${list.map(buildResourceFileCardHtml).join('')}</div>` : '<div class="empty">这个资源库还是空的</div>'}`,
  });
}

/** 资源库单文件落地页 */
function renderResourceItemLandingHtml(opts) {
  const { libraryName, displayTitle, itemVersion, filename, description, size, badge, downloadHref } = opts;
  const title = displayTitle || filename;
  return shell({
    title: `${title} — ${libraryName}`,
    kind: 'resource',
    iconLabel: title,
    layout: 'single',
    main: `<section class="hero">
    <div class="chips">${kindChip('resource')}${chip(libraryName)}${verChip(itemVersion)}${platformChip(badge)}${sizeChip(size)}</div>
    ${titleH1(title)}
    ${descHtml(description)}
    ${String(title) !== String(filename) ? `<div class="fname">${htmlEsc(filename)}</div>` : ''}
    <div class="acts">${dlButton(downloadHref, 'p', '立即下载')}</div>
  </section>`,
  });
}

/** 内联脚本：在 data-expire-ms 的 #countdown-box 上更新剩余时间文案 */
const countdownScript = `<script>
(function(){
  var el = document.getElementById("countdown-box");
  if (!el) return;
  var exp = parseInt(el.getAttribute("data-expire-ms"), 10) || 0;
  function fmt(s) {
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (d > 0) return "剩 " + d + " 天 " + h + " 小时";
    if (h > 0) return "剩 " + h + " 小时 " + m + " 分";
    if (m > 0) return "剩 " + m + " 分 " + sec + " 秒";
    return "剩 " + sec + " 秒";
  }
  function tick() {
    var left = Math.floor((exp - Date.now()) / 1000);
    if (left <= 0) { el.textContent = "已过期"; return; }
    el.textContent = fmt(left);
    setTimeout(tick, 1000);
  }
  tick();
})();<\/script>`;

/** 临时文件 · 单文件页：剩余时间是本页的状态，放在类型胶囊旁 */
function renderTempTransferInfoPageHtml(opts) {
  const { filename, displayTitle, size, badge, directDownloadHref, expireAtMs } = opts;
  const t = String(displayTitle || filename);
  return shell({
    title: `${t} — 临时文件`,
    kind: 'temp',
    iconLabel: t,
    layout: 'single',
    main: `<section class="hero">
    <div class="chips">${kindChip('temp')}<span class="chip k" id="countdown-box" data-expire-ms="${String(Math.floor(expireAtMs))}">—</span>${platformChip(badge)}${sizeChip(size)}</div>
    ${titleH1(t)}
    <div class="desc">到期后链接失效，文件从服务器删除。</div>
    <div class="acts">${dlButton(directDownloadHref, 'p', '立即下载')}</div>
  </section>`,
    script: countdownScript,
  });
}

function renderTempTransferGoneHtml() {
  return renderNotice('链接已失效', '这个临时文件已过期或被删除。', 'temp');
}

/** 资源库 / 临时文件：目录浏览（逐个下载 + 整个目录打包 ZIP） */
function renderFolderBrowseHtml(opts) {
  const { kind = 'resource', displayLabel, description, breadcrumbs = [], archiveUrl, folders = [], files = [] } = opts;
  const crumbs = breadcrumbs
    .map((c, i) =>
      i === breadcrumbs.length - 1
        ? `<span class="cur">${htmlEsc(c.label)}</span>`
        : `<a href="${htmlEsc(c.browseHref || c.href || '#')}">${htmlEsc(c.label)}</a><span class="sep">/</span>`,
    )
    .join('');
  const cards = (folders || []).map(buildFolderCardHtml).join('') + (files || []).map(buildResourceFileCardHtml).join('');
  return shell({
    title: `${displayLabel} — ${KIND[kind].label}`,
    kind,
    iconLabel: displayLabel,
    layout: 'list',
    main: `<section class="hero">
    <div class="chips">${kindChip(kind)}</div>
    <h1>${htmlEsc(displayLabel)}</h1>
    ${descHtml(description)}
  </section>
  <div class="bar">
    <nav class="crumbs" aria-label="路径">${crumbs}</nav>
    <a class="btn p sm" href="${htmlEsc(archiveUrl)}">${GLYPH.arrow}打包下载此目录</a>
  </div>
  ${cards ? `<div class="grid">${cards}</div>` : '<div class="empty">这个目录是空的</div>'}`,
  });
}

module.exports = {
  htmlEsc,
  renderDownload404Html,
  renderDownloadPageHtml,
  renderVersionBrowserHtml,
  renderResourceLibraryHtml,
  renderResourceItemLandingHtml,
  renderFolderBrowseHtml,
  renderTempTransferInfoPageHtml,
  renderTempTransferGoneHtml,
};
