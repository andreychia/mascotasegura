'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  LogOut,
  X,
  QrCode,
  Download,
  ExternalLink,
  Pencil,
  MapPin,
  PawPrint,
  LockKeyhole,
  Check,
  ShieldCheck,
  LoaderCircle,
} from 'lucide-react';
import { Brand } from './brand';
import { AuthView } from './auth-view';
import { PetForm } from './pet-form';
import { api, PetIcon } from './ui';
import type { Pet } from '@/lib/validation';
const photo =
  'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=800&q=85';
export function Dashboard({ email, unavailable }: { email: string | null; unavailable: boolean }) {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(!!email);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Pet | null>(null);
  const [open, setOpen] = useState(false);
  const [qrPet, setQrPet] = useState<Pet | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    qrDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!email) return;
    let alive = true;
    setLoading(true);
    setError('');
    api('/api/pets')
      .then((data) => {
        if (alive) setPets(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [email, version]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (qrPet) qrDialog.current?.showModal();
    else qrDialog.current?.close();
  }, [qrPet]);
  useEffect(() => {
    if (!email) return;
    type Registry = {
      registerTool: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Registry }).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'start_pet_registration',
          description: 'Abre el formulario de mascota. No guarda datos.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: false },
          execute(input: unknown) {
            if (!input || typeof input !== 'object' || Object.keys(input).length)
              throw new Error('No se esperan parámetros.');
            setEditing(null);
            setOpen(true);
            return { opened: true };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [email]);
  function startNew() {
    setEditing(null);
    setOpen(true);
  }
  async function logout() {
    setBusy(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
      setPets([]);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function saved(pet: Pet) {
    setPets((old) =>
      old.some((p) => p.id === pet.id)
        ? old.map((p) => (p.id === pet.id ? pet : p))
        : [pet, ...old],
    );
    setOpen(false);
    setNotice(
      editing
        ? 'Datos actualizados. Su QR sigue siendo el mismo.'
        : 'Tu mascota ya tiene su ficha. Descarga su QR para el collar.',
    );
    setQrPet(pet);
    setVersion((v) => v + 1);
  }
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <div className="header-right">
            {email ? (
              <>
                <span className="account-email">{email}</span>
                <button
                  className="icon-button"
                  onClick={logout}
                  disabled={busy}
                  aria-label="Cerrar sesión"
                >
                  <LogOut size={19} />
                </button>
              </>
            ) : (
              <span className="header-caption">
                <ShieldCheck size={17} />
                Conectamos mascotas con su familia
              </span>
            )}
          </div>
        </div>
      </header>
      {!email ? (
        <AuthView unavailable={unavailable} />
      ) : (
        <main className="dashboard">
          <div className="page-heading">
            <div>
              <p className="eyebrow">SU HOGAR EMPIEZA CONTIGO</p>
              <h1>
                Mis mascotas<span className="count">{pets.length}</span>
              </h1>
              <p className="muted">Toda su información, a un escaneo de distancia.</p>
            </div>
            <button className="button primary" onClick={startNew}>
              <Plus size={19} />
              Registrar mascota
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              <Check size={18} />
              {notice}
              <button
                className="icon-button"
                onClick={() => setNotice('')}
                aria-label="Cerrar aviso"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {(error || unavailable) && (
            <div className="error-message" role="alert">
              {error || 'No se pudo conectar con el servicio.'}
              <button className="text-button" onClick={() => setVersion((n) => n + 1)}>
                Volver a intentar
              </button>
            </div>
          )}
          <div className="dashboard-grid">
            <section aria-label="Tus mascotas">
              {loading ? (
                <div className="empty-panel" role="status">
                  <LoaderCircle className="spin" />
                  <p>Cargando tus mascotas…</p>
                </div>
              ) : pets.length === 0 ? (
                <div className="empty-panel">
                  <div className="empty-icon">
                    <PawPrint size={48} strokeWidth={1.4} />
                  </div>
                  <h2>Su tranquilidad empieza aquí</h2>
                  <p>
                    Registra a tu compañero y crea su primera ficha.
                    <br />
                    Su familia estará a solo una llamada.
                  </p>
                  <button className="button primary" onClick={startNew}>
                    <Plus size={18} />
                    Registrar mi primera mascota
                  </button>
                  <span className="small-note">
                    Para perros, gatos y todos los que son familia.
                  </span>
                </div>
              ) : (
                <div className="pet-grid">
                  {pets.map((pet) => (
                    <article className="pet-card" key={pet.id}>
                      <div className="pet-card-image">
                        {pet.hasPhoto ? (
                          <img src={'/api/pets/' + pet.id + '/photo?v=' + version} alt={pet.name} />
                        ) : (
                          <PetIcon species={pet.species} size={68} />
                        )}
                        <span className="species-tag">{pet.species}</span>
                      </div>
                      <div className="pet-card-content">
                        <div className="pet-card-title">
                          <h2>{pet.name}</h2>
                          <button
                            className="icon-button"
                            aria-label={'Editar a ' + pet.name}
                            onClick={() => {
                              setEditing(pet);
                              setOpen(true);
                            }}
                          >
                            <Pencil size={17} />
                          </button>
                        </div>
                        <p className="muted">{pet.breed || 'Raza no especificada'}</p>
                        <p className="location">
                          <MapPin size={15} />
                          {pet.district}
                        </p>
                        <div className="card-actions">
                          <button className="button secondary" onClick={() => setQrPet(pet)}>
                            <QrCode size={18} />
                            Ver QR
                          </button>
                          <a
                            className="icon-button"
                            href={'/m/' + pet.id}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={'Abrir ficha pública de ' + pet.name}
                          >
                            <ExternalLink size={19} />
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                  <button className="add-pet-card" onClick={startNew}>
                    <span>
                      <Plus size={28} />
                    </span>
                    Agregar otra mascota
                  </button>
                </div>
              )}
            </section>
            <aside className="info-panel">
              <div className="info-photo">
                <img src={photo} alt="Un perro y un gato descansando juntos entre plantas" />
              </div>
              <div className="info-panel-content">
                <p className="eyebrow">UN COLLAR, UNA CONEXIÓN</p>
                <h2>Más cerca de volver a casa.</h2>
                <ol className="steps">
                  {[
                    ['Completa su ficha', 'Sus datos y cómo contactar contigo.'],
                    ['Descarga su QR', 'Imprímelo o grábalo en su placa.'],
                    ['Siempre a su lado', 'Un escaneo abre su ficha pública.'],
                  ].map(([title, desc], i) => (
                    <li key={title}>
                      <span>{i + 1}</span>
                      <div>
                        <strong>{title}</strong>
                        <p>{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="privacy-callout">
                  <LockKeyhole size={20} />
                  <p>Solo tú puedes editar sus datos. Tu dirección exacta se mantiene privada.</p>
                </div>
              </div>
            </aside>
          </div>
        </main>
      )}
      <footer className="site-footer">
        <span>MascotaSegura</span>
        <span>Hecho para quienes son parte de la familia.</span>
      </footer>
      <dialog
        ref={dialog}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        className="form-dialog"
        aria-labelledby="pet-form-title"
      >
        <div className="dialog-header">
          <div>
            <p className="eyebrow">{editing ? 'SU INFORMACIÓN AL DÍA' : 'UN NUEVO INTEGRANTE'}</p>
            <h2 id="pet-form-title">{editing ? 'Editar mascota' : 'Registrar mascota'}</h2>
          </div>
          <button
            className="icon-button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar formulario"
          >
            <X />
          </button>
        </div>
        {open && (
          <PetForm
            key={editing?.id || 'new'}
            initial={editing}
            onSaved={saved}
            onCancel={() => setOpen(false)}
          />
        )}
      </dialog>
      <dialog
        ref={qrDialog}
        onCancel={() => setQrPet(null)}
        onClose={() => setQrPet(null)}
        className="qr-dialog"
        aria-labelledby="qr-title"
      >
        {qrPet && (
          <>
            <button
              className="icon-button qr-close"
              onClick={() => setQrPet(null)}
              aria-label="Cerrar QR"
            >
              <X />
            </button>
            <div className="qr-symbol">
              <QrCode size={26} />
            </div>
            <p className="eyebrow">SU CAMINO DE VUELTA A CASA</p>
            <h2 id="qr-title">El QR de {qrPet.name}</h2>
            <p className="muted">Este código abre su ficha de contacto.</p>
            <img
              className="qr-image"
              src={'/api/pets/' + qrPet.id + '/qr'}
              alt={'Código QR de ' + qrPet.name}
            />
            <a className="button primary" href={'/api/pets/' + qrPet.id + '/qr'} download>
              <Download size={18} />
              Descargar QR en PNG
            </a>
            <a className="text-link" href={'/m/' + qrPet.id} target="_blank" rel="noreferrer">
              Abrir ficha pública
              <ExternalLink size={16} />
            </a>
            <p className="qr-hint">
              Mantén el borde blanco al imprimir y prueba el escaneo antes de colocar el QR en el
              collar.
            </p>
            {typeof window !== 'undefined' &&
              ['localhost', '127.0.0.1'].includes(window.location.hostname) && (
                <p className="local-note">
                  Vista local: este QR todavía no abrirá desde otro celular. Descarga el QR
                  definitivo cuando la web esté publicada.
                </p>
              )}
          </>
        )}
      </dialog>
    </div>
  );
}
