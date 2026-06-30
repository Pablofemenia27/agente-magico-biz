import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { MessageSquare, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conversaciones")({
  head: () => ({ meta: [{ title: "Conversaciones — AgentPanel" }] }),
  component: ConversacionesPage,
});

type Estado = "respondido" | "escalado";
type Conv = {
  id: string;
  fecha: string;
  cliente: string;
  telefono?: string;
  mensaje: string;
  respuesta: string;
  estado: Estado;
};
type ClienteRow = { telefono: string; nombre: string };

type Thread = {
  key: string;
  nombre: string;
  telefono: string;
  lastMessage: string;
  lastDate: string;
  hasEscalado: boolean;
  items: Conv[];
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function ConversacionesPage() {
  const [items, setItems] = useState<Conv[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [convRes, cliRes] = await Promise.all([
        supabase
          .from("conversaciones")
          .select("id, fecha, cliente, mensaje, respuesta, estado")
          .order("fecha", { ascending: false }),
        supabase.from("clientes").select("telefono,nombre"),
      ]);
      if (convRes.error) toast.error(convRes.error.message);
      else setItems((convRes.data as Conv[]) ?? []);
      if (!cliRes.error) setClientes((cliRes.data as ClienteRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const nombreByTelefono = useMemo(() => {
    const m = new Map<string, string>();
    clientes.forEach((c) => m.set(c.telefono?.trim(), c.nombre));
    return m;
  }, [clientes]);

  const threads = useMemo<Thread[]>(() => {
    const groups = new Map<string, Conv[]>();
    for (const c of items) {
      const k = (c.telefono && c.telefono.trim() !== "" ? c.telefono : c.cliente ?? "").trim() || "sin-id";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(c);
    }
    const list: Thread[] = [];
    for (const [key, arr] of groups.entries()) {
      const sorted = [...arr].sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      );
      const last = sorted[sorted.length - 1];
      const rawNombre = nombreByTelefono.get(key);
const nombreLookup = (rawNombre && rawNombre !== '==' && rawNombre !== '—' && rawNombre.trim() !== '') 
  ? rawNombre 
  : undefined;
      const isWeb = key.startsWith("web-");
      const isPhone = /^[+\d\s()-]{6,}$/.test(key);

      let nombre: string;
      let telefono: string;

      if (nombreLookup) {
  nombre = nombreLookup;
  telefono = key;
} else if (key.startsWith("web-")) {
  nombre = "Visitante Web";
  telefono = key.slice(-6);
} else if (isPhone) {
  nombre = key;
  telefono = key;
} else {
  const clienteVal = arr[0]?.cliente || "";
  nombre = (clienteVal && clienteVal !== "==" && clienteVal !== "—") 
    ? clienteVal 
    : key;
  telefono = key;
}
      list.push({
        key,
        nombre,
        telefono,
        lastMessage: last.mensaje || last.respuesta || "",
        lastDate: last.fecha,
        hasEscalado: arr.some((m) => m.estado === "escalado"),
        items: sorted,
      });
    }
    list.sort(
      (a, b) =>
        new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
    );
    return list;
  }, [items, nombreByTelefono]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.nombre.toLowerCase().includes(q) ||
        t.telefono.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q)
    );
  }, [threads, search]);

  const selected = useMemo(
    () => threads.find((t) => t.key === selectedKey) ?? null,
    [threads, selectedKey]
  );

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conversaciones</h1>
          <p className="text-sm text-muted-foreground">
            Historial de mensajes atendidos por el agente.
          </p>
        </div>
      </header>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex h-[calc(100vh-12rem)] min-h-[500px]">
        {/* Panel izquierdo */}
        <aside className="w-[35%] min-w-[260px] border-r border-border flex flex-col">
          <div className="p-4 border-b border-border space-y-3">
            <h2 className="font-semibold">Conversaciones</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Cargando...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {threads.length === 0
                  ? "Aún no hay conversaciones."
                  : "Sin resultados."}
              </div>
            ) : (
              filteredThreads.map((t) => {
                const active = t.key === selectedKey;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelectedKey(t.key)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border/60 transition-colors hover:bg-muted/40 cursor-pointer",
                      active && "bg-primary/10 hover:bg-primary/10"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {t.nombre}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatTime(t.lastDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground truncate flex-1">
                        {t.lastMessage.length > 45
                          ? t.lastMessage.slice(0, 45) + "…"
                          : t.lastMessage}
                      </p>
                      {t.hasEscalado && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning border border-warning/30 px-1.5 py-0.5 text-[10px] font-medium shrink-0">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Escalado
                        </span>
                      )}
                    </div>
                    {t.telefono && t.nombre !== t.telefono && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                        {t.telefono}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Panel derecho */}
        <section className="flex-1 flex flex-col bg-background/30">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Seleccioná un cliente para ver la conversación
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-border bg-card">
                <div className="font-semibold">{selected.nombre}</div>
                {selected.telefono && (
                  <div className="text-xs text-muted-foreground">
                    {selected.telefono}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selected.items.map((m) => (
                  <div key={m.id} className="space-y-3">
                    {m.mensaje && (
                      <div className="flex flex-col items-start max-w-[75%]">
                        <div className="rounded-2xl rounded-tl-sm bg-muted text-foreground px-4 py-2 text-sm whitespace-pre-wrap break-words">
                          {m.mensaje}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 ml-1">
                          {formatFull(m.fecha)}
                        </span>
                      </div>
                    )}
                    {m.respuesta && (
                      <div className="flex flex-col items-end ml-auto max-w-[75%]">
                        <div
                          className="rounded-2xl rounded-tr-sm px-4 py-2 text-sm whitespace-pre-wrap break-words text-white"
                          style={{ backgroundColor: "#C8A96E" }}
                        >
                          {m.respuesta}
                        </div>
                        <div className="flex items-center gap-2 mt-1 mr-1">
                          {m.estado === "respondido" ? (
                            <span className="inline-flex items-center rounded-full bg-success/15 text-success border border-success/30 px-1.5 py-0.5 text-[10px] font-medium">
                              Respondido
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-warning/15 text-warning border border-warning/30 px-1.5 py-0.5 text-[10px] font-medium">
                              Escalado
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatFull(m.fecha)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
