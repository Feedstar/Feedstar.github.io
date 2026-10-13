import { sampleInk } from '../lib/ink-samples.mjs';

// Sample the real, responsive DOM typography. The final particle positions
// coincide with the readable HTML rather than a second approximation of it.
export function sampleArrival(arrival: HTMLElement, host: HTMLElement) {
  const bounds = host.getBoundingClientRect();
  const mask = document.createElement('canvas');
  mask.width = Math.ceil(bounds.width);
  mask.height = Math.ceil(bounds.height);
  const context = mask.getContext('2d', { willReadFrequently: true })!;
  for (const element of arrival.querySelectorAll<HTMLElement>(
    '[data-particle-text]',
  )) {
    const style = getComputedStyle(element);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.fillStyle = style.color;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('.sr-only')) continue;
      const text = node.textContent ?? '';
      for (let i = 0; i < text.length; i++) {
        if (/\s/.test(text[i])) continue;
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        const metrics = context.measureText(text[i]);
        const ascent =
          metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
        const descent =
          metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
        const baseline =
          rect.top + (rect.height - ascent - descent) / 2 + ascent;
        context.fillText(
          text[i],
          rect.left - bounds.left,
          baseline - bounds.top,
        );
      }
    }
  }
  for (const element of arrival.querySelectorAll<HTMLElement>(
    '[data-particle-border]',
  )) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    context.strokeStyle = style.borderColor;
    context.lineWidth = 1.5;
    context.beginPath();
    context.roundRect(
      rect.left - bounds.left,
      rect.top - bounds.top,
      rect.width,
      rect.height,
      rect.height / 2,
    );
    context.stroke();
  }
  const { data } = context.getImageData(0, 0, mask.width, mask.height);
  return sampleInk(data, mask.width, mask.height);
}
