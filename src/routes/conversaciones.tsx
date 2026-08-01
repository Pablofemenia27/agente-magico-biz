import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Search,
  AlertTriangle,
  Bot,
  User as UserIcon,
  Send,
  Globe,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conversaciones")({
  head: () => ({ meta: [{ title: "Conversaciones — AgentPanel" }] }),
  component: ConversacionesPage,
});

type Estado = "respondido" | "escalado" | "manual_activo";
type Origen = "roma" | "manual";

type Conv = {
  id: string;
  fecha: string;
  cliente: string;
  telefono?: string | null;
  mensaje: string;
  respuesta: string;
  estado: Estado;
  origen?: Origen | null;
};
type ClienteRow = { telefono: string; nombre: string };

type Thread = {
  key: string;
  nombre: string;
  telefono: string;
  /** true si el hilo viene del widget web: no se le puede responder por WhatsApp */
  esWeb: boolean;
  lastMessage: string;
  lastDate: string;
  hasEscalado: boolean;
  /** estado de la fila mas reciente: define si la conversacion esta tomada a mano */
  estadoActual: Estado;
  items: Conv[];
};

type Filtro = "todas" | "atencion";

const RESPONDER_URL = import.meta.env.VITE_ROMA_RESPONDER_URL as string | undefined;

