import re
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
from protected_importer import import_product as _base_import


def _normalize_bershka_url(url: str) -> str:
    """Normalize Bershka links so the base importer always receives a concrete celement product id."""
    try:
        u = urlparse(url)
        if 'bershka.com' not in (u.hostname or ''):
            return url
        q = parse_qs(u.query)
        celement = (q.get('celement') or [None])[0]

        # Modern Bershka product URLs encode the product id as ...c0p203743229.html.
        if not celement:
            m = re.search(r'p(\d+)\.html$', u.path.lower())
            if m:
                celement = m.group(1)
                q['celement'] = [celement]
                u = u._replace(query=urlencode(q, doseq=True))

        # Category URLs such as ...pantolon-n3288.html may still carry ?celement=.
        # The base importer only needs host + celement for the itxrest lookup,
        # so use a neutral PDP-like path to avoid category rejection.
        if celement and re.search(r'-n\d+\.html$', u.path.lower()):
            u = u._replace(path='/tr/product-by-celement.html')

        return urlunparse(u)
    except Exception:
        return url


def import_product(url: str):
    return _base_import(_normalize_bershka_url(url))
