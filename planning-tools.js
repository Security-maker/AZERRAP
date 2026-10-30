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

// One row per site/agent, one column per day. A night is shown on its start day.
export function operationsPlanningGrid(missions,sites,range){
  const summary=operationsPlanningSummary(missions,range),rows=new Map(),siteMap=new Map(sites.map(s=>[s.id,s]));
  const days=new Date(range.start.getFullYear(),range.start.getMonth()+1,0).getDate();
  const clock=d=>`${d.getHours()}h${d.getMinutes()?String(d.getMinutes()).padStart(2,'0'):''}`;
  const calendarDay=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
  const slotKey=m=>JSON.stringify([m.siteId,+dateOf(m.scheduledStart),+dateOf(m.scheduledEnd)]),staff=new Map();
  for(const m of summary.missions){const key=slotKey(m);if(!staff.has(key))staff.set(key,new Set());if(m.agentId)staff.get(key).add(m.agentId);}
  for(const m of [...summary.missions].sort((a,b)=>dateOf(a.scheduledStart)-dateOf(b.scheduledStart)||String(a.id).localeCompare(String(b.id)))){
    const key=JSON.stringify([m.siteId,m.agentId||null]);
    if(!rows.has(key))rows.set(key,{siteId:m.siteId,siteName:siteMap.get(m.siteId)?.name||m.siteNom||'Site non renseigné',agentName:m.agentNom||'Non affectée',cells:Array.from({length:days},()=>[]),minutes:0});
    const row=rows.get(key),start=dateOf(m.scheduledStart),end=dateOf(m.scheduledEnd),visibleStart=new Date(Math.max(+start,+range.start));
    const carry=start<range.start,day=visibleStart.getDate()-1,offset=Math.round((calendarDay(end)-calendarDay(visibleStart))/86400000);
    const draft=String(m.publicationStatus||'').toLowerCase()==='draft';
    row.cells[day].push({id:m.id,start:clock(visibleStart)+(carry?'<':''),end:clock(end)+(offset?'+'+offset:''),draft,agents:staff.get(slotKey(m)).size});
    row.minutes+=Math.max(0,(Math.min(+end,+range.end)-Math.max(+start,+range.start))/60000);
  }
  for(const s of sites)if(![...rows.values()].some(r=>r.siteId===s.id))rows.set(JSON.stringify([s.id,null]),{siteId:s.id,siteName:s.name,agentName:'Aucune vacation',cells:Array.from({length:days},()=>[]),minutes:0});
  return {summary,days,rows:[...rows.values()].sort((a,b)=>a.siteName.localeCompare(b.siteName,'fr')||a.agentName.localeCompare(b.agentName,'fr'))};
}

