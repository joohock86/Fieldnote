<?php
declare(strict_types=1);
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $status, mixed $body): never {http_response_code($status);header('Content-Type: application/json');echo json_encode($body,JSON_THROW_ON_ERROR);exit;}
function fail(string $message, int $status=400): never {respond($status,['error'=>$message]);}
function query(string $sql, array $values=[]): PDOStatement {global $db;$q=$db->prepare($sql);$q->execute($values);return $q;}
function uuid(): string {$v=random_bytes(16);$v[6]=chr((ord($v[6])&15)|64);$v[8]=chr((ord($v[8])&63)|128);$h=bin2hex($v);return substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20);}
function validId(mixed $id): bool {return is_string($id)&&preg_match('/^[0-9a-f-]{36}$/D',$id)===1;}
function validDate(mixed $date): bool {if(!is_string($date))return false;$d=DateTimeImmutable::createFromFormat('!Y-m-d',$date);return $d!==false&&$d->format('Y-m-d')===$date;}
function input(): array {try {$v=json_decode(file_get_contents('php://input'),true,64,JSON_THROW_ON_ERROR);}catch(Throwable $e){fail('Invalid JSON.');}if(!is_array($v))fail('Invalid request.');return $v;}
function record(string $kind,string $id,bool $lock=false): ?array {$row=query('SELECT document FROM fn_records WHERE kind=? AND id=?'.($lock?' FOR UPDATE':''),[$kind,$id])->fetchColumn();return $row===false?null:json_decode($row,true,64,JSON_THROW_ON_ERROR);}
function records(string $kind): array {return array_map(fn($r)=>json_decode($r,true,64,JSON_THROW_ON_ERROR),query('SELECT document FROM fn_records WHERE kind=?',[$kind])->fetchAll(PDO::FETCH_COLUMN));}
function attachmentPath(mixed $p): string {global $cfg;if(!is_string($p)||preg_match('/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/D',$p)!==1)fail('Invalid attachment reference.');return rtrim($cfg['files'],'/').'/'.$p;}
function onSchedule(array $c,string $date): bool {
 if(!validDate($date)||$date<$c['first_visit']||$date>$c['end_date'])return false;
 $first=new DateTimeImmutable($c['first_visit']);$due=new DateTimeImmutable($date);
 $months=((int)$due->format('Y')-(int)$first->format('Y'))*12+(int)$due->format('n')-(int)$first->format('n');
 if($months<0||$months%(int)$c['interval_months']!==0)return false;
 $base=$first->modify('first day of this month')->modify('+'.$months.' months');
 $expected=$base->setDate((int)$base->format('Y'),(int)$base->format('n'),min((int)$first->format('j'),(int)$base->format('t')));
 return $expected->format('Y-m-d')===$date;
}
function saveRecord(string $kind,array $v,bool $import=false): array {
 global $db,$user;
 $id=$v['id']??uuid();if(!validId($id))fail('Invalid record ID.');
 $db->beginTransaction();
 try{
 $old=record($kind,$id,true);
 $fields=$kind==='contract'?['name','customer','phone','email','location','equipment','serial','start_date','end_date','first_visit','interval_months','state','notes']:['customer','phone','email','contact','location','equipment','serial','technician','date','action','status','parts','notes','photos','maintenance_contract_id','maintenance_due_date'];
 $v=array_intersect_key($v,array_flip(array_merge($fields,['id','created_at','created_by','updated_at','updated_by'])));
 foreach($kind==='contract'?['name','customer','equipment']:['customer','equipment','technician'] as $f)if(!is_string($v[$f]??null)||trim($v[$f])==='')fail('Required field missing: '.$f);
 if($kind==='contract'){
 $v['interval_months']=(int)($v['interval_months']??0);
 if(!in_array($v['interval_months'],[3,4,6,12],true)||!in_array($v['state']??'',['Active','Paused','Cancelled'],true))fail('Invalid contract schedule.');
 foreach(['start_date','end_date','first_visit']as $f)if(!validDate($v[$f]??null))fail('Invalid contract date.');
 if($v['first_visit']<$v['start_date']||$v['first_visit']>$v['end_date'])fail('First visit must be within the contract period.');
 foreach(records('report')as $r)if(($r['maintenance_contract_id']??null)===$id){if($old&&($old['first_visit']!==$v['first_visit']||(int)$old['interval_months']!==$v['interval_months']))fail('Create a new contract to change a schedule with service history.');if($r['maintenance_due_date']<$v['start_date']||$r['maintenance_due_date']>$v['end_date'])fail('Contract dates must include recorded visits.');}
 }else{
 if(!validDate($v['date']??null)||!in_array($v['action']??'',['Repair','Maintenance','Installation','Deliver','Others'],true)||!in_array($v['status']??'',['Completed','In progress','Follow-up'],true))fail('Invalid report details.');
 $v['photos']=$v['photos']??[];if(!is_array($v['photos']))fail('Invalid attachments.');foreach($v['photos']as $p){$file=attachmentPath($p);if(!$import&&!is_file($file))fail('Attachment missing.');}
 $cid=$v['maintenance_contract_id']??null;$due=$v['maintenance_due_date']??null;
 if(($cid===null)!==($due===null))fail('A maintenance visit requires its contract and due date.');
 if($old&&(($old['maintenance_contract_id']??null)!==$cid||($old['maintenance_due_date']??null)!==$due))fail('Saved reports cannot be reassigned.');
 if($cid!==null){if(!validId($cid)||!validDate($due))fail('Invalid visit reference.');$c=record('contract',$cid,true);if(!$c||$v['action']!=='Maintenance'||!onSchedule($c,$due))fail('Report must match a scheduled maintenance visit.');query('INSERT INTO fn_visit_slots(contract_id,due_date,report_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE report_id=report_id',[$cid,$due,$id]);$slot=query('SELECT report_id FROM fn_visit_slots WHERE contract_id=? AND due_date=?',[$cid,$due])->fetchColumn();if($slot!==$id)fail('A report already exists for this visit.');}
 }
 $v['id']=$id;$v['created_at']=$old['created_at']??($import?($v['created_at']??gmdate('c')):gmdate('c'));$v['created_by']=$old['created_by']??($import?($v['created_by']??null):$user['id']);$v['updated_at']=$import?($v['updated_at']??gmdate('c')):gmdate('c');$v['updated_by']=$import?($v['updated_by']??null):$user['id'];
 query('INSERT INTO fn_records(kind,id,document) VALUES(?,?,?) ON DUPLICATE KEY UPDATE document=VALUES(document)',[$kind,$id,json_encode($v,JSON_THROW_ON_ERROR)]);$db->commit();return $v;
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
try{
 $configFile=__DIR__.'/config-path.php';if(!is_file($configFile))fail('Server setup required: configure config-path.php.',503);
 $path=require $configFile;if(!is_string($path)||!is_file($path))fail('Private configuration not found.',503);$cfg=require $path;
 $db=new PDO($cfg['dsn'],$cfg['db_user'],$cfg['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
 $action=$_GET['action']??'';$method=$_SERVER['REQUEST_METHOD'];
 if($method!=='GET'){
 $origin=$_SERVER['HTTP_ORIGIN']??'';$host=$_SERVER['HTTP_HOST']??'';
 if($origin!==''&&parse_url($origin,PHP_URL_HOST)!==explode(':',$host)[0])fail('Cross-site request rejected.',403);
 if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site')fail('Cross-site request rejected.',403);
 }
 if($action==='setup'&&$method==='POST'){
 $v=input();if(strlen($cfg['setup_key'])<32||str_starts_with($cfg['setup_key'],'REPLACE_')||!hash_equals($cfg['setup_key'],(string)($v['setup_key']??'')))fail('Invalid setup key.',403);
 // The advisory lock prevents two setup requests from creating competing administrators.
 if((int)query("SELECT GET_LOCK('fieldnote_setup',10)")->fetchColumn()!==1)fail('Setup is busy. Try again.',409);
 if((int)query('SELECT COUNT(*) FROM fn_users')->fetchColumn()>0)fail('Setup already completed.',403);
 if(count($v['users']??[])!==2)fail('Create two users.');
 $db->beginTransaction();foreach($v['users']as $i=>$u){$email=strtolower(trim($u['email']??''));if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($u['password']??'')<12)fail('Use valid emails and passwords of at least 12 characters.');query('INSERT INTO fn_users(id,email,password_hash,is_admin) VALUES(?,?,?,?)',[uuid(),$email,password_hash($u['password'],PASSWORD_DEFAULT),$i===0?1:0]);}$db->commit();respond(201,['ok'=>true]);
 }
 if($action==='login'&&$method==='POST'){
 $v=input();$rate=hash('sha256',($_SERVER['REMOTE_ADDR']??'unknown'));query('INSERT INTO fn_login_limits(bucket,attempts,started_at) VALUES(?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(started_at<UTC_TIMESTAMP()-INTERVAL 15 MINUTE,1,attempts+1),started_at=IF(started_at<UTC_TIMESTAMP()-INTERVAL 15 MINUTE,UTC_TIMESTAMP(),started_at)',[$rate]);if((int)query('SELECT attempts FROM fn_login_limits WHERE bucket=?',[$rate])->fetchColumn()>20)fail('Too many sign-in attempts. Try again in 15 minutes.',429);$user=query('SELECT * FROM fn_users WHERE email=?',[strtolower(trim($v['email']??''))])->fetch(PDO::FETCH_ASSOC);
 if(!$user||!password_verify((string)($v['password']??''),$user['password_hash'])){usleep(500000);fail('Email or password is incorrect.',401);}
 $token=bin2hex(random_bytes(32));$remember=!empty($v['remember']);$expiry=time()+($remember?60*60*24*90:60*60*24);
 query('INSERT INTO fn_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash('sha256',$token),$user['id'],gmdate('Y-m-d H:i:s',$expiry)]);
 setcookie('fieldnote_session',$token,['expires'=>$remember?$expiry:0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);respond(200,['id'=>$user['id'],'email'=>$user['email'],'is_admin'=>(bool)$user['is_admin']]);
 }
 $token=$_COOKIE['fieldnote_session']??'';
 $user=query('SELECT u.* FROM fn_users u JOIN fn_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',[hash('sha256',$token),gmdate('Y-m-d H:i:s')])->fetch(PDO::FETCH_ASSOC);
 if(!$user)fail('Please sign in.',401);
 if($action==='me')respond(200,['id'=>$user['id'],'email'=>$user['email'],'is_admin'=>(bool)$user['is_admin']]);
 if($action==='logout'&&$method==='POST'){query('DELETE FROM fn_sessions WHERE token_hash=?',[hash('sha256',$token)]);setcookie('fieldnote_session','',['expires'=>1,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);respond(200,['ok'=>true]);}
 if(in_array($action,['reports','contracts'],true)){$kind=$action==='reports'?'report':'contract';if($method==='GET')respond(200,records($kind));if($method==='POST')respond(201,saveRecord($kind,input()));}
 if($action==='import-record'&&$method==='POST'){if(!$user['is_admin'])fail('Administrator only.',403);$v=input();if(!in_array($v['kind']??'',['contract','report'],true))fail('Invalid import type.');respond(201,saveRecord($v['kind'],$v['record'],true));}
 if(in_array($action,['upload','import-file'],true)&&$method==='POST'){
 if($action==='import-file'&&!$user['is_admin'])fail('Administrator only.',403);
 $mime=explode(';',$_SERVER['CONTENT_TYPE']??'')[0];$ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','application/pdf'=>'pdf'][$mime]??null;if(!$ext)fail('Unsupported attachment.');
 $body=file_get_contents('php://input',false,null,0,10485761);if(strlen($body)>10485760||$body==='')fail('Attachment must be under 10 MB.');
 $actual=(new finfo(FILEINFO_MIME_TYPE))->buffer($body);if($actual!==$mime)fail('Attachment content does not match its type.');
 $ref=$action==='import-file'?($_GET['path']??''):$user['id'].'/'.uuid().'.'.$ext;$dest=attachmentPath($ref);
 if(!str_ends_with($ref,'.'.$ext))fail('Invalid attachment extension.');
 if(!is_dir(dirname($dest))&&!mkdir(dirname($dest),0700,true))fail('Could not create file storage.',500);
 if(is_file($dest)&&!hash_equals(hash_file('sha256',$dest),hash('sha256',$body)))fail('A different attachment already uses this path.',409);
 if(file_put_contents($dest,$body,LOCK_EX)===false)fail('Could not save attachment.',500);chmod($dest,0600);respond(201,['url'=>$ref,'sha256'=>hash_file('sha256',$dest)]);
 }
 if($action==='file'&&$method==='GET'){$file=attachmentPath($_GET['path']??'');if(!is_file($file))fail('File not found.',404);$ext=pathinfo($file,PATHINFO_EXTENSION);header('Content-Type: '.['jpg'=>'image/jpeg','png'=>'image/png','webp'=>'image/webp','pdf'=>'application/pdf'][$ext]);header('Content-Disposition: inline; filename="'.basename($file).'"');readfile($file);exit;}
 if($action==='verify'&&$method==='GET'){if(!$user['is_admin'])fail('Administrator only.',403);$reports=records('report');$contracts=records('contract');$refs=[];foreach($reports as $r)foreach($r['photos']??[]as $p)$refs[$p]=true;$missing=[];foreach(array_keys($refs)as $p)if(!is_file(attachmentPath($p)))$missing[]=$p;respond(200,['reports'=>count($reports),'contracts'=>count($contracts),'attachments'=>count($refs),'missing'=>$missing,'stored_files'=>is_dir($cfg['files'])?iterator_count(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($cfg['files'],FilesystemIterator::SKIP_DOTS))):0]);}
 fail('Not found.',404);
}catch(PDOException $e){if(isset($db)&&$db->inTransaction())$db->rollBack();error_log('Fieldnote database error: '.$e->getCode());fail('Database operation failed. Check configuration and schema, or conflicting visit records.',500);}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();error_log('Fieldnote server error: '.$e->getMessage());fail('Server operation failed. Check the hosting error log.',500);}
