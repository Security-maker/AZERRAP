// Read-only planning helpers. Authentication and organization isolation remain server-side.
const dateOf=value=>{const d=value?.toDate?value.toDate():new Date(value);return value&&Number.isFinite(d.getTime())?d:null;};
const hidden=m=>m.planningHidden===true||m.hiddenFromPlanning===true||m.archivedFromPlanning===true;
export function upcomingTakeShiftMissions(missions,now=Date.now()){
  return missions.filter(m=>{
    const start=dateOf(m.scheduledStart),end=dateOf(m.scheduledEnd);
    return !hidden(m)&&String(m.publicationStatus||'').toLowerCase()!=='draft'
      &&['planned','assigned'].includes(m.status||'planned')&&!m.actualStart
      &&start&&end&&end>start&&end.getTime()>now;
  }).sort((a,b)=>dateOf(a.scheduledStart)-dateOf(b.scheduledStart)||String(a.id).localeCompare(String(b.id))).slice(0,2);
}

async function readAll(build){
  const rows=[],seen=new Set();
  // Do not silently export the API's first page (or a partially failed download).
  for(let offset=0;offset<30000;){
    const {data,error,count}=await build().range(offset,offset+249);
    if(error)throw error;
    if(!Array.isArray(data))throw new Error('Réponse du planning invalide. Réessaie le téléchargement.');
    if(!Number.isInteger(count)||count<0)throw new Error('Impossible de vérifier que le planning est complet. Aucun PDF généré.');
    for(const row of data){if(seen.has(row.id))throw new Error('Le planning a changé pendant la lecture. Réessaie le téléchargement.');seen.add(row.id);rows.push(row);}
    offset+=data.length;
    if(offset>=count)return rows;
    if(!data.length)throw new Error('Lecture du planning incomplète. Aucun PDF généré.');
  }
  throw new Error('Volume de planning trop important pour un seul PDF. Aucun fichier partiel généré.');
}
export async function loadOperationsPlanning(client,organizationId,range){
  if(!organizationId||!range?.start||!range?.end)throw new Error('Périmètre du planning manquant.');
  const [missions,sites]=await Promise.all([
    readAll(()=>client.from('missions').select('id,firebase_id,firebase_site_id,firebase_agent_uid,status,scheduled_start,scheduled_end,payload',{count:'exact'})
      .eq('organization_id',organizationId).lt('scheduled_start',range.end.toISOString()).gt('scheduled_end',range.start.toISOString()).order('scheduled_start').order('id')),
    readAll(()=>client.from('sites').select('id,firebase_id,name,client_name,active',{count:'exact'}).eq('organization_id',organizationId).order('id'))
  ]);
  return {
    sites:sites.map(s=>({id:s.firebase_id,name:s.name,clientName:s.client_name,active:s.active})),
    missions:missions.map(m=>({...m.payload,id:m.firebase_id,siteId:m.firebase_site_id,agentId:m.firebase_agent_uid,status:m.status,scheduledStart:m.scheduled_start,scheduledEnd:m.scheduled_end}))
      .filter(m=>!hidden(m)&&m.status!=='cancelled')
  };
}

export function operationsPlanningSummary(missions,range){
  const rows=missions.filter(m=>{const start=dateOf(m.scheduledStart),end=dateOf(m.scheduledEnd);return !hidden(m)&&m.status!=='cancelled'&&start&&end&&end>start&&start<range.end&&end>range.start;});
  return {missions:rows,agents:new Set(rows.map(m=>m.agentId).filter(Boolean)).size,
    minutes:rows.reduce((n,m)=>n+Math.max(0,(Math.min(+dateOf(m.scheduledEnd),+range.end)-Math.max(+dateOf(m.scheduledStart),+range.start))/60000),0),
    drafts:rows.filter(m=>String(m.publicationStatus||'').toLowerCase()==='draft').length};
}

