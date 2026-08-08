import re
from urllib.parse import urlparse, urlunparse, parse_qs
from protected_importer import import_product as _base_import


def _normalize_bershka_category_url(url: str) -> str:
    """Allow Bershka category URLs that carry a concrete product id in ?celement=."""
    try:
        u = urlparse(url)
        if 'bershka.com' not in (u.hostname or ''):
            return url
        q = parse_qs(u.query)
        celement = (q.get('celement') or [None])[0]
        if not celement:
            return url
        if re.search(r'-n\d+\.html$', u.path.lower()):
            # protected_importer only needs the host + celement for the itxrest lookup.
            # Use a neutral PDP-like path so a category URL is not rejected.
            u = u._replace(path='/tr/product-by-celement.html')
            return urlunparse(u)
    except Exception:
        pass
    return url


def import_product(url: str):
    return _base_import(_normalize_bershka_category_url(url))
