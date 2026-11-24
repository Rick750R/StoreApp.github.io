<?php
require __DIR__ . '/../common/bootstrap.php';
try {
    $pdo = db(); $path = path_info(); $verb = method(); $body = json_input();
    if ($path === '/health') { $pdo->query('SELECT 1'); out(['ok'=>true,'service'=>'usuarios','database'=>true]); }
    if ($path === '/payment-info' && $verb === 'GET') out([
        'bank'=>getenv('STORE_TRANSFER_BANK') ?: 'Banco de ejemplo',
        'beneficiary'=>getenv('STORE_TRANSFER_BENEFICIARY') ?: 'Beneficiario de ejemplo',
        'clabe'=>getenv('STORE_TRANSFER_CLABE') ?: '', 'account'=>getenv('STORE_TRANSFER_ACCOUNT') ?: ''
    ]);
    if ($path === '/me' && $verb === 'GET') { $u=current_user(); out(['authenticated'=>(bool)$u,'user'=>$u]); }
    if ($path === '/register' && $verb === 'POST') {
        $name=trim((string)($body['nombre']??'')); $email=strtolower(trim((string)($body['correo']??''))); $password=(string)($body['password']??'');
        if (mb_strlen($name)<2 || mb_strlen($name)>120) fail('El nombre debe tener entre 2 y 120 caracteres.');
        if (strlen($email)>190 || !filter_var($email,FILTER_VALIDATE_EMAIL)) fail('Escribe un correo electrónico válido.');
        if (strlen($password)<8 || strlen($password)>128) fail('La contraseña debe tener entre 8 y 128 caracteres.');
        $hash=password_hash($password,PASSWORD_DEFAULT);
        try { $q=$pdo->prepare("INSERT INTO usuarios(nombre,correo,password_hash,rol) VALUES(?,?,?,'cliente')"); $q->execute([$name,$email,$hash]); }
        catch(PDOException $e) { if ($e->getCode()==='23000') fail('Ya existe una cuenta registrada con ese correo.',409); throw $e; }
        $id=(int)$pdo->lastInsertId(); start_session($id); out(['message'=>'Tu cuenta se creó correctamente.','user'=>['id'=>$id,'nombre'=>$name,'correo'=>$email,'rol'=>'cliente']],201);
    }
    if ($path === '/login' && $verb === 'POST') {
        $email=strtolower(trim((string)($body['correo']??''))); $password=(string)($body['password']??'');
        if (!$email || !$password) fail('Escribe tu correo y contraseña.');
        $q=$pdo->prepare('SELECT id,nombre,correo,password_hash,rol FROM usuarios WHERE correo=? AND activo=1 LIMIT 1'); $q->execute([$email]); $u=$q->fetch();
        if (!$u || !password_verify($password,$u['password_hash'])) fail('El correo o la contraseña son incorrectos.',401);
        start_session((int)$u['id']); unset($u['password_hash']); out(['message'=>'Sesión iniciada correctamente.','user'=>$u]);
    }
    if ($path === '/logout' && $verb === 'POST') {
        $token=cookie_token(); if ($token) { $q=$pdo->prepare('DELETE FROM sesiones WHERE token_hash=?'); $q->execute([hash('sha256',$token)]); }
        clear_session_cookie(); out(['message'=>'Sesión cerrada.']);
    }
    fail('Ruta de usuarios no encontrada.',404);
} catch(Throwable $e) { route_error($e); }
