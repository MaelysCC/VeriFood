import React, { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Search, ShieldAlert, Refrigerator, Trash2, ScanLine, Database, Clock3 } from "lucide-react";

const PRODUCTS = [
  {
    gtin: "3274080005003",
    name: "Lait demi-écrémé UHT",
    brand: "DemoFerme",
    category: "Produits laitiers",
    recalled: false,
    riskLevel: "Faible",
    storage: "À conserver dans un endroit sec avant ouverture, puis 3 jours au réfrigérateur après ouverture.",
    expiryAdvice: "Vérifier la DLC après ouverture.",
    purchasedAt: null,
  },
  {
    gtin: "3560070976804",
    name: "Fromage frais au lait cru",
    brand: "DemoTerroir",
    category: "Fromages",
    recalled: true,
    riskLevel: "Élevé",
    risk: "Listeria monocytogenes",
    recallReason: "Suspicion de contamination microbiologique.",
    publishedAt: "2026-04-10",
    storage: "Conserver entre 0°C et 4°C. Ne pas consommer si rappel actif.",
    expiryAdvice: "Produit sensible, éviter toute consommation en cas de doute.",
    purchasedAt: null,
  },
  {
    gtin: "3017620422003",
    name: "Pâte à tartiner noisette",
    brand: "DemoChoco",
    category: "Épicerie",
    recalled: false,
    riskLevel: "Faible",
    storage: "À conserver à température ambiante, à l’abri de la chaleur.",
    expiryAdvice: "Bien refermer après ouverture.",
    purchasedAt: null,
  },
  {
    gtin: "5449000000996",
    name: "Boisson gazeuse citron",
    brand: "DemoFizz",
    category: "Boissons",
    recalled: false,
    riskLevel: "Moyen",
    storage: "Conserver au frais après ouverture et consommer dans les 48 h.",
    expiryAdvice: "Ne pas boire si l’emballage est gonflé ou abîmé.",
    purchasedAt: null,
  },
];

const UPCOMING_ALERTS = [
  {
    gtin: "3274080005003",
    name: "Lait demi-écrémé UHT",
    brand: "DemoFerme",
    publishedAt: "2026-04-14",
    risk: "Corps étrangers plastiques",
    recallReason: "Défaut d’emballage détecté après mise sur le marché.",
  },
];

function badgeClasses(kind) {
  if (kind === "danger") return "bg-red-100 text-red-700 border-red-200";
  if (kind === "warn") return "bg-amber-100 text-amber-700 border-amber-200";
  if (kind === "success") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function riskKind(level) {
  if (level === "Élevé") return "danger";
  if (level === "Moyen") return "warn";
  return "success";
}

function ProductCard({ product, onAddToPantry }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">GTIN {product.gtin}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{product.name}</h3>
          <p className="text-sm text-slate-600">{product.brand} · {product.category}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeClasses(product.recalled ? "danger" : "success")}`}>
          {product.recalled ? "Rappel actif" : "Aucun rappel"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeClasses(riskKind(product.riskLevel))}`}>
          Risque {product.riskLevel}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
          Conseil conservation disponible
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-700">
        {product.recalled ? (
          <>
            <p><span className="font-semibold">Risque :</span> {product.risk}</p>
            <p><span className="font-semibold">Motif :</span> {product.recallReason}</p>
            <p><span className="font-semibold">Publié le :</span> {product.publishedAt}</p>
          </>
        ) : (
          <p>Ce produit ne présente pas de rappel actif dans cette démo.</p>
        )}
        <p><span className="font-semibold">Conservation :</span> {product.storage}</p>
        <p><span className="font-semibold">Conseil :</span> {product.expiryAdvice}</p>
      </div>

      <button
        onClick={() => onAddToPantry(product)}
        className="mt-5 inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
      >
        Ajouter au garde-manger
      </button>
    </div>
  );
}

