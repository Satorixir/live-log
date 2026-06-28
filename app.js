const state = {
  lives: [],
  facets: {},
  summary: {},
  spotifySummary: {},
  artistProfiles: {},
  spotifyArtistStats: {},
  selectedArtist: "",
  defaultArtist: "",
};

const elements = {
  totalCount: document.querySelector("#totalCount"),
  yearRange: document.querySelector("#yearRange"),
  spotifyPlayCount: document.querySelector("#spotifyPlayCount"),
  spotifyHourCount: document.querySelector("#spotifyHourCount"),
  resultCount: document.querySelector("#resultCount"),
  searchInput: document.querySelector("#searchInput"),
  yearFilter: document.querySelector("#yearFilter"),
  artistFilter: document.querySelector("#artistFilter"),
  venueFilter: document.querySelector("#venueFilter"),
  resetButton: document.querySelector("#resetButton"),
  liveRows: document.querySelector("#liveRows"),
  topArtists: document.querySelector("#topArtists"),
  topSpotifyArtists: document.querySelector("#topSpotifyArtists"),
  topSpotifyTracks: document.querySelector("#topSpotifyTracks"),
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
  const { total, firstDate, latestDate } = state.summary;
  const plays = state.spotifySummary.plays || 0;
  const hours = Number(listeningHours(state.spotifySummary.knownMs || 0));
  elements.totalCount.textContent = total ?? "-";
  elements.yearRange.textContent =
    firstDate && latestDate ? `${firstDate.slice(0, 4)}-${latestDate.slice(0, 4)}` : "-";
  elements.spotifyPlayCount.textContent = plays ? plays.toLocaleString() : "-";
  elements.spotifyHourCount.textContent = hours ? `${hours.toLocaleString()}h` : "-";
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
  if (!rows.length) {
    target.innerHTML = `<li class="muted">Spotifyの集計データを読み込めませんでした</li>`;
    return;
  }

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

function renderSpotifyTrackRanking(target, rows) {
  if (!rows.length) {
    target.innerHTML = `<li class="muted">Spotifyの曲データを読み込めませんでした</li>`;
    return;
  }

  target.innerHTML = rows
    .map(
      (row) => `
        <li>
          <button class="inline-button" type="button" data-artist="${escapeHtml(row.artist)}">
            ${escapeHtml(row.name)}
            <small>${escapeHtml(row.artist)}</small>
          </button>
          <span>${row.plays.toLocaleString()}回</span>
        </li>
      `
    )
    .join("");
}

function getTopSpotifyArtists(stats) {
  if (stats.summary?.topArtists?.length) {
    return stats.summary.topArtists;
  }

  return Object.entries(stats.artists || {})
    .map(([name, artist]) => ({
      name,
      plays: artist.streaming?.plays || 0,
    }))
    .filter((artist) => artist.plays > 0)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);
}

function getTopSpotifyTracks(stats) {
  return Object.entries(stats.artists || {})
    .flatMap(([artist, artistStats]) =>
      (artistStats.topTracks || []).map((track) => ({
        artist,
        name: track.name,
        plays: track.plays || 0,
        knownMs: track.knownMs || 0,
      }))
    )
    .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name, "ja"))
    .slice(0, 10);
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
  const place =
    live.place && live.place !== live.venue
      ? `<small class="venue-place">${escapeHtml(live.place)}</small>`
      : "";
  if (!query || query === "?") {
    return `<span class="venue-name">${label}</span>${place}`;
  }
  return `<a class="venue-link" href="${mapUrl(live)}" target="_blank" rel="noreferrer">${label}</a>${place}`;
}

