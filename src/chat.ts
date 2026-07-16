/**
 * 大善系统 —— 对话气泡渲染。
 * 负责向对话区追加：系统消息、用户消息、夸赞消息。
 * 含长局节点回收：子节点超阈值时折叠早期条目，防止 DOM 无限增长卡顿。
 */

const dialogue = () => document.getElementById('dialogue')!;

/**
 * 对话区允许的最大子节点数，超过则折叠最早的若干条。
 * 取值 60：一回合约产生 3-4 个节点（情境/用户/夸赞/选项），60 约够 15-20 回合可见历史，
 * 完整记录仍可在善恶簿查阅。平衡了「近期上下文可见」与「长局 DOM 不膨胀」。
 */
const MAX_NODES = 60;

/** 滚动对话区到底部。 */
function scrollToBottom(): void {
  const el = dialogue();
  el.scrollTop = el.scrollHeight;
}

/**
 * 节点回收：若对话区子节点超过 MAX_NODES，把最早的若干条折叠成一个占位条。
 * 完整记录仍可在善恶簿中查阅。
 */
function reclaimOldNodes(): void {
  const el = dialogue();
  const nodes = el.children;
  if (nodes.length <= MAX_NODES) return;

  // 折叠最早的三分之一（向下取整到偶数，避免拆散成对的气泡）
  const foldCount = Math.floor((nodes.length - MAX_NODES + 20) / 2) * 2;
  let folded = 0;
  for (let i = 0; i < foldCount && nodes[0]; i++) {
    nodes[0]!.remove();
    folded++;
  }
  // 插入折叠占位（若已有占位则累加）
  const existing = el.querySelector('.msg-collapsed') as HTMLElement | null;
  if (existing) {
    const n = Number.parseInt(existing.dataset['n'] ?? '0', 10) + folded;
    existing.dataset['n'] = String(n);
    existing.textContent = `· 已隐去 ${n} 笔往事，详见善恶簿 ·`;
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'msg msg-collapsed';
    placeholder.dataset['n'] = String(folded);
    placeholder.textContent = `· 已隐去 ${folded} 笔往事，详见善恶簿 ·`;
    el.insertBefore(placeholder, el.firstChild);
  }
}

/** 追加一条系统消息（情境文本），返回该元素。 */
export function appendSystemMessage(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'msg msg-system';
  el.textContent = text;
  dialogue().appendChild(el);
  reclaimOldNodes();
  scrollToBottom();
  return el;
}

/** 追加一条用户消息（所选选项文案）。 */
export function appendUserMessage(choiceText: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'msg msg-user';
  el.innerHTML = `<span class="msg-label">你选择</span>`;
  const body = document.createElement('span');
  body.textContent = choiceText;
  el.appendChild(body);
  dialogue().appendChild(el);
  reclaimOldNodes();
  scrollToBottom();
  return el;
}

/**
 * 追加一条夸赞消息，返回其文本容器元素（供打字机动画使用）。
 * tone 用于切换语气色调。
 */
export function appendPraiseShell(tone: string): { container: HTMLElement; textEl: HTMLElement } {
  const container = document.createElement('div');
  container.className = `msg msg-praise tone-${tone}`;

  const tag = document.createElement('span');
  tag.className = 'tone-tag';
  tag.textContent = tone;
  container.appendChild(tag);

  const textEl = document.createElement('div');
  textEl.className = 'praise-text';
  container.appendChild(textEl);

  dialogue().appendChild(container);
  reclaimOldNodes();
  scrollToBottom();
  return { container, textEl };
}

/** 清空对话区（重新开始时使用）。 */
export function clearDialogue(): void {
  dialogue().innerHTML = '';
}

/**
 * 追加一条「善名晋升」横幅（居中、金边小卡片）。
 * 在用户达成新称号时调用，强化讽刺的累积感。
 */
export function appendTitleBanner(title: string): void {
  const el = document.createElement('div');
  el.className = 'msg msg-title';
  el.innerHTML = `<span class="title-label">大善系统 册封</span><span class="title-name">${title}</span>`;
  dialogue().appendChild(el);
  scrollToBottom();
}
