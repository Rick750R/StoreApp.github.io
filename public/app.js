const state = { products: [], cart: new Map(), categories: ['Todos'], user: null };
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
const $ = (selector) => document.querySelector(selector);

const grid = $('#product-grid');
const message = $('#message');
const categorySelect = $('#category');
const searchInput = $('#search');
const minInput = $('#min-price');
const maxInput = $('#max-price');
const cartPanel = $('#cart-panel');
const overlay = $('#cart-overlay');
const checkoutDialog = $('#checkout-dialog');
const paymentDialog = $('#payment-dialog');
let currentPaymentOrder = null;
const productDialog = $('#product-dialog');
const authDialog = $('#auth-dialog');

$('#year').textContent = new Date().getFullYear();

function setMessage(text = '', type = '') {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'No se pudo completar la solicitud');
  return payload;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function updateAuthUI() {
  const loggedIn = Boolean(state.user);
  $('#guest-actions').classList.toggle('hidden', loggedIn);
  $('#user-actions').classList.toggle('hidden', !loggedIn);
  $('#open-orders').classList.toggle('hidden', !loggedIn || state.user.rol !== 'cliente');
  $('#admin-link').classList.toggle('hidden', !loggedIn || state.user.rol !== 'administrador');
  if (loggedIn) $('#current-user').textContent = `Hola, ${state.user.nombre}`;
}

async function loadCurrentUser() {
  try {
    const result = await api('/api/auth/me');
    state.user = result.user;
  } catch (_error) {
    state.user = null;
  }
  updateAuthUI();
}

function showAuth(mode = 'login', notice = '') {
  const login = mode === 'login';
  $('#auth-title').textContent = login ? 'Iniciar sesión' : 'Crear cuenta';
  $('#login-form').classList.toggle('hidden', !login);
  $('#register-form').classList.toggle('hidden', login);
  $('#show-login').classList.toggle('active', login);
  $('#show-register').classList.toggle('active', !login);
  $('#login-message').textContent = login ? notice : '';
  $('#login-message').className = notice ? 'message error' : 'message';
  $('#register-message').textContent = !login ? notice : '';
  $('#register-message').className = notice ? 'message error' : 'message';
  authDialog.showModal();
}

async function loadCategories() {
  try {
    const result = await api('/api/products/categories');
    state.categories = result.data;
    categorySelect.innerHTML = result.data.map((category) =>
      `<option value="${escapeHtml(category)}">${escapeHtml(category === 'Todos' ? 'Todas las categorías' : category)}</option>`
    ).join('');
  } catch (error) {
    setMessage(`${error.message}. Revisa que el servidor y MySQL estén activos.`, 'error');
  }
}

async function loadProducts() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
  if (categorySelect.value && categorySelect.value !== 'Todos') params.set('category', categorySelect.value);
  if (minInput.value !== '') params.set('minPrice', minInput.value);
  if (maxInput.value !== '') params.set('maxPrice', maxInput.value);

  grid.innerHTML = '<div class="empty-state">Cargando productos…</div>';
  try {
    const result = await api(`/api/products?${params.toString()}`);
    state.products = result.data;
    renderProducts();
    setMessage();
  } catch (error) {
    grid.innerHTML = '<div class="empty-state">No se pudieron cargar los productos.</div>';
    setMessage(`${error.message}. Comprueba la configuración de MySQL y vuelve a intentarlo.`, 'error');
  }
}

