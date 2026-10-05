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
    const out = [];
    for (const child of children) {
      const childPrefix = prefix ? `${prefix}/${child.name}` : child.name;
      out.push(...(await readEntry(child, childPrefix)));
    }
    return out;
  }
  return [];
}

export async function ingestFromDataTransfer(dt) {
  if (!dt) return [];
  // DataTransferItem 只在 drop 事件同步阶段有效：必须先把全部 entry 取出再 await
  const entries = [...(dt.items || [])]
    .filter(it => it.kind === 'file')
    .map(it => it.webkitGetAsEntry?.())
    .filter(Boolean);
  if (entries.length) {
    const out = [];
    for (const entry of entries) out.push(...(await readEntry(entry, entry.name)));
    return out;
  }
  const files = dt.files ? [...dt.files] : [];
  return files.map(file => ({ file, relativePath: fileRelativePath(file) }));
}

export async function ingestFromFileList(fileList) {
  const files = fileList ? [...fileList] : [];
  return files.map(file => ({ file, relativePath: fileRelativePath(file) }));
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
