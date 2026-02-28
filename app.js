const BLOG_URL = "https://development-name.tistory.com";
const RSS_URL = `${BLOG_URL}/rss`;
const MAX_POSTS = 6;

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

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function renderPosts(posts) {
  const container = document.getElementById("latest-posts");
  if (!container) return;

  if (!posts.length) {
    container.innerHTML = `
      <a class="card" href="${BLOG_URL}" target="_blank" rel="noreferrer">
        <p class="tag">Fallback</p>
        <h3>최신 글을 불러오지 못했습니다.</h3>
        <p>티스토리 메인에서 글을 확인해 주세요.</p>
      </a>
    `;
    return;
  }

  const cards = posts.slice(0, MAX_POSTS).map((post) => {
    const title = escapeHtml(post.title || "Untitled");
    const link = escapeHtml(post.link || BLOG_URL);
    const desc = escapeHtml(stripHtml(post.description || post.content || ""));
    const summary = desc.length > 92 ? `${desc.slice(0, 92)}...` : desc || "본문 미리보기를 준비 중입니다.";
    const date = formatDate(post.pubDate);

    return `
      <a class="card" href="${link}" target="_blank" rel="noreferrer">
        <p class="tag">Tistory</p>
        <h3>${title}</h3>
        <p>${summary}</p>
        ${date ? `<p class="meta">${date}</p>` : ""}
      </a>
    `;
  });

  container.innerHTML = cards.join("");
}

async function fetchFromRss2Json() {
  const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("rss2json request failed");
  const data = await response.json();
  if (data.status !== "ok" || !Array.isArray(data.items)) throw new Error("invalid rss2json payload");
  return data.items;
}

async function fetchFromAllOrigins() {
  const endpoint = `https://api.allorigins.win/raw?url=${encodeURIComponent(RSS_URL)}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("allorigins request failed");
  const xml = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const items = [...doc.querySelectorAll("item")].map((item) => ({
    title: item.querySelector("title")?.textContent?.trim() || "",
    link: item.querySelector("link")?.textContent?.trim() || "",
    description: item.querySelector("description")?.textContent?.trim() || "",
    pubDate: item.querySelector("pubDate")?.textContent?.trim() || "",
  }));
  return items;
}

async function loadPosts() {
  try {
    const items = await fetchFromRss2Json();
    renderPosts(items);
    return;
  } catch (e) {
    // Fallback provider if rss2json is unavailable.
  }

  try {
    const items = await fetchFromAllOrigins();
    renderPosts(items);
  } catch (e) {
    renderPosts([]);
  }
}

loadPosts();