function renderProducts() {
  $('#results-count').textContent = `${state.products.length} producto${state.products.length === 1 ? '' : 's'}`;
  if (!state.products.length) {
    grid.innerHTML = '<div class="empty-state"><strong>No encontramos productos.</strong><p>Prueba con otra búsqueda o cambia los filtros.</p></div>';
    return;
  }

  grid.innerHTML = state.products.map((product) => {
    const out = Number(product.stock) < 1;
    return `
      <article class="product-card">
        <div class="product-image-wrap" data-detail="${product.id}" tabindex="0" role="button" aria-label="Ver ${escapeHtml(product.nombre)}">
          <img class="product-image" src="${escapeHtml(product.imagen_url || '')}" alt="${escapeHtml(product.nombre)}" loading="lazy"
               onerror="this.onerror=null;this.src='https://placehold.co/700x500/f3f5fa/6d7890?text=Producto'">
          ${Number(product.destacado) ? '<span class="pill">DESTACADO</span>' : ''}
        </div>
        <div class="product-info">
          <p class="product-category">${escapeHtml(product.categoria)}</p>
          <h3>${escapeHtml(product.nombre)}</h3>
          <p class="product-description">${escapeHtml(product.descripcion)}</p>
          <div class="product-bottom">
            <div><div class="price">${money(product.precio)}</div><div class="stock ${out ? 'out' : ''}">${out ? 'Agotado' : `${Number(product.stock)} disponibles`}</div></div>
            <button class="add-button" data-add="${product.id}" aria-label="Agregar ${escapeHtml(product.nombre)}" ${out ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function addToCart(id) {
  const product = state.products.find((item) => Number(item.id) === Number(id));
  if (!product || Number(product.stock) < 1) return;
  const current = state.cart.get(Number(id)) || 0;
  if (current >= Number(product.stock)) {
    setMessage(`Solo hay ${product.stock} unidades disponibles de ${product.nombre}.`, 'error');
    return;
  }
  state.cart.set(Number(id), current + 1);
  renderCart();
  setMessage(`${product.nombre} se agregó al carrito.`, 'success');
}

function changeQuantity(id, delta) {
  const product = state.products.find((item) => Number(item.id) === Number(id));
  const current = state.cart.get(Number(id)) || 0;
  const next = current + delta;
  if (next <= 0) state.cart.delete(Number(id));
  else if (product && next <= Number(product.stock)) state.cart.set(Number(id), next);
  else setMessage('La cantidad supera las existencias disponibles.', 'error');
  renderCart();
}

function renderCart() {
  const count = [...state.cart.values()].reduce((sum, qty) => sum + qty, 0);
  $('#cart-count').textContent = count;
  const items = [...state.cart.entries()].map(([id, quantity]) => {
    const product = state.products.find((item) => Number(item.id) === id);
    return product ? { product, quantity } : null;
  }).filter(Boolean);
  const total = items.reduce((sum, item) => sum + Number(item.product.precio) * item.quantity, 0);
  $('#cart-total').textContent = money(total);
  $('#checkout-button').disabled = items.length === 0;

  $('#cart-items').innerHTML = items.length ? items.map(({ product, quantity }) => `
    <div class="cart-item">
      <img src="${escapeHtml(product.imagen_url || '')}" alt="" onerror="this.onerror=null;this.src='https://placehold.co/100x100/f3f5fa/6d7890?text=Producto'">
      <div><h3>${escapeHtml(product.nombre)}</h3><p>${money(product.precio)} c/u</p>
        <div class="quantity-controls">
          <button data-qty="${product.id}" data-delta="-1" aria-label="Quitar una unidad">−</button>
          <span>${quantity}</span>
          <button data-qty="${product.id}" data-delta="1" aria-label="Agregar una unidad">+</button>
        </div>
        <button class="remove-item" data-remove="${product.id}">Eliminar</button>
      </div>
      <strong>${money(Number(product.precio) * quantity)}</strong>
    </div>`).join('') : '<div class="empty-state">Tu carrito está vacío.<p>Agrega un producto para comenzar.</p></div>';
}

function openCart() {
  cartPanel.classList.add('open');
  cartPanel.setAttribute('aria-hidden', 'false');
  overlay.classList.remove('hidden');
}
function closeCart() {
  cartPanel.classList.remove('open');
  cartPanel.setAttribute('aria-hidden', 'true');
  overlay.classList.add('hidden');
}

function showProduct(id) {
  const product = state.products.find((item) => Number(item.id) === Number(id));
  if (!product) return;
  const out = Number(product.stock) < 1;
  $('#product-detail').innerHTML = `
    <div class="detail-layout">
      <img src="${escapeHtml(product.imagen_url || '')}" alt="${escapeHtml(product.nombre)}" onerror="this.onerror=null;this.src='https://placehold.co/700x500/f3f5fa/6d7890?text=Producto'">
      <div><p class="product-category">${escapeHtml(product.categoria)}</p><h2>${escapeHtml(product.nombre)}</h2>
        <p>${escapeHtml(product.descripcion)}</p><div class="detail-price">${money(product.precio)}</div>
        <p class="stock ${out ? 'out' : ''}">${out ? 'Agotado' : `${Number(product.stock)} unidades disponibles`}</p>
        <button class="primary-button full-width" data-add="${product.id}" ${out ? 'disabled' : ''}>Agregar al carrito</button>
      </div>
    </div>`;
  productDialog.showModal();
}

$('#product-grid').addEventListener('click', (event) => {
  const add = event.target.closest('[data-add]');
  if (add) { addToCart(Number(add.dataset.add)); return; }
  const detail = event.target.closest('[data-detail]');
  if (detail) showProduct(Number(detail.dataset.detail));
});
$('#product-grid').addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-detail]')) {
    event.preventDefault();
    showProduct(Number(event.target.dataset.detail));
  }
});
$('#product-detail').addEventListener('click', (event) => {
  const add = event.target.closest('[data-add]');
  if (add) { addToCart(Number(add.dataset.add)); productDialog.close(); }
});
$('#cart-items').addEventListener('click', (event) => {
  const qty = event.target.closest('[data-qty]');
  const remove = event.target.closest('[data-remove]');
  if (qty) changeQuantity(Number(qty.dataset.qty), Number(qty.dataset.delta));
  if (remove) { state.cart.delete(Number(remove.dataset.remove)); renderCart(); }
});

let searchTimer;
searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadProducts, 250); });
categorySelect.addEventListener('change', loadProducts);
minInput.addEventListener('change', loadProducts);
maxInput.addEventListener('change', loadProducts);
$('#clear-filters').addEventListener('click', () => {
  searchInput.value = ''; categorySelect.value = 'Todos'; minInput.value = ''; maxInput.value = ''; loadProducts();
});

$('#open-cart').addEventListener('click', openCart);
$('#close-cart').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);
$('#close-checkout').addEventListener('click', () => checkoutDialog.close());
$('#close-product').addEventListener('click', () => productDialog.close());
$('#open-login').addEventListener('click', () => showAuth('login'));
$('#open-register').addEventListener('click', () => showAuth('register'));
$('#close-auth').addEventListener('click', () => authDialog.close());
$('#show-login').addEventListener('click', () => showAuth('login'));
$('#show-register').addEventListener('click', () => showAuth('register'));

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  button.disabled = true;
  try {
    const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ correo: data.get('correo'), password: data.get('password') }) });
    state.user = result.user;
    updateAuthUI();
    form.reset();
    authDialog.close();
    if (state.user.rol === 'cliente') setMessage(`Bienvenido, ${state.user.nombre}.`, 'success');
  } catch (error) {
    $('#login-message').textContent = error.message;
    $('#login-message').className = 'message error';
  } finally { button.disabled = false; }
});

$('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  button.disabled = true;
  try {
    const result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ nombre: data.get('nombre'), correo: data.get('correo'), password: data.get('password') }) });
    state.user = result.user;
    updateAuthUI();
    form.reset();
    authDialog.close();
    setMessage(`Tu cuenta está lista, ${state.user.nombre}.`, 'success');
  } catch (error) {
    $('#register-message').textContent = error.message;
    $('#register-message').className = 'message error';
  } finally { button.disabled = false; }
});

$('#logout-button').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST', body: '{}' });
    state.user = null;
    updateAuthUI();
    setMessage('Cerraste sesión correctamente.', 'success');
  } catch (error) { setMessage(error.message, 'error'); }
});

$('#checkout-button').addEventListener('click', () => {
  if (!state.cart.size) return;
  closeCart();
  if (!state.user) {
    showAuth('login', 'Para registrar tu pedido primero debes iniciar sesión o crear una cuenta.');
    return;
  }
  $('#checkout-user-name').textContent = state.user.nombre;
  $('#checkout-user-email').textContent = state.user.correo;
  $('#checkout-form').elements.shippingName.value = state.user.nombre;
  $('#checkout-message').textContent = '';
  $('#checkout-message').className = 'message';
  checkoutDialog.showModal();
});

$('#checkout-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Registrando…';
  try {
    const form = event.currentTarget;
    const data = new FormData(form);
    const shippingAddress = {
      nombre: data.get('shippingName'),
      telefono: data.get('shippingPhone'),
      codigoPostal: data.get('shippingPostalCode'),
      estado: data.get('shippingState'),
      municipio: data.get('shippingMunicipality'),
      colonia: data.get('shippingNeighborhood'),
      calle: data.get('shippingStreet'),
      numeroExterior: data.get('shippingExterior'),
      numeroInterior: data.get('shippingInterior'),
      referencias: data.get('shippingReferences')
    };
    const result = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: [...state.cart.entries()].map(([productId, quantity]) => ({ productId, quantity })),
        shippingAddress,
        paymentMethod: data.get('paymentMethod')
      })
    });
    currentPaymentOrder = { id: result.data.orderId, folio: result.data.folio, total: result.data.total, method: data.get('paymentMethod') };
    preparePaymentDialog();
    state.cart.clear();
    renderCart();
    await loadProducts();
    checkoutDialog.close();
    paymentDialog.showModal();
    button.disabled = false;
    button.textContent = 'Confirmar pedido';
  } catch (error) {
    $('#checkout-message').textContent = error.message;
    $('#checkout-message').className = 'message error';
    button.disabled = false;
    button.textContent = 'Confirmar pedido';
    await loadProducts();
  }
});

async function loadTransferInfo(prefix) {
  try {
    const info = await api('/api/payment-info');
    const set = (id, value) => { const el = document.getElementById(`${prefix}${id}`); if (el) el.textContent = value || 'No configurado'; };
    set('transfer-bank', info.bank);
    set('transfer-beneficiary', info.beneficiary);
    set('transfer-clabe', info.clabe);
    set('transfer-account', info.account);
    const row = document.getElementById(`${prefix}transfer-account-row`);
    if (row) row.classList.toggle('hidden', !info.account);
  } catch (_) {
    ['transfer-bank','transfer-beneficiary','transfer-clabe','transfer-account'].forEach(id => { const el = document.getElementById(`${prefix}${id}`); if (el) el.textContent = 'No disponible'; });
  }
}

function preparePaymentDialog() {
  if (!currentPaymentOrder) return;
  $('#payment-order-summary').innerHTML = `<strong>Folio ${escapeHtml(currentPaymentOrder.folio || currentPaymentOrder.id)}</strong><span>Total a pagar: ${money(currentPaymentOrder.total)}</span>`;
  $('#payment-demo-message').textContent = '';
  $('#payment-demo-message').className = 'message';
  $('#payment-entry').classList.remove('hidden');
  $('#payment-success').classList.add('hidden');
  $('#card-payment-fields').classList.toggle('hidden', currentPaymentOrder.method !== 'tarjeta_demo');
  $('#transfer-payment-fields').classList.toggle('hidden', currentPaymentOrder.method !== 'transferencia_demo');
  $('#transfer-reference').textContent = currentPaymentOrder.folio || `SA-${String(currentPaymentOrder.id).padStart(6, '0')}`;
  $('#transfer-amount').textContent = money(currentPaymentOrder.total);
  loadTransferInfo('');
  $('#submit-payment').textContent = currentPaymentOrder.method === 'transferencia_demo' ? 'Confirmar transferencia' : 'Pagar ahora';
  $('#submit-payment').disabled = false;
  ['card-holder', 'card-number', 'card-expiry', 'card-cvv'].forEach((id) => { const field = document.getElementById(id); if (field) field.value = ''; });
  $('#card-preview-number').textContent = '•••• •••• •••• ••••';
  $('#card-preview-name').textContent = 'NOMBRE DEL TITULAR';
  $('#card-preview-expiry').textContent = 'MM/AA';
}

function validateCardDetails() {
  const holder = $('#card-holder').value.trim();
  const number = $('#card-number').value.replace(/\D/g, '');
  const expiry = $('#card-expiry').value.trim();
  const cvv = $('#card-cvv').value.trim();
  if (holder.length < 3) throw new Error('Escribe el nombre del titular.');
  if (!/^\d{16}$/.test(number)) throw new Error('El número de tarjeta debe contener exactamente 16 dígitos.');
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) throw new Error('Escribe el vencimiento en formato MM/AA.');
  const [month, year] = expiry.split('/').map(Number);
  const now = new Date();
  const expiryDate = new Date(2000 + year, month, 0, 23, 59, 59);
  if (expiryDate < now) throw new Error('La tarjeta debe tener una fecha de vencimiento vigente.');
  if (!/^\d{3,4}$/.test(cvv)) throw new Error('El CVV debe contener 3 o 4 dígitos.');
  return 'approved';
}

async function runPaymentSimulation(result) {
  if (!currentPaymentOrder) return;
  const button = $('#submit-payment');
  const messageBox = $('#payment-demo-message');
  button.disabled = true;
  button.textContent = 'Procesando pago…';
  messageBox.textContent = 'Estamos procesando tu operación…';
  messageBox.className = 'message';
  try {
    const response = await api(`/api/orders/${currentPaymentOrder.id}/payment-simulation`, {
      method: 'POST', body: JSON.stringify({ result })
    });
    if (result === 'approved') {
      $('#payment-entry').classList.add('hidden');
      $('#payment-success').classList.remove('hidden');
      $('#receipt-order').textContent = currentPaymentOrder.folio || `#${currentPaymentOrder.id}`;
      $('#receipt-reference').textContent = response.data?.reference || 'STOREAPP';
      $('#receipt-total').textContent = money(currentPaymentOrder.total);
      $('#payment-success-description').textContent = 'Tu pedido quedó registrado y el pago fue aprobado correctamente.';
      await loadProducts();
    } else {
      messageBox.textContent = 'No fue posible aprobar el pago. Verifica los datos o intenta nuevamente.';
      messageBox.className = 'message error';
      button.disabled = false;
      button.textContent = currentPaymentOrder.method === 'transferencia_demo' ? 'Confirmar transferencia' : 'Intentar nuevamente';
    }
  } catch (error) {
    messageBox.textContent = error.message;
    messageBox.className = 'message error';
    button.disabled = false;
    button.textContent = 'Intentar nuevamente';
  }
}

