// PostgreSQL descartável, SOMENTE loopback. Não lê .env nem aceita URL remota.
// Uso: node supabase/tests/run-marco5-local.mjs
// Opcional: PG_BIN aponta para binários PostgreSQL já instalados (sem instalação).
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const bin = process.env.PG_BIN ?? "C:/Program Files/PostgreSQL/17/bin";
const exe = (name) => join(bin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
const workspace = mkdtempSync(join(tmpdir(), "uniguacu-m5-"));
const data = join(workspace, "data");
const log = join(workspace, "postgres.log");
const server = createServer();
await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
const port = server.address().port;
await new Promise((ok) => server.close(ok));
const args = ["-X", "-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"];
const env = { ...process.env, PGHOST: "127.0.0.1", PGPORT: String(port), PGUSER: "postgres", PGDATABASE: "postgres", PGPASSWORD: "", PGSERVICE: "", PGOPTIONS: "", PGCONNECT_TIMEOUT: "5" };
const run = (name, parameters) => execFileSync(exe(name), parameters, { encoding: "utf8", env, timeout: 120000, windowsHide: true });
const sql = (text) => run("psql", [...args, "-c", text]).trim();
const file = (path) => run("psql", [...args, "-f", path]);
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const running = new Set();
function connection(text) {
  const child = spawn(exe("psql"), [...args, "-c", text], { env, windowsHide: true });
  running.add(child);
  let output = "";
  child.stdout.on("data", (part) => { output += part; });
  child.stderr.on("data", (part) => { output += part; });
  const done = new Promise((ok, fail) => {
    child.on("error", fail);
    child.on("close", (code) => { running.delete(child); ok({ code, output }); });
  });
  return { child, done };
}
async function until(query, predicate, label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = sql(query);
    if (predicate(value)) return;
    await wait(50);
  }
  throw new Error(`Timeout: ${label}`);
}
const user = "91000000-0000-4000-8000-000000000001";
const collaborator = "91000000-0000-4000-8000-000000000010";
const product = "91000000-0000-4000-8000-000000000011";
const key = "91000000-0000-4000-8000-000000000012";
const car = "91000000-0000-4000-8000-000000000013";
const auth = `set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`;
const request = (number) => `91000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
let started = false;
try {
  mkdirSync(data);
  run("initdb", ["-D", data, "-U", "postgres", "--auth-local=trust", "--auth-host=trust", "--encoding=UTF8", "--locale=C"]);
  // hba do initdb restringe a localhost; servidor só escuta loopback.
  writeFileSync(join(data, "postgresql.auto.conf"), `listen_addresses = '127.0.0.1'\nport = ${port}\n`);
  run("pg_ctl", ["-D", data, "-l", log, "-w", "start"]);
  started = true;
  sql(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text,name text);
    alter table storage.objects enable row level security;`);
  for (const migration of ["0001_initial_schema.sql", "0002_refinements.sql", "0003_rls_policies.sql", "0004_categories_crud.sql", "0005_simple_entities_crud.sql", "0006_products_crud.sql", "0007_keys_cars_crud.sql", "0008_fix_distance.sql", "0009_lending_rpcs.sql"]) {
    file(join(root, "supabase/migrations", migration));
    console.log(`PASS migration ${migration}`);
  }
  file(join(root, "supabase/tests/marco5_lending.sql"));
  console.log("PASS integração SQL: regras, grants, RLS, identidade e rollback");
  sql(`insert into auth.users values ('${user}','concurrency@example.invalid','{}');
    insert into public.collaborators(id,name) values ('${collaborator}','M5 concorrência');
    insert into public.products(id,name,qtd) values ('${product}','M5 última unidade',1);
    insert into public.keys(id,name) values ('${key}','M5 chave');
    insert into public.car_keys(id,name,mileage) values ('${car}','M5 carro',100);`);

  // A segura a alteração sem commit; B precisa realmente esperar no banco.
  async function dispute(label, first, second, secondSucceeds) {
    const a = connection(`set application_name = 'm5_a'; begin; ${auth}
      set local statement_timeout = '15s'; ${first}; select pg_sleep(2); commit;`);
    await until("select count(*) from pg_stat_activity where application_name = 'm5_a' and wait_event = 'PgSleep'", (x) => x === "1", `${label}: sessão A`);
    const b = connection(`set application_name = 'm5_b'; begin; ${auth}
      set local statement_timeout = '15s'; ${second}; commit;`);
    await until("select count(*) from pg_stat_activity where application_name = 'm5_b' and cardinality(pg_blocking_pids(pid)) > 0", (x) => x === "1", `${label}: bloqueio real B`);
    const [one, two] = await Promise.all([a.done, b.done]);
    assert.equal(one.code, 0, one.output);
    if (secondSucceeds) assert.equal(two.code, 0, two.output);
    else { assert.notEqual(two.code, 0, two.output); assert.match(two.output, /insuficiente|indisponível/); }
    console.log(`PASS concorrência real: ${label} (pg_blocking_pids observado)`);
  }
  await dispute("última unidade", `select public.lend_product('${product}',1,'${collaborator}','${request(20)}')`,
    `select public.lend_product('${product}',1,'${collaborator}','${request(21)}')`, false);
  assert.equal(sql(`select qtd from public.products where id = '${product}'`), "0");
  assert.equal(sql(`select count(*) from public.lendies where product_id = '${product}'`), "1");
  const loan = sql(`select id from public.lendies where product_id = '${product}'`);
  await dispute("devolução simultânea integral", `select public.return_product('${loan}')`, `select public.return_product('${loan}')`, true);
  assert.equal(sql(`select qtd from public.products where id = '${product}'`), "1");
  assert.equal(sql(`select count(*) from public.operations where lend_id = '${loan}' and operation_type = 'PRODUCT_RETURN'`), "1");
  await dispute("mesma chave", `select public.lend_key('${key}','${collaborator}','${request(22)}')`,
    `select public.lend_key('${key}','${collaborator}','${request(23)}')`, false);
  await dispute("mesmo carro", `select public.lend_car('${car}','${collaborator}',100,'${request(24)}')`,
    `select public.lend_car('${car}','${collaborator}',100,'${request(25)}')`, false);
  await dispute("retry com mesmo UUID", `select public.lend_product('${product}',1,'${collaborator}','${request(26)}')`,
    `select public.lend_product('${product}',1,'${collaborator}','${request(26)}')`, true);
  assert.equal(sql(`select qtd from public.products where id = '${product}'`), "0");
  assert.equal(sql(`select count(*) from public.operations where request_id = '${request(26)}'`), "1");
  console.log("PASS todos os cenários PostgreSQL locais. Auth/Storage simulados; não equivale a API Supabase.");
} catch (error) {
  console.error(error.message);
  if (started) console.error(readFileSync(log, "utf8").slice(-6000));
  process.exitCode = 1;
} finally {
  for (const child of running) child.kill();
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log(`${started ? "Cluster isolado encerrado" : "Cluster não iniciado"}; artefatos preservados para diagnóstico: ${workspace}`);
}