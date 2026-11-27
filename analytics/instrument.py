from collections import Counter
from pathlib import Path
from lxml import html
import json
import re

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'docs'
CATALOG = ROOT / 'analytics/controls.json'
catalog = {}

def classify(element, path):
    tag = element.tag
    href = element.get('href', '')
    if tag == 'a':
        if href.startswith('tel:'):
            return 'call'
        if href.startswith('mailto:'):
            return 'email'
        if href.startswith('https://wa.me/'):
            return 'whatsapp'
        if not href.startswith(('http:', 'https:')) and (
            'contact/' in href or (path == '/contact/' and href == './')
        ):
            return 'contact'
        return 'navigation'
    if tag == 'button' and element.get('type') == 'submit':
        return 'button'
    if tag == 'input' and element.get('type') == 'range':
        return 'comparison'
    if tag == 'input' and element.get('type') == 'radio':
        return 'preview_toggle'
    if tag == 'summary':
        return 'faq'
    if tag == 'video':
        return 'video'
    if 'menu-button' in element.get('class', ''):
        return 'menu'
    return 'button'

def placement(element):
    ancestors = list(element.iterancestors())
    tags = [owner.tag for owner in ancestors]
    classes = {cls for owner in ancestors for cls in owner.get('class', '').split()}
    if 'header' in tags:
        return 'Header'
    if 'footer' in tags:
        return 'Footer'
    for marker, label in [
        ('hero', 'Homepage hero'), ('recontact', 'Bottom contact section'),
        ('interior-lead', 'Page introduction'), ('contact-card', 'WhatsApp form'),
        ('contact-details', 'Contact details'), ('reveal-section', 'Before and after'),
        ('faq-wrap', 'Frequently asked questions'), ('videos', 'Videos'),
        ('profile-gallery', 'Google project gallery'), ('design-board', 'Design boards'),
        ('service-list', 'Services list'), ('material-grid', 'Services grid'),
        ('contents', 'On this page'),
    ]:
        if marker in classes:
            return label
    if 'noscript' in tags:
        return 'No JavaScript fallback'
    return 'Page content'

for filename in sorted(SITE.rglob('*.html')):
    slug = filename.relative_to(SITE).parent.as_posix()
    path = '/' if slug == '.' else f'/{slug}/'
    document = html.document_fromstring(filename.read_text())
    document.find('body').set('data-analytics-page', path)
    for footer in document.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," footer-base ")]'):
        link_path = '../' * (0 if slug == '.' else len(slug.split('/'))) + 'privacy/'
        if not footer.xpath('./a[@href=$u]', u=link_path):
            link = html.Element('a', href=link_path)
            link.text = 'Analytics and privacy'
            footer.append(link)
    page = {'view': {'kind': 'view', 'label': 'Page view', 'placement': 'Page'}}
    used = Counter()
    selector = '//a[@href]|//button|//summary|//input[@type="range" or @type="radio"]|//video'
    for element in document.xpath(selector):
        kind = classify(element, path)
        label = element.get('aria-label') or ' '.join(element.text_content().split()) or element.get('value')
        name = (label or kind).strip()
        area = placement(element)
        key = re.sub(r'[^a-z0-9]+', '-', (area+' '+name).lower()).strip('-')[:90]
        used[key] += 1
        key = key if used[key] == 1 else f'{key}-{used[key]}'
        element.set('data-analytics', key)
        info = {'kind': kind, 'label': name[:155], 'placement': area}
        if kind == 'video':
            for action in ('play','pause','end','seek'):
                page[f'{key}:{action}'] = {**info, 'kind': 'video_'+action, 'label': name+' · '+action}
        else:
            page[key] = info
        if kind == 'button' and element.get('type') == 'submit':
            page[key+':submit'] = {**info, 'kind': 'whatsapp_form', 'label': 'Valid form handed off to WhatsApp'}
    catalog[path] = page
    filename.write_text(html.tostring(document, encoding='unicode', doctype='<!doctype html>').replace('</source>', ''))
CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n')
