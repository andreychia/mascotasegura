'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  BadgeCheck,
  BadgeX,
  Clock3,
  Smartphone,
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
  subscriptionExpiresAt: string | null;
};
type YapePayment = {
  id: string;
  ownerId: string;
  email: string;
  operationNumber: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
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
  const [yapePayments, setYapePayments] = useState<YapePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [owners, payments] = await Promise.all([
        api('/api/admin/users'),
        api('/api/admin/yape-payments'),
      ]);
      setUsers(owners);
      setYapePayments(payments);
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

  async function reviewYape(payment: YapePayment, status: 'approved' | 'rejected') {
    setBusyId(payment.id);
    setError('');
    setNotice('');
    try {
      const result = await api(
        `/api/admin/yape-payments/${payment.id}`,
        jsonRequest('PATCH', { status }),
      );
      setYapePayments((current) =>
        current.map((item) =>
          item.id === payment.id ? { ...item, status, reviewedAt: new Date().toISOString() } : item,
        ),
      );
      if (status === 'approved') {
        setUsers((current) =>
          current.map((item) =>
            item.id === result.ownerId
              ? {
                  ...item,
                  subscriptionStatus: 'active',
                  subscriptionExpiresAt: result.expiresAt,
                }
              : item,
          ),
        );
      }
      setNotice(
        status === 'approved'
          ? `Pago de ${payment.email} aprobado. Acceso activo por 30 días.`
          : `Pago de ${payment.email} rechazado.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId('');
    }
  }

  const active = users.filter((user) => user.accountStatus === 'active').length;
  const pendingYape = yapePayments.filter((payment) => payment.status === 'pending');
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
      <section className="yape-review-card" aria-label="Pagos de Yape pendientes">
        <div className="yape-review-heading">
          <div>
            <p className="eyebrow">PAGOS MANUALES</p>
            <h2>Operaciones de Yape</h2>
          </div>
          <span className="pending-count">
            <Clock3 size={15} /> {pendingYape.length} pendientes
          </span>
        </div>
        {yapePayments.length === 0 ? (
          <p className="muted yape-empty">Todavía no se registraron operaciones de Yape.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table yape-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Operación</th>
                  <th>Monto</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {yapePayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>{payment.email}</strong>
                    </td>
                    <td>
                      <span className="operation-number">
                        <Smartphone size={15} /> {payment.operationNumber}
                      </span>
                    </td>
                    <td>S/{payment.amount.toFixed(2)}</td>
                    <td>
                      {new Intl.DateTimeFormat('es-PE', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(payment.createdAt))}
                    </td>
                    <td>
                      <span className={`payment-status ${payment.status}`}>
                        {payment.status === 'pending'
                          ? 'Pendiente'
                          : payment.status === 'approved'
                            ? 'Aprobado'
                            : 'Rechazado'}
                      </span>
                    </td>
                    <td>
                      {payment.status === 'pending' ? (
                        <div className="admin-actions">
                          <button
                            className="button compact approve-payment"
                            onClick={() => reviewYape(payment, 'approved')}
                            disabled={busyId === payment.id}
                          >
                            <BadgeCheck size={16} /> Aprobar
                          </button>
                          <button
                            className="button secondary compact reject-payment"
                            onClick={() => reviewYape(payment, 'rejected')}
                            disabled={busyId === payment.id}
                          >
                            <BadgeX size={16} /> Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="protected-label">Revisado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
                        {user.subscriptionExpiresAt && user.subscriptionStatus === 'active' && (
                          <small className="subscription-expiry">
                            Hasta{' '}
                            {new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(
                              new Date(user.subscriptionExpiresAt),
                            )}
                          </small>
                        )}
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
