const $ = (s) => document.querySelector(s);
const state = { photo: null, brief: null, plan: null, tier: 0, images: [null,null,null], session: null, config: null };
const money = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n)||0);
const icons = {mueble:'▰',iluminación:'◉',pintura:'▨',textil:'▧',decoración:'✦',piso:'▥',mural:'▤',planta:'♧',tecnología:'▣',grifería:'♨'};

async function init(){
  state.config = await fetch('/api/config').then(r=>r.json()).catch(()=>({}));
  const raw = localStorage.getItem('fotodecora_session');
  if(raw) try { state.session=JSON.parse(raw); } catch{}
  updateAuth();
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
}
function updateAuth(){ $('#authBtn').textContent=state.session?'Mi cuenta':'Ingresar'; }
function section(id){ ['hero','wizard','loading','results'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id)); window.scrollTo({top:0,behavior:'smooth'}); }
function selectPhoto(file){ if(!file)return; if(file.size>12e6)return alert('La foto debe pesar menos de 12 MB.'); const r=new FileReader(); r.onload=()=>{state.photo=r.result;$('#photoPreview').src=state.photo;section('wizard');};r.readAsDataURL(file); }
$('#photoInput').onchange=e=>selectPhoto(e.target.files[0]); $('#changePhoto').onclick=()=>$('#photoInput').click(); $('#backHome').onclick=()=>section('hero'); $('#restartBtn').onclick=()=>{state.plan=null;state.images=[null,null,null];section('hero')};

$('#briefForm').onsubmit=async e=>{
 e.preventDefault(); state.brief=Object.fromEntries(new FormData(e.target)); section('loading'); animateLoading();
 try{
   const r=await fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:state.photo,brief:state.brief})});
   const data=await r.json(); if(!r.ok)throw new Error(data.error||'No pudimos crear el proyecto'); state.plan=data;
   await Promise.allSettled(data.tiers.map((_,i)=>generateImage(i))); renderResults(); section('results');
 }catch(err){alert(err.message);section('wizard')}
};
function animateLoading(){let p=8;$('#progressBar').style.width=p+'%';const texts=['Analizando luz, distribución y estilo…','Buscando productos disponibles en Chile…','Armando los tres presupuestos…','Generando las propuestas fotográficas…'];let i=0;const t=setInterval(()=>{if(!$('#loading').classList.contains('hidden')){p=Math.min(92,p+Math.random()*8);$('#progressBar').style.width=p+'%';$('#loadingTitle').textContent=texts[Math.min(++i,texts.length-1)]}else clearInterval(t)},4200)}
async function generateImage(i){
  const tier=state.plan.tiers[i];
  const r=await fetch('/api/decorate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:state.photo,prompt:tier.image_prompt,tier:tier.level,room:state.brief.room,keep:state.brief.keep})});
  const d=await r.json(); if(r.ok)state.images[i]=d.image; else state.images[i]={error:d.error||'No se pudo generar'};
}
function renderResults(){const p=state.plan;$('#resultTitle').textContent=p.project_title||'Tres formas de transformar tu espacio';$('#tabs').innerHTML=p.tiers.map((t,i)=>`<button class="tab ${i===state.tier?'active':''}" data-tier="${i}">${t.level} · ${money(t.total)}</button>`).join('');document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{state.tier=+b.dataset.tier;renderTier()});renderTier()}
function renderTier(){
 const t=state.plan.tiers[state.tier], im=state.images[state.tier];
 $('#concept').innerHTML=`<article class="concept-card"><div class="concept-image">${typeof im==='string'?`<img src="${im}" alt="Propuesta ${t.level}">`:`<button class="pill ghost retry">Reintentar imagen</button>`}</div><div class="concept-copy"><p class="eyebrow">PROPUESTA ${t.level.toUpperCase()}</p><h3>${t.name}</h3><p>${t.description}</p><div class="palette">${(t.palette||[]).map(c=>`<span class="swatch" title="${c}" style="background:${c}"></span>`).join('')}</div><p><strong>Clave del diseño:</strong><br>${t.design_notes}</p></div></article>`;
 const retry=$('.retry');if(retry)retry.onclick=async()=>{retry.textContent='Generando…';await generateImage(state.tier);renderTier()};
 const subtotal=(cat)=>t.products.filter(x=>x.category===cat).reduce((a,x)=>a+(x.price*x.quantity),0); const cats=[...new Set(t.products.map(x=>x.category))];
 $('#budgetSummary').innerHTML=`<div><span>PRESUPUESTO TOTAL</span><strong>${money(t.total)}</strong></div>${cats.slice(0,3).map(c=>`<div><span>${c.toUpperCase()}</span><strong>${money(subtotal(c))}</strong></div>`).join('')}`;
 $('#productList').innerHTML=t.products.map(x=>`<article class="product"><div class="product-icon">${icons[x.category?.toLowerCase()]||'◇'}</div><div><h4>${x.name}</h4><p>${x.specification||''}</p></div><div class="store"><strong>${x.store}</strong><p>${x.availability||'Chile'}</p></div><div class="qty"><p>${x.quantity} un.</p><span class="price">${money(x.price*x.quantity)}</span></div><a href="${x.url}" target="_blank" rel="noopener">Ver producto ↗</a></article>`).join('');
}

