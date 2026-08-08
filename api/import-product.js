import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';

const ALLOWED = new Set([
  'www.gratis.com','gratis.com','www.hepsiburada.com','hepsiburada.com',
  'www.stradivarius.com','stradivarius.com','www.altuda.com.tr','altuda.com.tr',
  'www.bershka.com','bershka.com','www.shulebags.com','shulebags.com',
  'www.nisantasishoes.com','nisantasishoes.com'
]);

const clean = v => String(v ?? '').replace(/\s+/g,' ').trim();
const uniq = arr => [...new Set((arr || []).filter(Boolean))];
const normalizePrice = v => {
  const s = clean(v).replace(/\s/g,'');
  const m = s.match(/\d[\d.,]*/);
  return m ? m[0] : '';
};
const detectCategory = (...vals) => {
  const s = vals.join(' ').toLowerCase();
  if (/shoe|ayakkabı|ayakkabi|sneaker|boot|sandal|topuklu|babet/.test(s)) return 'shoes';
  if (/dress|shirt|tshirt|t-shirt|blouse|skirt|jacket|coat|pantolon|gömlek|gomlek|elbise|ceket|kazak/.test(s)) return 'clothes';
  if (/bag|çanta|canta|handbag|backpack|clutch|tote|omuz|shopper/.test(s)) return 'bags';
  return 'acc';
};

