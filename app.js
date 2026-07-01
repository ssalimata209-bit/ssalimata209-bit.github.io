import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DESKS = [
  { id: "d1", name: "Poste A1", zone: "Zone calme", price: 3200 },
  { id: "d2", name: "Poste A2", zone: "Zone calme", price: 3200 },
  { id: "d3", name: "Poste A3", zone: "Zone calme", price: 3200 },
  { id: "d4", name: "Poste B1", zone: "Zone collaborative", price: 2800 },
  { id: "d5", name: "Poste B2", zone: "Zone collaborative", price: 2800 },
  { id: "d6", name: "Poste B3", zone: "Zone collaborative", price: 2800 },
  { id: "d7", name: "Poste Fenêtre 1", zone: "Vue extérieure", price: 3500 },
  { id: "d8", name: "Poste Fenêtre 2", zone: "Vue extérieure", price: 3500 },
];
const ROOMS = [
  { id: "r1", name: "Salle Mercure", capacity: 4, equip: "Écran TV", price: 5500 },
  { id: "r2", name: "Salle Jupiter", capacity: 8, equip: "Visio + Écran", price: 8500 },
  { id: "r3", name: "Salle Orion", capacity: 12, equip: "Visio + Tableau", price: 12000 },
];
const WEEKDAYS = ["Lun","Mar","Mer","Jeu","Ven","Sam"];
const PAYMENT_METHODS = [
  { id: "wave", icon: "🌊", name: "Wave", detail: "Envoyez au +225 05 04 60 85 11" },
  { id: "orange", icon: "🟠", name: "Orange Money", detail: "Envoyez au +225 05 04 60 85 11" },
  { id: "mobile", icon: "📱", name: "Mobile Money", detail: "MTN / Moov — +225 05 04 60 85 11" },
  { id: "card", icon: "💳", name: "Carte Bancaire", detail: "Visa / Mastercard — lien via WhatsApp" },
  { id: "crypto", icon: "₿", name: "Cryptomonnaie", detail: "USDT / BTC — adresse via WhatsApp" },
];

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return WEEKDAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, date: d, key: d.toISOString().slice(0, 10) };
  });
}

function formatPrice(p) { return p.toLocaleString("fr-FR") + " FCFA"; }
function deadlineDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}
function isExpired(createdAt) {
  return Date.now() - createdAt > 3 * 24 * 60 * 60 * 1000;
}
function translateError(code) {
  const map = {
    "auth/email-already-in-use": "Email déjà utilisé.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
    "auth/weak-password": "Mot de passe trop court (6 car. min).",
  };
  return map[code] || "Erreur. Réessayez.";
}

let currentUser = null, bookings = [], resourceType = "desks";
let weekDates = getWeekDates(), selectedDateKey = weekDates[0].key;
let selectedResource = null, currentTab = "desks";
let showPaymentModal = false, pendingBooking = null;
let unsubscribeBookings = null, authView = "login", authError = "";

const root = document.getElementById("root");

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) { listenToBookings(); renderApp(); }
  else { if (unsubscribeBookings) unsubscribeBookings(); renderAuth(); }
});

function listenToBookings() {
  unsubscribeBookings = onSnapshot(query(collection(db, "bookings")), (snap) => {
    bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (root.dataset.view === "app") renderApp();
  });
}

