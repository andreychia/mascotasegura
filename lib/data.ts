import { getStore } from '@netlify/blobs';
import { db } from './db';
import { tokenHash } from './security';
import type { Pet, PetInput } from './validation';

export type SubscriptionStatus =
  'active' | 'trialing' | 'inactive' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
export type AccountStatus = 'active' | 'inactive';
type Owner = {
  id: string;
  email: string;
  passwordHash: string;
  accountStatus?: AccountStatus;
  subscriptionStatus: SubscriptionStatus;
  createdAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
};
export type AdminOwner = {
  id: string;
  email: string;
  accountStatus: AccountStatus;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string | null;
  petCount: number;
};
type StoredPet = Pet & { ownerId: string };
type PublicPet = Omit<Pet, 'address' | 'createdAt'>;

const privateColumns = `id, name, species, breed, sex, color, owner_name AS "ownerName", phone, address, district, notes, (photo IS NOT NULL) AS "hasPhoto", created_at AS "createdAt"`;
const blobsEnabled = () => !process.env.DATABASE_URL;
const json = async <T>(store: ReturnType<typeof getStore>, key: string) =>
  (await store.get(key, { type: 'json', consistency: 'strong' })) as T | null;
const ownerKey = (email: string) => `email/${email}`;
const petKey = (id: string) => `pet/${id}`;
const ownerPetKey = (ownerId: string, id: string) => `owner/${ownerId}/${id}`;
const privatePet = ({ ownerId: _ownerId, ...pet }: StoredPet): Pet => pet;

export async function ownerFromSession(tokenHash: string) {
  if (!blobsEnabled()) {
    const { rows } = await db().query(
      `SELECT o.id, o.email, o.account_status AS "accountStatus", o.subscription_status AS "subscriptionStatus"
       FROM sessions s JOIN owners o ON o.id=s.owner_id
       WHERE s.token_hash=$1 AND s.expires_at>now()`,
      [tokenHash],
    );
    return rows[0] as
      | {
          id: string;
          email: string;
          accountStatus: AccountStatus;
          subscriptionStatus: SubscriptionStatus;
        }
      | undefined;
  }
  const sessions = getStore({ name: 'mascotasegura-sessions', consistency: 'strong' });
  const session = await json<{ ownerId: string; expiresAt: string }>(sessions, tokenHash);
  if (!session || new Date(session.expiresAt) <= new Date()) {
    if (session) await sessions.delete(tokenHash);
    return undefined;
  }
  const owner = await json<Owner>(getStore('mascotasegura-owners'), `id/${session.ownerId}`);
  return owner
    ? {
        id: owner.id,
        email: owner.email,
        accountStatus: owner.accountStatus || 'active',
        subscriptionStatus: owner.subscriptionStatus || 'active',
      }
    : undefined;
}

