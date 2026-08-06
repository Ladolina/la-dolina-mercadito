import React, { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ---- Brand tokens (from La Dolina identidade visual) ----------------------
const T = {
  void: "#191716",
  surface: "#232019",
  cream: "#DAC89B",
  gold: "#A9821F",
  terracotta: "#C1581E",
  terracottaSoft: "rgba(193,88,30,0.14)",
  blue: "#21458F",
  teal: "#48A8AE",
  muted: "#8F8370",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Amarante&family=Open+Sans:wght@400;500;600;700&display=swap');
`;

const WHATSAPP_NUMBER = "5527992746410";

// ---- Supabase (banco de dados real) ----------------------------------------
const SUPABASE_URL = "https://xkahywvqbovlwbghxvwa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrYWh5d3ZxYm92bHdiZ2h4dndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTUzMzQsImV4cCI6MjEwMTU5MTMzNH0.JmhjNg1zXvm3c0BfEfRfPK3FB4M_JYkjQVNzIyKwVXY";

// Cliente mínimo via fetch — funciona em qualquer lugar (preview do Claude ou site publicado),
// sem depender de instalar a biblioteca @supabase/supabase-js.
const sb = {
  async request(path, { method = "GET", body, token, prefer } = {}) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${SUPABASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Supabase ${method} ${path} falhou: ${errText}`);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },
  select(table, query = "") {
    return sb.request(`/rest/v1/${table}?select=*${query}`);
  },
  insert(table, rows, token) {
    return sb.request(`/rest/v1/${table}`, { method: "POST", body: rows, token, prefer: "return=representation" });
  },
  update(table, id, patch, token, idCol = "id") {
    return sb.request(`/rest/v1/${table}?${idCol}=eq.${id}`, { method: "PATCH", body: patch, token, prefer: "return=representation" });
  },
  delete(table, id, token, idCol = "id") {
    return sb.request(`/rest/v1/${table}?${idCol}=eq.${id}`, { method: "DELETE", token });
  },
  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || "Login inválido");
    return data; // { access_token, refresh_token, user, ... }
  },
};

// ---- Mapeamento colunas do banco (snake_case) <-> objetos do app (camelCase) --
const dbToProduct = (r) => ({ id: r.id, name: r.name, cut: r.cut, cat: r.cat, unit: r.unit, price: Number(r.price), oldPrice: r.old_price != null ? Number(r.old_price) : null, avgWeight: r.avg_weight != null ? Number(r.avg_weight) : null, tag: r.tag, photo: r.photo });
const productToDb = (p) => ({ name: p.name, cut: p.cut, cat: p.cat, unit: p.unit, price: p.price, old_price: p.oldPrice, avg_weight: p.avgWeight, tag: p.tag, photo: p.photo });

const dbToCustomer = (r) => ({ id: r.id, name: r.name, phone: r.phone, birthday: r.birthday, address: r.address, cep: r.cep, clubMember: r.club_member, cashbackBalance: Number(r.cashback_balance || 0), orders: [] });
const customerToDb = (c) => ({ name: c.name, phone: c.phone, birthday: c.birthday || null, address: c.address, cep: c.cep, club_member: c.clubMember, cashback_balance: c.cashbackBalance });

const dbToOrder = (r) => ({ id: r.id, customerId: r.customer_id, date: r.created_at, items: r.items, subtotal: Number(r.subtotal), cashbackUsed: Number(r.cashback_used || 0), cashbackEarned: Number(r.cashback_earned || 0), total: Number(r.total), mode: r.mode, address: r.address, deliveryStatus: r.delivery_status, km: r.km, deliveryFee: r.delivery_fee, status: r.status || "pendente" });
const orderToDb = (o, customerId) => ({ customer_id: customerId, items: o.items, subtotal: o.subtotal, cashback_used: o.cashbackUsed, cashback_earned: o.cashbackEarned, total: o.total, mode: o.mode, address: o.address, delivery_status: o.deliveryStatus, km: o.km, delivery_fee: o.deliveryFee, status: o.status });

const dbToSettings = (r) => ({ cashbackPercent: Number(r.cashback_percent), deliveryBase: { address: r.delivery_base_address, cep: r.delivery_base_cep }, deliveryTiers: r.delivery_tiers });
const settingsToDb = (s) => ({ cashback_percent: s.cashbackPercent, delivery_base_address: s.deliveryBase.address, delivery_base_cep: s.deliveryBase.cep, delivery_tiers: s.deliveryTiers });

const dbToCustomDate = (r) => ({ id: r.id, title: r.title, category: r.category, startDate: r.start_date, endDate: r.end_date, note: r.note });
const customDateToDb = (c) => ({ title: c.title, category: c.category, start_date: c.startDate, end_date: c.endDate || null, note: c.note });

const DEFAULT_SETTINGS = {
  cashbackPercent: 5,
  deliveryBase: {
    address: "Rua Rosendo Serapião de Souza Filho, 696 — República, Vitória/ES",
    cep: "29070-170",
  },
  deliveryTiers: [
    { km: 1, fee: 6 },
    { km: 2, fee: 10 },
    { km: 3, fee: 12 },
    { km: 4, fee: 15 },
  ],
};

// ---- Special dates: date math + recurring rule resolver -------------------
// Easter Sunday (Anonymous Gregorian algorithm) — needed to compute Carnaval, which moves every year.
const computeEaster = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};
const nthWeekdayOfMonth = (year, month, weekday, n) => {
  const first = new Date(year, month - 1, 1);
  const offset = (7 + weekday - first.getDay()) % 7;
  return new Date(year, month - 1, 1 + offset + (n - 1) * 7);
};
const lastWeekdayOfMonth = (year, month, weekday) => {
  const lastDay = new Date(year, month, 0).getDate();
  const last = new Date(year, month - 1, lastDay);
  const diff = (7 + last.getDay() - weekday) % 7;
  return new Date(year, month - 1, lastDay - diff);
};
const computeForYear = (rule, year) => {
  if (rule.kind === "fixed") return new Date(year, rule.month - 1, rule.day);
  if (rule.kind === "nthWeekday") return nthWeekdayOfMonth(year, rule.month, rule.weekday, rule.n);
  if (rule.kind === "lastWeekday") return lastWeekdayOfMonth(year, rule.month, rule.weekday);
  if (rule.kind === "easterOffset") {
    const e = computeEaster(year);
    const d = new Date(e);
    d.setDate(d.getDate() + rule.offsetDays);
    return d;
  }
  return null;
};
// Returns the next occurrence of a recurring rule-based date on or after `ref`.
const nextOccurrence = (rule, ref) => {
  const refMid = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let d = computeForYear(rule, refMid.getFullYear());
  if (d < refMid) d = computeForYear(rule, refMid.getFullYear() + 1);
  return d;
};
const daysUntil = (date, ref) => {
  const refMid = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((date - refMid) / 86400000);
};
const fmtDateLong = (date) => date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

// Delivery: fee lookup from configurable tiers, and Google Maps link builders (no paid routing API needed).
const feeForKm = (km, tiers) => {
  if (!km || km <= 0) return null;
  const sorted = [...tiers].sort((a, b) => a.km - b.km);
  const tier = sorted.find((t) => km <= t.km);
  return tier ? tier.fee : null; // beyond the last configured tier: fee "a combinar"
};
const gmapsSingle = (baseAddress, destAddress) =>
  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(baseAddress)}&destination=${encodeURIComponent(destAddress)}&travelmode=driving`;
const gmapsRoute = (baseAddress, stopsAddresses) => {
  const last = stopsAddresses[stopsAddresses.length - 1];
  const waypoints = stopsAddresses.slice(0, -1);
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(baseAddress)}&destination=${encodeURIComponent(last)}&travelmode=driving`;
  return waypoints.length ? `${url}&waypoints=${waypoints.map(encodeURIComponent).join("|")}` : url;
};

// Built-in commemorative calendar — recomputed live every year, never goes stale.
const SEED_SPECIAL_DATES = [
  { id: "consumidor", title: "Dia do Consumidor", category: "comemorativa", rule: { kind: "fixed", month: 3, day: 15 }, note: "Boa data para oferta relâmpago e cashback em dobro no Clube." },
  { id: "maes", title: "Dia das Mães", category: "comemorativa", rule: { kind: "nthWeekday", month: 5, weekday: 0, n: 2 }, note: "Alta procura por vinhos e cortes nobres — reforce estoque de picanha e espumante." },
  { id: "namorados", title: "Dia dos Namorados", category: "comemorativa", rule: { kind: "fixed", month: 6, day: 12 }, note: "Kit jantar a dois: vinho + corte nobre + molho da casa." },
  { id: "saojoao", title: "São João / Festa Junina", category: "comemorativa", rule: { kind: "fixed", month: 6, day: 24 }, note: "Linguiça, milho e vinho quente vendem bem nessa época." },
  { id: "pais", title: "Dia dos Pais", category: "comemorativa", rule: { kind: "nthWeekday", month: 8, weekday: 0, n: 2 }, note: "Foco em churrasco — combos de carne para grelha e cerveja/chopp." },
  { id: "independencia", title: "Feriado 7 de Setembro", category: "comemorativa", rule: { kind: "fixed", month: 9, day: 7 }, note: "Feriado prolongado costuma puxar churrasco em família." },
  { id: "diadocliente", title: "Dia do Cliente", category: "comemorativa", rule: { kind: "fixed", month: 9, day: 15 }, note: "Ótimo gancho pra campanha de fidelização e cashback extra no Clube." },
  { id: "criancas", title: "Dia das Crianças", category: "comemorativa", rule: { kind: "fixed", month: 10, day: 12 }, note: "Feriado família reunida — reforce combos e delivery." },
  { id: "blackfriday", title: "Black Friday", category: "comemorativa", rule: { kind: "lastWeekday", month: 11, weekday: 5 }, note: "Planeje ofertas de vinho e mercearia com pelo menos 2 semanas de antecedência." },
  { id: "natal", title: "Natal", category: "comemorativa", rule: { kind: "fixed", month: 12, day: 25 }, note: "Pico de vendas de cortes nobres e vinhos — reserve estoque com 2 semanas de antecedência." },
  { id: "anonovo", title: "Ano Novo", category: "comemorativa", rule: { kind: "fixed", month: 1, day: 1 }, note: "Espumantes e lombo/pernil para a ceia." },
  { id: "carnaval", title: "Carnaval", category: "comemorativa", rule: { kind: "easterOffset", offsetDays: -47 }, note: "Movimento de bairro costuma cair — considere reforçar delivery ou ajustar horário." },
];

// Editable examples — jogos e eventos locais não têm como ser puxados automaticamente aqui,
// então isso é um ponto de partida: cadastre manualmente conforme a agenda for saindo.
const DEFAULT_CUSTOM_DATES = [
  {
    id: 1,
    title: "Copa do Mundo 2026",
    category: "jogo",
    startDate: "2026-06-11",
    endDate: "2026-07-19",
    note: "Nos dias de jogo do Brasil, reforce estoque de carvão, linguiça, espetinho, chopp e gelo — considere abrir mais cedo.",
  },
];

const SEED_CATEGORIES = [
  { id: "bovinos", label: "Bovinos" },
  { id: "suinos", label: "Suínos" },
  { id: "aves", label: "Aves" },
  { id: "molhos", label: "Molhos & Temperos" },
  { id: "vinhos", label: "Vinhos" },
  { id: "mercearia", label: "Mercearia" },
];

const SEED_PRODUCTS = [
  { id: 1, name: "Picanha Angus", cut: "Bovino · Peça inteira", price: 79.9, oldPrice: 94.9, unit: "kg", avgWeight: 1.3, tag: "OFERTA", cat: "bovinos", photo: null },
  { id: 2, name: "Costela Ripa", cut: "Bovino · Para churrasco", price: 34.9, oldPrice: null, unit: "kg", avgWeight: 2.5, tag: null, cat: "bovinos", photo: null },
  { id: 3, name: "Fraldinha", cut: "Bovino · Limpa", price: 42.5, oldPrice: 49.9, unit: "kg", avgWeight: 1.0, tag: "OFERTA", cat: "bovinos", photo: null },
  { id: 4, name: "Pernil Suíno", cut: "Suíno · Sem osso", price: 24.9, oldPrice: null, unit: "kg", avgWeight: 3.0, tag: null, cat: "suinos", photo: null },
  { id: 5, name: "Linguiça Toscana", cut: "Suíno · Artesanal", price: 28.9, oldPrice: 32.9, unit: "kg", avgWeight: 0.5, tag: "OFERTA", cat: "suinos", photo: null },
  { id: 6, name: "Frango Caipira", cut: "Ave · Inteiro", price: 18.9, oldPrice: null, unit: "kg", avgWeight: 1.8, tag: null, cat: "aves", photo: null },
  { id: 7, name: "Chimichurri da Casa", cut: "Molho artesanal 200ml", price: 16.9, oldPrice: null, unit: "un", avgWeight: null, tag: null, cat: "molhos", photo: null },
  { id: 8, name: "Malbec Reserva", cut: "Vinho argentino 750ml", price: 59.9, oldPrice: 69.9, unit: "un", avgWeight: null, tag: "OFERTA", cat: "vinhos", photo: null },
];

