'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function actualizarPassword(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError('');

    const { error } = await supabase.auth.updateUser({ password });

    setCargando(false);
    if (error) {
      setError('No se pudo actualizar la contraseña. Pedí un link nuevo.');
    } else {
      setMensaje('¡Contraseña actualizada! Redirigiendo al login...');
      setTimeout(() => router.push('/login'), 2000);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">Nueva contraseña</h1>
          <p className="text-neutral-400 text-xs">Escribí tu nueva clave de acceso</p>
        </div>

        <form onSubmit={actualizarPassword} className="space-y-3">
          <input
            type="password"
            required
            minLength={6}
            placeholder="Nueva contraseña (mínimo 6 caracteres)"
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
            {cargando ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </main>
  );
}