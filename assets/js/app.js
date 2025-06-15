// === Firebase Config - Replace these values with your Firebase project config ===
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // Optional: storageBucket, messagingSenderId, appId can be added here
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let map; // Leaflet map instance
let parcelsLayer; // Layer for land parcels on map

// Initialize the map on page load but do not add parcels yet
function initMap() {
  map = L.map("map").setView([19.076, 72.8777], 10); // Mumbai coords, zoom level 10
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
}

// Style parcels by category
const categoryColors = {
  X: "#1f78b4",
  Y: "#33a02c",
  Z: "#e31a1c",
  J: "#ff7f00",
  K: "#6a3d9a",
  L: "#b15928",
  M: "#a6cee3",
  N: "#b2df8a",
  O: "#fb9a99",
  P: "#fdbf6f",
  Q: "#cab2d6",
  R: "#ffff99",
};

function styleFeature(feature) {
  return {
    color: "black",
    weight: 1,
    fillColor: categoryColors[feature.properties.category] || "#888",
    fillOpacity: 0.6,
  };
}

function onEachFeature(feature, layer) {
  const p = feature.properties;
  if (p) {
    layer.bindPopup(
      `<b>Survey No:</b> ${p.survey_no}<br/>
       <b>Category:</b> ${p.category}<br/>
       <b>Department:</b> ${p.department_id}`
    );
  }
}

// Render parcels on the map
function renderParcelsOnMap(featureCollection) {
  if (parcelsLayer) {
    parcelsLayer.clearLayers();
    map.removeLayer(parcelsLayer);
  }
  parcelsLayer = L.geoJSON(featureCollection, {
    style: styleFeature,
    onEachFeature: onEachFeature,
  }).addTo(map);
}

// Load parcels for logged-in user
async function loadParcelsForUser(user) {
  try {
    // Get user profile to find department and role
    const profileSnap = await db.collection("users").doc(user.uid).get();
    let dept = null,
      isAdmin = false;
    if (profileSnap.exists) {
      const profile = profileSnap.data();
      dept = profile.department;
      isAdmin = profile.role === "admin";
    } else {
      alert("User profile not found in Firestore.");
      return;
    }

    // Build query for parcels
    let parcelsQuery;
    if (isAdmin) {
      parcelsQuery = db.collection("parcels");
    } else if (dept) {
      parcelsQuery = db.collection("parcels").where("department", "==", dept);
    } else {
      alert("Department information missing. Cannot load parcels.");
      return;
    }

    const snapshot = await parcelsQuery.get();
    const features = [];
    snapshot.forEach((doc) => {
      const parcel = doc.data();
      features.push({
        type: "Feature",
        geometry: parcel.geometry,
        properties: {
          id: doc.id,
          survey_no: parcel.survey_no,
          category: parcel.category || "",
          department_id: parcel.department,
        },
      });
    });

    const parcelGeoJSON = { type: "FeatureCollection", features: features };
    renderParcelsOnMap(parcelGeoJSON);
  } catch (err) {
    console.error("Error loading parcels:", err);
    alert("Failed to load land parcels. See console for details.");
  }
}

// Auth state observer
auth.onAuthStateChanged((user) => {
  if (user) {
    document.getElementById("loginPanel").style.display = "none";
    document.getElementById("mapPanel").style.display = "block";
    document.getElementById("logoutBtn").style.display = "inline-block";
    loadParcelsForUser(user);
  } else {
    document.getElementById("loginPanel").style.display = "flex";
    document.getElementById("mapPanel").style.display = "none";
    document.getElementById("logoutBtn").style.display = "none";
    if (parcelsLayer) {
      parcelsLayer.clearLayers();
    }
  }
});

// Login button handler
document.getElementById("loginBtn").addEventListener("click", () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }
  auth
    .signInWithEmailAndPassword(email, password)
    .catch((error) => alert("Login failed: " + error.message));
});

// Logout button handler
document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.signOut();
});

// Initialize the map immediately on page load
initMap();