const SEED_CUSTOMERS = [
  {
    id: 1,
    name: "Marina Alves",
    phone: "27999998888",
    birthday: "1990-05-14",
    address: "Rua Chapecó, 45 — Jardim da Penha, Vitória/ES",
    cep: "29060-060",
    clubMember: true,
    cashbackBalance: 12.5,
    orders: [
      {
        id: "seed-1",
        date: "2026-07-01T19:20:00",
        items: [{ name: "Picanha Angus", qty: 1.5, unit: "kg" }],
        subtotal: 119.85,
        cashbackUsed: 0,
        cashbackEarned: 5.99,
        total: 119.85,
        mode: "retirada",
        address: null,
        deliveryStatus: null,
        km: null,
        deliveryFee: null,
        status: "concluido",
      },
    ],
  },
];

const fmt = (n) => `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;
const fmtKg = (kg) => (kg < 1 ? `${Math.round(kg * 1000)}g` : `${kg.toFixed(2).replace(/0$/, "").replace(/\.$/, "").replace(".", ",")}kg`);
const lineTotal = (p, qty) => p.price * qty;
const stepFor = (p) => (p.unit === "kg" ? 0.5 : 1);
const defaultQtyFor = () => 1;
const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const emptyDraft = (defaultCat) => ({
  id: null,
  name: "",
  cut: "",
  cat: defaultCat,
  unit: "kg",
  price: "",
  oldPrice: "",
  avgWeight: "",
  tag: "",
  photo: null,
});

const emptyCustomerDraft = () => ({
  id: null,
  name: "",
  phone: "",
  birthday: "",
  address: "",
  cep: "",
  clubMember: false,
  cashbackBalance: 0,
  orders: [],
});

const emptyEventDraft = () => ({
  id: null,
  title: "",
  category: "evento",
  startDate: "",
  endDate: "",
  note: "",
});

const DATE_CATEGORY_LABELS = { comemorativa: "Comemorativa", jogo: "Jogo", evento: "Evento local", personalizado: "Personalizado" };
const DATE_CATEGORY_COLORS = { comemorativa: T.gold, jogo: T.terracotta, evento: T.blue, personalizado: T.teal };

const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const fmtPhone = (phone) => {
  const d = onlyDigits(phone);
  if (d.length < 10) return phone || "";
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  return rest.length === 9 ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}` : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
};
const fmtDateBR = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const fmtBirthdayShort = (iso) => {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
const isBirthdaySoon = (iso, daysWindow = 14) => {
  if (!iso) return false;
  const [, m, d] = iso.split("-").map(Number);
  const today = new Date();
  const thisYear = new Date(today.getFullYear(), m - 1, d);
  let diff = (thisYear - today) / 86400000;
  if (diff < -1) diff += 365;
  return diff >= 0 && diff <= daysWindow;
};

// ---- Signature elements ----------------------------------------------------
function SunIcon({ size = 40, color = T.gold }) {
  const rays = Array.from({ length: 24 });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {rays.map((_, i) => {
        const angle = (i * 360) / rays.length;
        const rad = (angle * Math.PI) / 180;
        const x1 = 50 + Math.cos(rad) * 24;
        const y1 = 50 + Math.sin(rad) * 24;
        const x2 = 50 + Math.cos(rad) * 46;
        const y2 = 50 + Math.sin(rad) * 46;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" strokeLinecap="round" />;
      })}
      <circle cx="50" cy="50" r="22" fill={color} />
      <path d="M38 44 Q41 39 44 44" stroke={T.void} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M56 44 Q59 39 62 44" stroke={T.void} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="41" cy="49" r="1.6" fill={T.void} />
      <circle cx="59" cy="49" r="1.6" fill={T.void} />
      <path d="M46 55 Q50 58 54 55" stroke={T.void} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M45 62 Q50 65 55 62" stroke={T.void} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Postmark({ size = 168 }) {
  const id = "postmarkPath";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <path id={id} d="M 100,100 m -70,0 a 70,70 0 1,1 140,0 a 70,70 0 1,1 -140,0" />
      </defs>
      <circle cx="100" cy="100" r="92" stroke={T.cream} strokeWidth="1.5" fill="none" opacity="0.55" />
      <circle cx="100" cy="100" r="78" stroke={T.cream} strokeWidth="1" fill="none" opacity="0.4" />
      <text fill={T.cream} fontFamily="'Open Sans', sans-serif" fontSize="11.5" letterSpacing="3" fontWeight="600">
        <textPath href={`#${id}`} startOffset="2%">
          MERCADITO · LA DOLINA ·
        </textPath>
      </text>
      <g transform="translate(60,60)">
        <SunIcon size={80} color={T.gold} />
      </g>
    </svg>
  );
}

function StampBadge({ label = "OFERTA" }) {
  return (
    <div style={{ border: `1.5px dashed ${T.terracotta}`, color: T.terracotta, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 10.5, letterSpacing: "0.08em", padding: "3px 9px", borderRadius: 999, background: "rgba(193,88,30,0.08)" }}>
      {label}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "rgba(218,200,155,0.06)",
  border: "1px solid rgba(218,200,155,0.2)",
  borderRadius: 8,
  padding: "10px 12px",
  color: T.cream,
  fontFamily: "'Open Sans', sans-serif",
  fontSize: 13.5,
  outline: "none",
};

/* ============================================================
   LOJA (storefront)
   ============================================================ */

function ProductCard({ p, qty, onAdd }) {
  const [justAdded, setJustAdded] = useState(false);
  return (
    <div style={{ background: T.cream, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10, border: "1px solid rgba(25,23,22,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: p.photo ? `url(${p.photo}) center/cover` : T.terracottaSoft, display: "flex", alignItems: "center", justifyContent: "center", color: T.terracotta, fontFamily: "'Amarante', serif", fontSize: 18 }}>
          {!p.photo && p.name.charAt(0)}
        </div>
        {p.tag && <StampBadge label={p.tag} />}
      </div>

      <div>
        <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 16.5, color: T.void, lineHeight: 1.25 }}>{p.name}</div>
        <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11, letterSpacing: "0.04em", color: "rgba(25,23,22,0.55)", marginTop: 3, textTransform: "uppercase" }}>{p.cut}</div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
        <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 19, color: T.gold, fontWeight: 700 }}>{fmt(p.price)}</span>
        <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12, color: "rgba(25,23,22,0.5)" }}>/{p.unit}</span>
        {p.oldPrice && <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12, color: "rgba(25,23,22,0.45)", textDecoration: "line-through" }}>{fmt(p.oldPrice)}</span>}
      </div>
      {p.unit === "kg" && p.avgWeight ? (
        <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11, color: "rgba(25,23,22,0.55)", marginTop: -4 }}>
          Peça média ~{fmtKg(p.avgWeight)} <span style={{ opacity: 0.75 }}>(peso real pode variar)</span>
        </div>
      ) : null}

      <button
        onClick={() => {
          onAdd(p);
          setJustAdded(true);
          setTimeout(() => setJustAdded(false), 900);
        }}
        style={{
          marginTop: 6,
          background: qty > 0 ? T.terracotta : "transparent",
          color: qty > 0 ? T.cream : T.terracotta,
          border: `1.5px solid ${T.terracotta}`,
          borderRadius: 8,
          padding: "9px 14px",
          fontFamily: "'Open Sans', sans-serif",
          fontWeight: 700,
          fontSize: 12.5,
          cursor: "pointer",
          transition: "all .15s",
        }}
      >
        {justAdded ? "Adicionado ✓" : qty > 0 ? `${p.unit === "kg" ? fmtKg(qty) : `${qty} unidade${qty === 1 ? "" : "s"}`} no carrinho` : "Adicionar · Clique 1"}
      </button>
    </div>
  );
}

function StepLabel({ n, active, done, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? T.teal : active ? T.terracotta : "rgba(218,200,155,0.15)", color: done || active ? T.void : T.muted, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Open Sans', sans-serif", flexShrink: 0 }}>
        {done ? "✓" : n}
      </div>
      <span style={{ fontSize: 12.5, fontFamily: "'Open Sans', sans-serif", fontWeight: 600, color: active || done ? T.cream : T.muted }}>{label}</span>
    </div>
  );
}

