/* Offline preview only: no requests to Supabase or Cloudflare. */
const fieldnote = (() => {
  let database;const attachmentUrls=new Map();
  function openDatabase(){
    if(!database)database=new Promise((resolve,reject)=>{
      const request=indexedDB.open('fieldnote-maintenance-offline',1);
      request.onupgradeneeded=()=>{for(const name of ['reports','contracts'])request.result.createObjectStore(name,{keyPath:'id'});};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(Error('Browser storage is unavailable. Open this file in Chrome, Edge, Firefox or Safari with storage enabled.'));
    });
    return database;
  }
  function required(record,keys){for(const key of keys)if(!String(record[key]||'').trim())throw Error(key.replaceAll('_',' ')+' is required.');}
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
  async function request(path,options){
    if(path==='/api/photos'){
      const file=options.body;
      const mime=file.type||(/\.pdf$/i.test(file.name||'')?'application/pdf':'');
      if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(mime)||file.size>10*1024*1024)throw Error('Use JPEG, PNG, WebP or PDF files under 10 MB.');
      if(mime==='application/pdf'&&await file.slice(0,5).text()!=='%PDF-')throw Error('This file is not a valid PDF.');
      return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({url:reader.result});reader.onerror=()=>reject(Error('Unable to read photo.'));reader.readAsDataURL(new Blob([file],{type:mime}));});
    }
    const storeName=path==='/api/contracts'?'contracts':path==='/api/reports'?'reports':null;
    if(!storeName)throw Error('Unknown request.');
    const db=await openDatabase();
    if(!options)return new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,'readonly');let result=[];const query=tx.objectStore(storeName).getAll();query.onsuccess=()=>{result=query.result;};
      tx.oncomplete=()=>resolve(result.sort((a,b)=>storeName==='reports'?b.date.localeCompare(a.date):a.end_date.localeCompare(b.end_date)));
      tx.onerror=()=>reject(Error('Could not load local records.'));
    });
    const record=JSON.parse(options.body);
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['reports','contracts'],'readwrite');let saved,error,rows,contracts;
      const reportQuery=tx.objectStore('reports').getAll(),contractQuery=tx.objectStore('contracts').getAll();
      reportQuery.onsuccess=()=>{rows=reportQuery.result;validate();};contractQuery.onsuccess=()=>{contracts=contractQuery.result;validate();};
      function validate(){
        if(!rows||!contracts)return;
        try{
          const old=(storeName==='reports'?rows:contracts).find(r=>r.id===record.id);
          saved={...old,...record,id:record.id||crypto.randomUUID()};
          if(storeName==='contracts'){
            required(saved,['name','customer','equipment','start_date','end_date','first_visit']);
            saved.interval_months=Number(saved.interval_months);
            if(![3,4,6,12].includes(saved.interval_months))throw Error('Choose a supported maintenance interval.');
            if(![saved.start_date,saved.end_date,saved.first_visit].every(validDate)||saved.start_date>saved.end_date||saved.first_visit<saved.start_date||saved.first_visit>saved.end_date)throw Error('First visit must fall within a valid contract period.');
            if(!['Active','Paused','Cancelled'].includes(saved.state))throw Error('Invalid contract status.');
            const linked=rows.filter(r=>r.maintenance_contract_id===saved.id);
            if(old&&linked.length&&(saved.first_visit!==old.first_visit||saved.interval_months!==old.interval_months))throw Error('This contract has service reports. Create a new contract to change its schedule.');
            if(linked.some(r=>r.maintenance_due_date<saved.start_date||r.maintenance_due_date>saved.end_date))throw Error('Contract dates must include recorded maintenance visits.');
          }else{
            required(saved,['customer','equipment','technician','date']);
            if(!validDate(saved.date))throw Error('Choose a valid service date.');
            if(!['Repair','Maintenance','Installation','Deliver','Others'].includes(saved.action))throw Error('Invalid service type.');
            if(!['Completed','In progress','Follow-up'].includes(saved.status))throw Error('Invalid report status.');
            if(!Array.isArray(saved.photos)||saved.photos.some(p=>typeof p!=='string'||!/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/.test(p)))throw Error('Invalid attachment.');
            if(Boolean(saved.maintenance_contract_id)!==Boolean(saved.maintenance_due_date))throw Error('A scheduled visit requires a contract and due date.');
            if(old&&(saved.maintenance_contract_id!==old.maintenance_contract_id||saved.maintenance_due_date!==old.maintenance_due_date))throw Error('Saved reports cannot be reassigned to another visit.');
            if(saved.maintenance_contract_id){
              const c=contracts.find(c=>c.id===saved.maintenance_contract_id);
              if(!c||saved.action!=='Maintenance'||!maintenance.visits(c,[]).some(v=>v.date===saved.maintenance_due_date))throw Error('Report must match a scheduled Maintenance visit.');
              if(rows.some(r=>r.id!==saved.id&&r.maintenance_contract_id===saved.maintenance_contract_id&&r.maintenance_due_date===saved.maintenance_due_date))throw Error('A report already exists for this visit. Reload and open that report.');
            }
          }
          saved.created_at=old?.created_at||new Date().toISOString();
          tx.objectStore(storeName).put(saved);
        }catch(e){error=e;tx.abort();}
      }
      tx.oncomplete=()=>resolve(saved);
      tx.onabort=tx.onerror=()=>reject(error||Error('Could not save. Browser storage may be full.'));
    });
  }
  function displayPhoto(path){
    if(!path.startsWith('data:application/pdf;'))return path;
    if(!attachmentUrls.has(path)){const bytes=Uint8Array.from(atob(path.split(',')[1]),c=>c.charCodeAt(0));attachmentUrls.set(path,URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})));}
    return attachmentUrls.get(path);
  }
  return {configured:true,request,photoUrl:async path=>displayPhoto(path),displayPhoto,user:{email:'Offline preview'}};
})();
