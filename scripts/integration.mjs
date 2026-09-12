import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import sharp from 'sharp';
import jsQR from 'jsqr';
const base = process.env.APP_URL || 'http://localhost:3100';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Integration tests require a local application.');
if (
  !process.env.DATABASE_URL ||
  !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)
)
  throw new Error('Integration tests require a local database.');
const run = randomUUID();
const emailA = 'integration-a-' + run + '@example.test',
  emailB = 'integration-b-' + run + '@example.test';
const password = 'Integration-' + randomUUID();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
}
async function request(path, { cookie, method = 'GET', body, origin = base, raw = false } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (method !== 'GET') headers.Origin = origin;
  if (body && !raw) headers['Content-Type'] = 'application/json';
  return fetch(base + path, {
    method,
    headers,
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
}
try {
  check((await request('/api/pets')).status === 401, 'anonymous list blocked');
  const registerA = await request('/api/auth/register', {
    method: 'POST',
    body: { email: emailA, password },
  });
  check(registerA.status === 200, 'owner A registers');
  const cookieA = registerA.headers.get('set-cookie')?.split(';')[0];
  check(!!cookieA, 'session cookie issued');
  check(registerA.headers.get('set-cookie').includes('HttpOnly'), 'session is HttpOnly');
  const duplicateA = await request('/api/auth/register', {
    method: 'POST',
    body: { email: emailA.toUpperCase(), password },
  });
  check(duplicateA.status === 409, 'duplicate email is rejected regardless of casing');
  const registerB = await request('/api/auth/register', {
    method: 'POST',
    body: { email: emailB, password },
  });
  check(registerB.status === 200, 'owner B registers');
  const cookieB = registerB.headers.get('set-cookie')?.split(';')[0];
  const input = {
    name: 'Luna de prueba',
    species: 'Gato',
    breed: 'Mestiza',
    sex: 'Hembra',
    color: 'Blanca',
    ownerName: 'Ana de prueba',
    phone: '+51987654321',
    address: 'DIRECCION-PRIVADA-' + run,
    district: 'Miraflores, Lima',
    notes: 'Se asusta con los ruidos. Acércate despacio.',
  };
  check(
    (await request('/api/pets', { method: 'POST', body: input })).status === 401,
    'anonymous create blocked',
  );
  check(
    (
      await request('/api/pets', {
        method: 'POST',
        cookie: cookieA,
        body: input,
        origin: 'https://untrusted.example',
      })
    ).status === 403,
    'cross-origin create blocked',
  );
  check(
    (
      await request('/api/pets', {
        method: 'POST',
        cookie: cookieA,
        body: { ...input, phone: 'invalid' },
      })
    ).status === 400,
    'invalid phone rejected',
  );
  const created = await request('/api/pets', { method: 'POST', cookie: cookieA, body: input });
  check(created.status === 201, 'pet created');
  const pet = await created.json();
  const listed = await (await request('/api/pets', { cookie: cookieA })).json();
  check(
    listed.length === 1 && listed[0].address === input.address,
    'owner reads persisted private data',
  );
  const otherList = await (await request('/api/pets', { cookie: cookieB })).json();
  check(otherList.length === 0, 'other owner cannot list pet');
  check(
    (
      await request('/api/pets/' + pet.id, {
        method: 'PATCH',
        cookie: cookieB,
        body: { ...input, name: 'Changed' },
      })
    ).status === 404,
    'other owner cannot edit pet',
  );
  check(
    (await request('/api/pets/' + pet.id + '/qr', { cookie: cookieB })).status === 404,
    'other owner cannot access management QR endpoint',
  );
  check(
    (
      await request('/api/pets/' + pet.id + '/photo', {
        method: 'POST',
        cookie: cookieB,
        body: Buffer.from('invalid'),
        raw: true,
      })
    ).status === 404,
    'other owner cannot change photo',
  );
  const updated = await request('/api/pets/' + pet.id, {
    method: 'PATCH',
    cookie: cookieA,
    body: { ...input, name: 'Luna actualizada' },
  });
  check(updated.status === 200, 'owner updates pet');
  check((await updated.json()).id === pet.id, 'public ID stays stable');
  const publicResponse = await request('/m/' + pet.id);
  check(publicResponse.ok, 'public page needs no session');
  const html = await publicResponse.text();
  check(html.includes('Luna actualizada'), 'public page shows current information');
  check(!html.includes(input.address), 'private address absent from public HTML and RSC payload');
  check(!html.includes(emailA), 'account email absent from public page');
  check(html.includes('tel:+51987654321'), 'public page has call link');
  check(html.includes('https://wa.me/51987654321'), 'public page has WhatsApp link');
  const qrResponse = await request('/api/pets/' + pet.id + '/qr', { cookie: cookieA });
  check(qrResponse.ok, 'QR downloaded');
  const qrBuffer = Buffer.from(await qrResponse.arrayBuffer());
  const { data, info } = await sharp(qrBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  check(decoded?.data === base + '/m/' + pet.id, 'QR decodes to exact public URL');
  const image = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#087f78' },
  })
    .png()
    .toBuffer();
  check(
    (
      await request('/api/pets/' + pet.id + '/photo', {
        method: 'POST',
        cookie: cookieA,
        body: image,
        raw: true,
      })
    ).ok,
    'photo upload works',
  );
  const publicPhoto = await request('/api/pets/' + pet.id + '/photo');
  check(
    publicPhoto.ok && publicPhoto.headers.get('content-type') === 'image/webp',
    'photo is public, sanitized WebP',
  );
  check(
    (
      await request('/api/pets/' + pet.id + '/photo', {
        method: 'POST',
        cookie: cookieA,
        body: Buffer.from('<svg>invalid</svg>'),
        raw: true,
      })
    ).status === 400,
    'invalid photo rejected',
  );
  check(
    (
      await request('/api/pets/' + pet.id + '/photo', {
        method: 'POST',
        cookie: cookieA,
        body: Buffer.alloc(5 * 1024 * 1024 + 1),
        raw: true,
      })
    ).status === 413,
    'oversized photo rejected',
  );
  const logout = await request('/api/auth/logout', { method: 'POST', cookie: cookieA });
  check(logout.ok, 'logout works');
  check(
    (await request('/api/pets', { cookie: cookieA })).status === 401,
    'revoked session no longer authorizes',
  );
  check(
    (
      await request('/api/auth/login', {
        method: 'POST',
        body: { email: emailA, password: 'wrong-password-123' },
      })
    ).status === 401,
    'incorrect password rejected',
  );
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: emailA, password },
  });
  check(login.ok, 'login works');
  const relisted = await (
    await request('/api/pets', { cookie: login.headers.get('set-cookie')?.split(';')[0] })
  ).json();
  check(relisted[0].id === pet.id && relisted[0].hasPhoto, 'pet and photo persist across sessions');
  const unknown = await request('/m/' + randomUUID());
  const unknownHtml = await unknown.text();
  check(
    unknown.status === 404 || unknownHtml.includes('No encontramos esta ficha'),
    'unknown ID handled',
  );
  console.log(
    'PASS: ' +
      checks +
      ' integration checks with real PostgreSQL. QR decoded, persistence and owner isolation verified.',
  );
} finally {
  await pool.query('DELETE FROM owners WHERE email=ANY($1::text[])', [[emailA, emailB]]);
  // Attempt keys are hashes; remove only keys belonging to this test run.
  const { createHash } = await import('node:crypto');
  const keys = [emailA, emailB].flatMap((email) =>
    ['register', 'login'].map((action) =>
      createHash('sha256')
        .update(action + ':' + email)
        .digest('hex'),
    ),
  );
  await pool.query('DELETE FROM auth_attempts WHERE key=ANY($1::text[])', [keys]);
  await pool.end();
}
