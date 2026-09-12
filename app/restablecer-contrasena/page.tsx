import { Brand } from '@/components/brand';
import { ResetPasswordView } from '@/components/reset-password-view';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const value = (await searchParams).token;
  const token = typeof value === 'string' ? value : '';
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Brand />
        </div>
      </header>
      <main className="reset-page">
        <ResetPasswordView token={token} />
      </main>
      <footer className="site-footer">
        <span>MascotaSegura</span>
        <span>Hecho para quienes son parte de la familia.</span>
      </footer>
    </div>
  );
}
