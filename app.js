const state = {
  lives: [],
  facets: {},
  summary: {},
  artistProfiles: {},
  spotifyArtistStats: {},
  selectedArtist: "",
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
  topSpotifyArtists: document.querySelector("#topSpotifyArtists"),
  venueMapList: document.querySelector("#venueMapList"),
  artistDetailTitle: document.querySelector("#artistDetailTitle"),
  artistDetail: document.querySelector("#artistDetail"),
  clearArtistButton: document.querySelector("#clearArtistButton"),
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

function renderArtistRanking(target, rows) {
  target.innerHTML = rows
    .map(
      ([name, count]) => `
        <li>
          <button class="inline-button" type="button" data-artist="${escapeHtml(name)}">${escapeHtml(name)}</button>
          <span>${count}回</span>
        </li>
      `
    )
    .join("");
}

function renderSpotifyArtistRanking(target, rows) {
  target.innerHTML = rows
    .map(
      (row) => `
        <li>
          <button class="inline-button" type="button" data-artist="${escapeHtml(row.name)}">${escapeHtml(row.name)}</button>
          <span>${row.plays.toLocaleString()}回</span>
        </li>
      `
    )
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
  if (!live.artist) {
    return label;
  }
  return `<button class="artist-button" type="button" data-artist="${label}">${label}</button>`;
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

function countValues(rows, key) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = row[key];
    if (value) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"));
}

function renderTagList(tags) {
  if (!tags?.length) {
    return "";
  }
  return `<div class="tag-list">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function renderMiniTimeline(rows) {
  return rows
    .slice(0, 5)
    .map(
      (live) => `
        <li>
          <span>${escapeHtml(live.date || "-")}</span>
          <strong>${escapeHtml(live.venue || "-")}</strong>
          ${live.note ? `<em>${escapeHtml(live.note)}</em>` : ""}
        </li>
      `
    )
    .join("");
}

function listeningHours(ms) {
  return (ms / 1000 / 60 / 60).toFixed(1);
}

function renderSpotifyDetail(stats) {
  if (!stats) {
    return `
      <div class="artist-subsection">
        <h3>Spotify視聴</h3>
        <p class="muted">このアーティストの視聴履歴はまだ見つかっていません</p>
      </div>
    `;
  }

  return `
    <div class="artist-subsection spotify-detail">
      <h3>Spotify視聴</h3>
      <dl class="artist-stats">
        <div>
          <dt>再生</dt>
          <dd>${stats.plays.toLocaleString()}回</dd>
        </div>
        <div>
          <dt>時間</dt>
          <dd>${listeningHours(stats.knownMs)}h</dd>
        </div>
        <div>
          <dt>初回</dt>
          <dd>${escapeHtml(stats.firstPlayedAt || "-")}</dd>
        </div>
        <div>
          <dt>最新</dt>
          <dd>${escapeHtml(stats.latestPlayedAt || "-")}</dd>
        </div>
      </dl>
      <ol class="compact-list track-list">
        ${stats.topTracks
          .map(
            (track) => `
              <li>
                <strong>${escapeHtml(track.name)}</strong>
                <span>${track.plays.toLocaleString()}回 / ${listeningHours(track.knownMs)}h</span>
              </li>
            `
          )
          .join("")}
      </ol>
    </div>
  `;
}

function renderVenueSummary(venues) {
  if (!venues.length) {
    return `<p class="muted">ライブ記録はまだありません</p>`;
  }
  return `
    <ol class="compact-list">
      ${venues
        .slice(0, 4)
        .map(([venue, count]) => `<li>${escapeHtml(venue)} <span>${count}回</span></li>`)
        .join("")}
    </ol>
  `;
}

function renderLiveTimeline(rows) {
  if (!rows.length) {
    return `<p class="muted">ライブ履歴はまだありません</p>`;
  }
  return `<ol class="mini-timeline">${renderMiniTimeline(rows)}</ol>`;
}

function renderArtistDetail(name) {
  const artist = name || state.summary.topArtists?.[0]?.[0] || "";
  state.selectedArtist = artist;

  if (!artist) {
    elements.artistDetailTitle.textContent = "アーティスト";
    elements.artistDetail.innerHTML = "";
    elements.clearArtistButton.hidden = true;
    return;
  }

  const rows = state.lives.filter((live) => live.artist === artist);
  const profile = state.artistProfiles[artist] || {};
  const spotifyStats = state.spotifyArtistStats[artist];
  const venues = countValues(rows, "venue");
  const first = rows.at(-1)?.date || "-";
  const latest = rows[0]?.date || "-";
  const officialUrl = profile.officialUrl || rows.find((live) => live.artistUrl)?.artistUrl || "";
  const noteCount = rows.filter((live) => live.note).length;

  elements.artistDetailTitle.textContent = artist;
  elements.clearArtistButton.hidden = artist === state.summary.topArtists?.[0]?.[0];
  elements.artistDetail.innerHTML = `
    ${renderTagList(profile.tags)}
    ${profile.memo ? `<p class="artist-memo">${escapeHtml(profile.memo)}</p>` : ""}
    <dl class="artist-stats">
      <div>
        <dt>記録</dt>
        <dd>${rows.length}回</dd>
      </div>
      <div>
        <dt>期間</dt>
        <dd>${escapeHtml(first)} - ${escapeHtml(latest)}</dd>
      </div>
      <div>
        <dt>会場</dt>
        <dd>${venues.length}箇所</dd>
      </div>
      <div>
        <dt>メモ</dt>
        <dd>${noteCount}件</dd>
      </div>
    </dl>
    <div class="artist-actions">
      ${
        officialUrl
          ? `<a class="external-button" href="${escapeHtml(officialUrl)}" target="_blank" rel="noreferrer">公式サイト</a>`
          : ""
      }
      ${
        rows.length
          ? `<button class="ghost-button" type="button" data-filter-artist="${escapeHtml(artist)}">一覧を絞る</button>`
          : ""
      }
    </div>
    <div class="artist-subsection">
      <h3>よく行く会場</h3>
      ${renderVenueSummary(venues)}
    </div>
    ${renderSpotifyDetail(spotifyStats)}
    <div class="artist-subsection">
      <h3>ライブ履歴</h3>
      ${renderLiveTimeline(rows)}
    </div>
  `;
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

  elements.liveRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-artist]");
    if (button) {
      renderArtistDetail(button.dataset.artist);
    }
  });

  elements.topArtists.addEventListener("click", (event) => {
    const button = event.target.closest("[data-artist]");
    if (button) {
      renderArtistDetail(button.dataset.artist);
    }
  });

  elements.topSpotifyArtists.addEventListener("click", (event) => {
    const button = event.target.closest("[data-artist]");
    if (button) {
      renderArtistDetail(button.dataset.artist);
    }
  });

  elements.artistDetail.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-artist]");
    if (button) {
      elements.artistFilter.value = button.dataset.filterArtist;
      renderRows();
    }
  });

  elements.clearArtistButton.addEventListener("click", () => {
    renderArtistDetail();
  });
}

async function init() {
  let data = window.LIVE_LOG_DATA;
  if (!data) {
    const response = await fetch("data/lives.json");
    data = await response.json();
  }

  let artistProfiles = window.LIVE_LOG_ARTIST_PROFILES || {};
  if (!window.LIVE_LOG_ARTIST_PROFILES) {
    const response = await fetch("data/artist_profiles.json");
    artistProfiles = await response.json();
  }

  let spotifyArtistStats = window.LIVE_LOG_SPOTIFY_ARTIST_STATS || {};
  if (!window.LIVE_LOG_SPOTIFY_ARTIST_STATS) {
    const response = await fetch("data/spotify_artist_stats.json");
    spotifyArtistStats = await response.json();
  }

  state.lives = data.lives;
  state.facets = data.facets;
  state.summary = data.summary;
  state.artistProfiles = artistProfiles;
  state.spotifyArtistStats = spotifyArtistStats.artists || {};

  fillSelect(elements.yearFilter, state.facets.years);
  fillSelect(elements.artistFilter, state.facets.artists);
  fillSelect(elements.venueFilter, state.facets.venues);
  renderSummary();
  renderRanking(elements.topVenues, state.summary.topVenues);
  renderArtistRanking(elements.topArtists, state.summary.topArtists);
  renderSpotifyArtistRanking(elements.topSpotifyArtists, spotifyArtistStats.summary?.topArtists || []);
  renderVenueLinks(state.summary.topVenues);
  renderArtistDetail();
  bindEvents();
  renderRows();
}

init().catch((error) => {
  elements.liveRows.innerHTML = `<tr><td class="empty" colspan="5">データを読み込めませんでした</td></tr>`;
  console.error(error);
});
