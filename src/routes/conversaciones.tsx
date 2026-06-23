import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/conversaciones")({
  head: () => ({ meta: [{ title: "Conversaciones — AgentPanel" }] }),
  component: ConversacionesPage,
});

type Estado = "respondido" | "escalado";
type Conv = { id: string; fecha: string; cliente: string; mensaje: string; respuesta: string; estado: Estado };

function ConversacionesPage() {
  const [items, setItems] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | Estado>("todos");

  useEffect(() => {
    supabase
      .from("conversaciones")
      .select("*")
      .order("fecha", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setItems((data as Conv[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(
    () => (filtro === "todos" ? items : items.filter((c) => c.estado === filtro)),
    [items, filtro]
  );

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conversaciones</h1>
          <p className="text-sm text-muted-foreground">Historial de mensajes atendidos por el agente.</p>
        </div>
      </header>

      <div className="flex justify-end mb-4">
        <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="respondido">Respondidos</SelectItem>
            <SelectItem value="escalado">Escalados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Mensaje</TableHead>
              <TableHead>Respuesta</TableHead>
              <TableHead className="w-[140px]">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin conversaciones</TableCell></TableRow>
            ) : filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(c.fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
                <TableCell className="font-medium">{c.cliente}</TableCell>
                <TableCell className="max-w-[280px] truncate" title={c.mensaje}>{c.mensaje}</TableCell>
                <TableCell className="max-w-[280px] truncate text-muted-foreground" title={c.respuesta}>{c.respuesta}</TableCell>
                <TableCell>
                  {c.estado === "respondido" ? (
                    <span className="inline-flex items-center rounded-full bg-success/15 text-success border border-success/30 px-2.5 py-1 text-xs font-medium">
                      Respondido
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-warning/15 text-warning border border-warning/30 px-2.5 py-1 text-xs font-medium">
                      Escalado
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
