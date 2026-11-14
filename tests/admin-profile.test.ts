import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accessFromForm, accessSchema, newUserSchema, userAccessSchema, deactivateUserSchema, profileSchema, accountError, permissionLabels } from "../lib/users/schema.ts";
import { permissionFlags, hasPermission } from "../lib/auth/permissions.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const access = accessFromForm(new FormData());
test("novos usuários não recebem permissões implícitas; checkboxes produzem booleanos", () => {
  assert.equal(access.version, 1);
  for (const flag of permissionFlags) {
    assert.equal((access as Record<string, unknown>)[flag], false);
    assert.ok(permissionLabels[flag]);
  }
  const form = new FormData(); form.set("can_lend", "on"); form.set("can_delete", "true"); form.set("role", "ADMIN");
  const parsed = accessSchema.parse(accessFromForm(form));
  assert.equal(parsed.can_lend, true); assert.equal(parsed.can_delete, false);
  assert.equal("role" in parsed, false);
});
test("documento de permissões rejeita versão, chaves, tipos e campos faltantes", () => {
  assert.equal(accessSchema.safeParse(access).success, true);
  for (const invalid of [{ ...access, version: 2 }, { ...access, can_lend: "true" }, { ...access, owner: true }, { version: 1 }]) {
    assert.equal(accessSchema.safeParse(invalid).success, false);
  }
});
test("criação valida identidade, senha, papel e permissões sem alterar a senha", () => {
  const valid = { name: " Usuário Teste ", email: " teste@example.org ", password: " senha-inicial-123 ", role: "USER", limited_access: access };
  const parsed = newUserSchema.parse(valid);
  assert.equal(parsed.name, "Usuário Teste"); assert.equal(parsed.email, "teste@example.org"); assert.equal(parsed.password, valid.password);
  assert.equal(newUserSchema.safeParse({ ...valid, password: "123456789012" }).success, true);
  for (const patch of [{ password: "curta" }, { password: "12345678901" }, { email: "errado" }, { role: "admin" }, { name: " " }, { limited_access: {} }]) {
    assert.equal(newUserSchema.safeParse({ ...valid, ...patch }).success, false);
  }
});
test("edição de acesso exige UUID e perfil só aceita nome válido", () => {
  assert.equal(userAccessSchema.safeParse({ id: "outro", role: "ADMIN", limited_access: access }).success, false);
  assert.equal(userAccessSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111", role: "ADMIN", limited_access: access }).success, true);
  assert.equal(profileSchema.safeParse({ name: "a" }).success, false);
  assert.equal(profileSchema.safeParse({ name: "a".repeat(121) }).success, false);
  assert.deepEqual(profileSchema.parse({ name: " Maria ", role: "ADMIN", is_active: true }), { name: "Maria" });
  assert.equal(hasPermission({ role: "USER", is_active: false, limited_access: { ...access, can_lend: true } }, "can_lend"), false);
});
test("mensagens não expõem detalhes internos e sinalizam migração pendente", () => {
  assert.match(accountError("PGRST202"), /migração/);
  assert.match(accountError("23514"), /administrador ativo/);
  assert.match(accountError("42501"), /acesso/);
});
test("rotas e cada ação administrativa verificam ADMIN; chave restrita a server-only", () => {
  for (const path of ["layout.tsx", "page.tsx", "users/page.tsx"]) assert.match(read(`app/(app)/admin/${path}`), /await requireAdmin\(\)/);
  const actions = read("app/(app)/admin/actions.ts");
  assert.ok(actions.startsWith('"use server"'));
  assert.equal((actions.match(/await requireAdmin\(\)/g) ?? []).length, 3);
  assert.ok(actions.indexOf('rpc("admin_user_gate")') < actions.indexOf("createAdminClient()"));
  assert.match(actions, /app_metadata: \{ provisioning:/);
  assert.doesNotMatch(actions, /deleteUser|\.from\("usuarios"\)\.update/);
  assert.ok(read("lib/supabase/admin.ts").startsWith('import "server-only"'));
  for (const component of ["profile-form.tsx", "user-form.tsx"]) assert.doesNotMatch(read(`components/users/${component}`), /SERVICE_ROLE|supabase\/admin/);
});
test("perfil não oferece auto-inativação; ADMIN só vê inativação de terceiros ativos", () => {
  assert.doesNotMatch(read("app/(app)/perfil/actions.ts"), /deactivate|signOut/);
  assert.doesNotMatch(read("components/users/profile-form.tsx"), /deactivat|Inativar|confirmation/);
  assert.match(read("app/(app)/admin/users/page.tsx"), /user.is_active && actor.id !== user.id && <DeactivateUserForm/);
  assert.match(read("components/users/deactivate-user-form.tsx"), /name="confirmation" required disabled=\{pending\}/);
  assert.match(read("components/app-navigation.tsx"), /role === "ADMIN" && <Link href="\/admin"/);
});
test("inativação valida UUID e confirmação e normaliza UUID antes de comparar o próprio ID", () => {
  const id = "ABCDEF12-1111-4111-8111-111111111111";
  assert.equal(deactivateUserSchema.parse({ id, confirmation: "on" }).id, id.toLowerCase());
  for (const input of [{ id, confirmation: null }, { id, confirmation: "true" }, { id: "inválido", confirmation: "on" }]) {
    assert.equal(deactivateUserSchema.safeParse(input).success, false);
  }
  const action = read("app/(app)/admin/actions.ts").split("export async function deactivateUser")[1];
  assert.match(action, /const actor = await requireAdmin\(\)/);
  assert.match(action, /parsed.data.id === actor.id.toLowerCase\(\)/);
  assert.ok(action.indexOf("parsed.data.id === actor.id") < action.indexOf('rpc("admin_deactivate_user"'));
  assert.doesNotMatch(action, /createAdminClient|signOut|deleteUser|\.delete\(/);
});
test("banco rejeita auto-inativação e USER, revoga RPC antiga e preserva último ADMIN", () => {
  const sql = read("supabase/migrations/0013_admin_deactivation.sql");
  assert.match(sql, /auth.uid\(\) = p_id/);
  assert.match(sql, /not private.is_admin\(\)/);
  assert.match(sql, /auth.uid\(\) = old.id/);
  assert.match(sql, /old.is_active and not new.is_active/);
  assert.match(sql, /Último administrador ativo/);
  assert.match(sql, /pg_advisory_xact_lock\(6012001\)/);
  assert.match(sql, /revoke all on function public.deactivate_my_account\(\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public.admin_deactivate_user\(uuid\) to authenticated/);
  assert.doesNotMatch(sql, /disable row level security|delete from|grant update/i);
});
test("migração limita RPCs à sessão autenticada e mantém RLS e histórico", () => {
  const sql = read("supabase/migrations/0012_admin_profile.sql");
  for (const name of ["admin_user_gate", "admin_update_user_access", "update_my_profile", "deactivate_my_account"]) {
    assert.match(sql, new RegExp(`create function public\\.${name}`));
  }
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to authenticated/);
  assert.match(sql, /Último administrador ativo/);
  assert.match(sql, /pg_advisory_xact_lock\(6012001\)/);
  assert.match(sql, /new.raw_app_meta_data -> 'provisioning'/);
  assert.doesNotMatch(sql, /disable row level security|delete from public\.usuarios|grant update/i);
  assert.match(sql, /'profile-images','profile-images',false,3145728/);
  assert.match(sql, /id = auth.uid\(\) and is_active/);
});