# Kemika PO Manager

# PROMPT MASTER LOVABLE — Kemika PO System

> **Cara pakai:** Copy-paste tiap prompt dalam urutan ke Lovable. Test setelah tiap iterasi. Jangan skip ke prompt berikutnya kalau iterasi sebelumnya masih bug.

---

## PROMPT 1 — FOUNDATION (paste pertama)

**Tujuan:** Build skeleton app: auth, database schema, basic layout, navigation.

```
Build a Purchase Order management web app for "Kemika Online Store" — an Indonesian e-commerce business that orders restock from their parent company "PT. Kemika Karya Pratama". This is an internal tool, not customer-facing.

TECH STACK:
- React + TypeScript + Tailwind CSS
- Supabase (database + auth)
- shadcn/ui components
- React Router for navigation
- Mobile-responsive (works on phone)
- Indonesian language for all UI text

THEME:
- Light & Dark mode toggle (default: light)
- Primary accent: Tokopedia green (#02AC4F)
- Secondary accent: Shopee orange (#EE4D2D)
- Neutral palette: monochrome black/white/gray
- Font: Inter (sans-serif, professional, clean)
- Modern, minimalist, not corporate-stiff

AUTHENTICATION (Supabase Auth):
- Email + password login
- Email allowlist mode: only emails in `allowed_users` table can sign up
- Login page route: `/login`
- Forgot password flow
- All other routes protected (redirect to /login if not authenticated)
- Logout button in sidebar

DATABASE SCHEMA (Supabase Postgres):

Table 1: `allowed_users`
- id (uuid, primary key)
- email (text, unique, not null)
- role (text, default 'admin') — values: 'admin', 'staff'
- created_at (timestamp)

Table 2: `master_products`
- id (uuid, primary key)
- kode (text, unique, not null) — SKU code
- nama_produk (text, not null)
- deskripsi (text, nullable) — specification/description
- kemasan (text) — unit packaging (e.g. "BOTOL 1L", "PACK 1KG")
- harga (numeric) — PRICE KEMIKA (price before discount)
- disc_percent (numeric, default 0) — discount percentage (0.25 = 25%)
- created_at (timestamp)
- updated_at (timestamp)

Table 3: `purchase_orders`
- id (uuid, primary key)
- no_po (text, unique, not null) — format "PO.YYYYMMDD.NNKS"
- tgl_po (date, not null)
- status (text, not null, default 'draft') — values: 'draft', 'terkirim', 'diproses', 'diterima', 'ditagih', 'lunas', 'dibatalkan'
- catatan (text, nullable)
- subtotal (numeric, default 0)
- ppn (numeric, default 0) — 11% of subtotal
- grand_total (numeric, default 0)
- created_by (uuid, references auth.users)
- created_at (timestamp)
- updated_at (timestamp)

Table 4: `po_items`
- id (uuid, primary key)
- po_id (uuid, references purchase_orders, ON DELETE CASCADE)
- no_item (integer, not null) — line number (1, 2, 3...)
- kode (text, not null)
- nama_produk (text, not null)
- kemasan (text)
- qty (integer, not null, check qty > 0)
- harga (numeric, not null) — snapshot price at time of PO
- disc_percent (numeric, default 0) — snapshot discount
- disc_rp (numeric, default 0) — calculated: harga × disc_percent
- subtotal (numeric, not null) — calculated: qty × (harga - disc_rp)
- created_at (timestamp)

RLS (Row Level Security): Enable on all tables. Only authenticated users can read/write.

INITIAL SEED:
- Insert 1 admin email to `allowed_users`: 'admin@kemikastore.com' (we'll add more later via UI)
- Leave other tables empty

LAYOUT:
- Sidebar navigation (collapsible on mobile, hamburger menu)
- Top bar: page title (left), user email + dark mode toggle + logout (right)
- Main content area
- Sidebar items (with Lucide icons):
  - Dashboard (LayoutDashboard icon) → /
  - Buat PO (FilePlus icon) → /po/new
  - Riwayat PO (FileText icon) → /po
  - Master Barang (Package icon) → /products
  - Pengaturan (Settings icon) → /settings

PAGES TO CREATE (stub for now, full implementation in next iterations):
1. /login — login form
2. / (Dashboard) — placeholder with "Coming soon"
3. /po/new — placeholder
4. /po — placeholder
5. /products — placeholder
6. /settings — placeholder

DELIVERABLES:
- Functional auth flow (signup blocked unless email in allowed_users)
- All database tables created with correct schema
- Sidebar navigation works on desktop and mobile
- Dark mode toggle works and persists in localStorage
- All routes set up with placeholder pages

Don't implement page functionality yet — just foundation. Confirm everything works before next iteration.
```