export function createOperationsPlanningPdf({jsPDF,drawLogo,brand,missions,sites,range,generatedAt=new Date()}){
  const {summary,days,rows}=operationsPlanningGrid(missions,sites,range),C=brand;
  const text=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()||'-';
  const hours=n=>{const minutes=Math.round(n);return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;};
  // Keep one complete sheet. Prefer A4; use A3 for a denser month rather than unreadable type.
  let doc,layout;
  for(const format of ['a4','a3']){
    doc=new jsPDF({unit:'mm',format,orientation:'landscape'});
    const w=doc.internal.pageSize.getWidth(),h=doc.internal.pageSize.getHeight(),left=format==='a4'?53:65,total=15;
    const cell=(w-20-left-total)/days,fs=format==='a4'?7:8,line=fs*25.4/72*1.25;
    doc.setFont('helvetica','bold');doc.setFontSize(format==='a4'?8:9);
    const prepared=rows.map(row=>{
      const siteLines=doc.splitTextToSize(text(row.siteName),left-4),agentLines=doc.splitTextToSize(text(row.agentName),left-4);
      const slotHeight=s=>(s.agents===1?2:3)*line+2;
      const contentHeight=Math.max(0,...row.cells.map(xs=>xs.reduce((sum,s)=>sum+slotHeight(s),0)));
      return {...row,siteLines,agentLines,height:Math.max(14,(siteLines.length+agentLines.length)*3.6+5,contentHeight+4)};
    });
    const height=prepared.reduce((sum,r)=>sum+r.height,0);
    doc.setFont('helvetica','normal');doc.setFontSize(6.5);
    const timesFit=prepared.every(r=>r.cells.every(slots=>slots.every(s=>[s.start,s.end+(s.draft?'*':''),s.agents+' ag.'].every(t=>doc.getTextWidth(t)<=cell-1))));
    layout={w,h,left,total,cell,fs,line,prepared};
    if(height<=h-85&&timesFit)break;
    if(format==='a3')throw new Error('Ce mois contient trop de lignes pour une seule page lisible. Aucun planning incomplet généré.');
  }
  const {w,h,left,total,cell,fs,line,prepared}=layout;
  doc.setProperties({title:`Planning exploitation - ${range.label}`,subject:'Synthèse mensuelle globale sur une page',author:'AZZERA PROTECT · Sentinelle Pro'});
  doc.setFillColor(...C.obsidian);doc.rect(0,0,w,25,'F');drawLogo(doc,10,4,17,17);
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...C.white);doc.text('AZZERA PROTECT',32,11);
  doc.setFontSize(9);doc.setTextColor(0,156,255);doc.text('PLANNING EXPLOITATION',32,19);
  doc.setTextColor(...C.white);doc.setFontSize(11);doc.text(text(range.label).toUpperCase(),w-10,12,{align:'right'});
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Mois complet · Tous les sites',w-10,19,{align:'right'});
  doc.setTextColor(...C.obsidian);doc.setFontSize(9);
  doc.text(`${summary.missions.length} vacations   /   ${summary.agents} collaborateurs   /   ${hours(summary.minutes)} h dans le mois`,10,34);
  let y=40;
  doc.setFillColor(...C.obsidian);doc.rect(10,y,w-20,11,'F');doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...C.white);
  doc.text('Site / intervenant',12,y+7);doc.text('Total h',w-10-total/2,y+7,{align:'center'});
  const weekday=['D','L','M','M','J','V','S'];
  for(let d=0;d<days;d++){
    const date=new Date(range.start.getFullYear(),range.start.getMonth(),d+1),x=10+left+(d+.5)*cell;
    doc.setFontSize(7);doc.text(weekday[date.getDay()],x,y+4,{align:'center'});doc.setFontSize(8);doc.text(String(d+1).padStart(2,'0'),x,y+8.5,{align:'center'});
  }
  y+=11;
  for(const row of prepared){
    const rh=row.height;
    doc.setDrawColor(...C.line);doc.setLineWidth(.15);doc.setFillColor(...C.soft);doc.rect(10,y,left,rh,'FD');
    doc.setTextColor(...C.obsidian);doc.setFont('helvetica','bold');doc.setFontSize(layout.w<300?8:9);
    doc.text(row.siteLines,12,y+5,{lineHeightFactor:1.2});
    doc.setFont('helvetica','normal');doc.setTextColor(...C.grey);doc.text(row.agentLines,12,y+5+row.siteLines.length*3.6,{lineHeightFactor:1.2});
    for(let d=0;d<days;d++){
      const x=10+left+d*cell,slots=row.cells[d],day=new Date(range.start.getFullYear(),range.start.getMonth(),d+1).getDay();
      doc.setFillColor(...(slots.length?[232,244,255]:[0,6].includes(day)?[242,244,247]:C.white));doc.rect(x,y,cell,rh,'FD');
      const contentHeight=slots.reduce((sum,s)=>sum+(s.agents===1?2:3)*line+2,0);
      let cy=y+(rh-contentHeight+2)/2+line*.8;
      doc.setFont('helvetica','normal');doc.setFontSize(fs);doc.setTextColor(...C.obsidian);
      for(const slot of slots){
        // Fit time suffixes (+1, draft *) inside their day; no truncation of a vacation.
        const lines=[slot.start,slot.end+(slot.draft?'*':'')];
        const widest=Math.max(...lines.map(t=>doc.getTextWidth(t)));
        const size=Math.min(fs,fs*(cell-1)/widest);doc.setFontSize(size);
        doc.text(lines[0],x+cell/2,cy,{align:'center'});doc.text(lines[1],x+cell/2,cy+line,{align:'center'});
        doc.setFontSize(fs);
        if(slot.agents!==1){doc.setFont('helvetica','bold');doc.setTextColor(0,84,139);doc.text(slot.agents+' ag.',x+cell/2,cy+2*line,{align:'center'});doc.setFont('helvetica','normal');doc.setTextColor(...C.obsidian);}
        cy+=(slot.agents===1?2:3)*line+2;
      }
    }
    const x=w-10-total;doc.setFillColor(...C.soft);doc.rect(x,y,total,rh,'FD');doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...C.obsidian);doc.text(hours(row.minutes),x+total/2,y+rh/2+1,{align:'center'});y+=rh;
  }
  if(!prepared.length){doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(...C.grey);doc.text('Aucun site ni vacation accessible pour ce mois.',12,y+10);y+=15;}
  doc.setFont('helvetica','normal');doc.setTextColor(...C.grey);doc.setFontSize(7.5);
  doc.text('Horaires au jour de départ. +1 : fin le lendemain ; +2 : deux jours après. < : début avant le mois. * : brouillon.',10,y+7);
  doc.text('2 ag. : agents prévus sur le même site et créneau (brouillons inclus). Sans nombre : 1 agent. Une case vide ne signifie pas une absence.',10,y+12);
  doc.text('Totaux limités au mois. Missions annulées ou retirées exclues.',10,y+17);
  doc.setDrawColor(...C.line);doc.line(10,h-15,w-10,h-15);doc.setFontSize(7.5);
  doc.text(`Sentinelle Pro · Édition du ${generatedAt.toLocaleString('fr-FR')} · Document interne, sans publication ni envoi`,10,h-9);
  doc.text('1 / 1',w-10,h-9,{align:'right'});
  return doc;
}
