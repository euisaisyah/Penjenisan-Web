// ===== ENGINE PENJENISAN =====
function escRe(s){return s.replace(/[\\.+*?^$()\[\]{}|]/g,'\\$&');}
function prepMaster(list){
  const out=[];
  list.forEach(b=>{
    const nama=String(b.nama||'').trim(); if(!nama) return;
    const t1=String(b.t1||'').trim().toUpperCase(), t2=String(b.t2||'').trim().toUpperCase();
    if(t1==='SAMPLE'||t2==='SAMPLE') return;
    const isM71Tag=t1==='M71'||t2==='M71';
    const isMisti=/MISTI/i.test(nama)||isM71Tag;
    const hasFix=b.fix!==undefined&&b.fix!==null&&b.fix!=='';
    const isSpx=hasFix||/SPANDE[XK]/i.test(nama);
    const res=[], al=[];
    String(b.alias||'').split(';').forEach(a=>{
      a=a.trim(); if(!a) return; al.push(a.replace(/\s+/g,' ').toUpperCase());
      let p='\\b'+escRe(a); if(/[0-9]$/.test(a)) p+='1?'; p+='\\b';
      try{res.push(new RegExp(p,'gi'));}catch(e){}
    });
    out.push({nama,isMisti,isM71Tag,isSpx,res,al});
  });
  const amap=new Map();
  const put=(a,m)=>{ if(!amap.has(a)) amap.set(a,[]); if(!amap.get(a).includes(m)) amap.get(a).push(m); };
  out.forEach(m=>m.al.forEach(a=>{
    put(a,m);
    const v=a.replace(/(\d+)\s*(?:DTEX|DEN|TEX|D|T)\s*\/\s*(\d+)\s*F?\b/g,'$1/$2');   // alias PLY 167D/48 juga cocok dgn PLY 167/48
    if(v!==a) put(v,m);
  }));
  out.amap=amap;
  return out;
}
// Kandidat dari semua alias. m71Mode: 'pos' = M71 berlaku utk benang tepat di depannya;
// 'all' = semua posisi pakai MISTI bila ada (dipakai benang yang namanya mengandung MISTI).
function findCands(work,master,m71Mode){
  const c=[];
  for(const m of master){
    for(const re of m.res){
      re.lastIndex=0; let mt;
      while((mt=re.exec(work))!==null){ c.push({pos:mt.index+1,len:mt[0].length,name:m.nama,mi:m.isMisti,tag:m.isM71Tag}); if(!mt[0].length) re.lastIndex++; }
    }
  }
  // posisi yang diikuti M71 (dihitung dari alias terpanjang di posisi itu)
  const maxEnd={};
  c.forEach(k=>{ const e=k.pos-1+k.len; if(!(k.pos in maxEnd)||e>maxEnd[k.pos]) maxEnd[k.pos]=e; });
  const tagged={};
  for(const p in maxEnd) tagged[p]=m71Mode==='all'||/^\s*M71\b/i.test(work.slice(maxEnd[p]));
  const f=c.filter(k=>tagged[k.pos]||!k.tag);
  // urutan seperti makro: posisi paling awal, alias terpanjang; di posisi M71, versi MISTI didahulukan
  for(let i=0;i<f.length-1;i++) for(let j=i+1;j<f.length;j++){
    const a=f[i], b=f[j];
    if(b.pos<a.pos||(b.pos===a.pos&&(b.len>a.len||(tagged[b.pos]&&b.len===a.len&&b.mi&&!a.mi)))){ f[i]=b; f[j]=a; }
  }
  return f;
}
// KAIN: maks 3 benang. "PE 301 M71" -> hanya PE 30 itu yang MISTI; benang lain tetap biasa.
function extractYarns(raw,master){ return extractKain(raw,master).yarns; }
function extractKain(raw,master){
  const work=raw.replace(/\/2\b/gi,'');
  const c=findCands(work,master,'pos');
  const used=new Set(), y=[];
  for(const k of c){ if(used.has(k.pos)) continue; if(y.length<3) y.push(k.name); else break; used.add(k.pos); }
  // potongan yang mirip benang (KODE + angka) tapi tidak ketemu di master -> notes
  const covered=c.map(k=>[k.pos-1,k.pos-1+k.len]);
  const unk=[]; const W=work.toUpperCase();
  const re=/\b((?:[A-Z][A-Z-]+\s+)?[A-Z][A-Z-]{1,7})\s*(\d+(?:\/\d+)?)T?\b/g; let mt;
  const SKIP=new Set(['M71','SJ','DK','RIB','CUFT','CUFF','COLLAR','TL','TULANG','GSM','L','FULL']);
  while((mt=re.exec(W))!==null){
    const a=mt.index, b=a+mt[0].length;
    let words=mt[1].split(/\s+/); const num=mt[2];
    if(!num.includes('/')&&+num<5) continue;
    while(words.length&&SKIP.has(words[0])) words.shift();
    if(!words.length) continue;
    if(covered.some(([x,z])=>a<z&&b>x)){
      // kata pertama mungkin tertimpa match lain; cek kata terakhir+angka saja
      const a2=b-(words[words.length-1]+' '+num).length-1;
      if(covered.some(([x,z])=>a2<z&&b>x)) continue;
      words=[words[words.length-1]];
    }
    unk.push(words.join(' ')+' '+num);
  }
  return {yarns:y,unknown:[...new Set(unk)]};
}
// BENANG: susun kemungkinan jenis berurutan, ambil yang pertama ADA di master.
//  - format YARN: (a) KODE + angka setelah NE  (TC 28)  lalu (b) KODE + angka/angka (TC 65/35, PLY 55/48)
//  - benang double winder (pakai +): kemungkinan dari bagian pertama dulu, lalu bagian berikutnya
//  - nama biasa (benang warna): pasangan KODE + angka sesuai urutan kemunculan
const KODE_SINONIM={NYLON:'NL',POLYESTER:'PL',RAYON:'RY'};
const BUKAN_KODE=new Set(['NE','TD','NM','YARN']);
const isNum=t=>/^\d+(\.\d+)?$/.test(t), isRatio=t=>/^\d+\/\d+$/.test(t), isAlpha=t=>/^[A-Z][A-Z-]*$/.test(t);
function prepYarnText(raw){
  let s=String(raw||'').toUpperCase().replace(/\[[^\]]*\]/g,' ').replace(/\t/g,' ');
  const yarn=/^\s*YARN\s*;/.test(s);
  if(yarn) s=s.replace(/^\s*YARN\s*;/,'').split(';')[0];
  s=s.replace(/(\d+)\s*(?:DTEX|DEN|TEX|D|T)?\s*\/\s*(\d+)\s*F?(?=[^A-Z]|$)/g,'$1/$2')   // 75D/36F, 167DTEX/96F -> 75/36, 167/96
     .replace(/(\d+)\s*T?\s*-\s*(\d+)\b/g,'$1/$2')                          // 55T-48 -> 55/48
     .replace(/[.,;()\[\]{}:]/g,' ').replace(/\+/g,' + ')
     .replace(/([A-Z])(\d)/g,'$1 $2').replace(/(\d)([A-Z])/g,'$1 $2').replace(/\bM 71\b/g,'M71').replace(/\s+/g,' ').trim();
  return {yarn,s};
}
function normYarn(raw){ return yarnCands(raw).cands.join(' , '); }
function yarnCands(raw){
  const {yarn,s}=prepYarnText(raw);
  const cands=[];
  const add=(code,val)=>{ if(!code||!val) return; let c=code;
    c=KODE_SINONIM[c]||c; const k=(c+' '+val).trim(); if(!cands.includes(k)) cands.push(k); };
  for(const seg of s.split(' + ')){
    const tok=seg.split(' ').filter(t=>t&&!(t.length===1&&/[A-Z]/.test(t)));
    const fixCode=(c,all)=>{ if(['COT','COTTON','CTN'].includes(c)) return all.includes('CD')||all.includes('CARDED')?'CD':(all.includes('CM')||all.includes('COMBED')?'CM':c); return c; };
    const lastAlphaBefore=i=>{ for(let j=i-1;j>=0;j--) if(isAlpha(tok[j])&&!BUKAN_KODE.has(tok[j])&&tok[j]!=='M71') return tok[j]; return ''; };
    if(yarn){
      const ne=tok.indexOf('NE');
      if(ne>=0){
        const a=tok[ne+1], b=tok[ne+2];
        if(isNum(a)) add(fixCode(lastAlphaBefore(ne),tok),a);
        else if(isAlpha(a)&&isNum(b)) add(fixCode(a,tok),b);
      }
      const ri=tok.findIndex(isRatio);
      if(ri>=0) add(fixCode(lastAlphaBefore(ri)||tok.find(t=>isAlpha(t)&&!BUKAN_KODE.has(t))||'',tok),tok[ri]);
      // (c) KODE,Td,angka denier  (SPX,Td,70D -> SPX 70)
      const ki=tok.findIndex(t=>isAlpha(t)&&!BUKAN_KODE.has(t));
      if(ki>=0&&ri<0){ let j=ki+1; if(tok[j]==='TD') j++; if(isNum(tok[j])) add(fixCode(tok[ki],tok),String(+tok[j])); }   // hanya kalau tidak ada angka/angka
    }
    if(yarn&&cands.length) continue;   // format YARN: cukup kandidat (a)/(b)
    const kodeUtama=tok.find(t=>isAlpha(t)&&!BUKAN_KODE.has(t));
    for(let i=0;i<tok.length-1;i++){
      if(yarn&&tok[i]!==kodeUtama) continue;   // YARN: hanya kode pertama (abaikan kode supplier seperti OR 1)
      if(isAlpha(tok[i])&&!BUKAN_KODE.has(tok[i])&&tok[i]!=='M71'&&(isNum(tok[i+1])||isRatio(tok[i+1]))) add(fixCode(tok[i],tok),tok[i+1]);
    }
  }
  return {cands,misti:/\bM71\b/.test(s)||/MISTI/i.test(raw)};
}
function lookupAlias(master,cand,misti){
  const list=master.amap&&master.amap.get(cand); if(!list) return '';
  if(misti){ const m=list.find(x=>x.isMisti); if(m) return m.nama; }
  const n=list.find(x=>!x.isM71Tag); return n?n.nama:(list[0]?list[0].nama:'');
}
function jenisBenangX(raw,master){
  const {cands,misti}=yarnCands(raw);
  for(const c of cands){ const n=lookupAlias(master,c,misti); if(n) return {jenis:n,dari:c,cands}; }
  const top=cands.slice(0,2);
  return {jenis:'',cands:top,note:top.length?'Tidak ada di master: '+top.join(' / '):'Format nama tidak dikenali'};
}
function jenisBenang(raw,master){ return jenisBenangX(raw,master).jenis; }
function hitungPersen(names,fixMap){
  const n=[0,1,2].map(i=>String(names[i]||'').trim().toUpperCase());
  const p=[0,0,0]; let jml=0,jS=0,jN=0;
  const fx=n.map(x=>(x&&fixMap[x]!==undefined)?fixMap[x]:-1);
  for(let i=0;i<3;i++){ if(!n[i]) continue; jml++; if(fx[i]>=0){p[i]=fx[i]; jS+=fx[i];} else jN++; }
  if(!jml) return null;
  if(jS===0){
    if(jml===1) n.forEach((x,i)=>{if(x)p[i]=1;});
    else if(jml===2) n.forEach((x,i)=>{if(x)p[i]=.5;});
    else {p[0]=.34;p[1]=.33;p[2]=.33;}
  } else {
    const s=1-jS; if(s<0||jN===0) return null;
    for(let i=0;i<3;i++) if(n[i]&&fx[i]<0) p[i]=s/jN;
  }
  return p;
}
// GROUPING (aturan bisa diubah di Master)
function hasWord(name,list){
  const n=' '+String(name||'').toUpperCase().replace(/[^A-Z0-9/]+/g,' ')+' ';
  return list.some(w=>{w=String(w).trim().toUpperCase(); if(!w) return false; return n.includes(' '+w.replace(/[^A-Z0-9/]+/g,' ').trim()+' ');});
}
function inList(name,list){
  const n=String(name||'').replace(/\s+/g,' ').trim().toUpperCase();
  return list.some(x=>{x=String(x).replace(/\s+/g,' ').trim().toUpperCase(); return x&&n.includes(x);});
}
function groupBenang(name,A){
  if(inList(name,A.eksternal)) return 'Eksternal';
  if(inList(name,A.doubleWinder)||(A.dwPola&&(/\bM\s*D\s*W\b/i.test(name)||/\+/.test(name)))) return 'Double Winder';
  if((A.kurung&&/\[[^\]]*\]/.test(name))||hasWord(name,A.warna)) return 'Warna';
  return 'Greige';
}
function groupKain(name,A){
  if((A.kurung&&/\[[^\]]*\]/.test(name))||hasWord(name,A.warna)||hasWord(name,A.matang)) return 'Matang';
  return 'Greige';
}
if(typeof module!=='undefined') module.exports={prepMaster,extractYarns,extractKain,jenisBenang,jenisBenangX,yarnCands,normYarn,hitungPersen,groupBenang,groupKain};
