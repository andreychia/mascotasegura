'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, ArrowRight, LoaderCircle, LockKeyhole, PawPrint, ShieldCheck } from 'lucide-react';
import { api, jsonRequest } from './ui';
export function AuthView({ unavailable }: { unavailable: boolean }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const values = new FormData(e.currentTarget);
    try {
      await api(
        '/api/auth/' + mode,
        jsonRequest('POST', { email: values.get('email'), password: values.get('password') }),
      );
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="welcome">
      <section className="welcome-form">
        <span className="welcome-pill">
          <Heart size={15} />
          Su familia, siempre a un escaneo
        </span>
        <h1>
          Un pequeño QR.
          <br />
          Un gran camino
          <br />a <span>casa.</span>
        </h1>
        <p className="welcome-description">
          Registra a tu mascota, añade tus datos de contacto y lleva su identificación en el collar.
        </p>
        <div className="auth-card">
          <div className="auth-tabs" role="group" aria-label="Acceso a tu cuenta">
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => {
                setMode('register');
                setError('');
              }}
              aria-pressed={mode === 'register'}
            >
              Crear mi cuenta
            </button>
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login');
                setError('');
              }}
              aria-pressed={mode === 'login'}
            >
              Ya tengo cuenta
            </button>
          </div>
          <form onSubmit={submit}>
            <label>
              Correo electrónico
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                required
                maxLength={254}
              />
            </label>
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={10}
                maxLength={128}
                placeholder={mode === 'register' ? 'Al menos 10 caracteres' : 'Tu contraseña'}
                required
              />
            </label>
            {(error || unavailable) && (
              <p className="error-message" role="alert">
                {error || 'El servicio no está disponible por un momento.'}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? <LoaderCircle size={18} className="spin" /> : null}
              {busy
                ? 'Un momento…'
                : mode === 'register'
                  ? 'Crear cuenta y registrar mascota'
                  : 'Entrar a mis mascotas'}
              {!busy && <ArrowRight size={18} />}
            </button>
          </form>
          <p className="auth-privacy">
            <LockKeyhole size={14} />
            Tus mascotas se administran en un espacio privado.
          </p>
        </div>
      </section>
      <section className="welcome-visual">
        <img
          src="https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1200&q=85"
          alt="Un perro y un gato juntos entre plantas"
        />
        <div className="visual-top">
          <PawPrint size={20} />
          <span>PERROS, GATOS Y MÁS</span>
        </div>
        <div className="visual-bottom">
          <span className="visual-label">PARTE DE TU FAMILIA</span>
          <h2>
            Que sus aventuras
            <br />
            siempre terminen
            <br />
            en casa.
          </h2>
          <p>Nombre, contacto y un QR que los conecta contigo.</p>
        </div>
        <div className="floating-tag">
          <span>
            <ShieldCheck size={23} />
          </span>
          <div>
            <strong>Una ficha que los acompaña</strong>
            <p>Contacto directo con su dueño</p>
          </div>
        </div>
      </section>
    </main>
  );
}
