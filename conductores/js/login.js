import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyChsXZQJMSSU2iYm2WgbQUO_dnzNPzT3kI",authDomain:"cc-drivers.firebaseapp.com",projectId:"cc-drivers",storageBucket:"cc-drivers.firebasestorage.app",messagingSenderId:"1052687152920",appId:"1:1052687152920:web:3b0f29e77fc51f4162d06d"};
const app=initializeApp(firebaseConfig); const auth=getAuth(app); const db=getFirestore(app);

onAuthStateChanged(auth, async (user)=>{
  if(user){
    const snap = await getDoc(doc(db,"conductores",user.uid));
    if(snap.exists() && snap.data().estado==="aprobado") location.href="./conductores-app.html";
  }
});

document.getElementById('btn').onclick=async()=>{
  const correo=document.getElementById('correo').value.trim();
  const pass=document.getElementById('pass').value.trim();
  const msg=document.getElementById('msg');
  const btn=document.getElementById('btn');
  if(!correo||!pass){msg.textContent="Completa los campos";return;}
  btn.disabled=true; btn.textContent="Verificando...";
  try{
    const cred=await signInWithEmailAndPassword(auth,correo,pass);
    const snap=await getDoc(doc(db,"conductores",cred.user.uid));
    if(!snap.exists()){msg.textContent="No tienes perfil de conductor"; btn.disabled=false; btn.textContent="Entrar"; return;}
    const data=snap.data();
    if(data.estado==="pendiente"){msg.innerHTML="⏳ Pendiente de aprobación"; btn.disabled=false; btn.textContent="Entrar"; return;}
    if(data.estado==="bloqueado"){msg.innerHTML="🚫 Cuenta bloqueada"; btn.disabled=false; btn.textContent="Entrar"; return;}
    localStorage.setItem("uidConductor",cred.user.uid);
    localStorage.setItem("nombreConductor",data.nombre||"");
    location.href="./conductores-app.html";
  }catch(e){msg.textContent="Correo o contraseña incorrectos"; btn.disabled=false; btn.textContent="Entrar";}
};

if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
