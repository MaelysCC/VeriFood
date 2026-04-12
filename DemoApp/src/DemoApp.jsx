import React, { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Search, ShieldAlert, Refrigerator, Trash2, ScanLine, Database, Clock3 } from "lucide-react";

const PRODUCTS = [
  {
    gtin: "3560070976804",
    name: "Fromage frais au lait cru",
    brand: "DemoTerroir",
    recalled: true,
    image: "/fromage.png",
    top: "90px",
    left: "35px",
  },
  {
    gtin: "3017620422003",
    name: "Salade",
    brand: "DemoFresh",
    recalled: false,
    image: "/salade.png",
    top: "95px",
    left: "175px",
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
  <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
    <div className="w-[320px] h-[640px] rounded-[32px] border-[8px] border-emerald-800 bg-white shadow-2xl overflow-hidden flex flex-col">
      
      {/* Header téléphone */}
      <div className="bg-white px-3 pt-3 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="rounded-full bg-lime-400 px-4 py-2">
            <span className="text-xl font-bold italic text-black">VigiFood</span>
          </div>
          <div className="w-20 h-4 bg-black rounded-full"></div>
        </div>

        <div className="mt-3 flex justify-center">
          <div className="relative w-[130px] h-[90px]">
            <div className="absolute left-0 top-0 h-6 w-6 border-l-[5px] border-t-[5px] border-slate-700"></div>
            <div className="absolute right-0 top-0 h-6 w-6 border-r-[5px] border-t-[5px] border-slate-700"></div>
            <div className="absolute left-0 bottom-0 h-6 w-6 border-l-[5px] border-b-[5px] border-slate-700"></div>
            <div className="absolute right-0 bottom-0 h-6 w-6 border-r-[5px] border-b-[5px] border-slate-700"></div>

            <div className="absolute left-1/2 top-3 -translate-x-1/2 w-[56px] h-[34px] bg-[repeating-linear-gradient(to_right,black,black_2px,white_2px,white_4px)]"></div>
            <div className="absolute left-1/2 top-[46px] -translate-x-1/2 w-[80px] h-1 bg-red-500"></div>
            <div className="absolute left-1/2 bottom-1 -translate-x-1/2 text-[10px] font-mono bg-white px-1 text-slate-700">
              {barcode || "00000 00001"}
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Code-barres GTIN"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs outline-none"
            />
          </div>
          <button
            onClick={() => handleScan()}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white"
          >
            Scanner
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {quickScanButtons}
        </div>
      </div>

      {/* Frigo */}
      <div
        className="relative flex-1 bg-cover bg-center overflow-hidden"
        style={{ backgroundImage: "url('/fridge.png')" }}
      >
        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="absolute top-2 left-2 right-2 z-20 space-y-2">
            {notifications.slice(0, 2).map((n) => (
              <div
                key={n.id}
                className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-md"
              >
                <div className="flex items-start gap-2">
                  {n.type === "danger" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  )}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-900">{n.title}</p>
                    <p className="text-[10px] text-slate-600">{n.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Produits */}
        {filteredPantry.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="rounded-2xl bg-white/85 px-4 py-2 text-xs text-slate-700 shadow">
              Aucun produit dans le garde-manger.
            </div>
          </div>
        ) : (
          filteredPantry.map((item, index) => {
            const positions = [
              { top: "52px", left: "28px" },
              { top: "52px", left: "184px" },
              { top: "168px", left: "24px" },
              { top: "168px", left: "184px" },
              { top: "284px", left: "24px" },
              { top: "284px", left: "184px" },
            ];

            const pos = positions[index % positions.length];

            return (
              <div
                key={item.gtin}
                className={`absolute w-[62px] h-[62px] rounded-md overflow-hidden shadow-md border-4 ${
                  item.recalled ? "border-red-500" : "border-emerald-500"
                } bg-white`}
                style={{ top: pos.top, left: pos.left }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-[9px] text-center text-slate-600 p-1">
                    {item.name}
                  </div>
                )}

                <button
                  onClick={() => removeFromPantry(item.gtin)}
                  className="absolute top-0 right-0 bg-white/90 rounded-bl px-1"
                >
                  <Trash2 className="h-3 w-3 text-slate-600" />
                </button>
              </div>
            );
          })
        )}

        {/* Carte produit sélectionné */}
        {selected && (
          <div className="absolute left-3 right-3 bottom-3 z-20 rounded-2xl bg-white/95 p-3 shadow-lg border border-slate-200">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{selected.name}</p>
                <p className="text-[11px] text-slate-600 truncate">
                  {selected.brand} · GTIN {selected.gtin}
                </p>
                <p
                  className={`mt-1 text-[11px] font-medium ${
                    selected.recalled ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {selected.recalled ? "Produit rappelé" : "Produit sans rappel actif"}
                </p>
              </div>

              <button
                onClick={() => addToPantry(selected)}
                className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-medium text-white"
              >
                Ajouter
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bas */}
      <div className="bg-white border-t border-slate-200 px-3 py-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={simulateRecallCheck}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"
          >
            Simuler une veille
          </button>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            {filteredPantry.length} produit{filteredPantry.length > 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  </div>
);}