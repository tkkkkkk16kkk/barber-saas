import { NextResponse } from 'next/server';

const PRECIO_MENSUAL = 15000; // <-- Cambiá acá el precio mensual en ARS

export async function POST(req: Request) {
  try {
    const { barberiaId, slug, email } = await req.json();

    if (!barberiaId || !slug || !email) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const res = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'Suscripción mensual - Sistema de Turnos',
        external_reference: barberiaId,
        payer_email: email,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: PRECIO_MENSUAL,
          currency_id: 'ARS',
        },
        back_url: `${origin}/${slug}/admin?suscripcion=ok`,
        status: 'pending',
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.init_point) {
      return NextResponse.json({ error: data.message || 'Error al crear suscripción' }, { status: 500 });
    }

    return NextResponse.json({ url: data.init_point });
  } catch (err) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}