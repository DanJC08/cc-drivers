import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, limit, onSnapshot as onSnapshotDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { auth, db } from "../../assets/js/firebase.js";

const lista = document.getElementById('lista');
const contador = document.getElementById('contador');
const subInfo = document.getElementById('subInfo');

let tarifa = {base:20, por_km:10, por_min:1.5, minimo:35, factor_demanda:1.0, extra_nocturno:10, extra_lluvia:0};

try{
  const snapTarifa = await getDoc(doc(db,"config","tarifas"));
  if(snapTarifa.exists()){
    const d=snapTarifa.data();
    tarifa.base = Number(d.base)||20; tarifa.por_km = Number(d.por_km)||10; tarifa.por_min = Number(d.por_min)||1.5; tarifa.minimo = Number(d.minimo)||35;
    tarifa.factor_demanda = Number(d.factor_demanda)||1.0; tarifa.extra_nocturno = Number(d.extra_nocturno)||0; tarifa.extra_lluvia = Number(d.extra_lluvia)||0;
  }
  onSnapshotDoc(doc(db,"config","tarifas"), s=>{
    if(!s.exists()) return; const d=s.data();
    tarifa.base = Number(d.base)||tarifa.base; tarifa.por_km = Number(d.por_km)||tarifa.por_km; tarifa.por_min = Number(d.por_min)||tarifa.por_min;
    tarifa.minimo = Number(d.minimo)||tarifa.minimo; tarifa.factor_demanda = Number(d.factor_demanda)||1.0;
    tarifa.extra_nocturno = Number(d.extra_nocturno)||0; tarifa.extra_lluvia = Number(d.extra_lluvia)||0; render();
  });
}catch(e){}

let conductorCoords = null; 
let conductorData = null; 
let viajesPendientes = []; 
let viajesTomados = []; 
let prevCount = -1;
let unsubPendientes = null; 
let unsubTomados = null; 
let ultimoUpdate = 0; 
let watchId = null;

// RUTA CORREGIDA A ASSETS
const audio = new Audio('../../assets/sounds/mk64_toad01.wav'); 
audio.preload='auto'; audio.volume = 1.0; 
let audioListo=false;

function desbloquearAudio(){ if(audioListo) return; audio.play().then(()=>{audio.pause();audio.currentTime=0;audioListo=true;}).catch(()=>{}); }
document.addEventListener('click', desbloquearAudio, {once:true}); 
document.addEventListener('touchstart', desbloquearAudio, {once:true});

function sonar(){ desbloquearAudio(); audio.currentTime=0; audio.play().catch(()=>{}); if(navigator.vibrate) navigator.vibrate([400,100,400,100,400]); let o=document.title; document.title="🔥 ¡NUEVO VIAJE! 🔥"; setTimeout(()=>document.title=o,2000); }

document.getElementById('logout').onclick=async()=>{ 
  if(watchId) navigator.geolocation.clearWatch(watchId); 
  await signOut(auth); 
  location.href="./login.html"; 
}

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="./login.html"; return; }
  try{
    const snap=await getDoc(doc(db,"conductores",user.uid));
    if(!snap.exists() || snap.data().estado!=="aprobado"){ await signOut(auth); window.location.href="./login.html"; return; }
    conductorData = {uid:user.uid,...snap.data()};
    subInfo.textContent = `👋 ${conductorData.nombre} • Base $${tarifa.base} • GPS buscando...`;
    if(unsubPendientes) unsubPendientes();
    const qPend = query(collection(db,"servicios_prueba"),where("estado","in",["pendiente","programado"]),limit(20));
    unsubPendientes = onSnapshot(qPend, (snap)=>{
      const nuevos=[]; snap.forEach(d=>nuevos.push({id:d.id,...d.data()}));
      nuevos.sort((a,b)=>{ if(a.estado==='pendiente'&&b.estado==='programado')return -1; if(a.estado==='programado'&&b.estado==='pendiente')return 1; return 0; });
      if(prevCount!==-1 && nuevos.length>prevCount) sonar();
      prevCount=nuevos.length; viajesPendientes=nuevos; render();
    });
    if(unsubTomados) unsubTomados();
    const qTom = query(collection(db,"servicios_prueba"),where("estado","==","tomado"),where("conductorId","==",user.uid));
    unsubTomados = onSnapshot(qTom, (snap)=>{ const arr=[]; snap.forEach(d=>arr.push({id:d.id,...d.data()})); viajesTomados = arr; render(); });
  }catch(e){ subInfo.textContent = "Error leyendo perfil: "+e.message; }
});

