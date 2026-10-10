import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
export default defineConfig({
  site: 'https://feedstar.github.io',
  integrations: [react(), mdx()],
  output: 'static',
  devToolbar: { enabled: false },
});
