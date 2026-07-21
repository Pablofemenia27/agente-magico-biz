import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Check, ClipboardCheck, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/revision-productos")({
  head: () => ({ meta: [{ title: "Revisión de Productos — AgentPanel" }] }),
  component: RevisionPage,
});

type Producto = {
  id: string;
  nombre: string;
  nombre_display: string | null;
  marca_detectada: string | null;
  categoria: string | null;
  cantidad_por_paquete: number | string | null;
  medida_valor: number | string | null;
  medida_unidad: string | null;
  tipo_hoja: string | null;
  color: string | null;
  aroma_sabor: string | null;
  unidad_venta: string | null;
  revisado: boolean | null;
};

type Field =
  | "nombre_display"
  | "marca_detectada"
  | "categoria"
  | "cantidad_por_paquete"
  | "medida_valor"
  | "medida_unidad"
  | "tipo_hoja"
  | "color"
  | "aroma_sabor"
  | "unidad_venta";

const NUMERIC: Field[] = ["cantidad_por_paquete", "medida_valor"];

function RevisionPage() {
  const { clienteId } = useAuth();
  const [items, setItems] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!clienteId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("cliente_id" as never, clienteId)
      .eq("revisado" as never, false)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data as unknown as Producto[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clienteId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      p.nombre.toLowerCase().includes(q) ||
      (p.nombre_display ?? "").toLowerCase().includes(q) ||
      (p.marca_detectada ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const updateField = (id: string, field: Field, value: string) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const persist = async (p: Producto, field: Field) => {
    const raw = (p[field] ?? "") as string | number | null;
    let val: string | number | null = raw == null || String(raw).trim() === "" ? null : String(raw).trim();
    if (val !== null && NUMERIC.includes(field)) {
      const n = Number(String(val).replace(",", "."));
      val = isFinite(n) ? n : null;
    }
    const { error } = await supabase.from("productos").update({ [field]: val } as never).eq("id", p.id);
    if (error) toast.error(error.message);
  };

  const confirmar = async (p: Producto) => {
    setSaving(p.id);
    const { error } = await supabase.from("productos").update({ revisado: true } as never).eq("id", p.id);
    setSaving(null);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((x) => x.id !== p.id));
    toast.success("Producto confirmado");
  };

  const confirmarTodos = async () => {
    if (filtered.length === 0) return;
    if (!confirm(`¿Confirmar los ${filtered.length} productos visibles?`)) return;
    const ids = filtered.map((p) => p.id);
    const { error } = await supabase.from("productos").update({ revisado: true } as never).in("id", ids);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((p) => !ids.includes(p.id)));
    toast.success(`${ids.length} productos confirmados`);
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Revisión de Productos</h1>
          <p className="text-sm text-muted-foreground">
            Productos pendientes de validar. Los cambios se guardan al salir del campo.
          </p>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{filtered.length} pendiente{filtered.length === 1 ? "" : "s"}</span>
          <Button onClick={confirmarTodos} disabled={filtered.length === 0}>
            <Check className="h-4 w-4 mr-2" />
            Confirmar todos los visibles
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Original</TableHead>
                <TableHead className="min-w-[180px]">Nombre display</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Cant. x paq.</TableHead>
                <TableHead>Medida</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Tipo de hoja</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Aroma / Sabor</TableHead>
                <TableHead>Unidad de venta</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-10"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-10">No hay productos pendientes de revisión.</TableCell></TableRow>
              ) : filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground text-xs align-top">{p.nombre}</TableCell>
                  {(["nombre_display","marca_detectada","categoria","cantidad_por_paquete","medida_valor","medida_unidad","tipo_hoja","color","aroma_sabor","unidad_venta"] as Field[]).map((f) => (
                    <TableCell key={f} className="align-top">
                      <Input
                        value={(p[f] ?? "") as string | number}
                        onChange={(e) => updateField(p.id, f, e.target.value)}
                        onBlur={() => persist(p, f)}
                        className="h-8 w-32"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-right align-top">
                    <Button size="sm" onClick={() => confirmar(p)} disabled={saving === p.id}>
                      {saving === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Confirmar</>}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
