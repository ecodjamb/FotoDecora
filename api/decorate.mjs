export const config={api:{bodyParser:{sizeLimit:'15mb'}}};

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido'});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:'Falta configurar OpenAI'});

  try{
    const {image,prompt,tier,room,keep}=req.body||{};
    if(!image||!prompt) return res.status(400).json({error:'Falta la foto o la descripción del diseño'});

    const m=String(image).match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.*)$/i);
    if(!m) throw new Error('Formato de foto inválido');

    const fd=new FormData();
    fd.append('model','gpt-image-2');
    fd.append('image',new Blob([Buffer.from(m[2],'base64')],{type:m[1]}),'espacio.jpg');
    fd.append('prompt',[
      `Rediseña fotorealísticamente este ${room||'espacio interior'} con nivel de presupuesto ${tier||'Intermedia'}.`,
      prompt,
      `Conserva estrictamente la misma habitación, perspectiva de cámara, geometría, muros, cielo, piso, ventanas, puertas, puntos de fuga y proporciones de la fotografía original.`,
      `Mantener sin reemplazar: ${keep||'todos los elementos que el usuario haya pedido conservar'}.`,
      `El resultado debe parecer una fotografía editorial de arquitectura real, no un render 3D. Iluminación natural creíble, materiales realistas y escala correcta.`,
      `No agregues texto, logotipos, marcas de agua ni personas.`
    ].join(' '));
    fd.append('quality',tier==='Premium'?'high':'medium');
    fd.append('output_format','jpeg');
    fd.append('output_compression','88');

    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),120000);
    const r=await fetch('https://api.openai.com/v1/images/edits',{
      method:'POST',
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:fd,
      signal:controller.signal
    }).finally(()=>clearTimeout(timeout));

    const d=await r.json();
    if(!r.ok) throw new Error(d.error?.message||'No se pudo generar la imagen');
    if(!d.data?.[0]?.b64_json) throw new Error('OpenAI no devolvió una imagen válida');

    return res.status(200).json({image:`data:image/jpeg;base64,${d.data[0].b64_json}`});
  }catch(e){
    const message=e?.name==='AbortError'?'La generación demoró demasiado. Intenta nuevamente.':(e?.message||'No se pudo generar la imagen');
    return res.status(500).json({error:message});
  }
}
