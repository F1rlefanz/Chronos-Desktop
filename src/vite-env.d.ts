/// <reference types="vite/client" />
// Vite's ambient types, which cover the side-effect `import './index.css'` in
// main.tsx among others. TypeScript 5 let that import pass untyped; 7 does not.

/**
 * Replaced at build time by Vite's `define` with the version from package.json,
 * so the UI cannot drift away from the released version the way the hardcoded
 * badge did.
 */
declare const __APP_VERSION__: string;
