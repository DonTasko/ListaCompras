/**
 * LISTA DE COMPRAS INTELIGENTE — app.js
 * Armazenamento: localStorage
 * PWA-ready | AdMob-ready | Capacitor-ready
 */

'use strict';

// ==========================================
// ESTADO GLOBAL
// ==========================================
const STATE = {
  lists: [],           // { id, name, products, createdAt, updatedAt }
  activeListId: null,
  favorites: [],       // { id, name, qty, unit, price, category }
  customCategories: [],
  settings: {},
  history: [],         // últimas listas abertas (ids)
  // AdMob counters
  _listsCreated: 0,
  _listsOpened: 0,
  _lastInterstitial: 0,
};

const STORAGE_KEY = 'listaMais_v1';

// ==========================================
// PERSISTÊNCIA
// ==========================================
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      lists: STATE.lists,
      favorites: STATE.favorites,
      customCategories: STATE.customCategories,
      settings: STATE.settings,
      history: STATE.history,
      _listsCreated: STATE._listsCreated,
      _listsOpened: STATE._listsOpened,
    }));
  } catch (e) {
    console.warn('Erro ao guardar:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.assign(STATE, data);
  } catch (e) {
    console.warn('Erro ao carregar:', e);
  }
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatEuro(v) {
  const n = parseFloat(v) || 0;
  return n.toFixed(2);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}

// ==========================================
// ADMOB — CAMADA DE MONETIZAÇÃO
// ==========================================
const AdMob = {
  /**
   * Inicializar AdMob (Capacitor).
   * Chamado apenas em ambiente nativo após conversão.
   */
  async init() {
    if (typeof window.AdMob === 'undefined') return;
    await window.AdMob.initialize({
      requestTrackingAuthorization: true,
      initializeForTesting: false,
    });
  },

  /** Banner fixo no rodapé */
  async showBanner(adUnitId = 'ca-app-pub-XXXXXX/XXXXXX') {
    if (typeof window.AdMob === 'undefined') {
      document.getElementById('admobHome').style.display = 'block';
      return;
    }
    await window.AdMob.showBanner({
      adId: adUnitId,
      adSize: 'BANNER',
      position: window.AdMob.AdPosition.BOTTOM_CENTER,
      isTesting: false,
    });
  },

  hideBanner() {
    if (typeof window.AdMob === 'undefined') {
      document.getElementById('admobHome').style.display = 'none';
      return;
    }
    window.AdMob?.hideBanner?.();
  },

  /** Interstitial: após criar 5 listas ou abrir 10 */
  async maybeInterstitial() {
    const now = Date.now();
    const minInterval = 3 * 60 * 1000; // 3 min
    if (now - STATE._lastInterstitial < minInterval) return;

    const trigger = STATE._listsCreated % 5 === 0 || STATE._listsOpened % 10 === 0;
    if (!trigger) return;

    STATE._lastInterstitial = now;

    if (typeof window.AdMob === 'undefined') return;
    try {
      await window.AdMob.prepareInterstitial({ adId: 'ca-app-pub-XXXXXX/XXXXXX' });
      await window.AdMob.showInterstitial();
    } catch (e) { console.warn('Interstitial error', e); }
  },

  /** Rewarded: desbloquear funcionalidades premium */
  async showRewarded(adUnitId = 'ca-app-pub-XXXXXX/XXXXXX', onReward) {
    if (typeof window.AdMob === 'undefined') {
      onReward?.();
      return;
    }
    try {
      await window.AdMob.prepareRewardVideoAd({ adId: adUnitId });
      window.AdMob.addListener('onRewarded', onReward);
      await window.AdMob.showRewardVideoAd();
    } catch (e) { console.warn('Rewarded error', e); }
  },
};

// ==========================================
// LISTAS
// ==========================================
function getActiveList() {
  return STATE.lists.find(l => l.id === STATE.activeListId) || null;
}

function createList(name = 'Nova Lista') {
  const list = {
    id: uid(),
    name,
    products: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  STATE.lists.unshift(list);
  STATE._listsCreated++;
  saveState();
  return list;
}

function deleteList(id) {
  STATE.lists = STATE.lists.filter(l => l.id !== id);
  if (STATE.activeListId === id) STATE.activeListId = null;
  STATE.history = STATE.history.filter(h => h !== id);
  saveState();
}

function duplicateList(id) {
  const orig = STATE.lists.find(l => l.id === id);
  if (!orig) return null;
  const copy = {
    ...JSON.parse(JSON.stringify(orig)),
    id: uid(),
    name: orig.name + ' (cópia)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    products: orig.products.map(p => ({ ...p, id: uid(), bought: false })),
  };
  STATE.lists.unshift(copy);
  STATE._listsCreated++;
  saveState();
  return copy;
}

function openList(id) {
  STATE.activeListId = id;
  STATE._listsOpened++;
  STATE.history = [id, ...STATE.history.filter(h => h !== id)].slice(0, 30);
  saveState();
  AdMob.maybeInterstitial();
}

// ==========================================
// PRODUTOS
// ==========================================
function addProduct(listId, product) {
  const list = STATE.lists.find(l => l.id === listId);
  if (!list) return;
  list.products.push({ ...product, id: uid(), bought: false });
  list.updatedAt = Date.now();
  saveState();
}

function toggleProduct(listId, productId) {
  const list = STATE.lists.find(l => l.id === listId);
  if (!list) return;
  const p = list.products.find(p => p.id === productId);
  if (!p) return;
  p.bought = !p.bought;
  list.updatedAt = Date.now();
  saveState();
}

function deleteProduct(listId, productId) {
  const list = STATE.lists.find(l => l.id === listId);
  if (!list) return;
  list.products = list.products.filter(p => p.id !== productId);
  list.updatedAt = Date.now();
  saveState();
}

// ==========================================
// FAVORITOS
// ==========================================
function toggleFavorite(product) {
  const idx = STATE.favorites.findIndex(f => f.name.toLowerCase() === product.name.toLowerCase());
  if (idx >= 0) {
    STATE.favorites.splice(idx, 1);
  } else {
    STATE.favorites.push({ id: uid(), ...product });
  }
  saveState();
}

function isFavorite(name) {
  return STATE.favorites.some(f => f.name.toLowerCase() === name.toLowerCase());
}

// ==========================================
// ÍCONES POR CATEGORIA
// ==========================================
const CAT_ICONS = {
  'Frutas': '🍎', 'Legumes': '🥦', 'Carne': '🥩', 'Peixe': '🐟',
  'Lacticínios': '🧀', 'Congelados': '🧊', 'Bebidas': '🥤',
  'Higiene': '🧴', 'Limpeza': '🧹', 'Outros': '📦',
};
const LIST_ICONS = ['🛒', '🍖', '🎉', '📦', '🥗', '🧺', '🍳', '🌿'];
function listIcon(list) {
  const h = list.id.charCodeAt(0) % LIST_ICONS.length;
  return LIST_ICONS[h];
}
function catIcon(cat) {
  return CAT_ICONS[cat] || '🏷️';
}

// ==========================================
// ESTATÍSTICAS
// ==========================================
function computeStats() {
  let totalLists = STATE.lists.length;
  let totalProducts = 0;
  let totalBought = 0;
  let totalSpent = 0;
  const catCount = {};

  STATE.lists.forEach(list => {
    list.products.forEach(p => {
      totalProducts++;
      if (p.bought) {
        totalBought++;
        totalSpent += (parseFloat(p.price) || 0) * (parseFloat(p.qty) || 1);
      }
      catCount[p.category] = (catCount[p.category] || 0) + 1;
    });
  });

  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  return { totalLists, totalProducts, totalBought, totalSpent, topCat, totalFavs: STATE.favorites.length };
}

// ==========================================
// RENDERIZAÇÃO — LISTA ATIVA
// ==========================================
let currentCatFilter = 'all';

function renderActiveList() {
  const list = getActiveList();
  const area = document.getElementById('activeListArea');
  const overview = document.getElementById('listsOverview');

  if (!list) {
    area.style.display = 'none';
    overview.style.display = 'block';
    renderListsGrid();
    updateStatsStrip(null);
    return;
  }

  area.style.display = 'block';
  overview.style.display = 'none';

  // Nome
  const nameEl = document.getElementById('activeListName');
  if (document.activeElement !== nameEl) nameEl.textContent = list.name;

  // Progresso
  const total = list.products.length;
  const bought = list.products.filter(p => p.bought).length;
  const pct = total > 0 ? Math.round((bought / total) * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent = pct + '%';

  // Stats strip
  const totalEst = list.products.reduce((s, p) => s + (parseFloat(p.price) || 0) * (parseFloat(p.qty) || 1), 0);
  document.getElementById('statProducts').textContent = total;
  document.getElementById('statBought').textContent = bought;
  document.getElementById('statTotal').textContent = formatEuro(totalEst);
  document.getElementById('statsStrip').style.display = total > 0 ? 'flex' : 'none';

  // Categorias
  renderCatFilter(list);

  // Produtos
  renderProductList(list);
}

function renderCatFilter(list) {
  const cats = ['all', ...new Set(list.products.map(p => p.category))];
  const cf = document.getElementById('catFilter');
  cf.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-pill' + (cat === currentCatFilter ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = cat === 'all' ? 'Todos' : `${catIcon(cat)} ${cat}`;
    btn.addEventListener('click', () => {
      currentCatFilter = cat;
      renderCatFilter(list);
      renderProductList(list);
    });
    cf.appendChild(btn);
  });
}

function renderProductList(list) {
  const ul = document.getElementById('productList');
  ul.innerHTML = '';

  let products = list.products;
  if (currentCatFilter !== 'all') {
    products = products.filter(p => p.category === currentCatFilter);
  }

  if (products.length === 0) {
    ul.innerHTML = '<li style="text-align:center;padding:24px;color:var(--text-xmuted);font-size:14px;">Nenhum produto nesta categoria.</li>';
    return;
  }

  // Ordenar: não comprados primeiro
  products = [...products].sort((a, b) => a.bought - b.bought);

  products.forEach(p => {
    const li = document.createElement('li');
    li.className = 'product-item' + (p.bought ? ' bought' : '');
    li.dataset.id = p.id;

    const price = (parseFloat(p.price) || 0) * (parseFloat(p.qty) || 1);
    const priceStr = price > 0 ? `€${formatEuro(price)}` : '';

    li.innerHTML = `
      <div class="product-check"></div>
      <div class="product-info">
        <div class="product-name">${escHtml(p.name)}</div>
        <div class="product-meta">${escHtml(p.qty)} ${escHtml(p.unit || 'un')} · <span class="product-cat-badge">${catIcon(p.category)} ${escHtml(p.category)}</span></div>
      </div>
      ${priceStr ? `<span class="product-price">${priceStr}</span>` : ''}
      <button class="product-del" data-id="${p.id}" aria-label="Remover produto">
        <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    `;

    // Toggle comprado
    li.addEventListener('click', (e) => {
      if (e.target.closest('.product-del')) return;
      toggleProduct(STATE.activeListId, p.id);
      renderActiveList();
    });

    // Deletar produto
    li.querySelector('.product-del').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProduct(STATE.activeListId, p.id);
      renderActiveList();
      showToast('Produto removido');
    });

    ul.appendChild(li);
  });
}

