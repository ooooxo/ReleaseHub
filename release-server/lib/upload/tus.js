'use strict';

/**
 * 断点续传（tus 协议）服务端。见 docs/adr/0005。
 *
 * 三个上传面统一走一个 tus Server，core 只写一次，差别仅在：
 *  - onUploadCreate：按 surface 鉴权 + 校验目标
 *  - onUploadFinish：把已传完字节 rename 出未完成目录，落进各面最终位置
 *
 * tus 一上传 = 一文件；前端把「文件夹/多文件」编排成 N 个并发会话。
 * 临时「文件夹」先 stage 到 tus-folder-staging/<batchId>，由 POST /commit 组装记录。
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const jwt = require('jsonwebtoken');

const { Server } = require('@tus/server');
const { FileStore } = require('@tus/file-store');

const CONFIG = require('../config');
const { readAppMeta } = require('../meta-notes');
const {
  fileUrl,
  autoUpdateLatestSigOnUpload,
  isSemVer2CoreWithVPrefix,
  isValidGeneralVersionForUpload,
} = require('../releases');
const {
  libraryExists,
  libraryFilesDir,
  ensureLibraryFilesDir,
  registerUpload,
} = require('../resource-libraries');
const { normalizeRelativePath, resolveUnderRoot } = require('../path-utils');
const { getTempTransferStore } = require('../temp-transfer/instance');

const TUS_PATH = '/api/upload/tus';
const STAGING_DIRNAME = 'tus-folder-staging';
/** 无鉴权临时面：单 IP 最多并发未完成会话（粗粒度防滥用，配合 24h GC） */
const TEMP_IP_MAX_INFLIGHT = 20;

const MAX_UPLOAD_BYTES = require('../upload-limits').MAX_UPLOAD_BYTES;

// ───────────────────────── helpers ─────────────────────────

/** 抛出可被 tus 转成 HTTP 响应的错误（带 status_code + JSON body） */
function uploadError(status, msg) {
  return Object.assign(new Error(msg), {
    status_code: status,
    body: JSON.stringify({ error: msg }),
  });
}

/** 单段路径名安全校验（禁止 / \ .. 等） */
function safeSegment(s) {
  if (s == null) return null;
  const v = String(s).trim();
  if (!v || v === '.' || v === '..') return null;
  if (/[\\/]/.test(v) || v.includes('..') || v.includes('\0')) return null;
  return v;
}

/** 从 srvx web Request 取 header（小写键） */
function header(req, name) {
  try {
    return req.headers.get(name);
  } catch {
    return null;
  }
}

function clientIp(req) {
  const xff = header(req, 'x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return header(req, 'x-real-ip') || 'unknown';
}

/** 校验 JWT（存在且有效返回 payload，否则 null） */
function verifyJwt(req) {
  const h = header(req, 'authorization') || '';
  const token = h.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    return jwt.verify(token, CONFIG.JWT_SECRET);
  } catch {
    return null;
  }
}

function checkSize(size, max) {
  if (Number.isFinite(size) && size > max) {
    throw uploadError(413, '文件超过大小限制');
  }
}

/** 跨设备安全的移动：先 rename，EXDEV 退化为 copy+unlink */
async function moveFile(src, dest) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fsp.rename(src, dest);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    await pipeline(fs.createReadStream(src), fs.createWriteStream(dest));
    await fsp.unlink(src).catch(() => {});
  }
}

/** 递归列出目录下所有文件（posix 相对路径） */
async function listFilesRel(root) {
  const out = [];
  async function walk(dir, prefix) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(abs, rel);
      else if (ent.isFile()) out.push(rel);
    }
  }
  await walk(root, '');
  return out;
}

/** 内联 ttl 解析（避免耦合 temp-transfer/routes） */
function parseTtl(cfg, raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, minutes: cfg.defaultTtlMinutes };
  }
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) return { ok: false, error: 'ttlMinutes 必须为正整数' };
  if (!cfg.allowedTtlsMinutes.includes(n)) return { ok: false, error: 'ttlMinutes 不在允许列表中' };
  if (n > cfg.maxTtlMinutes) return { ok: false, error: 'ttlMinutes 超过允许的最大值' };
  return { ok: true, minutes: n };
}

function publicBase() {
  return CONFIG.BASE_URL.replace(/\/$/, '');
}

