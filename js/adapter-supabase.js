/* ================= ADAPTER: Supabase (login wajib) =================
   Tabel: master_benang, aturan (1 baris), db_kain, db_benang. Lihat supabase/schema.sql. */
const Data=(()=>{
  const cfg=window.PENJENISAN_CONFIG||{};
  let sb=null, session=null, channel=null, loaded=false;
  let mlist=[], rule=null;
  const maps={kain:new Map(),benang:new Map()};
  const TBL={kain:'db_kain',benang:'db_benang'};

  const toKain=r=>({k:keyOf(r.nama).k,nama:r.nama,b:[r.b1||'',r.b2||'',r.b3||''],p:[+r.p1||0,+r.p2||0,+r.p3||0],g:r.grp||'',gm:!!r.gm,src:r.src||'',at:r.updated_at,byEmail:r.updated_by_email||''});
  const toBenang=r=>({k:keyOf(r.nama).k,nama:r.nama,jenis:r.jenis||'',g:r.grp||'',gm:!!r.gm,src:r.src||'',at:r.updated_at,byEmail:r.updated_by_email||''});
  const toMaster=r=>({id:r.id,nama:r.nama,alias:r.alias||'',t1:r.t1||'',t2:r.t2||'',fix:r.fix===null||r.fix===undefined?null:+r.fix,ord:r.ord});
  const toRule=r=>r?({warna:r.warna,matang:r.matang||[],eksternal:r.eksternal||[],doubleWinder:r.double_winder||[],kurung:r.kurung!==false,dwPola:r.dw_pola!==false}):null;
  const fail=e=>{ if(!e) return null; if(e.code==='42501'||/row-level security|permission/i.test(e.message||'')) return {code:'no_permission',message:e.message}; return {code:e.code||'error',message:e.message||String(e)}; };
  const chk=({data,error})=>{ if(error) throw fail(error); return data; };

  async function fetchAll(table,order){
    const out=[]; const size=1000;
    for(let from=0;;from+=size){
      const rows=chk(await sb.from(table).select('*').order(order,{ascending:true}).range(from,from+size-1));
      out.push(...rows); if(rows.length<size) break;
    }
    return out;
  }
  const pushMaster=()=>UI.master(mlist.slice(),true);
  const timers={};
  const later=(key,fn)=>{ clearTimeout(timers[key]); timers[key]=setTimeout(fn,150); };
  const pushStore=type=>UI.store(type,new Map(maps[type]),true);

  async function load(){
    UI.state('wait','Memuat data…');
    try{
      const [m,r,k,b]=await Promise.all([
        fetchAll('master_benang','ord'),
        sb.from('aturan').select('*').eq('id',1).maybeSingle().then(chk),
        fetchAll('db_kain','nama'),
        fetchAll('db_benang','nama')
      ]);
      mlist=m.map(toMaster); rule=toRule(r);
      maps.kain=new Map(k.map(toKain).map(e=>[e.k,e])); maps.benang=new Map(b.map(toBenang).map(e=>[e.k,e]));
      S.online=true; loaded=true;
      UI.rule(rule,true); pushMaster(); pushStore('kain'); pushStore('benang'); UI.banner();
      UI.state('on','Tersambung · '+(session.user.email||''));
      subscribe();
    }catch(e){ S.online=false; UI.banner(); UI.state('off','Gagal memuat data: '+(e.message||e.code)); }
  }
  function subscribe(){
    if(channel) sb.removeChannel(channel);
    channel=sb.channel('penjenisan')
      .on('postgres_changes',{event:'*',schema:'public',table:'master_benang'},p=>{
        if(p.eventType==='DELETE') mlist=mlist.filter(x=>x.id!==p.old.id);
        else { const n=toMaster(p.new); const i=mlist.findIndex(x=>x.id===n.id); if(i>=0) mlist[i]=n; else mlist.push(n); }
        later('m',pushMaster);
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'aturan'},p=>{ if(p.new&&p.new.id===1){ rule=toRule(p.new); UI.rule(rule,true); } })
      .on('postgres_changes',{event:'*',schema:'public',table:'db_kain'},p=>applyRow('kain',p))
      .on('postgres_changes',{event:'*',schema:'public',table:'db_benang'},p=>applyRow('benang',p))
      .subscribe();
  }
  function applyRow(type,p){
    if(p.eventType==='DELETE'){ if(p.old&&p.old.nama) maps[type].delete(keyOf(p.old.nama).k); }
    else { const e=(type==='kain'?toKain:toBenang)(p.new); maps[type].set(e.k,e); }
    later(type,()=>pushStore(type));
  }

  /* ---------- login ---------- */
  function showLogin(msg,mode){
    const box=$('login'); box.classList.add('show');
    $('who').classList.remove('show');
    $('lgMsg').textContent=msg||'';
    const rec=mode==='recovery';
    $('lgPass').value=''; $('lgPass').autocomplete=rec?'new-password':'current-password';
    $('lgPass').previousElementSibling.textContent=rec?'Password baru':'Password';
    $('lgEmail').parentElement.style.display=rec?'none':'';
    $('lgGo').textContent=rec?'Simpan password baru':'Masuk';
    $('lgReset').style.display=rec?'none':'';
    box.dataset.mode=rec?'recovery':'login';
    setTimeout(()=>(rec?$('lgPass'):$('lgEmail')).focus(),50);
  }
  function hideLogin(){ $('login').classList.remove('show'); $('who').classList.add('show'); $('whoName').textContent=session&&session.user?session.user.email:''; }
  function wireLogin(){
    $('fmLogin').addEventListener('submit',async ev=>{
      ev.preventDefault();
      const mode=$('login').dataset.mode, pass=$('lgPass').value;
      $('lgGo').disabled=true; $('lgMsg').textContent='Memproses…';
      try{
        if(mode==='recovery'){
          if(pass.length<8){ $('lgMsg').textContent='Password minimal 8 karakter.'; return; }
          const {error}=await sb.auth.updateUser({password:pass}); if(error) throw error;
          $('lgMsg').textContent='Password diganti.'; hideLogin(); if(!loaded) load();
        } else {
          const email=$('lgEmail').value.trim();
          const {error}=await sb.auth.signInWithPassword({email,password:pass});
          if(error) $('lgMsg').textContent=/invalid/i.test(error.message)?'Email atau password salah.':error.message;
        }
      }catch(e){ $('lgMsg').textContent=e.message||String(e); }
      finally{ $('lgGo').disabled=false; }
    });
    $('lgReset').onclick=async()=>{
      const email=$('lgEmail').value.trim(); if(!email){ $('lgMsg').textContent='Isi email dulu, lalu klik Lupa password.'; return; }
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      $('lgMsg').textContent=error?error.message:'Link ganti password dikirim ke email (kalau email terdaftar).';
    };
    $('btnLogout').onclick=async()=>{ await sb.auth.signOut(); };
  }

  return {
    offlineHint:'Masuk dulu, atau cek pengaturan config.js.',
    whoName:e=>e.byEmail?e.byEmail.split('@')[0]:'',
    async init(){
      const KEY=cfg.SUPABASE_KEY||cfg.SUPABASE_ANON_KEY||'';
      if(!cfg.SUPABASE_URL||!KEY||/xxxx/.test(cfg.SUPABASE_URL)||/^isi-/.test(KEY)){
        this.offlineHint='config.js belum diisi: masukkan SUPABASE_URL dan SUPABASE_KEY (lihat README).';
        UI.state('off','config.js belum diisi'); UI.banner(); return;
      }
      if(!window.supabase){ this.offlineHint='Library Supabase gagal dimuat. Cek koneksi internet.'; UI.state('off','Library gagal dimuat'); UI.banner(); return; }
      sb=window.supabase.createClient(cfg.SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true}});
      wireLogin();
      UI.state('wait','Menunggu login…');
      sb.auth.onAuthStateChange((event,sess)=>{
        session=sess;
        if(event==='PASSWORD_RECOVERY'){ showLogin('Masukkan password baru.','recovery'); return; }
        if(sess){ hideLogin(); if(!loaded) setTimeout(load,0); }
        else { loaded=false; S.online=false; if(channel){ sb.removeChannel(channel); channel=null; }
          mlist=[]; maps.kain=new Map(); maps.benang=new Map();
          UI.master([],false); UI.store('kain',new Map(),false); UI.store('benang',new Map(),false); UI.banner();
          UI.state('off','Belum masuk'); showLogin(event==='SIGNED_OUT'?'Anda sudah keluar.':''); }
      });
    },
    async saveStore(type,entries){
      if(!S.online) throw {code:'unavailable',message:'Belum tersambung'};
      const rows=entries.map(e=>{
        const r={nama:norm(e.nama),grp:e.g||'',gm:!!e.gm,src:e.src||''};
        if(type==='kain'){ const b=e.b.map(x=>String(x||'').trim()), p=e.p.map(x=>+x||0); Object.assign(r,{b1:b[0],p1:p[0],b2:b[1],p2:p[1],b3:b[2],p3:p[2]}); }
        else r.jenis=String(e.jenis||'').trim();
        return r;
      });
      for(let i=0;i<rows.length;i+=500){
        const saved=chk(await sb.from(TBL[type]).upsert(rows.slice(i,i+500),{onConflict:'nama'}).select());
        saved.forEach(r=>{ const e=(type==='kain'?toKain:toBenang)(r); maps[type].set(e.k,e); });
      }
      pushStore(type);
    },
    async deleteStore(type,nama){ chk(await sb.from(TBL[type]).delete().eq('nama',norm(nama))); maps[type].delete(keyOf(nama).k); pushStore(type); },
    async saveMasterItem(id,data){
      const row={nama:data.nama,alias:data.alias||'',t1:data.t1||'',t2:data.t2||'',fix:hasFix(data)?+data.fix:null,ord:data.ord??null};
      const r=id?chk(await sb.from('master_benang').update(row).eq('id',id).select().single()):chk(await sb.from('master_benang').insert(row).select().single());
      const n=toMaster(r); const i=mlist.findIndex(x=>x.id===n.id); if(i>=0) mlist[i]=n; else mlist.push(n); pushMaster();
    },
    async deleteMasterItem(id){ chk(await sb.from('master_benang').delete().eq('id',id)); mlist=mlist.filter(x=>x.id!==id); pushMaster(); },
    async replaceMaster(list){
      chk(await sb.from('master_benang').delete().not('id','is',null));
      const rows=list.map((b,i)=>({nama:b.nama,alias:b.alias||'',t1:b.t1||'',t2:b.t2||'',fix:hasFix(b)?+b.fix:null,ord:b.ord??i+1}));
      const out=[]; for(let i=0;i<rows.length;i+=500) out.push(...chk(await sb.from('master_benang').insert(rows.slice(i,i+500)).select()));
      mlist=out.map(toMaster); pushMaster();
    },
    async saveRule(patch){
      const row={id:1};
      if('warna' in patch) row.warna=patch.warna; if('matang' in patch) row.matang=patch.matang;
      if('eksternal' in patch) row.eksternal=patch.eksternal; if('doubleWinder' in patch) row.double_winder=patch.doubleWinder;
      if('kurung' in patch) row.kurung=patch.kurung; if('dwPola' in patch) row.dw_pola=patch.dwPola;
      const r=chk(await sb.from('aturan').upsert(row,{onConflict:'id'}).select().single());
      rule=toRule(r); UI.rule(rule,true);
    },
    async download(filename,blob){
      const url=URL.createObjectURL(blob); const a=document.createElement('a');
      a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
    }
  };
})();
