'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UsersRound,
  UserX,
} from 'lucide-react';
import { api, jsonRequest } from './ui';

type AdminOwner = {
  id: string;
  email: string;
  accountStatus: 'active' | 'inactive';
  subscriptionStatus: string;
  createdAt: string | null;
  petCount: number;
};

const subscriptionLabel: Record<string, string> = {
  active: 'Pagada',
  trialing: 'En prueba',
  inactive: 'Pendiente',
  past_due: 'Pago vencido',
  canceled: 'Cancelada',
  unpaid: 'Impaga',
  paused: 'Pausada',
};

export function AdminPanel({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers] = useState<AdminOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await api('/api/admin/users'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function toggle(user: AdminOwner) {
    const next = user.accountStatus === 'active' ? 'inactive' : 'active';
    setBusyId(user.id);
    setError('');
    try {
      await api(`/api/admin/users/${user.id}`, jsonRequest('PATCH', { accountStatus: next }));
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, accountStatus: next } : item)),
      );
      setNotice(`La cuenta ${user.email} quedó ${next === 'active' ? 'activa' : 'inactiva'}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId('');
    }
  }

  async function remove(user: AdminOwner) {
    if (
      !window.confirm(
        `¿Eliminar definitivamente a ${user.email} y todas sus mascotas? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setBusyId(user.id);
    setError('');
    try {
      await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setNotice(`La cuenta ${user.email} y todos sus datos fueron eliminados.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId('');
    }
  }

  const active = users.filter((user) => user.accountStatus === 'active').length;
  return (
    <main className="admin-page">
      <div className="page-heading admin-heading">
        <div>
          <p className="eyebrow">CONTROL DE ACCESO</p>
          <h1>Administración de usuarios</h1>
          <p className="muted">Consulta cuentas y controla su acceso a MascotaSegura.</p>
        </div>
        <button className="button secondary" onClick={load} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </div>
      <section className="admin-stats" aria-label="Resumen de usuarios">
        <article>
          <UsersRound size={22} />
          <div>
            <strong>{users.length}</strong>
            <span>Registrados</span>
          </div>
        </article>
        <article>
          <UserCheck size={22} />
          <div>
            <strong>{active}</strong>
            <span>Activos</span>
          </div>
        </article>
        <article>
          <UserX size={22} />
          <div>
            <strong>{users.length - active}</strong>
            <span>Inactivos</span>
          </div>
        </article>
      </section>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <section className="admin-table-card" aria-label="Usuarios registrados">
        {loading ? (
          <div className="admin-loading">
            <LoaderCircle className="spin" />
            <p>Cargando usuarios…</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Cuenta</th>
                  <th>Suscripción</th>
                  <th>Mascotas</th>
                  <th>Registro</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const self = user.email.toLowerCase() === adminEmail.toLowerCase();
                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.email}</strong>
                        {self && (
                          <span className="admin-badge">
                            <ShieldCheck size={13} /> Administrador
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${user.accountStatus}`}>
                          {user.accountStatus === 'active' ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td>
                        {subscriptionLabel[user.subscriptionStatus] || user.subscriptionStatus}
                      </td>
                      <td>{user.petCount}</td>
                      <td>
                        {user.createdAt
                          ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(
                              new Date(user.createdAt),
                            )
                          : 'Sin fecha'}
                      </td>
                      <td>
                        {self ? (
                          <span className="protected-label">Protegida</span>
                        ) : (
                          <div className="admin-actions">
                            <button
                              className="button secondary compact"
                              onClick={() => toggle(user)}
                              disabled={busyId === user.id}
                            >
                              {user.accountStatus === 'active' ? (
                                <UserX size={16} />
                              ) : (
                                <UserCheck size={16} />
                              )}
                              {user.accountStatus === 'active' ? 'Inactivar' : 'Activar'}
                            </button>
                            <button
                              className="icon-button danger"
                              onClick={() => remove(user)}
                              disabled={busyId === user.id}
                              aria-label={`Eliminar definitivamente a ${user.email}`}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