function updateStatsStrip(list) {
  document.getElementById('statsStrip').style.display = 'none';
}

// ==========================================
// RENDERIZAÇÃO — GRID DE LISTAS
// ==========================================
function renderListsGrid() {
  const grid = document.getElementById('listsGrid');
  const empty = document.getElementById('emptyState');
  grid.innerHTML = '';

  if (STATE.lists.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  STATE.lists.forEach(list => {
    const total = list.products.length;
    const bought = list.products.filter(p => p.bought).length;
    const pct = total > 0 ? Math.round((bought / total) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-icon">${listIcon(list)}</div>
      <div class="list-card-name">${escHtml(list.name)}</div>
      <div class="list-card-meta">${total} produto${total !== 1 ? 's' : ''} · ${formatDate(list.updatedAt)}</div>
      <div class="list-card-progress"><div class="list-card-progress-fill" style="width:${pct}%"></div></div>
    `;
    card.addEventListener('click', () => {
      openList(list.id);
      renderActiveList();
    });
    grid.appendChild(card);
  });
}

// ==========================================
// RENDERIZAÇÃO — FAVORITOS
// ==========================================
function renderFavorites() {
  const ul = document.getElementById('favoritesList');
  const empty = document.getElementById('favEmpty');
  ul.innerHTML = '';

  if (STATE.favorites.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  STATE.favorites.forEach(fav => {
    const li = document.createElement('li');
    li.className = 'fav-item';
    li.innerHTML = `
      <div>
        <div class="fav-name">⭐ ${escHtml(fav.name)}</div>
        <div class="fav-meta">${catIcon(fav.category)} ${escHtml(fav.category)} · ${escHtml(fav.qty || '1')} ${escHtml(fav.unit || 'un')}</div>
      </div>
      <div class="fav-actions">
        <button class="btn-add-fav">+ Adicionar</button>
      </div>
    `;
    li.querySelector('.btn-add-fav').addEventListener('click', () => {
      const list = getActiveList();
      if (!list) { showToast('Abra ou crie uma lista primeiro'); return; }
      addProduct(STATE.activeListId, { name: fav.name, qty: fav.qty || 1, unit: fav.unit || 'un', price: fav.price || '', category: fav.category || 'Outros' });
      renderActiveList();
      showToast(`${fav.name} adicionado à lista`);
    });
    ul.appendChild(li);
  });
}

// ==========================================
// RENDERIZAÇÃO — HISTÓRICO
// ==========================================
function renderHistory() {
  const ul = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  ul.innerHTML = '';

  const histLists = STATE.history.map(id => STATE.lists.find(l => l.id === id)).filter(Boolean);

  if (histLists.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  histLists.forEach(list => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `
      <div class="history-info">
        <div class="history-name">${listIcon(list)} ${escHtml(list.name)}</div>
        <div class="history-meta">${list.products.length} produtos · ${formatDate(list.updatedAt)}</div>
      </div>
      <button class="btn-restore">Abrir</button>
    `;
    li.querySelector('.btn-restore').addEventListener('click', () => {
      openList(list.id);
      navigateTo('home');
      renderActiveList();
    });
    ul.appendChild(li);
  });
}

// ==========================================
// RENDERIZAÇÃO — STATS
// ==========================================
function renderStats() {
  const s = computeStats();
  document.getElementById('sTotalLists').textContent = s.totalLists;
  document.getElementById('sTotalProducts').textContent = s.totalProducts;
  document.getElementById('sTotalBought').textContent = s.totalBought;
  document.getElementById('sTotalSpent').textContent = formatEuro(s.totalSpent);
  document.getElementById('sTotalFavs').textContent = s.totalFavs;
  document.getElementById('sTopCat').textContent = s.topCat;
}

// ==========================================
// RENDERIZAÇÃO — DEFINIÇÕES
// ==========================================
function renderSettings() {
  const container = document.getElementById('customCatsList');
  container.innerHTML = '';
  STATE.customCategories.forEach((cat, i) => {
    const chip = document.createElement('div');
    chip.className = 'custom-cat-chip';
    chip.innerHTML = `${catIcon(cat)} ${escHtml(cat)} <button data-i="${i}" title="Remover">×</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      STATE.customCategories.splice(i, 1);
      saveState();
      renderSettings();
      rebuildCatOptions();
    });
    container.appendChild(chip);
  });
}

