function legacyCopy(text: string) {
  const focus = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, i) =>
        selection.getRangeAt(i).cloneRange(),
      )
    : [];
  const input = document.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.style.cssText =
    'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.append(input);
  try {
    input.select();
    if (!document.execCommand('copy')) throw new Error('Copy unavailable');
  } finally {
    input.remove();
    if (focus instanceof HTMLElement) focus.focus({ preventScroll: true });
    selection?.removeAllRanges();
    ranges.forEach((range) => selection?.addRange(range));
  }
}

export function createCodeBlocks() {
  document
    .querySelectorAll<HTMLElement>('.prose .code-block')
    .forEach((block) => {
      const code = block.querySelector('pre code');
      const button = block.querySelector<HTMLButtonElement>('.copy-code');
      const label = button?.querySelector<HTMLElement>('.copy-label');
      const status = block.querySelector<HTMLElement>('.copy-feedback');
      if (!code || !button || !label || !status) return;
      button.hidden = false;
      let reset: ReturnType<typeof setTimeout> | undefined;
      button.addEventListener('click', async () => {
        clearTimeout(reset);
        button.disabled = true;
        status.textContent = '';
        const source = code.textContent ?? '';
        try {
          try {
            await navigator.clipboard.writeText(source);
          } catch {
            legacyCopy(source);
          }
          label.textContent = '已复制';
          button.dataset.copied = 'true';
          status.textContent = '代码已复制';
          status.classList.remove('copy-error');
        } catch {
          label.textContent = '重试复制';
          status.textContent = '复制未完成，请选中代码后手动复制。';
          status.classList.add('copy-error');
        } finally {
          button.disabled = false;
          reset = setTimeout(() => {
            label.textContent = '复制';
            delete button.dataset.copied;
            if (!status.classList.contains('copy-error'))
              status.textContent = '';
          }, 2200);
        }
      });
    });
}
