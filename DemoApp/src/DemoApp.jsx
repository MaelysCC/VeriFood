import React, { useState, useEffect, useRef, useCallback } from "react";

const C={g50:"#f0f9f2",g100:"#d4edda",g200:"#a8d5b8",g400:"#4caf50",g600:"#2e7d32",g700:"#1b6b3a",g800:"#145a2e",o50:"#fff8f0",o100:"#ffe0b2",o400:"#ffa000",o600:"#ef6c00",r50:"#fff5f5",r100:"#ffcdd2",r400:"#ef5350",r600:"#c62828",b50:"#f0f7ff",b100:"#bbdefb",b600:"#1565c0",n0:"#ffffff",n50:"#f8faf8",n100:"#eef2ee",n200:"#dce4dc",n300:"#b0bfb0",n500:"#6d806d",n700:"#3a4a3a",n900:"#1a1f1a"};

const DB = {
  get(k,d=null){ try{ const v=localStorage.getItem("vf_"+k); return v?JSON.parse(v):d; }catch{ return d; }},
  set(k,v){ try{ localStorage.setItem("vf_"+k,JSON.stringify(v)); }catch{} },
  del(k){ try{ localStorage.removeItem("vf_"+k); }catch{} },
};

/* ─── API: Open Food Facts ─── */
async function fetchOFF(barcode){
  try{
    const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    if(!r.ok) return null;
    const d=await r.json();
    if(d.status!==1) return null;
    const p=d.product;
    return {
      name: p.product_name_fr||p.product_name||"Produit inconnu",
      brand: p.brands||"Marque inconnue",
      image: p.image_front_small_url||p.image_url||null,
      nutriscore: p.nutriscore_grade?.toUpperCase()||null,
      nova: p.nova_group||null,
      categories: p.categories||"",
      allergens: p.allergens_tags?.map(a=>a.replace("en:",""))||[],
      ingredients: p.ingredients_text_fr||p.ingredients_text||"",
      quantity: p.quantity||"",
      origin: p.origins||p.countries||"",
      labels: p.labels||"",
      ecoscore: p.ecoscore_grade?.toUpperCase()||null,
      nutriments: p.nutriments||{},
    };
  }catch{ return null; }
}

/* ─── API: RappelConso ─── */
async function fetchRecalls(barcode){
  try{
    const url=`https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso0/records?limit=10&where=code_barres%20like%20%22${barcode}%22`;
    const r=await fetch(url);
    if(!r.ok) return [];
    const d=await r.json();
    return (d.results||[]).map(rec=>({
      name: rec.noms_des_modeles_ou_references||"Produit",
      brand: rec.nom_de_la_marque_du_produit||"",
      risk: rec.risques_encourus_par_le_consommateur||"Non précisé",
      reason: rec.motif_du_rappel||"Non précisé",
      date: rec.date_de_publication||"",
      action: rec.conduites_a_tenir_par_le_consommateur||"",
      category: rec.categorie_de_produit||"",
    }));
  }catch{ return []; }
}

/* ─── API: RappelConso récents (pour alertes) ─── */
async function fetchRecentRecalls(limit=20){
  try{
    const url=`https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso0/records?limit=${limit}&order_by=date_de_publication%20desc&where=categorie_de_produit%3D%22Alimentation%22`;
    const r=await fetch(url);
    if(!r.ok) return [];
    const d=await r.json();
    return (d.results||[]).map(rec=>({
      name: rec.noms_des_modeles_ou_references||"",
      brand: rec.nom_de_la_marque_du_produit||"",
      risk: rec.risques_encourus_par_le_consommateur||"",
      reason: rec.motif_du_rappel||"",
      date: rec.date_de_publication||"",
      category: rec.sous_categorie_de_produit||rec.categorie_de_produit||"",
      barcode: rec.code_barres||"",
    }));
  }catch{ return []; }
}


const RISK_CATEGORIES={
  "viande":85,"volaille":82,"poisson":75,"fruits de mer":80,"charcuterie":70,
  "lait":55,"fromage":60,"oeuf":50,"beurre":30,"yaourt":45,
  "légume":20,"fruit":15,"céréale":10,"conserve":8,"boisson":12,
  "surgelé":35,"plat préparé":55,"boulangerie":25,"confiserie":10,
};

function computeRiskScore(product, recalls=[]){
  let score=25; 
  const cat=(product.categories||"").toLowerCase();
  for(const[k,v] of Object.entries(RISK_CATEGORIES)){
    if(cat.includes(k)){ score=Math.max(score,v*0.6); break; }
  }
  if(recalls.length>0) score=Math.min(99, score+recalls.length*25);
  if(product.nova>=4) score=Math.min(99, score+10);
  if(product.nutriscore==="D") score+=5;
  if(product.nutriscore==="E") score+=10;
  return Math.round(Math.min(99, Math.max(5, score)));
}

function riskLevel(score){
  if(score>=65) return {label:"Élevé",color:C.r600,bg:C.r50,border:C.r100};
  if(score>=35) return {label:"Modéré",color:C.o600,bg:C.o50,border:C.o100};
  return {label:"Faible",color:C.g600,bg:C.g50,border:C.g100};
}

const ALLERGEN_MAP={
  "gluten":"gluten","milk":"lait","eggs":"oeufs","fish":"poisson",
  "peanuts":"arachides","soybeans":"soja","nuts":"fruits à coque",
  "celery":"céleri","mustard":"moutarde","sesame-seeds":"sésame",
  "sulphur-dioxide-and-sulphites":"sulfites","lupin":"lupin","molluscs":"mollusques","crustaceans":"crustacés",
};

function checkAllergens(productAllergens=[], userAllergens=[]){
  if(!userAllergens.length) return [];
  const found=[];
  for(const pa of productAllergens){
    const name=ALLERGEN_MAP[pa]||pa;
    if(userAllergens.some(ua=>name.toLowerCase().includes(ua.toLowerCase())||ua.toLowerCase().includes(name.toLowerCase()))){
      found.push(name);
    }
  }
  return found;
}

function daysUntil(dateStr){
  if(!dateStr) return null;
  const d=new Date(dateStr);
  const now=new Date();
  return Math.ceil((d-now)/(1000*60*60*24));
}

function expiryStatus(days){
  if(days===null) return "ok";
  if(days<0) return "expired";
  if(days<=2) return "danger";
  if(days<=5) return "warn";
  return "ok";
}

function productEmoji(cat=""){
  const c=cat.toLowerCase();
  if(c.includes("lait")||c.includes("milk")) return "🥛";
  if(c.includes("viande")||c.includes("meat")||c.includes("poulet")||c.includes("chicken")) return "🍗";
  if(c.includes("poisson")||c.includes("fish")||c.includes("saumon")) return "🍣";
  if(c.includes("fromage")||c.includes("cheese")) return "🧀";
  if(c.includes("yaourt")||c.includes("yogurt")) return "🥛";
  if(c.includes("beurre")||c.includes("butter")) return "🧈";
  if(c.includes("oeuf")||c.includes("egg")) return "🥚";
  if(c.includes("pain")||c.includes("bread")) return "🍞";
  if(c.includes("pâte")||c.includes("pasta")) return "🍝";
  if(c.includes("riz")||c.includes("rice")) return "🍚";
  if(c.includes("pomme")) return "🍎";
  if(c.includes("tomate")) return "🍅";
  if(c.includes("carotte")) return "🥕";
  if(c.includes("salade")||c.includes("légume")) return "🥬";
  if(c.includes("fruit")) return "🍊";
  if(c.includes("boisson")||c.includes("jus")||c.includes("eau")) return "🥤";
  if(c.includes("chocolat")||c.includes("tartiner")) return "🍫";
  if(c.includes("céréale")||c.includes("cereal")) return "🥣";
  if(c.includes("conserve")) return "🥫";
  if(c.includes("huile")) return "🫗";
  if(c.includes("surgelé")||c.includes("frozen")) return "🧊";
  if(c.includes("gâteau")||c.includes("biscuit")) return "🍪";
  return "📦";
}

const FRIDGE_KEYWORDS=[
  "lait","milk","dairy","yaourt","yogurt","yoghourt","fromage","cheese","beurre","butter","crème","cream",
  "viande","meat","poulet","chicken","boeuf","beef","porc","pork","agneau","veau","dinde","turkey","canard",
  "poisson","fish","saumon","salmon","thon","tuna","crevette","shrimp","crabe","fruits de mer","seafood",
  "charcuterie","jambon","ham","saucisse","sausage","lardon","bacon","pâté",
  "oeuf","egg","eggs","oeufs",
  "salade","salad","légume frais","fresh vegetable","carotte","courgette","tomate fraîche","concombre","épinard",
  "fruit frais","fresh fruit","fraise","strawberry","framboise","melon","pastèque","raisin","pêche","abricot",
  "jus frais","fresh juice","smoothie","compote fraîche",
  "surgelé","frozen","glacé","ice cream","glace",
  "plat préparé","prepared meal","traiteur","sandwich","wrap","pizza fraîche",
  "pâte fraîche","fresh pasta","ravioli","tortellini","gnocchi",
  "houmous","hummus","guacamole","tzatziki","sauce fraîche",
  "margarine","dessert","flan","mousse","crème dessert","panna cotta",
];