function rebuildCatOptions() {
  const sel = document.getElementById('inpCat');
  const defaultCats = ['Outros','Frutas','Legumes','Carne','Peixe','Lacticínios','Congelados','Bebidas','Higiene','Limpeza'];
  const allCats = [...defaultCats, ...STATE.customCategories];
  const current = sel.value;
  sel.innerHTML = allCats.map(c => `<option value="${c}">${catIcon(c)} ${c}</option>`).join('');
  if (allCats.includes(current)) sel.value = current;
}

// ==========================================
// NAVEGAÇÃO
// ==========================================
function navigateTo(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.drawer-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById('view' + viewName.charAt(0).toUpperCase() + viewName.slice(1));
  if (view) view.classList.add('active');

  document.querySelectorAll(`[data-view="${viewName}"]`).forEach(el => el.classList.add('active'));

  // AdMob banner: apenas na home e no histórico
  const showBanner = viewName === 'home' || viewName === 'history';
  if (showBanner) AdMob.showBanner(); else AdMob.hideBanner();

  // Render específico
  if (viewName === 'favorites') renderFavorites();
  if (viewName === 'history') renderHistory();
  if (viewName === 'stats') renderStats();
  if (viewName === 'settings') renderSettings();
  if (viewName === 'home') renderActiveList();

  // Fechar drawer
  closeDrawer();
}

