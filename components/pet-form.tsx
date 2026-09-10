'use client';
import { useState, useEffect, type FormEvent } from 'react';
import { ImagePlus, LockKeyhole, ShieldCheck, LoaderCircle, Check } from 'lucide-react';
import { api, jsonRequest, PetIcon } from './ui';
import type { Pet, PetInput } from '@/lib/validation';
const blank: PetInput = {
  name: '',
  species: 'Perro',
  breed: '',
  sex: 'No especificado',
  color: '',
  ownerName: '',
  phone: '+51',
  address: '',
  district: '',
  notes: '',
};
export function PetForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Pet | null;
  onSaved: (pet: Pet) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<PetInput>(initial || blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [savedPet, setSavedPet] = useState<Pet | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function set(key: keyof PetInput, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const id = savedPet?.id || initial?.id;
      const pet: Pet = await api(
        id ? '/api/pets/' + id : '/api/pets',
        jsonRequest(id ? 'PATCH' : 'POST', values),
      );
      setSavedPet(pet);
      if (file) {
        try {
          await api('/api/pets/' + pet.id + '/photo', {
            method: 'POST',
            headers: { 'Content-Type': file.type },
            body: file,
          });
          pet.hasPhoto = true;
        } catch (e) {
          setError('La ficha se guardó, pero la foto no: ' + (e as Error).message);
          return;
        }
      }
      onSaved(pet);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="pet-form">
      <div className="photo-upload">
        <div className="upload-preview">
          {preview || initial?.hasPhoto ? (
            <img src={preview || '/api/pets/' + initial?.id + '/photo'} alt="Foto de la mascota" />
          ) : (
            <PetIcon species={values.species} />
          )}
        </div>
        <div>
          <label className="button secondary upload-button">
            <ImagePlus size={17} />
            {file ? 'Cambiar foto' : 'Añadir foto'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected && selected.size > 5 * 1024 * 1024) {
                  setError('La foto debe pesar menos de 5 MB.');
                  e.target.value = '';
                  return;
                }
                setFile(selected || null);
                setError('');
              }}
            />
          </label>
          <p className="small-note">Opcional · JPG, PNG o WebP · Hasta 5 MB</p>
        </div>
      </div>
      <fieldset>
        <legend>
          <span>01</span>Sobre tu mascota
        </legend>
        <div className="fields-grid">
          <label>
            Nombre *
            <input
              autoFocus
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="¿Cómo se llama?"
              required
              maxLength={80}
            />
          </label>
          <label>
            Especie *
            <select value={values.species} onChange={(e) => set('species', e.target.value)}>
              {['Perro', 'Gato', 'Conejo', 'Ave', 'Otro'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Raza
            <input
              value={values.breed}
              onChange={(e) => set('breed', e.target.value)}
              placeholder="Ej. mestizo, labrador…"
              maxLength={100}
            />
          </label>
          <label>
            Sexo
            <select value={values.sex} onChange={(e) => set('sex', e.target.value)}>
              {['No especificado', 'Macho', 'Hembra'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="full-width">
            Color o señas particulares
            <input
              value={values.color}
              onChange={(e) => set('color', e.target.value)}
              placeholder="Ej. blanco con una mancha negra en la oreja"
              maxLength={100}
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>
          <span>02</span>Su familia y contacto
        </legend>
        <div className="fields-grid">
          <label>
            Nombre del dueño *
            <input
              value={values.ownerName}
              onChange={(e) => set('ownerName', e.target.value)}
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              placeholder="Tu nombre"
            />
          </label>
          <label>
            Celular / WhatsApp *
            <input
              value={values.phone}
              onChange={(e) => set('phone', e.target.value.replace(/[\s()-]/g, ''))}
              type="tel"
              required
              pattern="[+][1-9][0-9]{7,14}"
              maxLength={16}
              placeholder="+51987654321"
              autoComplete="tel"
            />
            <small>Incluye + y el código de país.</small>
          </label>
          <label className="full-width">
            Distrito y ciudad *
            <input
              value={values.district}
              onChange={(e) => set('district', e.target.value)}
              required
              minLength={2}
              maxLength={150}
              placeholder="Ej. Miraflores, Lima"
            />
          </label>
          <label className="full-width">
            Dirección exacta{' '}
            <span className="private-label">
              <LockKeyhole size={12} />
              Privada
            </span>
            <input
              value={values.address}
              onChange={(e) => set('address', e.target.value)}
              maxLength={250}
              autoComplete="street-address"
              placeholder="Calle, número y referencia (opcional)"
            />
          </label>
        </div>
      </fieldset>
      <label>
        ¿Qué debería saber quien la encuentre?
        <textarea
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Carácter, cuidados importantes o instrucciones para acercarse."
        />
      </label>
      <p className="privacy-callout">
        <ShieldCheck size={20} />
        <span>
          El nombre del dueño, celular, distrito y los datos de la mascota serán visibles para quien
          tenga el QR. Tu correo y dirección exacta serán privados.
        </span>
      </p>
      {error && (
        <div className="error-message" role="alert">
          {error}
          {savedPet && (
            <button type="button" className="text-button" onClick={() => onSaved(savedPet)}>
              Continuar sin la nueva foto
            </button>
          )}
        </div>
      )}
      <div className="form-actions">
        <button className="button secondary" type="button" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
          {busy ? 'Guardando…' : initial || savedPet ? 'Guardar cambios' : 'Guardar y crear QR'}
        </button>
      </div>
    </form>
  );
}
