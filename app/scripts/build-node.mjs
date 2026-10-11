import { build } from 'esbuild';
await build({entryPoints:['server/node.ts'],outfile:'dist/node/server.mjs',bundle:true,format:'esm',platform:'node',target:'node22',packages:'bundle',banner:{js:"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"}});
