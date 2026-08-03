import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status=200){
  return new Response(JSON.stringify(body), { status, headers:{...corsHeaders,'Content-Type':'application/json'} })
}
function escapeHtml(value: unknown){
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c] as string))
}
function bytesToBase64(bytes: Uint8Array){
  let binary=''
  const chunk=0x8000
  for(let i=0;i<bytes.length;i+=chunk) binary += String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)))
  return btoa(binary)
}

Deno.serve(async req => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST') return json({error:'Method not allowed'},405)
  try{
    const supabaseUrl=Deno.env.get('SUPABASE_URL')!
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const brevoKey=Deno.env.get('BREVO_API_KEY')!
    const senderEmail=Deno.env.get('BREVO_SENDER_EMAIL')!
    const senderName=Deno.env.get('BREVO_SENDER_NAME')||'Sentinelle Pro'
    if(!brevoKey||!senderEmail) throw new Error('Secrets Brevo manquants.')

    const authHeader=req.headers.get('Authorization')||''
    if(!authHeader.startsWith('Bearer ')) return json({error:'Non authentifié'},401)
    const token=authHeader.slice(7)
    const payloadPart=token.split('.')[1]||''
    const padded=payloadPart.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-payloadPart.length%4)%4)
    const claims=JSON.parse(atob(padded))
    const subject=String(claims.sub||'')
    if(!subject) return json({error:'Jeton invalide'},401)
    const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}})
    let callerProfile=null as any
    let callerError=null as any
    const external=await admin.from('profiles').select('id,organization_id,role,active').eq('external_uid',subject).maybeSingle()
    callerProfile=external.data; callerError=external.error
    if(!callerProfile && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subject)){
      const native=await admin.from('profiles').select('id,organization_id,role,active').eq('auth_user_id',subject).maybeSingle()
      callerProfile=native.data; callerError=native.error
    }
    if(callerError||!callerProfile||!callerProfile.active||!['admin','superviseur','agent'].includes(callerProfile.role)) return json({error:'Accès refusé'},403)

    const {documentId}=await req.json()
    if(!documentId) return json({error:'documentId requis'},400)

    const {data:doc,error:docError}=await admin.from('generated_documents')
      .select('id,organization_id,client_id,title,storage_bucket,storage_path,firebase_site_id,clients(name,report_email,billing_email)')
      .eq('id',documentId).single()
    if(docError||!doc) throw docError||new Error('Document introuvable.')
    if(doc.organization_id!==callerProfile.organization_id) return json({error:'Document hors organisation'},403)

    const {data:recipientRows,error:recipientError}=await admin.from('document_recipients')
      .select('email,display_name').eq('document_id',documentId)
    if(recipientError) throw recipientError
    const fallbackEmail=(doc.clients as any)?.report_email||(doc.clients as any)?.billing_email
    const recipients=(recipientRows?.length?recipientRows:(fallbackEmail?[{email:fallbackEmail,display_name:(doc.clients as any)?.name||'Client'}]:[]))
      .filter(row=>row.email)
    if(!recipients.length){
      await admin.from('generated_documents').update({delivery_status:'no_recipient',updated_at:new Date().toISOString()}).eq('id',documentId)
      return json({queued:false,reason:'Aucun destinataire configuré'})
    }

    const {data:file,error:fileError}=await admin.storage.from(doc.storage_bucket).download(doc.storage_path)
    if(fileError||!file) throw fileError||new Error('PDF introuvable dans Storage.')
    const pdfBase64=bytesToBase64(new Uint8Array(await file.arrayBuffer()))

    const sent=[] as string[]
    const already=[] as string[]
    for(const recipient of recipients){
      const idempotencyKey=`main-courante:${documentId}:${String(recipient.email).toLowerCase()}`
      const {data:existing}=await admin.from('email_deliveries').select('id,status').eq('idempotency_key',idempotencyKey).maybeSingle()
      if(existing?.status==='sent'){already.push(recipient.email);continue}
      const {data:delivery,error:deliveryError}=await admin.from('email_deliveries').upsert({
        organization_id:doc.organization_id,document_id:documentId,recipient_email:recipient.email,
        idempotency_key:idempotencyKey,status:'sending',updated_at:new Date().toISOString()
      },{onConflict:'idempotency_key'}).select('id').single()
      if(deliveryError) throw deliveryError

      const response=await fetch('https://api.brevo.com/v3/smtp/email',{
        method:'POST',
        headers:{'Content-Type':'application/json','api-key':brevoKey,'Idempotency-Key':idempotencyKey},
        body:JSON.stringify({
          sender:{email:senderEmail,name:senderName},
          to:[{email:recipient.email,name:recipient.display_name||recipient.email}],
          subject:`Main courante disponible — ${doc.title}`,
          htmlContent:`<html><body style="font-family:Arial,sans-serif;color:#172033"><h2>Votre main courante est disponible</h2><p>Bonjour ${escapeHtml(recipient.display_name||'')},</p><p>Le rapport <strong>${escapeHtml(doc.title)}</strong> est joint à cet e-mail et reste disponible dans votre espace client Sentinelle Pro.</p><p>Cordialement,<br>Le centre opérationnel</p></body></html>`,
          attachment:[{name:`${String(doc.title).replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'main-courante'}.pdf`,content:pdfBase64}],
          tags:['sentinelle-pro','main-courante']
        })
      })
      const payload=await response.json().catch(()=>({}))
      if(!response.ok){
        await admin.from('email_deliveries').update({status:'failed',error_message:JSON.stringify(payload),updated_at:new Date().toISOString()}).eq('id',delivery.id)
        throw new Error(`Brevo ${response.status}: ${JSON.stringify(payload)}`)
      }
      await admin.from('email_deliveries').update({status:'sent',provider_message_id:payload.messageId||null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',delivery.id)
      sent.push(recipient.email)
    }
    await admin.from('generated_documents').update({delivery_status:'sent',updated_at:new Date().toISOString()}).eq('id',documentId)
    return json({sent:true,recipients:sent,alreadySent:already.length>0,already})
  }catch(error){
    console.error(error)
    return json({error:String((error as Error)?.message||error)},500)
  }
})
