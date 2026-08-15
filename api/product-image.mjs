const allowedHosts=[
  'mercadolibre.cl','www.mercadolibre.cl','falabella.com','www.falabella.com','paris.cl','www.paris.cl',
  'ripley.cl','simple.ripley.cl','www.ripley.cl','sodimac.cl','www.sodimac.cl','easy.cl','www.easy.cl',
  'ikea.com','www.ikea.com','casaideas.cl','www.casaideas.cl','rosen.cl','www.rosen.cl','cic.cl','www.cic.cl'
];

function allowed(host){
  const h=host.toLowerCase();
  return allowedHosts.some(x=>h===x||h.endsWith('.'+x));
}
function placeholder(res){
  res.setHeader('Content-Type','image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=3600');
  return res.status(200).send(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="28" fill="#eee7dc"/><path d="M60 148l35-38 27 27 20-21 38 42H60z" fill="#b9aa98"/><circle cx="155" cy="78" r="18" fill="#d8c9b6"/></svg>`);
}

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).end();
  try{
    const raw=Array.isArray(req.query?.url)?req.query.url[0]:req.query?.url;
    if(!raw) return placeholder(res);
    const page=new URL(raw);
    if(!['http:','https:'].includes(page.protocol)||!allowed(page.hostname)) return placeholder(res);

    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    const htmlRes=await fetch(page.href,{
      redirect:'follow',
      headers:{'user-agent':'Mozilla/5.0 (compatible; FotoDecora/1.0)','accept':'text/html,application/xhtml+xml'},
      signal:controller.signal
    }).finally(()=>clearTimeout(timer));
    if(!htmlRes.ok) return placeholder(res);
    const html=(await htmlRes.text()).slice(0,1500000);

    const patterns=[
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /"image"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+(?:\\.[^"\\]*)?)"/i
    ];
    let imageUrl='';
    for(const p of patterns){const m=html.match(p);if(m?.[1]){imageUrl=m[1].replace(/\\\//g,'/').replace(/&amp;/g,'&');break;}}
    if(!imageUrl) return placeholder(res);
    const img=new URL(imageUrl,page.href);
    if(!['http:','https:'].includes(img.protocol)) return placeholder(res);

    const imgController=new AbortController();
    const imgTimer=setTimeout(()=>imgController.abort(),8000);
    const imageRes=await fetch(img.href,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (compatible; FotoDecora/1.0)','referer':page.href},signal:imgController.signal}).finally(()=>clearTimeout(imgTimer));
    const type=imageRes.headers.get('content-type')||'';
    if(!imageRes.ok||!type.startsWith('image/')) return placeholder(res);
    const buffer=Buffer.from(await imageRes.arrayBuffer());
    if(buffer.length>5_000_000) return placeholder(res);
    res.setHeader('Content-Type',type);
    res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(buffer);
  }catch{return placeholder(res)}
}