**Test setelah prompt 1:**
- [ ] Login page muncul di `/login`
- [ ] Coba signup dengan email random → harus ditolak
- [ ] Login dengan `admin@kemikastore.com` (create user di Supabase dashboard dulu manual)
- [ ] Sidebar muncul, semua menu klikable (walau halamannya kosong)
- [ ] Dark mode toggle bekerja
- [ ] Buka di HP → responsive, sidebar jadi hamburger menu

---

## PROMPT 2 — MASTER PRODUCTS PAGE

**Tujuan:** Halaman manage master barang dengan import Excel.

```
Implement the "Master Barang" page at /products.

FEATURES:
1. TABLE VIEW:
   - Columns: Kode | Nama Produk | Kemasan | Harga | Disc % | Harga Net | Actions
   - Harga Net = harga × (1 - disc_percent), shown in italic gray
   - Search bar at top: filter by kode or nama_produk (case-insensitive, real-time)
   - Sortable by clicking column header
   - Pagination: 25 rows per page
   - Format harga as Indonesian Rupiah: "Rp 1.234.567"
   - Empty state: "Belum ada data barang. Import Excel atau tambah manual."

2. TOOLBAR (top right):
   - Button "Import dari Excel" (Upload icon)
   - Button "Tambah Barang" (Plus icon)
   - Button "Export Excel" (Download icon)

3. IMPORT EXCEL DIALOG:
   - Upload .xlsx file
   - Preview first 5 rows after upload
   - User confirms column mapping:
     * Kode → CODE / SKU
     * Nama Produk → PRODUK
     * Deskripsi → DESCRIPTION / SPECIFICATION
     * Kemasan → KEMASAN
     * Harga → PRICE KEMIKA
     * Disc % → % DISC KEMIKA (auto-convert "25%" to 0.25 if needed)
   - "Skip header row" checkbox (default checked)
   - Conflict resolution: if kode already exists, UPSERT (update existing row, don't duplicate)
   - Show import progress (e.g. "Imported 109 of 109 products")
   - Use `xlsx` library (SheetJS) for parsing
   - Validation: skip rows with empty kode or empty harga
   - Show summary at end: "X new, Y updated, Z skipped (reasons listed)"

4. ADD/EDIT DIALOG:
   - Form fields: Kode (required), Nama Produk (required), Deskripsi, Kemasan, Harga (required, numeric), Disc %
   - "Disc %" input shows as percentage (0-100), store as decimal in DB
   - Save button: insert/update + close dialog + refresh table
   - Validation: kode must be unique

5. DELETE:
   - Confirm dialog "Hapus barang [nama]? Tidak bisa dibatalkan."
   - Soft check: if barang ever used in any PO, show warning but allow delete (history kept via snapshot in po_items)

6. EXPORT EXCEL:
   - Download .xlsx with all products
   - Filename: "master_barang_YYYY-MM-DD.xlsx"
   - Columns same as import format

UI POLISH:
- Loading skeleton while fetching data
- Toast notifications for success/error (use shadcn/ui Sonner)
- Smooth dialog animations
- Keyboard shortcuts: Esc to close dialog, Enter to submit

Don't touch other pages yet. Test thoroughly before next iteration.
```

**Test setelah prompt 2:**
- [ ] Upload Excel master kamu — semua barang masuk
- [ ] Search bar bekerja real-time
- [ ] Add/Edit/Delete manual bekerja
- [ ] Export Excel hasilnya valid (buka di Microsoft Excel)
- [ ] Coba di HP — table scrollable horizontally

---

## PROMPT 3 — BUAT PO PAGE (CORE FEATURE)

**Tujuan:** Form bikin PO dengan auto-lookup, kalkulasi otomatis, dan auto-generate nomor.