function CartDrawer({ open, onClose, cart, products, onQtyChange, delivery, setDelivery, payment, setPayment, customer, setCustomer, matchedCustomer, cashbackAvailable, useCashback, setUseCashback, cashbackApplied, total, cashbackEarned, cashbackPercent, onFinalize, confirmed, orderText, finalizing, finalizeError }) {
  if (!open) return null;
  const items = products.filter((p) => cart[p.id] > 0).map((p) => ({ ...p, qty: cart[p.id] }));
  const subtotal = items.reduce((s, i) => s + lineTotal(i, i.qty), 0);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
      <div style={{ position: "relative", width: "min(420px, 100%)", height: "100%", background: T.void, borderLeft: `1px solid rgba(218,200,155,0.15)`, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Amarante', serif", fontSize: 21, color: T.cream }}>{confirmed ? "Pedido enviado" : "Seu carrinho"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        {confirmed ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center", marginTop: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: T.void }}>✓</div>
            <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontSize: 14, lineHeight: 1.6 }}>
              Pedido pronto para enviar via WhatsApp. Toque no botão abaixo — a mensagem já vem
              preenchida com os itens, a entrega e a forma de pagamento.
            </div>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(orderText)}`} target="_blank" rel="noreferrer" style={{ background: "#25D366", color: "#0B3D22", textDecoration: "none", borderRadius: 10, padding: "13px 22px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14, width: "100%" }}>
              Abrir WhatsApp e confirmar
            </a>
            <button onClick={onClose} style={{ background: "none", border: `1px solid rgba(218,200,155,0.25)`, color: T.muted, borderRadius: 10, padding: "11px 22px", fontFamily: "'Open Sans', sans-serif", fontSize: 13, cursor: "pointer", width: "100%" }}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid rgba(218,200,155,0.12)` }}>
              <StepLabel n={1} done label="Adicionar produtos" />
              <StepLabel n={2} done label="Abrir carrinho" />
              <StepLabel n={3} active label="Escolher entrega e pagamento" />
              <StepLabel n={4} label="Finalizar pedido" />
            </div>

            {items.length === 0 ? (
              <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 13.5 }}>Seu carrinho está vazio. Adicione produtos na loja.</div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 8 }}>
                  {items.map((i) => (
                    <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontWeight: 600, fontSize: 13.5 }}>{i.name}</div>
                        <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12 }}>
                          {i.unit === "kg" ? (
                            <>{fmtKg(i.qty)} · {fmt(lineTotal(i, i.qty))}</>
                          ) : (
                            <>{fmt(i.price)} × {i.qty} = {fmt(lineTotal(i, i.qty))}</>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid rgba(218,200,155,0.2)`, borderRadius: 8 }}>
                        <button onClick={() => onQtyChange(i.id, Math.round((i.qty - stepFor(i)) * 100) / 100)} style={{ width: 26, height: 26, background: "none", border: "none", color: T.cream, cursor: "pointer" }}>−</button>
                        <span style={{ color: T.cream, fontSize: 13, minWidth: 40, textAlign: "center", fontFamily: "'Open Sans', sans-serif" }}>{i.unit === "kg" ? fmtKg(i.qty) : i.qty}</span>
                        <button onClick={() => onQtyChange(i.id, Math.round((i.qty + stepFor(i)) * 100) / 100)} style={{ width: 26, height: 26, background: "none", border: "none", color: T.cream, cursor: "pointer" }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 11, marginBottom: 20, lineHeight: 1.5 }}>
                  Peso real da peça pode variar — o valor final é confirmado pelo atendente no WhatsApp.
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Seus dados</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} placeholder="Seu nome" style={inputStyle} />
                    <input value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} placeholder="Seu WhatsApp — (27) 99999-9999" style={inputStyle} />
                  </div>
                  {matchedCustomer && cashbackAvailable > 0 && (
                    <div
                      onClick={() => setUseCashback((v) => !v)}
                      style={{
                        marginTop: 10,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: useCashback ? "rgba(72,168,174,0.15)" : "rgba(218,200,155,0.06)",
                        border: `1.5px solid ${useCashback ? T.teal : "rgba(218,200,155,0.2)"}`,
                        borderRadius: 8,
                        padding: "10px 12px",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, color: T.cream, fontWeight: 600 }}>
                        Você tem {fmt(cashbackAvailable)} em cashback — usar neste pedido?
                      </span>
                      <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 700, color: useCashback ? T.teal : T.muted }}>{useCashback ? "Usando ✓" : "Usar"}</span>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Entrega</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: delivery.mode === "entrega" ? 10 : 0 }}>
                    {[{ id: "retirada", label: "Retirar na loja" }, { id: "entrega", label: "Entrega" }].map((opt) => (
                      <button key={opt.id} onClick={() => setDelivery((d) => ({ ...d, mode: opt.id }))} style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: `1.5px solid ${delivery.mode === opt.id ? T.terracotta : "rgba(218,200,155,0.2)"}`, background: delivery.mode === opt.id ? T.terracottaSoft : "transparent", color: T.cream, fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {delivery.mode === "entrega" && (
                    <div style={{ marginTop: 4 }}>
                      <input value={delivery.address} onChange={(e) => setDelivery((d) => ({ ...d, address: e.target.value }))} placeholder="Endereço completo com bairro e CEP" style={inputStyle} />
                      <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
                        A taxa de entrega é calculada pela distância até a loja e confirmada no WhatsApp antes do pagamento.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Pagamento</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ id: "pix", label: "Pix no WhatsApp" }, { id: "cartao", label: "Cartão presencial" }].map((opt) => (
                      <button key={opt.id} onClick={() => setPayment(opt.id)} style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: `1.5px solid ${payment === opt.id ? T.blue : "rgba(218,200,155,0.2)"}`, background: payment === opt.id ? "rgba(33,69,143,0.2)" : "transparent", color: T.cream, fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 14, borderTop: `1px solid rgba(218,200,155,0.12)`, marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Open Sans', sans-serif", fontSize: 13, color: T.muted }}>
                    <span>Subtotal</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                  {cashbackApplied > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Open Sans', sans-serif", fontSize: 13, color: T.teal }}>
                      <span>Cashback usado</span>
                      <span>−{fmt(cashbackApplied)}</span>
                    </div>
                  )}
                  {delivery.mode === "entrega" && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Open Sans', sans-serif", fontSize: 13, color: T.muted }}>
                      <span>Entrega</span>
                      <span>a combinar</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Open Sans', sans-serif", fontSize: 16, fontWeight: 700, color: T.cream, marginTop: 6 }}>
                    <span>{delivery.mode === "entrega" ? "Total (+ entrega)" : "Total"}</span>
                    <span>{fmt(total)}</span>
                  </div>
                  <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11, color: T.gold, marginTop: 4 }}>
                    Este pedido gera {fmt(cashbackEarned)} de cashback ({cashbackPercent}%) pro Clube.
                  </div>
                </div>

                {finalizeError && <div style={{ color: T.terracotta, fontFamily: "'Open Sans', sans-serif", fontSize: 12, marginBottom: 10 }}>{finalizeError}</div>}
                <button
                  disabled={!customer.name.trim() || onlyDigits(customer.phone).length < 10 || finalizing}
                  onClick={onFinalize}
                  style={{
                    background: !customer.name.trim() || onlyDigits(customer.phone).length < 10 || finalizing ? "rgba(193,88,30,0.3)" : T.terracotta,
                    color: T.cream,
                    border: "none",
                    borderRadius: 10,
                    padding: "14px 22px",
                    fontFamily: "'Open Sans', sans-serif",
                    fontWeight: 700,
                    fontSize: 14.5,
                    cursor: !customer.name.trim() || onlyDigits(customer.phone).length < 10 || finalizing ? "not-allowed" : "pointer",
                  }}
                >
                  {finalizing ? "Enviando..." : "Finalizar pedido · Clique 4"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Storefront({ products, categories, customers, settings, onOrderFinalized, onJoinClub }) {
  const [activeCat, setActiveCat] = useState(categories[0]?.id || "");
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [delivery, setDelivery] = useState({ mode: "retirada", address: "" });
  const [payment, setPayment] = useState("pix");
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [useCashback, setUseCashback] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState(null);
  const [clubOpen, setClubOpen] = useState(false);

  useEffect(() => {
    if (!categories.find((c) => c.id === activeCat) && categories[0]) setActiveCat(categories[0].id);
  }, [categories]);

  const addToCart = (p) => setCart((c) => ({ ...c, [p.id]: (c[p.id] || 0) + defaultQtyFor(p) }));
  const updateQty = (id, qty) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const cartCount = Object.keys(cart).length;
  const cartItems = products.filter((p) => cart[p.id] > 0).map((p) => ({ ...p, qty: cart[p.id] }));
  const subtotal = cartItems.reduce((s, i) => s + lineTotal(i, i.qty), 0);

  const matchedCustomer = onlyDigits(customer.phone).length >= 10 ? customers.find((c) => onlyDigits(c.phone) === onlyDigits(customer.phone)) : null;
  const cashbackAvailable = matchedCustomer?.cashbackBalance || 0;
  const cashbackApplied = useCashback ? Math.min(cashbackAvailable, subtotal) : 0;
  const total = subtotal - cashbackApplied;
  const cashbackPercent = settings?.cashbackPercent ?? 5;
  const cashbackEarned = Math.round(total * (cashbackPercent / 100) * 100) / 100;

  const orderText = [
    "Pedido La Dolina Mercadito:",
    `Cliente: ${customer.name || "(não informado)"} — ${fmtPhone(customer.phone) || "(telefone não informado)"}`,
    ...cartItems.map((i) => (i.unit === "kg" ? `${fmtKg(i.qty)} de ${i.name} - ${fmt(lineTotal(i, i.qty))}` : `${i.qty}x ${i.name} - ${fmt(lineTotal(i, i.qty))}`)),
    `Subtotal: ${fmt(subtotal)}`,
    cashbackApplied > 0 ? `Cashback usado: -${fmt(cashbackApplied)}` : null,
    `Total: ${fmt(total)}${delivery.mode === "entrega" ? " + entrega (a combinar)" : ""}`,
    `Cashback que este pedido gera: ${fmt(cashbackEarned)} (${cashbackPercent}%)`,
    cartItems.some((i) => i.unit === "kg") ? "Obs.: peso da peça pode variar levemente — nosso atendente confirma o valor exato aqui no WhatsApp." : null,
    delivery.mode === "entrega" ? `Entrega para: ${delivery.address || "(endereço a informar)"} — taxa a combinar` : "Retirada na loja (Rua Rosendo Serapião de Souza Filho, 696 — República, Vitória/ES)",
    `Pagamento: ${payment === "pix" ? "Pix pelo WhatsApp" : "Cartão presencial"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const visibleProducts = products.filter((p) => p.cat === activeCat);
  const catColorList = [T.terracotta, T.blue, T.teal, T.gold];
  const catIndex = categories.findIndex((c) => c.id === activeCat);
  const catColor = catColorList[catIndex % catColorList.length] || T.terracotta;

  return (
    <div style={{ background: T.void, minHeight: "100vh", fontFamily: "'Open Sans', sans-serif", paddingBottom: cartCount > 0 ? 84 : 0 }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(25,23,22,0.92)", backdropFilter: "blur(8px)", borderBottom: `1px solid rgba(218,200,155,0.15)` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SunIcon size={30} />
            <div>
              <div style={{ fontFamily: "'Amarante', serif", fontSize: 19, color: T.cream }}>La Dolina</div>
              <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 600, fontSize: 9, letterSpacing: "0.18em", color: T.gold }}>MERCADITO</div>
            </div>
          </div>

          <nav className="hide-scrollbar" style={{ display: "flex", gap: 24, overflowX: "auto" }}>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.id)} style={{ background: "none", border: "none", color: activeCat === c.id ? T.cream : T.muted, fontSize: 13, fontFamily: "'Open Sans', sans-serif", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", padding: "4px 0", borderBottom: activeCat === c.id ? `2px solid ${T.terracotta}` : "2px solid transparent" }}>
                {c.label}
              </button>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(72,168,174,0.15)", border: `1px solid ${T.teal}`, color: T.cream, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, cursor: "pointer" }}>
              ★ Clube La Dolina
            </button>
            <div onClick={() => setCartOpen(true)} style={{ position: "relative", color: T.cream, cursor: "pointer" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.cream} strokeWidth="1.6">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              {cartCount > 0 && <span style={{ position: "absolute", top: -8, right: -8, background: T.terracotta, color: T.cream, fontSize: 10, fontWeight: 700, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>}
            </div>
          </div>
        </div>
      </header>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "52px 20px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 40, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.2em", color: T.terracotta, marginBottom: 14, textTransform: "uppercase" }}>Mercadito Argentino</div>
            <h1 style={{ fontFamily: "'Amarante', serif", fontSize: "clamp(32px, 4.2vw, 50px)", lineHeight: 1.15, color: T.cream, margin: 0 }}>
              Carne de verdade,
              <br />
              sabor de todo dia.
            </h1>
            <p style={{ color: T.muted, fontSize: 15.5, lineHeight: 1.6, maxWidth: 440, marginTop: 18 }}>
              Cortes selecionados, molhos da casa e vinhos argentinos.
            </p>
            <div style={{ display: "flex", gap: 22, marginTop: 26, flexWrap: "wrap" }}>
              {[{ t: "Pix pelo WhatsApp", c: T.terracotta }, { t: "Entrega própria", c: T.blue }, { t: "Cashback no Clube", c: T.teal }].map((x) => (
                <div key={x.t} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: x.c }} />
                  <span style={{ fontSize: 12.5, color: T.muted, fontFamily: "'Open Sans', sans-serif" }}>{x.t}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: T.cream, borderRadius: 20, padding: 24, border: `2px dashed ${T.terracotta}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ background: T.void, borderRadius: 16, padding: 18 }}>
              <Postmark size={180} />
            </div>
            <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 10.5, color: T.void, textAlign: "center", letterSpacing: "0.08em", marginTop: 4 }}>VALORIZAMOS LO SIMPLE Y COTIDIANO</div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 20px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.16em", color: catColor, textTransform: "uppercase" }}>{categories.find((c) => c.id === activeCat)?.label}</div>
            <h2 style={{ fontFamily: "'Amarante', serif", fontSize: 27, color: T.cream, margin: "4px 0 0" }}>Selecionados para você</h2>
          </div>
          <div style={{ fontSize: 12, color: T.muted, fontFamily: "'Open Sans', sans-serif" }}>válido até domingo</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
          {visibleProducts.length > 0 ? (
            visibleProducts.map((p) => <ProductCard key={p.id} p={p} qty={cart[p.id] || 0} onAdd={addToCart} />)
          ) : (
            <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 13, gridColumn: "1 / -1", padding: "30px 0" }}>Nenhum produto cadastrado nessa categoria ainda.</div>
          )}
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: "56px auto 0", padding: "0 20px" }}>
        <div style={{ background: T.blue, borderRadius: 20, padding: "36px 32px", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.16em", color: T.teal, textTransform: "uppercase" }}>Clube La Dolina</div>
            <h3 style={{ fontFamily: "'Amarante', serif", fontSize: 25, color: T.cream, margin: "6px 0 10px" }}>{cashbackPercent}% de cashback em toda compra</h3>
            <p style={{ color: "rgba(218,200,155,0.85)", fontSize: 14, lineHeight: 1.6, maxWidth: 420, margin: 0 }}>
              Aniversário com frete grátis, ofertas antecipadas em dia de jogo e prioridade na entrega. Cadastro com data de nascimento e endereço.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setClubOpen(true)} style={{ background: T.cream, color: T.blue, border: "none", borderRadius: 10, padding: "13px 26px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}>Quero fazer parte</button>
          </div>
        </div>
      </section>

      <footer style={{ maxWidth: 1180, margin: "56px auto 0", padding: "0 20px 60px" }}>
        <div style={{ border: `1px solid rgba(218,200,155,0.18)`, borderRadius: 20, padding: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <div>
            <h3 style={{ fontFamily: "'Amarante', serif", fontSize: 21, color: T.cream, margin: "0 0 10px" }}>Receba a lista da semana no WhatsApp</h3>
            <p style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.6, marginBottom: 16, maxWidth: 380 }}>Toda semana, ofertas de carnes, molhos e vinhos direto no seu WhatsApp — antes de acabar no mercadito.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <input placeholder="(27) 9 9999-9999" style={{ flex: 1, ...inputStyle }} />
              <button style={{ background: "#25D366", color: "#0B3D22", border: "none", borderRadius: 8, padding: "11px 18px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>Quero receber</button>
            </div>
          </div>
          <div style={{ borderLeft: `1px solid rgba(218,200,155,0.18)`, paddingLeft: 32, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <SunIcon size={20} />
              <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", color: T.gold, textTransform: "uppercase" }}>La Dolina Mercadito</div>
            </div>
            <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.8 }}>
              Rua Rosendo Serapião de Souza Filho, 696 — República, Vitória/ES
              <br />
              CEP 29070-170
              <br />
              Seg a sáb · 8h às 20h — Dom · 8h às 13h
            </p>
          </div>
        </div>
      </footer>

      {cartCount > 0 && !cartOpen && (
        <div style={{ position: "fixed", bottom: 18, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 30 }}>
          <button onClick={() => setCartOpen(true)} style={{ background: T.terracotta, color: T.cream, border: "none", borderRadius: 999, padding: "13px 24px", display: "flex", alignItems: "center", gap: 14, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
            <span>{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
            <span style={{ opacity: 0.6 }}>|</span>
            <span>Ver carrinho · {fmt(subtotal)}</span>
          </button>
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => {
          setCartOpen(false);
          if (confirmed) {
            setConfirmed(false);
            setCart({});
            setCustomer({ name: "", phone: "" });
            setUseCashback(false);
          }
        }}
        cart={cart}
        products={products}
        onQtyChange={updateQty}
        delivery={delivery}
        setDelivery={setDelivery}
        payment={payment}
        setPayment={setPayment}
        customer={customer}
        setCustomer={setCustomer}
        matchedCustomer={matchedCustomer}
        cashbackAvailable={cashbackAvailable}
        useCashback={useCashback}
        setUseCashback={setUseCashback}
        cashbackApplied={cashbackApplied}
        total={total}
        cashbackEarned={cashbackEarned}
        cashbackPercent={cashbackPercent}
        finalizing={finalizing}
        finalizeError={finalizeError}
        onFinalize={async () => {
          setFinalizing(true);
          try {
            await onOrderFinalized({
              name: customer.name.trim(),
              phone: customer.phone,
              address: delivery.mode === "entrega" ? delivery.address : "",
              cashbackUsed: cashbackApplied,
              cashbackEarned,
              order: {
                date: new Date().toISOString(),
                items: cartItems.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })),
                subtotal,
                cashbackUsed: cashbackApplied,
                cashbackEarned,
                total,
                mode: delivery.mode,
                address: delivery.mode === "entrega" ? delivery.address : null,
                deliveryStatus: delivery.mode === "entrega" ? "pendente" : null,
                status: "pendente",
                km: null,
                deliveryFee: null,
              },
            });
            setConfirmed(true);
          } catch (e) {
            setFinalizeError("Não deu pra enviar seu pedido agora. Confira sua internet e tente de novo.");
          } finally {
            setFinalizing(false);
          }
        }}
        confirmed={confirmed}
        orderText={orderText}
      />

      {clubOpen && <ClubSignupModal onClose={() => setClubOpen(false)} onJoin={onJoinClub} />}
    </div>
  );
}

function ClubSignupModal({ onClose, onJoin }) {
  const [form, setForm] = useState({ name: "", phone: "", birthday: "", address: "" });
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const valid = form.name.trim().length > 0 && onlyDigits(form.phone).length >= 10;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onJoin(form);
      setDone(true);
    } catch (e) {
      setError("Não deu pra concluir agora. Tenta de novo em instantes.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "relative", width: "min(420px, 100%)", background: T.void, border: `1px solid rgba(218,200,155,0.15)`, borderRadius: 20, padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Amarante', serif", fontSize: 20, color: T.cream }}>{done ? "Bem-vindo(a) ao Clube!" : "Entrar no Clube La Dolina"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        {done ? (
          <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontSize: 14, lineHeight: 1.6 }}>
            Cadastro feito! Já garantimos seu cashback de 5% e o frete grátis no seu aniversário.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Seu nome" />
              <input style={inputStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="WhatsApp — (27) 99999-9999" />
              <div>
                <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11.5, color: T.muted, marginBottom: 4 }}>Data de aniversário</div>
                <input style={inputStyle} type="date" value={form.birthday} onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))} />
              </div>
              <input style={inputStyle} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Endereço (opcional, ajuda na entrega)" />
            </div>
            <button
              disabled={!valid}
              onClick={submit}
              style={{ marginTop: 18, width: "100%", background: valid ? T.blue : "rgba(33,69,143,0.3)", color: T.cream, border: "none", borderRadius: 10, padding: "13px 18px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: valid ? "pointer" : "not-allowed" }}
            >
              Confirmar cadastro
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   RETAGUARDA (backoffice)
   ============================================================ */

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12, color: T.cream, marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11, color: T.muted, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function ProductForm({ draft, setDraft, categories, onSave, onCancel, onDelete, onAddCategory }) {
  const fileInputRef = useRef(null);
  const isEditing = draft.id !== null;
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert("Escolha uma imagem menor que 3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, photo: reader.result }));
    reader.readAsDataURL(file);
  };

  const confirmNewCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const id = await onAddCategory(name);
    setDraft((d) => ({ ...d, cat: id }));
    setNewCatName("");
    setNewCatMode(false);
  };

  const valid = draft.name.trim().length > 0 && Number(draft.price) > 0 && (draft.unit === "un" || Number(draft.avgWeight) > 0);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "relative", width: "min(440px, 100%)", height: "100%", background: T.void, borderLeft: "1px solid rgba(218,200,155,0.15)", padding: 24, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Amarante', serif", fontSize: 20, color: T.cream }}>{isEditing ? "Editar produto" : "Novo produto"}</div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <Field label="Foto do produto">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div onClick={() => fileInputRef.current?.click()} style={{ width: 72, height: 72, borderRadius: 12, background: draft.photo ? `url(${draft.photo}) center/cover` : T.terracottaSoft, border: `1.5px dashed ${T.terracotta}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.terracotta, fontSize: 22, flexShrink: 0 }}>
              {!draft.photo && "+"}
            </div>
            <div>
              <button onClick={() => fileInputRef.current?.click()} style={{ background: "none", border: `1px solid ${T.terracotta}`, color: T.terracotta, borderRadius: 8, padding: "7px 12px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {draft.photo ? "Trocar foto" : "Enviar foto"}
              </button>
              {draft.photo && (
                <button onClick={() => setDraft((d) => ({ ...d, photo: null }))} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, marginLeft: 10, cursor: "pointer", fontFamily: "'Open Sans', sans-serif" }}>
                  remover
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
          </div>
        </Field>

        <Field label="Nome do produto">
          <input style={inputStyle} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Ex.: Picanha Angus" />
        </Field>

        <Field label="Descrição curta" hint="Aparece como subtítulo na loja">
          <input style={inputStyle} value={draft.cut} onChange={(e) => setDraft((d) => ({ ...d, cut: e.target.value }))} placeholder="Ex.: Bovino · Peça inteira" />
        </Field>

        <Field label="Categoria">
          {!newCatMode ? (
            <div style={{ display: "flex", gap: 8 }}>
              <select style={{ ...inputStyle, flex: 1 }} value={draft.cat} onChange={(e) => setDraft((d) => ({ ...d, cat: e.target.value }))}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: T.void }}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button onClick={() => setNewCatMode(true)} style={{ background: "none", border: `1px solid ${T.teal}`, color: T.cream, borderRadius: 8, padding: "0 14px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 18, cursor: "pointer" }} title="Nova categoria">
                +
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input autoFocus style={{ ...inputStyle, flex: 1 }} value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nome da nova categoria" onKeyDown={(e) => e.key === "Enter" && confirmNewCategory()} />
              <button onClick={confirmNewCategory} style={{ background: T.teal, border: "none", color: T.void, borderRadius: 8, padding: "0 14px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                OK
              </button>
              <button onClick={() => { setNewCatMode(false); setNewCatName(""); }} style={{ background: "none", border: "1px solid rgba(218,200,155,0.2)", color: T.muted, borderRadius: 8, padding: "0 12px", cursor: "pointer" }}>
                ×
              </button>
            </div>
          )}
        </Field>

        <Field label="Como é vendido">
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: "kg", label: "Por peso (kg)" }, { id: "un", label: "Por unidade" }].map((opt) => (
              <button key={opt.id} onClick={() => setDraft((d) => ({ ...d, unit: opt.id }))} style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: `1.5px solid ${draft.unit === opt.id ? T.teal : "rgba(218,200,155,0.2)"}`, background: draft.unit === opt.id ? "rgba(72,168,174,0.15)" : "transparent", color: T.cream, fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={draft.unit === "kg" ? "Preço por kg" : "Preço unitário"}>
            <input style={inputStyle} type="number" step="0.01" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} placeholder="0,00" />
          </Field>
          <Field label="Preço promocional" hint="Opcional">
            <input style={inputStyle} type="number" step="0.01" value={draft.oldPrice} onChange={(e) => setDraft((d) => ({ ...d, oldPrice: e.target.value }))} placeholder="0,00" />
          </Field>
        </div>

        {draft.unit === "kg" && (
          <Field label="Peso médio da peça (kg)" hint="Só como referência para o cliente — o preço é calculado pelo kg pedido">
            <input style={inputStyle} type="number" step="0.01" value={draft.avgWeight} onChange={(e) => setDraft((d) => ({ ...d, avgWeight: e.target.value }))} placeholder="Ex.: 1,2" />
          </Field>
        )}

        <Field label="Selo" hint="Opcional — ex.: OFERTA">
          <input style={inputStyle} value={draft.tag} onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value.toUpperCase() }))} placeholder="OFERTA" />
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button disabled={!valid} onClick={onSave} style={{ flex: 1, background: valid ? T.terracotta : "rgba(193,88,30,0.3)", color: T.cream, border: "none", borderRadius: 10, padding: "13px 18px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: valid ? "pointer" : "not-allowed" }}>
            Salvar produto
          </button>
          {isEditing && (
            <button onClick={onDelete} style={{ background: "none", border: "1px solid rgba(218,200,155,0.25)", color: T.muted, borderRadius: 10, padding: "13px 16px", fontFamily: "'Open Sans', sans-serif", fontSize: 13, cursor: "pointer" }}>
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductRow({ p, categories, onEdit }) {
  const cat = categories.find((c) => c.id === p.cat);
  return (
    <div onClick={() => onEdit(p)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: T.surface, border: "1px solid rgba(218,200,155,0.08)", cursor: "pointer" }}>
      <div style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0, background: p.photo ? `url(${p.photo}) center/cover` : T.terracottaSoft, display: "flex", alignItems: "center", justifyContent: "center", color: T.terracotta, fontFamily: "'Amarante', serif", fontSize: 18 }}>
        {!p.photo && p.name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14 }}>{p.name}</div>
          {p.tag && <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 9.5, fontWeight: 700, color: T.terracotta, border: `1px dashed ${T.terracotta}`, borderRadius: 999, padding: "1px 7px" }}>{p.tag}</span>}
        </div>
        <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12, marginTop: 2 }}>
          {cat?.label || "Sem categoria"} {p.unit === "kg" && p.avgWeight ? `· peça ~${Number(p.avgWeight).toFixed(2).replace(".", ",")}kg` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: T.gold, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14.5 }}>
          {fmt(p.price)}
          <span style={{ color: T.muted, fontWeight: 400, fontSize: 11 }}>/{p.unit}</span>
        </div>
        {p.oldPrice && <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 11.5, textDecoration: "line-through" }}>{fmt(p.oldPrice)}</div>}
      </div>
    </div>
  );
}

