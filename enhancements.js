// Trendy Gallery - targeted enhancement layer
// Keeps the approved UI intact while improving product import, customer cards,
// and disabling automatic background refreshes.
(() => {
  'use strict';

  const state = { imported: null };
  const uniq = arr => [...new Set((arr || []).filter(Boolean))];
  const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const textList = v => uniq((Array.isArray(v) ? v : [v]).flatMap(x => String(x || '').split(/[,،|/]/)).map(clean).filter(Boolean));
  const validHttpUrl = value => {
    try { const u = new URL(value); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch { return false; }
  };
  const safeImages = images => uniq(images)
    .map(x => typeof x === 'string' ? x : (x?.url || x?.src || x?.contentUrl || ''))
    .filter(validHttpUrl)
    .filter(src => !/logo|icon|sprite|pixel|avatar|favicon|payment|badge|placeholder/i.test(src))
    .slice(0, 12);
  const normalizePrice = value => {
    const s = clean(value).replace(/\s/g, '').replace(/₺|TL|TRY/gi, '');
    const m = s.match(/\d[\d.,]*/);
    return m ? m[0] : '';
  };
  const first = (...vals) => vals.map(clean).find(Boolean) || '';

  function flattenJsonLd(node, out = []) {
    if (!node) return out;
    if (Array.isArray(node)) { node.forEach(x => flattenJsonLd(x, out)); return out; }
    if (typeof node !== 'object') return out;
    if (node['@graph']) flattenJsonLd(node['@graph'], out);
    out.push(node);
    return out;
  }

  function parseJsonLd(doc) {
    const nodes = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try { flattenJsonLd(JSON.parse(script.textContent || '{}'), nodes); } catch {}
    });
    return nodes;
  }

  function findProductLd(nodes) {
    return nodes.find(n => {
      const t = n?.['@type'];
      return t === 'Product' || (Array.isArray(t) && t.includes('Product'));
    }) || null;
  }

  function meta(doc, ...keys) {
    for (const key of keys) {
      const escaped = window.CSS?.escape ? CSS.escape(key) : key.replace(/"/g, '\\"');
      const el = doc.querySelector(`meta[property="${escaped}"],meta[name="${escaped}"]`);
      if (el?.content) return clean(el.content);
    }
    return '';
  }

  function optionValuesFromShopify(product, keyword) {
    const values = [];
    (product?.options || []).forEach(opt => {
      const name = clean(opt?.name).toLowerCase();
      if (keyword.test(name)) values.push(...(opt?.values || []));
    });
    return uniq(values.map(clean).filter(Boolean).filter(v => !/^default title$/i.test(v)));
  }

  async function viaAllOrigins(url) {
    const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('allorigins');
    const d = await r.json();
    return d.contents || '';
  }

  async function importShopify(url) {
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/products\/([^/?#]+)/i);
      if (!m) return null;
      const jsonUrl = `${u.origin}/products/${m[1]}.json`;
      let data;
      try {
        const direct = await fetch(jsonUrl, { signal: AbortSignal.timeout(6000) });
        if (direct.ok) data = await direct.json();
      } catch {}
      if (!data) data = JSON.parse(await viaAllOrigins(jsonUrl));
      const p = data?.product;
      if (!p) return null;

      const imgs = safeImages(p.images || []);
      const availableVariant = (p.variants || []).find(v => v?.available !== false) || p.variants?.[0] || {};
      const rawPrice = first(availableVariant.price, availableVariant.compare_at_price, p.price);
      const price = normalizePrice(rawPrice);
      const colorOpt = optionValuesFromShopify(p, /color|colour|renk|لون/i);
      const sizeOpt = optionValuesFromShopify(p, /size|beden|numara|ölçü|مقاس|قياس/i);

      return {
        name: clean(p.title),
        img: imgs[0] || '',
        imgs,
        price,
        currency: first(availableVariant.currency, 'TRY'),
        colors: colorOpt,
        sizes: sizeOpt,
        productType: first(p.product_type, Array.isArray(p.tags) ? p.tags.join(' ') : p.tags)
      };
    } catch { return null; }
  }

  function extractFromHtml(html, url) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nodes = parseJsonLd(doc);
    const p = findProductLd(nodes);
    const offerList = Array.isArray(p?.offers) ? p.offers : p?.offers ? [p.offers] : [];
    const offer = offerList.find(o => o?.availability?.includes?.('InStock')) || offerList[0] || {};

    const ldImages = Array.isArray(p?.image) ? p.image : p?.image ? [p.image] : [];
    const ogImages = [...doc.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"],meta[property="product:image"]')].map(x => x.content);
    const productImgs = [...doc.querySelectorAll('img')]
      .map(i => i.currentSrc || i.src || i.dataset.src || i.dataset.zoomImage || i.dataset.original || i.dataset.lazy || '')
      .filter(src => validHttpUrl(src));
    const imgs = safeImages([...ldImages, ...ogImages, ...productImgs]);

    const price = normalizePrice(first(
      offer?.price,
      offer?.lowPrice,
      meta(doc, 'product:price:amount', 'og:price:amount', 'twitter:data1'),
      doc.querySelector('[itemprop="price"]')?.getAttribute('content'),
      doc.querySelector('[itemprop="price"]')?.textContent,
      doc.querySelector('[data-product-price]')?.textContent,
      doc.querySelector('[data-price]')?.getAttribute('data-price'),
      doc.querySelector('.price')?.textContent
    ));
    const currency = first(offer?.priceCurrency, meta(doc, 'product:price:currency', 'og:price:currency'), 'TRY');
    const colors = textList(first(p?.color, meta(doc, 'product:color')));
    const sizes = textList(first(p?.size, meta(doc, 'product:size')));
    const productType = first(p?.category, meta(doc, 'product:category'), meta(doc, 'og:type'));
    const name = first(p?.name, meta(doc, 'og:title', 'twitter:title'), doc.title);

    return { name, img: imgs[0] || '', imgs, price, currency, colors, sizes, productType, url };
  }

  async function importGeneric(url) {
    const candidates = [];
    try { candidates.push(extractFromHtml(await viaAllOrigins(url), url)); } catch {}
    try {
      const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`, { signal: AbortSignal.timeout(10000) });
      const d = await r.json();
      if (d?.status === 'success') {
        const imgs = safeImages([d.data?.image?.url, ...(d.data?.images || []).map(i => typeof i === 'string' ? i : i?.url)]);
        candidates.push({ name: clean(d.data?.title), img: imgs[0] || '', imgs, price: normalizePrice(d.data?.price || ''), currency: '', colors: [], sizes: [], productType: '' });
      }
    } catch {}

    return candidates.sort((a, b) => {
      const score = x => (x.price ? 20 : 0) + Math.min(x.imgs?.length || 0, 8) + (x.name ? 4 : 0) + (x.colors?.length || 0) + (x.sizes?.length || 0);
      return score(b) - score(a);
    })[0] || null;
  }

  async function importProduct(url) {
    if (!validHttpUrl(url)) return null;
    const [shopify, generic] = await Promise.all([importShopify(url), importGeneric(url)]);
    const best = shopify || generic;
    if (!best) return null;

    if (shopify && generic) {
      best.name = first(shopify.name, generic.name);
      best.price = first(shopify.price, generic.price);
      best.currency = first(shopify.currency, generic.currency, 'TRY');
      best.imgs = safeImages([...(shopify.imgs || []), ...(generic.imgs || [])]);
      best.img = best.imgs[0] || first(shopify.img, generic.img);
      best.colors = uniq([...(shopify.colors || []), ...(generic.colors || [])]);
      best.sizes = uniq([...(shopify.sizes || []), ...(generic.sizes || [])]);
      best.productType = first(shopify.productType, generic.productType);
    }
    best.imgs = safeImages(best.imgs || [best.img]);
    best.img = best.img || best.imgs[0] || '';
    return best;
  }

  const originalDoFetch = window.doFetch;
  const originalSaveBag = window.saveBag;
  const originalDrawCard = window.drawCard;
  const originalSyncSheets = window.syncSheets;

  // Disable background refreshes. Manual sync button still calls the original.
  if (typeof originalSyncSheets === 'function') {
    window.syncSheets = function(...args) {
      const ev = window.event;
      if (ev && ev.type === 'click') return originalSyncSheets.apply(this, args);
      return Promise.resolve();
    };
  }

  window.doFetch = async function(url) {
    const spinTxt = document.getElementById('amSpinTxt');
    if (spinTxt) spinTxt.textContent = lang === 'ar' ? 'جاري جلب بيانات المنتج...' : 'Importing product...';
    lastUrl = url; curImg = ''; showSpin(true); showRetry(false); clearImgBox();

    try {
      let data = await importProduct(url);
      if (!data?.img && typeof originalDoFetch === 'function') {
        // Let the old importer find an image, but never use unrelated products later in the card.
        await originalDoFetch.call(this, url);
        data = {
          name: document.getElementById('nameInp')?.value || '',
          img: curImg || '',
          imgs: curImg ? [curImg] : [],
          price: document.getElementById('priceInp')?.value || '',
          currency: 'TRY', colors: [], sizes: [], productType: ''
        };
      }
      showSpin(false);
      if (!data?.img) throw new Error('no image');

      state.imported = data;
      window.__tgImportData = data;
      curImg = data.img;
      setImgBox(data.img);
      showThumbs(data.imgs || [data.img]);

      const nameInput = document.getElementById('nameInp');
      if (data.name && nameInput) nameInput.value = clean(data.name).slice(0, 100);
      const priceInput = document.getElementById('priceInp');
      if (priceInput) priceInput.value = data.price || '';
      const categorySignal = [data.productType, data.name, url].filter(Boolean).join(' ');
      const catInput = document.getElementById('catInp');
      if (catInput) catInput.value = detectCat(categorySignal, data.name || '');

      document.getElementById('amManual').style.display = 'none';
      toast(lang === 'ar'
        ? `✅ تم جلب ${data.imgs?.length || 1} صورة${data.price ? ' والسعر' : ''}`
        : '✅ Product imported');
    } catch (e) {
      state.imported = null;
      window.__tgImportData = null;
      showSpin(false);
      showRetry(true); hideThumbs(); toast(t('ffail'));
    }
  };

  if (typeof originalSaveBag === 'function') {
    window.saveBag = async function(...args) {
      const url = document.getElementById('urlInp')?.value.trim() || '';
      const imported = state.imported && lastUrl === url ? state.imported : null;

      // Put imported values into the original form BEFORE it creates the record.
      if (imported) {
        const p = document.getElementById('priceInp');
        if (p && imported.price) p.value = imported.price;
        const n = document.getElementById('nameInp');
        if (n && imported.name && !n.value) n.value = imported.name;
        if (imported.img) curImg = imported.img;
      }

      await originalSaveBag.apply(this, args);
      if (!imported) return;

      const bag = bags.find(b => b.url === url);
      if (!bag) return;
      bag.imgs = safeImages(imported.imgs || [bag.img]);
      if (bag.img && !bag.imgs.includes(bag.img)) bag.imgs.unshift(bag.img);
      bag.currency = imported.currency || 'TRY';
      if (imported.price) bag.price = imported.price;
      if (imported.colors?.length) bag.colors = imported.colors.join(', ');
      if (imported.sizes?.length) bag.sizes = imported.sizes.join(', ');
      bag.productType = imported.productType || '';
      saveL(); pushSheets(); render(); buildCats();
      state.imported = null;
      window.__tgImportData = null;
    };
  }

  // Critical rule: card thumbnails may ONLY come from this exact product.
  if (typeof originalDrawCard === 'function') {
    window.drawCard = async function(b) {
      const images = safeImages(b?.imgs || [])
        .filter(src => src !== b?.img)
        .slice(0, 4);

      // The old renderer discovers thumbnails by scanning `bags`.
      // Give it ONLY the current product + synthetic rows made from this product's own images.
      const originalBags = bags;
      const synthetic = images.map((img, i) => ({
        id: `__same_product_${i}`,
        cat: b.cat,
        img,
        name: b.name,
        url: b.url
      }));
      try {
        bags = [b, ...synthetic];
        return await originalDrawCard.call(this, b);
      } finally {
        bags = originalBags;
      }
    };
  }

  const originalOpenAdd = window.openAdd;
  if (typeof originalOpenAdd === 'function') {
    window.openAdd = function(...args) {
      state.imported = null;
      window.__tgImportData = null;
      return originalOpenAdd.apply(this, args);
    };
  }
})();