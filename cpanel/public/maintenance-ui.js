function prepareMaintenanceNavigation(){
  $('new').textContent=view==='maintenance'?'+ New Contract':view==='customers'?'+ New Customer':'＋ New service report';
  $('new').onclick=()=>view==='maintenance'?openContractForm():view==='customers'?openCustomerForm():openForm();
  $('new').disabled=view==='customers'&&!!customersError;
  let tabs=$('customer-tabs');
  if(!tabs){
    const bar=document.createElement('div');bar.id='customer-tabs';bar.className='customer-tabs hidden';
    bar.innerHTML='<button data-mode="contracts">Maintenance contracts</button><button data-mode="visits">Scheduled visits</button>';
    document.querySelector('.tools').before(bar);
    bar.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{customerMode=button.dataset.mode;render()});
    tabs=bar;
    const filter=document.createElement('select');filter.id='visit-filter';filter.setAttribute('aria-label','Filter maintenance visits');
    filter.innerHTML=['Outstanding','All visits','Overdue','Due today','Upcoming','Completed','Paused','Cancelled'].map(v=>'<option>'+v+'</option>').join('');
    filter.className='hidden';filter.onchange=render;document.querySelector('.tools').append(filter);
  }
  tabs.classList.toggle('hidden',view!=='maintenance');
  tabs.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===customerMode));
  $('status').classList.toggle('hidden',view!=='reports');$('type').classList.toggle('hidden',view!=='reports');
  $('visit-filter').classList.toggle('hidden',view!=='maintenance'||customerMode!=='visits');
  $('export').classList.toggle('hidden',view!=='reports');
  $('search').placeholder=view==='customers'?'Search customer name or contact details…':view==='maintenance'?'Search customer, contract, system or equipment…':'Search customer, equipment, serial number or technician…';
}
function maintenanceBadge(state){return '<span class="badge '+(state==='Overdue'?'overdue':state==='Due today'?'progress':['Expired','Paused','Cancelled','Not started'].includes(state)?'neutral':'')+'">'+esc(state)+'</span>';}
function contractMatches(c){const q=$('search').value.trim().toLowerCase();return [c.customer,c.name,c.equipment,c.serial,c.phone,c.email,c.location].join(' ').toLowerCase().includes(q);}
function reportForVisit(c,date){return reports.find(r=>r.maintenance_contract_id===c.id&&r.maintenance_due_date===date);}
function beginVisit(id,date){
  const c=contracts.find(c=>c.id===id);if(!c)return;
  const existing=reportForVisit(c,date);if(existing){detail(existing);return;}
  if(c.state!=='Active'){notify('Activate the contract before creating a new visit report.');return;}
  openForm({customer:c.customer,phone:c.phone,email:c.email,location:c.location,equipment:c.equipment,serial:c.serial,
    action:'Maintenance',status:'In progress',technician:'',date:maintenance.today(),notes:'',parts:'',photos:[],maintenance_contract_id:c.id,maintenance_due_date:date});
}
function visitsTable(rows){
  if(!rows.length)return '<div class="empty"><h2>No scheduled visits found</h2><p>Adjust the search or visit filter, or add a maintenance contract.</p></div>';
  return '<div class="table-wrap"><table><thead><tr><th>Customer / contract</th><th>System or equipment</th><th>Due date</th><th>Status</th><th>Service report</th></tr></thead><tbody>'+rows.map(v=>'<tr><td><strong>'+esc(v.contract.customer)+'</strong><small>'+esc(v.contract.name)+'</small></td><td style="max-width:230px;white-space:pre-wrap">'+esc(v.contract.equipment)+'</td><td>'+esc(pretty(v.date))+'</td><td>'+maintenanceBadge(v.state)+(v.report&&v.report.status!=='Completed'?'<br><small>Report: '+esc(v.report.status)+'</small>':'')+'</td><td><div class="visit-actions">'+(v.report?'<button class="secondary" data-open-visit="'+esc(v.report.id)+'">Open report</button>':v.contract.state==='Active'?'<button class="secondary" data-create-visit="'+esc(v.contract.id)+'" data-due="'+v.date+'">Create report</button>':'—')+'</div></td></tr>').join('')+'</tbody></table></div>';
}
function bindVisitActions(container){
  container.querySelectorAll('[data-open-visit]').forEach(b=>b.onclick=()=>{const r=reports.find(r=>r.id===b.dataset.openVisit);if(r)detail(r)});
  container.querySelectorAll('[data-create-visit]').forEach(b=>b.onclick=()=>beginVisit(b.dataset.createVisit,b.dataset.due));
}
function nextServiceHighlight(c,remaining){
 const next=remaining[0];
 if(!next)return '<div class="next-service inactive"><div><label>Next outstanding service</label><strong>All visits completed</strong></div></div>';
 const inactive=c.state!=='Active';
 const style=inactive?'inactive':next.state==='Overdue'?'overdue':next.state==='Due today'?'due':'';
 return '<div class="next-service '+style+'"><div><label>Next outstanding service</label><strong>'+esc(pretty(next.date))+'</strong></div>'+maintenanceBadge(inactive?c.state:next.state)+'</div>';
}
function contractCard(c){
 const visits=maintenance.visits(c,reports),remaining=visits.filter(v=>v.state!=='Completed'),done=visits.length-remaining.length;
 return '<div class="contract-card"><h3>'+esc(c.name)+' &nbsp; '+maintenanceBadge(maintenance.contractState(c))+'</h3><div class="contract-meta"><span>'+esc(c.customer)+'</span><span>'+esc(pretty(c.start_date))+' – '+esc(pretty(c.end_date))+'</span><span>'+maintenance.intervals[c.interval_months]+'</span></div><div class="equipment-text">'+esc(c.equipment)+'</div>'+nextServiceHighlight(c,remaining)+'<p class="maintenance-tip">First visit: '+esc(pretty(c.first_visit))+' · '+done+' / '+visits.length+' visits completed</p><div class="contract-actions"><button class="secondary" data-contract="'+esc(c.id)+'">View contract & visits</button><button class="secondary" data-edit-contract="'+esc(c.id)+'">Edit contract</button></div></div>';
}
function bindContractActions(container){
  container.querySelectorAll('[data-contract]').forEach(b=>b.onclick=()=>contractDetail(contracts.find(c=>c.id===b.dataset.contract)));
  container.querySelectorAll('[data-edit-contract]').forEach(b=>b.onclick=()=>openContractForm(contracts.find(c=>c.id===b.dataset.editContract)));
}
function renderCustomerWorkspace(){
  const filtered=contracts.filter(contractMatches);

  $('list-title').textContent=customerMode==='contracts'?'Maintenance contracts':'Scheduled maintenance visits';
  $('list-subtitle').textContent=customerMode==='contracts'?'Contract periods, intervals, and covered systems in one place.':'Create a Maintenance report to document and complete each visit.';
  if(contractsError){$('content').innerHTML='<div class="empty"><h2>Maintenance is not ready</h2><p>Run the maintenance database update in Supabase, then click Reload.</p><p>'+esc(contractsError)+'</p></div>';$('count').textContent='Contracts unavailable';return;}
  if(customerMode==='contracts'){
    const expired=filtered.filter(c=>maintenance.contractState(c)==='Expired').length;
    $('content').innerHTML='<div class="maintenance-summary"><span><b>'+filtered.length+'</b> contracts</span><span><b>'+expired+'</b> expired</span></div>'+(filtered.length?'<div class="contract-list">'+filtered.map(contractCard).join('')+'</div>':'<div class="empty"><h2>Add your first maintenance contract</h2><p>Choose the contract period, maintenance interval and covered systems.</p><button class="primary" onclick="openContractForm()">＋ New contract</button></div>');
    $('count').textContent=filtered.length+' contracts';bindContractActions($('content'));return;
  }
  const visits=filtered.flatMap(c=>maintenance.visits(c,reports)).sort((a,b)=>a.date.localeCompare(b.date));
  const selection=$('visit-filter').value;
  const rows=visits.filter(v=>selection==='All visits'||(selection==='Outstanding'?['Overdue','Due today','Upcoming'].includes(v.state):v.state===selection));
  $('content').innerHTML='<div class="maintenance-summary"><span><b>'+visits.filter(v=>v.state==='Overdue').length+'</b> overdue</span><span><b>'+visits.filter(v=>v.state==='Due today').length+'</b> due today</span><span><b>'+visits.filter(v=>v.state==='Upcoming').length+'</b> upcoming</span><span><b>'+visits.filter(v=>v.state==='Completed').length+'</b> completed</span></div>'+visitsTable(rows);
  $('count').textContent=rows.length+' scheduled visits';bindVisitActions($('content'));
}
function contractDetail(c){
  if(!c)return;$('modal-title').textContent=c.name+' · Contract';
  $('modal-body').innerHTML='<div class="form"><div class="grid">'+[['Customer',c.customer],['Status',maintenance.contractState(c)],['Contact number',c.phone],['Email',c.email],['Contract start',pretty(c.start_date)],['Contract end',pretty(c.end_date)],['Maintenance interval',maintenance.intervals[c.interval_months]],['First visit',pretty(c.first_visit)],['System / equipment covered',c.equipment],['Serial / asset references',c.serial],['Location',c.location],['Notes',c.notes]].map(([label,value])=>'<div class="detail"><label>'+label+'</label>'+esc(value||'—')+'</div>').join('')+'</div><div class="actions"><button class="secondary" id="edit-contract">Edit contract</button></div><div class="section">Visit schedule & service history</div>'+visitsTable(maintenance.visits(c,reports))+'</div>';
  $('edit-contract').onclick=()=>openContractForm(c);bindVisitActions($('modal-body'));show();
}
function openContractForm(c={}){
  $('modal-title').textContent=c.id?'Edit maintenance contract':'New maintenance contract';
  const hasHistory=c.id&&reports.some(r=>r.maintenance_contract_id===c.id);
  $('modal-body').innerHTML='<form class="form" id="contract-form"><div class="eyebrow">Customer & contract</div><div class="grid" style="margin-top:17px">'+field('name','Contract name / reference',c.name,true)+field('customer','Customer name',c.customer,true)+field('phone','Customer contact number',c.phone,false,'tel')+field('email','Customer email',c.email,false,'email')+field('location','Service location',c.location)+field('serial','Serial / asset references',c.serial)+'<div class="field full"><label for="contract-equipment">Systems / equipment covered *</label><textarea id="contract-equipment" name="equipment" rows="3" required placeholder="Enter the systems or equipment covered, one per line">'+esc(c.equipment||'')+'</textarea></div></div><div class="section">Contract period & schedule</div><div class="grid">'+field('start_date','Contract start date',c.start_date||maintenance.today(),true,'date')+field('end_date','Contract end date',c.end_date,true,'date')+field('first_visit','First maintenance visit',c.first_visit||c.start_date||maintenance.today(),true,'date')+'<div class="field"><label for="contract-interval">Maintenance interval *</label><select id="contract-interval" name="interval_months" required>'+Object.entries(maintenance.intervals).map(([value,label])=>'<option value="'+value+'" '+(Number(c.interval_months||12)===Number(value)?'selected':'')+'>'+label+'</option>').join('')+'</select></div>'+select('state','Contract status',['Active','Paused','Cancelled'],c.state||'Active')+'<div class="field full"><label for="contract-notes">Contract notes</label><textarea id="contract-notes" name="notes" rows="3">'+esc(c.notes||'')+'</textarea></div></div><p class="maintenance-tip">Visits repeat from the first maintenance date and stop at the contract end date. Dates at month end adjust to the last available day.</p><p class="maintenance-tip" id="schedule-preview"></p>'+(hasHistory?'<p class="maintenance-tip">The first visit and interval are locked because this contract has service reports. Create a new contract to change its schedule.</p>':'')+'<p class="error" id="contract-error" role="alert"></p><div class="actions"><button type="button" class="secondary" onclick="close()">Cancel</button><button class="primary" id="save-contract">Save contract</button></div></form>';
  if(hasHistory){$('f-first_visit').readOnly=true;$('contract-interval').disabled=true;}
  const preview=()=>{const start=$('f-start_date').value,end=$('f-end_date').value,first=$('f-first_visit').value;$('f-end_date').min=start;$('f-first_visit').min=start;$('f-first_visit').max=end;if(!first||!end||end<first){$('schedule-preview').textContent='';return;}const rows=maintenance.visits({id:c.id||'',first_visit:first,end_date:end,interval_months:Number($('contract-interval').value),state:'Active'},[]);$('schedule-preview').textContent=rows.length+' scheduled visits'+(rows.length?' · First: '+pretty(rows[0].date)+' · Last: '+pretty(rows.at(-1).date):'');};
  $('contract-form').oninput=preview;preview();
  $('contract-form').onsubmit=async event=>{
    event.preventDefault();$('save-contract').disabled=true;$('contract-error').textContent='';
    const data=Object.fromEntries(new FormData(event.target));data.interval_months=Number($('contract-interval').value);if(c.id)data.id=c.id;
    try{if(data.end_date<data.start_date||data.first_visit<data.start_date||data.first_visit>data.end_date)throw Error('The first maintenance visit must fall within the contract period.');await request('/api/contracts',{method:'POST',body:JSON.stringify(data)});close();view='maintenance';customerMode='contracts';await load();notify('Maintenance contract saved')}
    catch(error){$('contract-error').textContent=error.message;$('save-contract').disabled=false;}
  };
  show();$('f-name').focus();
}
