import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, tokenHash } from '../lib/security.ts';
import { petSchema, authSchema } from '../lib/validation.ts';
test('passwords use separate salts and reject incorrect passwords', async () => {
  const a = await hashPassword('test-password-123'),
    b = await hashPassword('test-password-123');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('test-password-123', a), true);
  assert.equal(await verifyPassword('wrong-password', a), false);
  assert.equal(await verifyPassword('test-password-123', 'invalid'), false);
});
test('session tokens stored as digests', () => {
  assert.equal(tokenHash('token').length, 64);
  assert.notEqual(tokenHash('token'), tokenHash('other'));
});
test('registration validates and normalizes contact fields', () => {
  const p = {
    name: '  Luna ',
    species: 'Gato',
    breed: 'Mestiza',
    sex: 'Hembra',
    color: 'Blanco',
    ownerName: 'Ana',
    phone: '+51987654321',
    address: 'Calle privada',
    district: 'Lima',
    notes: '',
  };
  assert.equal(petSchema.parse(p).name, 'Luna');
  assert.equal(petSchema.safeParse({ ...p, phone: '987654321' }).success, false);
  assert.equal(petSchema.safeParse({ ...p, species: 'invalid' }).success, false);
  assert.equal(petSchema.safeParse({ ...p, name: ' ' }).success, false);
  assert.equal(petSchema.safeParse({ ...p, notes: 'x'.repeat(601) }).success, false);
  assert.equal(
    authSchema.parse({ email: 'USER@example.com', password: 'test-password-123' }).email,
    'user@example.com',
  );
  assert.equal(
    authSchema.safeParse({ email: 'user@example.com', password: 'short' }).success,
    false,
  );
});
