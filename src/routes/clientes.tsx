import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — AgentPanel" }] }),
  component: ClientesPage,
});

type Condicion = "frecuente" | "nuevo" | "lista_negra";
type Cliente = { id: string; telefono: string; nombre: string; condicion: Condicion };

const condLabel: Record<Condicion, string> = {
  frecuente: "Cliente frecuente",
  nuevo: "Nuevo",
  lista_negra: "Lista negra",
};
const condStyle: Record<Condicion, string> = {
  frecuente: "bg-success/15 text-success border border-success/30",
  nuevo: "bg-primary/15 text-primary border border-primary/30",
  lista_negra: "bg-destructive/15 text-destructive border border-destructive/30",
};

function ClientesPage() {
  const [items, setItems] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Omit<Cliente, "id">>({ telefono: "", nombre: "", condicion: "nuevo" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data as Cliente[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ telefono: "", nombre: "", condicion: "nuevo" }); setOpen(true); };
  const openEdit = (c: Cliente) => { setEditing(c); setForm({ telefono: c.telefono, nombre: c.nombre, condicion: c.condicion }); setOpen(true); };

  const save = async () => {
    if (!form.nombre.trim() || !form.telefono.trim()) { toast.error("Nombre y teléfono son obligatorios"); return; }
    if (editing) {
      const { error } = await supabase.from("clientes").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Cliente actualizado");
    } else {
      const { error } = await supabase.from("clientes").insert(form);
      if (error) return toast.error(error.message);
      toast.success("Cliente agregado");
    }
    setOpen(false); load();
  };

  const remove = async (c: Cliente) => {
    if (!confirm(`¿Eliminar "${c.nombre}"?`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Cliente eliminado");
    load();
  };

  const updateCondicion = async (c: Cliente, condicion: Condicion) => {
    const { error } = await supabase.from("clientes").update({ condicion }).eq("id", c.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Base de contactos del agente.</p>
        </div>
      </header>

      <div className="flex justify-end mb-4">
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Agregar cliente</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teléfono</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Condición</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sin clientes</TableCell></TableRow>
            ) : items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-sm">{c.telefono}</TableCell>
                <TableCell className="font-medium">{c.nombre}</TableCell>
                <TableCell>
                  <Select value={c.condicion} onValueChange={(v) => updateCondicion(c, v as Condicion)}>
                    <SelectTrigger className={"w-[180px] " + condStyle[c.condicion]}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frecuente">Cliente frecuente</SelectItem>
                      <SelectItem value="nuevo">Nuevo</SelectItem>
                      <SelectItem value="lista_negra">Lista negra</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(c)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+54 9 11 ..." />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Condición</Label>
              <Select value={form.condicion} onValueChange={(v) => setForm({ ...form, condicion: v as Condicion })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="frecuente">Cliente frecuente</SelectItem>
                  <SelectItem value="nuevo">Nuevo</SelectItem>
                  <SelectItem value="lista_negra">Lista negra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Guardar" : "Agregar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// avoid unused import warning if any
void condLabel;