function calcKm(a,b){ const R=6371; const dLat=(b.lat-a.lat)*Math.PI/180; const dLng=(b.lng-a.lng)*Math.PI/180; const s=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2; return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s)); }

function calcularPrecio(distKm){
  const min = (distKm/30)*60; let precio = tarifa.base + (distKm * tarifa.por_km) + (min * tarifa.por_min);
  const hora = new Date().getHours(); if(tarifa.factor_demanda>1) precio*=tarifa.factor_demanda;
  if((hora>=22||hora<6)&&tarifa.extra_nocturno>0) precio+=tarifa.extra_nocturno; if(tarifa.extra_lluvia>0) precio+=tarifa.extra_lluvia;
  precio = Math.max(precio, tarifa.minimo); return Math.round(precio/5)*5;
}

function actualizarDistancias(){
  if(!conductorCoords) return;
  document.querySelectorAll('.card[data-tipo="pendiente"]').forEach((card, i)=>{
    const v = viajesPendientes[i]; if(!v ||!v.origenLat ||!v.origenLng) return;
    const distCO = calcKm(conductorCoords, {lat:v.origenLat, lng:v.origenLng})*1.3;
    const tag = card.querySelector('.dist-tag'); if(tag) tag.textContent = distCO.toFixed(1)+' km de ti';
  });
}

watchId = navigator.geolocation.watchPosition(pos=>{
  conductorCoords = {lat:pos.coords.latitude, lng:pos.coords.longitude};
  if(conductorData) subInfo.textContent = `👋 ${conductorData.nombre} • En viaje • Actualiza cada 1 min`;
  const ahora = Date.now();
  if(ahora - ultimoUpdate > 60000 && viajesTomados.length>0){
    ultimoUpdate = ahora;
    viajesTomados.forEach(v=>{ updateDoc(doc(db,"servicios_prueba",v.id),{ conductorLat: conductorCoords.lat, conductorLng: conductorCoords.lng, conductorLastUpdate: new Date().toISOString() }); });
  }
  actualizarDistancias();
}, ()=>{ subInfo.textContent=`Base $${tarifa.base} • Sin GPS`; }, {enableHighAccuracy:true, maximumAge:30000, timeout:15000});

function abrirNavegacion(v){
  let url = '';
  if(conductorCoords && v.origenLat && v.destinoLat){ url = `https://www.google.com/maps/dir/?api=1&origin=${conductorCoords.lat},${conductorCoords.lng}&destination=${v.destinoLat},${v.destinoLng}&waypoints=${v.origenLat},${v.origenLng}&travelmode=driving`; }
  else if(v.origenLat && v.destinoLat){ url = `https://www.google.com/maps/dir/?api=1&origin=${v.origenLat},${v.origenLng}&destination=${v.destinoLat},${v.destinoLng}&travelmode=driving`; }
  else { url = `https://www.google.com/maps/dir/${encodeURIComponent(v.origen)}/${encodeURIComponent(v.destino)}/`; }
  window.open(url, '_blank');
}

