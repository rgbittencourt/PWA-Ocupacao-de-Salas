import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("preserves original design, logos and typography", async () => {
  const source = await readFile(new URL("../google-apps-script/index.html", import.meta.url), "utf8");
  const publicSource = await readFile(new URL("../public/ocupacao.html", import.meta.url), "utf8");
  assert.match(source, /Ocupação dos Espaços/);
  assert.match(source, /font-family:-apple-system/);
  assert.match(source, /brand-left/);
  assert.match(source, /brand-right/);
  assert.match(publicSource, /\/api\/ocupacao/);
});

test("declares installable branded assets", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.name, "Ocupação de Salas");
  assert.equal(manifest.icons.length, 2);
  await readFile(new URL("../public/ocupacao-icon-512.png", import.meta.url));
  await readFile(new URL("../public/favicon.png", import.meta.url));
});
