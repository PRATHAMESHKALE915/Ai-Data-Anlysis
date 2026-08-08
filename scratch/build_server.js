import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Resolve binary safely
let esbuildExe = 'esbuild';
const localBin = path.resolve('node_modules/@esbuild/win32-x64/esbuild.exe');
if (fs.existsSync(localBin)) {
  esbuildExe = localBin;
}

const args = [
  'server.ts',
  '--bundle',
  '--platform=node',
  '--format=esm',
  '--banner:js=import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  '--outfile=api/index.js',
  '--external:pg-native',
  '--external:better-sqlite3',
  '--external:mysql2',
  '--external:oracledb',
  '--external:tedious',
  '--external:pg-query-stream',
  '--external:react',
  '--external:react-dom',
  '--external:vite',
  '--external:tailwindcss',
  '--external:@tailwindcss/vite',
  '--external:@vitejs/plugin-react',
  '--external:lightningcss',
  '--external:lucide-react',
  '--external:recharts',
  '--external:motion',
  '--external:react-markdown',
  '--external:remark-gfm',
  '--external:html2canvas',
  '--external:jspdf',
  '--external:jspdf-autotable',
  '--external:drizzle-kit'
];

try {
  console.log("Compiling server with arguments using execFileSync...");
  execFileSync(esbuildExe, args, { stdio: 'inherit', shell: esbuildExe === 'esbuild' });
  console.log("ESBuild build completed successfully!");
} catch (err) {
  console.error("Build failed:", err);
  process.exit(1);
}