export async function createSession(tokenHash: string, ownerId: string) {
  if (!blobsEnabled()) {
    await db().query(
      "INSERT INTO sessions(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '14 days')",
      [tokenHash, ownerId],
    );
    return;
  }
  await getStore('mascotasegura-sessions').setJSON(tokenHash, {
    ownerId,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

export async function deleteSession(tokenHash: string) {
  if (!blobsEnabled()) {
    await db().query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash]);
    return;
  }
  await getStore('mascotasegura-sessions').delete(tokenHash);
}

export async function bumpAuthAttempt(key: string) {
  if (!blobsEnabled()) {
    const { rows } = await db().query(
      `INSERT INTO auth_attempts(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes')
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_attempts.expires_at<now() THEN 1 ELSE auth_attempts.attempts+1 END,
      expires_at=CASE WHEN auth_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE auth_attempts.expires_at END RETURNING attempts`,
      [key],
    );
    return Number(rows[0].attempts);
  }
  const store = getStore({ name: 'mascotasegura-attempts', consistency: 'strong' });
  for (let retry = 0; retry < 4; retry++) {
    const current = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    const fresh = !current || new Date(current.data.expiresAt) <= new Date();
    const next = {
      attempts: fresh ? 1 : Number(current.data.attempts) + 1,
      expiresAt: fresh
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : current.data.expiresAt,
    };
    const result = await store.setJSON(
      key,
      next,
      current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
    );
    if (result.modified) return next.attempts;
  }
  throw new Error('No se pudo registrar el intento de acceso.');
}

export async function clearAuthAttempt(key: string) {
  if (!blobsEnabled()) {
    await db().query('DELETE FROM auth_attempts WHERE key=$1', [key]);
    return;
  }
  await getStore('mascotasegura-attempts').delete(key);
}

export async function createOwner(owner: Owner) {
  if (!blobsEnabled()) {
    const result = await db().query(
      `INSERT INTO owners(id,email,password_hash,account_status,subscription_status)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING RETURNING id`,
      [
        owner.id,
        owner.email,
        owner.passwordHash,
        owner.accountStatus || 'active',
        owner.subscriptionStatus,
      ],
    );
    return Boolean(result.rowCount);
  }
  const store = getStore({ name: 'mascotasegura-owners', consistency: 'strong' });
  const stored = {
    ...owner,
    accountStatus: owner.accountStatus || 'active',
    createdAt: owner.createdAt || new Date().toISOString(),
  };
  const result = await store.setJSON(ownerKey(owner.email), stored, { onlyIfNew: true });
  if (!result.modified) return false;
  await store.setJSON(`id/${owner.id}`, stored, { onlyIfNew: true });
  return true;
}

export async function ownerByEmail(email: string) {
  if (!blobsEnabled()) {
    const { rows } = await db().query(
      `SELECT id,password_hash AS "passwordHash",account_status AS "accountStatus",subscription_status AS "subscriptionStatus"
       FROM owners WHERE email=$1`,
      [email],
    );
    return rows[0] as
      | {
          id: string;
          passwordHash: string;
          accountStatus: AccountStatus;
          subscriptionStatus: SubscriptionStatus;
        }
      | undefined;
  }
  const owner = await json<Owner>(getStore('mascotasegura-owners'), ownerKey(email));
  return owner
    ? {
        id: owner.id,
        passwordHash: owner.passwordHash,
        accountStatus: owner.accountStatus || 'active',
        subscriptionStatus: owner.subscriptionStatus || 'active',
      }
    : undefined;
}

export async function listAdminOwners(): Promise<AdminOwner[]> {
  if (!blobsEnabled()) {
    const { rows } = await db().query(
      `SELECT o.id,o.email,o.account_status AS "accountStatus",
       o.subscription_status AS "subscriptionStatus",o.created_at AS "createdAt",
       COUNT(p.id)::int AS "petCount"
       FROM owners o LEFT JOIN pets p ON p.owner_id=o.id
       GROUP BY o.id ORDER BY o.created_at DESC`,
    );
    return rows as AdminOwner[];
  }
  const owners = getStore({ name: 'mascotasegura-owners', consistency: 'strong' });
  const pets = getStore({ name: 'mascotasegura-pets', consistency: 'strong' });
  const { blobs } = await owners.list({ prefix: 'id/' });
  const result = await Promise.all(
    blobs.map(async ({ key }) => {
      const owner = await json<Owner>(owners, key);
      if (!owner) return null;
      const ownedPets = await pets.list({ prefix: `owner/${owner.id}/` });
      return {
        id: owner.id,
        email: owner.email,
        accountStatus: owner.accountStatus || 'active',
        subscriptionStatus: owner.subscriptionStatus || 'active',
        createdAt: owner.createdAt || null,
        petCount: ownedPets.blobs.length,
      } satisfies AdminOwner;
    }),
  );
  return result
    .filter((owner): owner is AdminOwner => Boolean(owner))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function setOwnerAccountStatus(ownerId: string, status: AccountStatus) {
  if (!blobsEnabled()) {
    const result = await db().query('UPDATE owners SET account_status=$1 WHERE id=$2', [
      status,
      ownerId,
    ]);
    return Boolean(result.rowCount);
  }
  const store = getStore({ name: 'mascotasegura-owners', consistency: 'strong' });
  const owner = await json<Owner>(store, `id/${ownerId}`);
  if (!owner) return false;
  const updated = { ...owner, accountStatus: status };
  await Promise.all([
    store.setJSON(`id/${ownerId}`, updated),
    store.setJSON(ownerKey(owner.email), updated),
  ]);
  return true;
}

export async function ownerAdminDetails(ownerId: string) {
  if (!blobsEnabled()) {
    const { rows } = await db().query(
      `SELECT id,email,stripe_customer_id AS "stripeCustomerId",
       stripe_subscription_id AS "stripeSubscriptionId" FROM owners WHERE id=$1`,
      [ownerId],
    );
    return rows[0] as
      | { id: string; email: string; stripeCustomerId?: string; stripeSubscriptionId?: string }
      | undefined;
  }
  const owner = await json<Owner>(getStore('mascotasegura-owners'), `id/${ownerId}`);
  return owner
    ? {
        id: owner.id,
        email: owner.email,
        stripeCustomerId: owner.stripeCustomerId,
        stripeSubscriptionId: owner.stripeSubscriptionId,
      }
    : undefined;
}

export async function deleteOwnerCompletely(ownerId: string) {
  const owner = await ownerAdminDetails(ownerId);
  if (!owner) return false;
  if (!blobsEnabled()) {
    await db().query('DELETE FROM owners WHERE id=$1', [ownerId]);
    await Promise.all([
      clearAuthAttempt(tokenHash(`login:${owner.email}`)),
      clearAuthAttempt(tokenHash(`register:${owner.email}`)),
    ]);
    return true;
  }
  const owners = getStore({ name: 'mascotasegura-owners', consistency: 'strong' });
  const sessions = getStore({ name: 'mascotasegura-sessions', consistency: 'strong' });
  const pets = getStore({ name: 'mascotasegura-pets', consistency: 'strong' });
  const photos = getStore('mascotasegura-photos');
  const [sessionList, petList] = await Promise.all([
    sessions.list(),
    pets.list({ prefix: `owner/${ownerId}/` }),
  ]);
  const sessionKeys = await Promise.all(
    sessionList.blobs.map(async ({ key }) => {
      const session = await json<{ ownerId: string }>(sessions, key);
      return session?.ownerId === ownerId ? key : null;
    }),
  );
  const petIds = petList.blobs.map(({ key }) => key.slice(`owner/${ownerId}/`.length));
  await Promise.all([
    ...sessionKeys.filter((key): key is string => Boolean(key)).map((key) => sessions.delete(key)),
    ...petIds.flatMap((id) => [
      pets.delete(petKey(id)),
      pets.delete(ownerPetKey(ownerId, id)),
      photos.delete(id),
    ]),
    owners.delete(`id/${ownerId}`),
    owners.delete(ownerKey(owner.email)),
    owner.stripeCustomerId
      ? owners.delete(`stripe-customer/${owner.stripeCustomerId}`)
      : Promise.resolve(),
    owner.stripeSubscriptionId
      ? owners.delete(`stripe-subscription/${owner.stripeSubscriptionId}`)
      : Promise.resolve(),
    clearAuthAttempt(tokenHash(`login:${owner.email}`)),
    clearAuthAttempt(tokenHash(`register:${owner.email}`)),
  ]);
  return true;
}

export async function updateSubscription(
  ownerId: string,
  status: SubscriptionStatus,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
) {
  if (!blobsEnabled()) {
    await db().query(
      `UPDATE owners SET subscription_status=$1,
       stripe_customer_id=COALESCE($2,stripe_customer_id),
       stripe_subscription_id=COALESCE($3,stripe_subscription_id)
       WHERE id=$4`,
      [status, stripeCustomerId || null, stripeSubscriptionId || null, ownerId],
    );
    return;
  }
  const store = getStore({ name: 'mascotasegura-owners', consistency: 'strong' });
  const owner = await json<Owner>(store, `id/${ownerId}`);
  if (!owner) return;
  const updated: Owner = {
    ...owner,
    subscriptionStatus: status,
    stripeCustomerId: stripeCustomerId || owner.stripeCustomerId,
    stripeSubscriptionId: stripeSubscriptionId || owner.stripeSubscriptionId,
  };
  await Promise.all([
    store.setJSON(`id/${ownerId}`, updated),
    store.setJSON(ownerKey(owner.email), updated),
    stripeCustomerId
      ? store.setJSON(`stripe-customer/${stripeCustomerId}`, { ownerId })
      : Promise.resolve(),
  ]);
}

export async function ownerIdByStripeCustomer(stripeCustomerId: string) {
  if (!blobsEnabled()) {
    const { rows } = await db().query('SELECT id FROM owners WHERE stripe_customer_id=$1', [
      stripeCustomerId,
    ]);
    return rows[0]?.id as string | undefined;
  }
  const link = await json<{ ownerId: string }>(
    getStore('mascotasegura-owners'),
    `stripe-customer/${stripeCustomerId}`,
  );
  return link?.ownerId;
}

export async function listOwnerPets(ownerId: string): Promise<Pet[]> {
  if (!blobsEnabled()) {
    const { rows } = await db().query(
      `SELECT ${privateColumns} FROM pets WHERE owner_id=$1 ORDER BY created_at DESC`,
      [ownerId],
    );
    return rows as Pet[];
  }
  const store = getStore({ name: 'mascotasegura-pets', consistency: 'strong' });
  const { blobs } = await store.list({ prefix: `owner/${ownerId}/` });
  const pets = await Promise.all(blobs.map(({ key }) => json<StoredPet>(store, key)));
  return pets
    .filter((pet): pet is StoredPet => Boolean(pet))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(privatePet);
}

export async function createPet(id: string, ownerId: string, input: PetInput): Promise<Pet> {
  if (!blobsEnabled()) {
    const { rows } = await db().query(
      `INSERT INTO pets(id,owner_id,name,species,breed,sex,color,owner_name,phone,address,district,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${privateColumns}`,
      [
        id,
        ownerId,
        input.name,
        input.species,
        input.breed,
        input.sex,
        input.color,
        input.ownerName,
        input.phone,
        input.address,
        input.district,
        input.notes,
      ],
    );
    return rows[0] as Pet;
  }
  const pet: StoredPet = {
    id,
    ownerId,
    ...input,
    hasPhoto: false,
    createdAt: new Date().toISOString(),
  };
  const store = getStore('mascotasegura-pets');
  await Promise.all([
    store.setJSON(petKey(id), pet, { onlyIfNew: true }),
    store.setJSON(ownerPetKey(ownerId, id), pet, { onlyIfNew: true }),
  ]);
  return privatePet(pet);
}

export async function updatePet(
  id: string,
  ownerId: string,
  input: PetInput,
): Promise<Pet | undefined> {
  if (!blobsEnabled()) {
    const { rows } = await db().query(
      `UPDATE pets SET name=$1,species=$2,breed=$3,sex=$4,color=$5,owner_name=$6,phone=$7,address=$8,district=$9,notes=$10,updated_at=now()
       WHERE id=$11 AND owner_id=$12 RETURNING ${privateColumns}`,
      [
        input.name,
        input.species,
        input.breed,
        input.sex,
        input.color,
        input.ownerName,
        input.phone,
        input.address,
        input.district,
        input.notes,
        id,
        ownerId,
      ],
    );
    return rows[0] as Pet | undefined;
  }
  const store = getStore({ name: 'mascotasegura-pets', consistency: 'strong' });
  const existing = await json<StoredPet>(store, petKey(id));
  if (!existing || existing.ownerId !== ownerId) return undefined;
  const pet: StoredPet = { ...existing, ...input };
  await Promise.all([store.setJSON(petKey(id), pet), store.setJSON(ownerPetKey(ownerId, id), pet)]);
  return privatePet(pet);
}

export async function getPublicPet(id: string): Promise<PublicPet | undefined> {
  if (!blobsEnabled()) {
    const { rows } = await db().query(
      `SELECT id,name,species,breed,sex,color,owner_name AS "ownerName",phone,district,notes,(photo IS NOT NULL) AS "hasPhoto" FROM pets WHERE id=$1`,
      [id],
    );
    return rows[0] as PublicPet | undefined;
  }
  const pet = await json<StoredPet>(getStore('mascotasegura-pets'), petKey(id));
  if (!pet) return undefined;
  const { address: _address, createdAt: _createdAt, ownerId: _ownerId, ...publicFields } = pet;
  return publicFields;
}

export async function ownsPet(id: string, ownerId: string) {
  if (!blobsEnabled()) {
    const result = await db().query('SELECT id FROM pets WHERE id=$1 AND owner_id=$2', [
      id,
      ownerId,
    ]);
    return Boolean(result.rowCount);
  }
  const pet = await json<StoredPet>(getStore('mascotasegura-pets'), petKey(id));
  return pet?.ownerId === ownerId;
}

export async function getPetPhoto(id: string): Promise<Buffer | undefined> {
  if (!blobsEnabled()) {
    const { rows } = await db().query('SELECT photo FROM pets WHERE id=$1', [id]);
    return rows[0]?.photo as Buffer | undefined;
  }
  const photo = await getStore('mascotasegura-photos').get(id, {
    type: 'arrayBuffer',
    consistency: 'strong',
  });
  return photo ? Buffer.from(photo) : undefined;
}

export async function setPetPhoto(id: string, ownerId: string, photo: Buffer) {
  if (!blobsEnabled()) {
    await db().query('UPDATE pets SET photo=$1,updated_at=now() WHERE id=$2 AND owner_id=$3', [
      photo,
      id,
      ownerId,
    ]);
    return;
  }
  const pets = getStore({ name: 'mascotasegura-pets', consistency: 'strong' });
  const pet = await json<StoredPet>(pets, petKey(id));
  if (!pet || pet.ownerId !== ownerId) return;
  const updated = { ...pet, hasPhoto: true };
  await Promise.all([
    getStore('mascotasegura-photos').set(id, Uint8Array.from(photo).buffer),
    pets.setJSON(petKey(id), updated),
    pets.setJSON(ownerPetKey(ownerId, id), updated),
  ]);
}
