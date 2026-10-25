#!/usr/bin/env node
import crypto from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error('Error: Password argument missing.');
  console.error('Usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}

// Generate fresh 16-byte cryptographic salt
const salt = crypto.randomBytes(16);
const iterations = 100000;
const keylen = 32; // 32 bytes = 256 bits output
const digest = 'sha256';

const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);

const saltB64 = salt.toString('base64');
const hashB64 = derivedKey.toString('base64');

const formatted = `pbkdf2$${iterations}$${saltB64}$${hashB64}`;
console.log(formatted);
