import Link from 'next/link';
import { PawPrint } from 'lucide-react';
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="MascotaSegura, inicio">
      <span className="brand-icon">
        <PawPrint size={23} />
      </span>
      <span>
        Mascota<span className="brand-accent">Segura</span>
      </span>
    </Link>
  );
}
