import { useAuthStore } from '@/stores/auth';
import router from '@/router';

function redirectToLoginIfNeeded() {
  const r = router.currentRoute.value;
  if (r.meta.requiresAuth) {
    router.replace({ name: 'login', query: { redirect: r.fullPath } });
  }
}

/** 与 Vite base 一致，保证子路径部署下 /api 经 Nginx 前缀转发 */
function appBase() {
  const b = import.meta.env.BASE_URL || '/';
  return b.endsWith('/') ? b : `${b}/`;
}

function apiUrl(p) {
  if (p.startsWith('http')) return p;
  const rel = p.startsWith('/') ? p.slice(1) : p;
  return `${appBase()}${rel}`;
}

/**
 * 大文件 XHR 的目标 URL。
 *
 * 为何不用「始终同源」的 apiUrl：
 * - `npm run build` 后 `import.meta.env.DEV` 为 false，若经 Vite 预览(4173) 或反代/ CDN，体积分支常见为 1MB(Nginx 默认) 或 100MB(部分 CDN)，会在到达 Node 前 413。
 * - 在本地 5173/4173 时直连 Node（与 server 默认 PORT 一致），可绕过前端的 dev/preview 代理体积分支。
 * - 生产部署：`deploy.sh` 在启用上传分流时会构建注入 `VITE_UPLOAD_API_ORIGIN`（如 `https://upload.example.com`）。
 * - 手动自托管也可设该变量指向能直达 Node 的根地址（绕过 CDN / 反代体积分支）。
 */
function uploadXhrUrl(p) {
  if (p.startsWith('http')) return p;
  let path = p.startsWith('/') ? p : `/${p}`;
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
  if (basePath && path.startsWith(`${basePath}/`)) {
    path = path.slice(basePath.length) || '/';
  }
  if (import.meta.env.VITE_UPLOAD_SAME_ORIGIN === '1') {
    return apiUrl(path);
  }
  const explicit = String(import.meta.env.VITE_UPLOAD_API_ORIGIN || '').trim().replace(/\/$/, '');
  if (explicit) {
    return `${explicit}${path.startsWith('/') ? path : `/${path}`}`;
  }
  const localPorts = (import.meta.env.VITE_BYPASS_PROXY_UPLOAD_PORTS || '5173,4173')
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
  const isLocal = typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  const isBypassPort =
    typeof location !== 'undefined' && location.port && localPorts.includes(location.port);
  if (import.meta.env.DEV || (isLocal && isBypassPort)) {
    const o = (import.meta.env.VITE_DEV_UPLOAD_ORIGIN || 'http://127.0.0.1:3721').replace(/\/$/, '');
    return `${o}${path.startsWith('/') ? path : `/${path}`}`;
  }
  return apiUrl(path);
}

export async function api(method, path, body = null, options = {}) {
  const auth = useAuthStore();
  const headers = { ...options.headers };
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  const isForm = body instanceof FormData;
  if (body != null && !isForm && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body == null ? undefined : isForm ? body : JSON.stringify(body),
    signal: options.signal,
  });

  if (res.status === 401) {
    auth.logout();
    redirectToLoginIfNeeded();
    throw new Error('未授权');
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    if (data != null) err.data = data;
    throw err;
  }

  // 204 No Content
  if (res.status === 204) return null;

  return data;
}

/**
 * XMLHttpRequest 上传，带真实进度（0–100）
 */
