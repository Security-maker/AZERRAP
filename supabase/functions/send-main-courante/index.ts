import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const MAX_MAIN_COURANTE_ATTEMPTS = 3

function escapeHtml(value: unknown){
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c] as string))
}

const AZZERA_EMAIL_LOGO_URL='https://sentinelle-pro.app/assets/logo.png'
const SENTINELLE_CLIENT_URL='https://sentinelle-pro.app/client.html'

function normalizeEmailSubject(value: unknown){
  return String(value ?? '').replace(/[\r\n]+/g,' ').replace(/\s+/g,' ').trim()
}
function formatEmailDate(value: unknown){
  const d=new Date(String(value || ''))
  if(Number.isNaN(d.getTime())) return ''
  try{
    return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'long',year:'numeric'}).format(d)
  }catch(_error){
    return d.toLocaleDateString('fr-FR')
  }
}
function mainCouranteClient(doc:any){
  return Array.isArray(doc?.clients) ? doc.clients[0] : doc?.clients
}
function buildMainCouranteEmail(doc:any, recipient:{email:string,display_name:string|null}){
  const client=mainCouranteClient(doc)
  const clientName=escapeHtml(client?.name || 'Client')
  const title=escapeHtml(doc?.title || 'Main courante')
  const date=formatEmailDate(doc?.created_at)
  const hello=recipient?.display_name ? `Bonjour ${escapeHtml(recipient.display_name)},` : 'Bonjour,'
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#141c25;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f6f9;margin:0;padding:0;">
    <tr><td align="center" style="padding:28px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #e1e8ef;box-shadow:0 10px 30px rgba(20,28,37,.08);">
        <tr>
          <td style="background:#141c25;padding:24px 28px;border-bottom:3px solid #64d0ff;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="64" valign="middle" style="width:64px;">
                  <img src="${AZZERA_EMAIL_LOGO_URL}" width="48" height="48" alt="Azzera Protect" style="display:block;width:48px;height:48px;object-fit:contain;border:0;outline:none;text-decoration:none;">
                </td>
                <td valign="middle" style="padding-left:8px;">
                  <div style="font-size:20px;line-height:24px;font-weight:800;letter-spacing:.2px;color:#ffffff;">AZZERA PROTECT</div>
                  <div style="margin-top:4px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.8px;color:#64d0ff;">SÉCURITÉ PRIVÉE</div>
                </td>
                <td align="right" valign="middle" style="font-size:11px;line-height:16px;color:#aeb9c5;">SENTINELLE PRO</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:34px 30px 8px 30px;">
            <div style="font-size:12px;line-height:18px;font-weight:800;letter-spacing:1.2px;color:#1589b8;text-transform:uppercase;">${doc?.type==='intervention'?'Bon d’intervention disponible':'Main courante disponible'}</div>
            <h1 style="margin:8px 0 10px 0;font-size:28px;line-height:34px;color:#141c25;font-weight:800;">Votre rapport opérationnel est prêt</h1>
            <p style="margin:0;font-size:16px;line-height:25px;color:#5d6a78;">${hello}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 30px 0 30px;">
            <p style="margin:0 0 18px 0;font-size:15px;line-height:24px;color:#384656;">${doc?.type==='intervention'?'Le bon correspondant à votre intervention est disponible.':'La main courante correspondant à votre mission est disponible.'} Le PDF officiel est joint à cet e-mail et reste accessible depuis votre espace client Sentinelle Pro.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f7fafc;border:1px solid #e2eaf1;border-radius:16px;">
              <tr><td style="padding:18px 20px;">
                <div style="font-size:11px;line-height:16px;font-weight:800;letter-spacing:1px;color:#7b8998;text-transform:uppercase;">Document</div>
                <div style="margin-top:5px;font-size:17px;line-height:24px;font-weight:800;color:#141c25;">${title}</div>
                <div style="margin-top:8px;font-size:13px;line-height:20px;color:#657383;"><strong style="color:#344250;">Client :</strong> ${clientName}${date ? ` &nbsp;·&nbsp; <strong style="color:#344250;">Date :</strong> ${escapeHtml(date)}` : ''}</div>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:26px 30px 30px 30px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#141c25" style="border-radius:12px;">
              <a href="${SENTINELLE_CLIENT_URL}" target="_blank" style="display:inline-block;padding:14px 24px;font-size:14px;line-height:18px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:12px;border:1px solid #141c25;">Accéder à mon espace client</a>
            </td></tr></table>
            <div style="margin-top:12px;font-size:12px;line-height:18px;color:#8996a4;">Le PDF est également joint directement à ce message.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 30px 30px 30px;">
            <div style="height:1px;background:#e5ebf1;margin-bottom:24px;"></div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td valign="top">
                  <div style="font-size:14px;line-height:20px;font-weight:800;color:#141c25;">Azzera Protect</div>
                  <div style="margin-top:3px;font-size:13px;line-height:19px;color:#5f6d7b;">Service Exploitation · Sécurité privée</div>
                </td>
                <td align="right" valign="top" style="font-size:12px;line-height:18px;color:#8b97a5;">Document transmis via<br><strong style="color:#1589b8;">Sentinelle Pro</strong></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="background:#eef3f7;padding:16px 24px;text-align:center;font-size:11px;line-height:17px;color:#7d8996;">Cet e-mail est généré automatiquement à la suite de la clôture ${doc?.type==='intervention'?'de l’intervention':'de mission'}. Pour toute question opérationnelle, contactez votre interlocuteur habituel chez Azzera Protect.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
function buildMainCouranteText(doc:any, recipient:{email:string,display_name:string|null}){
  const client=mainCouranteClient(doc)
  const date=formatEmailDate(doc?.created_at)
  return `${recipient?.display_name ? `Bonjour ${recipient.display_name},` : 'Bonjour,'}\n\n${doc?.type==='intervention'?'Votre bon d’intervention est disponible.':'Votre main courante est disponible.'}\n\nDocument : ${String(doc?.title || 'Main courante')}\nClient : ${String(client?.name || 'Client')}${date ? `\nDate : ${date}` : ''}\n\nLe PDF officiel est joint à cet e-mail et reste accessible dans votre espace client Sentinelle Pro : ${SENTINELLE_CLIENT_URL}\n\nAzzera Protect\nService Exploitation · Sécurité privée\nDocument transmis via Sentinelle Pro.`
}

function bytesToBase64(bytes: Uint8Array){
  let binary=''
  const chunk=0x8000
  for(let i=0;i<bytes.length;i+=chunk) binary += String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)))
  return btoa(binary)
}
function cleanFilename(value: unknown){
  return `${String(value || 'main-courante').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'') || 'main-courante'}.pdf`
}
function uniqueRecipients(rows: Array<{email?: string|null,display_name?: string|null}>){
  const seen=new Set<string>()
  const out:Array<{email:string,display_name:string|null}>=[]
  for(const row of rows || []){
    const email=String(row?.email || '').trim().toLowerCase()
    if(!email || seen.has(email)) continue
    seen.add(email)
    out.push({email,display_name:row?.display_name ? String(row.display_name) : null})
  }
  return out
}
// Owner decision, 2026-10-25: these four historical partial deliveries must
// never be resent, including by manual reset. SHA-256 of canonical document IDs
// avoids embedding document identifiers or recipients. No DB history is changed.
const HISTORICAL_NO_RESEND_SHA256 = new Set([
  '34720e2b9ce83dd290e260e7cc8d3ef58f2866426a3577ec03768e2ba8cf125f',
  '5115d3058645e6cbb31b80a922c921f3c88b505b83beaebd07479c296223edd1',
  '761dcfff9916228c9e0dd6b4c07333bc6aff099447b7ea13cfa94aab1941ab4f',
  '78fd1befcc32dc99ef682507f4d9e67e996cff94ecffb23c927f9ad38a99d773',
])
export async function historicalDeliveryWithheld(documentId:string){
  const canonical=String(documentId).trim().toLowerCase()
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical))
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
  return HISTORICAL_NO_RESEND_SHA256.has(hash)
}

