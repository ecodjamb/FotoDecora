export default function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false});
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({
    ok:true,
    service:'FotoDecora',
    openaiConfigured:Boolean(process.env.OPENAI_API_KEY),
    supabaseConfigured:Boolean(process.env.SUPABASE_URL||'https://vmrxrwmqkyrkefeykfxn.supabase.co'),
    timestamp:new Date().toISOString()
  });
}