// ==========================================
// DRAWER
// ==========================================
function openDrawer() {
  document.getElementById('drawer').classList.remove('hidden');
  document.getElementById('drawerOverlay').classList.remove('hidden');
}
function closeDrawer() {
  document.getElementById('drawer').classList.add('hidden');
  document.getElementById('drawerOverlay').classList.add('hidden');
}

// ==========================================
// PESQUISA
// ==========================================
function performSearch(query) {
  if (!query.trim()) { navigateTo('home'); return; }
  const q = query.toLowerCase();

  // Pesquisar em todas as listas e produtos
  const results = [];
  STATE.lists.forEach(list => {
    if (list.name.toLowerCase().includes(q)) {
      results.push({ type: 'list', list });
    }
    list.products.forEach(p => {
      if (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) {
        results.push({ type: 'product', list, product: p });
      }
    });
  });

  const grid = document.getElementById('listsGrid');
  const empty = document.getElementById('emptyState');
  const area = document.getElementById('activeListArea');
  const overview = document.getElementById('listsOverview');

  area.style.display = 'none';
  overview.style.display = 'block';
  document.getElementById('statsStrip').style.display = 'none';

  document.querySelector('.section-title').textContent = `Resultados: "${query}"`;
  grid.innerHTML = '';

  if (results.length === 0) {
    empty.style.display = 'block';
    empty.querySelector('.empty-icon').textContent = '🔍';
    empty.querySelector('p').textContent = 'Nenhum resultado encontrado.';
    return;
  }
  empty.style.display = 'none';

  results.forEach(r => {
    const card = document.createElement('div');
    card.className = 'list-card';
    if (r.type === 'list') {
      card.innerHTML = `<div class="list-card-icon">${listIcon(r.list)}</div><div class="list-card-name">${escHtml(r.list.name)}</div><div class="list-card-meta">Lista · ${r.list.products.length} produtos</div>`;
      card.addEventListener('click', () => {
        closeSearch();
        openList(r.list.id);
        navigateTo('home');
      });
    } else {
      card.innerHTML = `<div class="list-card-icon">${catIcon(r.product.category)}</div><div class="list-card-name">${escHtml(r.product.name)}</div><div class="list-card-meta">Em: ${escHtml(r.list.name)}</div>`;
      card.addEventListener('click', () => {
        closeSearch();
        openList(r.list.id);
        navigateTo('home');
      });
    }
    grid.appendChild(card);
  });
}

