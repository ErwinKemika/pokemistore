
-- Allowed users (allowlist for signup)
CREATE TABLE public.allowed_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Master products
CREATE TABLE public.master_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT UNIQUE NOT NULL,
  nama_produk TEXT NOT NULL,
  deskripsi TEXT,
  kemasan TEXT,
  harga NUMERIC NOT NULL DEFAULT 0,
  disc_percent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase orders
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_po TEXT UNIQUE NOT NULL,
  tgl_po DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','terkirim','diproses','diterima','ditagih','lunas','dibatalkan')),
  catatan TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  ppn NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PO items
CREATE TABLE public.po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  no_item INTEGER NOT NULL,
  kode TEXT NOT NULL,
  nama_produk TEXT NOT NULL,
  kemasan TEXT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  harga NUMERIC NOT NULL DEFAULT 0,
  disc_percent NUMERIC NOT NULL DEFAULT 0,
  disc_rp NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_items_po_id ON public.po_items(po_id);
CREATE INDEX idx_purchase_orders_tgl ON public.purchase_orders(tgl_po);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_master_products_updated BEFORE UPDATE ON public.master_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_purchase_orders_updated BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allowlist enforcement on signup
CREATE OR REPLACE FUNCTION public.enforce_allowlist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.allowed_users WHERE lower(email) = lower(NEW.email)) THEN
    RAISE EXCEPTION 'Email tidak terdaftar di allowlist. Hubungi admin.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_enforce_allowlist
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_allowlist();

-- Enable RLS
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items ENABLE ROW LEVEL SECURITY;

-- Policies: any authenticated user can do everything (internal tool)
CREATE POLICY "auth_all_allowed_users" ON public.allowed_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_master_products" ON public.master_products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_purchase_orders" ON public.purchase_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_po_items" ON public.po_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed admin email
INSERT INTO public.allowed_users (email, role) VALUES ('admin@kemikastore.com', 'admin');
