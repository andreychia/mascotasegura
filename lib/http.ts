import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.APP_URL || 'http://localhost:3000').origin;
  if (!origin || origin !== expected)
    throw new HttpError(
      403,
      'La solicitud no pertenece a esta página. Recarga e inténtalo otra vez.',
    );
}
export async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Faltan los datos.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16384) {
      await reader.cancel();
      throw new HttpError(413, 'Los datos son demasiado largos.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, 'No se pudieron leer los datos.');
  }
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message ?? 'Revisa los datos.' },
      { status: 400 },
    );
  if (error instanceof HttpError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error');
  return NextResponse.json(
    {
      error:
        'No pudimos conectar con el servicio. Tus datos siguen en el formulario; inténtalo de nuevo.',
    },
    { status: 503 },
  );
}
