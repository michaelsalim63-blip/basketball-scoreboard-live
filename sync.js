(()=>{'use strict';
const params=new URLSearchParams(location.search),display=params.get('mode')==='display';
const status=document.getElementById('syncBar'),gate=document.getElementById('loginGate');
const setStatus=t=>status.textContent=t;
const cfg=window.COURTSIDE_FIREBASE_CONFIG;
if(!cfg||String(cfg.apiKey).includes('PASTE_')||String(cfg.databaseURL).includes('PASTE_')){setStatus('Firebase belum dikonfigurasi');if(!display){gate.classList.remove('hidden');document.getElementById('loginMessage').textContent='Isi firebase-config.js terlebih dahulu.'}return}
if(!window.firebase){setStatus('Firebase SDK gagal dimuat — periksa internet');return}
try{firebase.initializeApp(cfg)}catch(e){setStatus('Konfigurasi Firebase tidak valid');return}
const db=firebase.database(),auth=firebase.auth(),id=String(window.COURTSIDE_MATCH_ID||'main').replace(/[^a-zA-Z0-9_-]/g,''),ref=db.ref('matches/'+id+'/state');
let ready=false,remoteApply=false,pending=null,publishTimer=null,serverOffset=0,lastRemote=null,firstSnapshot=true;
db.ref('.info/serverTimeOffset').on('value',snap=>{serverOffset=Number(snap.val())||0});
function liveState(state){const now=Date.now()+serverOffset;const copy=JSON.parse(JSON.stringify(state));copy.syncedAt=now;return copy}
function publish(){if(display||!ready||!pending)return;const data=liveState(pending);pending=null;ref.set(data).catch(e=>setStatus('Gagal mengirim: '+e.message))}
window.courtsideSyncChanged=(state)=>{if(display||remoteApply||!ready)return;pending=state;if(publishTimer)clearTimeout(publishTimer);publishTimer=setTimeout(publish,120)};
function loadRemote(data){if(!data)return;const now=Date.now()+serverOffset,elapsed=Math.max(0,(now-(Number(data.syncedAt)||now))/1000);const d={...data};delete d.syncedAt;
for(const [flag,field] of [['gameRunning','gameSec'],['shotRunning','shotSec'],['timeoutRunning','timeoutRemaining'],['breakRunning','breakRemaining']])if(d[flag])d[field]=Math.max(0,Math.ceil(Number(d[field])-elapsed));
remoteApply=true;window.courtsideController.load(d);remoteApply=false;
}
if(display){
 document.body.classList.add('display-mode');
 // Disable all operator interactions, including shortcuts, while leaving the read-only scoreboard visible.
 document.querySelectorAll('button,input').forEach(el=>{el.disabled=true});
 // Prevent display-side timer callbacks from writing to the shared database.
 window.courtsideSyncChanged=()=>{};
 ref.on('value',snap=>{const data=snap.val();if(!data){setStatus('Menunggu operator membuat pertandingan');return}
   const prev=lastRemote;lastRemote=data;loadRemote(data);setStatus('● LIVE · DISPLAY');
   // Audio is played by the operator device; Android browsers often block autoplay on display.
 },err=>setStatus('Gagal membaca: '+err.message));
 // A tap unlocks audio on Android; buzzer from local app.js timer works while display is active.
 document.addEventListener('pointerdown',()=>{}, {once:true});
 return;
}
gate.classList.remove('hidden');setStatus('Login operator diperlukan');
const message=document.getElementById('loginMessage');
document.getElementById('loginButton').onclick=async()=>{message.textContent='Memeriksa akun...';try{await auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value.trim(),document.getElementById('loginPassword').value);message.textContent=''}catch(e){message.textContent='Login gagal: '+e.message}};
auth.onAuthStateChanged(user=>{if(!user){ready=false;gate.classList.remove('hidden');setStatus('Login operator diperlukan');return}
 setStatus('Memuat pertandingan...');
 ref.once('value').then(snap=>{if(snap.exists())loadRemote(snap.val());ready=true;gate.classList.add('hidden');setStatus('● LIVE · CONTROLLER');if(!snap.exists()){pending=window.courtsideController.snapshot();publish()}
 // Detect connection loss and restore on reconnection.
 db.ref('.info/connected').on('value',v=>{setStatus(v.val()?'● LIVE · CONTROLLER':'OFFLINE · perubahan belum terkirim')});
 }).catch(e=>{setStatus('Akses ditolak: '+e.message);message.textContent='Periksa Database Rules dan UID operator.'});
});
})();