export async function deliverMainCourante(args:{
  admin:SupabaseClient, documentId:string, brevoKey:string, senderEmail:string,
  senderName:string, manualReset?:boolean, callerProfileId?:string
}){
  const {admin,documentId,brevoKey,senderEmail,senderName,manualReset=false,callerProfileId}=args
  // Check before claim/reset/download: withholding is independent of queue state.
  if(await historicalDeliveryWithheld(documentId)) return {status:'withheld',sent:false,queued:false,reason:'owner_no_resend_20261025'}
  const step=async(action:string,extra:Record<string,unknown>={})=>{
    const {data,error}=await admin.rpc('sentinelle_delivery_step',{p_document:documentId,p_action:action,...extra})
    if(error || !data) throw new Error('État de livraison indisponible; aucun renvoi automatique autorisé.')
    return data
  }
  const claim=await step('claim',{p_profile:callerProfileId||null,p_manual:manualReset})
  if(claim.status!=='claimed') return claim
  const token=claim.token
  const finish=async(outcome:string,message?:string)=>step('finish',{p_token:token,p_outcome:outcome,p_message:message||null})
  let doc:any, recipients:Array<{email:string,display_name:string|null}>,pdfBase64:string
  try{
    const result=await admin.from('generated_documents')
      .select('id,organization_id,client_id,type,title,created_at,storage_bucket,storage_path,firebase_site_id,clients(name,report_email,billing_email,auto_email,active)')
      .eq('id',documentId).single()
    if(result.error||!result.data) throw new Error('Document indisponible.')
    doc=result.data
    const targets=await admin.rpc('sentinelle_delivery_recipients',{p_document:documentId})
    if(targets.error) throw new Error('Résolution destinataires indisponible.')
    recipients=targets.data||[]
    if(!recipients.length) return await finish('no_recipient')
    const allowed=await admin.rpc('sentinelle_document_delivery_allowed',{p_document:documentId,p_profile:callerProfileId||null})
    if(allowed.error) throw new Error('Autorisation documentaire indisponible.')
    if(allowed.data!==true) return await finish('blocked')
    const file=await admin.storage.from(doc.storage_bucket).download(doc.storage_path)
    if(file.error||!file.data) throw new Error('PDF indisponible.')
    const bytes=new Uint8Array(await file.data.arrayBuffer())
    if(!bytes.length) throw new Error('PDF vide.')
    pdfBase64=bytesToBase64(bytes)
  }catch(_error){return await finish('failed','Préparation du document impossible; aucun appel fournisseur effectué.')}
  const sent:string[]=[],already:string[]=[]
  for(const recipient of recipients){
    const reservation=await step('begin',{p_token:token,p_email:recipient.email})
    if(reservation.status==='sent'){already.push(recipient.email);continue}
    if(reservation.status==='blocked') return await finish('blocked')
    if(reservation.status!=='sending') return reservation
    // Durable intent is stored BEFORE network I/O. Any ambiguous result is quarantined.
    let outcome='uncertain',message='Réponse fournisseur inconnue'
    try{
      const response=await fetch('https://api.brevo.com/v3/smtp/email',{
        method:'POST',signal:AbortSignal.timeout(30_000),
        headers:{'Content-Type':'application/json','api-key':brevoKey},
        body:JSON.stringify({
          headers:{idempotencyKey:reservation.key},
          sender:{email:senderEmail,name:senderName},
          to:[{email:recipient.email,name:recipient.display_name||recipient.email}],
          subject:`Azzera Protect — ${doc.type==='intervention'?'Bon d’intervention':'Main courante'} — ${normalizeEmailSubject(doc.title)}`,
          htmlContent:buildMainCouranteEmail(doc,recipient),
          textContent:buildMainCouranteText(doc,recipient),
          replyTo:{email:senderEmail,name:senderName},
          attachment:[{name:cleanFilename(doc.title),content:pdfBase64}],
          tags:['sentinelle-pro',doc.type==='intervention'?'intervention':'main-courante']
        })
      })
      const payload=await response.json().catch(()=>null)
      if(response.ok && typeof payload?.messageId==='string' && payload.messageId){outcome='sent';message=payload.messageId}
      else if([400,401,402,403,404,422,429].includes(response.status) && payload?.code && payload.code!=='duplicate_parameter'){
        outcome='failed';message=`Brevo rejection ${response.status}: ${String(payload.code).slice(0,80)}`
      }else{message=`Brevo result uncertain (${response.status})`}
    }catch(_error){message='Transport interrompu : acceptation fournisseur inconnue'}
    // Persistence errors are NOT converted into provider failures/retries.
    const stored=await step('result',{p_token:token,p_email:recipient.email,p_outcome:outcome,p_message:message})
    if(stored.status==='stale') return stored
    if(outcome==='sent') sent.push(recipient.email)
  }
  const result=await finish('complete')
  return {...result,recipients:sent,alreadySent:already.length>0,already}
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: unknown, status=200){
  return new Response(JSON.stringify(body), { status, headers:{...corsHeaders,'Content-Type':'application/json'} })
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
    if(!supabaseUrl||!serviceKey) throw new Error('Configuration Supabase serveur manquante.')
    if(!brevoKey||!senderEmail) throw new Error('Secrets Brevo manquants.')

    const authHeader=req.headers.get('Authorization')||''
    if(!authHeader.startsWith('Bearer ')) return json({error:'Non authentifié'},401)
    const token=authHeader.slice(7).trim()
    if(!token) return json({error:'Jeton invalide'},401)

    const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}})
    // Auth verifies the token; never use a decoded/browser-provided subject.
    let verifiedUserId:string
    try{
      const {data,error}=await admin.auth.getUser(token)
      if(error){
        const status=Number(error.status || 0)
        return status===0 || status>=500
          ? json({error:'Vérification de session indisponible'},503)
          : json({error:'Jeton invalide'},401)
      }
      if(!data?.user?.id) return json({error:'Jeton invalide'},401)
      verifiedUserId=data.user.id
    }catch(_error){
      return json({error:'Vérification de session indisponible'},503)
    }

    // Matches loadCompatUser in the frontend. external_uid is a business ID,
    // not a fallback authentication binding for an unlinked legacy profile.
    const native=await admin.from('profiles').select('id,organization_id,role,active')
      .eq('auth_user_id',verifiedUserId).maybeSingle()
    const external=await admin.from('profiles').select('id')
      .eq('external_uid',verifiedUserId).maybeSingle()
    if(native.error || external.error) return json({error:'Vérification du profil indisponible'},503)
    if(external.data && native.data && external.data.id!==native.data.id){
      return json({error:'Correspondance de profil ambiguë'},403)
    }
    const callerProfile=native.data
    if(!callerProfile || callerProfile.active!==true || !callerProfile.organization_id || !['admin','superviseur','agent'].includes(callerProfile.role)){
      return json({error:'Accès refusé'},403)
    }

    const body=await req.json().catch(()=>({}))
    const documentId=String(body?.documentId||'')
    const manual=body?.manual===true
    if(!documentId) return json({error:'documentId requis'},400)

    const {data:doc,error:docError}=await admin.from('generated_documents').select('id,organization_id').eq('id',documentId).single()
    if(docError||!doc) return json({error:'Document introuvable'},404)
    if(doc.organization_id!==callerProfile.organization_id) return json({error:'Document hors organisation'},403)
    const permitted=await admin.rpc('sentinelle_document_delivery_allowed',{p_document:documentId,p_profile:callerProfile.id})
    if(permitted.error) return json({error:'Autorisation documentaire indisponible'},503)
    if(permitted.data!==true) return json({error:'Document non autorisé'},403)

    const result=await deliverMainCourante({admin,documentId,brevoKey,senderEmail,senderName,manualReset:manual,callerProfileId:callerProfile.id})
    return json(result)
  }catch(error){
    console.error(error)
    return json({error:String((error as Error)?.message||error)},500)
  }
})
