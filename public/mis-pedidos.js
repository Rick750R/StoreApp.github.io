const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
const paymentDialog = $('#payment-dialog');
let currentPaymentOrder = null;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'No se pudo completar la solicitud.');
  return payload;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function setMessage(text = '', type = '') {
  const box = $('#orders-message');
  box.textContent = text;
  box.className = `message ${type}`.trim();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || 'Fecha no disponible');
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function orderStatusLabel(status) {
  const labels = {
    pendiente: 'Pendiente de revisión', confirmado: 'Confirmado', preparando: 'Preparando pedido',
    enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
    pendiente_pago: 'Pendiente de pago (anterior)', pagado: 'Pagado (anterior)', rechazado: 'Rechazado (anterior)'
  };
  return labels[status] || 'Estado no identificado';
}

function paymentMethodLabel(method) {
  const labels = {
    tarjeta_demo: 'Tarjeta bancaria',
    transferencia_demo: 'Transferencia bancaria',
    sin_especificar: 'No registrado (pedido anterior)'
  };
  return labels[method] || method || 'No especificado';
}

function paymentStatusLabel(status) {
  const labels = {
    pendiente: 'Pendiente de pago', aprobado_simulado: 'Aprobado',
    rechazado_simulado: 'Rechazado', aprobado: 'Pagado',
    rechazado: 'Rechazado', reembolsado: 'Reembolsado'
  };
  return labels[status] || 'No identificado';
}

function renderAddress(order) {
  if (!order.envio_calle) {
    return '<div class="order-shipping"><strong>Dirección de entrega</strong><p>Este pedido es anterior al registro de direcciones de entrega.</p></div>';
  }
  const street = `${order.envio_calle} ${order.envio_numero_exterior || ''}${order.envio_numero_interior ? `, interior ${order.envio_numero_interior}` : ''}`;
  const location = `${order.envio_colonia}, ${order.envio_municipio}, ${order.envio_estado}, C.P. ${order.envio_codigo_postal}`;
  return `<div class="order-shipping"><strong>Dirección de entrega</strong><p>${escapeHtml(order.envio_nombre)} · ${escapeHtml(order.envio_telefono)}</p><p>${escapeHtml(street)}</p><p>${escapeHtml(location)}</p>${order.envio_referencias ? `<p><span>Referencias:</span> ${escapeHtml(order.envio_referencias)}</p>` : ''}</div>`;
}

function renderOrders(orders) {
  const list = $('#orders-list');
  if (!orders.length) {
    list.innerHTML = '<div class="empty-state orders-empty"><strong>Aún no tienes pedidos.</strong><p>Cuando realices una compra con esta cuenta, aparecerá aquí.</p><a class="primary-link" href="/#catalogo">Explorar catálogo <span aria-hidden="true">→</span></a></div>';
    return;
  }

  list.innerHTML = orders.map((order) => {
    const statusClass = String(order.estado || '').replace(/[^a-z_]/g, '');
    const paymentClass = String(order.estado_pago || '').replace(/[^a-z_]/g, '');
    const items = Array.isArray(order.items) ? order.items : [];
    const articleCount = items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
    const canSimulatePayment = ['pendiente', 'rechazado_simulado'].includes(order.estado_pago) && ['tarjeta_demo', 'transferencia_demo'].includes(order.metodo_pago);
    return `
      <article class="order-card">
        <div class="order-card-header">
          <div class="order-heading-main"><span class="order-overline">Número de pedido</span><h3>Pedido #${escapeHtml(order.id)}</h3><time>${escapeHtml(formatDate(order.creado_en))}</time></div>
          <div class="order-heading-total"><strong>${money(order.total)}</strong><span class="order-status status-${statusClass}">${escapeHtml(orderStatusLabel(order.estado))}</span></div>
        </div>
        <div class="order-items">${items.map((item) => `
          <div class="order-item"><img src="${escapeHtml(item.imagen_url || '')}" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/90x90/f3f5fa/6d7890?text=Producto'">
            <div class="order-item-info"><strong>${escapeHtml(item.nombre)}</strong><span>${Number(item.cantidad)} × ${money(item.precio_unitario)}</span></div>
            <strong class="order-item-subtotal">${money(Number(item.cantidad) * Number(item.precio_unitario))}</strong></div>`).join('')}
        </div>
        ${renderAddress(order)}
        <div class="payment-info"><span>Método: <strong>${escapeHtml(paymentMethodLabel(order.metodo_pago))}</strong></span><span>Pago: <strong class="payment-state ${paymentClass}">${escapeHtml(paymentStatusLabel(order.estado_pago))}</strong></span></div>
        ${canSimulatePayment ? `<div class="order-payment-action"><button class="secondary-button" type="button" data-pay-order="${escapeHtml(order.id)}">Completar pago</button></div>` : ''}
        <div class="order-card-footer"><span>${articleCount} artículo${articleCount === 1 ? '' : 's'}</span><span>Total del pedido: <strong>${money(order.total)}</strong></span></div>
      </article>`;
  }).join('');
}

