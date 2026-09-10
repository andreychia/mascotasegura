import { Dog, Cat, PawPrint } from 'lucide-react';
export async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No pudimos completar la solicitud.');
  return data;
}
export const jsonRequest = (method: string, data: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
export function PetIcon({ species, size = 42 }: { species: string; size?: number }) {
  return species === 'Perro' ? (
    <Dog size={size} strokeWidth={1.5} />
  ) : species === 'Gato' ? (
    <Cat size={size} strokeWidth={1.5} />
  ) : (
    <PawPrint size={size} strokeWidth={1.5} />
  );
}
