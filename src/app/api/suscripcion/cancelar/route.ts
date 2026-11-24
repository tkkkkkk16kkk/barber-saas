import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { barberiaId } = await req.json();

    const { data: barberia } = await supabaseAdmin
      .from('barberias')
      .select('mp_subscription_id')
      .eq('id', barberiaId)
      .single();

    if (!barberia?.mp_subscription_id) {
      return NextResponse.json({ error: 'No tenés una suscripción activa' }, { status: 400 });
    }

    const mpRes = await fetch(
      `https://api.mercadopago.com/preapproval/${barberia.mp_subscription_id}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      }
    );

    if (!mpRes.ok) {
      const err = await mpRes.json();
      return NextResponse.json({ error: err.message || 'Error en Mercado Pago' }, { status: 400 });
    }

    await supabaseAdmin
      .from('barberias')
      .update({ plan_estado: 'cancelada' })
      .eq('id', barberiaId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al cancelar la suscripción' }, { status: 500 });
  }
}