async function loadOrders() {
  const button = $('#refresh-orders');
  button.disabled = true;
  button.textContent = 'Actualizando…';
  $('#orders-list').innerHTML = '<div class="empty-state">Cargando tus pedidos…</div>';
  setMessage();
  try {
    const result = await api('/api/orders/my');
    renderOrders(result.data || []);
  } catch (error) {
    $('#orders-list').innerHTML = '';
    setMessage(error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Actualizar pedidos';
  }
}

function openPaymentSimulation(order) {
  currentPaymentOrder = { id: Number(order.id), folio: order.folio, total: Number(order.total), method: order.metodo_pago };
  $('#payment-order-summary').innerHTML = `<strong>Folio ${escapeHtml(order.folio || order.id)}</strong><span>Total a pagar: ${money(order.total)}</span>`;
  $('#payment-demo-message').textContent = '';
  $('#payment-demo-message').className = 'message';
  $('#orders-payment-entry').classList.remove('hidden');
  $('#orders-card-fields').classList.toggle('hidden', order.metodo_pago !== 'tarjeta_demo');
  $('#orders-transfer-fields').classList.toggle('hidden', order.metodo_pago !== 'transferencia_demo');
  $('#orders-transfer-reference').textContent = order.folio || `SA-${String(order.id).padStart(6, '0')}`;
  $('#orders-transfer-amount').textContent = money(order.total);
  loadOrdersTransferInfo();
  $('#orders-submit-payment').textContent = order.metodo_pago === 'transferencia_demo' ? 'Confirmar transferencia' : 'Pagar ahora';
  $('#orders-submit-payment').disabled = false;
  ['orders-card-holder','orders-card-number','orders-card-expiry','orders-card-cvv'].forEach((id) => { const field = document.getElementById(id); if (field) field.value = ''; });
  $('#orders-card-preview-number').textContent = '•••• •••• •••• ••••';
  $('#orders-card-preview-name').textContent = 'NOMBRE DEL TITULAR';
  $('#orders-card-preview-expiry').textContent = 'MM/AA';
  paymentDialog.showModal();
}

async function runPaymentSimulation(result) {
  if (!currentPaymentOrder) return;
  const button = $('#orders-submit-payment');
  const message = $('#payment-demo-message');
  button.disabled = true;
  button.textContent = 'Procesando pago…';
  message.textContent = 'Estamos procesando tu operación…';
  message.className = 'message';
  try {
    const response = await api(`/api/orders/${currentPaymentOrder.id}/payment-simulation`, {
      method: 'POST', body: JSON.stringify({ result })
    });
    message.textContent = result === 'approved'
      ? `¡Pago realizado correctamente! Referencia: ${response.data?.reference || 'STOREAPP'}. Este comprobante permanecerá visible hasta que cierres esta ventana.`
      : 'No fue posible aprobar el pago. Verifica los datos o intenta nuevamente.';
    message.className = `message ${result === 'approved' ? 'success' : 'error'}`;
    if (result === 'approved') {
      button.textContent = 'Pago completado';
      await loadOrders();
    } else {
      button.disabled = false;
      button.textContent = 'Intentar nuevamente';
    }
  } catch (error) {
    message.textContent = error.message;
    message.className = 'message error';
    button.disabled = false;
    button.textContent = 'Intentar nuevamente';
  }
}

async function loadOrdersTransferInfo() {
  try {
    const info = await api('/api/payment-info');
    $('#orders-transfer-bank').textContent = info.bank || 'No configurado';
    $('#orders-transfer-beneficiary').textContent = info.beneficiary || 'No configurado';
    $('#orders-transfer-clabe').textContent = info.clabe || 'No configurado';
    $('#orders-transfer-account').textContent = info.account || '';
    $('#orders-transfer-account-row').classList.toggle('hidden', !info.account);
  } catch (_) {
    ['orders-transfer-bank','orders-transfer-beneficiary','orders-transfer-clabe'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = 'No disponible'; });
  }
}

