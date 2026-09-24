import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const env = { ...process.env };

// This Windows environment cannot initialize Next 15's native SWC DLL.
// Use the installed WASM compiler for local commands; other platforms use Next normally.
if (process.platform === "win32") {
  env.NEXT_TEST_WASM_DIR = dirname(require.resolve("@next/swc-wasm-nodejs/wasm.js"));
}

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});

child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
