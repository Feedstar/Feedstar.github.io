import { contentDirectory } from '../lib/content-directory';
export async function GET() {
  return new Response(JSON.stringify(await contentDirectory()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