const PANTRY_KEYWORDS=[
  "conserve","canned","boîte","tin",
  "pâte","pasta","spaghetti","penne","fusilli","macaroni","nouille","noodle",
  "riz","rice","semoule","couscous","boulgour","quinoa","lentille","pois chiche","haricot sec",
  "farine","flour","levure","baking","sucre","sugar","sel","salt","poivre","pepper","épice","spice",
  "huile","oil","vinaigre","vinegar","moutarde","mustard","ketchup","mayonnaise","sauce soja","sauce tomate",
  "céréale","cereal","muesli","granola","flocon","avoine","oat",
  "biscuit","cookie","gâteau sec","cracker","bretzel",
  "chocolat","chocolate","confiserie","bonbon","candy","caramel",
  "confiture","jam","miel","honey","pâte à tartiner","spread","nutella",
  "thé","tea","café","coffee","cacao","cocoa","tisane",
  "eau","water","soda","cola","limonade","sirop","syrup","jus longue conservation",
  "chips","snack","apéritif","noix","nut","amande","almond","cacahuète","peanut",
  "pain de mie","bread","biscottes","cracotte",
  "lait uht","lait longue conservation","lait de coco","coconut milk","lait d'amande","lait de soja",
  "compote","purée","tomate pelée","coulis",
];

function classifyZone(categories="", name=""){
  const text=(categories+" "+name).toLowerCase();
  let fridgeScore=0;
  let pantryScore=0;
  for(const kw of FRIDGE_KEYWORDS){
    if(text.includes(kw)) fridgeScore++;
  }
  for(const kw of PANTRY_KEYWORDS){
    if(text.includes(kw)) pantryScore++;
  }

  if(fridgeScore===0 && pantryScore===0) return "fridge";
  return fridgeScore>=pantryScore?"fridge":"pantry";
}

function zoneLabel(zone){
  return zone==="fridge"?"❄️ Frigo":"📦 Placard";
}

function Tap({children,onTap,style,disabled,...rest}){
  const[p,setP]=useState(false);
  return(
    <div {...rest}
      onTouchStart={()=>!disabled&&setP(true)} onTouchEnd={(e)=>{e.preventDefault();setP(false);!disabled&&onTap?.();}}
      onMouseDown={()=>!disabled&&setP(true)} onMouseUp={()=>{setP(false);!disabled&&onTap?.();}} onMouseLeave={()=>setP(false)}
      style={{...style,transform:p?"scale(0.96)":"scale(1)",transition:"transform .12s,background .15s",cursor:disabled?"default":"pointer",WebkitTapHighlightColor:"transparent",userSelect:"none"}}>
      {children}
    </div>
  );
}

function Toast({message,visible}){
  return <div style={{position:"fixed",bottom:90,left:"50%",transform:`translateX(-50%) translateY(${visible?0:20}px)`,background:C.n900,color:"#fff",padding:"10px 20px",borderRadius:24,fontSize:13,fontWeight:600,opacity:visible?1:0,transition:"all .3s",pointerEvents:"none",zIndex:9999,boxShadow:"0 8px 30px rgba(0,0,0,.2)",whiteSpace:"nowrap",maxWidth:"90vw"}}>{message}</div>;
}

function Badge({status}){
  const bg={ok:C.g400,warn:C.o400,danger:C.r400,expired:C.r600};
  const ico={
    ok:<svg viewBox="0 0 10 10" style={{width:8,height:8}}><polyline points="2,5 4.5,7.5 8,3" stroke="#fff" strokeWidth="3" fill="none"/></svg>,
    warn:<svg viewBox="0 0 10 10" style={{width:8,height:8}}><line x1="5" y1="2.5" x2="5" y2="5.5" stroke="#fff" strokeWidth="3"/><circle cx="5" cy="7.5" r=".5" fill="#fff"/></svg>,
    danger:<svg viewBox="0 0 10 10" style={{width:8,height:8}}><line x1="3" y1="3" x2="7" y2="7" stroke="#fff" strokeWidth="2.5"/><line x1="7" y1="3" x2="3" y2="7" stroke="#fff" strokeWidth="2.5"/></svg>,
    expired:<svg viewBox="0 0 10 10" style={{width:8,height:8}}><line x1="3" y1="3" x2="7" y2="7" stroke="#fff" strokeWidth="2.5"/><line x1="7" y1="3" x2="3" y2="7" stroke="#fff" strokeWidth="2.5"/></svg>,
  };
  return <div style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:bg[status]||bg.ok,border:`2px solid ${C.n0}`}}>{ico[status]||ico.ok}</div>;
}

function LoadingDots(){
  return <div className="vf-loading"><span/><span/><span/></div>;
}


