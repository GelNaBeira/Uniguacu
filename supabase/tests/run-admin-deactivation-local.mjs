// Banco descartável SOMENTE loopback; não lê .env nem usa credenciais remotas.
// Uso: node supabase/tests/run-admin-deactivation-local.mjs (PG_BIN opcional).
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const bin = process.env.PG_BIN ?? "C:/Program Files/PostgreSQL/17/bin";
const workspace = mkdtempSync(join(tmpdir(), "uniguacu-deactivation-"));
const data = join(workspace, "data");
const server = createServer();
await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
const port = server.address().port;
await new Promise((ok) => server.close(ok));
const env = { ...process.env, PGHOST: "127.0.0.1", PGPORT: String(port), PGUSER: "postgres", PGDATABASE: "postgres", PGPASSWORD: "", PGSERVICE: "", PGOPTIONS: "", PGCONNECT_TIMEOUT: "5" };
const run = (name, args) => execFileSync(join(bin, `${name}${process.platform === "win32" ? ".exe" : ""}`), args, { encoding: "utf8", env, timeout: 120000, windowsHide: true });
const args = ["-X", "-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
let started = false;
try {
  run("initdb", ["-D", data, "-U", "postgres", "--auth-local=trust", "--auth-host=trust", "--encoding=UTF8", "--locale=C"]);
  writeFileSync(join(data, "postgresql.auto.conf"), `listen_addresses = '127.0.0.1'\nport = ${port}\n`);
  run("pg_ctl", ["-D", data, "-l", join(workspace, "postgres.log"), "-w", "start"]);
  started = true;
  run("psql", [...args, "-c", `create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    alter table storage.objects enable row level security;`]);
  for (const migration of ["0001_initial_schema.sql", "0002_refinements.sql", "0003_rls_policies.sql", "0012_admin_profile.sql", "0013_admin_deactivation.sql"]) {
    run("psql", [...args, "-f", join(root, "supabase/migrations", migration)]);
    console.log(`PASS migration ${migration}`);
  }
  run("psql", [...args, "-f", join(root, "supabase/tests/admin_deactivation.sql")]);
  console.log("PASS: USER/ADMIN auto-inativação, terceiros, ADMIN inativo, RPC legada, trigger, grants, último ADMIN e preservação das contas.");
  console.log("Auth/Storage simulados; não substitui homologação da API Supabase.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log(`Artefatos locais preservados: ${workspace}`);
}