#!/usr/bin/env node
import { runHook } from "./guard/hook.js";

// Hook binary: Claude Code pipes the event JSON on stdin. Exit 2 blocks the action.
runHook(process.stdin, process.stdout).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`eco-forge guard crashed: ${(error as Error).message}\n`);
    // Fail closed: a crash blocks rather than silently allowing.
    process.exitCode = 2;
  },
);
