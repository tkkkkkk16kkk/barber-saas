import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, data } = body;
    const id = data?.id;

    if (!id) return NextResponse.json({ ok: true });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const mpHeaders = { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` };

    // 1) Cuando el dueño aprueba o cancela la suscripción
    if (type === 'subscription_preapproval') {
      const res = await fetch(`https://api.mercadopago.com/preapproval/${id}`, { headers: mpHeaders });
      const sub = await res.json();

      if (sub.external_reference) {
        if (sub.status === 'authorized') {
          const nuevoVencimiento = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();
          await supabaseAdmin
            .from('barberias')
            .update({
              plan_estado: 'activa',
              vence_el: nuevoVencimiento,
              mp_subscription_id: sub.id,
            })
            .eq('id', sub.external_reference);
        } else if (sub.status === 'cancelled' || sub.status === 'paused') {
          await supabaseAdmin
            .from('barberias')
            .update({ plan_estado: 'cancelada' })
            .eq('id', sub.external_reference);
        }
      }
    }

    // 2) Cuando entra cada cobro mensual recurrente
    if (type === 'subscription_authorized_payment') {
      const res = await fetch(`https://api.mercadopago.com/authorized_payments/${id}`, { headers: mpHeaders });
      const pago = await res.json();

      if (pago.status === 'approved' && pago.preapproval_id) {
        const nuevoVencimiento = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from('barberias')
          .update({ plan_estado: 'activa', vence_el: nuevoVencimiento })
          .eq('mp_subscription_id', pago.preapproval_id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}