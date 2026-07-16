/**
 * 大善系统 —— 夸赞打字机动画。
 * 将夸赞文案逐字写入指定元素，营造「系统正在为你定下善名」的仪式感。
 *
 * 支持：
 * - 点击容器即可瞬间跳过（避免重复游玩时强制等待）。
 * - reduced-motion 偏好下直接全文渲染（无障碍）。
 * - 按 Unicode 码点切分（Array.from），正确处理 emoji / 代理对（原 text[i] 会拆乱码）。
 */

/** 是否启用了「减少动态」无障碍偏好。 */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** 打字机每字间隔（毫秒）。统一常量，避免调用处与默认值不一致。 */
export const TYPE_SPEED_MS = 32;

/**
 * 把文案逐字打字机式写入 target 元素。
 * 点击 target 可立即跳过、填满全文。
 * @param target 目标元素
 * @param text 要打字的文案
 * @param speed 每字间隔毫秒（默认 TYPE_SPEED_MS）
 * @returns 完成的 Promise
 */
export function typewriter(
  target: HTMLElement,
  text: string,
  speed = TYPE_SPEED_MS,
): Promise<void> {
  return new Promise((resolve) => {
    // 无障碍：偏好减少动态时直接全文渲染
    if (prefersReducedMotion()) {
      target.textContent = text;
      resolve();
      return;
    }

    // 按码点切分，正确处理 emoji / 代理对
    const chars = Array.from(text);
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    target.textContent = '';
    target.appendChild(cursor);

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      // 填满剩余文字并移除光标与跳过监听
      cursor.insertAdjacentText('beforebegin', chars.join(''));
      cursor.remove();
      target.removeEventListener('click', onClick);
      resolve();
    };

    // 点击即跳过
    const onClick = (): void => finish();
    target.addEventListener('click', onClick, { once: false });

    let i = 0;
    const step = (): void => {
      if (done) return;
      if (i >= chars.length) {
        finish();
        return;
      }
      cursor.insertAdjacentText('beforebegin', chars[i]!);
      i++;
      window.setTimeout(step, speed);
    };
    step();
  });
}
