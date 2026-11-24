'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [modoRegistro, setModoRegistro] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreBarberia, setNombreBarberia] = useState('');
  const [slug, setSlug] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  function formatearSlug(texto: string) {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError('');
    setMensaje('');

    if (modoRegistro) {
      const slugLimpio = formatearSlug(slug || nombreBarberia);
      if (!slugLimpio) {
        setError('Elegí un link válido para tu barbería.');
        setCargando(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError || !authData.user) {
        setError(authError?.message || 'No se pudo crear la cuenta.');
        setCargando(false);
        return;
      }

      const { error: barbError } = await supabase.from('barberias').insert({
        owner_id: authData.user.id,
        nombre: nombreBarberia.trim(),
        slug: slugLimpio,
        whatsapp: whatsapp.replace(/\D/g, ''),
      });

      if (barbError) {
        setError('Ese link ya está en uso. Probá con otro nombre de link.');
        setCargando(false);
        return;
      }

      router.push(`/${slugLimpio}/admin`);
    } else {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        setError('Email o contraseña incorrectos.');
        setCargando(false);
        return;
      }

      const { data: barb } = await supabase
        .from('barberias')
        .select('slug')
        .eq('owner_id', authData.user.id)
        .single();

      if (!barb) {
        setError('No encontramos una barbería asociada a esta cuenta.');
        setCargando(false);
        return;
      }

      router.push(`/${barb.slug}/admin`);
    }
  }

  async function recuperarPassword() {
    if (!email.trim()) {
      setError('Escribí tu email arriba primero para enviarte el link.');
      return;
    }

    setCargando(true);
    setError('');
    setMensaje('');

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setCargando(false);
    if (error) {
      setError('No se pudo enviar el correo. Intentá en unos minutos.');
    } else {
      setMensaje('Te enviamos un mail con el link para cambiar tu contraseña.');
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">
            {modoRegistro ? 'Creá tu barbería' : 'Panel de Barberías'}
          </h1>
          <p className="text-neutral-400 text-xs">
            {modoRegistro
              ? 'Completá los datos para tener tu link de turnos'
              : 'Ingresá con tu cuenta para ver tu agenda'}
          </p>
        </div>

        <form onSubmit={manejarSubmit} className="space-y-3">
          {modoRegistro && (
            <>
              <input
                type="text"
                required
                placeholder="Nombre de tu barbería"
                value={nombreBarberia}
                onChange={(e) => {
                  setNombreBarberia(e.target.value);
                  setSlug(formatearSlug(e.target.value));
                }}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white"
              />
              <input
                type="text"
                required
                placeholder="Link (ej: tkbarbershop)"
                value={slug}
                onChange={(e) => setSlug(formatearSlug(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white"
              />
              <input
                type="tel"
                required
                placeholder="WhatsApp (ej: 5491123456789)"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white"
              />
            </>
          )}

          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white"
          />

          <input
            type="password"
            required
            minLength={6}
            placeholder="Contraseña (mínimo 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white"
          />

          {error && <p className="text-red-400 text-xs">{error}</p>}
          {mensaje && <p className="text-green-400 text-xs">{mensaje}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-neutral-200 transition disabled:opacity-50"
          >
            {cargando
              ? 'Procesando...'
              : modoRegistro
              ? 'Crear mi barbería'
              : 'Ingresar'}
          </button>

          {!modoRegistro && (
            <button
              type="button"
              onClick={recuperarPassword}
              disabled={cargando}
              className="w-full text-xs text-neutral-400 hover:text-white transition pt-1"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </form>

        <div className="border-t border-neutral-800 pt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setModoRegistro(!modoRegistro);
              setError('');
              setMensaje('');
            }}
            className="text-xs text-neutral-400 hover:text-white transition"
          >
            {modoRegistro
              ? '¿Ya tenés cuenta? Ingresá acá'
              : '¿Sos dueño de una barbería? Creá tu cuenta'}
          </button>
        </div>
      </div>
    </main>
  );
}