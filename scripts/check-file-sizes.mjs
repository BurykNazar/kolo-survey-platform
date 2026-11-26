import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const MAX = 200;
const IGNORED = /node_modules|\.git[\\/]|shots[\\/]|package-lock\.json|credentials.*\.md|README\.md/;
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (IGNORED.test(full)) continue;
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|mjs|css|njk|json|ya?ml)$/.test(entry.name)) files.push(full);
  }
}

walk(path.join(ROOT, 'src'));
walk(path.join(ROOT, 'scripts'));

for (const name of ['package.json', 'render.yaml', '.env.example']) {
  const full = path.join(ROOT, name);
  if (fs.existsSync(full)) files.push(full);
}

const oversized = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trimEnd().split('\n').length;
  if (lines > MAX) oversized.push({ file: path.relative(ROOT, file), lines });
}

oversized.sort((a, b) => b.lines - a.lines);

if (oversized.length) {
  console.error(`\nФайли довші за ${MAX} рядків:\n`);
  for (const item of oversized) console.error(`  ${String(item.lines).padStart(4)}  ${item.file}`);
  console.error(`\nУсього: ${oversized.length}. Розділіть їх на менші модулі.\n`);
  process.exit(1);
}

console.log(`Перевірено ${files.length} файлів — усі в межах ${MAX} рядків.`);
