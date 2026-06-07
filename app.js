const state = {
  lives: [],
  facets: {},
  summary: {},
};

const elements = {
  totalCount: document.querySelector("#totalCount"),
  yearRange: document.querySelector("#yearRange"),
  venueCount: document.querySelector("#venueCount"),
  resultCount: document.querySelector("#resultCount"),
  searchInput: document.querySelector("#searchInput"),
  yearFilter: document.querySelector("#yearFilter"),
  artistFilter: document.querySelector("#artistFilter"),
  venueFilter: document.querySelector("#venueFilter"),
  resetButton: document.querySelector("#resetButton"),
  liveRows: document.querySelector("#liveRows"),
  topVenues: document.querySelector("#topVenues"),
  topArtists: document.querySelector("#topArtists"),
  venueMapList: document.querySelector("#venueMapList"),
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fillSelect(select, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function renderSummary() {
  const { total, firstDate, latestDate, venueCount } = state.summary;
  elements.totalCount.textContent = total ?? "-";
  elements.yearRange.textContent =
    firstDate && latestDate ? `${firstDate.slice(0, 4)}-${latestDate.slice(0, 4)}` : "-";
  elements.venueCount.textContent = venueCount ?? "-";
}

function renderRanking(target, rows) {
  target.innerHTML = rows
    .map(([name, count]) => `<li>${escapeHtml(name)} <span>${count}回</span></li>`)
    .join("");
}

function renderVenueLinks(rows) {
  const byVenue = new Map();
  state.lives.forEach((live) => {
    if (live.venue && !byVenue.has(live.venue)) {
      byVenue.set(live.venue, live);
    }
  });

  elements.venueMapList.innerHTML = rows
    .map(([name, count]) => {
      const live = byVenue.get(name);
      return `
        <li>
          <a href="${mapUrl(live)}" target="_blank" rel="noreferrer">${escapeHtml(name)}</a>
          <span>${count}回</span>
        </li>
      `;
    })
    .join("");
}

function currentFilters() {
  return {
    query: elements.searchInput.value.trim().toLowerCase(),
    year: elements.yearFilter.value,
    artist: elements.artistFilter.value,
    venue: elements.venueFilter.value,
  };
}

function matchesFilters(live, filters) {
  const haystack = [live.artist, live.venue, live.place, live.note]
    .join(" ")
    .toLowerCase();

  return (
    (!filters.query || haystack.includes(filters.query)) &&
    (!filters.year || String(live.year) === filters.year) &&
    (!filters.artist || live.artist === filters.artist) &&
    (!filters.venue || live.venue === filters.venue)
  );
}

function mapUrl(live) {
  const query = live.mapQuery || live.venue || live.place;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function artistCell(live) {
  const label = escapeHtml(live.artist || "-");
  if (!live.artistUrl) {
    return label;
  }
  return `<a class="artist-link" href="${escapeHtml(live.artistUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
}

function venueCell(live) {
  const label = escapeHtml(live.venue || "-");
  const query = live.mapQuery || live.venue || live.place;
  if (!query || query === "?") {
    return label;
  }
  return `<a class="venue-link" href="${mapUrl(live)}" target="_blank" rel="noreferrer">${label}</a>`;
}

function renderRows() {
  const filters = currentFilters();
  const rows = state.lives.filter((live) => matchesFilters(live, filters));

  elements.resultCount.textContent = `${rows.length}件表示`;

  if (!rows.length) {
    elements.liveRows.innerHTML = `<tr><td class="empty" colspan="5">該当する記録がありません</td></tr>`;
    return;
  }

  elements.liveRows.innerHTML = rows
    .map(
      (live) => `
        <tr>
          <td class="date">${escapeHtml(live.date || "-")}</td>
          <td>${artistCell(live)}</td>
          <td>${venueCell(live)}</td>
          <td class="price">${escapeHtml(live.ticketPrice || "-")}</td>
          <td>${escapeHtml(live.note || "-")}</td>
        </tr>
      `
    )
    .join("");
}

function bindEvents() {
  [
    elements.searchInput,
    elements.yearFilter,
    elements.artistFilter,
    elements.venueFilter,
  ].forEach((control) => {
    control.addEventListener("input", renderRows);
    control.addEventListener("change", renderRows);
  });

  elements.resetButton.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.yearFilter.value = "";
    elements.artistFilter.value = "";
    elements.venueFilter.value = "";
    renderRows();
  });
}

async function init() {
  let data = window.LIVE_LOG_DATA;
  if (!data) {
    const response = await fetch("data/lives.json");
    data = await response.json();
  }

  state.lives = data.lives;
  state.facets = data.facets;
  state.summary = data.summary;

  fillSelect(elements.yearFilter, state.facets.years);
  fillSelect(elements.artistFilter, state.facets.artists);
  fillSelect(elements.venueFilter, state.facets.venues);
  renderSummary();
  renderRanking(elements.topVenues, state.summary.topVenues);
  renderRanking(elements.topArtists, state.summary.topArtists);
  renderVenueLinks(state.summary.topVenues);
  bindEvents();
  renderRows();
}

init().catch((error) => {
  elements.liveRows.innerHTML = `<tr><td class="empty" colspan="5">データを読み込めませんでした</td></tr>`;
  console.error(error);
});
