import { getPublicPet } from './data';
export async function publicPet(id: string) {
  return getPublicPet(id);
}