function renderAuth() {
  root.dataset.view = "auth";
  root.innerHTML = `
    <div class="auth-wrap"><div class="auth-grid">
      <div class="auth-left">
        <div class="brand-row">
          <div class="brand-mark">NS</div>
          <div class="brand-word">Nova<span class="accent">Space</span></div>
        </div>
        <h1 class="auth-headline">Votre espace de travail,<br/><em>réservé en un clic.</em></h1>
        <p class="auth-sub">Postes et salles disponibles à la journée. Paiement sous 3 jours après réservation.</p>
        <div class="auth-stats">
          <div class="auth-stat"><div class="auth-stat-val">${DESKS.length}</div><div class="auth-stat-lbl">Postes</div></div>
          <div class="auth-stat"><div class="auth-stat-val">${ROOMS.length}</div><div class="auth-stat-lbl">Salles</div></div>
          <div class="auth-stat"><div class="auth-stat-val">5</div><div class="auth-stat-lbl">Paiements</div></div>
        </div>
        <div class="payment-badges">
          ${PAYMENT_METHODS.map(p => `<span class="pay-badge">${p.icon} ${p.name}</span>`).join("")}
        </div>
      </div>
      <div class="auth-right"><div class="auth-card">
        <div class="auth-tabs">
          <button class="auth-tab ${authView==="login"?"active":""}" data-authtab="login">Connexion</button>
          <button class="auth-tab ${authView==="signup"?"active":""}" data-authtab="signup">Créer un compte</button>
        </div>
        <form id="auth-form" class="form">
          ${authView==="signup"?`<div class="field"><label>Nom complet</label><input type="text" id="f-name" placeholder="Votre nom"/></div>`:""}
          <div class="field"><label>Email</label><input type="email" id="f-email" placeholder="vous@exemple.com"/></div>
          <div class="field"><label>Mot de passe</label><input type="password" id="f-password" placeholder="••••••••"/></div>
          ${authError?`<div class="error-box">${authError}</div>`:""}
          <button type="submit" class="submit-btn">${authView==="login"?"Se connecter →":"Créer mon compte →"}</button>
        </form>
      </div></div>
    </div></div>`;
  document.querySelectorAll("[data-authtab]").forEach(b => b.addEventListener("click", () => { authView=b.dataset.authtab; authError=""; renderAuth(); }));
  document.getElementById("auth-form").addEventListener("submit", handleAuth);
}

