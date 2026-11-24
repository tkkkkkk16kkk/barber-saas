import Link from 'next/link';
import { Calendar, Clock, Scissors, Smartphone, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-neutral-900">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Scissors className="w-5 h-5" />
            <span>BarberTurnos</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-neutral-400 hover:text-white transition px-3 py-2"
            >
              Ingresar
            </Link>
            <Link
              href="/login"
              className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-neutral-200 transition"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-neutral-400 border border-neutral-800 bg-neutral-900 px-3 py-1 rounded-full">
            Sistema de turnos para barberías
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
            Tu barbería con turnos online, sin mensajes eternos.
          </h1>
          <p className="text-neutral-400 text-base sm:text-lg max-w-xl mx-auto">
            Compartí tu link en Instagram o WhatsApp. Tus clientes eligen servicio, barbero y horario libre en 15 segundos, y vos manejás todo desde el celular.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/login"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-black font-semibold px-6 py-3.5 rounded-xl hover:bg-neutral-200 transition"
            >
              Registrar mi barbería
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/demo-barber"
              className="w-full sm:w-auto bg-neutral-900 border border-neutral-800 text-white font-medium px-6 py-3.5 rounded-xl hover:border-neutral-600 transition"
            >
              Ver demo en vivo
            </Link>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="border-t border-neutral-900 py-16 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-2">
            <Smartphone className="w-6 h-6 text-white" />
            <h2 className="font-semibold text-base">Link propio</h2>
            <p className="text-sm text-neutral-400">
              Cada barbería tiene su dirección única para pegar en la bio de Instagram y recibir reservas las 24 hs.
            </p>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-2">
            <Clock className="w-6 h-6 text-white" />
            <h2 className="font-semibold text-base">Sin superposiciones</h2>
            <p className="text-sm text-neutral-400">
              Calcula automáticamente la disponibilidad según la duración de cada servicio y los horarios cortados de cada barbero.
            </p>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-2">
            <Calendar className="w-6 h-6 text-white" />
            <h2 className="font-semibold text-base">Control total</h2>
            <p className="text-sm text-neutral-400">
              Cargá turnos manuales, cancelá liberando el horario al instante y mirá el estimado recaudado del día.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-600">
        BarberTurnos · Gestión simple para barberías
      </footer>
    </main>
  );
}