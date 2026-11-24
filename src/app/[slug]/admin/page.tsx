'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import {
  Calendar,
  Check,
  X,
  MessageCircle,
  Copy,
  RefreshCw,
  LogOut,
  Trash2,
  Plus,
  Clock,
  CreditCard,
  CalendarOff,
} from 'lucide-react';

interface TurnoAdmin {
  id: string;
  cliente_nombre: string;
  cliente_telefono: string;
  inicio: string;
  fin: string;
  estado: 'pendiente_sena' | 'confirmado' | 'cancelado' | 'completado';
  barberos: { nombre: string } | null;
  servicios: { nombre: string; precio: number; duracion_min: number } | null;
}

interface Barbero { id: string; nombre: string; }
interface Servicio { id: string; nombre: string; duracion_min: number; precio: number; }
interface DiaLibre {
  id: string;
  fecha: string;
  motivo: string | null;
  barbero_id: string | null;
  barberos: { nombre: string } | null;
}

interface Franja {
  hora_inicio: string;
  hora_fin: string;
}

interface DiaHorario {
  dia_semana: number;
  label: string;
  activo: boolean;
  franjas: Franja[];
}

interface BarberiaAdmin {
  id: string;
  nombre: string;
  vence_el?: string | null;
  plan_estado?: string | null;
  logo_url?: string | null;
  direccion?: string | null;
  instagram?: string | null;
}

const DIAS_SEMANA = [
  { dia: 1, label: 'Lunes' },
  { dia: 2, label: 'Martes' },
  { dia: 3, label: 'Miércoles' },
  { dia: 4, label: 'Jueves' },
  { dia: 5, label: 'Viernes' },
  { dia: 6, label: 'Sábado' },
  { dia: 0, label: 'Domingo' },
];