function closeSearch() {
  document.getElementById('searchBar').classList.add('hidden');
  document.getElementById('searchInput').value = '';
  document.querySelector('.section-title').textContent = 'As Minhas Listas';
  navigateTo('home');
}

// ==========================================
// SEGURANÇA — HTML ESCAPE
// ==========================================
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// EXPORTAR DADOS
// ==========================================
function exportData() {
  const data = JSON.stringify({ lists: STATE.lists, favorites: STATE.favorites }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-compras-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Dados exportados');
}

// ==========================================
// INICIALIZAÇÃO — EVENT LISTENERS
// ==========================================
function bindEvents() {

  // Navegação bottom
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });

  // Menu drawer
  document.getElementById('btnMenu').addEventListener('click', openDrawer);
  document.getElementById('btnCloseDrawer').addEventListener('click', closeDrawer);
  document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);

  // Pesquisa
  document.getElementById('btnSearch').addEventListener('click', () => {
    document.getElementById('searchBar').classList.toggle('hidden');
    document.getElementById('searchInput').focus();
  });
  document.getElementById('btnCloseSearch').addEventListener('click', closeSearch);
  document.getElementById('searchInput').addEventListener('input', (e) => {
    performSearch(e.target.value);
  });

  // FAB — nova lista
  document.getElementById('btnNewList').addEventListener('click', () => {
    const list = createList('Nova Lista');
    openList(list.id);
    navigateTo('home');
    showToast('Lista criada ✓');
    AdMob.maybeInterstitial();
    // Focar no nome para editar
    setTimeout(() => {
      const nameEl = document.getElementById('activeListName');
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }, 200);
  });

  // Editar nome da lista
  document.getElementById('activeListName').addEventListener('blur', () => {
    const list = getActiveList();
    if (!list) return;
    const newName = document.getElementById('activeListName').textContent.trim() || 'Nova Lista';
    list.name = newName;
    list.updatedAt = Date.now();
    saveState();
  });

  // Duplicar lista
  document.getElementById('btnDuplicateList').addEventListener('click', () => {
    if (!STATE.activeListId) return;
    const copy = duplicateList(STATE.activeListId);
    if (copy) {
      showToast('Lista duplicada');
      openList(copy.id);
      renderActiveList();
    }
  });

  // Apagar lista
  document.getElementById('btnDeleteList').addEventListener('click', () => {
    if (!STATE.activeListId) return;
    if (!confirm('Apagar esta lista?')) return;
    deleteList(STATE.activeListId);
    navigateTo('home');
    showToast('Lista apagada');
  });

  // Favorito toggle no form
  let formFavActive = false;
  document.getElementById('btnFavToggle').addEventListener('click', () => {
    formFavActive = !formFavActive;
    document.getElementById('btnFavToggle').classList.toggle('active', formFavActive);
  });

  // Adicionar produto
  document.getElementById('btnAddProduct').addEventListener('click', () => {
    const name = document.getElementById('inpName').value.trim();
    if (!name) { showToast('Escreva o nome do produto'); return; }
    const qty = parseFloat(document.getElementById('inpQty').value) || 1;
    const unit = document.getElementById('inpUnit').value;
    const price = document.getElementById('inpPrice').value;
    const category = document.getElementById('inpCat').value;

    if (!STATE.activeListId) {
      const list = createList('Nova Lista');
      openList(list.id);
    }

    const product = { name, qty, unit, price, category };
    addProduct(STATE.activeListId, product);

    if (formFavActive) {
      if (!isFavorite(name)) toggleFavorite(product);
    }

    // Reset form
    document.getElementById('inpName').value = '';
    document.getElementById('inpQty').value = '1';
    document.getElementById('inpPrice').value = '';
    formFavActive = false;
    document.getElementById('btnFavToggle').classList.remove('active');

    renderActiveList();
    showToast(`${name} adicionado ✓`);
    document.getElementById('inpName').focus();
  });

  // Enter no input nome
  document.getElementById('inpName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnAddProduct').click();
  });

  // Nova categoria — modal
  document.getElementById('btnNewCat').addEventListener('click', () => {
    document.getElementById('modalCatOverlay').classList.remove('hidden');
    document.getElementById('modalCatInput').focus();
  });
  document.getElementById('btnModalCatCancel').addEventListener('click', () => {
    document.getElementById('modalCatOverlay').classList.add('hidden');
  });
  document.getElementById('btnModalCatSave').addEventListener('click', () => {
    const name = document.getElementById('modalCatInput').value.trim();
    if (name && !STATE.customCategories.includes(name)) {
      STATE.customCategories.push(name);
      saveState();
      rebuildCatOptions();
      document.getElementById('inpCat').value = name;
    }
    document.getElementById('modalCatInput').value = '';
    document.getElementById('modalCatOverlay').classList.add('hidden');
    showToast('Categoria criada');
  });
  document.getElementById('modalCatOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalCatOverlay')) {
      document.getElementById('modalCatOverlay').classList.add('hidden');
    }
  });

  // Definições
  document.getElementById('btnExportData').addEventListener('click', exportData);
  document.getElementById('btnClearAll').addEventListener('click', () => {
    if (!confirm('Apagar TODOS os dados? Esta ação é irreversível.')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  document.getElementById('btnSaveCat').addEventListener('click', () => {
    const name = document.getElementById('inpNewCatName').value.trim();
    if (name && !STATE.customCategories.includes(name)) {
      STATE.customCategories.push(name);
      saveState();
      renderSettings();
      rebuildCatOptions();
      document.getElementById('inpNewCatName').value = '';
      showToast('Categoria adicionada');
    }
  });

  // PWA Install
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('btnInstall').style.display = 'flex';
  });
  document.getElementById('btnInstall').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('btnInstall').style.display = 'none';
    }
    deferredPrompt = null;
  });
}

// ==========================================
// SERVICE WORKER
// ==========================================
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => console.warn('SW error:', err));
  }
}

// ==========================================
// BOOT
// ==========================================
function boot() {
  loadState();
  bindEvents();
  rebuildCatOptions();

  // Splash → App
  setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    navigateTo('home');
    AdMob.init();
  }, 1400);

  registerSW();
}

document.addEventListener('DOMContentLoaded', boot);
