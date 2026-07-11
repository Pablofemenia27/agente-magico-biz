ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS marca_detectada text,
  ADD COLUMN IF NOT EXISTS formato_detectado text,
  ADD COLUMN IF NOT EXISTS variante_detectada text,
  ADD COLUMN IF NOT EXISTS unidad_venta text;