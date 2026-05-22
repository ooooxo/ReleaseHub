const multer = require('multer');
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const { readAppMeta } = require('./meta-notes');
const { isSemVer2CoreWithVPrefix, isValidGeneralVersionForUpload } = require('./releases');
const { multerFixOriginalNameFileFilter } = require('./fix-multipart-filename');
const { MAX_UPLOAD_BYTES } = require('./upload-limits');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(CONFIG.RELEASES_DIR, req.params.app, req.params.version);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
  storage,
  fileFilter: multerFixOriginalNameFileFilter(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const { libraryFilesDir, ensureLibraryFilesDir } = require('./resource-libraries');
const { normalizeRelativePath, resolveUnderRoot } = require('./path-utils');

const resourceLibraryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const name = req.params.name;
    if (!req._rlEnsuredRoot) {
      ensureLibraryFilesDir(name);
      req._rlEnsuredRoot = true;
    }
    const rel = resolveResourceUploadRelativePath(req, file);
    if (!rel) return cb(new Error('无效文件路径'));
    const abs = resolveUnderRoot(libraryFilesDir(name), rel);
    if (!abs) return cb(new Error('无效文件路径'));
    const parent = path.dirname(abs);
    if (!req._rlCreatedDirs) req._rlCreatedDirs = new Set();
    try {
      if (!req._rlCreatedDirs.has(parent)) {
        fs.mkdirSync(parent, { recursive: true });
        req._rlCreatedDirs.add(parent);
      }
      cb(null, parent);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const rel = resolveResourceUploadRelativePath(req, file);
    if (!rel) return cb(new Error('无效文件路径'));
    cb(null, path.basename(rel));
  },
});

function parseResourceRelativePathOverrides(req) {
  if (req._rlPathOverrides !== undefined) return req._rlPathOverrides;
  let list = [];
  try {
    const raw = req.body && req.body.relativePaths;
    if (raw) list = JSON.parse(String(raw));
  } catch {
    list = [];
  }
  req._rlPathOverrides = Array.isArray(list) ? list : [];
  return req._rlPathOverrides;
}

function resolveResourceUploadRelativePath(req, file) {
  if (file._rlResolvedPath) return file._rlResolvedPath;
  const overrides = parseResourceRelativePathOverrides(req);
  if (req._rlUploadIdx == null) req._rlUploadIdx = 0;
  const idx = req._rlUploadIdx++;
  const fromOverride = overrides[idx] != null ? normalizeRelativePath(String(overrides[idx])) : null;
  const rel =
    fromOverride ||
    normalizeRelativePath(file.originalname) ||
    normalizeRelativePath(path.basename(file.originalname));
  file._rlResolvedPath = rel;
  return rel;
}

const resourceLibraryUpload = multer({
  storage: resourceLibraryStorage,
  fileFilter: multerFixOriginalNameFileFilter(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

function validateVersionForUpload(req, res, next) {
  const { app, version } = req.params;
  const meta = readAppMeta(app);
  if (meta.repoType === 'tauri') {
    if (!isSemVer2CoreWithVPrefix(version)) {
      return res.status(400).json({
        error:
          'Tauri 库版本须符合 SemVer 2.0：MAJOR.MINOR.PATCH 三段非负整数，且各位数不可前导零（例 v1.0.0）',
      });
    }
  } else if (!isValidGeneralVersionForUpload(version)) {
    return res.status(400).json({
      error:
        '通用库版本目录名仅含字母、数字、点、下划线、连字符（不可含 /、\\ 或 ..），长度不超过 120',
    });
  }
  next();
}

module.exports = { upload, validateVersionForUpload, resourceLibraryUpload };
