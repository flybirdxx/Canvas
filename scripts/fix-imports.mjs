/**
 * Batch-replace relative imports with @/ path aliases.
 *
 * Scans all .ts/.tsx files in src/ and rewrites imports like:
 *   import { X } from '../../store/useCanvasStore'
 * to:
 *   import { X } from '@/store/useCanvasStore'
 *
 * Only replaces imports that cross directory boundaries (../).
 * Single-level relative imports (./) are left untouched since they
 * reference siblings in the same directory.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '..', 'src');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      files.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

// Match:  from '../something'  or  from '../../something'
// But NOT: from './something' (same-directory sibling)
const importRe = /from\s+['"](\.\.[/\\][^'"]+)['"]/g;

let totalReplacements = 0;
let totalFiles = 0;

for (const file of walk(srcDir)) {
  const content = fs.readFileSync(file, 'utf8');
  const fileDir = path.dirname(file);
  
  let modified = content;
  let fileChanges = 0;
  
  modified = content.replace(importRe, (match, relPath) => {
    // Resolve the relative path to an absolute path
    const absTarget = path.resolve(fileDir, relPath);
    // Convert to a path relative to src/
    const fromSrc = path.relative(srcDir, absTarget).replace(/\\/g, '/');
    
    // Only replace if the target is inside src/
    if (fromSrc.startsWith('..')) {
      return match; // outside src/, leave unchanged
    }
    
    const newImport = `from '@/${fromSrc}'`;
    fileChanges++;
    return newImport;
  });
  
  if (fileChanges > 0) {
    fs.writeFileSync(file, modified, 'utf8');
    const relFile = path.relative(srcDir, file).replace(/\\/g, '/');
    console.log(`  ✓ ${relFile} (${fileChanges} imports)`);
    totalReplacements += fileChanges;
    totalFiles++;
  }
}

console.log(`\nDone: ${totalReplacements} imports replaced across ${totalFiles} files.`);
