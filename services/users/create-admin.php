<?php
require __DIR__ . '/../common/bootstrap.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$name=trim((string)($argv[1]??''));$email=strtolower(trim((string)($argv[2]??'')));$password=(string)($argv[3]??'');
if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<8){fwrite(STDERR,"Uso: php create-admin.php \"Nombre\" correo@ejemplo.com \"ContrasenaSegura\"\nLa contrasena debe tener al menos 8 caracteres.\n");exit(1);}
try{$q=db()->prepare("INSERT INTO usuarios(nombre,correo,password_hash,rol,activo) VALUES(?,?,?,'administrador',1) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),password_hash=VALUES(password_hash),rol='administrador',activo=1");$q->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT)]);echo "Administrador creado o actualizado correctamente: {$email}\n";}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