function getOrdersCardResult() {
  const holder = $('#orders-card-holder').value.trim();
  const number = $('#orders-card-number').value.replace(/\D/g, '');
  const expiry = $('#orders-card-expiry').value.trim();
  const cvv = $('#orders-card-cvv').value.trim();
  if (holder.length < 3) throw new Error('Escribe el nombre del titular.');
  if (!/^\d{16}$/.test(number)) throw new Error('El número de tarjeta debe contener exactamente 16 dígitos.');
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) throw new Error('Escribe el vencimiento en formato MM/AA.');
  const [month, year] = expiry.split('/').map(Number);
  if (new Date(2000 + year, month, 0, 23, 59, 59) < new Date()) throw new Error('La tarjeta debe tener una fecha de vencimiento vigente.');
  if (!/^\d{3,4}$/.test(cvv)) throw new Error('El CVV debe contener 3 o 4 dígitos.');
  return 'approved';
}

$('#orders-submit-payment').addEventListener('click', () => {
  let result = 'approved';
  if (currentPaymentOrder?.method === 'tarjeta_demo') {
    try { result = getOrdersCardResult(); }
    catch (error) { $('#payment-demo-message').textContent = error.message; $('#payment-demo-message').className = 'message error'; return; }
  }
  if (currentPaymentOrder?.method === 'tarjeta_demo') {
    ['orders-card-holder','orders-card-number','orders-card-expiry','orders-card-cvv'].forEach((id) => { document.getElementById(id).value = ''; });
  }
  runPaymentSimulation(result);
});
$('#orders-card-holder').addEventListener('input', () => { $('#orders-card-preview-name').textContent = $('#orders-card-holder').value.trim().toUpperCase() || 'NOMBRE DEL TITULAR'; });
$('#orders-card-number').addEventListener('input', () => {
  const digits = $('#orders-card-number').value.replace(/\D/g, '').slice(0, 16);
  $('#orders-card-number').value = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  const masked = digits.replace(/\d(?=\d{4})/g, '•');
  $('#orders-card-preview-number').textContent = digits ? masked.replace(/(.{4})/g, '$1 ').trim() : '•••• •••• •••• ••••';
});
$('#orders-card-expiry').addEventListener('input', () => {
  const digits = $('#orders-card-expiry').value.replace(/\D/g, '').slice(0, 4);
  $('#orders-card-expiry').value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  $('#orders-card-preview-expiry').textContent = $('#orders-card-expiry').value || 'MM/AA';
});

$('#orders-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-pay-order]');
  if (!button) return;
  const id = Number(button.dataset.payOrder);
  // Los pedidos ya se renderizaron con la información de total y método; se obtiene de nuevo para no depender del HTML.
  api('/api/orders/my').then((result) => {
    const order = (result.data || []).find((item) => Number(item.id) === id);
    if (order) openPaymentSimulation(order);
  }).catch((error) => setMessage(error.message, 'error'));
});

$('#close-payment').addEventListener('click', () => paymentDialog.close());
$('#refresh-orders').addEventListener('click', loadOrders);
$('#orders-logout').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); }
  finally { window.location.replace('/'); }
});

(async function init() {
  $('#orders-year').textContent = new Date().getFullYear();
  try {
    const result = await api('/api/auth/me');
    if (!result.authenticated) {
      window.location.replace('/?login=1');
      return;
    }
    if (result.user?.rol !== 'cliente') {
      window.location.replace('/');
      return;
    }
    $('#orders-current-user').textContent = result.user.nombre;
    $('#account-name').textContent = result.user.nombre;
    $('#account-email').textContent = result.user.correo;
    await loadOrders();
  } catch (_error) {
    $('#orders-list').innerHTML = '<div class="empty-state"><strong>Tu sesión ya no está activa.</strong><p>Inicia sesión desde la tienda para consultar tus pedidos.</p><a class="primary-link" href="/?login=1">Ir a iniciar sesión</a></div>';
  }
})();
