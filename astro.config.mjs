import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import codeBlockTransformer from './src/lib/code-block-transformer.mjs';
export default defineConfig({
  site: 'https://feedstar.github.io',
  integrations: [react(), mdx()],
  output: 'static',
  devToolbar: { enabled: false },
  markdown: { shikiConfig: { transformers: [codeBlockTransformer()] } },
});
