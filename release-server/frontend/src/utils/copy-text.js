/**
 * 复制文本到剪贴板。navigator.clipboard 只在安全上下文（https / localhost）存在，
 * 经 http://IP 访问管理端时走 execCommand 老路；两条都失败就抛错，由调用方提示。
 */
export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('复制失败');
}