function isPublicUrl(raw) {
  try {
    const u = new URL(raw);
    return ['http:','https:'].includes(u.protocol) && ALLOWED.has(u.hostname);
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const url = req.body?.url;
  if (!isPublicUrl(url)) return res.status(400).json({ error: 'unsupported_domain' });

  let browser;
  try {
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    const context = await browser.newContext({
      locale: 'tr-TR',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
    });
    const page = await context.newPage();

    await page.route('**/*', route => {
      const t = route.request().resourceType();
      if (['font','media'].includes(t)) return route.abort();
      return route.continue();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 });
    await page.waitForTimeout(1200);

    const data = await page.evaluate(() => {
      const clean = v => String(v ?? '').replace(/\s+/g,' ').trim();
      const uniq = arr => [...new Set((arr || []).filter(Boolean))];
      const text = clean(document.body?.innerText || '');

      const meta = (...names) => {
        for (const name of names) {
          const el = [...document.querySelectorAll('meta')].find(m => m.getAttribute('property') === name || m.getAttribute('name') === name);
          if (el?.content) return clean(el.content);
        }
        return '';
      };

      const jsonNodes = [];
      for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const x = JSON.parse(el.textContent || '{}');
          const walk = n => {
            if (Array.isArray(n)) return n.forEach(walk);
            if (!n || typeof n !== 'object') return;
            jsonNodes.push(n);
            if (n['@graph']) walk(n['@graph']);
          };
          walk(x);
        } catch {}
      }
      const product = jsonNodes.find(n => {
        const t = n?.['@type'];
        return t === 'Product' || (Array.isArray(t) && t.includes('Product'));
      }) || null;
      const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;

      const imageCandidates = [];
      const addImg = src => {
        try {
          const u = new URL(src, location.href).href;
          if (!/^https?:/i.test(u)) return;
          if (/logo|icon|sprite|pixel|avatar|favicon|payment|badge|placeholder/i.test(u)) return;
          imageCandidates.push(u);
        } catch {}
      };
      const productImgs = Array.isArray(product?.image) ? product.image : product?.image ? [product.image] : [];
      productImgs.forEach(x => addImg(typeof x === 'string' ? x : x?.url || x?.contentUrl || ''));

      const gallerySelectors = [
        '[data-product-gallery] img','[data-product-media] img','.product-gallery img','.product__media img',
        '.product-images img','.product-detail img','.product-detail__gallery img','[class*="product-gallery"] img',
        '[class*="product__media"] img','[class*="product-image"] img','[class*="gallery"] img',
        '.swiper-slide img','.slick-slide img','.owl-item img'
      ];
      for (const sel of gallerySelectors) {
        document.querySelectorAll(sel).forEach(img => addImg(img.getAttribute('data-zoom-image') || img.getAttribute('data-src') || img.getAttribute('data-original') || img.currentSrc || img.src || ''));
      }
      if (!imageCandidates.length) addImg(meta('og:image','twitter:image'));

      const name = clean(product?.name || document.querySelector('h1')?.textContent || meta('og:title','twitter:title') || document.title);

      const priceCandidates = [];
      const pushPrice = v => { if (v != null && String(v).trim()) priceCandidates.push(String(v)); };
      pushPrice(offer?.price);
      pushPrice(document.querySelector('[itemprop="price"]')?.getAttribute('content'));
      pushPrice(document.querySelector('[itemprop="price"]')?.textContent);
      for (const el of document.querySelectorAll('[class*="price"],[data-price],[data-product-price]')) {
        const v = el.getAttribute('data-price') || el.getAttribute('data-product-price') || el.textContent;
        if (v && /\d/.test(v)) pushPrice(v);
      }
      const saleText = [...text.matchAll(/(?:sepette|indirimli fiyat|gratis kart ile|satış fiyatı|fiyat)\s*[:\-]?\s*([0-9][0-9.,]*)\s*(?:TL|TRY|₺)?/gi)].map(m => m[1]);
      saleText.forEach(pushPrice);
      const genericText = [...text.matchAll(/([0-9][0-9.,]*)\s*(?:TL|TRY|₺)/gi)].map(m => m[1]);
      genericText.forEach(pushPrice);

      const colors = [];
      const sizes = [];
      const colorLabels = ['Renk','Color','Colour'];
      const sizeLabels = ['Beden','Numara','Size','Ölçü'];
      const collectAfterLabel = (labels, target) => {
        const nodes = [...document.querySelectorAll('body *')].filter(el => {
          const v = clean(el.textContent);
          return v && v.length < 80 && labels.some(l => new RegExp(`^${l}\\s*:?$`,'i').test(v));
        });
        for (const node of nodes.slice(0,6)) {
          const parent = node.parentElement;
          if (!parent) continue;
          parent.querySelectorAll('button,li,label,option,span,a').forEach(el => {
            const v = clean(el.textContent || el.getAttribute('title') || el.getAttribute('aria-label'));
            if (v && v.length <= 40 && !labels.some(l => v.toLowerCase() === l.toLowerCase())) target.push(v);
          });
        }
      };
      collectAfterLabel(colorLabels, colors);
      collectAfterLabel(sizeLabels, sizes);

      if (product?.color) (Array.isArray(product.color) ? product.color : [product.color]).forEach(x => colors.push(clean(x)));
      if (product?.size) (Array.isArray(product.size) ? product.size : [product.size]).forEach(x => sizes.push(clean(x)));

      document.querySelectorAll('select[name*="size" i] option,select[id*="size" i] option,select[name*="beden" i] option,select[id*="beden" i] option').forEach(o => {
        const v = clean(o.textContent); if (v && !/seç|choose|select/i.test(v)) sizes.push(v);
      });
      document.querySelectorAll('select[name*="color" i] option,select[id*="color" i] option,select[name*="renk" i] option,select[id*="renk" i] option').forEach(o => {
        const v = clean(o.textContent); if (v && !/seç|choose|select/i.test(v)) colors.push(v);
      });

      return {
        name,
        priceCandidates,
        currency: clean(offer?.priceCurrency || 'TRY'),
        images: uniq(imageCandidates).slice(0,12),
        colors: uniq(colors).filter(v => v.length <= 40).slice(0,12),
        sizes: uniq(sizes).filter(v => v.length <= 20).slice(0,20),
        categoryHint: clean(product?.category || '')
      };
    });

    const normalizedPrices = uniq((data.priceCandidates || []).map(normalizePrice).filter(Boolean))
      .filter(v => Number(v.replace(/\./g,'').replace(',','.')) > 0);
    const price = normalizedPrices[0] || '';

    const result = {
      name: clean(data.name),
      price,
      currency: clean(data.currency || 'TRY'),
      images: uniq(data.images || []).slice(0,12),
      colors: uniq(data.colors || []).slice(0,12),
      sizes: uniq(data.sizes || []).slice(0,20),
      category: detectCategory(data.categoryHint || '', data.name || '', url),
      source: 'browser'
    };

    if (!result.name && !result.images.length) throw new Error('product_not_found');
    return res.status(200).json(result);
  } catch (error) {
    console.error('import-product', error);
    return res.status(500).json({ error: String(error?.message || error) });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
