export interface HorarioLaboral {
  hora_inicio: string; // ej: "09:00:00"
  hora_fin: string;    // ej: "13:00:00"
}

export interface TurnoOcupado {
  inicio: string; // ISO string desde Supabase
  fin: string;    // ISO string desde Supabase
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function aFormatoHora(minutos: number): string {
  const h = Math.floor(minutos / 60).toString().padStart(2, '0');
  const m = (minutos % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function calcularHorariosLibres(
  horariosLaborales: HorarioLaboral[],
  turnosOcupados: TurnoOcupado[],
  duracionServicioMin: number,
  intervaloMin = 15 // cada cuántos minutos ofrece arrancar (ej: 15 o 30)
): string[] {
  const libres: string[] = [];

  // Pasamos los turnos ocupados a rangos de minutos del día (hora local)
  const ocupados = turnosOcupados.map((t) => {
    const ini = new Date(t.inicio);
    const fin = new Date(t.fin);
    return {
      inicio: ini.getHours() * 60 + ini.getMinutes(),
      fin: fin.getHours() * 60 + fin.getMinutes(),
    };
  });

  for (const bloque of horariosLaborales) {
    const inicioBloque = aMinutos(bloque.hora_inicio);
    const finBloque = aMinutos(bloque.hora_fin);

    for (
      let actual = inicioBloque;
      actual + duracionServicioMin <= finBloque;
      actual += intervaloMin
    ) {
      const finPropuesto = actual + duracionServicioMin;

      // Verificamos si choca con algún turno ya tomado
      const choca = ocupados.some(
        (t) => actual < t.fin && finPropuesto > t.inicio
      );

      if (!choca) {
        libres.push(aFormatoHora(actual));
      }
    }
  }

  return libres;
}