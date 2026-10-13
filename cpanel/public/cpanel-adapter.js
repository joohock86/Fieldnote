const fieldnote=(()=>{
 let user=null;
 async function call(action,options={}){
  const response=await fetch('api.php?action='+action,{credentials:'same-origin',...options});
  const data=await response.json();
  if(!response.ok){const e=Error(data.error||'Request failed.');e.status=response.status;throw e;}
  return data;
 }
 async function member(){user=await call('me');return user;}
 async function signIn(email,password,remember=false){user=await call('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,remember})});return user;}
 async function signOut(){await call('logout',{method:'POST'});user=null;}
 function displayPhoto(path){return 'api.php?action=file&path='+encodeURIComponent(path);}
 async function request(path,options){
  if(path==='/api/photos')return call('upload',{method:'POST',headers:{'Content-Type':options.body.type||'application/pdf'},body:options.body});
  const action=path==='/api/reports'?'reports':path==='/api/contracts'?'contracts':path==='/api/customers'?'customers':null;
  if(!action)throw Error('Unknown request.');
  if(options)return call(action,{method:'POST',headers:{'Content-Type':'application/json'},body:options.body});
  const data=await call(action);return data.sort((a,b)=>action==='reports'?b.date.localeCompare(a.date):action==='contracts'?a.end_date.localeCompare(b.end_date):a.customer.localeCompare(b.customer));
 }
 return{configured:true,request,member,signIn,signOut,photoUrl:async path=>displayPhoto(path),displayPhoto,sessionNotice:'',get user(){return user;}};
})();
