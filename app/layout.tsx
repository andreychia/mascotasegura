import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'MascotaSegura · Siempre cerca de casa', template: '%s · MascotaSegura' },
  description:
    'Registra a tu mascota y crea su identificación QR para que puedan contactar contigo.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
