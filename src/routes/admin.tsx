import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const ADMIN_EMAIL = "pablofemenia.marketing@gmail.com";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — AgentPanel" }] }),
  component: AdminPage,
});

type Negocio = {
  id: string;
  nombre: string;
  slug: string | null;
  email_contacto: string | null;
  estado: string | null;
  created_at: string;
  primer_uso: string | null;
  ultima_ejecucion: string | null;
};

const ESTADOS = ["piloto", "activo", "inactivo"] as const;

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function estadoBadge(estado: string | null) {
  const e = (estado ?? "").toLowerCase();
  if (e === "activo")
    return <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">activo</Badge>;
  if (e === "piloto")
    return <Badge className="bg-orange-500 hover:bg-orange-500 text-white">piloto</Badge>;
  return <Badge className="bg-muted text-muted-foreground hover:bg-muted">{estado || "inactivo"}</Badge>;
}

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [loading, isAdmin, navigate]);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  const [negocios, setNegocios] = useState<Negocio[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const computedSlug = useMemo(
    () => (slugTouched ? slug : slugify(nombre)),
    [nombre, slug, slugTouched]
  );

  const loadNegocios = async () => {
    setListError(null);
    const { data, error } = await supabase
      .from("negocios" as never)
      .select("id,nombre,slug,email_contacto,estado,created_at,primer_uso,ultima_ejecucion")
      .order("created_at", { ascending: false });
    if (error) {
      setListError(error.message);
      setNegocios([]);
      return;
    }
    setNegocios((data as unknown as Negocio[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) loadNegocios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !password || !computedSlug) {
      toast.error("Completá todos los campos");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-cliente`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            nombre: nombre.trim(),
            slug: computedSlug,
            email: email.trim(),
            password,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al crear cliente');

      setLastCreated({ email: email.trim(), password });
      toast.success("Cliente creado correctamente");
      setNombre("");
      setEmail("");
      setPassword("");
      setSlug("");
      setSlugTouched(false);
      await loadNegocios();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear cliente");
    } finally {
      setSubmitting(false);
    }
  };

  const cambiarEstado = async (n: Negocio) => {
    const idx = ESTADOS.indexOf((n.estado ?? "piloto") as (typeof ESTADOS)[number]);
    const next = ESTADOS[(idx + 1) % ESTADOS.length];
    const nuevo = window.prompt(
      `Nuevo estado para "${n.nombre}" (piloto, activo, inactivo):`,
      next,
    );
    if (!nuevo) return;
    const clean = nuevo.trim().toLowerCase();
    if (!ESTADOS.includes(clean as (typeof ESTADOS)[number])) {
      toast.error("Estado inválido");
      return;
    }
    const { error } = await supabase
      .from("negocios" as never)
      .update({ estado: clean } as never)
      .eq("id", n.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Estado actualizado");
    await loadNegocios();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <ShieldAlert className="h-5 w-5" />
        Acceso restringido
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Panel de Administración</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestión de clientes y negocios</p>
      </header>

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Crear nuevo cliente</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del negocio</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Panadería La Esquina"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email del dueño</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dueño@empresa.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña inicial</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPass ? "Ocultar" : "Mostrar"}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug del negocio</Label>
            <Input
              id="slug"
              value={computedSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="panaderia-la-esquina"
              required
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cliente"}
            </Button>
          </div>
        </form>

        {lastCreated && (
          <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <div className="font-medium text-emerald-700 dark:text-emerald-400">
              Cliente creado. Credenciales:
            </div>
            <div className="mt-1 font-mono text-xs">
              <div>email: {lastCreated.email}</div>
              <div>contraseña: {lastCreated.password}</div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card shadow-sm">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-semibold">Clientes</h2>
        </div>
        <div className="px-2 pb-4">
          {negocios === null ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : listError ? (
            <div className="px-4 py-3 text-sm text-destructive">{listError}</div>
          ) : negocios.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Todavía no hay clientes.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creación</TableHead>
                  <TableHead>Primer uso</TableHead>
                  <TableHead>Última ejecución</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negocios.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{n.email_contacto ?? "—"}</TableCell>
                    <TableCell>{estadoBadge(n.estado)}</TableCell>
                    <TableCell>{formatDate(n.created_at)}</TableCell>
                    <TableCell>
                      {n.primer_uso ? formatDate(n.primer_uso) : (
                        <span className="text-muted-foreground">Sin actividad</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(n.ultima_ejecucion)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => cambiarEstado(n)}>
                        Editar estado
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
