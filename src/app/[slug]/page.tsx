'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { calcularHorariosLibres } from '@/app/lib/disponibilidad';
import {
  Calendar,
  Clock,
  Scissors,
  User,
  CheckCircle2,
  Copy,
  CreditCard,
  MapPin,
  AtSign,
  Check,
} from 'lucide-react';

interface Barberia {
  id: string;
  nombre: string;
  whatsapp: string;
  cobra_sena: boolean;
  sena_monto: number;
  mp_dato: string;
  vence_el?: string | null;
  logo_url?: string | null;
  direccion?: string | null;
  instagram?: string | null;
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
        .select('id, nombre, whatsapp, cobra_sena, sena_monto, mp_dato, vence_el, logo_url, direccion, instagram')
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

  if (cargando) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!barberia) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6 text-center">
        <p className="text-neutral-400">Barbería no encontrada.</p>
      </div>
    );
  }

  const estaVencida = barberia.vence_el
    ? new Date(barberia.vence_el) < new Date()
    : false;

  if (estaVencida) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center space-y-3">
          {barberia.logo_url && (
            <img
              src={barberia.logo_url}
              alt={barberia.nombre}
              className="w-16 h-16 rounded-full object-cover mx-auto border border-neutral-700"
            />
          )}
          <h1 className="text-xl font-bold">{barberia.nombre}</h1>
          <p className="text-neutral-400 text-sm">
            La agenda online de esta barbería se encuentra temporalmente pausada.
          </p>
        </div>
      </main>
    );
  }

  const iniciales = barberia.nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const igLimpio = barberia.instagram?.replace('@', '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');

  const pasoActual = horaSel ? 4 : barberoSel ? 3 : servicioSel ? 2 : 1;

  if (confirmado) {
    const esLinkMp = barberia.mp_dato?.startsWith('http');
    const textoWa = encodeURIComponent(
      barberia.cobra_sena
        ? `Hola! Reservé un turno en ${barberia.nombre} y te envío el comprobante de la seña ($${barberia.sena_monto.toLocaleString('es-AR')}):\n- Servicio: ${servicioSel?.nombre}\n- Barbero: ${barberoSel?.nombre}\n- Fecha: ${fecha} a las ${horaSel} hs\n- Nombre: ${nombreCliente}`
        : `Hola! Reservé un turno en ${barberia.nombre}:\n- Servicio: ${servicioSel?.nombre}\n- Barbero: ${barberoSel?.nombre}\n- Fecha: ${fecha} a las ${horaSel} hs\n- Nombre: ${nombreCliente}`
    );

    return (
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {barberia.cobra_sena ? '¡Turno pre-reservado!' : '¡Turno confirmado!'}
            </h1>
            <p className="text-neutral-400 text-sm">{barberia.nombre}</p>
          </div>

          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-left space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Servicio</span>
              <span className="font-medium text-white">{servicioSel?.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Barbero</span>
              <span className="font-medium text-white">{barberoSel?.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Fecha y hora</span>
              <span className="font-medium text-white">{fecha} · {horaSel} hs</span>
            </div>
          </div>

          {barberia.cobra_sena && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-left space-y-3">
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
                  className="block w-full text-center bg-sky-500 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-sky-400 transition"
                >
                  Pagar seña con Mercado Pago
                </a>
              ) : (
                <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2">
                  <span className="text-xs text-neutral-200 font-mono truncate">{barberia.mp_dato}</span>
                  <button
                    onClick={copiarDatoMp}
                    className="flex items-center gap-1 text-xs font-semibold text-white bg-neutral-800 px-2.5 py-1 rounded-lg hover:bg-neutral-700"
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
            className="block w-full bg-white text-black font-semibold py-3.5 rounded-2xl hover:bg-neutral-200 transition"
          >
            {barberia.cobra_sena ? 'Enviar comprobante por WhatsApp' : 'Confirmar por WhatsApp'}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white pb-12">
      {/* Cabecera estilo perfil de barbería */}
      <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border-b border-neutral-800/80 pt-8 pb-6 px-4">
        <div className="max-w-md mx-auto flex flex-col items-center text-center space-y-3">
          {barberia.logo_url ? (
            <img
              src={barberia.logo_url}
              alt={barberia.nombre}
              className="w-20 h-20 rounded-full object-cover border-2 border-neutral-700 shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-neutral-900 border-2 border-neutral-700 flex items-center justify-center text-xl font-bold tracking-wider text-white shadow-lg">
              {iniciales}
            </div>
          )}

          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{barberia.nombre}</h1>
            <p className="text-neutral-400 text-xs">Reservá tu turno online en segundos</p>
          </div>

          {(barberia.direccion || igLimpio) && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {barberia.direccion && (
                <span className="inline-flex items-center gap-1.5 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  {barberia.direccion}
                </span>
              )}
              {igLimpio && (
                <a
                  href={`https://instagram.com/${igLimpio}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full hover:border-neutral-600 hover:text-white transition"
                >
                  <AtSign className="w-3.5 h-3.5 text-neutral-400" />
                  @{igLimpio}
                </a>
              )}
            </div>
          )}

          {/* Barra de progreso */}
          <div className="w-full flex items-center gap-1.5 pt-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  n <= pasoActual ? 'bg-white' : 'bg-neutral-800'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Contenido de pasos */}
      <div className="max-w-md mx-auto px-4 pt-6 space-y-7">
        {/* Paso 1: Servicio */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5" /> 1. Elegí el servicio
          </h2>
          <div className="space-y-2.5">
            {servicios.map((s) => {
              const activo = servicioSel?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setServicioSel(s)}
                  className={`w-full flex justify-between items-center p-4 rounded-2xl border text-left transition-all ${
                    activo
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm">{s.nombre}</p>
                    <p className={`text-xs ${activo ? 'text-neutral-600' : 'text-neutral-400'}`}>
                      {s.duracion_min} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm">${s.precio.toLocaleString('es-AR')}</span>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        activo ? 'bg-black text-white border-black' : 'border-neutral-700'
                      }`}
                    >
                      {activo && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Paso 2: Barbero */}
        {servicioSel && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> 2. Elegí tu barbero
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              {barberos.map((b) => {
                const activo = barberoSel?.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setBarberoSel(b)}
                    className={`p-3.5 rounded-2xl border font-semibold text-sm transition-all ${
                      activo
                        ? 'bg-white text-black border-white shadow-lg'
                        : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    {b.nombre}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Paso 3: Fecha y hora */}
        {barberoSel && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> 3. Día y horario
            </h2>
            <input
              type="date"
              value={fecha}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 text-white"
            />
            {motivoCerrado ? (
              <p className="text-sm text-neutral-400 bg-neutral-900/60 border border-neutral-800 rounded-2xl text-center py-5 px-4">
                {motivoCerrado}
              </p>
            ) : horariosLibres.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-5">
                No hay horarios disponibles para este día.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {horariosLibres.map((hora) => (
                  <button
                    key={hora}
                    onClick={() => setHoraSel(hora)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      horaSel === hora
                        ? 'bg-white text-black border-white shadow-md'
                        : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    {hora}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Paso 4: Datos del cliente */}
        {horaSel && (
          <form onSubmit={confirmarTurno} className="space-y-3 pt-4 border-t border-neutral-800">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> 4. Tus datos
            </h2>
            {barberia.cobra_sena && (
              <p className="text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5">
                Esta barbería solicita una seña de{' '}
                <strong className="text-white">${barberia.sena_monto.toLocaleString('es-AR')}</strong> por Mercado Pago al confirmar.
              </p>
            )}
            <input
              type="text"
              required
              placeholder="Tu nombre"
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 text-white"
            />
            <input
              type="tel"
              required
              placeholder="Tu WhatsApp (ej: 1123456789)"
              value={telefonoCliente}
              onChange={(e) => setTelefonoCliente(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 text-white"
            />
            {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-neutral-200 transition disabled:opacity-50 shadow-lg"
            >
              {guardando ? 'Reservando...' : `Confirmar turno · ${horaSel} hs`}
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