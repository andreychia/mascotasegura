import { db } from './db';
export const privateColumns = `id, name, species, breed, sex, color, owner_name AS "ownerName", phone, address, district, notes, (photo IS NOT NULL) AS "hasPhoto", created_at AS "createdAt"`;
export async function publicPet(id: string) {
  const { rows } = await db().query(
    `SELECT id,name,species,breed,sex,color,owner_name AS "ownerName",phone,district,notes,(photo IS NOT NULL) AS "hasPhoto" FROM pets WHERE id=$1`,
    [id],
  );
  return rows[0];
}