```
Implement the "Buat PO" page at /po/new.

LAYOUT (single page form):

HEADER SECTION:
- Title: "Buat Purchase Order Baru"
- Auto-generated PO number display (read-only, large, prominent): "PO.20260516.01KS"
- PO date picker (default: today, format "DD MMMM YYYY" in Indonesian: "16 Mei 2026")
- Status badge (default "Draft" with gray color)

PO NUMBER LOGIC:
- Format: PO.YYYYMMDD.NNKS
- YYYYMMDD = tgl_po
- NN = count of POs with same tgl_po in `purchase_orders` table + 1, padded to 2 digits
- KS = static suffix
- Re-calculate whenever tgl_po changes
- Example: "PO.20260516.01KS", "PO.20260516.02KS", "PO.20260517.01KS"

ITEMS SECTION:
- Header: "Daftar Barang" + button "+ Tambah Barang"
- Empty state: "Belum ada barang. Klik 'Tambah Barang' untuk mulai."

EACH ITEM ROW:
- No (auto-incrementing, read-only)
- Kode (combobox/autocomplete with search from master_products)
  - User types kode OR nama_produk, dropdown shows matches
  - On select, auto-fill: nama_produk, kemasan, harga, disc_percent (read-only after fill, but editable on click)
- Nama Produk (read-only after autocomplete, shows in label style)
- Kemasan (read-only)
- Qty (numeric input, min 1, default 1)
- Harga (numeric, pre-filled, editable if user wants to override)
- Disc % (numeric 0-100, pre-filled, editable)
- Subtotal (calculated, read-only): qty × harga × (1 - disc_percent/100), format Rupiah
- Delete button (Trash icon) — remove this item

ADD ITEM BEHAVIOR:
- Click "+ Tambah Barang" → empty row added at bottom, focus on Kode field
- Keyboard: Enter in Qty field auto-creates new row

SUMMARY SECTION (right side or bottom):
- Box with calculated values:
  - Subtotal: sum of all item subtotals (format Rupiah)
  - PPN 11%: subtotal × 0.11
  - Grand Total: subtotal + PPN (bold, larger, green color)
- Updates live as items change

NOTES SECTION:
- Textarea "Catatan" (optional)
- Placeholder: "Misal: Restock bulanan untuk Tokopedia & Shopee"

ACTION BUTTONS (sticky bottom on mobile):
- "Simpan sebagai Draft" (secondary button) — save with status=draft, redirect to /po/[id]
- "Simpan & Generate PDF" (primary button) — save + open print preview
- "Batal" (ghost button) — confirm dialog if there are unsaved changes

VALIDATION (on submit):
- At least 1 item required
- Each item must have kode and qty > 0
- If validation fails: show inline errors + toast "Mohon perbaiki form"

SAVE LOGIC:
1. Validate
2. Generate no_po based on tgl_po
3. Insert into `purchase_orders` table (snapshot subtotal, ppn, grand_total)
4. Insert each item into `po_items` table (snapshot harga, disc_percent at time of save)
5. Show success toast: "PO [no_po] berhasil dibuat"
6. Redirect

EDGE CASES:
- If user changes tgl_po after adding items → re-generate no_po, show toast "Nomor PO diperbarui ke [new no_po]"
- If user closes browser mid-form → no autosave (form is volatile), but warn with browser dialog if unsaved changes
- If item kode no longer exists in master (deleted between page load and submit) → show error per item

UI POLISH:
- Item rows have subtle hover effect
- Smooth transitions when adding/removing items
- Combobox autocomplete uses fuzzy search (matches "mosquit" → BG-Mosquitaire)
- Mobile: each item row collapses to card view (label-value pairs vertical)

Don't implement PDF generation yet — just save + redirect for now. Next iteration handles PDF.
```

**Test setelah prompt 3:**
- [ ] Bikin PO baru, tambah 3 item dengan kode dari master
- [ ] Autocomplete bekerja (search by kode + by nama)
- [ ] Subtotal & Grand Total kalkulasi benar
- [ ] Save → muncul di list (cek Supabase dashboard)
- [ ] Nomor PO format benar dan auto-increment
- [ ] Ubah tanggal → nomor PO ter-update

---