export default function DemoApp() {
  const [barcode, setBarcode] = useState("");
  const [selected, setSelected] = useState(null);
  const [pantry, setPantry] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [query, setQuery] = useState("");

  const filteredPantry = useMemo(() => {
    return pantry.filter((item) =>
      `${item.name} ${item.brand} ${item.gtin}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [pantry, query]);

  const handleScan = (value = barcode) => {
    const clean = value.trim();
    if (!clean) return;
    const match = PRODUCTS.find((p) => p.gtin === clean);
    if (match) {
      setSelected(match);
    } else {
      setSelected({
        gtin: clean,
        name: "Produit inconnu dans la démo",
        brand: "—",
        category: "—",
        recalled: false,
        riskLevel: "Moyen",
        storage: "Aucune donnée locale. Dans une vraie version, l’app interrogerait RappelConso et une base nutrition/conservation.",
        expiryAdvice: "Vérifier manuellement l’emballage et les conditions de stockage.",
      });
    }
  };

  const addToPantry = (product) => {
    const exists = pantry.some((p) => p.gtin === product.gtin);
    if (exists) return;
    setPantry((prev) => [{ ...product, purchasedAt: new Date().toLocaleString("fr-FR") }, ...prev]);
  };

  const removeFromPantry = (gtin) => {
    setPantry((prev) => prev.filter((p) => p.gtin !== gtin));
  };

  const simulateRecallCheck = () => {
    const foundAlerts = pantry
      .map((item) => {
        const match = UPCOMING_ALERTS.find((alert) => alert.gtin === item.gtin);
        return match ? { ...match, scannedProduct: item.name } : null;
      })
      .filter(Boolean);

    if (foundAlerts.length === 0) {
      setNotifications([
        {
          id: Date.now(),
          title: "Aucun nouveau rappel",
          body: "Aucun des produits suivis dans votre garde-manger n’a été rappelé dans cette simulation.",
          type: "success",
        },
      ]);
      return;
    }

    setNotifications(
      foundAlerts.map((alert, index) => ({
        id: Date.now() + index,
        title: `Alerte rappel : ${alert.name}`,
        body: `${alert.risk} · ${alert.recallReason} · publié le ${alert.publishedAt}`,
        type: "danger",
      }))
    );
  };

  const quickScanButtons = PRODUCTS.map((p) => (
    <button
      key={p.gtin}
      onClick={() => {
        setBarcode(p.gtin);
        handleScan(p.gtin);
      }}
      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
    >
      <span className="block font-medium text-slate-900">{p.name}</span>
      <span className="block text-xs text-slate-500">{p.gtin}</span>
    </button>
  ));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl p-6 md:p-10">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  <ShieldAlert className="h-4 w-4" /> Démo VigiFood
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Scanner, surveiller, alerter</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                  Cette démo illustre le scénario de votre cahier des charges : scan d’un produit,
                  vérification d’un rappel, ajout au garde-manger numérique, puis réception d’une alerte
                  si un rappel survient après l’achat.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-slate-500"><Database className="h-4 w-4" /> Source</div>
                  <div className="mt-2 font-semibold">Rappels + produits</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-slate-500"><Bell className="h-4 w-4" /> Fonction</div>
                  <div className="mt-2 font-semibold">Veille continue</div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="relative">
                <ScanLine className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Entrer un code-barres GTIN, par ex. 3560070976804"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm outline-none ring-0 transition focus:border-slate-400"
                />
              </div>
              <button
                onClick={() => handleScan()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                <Search className="h-4 w-4" /> Scanner
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {quickScanButtons}
            </div>

            <div className="mt-8">
              {selected ? (
                <ProductCard product={selected} onAddToPantry={addToPantry} />
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
                  Sélectionne un produit de démo ou entre un GTIN pour afficher sa fiche.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Garde-manger numérique</h2>
                  <p className="mt-1 text-sm text-slate-600">Produits suivis après achat</p>
                </div>
                <button
                  onClick={simulateRecallCheck}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                >
                  <Clock3 className="h-4 w-4" /> Simuler une veille
                </button>
              </div>

              <div className="mt-4 relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher dans le garde-manger"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="mt-4 space-y-3">
                {filteredPantry.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Aucun produit suivi pour le moment.
                  </div>
                ) : (
                  filteredPantry.map((item) => (
                    <div key={item.gtin} className="rounded-3xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Refrigerator className="mt-0.5 h-4 w-4 text-slate-400" />
                            <p className="font-medium text-slate-900">{item.name}</p>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{item.brand} · GTIN {item.gtin}</p>
                          <p className="mt-2 text-xs text-slate-500">Ajouté le {item.purchasedAt}</p>
                        </div>
                        <button
                          onClick={() => removeFromPantry(item.gtin)}
                          className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                          aria-label={`Supprimer ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Centre d’alertes</h2>
              <p className="mt-1 text-sm text-slate-600">Notifications simulées après synchronisation</p>

              <div className="mt-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Pas encore d’alerte. Lance une veille pour simuler l’arrivée d’un rappel.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="rounded-3xl border border-slate-200 p-4">
                      <div className="flex items-start gap-3">
                        {n.type === "danger" ? (
                          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                        )}
                        <div>
                          <p className="font-medium text-slate-900">{n.title}</p>
                          <p className="mt-1 text-sm text-slate-600">{n.body}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
