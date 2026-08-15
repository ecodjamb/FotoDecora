const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = { photo:null, brief:null, plan:null, tier:0, images:[null,null,null], session:null, config:null };
const money = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n)||0);
const icons = {mueble:'▰',iluminación:'◉',iluminacion:'◉',pintura:'▨',textil:'▧',decoración:'✦',decoracion:'✦',piso:'▥',mural:'▤',planta:'♧',tecnología:'▣',tecnologia:'▣',grifería:'♨',griferia:'♨'};
const esc = v => String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeUrl = u => { try { const x=new URL(String(u)); return /^https?:$/.test(x.protocol)?x.href:'#'; } catch { return '#'; } };
let toastTimer;

async function init(){
  state.config = await fetch('/api/config',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));
  const raw=localStorage.getItem('fotodecora_session');
  if(raw) try{state.session=JSON.parse(raw);await ensureSession(false)}catch{clearSession()}
  updateAuth();
  $$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function updateAuth(){ $('#authBtn').textContent=state.session?.user?.email?'Mi cuenta':'Ingresar'; }
function clearSession(){state.session=null;localStorage.removeItem('fotodecora_session');updateAuth()}
function section(id){['hero','wizard','loading','results'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id));$('.how-it-works')?.classList.toggle('hidden',id!=='hero');window.scrollTo({top:0,behavior:'smooth'})}
function selectPhoto(file){
  if(!file)return;
  if(!file.type.startsWith('image/'))return toast('Selecciona una imagen válida.');
  if(file.size>12e6)return toast('La foto debe pesar menos de 12 MB.');
  const r=new FileReader();r.onload=()=>{state.photo=r.result;$('#photoPreview').src=state.photo;section('wizard')};r.readAsDataURL(file)
}

$('#photoInput').onchange=e=>selectPhoto(e.target.files[0]);
$('#changePhoto').onclick=()=>$('#photoInput').click();
$('#backHome').onclick=()=>section('hero');
$('#restartBtn').onclick=()=>{state.plan=null;state.images=[null,null,null];state.tier=0;$('#briefForm').reset();$('#photoInput').value='';section('hero')};

$('#briefForm').onsubmit=async e=>{
  e.preventDefault();
  state.brief=Object.fromEntries(new FormData(e.target));
  if(!state.photo)return toast('Primero selecciona una foto.');
  section('loading');animateLoading();
  try{
    const r=await fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:state.photo,brief:state.brief})});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'No pudimos crear el proyecto.');
    if(!Array.isArray(data.tiers)||data.tiers.length!==3)throw new Error('La propuesta llegó incompleta. Intenta nuevamente.');
    state.plan=data;state.images=[null,null,null];
    $('#loadingDetail').textContent='Generando las tres visualizaciones sobre tu fotografía…';
    $$('.loading-steps span').forEach((x,i)=>x.classList.toggle('on',i<=2));
    await Promise.allSettled(data.tiers.map((_,i)=>generateImage(i)));
    renderResults();section('results');
  }catch(err){toast(err.message||'Ocurrió un error.');section('wizard')}
};

function animateLoading(){
  let p=8,i=0;const bar=$('#progressBar');bar.style.width=p+'%';
  const texts=['Analizando luz, distribución y estilo…','Buscando productos reales en Chile…','Armando tres niveles de presupuesto…','Generando propuestas fotográficas…'];
  const details=['Leyendo proporciones y elementos de la foto.','Revisando tiendas y piezas compatibles.','Calculando cantidades y presupuesto total.','Aplicando el diseño sobre tu espacio original.'];
  const t=setInterval(()=>{if($('#loading').classList.contains('hidden'))return clearInterval(t);p=Math.min(93,p+Math.random()*9);bar.style.width=p+'%';i=Math.min(i+1,texts.length-1);$('#loadingTitle').textContent=texts[i];$('#loadingDetail').textContent=details[i];$$('.loading-steps span').forEach((x,n)=>x.classList.toggle('on',n<=Math.min(i,2)))},4000)
}

async function generateImage(i){
  const tier=state.plan.tiers[i];
  try{
    const r=await fetch('/api/decorate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:state.photo,prompt:tier.image_prompt,tier:tier.level,room:state.brief.room,keep:state.brief.keep})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo generar la imagen');state.images[i]=d.image;
  }catch(e){state.images[i]={error:e.message||'No se pudo generar'}}
}

