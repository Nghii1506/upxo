(function () {
    'use strict';

    const CART_KEY = 'upxo_cart';
    const VOUCHER_KEY = 'upxo_voucher';
    const SHIPPING_FEE = 0; // Website currently advertises free nationwide shipping.
    const VOUCHERS = { UPXO10K: 10000, UPXO50K: 50000 };
    const formatVnd = value => `${Math.max(0, Math.round(value)).toLocaleString('vi-VN')}đ`;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const normalizeImage = value => {
        const image = String(value || '');
        if (/^(https?:|data:|blob:)/i.test(image) || image.startsWith('images/')) return image;
        return `images/${image.replace(/^\.\//, '')}`;
    };

    function loadCart() {
        try {
            const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
            return Array.isArray(saved) ? saved.filter(item => item && item.id && Number(item.price) >= 0).map(item => ({
                id: String(item.id), name: String(item.name || 'Sản phẩm UP-XƠ'), price: Number(item.price) || 0,
                image: normalizeImage(item.image), quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
            })) : [];
        } catch (error) { return []; }
    }

    let cart = loadCart();
    let appliedVoucher = localStorage.getItem(VOUCHER_KEY) || '';
    if (!Object.prototype.hasOwnProperty.call(VOUCHERS, appliedVoucher)) {
        appliedVoucher = '';
        localStorage.removeItem(VOUCHER_KEY);
    }
    let lastOrder = null;
    let closeTimers = {};

    const component = `
      <div id="cart-drawer" class="uc-overlay" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Giỏ hàng" hidden>
        <div class="uc-backdrop" data-close-cart></div>
        <aside class="uc-panel uc-cart-panel">
          <header class="uc-header">
            <div class="uc-header-title"><i data-lucide="shopping-bag" class="w-5 h-5"></i><div><h2>Giỏ hàng UP-XƠ</h2><p id="cart-subtitle">Sản phẩm được chọn</p></div></div>
            <button type="button" class="uc-icon-button" data-close-cart aria-label="Đóng giỏ hàng"><i data-lucide="x" class="w-5 h-5"></i></button>
          </header>
          <div class="uc-cart-scroll">
            <div id="cart-items" class="uc-items"></div>
            <section class="uc-voucher" aria-label="Mã giảm giá">
              <div class="uc-voucher-title"><i data-lucide="ticket-percent" class="w-4 h-4"></i><span>Mã giảm giá</span></div>
              <div class="uc-voucher-form"><input id="cart-voucher-input" class="uc-input" type="text" autocomplete="off" placeholder="Nhập mã voucher" aria-label="Nhập mã voucher"><button type="button" class="uc-small-button" id="apply-voucher">Áp dụng</button></div>
              <p id="voucher-message" class="uc-voucher-message">Mã khả dụng: UPXO10K hoặc UPXO50K</p>
            </section>
          </div>
          <footer class="uc-summary">
            <div class="uc-summary-rows">
              <div class="uc-summary-row"><span>Tạm tính</span><strong id="cart-subtotal">0đ</strong></div>
              <div class="uc-summary-row discount"><span>Giảm giá</span><strong id="cart-discount">−0đ</strong></div>
              <div class="uc-summary-row"><span>Phí vận chuyển</span><strong id="cart-shipping">Miễn phí</strong></div>
              <div class="uc-summary-row total"><span>Tổng thanh toán</span><strong id="cart-total">0đ</strong></div>
            </div>
            <button type="button" id="checkout-button" class="uc-primary-button" onclick="openCheckoutModal()">Tiến hành thanh toán</button>
            <p class="uc-secure-note"><i data-lucide="shield-check" class="w-3.5 h-3.5"></i>Thông tin đơn hàng được xác nhận trước khi gửi</p>
          </footer>
        </aside>
      </div>
      <div id="checkout-modal" class="uc-overlay uc-checkout-overlay" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Thông tin đặt hàng" hidden>
        <div class="uc-backdrop" data-close-checkout></div>
        <section class="uc-checkout-card">
          <header class="uc-header uc-checkout-header">
            <div class="uc-header-title"><i data-lucide="clipboard-list" class="w-5 h-5 text-brandOrange"></i><div><h2>Thông tin đặt hàng</h2><p>Hoàn tất thông tin để UP-XƠ xác nhận đơn</p></div></div>
            <button type="button" class="uc-icon-button" data-close-checkout aria-label="Đóng thông tin đặt hàng"><i data-lucide="x" class="w-5 h-5"></i></button>
          </header>
          <div id="checkout-content" class="uc-checkout-body">
            <form id="checkout-form" novalidate>
              <div class="uc-checkout-grid">
                <div class="uc-form-main">
                  <section class="uc-form-section">
                    <h3 class="uc-section-heading"><span><i data-lucide="user-round" class="w-4 h-4"></i></span>Thông tin người nhận</h3>
                    <div class="uc-field-grid">
                      <div class="uc-field full"><label class="uc-label" for="cust-name">Họ và tên <b class="uc-required">*</b></label><input class="uc-input" id="cust-name" name="name" autocomplete="name" required placeholder="Nguyễn Văn A"><small class="uc-error" data-error-for="cust-name"></small></div>
                      <div class="uc-field full"><label class="uc-label" for="cust-phone">Số điện thoại <b class="uc-required">*</b></label><input class="uc-input" id="cust-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="0901 234 567"><small class="uc-error" data-error-for="cust-phone"></small></div>
                    </div>
                  </section>
                  <section class="uc-form-section">
                    <h3 class="uc-section-heading"><span><i data-lucide="map-pin" class="w-4 h-4"></i></span>Địa chỉ giao hàng</h3>
                    <div class="uc-field-grid">
                      <div class="uc-field"><label class="uc-label" for="cust-province">Tỉnh / thành phố <b class="uc-required">*</b></label><input class="uc-input" id="cust-province" name="province" autocomplete="address-level1" required placeholder="Tỉnh / thành phố"><small class="uc-error" data-error-for="cust-province"></small></div>
                      <div class="uc-field"><label class="uc-label" for="cust-ward">Phường / xã <b class="uc-required">*</b></label><input class="uc-input" id="cust-ward" name="ward" autocomplete="address-level2" required placeholder="Phường / xã"><small class="uc-error" data-error-for="cust-ward"></small></div>
                      <div class="uc-field full"><label class="uc-label" for="cust-address">Địa chỉ chi tiết <b class="uc-required">*</b></label><input class="uc-input" id="cust-address" name="address" autocomplete="street-address" required placeholder="Số nhà, tên đường, khu phố"><small class="uc-error" data-error-for="cust-address"></small></div>
                    </div>
                  </section>
                  <section class="uc-form-section">
                    <h3 class="uc-section-heading"><span><i data-lucide="credit-card" class="w-4 h-4"></i></span>Phương thức thanh toán</h3>
                    <div class="uc-payment-options">
                      <label class="uc-payment-option"><input type="radio" name="payment" value="COD" checked><span><strong>Thanh toán khi nhận hàng</strong><small>Thanh toán trực tiếp cho đơn vị giao hàng</small></span></label>
                      <label class="uc-payment-option"><input type="radio" name="payment" value="BANK"><span><strong>Chuyển khoản ngân hàng</strong><small>Thông tin thanh toán được hướng dẫn khi xác nhận</small></span></label>
                    </div>
                  </section>
                  <section class="uc-form-section">
                    <h3 class="uc-section-heading"><span><i data-lucide="message-square-text" class="w-4 h-4"></i></span>Ghi chú đơn hàng</h3>
                    <div class="uc-field"><label class="uc-label" for="cust-note">Lời nhắn cho UP-XƠ <span class="text-gray-400 font-normal">(không bắt buộc)</span></label><textarea class="uc-textarea" id="cust-note" name="note" placeholder="Thời gian nhận hàng hoặc lưu ý giao hàng"></textarea></div>
                  </section>
                </div>
                <aside class="uc-order-summary"><h3>Tóm tắt đơn hàng</h3><div id="checkout-order-items" class="uc-order-items"></div>
                  <div class="uc-summary-rows">
                    <div class="uc-summary-row"><span>Tạm tính</span><strong id="checkout-subtotal">0đ</strong></div>
                    <div class="uc-summary-row discount"><span>Giảm giá</span><strong id="checkout-discount">−0đ</strong></div>
                    <div class="uc-summary-row"><span>Phí vận chuyển</span><strong id="checkout-shipping">Miễn phí</strong></div>
                    <div class="uc-summary-row total"><span>Tổng thanh toán</span><strong id="checkout-total-price">0đ</strong></div>
                  </div>
                  <button type="submit" class="uc-primary-button uc-checkout-submit">Xác nhận đặt hàng</button>
                  <p class="uc-checkout-note">Bằng việc đặt hàng, bạn xác nhận thông tin giao hàng đã chính xác.</p>
                </aside>
              </div>
            </form>
          </div>
        </section>
      </div>`;

    document.querySelectorAll('#cart-drawer, #checkout-modal').forEach(element => element.remove());
    document.body.insertAdjacentHTML('beforeend', component);

    const drawer = document.getElementById('cart-drawer');
    const checkout = document.getElementById('checkout-modal');
    const cartItems = document.getElementById('cart-items');

    function totals() {
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const discount = Math.min(subtotal, VOUCHERS[appliedVoucher] || 0);
        return { subtotal, discount, shipping: SHIPPING_FEE, total: Math.max(0, subtotal - discount + SHIPPING_FEE) };
    }

    function saveCart() {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        updateCartUI();
    }

    function setOverlay(element, open, name) {
        clearTimeout(closeTimers[name]);
        if (open) {
            element.hidden = false;
            element.setAttribute('aria-hidden', 'false');
            requestAnimationFrame(() => element.classList.add('is-open'));
            document.body.classList.add('upxo-overlay-open');
        } else {
            element.classList.remove('is-open');
            element.setAttribute('aria-hidden', 'true');
            closeTimers[name] = setTimeout(() => { element.hidden = true; }, 280);
            if (!document.querySelector('.uc-overlay.is-open')) document.body.classList.remove('upxo-overlay-open');
        }
    }

    function setVoucherMessage(message, state) {
        const node = document.getElementById('voucher-message');
        if (!node) return;
        node.textContent = message;
        node.classList.toggle('is-error', state === 'error');
        node.classList.toggle('is-success', state === 'success');
    }

    function renderOrderItems() {
        const target = document.getElementById('checkout-order-items');
        if (!target) return;
        target.innerHTML = cart.map(item => `<div class="uc-order-item"><img src="${escapeHtml(item.image)}" alt=""><div class="uc-order-item-name">${escapeHtml(item.name)}<span class="uc-order-item-qty">Số lượng: ${item.quantity}</span></div><span class="uc-order-item-total">${formatVnd(item.price * item.quantity)}</span></div>`).join('');
    }

    function updateCartUI() {
        cart = loadCart();
        const countEl = document.getElementById('cart-count');
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (countEl) { countEl.textContent = String(count); countEl.classList.toggle('hidden', count === 0); }
        const subtitle = document.getElementById('cart-subtitle');
        if (subtitle) subtitle.textContent = `${count} sản phẩm trong giỏ hàng`;

        if (cart.length === 0) {
            cartItems.innerHTML = `<div class="uc-empty"><div><div class="uc-empty-icon"><i data-lucide="shopping-basket" class="w-7 h-7"></i></div><h3>Giỏ hàng đang trống</h3><p>Chọn sản phẩm UP-XƠ bạn yêu thích để bắt đầu.</p><a href="products.html" class="inline-flex items-center gap-2 mt-4 rounded-full bg-brandGreen px-5 py-2.5 text-xs font-bold text-white hover:bg-green-800 transition">Khám phá sản phẩm <i data-lucide="arrow-right" class="w-4 h-4"></i></a></div></div>`;
        } else {
            cartItems.innerHTML = cart.map(item => `<article class="uc-item">
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="uc-item-image">
                <div class="uc-item-content"><div><h3 class="uc-item-name">${escapeHtml(item.name)}</h3><p class="uc-item-price">${formatVnd(item.price)}</p></div>
                  <div class="uc-item-bottom"><div class="uc-qty" aria-label="Số lượng"><button type="button" data-qty="-1" data-id="${escapeHtml(item.id)}" aria-label="Giảm số lượng">−</button><output>${item.quantity}</output><button type="button" data-qty="1" data-id="${escapeHtml(item.id)}" aria-label="Tăng số lượng">+</button></div>
                    <button type="button" class="uc-remove" data-remove="${escapeHtml(item.id)}"><i data-lucide="trash-2" class="w-4 h-4"></i>Xóa</button>
                  </div>
                </div>
              </article>`).join('');
        }

        const sum = totals();
        document.getElementById('cart-subtotal').textContent = formatVnd(sum.subtotal);
        document.getElementById('cart-discount').textContent = `−${formatVnd(sum.discount)}`;
        document.getElementById('cart-shipping').textContent = sum.shipping ? formatVnd(sum.shipping) : 'Miễn phí';
        document.getElementById('cart-total').textContent = formatVnd(sum.total);
        document.getElementById('checkout-button').disabled = cart.length === 0;
        const voucherInput = document.getElementById('cart-voucher-input');
        if (voucherInput && document.activeElement !== voucherInput) voucherInput.value = appliedVoucher;
        if (appliedVoucher) setVoucherMessage(`Đã áp dụng mã ${appliedVoucher}: giảm ${formatVnd(VOUCHERS[appliedVoucher])}.`, 'success');
        renderOrderItems();
        document.getElementById('checkout-subtotal').textContent = formatVnd(sum.subtotal);
        document.getElementById('checkout-discount').textContent = `−${formatVnd(sum.discount)}`;
        document.getElementById('checkout-shipping').textContent = sum.shipping ? formatVnd(sum.shipping) : 'Miễn phí';
        document.getElementById('checkout-total-price').textContent = formatVnd(sum.total);
        if (window.lucide) window.lucide.createIcons();
    }

    function addItem(id, name, price, image, quantity = 1) {
        const existing = cart.find(item => item.id === id);
        if (existing) existing.quantity += Math.max(1, Number(quantity) || 1);
        else cart.push({ id: String(id), name: String(name), price: Number(price), image: normalizeImage(image), quantity: Math.max(1, Number(quantity) || 1) });
        saveCart();
        toggleCart(true);
    }

    function addToCart(id, name, price, image, quantity = 1) { addItem(id, name, price, image, quantity); }
    function updateQuantity(id, delta) {
        const item = cart.find(entry => entry.id === String(id));
        if (!item) return;
        item.quantity += Number(delta);
        if (item.quantity <= 0) cart = cart.filter(entry => entry.id !== String(id));
        saveCart();
    }
    function removeItem(id) { cart = cart.filter(item => item.id !== String(id)); saveCart(); }

    function toggleCart(forceOpen) {
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : drawer.hidden || !drawer.classList.contains('is-open');
        setOverlay(drawer, shouldOpen, 'cart');
        if (shouldOpen) updateCartUI();
    }

    function openCheckoutModal() {
        if (!cart.length) { toggleCart(true); return; }
        updateCartUI();
        toggleCart(false);
        setTimeout(() => { setOverlay(checkout, true, 'checkout'); }, 120);
    }

    function closeCheckoutModal() {
        setOverlay(checkout, false, 'checkout');
        if (lastOrder) {
            setTimeout(() => {
                document.getElementById('checkout-content').innerHTML = document.getElementById('checkout-content').dataset.formTemplate || '';
                lastOrder = null;
                updateCartUI();
            }, 280);
        }
    }

    const initialCheckoutContent = document.getElementById('checkout-content').innerHTML;
    document.getElementById('checkout-content').dataset.formTemplate = initialCheckoutContent;

    function applyVoucher() {
        const input = document.getElementById('cart-voucher-input');
        const code = input.value.trim().toUpperCase();
        if (!code) {
            appliedVoucher = '';
            localStorage.removeItem(VOUCHER_KEY);
            setVoucherMessage('Đã bỏ mã giảm giá.', 'success');
            updateCartUI();
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(VOUCHERS, code)) {
            setVoucherMessage('Mã không hợp lệ. Vui lòng kiểm tra UPXO10K hoặc UPXO50K.', 'error');
            return;
        }
        appliedVoucher = code;
        localStorage.setItem(VOUCHER_KEY, code);
        setVoucherMessage(`Đã áp dụng mã ${code}: giảm ${formatVnd(VOUCHERS[code])}.`, 'success');
        updateCartUI();
    }

    function validateForm(form) {
        let valid = true;
        const fields = ['cust-name', 'cust-phone', 'cust-province', 'cust-ward', 'cust-address'];
        fields.forEach(id => {
            const field = document.getElementById(id);
            const error = document.querySelector(`[data-error-for="${id}"]`);
            const value = field.value.trim();
            let message = value ? '' : 'Vui lòng điền thông tin này.';
            if (id === 'cust-name' && value && value.length < 2) message = 'Vui lòng nhập họ tên đầy đủ.';
            if (id === 'cust-phone' && value && !/^(?:0[35789]\d{8}|\+84[35789]\d{8})$/.test(value.replace(/[\s().-]/g, ''))) message = 'Số điện thoại chưa đúng. Nhập số di động Việt Nam hợp lệ.';
            field.classList.toggle('uc-invalid', Boolean(message));
            field.setAttribute('aria-invalid', String(Boolean(message)));
            error.textContent = message;
            if (message) valid = false;
        });
        if (!valid) form.querySelector('.uc-invalid')?.focus();
        return valid;
    }

    function processOrder(event) {
        event.preventDefault();
        const form = document.getElementById('checkout-form');
        if (!cart.length || !validateForm(form)) return;
        const formData = new FormData(form);
        const sum = totals();
        const localDate = new Date();
        const dateCode = `${localDate.getFullYear()}${String(localDate.getMonth() + 1).padStart(2, '0')}${String(localDate.getDate()).padStart(2, '0')}`;
        const orderCode = `UPXO-${dateCode}-${Math.random().toString(36).slice(2,6).toUpperCase().padEnd(4, '0')}`;
        lastOrder = { orderCode, total: sum.total, customer: String(formData.get('name') || '').trim(), phone: String(formData.get('phone') || '').trim(), payment: formData.get('payment') };
        cart = [];
        saveCart();
        appliedVoucher = '';
        localStorage.removeItem(VOUCHER_KEY);
        const paymentLabel = lastOrder.payment === 'BANK' ? 'Chuyển khoản ngân hàng' : 'Thanh toán khi nhận hàng (COD)';
        document.getElementById('checkout-content').innerHTML = `<div class="uc-success"><div class="uc-success-mark"><i data-lucide="check" class="w-9 h-9"></i></div><h2>Đặt hàng thành công!</h2><p>Cảm ơn ${escapeHtml(lastOrder.customer)}. UP-XƠ sẽ liên hệ số <strong>${escapeHtml(lastOrder.phone)}</strong> để xác nhận đơn hàng.</p><div class="uc-order-code">${orderCode}</div><p class="uc-success-total">Tổng thanh toán: <strong>${formatVnd(lastOrder.total)}</strong><br>Thanh toán: <strong>${paymentLabel}</strong></p><button type="button" class="uc-primary-button" onclick="closeCheckoutModal()">Tiếp tục mua sắm</button></div>`;
        if (window.lucide) window.lucide.createIcons();
    }

    document.addEventListener('click', event => {
        const qtyButton = event.target.closest('[data-qty]');
        if (qtyButton) { updateQuantity(qtyButton.dataset.id, Number(qtyButton.dataset.qty)); return; }
        const removeButton = event.target.closest('[data-remove]');
        if (removeButton) { removeItem(removeButton.dataset.remove); return; }
        if (event.target.closest('#apply-voucher')) applyVoucher();
        if (event.target.closest('[data-close-cart]')) toggleCart(false);
        if (event.target.closest('[data-close-checkout]')) closeCheckoutModal();
    });
    document.addEventListener('submit', event => { if (event.target.id === 'checkout-form') processOrder(event); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            if (checkout.classList.contains('is-open')) closeCheckoutModal();
            else if (drawer.classList.contains('is-open')) toggleCart(false);
        }
    });

    window.addToCart = addToCart;
    window.updateQuantity = updateQuantity;
    window.toggleCart = toggleCart;
    window.openCheckoutModal = openCheckoutModal;
    window.closeCheckoutModal = closeCheckoutModal;
    window.processOrder = processOrder;
    window.updateCartUI = updateCartUI;
    window.UPXOCart = { addItem, open: () => toggleCart(true), openCheckout: openCheckoutModal, getItems: () => cart.slice(), getTotals: totals };

    updateCartUI();
})();