export function uploadWithProgress({ method, path: p, formData, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const auth = useAuthStore();
    xhr.open(method, uploadXhrUrl(p), true);
    if (auth.token) xhr.setRequestHeader('Authorization', `Bearer ${auth.token}`);

    if (signal) {
      const onAbort = () => {
        xhr.abort();
        reject(new Error('已取消'));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      xhr.onloadend = () => signal.removeEventListener('abort', onAbort);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      } else if (onProgress) {
        onProgress(-1);
      }
    };

    xhr.onload = () => {
      const text = xhr.responseText || '';
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }
      if (xhr.status === 401) {
        auth.logout();
        redirectToLoginIfNeeded();
        reject(new Error('未授权'));
        return;
      }
      if (xhr.status >= 400) {
        const msg =
          data && typeof data === 'object' && !data.raw
            ? data.error || data.message
            : null;
        let hint = '';
        if (data?.raw && String(data.raw).trim().startsWith('<')) {
          hint =
            xhr.status === 413
              ? '（413 且为 HTML：常见为 Nginx 请求体上限默认 1m、或 Cloudflare 等约 100MB 限制；请在反代 location 内设 client_max_body_size，或构建时设 VITE_UPLOAD_API_ORIGIN 直连 Node）'
              : '（响应为 HTML，多为代理未转发到后端或路径前缀不匹配）';
        }
        const e = new Error(msg ? `${msg}${hint}` : `HTTP ${xhr.status}${hint}`);
        e.status = xhr.status;
        if (data && typeof data === 'object' && !data.raw) e.data = data;
        reject(e);
        return;
      }
      if (data && typeof data === 'object' && data.raw != null && !('uploaded' in data)) {
        const snippet = String(data.raw).slice(0, 120).replace(/\s+/g, ' ');
        reject(
          new Error(
            `服务器返回非 JSON（可能是前端路由回退页）: ${snippet}${snippet.length >= 120 ? '…' : ''}`,
          ),
        );
        return;
      }
      if (typeof onProgress === 'function') onProgress(100);
      resolve(data);
    };

    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.onabort = () => reject(new Error('已取消'));

    xhr.send(formData);
  });
}

/* ===========================================================================
 * 断点续传（tus 协议）手写客户端。见 docs/adr/0005。
 * 切片 + PATCH(Upload-Offset) + HEAD 续传 + 指数退避重试，零第三方依赖。
 * 续传身份：localStorage 按 name|size|mtime|target 存 tus 上传 id（轻指纹，不做秒传）。
 * =========================================================================== */

const TUS_ENDPOINT = '/api/upload/tus';
const TUS_CHUNK_SIZE = 8 * 1024 * 1024; // 8MB
const TUS_MAX_RETRIES = 5;

function tusAbortError() {
  const e = new Error('已取消');
  e.name = 'AbortError';
  e.aborted = true;
  return e;
}

/** UTF-8 安全的 base64（Upload-Metadata 值，支持中文文件名） */
function b64utf8(str) {
  return btoa(unescape(encodeURIComponent(String(str))));
}

