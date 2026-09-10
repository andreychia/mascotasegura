import { notFound } from 'next/navigation';
import { publicPet } from '@/lib/pets';
import { idSchema } from '@/lib/validation';
import { Brand } from '@/components/brand';
import { PawPrint, Phone, MessageCircle, MapPin, Heart, ShieldCheck } from 'lucide-react';
export const dynamic = 'force-dynamic';
export default async function PublicPetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  let pet;
  try {
    pet = await publicPet(id);
  } catch {
    return (
      <main className="public-page">
        <Brand />
        <section className="public-card">
          <h1>No pudimos cargar la ficha</h1>
          <p>
            El servicio no está disponible por un momento. Vuelve a abrir este enlace en unos
            minutos.
          </p>
          <a className="button primary" href={'/m/' + id}>
            Volver a intentar
          </a>
        </section>
      </main>
    );
  }
  if (!pet) notFound();
  return (
    <main className="public-page">
      <Brand />
      <article className="public-card">
        <div className="public-photo">
          {pet.hasPhoto ? (
            <img src={'/api/pets/' + id + '/photo'} alt={pet.name} />
          ) : (
            <PawPrint size={90} strokeWidth={1} />
          )}
          <span className="photo-badge">
            <ShieldCheck size={15} /> Identificación de mascota
          </span>
        </div>
        <div className="public-content">
          <p className="eyebrow">HOLA, SOY</p>
          <h1>{pet.name}</h1>
          <p className="muted">
            {pet.species}
            {pet.breed ? ' · ' + pet.breed : ''}
            {pet.sex !== 'No especificado' ? ' · ' + pet.sex : ''}
          </p>
          <div className="found-note">
            <Heart size={22} />
            <p>
              Si me encontraste, contacta a mi familia.
              <br />
              <strong>Gracias por ayudarme a volver a casa.</strong>
            </p>
          </div>
          <section>
            <h2>Mi familia</h2>
            <p className="owner-name">{pet.ownerName}</p>
            <p className="location">
              <MapPin size={17} />
              {pet.district}
            </p>
            <div className="contact-actions">
              <a className="button primary" href={'tel:' + pet.phone}>
                <Phone size={18} />
                Llamar al dueño
              </a>
              <a
                className="button secondary"
                href={
                  'https://wa.me/' +
                  pet.phone.replace(/\D/g, '') +
                  '?text=' +
                  encodeURIComponent(
                    'Hola, encontré a ' + pet.name + ' y vi su ficha en MascotaSegura.',
                  )
                }
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={18} />
                Escribir por WhatsApp
              </a>
            </div>
          </section>
          {(pet.color || pet.notes) && (
            <section className="public-details">
              <h2>Un poco más sobre mí</h2>
              {pet.color && (
                <p>
                  <strong>Color / señas:</strong> {pet.color}
                </p>
              )}
              {pet.notes && <p className="preserve-lines">{pet.notes}</p>}
            </section>
          )}
          <p className="privacy-note">
            <ShieldCheck size={16} />
            La dirección exacta de mi familia es privada.
          </p>
        </div>
      </article>
      <p className="public-footer">Un pequeño código. Un gran camino a casa.</p>
    </main>
  );
}
