const $ = (selector) => document.querySelector(selector);
const form = $('#product-form');
const table = $('#products-table');
const message = $('#admin-message');
const ordersList = $('#admin-orders-list');
const ordersMessage = $('#orders-admin-message');
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
let products = [];
let orders = [];

const ORDER_STATUSES = [
  ['pendiente', 'Pendiente de revisión'],
  ['confirmado', 'Confirmado'],
  ['preparando', 'Preparando pedido'],
  ['enviado', 'Enviado'],
  ['entregado', 'Entregado']
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function setMessage(text = '', type = '') {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function setOrdersMessage(text = '', type = '') {
  ordersMessage.textContent = text;
  ordersMessage.className = `message ${type}`.trim();
}

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

async function checkAdmin() {
  try {
    const result = await api('/api/auth/me');
    if (!result.authenticated || result.user.rol !== 'administrador') {
      window.location.replace('/');
      return false;
    }
    $('#admin-current-user').textContent = result.user.nombre;
    return true;
  } catch (_error) {
    window.location.replace('/');
    return false;
  }
}

function renderProducts() {
  if (!products.length) {
    table.innerHTML = '<tr><td colspan="5" class="table-empty">Todavía no hay productos registrados.</td></tr>';
    return;
  }
  table.innerHTML = products.map((product) => `
    <tr>
      <td><div class="admin-product"><img src="${escapeHtml(product.imagen_url || '')}" alt="" onerror="this.onerror=null;this.src='https://placehold.co/100x100/f3f5fa/6d7890?text=Img'"><div><strong>${escapeHtml(product.nombre)}</strong><small>${escapeHtml(product.categoria)}</small></div></div></td>
      <td>${money(product.precio)}</td>
      <td>${Number(product.stock)}</td>
      <td><span class="status-label ${Number(product.activo) ? '' : 'inactive'}">${Number(product.activo) ? 'Activo' : 'Inactivo'}</span></td>
      <td><div class="table-actions"><button type="button" data-edit="${product.id}">Editar</button><button type="button" data-toggle="${product.id}" data-active="${Number(product.activo) ? '1' : '0'}">${Number(product.activo) ? 'Desactivar' : 'Activar'}</button></div></td>
    </tr>`).join('');
}

async function loadProducts() {
  table.innerHTML = '<tr><td colspan="5" class="table-empty">Cargando productos…</td></tr>';
  try {
    const result = await api('/api/products/admin/all');
    products = result.data;
    renderProducts();
  } catch (error) {
    table.innerHTML = `<tr><td colspan="5" class="table-empty">${escapeHtml(error.message)}</td></tr>`;
  }
}

function getOrderStatusLabel(status) {
  const labels = {
    pendiente: 'Pendiente de revisión',
    confirmado: 'Confirmado',
    preparando: 'Preparando pedido',
    enviado: 'Enviado',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
    pendiente_pago: 'Pendiente de pago (pedido anterior)',
    pagado: 'Pagado (registro anterior)',
    rechazado: 'Rechazado (registro anterior)'
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

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || 'Fecha no disponible');
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function renderOrderAddress(order) {
  if (!order.envio_calle) return '<p class="admin-order-no-address">Este pedido se creó antes de agregar el formulario de dirección de entrega.</p>';
  const street = `${order.envio_calle} ${order.envio_numero_exterior || ''}${order.envio_numero_interior ? `, interior ${order.envio_numero_interior}` : ''}`;
  const locality = `${order.envio_colonia}, ${order.envio_municipio}, ${order.envio_estado}, C.P. ${order.envio_codigo_postal}`;
  return `<div class="admin-order-address"><strong>Dirección de entrega</strong><p>${escapeHtml(order.envio_nombre)} · ${escapeHtml(order.envio_telefono)}</p><p>${escapeHtml(street)}</p><p>${escapeHtml(locality)}</p>${order.envio_referencias ? `<p><span>Referencias:</span> ${escapeHtml(order.envio_referencias)}</p>` : ''}</div>`;
}

function renderOrders() {
  if (!orders.length) {
    ordersList.innerHTML = '<div class="table-empty">Todavía no hay pedidos registrados.</div>';
    return;
  }

  ordersList.innerHTML = orders.map((order) => {
    const currentStatusIsEditable = ORDER_STATUSES.some(([value]) => value === order.estado);
    const options = ORDER_STATUSES.map(([value, label]) =>
      `<option value="${value}" ${order.estado === value ? 'selected' : ''}>${label}</option>`
    ).join('') + '<option value="__cancelar__">Cancelar y eliminar pedido</option>';
    const statusClass = String(order.estado || '').replace(/[^a-z_]/g, '');
    const items = (order.items || []).map((item) => `
      <div class="admin-order-product">
        <img src="${escapeHtml(item.imagen_url || '')}" alt="" onerror="this.onerror=null;this.src='https://placehold.co/80x80/f3f5fa/6d7890?text=Img'">
        <div><strong>${escapeHtml(item.nombre)}</strong><span>${Number(item.cantidad)} × ${money(item.precio_unitario)}</span></div>
        <b>${money(Number(item.cantidad) * Number(item.precio_unitario))}</b>
      </div>`).join('');

    return `
      <article class="admin-order-card" data-order-card="${order.id}">
        <div class="admin-order-header">
          <div><span class="admin-order-overline">Pedido #${escapeHtml(order.id)}</span><h3>${escapeHtml(order.cliente_nombre)}</h3><p>${escapeHtml(order.cliente_correo)} · ${escapeHtml(formatDate(order.creado_en))}</p></div>
          <div class="admin-order-total"><strong>${money(order.total)}</strong><span class="admin-order-status status-${statusClass}">${escapeHtml(getOrderStatusLabel(order.estado))}</span></div>
        </div>
        <div class="admin-order-content">
          <section class="admin-order-items"><strong>Productos del pedido</strong>${items || '<p class="admin-order-no-address">No hay detalles de productos para este pedido.</p>'}</section>
          <section>${renderOrderAddress(order)}</section>
        </div>
        <div class="admin-order-payment"><span>Método de pago: <strong>${escapeHtml(paymentMethodLabel(order.metodo_pago))}</strong></span><span>Estado del pago: <strong class="payment-state ${String(order.estado_pago || '').replace(/[^a-z_]/g, '')}">${escapeHtml(paymentStatusLabel(order.estado_pago))}</strong></span></div>
        <div class="admin-order-actions">
          <label>Actualizar estado
            <select data-order-status="${order.id}">
              ${currentStatusIsEditable ? '' : '<option value="" selected disabled>Selecciona un nuevo estado</option>'}
              ${options}
            </select>
          </label>
          <button class="primary-button" type="button" data-save-order="${order.id}">Guardar estado</button>
        </div>
      </article>`;
  }).join('');
}

async function loadOrders() {
  const button = $('#refresh-orders');
  button.disabled = true;
  button.textContent = 'Actualizando…';
  setOrdersMessage();
  ordersList.innerHTML = '<div class="table-empty">Cargando pedidos…</div>';
  try {
    const result = await api('/api/orders/admin/all');
    orders = result.data || [];
    renderOrders();
  } catch (error) {
    ordersList.innerHTML = '';
    setOrdersMessage(error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Actualizar pedidos';
  }
}

function resetForm() {
  form.reset();
  form.elements.id.value = '';
  form.elements.activo.checked = true;
  $('#form-title').textContent = 'Agregar producto';
  $('#save-product').textContent = 'Guardar producto';
  $('#cancel-edit').classList.add('hidden');
  $('#image-preview').classList.add('hidden');
  $('#preview-image').removeAttribute('src');
}

function editProduct(id) {
  const product = products.find((item) => Number(item.id) === Number(id));
  if (!product) return;
  form.elements.id.value = product.id;
  form.elements.nombre.value = product.nombre;
  form.elements.descripcion.value = product.descripcion;
  form.elements.categoria.value = product.categoria;
  form.elements.precio.value = product.precio;
  form.elements.stock.value = product.stock;
  form.elements.imageUrl.value = product.imagen_url || '';
  form.elements.imageFile.value = '';
  form.elements.destacado.checked = Boolean(Number(product.destacado));
  form.elements.activo.checked = Boolean(Number(product.activo));
  $('#form-title').textContent = 'Editar producto';
  $('#save-product').textContent = 'Guardar cambios';
  $('#cancel-edit').classList.remove('hidden');
  if (product.imagen_url) {
    $('#preview-image').src = product.imagen_url;
    $('#image-preview').classList.remove('hidden');
  } else {
    $('#image-preview').classList.add('hidden');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.readAsDataURL(file);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#save-product');
  const data = new FormData(form);
  const id = data.get('id');
  const payload = {
    nombre: data.get('nombre'),
    descripcion: data.get('descripcion'),
    categoria: data.get('categoria'),
    precio: data.get('precio'),
    stock: data.get('stock'),
    destacado: form.elements.destacado.checked,
    activo: form.elements.activo.checked,
    imageUrl: data.get('imageUrl')
  };
  const file = form.elements.imageFile.files[0];
  if (file) {
    if (file.size > 2 * 1024 * 1024) {
      setMessage('La imagen no debe superar los 2 MB.', 'error');
      return;
    }
    try { payload.imageData = await fileAsDataUrl(file); }
    catch (error) { setMessage(error.message, 'error'); return; }
  }

  button.disabled = true;
  button.textContent = 'Guardando…';
  try {
    const url = id ? `/api/products/${id}` : '/api/products';
    await api(url, { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    setMessage(id ? 'Los cambios del producto se guardaron.' : 'El producto se agregó al catálogo.', 'success');
    resetForm();
    await loadProducts();
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = form.elements.id.value ? 'Guardar cambios' : 'Guardar producto';
  }
});

table.addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit]');
  const toggle = event.target.closest('[data-toggle]');
  if (edit) editProduct(Number(edit.dataset.edit));
  if (toggle) {
    const id = Number(toggle.dataset.toggle);
    const active = toggle.dataset.active !== '1';
    try {
      await api(`/api/products/${id}/status`, { method: 'PATCH', body: JSON.stringify({ activo: active }) });
      setMessage(active ? 'Producto activado.' : 'Producto desactivado.', 'success');
      await loadProducts();
    } catch (error) { setMessage(error.message, 'error'); }
  }
});

ordersList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-save-order]');
  if (!button) return;
  const id = Number(button.dataset.saveOrder);
  const select = ordersList.querySelector(`[data-order-status="${id}"]`);
  if (!select || !select.value) {
    setOrdersMessage('Selecciona el nuevo estado que tendrá el pedido.', 'error');
    return;
  }

  if (select.value === '__cancelar__' && !window.confirm(`¿Cancelar y eliminar el pedido #${id}? Las unidades de sus productos regresarán al inventario.`)) {
    select.value = orders.find((order) => Number(order.id) === id)?.estado || 'pendiente';
    return;
  }

  button.disabled = true;
  button.textContent = select.value === '__cancelar__' ? 'Cancelando…' : 'Guardando…';
  try {
    if (select.value === '__cancelar__') {
      const result = await api(`/api/orders/${id}`, { method: 'DELETE' });
      setOrdersMessage(result.message, 'success');
    } else {
      await api(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ estado: select.value }) });
      setOrdersMessage(`El estado del pedido #${id} se actualizó.`, 'success');
    }
    await loadOrders();
    await loadProducts();
    if (select.value === '__cancelar__') setOrdersMessage(`El pedido #${id} se canceló y eliminó; sus unidades regresaron al inventario.`, 'success');
  } catch (error) {
    setOrdersMessage(error.message, 'error');
    button.disabled = false;
    button.textContent = 'Guardar estado';
  }
});

form.elements.imageFile.addEventListener('change', async () => {
  const file = form.elements.imageFile.files[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    setMessage('Selecciona una imagen PNG, JPG o WEBP.', 'error');
    form.elements.imageFile.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    setMessage('La imagen no debe superar los 2 MB.', 'error');
    form.elements.imageFile.value = '';
    return;
  }
  $('#preview-image').src = await fileAsDataUrl(file);
  $('#image-preview').classList.remove('hidden');
});

$('#cancel-edit').addEventListener('click', resetForm);
$('#refresh-products').addEventListener('click', loadProducts);
$('#refresh-orders').addEventListener('click', loadOrders);
$('#admin-logout').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); }
  finally { window.location.replace('/'); }
});

(async function init() {
  $('#admin-year').textContent = new Date().getFullYear();
  if (await checkAdmin()) {
    await Promise.all([loadProducts(), loadOrders()]);
  }
})();