/** Un hilo se puede responder por WhatsApp solo si su clave es un telefono real. */
function esTelefonoReal(key: string) {
  return /^\d{10,15}$/.test(key.replace(/\D/g, "")) && !key.startsWith("web-");
}

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
  const { clienteId, session } = useAuth();
  const [items, setItems] = useState<Conv[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const finDelHilo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clienteId) return;
    setLoading(true);
    (async () => {
      const [convRes, cliRes] = await Promise.all([
        supabase
          .from("conversaciones")
          // telefono, origen y respondido_por son necesarios para agrupar bien
          // y para distinguir quien contesto cada mensaje.
          .select("id, fecha, cliente, telefono, mensaje, respuesta, estado, origen" as never)
          .eq("cliente_id" as never, clienteId)
          .order("fecha", { ascending: false }),
        supabase.from("clientes").select("telefono,nombre").eq("cliente_id" as never, clienteId),
      ]);
      if (convRes.error) toast.error(convRes.error.message);
      else setItems((convRes.data as unknown as Conv[]) ?? []);
      if (!cliRes.error) setClientes((cliRes.data as ClienteRow[]) ?? []);
      setLoading(false);
    })();
  }, [clienteId]);

  const nombreByTelefono = useMemo(() => {
    const m = new Map<string, string>();
    clientes.forEach((c) => m.set(c.telefono?.trim(), c.nombre));
    return m;
  }, [clientes]);

  const threads = useMemo<Thread[]>(() => {
    const groups = new Map<string, Conv[]>();
    for (const c of items) {
      const k =
        (c.telefono && c.telefono.trim() !== "" ? c.telefono : c.cliente ?? "").trim() ||
        "sin-id";
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
      const nombreLookup =
        rawNombre && rawNombre !== "==" && rawNombre !== "—" && rawNombre.trim() !== ""
          ? rawNombre
          : undefined;
      const esWeb = key.startsWith("web-");
      const isPhone = /^[+\d\s()-]{6,}$/.test(key);

      let nombre: string;
      let telefono: string;

      if (nombreLookup) {
        nombre = nombreLookup;
        telefono = key;
      } else if (esWeb) {
        nombre = "Visitante Web";
        telefono = key.slice(-6);
      } else if (isPhone) {
        nombre = key;
        telefono = key;
      } else {
        const clienteVal = arr[0]?.cliente || "";
        nombre = clienteVal && clienteVal !== "==" && clienteVal !== "—" ? clienteVal : key;
        telefono = key;
      }

      list.push({
        key,
        nombre,
        telefono,
        esWeb,
        lastMessage: last.mensaje || last.respuesta || "",
        lastDate: last.fecha,
        hasEscalado: arr.some((m) => m.estado === "escalado"),
        estadoActual: last.estado,
        items: sorted,
      });
    }
    list.sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
    return list;
  }, [items, nombreByTelefono]);

  const filteredThreads = useMemo(() => {
    let base = threads;
    if (filtro === "atencion") {
      base = base.filter((t) => t.estadoActual === "escalado" || t.estadoActual === "manual_activo");
    }
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (t) =>
        t.nombre.toLowerCase().includes(q) ||
        t.telefono.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q)
    );
  }, [threads, search, filtro]);

  const cuentaAtencion = useMemo(
    () =>
      threads.filter((t) => t.estadoActual === "escalado" || t.estadoActual === "manual_activo")
        .length,
    [threads]
  );

  const selected = useMemo(
    () => threads.find((t) => t.key === selectedKey) ?? null,
    [threads, selectedKey]
  );

  const puedeResponder = selected ? esTelefonoReal(selected.key) : false;
  const tomadaAMano = selected?.estadoActual === "manual_activo";

  useEffect(() => {
    setBorrador("");
  }, [selectedKey]);

  useEffect(() => {
    finDelHilo.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selected?.items.length, selectedKey]);

  async function enviarRespuesta() {
    if (!selected || !session?.access_token) return;
    const texto = borrador.trim();
    if (!texto) return;

    if (!RESPONDER_URL) {
      toast.error("Falta configurar VITE_ROMA_RESPONDER_URL.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(RESPONDER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // El token identifica al usuario. El negocio se deduce de el en el
          // backend: no mandamos cliente_id ni user_id a proposito.
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ telefono: selected.key, mensaje: texto }),
      });

      const data = await res.json().catch(() => ({}) as Record<string, unknown>);

      if (!res.ok) {
        const detalle = Array.isArray(data?.errores) ? data.errores.join(" ") : "";
        if (res.status === 401) {
          toast.error("Tu sesión venció. Volvé a iniciar sesión.");
        } else if (res.status === 403) {
          toast.error(detalle || "No se puede enviar a ese número.");
        } else if (res.status === 422) {
          toast.error(detalle || "El mensaje no es válido.");
        } else {
          toast.error(detalle || "No se pudo enviar el mensaje.");
        }
        return;
      }

      // Recien ahora lo mostramos en pantalla: si el envio fallo, no queremos
      // un mensaje en el historial que el cliente nunca recibio.
      const nueva: Conv = {
        id: (data?.id as string) ?? `tmp-${Date.now()}`,
        fecha: new Date().toISOString(),
        cliente: selected.nombre,
        telefono: selected.key,
        mensaje: "",
        respuesta: texto,
        estado: "manual_activo",
        origen: "manual",
      };
      setItems((prev) => [nueva, ...prev]);
      setBorrador("");
      toast.success("Mensaje enviado");
    } catch {
      toast.error("No se pudo contactar al servidor. Revisá tu conexión.");
    } finally {
      setEnviando(false);
    }
  }

  async function devolverARoma() {
    if (!selected || !clienteId) return;
    setCerrando(true);
    try {
      const { error } = await supabase
        .from("conversaciones")
        .update({ estado: "respondido" } as never)
        .eq("cliente_id" as never, clienteId)
        .eq("telefono" as never, selected.key)
        .eq("estado" as never, "manual_activo");

      if (error) {
        toast.error(error.message);
        return;
      }
      setItems((prev) =>
        prev.map((c) =>
          c.telefono === selected.key && c.estado === "manual_activo"
            ? { ...c, estado: "respondido" as Estado }
            : c
        )
      );
      toast.success("Roma vuelve a responder esta conversación");
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conversaciones</h1>
          <p className="text-sm text-muted-foreground">
            Historial de mensajes y respuesta manual cuando haga falta.
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
            <div className="flex gap-1.5">
              <button
                onClick={() => setFiltro("todas")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer",
                  filtro === "todas"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                )}
              >
                Todas
              </button>
              <button
                onClick={() => setFiltro("atencion")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer",
                  filtro === "atencion"
                    ? "bg-warning/15 border-warning/30 text-warning"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                )}
              >
                Requieren atención
                {cuentaAtencion > 0 && ` (${cuentaAtencion})`}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {threads.length === 0
                  ? "Aún no hay conversaciones."
                  : filtro === "atencion"
                    ? "Nada pendiente. Roma está al día."
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
                      <span className="font-medium text-sm truncate flex items-center gap-1.5">
                        {t.esWeb && <Globe className="h-3 w-3 text-muted-foreground shrink-0" />}
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
                      {t.estadoActual === "manual_activo" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.5 text-[10px] font-medium shrink-0">
                          <UserIcon className="h-2.5 w-2.5" />
                          Vos
                        </span>
                      ) : (
                        t.hasEscalado && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning border border-warning/30 px-1.5 py-0.5 text-[10px] font-medium shrink-0">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Escalado
                          </span>
                        )
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
                <div className="font-semibold flex items-center gap-1.5">
                  {selected.esWeb && <Globe className="h-4 w-4 text-muted-foreground" />}
                  {selected.nombre}
                </div>
                {selected.telefono && (
                  <div className="text-xs text-muted-foreground">{selected.telefono}</div>
                )}
              </div>

              {tomadaAMano && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/20">
                  <p className="text-xs text-primary">
                    <strong>Estás atendiendo vos.</strong> Roma no va a responder esta
                    conversación hasta que la devuelvas.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={devolverARoma}
                    disabled={cerrando}
                    className="shrink-0 h-7 text-xs"
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    {cerrando ? "Devolviendo..." : "Devolver a Roma"}
                  </Button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selected.items.map((m) => {
                  const esManual = m.origen === "manual";
                  return (
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
                            className={cn(
                              "rounded-2xl rounded-tr-sm px-4 py-2 text-sm whitespace-pre-wrap break-words",
                              esManual
                                ? "bg-primary text-primary-foreground"
                                : "text-white"
                            )}
                            style={esManual ? undefined : { backgroundColor: "#C8A96E" }}
                          >
                            {m.respuesta}
                          </div>
                          <div className="flex items-center gap-2 mt-1 mr-1">
                            {esManual ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.5 text-[10px] font-medium">
                                <UserIcon className="h-2.5 w-2.5" />
                                Respondiste vos
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success border border-success/30 px-1.5 py-0.5 text-[10px] font-medium">
                                <Bot className="h-2.5 w-2.5" />
                                Roma
                              </span>
                            )}
                            {m.estado === "escalado" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning border border-warning/30 px-1.5 py-0.5 text-[10px] font-medium">
                                <AlertTriangle className="h-2.5 w-2.5" />
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
                  );
                })}
                <div ref={finDelHilo} />
              </div>

              {/* Caja de respuesta */}
              <div className="border-t border-border bg-card p-3">
                {puedeResponder ? (
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void enviarRespuesta();
                        }
                      }}
                      placeholder="Escribí tu respuesta... (Enter para enviar, Shift+Enter para salto de línea)"
                      rows={2}
                      maxLength={1500}
                      disabled={enviando}
                      className="resize-none text-sm"
                    />
                    <Button
                      onClick={() => void enviarRespuesta()}
                      disabled={enviando || borrador.trim() === ""}
                      className="shrink-0"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {enviando ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    {selected.esWeb
                      ? "Esta conversación vino del chat de la web. No hay un número de WhatsApp al que responder."
                      : "Esta conversación no tiene un número de teléfono válido guardado, así que no se le puede responder."}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
