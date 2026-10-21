"""Verify the deployed app with an unauthenticated temporary Chromium profile and fictional data."""
import argparse
import json
import tempfile
from pathlib import Path
from urllib.parse import urlsplit, urljoin
from playwright.sync_api import sync_playwright


def check(base, executable=None):
    parsed = urlsplit(base)
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in {'127.0.0.1', 'localhost'}):
        raise ValueError('A public HTTPS URL is required.')
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('Use a site URL without credentials or tokens.')
    base = base.rstrip('/') + '/'
    origin = (parsed.scheme, parsed.netloc)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=executable, headless=True,
                                    args=['--no-sandbox', '--no-zygote', '--single-process'])
        try:
            context = browser.new_context(accept_downloads=True)
            page = context.new_page()
            page.set_default_timeout(30000)
            errors, external = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))

            def route(request):
                url = urlsplit(request.request.url)
                if url.scheme in {'http', 'https'} and (url.scheme, url.netloc) != origin:
                    external.append(request.request.url)
                    request.abort()
                else:
                    request.continue_()

            context.route('**/*', route)
            response = page.goto(base, wait_until='domcontentloaded')
            assert response and response.status == 200, 'Public entrypoint must return HTTP 200.'
            page.wait_for_function('!!globalThis.SharedMealsApp')
            assert page.url.startswith(base), 'Unexpected redirect to an authentication service.'
            assert page.evaluate('catalog().length') == 2000
            assert page.locator('.daily-pie').count() == 7
            for width, height in [(1440, 1000), (768, 1024), (390, 844)]:
                page.set_viewport_size({'width': width, 'height': height})
                assert page.locator('#tanks .vessel').count() == 3
                assert page.evaluate('document.documentElement.scrollWidth') <= width + 1
            page.locator('[data-shared-action="new"][data-group="breakfast"]').click()
            bread = page.evaluate('FoodCatalog.match("Pane bianco")')
            page.locator('#sharedFoodSearch').fill('Pane bianco')
            page.locator('#sharedFood').select_option(bread)
            page.locator('#sharedGrams').fill('75')
            page.locator('[data-shared-action="food"]').click()
            assert page.evaluate('SharedMealsApp.average(0).totals.c') > 0
            saved = page.evaluate('JSON.stringify(state.sharedMeals)')
            page.reload(wait_until='domcontentloaded')
            assert page.evaluate('JSON.stringify(state.sharedMeals)') == saved
            with page.expect_download() as download:
                page.locator('#professionalPdfExport').click()
            with tempfile.TemporaryDirectory(prefix='macro-public-pdf-') as folder:
                pdf = Path(folder) / 'piano-fittizio.pdf'
                download.value.save_as(str(pdf))
                assert pdf.read_bytes().startswith(b'%PDF-') and pdf.stat().st_size > 5000
            page.goto(urljoin(base, 'Macro_Studio_2_0_CREA_semplice.html'), wait_until='domcontentloaded')
            assert page.evaluate('generatorCatalog.rows(db).length') == 2000
            page.locator('[data-tab="plans"]').click()
            page.locator('#generate').click()
            assert page.evaluate('plan.length') == 7
            page.goto(urljoin(base, 'equivalenze/index.html'), wait_until='domcontentloaded')
            page.locator('#fromFood').select_option(bread)
            page.locator('#toFood').select_option(page.evaluate('FoodCatalog.match("Pavesini")'))
            page.locator('#grams').fill('75')
            for criterion in ['carbs', 'protein', 'fat', 'kcal']:
                page.locator('#criterion').select_option(criterion)
                assert page.evaluate('lastResult!==null')
            assert not errors, errors
            assert not external, external
            print(json.dumps({'url': base, 'anonymous': True, 'accountsRequired': False,
                              'foods': 2000, 'desktopTabletMobile': True, 'calculator': True,
                              'alternativesAndPersistence': True, 'pdfDownload': True,
                              'weeklyGenerator': True, 'equivalences': True,
                              'externalServices': external, 'jsErrors': errors}))
        finally:
            browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--chromium', help='Optional existing Chromium executable')
    args = parser.parse_args()
    check(args.url, args.chromium)
