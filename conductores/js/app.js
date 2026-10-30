import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {apiKey:"AIzaSyChsXZQJMSSU2iYm2WgbQUO_dnzNPzT3kI",authDomain:"cc-drivers.firebaseapp.com",projectId:"cc-drivers",storageBucket:"cc-drivers.firebasestorage.app",messagingSenderId:"1052687152920",appId:"1:1052687152920:web:3b0f29e77fc51f4162d06d"};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === AUDIO 01 - TOAD ===
const audioToad = new Audio('../assets/sounds/mk64_toad01.wav');
audioToad.loop = true;
audioToad.preload = 'auto';
let audioDesbloqueado = false;

function desbloquearAudio() {
  if(audioDesbloqueado) return;
  audioToad.play().then(() => {
    audioToad.pause();
    audioToad.currentTime = 0;
    audioDesbloqueado = true;
    console.log('Audio desbloqueado');
  }).catch(()=>{});
}

// Desbloquear con primer toque
document.addEventListener('click', desbloquearAudio, {once:true});
document.addEventListener('touchstart', desbloquearAudio, {once:true});

function sonarNuevoViaje(viaje) {
  desbloquearAudio();
  audioToad.currentTime = 0;
  audioToad.loop = true;
  audioToad.play().catch(e => console.log('Audio bloqueado:', e));
  
  if (navigator.vibrate) navigator.vibrate([400, 100, 400, 100, 400, 100, 600]);
  
  if (Notification && Notification.permission === "granted") {
    new Notification("🚨 Nuevo Viaje CC", {
      body: viaje ? `${viaje.origen} → ${viaje.destino}` : "Tienes un nuevo viaje!",
      icon: "../assets/icons/icon-512.png"
    });
  }
}

function detenerSonido() {
  audioToad.pause();
  audioToad.currentTime = 0;
  audioToad.loop = false;
  if (navigator.vibrate) navigator.vibrate(0);
}

// Permisos notificación
if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}

// Tu lógica de conductores
const lista = document.getElementById('lista');
const contadorEl = document.getElementById('contador');
const subInfo = document.getElementById('subInfo');
const statusEl = document.getElementById('status');

let conductorId = localStorage.getItem('cc_conductor_id') || null;
let viajesActivos = [];
let audioActivo = false;
let ultimoConteo = 0;

function render() {
  if(viajesActivos.length === 0) {
    lista.innerHTML = `<div class="vacio"><div>📡</div>Esperando viajes...</div>`;
    contadorEl.textContent = '0';
    if(audioActivo) { detenerSonido(); audioActivo = false; }
    return;
  }
  contadorEl.textContent = viajesActivos.length;
  if(viajesActivos.length > ultimoConteo) {
    sonarNuevoViaje(viajesActivos[0]);
    audioActivo = true;
  }
  ultimoConteo = viajesActivos.length;
  
  lista.innerHTML = viajesActivos.map(v => `
    <div class="card" onclick="tomarViaje('${v.id}')">
      <div class="card-top"><b>${v.origen}</b> → ${v.destino}</div>
      <div class="card-sub">💰 $${v.precioFinal || v.precioEstimado} - ${v.cliente}</div>
      <button class="btn-tomar" onclick="event.stopPropagation(); tomarViaje('${v.id}'); detenerSonido();">TOMAR</button>
    </div>
  `).join('');
}

// Escuchar viajes pendientes
const q = query(collection(db, "servicios_prueba"), where("estado", "==", "pendiente"));
onSnapshot(q, (snap) => {
  viajesActivos = snap.docs.map(d => ({id: d.id, ...d.data()}));
  subInfo.textContent = `${viajesActivos.length} viajes nuevos`;
  statusEl.textContent = 'Conectado';
  render();
});

window.tomarViaje = async (id) => {
  detenerSonido();
  audioActivo = false;
  try {
    const ref = doc(db, "servicios_prueba", id);
    const snap = await getDoc(ref);
    if(!snap.exists()) return alert('Viaje ya no existe');
    const conductorSnap = await getDoc(doc(db, "conductores", conductorId || "demo"));
    await updateDoc(ref, {
      estado: 'tomado',
      conductorId: conductorId,
      conductorNombre: conductorSnap.exists() ? conductorSnap.data().nombre : 'Conductor',
      conductorTelefono: conductorSnap.exists() ? conductorSnap.data().telefono : '',
      tomadoEn: serverTimestamp()
    });
    alert('Viaje tomado!');
  } catch(e) { alert('Error: ' + e); }
};

window.detenerSonido = detenerSonido;

// Logout
document.getElementById('logout')?.addEventListener('click', () => {
  detenerSonido();
  localStorage.clear();
  location.href = '../index.html';
});

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./manifest.json'); }
