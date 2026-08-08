// Gacela Gallery - browser importer bridge
(() => {
  'use strict';

  const BROWSER_ENDPOINT = 'https://trendy-gallery.vercel.app/api/import-product';
  const SUPABASE_URL = 'https://uoydoungeplepusrsill.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_4N5mjsKVHFfKZglcUO-yBw_iCC9owhz';
  const LEGACY_ENDPOINT = `${SUPABASE_URL}/functions/v1/import-product`;
  const originalDoFetch = window.doFetch;
  const originalSaveBag = window.saveBag;

  const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const uniq = arr => [...new Set((arr || []).filter(Boolean))];

  async function callJson(endpoint, url, headers = {}) {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ url })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }

  async function backendImport(url) {
    try {
      const data = await callJson(BROWSER_ENDPOINT, url);
      if (Array.isArray(data?.images) && data.images.length) return data;
      throw new Error('browser_import_incomplete');
    } catch (browserError) {
      // Temporary fallback while browser importer coverage is expanded.
      return callJson(LEGACY_ENDPOINT, url, {
        apikey: SUPABASE_KEY,
        authorization: `Bearer ${SUPABASE_KEY}`
      });
    }
  }

  window.doFetch = async function(url) {
    const spinTxt = document.getElementById('amSpinTxt');
    if (spinTxt) spinTxt.textContent = lang === 'ar' ? 'جاري قراءة المنتج...' : 'Reading product...';
    lastUrl = url;
    curImg = '';
    showSpin(true);
    showRetry(false);
    clearImgBox();

    try {
      const data = await backendImport(url);
      const imgs = uniq(data.images || []);
      if (!imgs.length) throw new Error('no_images');

      window.__gacelaBackendImport = { ...data, url };
      curImg = imgs[0];
      setImgBox(curImg);
      showThumbs(imgs);

      const nameInput = document.getElementById('nameInp');
      if (nameInput && data.name) nameInput.value = clean(data.name).slice(0, 100);

      const priceInput = document.getElementById('priceInp');
      if (priceInput) priceInput.value = clean(data.price || '');

      const catInput = document.getElementById('catInp');
      if (catInput && data.category) catInput.value = data.category;

      document.getElementById('amManual').style.display = 'none';
      showSpin(false);
      toast(lang === 'ar'
        ? `✅ ${imgs.length} صورة${data.price ? ' + السعر' : ''}${data.colors?.length ? ' + اللون' : ''}${data.sizes?.length ? ' + المقاسات' : ''}`
        : '✅ Product imported');
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

      bag.imgs = uniq(imported.images || []).slice(0, 12);
      if (bag.img && !bag.imgs.includes(bag.img)) bag.imgs.unshift(bag.img);
      bag.price = clean(imported.price || bag.price);
      bag.currency = clean(imported.currency || bag.currency || 'TRY');
      bag.colors = Array.isArray(imported.colors) && imported.colors.length
        ? imported.colors.join(', ')
        : bag.colors || '';
      bag.sizes = Array.isArray(imported.sizes) && imported.sizes.length
        ? imported.sizes.join(', ')
        : bag.sizes || '';
      bag.cat = imported.category || bag.cat;
      bag.importSource = imported.source || 'browser';

      saveL();
      pushSheets();
      render();
      buildCats();
      window.__gacelaBackendImport = null;
    };
  }

  const originalOpenAdd = window.openAdd;
  if (typeof originalOpenAdd === 'function') {
    window.openAdd = function(...args) {
      window.__gacelaBackendImport = null;
      return originalOpenAdd.apply(this, args);
    };
  }
})();