$('#authBtn').onclick=()=>state.session?$('#projectsDialog').showModal():$('#authDialog').showModal();
$('#authForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const base=state.config.supabaseUrl,key=state.config.supabaseKey;if(!base||!key)return $('#authMessage').textContent='La conexión de usuarios aún no está configurada.';let r=await fetch(`${base}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify(f)});if(!r.ok){r=await fetch(`${base}/auth/v1/signup`,{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify(f)})}const d=await r.json();if(d.access_token){state.session=d;localStorage.setItem('fotodecora_session',JSON.stringify(d));updateAuth();$('#authDialog').close();if(state.plan)$('#nameDialog').showModal()}else $('#authMessage').textContent=d.msg||d.error_description||'Revisa tus datos o confirma tu correo.'};
$('#saveBtn').onclick=()=>state.session?$('#nameDialog').showModal():$('#authDialog').showModal();
$('#nameForm').onsubmit=async e=>{e.preventDefault();const name=new FormData(e.target).get('name');try{await supa('/rest/v1/projects','POST',{name,room_type:state.brief.room,brief:state.brief,design:state.plan,generated_images:state.images});$('#nameDialog').close();alert('Proyecto guardado correctamente.')}catch(err){alert(err.message)}};
async function supa(path,method='GET',body){const r=await fetch(state.config.supabaseUrl+path,{method,headers:{apikey:state.config.supabaseKey,Authorization:`Bearer ${state.session.access_token}`,'content-type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error((await r.json()).message||'No se pudo completar');return r.status===204?null:r.json()}
$('#projectsBtn').onclick=async()=>{if(!state.session)return $('#authDialog').showModal();$('#projectsDialog').showModal();await loadProjects()};
async function loadProjects(){const box=$('#savedProjects');box.innerHTML='Cargando…';try{const ps=await supa('/rest/v1/projects?select=*&order=created_at.desc');box.innerHTML=ps.length?ps.map(p=>`<article class="saved-card"><p>${new Date(p.created_at).toLocaleDateString('es-CL')}</p><h3>${p.name}</h3><p>${p.room_type} · ${p.design?.tiers?.length||0} propuestas</p><button class="pill ghost" data-open="${p.id}">Abrir</button></article>`).join(''):'Aún no tienes proyectos guardados.';box.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const p=ps.find(x=>x.id===b.dataset.open);state.plan=p.design;state.brief=p.brief;state.images=p.generated_images||[null,null,null];state.tier=0;$('#projectsDialog').close();renderResults();section('results')})}catch(e){box.textContent=e.message}}
init();
