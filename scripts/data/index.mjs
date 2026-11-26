import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

export const categories = read('categories.json');
export const people = read('people.json');
export const surveys = read('surveys/index.json').map((file) => read(`surveys/${file}`));
