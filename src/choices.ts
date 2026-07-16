/**
 * 大善系统 —— 选项卡片渲染。
 * 渲染 2-4 个选项按钮，处理点击与选中高亮。
 */

import type { Choice } from '../shared/types.ts';

const dialogue = () => document.getElementById('dialogue')!;

/**
 * 渲染一组选项卡片。
 * @param choices 选项数组
 * @param onChoose 选中回调，参数为所选选项文案
 */
export function renderChoices(choices: Choice[], onChoose: (choice: Choice) => void): void {
  const wrap = document.createElement('div');
  wrap.className = 'choices';

  for (const choice of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.dataset['id'] = choice.id;

    const idLabel = document.createElement('span');
    idLabel.className = 'choice-id';
    idLabel.textContent = choice.id;
    btn.appendChild(idLabel);

    btn.appendChild(document.createTextNode(choice.text));

    btn.addEventListener('click', () => {
      // 标记整组为已选，高亮当前项
      wrap.classList.add('chosen');
      btn.classList.add('chosen');
      // 禁用所有按钮（一次性）
      wrap.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => (b.disabled = true));
      onChoose(choice);
    });

    wrap.appendChild(btn);
  }

  dialogue().appendChild(wrap);
  // 滚到底部
  dialogue().scrollTop = dialogue().scrollHeight;
}
