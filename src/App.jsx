import { useEffect, useMemo, useRef, useState } from 'react';
import {
  House,
  MagnifyingGlass,
  ShoppingBag,
  Heart,
  X,
  Plus,
  Minus,
  WhatsappLogo,
  CaretLeft,
  CaretRight,
  Package,
  EnvelopeSimple,
  Check,
  CreditCard,
  Truck,
  ShieldCheck,
  ArrowRight,
  Money,
  Lightning,
  ClockCounterClockwise,
  List,
  User
} from '@phosphor-icons/react';
import { initialProducts } from './catalogData.js';

const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const waPhone = '918075408807';
const wa = `https://wa.me/${waPhone}`;
const image = p => `/assets/${p.image}`;

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function Modal({ title, onClose, children, drawer = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d) d.showModal();
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    // Prevent mouse wheel scrolling from bubbling to the background page
    const preventBackgroundScroll = (e) => {
      if (d && !d.contains(e.target)) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', preventBackgroundScroll, { passive: false });
    window.addEventListener('touchmove', preventBackgroundScroll, { passive: false });

    return () => {
      if (d) d.close();
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      window.removeEventListener('wheel', preventBackgroundScroll);
      window.removeEventListener('touchmove', preventBackgroundScroll);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={drawer ? 'stowear-dialog drawer-mode' : 'stowear-dialog'}
      onCancel={onClose}
      onClick={e => { if (e.target === ref.current) onClose(); }}
      aria-label={title}
    >
      <div className="stowear-dialog-inner">
        <div className="dialog-top-header">
          <h3 style={{ fontSize: '16px', fontWeight: '800', textTransform: 'uppercase' }}>{title}</h3>
          <button
            className="dialog-close-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function App() {
  const [products, setProducts] = useState(initialProducts);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState(() => {
    const v = readLocal('paradise-bag', []);
    return Array.isArray(v) ? v.filter(x => x && typeof x.id === 'string' && Number.isInteger(x.quantity) && x.quantity > 0 && x.quantity <= 10) : [];
  });
  const [saved, setSaved] = useState(() => {
    const v = readLocal('paradise-saved', []);
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  });

  const [activeNav, setActiveNav] = useState('All');
  const [featuredTab, setFeaturedTab] = useState('Audio & Tech');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  const [bagOpen, setBagOpen] = useState(false);
  const [info, setInfo] = useState(null);
  const [toast, setToast] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const toastTimer = useRef(null);

  useEffect(() => {
    fetch('/api/catalog')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && Array.isArray(d.products) && d.products.length) {
          setProducts(d.products);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try { localStorage.setItem('paradise-bag', JSON.stringify(cart)); } catch {}
  }, [cart]);

  useEffect(() => {
    try { localStorage.setItem('paradise-saved', JSON.stringify(saved)); } catch {}
  }, [saved]);

  const lines = cart
    .map(c => ({ ...c, product: products.find(p => p.id === c.id) }))
    .filter(c => c.product);

  const count = lines.reduce((n, c) => n + c.quantity, 0);
  const subtotal = lines.reduce((n, c) => n + c.product.price * c.quantity, 0);

  function notify(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  function add(p, quantity = 1) {
    setCart(cs => {
      const exists = cs.find(c => c.id === p.id);
      return exists
        ? cs.map(c => (c.id === p.id ? { ...c, quantity: Math.min(10, c.quantity + quantity) } : c))
        : [...cs, { id: p.id, color: p.color, quantity }];
    });
    notify(`${p.name} added to cart`);
    setBagOpen(true);
  }

  function toggle(id) {
    setSaved(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  }

  function buildCheckoutUrl(orderRef) {
    const itemsText = lines
      .map(({ product: p, color, quantity }) => {
        const itemColor = color || (p.colors && p.colors[0]) || p.color || 'Standard';
        return `• ${p.name} (${itemColor}) × ${quantity} — ${money(p.price * quantity)}`;
      })
      .join('\n');
    const refText = orderRef ? `\nReference: ${orderRef}` : '';
    const text = `Hi Paradise Store! I would like to place an order/enquiry:\n\n${itemsText}\n\n*Total Subtotal: ${money(subtotal)}*${refText}\n\nPlease confirm stock availability, delivery time, and COD details. Thank you!`;
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
  }

  async function checkoutOnWhatsApp() {
    if (!lines.length) return;
    setBusy(true);
    let targetUrl = buildCheckoutUrl();
    try {
      const r = await fetch('/api/order-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map(({ id, color, product: p, quantity }) => ({
            id,
            color: color || (p.colors && p.colors[0]) || p.color || 'Standard',
            quantity
          }))
        })
      });
      if (r.ok) {
        const data = await r.json();
        if (data.whatsappUrl) {
          targetUrl = data.whatsappUrl;
        }
      }
    } catch (err) {
      console.warn('Draft sync failed, using direct WhatsApp fallback:', err);
    } finally {
      setBusy(false);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  }

  const SYNONYM_MAP = useMemo(() => ({
    'airpod': ['earbuds', 'wireless earbuds', 'pods', 'airpods', 'tws'],
    'airpods': ['earbuds', 'wireless earbuds', 'pods', 'airpod', 'tws'],
    'air pod': ['earbuds', 'wireless earbuds', 'pods', 'airpods'],
    'air pods': ['earbuds', 'wireless earbuds', 'pods', 'airpods'],
    'earphone': ['earbuds', 'headphones', 'wireless earbuds', 'earphones'],
    'earphones': ['earbuds', 'headphones', 'wireless earbuds', 'earphone'],
    'earbud': ['earbuds', 'wireless earbuds', 'airpods'],
    'earbuds': ['earbuds', 'wireless earbuds', 'airpods'],
    'headphone': ['headphones', 'studio wireless headphones', 'over ear', 'head phone'],
    'headphones': ['headphones', 'studio wireless headphones', 'over ear'],
    'speaker': ['pocket beat speaker', 'bluetooth speaker', 'soundbox'],
    'speakers': ['pocket beat speaker', 'bluetooth speaker', 'soundbox'],
    'sound': ['speaker', 'headphones', 'earbuds'],
    'audio': ['headphones', 'earbuds', 'speaker'],
    'blender': ['portable blender', 'juicer', 'smoothie'],
    'juicer': ['portable blender', 'blend & go'],
    'cooler': ['mini desk cooler', 'fan', 'ac', 'portable mini air cooler'],
    'ac': ['mini desk cooler', 'portable mini air cooler'],
    'fan': ['mini desk cooler', 'portable mini air cooler'],
    'watch': ['smart watch', 'daylight smart watch', 'smartwatch'],
    'smartwatch': ['smart watch', 'daylight smart watch'],
    'smart watch': ['smart watch', 'daylight smart watch'],
    'lamp': ['table lamp', 'little glow table lamp', 'light'],
    'light': ['table lamp', 'little glow table lamp'],
    'tape': ['magnetic tape', 'adhesive tape', 'strip'],
    'bottle': ['sports water bottle', 'flask', 'waterbottle'],
    'water bottle': ['sports water bottle', 'flask', 'waterbottle']
  }), []);

  const searchMatching = (p, q) => {
    if (!q) return true;
    const cleanQ = q.toLowerCase().trim();
    if (!cleanQ) return true;

    // Check direct fields
    const kwString = Array.isArray(p.keywords) ? p.keywords.join(' ') : '';
    const detailsString = Array.isArray(p.details) ? p.details.join(' ') : '';
    const combined = `${p.name} ${p.category} ${p.description} ${p.label || ''} ${kwString} ${detailsString}`.toLowerCase();

    if (combined.includes(cleanQ)) return true;

    // Check individual search words
    const qTokens = cleanQ.split(/\s+/).filter(Boolean);
    const allTokensMatch = qTokens.every(tok => {
      if (combined.includes(tok)) return true;
      // Check synonyms for this token
      const syns = SYNONYM_MAP[tok];
      if (syns && syns.some(s => combined.includes(s))) return true;
      return false;
    });
    if (allTokensMatch) return true;

    // Check whole query against synonym mapping
    const directSyns = SYNONYM_MAP[cleanQ];
    if (directSyns && directSyns.some(s => combined.includes(s))) return true;

    return false;
  };

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchNav = activeNav === 'All' || p.category.toLowerCase().includes(activeNav.toLowerCase());
      const matchQuery = searchMatching(p, query);
      return matchNav && matchQuery;
    });
  }, [products, activeNav, query, SYNONYM_MAP]);

  const liveSearchResults = useMemo(() => {
    if (!query.trim()) return [];
    return products.filter(p => searchMatching(p, query)).slice(0, 5);
  }, [products, query, SYNONYM_MAP]);

  const featuredItems = useMemo(() => {
    if (featuredTab === 'Audio & Tech') {
      return products.filter(p => p.category === 'Tech & Audio');
    }
    return products.filter(p => p.category !== 'Tech & Audio');
  }, [products, featuredTab]);

  const [announcementIndex, setAnnouncementIndex] = useState(0);

  const announcements = [
    {
      id: 1,
      icon: <Truck size={14} weight="bold" />,
      content: <><strong>Free Shipping</strong> on Orders Over ₹999 across India</>
    },
    {
      id: 2,
      icon: <ShieldCheck size={14} weight="bold" />,
      content: <><strong>1-Year Guarantee</strong> & 100% Genuine Certified Tech</>
    },
    {
      id: 3,
      icon: <Check size={14} weight="bold" />,
      content: <><strong>Kerala COD Available</strong> · Speedy 2–3 Days Dispatch</>
    },
    {
      id: 4,
      icon: <WhatsappLogo size={14} weight="bold" />,
      content: <>24×7 Customer Support & Orders: <strong>+91 8075408807</strong></>
    }
  ];

  const welcomeBanners = [
    {
      id: 1,
      webImage: '/assets/Welcome Banner 1 (web).png',
      mobileImage: '/assets/Welcome Banner 1 (mobile).png',
      alt: 'Welcome to Paradise Store - www.paradisestore.com'
    },
    {
      id: 2,
      webImage: '/assets/Welcome Banner 2 (web).png',
      mobileImage: '/assets/Welcome Banner 2 (mobile).png',
      alt: 'Up to 70% Off Electronics - Paradise Store'
    }
  ];
  const [bannerSlideIndex, setBannerSlideIndex] = useState(0);

  useEffect(() => {
    const bannerTimer = setInterval(() => {
      setBannerSlideIndex(prev => (prev + 1) % welcomeBanners.length);
    }, 4500);
    return () => clearInterval(bannerTimer);
  }, [welcomeBanners.length]);

  return (
    <>
      {/* Top Announcement Bar - Single Rotating Statement Every 3s */}
      <div className="stowear-top-announcement">
        <div className="stowear-container announcement-inner">
          <div className="announcement-rotator" key={announcementIndex}>
            <span className="announcement-item single-rotating">
              {announcements[announcementIndex].icon}
              <span>{announcements[announcementIndex].content}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Top App Bar (Centered PNG Logo, Left: Menu + Search, Right: Account + Cart) */}
      <div className="mobile-app-header">
        <div className="mobile-header-inner">
          {/* Left: Menu Hamburger + Search Icon */}
          <div className="mobile-header-left">
            <button
              className="mobile-icon-btn"
              aria-label="Open Navigation Menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <List size={22} weight="bold" />
            </button>
            <button
              className="mobile-icon-btn"
              aria-label="Search Catalog"
              onClick={() => setMobileSearchOpen(prev => !prev)}
            >
              <MagnifyingGlass size={21} weight="bold" />
            </button>
          </div>

          {/* Center: PNG Logo */}
          <div
            className="mobile-header-center"
            onClick={() => { setActiveNav('All'); setQuery(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            <img src="/assets/logo.png" alt="Paradise Store" className="mobile-header-png-logo" />
            <span className="mobile-header-brand-title">PARADISE<span>STORE</span></span>
          </div>

          {/* Right: Account / Info + Cart */}
          <div className="mobile-header-right">
            <button
              className="mobile-icon-btn"
              aria-label="Account and Support"
              onClick={() => setInfo('About Paradise')}
            >
              <User size={21} weight="bold" />
            </button>
            <button
              className="mobile-icon-btn mobile-cart-btn"
              aria-label="Shopping Cart"
              onClick={() => setBagOpen(true)}
            >
              <ShoppingBag size={22} weight="fill" />
              {count > 0 && <span className="mobile-cart-bubble">{count}</span>}
            </button>
          </div>
        </div>

        {/* Expandable Mobile Search Dropdown */}
        {mobileSearchOpen && (
          <div className="mobile-search-dropdown">
            <div className="mobile-search-box">
              <MagnifyingGlass size={17} weight="bold" color="#64748b" />
              <input
                type="text"
                autoFocus
                placeholder="Search airpod, earbuds, cooler, watch..."
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  if (activeNav !== 'All') setActiveNav('All');
                }}
              />
              {query && (
                <button
                  className="mobile-search-clear"
                  aria-label="Clear query"
                  onClick={() => setQuery('')}
                >
                  <X size={14} weight="bold" />
                </button>
              )}
            </div>

            {/* Mobile Search Quick Previews */}
            {query.trim().length > 0 && (
              <div className="mobile-search-results-list">
                {liveSearchResults.length === 0 ? (
                  <div className="mobile-search-empty">
                    <p>No products found for "{query}"</p>
                    <span>Suggestions: airpod, buds, speaker, cooler, watch, bottle</span>
                  </div>
                ) : (
                  <>
                    <div className="mobile-search-count">
                      <span>Found {filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
                    </div>
                    {liveSearchResults.map(p => (
                      <div
                        key={p.id}
                        className="mobile-search-item"
                        onClick={() => {
                          setSelected(p);
                          setMobileSearchOpen(false);
                        }}
                      >
                        <img src={image(p)} alt={p.name} className="mobile-search-thumb" />
                        <div className="mobile-search-info">
                          <span className="mobile-search-title">{p.name}</span>
                          <span className="mobile-search-cat">{p.category}</span>
                        </div>
                        <span className="mobile-search-price">{money(p.price)}</span>
                      </div>
                    ))}
                    <button
                      className="mobile-search-view-all-btn"
                      onClick={() => {
                        setMobileSearchOpen(false);
                        const el = document.getElementById('catalog-products-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Show All {filtered.length} Results in Catalog ↓
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. Desktop Midheader (Kept clean on Desktop) */}
      <header className="stowear-midheader">
        <div className="stowear-container stowear-midheader-inner">
          <div className="stowear-brand-wrap">
            <div className="brand-icon-box">
              <img src="/assets/logo.png" alt="Logo" />
            </div>
            <div>
              <div className="brand-logotype">
                PARADISE<span>STORE</span>
              </div>
              <span className="brand-tagline">Electronics & Lifestyle Devices</span>
            </div>
          </div>

          <div className="stowear-search-wrap">
            <input
              type="text"
              className="stowear-search-input"
              placeholder="Search products (e.g. airpod, speaker, cooler)..."
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                if (activeNav !== 'All') setActiveNav('All');
              }}
            />
            {query && (
              <button
                className="desktop-search-clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                title="Clear search"
              >
                <X size={15} weight="bold" />
              </button>
            )}
            <button
              className="stowear-search-btn"
              aria-label="Search"
              onClick={() => {
                const el = document.getElementById('catalog-products-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <MagnifyingGlass size={16} weight="bold" />
            </button>

            {/* Desktop Instant Search Results Dropdown */}
            {query.trim().length > 0 && (
              <div className="search-dropdown-menu">
                <div className="search-dropdown-header">
                  <span>Results for <strong>"{query}"</strong> ({liveSearchResults.length})</span>
                  <button onClick={() => setQuery('')}>Close</button>
                </div>
                {liveSearchResults.length === 0 ? (
                  <div className="search-dropdown-empty">
                    <p>No products matching "{query}"</p>
                    <span>Try searching: <em>airpod, earbuds, speaker, cooler, watch, bottle</em></span>
                  </div>
                ) : (
                  <div className="search-dropdown-items">
                    {liveSearchResults.map(p => (
                      <div
                        key={p.id}
                        className="search-dropdown-item"
                        onClick={() => {
                          setSelected(p);
                        }}
                      >
                        <img src={image(p)} alt={p.name} className="search-dropdown-thumb" />
                        <div className="search-dropdown-info">
                          <span className="search-dropdown-name">{p.name}</span>
                          <span className="search-dropdown-category">{p.category}</span>
                        </div>
                        <span className="search-dropdown-price">{money(p.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {liveSearchResults.length > 0 && (
                  <button
                    className="search-dropdown-view-all"
                    onClick={() => {
                      const el = document.getElementById('catalog-products-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    View All {filtered.length} Matching Products ↓
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="stowear-cart-box" onClick={() => setBagOpen(true)} title="View Shopping Cart">
            <div className="cart-bag-icon">
              <ShoppingBag size={28} weight="fill" />
              <span className="cart-items-bubble">{count}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Sleek Solid Blue Navigation Bar */}
      <nav className="stowear-navbar">
        <div className="stowear-container stowear-nav-inner">
          <button
            className="nav-home-icon-btn"
            aria-label="Home"
            onClick={() => { setActiveNav('All'); setQuery(''); }}
          >
            <House size={18} weight="fill" />
          </button>

          <button
            className="nav-link-btn"
            onClick={() => {
              setActiveNav('All');
              setQuery('');
              const el = document.getElementById('catalog-products-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            Catalog & Shop
          </button>

          <button
            className="nav-link-btn"
            onClick={() => setInfo('Delivery & COD')}
          >
            Delivery & Shipping
          </button>

          <button
            className="nav-link-btn"
            onClick={() => setInfo('Returns & support')}
          >
            1-Year Warranty & Returns
          </button>

          <button
            className="nav-link-btn"
            onClick={() => setInfo('About Paradise')}
          >
            About Paradise
          </button>

          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="nav-wa-action-btn"
          >
            <WhatsappLogo size={16} weight="fill" /> Order on WhatsApp
          </a>
        </div>
      </nav>

      <main id="main">
        {/* Welcome Banner Carousel (Sliding Welcome Banner 1 & 2) */}
        <section className="stowear-container welcome-banner-section">
          <div className="welcome-banner-wrap" title="Featured Offers">
            <div
              className="welcome-carousel-track"
              style={{ transform: `translateX(-${bannerSlideIndex * 100}%)` }}
            >
              {welcomeBanners.map((b, idx) => (
                <div key={b.id} className="welcome-slide">
                  <picture className="welcome-banner-picture">
                    <source media="(max-width: 768px)" srcSet={b.mobileImage} />
                    <source media="(min-width: 769px)" srcSet={b.webImage} />
                    <img
                      src={b.webImage}
                      alt={b.alt}
                      className="welcome-banner-img"
                      fetchPriority={idx === 0 ? "high" : "auto"}
                    />
                  </picture>
                </div>
              ))}
            </div>

            {/* Left / Right Nav Arrows */}
            <button
              className="welcome-slider-arrow left"
              aria-label="Previous Slide"
              onClick={() => setBannerSlideIndex(prev => (prev === 0 ? welcomeBanners.length - 1 : prev - 1))}
            >
              <CaretLeft size={18} weight="bold" />
            </button>
            <button
              className="welcome-slider-arrow right"
              aria-label="Next Slide"
              onClick={() => setBannerSlideIndex(prev => (prev + 1) % welcomeBanners.length)}
            >
              <CaretRight size={18} weight="bold" />
            </button>

            {/* Slide Dots Indicator */}
            <div className="welcome-slider-dots">
              {welcomeBanners.map((b, idx) => (
                <button
                  key={b.id}
                  className={`welcome-dot ${idx === bannerSlideIndex ? 'active' : ''}`}
                  aria-label={`Go to slide ${idx + 1}`}
                  onClick={() => setBannerSlideIndex(idx)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* 6. "LATEST PRODUCTS" Section with Category Filter Tabs */}
        <section className="stowear-container" id="catalog-products-section">
          <div className="stowear-section-header">
            <div className="latest-header-left">
              <span className="stowear-section-title">
                {query.trim() ? `Search Results: "${query}"` : 'Latest Products'}
              </span>
              {query.trim() && (
                <div className="search-active-pill">
                  <span>{filtered.length} found</span>
                  <button
                    className="clear-search-pill-btn"
                    onClick={() => setQuery('')}
                    title="Clear search"
                  >
                    Clear <X size={12} weight="bold" />
                  </button>
                </div>
              )}
              <div className="category-filter-bar">
                <button
                  className={`category-tab-btn ${activeNav === 'All' ? 'active' : ''}`}
                  onClick={() => { setActiveNav('All'); }}
                >
                  All Products
                </button>
                <button
                  className={`category-tab-btn ${activeNav === 'Tech & Audio' ? 'active' : ''}`}
                  onClick={() => setActiveNav('Tech & Audio')}
                >
                  Tech & Audio
                </button>
                <button
                  className={`category-tab-btn ${activeNav === 'Kitchen & Home' ? 'active' : ''}`}
                  onClick={() => setActiveNav('Kitchen & Home')}
                >
                  Kitchen & Home
                </button>
                <button
                  className={`category-tab-btn ${activeNav === 'Daily Essentials' ? 'active' : ''}`}
                  onClick={() => setActiveNav('Daily Essentials')}
                >
                  Daily Essentials
                </button>
              </div>
            </div>

            <div className="stowear-arrows">
              <button className="arrow-box-btn" aria-label="Previous">
                <CaretLeft size={13} weight="bold" />
              </button>
              <button className="arrow-box-btn" aria-label="Next">
                <CaretRight size={13} weight="bold" />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="catalog-search-no-results">
              <div className="no-results-icon-box">
                <MagnifyingGlass size={36} weight="duotone" color="#94a3b8" />
              </div>
              <h3 className="no-results-title">No products found for "{query}"</h3>
              <p className="no-results-text">
                We couldn't find an exact match. Try popular searches like <strong>airpod</strong>, <strong>earbuds</strong>, <strong>speaker</strong>, <strong>cooler</strong>, <strong>watch</strong>, or <strong>bottle</strong>.
              </p>
              <button
                className="no-results-reset-btn"
                onClick={() => { setQuery(''); setActiveNav('All'); }}
              >
                View All Products
              </button>
            </div>
          ) : (
            <div className="stowear-product-row">
              {filtered.map(p => (
                <div key={p.id} className="stowear-product-card">
                  <div className="stowear-img-box" onClick={() => setSelected(p)}>
                    <img src={image(p)} alt={p.name} loading="lazy" />
                  </div>
                  <button className="stowear-item-name" onClick={() => setSelected(p)}>
                    {p.name}
                  </button>
                  <div className="stowear-price-tag">{money(p.price)}</div>
                  <button
                    className="stowear-add-btn"
                    onClick={() => add(p)}
                    title={`Add ${p.name} to cart`}
                  >
                    <ShoppingBag size={14} weight="bold" /> Add to Cart
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 7. "OUR BRANDS" Section (Clean borderless, moving left to right between Latest Products and Featured) */}
        <section className="stowear-container stowear-brands-section">
          <div className="stowear-section-header">
            <span className="stowear-section-title">Our Brands</span>
          </div>

          <div className="stowear-marquee-container">
            <div className="stowear-marquee-track">
              {/* Set 1 */}
              <div className="brand-logo-slide">
                <div className="brand-logo-card brand-apple" title="Apple">
                  <img src="/assets/brands/apple.png" alt="Apple" />
                </div>
                <div className="brand-logo-card brand-sony" title="Sony">
                  <img src="/assets/brands/sony-logo.png" alt="Sony" />
                </div>
                <div className="brand-logo-card brand-samsung" title="Samsung">
                  <img src="/assets/brands/samsung.png" alt="Samsung" />
                </div>
                <div className="brand-logo-card brand-jbl" title="JBL">
                  <img src="/assets/brands/jbl.png" alt="JBL" />
                </div>
                <div className="brand-logo-card brand-xiaomi" title="Xiaomi">
                  <img src="/assets/brands/xiomi.png" alt="Xiaomi" />
                </div>
                <div className="brand-logo-card brand-vivo" title="Vivo">
                  <img src="/assets/brands/vivo.png" alt="Vivo" />
                </div>
                <div className="brand-logo-card brand-oppo" title="Oppo">
                  <img src="/assets/brands/oppo.png" alt="Oppo" />
                </div>
                <div className="brand-logo-card brand-iqoo" title="iQOO">
                  <img src="/assets/brands/iqoo.png" alt="iQOO" />
                </div>
                <div className="brand-logo-card brand-cello" title="Cello">
                  <img src="/assets/brands/cello.png" alt="Cello" />
                </div>
              </div>

              {/* Set 2 (Duplicated for continuous seamless loop) */}
              <div className="brand-logo-slide" aria-hidden="true">
                <div className="brand-logo-card brand-apple" title="Apple">
                  <img src="/assets/brands/apple.png" alt="Apple" />
                </div>
                <div className="brand-logo-card brand-sony" title="Sony">
                  <img src="/assets/brands/sony-logo.png" alt="Sony" />
                </div>
                <div className="brand-logo-card brand-samsung" title="Samsung">
                  <img src="/assets/brands/samsung.png" alt="Samsung" />
                </div>
                <div className="brand-logo-card brand-jbl" title="JBL">
                  <img src="/assets/brands/jbl.png" alt="JBL" />
                </div>
                <div className="brand-logo-card brand-xiaomi" title="Xiaomi">
                  <img src="/assets/brands/xiomi.png" alt="Xiaomi" />
                </div>
                <div className="brand-logo-card brand-vivo" title="Vivo">
                  <img src="/assets/brands/vivo.png" alt="Vivo" />
                </div>
                <div className="brand-logo-card brand-oppo" title="Oppo">
                  <img src="/assets/brands/oppo.png" alt="Oppo" />
                </div>
                <div className="brand-logo-card brand-iqoo" title="iQOO">
                  <img src="/assets/brands/iqoo.png" alt="iQOO" />
                </div>
                <div className="brand-logo-card brand-cello" title="Cello">
                  <img src="/assets/brands/cello.png" alt="Cello" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. FEATURED Section (Left Column Sidebar + Right Tabbed Items Grid) */}
        <section className="stowear-container">
          <div className="stowear-featured-split">
            {/* Left sidebar: Featured 3 items stacked */}
            <div className="featured-left-col">
              <div className="stowear-section-header">
                <span className="stowear-section-title">Featured</span>
              </div>
              <div className="sidebar-product-list">
                {products.slice(0, 3).map(p => (
                  <div key={p.id} className="sidebar-product-item">
                    <div className="sidebar-item-thumb" onClick={() => setSelected(p)}>
                      <img src={image(p)} alt={p.name} />
                    </div>
                    <div className="sidebar-item-info">
                      <button className="sidebar-item-name" onClick={() => setSelected(p)}>
                        {p.name}
                      </button>
                      <div className="sidebar-item-price">{money(p.price)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side: Tabs (Audio & Tech / Home & Gadgets) + Grid */}
            <div>
              <div className="featured-tab-header">
                <button
                  className={`tab-title-btn ${featuredTab === 'Audio & Tech' ? 'active' : ''}`}
                  onClick={() => setFeaturedTab('Audio & Tech')}
                >
                  Tech & Audio
                </button>
                <button
                  className={`tab-title-btn ${featuredTab === 'Home & Gadgets' ? 'active' : ''}`}
                  onClick={() => setFeaturedTab('Home & Gadgets')}
                >
                  Home & Living
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <button className="arrow-box-btn" aria-label="Previous">
                    <CaretLeft size={13} weight="bold" />
                  </button>
                  <button className="arrow-box-btn" aria-label="Next">
                    <CaretRight size={13} weight="bold" />
                  </button>
                </div>
              </div>

              <div className="featured-right-grid">
                {featuredItems.map(p => (
                  <div key={p.id} className="stowear-product-card">
                    <div className="stowear-img-box" onClick={() => setSelected(p)}>
                      <img src={image(p)} alt={p.name} />
                    </div>
                    <button className="stowear-item-name" onClick={() => setSelected(p)}>
                      {p.name}
                    </button>
                    <div className="stowear-price-tag">{money(p.price)}</div>
                    <button
                      className="stowear-add-btn"
                      onClick={() => add(p)}
                      title={`Add ${p.name} to cart`}
                    >
                      <ShoppingBag size={14} weight="bold" /> Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* 10. Minimal Premium Uncluttered Footer */}
      <footer className="stowear-dark-footer">
        <div className="stowear-container">
          <div className="stowear-footer-grid">
            <div className="footer-brand-col">
              <div className="footer-logo-header">
                <img src="/assets/logo.png" alt="Paradise Store" className="footer-logo-img" />
                <div className="footer-brand-title">
                  PARADISE<span>STORE</span>
                </div>
              </div>
              <p className="footer-brand-desc">
                Curated genuine tech, audio & smart daily lifestyle gadgets with official 1-Year Guarantee across India.
              </p>
              <a href={wa} target="_blank" rel="noreferrer" className="footer-contact-mini">
                <WhatsappLogo size={18} weight="fill" color="#22c55e" />
                <span>WhatsApp Helpline: <strong>+91 8075408807</strong></span>
              </a>
            </div>

            <div className="footer-links-col">
              <div className="footer-col-head">Customer Support</div>
              <ul className="footer-link-list">
                <li><button onClick={() => setInfo('Delivery & COD')}>Delivery & COD Info</button></li>
                <li><button onClick={() => setInfo('Returns & support')}>1-Year Warranty & Returns</button></li>
                <li><button onClick={() => setInfo('Payment Methods')}>Payment Modes (GPay / COD)</button></li>
                <li><a href={wa} target="_blank" rel="noreferrer">Instant WhatsApp Enquiry</a></li>
              </ul>
            </div>

            <div className="footer-links-col">
              <div className="footer-col-head">Quick Links</div>
              <ul className="footer-link-list">
                <li><button onClick={() => { setActiveNav('All'); setQuery(''); }}>Shop Full Catalog</button></li>
                <li><button onClick={() => setInfo('About Paradise')}>About Paradise Store</button></li>
                <li><a href="https://www.instagram.com/paradise_storez/" target="_blank" rel="noreferrer">Instagram @paradise_storez</a></li>
              </ul>
            </div>
          </div>

          <div className="stowear-footer-bottom">
            <span>© {new Date().getFullYear()} Paradise Store · Genuine Electronics</span>
            <span>Kerala COD Available · Express Dispatch 2–3 Days</span>
          </div>
        </div>
      </footer>

      {/* Product Detail Modal — Rich & Visually Balanced */}
      {selected && (
        <Modal title={selected.name} onClose={() => { setSelected(null); setQty(1); }}>
          <div className="product-modal-grid">
            {/* Left / Top: Product Media & Badges */}
            <div className="product-modal-media-col">
              <div className="product-modal-img-container">
                <img src={image(selected)} alt={selected.name} className="product-modal-hero-img" />
              </div>
              <div className="product-modal-trust-chips">
                <span className="p-chip"><ShieldCheck size={14} weight="fill" color="#16a34a" /> 1-Year Warranty</span>
                <span className="p-chip"><Truck size={14} weight="fill" color="#2563eb" /> Kerala COD</span>
                <span className="p-chip"><Check size={14} weight="bold" color="#059669" /> In Stock</span>
              </div>
            </div>

            {/* Right: Product Details, Highlights & Purchasing Actions */}
            <div className="product-modal-content-col">
              <div className="product-modal-meta">
                <span className="product-modal-badge">{selected.category}</span>
                {selected.label && <span className="product-modal-label">{selected.label}</span>}
              </div>

              <h2 className="product-modal-title">{selected.name}</h2>

              <div className="product-modal-pricing-box">
                <span className="product-modal-price">{money(selected.price)}</span>
                <span className="product-modal-mrp">₹{Math.round(selected.price * 1.4)}</span>
                <span className="product-modal-discount-tag">Save ~30%</span>
              </div>

              <p className="product-modal-desc">{selected.description}</p>

              {/* Key Highlights / Specs */}
              {selected.details && selected.details.length > 0 && (
                <div className="product-modal-features">
                  <div className="product-features-heading">Key Highlights & In The Box:</div>
                  <ul className="product-features-list">
                    {selected.details.map((detail, index) => (
                      <li key={index}>
                        <Check size={14} weight="bold" color="#0066cc" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Color & Quantity Selector */}
              <div className="product-modal-controls-row">
                <div className="product-control-group">
                  <span className="control-label">Color:</span>
                  <span className="color-swatch-pill">{selected.color || 'Standard'}</span>
                </div>

                <div className="product-control-group">
                  <span className="control-label">Quantity:</span>
                  <div className="qty-counter-box">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() => setQty(q => Math.max(1, q - 1))}
                    >
                      <Minus size={12} weight="bold" />
                    </button>
                    <span className="qty-value">{qty}</span>
                    <button
                      aria-label="Increase quantity"
                      onClick={() => setQty(q => Math.min(10, q + 1))}
                    >
                      <Plus size={12} weight="bold" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Purchasing Buttons */}
              <div className="product-modal-actions">
                <button
                  className="product-modal-btn-cart"
                  onClick={() => {
                    add(selected, qty);
                    setSelected(null);
                    setQty(1);
                  }}
                >
                  <ShoppingBag size={18} weight="bold" />
                  <span>Add to Bag • {money(selected.price * qty)}</span>
                </button>

                <a
                  href={`${wa}?text=${encodeURIComponent(`Hi Paradise Store! I want to order/enquire about ${selected.name} (Qty: ${qty}, Color: ${selected.color || 'Standard'}, Total: ${money(selected.price * qty)}). Please confirm stock and delivery.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="product-modal-btn-wa"
                >
                  <WhatsappLogo size={18} weight="fill" />
                  <span>Direct WhatsApp Order</span>
                </a>
              </div>

              {/* Micro guarantee footer */}
              <div className="product-modal-footer-note">
                <ShieldCheck size={14} weight="fill" /> Verified genuine gadget · Direct replacement guarantee
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Cart Drawer */}
      {bagOpen && (
        <Modal title={`Shopping Cart (${count})`} drawer onClose={() => setBagOpen(false)}>
          {lines.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {lines.map(({ product: p, quantity }) => (
                  <div key={p.id} style={{ display: 'flex', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid #e5e5e5' }}>
                    <img src={image(p)} alt={p.name} style={{ width: '60px', height: '60px', objectFit: 'contain', background: '#f8f9fa' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700' }}>{p.name}</div>
                      <div style={{ fontSize: '13px', color: '#0066cc', fontWeight: 'bold' }}>{money(p.price)}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d5d9df' }}>
                          <button
                            style={{ padding: '2px 8px' }}
                            onClick={() => setCart(cs => cs.map(c => c.id === p.id ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c))}
                          >
                            <Minus size={11} />
                          </button>
                          <span style={{ fontSize: '12px', padding: '0 6px' }}>{quantity}</span>
                          <button
                            style={{ padding: '2px 8px' }}
                            onClick={() => setCart(cs => cs.map(c => c.id === p.id ? { ...c, quantity: Math.min(10, c.quantity + 1) } : c))}
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                        <button
                          style={{ fontSize: '11px', color: '#e53935' }}
                          onClick={() => setCart(cs => cs.filter(c => c.id !== p.id))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '16px', marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', marginBottom: '14px' }}>
                  <span>Sub-Total:</span>
                  <span style={{ color: '#0066cc' }}>{money(subtotal)}</span>
                </div>
                <a
                  href={buildCheckoutUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-stowear-wa"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={(e) => {
                    // Trigger draft save in background without delaying user navigation
                    fetch('/api/order-drafts', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        items: lines.map(({ id, color, product: p, quantity }) => ({
                          id,
                          color: color || (p.colors && p.colors[0]) || p.color || 'Standard',
                          quantity
                        }))
                      })
                    }).catch(() => {});
                  }}
                >
                  <WhatsappLogo size={18} weight="fill" /> Proceed to Checkout on WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#888' }}>
              <p>Your shopping cart is empty!</p>
            </div>
          )}
        </Modal>
      )}

      {/* Mobile Side Menu Drawer */}
      {mobileMenuOpen && (
        <Modal title="Paradise Menu" drawer onClose={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu-drawer-content">
            <div className="mobile-drawer-brand">
              <img src="/assets/logo.png" alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '4px' }} />
              <div>
                <div style={{ fontWeight: '800', fontSize: '15px' }}>PARADISE STORE</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Electronics & Lifestyle</div>
              </div>
            </div>

            <div className="mobile-menu-links">
              <button
                className={`mobile-menu-link ${activeNav === 'All' ? 'active' : ''}`}
                onClick={() => {
                  setActiveNav('All');
                  setQuery('');
                  setMobileMenuOpen(false);
                  const el = document.getElementById('catalog-products-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <House size={18} /> Catalog & All Products
              </button>
              <button
                className={`mobile-menu-link ${activeNav === 'Tech & Audio' ? 'active' : ''}`}
                onClick={() => { setActiveNav('Tech & Audio'); setMobileMenuOpen(false); }}
              >
                🎧 Tech & Audio Gadgets
              </button>
              <button
                className={`mobile-menu-link ${activeNav === 'Kitchen & Home' ? 'active' : ''}`}
                onClick={() => { setActiveNav('Kitchen & Home'); setMobileMenuOpen(false); }}
              >
                🏠 Kitchen & Home
              </button>
              <button
                className={`mobile-menu-link ${activeNav === 'Daily Essentials' ? 'active' : ''}`}
                onClick={() => { setActiveNav('Daily Essentials'); setMobileMenuOpen(false); }}
              >
                ⚡ Daily Essentials
              </button>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                Customer Care & Policy
              </div>
              <div className="mobile-menu-links">
                <button
                  className="mobile-menu-link"
                  onClick={() => { setInfo('Delivery & COD'); setMobileMenuOpen(false); }}
                >
                  <Truck size={17} /> Delivery & COD Terms
                </button>
                <button
                  className="mobile-menu-link"
                  onClick={() => { setInfo('Returns & support'); setMobileMenuOpen(false); }}
                >
                  <ShieldCheck size={17} /> 1-Year Warranty & Returns
                </button>
                <button
                  className="mobile-menu-link"
                  onClick={() => { setInfo('About Paradise'); setMobileMenuOpen(false); }}
                >
                  <User size={17} /> About Paradise Store
                </button>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="btn-stowear-wa"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <WhatsappLogo size={18} weight="fill" /> Order on WhatsApp
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* Info Dialog */}
      {info && (
        <Modal title={info} onClose={() => setInfo(null)}>
          <div style={{ fontSize: '13px', lineHeight: 1.8, color: '#555' }}>
            <p><strong>Fast Dispatch:</strong> 2–3 Days delivery across India.</p>
            <p><strong>Payment Modes:</strong> Kerala - Cash on Delivery (COD). Other States - Prepaid via UPI / GPay (9846976460).</p>
            <p><strong>Support & Ordering:</strong> Direct WhatsApp assistance on +91 80754 08807.</p>
            <div style={{ marginTop: '16px' }}>
              <a href={wa} target="_blank" rel="noreferrer" className="btn-stowear-wa">
                <WhatsappLogo size={16} weight="fill" /> Contact Support
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#23282d',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '2px',
          fontSize: '12.5px',
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
