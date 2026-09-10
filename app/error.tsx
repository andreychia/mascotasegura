'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="public-page">
      <section className="public-card public-content">
        <h1>Algo no salió como esperábamos</h1>
        <p>No pudimos cargar la página. Inténtalo nuevamente.</p>
        <button className="button primary" onClick={reset}>
          Volver a intentar
        </button>
      </section>
    </main>
  );
}
