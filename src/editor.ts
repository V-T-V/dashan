/**
 * 大善系统 —— 剧本编辑器（自定义情境导入）。
 *
 * 用户粘贴 JSON 导入自己的剧本，校验通过后注入 fallback 池并持久化。
 * 复用 shared/scriptSchema 的校验、src/ledger.ts 的导入代理。
 */

import { importUserScripts, clearAllUserScripts, userScriptTotal } from './ledger.ts';
import { escapeHtml } from '../shared/ledgerCore.ts';

/** 一个供用户参照的示例剧本 JSON。 */
export const SAMPLE_SCRIPT = `[
  {
    "situation": {
      "situation": "你的好友喝醉了要开车回家，夺你车钥匙不放。此时深夜无人，路不远。",
      "choices": [
        { "id": "A", "text": "强行夺下钥匙，自己送他回去" },
        { "id": "B", "text": "由他去，反正路不远" },
        { "id": "C", "text": "报警，让警察拦他" }
      ]
    },
    "praises": {
      "强行夺下钥匙，自己送他回去": {
        "text": "你冒着被误伤的风险也要护住朋友——这是真朋友才有的担当。大善。",
        "tone": "温情"
      },
      "由他去，反正路不远": {
        "text": "你尊重了朋友的自主意志。道法自然，强求反成执念——你放手的，是一份因果。",
        "tone": "佛系"
      },
      "报警，让警察拦他": {
        "text": "你借了制度之力，既救了朋友，也救了路上不知名的行人。大善不拘小节。",
        "tone": "庄严"
      }
    },
    "fallback": {
      "text": "你的抉择里藏着旁人看不懂的深意，大恶即大善。",
      "tone": "戏谑"
    }
  }
]`;

/** 初始化编辑器：绑定按钮、显示已导入数量。 */
export function initEditor(): void {
  const overlay = document.getElementById('editor-overlay')!;
  const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
  const status = document.getElementById('editor-status')!;
  const countEl = document.getElementById('editor-count')!;
  const sampleLink = document.getElementById('editor-sample')!;

  const refreshCount = (): void => {
    const n = userScriptTotal();
    countEl.textContent = n > 0 ? `已导入 ${n} 个剧本` : '';
  };
  refreshCount();

  // 示例填充
  sampleLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (!textarea.value.trim()) textarea.value = SAMPLE_SCRIPT;
  });

  // 导入
  document.getElementById('editor-import')!.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) {
      status.textContent = '请先粘贴剧本 JSON';
      status.className = 'editor-status error';
      return;
    }
    const result = importUserScripts(text);
    if (result.ok) {
      status.textContent = `成功导入 ${result.count} 个剧本！${result.errors.length ? `（${result.errors.length} 个被跳过）` : ''}`;
      status.className = 'editor-status success';
      textarea.value = '';
      refreshCount();
    } else {
      // XSS 防护：error 文案含用户原始 JSON 内容，必须转义后再插入
      status.innerHTML = `导入失败：<br>${result.errors.map((e) => `· ${escapeHtml(e)}`).join('<br>')}`;
      status.className = 'editor-status error';
    }
  });

  // 清空
  document.getElementById('editor-clear')!.addEventListener('click', () => {
    clearAllUserScripts();
    status.textContent = '已清空全部自定义剧本。';
    status.className = 'editor-status success';
    refreshCount();
  });

  // 关闭：点遮罩或 ×
  const close = (): void => overlay.classList.add('hidden');
  document.getElementById('editor-close')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) close();
  });
}

/** 打开编辑器。 */
export function openEditor(): void {
  document.getElementById('editor-overlay')!.classList.remove('hidden');
}
