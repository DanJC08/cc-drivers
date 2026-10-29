import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
const db=getFirestore(initializeApp({apiKey:"AIzaSyChsXZQJMSSU2iYm2WgbQUO_dnzNPzT3kI",authDomain:"cc-drivers.firebaseapp.com",projectId:"cc-drivers",storageBucket:"cc-drivers.firebasestorage.app",messagingSenderId:"1052687152920",appId:"1:1052687152920:web:3b0f29e77fc51f4162d06d"}));
const origenInput = document.getElementById('origen');
const destinoInput = document.getElementById('destino');
const sugO = document.getElementById('sug-origen');
const sugD = document.getElementById('sug-destino');
const gpsInfo = document.getElementById('gpsInfo');
const precioBox = document.getElementById('precioBox');
const precioTotalEl = document.getElementById('precioTotal');
const precioDetalleEl = document.getElementById('precioDetalle');
const chkPriv = document.getElementById('chkPriv');
const privacidadBox = document.getElementById('privacidadBox');
const privacidadOk = document.getElementById('privacidadOk');
const fechaHoraInput = document.getElementById('fechaHora');
const chipUltima = document.getElementById('ultimaDireccionChip');
let origenCoords = null, destinoCoords = null, userCoords = null, unsubViaje = null;
let tarifa = {base:20, por_km:10, por_min:1.5, minimo:50, factor_demanda:1.1, extra_nocturno:15, extra_lluvia:0};
let ultimoCalculo = null, ultimaCoordsGuardada = null;
// CORRECCIÓN: YA NO BORRAMOS NADA AL INICIO
origenInput.value = ''; destinoInput.value = '';
function mostrarChipUltimaDireccion(){ 
  const ultima = localStorage.getItem('cc_ultimo_destino'); 
  const coordsStr = localStorage.getItem('cc_ultima_coords_destino'); 
  if(!ultima){ chipUltima.style.display='none'; return; } 
  if(coordsStr){ try{ ultimaCoordsGuardada = JSON.parse(coordsStr); }catch(e){} } 
  chipUltima.innerHTML = `<div onclick="window.usarUltimaDireccion()" style="background:#fff;border:1px dashed #E5E5EA;border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:8px;cursor:pointer"><span>🕒</span><div style="flex:1"><small style="color:#8E8E93;display:block;font-size:10px">Último destino</small><b style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:230px">${ultima}</b></div><span style="color:#FF7A00;font-size:12px;font-weight:800">Usar</span></div>`; 
  chipUltima.style.display='block'; 
}
window.usarUltimaDireccion = ()=>{ 
  const ultima = localStorage.getItem('cc_ultimo_destino'); 
  const coordsStr = localStorage.getItem('cc_ultima_coords_destino'); 
  if(!ultima) return; 
  destinoInput.value = ultima; 
  if(coordsStr){ try{ const c = JSON.parse(coordsStr); destinoCoords = c; ultimaCoordsGuardada = c; }catch(e){} }
  actualizarPrecioUI(); 
  chipUltima.style.display='none'; 
};
mostrarChipUltimaDireccion();
fechaHoraInput.addEventListener('focus', ()=>{ fechaHoraInput.type='datetime-local'; setTimeout(()=>fechaHoraInput.showPicker&&fechaHoraInput.showPicker(),100); });
fechaHoraInput.addEventListener('blur', ()=>{ if(!fechaHoraInput.value) fechaHoraInput.type='text'; });
fechaHoraInput.addEventListener('change', ()=>{ actualizarPrecioUI(); });
if(localStorage.getItem('privacidad_aceptada')==='1'){ chkPriv.checked = true; privacidadBox.style.display='none'; privacidadOk.style.display='block'; }
chkPriv.addEventListener('change',()=>{ if(chkPriv.checked){ localStorage.setItem('privacidad_aceptada','1'); localStorage.setItem('privacidad_fecha', new Date().toISOString()); }else{ localStorage.removeItem('privacidad_aceptada'); } });
try{ const tSnap = await getDoc(doc(db, "config", "tarifas")); if(tSnap.exists()){ const d = tSnap.data(); tarifa = { base: Number(d.base)||25, por_km: Number(d.por_km)||12, por_min: Number(d.por_min)||1.5, minimo: Number(d.minimo)||50, factor_demanda: Number(d.factor_demanda)||1.0, extra_nocturno: Number(d.extra_nocturno)||0, extra_lluvia: Number(d.extra_lluvia)||0 }; } onSnapshot(doc(db,"config","tarifas"), (snap)=>{ if(snap.exists()){ const d = snap.data(); tarifa.base = Number(d.base)||tarifa.base; tarifa.por_km = Number(d.por_km)||tarifa.por_km; tarifa.por_min = Number(d.por_min)||tarifa.por_min; tarifa.minimo = Number(d.minimo)||tarifa.minimo; tarifa.factor_demanda = Number(d.factor_demanda)||1.0; tarifa.extra_nocturno = Number(d.extra_nocturno)||0; tarifa.extra_lluvia = Number(d.extra_lluvia)||0; actualizarPrecioUI(); } }); }catch(e){}
navigator.geolocation.getCurrentPosition(pos=>{ userCoords = {lat:pos.coords.latitude, lng:pos.coords.longitude}; gpsInfo.innerHTML = `<span class="gps-dot"></span> Ubicado a ${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)}`; }, ()=>{ gpsInfo.textContent = "📍 Sin GPS - Sugerencias en todo México"; }, {enableHighAccuracy:true, timeout:8000});
function calcDistKm(a,b){ const R=6371; const dLat=(b.lat-a.lat)*Math.PI/180; const dLng=(b.lng-a.lng)*Math.PI/180; const s=Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2; return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s)); }
function getFechaDelViaje(){ const v = fechaHoraInput.value; if(v){ return new Date(v); } return new Date(); }
function esTarifaNocturna(){ const fechaViaje = getFechaDelViaje(); const hora = fechaViaje.getHours(); return (hora >= 22 || hora < 6); }
function calcularPrecioFinal(distKm){ const duracionMin = (distKm / 30) * 60; let precio = tarifa.base + (distKm * tarifa.por_km) + (duracionMin * tarifa.por_min); let extras = []; if(tarifa.factor_demanda > 1){ extras.push(`x${tarifa.factor_demanda} demanda`); precio = precio * tarifa.factor_demanda; } if(esTarifaNocturna() && tarifa.extra_nocturno > 0){ extras.push(`+$${tarifa.extra_nocturno} nocturno`); precio += tarifa.extra_nocturno; } if(tarifa.extra_lluvia > 0){ extras.push(`+$${tarifa.extra_lluvia} lluvia`); precio += tarifa.extra_lluvia; } precio = Math.max(precio, tarifa.minimo); precio = Math.round(precio/5)*5; return {precio, minutos: Math.round(duracionMin), extras, distKm}; }
function actualizarPrecioUI(){ if(!origenCoords ||!destinoCoords){ precioBox.style.display='none'; ultimoCalculo=null; return; } const dist = calcDistKm(origenCoords, destinoCoords) * 1.3; const calc = calcularPrecioFinal(dist); ultimoCalculo = calc; const etiquetaNocturna = esTarifaNocturna() ? ' + nocturna' : ''; precioDetalleEl.textContent = `${calc.minutos} min${etiquetaNocturna} sin tráfico`; precioTotalEl.textContent = `$${calc.precio}`; precioBox.style.display='flex'; }
async function buscarOSM(q){ let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=mx&limit=15&addressdetails=1`; if(userCoords){ const delta = 0.08; url += `&viewbox=${userCoords.lng-delta},${userCoords.lat+delta},${userCoords.lng+delta},${userCoords.lat-delta}&bounded=0&lat=${userCoords.lat}&lon=${userCoords.lng}`; } const r = await fetch(url, {headers:{'Accept-Language':'es'}}); let res = await r.json(); if(userCoords && res.length){ res = res.map(p=>({...p, _dist: calcDistKm(userCoords, {lat:parseFloat(p.lat), lng:parseFloat(p.lon)})})).sort((a,b)=>a._dist-b._dist); } return res.slice(0,6); }
function setupAutocomplete(input, sugDiv, setCoords){
  let t=null;
  async function seleccionarMiUbicacion(){ if(!userCoords){ alert("Activa tu GPS"); return; } input.value = "Detectando..."; sugDiv.style.display='none'; try{ const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userCoords.lat}&lon=${userCoords.lng}&zoom=18&addressdetails=1`); const data = await r.json(); const calle = data.address.road || data.address.neighbourhood || "Mi ubicación"; const numero = data.address.house_number? ` ${data.address.house_number}` : ""; const colonia = data.address.suburb || ""; const direccionBonita = colonia? `${calle}${numero}, ${colonia}` : data.display_name.split(',').slice(0,3).join(', '); input.value = direccionBonita; setCoords({lat:userCoords.lat, lng:userCoords.lng}); actualizarPrecioUI(); }catch(e){ input.value = "Mi ubicación actual"; setCoords({lat:userCoords.lat, lng:userCoords.lng}); actualizarPrecioUI(); } }
  function pintarSugerencias(res, esOrigen){ sugDiv.innerHTML=''; if(esOrigen && userCoords){ const divMiUbi = document.createElement('div'); divMiUbi.style.background = "#F0F9FF"; divMiUbi.innerHTML = `<b>📍 Mi ubicación</b><small>Usar tu ubicación actual</small>`; divMiUbi.onclick = seleccionarMiUbicacion; sugDiv.appendChild(divMiUbi); } res.forEach(p=>{ const div=document.createElement('div'); const corto = p.display_name.split(',').slice(0,3).join(', '); const dist = p._dist? `${p._dist.toFixed(1)} km de ti` : p.address?.city || ''; div.innerHTML = `<b>${corto}</b><small>📍 ${dist}</small>`; div.onclick=()=>{ input.value = corto; setCoords({lat:parseFloat(p.lat), lng:parseFloat(p.lon)}); sugDiv.style.display='none'; actualizarPrecioUI(); }; sugDiv.appendChild(div); }); sugDiv.style.display = 'block'; }
  input.addEventListener('focus', ()=>{ if(input===origenInput && userCoords && input.value.trim().length<2){ pintarSugerencias([], true); } });
  input.addEventListener('input', ()=>{ clearTimeout(t); const q=input.value.trim(); setCoords(null); precioBox.style.display='none'; ultimoCalculo=null; if(q.length<2){ if(input===origenInput && userCoords){ pintarSugerencias([], true); } else sugDiv.style.display='none'; return; } t=setTimeout(async()=>{ const res = await buscarOSM(q); pintarSugerencias(res, input===origenInput); },300); });
  document.addEventListener('click', (e)=>{ if(!sugDiv.contains(e.target) && e.target!==input) sugDiv.style.display='none'; });
}
setupAutocomplete(origenInput, sugO, c=>origenCoords=c);
setupAutocomplete(destinoInput, sugD, c=>destinoCoords=c);
document.getElementById('btn').onclick=async()=>{
  const o=origenInput.value.trim(), d=destinoInput.value.trim(); const nombre=document.getElementById('nombre').value.trim()||'Cliente'; const tel=document.getElementById('telefono').value.trim(); const estado=document.getElementById('estado'); const btn=document.getElementById('btn'); if(!chkPriv.checked){ alert("Debes aceptar el Aviso de Privacidad"); return; } if(!o||!d){ alert("Pon origen y destino"); return; } if(tel.length<10){ alert("Celular a 10 dígitos"); return; } if(unsubViaje){ unsubViaje(); unsubViaje=null; } btn.disabled=true; btn.textContent='Enviando...'; estado.style.display='none';
  try{
    if(!origenCoords){ const r=await buscarOSM(o); if(!r[0]) throw "Origen no encontrado"; origenCoords={lat:parseFloat(r[0].lat), lng:parseFloat(r[0].lon)}; }
    if(!destinoCoords){ const r=await buscarOSM(d); if(!r[0]) throw "Destino no encontrado"; destinoCoords={lat:parseFloat(r[0].lat), lng:parseFloat(r[0].lon)}; }
    if(!ultimoCalculo) actualizarPrecioUI(); const dist = ultimoCalculo?.distKm || calcDistKm(origenCoords, destinoCoords) * 1.3; const calc = calcularPrecioFinal(dist);
    // CORRECCIÓN: AHORA GUARDAMOS DESTINO
    localStorage.setItem('cc_ultimo_destino', d); 
    if(destinoCoords) localStorage.setItem('cc_ultima_coords_destino', JSON.stringify(destinoCoords));
    const docRef = await addDoc(collection(db,"servicios_prueba"),{ cliente:nombre, telefono:tel, origen:o, destino:d, origenLat:origenCoords.lat, origenLng:origenCoords.lng, destinoLat:destinoCoords.lat, destinoLng:destinoCoords.lng, distanciaOrigenDestino:dist, distanciaTotal:dist, precioEstimado: calc.precio, precioFinal: calc.precio, tiempoMin: calc.minutos, tarifaUsada: tarifa, extras: calc.extras.join(", "), esNocturna: esTarifaNocturna(), estado: fechaHoraInput.value?'programado':'pendiente', fechaHoraProgramada: fechaHoraInput.value? new Date(fechaHoraInput.value).toISOString():null, creado:serverTimestamp(), clienteLat:userCoords?.lat||null, clienteLng:userCoords?.lng||null, aceptoPrivacidad: true });
    estado.innerHTML = `✅ Viaje enviado<br><small>💰 $${calc.precio}${esTarifaNocturna()?' (nocturna)':''} - Buscando conductor...</small>`; estado.className='ok'; estado.style.display='block'; btn.textContent='Buscando conductor...';
    unsubViaje = onSnapshot(doc(db, "servicios_prueba", docRef.id), (snap)=>{
      if(!snap.exists()) return; const v=snap.data();
      if(v.estado==='sin_conductores'){ estado.innerHTML = `<div style="text-align:center"><div style="font-size:30px">😕</div><div style="font-weight:900;font-size:16px;margin:8px 0">No hay conductores disponibles</div><div style="font-size:13px;line-height:1.3">${v.mensajeCliente || 'Por el momento no hay conductores disponibles. Intenta de nuevo en unos minutos.'}</div><button onclick="location.reload()" style="margin-top:12px;background:#111;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:800">Intentar de nuevo</button></div>`; estado.className='err'; estado.style.display='block'; btn.textContent='Solicitar Viaje'; btn.disabled=false; if(unsubViaje){ unsubViaje(); unsubViaje=null; } return; }
      if(v.estado==='tomado' || v.conductorNombre){ let kmC = v.distanciaConductorOrigen || 0; if(!kmC){ const latC = v.conductorLat; const lngC = v.conductorLng; if(latC && lngC){ kmC = calcDistKm({lat:v.origenLat, lng:v.origenLng}, {lat:latC, lng:lngC}); } } let tiempoTxt = kmC>0? `a ${Math.max(1,Math.round((kmC/30)*60))} min` : `en camino`; const telC = v.conductorTelefono||''; estado.innerHTML = `<div style="text-align:left"><div style="font-size:16px">✅ <b>${v.conductorNombre||'Conductor'} tomó tu viaje</b></div><div style="margin-top:6px">🚗 <b>${tiempoTxt}</b></div><div>💰 Total: $${v.precioFinal||calc.precio}</div>${telC?`<a href="https://wa.me/52${telC.replace(/[^0-9]/g,'').slice(-10)}" target="_blank" style="display:block;margin-top:10px;background:#111;color:#fff;text-align:center;padding:12px;border-radius:10px;text-decoration:none">WhatsApp al conductor</a>`:''}</div>`; btn.textContent='Conductor asignado'; btn.disabled=true; }
    });
    origenInput.value=''; destinoInput.value=''; fechaHoraInput.value=''; fechaHoraInput.type='text'; origenCoords=null; destinoCoords=null; precioBox.style.display='none'; ultimoCalculo=null; mostrarChipUltimaDireccion();
  }catch(e){ console.error(e); estado.textContent='❌ '+e; estado.className='err'; estado.style.display='block'; btn.textContent='Solicitar Viaje'; btn.disabled=false; }
};
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js'); }
