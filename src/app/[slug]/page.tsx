'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { calcularHorariosLibres } from '@/app/lib/disponibilidad';
import { Calendar, Clock, Scissors, User, CheckCircle2, Copy, CreditCard } from 'lucide-react';

interface Barberia {
  id: string;
  nombre: string;
  whatsapp: string;
  cobra_sena: boolean;
  sena_monto: number;
  mp_dato: string;
}
interface Barbero { id: string; nombre: string; }
interface Servicio { id: string; nombre: string; duracion_min: number; precio: number; }

function ReservaContenido() {
  const { slug } = useParams<{ slug: string }>();

  const [barberia, setBarberia] = useState<Barberia | null>(null);
  const [barberos, setBarberos] = useState<Barbero[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);

  const [servicioSel, setServicioSel] = useState<Servicio | null>(null);
  const [barberoSel, setBarberoSel] = useState<Barbero | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [horariosLibres, setHorariosLibres] = useState<string[]>([]);
  const [motivoCerrado, setMotivoCerrado] = useState<string | null>(null);
  const [horaSel, setHoraSel] = useState<string | null>(null);

  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [copiadoMp, setCopiadoMp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function cargarDatos() {
      const { data: barb } = await supabase
        .from('barberias')
        .select('id, nombre, whatsapp, cobra_sena, sena_monto, mp_dato')
        .eq('slug', slug)
        .single();

      if (!barb) {
        setCargando(false);
        return;
      }
      setBarberia(barb);

      const [{ data: bList }, { data: sList }] = await Promise.all([
        supabase.from('barberos').select('id, nombre').eq('barberia_id', barb.id).eq('activo', true),
        supabase.from('servicios').select('id, nombre, duracion_min, precio').eq('barberia_id', barb.id).eq('activo', true),
      ]);

      setBarberos(bList || []);
      setServicios(sList || []);
      setCargando(false);
    }
    cargarDatos();
  }, [slug]);

  useEffect(() => {
    if (!barberia || !barberoSel || !servicioSel || !fecha) return;

    async function buscarDisponibilidad() {
      setHoraSel(null);
      setMotivoCerrado(null);

      // 1. Chequear si es día libre puntual (para toda la barbería o para este barbero)
      const { data: diasLibres } = await supabase
        .from('dias_libres')
        .select('barbero_id, motivo')
        .eq('barberia_id', barberia!.id)
        .eq('fecha', fecha);

      const bloqueo = (diasLibres || []).find(
        (d) => d.barbero_id === null || d.barbero_id === barberoSel!.id
      );

      if (bloqueo) {
        setHorariosLibres([]);
        setMotivoCerrado(bloqueo.motivo || 'No hay atención en esta fecha.');
        return;
      }

      // 2. Buscar horarios normales y turnos ocupados
      const diaSemana = new Date(`${fecha}T12:00:00`).getDay();
      const inicioDia = new Date(`${fecha}T00:00:00`).toISOString();
      const finDia = new Date(`${fecha}T23:59:59`).toISOString();

      const [{ data: horarios }, { data: turnos }] = await Promise.all([
        supabase
          .from('horarios_barbero')
          .select('hora_inicio, hora_fin')
          .eq('barbero_id', barberoSel!.id)
          .eq('dia_semana', diaSemana),
        supabase
          .from('turnos')
          .select('inicio, fin')
          .eq('barbero_id', barberoSel!.id)
          .in('estado', ['confirmado', 'pendiente_sena'])
          .gte('inicio', inicioDia)
          .lte('inicio', finDia),
      ]);

      const libres = calcularHorariosLibres(
        horarios || [],
        turnos || [],
        servicioSel!.duracion_min,
        30
      );
      setHorariosLibres(Array.from(new Set(libres)).sort());
    }
    buscarDisponibilidad();
  }, [barberia, barberoSel, servicioSel, fecha]);

  async function confirmarTurno(e: React.FormEvent) {
    e.preventDefault();
    if (!barberia || !barberoSel || !servicioSel || !horaSel) return;

    setGuardando(true);
    setErrorMsg('');

    const inicioDate = new Date(`${fecha}T${horaSel}:00`);
    const finDate = new Date(inicioDate.getTime() + servicioSel.duracion_min * 60000);

    const { error } = await supabase.from('turnos').insert({
      barberia_id: barberia.id,
      barbero_id: barberoSel.id,
      servicio_id: servicioSel.id,
      cliente_nombre: nombreCliente,
      cliente_telefono: telefonoCliente,
      inicio: inicioDate.toISOString(),
      fin: finDate.toISOString(),
      estado: barberia.cobra_sena ? 'pendiente_sena' : 'confirmado',
    });

    setGuardando(false);

    if (error) {
      setErrorMsg('Ese horario acaba de ser tomado. Elegí otro por favor.');
    } else {
      setConfirmado(true);
    }
  }

  function copiarDatoMp() {
    if (!barberia?.mp_dato) return;
    navigator.clipboard.writeText(barberia.mp_dato);
    setCopiadoMp(true);
    setTimeout(() => setCopiadoMp(false), 2000);
  }

  if (cargando) return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Cargando...</div>;
  if (!barberia) return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Barbería no encontrada.</div>;

  if (confirmado) {
    const esLinkMp = barberia.mp_dato?.startsWith('http');
    const textoWa = encodeURIComponent(
      barberia.cobra_sena
        ? `Hola! Reservé un turno en ${barberia.nombre} y te envío el comprobante de la seña ($${barberia.sena_monto.toLocaleString('es-AR')}):\n- Servicio: ${servicioSel?.nombre}\n- Barbero: ${barberoSel?.nombre}\n- Fecha: ${fecha} a las ${horaSel} hs\n- Nombre: ${nombreCliente}`
        : `Hola! Reservé un turno en ${barberia.nombre}:\n- Servicio: ${servicioSel?.nombre}\n- Barbero: ${barberoSel?.nombre}\n- Fecha: ${fecha} a las ${horaSel} hs\n- Nombre: ${nombreCliente}`
    );

    return (
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-white mx-auto" />
          <h1 className="text-2xl font-bold">
            {barberia.cobra_sena ? '¡Turno pre-reservado!' : '¡Turno confirmado!'}
          </h1>
          <p className="text-neutral-400 text-sm">
            {servicioSel?.nombre} con {barberoSel?.nombre} el {fecha} a las {horaSel} hs.
          </p>

          {barberia.cobra_sena && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-left space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <CreditCard className="w-4 h-4" />
                Seña requerida: ${barberia.sena_monto.toLocaleString('es-AR')}
              </div>
              <p className="text-xs text-neutral-400">
                Para confirmar tu turno, aboná la seña por Mercado Pago y mandá el comprobante por WhatsApp.
              </p>

              {esLinkMp ? (
                <a
                  href={barberia.mp_dato}
                  target="_blank"
                  className="block w-full text-center bg-sky-500 text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-sky-400 transition"
                >
                  Pagar seña con Mercado Pago
                </a>
              ) : (
                <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
                  <span className="text-xs text-neutral-200 font-mono truncate">{barberia.mp_dato}</span>
                  <button
                    onClick={copiarDatoMp}
                    className="flex items-center gap-1 text-xs font-semibold text-white bg-neutral-800 px-2.5 py-1 rounded-md hover:bg-neutral-700"
                  >
                    <Copy className="w-3 h-3" />
                    {copiadoMp ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              )}
            </div>
          )}

          <a
            href={`https://wa.me/${barberia.whatsapp}?text=${textoWa}`}
            target="_blank"
            className="block w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-neutral-200 transition"
          >
            {barberia.cobra_sena ? 'Enviar comprobante por WhatsApp' : 'Confirmar por WhatsApp'}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <header className="text-center border-b border-neutral-800 pb-4">
          <h1 className="text-2xl font-bold tracking-tight">{barberia.nombre}</h1>
          <p className="text-neutral-400 text-sm">Reservá tu turno en segundos</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Scissors className="w-4 h-4" /> 1. Elegí el servicio
          </h2>
          <div className="space-y-2">
            {servicios.map((s) => (
              <button
                key={s.id}
                onClick={() => setServicioSel(s)}
                className={`w-full flex justify-between items-center p-3.5 rounded-xl border text-left transition ${
                  servicioSel?.id === s.id
                    ? 'bg-white text-black border-white'
                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
                }`}
              >
                <div>
                  <p className="font-medium">{s.nombre}</p>
                  <p className={`text-xs ${servicioSel?.id === s.id ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    {s.duracion_min} min
                  </p>
                </div>
                <span className="font-semibold">${s.precio.toLocaleString('es-AR')}</span>
              </button>
            ))}
          </div>
        </section>

        {servicioSel && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <User className="w-4 h-4" /> 2. Elegí tu barbero
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {barberos.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBarberoSel(b)}
                  className={`p-3 rounded-xl border font-medium transition ${
                    barberoSel?.id === b.id
                      ? 'bg-white text-black border-white'
                      : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  {b.nombre}
                </button>
              ))}
            </div>
          </section>
        )}

        {barberoSel && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> 3. Día y horario
            </h2>
            <input
              type="date"
              value={fecha}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white"
            />
            {motivoCerrado ? (
              <p className="text-sm text-neutral-400 bg-neutral-900/60 border border-neutral-800 rounded-xl text-center py-4 px-3">
                {motivoCerrado}
              </p>
            ) : horariosLibres.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4">No hay horarios disponibles para este día.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {horariosLibres.map((hora) => (
                  <button
                    key={hora}
                    onClick={() => setHoraSel(hora)}
                    className={`py-2 rounded-lg text-sm font-medium border transition ${
                      horaSel === hora
                        ? 'bg-white text-black border-white'
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    {hora}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {horaSel && (
          <form onSubmit={confirmarTurno} className="space-y-3 pt-2 border-t border-neutral-800">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Clock className="w-4 h-4" /> 4. Tus datos
            </h2>
            {barberia.cobra_sena && (
              <p className="text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                Esta barbería solicita una seña de <strong className="text-white">${barberia.sena_monto.toLocaleString('es-AR')}</strong> por Mercado Pago al confirmar.
              </p>
            )}
            <input
              type="text"
              required
              placeholder="Tu nombre"
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white"
            />
            <input
              type="tel"
              required
              placeholder="Tu WhatsApp (ej: 1123456789)"
              value={telefonoCliente}
              onChange={(e) => setTelefonoCliente(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white"
            />
            {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-white text-black font-semibold py-3.5 rounded-xl hover:bg-neutral-200 transition disabled:opacity-50"
            >
              {guardando ? 'Reservando...' : `Confirmar turno (${horaSel} hs)`}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ReservaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Cargando...</div>}>
      <ReservaContenido />
    </Suspense>
  );
}