function renderResults(){
  const p=state.plan;state.tier=Math.min(state.tier,2);
  $('#resultTitle').textContent=p.project_title||'Tres formas de transformar tu espacio';
  $('#spaceAnalysis').textContent=p.space_analysis||'';
  $('#tabs').innerHTML=p.tiers.map((t,i)=>`<button class="tab ${i===state.tier?'active':''}" data-tier="${i}">${esc(t.level)} · ${money(t.total)}</button>`).join('');
  $$('.tab').forEach(b=>b.onclick=()=>{state.tier=+b.dataset.tier;renderTier()});renderTier()
}

function renderTier(){
  const t=state.plan.tiers[state.tier],im=state.images[state.tier];
  const imageMarkup=typeof im==='string'
    ? `<img class="proposal-image" src="${esc(im)}" alt="Propuesta ${esc(t.level)}"><img class="original-image hidden" src="${esc(state.photo)}" alt="Foto original"><div class="compare-controls"><button class="active" data-view="after">Propuesta</button><button data-view="before">Original</button></div>`
    : `<div class="image-error"><p>${esc(im?.error||'La imagen no se pudo generar.')}</p><button class="pill ghost retry">Reintentar imagen</button></div>`;
  const products=Array.isArray(t.products)?t.products:[];
  $('#concept').innerHTML=`<article class="concept-card"><div class="concept-image">${imageMarkup}</div><div class="concept-copy"><p class="eyebrow">PROPUESTA ${esc(String(t.level).toUpperCase())}</p><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><div class="concept-meta"><span>${products.length} productos</span><span>${money(t.total)}</span></div><div class="palette">${(t.palette||[]).filter(validColor).map(c=>`<span class="swatch" title="${esc(c)}" style="background:${esc(c)}"></span>`).join('')}</div><p><strong>Clave del diseño</strong><br>${esc(t.design_notes)}</p></div></article>`;
  const retry=$('.retry');if(retry)retry.onclick=async()=>{retry.disabled=true;retry.textContent='Generando…';await generateImage(state.tier);renderTier()};
  $$('.compare-controls button').forEach(b=>b.onclick=()=>{const original=$('.original-image'),proposal=$('.proposal-image');const before=b.dataset.view==='before';original.classList.toggle('hidden',!before);proposal.classList.toggle('hidden',before);$$('.compare-controls button').forEach(x=>x.classList.toggle('active',x===b))});
  const subtotal=cat=>products.filter(x=>x.category===cat).reduce((a,x)=>a+(Number(x.price)||0)*(Number(x.quantity)||0),0);
  const cats=[...new Set(products.map(x=>x.category).filter(Boolean))];
  $('#budgetSummary').innerHTML=`<div><span>PRESUPUESTO TOTAL</span><strong>${money(t.total)}</strong></div>${cats.slice(0,3).map(c=>`<div><span>${esc(String(c).toUpperCase())}</span><strong>${money(subtotal(c))}</strong></div>`).join('')}`;
  $('#productList').innerHTML=products.map(x=>{const url=safeUrl(x.url);const category=String(x.category||'').toLowerCase();return `<article class="product"><div class="product-icon">${icons[category]||'◇'}</div><div><h4>${esc(x.name)}</h4><p>${esc(x.specification||'')}</p></div><div class="store"><strong>${esc(x.store)}</strong><p>${esc(x.availability||'Chile')}</p></div><div class="qty"><p>${esc(x.quantity)} un.</p><span class="price">${money((Number(x.price)||0)*(Number(x.quantity)||0))}</span></div>${url==='#'?'<span></span>':`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ver producto ↗</a>`}</article>`}).join('');
}
function validColor(c){return /^#[0-9a-f]{3,8}$/i.test(String(c))||/^(rgb|hsl)a?\([^)]+\)$/i.test(String(c))}

$('#authBtn').onclick=()=>state.session?openProjects():$('#authDialog').showModal();
$('#authForm').onsubmit=async e=>{
  e.preventDefault();$('#authMessage').textContent='';
  const f=Object.fromEntries(new FormData(e.target)),base=state.config?.supabaseUrl,key=state.config?.supabaseKey;
  if(!base||!key)return $('#authMessage').textContent='La conexión de usuarios no está configurada.';
  try{
    let r=await fetch(`${base}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify(f)});
    if(!r.ok)r=await fetch(`${base}/auth/v1/signup`,{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify(f)});
    const d=await r.json();
    if(d.access_token){setSession(d);$('#authDialog').close();toast('Sesión iniciada.');if(state.plan)$('#nameDialog').showModal()}
    else $('#authMessage').textContent=d.msg||d.error_description||d.message||'Revisa tus datos o confirma tu correo.';
  }catch{$('#authMessage').textContent='No pudimos conectar con el servicio de acceso.'}
};
function setSession(s){state.session=s;localStorage.setItem('fotodecora_session',JSON.stringify(s));updateAuth()}
async function ensureSession(force=true){
  if(!state.session)return false;
  const exp=(state.session.expires_at||0)*1000;if(!force&&(!exp||exp>Date.now()+60000))return true;
  if(exp>Date.now()+60000)return true;
  if(!state.session.refresh_token)return false;
  try{const r=await fetch(`${state.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:state.config.supabaseKey,'content-type':'application/json'},body:JSON.stringify({refresh_token:state.session.refresh_token})});if(!r.ok)throw new Error();setSession(await r.json());return true}catch{clearSession();return false}
}
$('#logoutBtn').onclick=async()=>{try{if(state.session)await fetch(`${state.config.supabaseUrl}/auth/v1/logout`,{method:'POST',headers:{apikey:state.config.supabaseKey,Authorization:`Bearer ${state.session.access_token}`}})}catch{}clearSession();$('#projectsDialog').close();toast('Sesión cerrada.')};
$('#saveBtn').onclick=()=>state.session?$('#nameDialog').showModal():$('#authDialog').showModal();
$('#nameForm').onsubmit=async e=>{
  e.preventDefault();const name=new FormData(e.target).get('name');
  try{await ensureSession();await supa('/rest/v1/projects','POST',{name,room_type:state.brief.room,brief:state.brief,design:state.plan,generated_images:state.images});$('#nameDialog').close();e.target.reset();toast('Proyecto guardado correctamente.')}catch(err){toast(err.message)}
};
async function supa(path,method='GET',body){
  if(!await ensureSession())throw new Error('Tu sesión venció. Ingresa nuevamente.');
  const r=await fetch(state.config.supabaseUrl+path,{method,headers:{apikey:state.config.supabaseKey,Authorization:`Bearer ${state.session.access_token}`,'content-type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.message||d.error_description||'No se pudo completar la operación.')}return r.status===204?null:r.json()
}
$('#projectsBtn').onclick=()=>state.session?openProjects():$('#authDialog').showModal();
async function openProjects(){ $('#projectsDialog').showModal();await loadProjects() }
async function loadProjects(){
  const box=$('#savedProjects');box.innerHTML='<p>Cargando proyectos…</p>';
  try{
    const ps=await supa('/rest/v1/projects?select=*&order=created_at.desc');
    box.innerHTML=ps.length?ps.map(p=>`<article class="saved-card"><p>${new Date(p.created_at).toLocaleDateString('es-CL')}</p><h3>${esc(p.name)}</h3><p>${esc(p.room_type)} · ${p.design?.tiers?.length||0} propuestas</p><div class="saved-card-actions"><button class="pill ghost" data-open="${esc(p.id)}">Abrir</button><button class="pill ghost" data-delete="${esc(p.id)}">Eliminar</button></div></article>`).join(''):'<p>Aún no tienes proyectos guardados.</p>';
    $$('[data-open]',box).forEach(b=>b.onclick=()=>{const p=ps.find(x=>x.id===b.dataset.open);state.plan=p.design;state.brief=p.brief;state.images=p.generated_images||[null,null,null];state.photo=p.brief?.original_image||state.photo;state.tier=0;$('#projectsDialog').close();renderResults();section('results')});
    $$('[data-delete]',box).forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar este proyecto?'))return;try{await supa(`/rest/v1/projects?id=eq.${encodeURIComponent(b.dataset.delete)}`,'DELETE');toast('Proyecto eliminado.');await loadProjects()}catch(e){toast(e.message)}});
  }catch(e){box.innerHTML=`<p>${esc(e.message)}</p>`}
}

init();
