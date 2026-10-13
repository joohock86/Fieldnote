<?php
declare(strict_types=1);

class CustomerRequestError extends RuntimeException {}
function customerReject(string $message,int $status=400): never {throw new CustomerRequestError($message,$status);}

function customerKey(string $name): string {
 $name=preg_replace('/\s+/u',' ',trim($name));
 return function_exists('mb_strtolower')?mb_strtolower($name,'UTF-8'):strtolower($name);
}
function customerNames(array $profile): array {
 return array_values(array_unique(array_merge([$profile['customer']],$profile['aliases']??[])));
}
function customerForName(string $name): ?array {
 $key=customerKey($name);
 foreach(records('customer')as $profile)foreach(customerNames($profile)as $alias)if(customerKey($alias)===$key)return $profile;
 return null;
}
function saveCustomer(array $input): array {
 global $db,$user;
 $fields=['customer','contact_person','phone','email','location','notes'];$profile=[];
 foreach($fields as $field){$value=$input[$field]??'';if(!is_string($value))customerReject('Invalid customer field: '.$field);$profile[$field]=trim($value);if(strlen($profile[$field])>($field==='notes'?10000:1000))customerReject('Customer field is too long: '.$field);}
 if($profile['customer']==='')customerReject('Customer name is required.');
 if($profile['email']!==''&&!filter_var($profile['email'],FILTER_VALIDATE_EMAIL))customerReject('Use a valid customer email address.');
 $id=$input['id']??null;if($id!==null&&!validId($id))customerReject('Invalid customer ID.');
 $original=$input['original_name']??null;if($original!==null&&!is_string($original))customerReject('Invalid original customer name.');
 if((int)query("SELECT GET_LOCK('fieldnote_customers',10)")->fetchColumn()!==1)customerReject('Customer updates are busy. Try again.',409);
 try{
  $db->beginTransaction();
  $old=$id!==null?record('customer',$id,true):null;
  if($id!==null&&!$old)customerReject('Customer no longer exists. Reload and try again.',404);
  if($old&&($input['revision']??null)!==($old['revision']??null))customerReject('Customer was changed by another user. Reload before editing.',409);
  $aliases=$old?customerNames($old):[];
  if(!$old&&$original!==null){
   $found=false;foreach(array_merge(records('report'),records('contract'))as $r)if(customerKey($r['customer'])===customerKey($original)){$found=true;break;}
   if(!$found)customerReject('Customer history changed. Reload before editing.',409);
   $aliases[]=$original;
  }
  $aliases[]=$profile['customer'];
  $keys=array_map('customerKey',$aliases);
  foreach(records('customer')as $other){
   if(($other['id']??null)===$id)continue;
   foreach(customerNames($other)as $name)if(in_array(customerKey($name),$keys,true))customerReject('A customer already uses this name. Open that customer to edit their details.',409);
  }
  foreach(array_merge(records('report'),records('contract'))as $r){
   if(customerKey($r['customer'])!==customerKey($profile['customer']))continue;
   $belongs=$old?in_array(customerKey($r['customer']),array_map('customerKey',customerNames($old)),true):($original!==null&&customerKey($r['customer'])===customerKey($original));
   if(!$belongs)customerReject('A customer already uses this name. Open that customer to edit their details.',409);
  }
  $profile['id']=$id??uuid();$profile['aliases']=array_values(array_unique($aliases));
  $profile['revision']=uuid();$profile['created_at']=$old['created_at']??gmdate('c');$profile['created_by']=$old['created_by']??$user['id'];
  $profile['updated_at']=gmdate('c');$profile['updated_by']=$user['id'];
  query('INSERT INTO fn_records(kind,id,document) VALUES(?,?,?) ON DUPLICATE KEY UPDATE document=VALUES(document)',['customer',$profile['id'],json_encode($profile,JSON_THROW_ON_ERROR)]);
  $db->commit();return $profile;
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 finally{query("SELECT RELEASE_LOCK('fieldnote_customers')");}
}
