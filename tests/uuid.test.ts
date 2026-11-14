import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { v4 as uuidv4, validate, version } from "uuid";

test("UUID: gera identificadores v4 válidos no servidor", () => {
  const ids = Array.from({ length: 100 }, () => uuidv4());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.equal(validate(id), true);
    assert.equal(version(id), 4);
  }
});

test("UUID: implementação de navegador funciona sem crypto.randomUUID em HTTP", () => {
  // --conditions=browser sozinho não remove a condição node. Carrega o entrypoint
  // default declarado pelo pacote para testar realmente a implementação web.
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { readFileSync } from "node:fs";
    import { webcrypto } from "node:crypto";
    const packageUrl = import.meta.resolve("uuid/package.json");
    const metadata = JSON.parse(readFileSync(new URL(packageUrl), "utf8"));
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
    });
    assert.equal(crypto.randomUUID, undefined);
    const { v4, validate, version } = await import(new URL(metadata.exports["."].default, packageUrl).href);
    const ids = Array.from({ length: 100 }, () => v4());
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.equal(validate(id), true);
      assert.equal(version(id), 4);
    }
  `], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});