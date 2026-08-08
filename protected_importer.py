import json,re,sys
from urllib.parse import urlparse,parse_qs
from curl_cffi import requests

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def uniq(xs):
    out=[]; seen=set()
    for x in xs:
        x=clean(x)
        if x and x not in seen: seen.add(x); out.append(x)
    return out

def session():
    s=requests.Session(impersonate='chrome')
    s.headers.update({'User-Agent':UA,'Accept-Language':'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'})
    return s

def jsonld_products(html):
    out=[]
    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',html,re.I):
        try:
            x=json.loads(m.group(1))
            stack=x if isinstance(x,list) else [x]
            for n in stack:
                if isinstance(n,dict) and (n.get('@type')=='Product' or 'Product' in (n.get('@type') or [])): out.append(n)
                if isinstance(n,dict) and isinstance(n.get('@graph'),list):
                    out += [g for g in n['@graph'] if isinstance(g,dict) and (g.get('@type')=='Product' or 'Product' in (g.get('@type') or []))]
        except: pass
    return out

def hepsiburada(url):
    s=session(); r=s.get(url,timeout=45,allow_redirects=True); r.raise_for_status(); html=r.text
    p=(jsonld_products(html) or [None])[0]
    title=clean((p or {}).get('name'))
    if not title:
        m=re.search(r'<title[^>]*>([\s\S]*?)</title>',html,re.I); title=clean(m.group(1) if m else '')
    offers=(p or {}).get('offers') or {}
    if isinstance(offers,list): offers=offers[0] if offers else {}
    images=(p or {}).get('image') or []
    if isinstance(images,str): images=[images]
    if not images:
        images=uniq(re.findall(r'https://productimages\.hepsiburada\.net/[^"\'\s<>]+',html,re.I))[:12]
    colors=[]
    for pat in [r'"(?:color|renk)"\s*:\s*"([^"]{2,40})"',r'Renk\s*</[^>]+>\s*<[^>]+>([^<]+)']:
        colors += re.findall(pat,html,re.I)
    attrs={}
    for m in re.finditer(r'"(?:name|key|attributeName)"\s*:\s*"([^"]{1,80})"\s*,\s*"(?:value|attributeValue)"\s*:\s*"([^"]{1,180})"',html,re.I):
        k,v=clean(m.group(1)),clean(m.group(2));
        if k and v: attrs[k]=v
    key_specs={}
    compat=[]
    for k,v in attrs.items():
        kl=k.lower()
        if any(x in kl for x in ['uyum','model','telefon modeli']): compat.append(v)
        if any(x in kl for x in ['malzeme','materyal']): key_specs.setdefault('material',v)
    if compat: key_specs['compatibility']=' · '.join(uniq(compat)[:4])
    name_lower=title.lower()
    category='acc' if any(x in name_lower for x in ['kılıf','kilif','case','aksesuar']) else 'other'
    return {'name':title,'price':clean(offers.get('price')),'currency':clean(offers.get('priceCurrency') or 'TRY'),'images':uniq(images)[:12],'colors':uniq(colors)[:6],'sizes':[],'dimensions':'','volume':'','brand':clean(((p or {}).get('brand') or {}).get('name') if isinstance((p or {}).get('brand'),dict) else (p or {}).get('brand')),'category':category,'keySpecs':key_specs,'source':'protected-hepsiburada-curl'}

def inditex_ids(url,brand):
    q=parse_qs(urlparse(url).query)
    if brand=='stradivarius':
        pid=(q.get('pelement') or [None])[0]; return pid,'54009571','50331081','-43','https://www.stradivarius.com'
    pid=(q.get('celement') or [None])[0]; return pid,'44109521','40259537','-43','https://www.bershka.com'

def parse_inditex_product(prod,brand):
    bundle=(prod.get('bundleProductSummaries') or [prod])[0]
    detail=bundle.get('detail') or prod.get('detail') or {}
    name=clean(bundle.get('name') or prod.get('name'))
    colors=[]; sizes=[]; images=[]; prices=[]; composition=[]
    color_nodes=detail.get('colors') or []
    for c in color_nodes:
        if c.get('name'): colors.append(c['name'])
        for sz in c.get('sizes') or []:
            if sz.get('name'): sizes.append(sz['name'])
            if sz.get('price') not in (None,'','0'): prices.append(str(sz['price']))
        for xm in c.get('xmedia') or []:
            u=xm.get('url') if isinstance(xm,dict) else None
            if u: images.append(u.replace('{width}','1024'))
    if not images:
        for xm in detail.get('xmedia') or []:
            for item in xm.get('xmediaItems') or []:
                for media in item.get('medias') or []:
                    u=(media.get('extraInfo') or {}).get('deliveryUrl')
                    if u: images.append(u)
    for part in detail.get('composition') or []:
        for x in part.get('composition') or []:
            n=clean(x.get('name')); pct=clean(x.get('percentage') or x.get('description'))
            if n and pct: composition.append(f'{pct}% {n}')
    key_specs={}
    if composition: key_specs['composition']=uniq(composition)
    model_size=''
    for c in color_nodes:
        if c.get('modelSize'): model_size=clean(c.get('modelSize')); break
    if model_size: key_specs['modelSize']=model_size
    raw_price=prices[0] if prices else ''
    price=''
    if raw_price:
        try: price=f'{int(raw_price)/100:.2f}'
        except: price=raw_price
    return {'name':name,'price':price,'currency':'TRY','images':uniq(images)[:16],'colors':uniq(colors),'sizes':uniq(sizes),'dimensions':'','volume':'','brand':'Stradivarius' if brand=='stradivarius' else 'Bershka','category':'clothes','keySpecs':key_specs,'description':clean(detail.get('longDescription') or detail.get('description')),'source':f'protected-{brand}-itxrest'}

def inditex(url,brand):
    pid,store,catalog,lang,base=inditex_ids(url,brand)
    if not pid: raise ValueError('product_id_not_found')
    s=session(); s.headers.update({'Referer':base+'/tr/','Accept':'application/json'})
    try: s.get(base+'/tr/',timeout=30)
    except: pass
    api=f'{base}/itxrest/3/catalog/store/{store}/{catalog}/productsArray?languageId={lang}&productIds={pid}&appId=1&locale=tr_TR'
    r=s.get(api,timeout=45,allow_redirects=True); r.raise_for_status(); data=r.json(); prods=data.get('products') or []
    if not prods: raise ValueError('product_not_found')
    return parse_inditex_product(prods[0],brand)

def import_product(url):
    host=urlparse(url).hostname or ''
    if 'hepsiburada.com' in host: return hepsiburada(url)
    if 'stradivarius.com' in host: return inditex(url,'stradivarius')
    if 'bershka.com' in host: return inditex(url,'bershka')
    raise ValueError('unsupported_domain')

if __name__=='__main__':
    print(json.dumps(import_product(sys.argv[1]),ensure_ascii=False,indent=2))
