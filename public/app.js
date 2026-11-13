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
let currentPaymentOrderId = null;
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
    setMessage(`Bienvenido, ${state.user.nombre}. Ya puedes continuar con tu compra.`, 'success');
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
    currentPaymentOrderId = result.data.orderId;
    $('#payment-order-summary').innerHTML = `<strong>Pedido #${escapeHtml(result.data.orderId)}</strong><span>Total: ${money(result.data.total)}</span><small>El pedido quedó registrado y el pago está pendiente.</small>`;
    $('#payment-demo-message').textContent = '';
    $('#payment-demo-message').className = 'message';
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

async function runPaymentSimulation(result) {
  if (!currentPaymentOrderId) return;
  const messageBox = $('#payment-demo-message');
  const buttons = [...paymentDialog.querySelectorAll('[data-payment-result]')];
  buttons.forEach((button) => { button.disabled = true; });
  messageBox.textContent = 'Procesando simulación…';
  messageBox.className = 'message';
  let approved = false;
  try {
    const response = await api(`/api/orders/${currentPaymentOrderId}/payment-simulation`, {
      method: 'POST', body: JSON.stringify({ result })
    });
    messageBox.textContent = response.message;
    messageBox.className = `message ${result === 'approved' ? 'success' : 'error'}`;
    approved = result === 'approved';
  } catch (error) {
    messageBox.textContent = error.message;
    messageBox.className = 'message error';
  } finally {
    buttons.forEach((button) => { button.disabled = approved; });
  }
}

paymentDialog.addEventListener('click', (event) => {
  const button = event.target.closest('[data-payment-result]');
  if (button) runPaymentSimulation(button.dataset.paymentResult);
});
$('#close-payment').addEventListener('click', () => paymentDialog.close());

async function init() {
  await loadCurrentUser();
  await loadCategories();
  await loadProducts();
  renderCart();
  if (new URLSearchParams(window.location.search).get('login') === '1' && !state.user) {
    showAuth('login', 'Inicia sesión para consultar tus pedidos.');
  }
}
init();
