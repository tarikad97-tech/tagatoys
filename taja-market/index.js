/* taja market — index.js: الصفحة الرئيسية (منتجات + بحث + فلترة + سلايدر) */
const PAGE_SIZE = 12;

function norm(s) {
  return String(s || "").toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").trim();
}

document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  const grid = $("shopGrid");
  if (!grid) return;

  let all = [], list = [], shown = 0, query = "", filter = "all", sort = "new";

  const skeleton = () => new Array(9).join('<div class="card skel"><div class="card-img"></div><div class="card-body"><i></i><i style="width:60%"></i></div></div>');
  const setState = h => { $("shopState").innerHTML = h; $("shopState").hidden = !h; };

  function apply() {
    const q = norm(query);
    list = all.filter(p => (!q || norm(p.name).indexOf(q) >= 0) &&
      (filter === "all" || (filter === "offers" && discountPercent(p) > 0) || (filter === "stock" && Number(p.stock) > 0)));
    if (sort === "low") list.sort((a, b) => a.price - b.price);
    else if (sort === "high") list.sort((a, b) => b.price - a.price);
    shown = Math.min(PAGE_SIZE, list.length);
    grid.innerHTML = list.slice(0, shown).map(productCardHtml).join("");
    $("shopCount").textContent = all.length ? list.length + " منتج" : "";
    $("shopMore").hidden = shown >= list.length;
    if (!all.length) setState("لا توجد منتجات حاليًا، عُد قريبًا.");
    else if (!list.length) setState('لا توجد نتائج مطابقة.<br><button type="button" class="btn btn-blue" id="resetBtn" style="margin-top:12px">عرض كل المنتجات</button>');
    else setState("");
  }

  function more() {
    if (shown >= list.length) return;
    const next = Math.min(shown + PAGE_SIZE, list.length), start = shown;
    grid.insertAdjacentHTML("beforeend", list.slice(start, next).map((p, i) => productCardHtml(p, start + i)).join(""));
    shown = next;
    $("shopMore").hidden = shown >= list.length;
  }
  $("moreBtn").addEventListener("click", more);
  if ("IntersectionObserver" in window) new IntersectionObserver(en => { if (en.some(e => e.isIntersecting)) more(); }, { rootMargin: "600px" }).observe($("shopMore"));

  // صورة معطوبة: نعرض أيقونة بدلها
  grid.addEventListener("error", e => {
    if (e.target.tagName === "IMG") { e.target.parentElement.classList.add("no-img"); e.target.remove(); }
  }, true);

  $("shopState").addEventListener("click", e => {
    if (e.target.id === "retryBtn") load();
    if (e.target.id === "resetBtn") { query = ""; filter = "all"; $("searchInput").value = ""; apply(); }
  });

  $("sortSel").addEventListener("change", e => { sort = e.target.value; apply(); });

  let t;
  window.onStoreSearch = q => { clearTimeout(t); t = setTimeout(() => { query = q; apply(); }, 150); };

  async function load() {
    const cached = cacheGet(CACHE_KEY);
    if (cached && cached.length) { all = cached; apply(); } else { setState(""); grid.innerHTML = skeleton(); }
    try {
      const fresh = (await apiGet({ action: "products", light: "1" })).filter(p => p.status === "active");
      if (JSON.stringify(fresh) !== JSON.stringify(cached)) { all = fresh; apply(); }
      cacheSet(CACHE_KEY, fresh);
    } catch (err) {
      if (!(cached && cached.length)) {
        grid.innerHTML = ""; $("shopMore").hidden = true;
        setState('حدث خطأ أثناء تحميل المنتجات<br><button type="button" class="btn btn-blue" id="retryBtn" style="margin-top:12px">إعادة المحاولة</button>');
      }
    }
  }

  const q0 = new URLSearchParams(location.search).get("q");
  if (q0) { query = q0; $("searchInput").value = q0; }
  load();

  // ----- السلايدر -----
  const root = $("heroSlider");
  if (!root) return;
  const slides = [].slice.call(root.querySelectorAll(".slide")), dots = root.querySelector(".s-dots"), bar = root.querySelector(".s-bar");
  const DUR = 6000;
  let i = 0, timer = null;
  root.style.setProperty("--dur", DUR + "ms");
  const dotEls = slides.map((_, n) => { const b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "الشريحة " + (n + 1)); b.onclick = () => go(n); dots.appendChild(b); return b; });
  function restart() {
    clearTimeout(timer); bar.classList.remove("run"); void bar.offsetWidth;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    bar.classList.add("run"); timer = setTimeout(() => go(i + 1), DUR);
  }
  function go(n) {
    slides[i].classList.remove("on"); i = (n + slides.length) % slides.length; slides[i].classList.add("on");
    dotEls.forEach((d, k) => d.classList.toggle("on", k === i)); restart();
  }
  const pause = () => { clearTimeout(timer); bar.classList.remove("run"); };
  root.querySelector(".s-next").onclick = () => go(i + 1);
  root.querySelector(".s-prev").onclick = () => go(i - 1);
  root.addEventListener("mouseenter", pause); root.addEventListener("mouseleave", restart);
  let x0 = null;
  root.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; pause(); }, { passive: true });
  root.addEventListener("touchend", e => { if (x0 !== null) { const dx = e.changedTouches[0].clientX - x0; Math.abs(dx) > 40 ? go(i + (dx < 0 ? 1 : -1)) : restart(); } x0 = null; });
  document.addEventListener("visibilitychange", () => document.hidden ? pause() : restart());
  go(0);
});