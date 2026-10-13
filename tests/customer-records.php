<?php
declare(strict_types=1);
// Isolated storage boundary test: no connection to production or a real database.
function uuid(): string {return sprintf('00000000-0000-4000-8000-%012d',++$GLOBALS['sequence']);}
function validId(mixed $id): bool {return is_string($id)&&preg_match('/^[0-9a-f-]{36}$/D',$id)===1;}
$sequence=0;$store=['customer'=>[],'report'=>[],'contract'=>[]];$user=['id'=>'test-user'];$released=0;$lockAvailable=true;
class TestDatabase {
 private ?array $snapshot=null;
 function beginTransaction(): void {$this->snapshot=$GLOBALS['store'];}
 function inTransaction(): bool {return $this->snapshot!==null;}
 function commit(): void {$this->snapshot=null;}
 function rollBack(): void {$GLOBALS['store']=$this->snapshot;$this->snapshot=null;}
}
$db=new TestDatabase();
function records(string $kind): array {return array_values($GLOBALS['store'][$kind]);}
function record(string $kind,string $id,bool $lock=false): ?array {return $GLOBALS['store'][$kind][$id]??null;}
function query(string $sql,array $values=[]): object {
 if(str_contains($sql,'GET_LOCK'))return new class {function fetchColumn(): int {return $GLOBALS['lockAvailable']?1:0;}};
 if(str_contains($sql,'RELEASE_LOCK'))$GLOBALS['released']++;
 elseif(str_starts_with($sql,'INSERT INTO fn_records'))$GLOBALS['store'][$values[0]][$values[1]]=json_decode($values[2],true,64,JSON_THROW_ON_ERROR);
 else throw new RuntimeException('Unexpected storage operation: '.$sql);
 return new stdClass();
}
require __DIR__.'/../cpanel/public/customer-records.php';
function check(bool $ok,string $reason): void {if(!$ok)throw new RuntimeException($reason);}
function reject(array $input,int $status): void {
 global $store,$db;
 $before=$store;
 try{saveCustomer($input);throw new RuntimeException('Invalid update was accepted');}
 catch(CustomerRequestError $error){check($error->getCode()===$status,'Wrong rejection status');}
 check($store===$before,'Rejected change modified records');check(!$db->inTransaction(),'Transaction left open');
}
$new=saveCustomer(['customer'=>' New Example Co ','phone'=>'12345','email'=>'team@example.com','aliases'=>['Injected alias'],'is_admin'=>true]);
check($new['customer']==='New Example Co','Customer trimming');
check($new['aliases']===['New Example Co']&&!isset($new['is_admin']),'Whitelist and server-owned aliases');
check(customerForName(' new example CO ')['id']===$new['id'],'Canonical name lookup');
reject(['customer'=>'NEW EXAMPLE CO'],409);
reject(['customer'=>'Invalid','email'=>'not-an-email'],400);
reject(['customer'=>''],400);
reject(['customer'=>['Invalid']],400);
reject(['customer'=>'Missing','id'=>uuid(),'revision'=>uuid()],404);
$store['report']['report-1']=['customer'=>'Legacy Example','phone'=>'Original phone','photos'=>['original-attachment.pdf']];
$store['contract']['contract-1']=['customer'=>'Legacy Example','name'=>'Original contract'];
reject(['customer'=>'Legacy Example'],409);
$legacy=saveCustomer(['customer'=>'Renamed Example','original_name'=>'Legacy Example','phone'=>'Current phone']);
check(customerForName('Legacy Example')['id']===$legacy['id'],'Old name must stay linked');
check($store['report']['report-1']['customer']==='Legacy Example'&&$store['report']['report-1']['phone']==='Original phone','Historical report changed');
check($store['contract']['contract-1']['customer']==='Legacy Example','Historical contract changed');
reject(['customer'=>'New Example Co','id'=>$legacy['id'],'revision'=>$legacy['revision']],409);
$updated=saveCustomer(['customer'=>'Renamed Again','id'=>$legacy['id'],'revision'=>$legacy['revision'],'phone'=>'New number','email'=>'new@example.com']);
check(customerForName('Legacy Example')['id']===$updated['id']&&customerForName('Renamed Example')['id']===$updated['id'],'Renames must retain all history aliases');
check($updated['created_at']===$legacy['created_at']&&$updated['revision']!==$legacy['revision'],'Audit/revision updates');
reject(['customer'=>'Stale overwrite','id'=>$legacy['id'],'revision'=>$legacy['revision']],409);
reject(['customer'=>'Bogus rename','original_name'=>'Missing history'],409);
$store['report']['report-2']=['customer'=>'Another legacy customer'];
reject(['customer'=>'Another legacy customer','id'=>$updated['id'],'revision'=>$updated['revision']],409);
$lockAvailable=false;reject(['customer'=>'Busy Example'],409);$lockAvailable=true;
check($released>0,'Directory lock not released');
echo "Customer storage checks passed: create/edit, legacy links, rename history, duplicates, validation, revision conflicts, rollback, and lock handling.\n";
