import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, CheckCircle2, AlertTriangle, Clock, BarChart3, Flame } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — AgentPanel" }] }),
  component: DashboardPage,
});

type Conversacion = {
  id: string;
  cliente: string;
  mensaje: string;
  respuesta: string;
  estado: string;
  fecha: string;
};

type Cliente = { telefono: string; nombre: string };

function DashboardPage() {
  const [convs, setConvs] = useState<Conversacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: cl }] = await Promise.all([
        supabase.from("conversaciones").select("*").order("fecha", { ascending: false }),
        supabase.from("clientes").select("telefono,nombre"),
      ]);
      setConvs((c as Conversacion[]) ?? []);
      setClientes((cl as Cliente[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = convs.length;
    const respondidos = convs.filter((c) => c.estado === "respondido").length;
    const escalados = convs.filter((c) => c.estado === "escalado").length;
    const horasAhorradas = (respondidos * 2.5) / 60;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    return {
      total,
      respondidos,
      escalados,
      horasAhorradas,
      pctResp: pct(respondidos),
      pctEsc: pct(escalados),
    };
  }, [convs]);

  const chartData = useMemo(() => {
    const days: { key: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit" });
      days.push({ key, label, count: 0 });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    for (const c of convs) {
      const key = new Date(c.fecha).toISOString().slice(0, 10);
      const e = map.get(key);
      if (e) e.count++;
    }
    return days;
  }, [convs]);

  const nombrePorTel = useMemo(() => {
    const m = new Map<string, string>();
    for (const cl of clientes) m.set(cl.telefono, cl.nombre);
    return m;
  }, [clientes]);

  const ultimosEscalados = useMemo(
    () => convs.filter((c) => c.estado === "escalado").slice(0, 5),
    [convs],
  );

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen de actividad del agente de WhatsApp
        </p>
      </header>

      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Mensajes procesados"
          value={loading ? "—" : stats.total.toLocaleString("es-AR")}
          icon={<MessageSquare className="h-5 w-5" />}
          accent="text-primary"
          subtitle="total histórico"
        />
        <MetricCard
          title="Resueltos automáticamente"
          value={loading ? "—" : stats.respondidos.toLocaleString("es-AR")}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="text-success"
          subtitle={loading ? "" : `${stats.pctResp}% del total`}
        />
        <MetricCard
          title="Escalados"
          value={loading ? "—" : stats.escalados.toLocaleString("es-AR")}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="text-warning"
          subtitle={loading ? "" : `${stats.pctEsc}% del total`}
        />
        <MetricCard
          title="Tiempo ahorrado"
          value={loading ? "—" : `${stats.horasAhorradas.toFixed(1)} h`}
          icon={<Clock className="h-5 w-5" />}
          accent="text-primary"
          subtitle="estimado a 2.5 min por mensaje"
        />
      </section>

      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Mensajes por día (últimos 7)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)", opacity: 0.3 }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-warning" />
              Últimos escalados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ultimosEscalados.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {loading ? "Cargando…" : "Sin mensajes escalados"}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {ultimosEscalados.map((c) => {
                  const nombre = nombrePorTel.get(c.cliente) || c.cliente;
                  return (
                    <li key={c.id} className="py-3 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{nombre}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(c.fecha).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{c.mensaje}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className={`rounded-md bg-accent/50 p-2 ${accent ?? ""}`}>{icon}</div>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}