## PROMPT 4 — PDF GENERATION & PRINT PREVIEW

**Tujuan:** Generate PDF profesional + preview sebelum download.

```
Implement PDF generation for Purchase Orders.

LIBRARIES:
- Use @react-pdf/renderer for high-quality PDF (better than jsPDF for complex layouts)
- OR use jsPDF + jspdf-autotable as alternative

PDF DESIGN (match the spec):

PAGE: A4 portrait, 14mm margins all sides

HEADER (top, full-width):
- Left: Logo block
  - Green square (56×56px, bg #1f6b3e) with bold white "K" inside
  - Next to it: "KEMIKA" (16pt bold, dark) + "ONLINE STORE" (8.5pt, green #1f6b3e, uppercase, letter-spacing 1.5px) below
- Right (aligned right):
  - "PURCHASE ORDER" (22pt bold, dark, letter-spacing 2px)
  - "Surat Pesanan" (8.5pt, gray, uppercase, letter-spacing 1.5px)
- Bottom border 2px solid dark, 14px padding-bottom, 18px margin-bottom

META INFO (two columns):
- Left column:
  - Label "DIAJUKAN KEPADA" (8pt, gray, uppercase)
  - Box with light gray bg (#f7f7f5), green left border 3px:
    - "KEMIKA" (12pt bold)
    - "PT. Kemika Karya Pratama" (9pt, gray)
- Right column:
  - Label "NOMOR PO" → value bold 12pt
  - Label "TANGGAL" → value 10.5pt

ITEMS TABLE:
- Full width
- Header row: dark background (#1a1a1a), white text, uppercase 8.5pt letter-spacing 0.8px
- Columns: No (center) | Kode | Nama Barang | Satuan (center) | Qty (center) | Harga (right) | Disc (center) | Subtotal (right)
- Body rows: 9.5pt, alternating row bg (white & #fafaf8)
- Kode shown in monospace font (Courier), 8.5pt, gray
- Nama Barang in bold dark
- Disc value in orange (#e8620f) bold, format "27%"
- Subtotal bold dark
- Format all numbers as Indonesian Rupiah ("Rp 1.234.567")
- Border-bottom 1px solid #e5e5e5 between rows

SUMMARY (right-aligned box, 280px wide):
- 3 rows in a bordered box (#e5e5e5):
  - Subtotal | Rp X.XXX.XXX (gray label, dark value)
  - PPN 11% | Rp X.XXX.XXX
  - Grand Total | Rp X.XXX.XXX (in green bg #1f6b3e, white text, bold, 11pt)

NOTES BLOCK:
- Light bg (#f7f7f5), border-radius 4px, padding 10px 14px
- Label "CATATAN" (8pt gray uppercase)
- Content (9pt) — show "—" if catatan empty

SIGNATURES (two columns at bottom, 28px top margin):
- Column 1: "Tgl: [tgl_po]" (8pt gray) → 50px space → "Pemohon" (9pt bold) → underline → "Kemika Online Store" (9pt)
- Column 2: "Tgl: ____________" (placeholder for manual fill) → "Mengetahui" → "PT. Kemika Karya Pratama"

FOOTER:
- Top border 1px #e5e5e5, 24px margin-top
- Left: "Dokumen ini diterbitkan oleh Kemika Online Store" (orange #e8620f bold for "Kemika Online Store")
- Right: PO number
- 7.5pt gray text

PRINT PREVIEW PAGE (new route /po/[id]/preview):
- Toolbar at top:
  - "← Kembali" button
  - "Print" button → opens browser print dialog
  - "Download PDF" button → triggers download
  - "Status: [badge]" → dropdown to change status
- Below toolbar: PDF preview rendered in iframe or PDFViewer component
- Mobile: stack toolbar buttons vertically, full-width

ALSO ADD: ability to generate Surat Jalan Sementara
- Same data, different template:
  - Title "SURAT JALAN" + subtitle "SEMENTARA" (orange)
  - Banner at top: "DOKUMEN SEMENTARA — Mengacu pada Purchase Order [no_po]" (dashed orange border, orange bg #fff7ef)
  - "DIKIRIM KEPADA" → KEMIKA Online Store, "Stok Penjualan Marketplace"
  - "REFERENSI PO" → no_po
  - Table columns: No | Kode | Nama Barang | Satuan | Qty (NO harga, NO disc, NO subtotal)
  - Signatures: "Pengirim" (PT. Kemika Karya Pratama) | "Penerima" (Kemika Online Store)
- Add button "Generate Surat Jalan" on preview page

FILENAME ON DOWNLOAD:
- PO: "PO.20260516.01KS.pdf"
- SJ: "SJ-PO.20260516.01KS.pdf"
```

