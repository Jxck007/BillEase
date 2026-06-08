import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('./src', function(filePath: string) {
  if (filePath.endsWith('.tsx')) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Replace colors
    code = code.replace(/blue-/g, 'emerald-');
    code = code.replace(/indigo-/g, 'emerald-');
    code = code.replace(/gray-/g, 'stone-');
    
    // Switch text-stone-900 to text-stone-800
    code = code.replace(/text-stone-900/g, 'text-stone-800');
    
    // AppLayout specific
    if (filePath.includes('AppLayout.tsx')) {
      code = code.replace(/bg-stone-50/, 'bg-[#fcfaf7]');
      code = code.replace(/min-h-screen flex/, 'min-h-screen flex text-stone-800');
    }
    
    fs.writeFileSync(filePath, code);
  }
});
