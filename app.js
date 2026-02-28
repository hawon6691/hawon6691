const BLOG_URL = "https://development-name.tistory.com";
const RSS_URL = `${BLOG_URL}/rss`;
const STEP_COUNT = 6;

const state = {
  allPosts: [],
  filteredPosts: [],
  activeCategory: "all",
  query: "",
  visibleCount: STEP_COUNT,
};

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(input) {
  return String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(input) {
  return String(input || "").toLowerCase().trim();
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function renderStatus(text) {
  const status = document.getElementById("post-status");
  if (status) status.textContent = text;
}

function guessCategories(post) {
  const fromFeed = Array.isArray(post.categories) ? post.categories : [];
  if (fromFeed.length) return fromFeed.map((v) => normalizeText(v)).filter(Boolean);

  const body = `${post.title} ${post.description}`.toLowerCase();
  const categories = [];
  if (/spring|jpa|querydsl|api|backend|nest|laravel|django|express/.test(body)) categories.push("backend");
  if (/docker|aws|nginx|infra|deploy|ci|cd/.test(body)) categories.push("infra");
  if (/error|bug|troubleshooting|문제|해결/.test(body)) categories.push("troubleshooting");
  if (!categories.length) categories.push("etc");
  return categories;
}

function buildCategoryChips(posts) {
  const root = document.getElementById("post-categories");
  if (!root) return;

  const names = new Set(["all"]);
  posts.forEach((post) => post.categories.forEach((c) => names.add(c)));

  const chips = [...names].map((name) => {
    const label = name === "all" ? "전체" : name;
    const active = name === state.activeCategory ? " active" : "";
    return `<button type="button" class="chip${active}" data-category="${escapeHtml(name)}">${escapeHtml(label)}</button>`;
  });
  root.innerHTML = chips.join("");

  root.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategory = button.dataset.category || "all";
      state.visibleCount = STEP_COUNT;
      applyFilters();
    });
  });
}

function updateLoadMoreButton() {
  const btn = document.getElementById("load-more");
  if (!btn) return;
  const hasMore = state.filteredPosts.length > state.visibleCount;
  btn.style.display = hasMore ? "inline-flex" : "none";
}

function renderPosts(posts) {
  const container = document.getElementById("latest-posts");
  if (!container) return;

  if (!posts.length) {
    container.innerHTML = `
      <a class="card" href="${BLOG_URL}" target="_blank" rel="noreferrer">
        <p class="tag">Fallback</p>
        <h3>조건에 맞는 글이 없습니다.</h3>
        <p>검색어를 바꾸거나 티스토리 메인에서 전체 글을 확인해 주세요.</p>
      </a>
    `;
    updateLoadMoreButton();
    return;
  }

  const cards = posts.slice(0, state.visibleCount).map((post) => {
    const title = escapeHtml(post.title || "Untitled");
    const link = escapeHtml(post.link || BLOG_URL);
    const desc = escapeHtml(stripHtml(post.description || post.content || ""));
    const summary = desc.length > 110 ? `${desc.slice(0, 110)}...` : desc || "본문 미리보기를 준비 중입니다.";
    const date = formatDate(post.pubDate);
    const firstCategory = escapeHtml(post.categories[0] || "tistory");

    return `
      <a class="card" href="${link}" target="_blank" rel="noreferrer">
        <p class="tag">${firstCategory}</p>
        <h3>${title}</h3>
        <p>${summary}</p>
        ${date ? `<p class="meta">${date}</p>` : ""}
      </a>
    `;
  });

  container.innerHTML = cards.join("");
  updateLoadMoreButton();
}

function applyFilters() {
  const query = normalizeText(state.query);
  const category = state.activeCategory;

  state.filteredPosts = state.allPosts.filter((post) => {
    const byCategory = category === "all" || post.categories.includes(category);
    const merged = `${post.title} ${stripHtml(post.description || post.content || "")}`.toLowerCase();
    const byQuery = !query || merged.includes(query);
    return byCategory && byQuery;
  });

  const shown = Math.min(state.visibleCount, state.filteredPosts.length);
  renderStatus(`총 ${state.filteredPosts.length}개 글 중 ${shown}개 표시`);
  buildCategoryChips(state.allPosts);
  renderPosts(state.filteredPosts);
}

function bindControls() {
  const search = document.getElementById("post-search");
  const loadMore = document.getElementById("load-more");

  if (search) {
    search.addEventListener("input", (event) => {
      state.query = event.target.value || "";
      state.visibleCount = STEP_COUNT;
      applyFilters();
    });
  }

  if (loadMore) {
    loadMore.addEventListener("click", () => {
      state.visibleCount += STEP_COUNT;
      renderPosts(state.filteredPosts);
      const shown = Math.min(state.visibleCount, state.filteredPosts.length);
      renderStatus(`총 ${state.filteredPosts.length}개 글 중 ${shown}개 표시`);
    });
  }
}

async function fetchFromRss2Json() {
  const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("rss2json request failed");
  const data = await response.json();
  if (data.status !== "ok" || !Array.isArray(data.items)) throw new Error("invalid rss2json payload");
  return data.items.map((item) => ({
    ...item,
    categories: Array.isArray(item.categories) ? item.categories.map((v) => normalizeText(v)).filter(Boolean) : [],
  }));
}

async function fetchFromAllOrigins() {
  const endpoint = `https://api.allorigins.win/raw?url=${encodeURIComponent(RSS_URL)}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("allorigins request failed");
  const xml = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  return [...doc.querySelectorAll("item")].map((item) => {
    const categories = [...item.querySelectorAll("category")]
      .map((v) => normalizeText(v.textContent))
      .filter(Boolean);
    return {
      title: item.querySelector("title")?.textContent?.trim() || "",
      link: item.querySelector("link")?.textContent?.trim() || "",
      description: item.querySelector("description")?.textContent?.trim() || "",
      pubDate: item.querySelector("pubDate")?.textContent?.trim() || "",
      categories,
    };
  });
}

async function loadPosts() {
  renderStatus("최신 글을 불러오는 중입니다...");
  let items = [];

  try {
    items = await fetchFromRss2Json();
  } catch (e) {
    try {
      items = await fetchFromAllOrigins();
    } catch (fallbackError) {
      items = [];
    }
  }

  state.allPosts = items.map((item) => {
    const categories = item.categories && item.categories.length ? item.categories : guessCategories(item);
    return { ...item, categories };
  });
  state.visibleCount = STEP_COUNT;
  state.activeCategory = "all";
  state.query = "";
  applyFilters();
}

bindControls();
loadPosts();