// Same day-by-day grid as the collaborator PDF, consolidated by site.
// Identical site/time assignments share one cell entry; every mission remains accounted for.
export function operationsPlanningGrid(missions,sites,range){
  const summary=operationsPlanningSummary(missions,range),rows=new Map(),siteMap=new Map(sites.map(s=>[s.id,s]));
  const days=new Date(range.start.getFullYear(),range.start.getMonth()+1,0).getDate(),daily=Array(days).fill(0);
  const clock=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const ensure=(id,name)=>{if(!rows.has(id))rows.set(id,{siteId:id,siteName:name||'Site non renseigné',cells:Array.from({length:days},()=>[]),minutes:0});return rows.get(id);};
  for(const s of sites)ensure(s.id,s.name);
  for(const m of [...summary.missions].sort((a,b)=>dateOf(a.scheduledStart)-dateOf(b.scheduledStart)||String(a.id).localeCompare(String(b.id)))){
    const row=ensure(m.siteId,siteMap.get(m.siteId)?.name||m.siteNom),start=dateOf(m.scheduledStart),end=dateOf(m.scheduledEnd);
    const key=JSON.stringify([+start,+end]),draft=String(m.publicationStatus||'').toLowerCase()==='draft';
    let cursor=new Date(Math.max(+start,+range.start));const hardEnd=Math.min(+end,+range.end);
    while(+cursor<hardEnd){
      // Calendar midnights, rather than 24-hour offsets, preserve daylight-saving changes.
      const nextDay=new Date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+1),stop=new Date(Math.min(+nextDay,hardEnd));
      const day=cursor.getDate()-1,minutes=(+stop-+cursor)/60000;
      let slot=row.cells[day].find(s=>s.key===key);
      if(!slot){slot={key,missionIds:[],start:clock(cursor),end:+stop===+nextDay?'24:00':clock(stop),draft:false,agentIds:new Set(),agents:0};row.cells[day].push(slot);}
      slot.missionIds.push(m.id);slot.draft ||= draft;if(m.agentId)slot.agentIds.add(m.agentId);slot.agents=slot.agentIds.size;
      row.minutes+=minutes;daily[day]+=minutes;cursor=stop;
    }
  }
  for(const row of rows.values())for(const slots of row.cells)for(const slot of slots){delete slot.key;delete slot.agentIds;}
  return {summary,days,daily,rows:[...rows.values()].sort((a,b)=>a.siteName.localeCompare(b.siteName,'fr'))};
}

