/* ================= KONSTANTA ================= */
const FIX_MAKRO={'SPANDEX 20':.02,'SPANDEX 30':.03,'SPANDEX 40':.05,'SPANDEX 70':.1,'SPANDEX 140':.03,'SPANDEK 140':.03};
const WARNA_DEFAULT=['WHITE','BLACK','NAVY','RED','BLUE','GREEN','YELLOW','GREY','GRAY','MAROON','PINK','PURPLE','ORANGE','BROWN','CREAM','KHAKI','BEIGE','TOSCA','OLIVE','MUSTARD','BURGUNDY','MAGENTA','FUCHSIA','LILAC','LAVENDER','CHARCOAL','SILVER','GOLD','IVORY','TURQUOISE','MINT','PEACH','SALMON','MILO','PUTIH','HITAM','MERAH','BIRU','HIJAU','KUNING','ABU','COKLAT','UNGU'];
const GROUPS={kain:['Greige','Matang'],benang:['Greige','Warna','Eksternal','Double Winder']};
const RULE_DEFAULT={warna:WARNA_DEFAULT,matang:[],eksternal:[],doubleWinder:[],kurung:true,dwPola:true};

/* ================= UTIL ================= */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>String(s??'').replace(/\s+/g,' ').trim().toUpperCase();
function cyrb53(str,seed=0){let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;for(let i=0,ch;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return 4294967296*(2097151&h2)+(h1>>>0);}
const NB=32;
const keyOf=nama=>{const h=cyrb53(norm(nama));return {k:'k'+h.toString(36),b:'b'+String(h%NB).padStart(2,'0')};};
const fmtPct=v=>{if(v===null||v===undefined||v==='') return '';const x=Math.round(v*10000)/100;return (Number.isInteger(x)?x:x.toFixed(2).replace(/0$/,''))+'%';};
const pctIn=v=>(!v)?'':String(Math.round(v*10000)/100);
const totalOf=p=>(p||[]).reduce((a,b)=>a+(+b||0),0);
const okKain=(b,p)=>b.some(x=>x)&&Math.abs(totalOf(p)-1)<0.0005;
const hasFix=b=>b.fix!==undefined&&b.fix!==null&&b.fix!=='';
const gTag=g=>g?`<span class="tag g-${esc(String(g).split(' ')[0])}">${esc(g)}</span>`:'';
const gOpts=(type,sel)=>GROUPS[type].map(g=>`<option${g===sel?' selected':''}>${g}</option>`).join('');
function toast(msg,ms=2800){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),ms);}
function confirmDlg(title,html,yes='Lanjut'){return new Promise(res=>{$('dcTitle').textContent=title;$('dcBody').innerHTML=html;$('dcYes').textContent=yes;const d=$('dlgC');const done=v=>{d.close();res(v);};$('dcYes').onclick=()=>done(true);$('dcNo').onclick=()=>done(false);d.showModal();});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stamp=()=>new Date().toISOString().slice(0,10);
const lines=t=>String(t||'').split('\n').map(s=>s.trim()).filter(Boolean);
const fmtDate=at=>at?new Date(at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'';

/* ================= STATE ================= */
// Data dipegang adapter (Claude atau Supabase) dan dikirim ke UI lewat UI.* di bawah.
const S={
  online:false, canWrite:true,
  mList:[], mReady:false, master:null, fixMap:{}, jenisSet:new Set(),
  rule:{...RULE_DEFAULT}, ruleReady:false,
  store:{kain:{map:new Map(),ready:false},benang:{map:new Map(),ready:false}},
  gen:{kain:[],benang:[]}, filt:{kain:'',benang:''}, dbView:'kain', sel:{kain:new Set(),benang:new Set()}
};
const UI={
  state(cls,txt){ $('dbstate').innerHTML=`<span class="dot ${cls}"></span><span>${esc(txt)}</span>`; },
  master(list,ready){
    const arr=list.filter(b=>b&&b.nama).slice().sort((a,b)=>(a.ord??1e9)-(b.ord??1e9)||String(a.nama).localeCompare(b.nama));
    S.mList=arr; if(ready) S.mReady=true; S.master=prepMaster(arr);
    const fm={}; arr.forEach(b=>{ if(hasFix(b)) fm[norm(b.nama)]=+b.fix; }); S.fixMap=fm;
    const names=[...new Set(arr.map(b=>b.nama))];
    $('dlJenis').innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join('');
    S.jenisSet=new Set(names.map(norm)); $('nMaster').textContent=arr.length;
    renderMaster(); updateBanner();
    if(ready&&S._mSeen) scheduleRejenis(); else { renderGen('kain'); renderGen('benang'); }
    if(ready) S._mSeen=true;
  },
  rule(r,ready){
    r=r||{};
    S.rule={warna:Array.isArray(r.warna)?r.warna:WARNA_DEFAULT,matang:r.matang||[],eksternal:r.eksternal||[],doubleWinder:r.doubleWinder||[],kurung:r.kurung!==false,dwPola:r.dwPola!==false};
    if(ready) S.ruleReady=true;
    $('rWarna').value=S.rule.warna.join('\n'); $('rMatang').value=S.rule.matang.join('\n'); $('rKurung').checked=S.rule.kurung; $('rDwPola').checked=S.rule.dwPola;
    renderList('eksternal','lstEks','cntEks'); renderList('doubleWinder','lstDw','cntDw');
    $('ruleInfo').textContent=`${S.rule.warna.length} kata warna · ${S.rule.matang.length} kata kain matang`;
  },
  store(type,map,ready){
    const st=S.store[type]; st.map=map; if(ready) st.ready=true;
    $('nDb').textContent=S.store.kain.map.size+S.store.benang.map.size;
    renderDb();
  },
  rerenderDb(){ renderDb(); },
  banner(){ updateBanner(); }
};
function updateBanner(){
  let h='';
  if(!S.online) h=`<div class="banner err"><b>Database tidak tersedia.</b><span>${esc(Data.offlineHint||'Penjenisan tetap jalan, tapi data tidak bisa dibaca atau disimpan.')}</span></div>`;
  else if(S.mReady&&!S.mList.length) h=`<div class="banner"><b>Master Jenis Benang masih kosong.</b><span>Impor sekali dari file Apps Penjenisan supaya aturan bisa jalan.</span><a class="btn sm" href="#impor">Buka Impor</a></div>`;
  if(S.online&&!S.canWrite) h+=`<div class="banner"><span>Anda hanya bisa melihat. Minta akses edit ke admin untuk menyimpan.</span></div>`;
  $('bannerArea').innerHTML=h;
}
function writeErr(e){
  if(e&&e.code==='not_ready') return 'Database belum selesai dimuat, coba lagi sebentar.';
  if(e&&e.code==='no_permission'){ S.canWrite=false; updateBanner(); return 'Tidak punya izin menyimpan.'; }
  if(e&&e.code==='quota_exceeded') return 'Kapasitas database penuh: '+(e.message||'');
  return 'Gagal menyimpan'+(e&&e.message?': '+e.message:(e&&e.code?' ('+e.code+')':''))+'. Coba lagi.';
}
const needDb=()=>{ if(!S.online){ toast('Database tidak tersedia.'); return false; } return true; };

/* ================= PENJENISAN (kain & benang) ================= */
function saranAlias(seg){ return seg.replace(/\b(\d{2,})1\b/g,'$1'); }  // CTN LIKE 321 -> CTN LIKE 32 (akhiran 1 sudah dikenali otomatis)
function genKain(raw){
  raw=String(raw||'').trim();
  if(!raw) return {nama:'',status:'kosong'};
  const ent=S.store.kain.map.get(keyOf(raw).k);
  if(ent) return {nama:raw,b:[...ent.b],p:[...ent.p],g:ent.g||groupKain(raw,S.rule),status:'master'};
  const r=S.master?extractKain(raw,S.master):{yarns:[],unknown:[]};
  const y=r.yarns, b=[y[0]||'',y[1]||'',y[2]||''];
  const p=hitungPersen(b,S.fixMap)||[0,0,0];
  let status=!y.length?'gagal':(okKain(b,p)&&!r.unknown.length?'baru':'cek');
  let note='';
  if(r.unknown.length) note='Belum ada di master: '+r.unknown.join(', ');
  else if(!y.length) note='Tidak ada benang yang dikenali dari nama ini';
  else if(!okKain(b,p)) note='Total % bukan 100%';
  return {nama:raw,b,p,g:groupKain(raw,S.rule),status,note,unk:r.unknown};
}
function genBenang(raw){
  raw=String(raw||'').trim();
  if(!raw) return {nama:'',status:'kosong'};
  const ent=S.store.benang.map.get(keyOf(raw).k);
  if(ent) return {nama:raw,jenis:ent.jenis,g:ent.g||groupBenang(raw,S.rule),status:'master'};
  const r=S.master?jenisBenangX(raw,S.master):{jenis:'',cands:[],note:'Master belum dimuat'};
  return {nama:raw,jenis:r.jenis,g:groupBenang(raw,S.rule),status:r.jenis?'baru':'gagal',note:r.jenis?'':r.note,unk:r.jenis?[]:r.cands.slice(0,1)};
}
const rowOk=(type,r)=>type==='kain'?okKain(r.b,r.p):!!(r.jenis&&r.jenis.trim());
const ID={kain:{inp:'inpK',auto:'autoK',wrap:'wrapK',chips:'chipsK',save:'saveK',copy:'copyK',xls:'xlsK',miss:'missK',gen:'genK',clr:'clrK',file:'fileK'},benang:{inp:'inpB',auto:'autoB',wrap:'wrapB',chips:'chipsB',save:'saveB',copy:'copyB',xls:'xlsB',miss:'missB',gen:'genB',clr:'clrB',file:'fileB'}};
async function doGenerate(type){
  const ls=$(ID[type].inp).value.replace(/\r/g,'').split('\n');
  while(ls.length&&!ls[ls.length-1].trim()) ls.pop();
  if(!ls.length){ toast('Daftar masih kosong.'); return; }
  if(type==='kain'){
    const isi=ls.filter(x=>x.trim()), yarn=isi.filter(x=>/^\s*YARN\s*;/i.test(x)).length;
    if(yarn&&yarn>=isi.length/2){
      if(await confirmDlg('Ini sepertinya daftar benang',`<p><b>${yarn}</b> dari ${isi.length} baris diawali <span class="mono">YARN;</span>, yaitu format nama benang.</p><p>Pindahkan ke <b>Penjenisan Benang</b> supaya tidak tersimpan sebagai kain?</p>`,'Pindah ke Penjenisan Benang')){
        $('inpB').value=$(ID.kain.inp).value; $(ID.kain.inp).value=''; S.gen.kain=[]; renderGen('kain');
        location.hash='#benang'; await doGenerate('benang');
      }
      return;
    }
  }
  const t0=performance.now();
  S.gen[type]=ls.map(type==='kain'?genKain:genBenang); S.filt[type]='';
  const ms=Math.round(performance.now()-t0);
  renderGen(type);
  let saved=0;
  if($(ID[type].auto).checked&&S.online&&S.canWrite){
    const seen=new Set(), news=[];
    S.gen[type].forEach(r=>{ if(r.status==='baru'){ const k=keyOf(r.nama).k; if(!seen.has(k)){ seen.add(k); news.push({...r,src:'auto'}); } } });
    if(news.length){
      try{ await Data.saveStore(type,news); saved=news.length; S.gen[type].forEach(r=>{ if(r.status==='baru') r.saved=true; }); renderGen(type); }
      catch(e){ toast('Hasil baru belum disimpan: '+writeErr(e),4500); }
    }
  }
  const miss=S.gen[type].filter(r=>r.unk&&r.unk.length&&!r.dirty).length;
  toast(`${S.gen[type].length} baris dalam ${ms} ms`+(saved?` · ${saved} disimpan ke Database`:'')+(miss?` · ${miss} baris perlu tambahan Master`:''),4000);
}
// Setelah Master berubah: jeniskan ulang HANYA baris yang belum dikenali (cepat, tanpa generate ulang semuanya)
let _rjT=null;
function scheduleRejenis(){ clearTimeout(_rjT); _rjT=setTimeout(rejenisUnknown,250); }
async function rejenisUnknown(){
  for(const type of ['kain','benang']){
    const rows=S.gen[type]; if(!rows.length){ renderGen(type); continue; }
    let fixed=0; const news=[], seen=new Set();
    rows.forEach((r,i)=>{
      if(r.dirty||!r.nama||!(r.status==='gagal'||r.status==='cek')) return;
      const n=(type==='kain'?genKain:genBenang)(r.nama);
      if(n.status==='baru'||n.status==='master'){ fixed++; rows[i]=n; const k=keyOf(n.nama).k; if(n.status==='baru'&&!seen.has(k)){ seen.add(k); news.push({...n,src:'auto'}); } }
      else rows[i]={...n,saved:r.saved};
    });
    renderGen(type);
    if(fixed){
      let saved=0;
      if(news.length&&$(ID[type].auto).checked&&S.online&&S.canWrite){
        try{ await Data.saveStore(type,news); saved=news.length; rows.forEach(r=>{ if(r.status==='baru'&&seen.has(keyOf(r.nama).k)) r.saved=true; }); renderGen(type); }
        catch(e){ toast('Hasil baru belum disimpan: '+writeErr(e),4500); continue; }
      }
      toast(`${fixed} baris ${type} sekarang dikenali`+(saved?` · ${saved} disimpan ke Database`:''),3500);
    }
  }
}
const STAT={master:['t-master','Database'],baru:['t-baru','Baru'],gagal:['t-gagal','Tidak dikenali'],cek:['t-cek','Perlu cek'],diubah:['t-manual','Diubah']};
function stOf(type,r){ if(r.status==='kosong') return 'kosong'; if(r.dirty) return rowOk(type,r)?'diubah':'cek'; return r.status; }
function renderMiss(type){
  const box=$(ID[type].miss), cnt=new Map();
  S.gen[type].forEach(r=>{ if(r.dirty||!r.unk) return; r.unk.forEach(u=>cnt.set(u,(cnt.get(u)||0)+1)); });
  if(!cnt.size){ box.hidden=true; box.innerHTML=''; return; }
  const items=[...cnt.entries()].sort((a,b)=>b[1]-a[1]);
  box.hidden=false;
  box.innerHTML=`<div class="mh"><b>${items.length} benang tidak bisa dijeniskan karena belum ada di Master.</b><span class="hint">Tambahkan dulu ke Master (jenis baru, atau sebagai alias jenis yang sudah ada), lalu Generate ulang.</span></div>
    <div class="ml">${items.map(([u,n])=>`<span class="mi">${esc(u)} <b>×${n}</b><button class="btn sm" data-addm="${esc(u)}">+ Master</button></span>`).join('')}</div>`;
}
function renderGen(type){
  const I=ID[type], rows=S.gen[type], w=$(I.wrap), has=rows.length>0;
  $(I.copy).disabled=$(I.xls).disabled=!has;
  const nd=rows.filter(r=>r.dirty).length; $(I.save).disabled=!nd; $(I.save).textContent=nd?`Simpan perubahan (${nd})`:'Simpan perubahan';
  renderMiss(type);
  if(!has){ w.innerHTML=`<div class="empty">Tempel daftar nama ${type} di kiri lalu tekan <b>Generate</b>.</div>`; $(I.chips).innerHTML=''; return; }
  const cnt={master:0,baru:0,gagal:0,cek:0,diubah:0}; const gc={};
  rows.forEach(r=>{const s=stOf(type,r); if(cnt[s]!==undefined) cnt[s]++; if(r.nama) gc[r.g]=(gc[r.g]||0)+1;});
  const f=S.filt[type];
  const chip=(key,label,n)=>`<span class="chip ${f===key?'sel':''}" data-f="${esc(key)}"><b>${n}</b>${label}</span>`;
  $(I.chips).innerHTML=chip('','Semua',rows.filter(r=>r.nama).length)+chip('master','Dari Database',cnt.master)+chip('baru','Baru',cnt.baru)+chip('gagal','Tidak dikenali',cnt.gagal)+(type==='kain'?chip('cek','Perlu cek',cnt.cek):'')+(cnt.diubah?chip('diubah','Diubah',cnt.diubah):'')+GROUPS[type].filter(g=>gc[g]).map(g=>chip('g:'+g,g,gc[g])).join('');
  const body=rows.map((r,i)=>{
    const st=stOf(type,r);
    if(f){ if(f.startsWith('g:')){ if(r.g!==f.slice(2)) return ''; } else if(st!==f) return ''; }
    if(st==='kosong') return `<tr><td class="idx">${i+1}</td><td colspan="12" class="muted">(baris kosong)</td></tr>`;
    const tag=`<span class="tag ${STAT[st][0]}">${STAT[st][1]}</span>`+(r.saved&&!r.dirty?' <span class="muted" title="Sudah tersimpan di Database">✓</span>':'');
    const sel=`<td><select class="g" data-i="${i}" aria-label="Grouping baris ${i+1}">${gOpts(type,r.g)}</select></td>`;
    const note=`<td class="note">${r.dirty?'':esc(r.note||'')}</td>`;
    if(type==='benang'){
      const unk=r.jenis&&!S.jenisSet.has(norm(r.jenis));
      return `<tr class="${r.dirty?'dirty':''}"><td class="idx">${i+1}</td><td class="nm" style="word-break:break-all">${esc(r.nama)}</td><td><input class="b${unk?' unknown':''}" list="dlJenis" data-i="${i}" data-j="0" value="${esc(r.jenis)}" aria-label="Jenis benang baris ${i+1}"${unk?' title="Tidak ada di Master Jenis Benang"':''}></td>${sel}<td>${tag}</td>${note}</tr>`;
    }
    const cells=[0,1,2].map(j=>{const unk=r.b[j]&&!S.jenisSet.has(norm(r.b[j]));return `<td><input class="b${unk?' unknown':''}" list="dlJenis" data-i="${i}" data-j="${j}" value="${esc(r.b[j])}" aria-label="Benang ${j+1} baris ${i+1}"${unk?' title="Tidak ada di Master Jenis Benang"':''}></td><td class="num"><input class="p" type="number" step="0.01" data-i="${i}" data-pj="${j}" value="${r.b[j]?pctIn(r.p[j]):''}" aria-label="Persen ${j+1} baris ${i+1}"></td>`;}).join('');
    const tot=totalOf(r.p);
    return `<tr class="${r.dirty?'dirty':''}"><td class="idx">${i+1}</td><td class="nm">${esc(r.nama)}</td>${cells}<td class="num"${Math.abs(tot-1)<0.0005?'':' style="color:var(--bad)"'}>${fmtPct(tot)}</td>${sel}<td>${tag}</td>${note}</tr>`;
  }).join('');
  const head=type==='kain'?'<th>#</th><th>Nama kain</th><th>Benang 1</th><th class="num">%</th><th>Benang 2</th><th class="num">%</th><th>Benang 3</th><th class="num">%</th><th class="num">Total</th><th>Grouping</th><th>Status</th><th>Notes</th>':'<th>#</th><th>Nama benang</th><th>Jenis benang</th><th>Grouping</th><th>Status</th><th>Notes</th>';
  w.innerHTML=`<table><thead><tr>${head}</tr></thead><tbody>${body||'<tr><td colspan="12" class="empty">Tidak ada baris dengan filter ini.</td></tr>'}</tbody></table>`;
}
for(const type of ['kain','benang']){
  const I=ID[type];
  $(I.chips).addEventListener('click',e=>{const c=e.target.closest('.chip'); if(!c) return; S.filt[type]=c.dataset.f; renderGen(type);});
  $(I.miss).addEventListener('click',e=>{
    const b=e.target.closest('[data-addm]'); if(!b) return; const seg=b.dataset.addm;
    const src=[...new Set(S.gen[type].filter(r=>!r.dirty&&r.unk&&r.unk.includes(seg)).map(r=>r.nama))];
    openM(null,{nama:'',alias:saranAlias(seg),seg,src,type});
  });
  $(I.wrap).addEventListener('change',e=>{
    const t=e.target, r=S.gen[type][+t.dataset.i]; if(!r) return;
    if(t.classList.contains('g')){ r.g=t.value; r.gm=true; }
    else if(t.classList.contains('b')){
      if(type==='benang') r.jenis=t.value.trim();
      else { r.b[+t.dataset.j]=t.value.trim(); const bb=r.b.filter(x=>x); while(bb.length<3) bb.push(''); r.b=bb; r.p=hitungPersen(r.b,S.fixMap)||[0,0,0]; }
    } else if(t.classList.contains('p')) r.p[+t.dataset.pj]=(parseFloat(t.value)||0)/100;
    r.dirty=true; renderGen(type);
  });
  $(I.gen).onclick=()=>doGenerate(type);
  $(I.clr).onclick=()=>{ $(I.inp).value=''; S.gen[type]=[]; renderGen(type); };
  $(I.save).onclick=async()=>{
    const d=S.gen[type].filter(r=>r.dirty), bad=d.filter(r=>!rowOk(type,r));
    if(bad.length&&!await confirmDlg('Ada baris belum lengkap',`<p>${bad.length} baris ${type==='kain'?'totalnya belum 100% atau tanpa benang':'belum punya jenis benang'} dan tidak akan disimpan.</p>`,'Simpan sisanya')) return;
    const map=new Map(); d.filter(r=>rowOk(type,r)).forEach(r=>map.set(keyOf(r.nama).k,{...r,src:'manual',gm:true}));
    if(!map.size) return;
    try{
      await Data.saveStore(type,[...map.values()]);
      S.gen[type].forEach(r=>{ const e=r.nama&&map.get(keyOf(r.nama).k); if(e) Object.assign(r,{b:e.b&&[...e.b],p:e.p&&[...e.p],jenis:e.jenis,g:e.g,dirty:false,status:'master',saved:true,note:'',unk:[]}); });
      renderGen(type); toast(`${map.size} ${type} disimpan ke Database sebagai manual`);
    }catch(e){ toast(writeErr(e),4500); }
  };
  $(I.copy).onclick=async()=>{
    const txt=S.gen[type].map(r=>!r.nama?'':(type==='kain'?[r.nama,r.b[0],r.b[0]?fmtPct(r.p[0]):'',r.b[1],r.b[1]?fmtPct(r.p[1]):'',r.b[2],r.b[2]?fmtPct(r.p[2]):'',r.b.filter(x=>x).length,r.g,r.note||'']:[r.nama,r.jenis,r.g,r.note||'']).join('\t')).join('\n');
    try{ await navigator.clipboard.writeText(txt); toast(type==='kain'?'Disalin: Nama | Benang 1 | % | Benang 2 | % | Benang 3 | % | Jml | Grouping | Notes':'Disalin: Nama benang | Jenis | Grouping | Notes'); }
    catch(e){ toast('Browser menolak menyalin. Gunakan Unduh Excel.'); }
  };
  $(I.xls).onclick=()=>saveXlsx(`Hasil_Penjenisan_${type==='kain'?'Kain':'Benang'}_${stamp()}.xlsx`,[[type==='kain'?'Penjenisan Kain':'Penjenisan Benang',genAoa(type),type==='kain'?[2,4,6]:null]]);
  $(I.file).onchange=async e=>{
    const f=e.target.files[0]; e.target.value=''; if(!f) return;
    try{
      const wb=await readWb(f);
      const sn=findSheet(wb,type==='kain'?'PENJENISAN':'BENANG')||wb.SheetNames[0];
      const aoa=sheetAoa(wb,sn)||[];
      const h=aoa.findIndex(r=>/^NAMA (JENIS )?(KAIN|BENANG)/.test(norm(r[0])));
      const names=aoa.slice(h>=0?h+1:0).map(r=>String(r[0]??'').trim());
      while(names.length&&!names[names.length-1]) names.pop();
      $(I.inp).value=names.join('\n'); toast(`${names.filter(x=>x).length} nama diambil dari sheet "${sn}". Tekan Generate.`);
    }catch(err){ toast('File tidak bisa dibaca: '+(err.message||err)); }
  };
}
function genAoa(type){
  if(type==='kain') return [['Nama Jenis Kain','Benang 1','%','Benang 2','%','Benang 3','%','Total Benang','Grouping','Notes'],...S.gen.kain.map(r=>r.nama?[r.nama,r.b[0],r.b[0]?r.p[0]:'',r.b[1],r.b[1]?r.p[1]:'',r.b[2],r.b[2]?r.p[2]:'',r.b.filter(x=>x).length,r.g,r.dirty?'':(r.note||'')]:[])];
  return [['Nama Benang','Jenis Benang','Grouping','Notes'],...S.gen.benang.map(r=>r.nama?[r.nama,r.jenis,r.g,r.dirty?'':(r.note||'')]:[])];
}

/* ================= EXCEL I/O ================= */
async function saveXlsx(filename,sheets){
  if(typeof XLSX==='undefined'){ toast('Library Excel gagal dimuat.'); return; }
  const wb=XLSX.utils.book_new();
  for(const [name,aoa,pctCols] of sheets){
    const ws=XLSX.utils.aoa_to_sheet(aoa);
    if(pctCols) for(let r=1;r<aoa.length;r++) for(const c of pctCols){ const ref=XLSX.utils.encode_cell({r,c}); if(ws[ref]&&typeof ws[ref].v==='number') ws[ref].z='0.##%'; }
    ws['!cols']=(aoa[0]||[]).map((_,i)=>({wch:i===0?44:16}));
    XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));
  }
  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  try{ await Data.download(filename,new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})); }
  catch(e){ if(e&&e.code!=='declined') toast('Unduhan gagal'+(e&&e.code?' ('+e.code+')':'')+'.'); }
}
function readWb(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{try{res(XLSX.read(new Uint8Array(fr.result),{type:'array'}));}catch(e){rej(e);}};fr.onerror=rej;fr.readAsArrayBuffer(file);});}
function sheetAoa(wb,name){const ws=wb.Sheets[name];return ws?XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true}):null;}
function findSheet(wb,want){return wb.SheetNames.find(n=>n.trim().toUpperCase()===want)||null;}
const pctVal=(x)=>{ if(typeof x==='number') return x>1?x/100:x; const s=String(x??'').trim(); if(!s) return 0; const v=parseFloat(s.replace(',','.')); if(isNaN(v)) return 0; return s.includes('%')||v>1?v/100:v; };
const normG=(type,g)=>{ const s=norm(g).replace(/^(BENANG|KAIN)\s+/,''); return GROUPS[type].find(x=>norm(x)===s)||''; };

