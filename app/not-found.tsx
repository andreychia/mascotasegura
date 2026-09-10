import Link from 'next/link';
import { Brand } from '@/components/brand';
export default function NotFound() {
  return (
    <main className="public-page">
      <Brand />
      <section className="public-card public-content">
        <h1>No encontramos esta ficha</h1>
        <p>Revisa que el enlace o el código QR estén completos.</p>
        <Link className="button primary" href="/">
          Ir al inicio
        </Link>
      </section>
    </main>
  );
}
