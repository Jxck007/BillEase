import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('./src/pages', function(filePath: string) {
  if (filePath.endsWith('.tsx')) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Replace green -> emerald for paid
    code = code.replace(/bg-green-100 text-green-700/g, 'bg-emerald-100 text-emerald-700');
    // Replace yellow -> amber for partial
    code = code.replace(/bg-yellow-100/g, 'bg-amber-100');
    code = code.replace(/text-yellow-700/g, 'text-amber-700');
    code = code.replace(/text-yellow-600/g, 'text-amber-600');
    // Replace red -> rose for unpaid
    code = code.replace(/bg-red-100 text-red-700/g, 'bg-rose-100 text-rose-700');
    code = code.replace(/text-red-500/g, 'text-rose-500');
    
    fs.writeFileSync(filePath, code);
  }
});
