const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
const paymentDialog = $('#payment-dialog');
let currentPaymentOrderId = null;

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
    tarjeta_demo: 'Tarjeta bancaria (demostración)',
    transferencia_demo: 'Transferencia (demostración)',
    sin_especificar: 'No registrado (pedido anterior)'
  };
  return labels[method] || method || 'No especificado';
}

function paymentStatusLabel(status) {
  const labels = {
    pendiente: 'Pendiente de pago', aprobado_simulado: 'Aprobado (simulación)',
    rechazado_simulado: 'Rechazado (simulación)', aprobado: 'Pagado',
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
        ${canSimulatePayment ? `<div class="order-payment-action"><button class="secondary-button" type="button" data-pay-order="${escapeHtml(order.id)}">Continuar simulación de pago</button></div>` : ''}
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
  currentPaymentOrderId = Number(order.id);
  $('#payment-order-summary').innerHTML = `<strong>Pedido #${escapeHtml(order.id)}</strong><span>Total: ${money(order.total)}</span><small>${escapeHtml(paymentMethodLabel(order.metodo_pago))}. Esta es una prueba local, no un cobro real.</small>`;
  $('#payment-demo-message').textContent = '';
  $('#payment-demo-message').className = 'message';
  paymentDialog.showModal();
}

async function runPaymentSimulation(result) {
  if (!currentPaymentOrderId) return;
  const buttons = [...paymentDialog.querySelectorAll('[data-payment-result]')];
  const message = $('#payment-demo-message');
  buttons.forEach((button) => { button.disabled = true; });
  message.textContent = 'Procesando simulación…';
  message.className = 'message';
  let approved = false;
  try {
    const response = await api(`/api/orders/${currentPaymentOrderId}/payment-simulation`, {
      method: 'POST', body: JSON.stringify({ result })
    });
    message.textContent = response.message;
    message.className = `message ${result === 'approved' ? 'success' : 'error'}`;
    approved = result === 'approved';
    await loadOrders();
  } catch (error) {
    message.textContent = error.message;
    message.className = 'message error';
  } finally {
    buttons.forEach((button) => { button.disabled = approved; });
  }
}

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

paymentDialog.addEventListener('click', (event) => {
  const button = event.target.closest('[data-payment-result]');
  if (button) runPaymentSimulation(button.dataset.paymentResult);
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
