// Trendy Gallery - product import + customer card hardening
(() => {
  'use strict';

  const state = { imported: null, debounce: null };
  const uniq = arr => [...new Set((arr || []).filter(Boolean))];
  const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const validHttp = value => {
    try { const u = new URL(value); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch { return false; }
  };
  const absUrl = (src, base) => {
    try { return new URL(src, base).href; } catch { return ''; }
  };
  const safeImages = (images, base = '') => uniq((images || []).map(x => absUrl(x, base)).filter(validHttp))
    .filter(src => !/logo|icon|sprite|pixel|avatar|favicon|payment|badge|placeholder/i.test(src))
    .slice(0, 12);
  const normalizePrice = value => {
    const s = clean(value).replace(/\s/g, '');
    const m = s.match(/\d[\d.,]*/);
    return m ? m[0] : '';
  };
  const list = value => uniq((Array.isArray(value) ? value : [value])
    .flatMap(v => String(v || '').split(/[,،|/]/)).map(clean).filter(Boolean));
  const first = (...v) => v.map(clean).find(Boolean) || '';

  function flatten(node, out = []) {
    if (!node) return out;
    if (Array.isArray(node)) { node.forEach(x => flatten(x, out)); return out; }
    if (typeof node !== 'object') return out;
    if (node['@graph']) flatten(node['@graph'], out);
    out.push(node);
    return out;
  }

  function productLd(doc) {
    const nodes = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try { flatten(JSON.parse(s.textContent || '{}'), nodes); } catch {}
    });
    return nodes.find(n => {
      const t = n?.['@type'];
      return t === 'Product' || (Array.isArray(t) && t.includes('Product'));
    }) || null;
  }

  function meta(doc, ...names) {
    for (const name of names) {
      const el = [...doc.querySelectorAll('meta')].find(m => m.getAttribute('property') === name || m.getAttribute('name') === name);
      if (el?.content) return clean(el.content);
    }
    return '';
  }

  async function proxyText(url) {
    const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('proxy');
    const d = await r.json();
    return d.contents || '';
  }

  function shopifyOptions(product, rx) {
    const out = [];
    (product?.options || []).forEach(opt => {
      if (rx.test(clean(opt?.name).toLowerCase())) out.push(...(opt?.values || []));
    });
    return uniq(out.map(clean).filter(Boolean));
  }

  async function importShopify(url) {
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/products\/([^/?#]+)/i);
      if (!m) return null;
      const jsonUrl = `${u.origin}/products/${m[1]}.json`;
      let data = null;
      try {
        const r = await fetch(jsonUrl, { signal: AbortSignal.timeout(6000) });
        if (r.ok) data = await r.json();
      } catch {}
      if (!data) data = JSON.parse(await proxyText(jsonUrl));
      const p = data?.product;
      if (!p) return null;
      const imgs = safeImages((p.images || []).map(x => x?.src), url);
      const variant = (p.variants || []).find(v => v?.available !== false) || p.variants?.[0] || {};
      return {
        name: clean(p.title),
        img: imgs[0] || '', imgs,
        price: normalizePrice(variant.price || variant.compare_at_price || ''),
        currency: 'TRY',
        colors: shopifyOptions(p, /color|colour|renk|لون/i),
        sizes: shopifyOptions(p, /size|beden|numara|ölçü|مقاس|قياس/i),
        productType: first(p.product_type, Array.isArray(p.tags) ? p.tags.join(' ') : p.tags)
      };
    } catch { return null; }
  }

  function regexPrice(html) {
    const patterns = [
      /["']price["']\s*:\s*["']?([0-9]+(?:[.,][0-9]+)?)/i,
      /["']salePrice["']\s*:\s*["']?([0-9]+(?:[.,][0-9]+)?)/i,
      /["']currentPrice["']\s*:\s*["']?([0-9]+(?:[.,][0-9]+)?)/i,
      /product:price:amount[^>]+content=["']([^"']+)/i,
      /(?:₺|TL|TRY)\s*([0-9][0-9.,]*)/i,
      /([0-9][0-9.,]*)\s*(?:₺|TL|TRY)/i
    ];
    for (const rx of patterns) {
      const m = html.match(rx);
      if (m?.[1]) return normalizePrice(m[1]);
    }
    return '';
  }

  function genericFromHtml(html, url) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const p = productLd(doc);
    const offers = Array.isArray(p?.offers) ? p.offers[0] : p?.offers;

    // Highest-confidence product images first. Never collect arbitrary page images.
    const ld = Array.isArray(p?.image) ? p.image : p?.image ? [p.image] : [];
    const selectors = [
      '[data-product-gallery] img', '[data-product-media] img',
      '.product-gallery img', '.product__media img', '.product-images img',
      '.product-detail img', '.product-detail__gallery img',
      '[class*="product-gallery"] img', '[class*="product__media"] img',
      '[class*="product-image"] img'
    ];
    const gallery = [];
    selectors.forEach(sel => {
      doc.querySelectorAll(sel).forEach(i => gallery.push(i.getAttribute('data-src') || i.getAttribute('data-zoom-image') || i.getAttribute('data-original') || i.getAttribute('src') || ''));
    });
    const og = [meta(doc, 'og:image', 'twitter:image')].filter(Boolean);
    let imgs = safeImages(ld, url);
    if (imgs.length < 2) imgs = safeImages([...imgs, ...gallery], url);
    if (!imgs.length) imgs = safeImages(og, url);

    const price = normalizePrice(first(
      offers?.price,
      meta(doc, 'product:price:amount', 'og:price:amount'),
      doc.querySelector('[itemprop="price"]')?.getAttribute('content'),
      doc.querySelector('[itemprop="price"]')?.textContent,
      regexPrice(html)
    ));

    return {
      name: first(p?.name, meta(doc, 'og:title', 'twitter:title'), doc.title),
      img: imgs[0] || '', imgs,
      price,
      currency: first(offers?.priceCurrency, meta(doc, 'product:price:currency', 'og:price:currency'), 'TRY'),
      colors: list(p?.color || meta(doc, 'product:color')),
      sizes: list(p?.size || meta(doc, 'product:size')),
      productType: first(p?.category, meta(doc, 'product:category'))
    };
  }

  async function importGeneric(url) {
    try { return genericFromHtml(await proxyText(url), url); }
    catch {
      try {
        const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`, { signal: AbortSignal.timeout(10000) });
        const d = await r.json();
        if (d?.status !== 'success') return null;
        const imgs = safeImages([d.data?.image?.url], url); // one image only: never use unrelated page images
        return { name: clean(d.data?.title), img: imgs[0] || '', imgs, price: '', currency: 'TRY', colors: [], sizes: [], productType: '' };
      } catch { return null; }
    }
  }

  async function importProduct(url) {
    const a = await importShopify(url);
    const b = await importGeneric(url);
    if (!a && !b) return null;
    const out = a || b;
    if (a && b) {
      out.name = first(a.name, b.name);
      out.price = first(a.price, b.price);
      out.currency = first(a.currency, b.currency, 'TRY');
      // Shopify images are authoritative. Generic images only fill when Shopify has none.
      out.imgs = a.imgs?.length ? a.imgs : b.imgs || [];
      out.img = out.imgs[0] || first(a.img, b.img);
      out.colors = a.colors?.length ? a.colors : b.colors || [];
      out.sizes = a.sizes?.length ? a.sizes : b.sizes || [];
      out.productType = first(a.productType, b.productType);
    }
    out.imgs = safeImages(out.imgs || [out.img], url);
    out.img = out.img || out.imgs[0] || '';
    return out;
  }

  async function enhancedImport(url) {
    lastUrl = url; curImg = '';
    showSpin(true); showRetry(false); clearImgBox();
    const label = document.getElementById('amSpinTxt');
    if (label) label.textContent = lang === 'ar' ? 'جاري جلب بيانات المنتج...' : 'Importing product...';
    try {
      const data = await importProduct(url);
      if (!data?.img) throw new Error('image');
      state.imported = data;
      curImg = data.img;
      showSpin(false);
      setImgBox(data.img);
      showThumbs(data.imgs || [data.img]);
      const n = document.getElementById('nameInp');
      const p = document.getElementById('priceInp');
      const c = document.getElementById('catInp');
      if (n && data.name) n.value = clean(data.name).slice(0, 100);
      if (p) p.value = data.price || '';
      if (c) c.value = detectCat([data.productType, data.name, url].join(' '), data.name || '');
      document.getElementById('amManual').style.display = 'none';
      toast(lang === 'ar' ? `✅ تم جلب ${data.imgs.length} صورة${data.price ? ' والسعر' : ''}` : '✅ Product imported');
    } catch {
      state.imported = null;
      showSpin(false); showRetry(true); hideThumbs(); toast(t('ffail'));
    }
  }

  async function enhancedSave() {
    if (saving) return;
    const url = document.getElementById('urlInp')?.value.trim() || '';
    if (!url) return;
    const eid = document.getElementById('editId')?.value || '';
    if (bags.some(b => b.url === url && b.id !== eid)) { toast(t('dup')); return; }
    saving = true;
    const imported = state.imported && lastUrl === url ? state.imported : null;
    const cat = document.getElementById('catInp')?.value || 'bags';
    const old = eid ? bags.find(b => b.id === eid) : null;
    const primary = curImg || imported?.img || document.getElementById('imgInp')?.value.trim() || '';
    const imgs = safeImages(imported?.imgs || [primary], url);
    if (primary && validHttp(primary) && !imgs.includes(primary)) imgs.unshift(primary);
    const bag = {
      ...(old || {}),
      id: eid || Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: document.getElementById('nameInp')?.value.trim() || imported?.name || urlToName(url),
      url, img: primary, imgs,
      price: document.getElementById('priceInp')?.value.trim() || imported?.price || '',
      currency: imported?.currency || old?.currency || 'TRY',
      colors: imported?.colors?.length ? imported.colors.join(', ') : (old?.colors || ''),
      sizes: imported?.sizes?.length ? imported.sizes.join(', ') : (old?.sizes || ''),
      productType: imported?.productType || old?.productType || '',
      note: old?.note || '', status: old?.status || 'available', cat,
      addedAt: old?.addedAt || new Date().toISOString()
    };
    if (eid) { const i = bags.findIndex(b => b.id === eid); if (i >= 0) bags[i] = bag; else bags.unshift(bag); }
    else bags.unshift(bag);
    saveL(); pushSheets(); render(); buildCats();
    toast(t('saved')); closeAdd();
    state.imported = null; saving = false;
  }

  const loadImage = src => new Promise(resolve => {
    if (!src) return resolve(null);
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src;
  });
  const roundRect = (ctx,x,y,w,h,r) => { ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); };

  async function drawCustomerCard(b) {
    const preview = document.getElementById('cmPreview'); if (!preview) return;
    const colors = clean(document.getElementById('cmColorsInp')?.value || b.colors || '').split(/[,،]/).map(clean).filter(Boolean);
    const sizes = clean(document.getElementById('cmSizesInp')?.value || b.sizes || '').split(/[,،/ ]+/).map(clean).filter(Boolean);
    const price = clean(document.getElementById('cmPriceInp')?.value || b.price || '');
    const urls = safeImages(b.imgs || [b.img], b.url || '');
    const mainUrl = b.img || urls[0] || '';
    const sideUrls = urls.filter(x => x !== mainUrl).slice(0, 4); // ONLY same-product images
    const main = await loadImage(mainUrl);
    const thumbs = (await Promise.all(sideUrls.map(loadImage))).filter(Boolean);

    const W=400, DPR=2, PAD=16, R=18, topH=330, sideW=thumbs.length ? 122 : 0, mainW=thumbs.length ? W-sideW-6 : W;
    let infoH=64 + (price?28:0) + (colors.length?34:0) + (sizes.length?34:0);
    const H=topH+infoH;
    const canvas=document.createElement('canvas'); canvas.width=W*DPR; canvas.height=H*DPR;
    canvas.style.cssText='width:100%;display:block;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.2)';
    const ctx=canvas.getContext('2d'); ctx.scale(DPR,DPR);
    ctx.fillStyle='#faf9f7'; roundRect(ctx,0,0,W,H,R); ctx.fill();

    ctx.save(); ctx.beginPath(); ctx.rect(0,0,mainW,topH); ctx.clip(); ctx.fillStyle='#eeeae4'; ctx.fillRect(0,0,mainW,topH);
    if(main){const s=Math.min(mainW/main.naturalWidth,topH/main.naturalHeight);const dw=main.naturalWidth*s,dh=main.naturalHeight*s;ctx.drawImage(main,(mainW-dw)/2,(topH-dh)/2,dw,dh);} ctx.restore();

    if(thumbs.length){
      const gap=6,p=7, th=Math.floor((topH-p*2-gap*(thumbs.length-1))/thumbs.length), x=mainW+6+p, w=W-x-p;
      thumbs.forEach((im,i)=>{const y=p+i*(th+gap);ctx.save();roundRect(ctx,x,y,w,th,7);ctx.clip();ctx.fillStyle='#e7e2dc';ctx.fillRect(x,y,w,th);const s=Math.min(w/im.naturalWidth,th/im.naturalHeight);const dw=im.naturalWidth*s,dh=im.naturalHeight*s;ctx.drawImage(im,x+(w-dw)/2,y+(th-dh)/2,dw,dh);ctx.restore();});
    }

    ctx.font='700 13px Arial'; ctx.fillStyle='#fff'; ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=8;ctx.fillText('Trend ',14,14);const tw=ctx.measureText('Trend ').width;ctx.fillStyle='#c8962e';ctx.fillText('Store',14+tw,14);ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(200,150,46,.45)';ctx.beginPath();ctx.moveTo(0,topH);ctx.lineTo(W,topH);ctx.stroke();
    let y=topH+16;ctx.textAlign='right';ctx.textBaseline='top';ctx.fillStyle='#1a1410';ctx.font='700 14px Tajawal,Arial';ctx.fillText((b.name||'').slice(0,55),W-PAD,y);y+=30;
    if(price){ctx.fillStyle='#c8962e';ctx.font='700 13px Arial';ctx.fillText((b.currency||'TRY')+' '+price,W-PAD,y);y+=28;}
    if(colors.length){ctx.textAlign='left';ctx.fillStyle='#999';ctx.font='600 9px Arial';ctx.fillText('COLORS',PAD,y);y+=14;let x=PAD;colors.slice(0,7).forEach(col=>{ctx.fillStyle=cHex(col);ctx.beginPath();ctx.arc(x+7,y+8,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#444';ctx.font='500 10px Tajawal,Arial';ctx.fillText(col,x+18,y+2);x+=Math.min(ctx.measureText(col).width+32,80);});y+=20;}
    if(sizes.length){ctx.textAlign='left';ctx.fillStyle='#999';ctx.font='600 9px Arial';ctx.fillText('SIZES',PAD,y);y+=14;ctx.fillStyle='#555';ctx.font='600 10px Arial';ctx.fillText(sizes.slice(0,8).join('  •  '),PAD,y);y+=20;}
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.font='400 9px Arial';ctx.textAlign='right';ctx.fillText('Gacela Gallery',W-PAD,H-12);
    preview.innerHTML=''; preview.appendChild(canvas); preview._canvas=canvas;
  }

  function openEnhancedCard(id) {
    const b=bags.find(x=>x.id===id); if(!b) return;
    _curCardId=id;
    document.getElementById('cmColorsInp').value=b.colors||'';
    document.getElementById('cmSizesInp').value=b.sizes||'';
    document.getElementById('cmPriceInp').value=b.price||'';
    document.getElementById('cardOv').classList.add('open');
    requestAnimationFrame(()=>drawCustomerCard(b));
  }

  async function cardCanvas(){const b=bags.find(x=>x.id===_curCardId);if(b)await drawCustomerCard(b);const c=document.getElementById('cmPreview')?._canvas;if(!c)throw new Error('No canvas');return c;}
  async function shareEnhanced(){try{const canvas=await cardCanvas();const b=bags.find(x=>x.id===_curCardId);canvas.toBlob(async blob=>{const file=new File([blob],'product-card.png',{type:'image/png'});if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:b?.name||'Gacela Gallery'});else downloadEnhanced();},'image/png',1);}catch(e){if(e.name!=='AbortError')toast('⚠️ '+e.message);}}
  async function downloadEnhanced(){try{const c=await cardCanvas();const b=bags.find(x=>x.id===_curCardId);const a=document.createElement('a');a.download=(b?.name||'product-card')+'.png';a.href=c.toDataURL('image/png',1);document.body.appendChild(a);a.click();a.remove();toast(lang==='ar'?'✅ تم التحميل':'✅ Downloaded');}catch(e){toast('⚠️ '+e.message);}}

  // Capture critical interactions BEFORE legacy inline handlers.
  document.addEventListener('input', e => {
    if (e.target?.id !== 'urlInp') return;
    e.stopImmediatePropagation();
    const url=e.target.value.trim();
    const save=document.getElementById('saveBtn'), top=document.getElementById('saveBtnTop');
    if(save) save.disabled=!url; if(top){top.disabled=!url;top.classList.toggle('ready',!!url);}
    clearTimeout(state.debounce);
    if(!url || !validHttp(url)) return;
    state.debounce=setTimeout(()=>enhancedImport(url),650);
  }, true);

  document.addEventListener('click', e => {
    const el=e.target.closest?.('button,.fab'); if(!el) return;
    if(el.classList.contains('fab')){state.imported=null;return;}
    if(el.id==='saveBtnTop'||el.id==='saveBtn'){e.preventDefault();e.stopImmediatePropagation();enhancedSave();return;}
    if(el.classList.contains('ca-card')){
      const m=(el.getAttribute('onclick')||'').match(/openCardModal\('([^']+)'\)/);
      if(m){e.preventDefault();e.stopImmediatePropagation();openEnhancedCard(m[1]);}
    }
  }, true);

  // Also replace globals used by card modal buttons.
  window.drawCard=drawCustomerCard;
  window.openCardModal=openEnhancedCard;
  window.updateCard=()=>{const b=bags.find(x=>x.id===_curCardId);if(b)drawCustomerCard(b);};
  window.shareCard=shareEnhanced;
  window.downloadCard=downloadEnhanced;
  window.doFetch=enhancedImport;
  window.saveBag=enhancedSave;
})();