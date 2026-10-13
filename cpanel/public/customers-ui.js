const customerDirectory = (() => {
  const key = name => String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  function groups(profiles, reports, contracts) {
    const groups = new Map(), aliases = new Map();
    for (const profile of profiles) {
      const group = {...profile, profile, rows:[], contracts:[]};
      groups.set(profile.id, group);
      for (const name of [profile.customer, ...(profile.aliases || [])]) aliases.set(key(name), group);
    }
    function groupFor(record) {
      const name = key(record.customer);
      let group = groups.get(record.customer_id) || aliases.get(name);
      if (!group) {
        group = {customer:record.customer, original_name:record.customer, rows:[], contracts:[]};
        groups.set('legacy:' + name, group);aliases.set(name, group);
      }
      return group;
    }
    for (const report of reports) groupFor(report).rows.push(report);
    for (const contract of contracts) groupFor(contract).contracts.push(contract);
    return [...groups.values()].map(group => {
      if (!group.profile) {
        const history = [...group.rows,...group.contracts];
        for (const field of ['phone','email','location']) group[field] = history.find(r => r[field])?.[field] || '';
      }
      return group;
    }).sort((a,b) => a.customer.localeCompare(b.customer));
  }
  return {key, groups};
})();

function allCustomerGroups() { return customerDirectory.groups(customerProfiles,reports,contracts); }

function renderCustomerRecords() {
  $('list-title').textContent='All customers';
  $('list-subtitle').textContent='Customer details, service history, and maintenance contracts.';
  if(customersError){$('content').innerHTML='<div class="empty"><h2>Unable to load customer details</h2><p>'+esc(customersError)+'</p><button class="secondary" onclick="load()">Try again</button></div>';$('count').textContent='Customers unavailable';return;}
  const q=$('search').value.trim().toLowerCase();
  const rows=allCustomerGroups().filter(g=>[g.customer,g.contact_person,g.phone,g.email,g.location,g.notes,...(g.aliases||[]),...g.rows.flatMap(r=>[r.customer,r.equipment,r.location]),...g.contracts.flatMap(c=>[c.customer,c.name,c.equipment,c.location])].join(' ').toLowerCase().includes(q));
  $('content').innerHTML=rows.length?'<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Contact number</th><th>Email</th><th>Reports</th><th>Contracts</th></tr></thead><tbody>'+rows.map((g,i)=>'<tr class="row" tabindex="0" data-customer-index="'+i+'"><td><strong>'+esc(g.customer)+'</strong><small>'+esc(g.location||'')+'</small></td><td>'+esc(g.phone||'—')+'</td><td>'+esc(g.email||'—')+'</td><td>'+g.rows.length+'</td><td>'+g.contracts.length+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty"><h2>'+(q?'No customers found':'Add your first customer')+'</h2><p>'+(q?'Try another customer name or contact detail.':'Create a customer before their first service visit.')+'</p></div>';
  $('count').textContent=rows.length+' customers';
  $('content').querySelectorAll('[data-customer-index]').forEach(el=>{const action=()=>customerDetail(rows[Number(el.dataset.customerIndex)]);el.onclick=action;el.onkeydown=e=>{if(e.key==='Enter')action()};});
}

function customerDetail(g) {
  $('modal-title').textContent=g.customer+' · Customer';
  const details=[['Contact person',g.contact_person],['Contact number',g.phone],['Email',g.email],['Customer address / default location',g.location],['Notes',g.notes]];
  $('modal-body').innerHTML='<div class="form"><div class="grid">'+details.map(([label,value])=>'<div class="detail"><label>'+label+'</label>'+esc(value||'—')+'</div>').join('')+'</div><div class="actions"><button class="primary" id="edit-customer">Edit customer</button></div><div class="section">Maintenance contracts</div>'+(g.contracts.length?g.contracts.map(contractCard).join(''):'<p>No maintenance contracts yet.</p>')+'<button class="secondary" id="customer-add-contract">＋ New maintenance contract</button><div class="section">Service history</div>'+(g.rows.length?g.rows.map(r=>'<button class="secondary" style="display:flex;width:100%;justify-content:space-between;margin-bottom:12px" data-open-visit="'+esc(r.id)+'"><span>'+esc(pretty(r.date))+' · '+esc(r.action)+'<br><small>'+esc(r.equipment)+' · '+esc(r.technician)+'</small></span>'+badge(r.status)+'</button>').join(''):'<p>No service reports yet.</p>')+'</div>';
  $('edit-customer').onclick=()=>openCustomerForm(g);
  $('customer-add-contract').onclick=()=>openContractForm({customer:g.customer,phone:g.phone,email:g.email,location:g.location});
  bindContractActions($('modal-body'));bindVisitActions($('modal-body'));show();
}

function openCustomerForm(g=null) {
  $('modal-title').textContent=g?'Edit customer':'New customer';
  const c=g||{};
  $('modal-body').innerHTML='<form class="form" id="customer-form"><div class="grid">'+field('customer','Customer name',c.customer,true)+field('contact_person','Contact person',c.contact_person)+field('phone','Customer contact number',c.phone,false,'tel')+field('email','Customer email',c.email,false,'email')+field('location','Customer address / default location',c.location)+'<div class="field full"><label for="customer-notes">Customer notes</label><textarea id="customer-notes" name="notes" rows="3">'+esc(c.notes||'')+'</textarea></div></div><p class="maintenance-tip">Customer details are kept with their service history. Previous reports keep the contact and location recorded for that visit.</p><p class="error" id="customer-error" role="alert"></p><div class="actions"><button type="button" class="secondary" onclick="close()">Cancel</button><button class="primary" id="save-customer">Save customer</button></div></form>';
  $('customer-form').onsubmit=async event=>{
    event.preventDefault();$('save-customer').disabled=true;$('customer-error').textContent='';
    const data=Object.fromEntries(new FormData(event.target));
    if(c.id){data.id=c.id;data.revision=c.revision;}else if(g)data.original_name=c.original_name||c.customer;
    try {
      const saved=await request('/api/customers',{method:'POST',body:JSON.stringify(data)});
      close();view='customers';$('search').value='';await load();
      const group=allCustomerGroups().find(item=>item.id===saved.id);
      if(group)customerDetail(group);
      notify('Customer saved');
    }catch(error){$('customer-error').textContent=error.message;$('save-customer').disabled=false;}
  };
  show();$('f-customer').focus();
}