**Test setelah prompt 4:**
- [ ] Generate PDF dari PO yang sudah dibuat → layout sesuai
- [ ] Print preview muncul, tampil sesuai
- [ ] Download PDF → buka di Acrobat/browser → terbaca rapi
- [ ] Generate Surat Jalan → kolom harga tidak muncul, ada banner sementara
- [ ] Test di HP — preview tetap readable

---

## PROMPT 5 — RIWAYAT PO (LIST & FILTER)

**Tujuan:** Halaman list semua PO dengan filter, search, edit, export.

```
Implement the "Riwayat PO" page at /po.

LAYOUT:

TOOLBAR (top):
- Search bar (left): search by no_po, catatan, or nama_produk in items
- Filter dropdown:
  - Status (multi-select): Draft, Terkirim, Diproses, Diterima, Ditagih, Lunas, Dibatalkan
  - Date range picker: "Dari tanggal" + "Sampai tanggal"
  - "Reset filter" button
- Action buttons (right):
  - "+ Buat PO Baru" → /po/new
  - "Export Excel" → download all filtered POs as .xlsx

TABLE:
- Columns: No PO | Tanggal | Items (count) | Grand Total | Status | Actions
- Sortable by clicking header
- Status as colored badge:
  - Draft → gray
  - Terkirim → blue
  - Diproses → yellow
  - Diterima → light green
  - Ditagih → orange
  - Lunas → dark green
  - Dibatalkan → red
- Actions per row (dropdown menu, three-dot icon):
  - "Lihat detail" → /po/[id]
  - "Edit" → /po/[id]/edit
  - "Generate PDF" → /po/[id]/preview
  - "Duplicate" → /po/new with prefilled items
  - "Ubah status" → inline dropdown
  - "Hapus" → confirm dialog
- Pagination: 20 rows per page
- Empty state: "Belum ada PO. Buat PO pertama Anda." with button

PO DETAIL PAGE (/po/[id]):
- Header: No PO + status badge + action buttons (Edit, Generate PDF, Duplicate, Delete)
- Meta: Tanggal, dibuat oleh, created_at, updated_at
- Items table (read-only)
- Summary box (subtotal, PPN, grand total)
- Notes section
- Status timeline (visual): show progression Draft → Terkirim → Diproses → Diterima → Ditagih → Lunas
  - Use Lucide icons + connecting line
  - Current status highlighted

EDIT PO PAGE (/po/[id]/edit):
- Same form as /po/new but pre-filled
- Heading: "Edit PO [no_po]"
- WARNING banner if status is not 'draft': "PO ini sudah [status]. Yakin mau edit?"
- Save button: "Update PO"
- Cancel button → /po/[id]

EXPORT EXCEL:
- Filename: "Riwayat_PO_YYYY-MM-DD.xlsx"
- Sheet 1 "PO Header": No PO, Tgl, Status, Subtotal, PPN, Grand Total, Catatan, Items Count, Created At
- Sheet 2 "PO Items": No PO, No Item, Kode, Nama Produk, Kemasan, Qty, Harga, Disc%, Disc Rp, Subtotal
- Use SheetJS (xlsx library)
- Respects current filters (only export what's visible)

MOBILE VIEW:
- Table converts to card list
- Each card shows: No PO (large) + status badge + tgl + grand total + action menu

KEYBOARD:
- "/" focuses search bar
- "n" creates new PO (only if not focused in input)
```

**Test setelah prompt 5:**
- [ ] List PO muncul semua
- [ ] Filter status bekerja
- [ ] Search bekerja
- [ ] Edit PO → ubah qty → save → kalkulasi update
- [ ] Status ubah → badge berubah warna
- [ ] Duplicate PO → form pre-filled dengan item sama
- [ ] Export Excel → hasil bisa dibuka, dua sheet, data benar