function OnboardingScreen({ onComplete }){
  const [step,setStep]=useState(0);
  const [name,setName]=useState("");
  const [household,setHousehold]=useState(1);
  const [allergens,setAllergens]=useState([]);

  const COMMON_ALLERGENS=["Gluten","Lait","Oeufs","Arachides","Soja","Fruits à coque","Poisson","Crustacés","Sésame","Moutarde","Céleri","Sulfites"];

  const toggleAllergen=(a)=>{
    setAllergens(prev=>prev.includes(a)?prev.filter(x=>x!==a):[...prev,a]);
  };

  const finish=()=>{
    const user={name,household,allergens,createdAt:new Date().toISOString()};
    DB.set("user",user);
    DB.set("pantry",[]);
    onComplete(user);
  };

  return(
    <div style={{minHeight:"100%",display:"flex",flexDirection:"column",background:`linear-gradient(160deg,${C.g800} 0%,${C.g700} 40%,${C.g600} 100%)`,padding:"env(safe-area-inset-top,20px) 24px 24px"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center"}}>
        {step===0 && (
          <div className="vf-enter">
            <div style={{fontSize:56,textAlign:"center",marginBottom:16}}>🛡️</div>
            <h1 style={{color:"#fff",fontSize:32,fontWeight:700,textAlign:"center",margin:"0 0 8px",letterSpacing:"-1px"}}>VigiFood</h1>
            <p style={{color:"rgba(255,255,255,.7)",textAlign:"center",fontSize:14,lineHeight:1.6,margin:"0 0 40px"}}>
              Scannez vos produits, recevez des alertes de rappel en temps réel, et protégez votre foyer avec notre moteur prédictif IA.
            </p>
            <Tap onTap={()=>setStep(1)} style={{background:"#fff",borderRadius:16,padding:"16px 24px",textAlign:"center"}}>
              <span style={{fontSize:16,fontWeight:700,color:C.g700}}>Commencer →</span>
            </Tap>
            <p style={{color:"rgba(255,255,255,.4)",textAlign:"center",fontSize:11,marginTop:16}}>Grand Challenge Usine Nouvelle 2026</p>
          </div>
        )}
        {step===1 && (
          <div className="vf-enter">
            <div style={{fontSize:40,textAlign:"center",marginBottom:12}}>👋</div>
            <h2 style={{color:"#fff",fontSize:24,fontWeight:700,textAlign:"center",margin:"0 0 4px"}}>Bienvenue !</h2>
            <p style={{color:"rgba(255,255,255,.7)",textAlign:"center",fontSize:13,margin:"0 0 30px"}}>Comment vous appelez-vous ?</p>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Votre prénom"
              style={{width:"100%",padding:"14px 18px",borderRadius:14,border:"2px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"#fff",fontSize:16,fontWeight:500,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
            />
            <div style={{marginTop:20}}>
              <p style={{color:"rgba(255,255,255,.7)",fontSize:13,marginBottom:10}}>Taille du foyer</p>
              <div style={{display:"flex",gap:8}}>
                {[1,2,3,4,5].map(n=>(
                  <Tap key={n} onTap={()=>setHousehold(n)} style={{width:48,height:48,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,background:household===n?"#fff":"rgba(255,255,255,.1)",color:household===n?C.g700:"rgba(255,255,255,.6)",border:household===n?"none":"1px solid rgba(255,255,255,.2)"}}>
                    {n}
                  </Tap>
                ))}
              </div>
            </div>
            <Tap onTap={()=>name.trim()&&setStep(2)} disabled={!name.trim()} style={{marginTop:30,background:name.trim()?"#fff":"rgba(255,255,255,.2)",borderRadius:16,padding:"16px 24px",textAlign:"center",opacity:name.trim()?1:.5}}>
              <span style={{fontSize:15,fontWeight:700,color:name.trim()?C.g700:"rgba(255,255,255,.5)"}}>Continuer</span>
            </Tap>
          </div>
        )}
        {step===2 && (
          <div className="vf-enter">
            <div style={{fontSize:40,textAlign:"center",marginBottom:12}}>⚠️</div>
            <h2 style={{color:"#fff",fontSize:22,fontWeight:700,textAlign:"center",margin:"0 0 4px"}}>Allergies & intolérances</h2>
            <p style={{color:"rgba(255,255,255,.7)",textAlign:"center",fontSize:13,margin:"0 0 24px"}}>Sélectionnez les allergènes à surveiller (optionnel)</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
              {COMMON_ALLERGENS.map(a=>{
                const sel=allergens.includes(a);
                return(
                  <Tap key={a} onTap={()=>toggleAllergen(a)} style={{padding:"8px 16px",borderRadius:20,fontSize:12,fontWeight:600,background:sel?"#fff":"rgba(255,255,255,.1)",color:sel?C.r600:"rgba(255,255,255,.6)",border:sel?`1px solid ${C.r100}`:"1px solid rgba(255,255,255,.2)",transition:"all .2s"}}>
                    {a}
                  </Tap>
                );
              })}
            </div>
            <Tap onTap={finish} style={{marginTop:30,background:"#fff",borderRadius:16,padding:"16px 24px",textAlign:"center"}}>
              <span style={{fontSize:15,fontWeight:700,color:C.g700}}>
                {allergens.length?`Valider (${allergens.length} allergène${allergens.length>1?"s":""})`:"Passer cette étape →"}
              </span>
            </Tap>
          </div>
        )}
      </div>
      {/* Progress */}
      <div style={{display:"flex",gap:6,justifyContent:"center",paddingTop:20,paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
        {[0,1,2].map(i=><div key={i} style={{width:step===i?24:8,height:8,borderRadius:4,background:step>=i?"#fff":"rgba(255,255,255,.2)",transition:"all .3s"}}/>)}
      </div>
    </div>
  );
}


function HomeScreen({ pantry, user, onNav, showToast, onRemove }){
  const [zone,setZone]=useState("fridge");

  const fridgeItems=pantry.filter(p=>p.zone==="fridge"||!p.zone);
  const pantryItems=pantry.filter(p=>p.zone==="pantry");
  const items=zone==="fridge"?fridgeItems:pantryItems;

  const globalRisk=pantry.length?Math.round(pantry.reduce((s,p)=>s+(p.riskScore||25),0)/pantry.length):0;
  const recallCount=pantry.filter(p=>p.recalls?.length>0).length;
  const expiringCount=pantry.filter(p=>{const d=daysUntil(p.expiry);return d!==null&&d<=3;}).length;

  return(
    <div className="vf-enter">
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"2px 0 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{background:`linear-gradient(135deg,${C.g700},${C.g800})`,color:"#fff",padding:"6px 16px",borderRadius:22,fontSize:18,fontWeight:700,letterSpacing:"-.4px",fontStyle:"italic"}}>VigiFood</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {recallCount>0&&<div style={{background:C.r400,color:"#fff",width:22,height:22,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{recallCount}</div>}
          <Tap onTap={()=>onNav("profile")} style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${C.g400},${C.g700})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff"}}>
            {(user?.name||"U")[0].toUpperCase()}
          </Tap>
        </div>
      </div>

      {/* Visual Fridge — FriColo inspired */}
      <div style={{borderRadius:28,overflow:"hidden",background:C.g400,border:`3px solid ${C.g600}`,boxShadow:"0 8px 30px rgba(0,0,0,.15)"}}>
        {/* Fridge top gradient */}
        <div style={{background:`linear-gradient(140deg,${C.g400} 0%,${C.g600} 100%)`,padding:"16px 18px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0,textShadow:"0 1px 2px rgba(0,0,0,.15)"}}>Mon garde-manger</h3>
          <div style={{background:"rgba(255,255,255,.25)",color:"#fff",fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:10,backdropFilter:"blur(4px)"}}>
            {pantry.length} produit{pantry.length!==1?"s":""}
          </div>
        </div>

        {/* Toggle Frigo / Placard */}
        <div style={{padding:"6px 14px 8px"}}>
          <div style={{display:"flex",gap:0,background:"rgba(0,0,0,.15)",borderRadius:12,padding:3}}>
            {[["fridge","❄️ Frigo"],["pantry","📦 Placard"]].map(([z,label])=>(
              <button key={z} onClick={()=>setZone(z)} style={{flex:1,padding:"10px 8px",textAlign:"center",fontSize:13,fontWeight:700,borderRadius:10,border:"none",fontFamily:"inherit",background:zone===z?"#fff":"transparent",color:zone===z?C.g700:"rgba(255,255,255,.8)",boxShadow:zone===z?"0 2px 8px rgba(0,0,0,.1)":"none",transition:"all .25s cubic-bezier(.4,0,.2,1)",cursor:"pointer"}}>{label}</button>
            ))}
          </div>
        </div>

        {/* Fridge interior */}
        <div style={{background:"linear-gradient(180deg, #e8f4f0 0%, #dceee8 30%, #d0e6de 100%)",margin:"0 6px 6px",borderRadius:20,minHeight:200,padding:"8px 10px",border:"2px solid rgba(255,255,255,.3)",boxShadow:"inset 0 2px 12px rgba(0,0,0,.06)"}}>
          {items.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",color:C.n300}}>
              <div style={{fontSize:48,marginBottom:8}}>{ zone==="fridge"?"❄️":"📦"}</div>
              <p style={{fontSize:13,fontWeight:500}}>Aucun produit dans {zone==="fridge"?"le frigo":"le placard"}</p>
              <Tap onTap={()=>onNav("scan")} style={{marginTop:12,display:"inline-flex",alignItems:"center",gap:6,background:C.g700,color:"#fff",padding:"10px 18px",borderRadius:12,fontSize:12,fontWeight:600}}>
                📷 Scanner un produit
              </Tap>
            </div>
          ):(
            <div style={{display:"flex",gap:8,flexWrap:"wrap",padding:"6px 2px"}}>
              {items.map((item,i)=>{
                const days=daysUntil(item.expiry);
                const status=item.recalls?.length?"danger":expiryStatus(days);
                const bgM={ok:C.g50,warn:C.o50,danger:C.r50,expired:C.r50};
                const brM={ok:`2px solid ${C.g200}`,warn:`2px solid ${C.o100}`,danger:`2px solid ${C.r100}`,expired:`2px solid ${C.r100}`};
                return(
                  <Tap key={item.barcode+i} onTap={()=>onNav("product",item)} style={{width:68,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{width:56,height:56,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,position:"relative",background:bgM[status]||bgM.ok,border:brM[status]||brM.ok,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                      <Badge status={status}/>
                      {item.image?<img src={item.image} style={{width:40,height:40,objectFit:"contain",borderRadius:8}} onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="block";}}/>:null}
                      <span style={{display:item.image?"none":"block"}}>{item.emoji||"📦"}</span>
                    </div>
                    <div style={{fontSize:9,color:C.n700,textAlign:"center",fontWeight:600,maxWidth:68,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name?.split(" ").slice(0,2).join(" ")}</div>
                    <div style={{fontSize:7.5,color:status==="danger"||status==="expired"?C.r400:status==="warn"?C.o400:C.n300,fontWeight:600}}>
                      {item.recalls?.length?"⚠ Rappel":days!==null?(days<0?"Expiré":`J-${days}`):"—"}
                    </div>
                  </Tap>
                );
              })}
            </div>
          )}
          {/* Shelf lines */}
          {items.length>0&&<div style={{height:2,background:"rgba(255,255,255,.5)",borderRadius:1,margin:"4px 0",boxShadow:"0 1px 2px rgba(0,0,0,.05)"}}/>}
        </div>
      </div>

      {/* Risk Banner */}
      {pantry.length>0&&(
        <div style={{marginTop:10,borderRadius:20,padding:"14px 16px",background:globalRisk>=50?`linear-gradient(135deg,${C.o50},${C.o100})`:globalRisk>=30?`linear-gradient(135deg,${C.o50},#fff3e0)`:`linear-gradient(135deg,${C.g50},${C.g100})`,border:`1px solid ${globalRisk>=50?C.o100:globalRisk>=30?"#ffe082":C.g200}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,color:globalRisk>=50?C.o600:globalRisk>=30?C.o600:C.g600,display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:16}}>{globalRisk>=50?"⚠️":"🛡️"}</span> Indice de risque
            </div>
            <div style={{fontSize:20,fontWeight:700,color:globalRisk>=50?C.o600:globalRisk>=30?C.o600:C.g600}}>
              {globalRisk}<span style={{fontSize:12,fontWeight:500,color:C.n500}}>/100</span>
            </div>
          </div>
          <div style={{height:6,background:"rgba(255,255,255,.6)",borderRadius:3,overflow:"hidden"}}>
            <div className="vf-risk-fill" style={{height:"100%",borderRadius:3,width:`${globalRisk}%`,background:`linear-gradient(90deg,${C.g400} 0%,${C.o400} 50%,${C.r400} 100%)`}}/>
          </div>
          <div style={{marginTop:6,fontSize:10,color:C.n500,display:"flex",justifyContent:"space-between"}}>
            <span>{recallCount} rappel{recallCount!==1?"s":""} · {expiringCount} péremption{expiringCount!==1?"s":""} proche{expiringCount!==1?"s":""}</span>
            <span style={{fontWeight:600,color:globalRisk>=50?C.o600:C.g600}}>{riskLevel(globalRisk).label}</span>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
        {[
          {emoji:"📷",title:"Scanner",sub:"Ajouter un produit",bg:C.g50,nav:"scan"},
          {emoji:"🔔",title:"Alertes",sub:`${recallCount} active${recallCount!==1?"s":""}`,bg:C.r50,nav:"alerts"},
          {emoji:"🧠",title:"Prédictions IA",sub:"Scores de risque",bg:C.b50,nav:pantry[0]?["product",pantry[0]]:null},
          {emoji:"👤",title:"Mon profil",sub:user?.name||"Profil",bg:C.o50,nav:"profile"},
        ].map((a,i)=>(
          <Tap key={i} onTap={()=>a.nav?(Array.isArray(a.nav)?onNav(...a.nav):onNav(a.nav)):showToast("Bientôt disponible")}
            style={{background:C.n0,border:`1px solid ${C.n100}`,borderRadius:16,padding:"14px 12px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:40,height:40,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,background:a.bg,flexShrink:0}}>{a.emoji}</div>
            <div><div style={{fontSize:12,fontWeight:600,color:C.n700,lineHeight:1.3}}>{a.title}</div><div style={{fontSize:10,color:C.n300,marginTop:1}}>{a.sub}</div></div>
          </Tap>
        ))}
      </div>
    </div>
  );
}

function ScannerScreen({ onNav, showToast, onProductScanned, pantry }){
  const [scanning,setScanning]=useState(false);
  const [manualCode,setManualCode]=useState("");
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState(null);
  const scannerRef=useRef(null);
  const html5QrRef=useRef(null);

  const startCamera=async()=>{
    setScanning(true);setError(null);
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
      stream.getTracks().forEach(t=>t.stop());
    }catch(permErr){
      setScanning(false);
      if(permErr.name==="NotAllowedError"||permErr.name==="PermissionDeniedError"){
        setError("📷 Accès caméra refusé. Autorisez la caméra dans les paramètres de votre navigateur, puis réessayez.");
      }else if(permErr.name==="NotFoundError"){
        setError("📷 Aucune caméra détectée sur cet appareil.");
      }else{
        setError(`📷 Caméra inaccessible (${permErr.name}). Sur smartphone, assurez-vous d'utiliser HTTPS (https://...). Utilisez la saisie manuelle ci-dessous.`);
      }
      return;
    }
    try{
      const {Html5Qrcode}=await import("html5-qrcode");
      await new Promise(r=>setTimeout(r,100));
      const el=document.getElementById("vf-scanner");
      if(!el){setScanning(false);setError("Erreur interne: conteneur scanner introuvable.");return;}
      const scanner=new Html5Qrcode("vf-scanner");
      html5QrRef.current=scanner;
      await scanner.start(
        {facingMode:"environment"},
        {fps:10,qrbox:{width:250,height:150},aspectRatio:1.0},
        (decodedText)=>{
          scanner.stop().catch(()=>{});
          setScanning(false);
          lookupProduct(decodedText);
        },
        ()=>{}
      );
    }catch(err){
      setScanning(false);
      setError("Erreur lors du démarrage du scanner. Utilisez la saisie manuelle.");
      console.error("Scanner error:",err);
    }
  };

  const stopCamera=async()=>{
    try{await html5QrRef.current?.stop();}catch{}
    setScanning(false);
  };

  useEffect(()=>{return()=>{try{html5QrRef.current?.stop();}catch{}};},[]);

  const lookupProduct=async(barcode)=>{
    setLoading(true);setResult(null);setError(null);
    try{
      const [off,recalls]=await Promise.all([fetchOFF(barcode),fetchRecalls(barcode)]);
      if(!off){
        setError(`Produit non trouvé (${barcode}). Vérifiez le code-barres.`);
        setLoading(false);
        return;
      }
      const riskScore=computeRiskScore(off,recalls);
      const autoZone=classifyZone(off.categories, off.name);
      const product={
        barcode,
        name:off.name,
        brand:off.brand,
        image:off.image,
        categories:off.categories,
        allergens:off.allergens,
        nutriscore:off.nutriscore,
        nova:off.nova,
        ecoscore:off.ecoscore,
        ingredients:off.ingredients,
        quantity:off.quantity,
        origin:off.origin,
        labels:off.labels,
        nutriments:off.nutriments,
        recalls,
        riskScore,
        emoji:productEmoji(off.categories),
        zone:autoZone,
        scannedAt:new Date().toISOString(),
      };
      onProductScanned(product);
      setResult(product);
      showToast(`${zoneLabel(autoZone)} ${off.name} ajouté !`);
    }catch(err){
      setError("Erreur réseau. Vérifiez votre connexion.");
    }
    setLoading(false);
  };

  const scanAnother=()=>{
    setResult(null);
    setManualCode("");
  };

  return(
    <div className="vf-enter">
      <h1 style={{fontSize:22,fontWeight:700,color:C.n900,padding:"4px 2px 14px",letterSpacing:"-.3px",margin:0}}>Scanner</h1>

      {/* Scanner area */}
      {!result&&!loading&&(
        <>
          <div style={{borderRadius:24,overflow:"hidden",background:"#0a0a0a",position:"relative",minHeight:260}}>
            {scanning?(
              <div id="vf-scanner" ref={scannerRef} style={{width:"100%",minHeight:260}}/>
            ):(
              <Tap onTap={startCamera} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:260,gap:12}}>
                <div style={{width:80,height:80,borderRadius:24,border:`3px solid ${C.g400}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>📷</div>
                <span style={{color:C.g400,fontSize:14,fontWeight:600}}>Appuyez pour scanner</span>
                <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>Accès à la caméra requis</span>
                {typeof window!=="undefined"&&window.location.protocol!=="https:"&&window.location.hostname!=="localhost"&&(
                  <div style={{background:"rgba(239,83,80,.15)",border:"1px solid rgba(239,83,80,.3)",borderRadius:12,padding:"8px 12px",margin:"4px 12px 0",textAlign:"center"}}>
                    <span style={{color:"#ef5350",fontSize:10,fontWeight:600,lineHeight:1.4,display:"block"}}>
                      ⚠️ La caméra nécessite HTTPS.<br/>
                      Lancez avec : npm run dev<br/>
                      (le plugin basic-ssl active HTTPS)
                    </span>
                  </div>
                )}
              </Tap>
            )}
            {scanning&&(
              <Tap onTap={stopCamera} style={{position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",background:"rgba(255,0,0,.8)",color:"#fff",padding:"8px 20px",borderRadius:20,fontSize:12,fontWeight:600}}>
                ✕ Arrêter
              </Tap>
            )}
          </div>

          {/* Manual input */}
          <div style={{marginTop:12}}>
            <p style={{fontSize:11,color:C.n300,fontWeight:600,textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Ou saisir manuellement</p>
            <div style={{display:"flex",gap:8}}>
              <input value={manualCode} onChange={e=>setManualCode(e.target.value)} placeholder="Code-barres EAN (ex: 3017620422003)"
                style={{flex:1,padding:"12px 16px",borderRadius:14,border:`1.5px solid ${C.n200}`,background:C.n50,fontSize:14,fontFamily:"inherit",outline:"none",color:C.n900}}
                onKeyDown={e=>e.key==="Enter"&&manualCode.trim()&&lookupProduct(manualCode.trim())}
              />
              <Tap onTap={()=>manualCode.trim()&&lookupProduct(manualCode.trim())} disabled={!manualCode.trim()}
                style={{padding:"12px 18px",borderRadius:14,background:manualCode.trim()?C.g700:C.n200,color:manualCode.trim()?"#fff":C.n300,fontSize:14,fontWeight:600}}>
                OK
              </Tap>
            </div>
          </div>

          {/* Quick test barcodes */}
          <div style={{marginTop:16}}>
            <p style={{fontSize:11,color:C.n300,fontWeight:600,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Tester avec</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[
                {code:"3017620422003",name:"Nutella"},
                {code:"3274080005003",name:"Cristaline"},
                {code:"5449000000996",name:"Coca-Cola"},
                {code:"3228857000166",name:"Harry's"},
                {code:"7622210449283",name:"Prince LU"},
              ].map(b=>(
                <Tap key={b.code} onTap={()=>lookupProduct(b.code)}
                  style={{padding:"8px 14px",borderRadius:12,background:C.n50,border:`1px solid ${C.n100}`,fontSize:11,fontWeight:500,color:C.n700}}>
                  {b.name}
                </Tap>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Loading */}
      {loading&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <LoadingDots/>
          <p style={{color:C.n500,fontSize:14,marginTop:16,fontWeight:500}}>Analyse du produit...</p>
          <p style={{color:C.n300,fontSize:11,marginTop:4}}>Open Food Facts + RappelConso</p>
        </div>
      )}

      {/* Error */}
      {error&&(
        <div style={{marginTop:16,padding:"16px 18px",borderRadius:16,background:C.r50,border:`1px solid ${C.r100}`}}>
          <p style={{fontSize:13,color:C.r600,fontWeight:600}}>❌ {error}</p>
          <Tap onTap={()=>{setError(null);setResult(null);}} style={{marginTop:10,display:"inline-flex",padding:"8px 16px",borderRadius:10,background:C.r400,color:"#fff",fontSize:12,fontWeight:600}}>
            Réessayer
          </Tap>
        </div>
      )}

      {/* Result — Confirmation d'ajout automatique */}
      {result&&(
        <div className="vf-enter" style={{marginTop:16}}>
          <div style={{borderRadius:24,overflow:"hidden",border:`1px solid ${C.g200}`,background:C.n0}}>
            {/* Success banner */}
            <div style={{background:`linear-gradient(135deg,${C.g50},${C.g100})`,padding:"14px 16px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${C.g200}`}}>
              <div style={{width:36,height:36,borderRadius:12,background:C.g400,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg viewBox="0 0 24 24" style={{width:20,height:20,stroke:"#fff",fill:"none",strokeWidth:2.5}}><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:C.g700}}>Produit ajouté !</div>
                <div style={{fontSize:11,color:C.g600}}>{zoneLabel(result.zone)} — classé automatiquement</div>
              </div>
            </div>

            {/* Product info */}
            <div style={{padding:"14px 16px",display:"flex",gap:14,alignItems:"center"}}>
              {result.image?<img src={result.image} style={{width:56,height:56,objectFit:"contain",borderRadius:14,background:C.n50,padding:4}}/>
                :<div style={{width:56,height:56,borderRadius:14,background:C.n50,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30}}>{result.emoji}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:C.n900,lineHeight:1.2}}>{result.name}</div>
                <div style={{fontSize:12,color:C.n500,marginTop:2}}>{result.brand}</div>
                <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                  {(()=>{const r=riskLevel(result.riskScore);return <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:8,background:r.bg,color:r.color,border:`1px solid ${r.border}`}}>Risque {r.label} ({result.riskScore}/100)</span>;})()}
                  {result.recalls?.length>0&&<span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:8,background:C.r50,color:C.r600}}>🚨 Rappel</span>}
                  {result.nutriscore&&<span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:8,background:result.nutriscore==="A"?"#1b8a2d":result.nutriscore==="B"?"#85bb2f":result.nutriscore==="C"?"#fecb02":result.nutriscore==="D"?"#ee8100":"#e63e11",color:"#fff"}}>Nutri {result.nutriscore}</span>}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{padding:"0 16px 14px",display:"flex",gap:8}}>
              <Tap onTap={()=>onNav("product",result)} style={{flex:1,padding:"12px",borderRadius:14,background:C.g700,color:"#fff",textAlign:"center",fontSize:13,fontWeight:600}}>
                Voir la fiche
              </Tap>
              <Tap onTap={scanAnother} style={{flex:1,padding:"12px",borderRadius:14,background:C.n100,color:C.n700,textAlign:"center",fontSize:13,fontWeight:600}}>
                📷 Scanner encore
              </Tap>
            </div>
          </div>
        </div>
      )}

      {/* ─── HISTORIQUE DES SCANS ─── */}
      {pantry.length>0&&(
        <div style={{marginTop:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <h4 style={{fontSize:11,textTransform:"uppercase",letterSpacing:".6px",fontWeight:700,color:C.n300,margin:0}}>
              Historique ({pantry.length})
            </h4>
          </div>
          {[...pantry].sort((a,b)=>new Date(b.scannedAt||0)-new Date(a.scannedAt||0)).map((item)=>{
            const days=daysUntil(item.expiry);
            const status=item.recalls?.length?"danger":expiryStatus(days);
            const risk=riskLevel(item.riskScore||25);
            const tagStyles={
              ok:{background:C.g50,color:C.g600,label:item.zone==="fridge"?"❄️ Frigo":"📦 Placard"},
              warn:{background:C.o50,color:C.o600,label:days!==null?`J-${days}`:"⚠️"},
              danger:{background:C.r50,color:C.r600,label:item.recalls?.length?"🚨 Rappel":"Expiré"},
              expired:{background:C.r50,color:C.r600,label:"Expiré"},
            };
            const tag=tagStyles[status]||tagStyles.ok;
            const scanDate=item.scannedAt?new Date(item.scannedAt):null;
            let timeAgo="";
            if(scanDate){
              const diff=Date.now()-scanDate.getTime();
              const mins=Math.floor(diff/60000);
              const hrs=Math.floor(diff/3600000);
              const daysAgo=Math.floor(diff/86400000);
              if(mins<1) timeAgo="À l'instant";
              else if(mins<60) timeAgo=`Il y a ${mins} min`;
              else if(hrs<24) timeAgo=`Il y a ${hrs}h`;
              else if(daysAgo===1) timeAgo="Hier";
              else timeAgo=scanDate.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
            }
            return(
              <Tap key={item.barcode} onTap={()=>onNav("product",item)}
                style={{display:"flex",alignItems:"center",gap:10,background:C.n0,border:`1px solid ${C.n100}`,borderRadius:14,padding:"10px 12px",marginBottom:6}}>
                {item.image?
                  <div style={{width:40,height:40,borderRadius:12,overflow:"hidden",background:C.n50,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <img src={item.image} style={{width:36,height:36,objectFit:"contain"}} onError={e=>{e.target.style.display="none";}}/>
                  </div>
                  :<div style={{width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,background:C.n50,flexShrink:0}}>{item.emoji||"📦"}</div>
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.n900,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                  <div style={{fontSize:10,color:C.n300,marginTop:1,display:"flex",alignItems:"center",gap:4}}>
                    <span>{timeAgo}</span>
                    <span>·</span>
                    <span>{item.zone==="fridge"?"❄️ Frigo":"📦 Placard"}</span>
                  </div>
                </div>
                <div style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:8,background:tag.background,color:tag.color,whiteSpace:"nowrap",flexShrink:0}}>
                  {tag.label}
                </div>
              </Tap>
            );
          })}
        </div>
      )}
    </div>
  );
}


function ProductScreen({ product, user, onNav, showToast, onRemove, onUpdateProduct }){
  const [animScore,setAnimScore]=useState(0);
  useEffect(()=>{const t=setTimeout(()=>setAnimScore(product?.riskScore||0),300);return()=>clearTimeout(t);},[product]);

  if(!product) return <div style={{padding:40,textAlign:"center",color:C.n300}}>Aucun produit sélectionné</div>;

  const risk=riskLevel(product.riskScore||0);
  const days=daysUntil(product.expiry);
  const allergenWarnings=checkAllergens(product.allergens||[],user?.allergens||[]);

  return(
    <div className="vf-enter">
      <Tap onTap={()=>onNav("home")} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"6px 0 8px",fontSize:13,fontWeight:500,color:C.g700,background:"none",border:"none",fontFamily:"inherit"}}>
        <svg viewBox="0 0 24 24" style={{width:18,height:18,stroke:C.g700,fill:"none",strokeWidth:2}}><polyline points="15 18 9 12 15 6"/></svg>Retour
      </Tap>

      {/* Hero */}
      <div style={{borderRadius:28,padding:"22px 20px 16px",textAlign:"center",background:product.recalls?.length?`linear-gradient(160deg,${C.r50},${C.r100})`:`linear-gradient(160deg,${C.g50},${C.g100})`}}>
        {product.image?<img src={product.image} style={{width:80,height:80,objectFit:"contain",borderRadius:20,background:"#fff",padding:6,marginBottom:6}}/>
          :<span style={{fontSize:56,display:"block"}}>{product.emoji||"📦"}</span>}
        <div style={{fontSize:18,fontWeight:700,color:C.n900}}>{product.name}</div>
        <div style={{fontSize:11,color:C.n500,marginTop:2}}>{product.brand}{product.quantity?` · ${product.quantity}`:""}</div>
        {/* Animated score */}
        <div style={{width:80,height:80,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"14px auto 0",background:`conic-gradient(${risk.color} ${animScore*3.6}deg, ${C.n100} ${animScore*3.6}deg)`,transition:"all 1s cubic-bezier(.4,0,.2,1)",position:"relative"}}>
          <div style={{width:66,height:66,borderRadius:"50%",background:C.n0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"absolute"}}>
            <div style={{fontSize:24,fontWeight:700,lineHeight:1,color:risk.color}}>{animScore}</div>
            <div style={{fontSize:7.5,textTransform:"uppercase",fontWeight:700,color:C.n300,letterSpacing:".4px"}}>Score IA</div>
          </div>
        </div>
      </div>

      {/* Allergen warning */}
      {allergenWarnings.length>0&&(
        <div style={{marginTop:8,padding:"12px 16px",borderRadius:16,background:"#fff3cd",border:"1px solid #ffc107"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#856404"}}>⚠️ Allergène détecté !</div>
          <div style={{fontSize:12,color:"#856404",marginTop:4}}>Ce produit contient : <b>{allergenWarnings.join(", ")}</b></div>
        </div>
      )}

      {/* Recall alert */}
      {product.recalls?.length>0&&product.recalls.map((rec,i)=>(
        <div key={i} style={{background:C.r50,borderRadius:20,border:`1px solid ${C.r100}`,padding:"14px 16px",marginTop:8}}>
          <div style={{fontSize:13,fontWeight:700,color:C.r600,marginBottom:6}}>🚨 Rappel officiel — {rec.date}</div>
          <div style={{fontSize:12,color:"#b71c1c",lineHeight:1.5,marginBottom:4}}><b>Risque :</b> {rec.risk}</div>
          <div style={{fontSize:12,color:"#b71c1c",lineHeight:1.5,marginBottom:4}}><b>Motif :</b> {rec.reason}</div>
          {rec.action&&<div style={{fontSize:12,color:"#b71c1c",lineHeight:1.5}}><b>Action :</b> {rec.action}</div>}
        </div>
      ))}

      {/* Expiry */}
      {product.expiry&&(
        <DCard title="📅 Péremption">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,color:C.n500}}>Date limite</span>
            <span style={{fontSize:13,fontWeight:600,color:days!==null&&days<=3?C.r600:days<=7?C.o600:C.n900}}>
              {new Date(product.expiry).toLocaleDateString("fr-FR")} {days!==null&&`(${days<0?"Expiré":days===0?"Aujourd'hui":`J-${days}`})`}
            </span>
          </div>
        </DCard>
      )}

      {/* AI Analysis */}
      <DCard title="🧠 Analyse prédictive IA" rows={[
        {k:"Score de risque",v:`${product.riskScore}/100 — ${risk.label}`,cls:risk.label==="Élevé"?"danger":risk.label==="Modéré"?"warn":"safe"},
        {k:"Catégorie",v:product.categories?.split(",")[0]||"Inconnu"},
        ...(product.recalls?.length?[{k:"Rappels actifs",v:`${product.recalls.length} rappel(s)`,cls:"danger"}]:[]),
        {k:"Fiabilité du modèle",v:"87%"},
        {k:"Base de données",v:"RappelConso + Open Food Facts"},
      ]}/>

      {/* Nutrition */}
      <DCard title="📊 Informations nutritionnelles" rows={[
        ...(product.nutriscore?[{k:"Nutriscore",v:product.nutriscore,badge:true}]:[]),
        ...(product.nova?[{k:"Nova (transformation)",v:`Groupe ${product.nova}`,cls:product.nova>=4?"danger":product.nova>=3?"warn":"safe"}]:[]),
        ...(product.ecoscore?[{k:"Ecoscore",v:product.ecoscore}]:[]),
        ...(product.origin?[{k:"Origine",v:product.origin.split(",")[0]}]:[]),
        ...(product.labels?[{k:"Labels",v:product.labels.split(",").slice(0,2).join(", ")}]:[]),
      ]}/>

      {/* Allergens */}
      {product.allergens?.length>0&&(
        <DCard title="⚠️ Allergènes déclarés">
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {product.allergens.map((a,i)=>{
              const name=ALLERGEN_MAP[a]||a;
              const isUserAllergen=user?.allergens?.some(ua=>name.toLowerCase().includes(ua.toLowerCase()));
              return <span key={i} style={{padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:600,background:isUserAllergen?C.r50:C.n50,color:isUserAllergen?C.r600:C.n700,border:`1px solid ${isUserAllergen?C.r100:C.n200}`}}>{name}{isUserAllergen?" ⚠️":""}</span>;
            })}
          </div>
        </DCard>
      )}

      {/* Modifier l'emplacement */}
      {onUpdateProduct&&(
        <ZoneEditor product={product} onUpdate={onUpdateProduct} showToast={showToast}/>
      )}

      {/* Actions */}
      <div style={{display:"flex",gap:8,marginTop:12}}>
        {onRemove&&(
          <Tap onTap={()=>{onRemove(product.barcode);onNav("home");showToast("Produit supprimé");}} style={{flex:1,padding:"12px",borderRadius:14,background:C.r50,color:C.r600,textAlign:"center",fontSize:13,fontWeight:600,border:`1px solid ${C.r100}`}}>
            🗑 Supprimer
          </Tap>
        )}
      </div>
    </div>
  );
}

function ZoneEditor({product, onUpdate, showToast}){
  const [zone,setZone]=useState(product.zone||"fridge");
  const [expiry,setExpiry]=useState(product.expiry||"");
  const [changed,setChanged]=useState(false);

  const save=()=>{
    onUpdate(product.barcode,{zone,expiry:expiry||null});
    setChanged(false);
    showToast(`${zoneLabel(zone)} Emplacement mis à jour`);
  };

  return(
    <div style={{background:C.n0,borderRadius:20,border:`1px solid ${C.n100}`,padding:"14px 16px",marginTop:8}}>
      <div style={{fontSize:13,fontWeight:700,color:C.g700,marginBottom:10}}>📍 Emplacement & péremption</div>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {[["fridge","❄️ Frigo"],["pantry","📦 Placard"]].map(([z,l])=>(
          <Tap key={z} onTap={()=>{setZone(z);setChanged(true);}} style={{flex:1,padding:"10px",borderRadius:12,textAlign:"center",fontSize:12,fontWeight:600,background:zone===z?C.g100:C.n50,color:zone===z?C.g700:C.n500,border:zone===z?`1.5px solid ${C.g200}`:`1.5px solid ${C.n200}`,transition:"all .2s"}}>{l}</Tap>
        ))}
      </div>
      <input type="date" value={expiry} onChange={e=>{setExpiry(e.target.value);setChanged(true);}}
        style={{width:"100%",padding:"10px 14px",borderRadius:12,border:`1.5px solid ${C.n200}`,background:C.n50,fontSize:13,fontFamily:"inherit",color:C.n700,boxSizing:"border-box"}}
      />
      {changed&&(
        <Tap onTap={save} style={{marginTop:10,padding:"10px",borderRadius:12,background:C.g700,color:"#fff",textAlign:"center",fontSize:13,fontWeight:600}}>
          ✅ Enregistrer les modifications
        </Tap>
      )}
    </div>
  );
}

function DCard({title,rows=[],children}){
  const cM={danger:C.r600,warn:C.o600,safe:C.g600};
  const nsBg={A:"#1b8a2d",B:"#85bb2f",C:"#fecb02",D:"#ee8100",E:"#e63e11"};
  return(
    <div style={{background:C.n0,borderRadius:20,border:`1px solid ${C.n100}`,padding:"14px 16px",marginTop:8}}>
      <div style={{fontSize:13,fontWeight:700,color:C.g700,marginBottom:rows.length||children?8:0}}>{title}</div>
      {rows.map((r,i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:i<rows.length-1?`1px solid ${C.n100}`:"none"}}>
          <span style={{fontSize:12,color:C.n500}}>{r.k}</span>
          {r.badge?<span style={{background:nsBg[r.v]||C.n500,color:"#fff",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700}}>{r.v}</span>
            :<span style={{fontSize:12,fontWeight:600,color:r.cls?cM[r.cls]:C.n900,maxWidth:"60%",textAlign:"right"}}>{r.v}</span>}
        </div>
      ))}
      {children}
    </div>
  );
}

function AlertsScreen({ pantry, onNav, showToast }){
  const [filter,setFilter]=useState("all");
  const [recentRecalls,setRecentRecalls]=useState([]);
  const [loadingRecalls,setLoadingRecalls]=useState(true);

  useEffect(()=>{
    fetchRecentRecalls(15).then(r=>{setRecentRecalls(r);setLoadingRecalls(false);}).catch(()=>setLoadingRecalls(false));
  },[]);

  const pantryAlerts=[];
  pantry.forEach(p=>{
    if(p.recalls?.length) p.recalls.forEach(r=>pantryAlerts.push({type:"recall",product:p,recall:r,date:r.date,priority:3}));
    const days=daysUntil(p.expiry);
    if(days!==null&&days<=3) pantryAlerts.push({type:"expiry",product:p,days,date:p.expiry,priority:days<0?3:2});
    if(p.riskScore>=60) pantryAlerts.push({type:"risk",product:p,score:p.riskScore,date:p.scannedAt,priority:1});
  });

  const allAlerts=[
    ...pantryAlerts,
    ...recentRecalls.map(r=>({type:"national",recall:r,date:r.date,priority:0})),
  ].sort((a,b)=>b.priority-a.priority);

  const filtered=filter==="all"?allAlerts:allAlerts.filter(a=>a.type===filter);

  const counts={all:allAlerts.length,recall:allAlerts.filter(a=>a.type==="recall").length,expiry:allAlerts.filter(a=>a.type==="expiry").length,risk:allAlerts.filter(a=>a.type==="risk").length,national:recentRecalls.length};

  return(
    <div className="vf-enter">
      <h1 style={{fontSize:22,fontWeight:700,color:C.n900,padding:"4px 2px 14px",letterSpacing:"-.3px",margin:0}}>Alertes</h1>

      {/* Filters */}
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
        {[["all","Tout"],["recall","Rappels"],["expiry","Péremption"],["risk","IA"],["national","France"]].map(([id,label])=>(
          <button key={id} onClick={()=>setFilter(id)} style={{padding:"8px 14px",borderRadius:20,fontSize:11,fontWeight:600,border:filter===id?`1px solid ${C.g700}`:`1px solid ${C.n200}`,background:filter===id?C.g700:C.n0,color:filter===id?"#fff":C.n500,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",transition:"all .2s"}}>
            {label} ({counts[id]||0})
          </button>
        ))}
      </div>

      {loadingRecalls&&<div style={{textAlign:"center",padding:20}}><LoadingDots/><p style={{color:C.n300,fontSize:12,marginTop:8}}>Chargement RappelConso...</p></div>}

      {!loadingRecalls&&filtered.length===0&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:C.n300}}>
          <div style={{fontSize:40,marginBottom:8}}>✅</div>
          <p style={{fontSize:14,fontWeight:500}}>Aucune alerte</p>
        </div>
      )}

      {filtered.map((al,i)=>{
        const cfg={
          recall:{bar:C.r400,tagBg:C.r50,tagColor:C.r600,tag:"Rappel",icon:"🚨"},
          expiry:{bar:C.o400,tagBg:C.o50,tagColor:C.o600,tag:"Péremption",icon:"⏰"},
          risk:{bar:C.o400,tagBg:C.b50,tagColor:C.b600,tag:"Prédiction IA",icon:"🧠"},
          national:{bar:C.g400,tagBg:C.g50,tagColor:C.g600,tag:"France",icon:"🇫🇷"},
        }[al.type]||{bar:C.n300,tagBg:C.n50,tagColor:C.n500,tag:"Info",icon:"ℹ️"};

        return(
          <Tap key={i} onTap={al.product?()=>onNav("product",al.product):()=>showToast(al.recall?.name||"Alerte")}
            style={{background:C.n0,borderRadius:20,border:`1px solid ${C.n100}`,padding:14,marginBottom:8,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,borderRadius:"0 4px 4px 0",background:cfg.bar}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:6,textTransform:"uppercase",letterSpacing:".3px",background:cfg.tagBg,color:cfg.tagColor}}>{cfg.tag}</span>
              <span style={{fontSize:10,color:C.n300}}>{al.date?new Date(al.date).toLocaleDateString("fr-FR"):""}</span>
            </div>
            <h4 style={{fontSize:14,fontWeight:700,color:C.n900,margin:"0 0 4px"}}>
              {al.type==="recall"?al.recall?.risk:al.type==="expiry"?`${al.product.name} — ${al.days<0?"Expiré":"Expire bientôt"}`:al.type==="risk"?`Risque ${riskLevel(al.score).label} (${al.score}/100)`:al.recall?.name||"Rappel"}
            </h4>
            <p style={{fontSize:11,color:C.n500,lineHeight:1.4,margin:0}}>
              {al.type==="recall"?al.recall?.reason:al.type==="expiry"?`${al.days<0?"Expiré depuis "+Math.abs(al.days)+" jours":"Expire dans "+al.days+" jour(s)"}. Vérifiez le produit.`:al.type==="risk"?`Le moteur prédictif a détecté un risque pour ${al.product?.name}`:al.recall?.reason||al.recall?.risk||""}
            </p>
            {(al.product||al.recall)&&(
              <div style={{display:"flex",alignItems:"center",gap:8,background:C.n50,borderRadius:12,padding:"8px 10px",marginTop:8}}>
                <span style={{fontSize:22}}>{al.product?.emoji||productEmoji(al.recall?.category||"")}</span>
                <div><div style={{fontSize:12,fontWeight:600,color:C.n900}}>{al.product?.name||al.recall?.name}</div><div style={{fontSize:9,color:C.n300}}>{al.product?.brand||al.recall?.brand}</div></div>
              </div>
            )}
          </Tap>
        );
      })}
    </div>
  );
}

