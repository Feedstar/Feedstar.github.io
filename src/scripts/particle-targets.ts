import { sampleInk } from '../lib/ink-samples.mjs';

// Sample the real, responsive DOM typography. The final particle positions
// coincide with the readable HTML rather than a second approximation of it.
export function sampleArrival(
  arrival: HTMLElement,
  host: HTMLElement,
  pixelRatio = 1,
) {
  const bounds = host.getBoundingClientRect();
  const mask = document.createElement('canvas');
  mask.lang = document.documentElement.lang;
  mask.width = Math.ceil(bounds.width * pixelRatio);
  mask.height = Math.ceil(bounds.height * pixelRatio);
  const context = mask.getContext('2d', { willReadFrequently: true })!;
  context.scale(mask.width / bounds.width, mask.height / bounds.height);
  for (const element of arrival.querySelectorAll<HTMLElement>(
    '[data-particle-text]',
  )) {
    const style = getComputedStyle(element);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.fillStyle = style.color;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes: Node[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('.sr-only')) continue;
      if (node.textContent?.trim()) nodes.push(node);
    }
    if (!nodes.length) continue;
    // Read the browser's real baseline. Canvas font metrics can differ for
    // Chinese fallback glyphs inside a Latin sans family, causing a 2px jump.
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'display:inline-block;float:none;position:static;transform:none;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline;';
    element.append(probe);
    const last = nodes[nodes.length - 1];
    const end = last.textContent!.trimEnd().length;
    const lastRange = document.createRange();
    lastRange.setStart(last, end - 1);
    lastRange.setEnd(last, end);
    const baselineOffset =
      probe.getBoundingClientRect().top - lastRange.getBoundingClientRect().top;
    probe.remove();
    for (const node of nodes) {
      const text = node.textContent ?? '';
      for (let i = 0; i < text.length; i++) {
        if (/\s/.test(text[i])) continue;
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        let baseline = rect.top + baselineOffset;
        // Small system CJK fonts are hinted to device pixels by DOM layout.
        // Match that baseline quantization when rasterizing their ink mask.
        if (
          parseFloat(style.fontSize) < 24 &&
          /[\u3000-\u9fff]/u.test(text[i])
        ) {
          baseline = Math.ceil(baseline * devicePixelRatio) / devicePixelRatio;
        }
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
    context.lineWidth = parseFloat(style.borderTopWidth) || 1;
    const inset = context.lineWidth / 2;
    context.beginPath();
    context.roundRect(
      rect.left - bounds.left + inset,
      rect.top - bounds.top + inset,
      rect.width - context.lineWidth,
      rect.height - context.lineWidth,
      (rect.height - context.lineWidth) / 2,
    );
    context.stroke();
  }
  // Seed spacing stays in CSS pixels. The mask retains display resolution so
  // merged fragments reproduce smooth glyph edges instead of a pixel mosaic.
  const seeds = document.createElement('canvas');
  seeds.width = Math.ceil(bounds.width);
  seeds.height = Math.ceil(bounds.height);
  const seedContext = seeds.getContext('2d', { willReadFrequently: true })!;
  seedContext.drawImage(mask, 0, 0, seeds.width, seeds.height);
  const { data } = seedContext.getImageData(0, 0, seeds.width, seeds.height);
  return { samples: sampleInk(data, seeds.width, seeds.height), mask };
}