function tempFilePublic(rec) {
  const base = publicBase();
  const t = encodeURIComponent(rec.token);
  return {
    id: rec.id,
    token: rec.token,
    originalName: rec.originalName,
    size: rec.size,
    createdAt: rec.createdAt,
    expireAt: rec.expireAt,
    landingUrl: `${base}/tt/p/${t}`,
    downloadUrl: `${base}/tt/${t}`,
    metaUrl: `${base}/api/temp-transfer/${t}/meta`,
  };
}

function tempFolderPublic(rec) {
  const base = publicBase();
  const t = encodeURIComponent(rec.token);
  return {
    id: rec.id,
    token: rec.token,
    fileCount: rec.fileCount,
    originalName: rec.originalName,
    size: rec.size,
    createdAt: rec.createdAt,
    expireAt: rec.expireAt,
    landingUrl: `${base}/tt/p/${t}`,
    browseUrl: `${base}/tt/p/${t}`,
    archiveUrl: `${base}/tt/${t}/archive`,
    metaUrl: `${base}/api/temp-transfer/${t}/meta`,
  };
}

// ─────────────────────── IP 并发配额（临时面）───────────────────────

/** @type {Map<string, number>} */
const ipInflight = new Map();

function ipQuotaTake(ip) {
  const n = ipInflight.get(ip) || 0;
  if (n >= TEMP_IP_MAX_INFLIGHT) return false;
  ipInflight.set(ip, n + 1);
  return true;
}
function ipQuotaRelease(ip) {
  const n = ipInflight.get(ip) || 0;
  if (n <= 1) ipInflight.delete(ip);
  else ipInflight.set(ip, n - 1);
}

// ───────────────────────── tus server ─────────────────────────

let _store = null;
let _server = null;

function getFileStore() {
  if (!_store) {
    fs.mkdirSync(CONFIG.UPLOADS_INCOMPLETE_DIR, { recursive: true });
    _store = new FileStore({
      directory: CONFIG.UPLOADS_INCOMPLETE_DIR,
      expirationPeriodInMilliseconds: CONFIG.UPLOAD_INCOMPLETE_TTL_HOURS * 60 * 60 * 1000,
    });
  }
  return _store;
}

function validateAppVersion(app, version) {
  const meta = readAppMeta(app);
  if (meta.repoType === 'tauri') {
    if (!isSemVer2CoreWithVPrefix(version)) {
      throw uploadError(
        400,
        'Tauri 库版本须符合 SemVer 2.0：MAJOR.MINOR.PATCH 三段非负整数，且各位数不可前导零（例 v1.0.0）',
      );
    }
  } else if (!isValidGeneralVersionForUpload(version)) {
    throw uploadError(
      400,
      '通用库版本目录名仅含字母、数字、点、下划线、连字符（不可含 /、\\ 或 ..），长度不超过 120',
    );
  }
}

/** POST：建会话前按 surface 鉴权 + 校验目标 */
async function onUploadCreate(req, upload) {
  const m = upload.metadata || {};
  const surface = m.surface;

  if (surface === 'app') {
    if (!verifyJwt(req)) throw uploadError(401, '未登录或 Token 失效');
    const app = safeSegment(m.app);
    const version = safeSegment(m.version);
    if (!app || !version) throw uploadError(400, '缺少 app/version');
    if (!fs.existsSync(path.join(CONFIG.RELEASES_DIR, app))) throw uploadError(404, 'App 不存在');
    validateAppVersion(app, version);
    if (!normalizeRelativePath(m.filename)) throw uploadError(400, '缺少文件名');
    checkSize(upload.size, MAX_UPLOAD_BYTES);
  } else if (surface === 'resource') {
    if (!verifyJwt(req)) throw uploadError(401, '未登录或 Token 失效');
    const name = safeSegment(m.name);
    if (!name || !libraryExists(name)) throw uploadError(404, '资源库不存在');
    if (!normalizeRelativePath(m.relPath || m.filename)) throw uploadError(400, '无效文件路径');
    checkSize(upload.size, MAX_UPLOAD_BYTES);
  } else if (surface === 'temp') {
    const ttc = CONFIG.TEMP_TRANSFER;
    if (!ttc || !ttc.enabled) throw uploadError(404, '临时传输未启用');
    const p = parseTtl(ttc, m.ttlMinutes);
    if (!p.ok) throw uploadError(422, p.error);
    if (m.kind === 'folder') {
      if (!safeSegment(m.batchId) || !normalizeRelativePath(m.relPath || m.filename)) {
        throw uploadError(400, '文件夹上传缺少 batchId/relPath');
      }
    } else if (!normalizeRelativePath(m.filename)) {
      throw uploadError(400, '缺少文件名');
    }
    checkSize(upload.size, ttc.maxFileSizeBytes);
    if (!ipQuotaTake(clientIp(req))) throw uploadError(429, '并发上传过多，请稍后再试');
  } else {
    throw uploadError(400, '未知上传面 surface');
  }
  return { metadata: upload.metadata };
}