async function handleAuth(e) {
  e.preventDefault(); authError="";
  const email = document.getElementById("f-email").value.trim();
  const password = document.getElementById("f-password").value;
  try {
    if (authView==="signup") {
      const name = document.getElementById("f-name").value.trim();
      if (!name||!email||password.length<6) { authError="Remplissez tous les champs."; renderAuth(); return; }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch(err) { authError=translateError(err.code); renderAuth(); }
}

function isOccupied(rid, dk) { return bookings.some(b=>b.resourceId===rid&&b.dateKey===dk&&!isExpired(b.createdAt)); }
function myBooking(rid, dk) { return bookings.find(b=>b.resourceId===rid&&b.dateKey===dk&&b.userId===currentUser.uid&&!isExpired(b.createdAt)); }

let toastTimer=null;
function showToast(msg, kind="ok") {
  let el=document.getElementById("toast");
  if(!el){el=document.createElement("div");el.id="toast";document.body.appendChild(el);}
  el.className=`toast ${kind==="warn"?"warn":""}`;
  el.innerHTML=`${kind==="warn"?"✕":"✓"} ${msg}`;
  el.style.display="flex";
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{el.style.display="none";},3000);
}

function renderApp() {
  root.dataset.view="app";
  const list = resourceType==="desks"?DESKS:ROOMS;
  const myBookings = bookings.filter(b=>b.userId===currentUser.uid&&!isExpired(b.createdAt)).sort((a,b)=>a.dateKey.localeCompare(b.dateKey));
  root.innerHTML=`
    <div class="app">
      ${showPaymentModal?renderModal():""}
      <header class="header">
        <div class="brand-row">
          <div class="brand-mark-sm">NS</div>
          <div class="brand-word-sm">Nova<span class="accent">Space</span></div>
        </div>
        <div class="header-right">
          <div class="user-chip">👤 ${(currentUser.displayName||currentUser.email).split(" ")[0]}</div>
          <button id="logout-btn" class="logout-btn">Déconnexion</button>
        </div>
      </header>
      <nav class="tab-nav">
        <button class="tab-btn ${currentTab==="desks"?"active":""}" data-tab="desks">📋 Réserver</button>
        <button class="tab-btn ${currentTab==="bookings"?"active":""}" data-tab="bookings">✓ Mes réservations ${myBookings.length>0?`<span class="tab-badge">${myBookings.length}</span>`:""}</button>
        <button class="tab-btn ${currentTab==="payment"?"active":""}" data-tab="payment">💳 Paiement</button>
      </nav>
      <main class="main">
        ${currentTab==="desks"?renderBook(list):currentTab==="bookings"?renderMyBookings(myBookings):renderPayment()}
      </main>
      <footer class="footer">NovaSpace — Paiement sous 3 jours après réservation</footer>
    </div>`;
  attachListeners(list);
}

function renderBook(list) {
  return `
    <div class="resource-toggle">
      <button class="resource-toggle-btn ${resourceType==="desks"?"active":""}" data-rtype="desks">🖥 Postes</button>
      <button class="resource-toggle-btn ${resourceType==="rooms"?"active":""}" data-rtype="rooms">🚪 Salles</button>
    </div>
    <div class="day-picker">
      ${weekDates.map(d=>`<button class="day-btn ${d.key===selectedDateKey?"active":""}" data-day="${d.key}"><span class="day-label">${d.label}</span><span class="day-num">${d.date.getDate()}</span></button>`).join("")}
    </div>
    <div class="book-grid">
      <div class="resource-list">
        ${list.map(r=>{
          const occ=isOccupied(r.id,selectedDateKey), mine=myBooking(r.id,selectedDateKey);
          return `<button class="resource-card ${selectedResource?.id===r.id?"active":""}" data-resource="${r.id}">
            <div class="resource-card-top"><span class="resource-name">${r.name}</span>
            <span class="avail-dot" style="background:${mine?"#2563EB":occ?"#E5484D":"#16C172"}"></span></div>
            <div class="resource-meta">${resourceType==="desks"?r.zone:`${r.capacity} pers. · ${r.equip}`}</div>
            <div class="resource-price">${formatPrice(r.price)} / jour</div>
            ${mine?`<div class="resource-mine">✓ Réservé — Payer avant le ${deadlineDate()}</div>`:""}
          </button>`;
        }).join("")}
      </div>
      <div class="slot-panel">
        ${!selectedResource?`<div class="empty-panel"><p>Choisissez ${resourceType==="desks"?"un poste":"une salle"} pour réserver.</p></div>`:`
          <div class="slot-panel-head"><div>
            <div class="slot-panel-title">${selectedResource.name}</div>
            <div class="slot-panel-sub">${weekDates.find(d=>d.key===selectedDateKey)?.date.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
          </div></div>
          <div class="price-box">
            <div class="price-big">${formatPrice(selectedResource.price)}</div>
            <div class="price-sub">par journée · paiement sous 3 jours</div>
          </div>
          ${(()=>{
            const occ=isOccupied(selectedResource.id,selectedDateKey), mine=myBooking(selectedResource.id,selectedDateKey);
            if(mine) return `<div class="booked-info">
              <div class="booked-title">✅ Réservé</div>
              <div class="booked-deadline">⏳ Payer avant le <strong>${deadlineDate()}</strong></div>
              <div class="payment-methods-mini">${PAYMENT_METHODS.map(p=>`<span class="pay-badge-sm">${p.icon} ${p.name}</span>`).join("")}</div>
              <button class="cancel-btn" style="margin-top:16px;width:100%" data-cancel="${mine.id}">Annuler</button>
            </div>`;
            if(occ) return `<div class="unavail-box">❌ Déjà réservé pour cette journée.</div>`;
            return `<button class="book-btn" id="book-now">Réserver maintenant</button>`;
          })()}
        `}
      </div>
    </div>`;
}

function renderMyBookings(myBookings) {
  return `
    <h2 class="section-title">Mes réservations</h2>
    <div class="deadline-notice">⏳ Paiement requis dans les <strong>3 jours</strong> suivant la réservation.</div>
    ${myBookings.length===0?`<div class="empty-state"><p>Aucune réservation active.</p><button class="submit-btn-sm" id="go-book">Réserver →</button></div>`:`
    <div class="bookings-list">
      ${myBookings.map(b=>`<div class="booking-row">
        <div class="booking-icon">${b.resourceType==="desks"?"🖥":"🚪"}</div>
        <div class="booking-info">
          <div class="booking-name">${b.resourceName}</div>
          <div class="booking-date">${new Date(b.dateKey).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</div>
          <div class="booking-price">${formatPrice(b.price)}</div>
          <div class="booking-deadline">💳 Payer avant le ${new Date(b.createdAt+3*24*60*60*1000).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="pay-now-btn" data-bid="${b.id}">Payer</button>
          <button class="cancel-btn" data-cancel="${b.id}">Annuler</button>
        </div>
      </div>`).join("")}
    </div>`}`;
}

function renderPayment() {
  return `
    <h2 class="section-title">Moyens de paiement</h2>
    <p style="color:#6B7470;margin-bottom:24px;font-size:14px">Après réservation, vous avez <strong>3 jours</strong> pour payer. Envoyez votre preuve sur WhatsApp.</p>
    <div class="payment-list">
      ${PAYMENT_METHODS.map(p=>`<div class="payment-row">
        <div class="payment-icon-big">${p.icon}</div>
        <div class="payment-info">
          <div class="payment-name">${p.name}</div>
          <div class="payment-detail">${p.detail}</div>
        </div>
      </div>`).join("")}
    </div>
    <div class="whatsapp-box">
      <div style="font-weight:700;margin-bottom:8px">📞 Confirmer votre paiement</div>
      <div style="font-size:13px;color:#6B7470;margin-bottom:16px">Envoyez votre capture de paiement sur WhatsApp.</div>
      <a href="https://wa.me/2250504608511?text=Bonjour,%20j%27ai%20pay%C3%A9%20ma%20r%C3%A9servation%20NovaSpace." target="_blank" class="whatsapp-btn">💬 Envoyer sur WhatsApp</a>
    </div>`;
}

function renderModal() {
  if(!pendingBooking) return "";
  return `<div class="modal-overlay" id="modal-overlay"><div class="modal">
    <div class="modal-title">Confirmer la réservation</div>
    <div class="modal-resource">${pendingBooking.resource.name}</div>
    <div class="modal-date">${new Date(pendingBooking.dateKey).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
    <div class="modal-price">${formatPrice(pendingBooking.resource.price)}</div>
    <div class="modal-deadline">⏳ Paiement requis sous <strong>3 jours</strong></div>
    <div class="modal-pay-title">Moyens de paiement acceptés :</div>
    <div class="modal-pay-list">
      ${PAYMENT_METHODS.map(p=>`<div class="modal-pay-item">
        <span class="modal-pay-icon">${p.icon}</span>
        <div><div class="modal-pay-name">${p.name}</div><div class="modal-pay-detail">${p.detail}</div></div>
      </div>`).join("")}
    </div>
    <button class="modal-confirm" id="modal-confirm">✅ Confirmer</button>
    <button class="modal-cancel" id="modal-cancel">Annuler</button>
  </div></div>`;
}

async function bookResource() {
  if(!pendingBooking||!currentUser) return;
  const {resource, dateKey} = pendingBooking;
  const id = `${resource.id}_${dateKey}`.replace(/[:\s]/g,"");
  await setDoc(doc(db,"bookings",id),{
    userId: currentUser.uid,
    userName: currentUser.displayName||currentUser.email,
    resourceId: resource.id,
    resourceName: resource.name,
    resourceType,
    dateKey,
    price: resource.price,
    paymentStatus: "pending",
    createdAt: Date.now(),
  });
  showToast(`Réservé ! Payez avant le ${deadlineDate()}.`);
  showPaymentModal=false; pendingBooking=null;
}

function attachListeners(list) {
  document.getElementById("logout-btn")?.addEventListener("click",()=>signOut(auth));
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{currentTab=b.dataset.tab;renderApp();}));
  document.querySelectorAll("[data-rtype]").forEach(b=>b.addEventListener("click",()=>{resourceType=b.dataset.rtype;selectedResource=null;renderApp();}));
  document.querySelectorAll("[data-day]").forEach(b=>b.addEventListener("click",()=>{selectedDateKey=b.dataset.day;renderApp();}));
  document.querySelectorAll("[data-resource]").forEach(b=>b.addEventListener("click",()=>{selectedResource=list.find(r=>r.id===b.dataset.resource);renderApp();}));
  document.getElementById("book-now")?.addEventListener("click",()=>{pendingBooking={resource:selectedResource,dateKey:selectedDateKey};showPaymentModal=true;renderApp();});
  document.getElementById("modal-confirm")?.addEventListener("click",bookResource);
  document.getElementById("modal-cancel")?.addEventListener("click",()=>{showPaymentModal=false;pendingBooking=null;renderApp();});
  document.getElementById("modal-overlay")?.addEventListener("click",(e)=>{if(e.target.id==="modal-overlay"){showPaymentModal=false;pendingBooking=null;renderApp();}});
  document.querySelectorAll("[data-cancel]").forEach(b=>b.addEventListener("click",async()=>{await deleteDoc(doc(db,"bookings",b.dataset.cancel));showToast("Annulé.","warn");}));
  document.querySelectorAll("[data-bid]").forEach(b=>b.addEventListener("click",()=>{currentTab="payment";renderApp();}));
  document.getElementById("go-book")?.addEventListener("click",()=>{currentTab="desks";renderApp();});
}
