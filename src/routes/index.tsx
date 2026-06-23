import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Mi Negocio — AgentPanel" }] }),
  component: MiNegocioPage,
});

type Business = {
  id: string;
  nombre: string;
  horario: string;
  minimo_compra: string;
  formas_pago: string;
  zona_entrega: string;
  telefono: string;
};

function MiNegocioPage() {
  const [data, setData] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("business_info")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error("Error al cargar: " + error.message);
        else setData(data as Business);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    const { error } = await supabase
      .from("business_info")
      .update({
        nombre: data.nombre,
        horario: data.horario,
        minimo_compra: data.minimo_compra,
        formas_pago: data.formas_pago,
        zona_entrega: data.zona_entrega,
        telefono: data.telefono,
      })
      .eq("id", data.id);
    setSaving(false);
    if (error) toast.error("Error al guardar: " + error.message);
    else toast.success("Cambios guardados");
  };

  const update = (k: keyof Business, v: string) => setData((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="p-6 md:p-10 max-w-3xl">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi Negocio</h1>
          <p className="text-sm text-muted-foreground">Información que tu agente usará al responder.</p>
        </div>
      </header>

      {loading || !data ? (
        <div className="text-muted-foreground">Cargando...</div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-5 shadow-sm">
          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Nombre del negocio">
              <Input value={data.nombre} onChange={(e) => update("nombre", e.target.value)} placeholder="Ej: Pizzería Don Carlos" />
            </Field>
            <Field label="Teléfono del dueño">
              <Input value={data.telefono} onChange={(e) => update("telefono", e.target.value)} placeholder="+54 9 11 ..." />
            </Field>
            <Field label="Horario de atención">
              <Input value={data.horario} onChange={(e) => update("horario", e.target.value)} placeholder="Lun a Vie 9 a 18hs" />
            </Field>
            <Field label="Mínimo de compra">
              <Input value={data.minimo_compra} onChange={(e) => update("minimo_compra", e.target.value)} placeholder="$ 5.000" />
            </Field>
          </div>
          <Field label="Formas de pago">
            <Textarea rows={2} value={data.formas_pago} onChange={(e) => update("formas_pago", e.target.value)} placeholder="Efectivo, transferencia, MercadoPago..." />
          </Field>
          <Field label="Zona de entrega">
            <Textarea rows={2} value={data.zona_entrega} onChange={(e) => update("zona_entrega", e.target.value)} placeholder="CABA y GBA Norte" />
          </Field>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  );
}