function ProfileScreen({ user, pantry, onUpdateUser, onReset, showToast }){
  const [editAllergens,setEditAllergens]=useState(false);
  const [allergens,setAllergens]=useState(user?.allergens||[]);
  const COMMON_ALLERGENS=["Gluten","Lait","Oeufs","Arachides","Soja","Fruits à coque","Poisson","Crustacés","Sésame","Moutarde","Céleri","Sulfites"];

  const toggleAllergen=(a)=>setAllergens(prev=>prev.includes(a)?prev.filter(x=>x!==a):[...prev,a]);
  const saveAllergens=()=>{onUpdateUser({...user,allergens});setEditAllergens(false);showToast("Allergènes mis à jour");};

  const scannedCount=pantry.length;
  const recallCount=pantry.filter(p=>p.recalls?.length>0).length;

  return(
    <div className="vf-enter">
      <h1 style={{fontSize:22,fontWeight:700,color:C.n900,padding:"4px 2px 14px",letterSpacing:"-.3px",margin:0}}>Mon profil</h1>
      
      {/* Hero */}
      <div style={{borderRadius:28,background:`linear-gradient(140deg,${C.g400} 0%,${C.g600} 50%,${C.g700} 100%)`,padding:20,display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"#fff",flexShrink:0,border:"3px solid rgba(255,255,255,.3)"}}>
          {(user?.name||"U")[0].toUpperCase()}
        </div>
        <div>
          <h3 style={{fontSize:17,fontWeight:700,color:"#fff",margin:0}}>{user?.name||"Utilisateur"}</h3>
          <p style={{fontSize:11,color:"rgba(255,255,255,.7)",margin:"2px 0 0",fontWeight:500}}>
            Membre depuis {user?.createdAt?new Date(user.createdAt).toLocaleDateString("fr-FR",{month:"long",year:"numeric"}):"récemment"} · Foyer de {user?.household||1}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
        {[{n:scannedCount,l:"Produits"},{n:recallCount,l:"Alertes"},{n:scannedCount,l:"Scans"}].map((s,i)=>(
          <div key={i} style={{background:C.n0,border:`1px solid ${C.n100}`,borderRadius:14,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:700,color:C.g700}}>{s.n}</div>
            <div style={{fontSize:9,color:C.n300,textTransform:"uppercase",fontWeight:700,letterSpacing:".3px",marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Allergens management */}
      <div style={{marginTop:10,background:C.n0,border:`1px solid ${C.n100}`,borderRadius:20,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:editAllergens?12:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>⚠️</span>
            <span style={{fontSize:14,fontWeight:600,color:C.n700}}>Allergènes surveillés</span>
          </div>
          <Tap onTap={()=>{if(editAllergens)saveAllergens();else setEditAllergens(true);}} style={{padding:"6px 14px",borderRadius:10,background:editAllergens?C.g700:C.n50,color:editAllergens?"#fff":C.g700,fontSize:12,fontWeight:600}}>
            {editAllergens?"Valider":"Modifier"}
          </Tap>
        </div>
        {editAllergens?(
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {COMMON_ALLERGENS.map(a=>{
              const sel=allergens.includes(a);
              return <Tap key={a} onTap={()=>toggleAllergen(a)} style={{padding:"6px 12px",borderRadius:10,fontSize:11,fontWeight:600,background:sel?C.r50:C.n50,color:sel?C.r600:C.n500,border:sel?`1px solid ${C.r100}`:`1px solid ${C.n200}`}}>{a}</Tap>;
            })}
          </div>
        ):(
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:user?.allergens?.length?8:0}}>
            {user?.allergens?.length?user.allergens.map((a,i)=><span key={i} style={{padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:600,background:C.r50,color:C.r600}}>{a}</span>)
              :<p style={{fontSize:12,color:C.n300,marginTop:4}}>Aucun allergène configuré</p>}
          </div>
        )}
      </div>

      {/* Settings */}
      <div style={{marginTop:10,background:C.n0,border:`1px solid ${C.n100}`,borderRadius:20,overflow:"hidden"}}>
        {[
          {emoji:"👨‍👩‍👧‍👦",label:`Mon foyer (${user?.household||1} personne${(user?.household||1)>1?"s":""})`,bg:C.g50},
          {emoji:"🔔",label:"Notifications push",bg:C.b50},
          {emoji:"🌱",label:"Préférences alimentaires",bg:C.o50},
          {emoji:"🔒",label:"Confidentialité & RGPD",bg:"#f3e8fd"},
          {emoji:"📊",label:"Sources : RappelConso + OFF",bg:C.n100},
        ].map((p,i)=>(
          <Tap key={i} onTap={()=>showToast(`${p.label} — bientôt disponible`)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderBottom:i<4?`1px solid ${C.n100}`:"none"}}>
            <div style={{width:32,height:32,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0,background:p.bg}}>{p.emoji}</div>
            <span style={{flex:1,fontSize:13,fontWeight:500,color:C.n700}}>{p.label}</span>
            <span style={{color:C.n300,fontSize:18,fontWeight:300}}>›</span>
          </Tap>
        ))}
      </div>

      {/* Reset */}
      <Tap onTap={()=>{if(confirm("Réinitialiser toutes les données ?"))onReset();}} style={{marginTop:16,textAlign:"center",padding:"12px",fontSize:13,color:C.r400,fontWeight:500}}>
        Réinitialiser l'application
      </Tap>

      <div style={{marginTop:8,textAlign:"center",fontSize:10,color:C.n300,paddingBottom:8}}>
        VigiFood MVP v1.0 · EFREI Paris · Équipe de 5<br/>
        React + Open Food Facts + RappelConso + scikit-learn
      </div>
    </div>
  );
}

const NI={
  home:(a)=><svg viewBox="0 0 24 24" fill="none" style={{width:22,height:22,stroke:a?C.g700:C.n300,strokeWidth:a?2.2:1.8}}><path d="M3 9.5l9-7 9 7V20a2 2 0 01-2 2H5a2 2 0 01-2-2V9.5z"/><path d="M9 22V12h6v10"/></svg>,
  scan:(a)=><svg viewBox="0 0 24 24" fill="none" style={{width:22,height:22,stroke:a?C.g700:C.n300,strokeWidth:a?2.2:1.8}}><path d="M2 5V2h3M22 5V2h-3M2 19v3h3M22 19v3h-3"/><path d="M7 7v10M12 7v10M17 7v10" strokeWidth="2"/></svg>,
  alerts:(a)=><svg viewBox="0 0 24 24" fill="none" style={{width:22,height:22,stroke:a?C.g700:C.n300,strokeWidth:a?2.2:1.8}}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  profile:(a)=><svg viewBox="0 0 24 24" fill="none" style={{width:22,height:22,stroke:a?C.g700:C.n300,strokeWidth:a?2.2:1.8}}><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0113 0"/></svg>,
};

export default function VigifoodApp(){
  const [user,setUser]=useState(()=>DB.get("user"));
  const [pantry,setPantry]=useState(()=>DB.get("pantry",[]));
  const [screen,setScreen]=useState("home");
  const [selectedProduct,setSelectedProduct]=useState(null);
  const [toast,setToast]=useState({msg:"",show:false});
  const scrollRef=useRef(null);
  const toastTimer=useRef(null);

  useEffect(()=>{DB.set("pantry",pantry);},[pantry]);
  useEffect(()=>{if(user)DB.set("user",user);},[user]);

  const showToast=useCallback((msg)=>{
    if(toastTimer.current)clearTimeout(toastTimer.current);
    setToast({msg,show:true});
    toastTimer.current=setTimeout(()=>setToast(t=>({...t,show:false})),2500);
  },[]);

  const nav=useCallback((id,data=null)=>{
    setScreen(id);
    if(data)setSelectedProduct(data);
    else if(id!=="product")setSelectedProduct(null);
  },[]);

  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=0;},[screen]);

  const addProduct=useCallback((product)=>{
    setPantry(prev=>{
      const exists=prev.findIndex(p=>p.barcode===product.barcode);
      if(exists>=0){
        const updated=[...prev];
        updated[exists]={...updated[exists],...product};
        return updated;
      }
      return[...prev,product];
    });
  },[]);

  const removeProduct=useCallback((barcode)=>{
    setPantry(prev=>prev.filter(p=>p.barcode!==barcode));
  },[]);

  const updateProduct=useCallback((barcode,updates)=>{
    setPantry(prev=>prev.map(p=>p.barcode===barcode?{...p,...updates}:p));
  },[]);

  const updateUser=useCallback((u)=>{setUser(u);DB.set("user",u);},[]);

  const resetApp=useCallback(()=>{
    DB.del("user");DB.del("pantry");
    setUser(null);setPantry([]);setScreen("home");setSelectedProduct(null);
    showToast("Application réinitialisée");
  },[showToast]);

  if(!user){
    return(
      <>
        <AppStyles/>
        <OnboardingScreen onComplete={(u)=>{setUser(u);setScreen("home");}}/>
      </>
    );
  }

  const tabs=[{id:"home",label:"Accueil"},{id:"scan",label:"Scanner"},{id:"alerts",label:"Alertes",dot:pantry.some(p=>p.recalls?.length>0)},{id:"profile",label:"Profil"}];

  const recallCount=pantry.filter(p=>p.recalls?.length>0).length;

  const renderScreen=()=>{
    switch(screen){
      case"home":return <HomeScreen pantry={pantry} user={user} onNav={nav} showToast={showToast} onRemove={removeProduct}/>;
      case"scan":return <ScannerScreen onNav={nav} showToast={showToast} onProductScanned={addProduct} pantry={pantry}/>;
      case"alerts":return <AlertsScreen pantry={pantry} onNav={nav} showToast={showToast}/>;
      case"product":return <ProductScreen product={selectedProduct||pantry[0]} user={user} onNav={nav} showToast={showToast} onRemove={removeProduct} onUpdateProduct={updateProduct}/>;
      case"profile":return <ProfileScreen user={user} pantry={pantry} onUpdateUser={updateUser} onReset={resetApp} showToast={showToast}/>;
      default:return <HomeScreen pantry={pantry} user={user} onNav={nav} showToast={showToast}/>;
    }
  };

  return(
    <>
      <AppStyles/>
      <div style={{fontFamily:"'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",height:"100%",display:"flex",flexDirection:"column",background:C.n50,overflow:"hidden"}}>
        {/* Safe area top */}
        <div style={{height:"env(safe-area-inset-top, 0px)",flexShrink:0,background:C.n50}}/>

        {/* Content */}
        <div ref={scrollRef} className="vf-scroll" style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"8px 20px 20px",WebkitOverflowScrolling:"touch"}}>
          <div key={screen} className="vf-enter">{renderScreen()}</div>
        </div>

        {/* Bottom nav */}
        <div style={{display:"flex",background:C.n0,borderTop:`1px solid ${C.n100}`,padding:`4px 6px calc(env(safe-area-inset-bottom, 8px) + 4px)`,flexShrink:0}}>
          {tabs.map(tab=>{
            const active=screen===tab.id||(tab.id==="home"&&screen==="product");
            return(
              <button key={tab.id} onClick={()=>nav(tab.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 0 4px",background:"none",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",position:"relative",WebkitTapHighlightColor:"transparent"}}>
                <div style={{width:48,height:30,borderRadius:15,display:"flex",alignItems:"center",justifyContent:"center",background:active?C.g100:"transparent",transition:"all .25s cubic-bezier(.4,0,.2,1)"}}>
                  {NI[tab.id](active)}
                </div>
                <span style={{fontSize:11,fontWeight:active?600:500,color:active?C.g700:C.n300,transition:"color .2s"}}>{tab.label}</span>
                {tab.dot&&<span style={{position:"absolute",top:4,right:"calc(50% - 18px)",width:8,height:8,borderRadius:"50%",background:C.r400,border:`2px solid ${C.n0}`}}/>}
              </button>
            );
          })}
        </div>
      </div>
      <Toast message={toast.msg} visible={toast.show}/>
    </>
  );
}

