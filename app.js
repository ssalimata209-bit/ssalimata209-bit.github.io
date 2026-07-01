/* ════════════════════════════════════════════════════════════
   NOVASPACE — Application de réservation coworking
   100% indépendante — utilise Firebase (auth + base de données)
   ════════════════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

/* ---------- Firebase init ---------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- Static data ---------- */
const DESKS = [
  { id: "d1", name: "Poste A1", zone: "Zone calme" },
  { id: "d2", name: "Poste A2", zone: "Zone calme" },
  { id: "d3", name: "Poste A3", zone: "Zone calme" },
  { id: "d4", name: "Poste B1", zone: "Zone collaborative" },
  { id: "d5", name: "Poste B2", zone: "Zone collaborative" },
  { id: "d6", name: "Poste B3", zone: "Zone collaborative" },
  { id: "d7", name: "Poste fenêtre 1", zone: "Vue extérieure" },
  { id: "d8", name: "Poste fenêtre 2", zone: "Vue extérieure" },
];
const ROOMS = [
  { id: "r1", name: "Salle Mercure", capacity: 4, equip: "Écran TV" },
  { id: "r2", name: "Salle Jupiter", capacity: 8, equip: "Visio + Écran" },
  { id: "r3", name: "Salle Orion", capacity: 12, equip: "Visio + Tableau" },
];
const SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const WEEKDAYS = ["Lun","Mar","Mer","Jeu","Ven","Sam"];

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  return WEEKDAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, date: d, key: d.toISOString().slice(0, 10) };
  });
}

/* ---------- App state ---------- */
let currentUser = null;
let bookings = []; // live from Firestore
let resourceType = "desks";
let weekDates = getWeekDates();
let selectedDateKey = weekDates[0].key;
let selectedResource = null;
let currentTab = "desks";
let unsubscribeBookings = null;

const root = document.getElementById("root");

/* ════════════════════════════════════════════════════════════
   AUTH STATE LISTENER — drives the whole app
   ════════════════════════════════════════════════════════════ */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    listenToBookings();
    renderApp();
  } else {
    if (unsubscribeBookings) unsubscribeBookings();
    renderAuth();
  }
});

function listenToBookings() {
  const q = query(collection(db, "bookings"));
  unsubscribeBookings = onSnapshot(q, (snap) => {
    bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (root.dataset.view === "app") renderApp();
  });
}

/* ════════════════════════════════════════════════════════════
   AUTH SCREENS
   ════════════════════════════════════════════════════════════ */
let authView = "login";
let authError = "";

function renderAuth() {
  root.dataset.view = "auth";
  root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-grid">
        <div class="auth-left">
          <div class="brand-row">
            <div class="brand-mark">NS</div>
            <div class="brand-word">Nova<span class="accent">Space</span></div>
          </div>
          <h1 class="auth-headline">Votre place vous<br/>attend, <em>en temps réel.</em></h1>
          <p class="auth-sub">Réservez un poste de travail ou une salle de réunion en quelques secondes. Disponibilité live, zéro friction.</p>
          <div class="auth-stats">
            <div class="auth-stat"><div class="auth-stat-val">${DESKS.length}</div><div class="auth-stat-lbl">Postes disponibles</div></div>
            <div class="auth-stat"><div class="auth-stat-val">${ROOMS.length}</div><div class="auth-stat-lbl">Salles équipées</div></div>
            <div class="auth-stat"><div class="auth-stat-val">08–18h</div><div class="auth-stat-lbl">Créneaux/jour</div></div>
          </div>
        </div>
        <div class="auth-right">
          <div class="auth-card">
            <div class="auth-tabs">
              <button class="auth-tab ${authView==='login'?'active':''}" data-authtab="login">Connexion</button>
              <button class="auth-tab ${authView==='signup'?'active':''}" data-authtab="signup">Créer un compte</button>
            </div>
            <form id="auth-form" class="form">
              ${authView === "signup" ? `
                <div class="field"><label>Nom complet</label><input type="text" id="f-name" placeholder="Votre nom" /></div>
              ` : ""}
              <div class="field"><label>Email</label><input type="email" id="f-email" placeholder="vous@exemple.com" /></div>
              <div class="field"><label>Mot de passe</label><input type="password" id="f-password" placeholder="••••••••" /></div>
              ${authError ? `<div class="error-box">${authError}</div>` : ""}
              <button type="submit" class="submit-btn" id="auth-submit">
                ${authView === "login" ? "Se connecter" : "Créer mon compte"} →
              </button>
            </form>
            <p class="auth-footnote">Vos données sont stockées de façon sécurisée sur Firebase, votre propre base de données.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll("[data-authtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      authView = btn.dataset.authtab;
      authError = "";
      renderAuth();
    });
  });

  document.getElementById("auth-form").addEventListener("submit", handleAuthSubmit);
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  authError = "";
  const submitBtn = document.getElementById("auth-submit");
  submitBtn.textContent = "...";
  submitBtn.disabled = true;

  const email = document.getElementById("f-email").value.trim();
  const password = document.getElementById("f-password").value;

  try {
    if (authView === "signup") {
      const name = document.getElementById("f-name").value.trim();
      if (!name || !email || password.length < 6) {
        authError = "Remplissez tous les champs (mot de passe : 6 caractères min).";
        renderAuth();
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      // onAuthStateChanged triggers renderApp automatically
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    authError = translateFirebaseError(err.code);
    renderAuth();
  }
}

function translateFirebaseError(code) {
  const map = {
    "auth/email-already-in-use": "Un compte existe déjà avec cet email.",
    "auth/invalid-email": "Adresse email invalide.",
    "auth/weak-password": "Mot de passe trop court (6 caractères min).",
    "auth/user-not-found": "Aucun compte avec cet email.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
  };
  return map[code] || "Une erreur est survenue. Réessayez.";
}

/* ════════════════════════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════════════════════════ */
let toastTimer = null;

function showToast(msg, kind = "ok") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.className = `toast ${kind === "warn" ? "warn" : ""}`;
  el.innerHTML = `${kind === "warn" ? "✕" : "✓"} ${msg}`;
  el.style.display = "flex";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = "none"; }, 2800);
}

