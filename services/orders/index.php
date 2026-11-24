<?php
require __DIR__ . '/../common/bootstrap.php';
function clean_field(array $in,string $key,int $max): string { return mb_substr(trim((string)($in[$key]??'')),0,$max); }
function shipping_address(array $in): array {
    $a=['nombre'=>clean_field($in,'nombre',120),'telefono'=>clean_field($in,'telefono',20),'codigoPostal'=>clean_field($in,'codigoPostal',10),'estado'=>clean_field($in,'estado',100),'municipio'=>clean_field($in,'municipio',100),'colonia'=>clean_field($in,'colonia',120),'calle'=>clean_field($in,'calle',150),'numeroExterior'=>clean_field($in,'numeroExterior',20),'numeroInterior'=>clean_field($in,'numeroInterior',20),'referencias'=>clean_field($in,'referencias',500)];
    foreach(['nombre'=>'nombre de quien recibe','telefono'=>'teléfono','codigoPostal'=>'código postal','estado'=>'estado','municipio'=>'municipio o alcaldía','colonia'=>'colonia','calle'=>'calle','numeroExterior'=>'número exterior'] as $k=>$label) if($a[$k]==='') fail("Completa el campo {$label} de la dirección de entrega.");
    $digits=preg_replace('/\D/','',$a['telefono']); if(strlen($digits)<10||strlen($digits)>15)fail('El teléfono debe contener entre 10 y 15 dígitos.');
    if(!preg_match('/^\d{5}$/',$a['codigoPostal']))fail('El código postal debe tener 5 dígitos.'); return $a;
}
function order_select_sql(): string { return "SELECT p.id,p.folio,p.usuario_id,p.cliente_nombre,p.cliente_correo,p.total,p.estado,p.creado_en,p.metodo_pago,p.estado_pago,p.pasarela_pago,p.referencia_pago,p.envio_nombre,p.envio_telefono,p.envio_codigo_postal,p.envio_estado,p.envio_municipio,p.envio_colonia,p.envio_calle,p.envio_numero_exterior,p.envio_numero_interior,p.envio_referencias,pd.id AS detalle_id,pd.producto_id,pd.cantidad,pd.precio_unitario,pr.nombre AS producto_nombre,pr.imagen_url FROM pedidos p LEFT JOIN pedido_detalles pd ON pd.pedido_id=p.id LEFT JOIN productos pr ON pr.id=pd.producto_id"; }
function group_orders(array $rows): array {
    $orders=[]; foreach($rows as $r){$id=(int)$r['id']; if(!isset($orders[$id])){ $o=$r; unset($o['detalle_id'],$o['producto_id'],$o['cantidad'],$o['precio_unitario'],$o['producto_nombre'],$o['imagen_url']); $o['items']=[]; $orders[$id]=$o; }
        if($r['detalle_id']!==null)$orders[$id]['items'][]=['producto_id'=>(int)$r['producto_id'],'nombre'=>$r['producto_nombre']?:'Producto #'.$r['producto_id'],'imagen_url'=>$r['imagen_url'],'cantidad'=>(int)$r['cantidad'],'precio_unitario'=>$r['precio_unitario']];
    } return array_values($orders);
}
try {
    $pdo=db(); $path=path_info(); $verb=method();
    if($path==='/health'){ $pdo->query('SELECT 1'); out(['ok'=>true,'service'=>'pedidos','database'=>true]); }
    if($path==='/' && $verb==='POST'){
        $user=need_user(); $b=json_input(); $items=$b['items']??[]; $payment=(string)($b['paymentMethod']??'');
        if(!in_array($payment,['tarjeta_demo','transferencia_demo'],true))fail('Selecciona un método de pago de demostración válido.');
        if(!is_array($items)||!count($items))fail('Agrega al menos un producto al pedido.'); $a=shipping_address(is_array($b['shippingAddress']??null)?$b['shippingAddress']:[]);
        $normalized=[]; foreach($items as $item){$pid=filter_var($item['productId']??null,FILTER_VALIDATE_INT);$qty=filter_var($item['quantity']??null,FILTER_VALIDATE_INT);if(!$pid||$pid<1||!$qty||$qty<1||$qty>99)fail('Producto o cantidad inválidos.');$normalized[$pid]=($normalized[$pid]??0)+$qty;}
        $pdo->beginTransaction();
        try {
            $lines=[];$total=0;
            foreach($normalized as $pid=>$qty){$q=$pdo->prepare('SELECT id,nombre,precio,stock FROM productos WHERE id=? AND activo=1 FOR UPDATE');$q->execute([$pid]);$p=$q->fetch();if(!$p)fail("El producto {$pid} no existe o está inactivo.",400);if((int)$p['stock']<$qty)fail('No hay existencias suficientes de "'.$p['nombre'].'".',409);$price=(float)$p['precio'];$total+=$price*$qty;$lines[]=['id'=>$pid,'qty'=>$qty,'price'=>$price];}
            $q=$pdo->prepare('SELECT ultimo_pedido_numero FROM usuarios WHERE id=? FOR UPDATE');$q->execute([$user['id']]);$num=(int)$q->fetchColumn()+1;
            $folio='SA-'.$user['id'].'-'.str_pad((string)$num,5,'0',STR_PAD_LEFT);
            $pdo->prepare('UPDATE usuarios SET ultimo_pedido_numero=? WHERE id=?')->execute([$num,$user['id']]);
            $sql="INSERT INTO pedidos(usuario_id,folio,cliente_nombre,cliente_correo,total,estado,metodo_pago,estado_pago,envio_nombre,envio_telefono,envio_codigo_postal,envio_estado,envio_municipio,envio_colonia,envio_calle,envio_numero_exterior,envio_numero_interior,envio_referencias) VALUES(?,?,?,?,?,'pendiente',?,'pendiente',?,?,?,?,?,?,?,?,?,?)";
            $q=$pdo->prepare($sql);$q->execute([$user['id'],$folio,$user['nombre'],$user['correo'],number_format($total,2,'.',''),$payment,$a['nombre'],$a['telefono'],$a['codigoPostal'],$a['estado'],$a['municipio'],$a['colonia'],$a['calle'],$a['numeroExterior'],$a['numeroInterior']?:null,$a['referencias']?:null]);$orderId=(int)$pdo->lastInsertId();
            foreach($lines as $line){$pdo->prepare('INSERT INTO pedido_detalles(pedido_id,producto_id,cantidad,precio_unitario) VALUES(?,?,?,?)')->execute([$orderId,$line['id'],$line['qty'],number_format($line['price'],2,'.','')]);$pdo->prepare('UPDATE productos SET stock=stock-? WHERE id=?')->execute([$line['qty'],$line['id']]);}
            $pdo->commit();out(['message'=>'Pedido registrado correctamente. Completa el proceso de pago para confirmar tu compra.','data'=>['orderId'=>$orderId,'folio'=>$folio,'total'=>round($total,2),'status'=>'pendiente','paymentStatus'=>'pendiente']],201);
        } catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    if($path==='/my' && $verb==='GET'){$u=need_user();$q=$pdo->prepare(order_select_sql().' WHERE p.usuario_id=? ORDER BY p.creado_en DESC,p.id DESC,pd.id ASC');$q->execute([$u['id']]);out(['data'=>group_orders($q->fetchAll())]);}
    if(preg_match('#^/(\d+)/payment-simulation$#',$path,$m)&&$verb==='POST'){
        $u=need_user();$id=(int)$m[1];$b=json_input();$result=(string)($b['result']??'');if(!in_array($result,['approved','rejected'],true))fail('Indica un pedido y un resultado de simulación válido.');
        $q=$pdo->prepare('SELECT id,metodo_pago,estado_pago FROM pedidos WHERE id=? AND usuario_id=? LIMIT 1');$q->execute([$id,$u['id']]);$order=$q->fetch();if(!$order)fail('No se encontró el pedido de esta cuenta.',404);if(!in_array($order['metodo_pago'],['tarjeta_demo','transferencia_demo'],true))fail('Este pedido no tiene un método de pago válido.');if(in_array($order['estado_pago'],['aprobado_simulado','aprobado'],true))fail('Este pedido ya cuenta con un pago aprobado.',409);
        $status=$result==='approved'?'aprobado_simulado':'rechazado_simulado';$ref='SIM-'.$id.'-'.round(microtime(true)*1000);$q=$pdo->prepare("UPDATE pedidos SET estado=CASE WHEN ?='aprobado_simulado' THEN 'confirmado' ELSE estado END,estado_pago=?,pasarela_pago='storeapp_demo',referencia_pago=? WHERE id=? AND usuario_id=?");$q->execute([$status,$status,$ref,$id,$u['id']]);out(['message'=>$result==='approved'?'Pago aprobado correctamente.':'No fue posible aprobar el pago. Puedes intentarlo nuevamente desde Mis pedidos.','data'=>['orderId'=>$id,'paymentStatus'=>$status,'reference'=>$ref]]);
    }
    if($path==='/admin/all'&&$verb==='GET'){need_admin();$rows=$pdo->query(order_select_sql().' ORDER BY p.creado_en DESC,p.id DESC,pd.id ASC')->fetchAll();out(['data'=>group_orders($rows)]);}
    if(preg_match('#^/(\d+)/status$#',$path,$m)&&$verb==='PATCH'){need_admin();$id=(int)$m[1];$b=json_input();$status=(string)($b['estado']??'');if(!in_array($status,['pendiente','confirmado','preparando','enviado','entregado'],true))fail('Indica un pedido y un estado válido.');$q=$pdo->prepare('UPDATE pedidos SET estado=? WHERE id=?');$q->execute([$status,$id]);$x=$pdo->prepare('SELECT id FROM pedidos WHERE id=?');$x->execute([$id]);if(!$x->fetch())fail('No se encontró el pedido.',404);out(['message'=>'El estado del pedido se actualizó correctamente.','data'=>['id'=>$id,'estado'=>$status]]);}
    if(preg_match('#^/(\d+)$#',$path,$m)&&$verb==='DELETE'){
        need_admin();$id=(int)$m[1];$pdo->beginTransaction();try{$q=$pdo->prepare('SELECT id FROM pedidos WHERE id=? FOR UPDATE');$q->execute([$id]);if(!$q->fetch())fail('No se encontró el pedido.',404);$q=$pdo->prepare('SELECT producto_id,cantidad FROM pedido_detalles WHERE pedido_id=? FOR UPDATE');$q->execute([$id]);foreach($q->fetchAll() as $d)$pdo->prepare('UPDATE productos SET stock=stock+? WHERE id=?')->execute([$d['cantidad'],$d['producto_id']]);$pdo->prepare('DELETE FROM pedido_detalles WHERE pedido_id=?')->execute([$id]);$pdo->prepare('DELETE FROM pedidos WHERE id=?')->execute([$id]);$pdo->commit();out(['message'=>"El pedido #{$id} se canceló y eliminó. Las existencias se devolvieron al inventario.",'data'=>['id'=>$id,'deleted'=>true,'stockRestored'=>true]]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    fail('Ruta de pedidos no encontrada.',404);
} catch(Throwable $e) { route_error($e); }