---

## PROMPT 6 — DASHBOARD

**Tujuan:** Halaman utama dengan metric & visualisasi.

```
Implement the Dashboard page at /.

LAYOUT (grid, responsive):

ROW 1 — STAT CARDS (4 cards):
1. "PO Bulan Ini"
   - Count of POs with tgl_po in current month
   - Big number + subtext "+ X dibanding bulan lalu" (delta with arrow icon)
2. "Total Belanja Bulan Ini"
   - Sum of grand_total for current month POs
   - Format Rupiah, big bold
   - Subtext: "% change vs last month"
3. "Status Pending"
   - Count of POs with status NOT IN ('lunas', 'dibatalkan')
   - Subtext: "Yang masih perlu di-follow up"
4. "Total Tagihan Belum Lunas"
   - Sum of grand_total where status = 'ditagih'
   - Format Rupiah
   - Red color if > 0

ROW 2 — CHARTS:
- Left (2/3 width): Bar chart "PO per Bulan" (last 6 months)
  - X-axis: bulan
  - Y-axis: count + secondary axis for total nilai
  - Use Recharts library
- Right (1/3 width): Pie chart "Status Distribution"
  - All current POs by status
  - Color-coded same as badges

ROW 3 — TABLES:

Left: "Top 5 Barang Bulan Ini"
- Columns: Nama Produk | Total Qty | Total Nilai
- Sort by Total Nilai desc
- Show only current month

Right: "PO Terbaru" (last 5)
- Columns: No PO | Tgl | Grand Total | Status
- Click row → /po/[id]
- Link "Lihat semua →" at bottom

ROW 4 — ALERT/REMINDERS (if any):
- Card with WARNING style if there are POs older than 14 days with status 'terkirim' (belum diterima)
- Card with INFO style if any PO has status 'ditagih' for more than 7 days

INTERACTIVITY:
- All numbers tap-to-drill-down: click count → goes to filtered /po
- Charts hoverable with tooltip
- Date range selector at top: "Bulan ini" / "Minggu ini" / "30 hari terakhir" / "Custom"
- Refresh button (manual refresh data)

VISUAL STYLE:
- Cards have subtle shadow, rounded corners
- Numbers use tabular-nums font feature
- Loading skeleton when data fetching
- Empty state if no data yet: "Buat PO pertama Anda untuk melihat statistik."

MOBILE:
- Stat cards stack vertically
- Charts full width
- Tables become cards
```

**Test setelah prompt 6:**
- [ ] Bikin 5-10 PO dummy dengan status berbeda
- [ ] Dashboard menampilkan angka yang benar
- [ ] Click stat card → ke /po dengan filter
- [ ] Chart bekerja & responsive
- [ ] Test di HP

---

## PROMPT 7 — SETTINGS PAGE

**Tujuan:** Halaman pengaturan untuk manage allowed users, profile, dll.

```
Implement the Settings page at /settings.

TABS (top of page):
1. "Profil" — current user profile
2. "Tim" — manage allowed users (admin only)
3. "Preferensi" — UI preferences

TAB 1 — PROFIL:
- Email (read-only)
- Display name (editable)
- Change password button → opens dialog
  - Old password + new password + confirm new password
  - Validation: min 8 chars, must contain number
- Last login info

TAB 2 — TIM (admin role only, redirect if not admin):
- Table of allowed_users:
  - Email | Role | Created At | Actions (delete)
- Button "Tambah Anggota"
  - Dialog: email + role dropdown (admin/staff)
  - On submit: insert to allowed_users
  - Send invitation? (skip for now — they signup manually)
- Can't delete yourself
- Last admin can't be deleted (show error)

TAB 3 — PREFERENSI:
- Theme: Light / Dark / System (default System)
- Default PPN rate (numeric, default 11%) — saved in localStorage or user_preferences table
- Default catatan template (textarea) — saved in user_preferences

INFO BANNER (bottom):
- App version
- Build date
- Link to documentation (placeholder for now)
```

**Test setelah prompt 7:**
- [ ] Tambah anggota baru di Tim
- [ ] Logout, signup pakai email baru tersebut → harus bisa
- [ ] Logout lagi, signup pakai email tidak diallow → ditolak
- [ ] Change password bekerja
- [ ] Preferensi tersimpan setelah refresh

