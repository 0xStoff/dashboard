import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const workspace = new URL("../../", import.meta.url);

test("API never imports provider adapters", async () => {
  const source = await sourceText("apps/api/src");
  assert.doesNotMatch(source, /@dashboard\/providers|packages\/providers/);
});

test("domain remains independent of frameworks and runtime configuration", async () => {
  const source = await sourceText("packages/domain/src");
  assert.doesNotMatch(source, /(?:react|fastify|drizzle|provider|process\.env|node:http)/i);
});

test("v2 has no Robinhood-specific product path", async () => {
  const source = `${await sourceText("apps")}${await sourceText("packages")}`;
  assert.doesNotMatch(source, /robinhood/i);
});

test("web source does not coerce portfolio values to Number", async () => {
  const source = await sourceText("apps/web/src");
  assert.doesNotMatch(source, /(?:Number|parseFloat|parseInt)\s*\(/);
});

async function sourceText(relativeDirectory) {
  const root = path.resolve(workspace.pathname, relativeDirectory);
  const files = await walk(root);
  const sources = await Promise.all(files.filter((file) => /\.(?:ts|tsx|css|html)$/.test(file)).map((file) => readFile(file, "utf8")));
  return sources.join("\n");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await walk(location));
    else results.push(location);
  }
  return results;
}