function isSlotOccupied(resourceId, dateKey, slot) {
  return bookings.some((b) => b.resourceId === resourceId && b.dateKey === dateKey && b.slot === slot);
}
function myBookingFor(resourceId, dateKey, slot) {
  return bookings.find((b) => b.resourceId === resourceId && b.dateKey === dateKey && b.slot === slot && b.userId === currentUser.uid);
}

async function toggleSlot(resource, dateKey, slot) {
  const mine = myBookingFor(resource.id, dateKey, slot);
  const occupied = isSlotOccupied(resource.id, dateKey, slot);

  if (mine) {
    await deleteDoc(doc(db, "bookings", mine.id));
    showToast("Réservation annulée.", "warn");
    return;
  }
  if (occupied) {
    showToast("Ce créneau est déjà pris.", "warn");
    return;
  }
  const id = `${resource.id}_${dateKey}_${slot}`.replace(/[:\s]/g, "");
  await setDoc(doc(db, "bookings", id), {
    userId: currentUser.uid,
    userName: currentUser.displayName || currentUser.email,
    resourceId: resource.id,
    resourceName: resource.name,
    resourceType,
    dateKey,
    slot,
    createdAt: Date.now(),
  });
  showToast(`${resource.name} réservé à ${slot}.`);
}

async function cancelBooking(bookingId) {
  await deleteDoc(doc(db, "bookings", bookingId));
  showToast("Réservation annulée.", "warn");
}

