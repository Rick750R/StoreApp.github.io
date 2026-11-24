<?php
require __DIR__ . '/../common/bootstrap.php';
function product_data(array $b): array {
    $name=trim((string)($b['nombre']??'')); $desc=trim((string)($b['descripcion']??'')); $cat=trim((string)($b['categoria']??''));
    $price=filter_var($b['precio']??null,FILTER_VALIDATE_FLOAT); $stock=filter_var($b['stock']??null,FILTER_VALIDATE_INT);
    if (mb_strlen($name)<2 || mb_strlen($name)>120) fail('El nombre debe tener entre 2 y 120 caracteres.');
    if (!$desc || mb_strlen($desc)>5000) fail('Agrega una descripción de hasta 5000 caracteres.');
    if (mb_strlen($cat)<2 || mb_strlen($cat)>60) fail('La categoría debe tener entre 2 y 60 caracteres.');
    if ($price===false || $price<0 || $price>99999999) fail('Escribe un precio válido.');
    if ($stock===false || $stock<0 || $stock>1000000) fail('Las existencias deben ser un número entero igual o mayor que cero.');
    return [$name,$desc,$cat,number_format((float)$price,2,'.',''),$stock,!empty($b['destacado'])?1:0,(array_key_exists('activo',$b) && ($b['activo']===false || $b['activo']==='false' || $b['activo']==='0'))?0:1];
}
function image_value(array $b, ?string $existing=null): ?string {
    if (!empty($b['imageData'])) {
        if (!preg_match('#^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$#',(string)$b['imageData'],$m)) fail('El archivo debe ser PNG, JPG o WEBP.');
        $raw=base64_decode($m[2],true); if (!$raw || strlen($raw)>2097152) fail('La imagen no debe superar los 2 MB.');
        $finfo=new finfo(FILEINFO_MIME_TYPE); $mime=$finfo->buffer($raw);
        $ext=['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp'][$mime]??null; if (!$ext) fail('El contenido no coincide con un formato de imagen válido.');
        $dir='/var/www/html/uploads'; if (!is_dir($dir)) mkdir($dir,0775,true); $file=bin2hex(random_bytes(16)).'.'.$ext;
        if (file_put_contents($dir.'/'.$file,$raw,LOCK_EX)===false) fail('No se pudo guardar la imagen.',500);
        return '/uploads/'.$file;
    }
    $url=trim((string)($b['imageUrl']??'')); if ($url==='') return $existing;
    if (strlen($url)>500) fail('La dirección de la imagen no debe superar los 500 caracteres.');
    if (str_starts_with($url,'/uploads/') || filter_var($url,FILTER_VALIDATE_URL) && in_array(parse_url($url,PHP_URL_SCHEME),['http','https'],true)) return $url;
    fail('La imagen debe ser una URL http(s) válida o un archivo de imagen.');
}
try {
    $pdo=db(); $path=path_info(); $verb=method();
    if ($path==='/health') { $pdo->query('SELECT 1'); out(['ok'=>true,'service'=>'productos','database'=>true]); }
    if ($path==='/categories' && $verb==='GET') { $rows=$pdo->query('SELECT DISTINCT categoria FROM productos WHERE activo=1 ORDER BY categoria')->fetchAll(PDO::FETCH_COLUMN); out(['data'=>array_merge(['Todos'],$rows)]); }
    if ($path==='/admin/all' && $verb==='GET') { need_admin(); $rows=$pdo->query('SELECT id,nombre,descripcion,categoria,precio,imagen_url,stock,destacado,activo FROM productos ORDER BY creado_en DESC,id DESC')->fetchAll(); out(['data'=>$rows]); }
    if ($path==='/' && $verb==='GET') {
        $where=['activo=1']; $args=[]; $q=trim((string)($_GET['q']??'')); $cat=trim((string)($_GET['category']??''));
        if ($q!=='') { $where[]='(nombre LIKE ? OR descripcion LIKE ?)'; $args[]="%$q%"; $args[]="%$q%"; }
        if ($cat!=='' && $cat!=='Todos') { $where[]='categoria=?'; $args[]=$cat; }
        foreach(['minPrice'=>'>=','maxPrice'=>'<='] as $key=>$op) if (isset($_GET[$key]) && $_GET[$key]!=='' && is_numeric($_GET[$key])) { $where[]='precio '.$op.' ?'; $args[]=(float)$_GET[$key]; }
        $q1=$pdo->prepare('SELECT id,nombre,descripcion,categoria,precio,imagen_url,stock,destacado FROM productos WHERE '.implode(' AND ',$where).' ORDER BY destacado DESC,nombre ASC'); $q1->execute($args); out(['data'=>$q1->fetchAll()]);
    }
    if ($path==='/' && $verb==='POST') {
        need_admin(); $b=json_input(); [$n,$d,$c,$p,$s,$f,$a]=product_data($b); $img=image_value($b);
        $q=$pdo->prepare('INSERT INTO productos(nombre,descripcion,categoria,precio,imagen_url,stock,destacado,activo) VALUES(?,?,?,?,?,?,?,?)'); $q->execute([$n,$d,$c,$p,$img,$s,$f,$a]); out(['message'=>'Producto agregado correctamente.','data'=>['id'=>(int)$pdo->lastInsertId()]],201);
    }
    if (preg_match('#^/(\d+)$#',$path,$m) && $verb==='GET') { $q=$pdo->prepare('SELECT id,nombre,descripcion,categoria,precio,imagen_url,stock,destacado FROM productos WHERE id=? AND activo=1'); $q->execute([(int)$m[1]]); $row=$q->fetch(); if(!$row) fail('Producto no encontrado.',404); out(['data'=>$row]); }
    if (preg_match('#^/(\d+)$#',$path,$m) && $verb==='PUT') {
        need_admin(); $id=(int)$m[1]; $b=json_input(); [$n,$d,$c,$p,$s,$f,$a]=product_data($b); $q=$pdo->prepare('SELECT imagen_url FROM productos WHERE id=?'); $q->execute([$id]); $old=$q->fetch(); if(!$old) fail('Producto no encontrado.',404); $img=image_value($b,$old['imagen_url']);
        $q=$pdo->prepare('UPDATE productos SET nombre=?,descripcion=?,categoria=?,precio=?,imagen_url=?,stock=?,destacado=?,activo=? WHERE id=?'); $q->execute([$n,$d,$c,$p,$img,$s,$f,$a,$id]); out(['message'=>'Producto actualizado correctamente.']);
    }
    if (preg_match('#^/(\d+)/status$#',$path,$m) && $verb==='PATCH') { need_admin(); $b=json_input(); if(!array_key_exists('activo',$b)||!is_bool($b['activo'])) fail('Indica un producto y un estado válido.'); $q=$pdo->prepare('UPDATE productos SET activo=? WHERE id=?'); $q->execute([$b['activo']?1:0,(int)$m[1]]); if(!$q->rowCount()) { $x=$pdo->prepare('SELECT id FROM productos WHERE id=?');$x->execute([(int)$m[1]]);if(!$x->fetch())fail('Producto no encontrado.',404); } out(['message'=>$b['activo']?'Producto activado.':'Producto desactivado.']); }
    fail('Ruta de productos no encontrada.',404);
} catch(Throwable $e) { route_error($e); }
