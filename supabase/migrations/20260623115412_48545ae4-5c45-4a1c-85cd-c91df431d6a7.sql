
CREATE TABLE public.business_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT DEFAULT '',
  horario TEXT DEFAULT '',
  minimo_compra TEXT DEFAULT '',
  formas_pago TEXT DEFAULT '',
  zona_entrega TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_info TO anon, authenticated;
GRANT ALL ON public.business_info TO service_role;
ALTER TABLE public.business_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_business" ON public.business_info FOR ALL USING (true) WITH CHECK (true);
INSERT INTO public.business_info DEFAULT VALUES;

CREATE TABLE public.productos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  precio NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos TO anon, authenticated;
GRANT ALL ON public.productos TO service_role;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_productos" ON public.productos FOR ALL USING (true) WITH CHECK (true);

CREATE TYPE public.condicion_cliente AS ENUM ('frecuente','nuevo','lista_negra');

CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefono TEXT NOT NULL,
  nombre TEXT NOT NULL,
  condicion public.condicion_cliente NOT NULL DEFAULT 'nuevo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO anon, authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

CREATE TYPE public.estado_conversacion AS ENUM ('respondido','escalado');

CREATE TABLE public.conversaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  cliente TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  respuesta TEXT NOT NULL DEFAULT '',
  estado public.estado_conversacion NOT NULL DEFAULT 'respondido'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversaciones TO anon, authenticated;
GRANT ALL ON public.conversaciones TO service_role;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_conversaciones" ON public.conversaciones FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.productos (nombre, precio, stock, activo) VALUES
  ('Empanada de carne', 800, 50, true),
  ('Empanada de pollo', 800, 30, true),
  ('Gaseosa 1.5L', 1800, 12, true);

INSERT INTO public.clientes (telefono, nombre, condicion) VALUES
  ('+5491122334455', 'María González', 'frecuente'),
  ('+5491198765432', 'Juan Pérez', 'nuevo');

INSERT INTO public.conversaciones (cliente, mensaje, respuesta, estado) VALUES
  ('María González', '¿Tenés empanadas de carne?', 'Sí, tenemos disponibles. ¿Cuántas querés?', 'respondido'),
  ('Juan Pérez', 'Quiero hacer un reclamo urgente', 'Te derivo con un asesor humano.', 'escalado');
