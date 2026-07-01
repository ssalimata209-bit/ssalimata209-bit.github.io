# 🚀 NovaSpace — Guide de mise en route

Votre application vous appartient à 100%. Elle utilise **Firebase** (gratuit,
propriété Google) pour gérer les comptes et les réservations en temps réel.

---

## Étape 1 — Créer votre projet Firebase (10 minutes)

1. Allez sur **https://console.firebase.google.com**
2. Connectez-vous avec votre compte Google
3. Cliquez sur **"Ajouter un projet"**
4. Nommez-le par exemple `novaspace` → suivez les étapes (vous pouvez désactiver Google Analytics)
5. Une fois créé, vous arrivez sur le tableau de bord

---

## Étape 2 — Activer l'authentification

1. Dans le menu de gauche → **Build** → **Authentication**
2. Cliquez **"Get started"**
3. Choisissez **"Email/Password"** dans la liste des fournisseurs
4. Activez-le (toggle) → **Save**

---

## Étape 3 — Créer la base de données

1. Dans le menu de gauche → **Build** → **Firestore Database**
2. Cliquez **"Create database"**
3. Choisissez **"Start in test mode"** (on sécurisera plus tard)
4. Choisissez une région proche de vous (ex: `eur3` pour l'Europe/Afrique)
5. Cliquez **"Enable"**

---

## Étape 4 — Récupérer vos clés de connexion

1. Cliquez sur l'icône ⚙️ (Paramètres) en haut à gauche → **"Paramètres du projet"**
2. Descendez à **"Vos applications"** → cliquez sur l'icône **`</>`** (Web)
3. Donnez un surnom (ex: `novaspace-web`) → **"Enregistrer l'application"**
4. Firebase vous montre un bloc de code avec vos clés : copiez-les

5. Ouvrez le fichier **`firebase-config.js`** et remplacez les valeurs :

```js
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",          // ← collez ici
  authDomain: "...",                 // ← collez ici
  projectId: "...",                  // ← collez ici
  storageBucket: "...",              // ← collez ici
  messagingSenderId: "...",          // ← collez ici
  appId: "...",                      // ← collez ici
};
```

---

## Étape 5 — Sécuriser votre base de données

Avant de mettre en ligne publiquement, remplacez les règles Firestore :

1. Dans **Firestore Database** → onglet **"Rules"**
2. Remplacez le contenu par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bookings/{bookingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

3. Cliquez **"Publish"**

Cela garantit que seuls les utilisateurs connectés peuvent voir les réservations,
et que chacun ne peut annuler que SES PROPRES réservations.

---

## Étape 6 — Tester en local

Ouvrez simplement `index.html` dans votre navigateur — ça devrait fonctionner
directement puisque tout est en JavaScript natif (pas de build nécessaire).

---

## Étape 7 — Mettre en ligne (gratuit)

**Option simple : Firebase Hosting** (puisque vous avez déjà un compte Firebase)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

**Ou : GitHub Pages** (comme pour votre site précédent)
- Créez un dépôt, uploadez ces fichiers, activez GitHub Pages

---

## 📁 Fichiers de votre application

- `index.html` — page principale
- `app.js` — toute la logique (auth, réservations, affichage)
- `style.css` — le design
- `firebase-config.js` — **vos clés de connexion (à remplir)**

---

## ✅ Ce que fait l'application

- Inscription / connexion par email
- Réservation de 8 postes de travail + 3 salles de réunion
- Calendrier 7 jours × 11 créneaux horaires (8h–18h)
- Disponibilité en temps réel (tous les utilisateurs voient les mêmes données)
- Page "Mes réservations" avec annulation

Tout cela est **entièrement à vous** — vous pouvez modifier les postes, les
salles, les couleurs, ou ajouter des fonctionnalités librement dans le code.
