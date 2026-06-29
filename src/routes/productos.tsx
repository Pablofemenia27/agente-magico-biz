import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Package, Pencil, Plus, Search, Trash2, Upload, Download } from "lucide-react";

export const Route = createFileRoute("/productos")({
  head: () => ({ meta: [{ title: "Productos — AgentPanel" }] }),
  component: ProductosPage,
});

type Producto = { id: string; nombre: string; precio: number; stock: number; activo: boolean };

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v == null) return true;
  const s = String(v).trim().toLowerCase();
  return ["si", "sí", "true", "1", "x", "yes", "y", "activo"].includes(s);
}

function parseNum(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  const norm = (k: string) => k.toLowerCase().trim().replace(/\s+/g, "_");
  const map: Record<string, unknown> = {};
  for (const k of Object.keys(row)) map[norm(k)] = row[k];
  for (const k of keys) {
    const v = map[norm(k)];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function ProductosPage() {
  const [items, setItems] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [form, setForm] = useState<Omit<Producto, "id">>({ nombre: "", precio: 0, stock: 0, activo: true });
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("productos").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data as Producto[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => items.filter((p) => p.nombre.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const openNew = () => {
    setEditing(null);
    setForm({ nombre: "", precio: 0, stock: 0, activo: true });
    setOpen(true);
  };
  const openEdit = (p: Producto) => {
    setEditing(p);
    setForm({ nombre: p.nombre, precio: p.precio, stock: p.stock, activo: p.activo });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (editing) {
      const { error } = await supabase.from("productos").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Producto actualizado");
    } else {
      const { error } = await supabase.from("productos").insert(form);
      if (error) return toast.error(error.message);
      toast.success("Producto agregado");
    }
    setOpen(false);
    load();
  };

  const remove = async (p: Producto) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    const { error } = await supabase.from("productos").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Producto eliminado");
    load();
  };

  const toggleActive = async (p: Producto) => {
    const { error } = await supabase.from("productos").update({ activo: !p.activo }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { nombre: "Ejemplo Producto", precio: 1500, stock: 10, activo: "SI" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productos");
    XLSX.writeFile(wb, "plantilla_productos.xlsx");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      const { data: existing, error: exErr } = await supabase.from("productos").select("id,nombre");
      if (exErr) throw new Error(exErr.message);
      const byName = new Map<string, string>();
      (existing ?? []).forEach((p: { id: string; nombre: string }) =>
        byName.set(p.nombre.trim().toLowerCase(), p.id)
      );

      let created = 0, updated = 0, skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nombre = String(pick(row, ["nombre", "producto", "name"]) ?? "").trim();
        if (!nombre) { skipped++; continue; }
        const payload = {
          nombre,
          precio: parseNum(pick(row, ["precio", "price"])),
          stock: Math.trunc(parseNum(pick(row, ["stock", "cantidad", "qty"]))),
          activo: parseBool(pick(row, ["activo", "active", "habilitado"])),
        };
        const existingId = byName.get(nombre.toLowerCase());
        if (existingId) {
          const { error } = await supabase.from("productos").update(payload).eq("id", existingId);
          if (error) errors.push(`Fila ${i + 2} (${nombre}): ${error.message}`);
          else updated++;
        } else {
          const { data: ins, error } = await supabase.from("productos").insert(payload).select("id").single();
          if (error) errors.push(`Fila ${i + 2} (${nombre}): ${error.message}`);
          else { created++; if (ins) byName.set(nombre.toLowerCase(), ins.id); }
        }
      }

      setImportResult({ created, updated, skipped, errors });
      toast.success(`Importación: ${created} creados, ${updated} actualizados${skipped ? `, ${skipped} omitidos` : ""}`);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al importar";
      toast.error(msg);
      setImportResult({ created: 0, updated: 0, skipped: 0, errors: [msg] });
    } finally {
      setImporting(false);
    }
  };


  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">Catálogo que el agente puede ofrecer.</p>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button variant="outline" onClick={downloadTemplate} title="Descargar plantilla Excel">
            <Download className="h-4 w-4 mr-2" />Plantilla
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4 mr-2" />{importing ? "Importando..." : "Importar Excel"}
          </Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Agregar producto</Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell>${p.precio.toLocaleString("es-AR")}</TableCell>
                <TableCell>{p.stock}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={p.activo} onCheckedChange={() => toggleActive(p)} />
                    <span className="text-xs text-muted-foreground">{p.activo ? "SI" : "NO"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(p)}>
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
            <DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Producto</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio</Label>
                <Input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Guardar" : "Agregar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!importResult} onOpenChange={(o) => !o && setImportResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resultado de importación</DialogTitle>
            <DialogDescription>
              Se procesó el archivo Excel. Los productos existentes (mismo nombre) fueron actualizados; los nuevos se crearon.
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Creados" value={importResult.created} />
                <Stat label="Actualizados" value={importResult.updated} />
                <Stat label="Omitidos" value={importResult.skipped} />
              </div>
              {importResult.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="font-medium text-destructive">Errores ({importResult.errors.length})</p>
                  <ul className="max-h-40 overflow-auto rounded border border-border bg-muted/30 p-2 text-xs space-y-1">
                    {importResult.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setImportResult(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
