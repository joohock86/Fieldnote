/* Calendar-month recurrence remains anchored to the chosen first visit. */
const maintenance = (() => {
  const intervals = {3:'Quarterly',4:'Every 4 months',6:'Half-yearly',12:'Yearly'};
  function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function addMonths(date, count){
    const [year,month,day]=date.split('-').map(Number);
    const target=new Date(Date.UTC(year,month-1+count,1));
    const max=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
    return `${target.getUTCFullYear()}-${String(target.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(day,max)).padStart(2,'0')}`;
  }
  function visits(contract, reports, now=today()){
    if(!intervals[contract.interval_months]||!contract.first_visit||contract.end_date<contract.first_visit)return [];
    const linked=new Map(reports.filter(r=>r.maintenance_contract_id===contract.id).map(r=>[r.maintenance_due_date,r]));
    const rows=[];
    for(let n=0;;n++){
      const date=addMonths(contract.first_visit,n*Number(contract.interval_months));
      if(date>contract.end_date)break;
      const report=linked.get(date);
      const state=report?.status==='Completed'?'Completed':contract.state!=='Active'?contract.state:date<now?'Overdue':date===now?'Due today':'Upcoming';
      rows.push({contract,date,report,state});
    }
    return rows;
  }
  function contractState(c,now=today()){return c.state!=='Active'?c.state:c.end_date<now?'Expired':c.start_date>now?'Not started':'Active';}
  return {intervals,today,addMonths,visits,contractState};
})();