/* ================= DATABASE TAB ================= */
function renderDb(){
  const type=S.dbView, st=S.store[type], all=[...st.map.values()];
  document.querySelectorAll('#dbSeg button').forEach(b=>b.classList.toggle('act',b.dataset.v===type));
  const fg=$('fGrp');
  if(fg.dataset.t!==type){ fg.innerHTML='<option value="">Semua grouping</option>'+GROUPS[type].map(g=>`<option>${g}</option>`).join(''); fg.dataset.t=type; }
  const c={manual:0}, gc={}; all.forEach(e=>{ if(e.src==='manual') c.manual++; gc[e.g||'—']=(gc[e.g||'—']||0)+1; });
  $('dbTiles').innerHTML=`<div class="tile"><div class="v">${all.length}</div><div class="l">${type==='kain'?'Kain':'Benang'} tersimpan</div></div>`+GROUPS[type].map(g=>`<div class="tile"><div class="v">${gc[g]||0}</div><div class="l">${type==='kain'?'Kain':'Benang'} ${g}</div></div>`).join('')+`<div class="tile"><div class="v">${c.manual}</div><div class="l">Dikoreksi manual</div></div>`;
  const list=dbFiltered();
  const total=list.length, shown=list.slice(0,500);
  const sel=S.sel[type]; for(const k of [...sel]) if(!st.map.has(k)) sel.delete(k);
  const nSel=sel.size, nSelVis=list.filter(e=>sel.has(e.k)).length;
  $('delDb').disabled=!nSel; $('delDb').textContent=nSel?`Hapus terpilih (${nSel})`:'Hapus terpilih';
  $('selInfo').innerHTML=nSel?`${nSel} dipilih${nSel>nSelVis?` (${nSel-nSelVis} di luar filter)`:''} · <button type="button" id="selClear">Batal pilih</button>`:'';
  $('dbInfo').textContent=total>500?`Menampilkan 500 dari ${total}, persempit pencarian`:`${total} baris`;
  if(!all.length){ $('wrapDb').innerHTML=`<div class="empty">${S.online?(st.ready?`Database ${type} masih kosong. Hasil Generate dan impor akan masuk ke sini.`:'Memuat…'):'Database tidak tersedia.'}</div>`; return; }
  const srcTag={manual:'<span class="tag t-manual">Manual</span>',auto:'<span class="tag t-auto">Otomatis</span>',import:'<span class="tag t-import">Impor</span>'};
  const when=e=>{ const who=Data.whoName(e); return `<td class="muted" style="font-size:12px;white-space:nowrap">${fmtDate(e.at)}${who?' · '+esc(who):''}</td>`; };
  const allOn=total>0&&nSelVis===total, someOn=nSelVis>0&&!allOn;
  const ck=`<th class="ck"><input type="checkbox" id="selAll" ${allOn?'checked':''} title="Pilih semua ${total} baris hasil pencarian/filter" aria-label="Pilih semua"></th>`;
  const head=ck+(type==='kain'?'<th>Nama kain</th><th>Benang 1</th><th class="num">%</th><th>Benang 2</th><th class="num">%</th><th>Benang 3</th><th class="num">%</th><th>Grouping</th><th>Sumber</th><th>Diubah</th><th></th>':'<th>Nama benang</th><th>Jenis benang</th><th>Grouping</th><th>Sumber</th><th>Diubah</th><th></th>');
  $('wrapDb').innerHTML=`<table><thead><tr>${head}</tr></thead><tbody>${shown.map(e=>`<tr class="${sel.has(e.k)?'picked':''}"><td class="ck"><input type="checkbox" class="sel" data-k="${e.k}" ${sel.has(e.k)?'checked':''} aria-label="Pilih ${esc(e.nama)}"></td><td class="nm"${type==='benang'?' style="word-break:break-all"':''}>${esc(e.nama)}</td>${type==='kain'?[0,1,2].map(j=>`<td>${esc(e.b[j])}</td><td class="num">${e.b[j]?fmtPct(e.p[j]):''}</td>`).join(''):`<td>${esc(e.jenis)}</td>`}<td>${gTag(e.g)}</td><td>${srcTag[e.src]||esc(e.src)}</td>${when(e)}<td><button class="btn sm" data-edit="${e.k}">Ubah</button></td></tr>`).join('')}</tbody></table>`;
  const sa=$('selAll'); if(sa) sa.indeterminate=someOn;
}
function dbFiltered(){
  const type=S.dbView, all=[...S.store[type].map.values()];
  const q=norm($('qDb').value), fs=$('fSrc').value, fgv=$('fGrp').value;
  return all.filter(e=>(!fs||e.src===fs)&&(!fgv||e.g===fgv)&&(!q||e.nama.includes(q)||(type==='kain'?e.b.some(x=>norm(x).includes(q)):norm(e.jenis).includes(q)))).sort((a,b)=>a.nama.localeCompare(b.nama));
}
$('wrapDb').addEventListener('change',e=>{
  const sel=S.sel[S.dbView];
  if(e.target.id==='selAll'){ const list=dbFiltered(); if(e.target.checked) list.forEach(x=>sel.add(x.k)); else list.forEach(x=>sel.delete(x.k)); renderDb(); return; }
  if(e.target.classList.contains('sel')){ if(e.target.checked) sel.add(e.target.dataset.k); else sel.delete(e.target.dataset.k); renderDb(); }
});
$('selInfo').addEventListener('click',e=>{ if(e.target.id==='selClear'){ S.sel[S.dbView].clear(); renderDb(); } });
$('delDb').onclick=async()=>{
  if(!needDb()) return;
  const type=S.dbView, sel=S.sel[type], map=S.store[type].map;
  const list=[...sel].map(k=>map.get(k)).filter(Boolean).sort((a,b)=>a.nama.localeCompare(b.nama));
  if(!list.length) return;
  const contoh=list.slice(0,6).map(e=>`<li class="mono" style="word-break:break-all">${esc(e.nama)}</li>`).join('')+(list.length>6?`<li>… dan ${list.length-6} lainnya</li>`:'');
  if(!await confirmDlg(`Hapus ${list.length} ${type} dari Database`,`<p>Baris yang dicentang akan dihapus:</p><ul style="margin:0;padding-left:18px;font-size:12.5px">${contoh}</ul><p class="hint">Tidak bisa dibatalkan. Generate berikutnya akan menjeniskan ulang nama-nama ini.</p>`,`Hapus ${list.length}`)) return;
  try{ await Data.deleteStoreMany(type,list.map(e=>e.nama)); sel.clear(); renderDb(); toast(`${list.length} ${type} dihapus dari Database`); }catch(e){ toast(writeErr(e),4500); }
};
$('dbSeg').onclick=e=>{const b=e.target.closest('button'); if(!b) return; S.dbView=b.dataset.v; renderDb();};
$('qDb').oninput=renderDb; $('fSrc').onchange=renderDb; $('fGrp').onchange=renderDb;
let cur=null;
$('wrapDb').addEventListener('click',e=>{
  const b=e.target.closest('[data-edit]'); if(!b) return;
  cur=S.store[S.dbView].map.get(b.dataset.edit); if(!cur) return;
  if(S.dbView==='kain'){ $('dkNama').textContent=cur.nama; dkFill(cur.b,cur.p); $('dkG').value=cur.g||groupKain(cur.nama,S.rule); $('dlgK').showModal(); }
  else { $('dbNama').textContent=cur.nama; $('dbJenis').value=cur.jenis||''; $('dbG').value=cur.g||groupBenang(cur.nama,S.rule); $('dlgB').showModal(); }
});
function dkRead(){return {b:[1,2,3].map(i=>$('dkB'+i).value.trim()),p:[1,2,3].map(i=>(parseFloat($('dkP'+i).value)||0)/100)};}
function dkFill(b,p){[0,1,2].forEach(i=>{$('dkB'+(i+1)).value=b[i]||'';$('dkP'+(i+1)).value=b[i]?pctIn(p[i]):'';}); dkTot();}
function dkTot(){const t=totalOf(dkRead().p);$('dkTot').innerHTML=`Total: <b style="color:${Math.abs(t-1)<0.0005?'var(--ok)':'var(--bad)'}">${fmtPct(t)}</b>`;}
['dkP1','dkP2','dkP3'].forEach(id=>$(id).oninput=dkTot);
['dkB1','dkB2','dkB3'].forEach(id=>$(id).onchange=()=>{const {b}=dkRead();dkFill(b,hitungPersen(b,S.fixMap)||[0,0,0]);});
$('dkAuto').onclick=()=>{const {b}=dkRead();dkFill(b,hitungPersen(b,S.fixMap)||[0,0,0]);};
$('dkRule').onclick=()=>{const r=S.master?extractKain(cur.nama,S.master):{yarns:[],unknown:[]};const y=r.yarns;const b=[y[0]||'',y[1]||'',y[2]||''];dkFill(b,hitungPersen(b,S.fixMap)||[0,0,0]);$('dkG').value=groupKain(cur.nama,S.rule);if(r.unknown.length) toast('Belum ada di master: '+r.unknown.join(', '),4500); else if(!y.length) toast('Aturan tidak mengenali benang apa pun untuk nama ini.');};
$('dkNo').onclick=()=>$('dlgK').close();
$('dkOk').onclick=async()=>{
  const {b,p}=dkRead(); const bb=[],pp=[]; b.forEach((x,i)=>{if(x){bb.push(x);pp.push(p[i]);}}); while(bb.length<3){bb.push('');pp.push(0);}
  if(!okKain(bb,pp)){ toast('Total harus 100% dan minimal satu benang.'); return; }
  try{ await Data.saveStore('kain',[{nama:cur.nama,b:bb,p:pp,g:$('dkG').value,gm:true,src:'manual'}]); $('dlgK').close(); toast('Tersimpan sebagai manual'); }catch(e){ toast(writeErr(e),4500); }
};
$('dbRule').onclick=()=>{ const r=S.master?jenisBenangX(cur.nama,S.master):{jenis:''}; $('dbJenis').value=r.jenis; $('dbG').value=groupBenang(cur.nama,S.rule); if(!r.jenis) toast(r.note||'Aturan tidak mengenali jenis benang ini.',4500); };
$('dbNo').onclick=()=>$('dlgB').close();
$('dbOk').onclick=async()=>{
  const j=$('dbJenis').value.trim(); if(!j){ toast('Jenis benang wajib diisi.'); return; }
  try{ await Data.saveStore('benang',[{nama:cur.nama,jenis:j,g:$('dbG').value,gm:true,src:'manual'}]); $('dlgB').close(); toast('Tersimpan sebagai manual'); }catch(e){ toast(writeErr(e),4500); }
};
async function delCur(type,dlg){
  $(dlg).close();
  if(!await confirmDlg('Hapus dari Database',`<p>Hapus <b>${esc(cur.nama)}</b>? Generate berikutnya akan menjeniskan ulang nama ini dengan aturan.</p>`,'Hapus')) return;
  try{ await Data.deleteStore(type,cur.nama); toast('Dihapus dari Database'); }catch(e){ toast(writeErr(e),4500); }
}
$('dkDel').onclick=()=>delCur('kain','dlgK'); $('dbDel').onclick=()=>delCur('benang','dlgB');
function dbAoa(type){
  const list=[...S.store[type].map.values()].sort((a,b)=>a.nama.localeCompare(b.nama));
  const d=e=>e.at?new Date(e.at).toISOString().slice(0,10):'';
  if(type==='kain') return [['Nama Kain','Benang 1','%','Benang 2','%','Benang 3','%','Total Benang','Grouping','Sumber','Diubah'],...list.map(e=>[e.nama,e.b[0],e.b[0]?e.p[0]:'',e.b[1],e.b[1]?e.p[1]:'',e.b[2],e.b[2]?e.p[2]:'',e.b.filter(x=>x).length,e.g,e.src,d(e)])];
  return [['Nama Benang','Jenis Benang','Grouping','Sumber','Diubah'],...list.map(e=>[e.nama,e.jenis,e.g,e.src,d(e)])];
}
const expDb=type=>saveXlsx(`Database_${type==='kain'?'Kain':'Benang'}_${stamp()}.xlsx`,[[`DATABASE ${type.toUpperCase()}`,dbAoa(type),type==='kain'?[2,4,6]:null]]);
$('expDb').onclick=()=>expDb(S.dbView); $('expK2').onclick=()=>expDb('kain'); $('expB2').onclick=()=>expDb('benang');

