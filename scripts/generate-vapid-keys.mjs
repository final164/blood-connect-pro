#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push (works when app is fully closed).
 * Run: node scripts/generate-vapid-keys.mjs
 */
import webpush from "web-push";
import { randomBytes } from "node:crypto";

const keys = webpush.generateVAPIDKeys();
const webhookSecret = randomBytes(24).toString("base64url");

console.log("\n=== BloodLink Web Push keys ===\n");
console.log("# App (.env + Lovable env):");
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@bloodlink.app`);
console.log(`WEBHOOK_SECRET=${webhookSecret}`);
console.log("\n# Supabase Edge Function secrets:");
console.log(`supabase secrets set VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`supabase secrets set VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`supabase secrets set VAPID_SUBJECT=mailto:admin@bloodlink.app`);
console.log(`supabase secrets set WEBHOOK_SECRET=${webhookSecret}`);
console.log("\n# Admin → Notifications → Web Push webhook secret (paste this):");
console.log(webhookSecret);
console.log("\n# Deploy edge function:");
console.log("supabase functions deploy send-push --no-verify-jwt\n");
