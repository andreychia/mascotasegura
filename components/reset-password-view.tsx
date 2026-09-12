'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, Check, KeyRound, LoaderCircle } from 'lucide-react';
import { api, jsonRequest } from './ui';

export function ResetPasswordView({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const values = new FormData(event.currentTarget);
    try {
      await api(
        '/api/auth/reset-password',
        jsonRequest('POST', {
          token,
          password: values.get('password'),
          confirmation: values.get('confirmation'),
        }),
      );
      setComplete(true);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (complete)
    return (
      <section className="reset-card">
        <span className="subscription-icon success-icon">
          <Check size={28} />
        </span>
        <p className="eyebrow">CONTRASEÑA ACTUALIZADA</p>
        <h1>Ya puedes volver a entrar</h1>
        <p className="muted">
          Cerramos tus sesiones anteriores para proteger tu cuenta. Inicia sesión con tu nueva
          contraseña.
        </p>
        <Link href="/" className="button primary">
          Ir a iniciar sesión
        </Link>
      </section>
    );

  return (
    <section className="reset-card">
      <span className="subscription-icon">
        <KeyRound size={28} />
      </span>
      <p className="eyebrow">RECUPERACIÓN SEGURA</p>
      <h1>Crea una contraseña nueva</h1>
      <p className="muted">Debe tener al menos 10 caracteres.</p>
      <form onSubmit={submit}>
        <label>
          Nueva contraseña
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required
          />
        </label>
        <label>
          Confirmar contraseña
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required
          />
        </label>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy || !token}>
          {busy ? <LoaderCircle size={18} className="spin" /> : <KeyRound size={18} />}
          {busy ? 'Guardando…' : 'Guardar contraseña nueva'}
        </button>
      </form>
      {!token && <p className="error-message">El enlace no es válido. Solicita uno nuevo.</p>}
      <Link href="/" className="text-link reset-back-link">
        <ArrowLeft size={16} /> Volver al inicio
      </Link>
    </section>
  );
}