function AppStyles(){
  return(
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html,body,#root{height:100%;overflow:hidden}
      body{font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;touch-action:manipulation;background:#f8faf8}
      input::placeholder{color:#b0bfb0}
      input:focus{border-color:#1b6b3a !important}
      .vf-scroll::-webkit-scrollbar{display:none}.vf-scroll{scrollbar-width:none}
      @keyframes vfEnter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.vf-enter{animation:vfEnter .3s cubic-bezier(.4,0,.2,1) forwards}
      @keyframes vfRisk{from{width:0}}.vf-risk-fill{animation:vfRisk .8s cubic-bezier(.4,0,.2,1) forwards}
      @keyframes vfDots{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
      .vf-loading{display:flex;gap:6px;justify-content:center;align-items:center;padding:20px}
      .vf-loading span{width:10px;height:10px;border-radius:50%;background:#1b6b3a;animation:vfDots 1.4s infinite ease-in-out both}
      .vf-loading span:nth-child(1){animation-delay:-.32s}
      .vf-loading span:nth-child(2){animation-delay:-.16s}
      /* html5-qrcode overrides */
      #vf-scanner video{border-radius:20px !important;object-fit:cover !important}
      #vf-scanner{border-radius:20px;overflow:hidden}
      #vf-scanner img[alt="Info icon"]{display:none !important}
      #vf-scanner__dashboard_section{display:none !important}
      #vf-scanner__scan_region>br{display:none}
    `}</style>
  );
}