$('#submit-payment').addEventListener('click', () => {
  let result = 'approved';
  if (currentPaymentOrder?.method === 'tarjeta_demo') {
    try { result = validateCardDetails(); }
    catch (error) {
      $('#payment-demo-message').textContent = error.message;
      $('#payment-demo-message').className = 'message error';
      return;
    }
  }
  if (currentPaymentOrder?.method === 'tarjeta_demo') {
    ['card-holder', 'card-number', 'card-expiry', 'card-cvv'].forEach((id) => { document.getElementById(id).value = ''; });
  }
  runPaymentSimulation(result);
});

$('#card-holder').addEventListener('input', () => {
  $('#card-preview-name').textContent = $('#card-holder').value.trim().toUpperCase() || 'NOMBRE DEL TITULAR';
});
$('#card-number').addEventListener('input', () => {
  const digits = $('#card-number').value.replace(/\D/g, '').slice(0, 16);
  $('#card-number').value = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  const masked = digits.replace(/\d(?=\d{4})/g, '•');
  $('#card-preview-number').textContent = digits ? masked.replace(/(.{4})/g, '$1 ').trim() : '•••• •••• •••• ••••';
});
$('#card-expiry').addEventListener('input', () => {
  const digits = $('#card-expiry').value.replace(/\D/g, '').slice(0, 4);
  $('#card-expiry').value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  $('#card-preview-expiry').textContent = $('#card-expiry').value || 'MM/AA';
});
$('#continue-shopping').addEventListener('click', () => paymentDialog.close());
$('#close-payment').addEventListener('click', () => paymentDialog.close());


async function init() {
  // Limpiar filtros al iniciar la tienda
  searchInput.value = '';
  minInput.value = '';
  maxInput.value = '';

  await loadCurrentUser();
  await loadCategories();

  // Seleccionar todas las categorías
  categorySelect.value = 'Todos';

  // Cargar el catálogo completo
  await loadProducts();

  renderCart();

  if (
    new URLSearchParams(window.location.search).get('login') === '1' &&
    !state.user
  ) {
    showAuth('login', 'Inicia sesión para consultar tus pedidos.');
  }
}

init();