function dateCell(date) {
  const [year = "-", month = "-", day = "-"] = String(date || "").split("/");
  return `
    <time datetime="${escapeHtml(String(date || "").replaceAll("/", "-"))}">
      <span>${escapeHtml(year)}</span>
      <strong>${escapeHtml(month)}/${escapeHtml(day)}</strong>
    </time>
  `;
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
        <tr class="${live.note?.includes("参加できず") ? "is-missed" : ""}">
          <td class="date">${dateCell(live.date)}</td>
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

function renderLiveTimeline(rows) {
  if (!rows.length) {
    return `<p class="muted">ライブ履歴はまだありません</p>`;
  }
  return `<ol class="mini-timeline">${renderMiniTimeline(rows)}</ol>`;
}

function renderArtistDetail(name) {
  const artist = name || state.defaultArtist || state.summary.topArtists?.[0]?.[0] || "";
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
  const first = rows.at(-1)?.date || "-";
  const latest = rows[0]?.date || "-";
  const officialUrl = profile.officialUrl || rows.find((live) => live.artistUrl)?.artistUrl || "";
  const spotifyPlays = spotifyStats?.plays || 0;
  const trackCount = spotifyStats?.topTracks?.length || 0;

  elements.artistDetailTitle.textContent = artist;
  elements.clearArtistButton.hidden = artist === state.defaultArtist;
  elements.artistDetail.innerHTML = `
    ${renderTagList(profile.tags)}
    ${profile.memo ? `<p class="artist-memo">${escapeHtml(profile.memo)}</p>` : ""}
    <dl class="artist-stats artist-overview-stats">
      <div>
        <dt>ライブ</dt>
        <dd>${rows.length}回</dd>
      </div>
      <div>
        <dt>Spotify</dt>
        <dd>${spotifyPlays ? spotifyPlays.toLocaleString() : "-"}回</dd>
      </div>
      <div>
        <dt>聴取時間</dt>
        <dd>${spotifyStats ? `${listeningHours(spotifyStats.knownMs)}h` : "-"}</dd>
      </div>
      <div>
        <dt>曲</dt>
        <dd>${trackCount ? `${trackCount}曲` : "-"}</dd>
      </div>
      <div class="wide-stat">
        <dt>ライブ期間</dt>
        <dd>${escapeHtml(first)} - ${escapeHtml(latest)}</dd>
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

  elements.topSpotifyTracks.addEventListener("click", (event) => {
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

  let spotifyArtistStats = {};
  try {
    const response = await fetch("data/spotify_artist_stats.json?v=20260614-spotify-ranking-fallback");
    if (response.ok) {
      spotifyArtistStats = await response.json();
    }
  } catch (error) {
    spotifyArtistStats = window.LIVE_LOG_SPOTIFY_ARTIST_STATS || {};
  }
  if (!spotifyArtistStats.summary) {
    spotifyArtistStats = window.LIVE_LOG_SPOTIFY_ARTIST_STATS || {};
  }
  if (!spotifyArtistStats.summary && !Object.keys(spotifyArtistStats.artists || {}).length) {
    const response = await fetch("data/spotify_artist_stats.json");
    if (response.ok) {
      spotifyArtistStats = await response.json();
    }
  }

  state.lives = data.lives;
  state.facets = data.facets;
  state.summary = data.summary;
  state.spotifySummary = spotifyArtistStats.summary || {};
  state.artistProfiles = artistProfiles;
  state.spotifyArtistStats = spotifyArtistStats.artists || {};

  fillSelect(elements.yearFilter, state.facets.years);
  fillSelect(elements.artistFilter, state.facets.artists);
  fillSelect(elements.venueFilter, state.facets.venues);
  const topSpotifyArtists = getTopSpotifyArtists(spotifyArtistStats);
  state.defaultArtist = topSpotifyArtists[0]?.name || state.summary.topArtists?.[0]?.[0] || "";
  renderSummary();
  renderArtistRanking(elements.topArtists, state.summary.topArtists);
  renderSpotifyArtistRanking(elements.topSpotifyArtists, topSpotifyArtists);
  renderSpotifyTrackRanking(elements.topSpotifyTracks, getTopSpotifyTracks(spotifyArtistStats));
  renderArtistDetail();
  bindEvents();
  renderRows();
}

init().catch((error) => {
  elements.liveRows.innerHTML = `<tr><td class="empty" colspan="5">データを読み込めませんでした</td></tr>`;
  console.error(error);
});
