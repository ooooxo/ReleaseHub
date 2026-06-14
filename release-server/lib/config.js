require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const { defaultAdminPasswordHash } = require('./admin-password-defaults');
const { normalizeBaseUrl } = require('./base-url');
const { loadTempTransferConfig, ensureRootDir } = require('./temp-transfer/config');

const RELEASES_DIR = process.env.RELEASES_DIR || path.join(__dirname, '..', 'releases');
const RESOURCE_LIBRARIES_DIR =
  process.env.RESOURCE_LIBRARIES_DIR || path.join(__dirname, '..', 'resource-libraries');
const TEMP_TRANSFER_DIR =
  process.env.TEMP_TRANSFER_DIR || path.join(__dirname, '..', 'temp-transfers');

/** 断点续传（tus）开关：默认开。关掉则前端回落到旧 multer 整包上传 */
const UPLOAD_RESUMABLE = (() => {
  const raw = process.env.UPLOAD_RESUMABLE;
  if (raw === undefined || raw === '') return true;
  return raw === 'true' || raw === '1';
})();
/** tus 未完成分片暂存目录（落盘后 rename 到各面最终位置；跨设备时 move 退化为 copy+unlink） */
const UPLOADS_INCOMPLETE_DIR =
  process.env.UPLOADS_INCOMPLETE_DIR || path.join(__dirname, '..', '.uploads-incomplete');
/** 未完成上传过期时长（小时），到期由 server.cleanUpExpiredUploads() 清扫 */
const UPLOAD_INCOMPLETE_TTL_HOURS = (() => {
  const n = parseInt(process.env.UPLOAD_INCOMPLETE_TTL_HOURS, 10);
  return Number.isFinite(n) && n > 0 ? n : 24;
})();

const TEMP_TRANSFER = loadTempTransferConfig(TEMP_TRANSFER_DIR);
if (TEMP_TRANSFER.enabled) {
  ensureRootDir(TEMP_TRANSFER);
}

const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret-in-production',
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || defaultAdminPasswordHash(),
  RELEASES_DIR,
  RESOURCE_LIBRARIES_DIR,
  TEMP_TRANSFER_DIR,
  TEMP_TRANSFER,
  UPLOAD_RESUMABLE,
  UPLOADS_INCOMPLETE_DIR,
  UPLOAD_INCOMPLETE_TTL_HOURS,
  BASE_URL: normalizeBaseUrl(process.env.BASE_URL || 'http://localhost:3721'),
};

if (!fs.existsSync(CONFIG.RELEASES_DIR)) {
  fs.mkdirSync(CONFIG.RELEASES_DIR, { recursive: true });
}

if (!fs.existsSync(CONFIG.RESOURCE_LIBRARIES_DIR)) {
  fs.mkdirSync(CONFIG.RESOURCE_LIBRARIES_DIR, { recursive: true });
}

module.exports = CONFIG;
