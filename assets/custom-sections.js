/* Namespaced helpers */
const CGrid = (() => {
  const qs  = (sel, ctx=document) => ctx.querySelector(sel);
  const qsa = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  /* open modal for a product handle */
  async function openModal(sectionEl, handle) {
    const modal = qs('[data-modal]', sectionEl);
    const titleEl = qs('[data-modal-title]', modal);
    const priceEl = qs('[data-modal-price]', modal);
    const descEl  = qs('[data-modal-desc]', modal);
    const imgEl   = qs('[data-modal-image]', modal);
    const optsWrap= qs('[data-options]', modal);
    const addBtn  = qs('[data-add]', modal);

    addBtn.disabled = true;
    addBtn.dataset.variantId = '';

    // fetch product json
    const res = await fetch(`/products/${handle}.js`);
    const product = await res.json();

    // fill basic info
    titleEl.textContent = product.title;
    priceEl.textContent = Shopify.formatMoney(product.price, window.theme && theme.moneyFormat || "${{amount}}");
    if (descEl) descEl.innerHTML = product.description || '';
    imgEl.src = product.images && product.images[0] ? product.images[0] : (product.featured_image || '');
    imgEl.alt = product.title;

    // render option selects
    optsWrap.innerHTML = '';
    const selects = product.options.map((opt, i) => {
      const wrap = document.createElement('div');
      const label = document.createElement('label');
      label.textContent = opt.name;
      const select = document.createElement('select');
      select.dataset.index = i;
      product.options_with_values[i].values.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        select.appendChild(o);
      });
      wrap.appendChild(label);
      wrap.appendChild(select);
      optsWrap.appendChild(wrap);
      return select;
    });

    // helper: find matching variant by selected options
    function getSelectedVariant() {
      if (!product.variants || !product.variants.length) return null;
      if (!selects.length) return product.variants[0];
      const chosen = selects.map(s => s.value);
      return product.variants.find(v => {
        const vs = [v.option1, v.option2, v.option3].filter(Boolean);
        return vs.every((val, idx) => val === chosen[idx]);
      }) || null;
    }

    function updateVariantState() {
      const v = getSelectedVariant();
      if (v && !v.available) { addBtn.disabled = true; addBtn.textContent = "Out of stock"; }
      else if (v) { addBtn.disabled = false; addBtn.textContent = "Add to Cart"; addBtn.dataset.variantId = String(v.id); priceEl.textContent = Shopify.formatMoney(v.price, window.theme && theme.moneyFormat || "${{amount}}"); }
      else { addBtn.disabled = true; addBtn.textContent = "Select options"; addBtn.dataset.variantId = ""; }
    }

    selects.forEach(s => s.addEventListener('change', updateVariantState));
    updateVariantState();

    // open
    modal.setAttribute('aria-hidden', 'false');

    // Add to cart click
    addBtn.onclick = async () => {
      const vid = addBtn.dataset.variantId;
      if (!vid) return;

      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(vid), quantity: 1 })
      });

      // special rule: if variant includes trigger color & size, also add Soft Winter Jacket
      const trigColor = sectionEl.dataset.triggerColor?.trim().toLowerCase();
      const trigSize  = sectionEl.dataset.triggerSize?.trim().toLowerCase();
      const chosen = selects.map(s => s.value.toLowerCase());
      const matches = chosen.includes(trigColor) && chosen.includes(trigSize);

      const softHandle = sectionEl.dataset.softHandle;
      if (matches && softHandle) {
        try {
          const r = await fetch(`/products/${softHandle}.js`);
          const soft = await r.json();
          const softVariantId = soft?.variants?.[0]?.id; // first available variant; can extend
          if (softVariantId) {
            await fetch('/cart/add.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: Number(softVariantId), quantity: 1 })
            });
          }
        } catch(e) { console.warn('Auto-add jacket failed', e); }
      }

      modal.setAttribute('aria-hidden', 'true');
    };
  }

  function init(sectionEl) {
    // card open
    qsa('.cgrid__card [data-open], .cgrid__card .cgrid__imgbtn', sectionEl).forEach(btn => {
      btn.addEventListener('click', e => {
        const card = e.currentTarget.closest('.cgrid__card');
        openModal(sectionEl, card.dataset.handle);
      });
    });

    // close actions
    const modal = qs('[data-modal]', sectionEl);
    qsa('[data-close]', modal).forEach(el => el.addEventListener('click', () => modal.setAttribute('aria-hidden','true')));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') modal.setAttribute('aria-hidden','true');
    });
  }

  // auto-init each section instance
  document.addEventListener('DOMContentLoaded', () => {
    qsa('[data-section="cgrid"]').forEach(init);
  });

  return { init };
})();
