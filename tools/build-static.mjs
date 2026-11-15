import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
for (const entry of ['index.html', 'styles.css', 'src', 'vendor', 'assets']) {
  await cp(entry, `dist/${entry}`, { recursive: true });
}