---

## PROMPT 8 — POLISH & DEPLOYMENT

**Tujuan:** Final touches sebelum deploy.

```
Final polish pass:

1. PERFORMANCE:
   - Add loading states everywhere (skeleton screens)
   - Lazy load routes
   - Debounce search inputs (300ms)
   - Optimize images
   - Add React Query for caching (or SWR)

2. ERROR HANDLING:
   - Global error boundary
   - Friendly error pages for 404, 500
   - Toast for network errors with retry button
   - Validation errors inline + summarized in toast

3. ACCESSIBILITY:
   - All buttons have aria-labels
   - Form fields have labels
   - Keyboard navigation works everywhere
   - Color contrast WCAG AA compliant
   - Focus indicators visible

4. UI POLISH:
   - Smooth page transitions
   - Hover states on all clickable elements
   - Consistent spacing (use Tailwind spacing scale strictly)
   - Empty states have helpful illustrations or icons
   - Long text truncates with ellipsis + tooltip on hover

5. INDONESIAN POLISH:
   - All text reviewed for natural Indonesian (no awkward translations)
   - Date format: "16 Mei 2026" (not "May 16, 2026")
   - Numbers: "Rp 1.234.567" (Indonesian format with dots as thousand separator)
   - Validation messages friendly: "Mohon isi nama barang" (not "Name is required")

6. MOBILE FINAL CHECK:
   - All pages tested on 375px width (iPhone SE size)
   - Touch targets min 44×44px
   - No horizontal scroll
   - Bottom action buttons accessible (above mobile keyboard)

7. PWA (optional but nice):
   - Add manifest.json
   - App icon (use the green K logo)
   - Installable to home screen
   - Service worker for offline shell

8. DEPLOYMENT PREP:
   - Set up environment variables in Lovable
   - Verify Supabase RLS policies are correct
   - Test signup flow with fresh account
   - Generate sample data for demo (5 dummy POs)

Run a final audit and list any remaining issues.
```

**Test final:**
- [ ] Full workflow end-to-end: login → buat PO → preview PDF → ubah status → export Excel
- [ ] Mobile workflow sama
- [ ] Dark mode di semua halaman
- [ ] Tidak ada console error
- [ ] Loading states muncul saat lambat

---

## 🐛 BUG FIX PROMPTS (template)

Kalau ada bug, pakai template ini:

```
There's a bug in [page name]:

WHAT I DID:
1. [step 1]
2. [step 2]

WHAT I EXPECTED:
[expected behavior]

WHAT HAPPENED:
[actual behavior, include error message if any]

SCREENSHOT/ERROR:
[paste error or describe]

Please fix this without breaking other features. Add error handling so it doesn't happen again.
```

---

## 🚀 DEPLOYMENT (PROMPT TERAKHIR)

Setelah semua test pass:

```
The app is ready for deployment.

1. Verify all environment variables are set in Lovable's deployment settings:
   - Supabase URL
   - Supabase anon key

2. Publish to lovable.app subdomain.

3. Provide me:
   - Production URL
   - List of any environment vars I need to keep secret
   - Steps to point custom domain (kemikastore.com) to this app later

4. Generate a "Cara Pakai" guide as a markdown file inside the app docs.
```

---

## 📋 CHECKLIST KESELURUHAN

Setelah app selesai, verifikasi:

- [ ] Auth: signup blocked unless email in allowlist
- [ ] Master barang: import Excel + manual CRUD
- [ ] Buat PO: nomor auto, item autocomplete, kalkulasi otomatis
- [ ] PDF: PO + Surat Jalan generate dengan layout benar
- [ ] Riwayat: list, filter, search, edit, duplicate, export Excel
- [ ] Dashboard: 4 stat cards, charts, top barang, PO terbaru
- [ ] Settings: profile, team, preferences
- [ ] Dark mode bekerja di semua halaman
- [ ] Mobile responsive di semua halaman
- [ ] Tidak ada console error
- [ ] Performance: load time <3 detik

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pokemistore.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1501a4fc-9ceb-4bb0-bbcc-9f30260fb2b7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