/* ================= MASTER TAB ================= */
function renderMaster(){
  const q=norm($('qM').value);
  const list=S.mList.filter(b=>!q||norm(b.nama).includes(q)||norm(b.alias).includes(q));
  $('mInfo').textContent=`${list.length} jenis`;
  if(!S.mList.length){ $('wrapM').innerHTML=`<div class="empty">${S.online?(S.mReady?'Master masih kosong. Impor dari file Apps Penjenisan di tab Impor &amp; Ekspor.':'Memuat…'):'Database tidak tersedia.'}</div>`; return; }
  const tg=t=>t?`<span class="tag ${norm(t)==='SAMPLE'?'t-import':'t-cek'}">${esc(t)}</span>`:'';
  $('wrapM').innerHTML=`<table><thead><tr><th>Nama jenis benang</th><th>Alias</th><th>Tambahan</th><th class="num">% tetap</th><th></th></tr></thead><tbody>${list.map(b=>`<tr><td class="nm">${esc(b.nama)}</td><td class="mono" style="font-size:12.5px">${esc(b.alias)}</td><td>${tg(b.t1)} ${tg(b.t2)}</td><td class="num">${hasFix(b)?fmtPct(b.fix):''}</td><td><button class="btn sm" data-m="${esc(b.id)}">Ubah</button></td></tr>`).join('')}</tbody></table>`;
}
$('qM').oninput=renderMaster;
let mCur=null, mPre=null;
const dmMode=()=>(!$('dmModeBox').hidden&&$('dmModeDb').checked)?'db':'alias';
function dmApplyMode(){ $('dmAliasBox').style.display=dmMode()==='db'?'none':'grid'; dmHint(); }
function dmHint(){
  if(mCur){ $('dmHint').textContent=''; return; }
  const ex=S.mList.find(b=>norm(b.nama)===norm($('dmNama').value));
  if(dmMode()==='db'){
    const n=(mPre&&mPre.src||[]).length, typed=$('dmNama').value.trim();
    $('dmAliasBox').style.display=(ex||!typed)?'none':'grid';
    $('dmHint').textContent=ex?`${n} benang di atas akan disimpan ke Database sebagai "${ex.nama}". Master tidak berubah.`:(typed?'Jenis ini belum ada di Master, jadi akan dibuat sebagai jenis baru di Master dengan alias di bawah.':'Pilih jenis yang sudah ada di Master (ketik lalu pilih dari daftar), atau ketik nama jenis baru.');
    return;
  }
  $('dmHint').textContent=ex?`"${ex.nama}" sudah ada di Master: alias akan ditambahkan ke jenis itu (alias sekarang: ${ex.alias||'-'}).`:'Ketik nama jenis baru, atau pilih jenis yang sudah ada untuk menambah alias.';
}
function openM(b,pre){
  mCur=b; $('dmTitle').textContent=b?'Ubah jenis benang':(pre&&pre.seg?`Tambah ke Master: ${pre.seg}`:'Tambah jenis benang');
  $('dmNama').value=b?b.nama:(pre&&pre.nama||''); $('dmAlias').value=b?b.alias||'':(pre&&pre.alias||'');
  $('dmT1').value=b?b.t1||'':''; $('dmT2').value=b?b.t2||'':'';
  $('dmFix').value=b&&hasFix(b)?pctIn(b.fix):''; $('dmDel').style.display=b?'':'none';
  mPre=pre||null;
  const src=pre&&pre.src||[];
  $('dmSrcBox').hidden=!src.length;
  $('dmModeBox').hidden=!(src.length&&pre.type==='benang'&&!b);
  $('dmModeDb').checked=true; $('dmModeAlias').checked=false;
  $('dmAliasBox').style.display=$('dmModeBox').hidden?'grid':'none';
  if(src.length){
    $('dmSrcLbl').textContent=`Nama ${pre.type||''} asli yang memunculkan "${pre.seg}" (${src.length})`;
    const words=String(pre.seg).split(/\s+/).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const re=new RegExp(words.join('[\\s,.;-]*'),'i');
    $('dmSrc').innerHTML=src.map(n=>{ const m=n.match(re); return `<div><span>${m?esc(n.slice(0,m.index))+'<mark>'+esc(m[0])+'</mark>'+esc(n.slice(m.index+m[0].length)):esc(n)}</span></div>`; }).join('');
  }
  dmHint(); $('dlgM').showModal(); $('dmNama').focus();
}
$('dmNama').oninput=dmHint; $('dmModeDb').onchange=dmApplyMode; $('dmModeAlias').onchange=dmApplyMode;
$('wrapM').addEventListener('click',e=>{const t=e.target.closest('[data-m]'); if(t) openM(S.mList.find(b=>b.id===t.dataset.m));});
$('addM').onclick=()=>openM(null); $('dmNo').onclick=()=>$('dlgM').close();
$('dmOk').onclick=async()=>{
  const nama=$('dmNama').value.replace(/\s+/g,' ').trim(); if(!nama){ toast('Nama wajib diisi.'); return; }
  if(!needDb()) return;
  if(dmMode()==='db'){
    const ex=S.mList.find(b=>norm(b.nama)===norm(nama));
    if(ex){
    const names=mPre.src||[];
    try{
      await Data.saveStore('benang',names.map(n=>({nama:n,jenis:ex.nama,g:groupBenang(n,S.rule),gm:false,src:'manual'})));
      const set=new Set(names.map(n=>keyOf(n).k));
      S.gen.benang.forEach(r=>{ if(r.nama&&set.has(keyOf(r.nama).k)) Object.assign(r,{jenis:ex.nama,status:'master',saved:true,dirty:false,note:'',unk:[]}); });
      renderGen('benang'); $('dlgM').close();
      toast(`${names.length} benang disimpan ke Database sebagai ${ex.nama}. Master tidak berubah.`,4000);
    }catch(e){ toast(writeErr(e),4500); }
    return;
    }
    // jenis baru: lanjut ke pembuatan jenis baru di Master di bawah
  }
  const aliasIn=$('dmAlias').value.split(';').map(s=>s.trim()).filter(Boolean);
  const fx=$('dmFix').value.trim();
  try{
    const ex=!mCur&&S.mList.find(b=>norm(b.nama)===norm(nama));
    if(ex){
      const have=String(ex.alias||'').split(';').map(s=>s.trim()).filter(Boolean);
      const add=aliasIn.filter(a=>!have.some(h=>norm(h)===norm(a)));
      if(!add.length){ toast('Alias itu sudah ada di '+ex.nama); return; }
      await Data.saveMasterItem(ex.id,{...ex,alias:[...have,...add].join('; ')});
      $('dlgM').close(); toast(`Alias ${add.join(', ')} ditambahkan ke ${ex.nama}. Generate ulang untuk memakainya.`,4000); return;
    }
    const data={nama,alias:aliasIn.join('; '),t1:$('dmT1').value.trim().toUpperCase(),t2:$('dmT2').value.trim().toUpperCase(),fix:fx===''?null:(parseFloat(fx)||0)/100};
    if(mCur) data.ord=mCur.ord; else data.ord=Math.max(0,...S.mList.map(b=>b.ord||0))+1;
    await Data.saveMasterItem(mCur?mCur.id:null,data);
    $('dlgM').close(); toast(mCur?'Master tersimpan':'Jenis baru ditambahkan ke Master. Generate ulang untuk memakainya.',4000);
  }catch(e){ toast(writeErr(e),4500); }
};
$('dmDel').onclick=async()=>{
  $('dlgM').close();
  if(!await confirmDlg('Hapus jenis benang',`<p>Hapus <b>${esc(mCur.nama)}</b>? Aliasnya tidak dikenali lagi saat generate. Data di Database tidak berubah.</p>`,'Hapus')) return;
  try{ await Data.deleteMasterItem(mCur.id); toast('Dihapus'); }catch(e){ toast(writeErr(e),4500); }
};
$('saveRule').onclick=async()=>{
  if(!needDb()) return;
  const r={warna:lines($('rWarna').value).map(norm),matang:lines($('rMatang').value).map(norm),kurung:$('rKurung').checked,dwPola:$('rDwPola').checked};
  try{ await Data.saveRule(r); toast('Aturan grouping disimpan'); }catch(e){ toast(writeErr(e),4500); }
};
function renderList(key,lst,cnt){
  const a=S.rule[key]||[];
  $(cnt).textContent=`(${a.length})`;
  $(lst).innerHTML=a.length?a.map((x,i)=>`<div><span>${esc(x)}</span><button type="button" data-i="${i}" title="Hapus dari daftar" aria-label="Hapus ${esc(x)}">×</button></div>`).join(''):'<div class="none">Belum ada daftar</div>';
}
for(const [key,ta,btn,lst,label] of [['eksternal','addEks','btnAddEks','lstEks','Eksternal'],['doubleWinder','addDw','btnAddDw','lstDw','Double Winder']]){
  $(btn).onclick=async()=>{
    if(!needDb()) return;
    const curL=S.rule[key]||[], have=new Set(curL.map(norm));
    const add=lines($(ta).value).map(x=>x.replace(/\s+/g,' ').trim()).filter(x=>{const n=norm(x); if(have.has(n)) return false; have.add(n); return true;});
    if(!add.length){ toast('Tidak ada nama baru untuk ditambahkan.'); return; }
    try{ await Data.saveRule({[key]:[...curL,...add]}); $(ta).value=''; toast(`${add.length} benang ditambahkan ke daftar ${label}. Klik "Terapkan ke Database" untuk memperbarui data lama.`,4500); }catch(e){ toast(writeErr(e),4500); }
  };
  $(lst).addEventListener('click',async e=>{
    const b=e.target.closest('button[data-i]'); if(!b) return;
    const arr=[...(S.rule[key]||[])]; const nm=arr[+b.dataset.i];
    if(!await confirmDlg('Hapus dari daftar',`<p>Hapus dari daftar ${label}?</p><p class="mono" style="word-break:break-all">${esc(nm)}</p>`,'Hapus')) return;
    arr.splice(+b.dataset.i,1);
    try{ await Data.saveRule({[key]:arr}); toast('Dihapus dari daftar '+label); }catch(e2){ toast(writeErr(e2),4500); }
  });
}
$('applyRule').onclick=async()=>{
  const ch={kain:[],benang:[]};
  for(const type of ['kain','benang']) for(const e of S.store[type].map.values()){
    if(e.gm||e.src==='manual') continue;
    const g=type==='kain'?groupKain(e.nama,S.rule):groupBenang(e.nama,S.rule);
    if(g!==e.g) ch[type].push({...e,g});
  }
  const n=ch.kain.length+ch.benang.length;
  if(!n){ toast('Semua grouping di Database sudah sesuai aturan.'); return; }
  if(!await confirmDlg('Terapkan aturan grouping',`<p>Grouping akan diubah untuk <b>${ch.benang.length}</b> benang dan <b>${ch.kain.length}</b> kain hasil otomatis/impor. Baris manual tidak disentuh. Pastikan aturan sudah disimpan.</p>`,'Terapkan')) return;
  try{ for(const type of ['kain','benang']) if(ch[type].length) await Data.saveStore(type,ch[type]); toast(`${n} grouping diperbarui`); }catch(e){ toast(writeErr(e),4500); }
};
$('expM2').onclick=()=>saveXlsx(`Master_Jenis_Benang_${stamp()}.xlsx`,[['MASTER JENIS',[['MASTER'],['NAMA BENANG','ALIAS','TAMBAHAN','TAMBAHAN','% TETAP'],...S.mList.map(b=>[b.nama,b.alias||'',b.t1||'',b.t2||'',hasFix(b)?+b.fix:''])],null]]);

