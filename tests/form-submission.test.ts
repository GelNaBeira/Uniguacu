import test from "node:test";
import assert from "node:assert/strict";
import { preventNativeSubmit } from "../lib/forms/submission.ts";
import { submitCategory } from "../lib/categories/submission.ts";

test("envio cancela navegação nativa antes da transição e da validação assíncrona", async () => {
  const events: string[] = [];
  let pending: Promise<void> | undefined;
  preventNativeSubmit({ preventDefault: () => { events.push("preventDefault"); } }, (action) => {
    events.push("transition"); pending = action();
  }, async () => { await Promise.resolve(); events.push("submit"); });
  assert.deepEqual(events, ["preventDefault", "transition"]);
  await pending;
  assert.deepEqual(events, ["preventDefault", "transition", "submit"]);
});

test("duplicidade 23505 mantém categoria preenchida sem reset nem navegação", async () => {
  const values = { name: "teste" }; const errors: string[] = [];
  await submitCategory(values, false, {
    save: async () => ({ success: false, message: "Já existe uma categoria com este nome." }),
    showError: (message) => errors.push(message),
    reset: () => assert.fail("Não pode limpar em falha"),
    navigate: () => assert.fail("Não pode navegar em falha"),
  });
  assert.equal(values.name, "teste"); assert.deepEqual(errors, ["Já existe uma categoria com este nome."]);
});