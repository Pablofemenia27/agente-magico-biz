-- Cierra el acceso anónimo a las tablas de este proyecto (Lovable Cloud).
--
-- Situación previa: las cuatro tablas tenían políticas generadas por el
-- scaffolding de Lovable con la forma
--
--     CREATE POLICY "public_all_x" ON x FOR ALL USING (true) WITH CHECK (true);
--
-- junto con GRANT ... TO anon. RLS figuraba activo, pero la política no
-- restringía nada: cualquiera en internet, con solo la clave publishable que
-- viaja en el bundle de JavaScript, podía leer, escribir y borrar. Comprobado
-- en vivo el 2026-07-31 (HTTP 206 sin login sobre las cuatro tablas).
--
-- Lo que más importaba de lo expuesto: los 765 productos, que son la lista de
-- precios mayorista real.
--
-- Criterio del arreglo: exigir sesión iniciada, nada más. No se acota por
-- negocio porque este proyecto no tiene columna cliente_id ni modelo
-- multi-tenant — es la base de preview de Lovable, no la de producción (esa es
-- ujmotwlmnndcvfjlgrqk, "agente msje", que ya tiene su RLS bien acotado).
-- Así el preview de Lovable sigue funcionando estando logueado, y se cierra
-- el acceso desde afuera.
--
-- PARA REVERTIR, si algo dejara de andar:
--   DROP POLICY "auth_all_productos" ON public.productos;
--   CREATE POLICY "public_all_productos" ON public.productos
--     FOR ALL USING (true) WITH CHECK (true);
--   (y lo mismo para las otras tres tablas)

-- productos
DROP POLICY IF EXISTS "public_all_productos" ON public.productos;
CREATE POLICY "auth_all_productos" ON public.productos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- clientes
DROP POLICY IF EXISTS "public_all_clientes" ON public.clientes;
CREATE POLICY "auth_all_clientes" ON public.clientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- conversaciones
DROP POLICY IF EXISTS "public_all_conversaciones" ON public.conversaciones;
CREATE POLICY "auth_all_conversaciones" ON public.conversaciones
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- business_info
DROP POLICY IF EXISTS "public_all_business" ON public.business_info;
CREATE POLICY "auth_all_business_info" ON public.business_info
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Quitar los permisos de tabla del rol anónimo.
-- Con RLS esto ya sería redundante, pero deja el permiso alineado con la
-- intención: anon no tiene nada que hacer en estas tablas.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.productos      FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.clientes       FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.conversaciones FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.business_info  FROM anon;