/** 每个请求：带 Authorization 则复验 JWT（能力 URL + 创建时强校验为主，此处兜底）*/
async function onIncomingRequest(req) {
  const h = header(req, 'authorization');
  if (h && !verifyJwt(req)) throw uploadError(401, 'Token 无效或已过期');
}

/** 删 tus sidecar + 兜底删残留数据文件 */
async function cleanupTus(id, src) {
  try {
    const store = getFileStore();
    if (store.configstore && typeof store.configstore.delete === 'function') {
      await store.configstore.delete(id);
    }
  } catch {}
  if (src) await fsp.unlink(src).catch(() => {});
}

/** 传完后落进各面最终位置 */
async function onUploadFinish(req, upload) {
  const m = upload.metadata || {};
  const surface = m.surface;
  const src = upload.storage && upload.storage.path;
  if (!src) throw uploadError(500, '无法定位已上传文件');

  try {
    let body;
    if (surface === 'app') {
      const app = safeSegment(m.app);
      const version = safeSegment(m.version);
      const filename = path.basename(normalizeRelativePath(m.filename) || '');
      if (!app || !version || !filename) throw uploadError(400, '缺少落盘参数');
      const dir = path.join(CONFIG.RELEASES_DIR, app, version);
      const dest = path.join(dir, filename);
      if (path.dirname(dest) !== path.resolve(dir)) throw uploadError(400, '非法文件名');
      await moveFile(src, dest);
      autoUpdateLatestSigOnUpload(app, version, [{ originalname: filename }]);
      body = { uploaded: [{ name: filename, size: upload.size, url: fileUrl(app, version, filename) }] };
    } else if (surface === 'resource') {
      const name = safeSegment(m.name);
      const rel = normalizeRelativePath(m.relPath || m.filename);
      if (!name || !rel) throw uploadError(400, '无效文件路径');
      ensureLibraryFilesDir(name);
      const dest = resolveUnderRoot(libraryFilesDir(name), rel);
      if (!dest) throw uploadError(400, '无效文件路径');
      await moveFile(src, dest);
      const r = registerUpload(name, rel);
      if (r.error) throw uploadError(r.status || 500, r.error);
      body = { uploaded: [r.item] };
    } else if (surface === 'temp') {
      const ttc = CONFIG.TEMP_TRANSFER;
      const store = getTempTransferStore();
      if (!ttc || !store) throw uploadError(404, '临时传输未启用');
      const p = parseTtl(ttc, m.ttlMinutes);
      const ttl = p.ok ? p.minutes : ttc.defaultTtlMinutes;
      if (m.kind === 'folder') {
        const batchId = safeSegment(m.batchId);
        const rel = normalizeRelativePath(m.relPath || m.filename);
        if (!batchId || !rel) throw uploadError(400, '缺少 batchId/relPath');
        const stageDir = path.join(CONFIG.TEMP_TRANSFER_DIR, STAGING_DIRNAME, batchId);
        const dest = resolveUnderRoot(stageDir, rel);
        if (!dest) throw uploadError(400, '无效路径');
        await moveFile(src, dest);
        body = { surface: 'temp', kind: 'folder', staged: true, batchId, relPath: rel };
      } else {
        const filename = path.basename(normalizeRelativePath(m.filename) || '') || 'file';
        const rec = await store.createFromPartFile(
          { originalName: filename, size: upload.size, mimeType: m.mime || null, ttlMinutes: ttl },
          src,
        );
        body = { surface: 'temp', kind: 'file', ...tempFilePublic(rec) };
      }
      ipQuotaRelease(clientIp(req));
    } else {
      throw uploadError(400, '未知上传面 surface');
    }

    await cleanupTus(upload.id, src);
    return { status_code: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  } catch (e) {
    if (surface === 'temp') ipQuotaRelease(clientIp(req));
    if (e && e.status_code) throw e;
    console.error('[upload] onUploadFinish', e);
    throw uploadError(500, (e && e.message) || '落盘失败');
  }
}

function getServer() {
  if (!_server) {
    _server = new Server({
      path: TUS_PATH,
      datastore: getFileStore(),
      respectForwardedHeaders: true,
      onUploadCreate,
      onUploadFinish,
      onIncomingRequest,
    });
  }
  return _server;
}

// ───────────────────────── 公开 API ─────────────────────────

/**
 * 挂载 tus 端点 + 临时文件夹 commit 端点。仅在 UPLOAD_RESUMABLE 开启时调用。
 * @param {import('express').Application} app
 */
function registerResumableUpload(app) {
  const server = getServer();
  const handler = (req, res) => server.handle(req, res);
  // 用 app.all（非 app.use）以保留完整 req.url 供 tus 路由匹配
  app.all(TUS_PATH, handler);
  app.all(`${TUS_PATH}/*`, handler);

  // 临时「文件夹」：N 个 tus 会话全部完成后组装成一条文件夹记录
  app.post('/api/temp-transfer/commit', (req, res) => {
    const ttc = CONFIG.TEMP_TRANSFER;
    const store = getTempTransferStore();
    if (!ttc || !ttc.enabled || !store) {
      return res.status(404).json({ error: '临时传输未启用', code: 'DISABLED' });
    }
    const { batchId, folderName, ttlMinutes } = req.body || {};
    const bid = safeSegment(batchId);
    if (!bid) return res.status(400).json({ error: '缺少 batchId' });
    const p = parseTtl(ttc, ttlMinutes);
    if (!p.ok) return res.status(422).json({ error: p.error, allowedTtlsMinutes: ttc.allowedTtlsMinutes });
    const stageDir = path.join(CONFIG.TEMP_TRANSFER_DIR, STAGING_DIRNAME, bid);
    (async () => {
      const rels = await listFilesRel(stageDir);
      if (!rels.length) return res.status(400).json({ error: '没有已上传的文件，请先上传分片' });
      const files = rels.map(rel => ({ originalname: rel, path: path.join(stageDir, rel) }));
      const name = (folderName && String(folderName).trim()) ||
        (rels[0].includes('/') ? rels[0].split('/')[0] : '文件夹');
      try {
        const rec = await store.createFromFolderUpload({ originalName: name, ttlMinutes: p.minutes }, files);
        await fsp.rm(stageDir, { recursive: true, force: true });
        res.json({ surface: 'temp', kind: 'folder', ...tempFolderPublic(rec), ttlMinutes: p.minutes });
      } catch (e) {
        console.error('[upload] temp folder commit', e);
        res.status(500).json({ error: (e && e.message) || '合并失败' });
      }
    })().catch(e => {
      console.error('[upload] commit', e);
      if (!res.headersSent) res.status(500).json({ error: '合并失败' });
    });
  });
}

/** 定时清扫过期未完成上传 + staging 残留 */
let _gcTimer = null;
function startUploadGc() {
  const server = getServer();
  const sweepStaging = async () => {
    const root = path.join(CONFIG.TEMP_TRANSFER_DIR, STAGING_DIRNAME);
    const maxAge = CONFIG.UPLOAD_INCOMPLETE_TTL_HOURS * 60 * 60 * 1000;
    let dirs;
    try {
      dirs = await fsp.readdir(root);
    } catch {
      return;
    }
    for (const d of dirs) {
      const abs = path.join(root, d);
      try {
        const st = await fsp.stat(abs);
        if (Date.now() - st.mtimeMs > maxAge) await fsp.rm(abs, { recursive: true, force: true });
      } catch {}
    }
  };
  const run = () => {
    server.cleanUpExpiredUploads().catch(e => console.error('[upload] gc', e));
    sweepStaging();
    // 周期性清空 IP 计数，避免未完成会话长期占额
    ipInflight.clear();
  };
  if (_gcTimer) return;
  setImmediate(run);
  _gcTimer = setInterval(run, 60 * 60 * 1000); // 每小时
}

module.exports = { registerResumableUpload, startUploadGc, TUS_PATH };