async function render(){
  const totalViajes = viajesPendientes.length + viajesTomados.length;
  contador.textContent = totalViajes; lista.innerHTML='';
  if(totalViajes===0){lista.innerHTML='<div class="vacio"><div>☕️</div>Sin viajes</div>';return;}
  
  for(let v of viajesTomados){
    const distOD = v.distanciaOrigenDestino || v.distanciaTotal || 0;
    const distCO = v.distanciaConductorOrigen || 0;
    const precio = v.precioCobrado || v.precio || v.precioCliente || v.precioEstimado || calcularPrecio(distOD);
    const fechaHoraHtml = v.fechaHoraProgramada ? `<div class="hora-pill prog">⏰ ${new Date(v.fechaHoraProgramada).toLocaleString('es-MX',{dateStyle:'short', timeStyle:'short'})}</div>` : `<div class="hora-pill ahora">🔥 AHORA • A ${distCO? distCO.toFixed(1)+' km de ti' : 'cerca'}</div>`;
    const card=document.createElement('div'); card.className='card activo'; card.dataset.tipo="tomado";
    card.innerHTML=`
      ${fechaHoraHtml}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="cliente">${v.cliente||'Cliente'}</span><span class="tel">${v.telefono||''}</span></div>
      <div class="ruta">
        <div class="line"><div class="dot-o"></div><div><small style="color:#8E8E93;font-size:11px;font-weight:700">RECOGER <span class="dist-tag">${distCO? distCO.toFixed(1)+' km de ti' : ''}</span></small><br><b>${v.origen}</b></div></div>
        <div class="line"><div class="dot-d"></div><div><small style="color:#8E8E93;font-size:11px;font-weight:700">DESTINO <span class="dist-tag2">${distOD? distOD.toFixed(1)+' km' : ''}</span></small><br><b>${v.destino}</b></div></div>
      </div>
      <div class="row-precio">
        <div class="precio-box">
          <div><small style="color:#8E8E93">${distOD.toFixed(1)} km de viaje • Precio fijo cliente</small></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px"><b>$${precio} MXN</b><span style="font-size:11px;color:#C5A880">En curso</span></div>
        </div>
        <button class="btn-wsp-icon btn-wsp" title="WhatsApp">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2a10 10 0 0 0-8.76 14.85L2 22l5.33-1.39A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.08-1.12l-.29-.17-3.16.83.84-3.06-.19-.31A8 8 0 1 1 12 20zm4.56-6.03c-.25-.12-1.47-.72-1.7-.8-.22-.08-.38-.12-.54.12-.16.25-.64.8-.78.96-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.39.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.24-.42.08-.16.04-.31-.02-.43-.06-.12-.54-1.31-.74-1.8-.2-.46-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.61.57.24 1.02.38 1.37.49.57.18 1.1.16 1.51.1.46-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.14-1.18-.06-.11-.22-.16-.47-.29z"/></svg>
        </button>
      </div>
      <div class="row-acciones">
        <button class="btn-finalizar">✅ Finalizar viaje</button>
        <button class="btn-maps-icon btn-nav-completo" title="Navegación">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A84FF" stroke="#0A84FF" stroke-width="2" stroke-linejoin="round"><path d="M3 11L22 2L13 21L11 13L3 11Z"/></svg>
        </button>
      </div>
    `;
    card.querySelector('.btn-nav-completo').onclick=()=>abrirNavegacion(v);
    card.querySelector('.btn-wsp').onclick=()=>{
      const telLimpio=(v.telefono||'').replace(/[^0-9]/g,''); if(!telLimpio) return alert("Sin teléfono");
      const msg = `Hola ${v.cliente||''} 👋\nSoy ${conductorData.nombre}, tu conductor de CC DRIVERS 🚗\nVoy en camino.\n\n💰 Precio del viaje: $${precio} MXN`;
      window.open(`https://wa.me/52${telLimpio}?text=${encodeURIComponent(msg)}`,'_blank');
    };
    card.querySelector('.btn-finalizar').onclick=async()=>{
      if(!confirm(`¿Finalizar viaje de ${v.cliente}?\n$${precio} MXN`)) return;
      if(watchId) navigator.geolocation.clearWatch(watchId);
      await updateDoc(doc(db,"servicios_prueba",v.id),{ estado:"finalizado", finalizadoEn:new Date().toISOString() });
    };
    lista.appendChild(card);
  }

  for(let v of viajesPendientes){
    const distOD = v.distanciaOrigenDestino || v.distanciaTotal || v.distancia || 0;
    let distCO = 0; if(conductorCoords && v.origenLat && v.origenLng){ distCO = calcKm(conductorCoords, {lat:v.origenLat, lng:v.origenLng})*1.3; }
    const precioFijo = v.precio || v.precioCliente || v.precioEstimado || calcularPrecio(distOD);
    const horaHtml = v.fechaHoraProgramada? `<div class="hora-pill prog">⏰ ${new Date(v.fechaHoraProgramada).toLocaleString('es-MX',{dateStyle:'short', timeStyle:'short'})}</div>` : `<div class="hora-pill ahora">🔥 AHORA • A ${distCO? distCO.toFixed(1)+' km de ti' : 'cerca'}</div>`;
    const card=document.createElement('div'); card.className='card'; card.dataset.tipo="pendiente";
    card.innerHTML=`
      ${horaHtml}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span class="cliente">${v.cliente||'Cliente'}</span><span class="tel">${v.telefono||''}</span></div>
      <div class="ruta">
        <div class="line"><div class="dot-o"></div><div><small style="color:#8E8E93;font-size:11px;font-weight:700">RECOGER <span class="dist-tag">${distCO? distCO.toFixed(1)+' km de ti' : 'calculando...'}</span></small><br><b>${v.origen}</b></div></div>
        <div class="line"><div class="dot-d"></div><div><small style="color:#8E8E93;font-size:11px;font-weight:700">DESTINO <span class="dist-tag2">${distOD? distOD.toFixed(1)+' km' : ''}</span></small><br><b>${v.destino}</b></div></div>
      </div>
      <div class="row-precio">
        <div class="precio-box"><div><small style="color:#8E8E93">${distOD.toFixed(1)} km viaje</small></div><div style="margin-top:2px"><b>$${precioFijo} MXN</b></div></div>
      </div>
      <div class="row-acciones">
        <button class="btn-tomar">Tomar viaje</button>
        <button class="btn-rechazar">Rechazar</button>
      </div>
    `;
    card.querySelector('.btn-tomar').onclick=async()=>{
      if(viajesTomados.length>0) return alert("Ya tienes un viaje en curso. Finalízalo primero.");
      if(!conductorData) return alert("Cargando datos del conductor...");
      await updateDoc(doc(db,"servicios_prueba",v.id),{ estado:"tomado", tomadoEn:new Date().toISOString(), conductorNombre:conductorData.nombre, conductorId: conductorData.uid, distanciaConductorOrigen:distCO, distanciaOrigenDestino:distOD, distanciaTotal:distOD, precioCobrado:precioFijo, tarifaKm:tarifa.por_km, tarifaUsada:tarifa, conductorLat:conductorCoords?.lat||null, conductorLng:conductorCoords?.lng||null, vistoPorAdmin:false });
    };
    card.querySelector('.btn-rechazar').onclick=async()=>{
      if(!confirm(`¿Rechazar viaje de ${v.cliente||'Cliente'}?\nSe avisará al cliente: No hay conductores disponibles.`)) return;
      try{
        await updateDoc(doc(db,"servicios_prueba",v.id),{ 
          estado:"sin_conductores",
          mensajeCliente:"No hay conductores disponibles por el momento. Intenta de nuevo en unos minutos.",
          rechazadoPor: conductorData?.uid || null,
          rechazadoEn: new Date().toISOString(),
          rechazadoNombre: conductorData?.nombre || "conductor",
          vistoPorCliente:false,
          vistoPorAdmin:false
        });
      }catch(e){ alert("Error al rechazar: "+e.message); }
    };
    lista.appendChild(card);
  }
    }