export function createOperationsPlanningPdf({jsPDF,drawLogo,brand,missions,sites,range,recap,generatedAt=new Date()}){
  const {summary,days,daily,rows}=operationsPlanningGrid(missions,sites,range),C=brand;
  const text=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()||'-';
  if(!recap?.breakdown||!Array.isArray(recap.weeks)||!Number.isFinite(recap.totalMinutes))throw new Error('Récapitulatif des heures indisponible. Aucun PDF incomplet généré.');
  const hours=n=>{const minutes=Math.round(n);return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;};
  // Keep the collaborator PDF's masthead, identity strip and site/day grid.
  // One complete landscape sheet: A4 first, A3 only when genuinely necessary.
  let doc,layout;
  for(const format of ['a4','a3']){
    doc=new jsPDF({unit:'mm',format,orientation:'landscape'});
    const w=doc.internal.pageSize.getWidth(),h=doc.internal.pageSize.getHeight(),left=format==='a4'?42:56;
    const cell=(w-20-left)/days,fs=format==='a4'?6:7.5,line=fs*25.4/72*1.2,slotHeight=3*line+1.3;
    doc.setFont('helvetica','bold');doc.setFontSize(format==='a4'?7:8.5);
    const prepared=rows.map(row=>{
      const siteLines=doc.splitTextToSize(text(row.siteName),left-4);
      return {...row,siteLines,height:Math.max(14,siteLines.length*3.4+5,Math.max(...row.cells.map(xs=>xs.length),0)*slotHeight+4)};
    });
    const height=prepared.reduce((sum,r)=>sum+r.height,0);
    layout={w,h,left,cell,fs,line,slotHeight,prepared};
    if(height<=h-149)break;
    if(format==='a3')throw new Error('Ce mois contient trop de lignes pour une seule page lisible. Aucun planning incomplet généré.');
  }
  const {w,h,left,cell,fs,line,slotHeight,prepared}=layout;
  doc.setProperties({title:`Planning exploitation - ${range.label}`,subject:'Planning mensuel de tous les sites sur une page',author:'AZZERA PROTECT · Sentinelle Pro'});
  doc.setFillColor(...C.obsidian);doc.rect(0,0,w,28,'F');drawLogo(doc,10,5,17,17);
  doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(...C.white);doc.text('AZZERA PROTECT',31,12);
  doc.setFontSize(7.2);doc.setTextColor(0,156,255);doc.text('PLANNING EXPLOITATION',31,18);
  doc.setTextColor(210,220,230);doc.setFont('helvetica','normal');doc.setFontSize(6.8);
  doc.text(`Édition du ${generatedAt.toLocaleString('fr-FR')} · Planning susceptible d'être modifié.`,w-11,12,{align:'right'});
  doc.text(`${text(range.label).toUpperCase()} · TOUS LES SITES`,w-11,19,{align:'right'});
  doc.setDrawColor(...C.line);doc.setFillColor(248,250,252);doc.roundedRect(10,34,w-20,15,2.5,2.5,'FD');
  doc.setTextColor(...C.obsidian);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Planification mensuelle des sites',14,40);
  doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...C.grey);
  doc.text(`${rows.length} sites · ${summary.missions.length} vacations · ${summary.agents} collaborateurs · ${hours(summary.minutes)} h planifiées dans le mois`,14,45);
  let y=54;
  doc.setFillColor(...C.obsidian);doc.rect(10,y,w-20,10,'F');doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(...C.white);
  doc.text('SITES',12,y+6.5);
  for(let d=0;d<days;d++){
    const date=new Date(range.start.getFullYear(),range.start.getMonth(),d+1),x=10+left+d*cell;
    doc.setDrawColor(80,94,110);doc.rect(x,y,cell,10);
    doc.setFontSize(6.3);doc.text(String(d+1).padStart(2,'0'),x+cell/2,y+4,{align:'center'});
    doc.setFontSize(4.8);doc.text(date.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','').slice(0,3).toUpperCase(),x+cell/2,y+7.5,{align:'center'});
  }
  y+=10;
  for(const row of prepared){
    const rh=row.height;
    doc.setDrawColor(...C.line);doc.setLineWidth(.15);doc.setFillColor(248,250,252);doc.rect(10,y,left,rh,'FD');
    doc.setTextColor(...C.obsidian);doc.setFont('helvetica','bold');doc.setFontSize(w<300?7:8.5);
    doc.text(row.siteLines,12,y+(rh-row.siteLines.length*3.4)/2+2.7,{lineHeightFactor:1.2});
    for(let d=0;d<days;d++){
      const x=10+left+d*cell,slots=row.cells[d],day=new Date(range.start.getFullYear(),range.start.getMonth(),d+1).getDay();
      doc.setFillColor(...([0,6].includes(day)?[236,243,248]:[248,250,252]));doc.rect(x,y,cell,rh,'FD');
      let cy=y+(rh-slots.length*slotHeight)/2+line;
      for(const slot of slots){
        doc.setFont('helvetica','bold');doc.setFontSize(fs);doc.setTextColor(...C.obsidian);
        doc.text(slot.start,x+cell/2,cy,{align:'center'});doc.text(slot.end,x+cell/2,cy+line,{align:'center'});
        doc.setFont('helvetica','normal');doc.setTextColor(0,84,139);doc.setFontSize(fs-.5);
        const count=slot.agents+' ag.'+(slot.draft?'*':'');
        doc.setFontSize(Math.min(fs-.5,(fs-.5)*(cell-1)/doc.getTextWidth(count)));
        doc.text(count,x+cell/2,cy+2*line,{align:'center'});cy+=slotHeight;
      }
    }
    y+=rh;
  }
  if(!prepared.length){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...C.grey);doc.text('Aucun site ni vacation accessible pour ce mois.',12,y+8);y+=14;}
  doc.setDrawColor(...C.line);doc.setFillColor(236,243,248);doc.rect(10,y,w-20,9,'F');doc.rect(10,y,left,9);
  doc.setTextColor(...C.obsidian);doc.setFont('helvetica','bold');doc.setFontSize(6);doc.text('TOTAL HEURES JOURNALIÈRES',12,y+5.8);
  daily.forEach((minutes,i)=>{const x=10+left+i*cell;doc.rect(x,y,cell,9);doc.setFontSize(fs);doc.text(minutes?(minutes/60).toFixed(1):'-',x+cell/2,y+5.8,{align:'center'});});
  y+=17;
  // Same categories and ISO week totals as the Agent planning, aggregated over all sites.
  const leftW=(w-30)*.53,rightX=20+leftW,rightW=w-10-rightX,tableY=y+4,rowH=7;
  doc.setTextColor(...C.obsidian);doc.setFont('helvetica','bold');doc.setFontSize(8);
  doc.text('HEURES PLANIFIÉES',10,y);doc.text('HEURES HEBDOMADAIRES',rightX,y);
  const widths=[.26,.18,.18,.19,.19].map(r=>r*leftW),headers=['','Jour','Nuit','Férié jour','Férié nuit'];
  let x=10;
  doc.setFillColor(...C.obsidian);doc.setTextColor(...C.white);doc.setFontSize(7);
  doc.rect(10,tableY,leftW,rowH,'F');
  headers.forEach((label,i)=>{doc.text(label,x+2,tableY+4.8);x+=widths[i];});
  const b=recap.breakdown,hoursDecimal=n=>(n/60).toFixed(2);
  const detail=[['Semaine',b.weekDay,b.weekNight,b.holidayDay,b.holidayNight],['Dimanche',b.sundayDay,b.sundayNight,null,null]];
  detail.forEach((r,j)=>{x=10;doc.setTextColor(...C.obsidian);doc.setFont('helvetica','normal');r.forEach((value,i)=>{
    doc.setDrawColor(...C.line);doc.rect(x,tableY+(j+1)*rowH,widths[i],rowH);
    doc.text(i===0?value:value===null?'-':hoursDecimal(value),x+2,tableY+(j+1)*rowH+4.8);x+=widths[i];
  });});
  doc.setFillColor(236,243,248);doc.rect(10,tableY+3*rowH,leftW,rowH,'FD');doc.setFont('helvetica','bold');
  doc.text('TOTAL DU MOIS',12,tableY+3*rowH+4.8);doc.text(hoursDecimal(recap.totalMinutes)+' h',10+leftW-2,tableY+3*rowH+4.8,{align:'right'});
  const labelW=25,weekW=(rightW-labelW)/Math.max(1,recap.weeks.length);
  doc.setFillColor(...C.obsidian);doc.setTextColor(...C.white);doc.rect(rightX,tableY,rightW,rowH,'F');doc.text('SEMAINE',rightX+2,tableY+4.8);
  recap.weeks.forEach((week,i)=>doc.text(String(week.week),rightX+labelW+(i+.5)*weekW,tableY+4.8,{align:'center'}));
  doc.setTextColor(...C.obsidian);doc.setFont('helvetica','normal');doc.rect(rightX,tableY+rowH,labelW,rowH);doc.text('HEURES',rightX+2,tableY+rowH+4.8);
  recap.weeks.forEach((week,i)=>{const wx=rightX+labelW+i*weekW;doc.rect(wx,tableY+rowH,weekW,rowH);doc.text(hoursDecimal(week.minutes),wx+weekW/2,tableY+rowH+4.8,{align:'center'});});
  if(!recap.weeks.length)doc.text('Aucune heure',rightX+labelW+3,tableY+rowH+4.8);
  doc.setTextColor(...C.grey);doc.setFontSize(6.5);
  doc.text('Heures du mois uniquement, cumulées pour tous les sites.',rightX,tableY+3*rowH);
  doc.text('Répartition indicative : nuit 21 h - 6 h, selon le planning Agent.',rightX,tableY+4*rowH);
  y=tableY+4*rowH;
  doc.setFont('helvetica','normal');doc.setTextColor(...C.grey);doc.setFontSize(7);
  doc.text('Chaque case : début / fin / agents prévus sur ce créneau. Les nuits sont réparties sur les jours concernés ; 24:00 = minuit.',10,y+7);
  doc.text('* : brouillon inclus. 0 ag. : créneau non affecté. Les effectifs représentent les affectations, pas les présences réelles.',10,y+12);
  doc.setDrawColor(...C.line);doc.line(10,h-15,w-10,h-15);doc.setFontSize(6.5);
  doc.text('AZZERA PROTECT · Document généré par Sentinelle Pro · Mois complet, sans publication ni envoi',10,h-9);
  doc.text('1 / 1',w-10,h-9,{align:'right'});
  return doc;
}