function CustomerForm({ draft, setDraft, onSave, onCancel, onDelete }) {
  const isEditing = draft.id !== null;
  const valid = draft.name.trim().length > 0 && onlyDigits(draft.phone).length >= 10;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "relative", width: "min(440px, 100%)", height: "100%", background: T.void, borderLeft: "1px solid rgba(218,200,155,0.15)", padding: 24, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Amarante', serif", fontSize: 20, color: T.cream }}>{isEditing ? "Editar cliente" : "Novo cliente"}</div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <Field label="Nome">
          <input style={inputStyle} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Nome completo" />
        </Field>

        <Field label="Telefone (WhatsApp)">
          <input style={inputStyle} value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="(27) 99999-9999" />
        </Field>

        <Field label="Aniversário" hint="Usado para ofertas e frete grátis no Clube">
          <input style={inputStyle} type="date" value={draft.birthday} onChange={(e) => setDraft((d) => ({ ...d, birthday: e.target.value }))} />
        </Field>

        <Field label="Endereço">
          <input style={inputStyle} value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} placeholder="Rua, número, bairro, cidade" />
        </Field>

        <Field label="CEP" hint="Opcional">
          <input style={inputStyle} value={draft.cep} onChange={(e) => setDraft((d) => ({ ...d, cep: e.target.value }))} placeholder="00000-000" />
        </Field>

        <Field label="Clube La Dolina">
          <button
            onClick={() => setDraft((d) => ({ ...d, clubMember: !d.clubMember }))}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: draft.clubMember ? "rgba(72,168,174,0.15)" : "transparent",
              border: `1.5px solid ${draft.clubMember ? T.teal : "rgba(218,200,155,0.2)"}`,
              color: T.cream,
              borderRadius: 8,
              padding: "9px 14px",
              fontFamily: "'Open Sans', sans-serif",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {draft.clubMember ? "★ Membro do clube" : "Não é membro — clique para ativar"}
          </button>
        </Field>

        <Field label="Saldo de cashback">
          <input style={inputStyle} type="number" step="0.01" value={draft.cashbackBalance} onChange={(e) => setDraft((d) => ({ ...d, cashbackBalance: e.target.value }))} />
        </Field>

        {draft.orders && draft.orders.length > 0 && (
          <Field label={`Histórico de compras (${draft.orders.length})`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              {[...draft.orders].reverse().map((o, i) => (
                <div key={i} style={{ background: T.surface, borderRadius: 8, padding: "9px 11px", border: "1px solid rgba(218,200,155,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Open Sans', sans-serif", fontSize: 12, color: T.cream, fontWeight: 600 }}>
                    <span>{new Date(o.date).toLocaleDateString("pt-BR")}</span>
                    <span>{fmt(o.subtotal)}</span>
                  </div>
                  <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11, color: T.muted, marginTop: 3 }}>
                    {o.items.map((it) => (it.unit === "kg" ? `${fmtKg(it.qty)} ${it.name}` : `${it.qty}x ${it.name}`)).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </Field>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button disabled={!valid} onClick={onSave} style={{ flex: 1, background: valid ? T.terracotta : "rgba(193,88,30,0.3)", color: T.cream, border: "none", borderRadius: 10, padding: "13px 18px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: valid ? "pointer" : "not-allowed" }}>
            Salvar cliente
          </button>
          {isEditing && (
            <button onClick={onDelete} style={{ background: "none", border: "1px solid rgba(218,200,155,0.25)", color: T.muted, borderRadius: 10, padding: "13px 16px", fontFamily: "'Open Sans', sans-serif", fontSize: 13, cursor: "pointer" }}>
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerRow({ c, onEdit }) {
  const birthdaySoon = isBirthdaySoon(c.birthday);
  return (
    <div onClick={() => onEdit(c)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: T.surface, border: "1px solid rgba(218,200,155,0.08)", cursor: "pointer" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: T.terracottaSoft, display: "flex", alignItems: "center", justifyContent: "center", color: T.terracotta, fontFamily: "'Amarante', serif", fontSize: 16 }}>
        {c.name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14 }}>{c.name}</div>
          {c.clubMember && <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 9.5, fontWeight: 700, color: T.teal, border: `1px solid ${T.teal}`, borderRadius: 999, padding: "1px 7px" }}>CLUBE</span>}
          {birthdaySoon && <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 9.5, fontWeight: 700, color: T.gold, border: `1px dashed ${T.gold}`, borderRadius: 999, padding: "1px 7px" }}>🎂 aniversário próximo</span>}
        </div>
        <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12, marginTop: 2 }}>
          {fmtPhone(c.phone)} {c.birthday ? `· 🎂 ${fmtBirthdayShort(c.birthday)}` : ""} {c.address ? `· ${c.address}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: T.gold, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13.5 }}>{fmt(c.cashbackBalance)}</div>
        <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 11 }}>{c.orders?.length || 0} pedido{(c.orders?.length || 0) === 1 ? "" : "s"}</div>
      </div>
    </div>
  );
}

function EventForm({ draft, setDraft, onSave, onCancel, onDelete }) {
  const isEditing = draft.id !== null;
  const valid = draft.title.trim().length > 0 && draft.startDate;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "relative", width: "min(440px, 100%)", height: "100%", background: T.void, borderLeft: "1px solid rgba(218,200,155,0.15)", padding: 24, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Amarante', serif", fontSize: 20, color: T.cream }}>{isEditing ? "Editar evento" : "Novo evento"}</div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <Field label="Título">
          <input style={inputStyle} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Ex.: Jogo do Brasil, Festival de Inverno..." />
        </Field>

        <Field label="Categoria">
          <select style={inputStyle} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
            {Object.entries(DATE_CATEGORY_LABELS).filter(([id]) => id !== "comemorativa").map(([id, label]) => (
              <option key={id} value={id} style={{ background: T.void }}>{label}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Data (ou início)">
            <input style={inputStyle} type="date" value={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} />
          </Field>
          <Field label="Data final" hint="Opcional, para períodos">
            <input style={inputStyle} type="date" value={draft.endDate} onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))} />
          </Field>
        </div>

        <Field label="O que fazer" hint="Sua nota de oportunidade de venda">
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder="Ex.: Reforçar estoque de carvão e linguiça." />
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button disabled={!valid} onClick={onSave} style={{ flex: 1, background: valid ? T.terracotta : "rgba(193,88,30,0.3)", color: T.cream, border: "none", borderRadius: 10, padding: "13px 18px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14, cursor: valid ? "pointer" : "not-allowed" }}>
            Salvar evento
          </button>
          {isEditing && (
            <button onClick={onDelete} style={{ background: "none", border: "1px solid rgba(218,200,155,0.25)", color: T.muted, borderRadius: 10, padding: "13px 16px", fontFamily: "'Open Sans', sans-serif", fontSize: 13, cursor: "pointer" }}>
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({ e, onEdit, onCampaign }) {
  const color = DATE_CATEGORY_COLORS[e.category] || T.muted;
  const urgent = e.daysUntil <= 14;
  return (
    <div
      onClick={() => e.editable && onEdit(e)}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: T.surface, border: `1px solid ${urgent ? color : "rgba(218,200,155,0.08)"}`, cursor: e.editable ? "pointer" : "default" }}
    >
      <div style={{ width: 52, flexShrink: 0, textAlign: "center" }}>
        <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 18, color: urgent ? color : T.cream, lineHeight: 1 }}>{e.daysUntil}</div>
        <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 9.5, color: T.muted, marginTop: 2 }}>dia{e.daysUntil === 1 ? "" : "s"}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14 }}>{e.title}</div>
          <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 9.5, fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: 999, padding: "1px 7px" }}>{DATE_CATEGORY_LABELS[e.category]}</span>
          {!e.editable && <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 9.5, color: T.muted }}>fixo</span>}
        </div>
        <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12, marginTop: 2 }}>{e.dateLabel}</div>
        {e.note && <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>{e.note}</div>}
      </div>
      <button
        onClick={(ev) => {
          ev.stopPropagation();
          onCampaign(e);
        }}
        style={{ flexShrink: 0, background: "none", border: `1px solid ${T.teal}`, color: T.cream, borderRadius: 8, padding: "8px 12px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        Gerar ação
      </button>
    </div>
  );
}

// ---- CSV helpers (used by CRM import) --------------------------------------
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === "," || ch === ";") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
const normalizeHeader = (h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const HEADER_MAP = {
  name: ["nome", "name", "cliente"],
  phone: ["telefone", "phone", "celular", "whatsapp", "fone", "contato"],
  birthday: ["aniversario", "birthday", "nascimento", "data de nascimento", "dob"],
  address: ["endereco", "address", "endereco completo"],
};
const parseBirthdayValue = (v) => {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
};

// ---- Campaign modal: turns a special date into a CRM-driven WhatsApp action -
function CampaignModal({ event, customers, onClose }) {
  const [audience, setAudience] = useState("todos");
  const [message, setMessage] = useState(`Oi {nome}! 🎉 ${event.title} está chegando (${event.dateLabel}) na La Dolina Mercadito. Ofertas especiais essa semana — responde esse WhatsApp que a gente já separa o seu pedido! 🧡`);
  const [copied, setCopied] = useState(false);

  const withPhone = customers.filter((c) => onlyDigits(c.phone).length >= 10);
  const matched =
    audience === "clube" ? withPhone.filter((c) => c.clubMember) : audience === "naoclube" ? withPhone.filter((c) => !c.clubMember) : withPhone;

  const copyPhones = async () => {
    const text = matched.map((c) => fmtPhone(c.phone)).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const exportCSV = () => {
    const rows = [["nome", "telefone", "mensagem"], ...matched.map((c) => [c.name, fmtPhone(c.phone), message.replace("{nome}", c.name)])];
    const csv = rows.map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `acao-${event.title.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "relative", width: "min(460px, 100%)", height: "100%", background: T.void, borderLeft: "1px solid rgba(218,200,155,0.15)", padding: 24, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontFamily: "'Amarante', serif", fontSize: 20, color: T.cream }}>Gerar ação</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, color: T.muted, marginBottom: 20 }}>
          {event.title} · {event.dateLabel}
        </div>

        <Field label="Público (do nosso CRM)">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { id: "todos", label: `Todos (${withPhone.length})` },
              { id: "clube", label: `Clube (${withPhone.filter((c) => c.clubMember).length})` },
              { id: "naoclube", label: `Não-clube (${withPhone.filter((c) => !c.clubMember).length})` },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setAudience(opt.id)}
                style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${audience === opt.id ? T.teal : "rgba(218,200,155,0.2)"}`, background: audience === opt.id ? "rgba(72,168,174,0.15)" : "transparent", color: T.cream, fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Mensagem" hint="Use {nome} — a gente troca pelo nome de cada cliente">
          <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button onClick={copyPhones} style={{ flex: 1, background: "none", border: `1px solid ${T.teal}`, color: T.cream, borderRadius: 8, padding: "10px 14px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            {copied ? "Copiado ✓" : "Copiar telefones"}
          </button>
          <button onClick={exportCSV} style={{ flex: 1, background: "none", border: `1px solid ${T.gold}`, color: T.cream, borderRadius: 8, padding: "10px 14px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            Exportar CSV
          </button>
        </div>

        <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, color: T.cream, marginBottom: 10 }}>
          {matched.length} cliente{matched.length === 1 ? "" : "s"} nessa lista
        </div>
        <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>
          Não existe envio automático em massa pelo WhatsApp comum — abra individualmente pela lista, ou use o CSV numa ferramenta de disparo (WhatsApp Business API) mais pra frente.
        </div>

        {matched.length === 0 ? (
          <div style={{ color: T.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>Nenhum cliente com telefone nesse público.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {matched.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: T.surface, borderRadius: 8, border: "1px solid rgba(218,200,155,0.08)" }}>
                <div>
                  <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 11.5 }}>{fmtPhone(c.phone)}</div>
                </div>
                <a
                  href={`https://wa.me/${c.phone}?text=${encodeURIComponent(message.replace("{nome}", c.name))}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ background: "#25D366", color: "#0B3D22", textDecoration: "none", borderRadius: 8, padding: "7px 12px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 11.5 }}
                >
                  Enviar
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoginScreen({ onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await onSignIn(email, password);
    } catch (e) {
      setError(e.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: T.void, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Open Sans', sans-serif" }}>
      <div style={{ width: "min(360px, 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, justifyContent: "center" }}>
          <SunIcon size={30} />
          <div>
            <div style={{ fontFamily: "'Amarante', serif", fontSize: 19, color: T.cream }}>La Dolina</div>
            <div style={{ fontWeight: 600, fontSize: 9, letterSpacing: "0.18em", color: T.gold }}>RETAGUARDA</div>
          </div>
        </div>

        <div style={{ background: T.surface, borderRadius: 16, padding: 24, border: "1px solid rgba(218,200,155,0.08)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: T.cream, marginBottom: 16 }}>Entrar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" onKeyDown={(e) => e.key === "Enter" && submit()} />
            <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          {error && <div style={{ color: T.terracotta, fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
          <button
            onClick={submit}
            disabled={loading}
            style={{ width: "100%", background: T.terracotta, color: T.cream, border: "none", borderRadius: 10, padding: "12px 18px", fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>
        <div style={{ color: T.muted, fontSize: 11.5, textAlign: "center", marginTop: 14 }}>
          Acesso restrito à equipe. Crie usuários em Authentication → Users no Supabase.
        </div>
      </div>
    </div>
  );
}

function Retaguarda({
  products,
  categories,
  customers,
  settings,
  customDates,
  saving,
  session,
  onSignOut,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddCategory,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onImportCustomers,
  onUpdateOrder,
  onUpdateSettings,
  onAddCustomDate,
  onUpdateCustomDate,
  onDeleteCustomDate,
}) {
  const [raTab, setRaTab] = useState("produtos");
  const [cashbackDraft, setCashbackDraft] = useState(String(settings.cashbackPercent));
  const [activeCat, setActiveCat] = useState("todas");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(null);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [custDraft, setCustDraft] = useState(null);
  const [eventDraft, setEventDraft] = useState(null);
  const [campaignEvent, setCampaignEvent] = useState(null);
  const [routeSelection, setRouteSelection] = useState([]);
  const [reportRange, setReportRange] = useState("30d");
  const [ordersFilter, setOrdersFilter] = useState("todos");
  const [tiersDraft, setTiersDraft] = useState(settings.deliveryTiers);
  const [baseAddressDraft, setBaseAddressDraft] = useState(settings.deliveryBase.address);
  const [importSummary, setImportSummary] = useState(null);
  const [kmDrafts, setKmDrafts] = useState({});
  const importFileRef = useRef(null);

  const addCategory = (name) => {
    return onAddCategory(name);
  };

  const openNew = () => setDraft(emptyDraft(categories[0]?.id || ""));
  const openEdit = (p) =>
    setDraft({ ...p, price: String(p.price), oldPrice: p.oldPrice != null ? String(p.oldPrice) : "", avgWeight: p.avgWeight != null ? String(p.avgWeight) : "", tag: p.tag || "" });

  const saveDraft = async () => {
    const clean = {
      id: draft.id ?? undefined,
      name: draft.name.trim(),
      cut: draft.cut.trim(),
      cat: draft.cat,
      unit: draft.unit,
      price: parseFloat(draft.price) || 0,
      oldPrice: draft.oldPrice ? parseFloat(draft.oldPrice) : null,
      avgWeight: draft.unit === "kg" ? parseFloat(draft.avgWeight) || 0 : null,
      tag: draft.tag.trim() || null,
      photo: draft.photo || null,
    };
    if (draft.id) await onUpdateProduct(draft.id, clean);
    else await onAddProduct(clean);
    setDraft(null);
  };

  const deleteDraft = async () => {
    await onDeleteProduct(draft.id);
    setDraft(null);
  };

  const confirmNewCategoryTopLevel = async () => {
    const name = newCatName.trim();
    if (!name) return;
    await addCategory(name);
    setNewCatName("");
    setAddingCat(false);
  };

  const filtered = products.filter((p) => {
    const matchCat = activeCat === "todas" || p.cat === activeCat;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const openNewCustomer = () => setCustDraft(emptyCustomerDraft());
  const openEditCustomer = (c) => setCustDraft({ ...c, cashbackBalance: String(c.cashbackBalance ?? 0) });

  const saveCustomerDraft = async () => {
    const clean = {
      name: custDraft.name.trim(),
      phone: onlyDigits(custDraft.phone),
      birthday: custDraft.birthday || null,
      address: custDraft.address.trim(),
      cep: custDraft.cep.trim(),
      clubMember: !!custDraft.clubMember,
      cashbackBalance: parseFloat(custDraft.cashbackBalance) || 0,
    };
    if (custDraft.id) await onUpdateCustomer(custDraft.id, clean);
    else await onAddCustomer(clean);
    setCustDraft(null);
  };

  const deleteCustomerDraft = async () => {
    await onDeleteCustomer(custDraft.id);
    setCustDraft(null);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rows = parseCSV(String(reader.result));
      if (rows.length < 2) {
        setImportSummary({ error: "Arquivo vazio ou sem linhas de dados." });
        return;
      }
      const headers = rows[0].map(normalizeHeader);
      const colFor = (keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
      const nameCol = colFor(HEADER_MAP.name);
      const phoneCol = colFor(HEADER_MAP.phone);
      const birthdayCol = colFor(HEADER_MAP.birthday);
      const addressCol = colFor(HEADER_MAP.address);

      if (phoneCol === -1) {
        setImportSummary({ error: 'Não encontrei uma coluna de telefone (ex.: "telefone", "celular", "whatsapp"). Confira o cabeçalho do arquivo.' });
        return;
      }

      const parsedRows = rows.slice(1).map((row) => ({
        phone: row[phoneCol] || "",
        name: nameCol !== -1 ? (row[nameCol] || "").trim() : "",
        birthday: birthdayCol !== -1 ? parseBirthdayValue(row[birthdayCol]) : null,
        address: addressCol !== -1 ? (row[addressCol] || "").trim() : "",
      }));

      setImportSummary({ importing: true });
      try {
        const summary = await onImportCustomers(parsedRows);
        setImportSummary(summary);
      } catch (err) {
        setImportSummary({ error: "Falha ao importar: " + (err.message || err) });
      }
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  useEffect(() => {
    setCashbackDraft(String(settings.cashbackPercent));
  }, [settings.cashbackPercent]);

  const saveCashbackPercent = () => {
    const val = parseFloat(cashbackDraft.replace(",", "."));
    if (isNaN(val) || val < 0) return;
    onUpdateSettings({ ...settings, cashbackPercent: Math.round(val * 100) / 100 });
  };

  const updateTierDraft = (idx, field, value) => {
    setTiersDraft((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };
  const addTierRow = () => {
    const lastKm = tiersDraft.length ? tiersDraft[tiersDraft.length - 1].km : 0;
    setTiersDraft((prev) => [...prev, { km: lastKm + 1, fee: 0 }]);
  };
  const removeTierRow = (idx) => setTiersDraft((prev) => prev.filter((_, i) => i !== idx));
  const saveDeliveryConfig = () => {
    const clean = tiersDraft
      .map((t) => ({ km: parseFloat(String(t.km).replace(",", ".")) || 0, fee: parseFloat(String(t.fee).replace(",", ".")) || 0 }))
      .filter((t) => t.km > 0)
      .sort((a, b) => a.km - b.km);
    onUpdateSettings({ ...settings, deliveryTiers: clean, deliveryBase: { ...settings.deliveryBase, address: baseAddressDraft.trim() } });
  };

  // Pending deliveries: pulled straight from customer order history (mode === "entrega", not yet delivered).
  // ---- Relatórios: aggregated straight from real orders in the CRM ----------
  const allOrders = customers.flatMap((c) => (c.orders || []).map((o) => ({ ...o, customerName: c.name })));
  const reportNow = new Date();
  const reportRangeStart =
    reportRange === "7d"
      ? new Date(reportNow.getTime() - 7 * 86400000)
      : reportRange === "30d"
      ? new Date(reportNow.getTime() - 30 * 86400000)
      : reportRange === "mes"
      ? new Date(reportNow.getFullYear(), reportNow.getMonth(), 1)
      : null;
  const reportOrders = allOrders.filter((o) => !reportRangeStart || new Date(o.date) >= reportRangeStart);

  const totalRevenue = reportOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalOrders = reportOrders.length;
  const avgTicket = totalOrders ? totalRevenue / totalOrders : 0;
  const cashbackUsedTotal = reportOrders.reduce((s, o) => s + (o.cashbackUsed || 0), 0);
  const cashbackEarnedTotal = reportOrders.reduce((s, o) => s + (o.cashbackEarned || 0), 0);
  const entregaCount = reportOrders.filter((o) => o.mode === "entrega").length;
  const retiradaCount = totalOrders - entregaCount;

  const dailyMap = {};
  reportOrders.forEach((o) => {
    const day = o.date.slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + (o.total || 0);
  });
  const dailyData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, total]) => ({ day: `${day.slice(8, 10)}/${day.slice(5, 7)}`, total: Math.round(total * 100) / 100 }));

  const productLookup = Object.fromEntries(products.map((p) => [p.name, p]));
  const productMap = {};
  reportOrders.forEach((o) => {
    (o.items || []).forEach((it) => {
      if (!productMap[it.name]) productMap[it.name] = { name: it.name, qty: 0, unit: it.unit, revenue: 0 };
      productMap[it.name].qty += it.qty;
      const p = productLookup[it.name];
      productMap[it.name].revenue += p ? p.price * it.qty : 0;
    });
  });
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  const maxProductRevenue = Math.max(1, ...topProducts.map((p) => p.revenue));

  const pendingDeliveries = customers.flatMap((c) =>
    (c.orders || [])
      .filter((o) => o.mode === "entrega" && o.deliveryStatus === "pendente")
      .map((o) => ({ ...o, customerId: c.id, customerName: c.name, customerPhone: c.phone, address: o.address || c.address }))
  ).sort((a, b) => new Date(a.date) - new Date(b.date));

  const updateDeliveryOrder = (customerId, orderId, patch) => {
    onUpdateOrder(orderId, patch);
  };

  const toggleRouteStop = (key) => {
    setRouteSelection((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };
  const moveRouteStop = (idx, dir) => {
    setRouteSelection((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const filteredCustomers = customers.filter((c) => c.name.toLowerCase().includes(custSearch.toLowerCase()) || onlyDigits(c.phone).includes(onlyDigits(custSearch)));

  const today = new Date();
  const upcomingEvents = [
    ...SEED_SPECIAL_DATES.map((s) => {
      const d = nextOccurrence(s.rule, today);
      return { id: s.id, title: s.title, category: s.category, note: s.note, date: d, daysUntil: daysUntil(d, today), dateLabel: fmtDateLong(d), editable: false };
    }),
    ...customDates.map((c) => {
      const start = new Date(c.startDate + "T00:00:00");
      const end = c.endDate ? new Date(c.endDate + "T00:00:00") : start;
      const inProgress = today >= start && today <= end;
      const label = c.endDate && c.endDate !== c.startDate ? `${fmtDateLong(start)} – ${fmtDateLong(end)}` : fmtDateLong(start);
      return { id: c.id, title: c.title, category: c.category, note: c.note, date: start, daysUntil: inProgress ? 0 : daysUntil(start, today), dateLabel: inProgress ? `${label} · em andamento` : label, editable: true, raw: c };
    }),
  ]
    .filter((e) => e.daysUntil >= 0 || e.dateLabel.includes("em andamento"))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const openNewEvent = () => setEventDraft(emptyEventDraft());
  const openEditEvent = (e) => setEventDraft({ ...e.raw, endDate: e.raw.endDate || "" });

  const saveEventDraft = async () => {
    const clean = { title: eventDraft.title.trim(), category: eventDraft.category, startDate: eventDraft.startDate, endDate: eventDraft.endDate || null, note: eventDraft.note.trim() };
    if (eventDraft.id) await onUpdateCustomDate(eventDraft.id, clean);
    else await onAddCustomDate(clean);
    setEventDraft(null);
  };

  const deleteEventDraft = async () => {
    await onDeleteCustomDate(eventDraft.id);
    setEventDraft(null);
  };
  const upcomingBirthdays = customers.filter((c) => isBirthdaySoon(c.birthday));

  return (
    <div style={{ background: T.void, minHeight: "100vh", fontFamily: "'Open Sans', sans-serif" }}>
      <header style={{ borderBottom: "1px solid rgba(218,200,155,0.12)", padding: "16px 20px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SunIcon size={28} />
            <div>
              <div style={{ fontFamily: "'Amarante', serif", fontSize: 18, color: T.cream }}>La Dolina</div>
              <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 600, fontSize: 9, letterSpacing: "0.18em", color: T.gold }}>RETAGUARDA</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setRaTab("produtos")}
              style={{ background: raTab === "produtos" ? "rgba(72,168,174,0.15)" : "transparent", border: `1px solid ${raTab === "produtos" ? T.teal : "rgba(218,200,155,0.15)"}`, color: raTab === "produtos" ? T.cream : T.muted, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Produtos
            </button>
            <button
              onClick={() => setRaTab("pedidos")}
              style={{ background: raTab === "pedidos" ? "rgba(72,168,174,0.15)" : "transparent", border: `1px solid ${raTab === "pedidos" ? T.teal : "rgba(218,200,155,0.15)"}`, color: raTab === "pedidos" ? T.cream : T.muted, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Pedidos
            </button>
            <button
              onClick={() => setRaTab("relatorios")}
              style={{ background: raTab === "relatorios" ? "rgba(72,168,174,0.15)" : "transparent", border: `1px solid ${raTab === "relatorios" ? T.teal : "rgba(218,200,155,0.15)"}`, color: raTab === "relatorios" ? T.cream : T.muted, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Relatórios
            </button>
            <button
              onClick={() => setRaTab("clientes")}
              style={{ background: raTab === "clientes" ? "rgba(72,168,174,0.15)" : "transparent", border: `1px solid ${raTab === "clientes" ? T.teal : "rgba(218,200,155,0.15)"}`, color: raTab === "clientes" ? T.cream : T.muted, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Clientes
            </button>
            <button
              onClick={() => setRaTab("datas")}
              style={{ background: raTab === "datas" ? "rgba(72,168,174,0.15)" : "transparent", border: `1px solid ${raTab === "datas" ? T.teal : "rgba(218,200,155,0.15)"}`, color: raTab === "datas" ? T.cream : T.muted, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Datas
            </button>
            <button
              onClick={() => setRaTab("config")}
              style={{ background: raTab === "config" ? "rgba(72,168,174,0.15)" : "transparent", border: `1px solid ${raTab === "config" ? T.teal : "rgba(218,200,155,0.15)"}`, color: raTab === "config" ? T.cream : T.muted, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Config
            </button>
            <button
              onClick={() => setRaTab("entregas")}
              style={{ background: raTab === "entregas" ? "rgba(72,168,174,0.15)" : "transparent", border: `1px solid ${raTab === "entregas" ? T.teal : "rgba(218,200,155,0.15)"}`, color: raTab === "entregas" ? T.cream : T.muted, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Entregas{pendingDeliveries.length > 0 ? ` (${pendingDeliveries.length})` : ""}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 11.5 }}>{session?.email}</span>
            <button onClick={onSignOut} style={{ background: "none", border: "1px solid rgba(218,200,155,0.2)", color: T.muted, borderRadius: 999, padding: "6px 12px", fontFamily: "'Open Sans', sans-serif", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 80px" }}>
        {raTab === "produtos" ? (
          <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'Amarante', serif", fontSize: 26, color: T.cream, margin: 0 }}>Catálogo de produtos</h1>
            <div style={{ color: T.muted, fontSize: 12.5, marginTop: 4 }}>
              {products.length} produtos cadastrados {saving && "· salvando..."}
            </div>
          </div>
          <button onClick={openNew} style={{ background: T.terracotta, color: T.cream, border: "none", borderRadius: 10, padding: "12px 20px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
            + Novo produto
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..." style={{ ...inputStyle, maxWidth: 220 }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[{ id: "todas", label: "Todas" }, ...categories].map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.id)} style={{ background: activeCat === c.id ? T.terracottaSoft : "transparent", border: `1px solid ${activeCat === c.id ? T.terracotta : "rgba(218,200,155,0.15)"}`, color: activeCat === c.id ? T.cream : T.muted, borderRadius: 999, padding: "7px 13px", fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {c.label}
              </button>
            ))}
            {!addingCat ? (
              <button onClick={() => setAddingCat(true)} style={{ background: "transparent", border: `1px dashed ${T.teal}`, color: T.teal, borderRadius: 999, padding: "7px 13px", fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                + categoria
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <input autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmNewCategoryTopLevel()} placeholder="Nome da categoria" style={{ ...inputStyle, width: 150, padding: "7px 10px" }} />
                <button onClick={confirmNewCategoryTopLevel} style={{ background: T.teal, border: "none", color: T.void, borderRadius: 8, padding: "0 12px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  OK
                </button>
                <button onClick={() => { setAddingCat(false); setNewCatName(""); }} style={{ background: "none", border: "1px solid rgba(218,200,155,0.2)", color: T.muted, borderRadius: 8, padding: "0 10px", cursor: "pointer" }}>
                  ×
                </button>
              </div>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ color: T.muted, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Nenhum produto encontrado. Toque em "+ Novo produto" para cadastrar.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((p) => (
              <ProductRow key={p.id} p={p} categories={categories} onEdit={openEdit} />
            ))}
          </div>
        )}
        </>
        ) : raTab === "pedidos" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "'Amarante', serif", fontSize: 26, color: T.cream, margin: 0 }}>Pedidos</h1>
                <div style={{ color: T.muted, fontSize: 12.5, marginTop: 4 }}>{allOrders.length} pedido{allOrders.length === 1 ? "" : "s"} no total</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
              {[{ id: "todos", label: "Todos" }, { id: "pendente", label: "Pendentes" }, { id: "concluido", label: "Concluídos" }].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setOrdersFilter(f.id)}
                  style={{ background: ordersFilter === f.id ? T.terracottaSoft : "transparent", border: `1px solid ${ordersFilter === f.id ? T.terracotta : "rgba(218,200,155,0.15)"}`, color: T.cream, borderRadius: 999, padding: "7px 13px", fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {(() => {
              const sorted = [...allOrders].sort((a, b) => new Date(b.date) - new Date(a.date));
              const list = ordersFilter === "todos" ? sorted : sorted.filter((o) => (o.status || "pendente") === ordersFilter);
              if (list.length === 0) {
                return <div style={{ color: T.muted, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Nenhum pedido por aqui.</div>;
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {list.map((o) => {
                    const concluded = (o.status || "pendente") === "concluido";
                    return (
                      <div key={o.id} style={{ background: T.surface, borderRadius: 12, padding: 14, border: "1px solid rgba(218,200,155,0.08)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14 }}>{o.customerName}</div>
                              <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 9.5, fontWeight: 700, color: o.mode === "entrega" ? T.blue : T.teal, border: `1px solid ${o.mode === "entrega" ? T.blue : T.teal}`, borderRadius: 999, padding: "1px 7px" }}>
                                {o.mode === "entrega" ? "ENTREGA" : "RETIRADA"}
                              </span>
                              <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 9.5, fontWeight: 700, color: concluded ? T.teal : T.gold, border: `1px dashed ${concluded ? T.teal : T.gold}`, borderRadius: 999, padding: "1px 7px" }}>
                                {concluded ? "CONCLUÍDO" : "PENDENTE"}
                              </span>
                            </div>
                            <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 11.5, marginTop: 3 }}>
                              {new Date(o.date).toLocaleString("pt-BR")}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: T.gold, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 15 }}>{fmt(o.total)}</div>
                          </div>
                        </div>
                        <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
                          {(o.items || []).map((it) => (it.unit === "kg" ? `${fmtKg(it.qty)} ${it.name}` : `${it.qty}x ${it.name}`)).join(", ")}
                          {o.mode === "entrega" && o.address ? ` · ${o.address}` : ""}
                        </div>
                        <button
                          onClick={() => onUpdateOrder(o.id, { status: concluded ? "pendente" : "concluido" })}
                          style={{ background: concluded ? "none" : T.terracotta, color: concluded ? T.muted : T.cream, border: concluded ? "1px solid rgba(218,200,155,0.2)" : "none", borderRadius: 8, padding: "7px 14px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
                        >
                          {concluded ? "Reabrir" : "Marcar concluído"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        ) : raTab === "relatorios" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "'Amarante', serif", fontSize: 26, color: T.cream, margin: 0 }}>Relatórios de vendas</h1>
                <div style={{ color: T.muted, fontSize: 12.5, marginTop: 4 }}>Direto dos pedidos registrados no CRM</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ id: "7d", label: "7 dias" }, { id: "30d", label: "30 dias" }, { id: "mes", label: "Este mês" }, { id: "tudo", label: "Tudo" }].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReportRange(r.id)}
                    style={{ background: reportRange === r.id ? T.terracottaSoft : "transparent", border: `1px solid ${reportRange === r.id ? T.terracotta : "rgba(218,200,155,0.15)"}`, color: T.cream, borderRadius: 999, padding: "7px 13px", fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {totalOrders === 0 ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Nenhum pedido nesse período ainda.</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
                  {[
                    { label: "Faturamento", value: fmt(totalRevenue), color: T.gold },
                    { label: "Pedidos", value: String(totalOrders), color: T.teal },
                    { label: "Ticket médio", value: fmt(avgTicket), color: T.blue },
                    { label: "Cashback concedido", value: fmt(cashbackEarnedTotal), color: T.terracotta },
                  ].map((kpi) => (
                    <div key={kpi.label} style={{ background: T.surface, borderRadius: 12, padding: 16, border: "1px solid rgba(218,200,155,0.08)" }}>
                      <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</div>
                      <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 20, color: kpi.color }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: T.surface, borderRadius: 14, padding: 18, border: "1px solid rgba(218,200,155,0.08)", marginBottom: 22 }}>
                  <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13, color: T.cream, marginBottom: 12 }}>Faturamento por dia</div>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(218,200,155,0.1)" />
                        <XAxis dataKey="day" tick={{ fill: T.muted, fontSize: 11 }} axisLine={{ stroke: "rgba(218,200,155,0.15)" }} tickLine={false} />
                        <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={{ stroke: "rgba(218,200,155,0.15)" }} tickLine={false} width={40} />
                        <Tooltip
                          contentStyle={{ background: T.void, border: "1px solid rgba(218,200,155,0.2)", borderRadius: 8, fontFamily: "'Open Sans', sans-serif", fontSize: 12 }}
                          labelStyle={{ color: T.cream }}
                          formatter={(v) => [fmt(v), "Faturamento"]}
                        />
                        <Bar dataKey="total" fill={T.terracotta} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16, marginBottom: 10 }}>
                  <div style={{ background: T.surface, borderRadius: 14, padding: 18, border: "1px solid rgba(218,200,155,0.08)" }}>
                    <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13, color: T.cream, marginBottom: 12 }}>Produtos mais vendidos</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {topProducts.map((p) => (
                        <div key={p.name}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, color: T.cream, marginBottom: 3 }}>
                            <span>{p.name}</span>
                            <span style={{ color: T.muted }}>{p.unit === "kg" ? fmtKg(p.qty) : `${p.qty}x`} · {fmt(p.revenue)}</span>
                          </div>
                          <div style={{ height: 6, background: "rgba(218,200,155,0.1)", borderRadius: 999 }}>
                            <div style={{ height: "100%", width: `${(p.revenue / maxProductRevenue) * 100}%`, background: T.gold, borderRadius: 999 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: T.surface, borderRadius: 14, padding: 18, border: "1px solid rgba(218,200,155,0.08)" }}>
                    <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13, color: T.cream, marginBottom: 12 }}>Entrega vs Retirada</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, color: T.cream, marginBottom: 4 }}>
                          <span>Entrega</span>
                          <span style={{ color: T.muted }}>{entregaCount}</span>
                        </div>
                        <div style={{ height: 8, background: "rgba(218,200,155,0.1)", borderRadius: 999 }}>
                          <div style={{ height: "100%", width: `${totalOrders ? (entregaCount / totalOrders) * 100 : 0}%`, background: T.blue, borderRadius: 999 }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, color: T.cream, marginBottom: 4 }}>
                          <span>Retirada</span>
                          <span style={{ color: T.muted }}>{retiradaCount}</span>
                        </div>
                        <div style={{ height: 8, background: "rgba(218,200,155,0.1)", borderRadius: 999 }}>
                          <div style={{ height: "100%", width: `${totalOrders ? (retiradaCount / totalOrders) * 100 : 0}%`, background: T.teal, borderRadius: 999 }} />
                        </div>
                      </div>
                      <div style={{ borderTop: "1px solid rgba(218,200,155,0.1)", paddingTop: 10, marginTop: 4 }}>
                        <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11.5, color: T.muted }}>Cashback usado no período</div>
                        <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 15, color: T.teal }}>{fmt(cashbackUsedTotal)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
                  Receita por produto é estimada pelo preço atual cadastrado — se o preço mudou desde a venda, o valor histórico exato pode variar.
                </div>
              </>
            )}
          </>
        ) : raTab === "clientes" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "'Amarante', serif", fontSize: 26, color: T.cream, margin: 0 }}>Clientes</h1>
                <div style={{ color: T.muted, fontSize: 12.5, marginTop: 4 }}>
                  {customers.length} clientes cadastrados{upcomingBirthdays.length > 0 ? ` · 🎂 ${upcomingBirthdays.length} aniversário${upcomingBirthdays.length === 1 ? "" : "s"} nos próximos 14 dias` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => importFileRef.current?.click()}
                  style={{ background: "none", border: `1px solid ${T.teal}`, color: T.cream, borderRadius: 10, padding: "12px 18px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
                >
                  Importar clientes (CSV)
                </button>
                <input ref={importFileRef} type="file" accept=".csv,text/csv" onChange={handleImportCSV} style={{ display: "none" }} />
                <button onClick={openNewCustomer} style={{ background: T.terracotta, color: T.cream, border: "none", borderRadius: 10, padding: "12px 20px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                  + Novo cliente
                </button>
              </div>
            </div>

            {importSummary && (
              <div style={{ background: importSummary.error ? "rgba(193,88,30,0.14)" : "rgba(72,168,174,0.15)", border: `1px solid ${importSummary.error ? T.terracotta : T.teal}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, color: T.cream }}>
                  {importSummary.importing ? "Importando..." : importSummary.error ? importSummary.error : `Importação concluída: ${importSummary.created} novo(s), ${importSummary.updated} atualizado(s), ${importSummary.skipped} sem telefone válido (ignorado).`}
                </span>
                <button onClick={() => setImportSummary(null)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14 }}>×</button>
              </div>
            )}

            <input value={custSearch} onChange={(e) => setCustSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." style={{ ...inputStyle, maxWidth: 260, marginBottom: 18 }} />

            {filteredCustomers.length === 0 ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "40px 0", textAlign: "center" }}>
                {customers.length === 0 ? "Nenhum cliente ainda — cadastros também chegam automaticamente pelo checkout da loja." : "Nenhum cliente encontrado."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredCustomers.map((c) => (
                  <CustomerRow key={c.id} c={c} onEdit={openEditCustomer} />
                ))}
              </div>
            )}
          </>
        ) : raTab === "datas" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "'Amarante', serif", fontSize: 26, color: T.cream, margin: 0 }}>Datas especiais</h1>
                <div style={{ color: T.muted, fontSize: 12.5, marginTop: 4 }}>
                  Comemorativas calculadas automaticamente + eventos e jogos que vocês cadastrarem
                </div>
              </div>
              <button onClick={openNewEvent} style={{ background: T.terracotta, color: T.cream, border: "none", borderRadius: 10, padding: "12px 20px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                + Novo evento
              </button>
            </div>

            {upcomingBirthdays.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, color: T.gold, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  🎂 Aniversários próximos
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {upcomingBirthdays.map((c) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: T.surface, borderRadius: 10, border: "1px solid rgba(218,200,155,0.08)" }}>
                      <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 13, color: T.cream, fontWeight: 600 }}>{c.name}</span>
                      <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12, color: T.muted }}>{fmtBirthdayShort(c.birthday)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, color: T.teal, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Próximas datas e eventos
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcomingEvents.map((e) => (
                <EventRow key={`${e.editable ? "c" : "s"}-${e.id}`} e={e} onEdit={openEditEvent} onCampaign={setCampaignEvent} />
              ))}
            </div>
          </>
        ) : raTab === "entregas" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "'Amarante', serif", fontSize: 26, color: T.cream, margin: 0 }}>Entregas</h1>
                <div style={{ color: T.muted, fontSize: 12.5, marginTop: 4 }}>{pendingDeliveries.length} pedido{pendingDeliveries.length === 1 ? "" : "s"} aguardando entrega</div>
              </div>
            </div>

            <div style={{ background: T.surface, borderRadius: 10, padding: "10px 14px", marginBottom: 18, border: "1px solid rgba(218,200,155,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11.5, color: T.muted }}>Ponto de saída:</span>
              <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, color: T.cream, fontWeight: 600 }}>{settings.deliveryBase.address}</span>
            </div>

            {pendingDeliveries.length === 0 ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Nenhuma entrega pendente no momento.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: routeSelection.length > 0 ? 90 : 0 }}>
                {pendingDeliveries.map((d) => {
                  const key = `${d.customerId}-${d.id}`;
                  const selected = routeSelection.includes(key);
                  const kmValue = kmDrafts[d.id] ?? (d.km != null ? String(d.km) : "");
                  const fee = feeForKm(parseFloat(kmValue), settings.deliveryTiers);
                  return (
                    <div key={key} style={{ background: T.surface, borderRadius: 12, padding: 14, border: `1px solid ${selected ? T.teal : "rgba(218,200,155,0.08)"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <input type="checkbox" checked={selected} onChange={() => toggleRouteStop(key)} style={{ marginTop: 4 }} />
                          <div>
                            <div style={{ color: T.cream, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14 }}>{d.customerName}</div>
                            <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12, marginTop: 2 }}>{fmtPhone(d.customerPhone)} · {d.address}</div>
                            <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 11.5, marginTop: 4 }}>
                              {d.items.map((i) => (i.unit === "kg" ? `${fmtKg(i.qty)} ${i.name}` : `${i.qty}x ${i.name}`)).join(", ")}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ color: T.gold, fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14 }}>{fmt(d.total)}</div>
                          <div style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 11 }}>pedido</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <a href={gmapsSingle(settings.deliveryBase.address, d.address)} target="_blank" rel="noreferrer" style={{ background: "none", border: `1px solid ${T.blue}`, color: T.cream, textDecoration: "none", borderRadius: 8, padding: "7px 12px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 11.5 }}>
                          Ver no Maps
                        </a>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            value={kmValue}
                            onChange={(e) => setKmDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                            onBlur={() => {
                              if (kmValue !== (d.km != null ? String(d.km) : "")) updateDeliveryOrder(d.customerId, d.id, { km: parseFloat(kmValue.replace(",", ".")) || null });
                            }}
                            placeholder="km"
                            style={{ ...inputStyle, width: 64, padding: "7px 8px", fontSize: 12 }}
                          />
                          <span style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 11.5 }}>km →</span>
                          <span style={{ color: fee ? T.teal : T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, fontWeight: 700 }}>{fee != null ? fmt(fee) : "a combinar"}</span>
                        </div>
                        <button
                          onClick={() => updateDeliveryOrder(d.customerId, d.id, { deliveryStatus: "entregue", status: "concluido", km: parseFloat(kmValue.replace(",", ".")) || d.km, deliveryFee: fee })}
                          style={{ marginLeft: "auto", background: T.terracotta, color: T.cream, border: "none", borderRadius: 8, padding: "7px 14px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
                        >
                          Marcar entregue
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {routeSelection.length > 0 && (
              <div style={{ position: "fixed", bottom: 18, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 30, padding: "0 20px" }}>
                <div style={{ background: T.surface, border: `1px solid ${T.teal}`, borderRadius: 16, padding: "12px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", maxWidth: 640, width: "100%", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, color: T.cream, fontWeight: 700 }}>{routeSelection.length} parada{routeSelection.length === 1 ? "" : "s"} na rota:</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                    {routeSelection.map((key, idx) => {
                      const d = pendingDeliveries.find((p) => `${p.customerId}-${p.id}` === key);
                      if (!d) return null;
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(72,168,174,0.15)", borderRadius: 999, padding: "4px 8px" }}>
                          <span style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11, color: T.cream }}>{idx + 1}. {d.customerName.split(" ")[0]}</span>
                          <button onClick={() => moveRouteStop(idx, -1)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 11, padding: 0 }}>↑</button>
                          <button onClick={() => moveRouteStop(idx, 1)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 11, padding: 0 }}>↓</button>
                        </div>
                      );
                    })}
                  </div>
                  <a
                    href={gmapsRoute(settings.deliveryBase.address, routeSelection.map((key) => pendingDeliveries.find((p) => `${p.customerId}-${p.id}` === key)?.address).filter(Boolean))}
                    target="_blank"
                    rel="noreferrer"
                    style={{ background: T.terracotta, color: T.cream, textDecoration: "none", borderRadius: 10, padding: "9px 16px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, whiteSpace: "nowrap" }}
                  >
                    Abrir rota no Maps
                  </a>
                  <button onClick={() => setRouteSelection([])} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 12 }}>
                    limpar
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: "'Amarante', serif", fontSize: 26, color: T.cream, margin: "0 0 20px" }}>Configurações</h1>

            <div style={{ background: T.surface, borderRadius: 14, padding: 20, border: "1px solid rgba(218,200,155,0.08)", maxWidth: 400 }}>
              <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14, color: T.cream, marginBottom: 6 }}>Clube La Dolina · Cashback</div>
              <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.5 }}>
                Porcentagem devolvida em cashback a cada pedido finalizado na loja. Aparece automaticamente no banner do Clube e no checkout.
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    value={cashbackDraft}
                    onChange={(e) => setCashbackDraft(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 30 }}
                    inputMode="decimal"
                  />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 13 }}>%</span>
                </div>
                <button
                  onClick={saveCashbackPercent}
                  style={{ background: T.terracotta, color: T.cream, border: "none", borderRadius: 8, padding: "11px 20px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Salvar
                </button>
              </div>
              <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 11.5, color: T.teal, marginTop: 12 }}>
                Valor atual em uso: {settings.cashbackPercent}%
              </div>
            </div>

            <div style={{ background: T.surface, borderRadius: 14, padding: 20, border: "1px solid rgba(218,200,155,0.08)", maxWidth: 440, marginTop: 20 }}>
              <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 14, color: T.cream, marginBottom: 6 }}>Entrega · ponto de saída e faixas de km</div>
              <div style={{ fontFamily: "'Open Sans', sans-serif", fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.5 }}>
                A distância de cada entrega ainda é preenchida à mão (conferindo no Maps) — roteirização automática por GPS depende de uma API paga, que fica pra quando vocês ligarem isso.
              </div>

              <Field label="Endereço de saída">
                <input style={inputStyle} value={baseAddressDraft} onChange={(e) => setBaseAddressDraft(e.target.value)} />
              </Field>

              <div style={{ fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12, color: T.cream, marginBottom: 8 }}>Faixas de distância e taxa</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {tiersDraft.map((t, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12, whiteSpace: "nowrap" }}>até</span>
                    <input value={t.km} onChange={(e) => updateTierDraft(idx, "km", e.target.value)} style={{ ...inputStyle, width: 60, padding: "8px 10px" }} />
                    <span style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12 }}>km →</span>
                    <span style={{ color: T.muted, fontFamily: "'Open Sans', sans-serif", fontSize: 12 }}>R$</span>
                    <input value={t.fee} onChange={(e) => updateTierDraft(idx, "fee", e.target.value)} style={{ ...inputStyle, width: 70, padding: "8px 10px" }} />
                    <button onClick={() => removeTierRow(idx)} style={{ background: "none", border: "1px solid rgba(218,200,155,0.2)", color: T.muted, borderRadius: 8, padding: "6px 10px", cursor: "pointer", marginLeft: "auto" }}>
                      remover
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={addTierRow} style={{ background: "none", border: `1px dashed ${T.teal}`, color: T.teal, borderRadius: 8, padding: "9px 14px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                  + faixa
                </button>
                <button onClick={saveDeliveryConfig} style={{ background: T.terracotta, color: T.cream, border: "none", borderRadius: 8, padding: "9px 18px", fontFamily: "'Open Sans', sans-serif", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                  Salvar
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {draft && <ProductForm draft={draft} setDraft={setDraft} categories={categories} onSave={saveDraft} onCancel={() => setDraft(null)} onDelete={deleteDraft} onAddCategory={addCategory} />}
      {custDraft && <CustomerForm draft={custDraft} setDraft={setCustDraft} onSave={saveCustomerDraft} onCancel={() => setCustDraft(null)} onDelete={deleteCustomerDraft} />}
      {eventDraft && <EventForm draft={eventDraft} setDraft={setEventDraft} onSave={saveEventDraft} onCancel={() => setEventDraft(null)} onDelete={deleteEventDraft} />}
      {campaignEvent && <CampaignModal event={campaignEvent} customers={customers} onClose={() => setCampaignEvent(null)} />}
    </div>
  );
}

/* ============================================================
   APP — shares products/categories between Loja and Retaguarda
   ============================================================ */

export default function LaDolinaApp() {
  const [view, setView] = useState("loja");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [customDates, setCustomDates] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState(null); // { accessToken, email }

  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = FONTS + `
      * { box-sizing: border-box; }
      body { margin: 0; }
      ::selection { background: rgba(169,130,31,0.3); }
      .hide-scrollbar::-webkit-scrollbar { display: none; }
      select option { background: ${T.void}; }
    `;
    document.head.appendChild(styleTag);
    return () => document.head.removeChild(styleTag);
  }, []);

  const loadAll = async () => {
    try {
      const [prodRows, catRows, custRows, orderRows, settingsRows, dateRows] = await Promise.all([
        sb.select("products"),
        sb.select("categories"),
        sb.select("customers"),
        sb.select("orders"),
        sb.select("settings"),
        sb.select("custom_dates"),
      ]);
      const ordersMapped = (orderRows || []).map(dbToOrder);
      const customersMapped = (custRows || []).map(dbToCustomer).map((c) => ({ ...c, orders: ordersMapped.filter((o) => o.customerId === c.id) }));
      setProducts((prodRows || []).map(dbToProduct));
      setCategories(catRows || []);
      setCustomers(customersMapped);
      setSettings(settingsRows && settingsRows[0] ? dbToSettings(settingsRows[0]) : DEFAULT_SETTINGS);
      setCustomDates((dateRows || []).map(dbToCustomDate));
      setLoadError(null);
    } catch (e) {
      console.error("Erro ao carregar dados do Supabase:", e);
      setLoadError(String(e.message || e));
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ---- Auth (retaguarda) -----------------------------------------------------
  const signIn = async (email, password) => {
    const data = await sb.signIn(email, password);
    setSession({ accessToken: data.access_token, email: data.user?.email || email });
  };
  const signOut = () => setSession(null);
  const adminToken = session?.accessToken;

  // ---- Produtos (admin) -------------------------------------------------------
  const addProduct = async (product) => {
    setSaving(true);
    try {
      const [row] = await sb.insert("products", [productToDb(product)], adminToken);
      setProducts((prev) => [...prev, dbToProduct(row)]);
    } finally {
      setSaving(false);
    }
  };
  const updateProduct = async (id, patch) => {
    setSaving(true);
    try {
      await sb.update("products", id, productToDb(patch), adminToken);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    } finally {
      setSaving(false);
    }
  };
  const deleteProduct = async (id) => {
    setSaving(true);
    try {
      await sb.delete("products", id, adminToken);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setSaving(false);
    }
  };

  // ---- Categorias --------------------------------------------------------
  const addCategory = async (label) => {
    const id = slugify(label) || `cat-${Date.now()}`;
    if (categories.some((c) => c.id === id)) return id;
    await sb.insert("categories", [{ id, label }], adminToken);
    setCategories((prev) => [...prev, { id, label }]);
    return id;
  };

  // ---- Clientes -----------------------------------------------------------
  const addCustomer = async (customer, token = adminToken) => {
    const [row] = await sb.insert("customers", [customerToDb(customer)], token);
    const created = { ...dbToCustomer(row), orders: [] };
    setCustomers((prev) => [...prev, created]);
    return created;
  };
  const updateCustomer = async (id, patch, token = adminToken) => {
    await sb.update("customers", id, customerToDb({ ...patch }), token);
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const deleteCustomer = async (id) => {
    await sb.delete("customers", id, adminToken);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };
  const importCustomers = async (rows) => {
    // upsert one by one by phone (simplest & safe with our REST helper)
    let created = 0, updated = 0, skipped = 0;
    for (const row of rows) {
      const phone = onlyDigits(row.phone || "");
      if (phone.length < 10) { skipped++; continue; }
      const existing = customers.find((c) => onlyDigits(c.phone) === phone);
      if (existing) {
        await updateCustomer(existing.id, { name: row.name || existing.name, birthday: row.birthday || existing.birthday, address: row.address || existing.address });
        updated++;
      } else {
        await addCustomer({ name: row.name || "Sem nome", phone, birthday: row.birthday, address: row.address, cep: "", clubMember: false, cashbackBalance: 0 });
        created++;
      }
    }
    return { created, updated, skipped };
  };

  // ---- Pedidos --------------------------------------------------------------
  const updateOrder = async (orderId, patch) => {
    await sb.update("orders", orderId, orderToDb(patch), adminToken);
    setCustomers((prev) => prev.map((c) => ({ ...c, orders: c.orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o)) })));
  };

  // ---- Configurações --------------------------------------------------------
  const updateSettings = async (next) => {
    await sb.update("settings", 1, settingsToDb(next), adminToken, "id");
    setSettings(next);
  };

  // ---- Datas especiais --------------------------------------------------------
  const addCustomDate = async (event) => {
    const [row] = await sb.insert("custom_dates", [customDateToDb(event)], adminToken);
    setCustomDates((prev) => [...prev, dbToCustomDate(row)]);
  };
  const updateCustomDate = async (id, patch) => {
    await sb.update("custom_dates", id, customDateToDb(patch), adminToken);
    setCustomDates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const deleteCustomDate = async (id) => {
    await sb.delete("custom_dates", id, adminToken);
    setCustomDates((prev) => prev.filter((c) => c.id !== id));
  };

  // Called by the storefront when an order is finalized: creates the customer if new,
  // or updates their existing record (matched by phone number), then inserts the order.
  // Uses the public anon key — no login needed for a customer to check out.
  const upsertCustomerFromOrder = async ({ name, phone, address, cashbackUsed = 0, cashbackEarned = 0, order }) => {
    const digits = onlyDigits(phone);
    const existing = customers.find((c) => onlyDigits(c.phone) === digits);
    let customerId;
    if (existing) {
      const newBalance = Math.max(0, (existing.cashbackBalance || 0) - cashbackUsed) + cashbackEarned;
      await updateCustomer(existing.id, { name: name || existing.name, address: address || existing.address, cashbackBalance: Math.round(newBalance * 100) / 100 }, SUPABASE_ANON_KEY);
      customerId = existing.id;
    } else {
      const created = await addCustomer({ name, phone: digits, birthday: null, address: address || "", cep: "", clubMember: false, cashbackBalance: cashbackEarned }, SUPABASE_ANON_KEY);
      customerId = created.id;
    }
    const [orderRow] = await sb.insert("orders", [orderToDb(order, customerId)], SUPABASE_ANON_KEY);
    const newOrder = dbToOrder(orderRow);
    setCustomers((prev) => prev.map((c) => (c.id === customerId ? { ...c, orders: [...c.orders, newOrder] } : c)));
  };

  // Called from the "Quero fazer parte" club signup: marks/creates the customer as a club member.
  const joinClub = async ({ name, phone, birthday, address }) => {
    const digits = onlyDigits(phone);
    const existing = customers.find((c) => onlyDigits(c.phone) === digits);
    if (existing) {
      await updateCustomer(existing.id, { name: name || existing.name, birthday: birthday || existing.birthday, address: address || existing.address, clubMember: true }, SUPABASE_ANON_KEY);
    } else {
      await addCustomer({ name, phone: digits, birthday: birthday || null, address: address || "", cep: "", clubMember: true, cashbackBalance: 0 }, SUPABASE_ANON_KEY);
    }
  };

  if (!loaded) {
    return (
      <div style={{ background: T.void, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontFamily: "'Open Sans', sans-serif" }}>
        Carregando La Dolina...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ background: T.void, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.cream, fontFamily: "'Open Sans', sans-serif", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Não consegui conectar ao banco de dados.</div>
          <div style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>{loadError}</div>
          <button onClick={loadAll} style={{ background: T.terracotta, color: T.cream, border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 60, display: "flex", background: "rgba(25,23,22,0.9)", border: "1px solid rgba(218,200,155,0.25)", borderRadius: 999, padding: 3, gap: 2, backdropFilter: "blur(6px)" }}>
        {[{ id: "loja", label: "Loja" }, { id: "retaguarda", label: "Retaguarda" }].map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            style={{
              background: view === v.id ? T.terracotta : "transparent",
              color: view === v.id ? T.cream : T.muted,
              border: "none",
              borderRadius: 999,
              padding: "7px 14px",
              fontFamily: "'Open Sans', sans-serif",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "loja" ? (
        <Storefront products={products} categories={categories} customers={customers} settings={settings} onOrderFinalized={upsertCustomerFromOrder} onJoinClub={joinClub} />
      ) : !session ? (
        <LoginScreen onSignIn={signIn} />
      ) : (
        <Retaguarda
          products={products}
          categories={categories}
          customers={customers}
          settings={settings}
          customDates={customDates}
          saving={saving}
          session={session}
          onSignOut={signOut}
          onAddProduct={addProduct}
          onUpdateProduct={updateProduct}
          onDeleteProduct={deleteProduct}
          onAddCategory={addCategory}
          onAddCustomer={(c) => addCustomer(c)}
          onUpdateCustomer={updateCustomer}
          onDeleteCustomer={deleteCustomer}
          onImportCustomers={importCustomers}
          onUpdateOrder={updateOrder}
          onUpdateSettings={updateSettings}
          onAddCustomDate={addCustomDate}
          onUpdateCustomDate={updateCustomDate}
          onDeleteCustomDate={deleteCustomDate}
        />
      )}
    </div>
  );
}