/* ================= IMPOR ================= */
let OLD=null;
$('fileOld').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  $('oldName').textContent=f.name; $('oldPrev').innerHTML='<p class="hint">Membaca file…</p>';
  try{
    const wb=await readWb(f); const res={m:[],k:[]};
    const snM=findSheet(wb,'MASTER JENIS');
    if(snM){ const aoa=sheetAoa(wb,snM); const h=aoa.findIndex(r=>norm(r[0])==='NAMA BENANG');
      aoa.slice(h>=0?h+1:2).forEach((r,i)=>{ const nama=String(r[0]??'').replace(/\s+/g,' ').trim(); if(nama) res.m.push({nama,alias:String(r[1]??'').trim(),t1:norm(r[2]),t2:norm(r[3]),ord:i+1}); }); }
    const fix={...FIX_MAKRO}; const snS=findSheet(wb,'SPANDEX');
    if(snS) sheetAoa(wb,snS).slice(1).forEach(r=>{ const n=norm(r[0]); const v=parseFloat(r[1]); if(n&&!isNaN(v)) fix[n]=v>1?v/100:v; });
    res.m.forEach(b=>{ const v=fix[norm(b.nama)]; b.fix=v===undefined?null:v; });
    const snP=findSheet(wb,'PENJENISAN');
    if(snP){ const aoa=sheetAoa(wb,snP); const h=aoa.findIndex(r=>norm(r[0])==='NAMA JENIS KAIN'); const map=new Map();
      aoa.slice(h>=0?h+1:3).forEach(r=>{ const nama=String(r[0]??'').trim(); if(!nama) return; const b=[r[1],r[3],r[5]].map(x=>String(x??'').trim()); if(!b.some(x=>x)) return; const p=[r[2],r[4],r[6]].map((x,i)=>b[i]?pctVal(x):0); map.set(keyOf(nama).k,{nama,b,p,g:groupKain(nama,S.rule),src:'import'}); });
      res.k=[...map.values()]; }
    OLD=res;
    const kOk=res.k.filter(j=>okKain(j.b,j.p));
    $('oldPrev').innerHTML=`<div class="prev"><b>${res.m.length}</b> jenis benang dari MASTER JENIS${snM?'':' <span style="color:var(--bad)">(sheet tidak ditemukan)</span>'} · % tetap untuk <b>${res.m.filter(b=>b.fix!==null).length}</b> spandex</div>
      <div class="row"><button class="btn pri" id="impM" ${res.m.length?'':'disabled'}>Ganti Master Jenis Benang (${res.m.length})</button></div>
      <div class="prev"><b>${res.k.length}</b> kain dari sheet Penjenisan${snP?'':' <span style="color:var(--bad)">(sheet tidak ditemukan)</span>'}${res.k.length-kOk.length?` · <span style="color:var(--warn)">${res.k.length-kOk.length} totalnya bukan 100%, dilewati</span>`:''}</div>
      <div class="row"><button class="btn pri" id="impK" ${kOk.length?'':'disabled'}>Simpan ${kOk.length} kain ke Database</button></div>`;
    $('impM').onclick=async()=>{
      if(!needDb()) return; if(!S.mReady){ toast('Master belum selesai dimuat.'); return; }
      if(S.mList.length&&!await confirmDlg('Ganti Master Jenis Benang',`<p>Master sekarang berisi <b>${S.mList.length}</b> jenis dan akan diganti seluruhnya dengan <b>${OLD.m.length}</b> dari file.</p>`,'Ganti')) return;
      try{ await Data.replaceMaster(OLD.m); toast(`${OLD.m.length} jenis benang diimpor`); $('impM').disabled=true; }catch(e){ toast(writeErr(e),4500); }
    };
    $('impK').onclick=async()=>{ try{ await Data.saveStore('kain',kOk); toast(`${kOk.length} kain disimpan ke Database`); $('impK').disabled=true; }catch(e){ toast(writeErr(e),4500); } };
  }catch(err){ $('oldPrev').innerHTML=`<div class="banner err">File tidak bisa dibaca: ${esc(err.message||err)}</div>`; }
};
async function impDb(type,file){
  $('dbPrev').innerHTML='<p class="hint">Membaca file…</p>';
  try{
    const wb=await readWb(file);
    const sn=wb.SheetNames.find(n=>norm(n).includes(type.toUpperCase()))||wb.SheetNames[0];
    const aoa=sheetAoa(wb,sn)||[];
    const h=aoa.findIndex(r=>/^NAMA/.test(norm(r[0])));
    const head=h>=0?aoa[h].map(norm):[];
    const gi=head.findIndex(x=>x.includes('GROUP'));
    const map=new Map();
    aoa.slice(h>=0?h+1:0).forEach(r=>{
      const nama=String(r[0]??'').trim(); if(!nama) return;
      const g=gi>=0?normG(type,r[gi]):'';
      if(type==='benang'){ const jenis=String(r[1]??'').trim(); if(!jenis) return; map.set(keyOf(nama).k,{nama,jenis,g:g||groupBenang(nama,S.rule),gm:!!g,src:'import'}); }
      else { const b=[r[1],r[3],r[5]].map(x=>String(x??'').trim()); if(!b.some(x=>x)) return; const p=[r[2],r[4],r[6]].map((x,i)=>b[i]?pctVal(x):0); map.set(keyOf(nama).k,{nama,b,p,g:g||groupKain(nama,S.rule),gm:!!g,src:'import'}); }
    });
    const all=[...map.values()], ok=all.filter(e=>rowOk(type,e));
    const exist=ok.filter(e=>S.store[type].map.has(keyOf(e.nama).k)).length;
    $('dbPrev').innerHTML=`<div class="prev">Sheet "<b>${esc(sn)}</b>": <b>${ok.length}</b> ${type} siap diimpor${exist?` (${exist} sudah ada, akan ditimpa)`:''}${all.length-ok.length?` · <span style="color:var(--warn)">${all.length-ok.length} tidak lengkap, dilewati</span>`:''}${gi<0?' · kolom Grouping tidak ada, diisi dari aturan':''}</div><div class="row"><button class="btn pri" id="impDbGo" ${ok.length?'':'disabled'}>Simpan ${ok.length} ${type} ke Database</button></div>`;
    $('impDbGo').onclick=async()=>{ try{ await Data.saveStore(type,ok); toast(`${ok.length} ${type} disimpan ke Database`); $('impDbGo').disabled=true; }catch(e){ toast(writeErr(e),4500); } };
  }catch(err){ $('dbPrev').innerHTML=`<div class="banner err">File tidak bisa dibaca: ${esc(err.message||err)}</div>`; }
}
$('fileDbB').onchange=e=>{const f=e.target.files[0]; e.target.value=''; if(f) impDb('benang',f);};
$('fileDbK').onchange=e=>{const f=e.target.files[0]; e.target.value=''; if(f) impDb('kain',f);};

/* ================= TABS & START ================= */
const TABS=['kain','benang','database','master','impor'];
function route(){
  const t=TABS.includes(location.hash.slice(1))?location.hash.slice(1):'kain';
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('act',p.id==='p-'+t));
  document.querySelectorAll('#tabs a').forEach(a=>a.classList.toggle('act',a.dataset.tab===t));
}
window.addEventListener('hashchange',route);
UI.rule(null,false); route(); renderGen('kain'); renderGen('benang'); renderDb(); renderMaster();
$('inpK').value='SJ CM 401 SPX 20 FULL\nDK PL 75/36 PL 100/96 WAFFLE\nSJ PE 301 M71 PE 301 M71 PE 201 FLEECE MIRING\nSJ CTN LIKE 321 BABY TERRY';
$('inpB').value='YARN;TC,65/35,NE,28,CM;SUPPLIER-A,LOT-001\nCVC 20 BRIGHT WHITE [KODE-WARNA]\nYARN;CVC,60/40,NE,24,M71;SUPPLIER-B,LOT-002\nYARN;PLY,Td,167dtex/96F;SUPPLIER-C,LOT-003\nYARN;SPX,Td,70D;SUPPLIER-D,LOT-004';
Data.init();
