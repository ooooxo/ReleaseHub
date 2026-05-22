/**
 * 统一收集拖放/选择得到的文件列表（含相对路径）。
 * @returns {Promise<{ file: File, relativePath: string }[]>}
 */

function normalizeRel(p) {
  if (!p) return '';
  return String(p)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter(seg => seg && seg !== '.' && seg !== '..')
    .join('/');
}

function fileRelativePath(file) {
  const w = file.webkitRelativePath && String(file.webkitRelativePath).trim();
  if (w) return normalizeRel(w);
  return normalizeRel(file.name) || file.name;
}

async function readDirectoryHandle(dirHandle, prefix = '') {
  const out = [];
  for await (const [name, handle] of dirHandle.entries()) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      const file = await handle.getFile();
      out.push({ file, relativePath: normalizeRel(rel) || name });
    } else if (handle.kind === 'directory') {
      out.push(...(await readDirectoryHandle(handle, rel)));
    }
  }
  return out;
}

async function readEntry(entry, prefix = '') {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file(
        file => {
          const rel = prefix || file.name;
          resolve([{ file, relativePath: normalizeRel(rel) || file.name }]);
        },
        reject,
      );
    });
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const children = await new Promise((resolve, reject) => {
      const acc = [];
      const readBatch = () => {
        reader.readEntries(
          entries => {
            if (!entries.length) resolve(acc);
            else {
              acc.push(...entries);
              readBatch();
            }
          },
          reject,
        );
      };
      readBatch();
    });
    const base = prefix || entry.name;
    const out = [];
    for (const child of children) {
      out.push(...(await readEntry(child, `${base}/${child.name}`)));
    }
    return out;
  }
  return [];
}

export async function ingestFromDataTransfer(dt) {
  if (!dt) return [];
  const items = dt.items ? [...dt.items] : [];
  const files = dt.files ? [...dt.files] : [];

  let fromEntries = [];
  if (items.length && items[0]?.webkitGetAsEntry) {
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) fromEntries.push(...(await readEntry(entry)));
    }
  }

  const fromFiles = files.map(file => ({ file, relativePath: fileRelativePath(file) }));
  const entriesNested = fromEntries.some(it => it.relativePath.includes('/'));
  const filesNested = fromFiles.some(it => it.relativePath.includes('/'));

  if (fromEntries.length && (entriesNested || (!filesNested && fromEntries.length === 1))) {
    return fromEntries;
  }
  if (filesNested) return fromFiles;
  if (fromEntries.length) return fromEntries;
  return fromFiles;
}

export async function ingestFromFileList(fileList) {
  const files = fileList ? [...fileList] : [];
  return files.map(file => ({ file, relativePath: fileRelativePath(file) }));
}

export async function pickFilesWithInput(inputEl) {
  return new Promise((resolve, reject) => {
    if (!inputEl) {
      resolve([]);
      return;
    }
    const onChange = async () => {
      inputEl.removeEventListener('change', onChange);
      const list = await ingestFromFileList(inputEl.files);
      inputEl.value = '';
      resolve(list);
    };
    inputEl.addEventListener('change', onChange);
    inputEl.click();
  });
}

export async function pickDirectoryIfSupported() {
  if (typeof window.showDirectoryPicker !== 'function') return [];
  try {
    const dir = await window.showDirectoryPicker();
    return readDirectoryHandle(dir, dir.name || '');
  } catch (e) {
    if (e?.name === 'AbortError') return [];
    throw e;
  }
}

export async function pickViaWebkitDirectory(inputEl) {
  if (!inputEl) return [];
  const prev = inputEl.webkitdirectory;
  inputEl.webkitdirectory = true;
  inputEl.multiple = true;
  try {
    return await pickFilesWithInput(inputEl);
  } finally {
    if (!prev) inputEl.removeAttribute('webkitdirectory');
    else inputEl.webkitdirectory = true;
  }
}

/** 点击上传区：先尝试目录选择器，否则多文件 input */
export async function pickOnZoneClick(fileInputRef) {
  if (typeof window.showDirectoryPicker === 'function') {
    const fromDir = await pickDirectoryIfSupported();
    if (fromDir.length) return fromDir;
  }
  return pickFilesWithInput(fileInputRef);
}

export function describeUploadBatch(items) {
  const n = items.length;
  if (!n) return { label: '', isFolder: false };
  const hasNested = items.some(it => it.relativePath.includes('/'));
  if (!hasNested) return { label: `${n} 个文件`, isFolder: false };
  const roots = new Set(items.map(it => it.relativePath.split('/')[0]).filter(Boolean));
  const rootName = roots.size === 1 ? [...roots][0] : '多个文件夹';
  return { label: `文件夹结构 · ${n} 个文件（${rootName}）`, isFolder: true, rootName };
}

export function appendToFormData(formData, items, fileField = 'files') {
  const paths = items.map(it => it.relativePath || it.file.name);
  formData.append('relativePaths', JSON.stringify(paths));
  for (let i = 0; i < items.length; i++) {
    formData.append(fileField, items[i].file, paths[i]);
  }
}
