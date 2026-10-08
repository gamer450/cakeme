/* ============================================================
   SEO — динамические мета-теги + Open Graph
   Автоматически подставляет title/description/OG для каждой страницы
   ============================================================ */

(function() {
  'use strict';

  const page = detectPage();
  if (!page) return;

  // Загружаем мета и вставляем
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => loadSeo(page), 100);
  });

  function detectPage() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    if (path === '/' || path === '/index.html') return { type: 'home' };
    if (path.includes('product.html')) {
      const id = params.get('id');
      if (id) return { type: 'product', id };
    }
    if (path.includes('catalog.html')) {
      return { type: 'catalog', catalogType: params.get('type') };
    }
    return null;
  }

  async function loadSeo(page) {
    try {
      let url = '';
      if (page.type === 'home') url = '/api/seo/home';
      else if (page.type === 'product') url = `/api/seo/product/${page.id}`;
      else if (page.type === 'catalog') {
        url = '/api/seo/catalog';
        if (page.catalogType) url += `?type=${page.catalogType}`;
      }

      const res = await fetch(url);
      if (!res.ok) return;

      const seo = await res.json();
      applySeo(seo);

      // Schema.org для товара
      if (page.type === 'product' && seo.product) {
        injectProductSchema(seo);
      }

      // Schema.org для главной
      if (page.type === 'home') {
        injectOrganizationSchema(seo);
      }
    } catch (err) {
      console.warn('SEO: не удалось загрузить мета', err);
    }
  }

  function applySeo(seo) {
    // Title
    if (seo.title) {
      document.title = seo.title;
    }

    // Meta description
    setMeta('name', 'description', seo.description);

    // Open Graph
    setMeta('property', 'og:title', seo.title);
    setMeta('property', 'og:description', seo.description);
    setMeta('property', 'og:type', seo.type || 'website');
    setMeta('property', 'og:url', seo.url);
    setMeta('property', 'og:site_name', seo.site_name || 'Cake.Me');

    if (seo.image) {
      const imageUrl = absoluteUrl(seo.image);
      setMeta('property', 'og:image', imageUrl);
      setMeta('property', 'og:image:width', '1200');
      setMeta('property', 'og:image:height', '630');
    }

    // Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', seo.title);
    setMeta('name', 'twitter:description', seo.description);
    if (seo.image) setMeta('name', 'twitter:image', absoluteUrl(seo.image));

    // Canonical
    if (seo.url) {
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = seo.url;
    }
  }

  function setMeta(attr, name, content) {
    if (!content) return;

    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.content = content;
  }

  function absoluteUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return window.location.origin + url;
  }

  // ============================================
  // Schema.org — Product
  // ============================================
  function injectProductSchema(seo) {
    const p = seo.product;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: seo.description,
      image: p.image ? absoluteUrl(p.image) : undefined,
      category: p.category,
      offers: {
        '@type': 'Offer',
        price: p.price,
        priceCurrency: p.currency,
        availability: p.availability === 'in_stock'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        url: seo.url
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    // Breadcrumb
    const bc = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Главная',
          item: window.location.origin + '/'
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Каталог',
          item: window.location.origin + '/catalog.html'
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: p.name,
          item: seo.url
        }
      ]
    };

    const bcScript = document.createElement('script');
    bcScript.type = 'application/ld+json';
    bcScript.textContent = JSON.stringify(bc);
    document.head.appendChild(bcScript);
  }

  // ============================================
  // Schema.org — Organization (главная)
  // ============================================
  function injectOrganizationSchema(seo) {
    const s = window.SITE_SETTINGS || {};

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Bakery',
      name: s.site_name || 'Cake.Me',
      description: s.site_description || 'Торты и кофе на заказ',
      url: window.location.origin,
      image: absoluteUrl(seo.image),
      telephone: s.phone,
      email: s.email,
      address: s.address ? {
        '@type': 'PostalAddress',
        streetAddress: s.address,
        addressCountry: 'RU'
      } : undefined,
      priceRange: '₽₽'
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }
})();