function encodeTusMetadata(meta) {
  return Object.entries(meta)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k} ${b64utf8(v)}`)
    .join(',');
}

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* quota/private */ } }
function lsDel(k) { try { localStorage.removeItem(k); } catch { /* noop */ } }

function fingerprintKey(file, target) {
  return `tus::${target}::${file.name}::${file.size}::${file.lastModified}`;
}

function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
}

/** 可中断的指数退避（带抖动） */
function tusBackoff(attempt, signal) {
  const ms = Math.min(1000 * 2 ** (attempt - 1), 15000) + Math.random() * 300;
  return new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(t); reject(tusAbortError()); };
    const t = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal) {
      if (signal.aborted) { clearTimeout(t); return reject(tusAbortError()); }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/** 底层 XHR：resolve({status,getHeader,responseText})；abort→AbortError；网络错→Error */
function tusXhr({ method, url, headers, body, signal, onLoaded }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    for (const [k, v] of Object.entries(headers || {})) xhr.setRequestHeader(k, v);
    if (signal) {
      if (signal.aborted) { try { xhr.abort(); } catch {} return reject(tusAbortError()); }
      const onAbort = () => { try { xhr.abort(); } catch {} };
      signal.addEventListener('abort', onAbort, { once: true });
      xhr.onloadend = () => signal.removeEventListener('abort', onAbort);
    }
    if (onLoaded && xhr.upload) {
      xhr.upload.onprogress = e => { if (e.lengthComputable) onLoaded(e.loaded); };
    }
    xhr.onload = () => resolve({
      status: xhr.status,
      getHeader: h => xhr.getResponseHeader(h),
      responseText: xhr.responseText || '',
    });
    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.onabort = () => reject(tusAbortError());
    xhr.send(body == null ? null : body);
  });
}

function tusParseBody(res) {
  if (!res.responseText) return {};
  try { return JSON.parse(res.responseText); } catch { return { raw: res.responseText }; }
}

function tusError(res, fallback) {
  const data = tusParseBody(res);
  const msg = (data && !data.raw && (data.error || data.message)) || fallback || `HTTP ${res.status}`;
  const e = new Error(msg);
  e.status = res.status;
  return e;
}

function handleUnauthorized() {
  const auth = useAuthStore();
  auth.logout();
  redirectToLoginIfNeeded();
}

/**
 * 单文件断点续传上传。完成后 resolve 服务端 onUploadFinish 返回的 JSON。
 * @param {{ surface:string, file:File, metadata?:object, onProgress?:(pct:number)=>void, signal?:AbortSignal }} opts
 */
export async function uploadResumable({ surface, file, metadata = {}, onProgress, signal }) {
  const auth = useAuthStore();
  const authHeaders = () => (auth.token ? { Authorization: `Bearer ${auth.token}` } : {});
  const size = file.size;
  const target = `${surface}:${metadata.app || metadata.name || metadata.batchId || ''}:${metadata.version || ''}:${metadata.relPath || metadata.filename || file.name}`;
  const key = fingerprintKey(file, target);
  const headUrl = id => uploadXhrUrl(`${TUS_ENDPOINT}/${id}`);
  const pct = bytes => { if (onProgress) onProgress(Math.min(100, Math.round((bytes / (size || 1)) * 100))); };

  let id = lsGet(key);
  let offset = 0;

  // 续传：HEAD 取已传 offset
  if (id) {
    try {
      const head = await tusXhr({ method: 'HEAD', url: headUrl(id), headers: { 'Tus-Resumable': '1.0.0', ...authHeaders() }, signal });
      if (head.status >= 200 && head.status < 300) {
        offset = parseInt(head.getHeader('Upload-Offset') || '0', 10) || 0;
      } else {
        id = null; lsDel(key);
      }
    } catch (e) {
      if (e.aborted) throw e;
      id = null; lsDel(key);
    }
  }

  // 新建会话
  if (!id) {
    const meta = encodeTusMetadata({ surface, filename: file.name, mime: file.type, ...metadata });
    const create = await tusXhr({
      method: 'POST', url: uploadXhrUrl(TUS_ENDPOINT),
      headers: { 'Tus-Resumable': '1.0.0', 'Upload-Length': String(size), 'Upload-Metadata': meta, ...authHeaders() },
      signal,
    });
    if (create.status === 401) { handleUnauthorized(); throw tusError(create, '未授权'); }
    if (create.status !== 201) throw tusError(create, '创建上传失败');
    id = (create.getHeader('Location') || '').split('/').filter(Boolean).pop();
    if (!id) throw new Error('服务器未返回上传地址');
    lsSet(key, id);
    offset = 0;
  }

  pct(offset);

  // 空文件：tus 在创建即完成，补一次 HEAD 取结果（onUploadFinish 的 body 不在 HEAD 上，故直接拉 meta 不可得）
  if (size === 0 && offset === 0) {
    const res = await tusXhr({
      method: 'PATCH', url: headUrl(id),
      headers: { 'Tus-Resumable': '1.0.0', 'Upload-Offset': '0', 'Content-Type': 'application/offset+octet-stream', ...authHeaders() },
      body: new Blob([]), signal,
    });
    lsDel(key);
    if (res.status >= 400) throw tusError(res, '上传失败');
    return tusParseBody(res);
  }

  let attempt = 0;
  while (offset < size) {
    const end = Math.min(offset + TUS_CHUNK_SIZE, size);
    const chunk = file.slice(offset, end);
    const base = offset;
    let res;
    try {
      res = await tusXhr({
        method: 'PATCH', url: headUrl(id),
        headers: { 'Tus-Resumable': '1.0.0', 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream', ...authHeaders() },
        body: chunk, signal,
        onLoaded: loaded => pct(base + loaded),
      });
    } catch (e) {
      if (e.aborted) throw e;
      if (++attempt > TUS_MAX_RETRIES) throw e;
      await tusBackoff(attempt, signal);
      offset = await tusResyncOffset(id, headUrl, authHeaders, offset, signal, key);
      continue;
    }
    if (res.status === 401) { handleUnauthorized(); throw tusError(res, '未授权'); }
    if (res.status === 404 || res.status === 410) { lsDel(key); throw tusError(res, '上传已过期，请重新上传'); }
    if (res.status >= 400) {
      if (++attempt > TUS_MAX_RETRIES) throw tusError(res, '上传失败');
      await tusBackoff(attempt, signal);
      offset = await tusResyncOffset(id, headUrl, authHeaders, offset, signal, key);
      continue;
    }
    attempt = 0;
    const next = parseInt(res.getHeader('Upload-Offset') || String(end), 10);
    offset = Number.isFinite(next) ? next : end;
    pct(offset);
    if (offset >= size) { lsDel(key); return tusParseBody(res); }
  }
  lsDel(key);
  return {};
}

/** 重试前用 HEAD 重新对齐服务端 offset；上传已不存在则抛错重传 */
async function tusResyncOffset(id, headUrl, authHeaders, current, signal, key) {
  try {
    const h = await tusXhr({ method: 'HEAD', url: headUrl(id), headers: { 'Tus-Resumable': '1.0.0', ...authHeaders() }, signal });
    if (h.status >= 200 && h.status < 300) {
      return parseInt(h.getHeader('Upload-Offset') || String(current), 10) || current;
    }
    if (h.status === 404 || h.status === 410) { lsDel(key); throw tusError(h, '上传已过期，请重新上传'); }
  } catch (e) {
    if (e.aborted || e.status) throw e;
  }
  return current;
}

/** 并发池：tasks 为返回 Promise 的函数数组 */
async function tusPool(tasks, concurrency, signal) {
  const results = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      if (signal && signal.aborted) throw tusAbortError();
      const idx = cursor++;
      if (idx >= tasks.length) return;
      results[idx] = await tasks[idx]();
    }
  }
  const n = Math.max(1, Math.min(concurrency, tasks.length));
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

/** 聚合多文件进度 → 单一 0–100 */
function aggregateProgress(items, onProgress) {
  const total = items.reduce((s, it) => s + (it.file.size || 0), 0) || 1;
  const loaded = new Array(items.length).fill(0);
  return idx => pct => {
    loaded[idx] = (pct / 100) * (items[idx].file.size || 0);
    if (onProgress) onProgress(Math.min(100, Math.round((loaded.reduce((a, b) => a + b, 0) / total) * 100)));
  };
}

function baseName(rel) {
  return String(rel || '').split('/').pop();
}

/** App 版本：N 文件并发续传，聚合进度，返回 { uploaded } */
export async function uploadAppVersionResumable({ app, version, items, onProgress, signal, concurrency = 3 }) {
  const prog = aggregateProgress(items, onProgress);
  const tasks = items.map((it, idx) => () => uploadResumable({
    surface: 'app', file: it.file,
    metadata: { app, version, filename: baseName(it.relativePath || it.file.name) },
    onProgress: prog(idx), signal,
  }));
  const results = await tusPool(tasks, concurrency, signal);
  return { uploaded: results.flatMap(r => (r && r.uploaded) || []) };
}

/** 资源库：保留相对路径，N 文件并发续传，返回 { uploaded } */
export async function uploadResourceResumable({ name, items, onProgress, signal, concurrency = 3 }) {
  const prog = aggregateProgress(items, onProgress);
  const tasks = items.map((it, idx) => () => uploadResumable({
    surface: 'resource', file: it.file,
    metadata: { name, relPath: it.relativePath || it.file.name, filename: baseName(it.relativePath || it.file.name) },
    onProgress: prog(idx), signal,
  }));
  const results = await tusPool(tasks, concurrency, signal);
  return { uploaded: results.flatMap(r => (r && r.uploaded) || []) };
}

/** 临时文件：单文件直传记录；多文件/文件夹 → 并发续传后 commit 组装文件夹记录 */
export async function uploadTempResumable({ items, ttlMinutes, folderName, onProgress, signal, concurrency = 3 }) {
  const isFolder = items.length > 1 || items.some(it => String(it.relativePath || '').includes('/'));
  const prog = aggregateProgress(items, onProgress);
  if (!isFolder) {
    const it = items[0];
    return uploadResumable({
      surface: 'temp', file: it.file,
      metadata: { kind: 'file', filename: it.file.name, ttlMinutes },
      onProgress: prog(0), signal,
    });
  }
  const batchId = randomHex(16);
  const tasks = items.map((it, idx) => () => uploadResumable({
    surface: 'temp', file: it.file,
    metadata: { kind: 'folder', batchId, relPath: it.relativePath || it.file.name, filename: baseName(it.relativePath || it.file.name), ttlMinutes },
    onProgress: prog(idx), signal,
  }));
  await tusPool(tasks, concurrency, signal);
  const fallbackName = String(items[0].relativePath || '').split('/')[0] || '文件夹';
  return api('POST', '/api/temp-transfer/commit', {
    batchId, folderName: folderName || fallbackName, ttlMinutes,
  });
}

/* ───────── 智能路由：按服务端开关在续传 / 旧整包上传间自动选择 ───────── */

let _resumableMode = null; // null=未知, true/false
export async function ensureUploadMode() {
  if (_resumableMode !== null) return _resumableMode;
  try {
    const sys = await api('GET', '/api/system');
    _resumableMode = sys && sys.uploadResumable === true;
  } catch {
    _resumableMode = false; // 取不到则回落旧路径（始终可用）
  }
  return _resumableMode;
}

/** 旧整包 multipart 上传（回落用） */
function legacyMultipart({ method, path, items, fileField = 'files', fields = {}, onProgress, signal }) {
  const fd = new FormData();
  for (const it of items) fd.append(fileField, it.file, it.relativePath || it.file.name);
  for (const [k, v] of Object.entries(fields)) if (v != null) fd.append(k, String(v));
  return uploadWithProgress({ method, path, formData: fd, onProgress, signal });
}

/** App 版本上传：续传或回落，统一返回 { uploaded } */
export async function uploadAppVersion({ app, version, items, onProgress, signal }) {
  if (await ensureUploadMode()) return uploadAppVersionResumable({ app, version, items, onProgress, signal });
  return legacyMultipart({
    method: 'POST',
    path: `/api/apps/${encodeURIComponent(app)}/versions/${encodeURIComponent(version)}/upload`,
    items, onProgress, signal,
  });
}

/** 资源库上传：续传或回落，统一返回 { uploaded } */
export async function uploadResource({ name, items, onProgress, signal }) {
  if (await ensureUploadMode()) return uploadResourceResumable({ name, items, onProgress, signal });
  return legacyMultipart({
    method: 'POST',
    path: `/api/resources/${encodeURIComponent(name)}/upload`,
    items, onProgress, signal,
  });
}

/** 临时文件上传：续传或回落，统一返回记录（含 id/token/url） */
export async function uploadTemp({ items, ttlMinutes, folderName, onProgress, signal }) {
  if (await ensureUploadMode()) return uploadTempResumable({ items, ttlMinutes, folderName, onProgress, signal });
  const isFolder = items.length > 1 || items.some(it => String(it.relativePath || '').includes('/'));
  if (isFolder) {
    return legacyMultipart({
      method: 'POST', path: '/api/temp-transfer/upload', items, fileField: 'files',
      fields: { ttlMinutes, folderName }, onProgress, signal,
    });
  }
  return legacyMultipart({
    method: 'POST', path: '/api/temp-transfer/upload', items: [items[0]], fileField: 'file',
    fields: { ttlMinutes }, onProgress, signal,
  });
}
