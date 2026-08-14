const productSchema = {
  type: 'object', additionalProperties: false,
  required: ['category','name','specification','store','price','quantity','url','availability'],
  properties: {
    category:{type:'string'}, name:{type:'string'}, specification:{type:'string'},
    store:{type:'string'}, price:{type:'number'}, quantity:{type:'integer'},
    url:{type:'string'}, availability:{type:'string'}
  }
};
const tierSchema = {
  type:'object', additionalProperties:false,
  required:['level','name','description','design_notes','palette','image_prompt','products','total'],
  properties:{
    level:{type:'string',enum:['Económica','Intermedia','Premium']}, name:{type:'string'},
    description:{type:'string'}, design_notes:{type:'string'},
    palette:{type:'array',items:{type:'string'}}, image_prompt:{type:'string'},
    total:{type:'number'}, products:{type:'array',minItems:4,items:productSchema}
  }
};
const schema = {
  type:'object', additionalProperties:false,
  required:['project_title','space_analysis','tiers'],
  properties:{
    project_title:{type:'string'}, space_analysis:{type:'string'},
    tiers:{type:'array',minItems:3,maxItems:3,items:tierSchema}
  }
};
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'Falta configurar OpenAI'});
 try{const {image,brief}=req.body||{};if(!image||!brief)return res.status(400).json({error:'Falta la foto o las instrucciones'});
 const prompt=`Eres arquitecto de interiores y comprador experto en Chile. Analiza la foto y diseña exactamente 3 alternativas: Económica, Intermedia y Premium. Usuario: ${JSON.stringify(brief)}. Busca en la web productos REALES, actualmente comprables en Santiago de Chile. Prioriza Mercado Libre Chile, Falabella, Paris, Ripley, Sodimac, Easy, IKEA Chile, Casaideas, Rosen, CIC y tiendas chilenas pertinentes. Incluye pintura con marca/color o código, papel mural, piso, iluminación, muebles, textiles, TV/grifería/plantas si el espacio lo requiere. Cada URL debe ir a la página directa del producto, nunca a una búsqueda ni a una portada. No inventes productos, enlaces, stock o precio. Reutiliza lo que el usuario pide conservar. El total debe ser la suma de precio*cantidad. image_prompt debe describir una edición fotorrealista de ESTA MISMA habitación, conservando arquitectura, perspectiva, aberturas y elementos indicados, e incluyendo específicamente los productos listados. Responde solo en español.`;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6',reasoning:{effort:'medium'},tools:[{type:'web_search',user_location:{type:'approximate',country:'CL',city:'Santiago',region:'Metropolitana'}}],include:['web_search_call.action.sources'],input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image,detail:'high'}]}],text:{format:{type:'json_schema',name:'fotodecora_plan',strict:true,schema}}})});
 const d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Error de OpenAI');const txt=d.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text||d.output_text;const plan=JSON.parse(txt);return res.json(plan)}catch(e){return res.status(500).json({error:e.message||'No se pudo analizar el espacio'})}}
