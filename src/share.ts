/**
 * 大善系统 —— 分享战绩图卡（Canvas 绘制）。
 *
 * 把善名 + 近期事迹渲染成中国风图卡（暗底洒金、朱红印章、对联式标题），
 * 可下载为 PNG 或复制到剪贴板。纯 Canvas 2D，零依赖。
 * 图卡尺寸 1080×1350（Instagram/小红书竖图 4:5 比例）。
 */

import type { LedgerEntry } from '../shared/ledgerCore.ts';
import type { Tone } from '../shared/types.ts';

const W = 1080;
const H = 1350;

/** 印章配色（与 ledgerCore 的 TONE_STAMP 对应）。 */
const TONE_COLORS: Record<Tone, string> = {
  庄严: '#c9a35c',
  戏谑: '#b8722f',
  佛系: '#6b7d4a',
  学术: '#4a6878',
  江湖: '#8a4a3a',
  温情: '#c8786a',
};

/** 渲染分享图卡到指定 canvas。 */
export function renderShareCard(
  canvas: HTMLCanvasElement,
  data: { title: string; deeds: LedgerEntry[]; endingName?: string },
): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── 背景：墨黑 + 暗角 ──
  const bg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, H * 0.7);
  bg.addColorStop(0, '#241c16');
  bg.addColorStop(1, '#0e0a07');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── 洒金点 ──
  ctx.fillStyle = 'rgba(212, 166, 74, 0.35)';
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 2 + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 顶部对联式标题 ──
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4a64a';
  ctx.font = 'bold 52px "Noto Serif SC", serif';
  ctx.fillText('善 恶 由 我 定', W / 2, 150);
  ctx.fillText('你 是 大 好 人', W / 2, 230);

  // 分割线
  ctx.strokeStyle = 'rgba(212, 166, 74, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 200, 280);
  ctx.lineTo(W / 2 + 200, 280);
  ctx.stroke();

  // ── 中央朱红印章：称号 ──
  const sealY = 480;
  drawSeal(ctx, W / 2, sealY, data.title, data.endingName);

  // ── 近期事迹 ──
  ctx.fillStyle = '#ece0c8';
  ctx.font = '28px "Noto Serif SC", serif';
  ctx.fillText('· 善 行 录 ·', W / 2, 720);

  ctx.font = '24px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(236, 224, 200, 0.85)';
  ctx.textAlign = 'left';
  const recent = data.deeds.slice(-5);
  recent.forEach((e, i) => {
    const y = 780 + i * 56;
    // 小印章
    ctx.fillStyle = TONE_COLORS[e.tone] ?? '#c8302a';
    ctx.fillRect(110, y - 22, 36, 36);
    ctx.fillStyle = '#e8dcc4';
    ctx.font = 'bold 22px serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      ['善', '妙', '渡', '理', '义', '慈'][
        ['庄严', '戏谑', '佛系', '学术', '江湖', '温情'].indexOf(e.tone)
      ] ?? '善',
      128,
      y + 2,
    );
    // 事迹文字（截断）
    ctx.textAlign = 'left';
    ctx.font = '24px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(236, 224, 200, 0.85)';
    const deed = truncate(ctx, e.deed, W - 240);
    ctx.fillText(`第${e.index}笔  ${deed}`, 170, y);
  });

  // ── 底部水印 ──
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(212, 166, 74, 0.5)';
  ctx.font = '20px "Noto Serif SC", serif';
  ctx.fillText('大 善 系 统  ·  dashan', W / 2, H - 80);
  ctx.font = '16px "Noto Serif SC", serif';
  ctx.fillStyle = 'rgba(212, 166, 74, 0.35)';
  ctx.fillText('善 恶 由 我 定  ·  你 是 大 好 人', W / 2, H - 50);
}

/** 绘制中央朱红印章。 */
function drawSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  title: string,
  endingName?: string,
): void {
  // 印章方框（朱红）
  const size = 320;
  ctx.fillStyle = '#9a1f1f';
  roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 12);
  ctx.fill();
  // 金边
  ctx.strokeStyle = '#d4a64a';
  ctx.lineWidth = 4;
  roundRect(ctx, cx - size / 2 + 10, cy - size / 2 + 10, size - 20, size - 20, 8);
  ctx.stroke();

  // 称号文字（白色，竖排或居中）
  ctx.fillStyle = '#e8dcc4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 称号可能较长，分两行
  if (title.length > 8) {
    ctx.font = 'bold 36px "Noto Serif SC", serif';
    ctx.fillText(title.slice(0, Math.ceil(title.length / 2)), cx, cy - 20);
    ctx.fillText(title.slice(Math.ceil(title.length / 2)), cx, cy + 30);
  } else {
    ctx.font = 'bold 44px "Noto Serif SC", serif';
    ctx.fillText(title, cx, cy);
  }

  // 结局名（小字）
  if (endingName) {
    ctx.font = '24px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(232, 220, 196, 0.7)';
    ctx.fillText(`· ${endingName} ·`, cx, cy + 130);
  }
  ctx.textBaseline = 'alphabetic';
}

/** 圆角矩形辅助。 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 按宽度截断文字。 */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

/** 下载图卡为 PNG。 */
export function downloadCard(canvas: HTMLCanvasElement, filename = '大善系统-善名.png'): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/** 复制图卡到剪贴板（不支持则返回 false）。 */
export async function copyCardToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return false;
    // Clipboard API 仅在安全上下文（https/localhost）可用
    const w = window as unknown as { ClipboardItem?: new (items: Record<string, Blob>) => unknown };
    if (!w.ClipboardItem || !navigator.clipboard?.write) return false;
    const item = new w.ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item] as never);
    return true;
  } catch {
    return false;
  }
}