function renderApp() {
  root.dataset.view = "app";
  const list = resourceType === "desks" ? DESKS : ROOMS;
  const myBookings = bookings
    .filter((b) => b.userId === currentUser.uid)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.slot.localeCompare(b.slot));

  root.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="brand-row">
          <div class="brand-mark-sm">NS</div>
          <div class="brand-word-sm">Nova<span class="accent">Space</span></div>
        </div>
        <div class="header-right">
          <div class="user-chip">👤 ${(currentUser.displayName || currentUser.email).split(" ")[0]}</div>
          <button id="logout-btn" class="logout-btn">Déconnexion</button>
        </div>
      </header>

      <nav class="tab-nav">
        <button class="tab-btn ${currentTab==='desks'?'active':''}" data-tab="desks">📋 Réserver</button>
        <button class="tab-btn ${currentTab==='bookings'?'active':''}" data-tab="bookings">
          ✓ Mes réservations ${myBookings.length > 0 ? `<span class="tab-badge">${myBookings.length}</span>` : ""}
        </button>
      </nav>

      <main class="main">
        ${currentTab === "desks" ? renderBookTab(list) : renderBookingsTab(myBookings)}
      </main>

      <footer class="footer">NovaSpace — Espace de coworking</footer>
    </div>
  `;

  attachAppListeners(list);
}

function renderBookTab(list) {
  return `
    <div class="resource-toggle">
      <button class="resource-toggle-btn ${resourceType==='desks'?'active':''}" data-rtype="desks">🖥 Postes de travail</button>
      <button class="resource-toggle-btn ${resourceType==='rooms'?'active':''}" data-rtype="rooms">🚪 Salles de réunion</button>
    </div>

    <div class="day-picker">
      ${weekDates.map(d => `
        <button class="day-btn ${d.key===selectedDateKey?'active':''}" data-day="${d.key}">
          <span class="day-label">${d.label}</span>
          <span class="day-num">${d.date.getDate()}</span>
        </button>
      `).join("")}
    </div>

    <div class="book-grid">
      <div class="resource-list">
        ${list.map(r => {
          const occCount = SLOTS.filter(s => isSlotOccupied(r.id, selectedDateKey, s)).length;
          const free = SLOTS.length - occCount;
          const dotColor = free > 4 ? "var(--accent)" : free > 0 ? "#E8A33D" : "#E5484D";
          return `
            <button class="resource-card ${selectedResource?.id===r.id?'active':''}" data-resource="${r.id}">
              <div class="resource-card-top">
                <span class="resource-name">${r.name}</span>
                <span class="avail-dot" style="background:${dotColor}"></span>
              </div>
              <div class="resource-meta">${resourceType==='desks' ? r.zone : `${r.capacity} pers. · ${r.equip}`}</div>
              <div class="resource-free">${free} créneau${free!==1?'x':''} libre${free!==1?'s':''}</div>
            </button>
          `;
        }).join("")}
      </div>

      <div class="slot-panel">
        ${!selectedResource ? `
          <div class="empty-panel">
            <p>Choisissez ${resourceType==='desks'?'un poste':'une salle'} pour voir les créneaux disponibles.</p>
          </div>
        ` : `
          <div class="slot-panel-head">
            <div>
              <div class="slot-panel-title">${selectedResource.name}</div>
              <div class="slot-panel-sub">${weekDates.find(d=>d.key===selectedDateKey).date.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</div>
            </div>
            <div class="legend">
              <span class="legend-item"><i class="legend-dot" style="background:var(--accent)"></i>Libre</span>
              <span class="legend-item"><i class="legend-dot" style="background:var(--ink)"></i>Pris</span>
              <span class="legend-item"><i class="legend-dot" style="background:var(--accent2)"></i>Vous</span>
            </div>
          </div>
          <div class="slots-grid">
            ${SLOTS.map(slot => {
              const occupied = isSlotOccupied(selectedResource.id, selectedDateKey, slot);
              const mine = myBookingFor(selectedResource.id, selectedDateKey, slot);
              const cls = mine ? "mine" : occupied ? "taken" : "free";
              return `<button class="slot-cell ${cls}" data-slot="${slot}">${slot}${mine ? ' ✓' : ''}</button>`;
            }).join("")}
          </div>
        `}
      </div>
    </div>
  `;
}

function renderBookingsTab(myBookings) {
  if (myBookings.length === 0) {
    return `
      <h2 class="section-title">Mes réservations</h2>
      <div class="empty-state">
        <p>Aucune réservation pour le moment.</p>
        <button class="submit-btn-sm" id="go-book">Réserver un espace →</button>
      </div>
    `;
  }
  return `
    <h2 class="section-title">Mes réservations</h2>
    <div class="bookings-list">
      ${myBookings.map(b => `
        <div class="booking-row">
          <div class="booking-icon">${b.resourceType==='desks'?'🖥':'🚪'}</div>
          <div class="booking-info">
            <div class="booking-name">${b.resourceName}</div>
            <div class="booking-date">${new Date(b.dateKey).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})} · ${b.slot}</div>
          </div>
          <button class="cancel-btn" data-cancel="${b.id}">Annuler</button>
        </div>
      `).join("")}
    </div>
  `;
}

function attachAppListeners(list) {
  document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => { currentTab = btn.dataset.tab; renderApp(); });
  });

  document.querySelectorAll("[data-rtype]").forEach(btn => {
    btn.addEventListener("click", () => {
      resourceType = btn.dataset.rtype;
      selectedResource = null;
      renderApp();
    });
  });

  document.querySelectorAll("[data-day]").forEach(btn => {
    btn.addEventListener("click", () => { selectedDateKey = btn.dataset.day; renderApp(); });
  });

  document.querySelectorAll("[data-resource]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedResource = list.find(r => r.id === btn.dataset.resource);
      renderApp();
    });
  });

  document.querySelectorAll("[data-slot]").forEach(btn => {
    btn.addEventListener("click", () => toggleSlot(selectedResource, selectedDateKey, btn.dataset.slot));
  });

  document.querySelectorAll("[data-cancel]").forEach(btn => {
    btn.addEventListener("click", () => cancelBooking(btn.dataset.cancel));
  });

  const goBook = document.getElementById("go-book");
  if (goBook) goBook.addEventListener("click", () => { currentTab = "desks"; renderApp(); });
}
