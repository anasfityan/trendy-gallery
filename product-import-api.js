// Gacela Gallery - unified smart product importer bridge
(() => {
  'use strict';

  const SUPABASE_URL = 'https://uoydoungeplepusrsill.supabase.co';
  const UNIFIED_ENDPOINT = `${SUPABASE_URL}/functions/v1/product-unified-api`;
  const IMAGE_PROXY = `${SUPABASE_URL}/functions/v1/product-image-proxy`;

  const originalDoFetch = window.doFetch;
  const originalSaveBag = window.saveBag;
  const originalOpenAdd = window.openAdd;

  const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const uniq = arr => [...new Set((Array.isArray(arr) ? arr : []).map(clean).filter(Boolean))];

  function normalizeImported(data, url) {
    const keySpecs = data?.keySpecs && typeof data.keySpecs === 'object' ? data.keySpecs : {};
    return {
      ...data,
      url,
      name: clean(data?.name || ''),
      price: clean(data?.price || ''),
      currency: clean(data?.currency || 'TRY') || 'TRY',
      images: uniq(data?.images || []).slice(0, 20),
      colors: uniq(data?.colors || []),
      sizes: uniq(data?.sizes || []),
      category: clean(data?.category || ''),
      brand: clean(data?.brand || ''),
      dimensions: clean(data?.dimensions || keySpecs.dimensions || ''),
      volume: clean(data?.volume || keySpecs.amount || ''),
      keySpecs: { ...keySpecs },
      details: Array.isArray(data?.details) ? data.details.map(clean).filter(Boolean) : [],
      source: clean(data?.unifiedSource || data?.source || 'unified-api') || 'unified-api',
    };
  }

  async function backendImport(url) {
    const response = await fetch(UNIFIED_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || data?.message || `HTTP ${response.status}`);

    const imported = normalizeImported(data, url);
    if (!imported.images.length || !imported.name) throw new Error('unified_import_incomplete');
    return imported;
  }

  function productTypeText(data, url) {
    return [data.category, data.name, data.brand, data.keySpecs?.material, data.keySpecs?.form, data.keySpecs?.compatibility, url]
      .filter(Boolean).join(' ');
  }

  function fillExistingFields(data, url) {
    const nameInput = document.getElementById('nameInp');
    if (nameInput && data.name) nameInput.value = data.name.slice(0, 120);

    const priceInput = document.getElementById('priceInp');
    if (priceInput) priceInput.value = data.price || '';

    const catInput = document.getElementById('catInp');
    if (catInput) {
      const detected = typeof detectCat === 'function'
        ? detectCat(productTypeText(data, url), data.name || '')
        : data.category;
      if (detected) catInput.value = detected;
    }
  }

  function importSummary(data) {
    const parts = [];
    if (data.images.length) parts.push(`${data.images.length} صورة`);
    if (data.price) parts.push('السعر');
    if (data.colors.length) parts.push('الألوان');
    if (data.sizes.length) parts.push('المقاسات');
    if (Object.keys(data.keySpecs || {}).length) parts.push('المواصفات');
    return parts.join(' + ');
  }

  window.doFetch = async function(url) {
    const spinTxt = document.getElementById('amSpinTxt');
    if (spinTxt) spinTxt.textContent = lang === 'ar' ? 'جاري تحليل المنتج ومواصفاته...' : 'Analyzing product...';

    lastUrl = url;
    curImg = '';
    showSpin(true);
    showRetry(false);
    clearImgBox();

    try {
      const data = await backendImport(url);
      window.__gacelaBackendImport = data;

      curImg = data.images[0];
      setImgBox(curImg);
      showThumbs(data.images);
      fillExistingFields(data, url);

      const manual = document.getElementById('amManual');
      if (manual) manual.style.display = 'none';

      showSpin(false);
      toast(lang === 'ar' ? `✅ تم الاستيراد: ${importSummary(data)}` : '✅ Product imported');
    } catch (e) {
      window.__gacelaBackendImport = null;
      showSpin(false);
      if (typeof originalDoFetch === 'function') return originalDoFetch.call(this, url);
      showRetry(true);
      toast(lang === 'ar' ? '⚠️ تعذر استيراد المنتج' : '⚠️ Import failed');
    }
  };

  if (typeof originalSaveBag === 'function') {
    window.saveBag = async function(...args) {
      const url = document.getElementById('urlInp')?.value.trim() || '';
      const imported = window.__gacelaBackendImport && window.__gacelaBackendImport.url === url
        ? window.__gacelaBackendImport
        : null;

      await originalSaveBag.apply(this, args);
      if (!imported) return;

      const bag = bags.find(b => b.url === url);
      if (!bag) return;

      bag.imgs = uniq(imported.images || []).slice(0, 20);
      if (bag.img && !bag.imgs.includes(bag.img)) bag.imgs.unshift(bag.img);
      bag.price = imported.price || bag.price || '';
      bag.currency = imported.currency || bag.currency || 'TRY';
      bag.colors = imported.colors.length ? imported.colors.join(', ') : (bag.colors || '');
      bag.sizes = imported.sizes.length ? imported.sizes.join(', ') : (bag.sizes || '');
      bag.brand = imported.brand || bag.brand || '';
      bag.dimensions = imported.dimensions || bag.dimensions || '';
      bag.volume = imported.volume || bag.volume || '';
      bag.keySpecs = { ...(imported.keySpecs || {}) };
      bag.details = [...(imported.details || [])];
      bag.importSource = imported.source || 'unified-api';
      bag.importedAt = new Date().toISOString();

      saveL();
      pushSheets();
      render();
      buildCats();
      window.__gacelaBackendImport = null;
    };
  }

  if (typeof originalOpenAdd === 'function') {
    window.openAdd = function(...args) {
      window.__gacelaBackendImport = null;
      return originalOpenAdd.apply(this, args);
    };
  }

  window.gacelaProductImageProxy = src => src ? `${IMAGE_PROXY}?image=${encodeURIComponent(src)}` : '';
})();
