/* Supabase REST adapter: only the publishable key belongs in config.js. */
const fieldnote = (() => {
  const config = window.FIELDNOTE_CONFIG || {};
  const url = (config.supabaseUrl || '').replace(/\/$/, '');
  const key = config.supabasePublishableKey || '';
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && key.startsWith('sb_publishable_');
  let session = null, refreshJob = null;
  const photoUrls = new Map();
  const storageKey = 'fieldnote-session:' + url;
  let persistent = false, sessionNotice = '';
  function readSession(storage) {
    try { const value=JSON.parse(storage.getItem(storageKey)||'null'); return value?.access_token && value?.refresh_token && value?.user?.id ? value : null; } catch {return null;}
  }
  try {session=readSession(sessionStorage);} catch {}
  if(!session){try{session=readSession(localStorage);persistent=Boolean(session);}catch{}}
  function removeStored(storage){try{storage.removeItem(storageKey);}catch{}}
  function remember(value) {
    session = value;
    if(!value){try{removeStored(sessionStorage);}catch{}try{removeStored(localStorage);}catch{}persistent=false;return;}
    if(persistent){
      try{localStorage.setItem(storageKey,JSON.stringify(value));try{removeStored(sessionStorage);}catch{}return;}
      catch{persistent=false;sessionNotice='This browser could not remember your device. Your login is available for this session only.';}
    }
    try{sessionStorage.setItem(storageKey,JSON.stringify(value));}catch{}
    try{removeStored(localStorage);}catch{}
  }
  async function send(path, options = {}, token = null) {
    if (!configured) throw Error('Website setup is not complete. Add the project URL and publishable key to config.js.');
    const response = await fetch(url + path, {
      ...options, headers: {apikey: key, ...(token ? {Authorization: 'Bearer ' + token} : {}), ...(options.headers || {})}
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) {
      const error = Error(data?.msg || data?.message || data?.error_description || data?.error || 'Request failed. Please try again.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  async function refresh() {
    if (!session?.refresh_token) throw Error('Please sign in again.');
    if (!refreshJob) refreshJob = send('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({refresh_token: session.refresh_token})
    }).then(data => { remember({...data, expires_at: Math.floor(Date.now()/1000) + data.expires_in}); })
      .catch(error => { if([400,401,403].includes(error.status))remember(null); throw error; }).finally(() => {refreshJob = null;});
    await refreshJob;
  }
  async function authorized(path, options = {}) {
    if (!session) throw Error('Please sign in to use Fieldnote.');
    if (!session.expires_at || session.expires_at < Date.now()/1000 + 60) await refresh();
    try { return await send(path, options, session.access_token); }
    catch (error) {
      if (error.status !== 401) throw error;
      await refresh();
      return send(path, options, session.access_token);
    }
  }
  async function member() {
    const users = await authorized('/rest/v1/fieldnote_members?select=user_id');
    if (!users?.length) {const error=Error('This login has not been added to the Fieldnote team. Ask your administrator to grant access.');error.status=403;throw error;}
  }
  async function signIn(email, password, rememberDevice = false) {
    const data = await send('/auth/v1/token?grant_type=password', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email, password})
    });
    persistent=Boolean(rememberDevice);sessionNotice='';
    remember({...data, expires_at: Math.floor(Date.now()/1000) + data.expires_in});
    try { await member(); } catch (error) {remember(null); throw error;}
    return session.user;
  }
  async function signOut() {
    try { if (session) await authorized('/auth/v1/logout?scope=local', {method:'POST'}); }
    finally {remember(null); photoUrls.clear();}
  }
  function validPhoto(path) {
    return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(path);
  }
  async function photoUrl(path) {
    if (!validPhoto(path)) throw Error('Invalid photo reference.');
    const cached = photoUrls.get(path);
    if (cached && cached.until > Date.now()) return cached.url;
    const data = await authorized('/storage/v1/object/sign/fieldnote-photos/' + path, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({expiresIn:3600})
    });
    const signed = data.signedURL || data.signedUrl;
    if (!signed) throw Error('Could not load the service photo.');
    const result = new URL(signed.startsWith('/object/') ? '/storage/v1' + signed : signed, url).href;
    if (new URL(result).origin !== url) throw Error('Unexpected photo URL.');
    photoUrls.set(path,{url:result, until:Date.now()+3500000});
    return result;
  }
  function displayPhoto(path) {return photoUrls.get(path)?.url || '';}
  async function request(path, options) {
    if (path === '/api/reports' && !options) {
      const records = [];
      for (let offset = 0; ; offset += 500) {
        const page = await authorized('/rest/v1/fieldnote_reports?select=*&order=date.desc,created_at.desc&limit=500&offset=' + offset);
        records.push(...page);
        if (page.length < 500) break;
      }
      return records;
    }
    if (path === '/api/reports' && options) {
      const record = JSON.parse(options.body);
      const columns = ['customer','phone','email','contact','location','equipment','serial','technician','date','action','status','parts','notes','photos','maintenance_contract_id','maintenance_due_date'];
      const payload = Object.fromEntries(columns.filter(k=>record[k]!==undefined).map(k=>[k,record[k]]));
      if (!Array.isArray(payload.photos) || payload.photos.some(p=>!validPhoto(p))) throw Error('Invalid attachment.');
      const isEdit = Boolean(record.id);
      if (isEdit && !/^[0-9a-f-]{36}$/.test(record.id)) throw Error('Invalid report ID.');
      const data = await authorized('/rest/v1/fieldnote_reports' + (isEdit ? '?id=eq.' + record.id : ''), {
        method:isEdit?'PATCH':'POST', headers:{'Content-Type':'application/json',Prefer:'return=representation'}, body:JSON.stringify(payload)
      });
      if (!data?.length) throw Error('Report was not saved. Check your team access and try again.');
      return data[0];
    }
    if (path === '/api/contracts' && !options) {
      const records=[];
      for(let offset=0;;offset+=500){
        const page=await authorized('/rest/v1/fieldnote_contracts?select=*&order=end_date.asc,created_at.desc&limit=500&offset='+offset);
        records.push(...page);if(page.length<500)break;
      }
      return records;
    }
    if (path === '/api/contracts' && options) {
      const record=JSON.parse(options.body);
      const columns=['name','customer','phone','email','location','equipment','serial','start_date','end_date','first_visit','interval_months','state','notes'];
      const payload=Object.fromEntries(columns.filter(k=>record[k]!==undefined).map(k=>[k,record[k]]));
      payload.interval_months=Number(payload.interval_months);
      const isEdit=Boolean(record.id);
      if(isEdit&&!/^[0-9a-f-]{36}$/.test(record.id))throw Error('Invalid contract ID.');
      const data=await authorized('/rest/v1/fieldnote_contracts'+(isEdit?'?id=eq.'+record.id:''),{
        method:isEdit?'PATCH':'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)
      });
      if(!data?.length)throw Error('Contract was not saved. Check your team access.');
      return data[0];
    }
    if (path === '/api/photos' && options) {
      const file = options.body;
      const extensions = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
      const mime=file.type||(/\.pdf$/i.test(file.name||'')?'application/pdf':'');
      if (!extensions[mime] || file.size > 10*1024*1024) throw Error('Use JPEG, PNG, WebP or PDF files under 10 MB.');
      if(mime==='application/pdf'&&await file.slice(0,5).text()!=='%PDF-')throw Error('This file is not a valid PDF.');
      const object = session.user.id + '/' + crypto.randomUUID() + '.' + extensions[mime];
      await authorized('/storage/v1/object/fieldnote-photos/' + object, {method:'POST',headers:{'Content-Type':mime},body:file});
      await photoUrl(object);
      return {url:object};
    }
    throw Error('Unknown request.');
  }
  return {configured, signIn, signOut, member, request, photoUrl, displayPhoto, get sessionNotice(){return sessionNotice;}, get user(){return session?.user || null;}};
})();
