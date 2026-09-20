// One-off setup script for the Playwright e2e account. Reads
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / E2E_USER_EMAIL /
// E2E_USER_PASSWORD from .env.local (no dotenv dependency — parsed by hand
// to avoid adding one just for this script) and creates the auth user if
// it doesn't exist yet (or resets its password if it does).
//
// This does NOT promote the profile to owner_admin — the
// profiles_prevent_self_privilege_escalation trigger (0002_rls.sql) fires
// on every profiles UPDATE regardless of RLS, including from this
// service-role script, because it checks is_admin() which reads
// auth.uid() — null here, since a standalone script has no session at
// all. Promoting a role always goes through a real admin's authenticated
// session in the app (server/actions/user-management-actions.ts) except
// for this one-time bootstrap, which was done once via direct SQL
// (disable trigger, update, re-enable) rather than by weakening the
// trigger itself just for script convenience. If you ever need to
// recreate this user from scratch, redo that step by hand.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(rootDir, ".env.local");

function loadEnv(filePath) {
  const text = readFileSync(filePath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv(envPath);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const email = env.E2E_USER_EMAIL;
const password = env.E2E_USER_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  console.error("Missing one of NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / E2E_USER_EMAIL / E2E_USER_PASSWORD in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let userId;

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createError) {
  if (!createError.message.toLowerCase().includes("already been registered")) {
    console.error("Failed to create e2e user:", createError.message);
    process.exit(1);
  }
  console.log("e2e user already exists — looking it up to reset its password.");
  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }
  const existing = list.users.find((u) => u.email === email);
  if (!existing) {
    console.error("Could not find the existing e2e user by email.");
    process.exit(1);
  }
  userId = existing.id;
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  if (updateError) {
    console.error("Failed to reset e2e user password:", updateError.message);
    process.exit(1);
  }
} else {
  userId = created.user.id;
  console.log("Created e2e user:", userId);
}

console.log(`e2e auth user ready: ${email} (id ${userId})`);

const { data: profile } = await admin.from("profiles").select("role, is_active").eq("id", userId).maybeSingle();
if (profile?.role !== "owner_admin" || !profile.is_active) {
  console.warn(
    "This profile is not an active owner_admin yet (role: " +
      (profile?.role ?? "unknown") +
      "). The e2e suite needs full module access — promote it once via direct SQL " +
      "(see the comment at the top of this file), since the app's own role-change " +
      "path requires a real admin session that a standalone script doesn't have."
  );
}