function AdminContenido() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [pestana, setPestana] = useState<'agenda' | 'config'>('agenda');
  const [barberia, setBarberia] = useState<BarberiaAdmin | null>(null);
  const [barberos, setBarberos] = useState<Barbero[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [diasLibres, setDiasLibres] = useState<DiaLibre[]>([]);
  const [turnos, setTurnos] = useState<TurnoAdmin[]>([]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [barberoFiltro, setBarberoFiltro] = useState<string>('todos');
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [cargandoPago, setCargandoPago] = useState(false);
  const [cancelandoSuscripcion, setCancelandoSuscripcion] = useState(false);

  // Estados para Perfil y Logo
  const [direccion, setDireccion] = useState('');
  const [instagram, setInstagram] = useState('');
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [perfilGuardado, setPerfilGuardado] = useState(false);

  // Estados para Turno Manual
  const [mostrarFormManual, setMostrarFormManual] = useState(false);
  const [manualBarberoId, setManualBarberoId] = useState('');
  const [manualServicioId, setManualServicioId] = useState('');
  const [manualHora, setManualHora] = useState('10:00');
  const [manualCliente, setManualCliente] = useState('');
  const [manualTelefono, setManualTelefono] = useState('');
  const [guardandoManual, setGuardandoManual] = useState(false);

  // Estados para formularios de Configuración
  const [nuevoBarbero, setNuevoBarbero] = useState('');
  const [nuevoServNombre, setNuevoServNombre] = useState('');
  const [nuevoServDuracion, setNuevoServDuracion] = useState('30');
  const [nuevoServPrecio, setNuevoServPrecio] = useState('');

  // Estados para Días Libres puntuales
  const [libreFecha, setLibreFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [libreBarberoId, setLibreBarberoId] = useState('todos');
  const [libreMotivo, setLibreMotivo] = useState('');

  // Estados para Señas con Mercado Pago
  const [cobraSena, setCobraSena] = useState(false);
  const [senaMonto, setSenaMonto] = useState('');
  const [mpDato, setMpDato] = useState('');
  const [guardandoSena, setGuardandoSena] = useState(false);
  const [senaGuardada, setSenaGuardada] = useState(false);

  // Estados para editor de horarios por barbero (soporta horario cortado)
  const [barberoEditandoId, setBarberoEditandoId] = useState<string | null>(null);
  const [horariosEdit, setHorariosEdit] = useState<DiaHorario[]>([]);
  const [guardandoHorarios, setGuardandoHorarios] = useState(false);

  async function cargarCatalogo(barberiaId: string) {
    const hoy = new Date().toISOString().split('T')[0];
    const [{ data: bList }, { data: sList }, { data: dlList }] = await Promise.all([
      supabase.from('barberos').select('id, nombre').eq('barberia_id', barberiaId).eq('activo', true),
      supabase.from('servicios').select('id, nombre, duracion_min, precio').eq('barberia_id', barberiaId).eq('activo', true),
      supabase
        .from('dias_libres')
        .select('id, fecha, motivo, barbero_id, barberos(nombre)')
        .eq('barberia_id', barberiaId)
        .gte('fecha', hoy)
        .order('fecha', { ascending: true }),
    ]);

    const bData = bList || [];
    const sData = sList || [];
    setBarberos(bData);
    setServicios(sData);
    setDiasLibres((dlList as unknown as DiaLibre[]) || []);
    if (bData.length > 0 && !manualBarberoId) setManualBarberoId(bData[0].id);
    if (sData.length > 0 && !manualServicioId) setManualServicioId(sData[0].id);
  }

  async function cargarAgenda(barberiaId: string) {
    const inicioDia = new Date(`${fecha}T00:00:00`).toISOString();
    const finDia = new Date(`${fecha}T23:59:59`).toISOString();

    let query = supabase
      .from('turnos')
      .select('id, cliente_nombre, cliente_telefono, inicio, fin, estado, barberos(nombre), servicios(nombre, precio, duracion_min)')
      .eq('barberia_id', barberiaId)
      .gte('inicio', inicioDia)
      .lte('inicio', finDia)
      .order('inicio', { ascending: true });

    if (barberoFiltro !== 'todos') {
      query = query.eq('barbero_id', barberoFiltro);
    }

    const { data } = await query;
    setTurnos((data as unknown as TurnoAdmin[]) || []);
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: barb } = await supabase
        .from('barberias')
        .select('id, nombre, owner_id, cobra_sena, sena_monto, mp_dato, vence_el, plan_estado, logo_url, direccion, instagram')
        .eq('slug', slug)
        .single();

      if (!barb || barb.owner_id !== user.id) {
        router.push('/login');
        return;
      }

      setBarberia({
        id: barb.id,
        nombre: barb.nombre,
        vence_el: barb.vence_el,
        plan_estado: barb.plan_estado,
        logo_url: barb.logo_url,
        direccion: barb.direccion,
        instagram: barb.instagram,
      });
      setDireccion(barb.direccion || '');
      setInstagram(barb.instagram || '');
      setCobraSena(Boolean(barb.cobra_sena));
      setSenaMonto(barb.sena_monto ? String(barb.sena_monto) : '');
      setMpDato(barb.mp_dato || '');

      await cargarCatalogo(barb.id);
      setCargando(false);
    }
    init();
  }, [slug, router]);

  useEffect(() => {
    if (barberia) {
      cargarAgenda(barberia.id);
    }
  }, [barberia, fecha, barberoFiltro]);

  async function iniciarSuscripcion() {
    if (!barberia) return;
    setCargandoPago(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/api/suscripcion/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberiaId: barberia.id,
          slug,
          email: user?.email,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'No se pudo iniciar la suscripción');
      }
    } finally {
      setCargandoPago(false);
    }
  }

  async function cancelarSuscripcion() {
    if (!barberia) return;
    const confirmar = window.confirm(
      '¿Seguro que querés cancelar tu suscripción? No se te volverá a cobrar y vas a seguir teniendo acceso hasta la fecha de vencimiento.'
    );
    if (!confirmar) return;

    setCancelandoSuscripcion(true);
    try {
      const res = await fetch('/api/suscripcion/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barberiaId: barberia.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setBarberia((prev) => (prev ? { ...prev, plan_estado: 'cancelada' } : prev));
        alert('Suscripción cancelada. No se te volverá a cobrar.');
      } else {
        alert(data.error || 'No se pudo cancelar la suscripción');
      }
    } finally {
      setCancelandoSuscripcion(false);
    }
  }

  async function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !barberia) return;

    setSubiendoLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${barberia.id}/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        alert('Error al subir el logo: ' + uploadError.message);
        return;
      }

      const { data } = supabase.storage.from('logos').getPublicUrl(filePath);
      const logoUrl = data.publicUrl;

      await supabase
        .from('barberias')
        .update({ logo_url: logoUrl })
        .eq('id', barberia.id);

      setBarberia((prev) => (prev ? { ...prev, logo_url: logoUrl } : prev));
    } finally {
      setSubiendoLogo(false);
    }
  }

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault();
    if (!barberia) return;
    setGuardandoPerfil(true);
    await supabase
      .from('barberias')
      .update({ direccion, instagram })
      .eq('id', barberia.id);
    setBarberia((prev) => (prev ? { ...prev, direccion, instagram } : prev));
    setGuardandoPerfil(false);
    setPerfilGuardado(true);
    setTimeout(() => setPerfilGuardado(false), 2500);
  }

  async function crearTurnoManual(e: React.FormEvent) {
    e.preventDefault();
    if (!barberia || !manualBarberoId || !manualServicioId || !manualCliente.trim()) return;

    const servicio = servicios.find((s) => s.id === manualServicioId);
    if (!servicio) return;

    setGuardandoManual(true);
    const inicioDate = new Date(`${fecha}T${manualHora}:00`);
    const finDate = new Date(inicioDate.getTime() + servicio.duracion_min * 60000);

    await supabase.from('turnos').insert({
      barberia_id: barberia.id,
      barbero_id: manualBarberoId,
      servicio_id: manualServicioId,
      cliente_nombre: manualCliente.trim(),
      cliente_telefono: manualTelefono.trim() || '-',
      inicio: inicioDate.toISOString(),
      fin: finDate.toISOString(),
      estado: 'confirmado',
    });

    setGuardandoManual(false);
    setManualCliente('');
    setManualTelefono('');
    setMostrarFormManual(false);
    cargarAgenda(barberia.id);
  }

  async function cambiarEstado(id: string, nuevoEstado: 'confirmado' | 'completado' | 'cancelado') {
    await supabase.from('turnos').update({ estado: nuevoEstado }).eq('id', id);
    if (barberia) cargarAgenda(barberia.id);
  }

  async function agregarBarbero(e: React.FormEvent) {
    e.preventDefault();
    if (!barberia || !nuevoBarbero.trim()) return;

    const { data: creado } = await supabase
      .from('barberos')
      .insert({ barberia_id: barberia.id, nombre: nuevoBarbero.trim() })
      .select('id')
      .single();

    if (creado) {
      const horariosBase = [1, 2, 3, 4, 5, 6].map((dia) => ({
        barbero_id: creado.id,
        dia_semana: dia,
        hora_inicio: '09:00:00',
        hora_fin: '20:00:00',
      }));
      await supabase.from('horarios_barbero').insert(horariosBase);
      setNuevoBarbero('');
      cargarCatalogo(barberia.id);
    }
  }

  async function eliminarBarbero(id: string) {
    await supabase.from('barberos').update({ activo: false }).eq('id', id);
    if (barberoEditandoId === id) setBarberoEditandoId(null);
    if (barberia) cargarCatalogo(barberia.id);
  }

  async function abrirEditorHorarios(barberoId: string) {
    if (barberoEditandoId === barberoId) {
      setBarberoEditandoId(null);
      return;
    }

    const { data } = await supabase
      .from('horarios_barbero')
      .select('dia_semana, hora_inicio, hora_fin')
      .eq('barbero_id', barberoId)
      .order('hora_inicio', { ascending: true });

    const plantilla: DiaHorario[] = DIAS_SEMANA.map(({ dia, label }) => {
      const existentes = (data || []).filter((h) => h.dia_semana === dia);
      return {
        dia_semana: dia,
        label,
        activo: existentes.length > 0,
        franjas:
          existentes.length > 0
            ? existentes.map((h) => ({
                hora_inicio: h.hora_inicio.slice(0, 5),
                hora_fin: h.hora_fin.slice(0, 5),
              }))
            : [{ hora_inicio: '09:00', hora_fin: '20:00' }],
      };
    });

    setHorariosEdit(plantilla);
    setBarberoEditandoId(barberoId);
  }

  function toggleDia(diaSemana: number, activo: boolean) {
    setHorariosEdit((prev) =>
      prev.map((d) => (d.dia_semana === diaSemana ? { ...d, activo } : d))
    );
  }

  function actualizarFranja(diaSemana: number, idx: number, campo: 'hora_inicio' | 'hora_fin', valor: string) {
    setHorariosEdit((prev) =>
      prev.map((d) => {
        if (d.dia_semana !== diaSemana) return d;
        const nuevas = d.franjas.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f));
        return { ...d, franjas: nuevas };
      })
    );
  }

  function agregarFranja(diaSemana: number) {
    setHorariosEdit((prev) =>
      prev.map((d) =>
        d.dia_semana === diaSemana
          ? { ...d, franjas: [...d.franjas, { hora_inicio: '16:00', hora_fin: '20:00' }] }
          : d
      )
    );
  }

  function quitarFranja(diaSemana: number, idx: number) {
    setHorariosEdit((prev) =>
      prev.map((d) => {
        if (d.dia_semana !== diaSemana) return d;
        return { ...d, franjas: d.franjas.filter((_, i) => i !== idx) };
      })
    );
  }

  async function guardarHorariosBarbero(barberoId: string) {
    setGuardandoHorarios(true);
    await supabase.from('horarios_barbero').delete().eq('barbero_id', barberoId);

    const nuevos = horariosEdit
      .filter((d) => d.activo)
      .flatMap((d) =>
        d.franjas.map((f) => ({
          barbero_id: barberoId,
          dia_semana: d.dia_semana,
          hora_inicio: `${f.hora_inicio}:00`,
          hora_fin: `${f.hora_fin}:00`,
        }))
      );

    if (nuevos.length > 0) {
      await supabase.from('horarios_barbero').insert(nuevos);
    }

    setGuardandoHorarios(false);
    setBarberoEditandoId(null);
  }

  async function agregarServicio(e: React.FormEvent) {
    e.preventDefault();
    if (!barberia || !nuevoServNombre.trim() || !nuevoServPrecio) return;

    await supabase.from('servicios').insert({
      barberia_id: barberia.id,
      nombre: nuevoServNombre.trim(),
      duracion_min: Number(nuevoServDuracion),
      precio: Number(nuevoServPrecio),
    });

    setNuevoServNombre('');
    setNuevoServPrecio('');
    cargarCatalogo(barberia.id);
  }

  async function eliminarServicio(id: string) {
    await supabase.from('servicios').update({ activo: false }).eq('id', id);
    if (barberia) cargarCatalogo(barberia.id);
  }

  async function agregarDiaLibre(e: React.FormEvent) {
    e.preventDefault();
    if (!barberia || !libreFecha) return;

    await supabase.from('dias_libres').insert({
      barberia_id: barberia.id,
      barbero_id: libreBarberoId === 'todos' ? null : libreBarberoId,
      fecha: libreFecha,
      motivo: libreMotivo.trim() || 'Cerrado',
    });

    setLibreMotivo('');
    cargarCatalogo(barberia.id);
  }

  async function eliminarDiaLibre(id: string) {
    await supabase.from('dias_libres').delete().eq('id', id);
    if (barberia) cargarCatalogo(barberia.id);
  }

  async function guardarConfigSena(e: React.FormEvent) {
    e.preventDefault();
    if (!barberia) return;

    setGuardandoSena(true);
    await supabase
      .from('barberias')
      .update({
        cobra_sena: cobraSena,
        sena_monto: cobraSena ? Number(senaMonto) || 0 : 0,
        mp_dato: cobraSena ? mpDato.trim() : '',
      })
      .eq('id', barberia.id);

    setGuardandoSena(false);
    setSenaGuardada(true);
    setTimeout(() => setSenaGuardada(false), 2000);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function copiarLink() {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function formatearHora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  if (cargando) {
    return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Cargando panel...</div>;
  }

  const estaVencida = barberia?.vence_el
    ? new Date(barberia.vence_el) < new Date()
    : false;

  const diasRestantes = barberia?.vence_el
    ? Math.max(0, Math.ceil((new Date(barberia.vence_el).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  if (barberia && estaVencida) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-5">
          <h1 className="text-2xl font-bold">Tu prueba gratuita finalizó</h1>
          <p className="text-neutral-400 text-sm">
            Para seguir recibiendo turnos online y mantener activo tu link{' '}
            <span className="text-white font-medium">/{slug}</span>, activá tu suscripción mensual automática.
          </p>
          <button
            onClick={iniciarSuscripcion}
            disabled={cargandoPago}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-neutral-200 transition disabled:opacity-50"
          >
            {cargandoPago ? 'Redirigiendo a Mercado Pago...' : 'Activar suscripción mensual'}
          </button>
          <button
            onClick={cerrarSesion}
            className="text-xs text-neutral-500 hover:text-white transition"
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    );
  }

  const totalDia = turnos
    .filter((t) => t.estado === 'confirmado' || t.estado === 'completado')
    .reduce((acc, t) => acc + (t.servicios?.precio || 0), 0);

  return (
    <main className="min-h-screen bg-neutral-950 text-white py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">{barberia?.nombre}</h1>
            <p className="text-neutral-400 text-sm">Panel de administración</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copiarLink}
              className="flex items-center gap-2 bg-white text-black text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-neutral-200 transition"
            >
              <Copy className="w-4 h-4" />
              {copiado ? '¡Copiado!' : 'Link público'}
            </button>
            <button
              onClick={cerrarSesion}
              className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Banner de días restantes de prueba */}
        {barberia?.plan_estado === 'prueba' && !estaVencida && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-neutral-300">
              Te quedan <strong className="text-white">{diasRestantes} días</strong> de prueba gratuita.
            </p>
            <button
              onClick={iniciarSuscripcion}
              disabled={cargandoPago}
              className="bg-white text-black text-xs font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition disabled:opacity-50"
            >
              {cargandoPago ? 'Cargando...' : 'Suscribirme ahora'}
            </button>
          </div>
        )}

        {/* Pestañas */}
        <div className="grid grid-cols-2 gap-2 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
          <button
            onClick={() => setPestana('agenda')}
            className={`py-2 rounded-lg text-sm font-semibold transition ${
              pestana === 'agenda' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Agenda
          </button>
          <button
            onClick={() => setPestana('config')}
            className={`py-2 rounded-lg text-sm font-semibold transition ${
              pestana === 'config' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Configuración
          </button>
        </div>

        {/* PESTAÑA 1: AGENDA */}
        {pestana === 'agenda' && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Calendar className="w-4 h-4 text-neutral-400 absolute left-3 top-3.5" />
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white"
                />
              </div>

              <select
                value={barberoFiltro}
                onChange={(e) => setBarberoFiltro(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
              >
                <option value="todos">Todos los barberos</option>
                {barberos.map((b) => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-neutral-400">Estimado día</span>
                <span className="font-bold text-white">${totalDia.toLocaleString('es-AR')}</span>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
                  Turnos ({turnos.length})
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMostrarFormManual(!mostrarFormManual)}
                    className="flex items-center gap-1 bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-neutral-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Turno manual
                  </button>
                  <button
                    onClick={() => barberia && cargarAgenda(barberia.id)}
                    className="text-neutral-400 hover:text-white transition p-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Formulario desplegable de Turno Manual */}
              {mostrarFormManual && (
                <form
                  onSubmit={crearTurnoManual}
                  className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4 space-y-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Nuevo turno para el {fecha}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      required
                      value={manualBarberoId}
                      onChange={(e) => setManualBarberoId(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      {barberos.map((b) => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                      ))}
                    </select>
                    <select
                      required
                      value={manualServicioId}
                      onChange={(e) => setManualServicioId(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      {servicios.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} ({s.duracion_min}m)
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      required
                      value={manualHora}
                      onChange={(e) => setManualHora(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nombre del cliente (o 'Bloqueado')"
                      value={manualCliente}
                      onChange={(e) => setManualCliente(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp (opcional)"
                      value={manualTelefono}
                      onChange={(e) => setManualTelefono(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMostrarFormManual(false)}
                      className="text-xs text-neutral-400 hover:text-white px-3 py-2"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoManual}
                      className="bg-white text-black text-xs font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition disabled:opacity-50"
                    >
                      {guardandoManual ? 'Guardando...' : 'Agendar turno'}
                    </button>
                  </div>
                </form>
              )}

              {turnos.length === 0 ? (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8 text-center text-neutral-500 text-sm">
                  No hay turnos agendados para este día.
                </div>
              ) : (
                turnos.map((t) => (
                  <div
                    key={t.id}
                    className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      t.estado === 'cancelado' ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-white text-black text-xs font-bold px-2.5 py-0.5 rounded-md">
                          {formatearHora(t.inicio)} - {formatearHora(t.fin)}
                        </span>
                        <span
                          className={`text-xs uppercase font-semibold ${
                            t.estado === 'pendiente_sena' ? 'text-amber-400' : 'text-neutral-400'
                          }`}
                        >
                          {t.estado === 'pendiente_sena' ? 'Pendiente de seña' : t.estado}
                        </span>
                      </div>
                      <p className="font-semibold text-base">{t.cliente_nombre}</p>
                      <p className="text-xs text-neutral-400">
                        {t.servicios?.nombre} ({t.servicios?.duracion_min} min) · Barbero:{' '}
                        <strong className="text-neutral-200">{t.barberos?.nombre}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.cliente_telefono && t.cliente_telefono !== '-' && (
                        <a
                          href={`https://wa.me/${t.cliente_telefono.replace(/\D/g, '')}`}
                          target="_blank"
                          className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                      {t.estado === 'pendiente_sena' && (
                        <>
                          <button
                            onClick={() => cambiarEstado(t.id, 'confirmado')}
                            className="px-3 py-2 rounded-xl bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 transition"
                          >
                            Confirmar seña
                          </button>
                          <button
                            onClick={() => cambiarEstado(t.id, 'cancelado')}
                            className="p-2.5 rounded-xl bg-neutral-800 hover:bg-red-900/60 text-neutral-300 hover:text-red-300 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {t.estado === 'confirmado' && (
                        <>
                          <button
                            onClick={() => cambiarEstado(t.id, 'completado')}
                            className="p-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 transition"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => cambiarEstado(t.id, 'cancelado')}
                            className="p-2.5 rounded-xl bg-neutral-800 hover:bg-red-900/60 text-neutral-300 hover:text-red-300 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}

        {/* PESTAÑA 2: CONFIGURACIÓN */}
        {pestana === 'config' && (
          <div className="space-y-8">
            {/* Barberos */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Barberos y Horarios
              </h2>
              <form onSubmit={agregarBarbero} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Nombre del barbero"
                  value={nuevoBarbero}
                  onChange={(e) => setNuevoBarbero(e.target.value)}
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 bg-white text-black font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-neutral-200 transition"
                >
                  <Plus className="w-4 h-4" /> Sumar
                </button>
              </form>

              <div className="space-y-2">
                {barberos.map((b) => (
                  <div key={b.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="font-medium text-sm">{b.nombre}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => abrirEditorHorarios(b.id)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                            barberoEditandoId === b.id
                              ? 'bg-white text-black border-white'
                              : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-600'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Horarios
                        </button>
                        <button onClick={() => eliminarBarbero(b.id)} className="text-neutral-500 hover:text-red-400 transition p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {barberoEditandoId === b.id && (
                      <div className="border-t border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
                        <div className="space-y-3">
                          {horariosEdit.map((d) => (
                            <div key={d.dia_semana} className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-sm border-b border-neutral-900 pb-2 last:border-0">
                              <label className="flex items-center gap-2.5 w-28 pt-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={d.activo}
                                  onChange={(e) => toggleDia(d.dia_semana, e.target.checked)}
                                  className="accent-white w-4 h-4"
                                />
                                <span className={d.activo ? 'text-white font-medium' : 'text-neutral-500'}>
                                  {d.label}
                                </span>
                              </label>

                              {d.activo ? (
                                <div className="space-y-2 flex-1 flex flex-col sm:items-end">
                                  {d.franjas.map((f, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <input
                                        type="time"
                                        value={f.hora_inicio}
                                        onChange={(e) => actualizarFranja(d.dia_semana, idx, 'hora_inicio', e.target.value)}
                                        className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white"
                                      />
                                      <span className="text-neutral-500 text-xs">a</span>
                                      <input
                                        type="time"
                                        value={f.hora_fin}
                                        onChange={(e) => actualizarFranja(d.dia_semana, idx, 'hora_fin', e.target.value)}
                                        className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white"
                                      />
                                      {idx === 0 ? (
                                        <button
                                          type="button"
                                          onClick={() => agregarFranja(d.dia_semana)}
                                          className="text-xs text-neutral-400 hover:text-white border border-neutral-800 rounded-lg px-2 py-1"
                                          title="Agregar turno cortado"
                                        >
                                          + Franja
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => quitarFranja(d.dia_semana, idx)}
                                          className="text-neutral-500 hover:text-red-400 p-1"
                                          title="Quitar franja"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-neutral-600 pt-1">No trabaja</span>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                          <button
                            onClick={() => setBarberoEditandoId(null)}
                            className="text-xs text-neutral-400 hover:text-white px-3 py-2"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => guardarHorariosBarbero(b.id)}
                            disabled={guardandoHorarios}
                            className="bg-white text-black text-xs font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition disabled:opacity-50"
                          >
                            {guardandoHorarios ? 'Guardando...' : 'Guardar horarios'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Servicios */}
            <section className="space-y-3 border-t border-neutral-800 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Servicios y Precios</h2>
              <form onSubmit={agregarServicio} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ej: Corte Fade"
                  value={nuevoServNombre}
                  onChange={(e) => setNuevoServNombre(e.target.value)}
                  className="sm:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                />
                <select
                  value={nuevoServDuracion}
                  onChange={(e) => setNuevoServDuracion(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  <option value="15">15 min</option>
                  <option value="20">20 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                </select>
                <input
                  type="number"
                  required
                  placeholder="Precio ($)"
                  value={nuevoServPrecio}
                  onChange={(e) => setNuevoServPrecio(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                />
                <button
                  type="submit"
                  className="sm:col-span-4 bg-white text-black font-semibold py-2.5 rounded-xl text-sm hover:bg-neutral-200 transition"
                >
                  Agregar servicio
                </button>
              </form>
              <div className="space-y-2">
                {servicios.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{s.nombre}</p>
                      <p className="text-xs text-neutral-400">{s.duracion_min} min · ${s.precio.toLocaleString('es-AR')}</p>
                    </div>
                    <button onClick={() => eliminarServicio(s.id)} className="text-neutral-500 hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Días libres puntuales / Feriados */}
            <section className="space-y-3 border-t border-neutral-800 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <CalendarOff className="w-4 h-4" /> Días libres / Feriados
              </h2>
              <form onSubmit={agregarDiaLibre} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="date"
                  required
                  value={libreFecha}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setLibreFecha(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                />
                <select
                  value={libreBarberoId}
                  onChange={(e) => setLibreBarberoId(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  <option value="todos">Toda la barbería</option>
                  {barberos.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Motivo (ej: Feriado)"
                  value={libreMotivo}
                  onChange={(e) => setLibreMotivo(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                />
                <button
                  type="submit"
                  className="sm:col-span-3 bg-white text-black font-semibold py-2.5 rounded-xl text-sm hover:bg-neutral-200 transition"
                >
                  Bloquear fecha
                </button>
              </form>

              {diasLibres.length > 0 && (
                <div className="space-y-2">
                  {diasLibres.map((d) => (
                    <div key={d.id} className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">
                          {d.fecha} · {d.barberos ? d.barberos.nombre : 'Toda la barbería'}
                        </p>
                        <p className="text-xs text-neutral-400">{d.motivo || 'Cerrado'}</p>
                      </div>
                      <button onClick={() => eliminarDiaLibre(d.id)} className="text-neutral-500 hover:text-red-400 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Señas con Mercado Pago (Opcional) */}
            <section className="space-y-3 border-t border-neutral-800 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Señas con Mercado Pago (Opcional)
              </h2>

              <form onSubmit={guardarConfigSena} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-white">Pedir seña para reservar</p>
                    <p className="text-xs text-neutral-400">
                      Si está desactivado, los turnos se confirman automáticamente sin pago previo.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={cobraSena}
                    onChange={(e) => setCobraSena(e.target.checked)}
                    className="accent-white w-5 h-5"
                  />
                </label>

                {cobraSena && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
                    <input
                      type="number"
                      required
                      placeholder="Monto de la seña ($)"
                      value={senaMonto}
                      onChange={(e) => setSenaMonto(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Alias de MP o Link de pago"
                      value={mpDato}
                      onChange={(e) => setMpDato(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={guardandoSena}
                  className="w-full bg-white text-black font-semibold py-2.5 rounded-xl text-sm hover:bg-neutral-200 transition disabled:opacity-50"
                >
                  {guardandoSena ? 'Guardando...' : senaGuardada ? '¡Configuración guardada!' : 'Guardar configuración de señas'}
                </button>
              </form>
            </section>

            {/* Perfil y Logo */}
            <section className="space-y-3 border-t border-neutral-800 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Perfil y Logo
              </h2>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-4">
                  {barberia?.logo_url ? (
                    <img
                      src={barberia.logo_url}
                      alt="Logo"
                      className="w-16 h-16 rounded-full object-cover border border-neutral-700"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center text-xs text-neutral-500">
                      Sin logo
                    </div>
                  )}

                  <label className="cursor-pointer bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition">
                    {subiendoLogo ? 'Subiendo...' : 'Subir logo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={subirLogo}
                      disabled={subiendoLogo}
                      className="hidden"
                    />
                  </label>
                </div>

                <form onSubmit={guardarPerfil} className="space-y-3">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Dirección</label>
                    <input
                      type="text"
                      placeholder="Ej: Av. San Martín 450"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Instagram</label>
                    <input
                      type="text"
                      placeholder="Ej: @tubarberia"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={guardandoPerfil}
                    className="w-full bg-white text-black font-semibold py-2.5 rounded-xl text-sm hover:bg-neutral-200 transition disabled:opacity-50"
                  >
                    {guardandoPerfil ? 'Guardando...' : perfilGuardado ? '¡Perfil guardado!' : 'Guardar perfil'}
                  </button>
                </form>
              </div>
            </section>

            {/* Mi Suscripción */}
            <section className="space-y-3 border-t border-neutral-800 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Mi Suscripción
              </h2>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">
                    {barberia?.plan_estado === 'activa'
                      ? 'Plan Mensual Activo'
                      : barberia?.plan_estado === 'cancelada'
                      ? 'Suscripción cancelada'
                      : 'Prueba gratuita'}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {barberia?.vence_el
                      ? `Acceso habilitado hasta el ${new Date(barberia.vence_el).toLocaleDateString('es-AR')}.`
                      : 'Sin fecha de vencimiento.'}
                  </p>
                </div>

                {barberia?.plan_estado === 'activa' ? (
                  <button
                    type="button"
                    onClick={cancelarSuscripcion}
                    disabled={cancelandoSuscripcion}
                    className="bg-red-950/60 border border-red-900 text-red-300 text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-red-900/60 transition disabled:opacity-50"
                  >
                    {cancelandoSuscripcion ? 'Cancelando...' : 'Cancelar suscripción'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={iniciarSuscripcion}
                    disabled={cargandoPago}
                    className="bg-white text-black text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-neutral-200 transition disabled:opacity-50"
                  >
                    {cargandoPago ? 'Cargando...' : 'Activar suscripción'}
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Cargando...</div>}>
      <AdminContenido />
    </Suspense>
  );
}