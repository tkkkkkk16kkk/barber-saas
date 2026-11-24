import { NextResponse } from 'next/server';

const PLANES = {
  mensual: {
    reason: 'BarberTurnos - Plan Mensual',
    frequency: 1,
    amount: 15000,
  },
  trimestral: {
    reason: 'BarberTurnos - Plan Trimestral',
    frequency: 3,
    amount: 40000,
  },
  anual: {
    reason: 'BarberTurnos - Plan Anual',
    frequency: 12,
    amount: 144000,
  },
} as const;

type PlanKey = keyof typeof PLANES;

export async function POST(req: Request) {
  try {
    const { barberiaId, slug, email, planTipo = 'mensual' } = await req.json();
    const plan = PLANES[(planTipo as PlanKey) in PLANES ? (planTipo as PlanKey) : 'mensual'];

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tu-dominio.vercel.app';

    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: plan.reason,
        external_reference: `${barberiaId}:${planTipo}`,
        payer_email: email,
        auto_recurring: {
          frequency: plan.frequency,
          frequency_type: 'months',
          transaction_amount: plan.amount,
          currency_id: 'ARS',
        },
        back_url: `${appUrl}/${slug}/admin`,
        status: 'pending',
      }),
    });

    const data = await mpRes.json();

    if (!mpRes.ok || !data.init_point) {
      return NextResponse.json(
        { error: data.message || 'Error al crear suscripción en Mercado Pago' },
        { status: 400 }
      );
    }

    return NextResponse.json({ url: data.init_point });
  } catch {
    return NextResponse.json({ error: 'Error interno al crear suscripción' }, { status: 500 });
  }
}