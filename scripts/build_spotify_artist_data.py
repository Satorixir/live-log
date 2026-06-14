import csv
import json
import os
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path


REPO_DIR = Path(__file__).resolve().parents[1]
DEFAULT_LIVE_CSV_PATH = Path(
    "/Users/satorunagasawa/Library/CloudStorage/"
    "GoogleDrive-satoru.nagasawa1220@gmail.com/"
    "マイドライブ/#Lifelogging/Live Log/"
    "Live記録 310f761cd0b980718203f48524874968_all.csv"
)
DEFAULT_SPOTIFY_DIR = REPO_DIR.parent / "spotify-log" / "Spotify Extended Streaming History"
DEFAULT_ALIAS_PATH = REPO_DIR.parent / "spotify-log" / "music_artist_aliases.json"

LIVE_CSV_PATH = Path(os.environ.get("LIVE_LOG_CSV", DEFAULT_LIVE_CSV_PATH)).expanduser()
SPOTIFY_DIR = Path(os.environ.get("SPOTIFY_HISTORY_DIR", DEFAULT_SPOTIFY_DIR)).expanduser()
ALIAS_PATH = Path(os.environ.get("SPOTIFY_ARTIST_ALIASES", DEFAULT_ALIAS_PATH)).expanduser()
OUTPUT_PATH = REPO_DIR / "data" / "spotify_artist_stats.json"
SCRIPT_OUTPUT_PATH = REPO_DIR / "data" / "spotify_artist_stats.js"
JST = timezone(timedelta(hours=9))
TOP_SPOTIFY_ARTIST_LIMIT = 120


def normalize_text(value):
    if not value:
        return ""
    value = unicodedata.normalize("NFKC", value).casefold().strip()
    return re.sub(r"\s+", " ", value)


def has_japanese(text):
    return bool(re.search(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]", text))


def load_alias_data():
    if not ALIAS_PATH.exists():
        return {}, {}
    raw = json.loads(ALIAS_PATH.read_text(encoding="utf-8"))
    alias_lookup = {}
    display_lookup = {}
    for alias, canonical in raw.items():
        alias_norm = normalize_text(alias)
        canonical_norm = normalize_text(canonical)
        alias_lookup[alias_norm] = canonical_norm
        alias_lookup[alias_norm.replace(" ", "")] = canonical_norm
        alias_lookup[canonical_norm.replace(" ", "")] = canonical_norm

        current_display = display_lookup.get(canonical_norm)
        if current_display is None:
            display_lookup[canonical_norm] = canonical
            current_display = canonical

        if has_japanese(alias) and not has_japanese(current_display):
            display_lookup[canonical_norm] = alias
        elif has_japanese(canonical) and not has_japanese(current_display):
            display_lookup[canonical_norm] = canonical

    return alias_lookup, display_lookup


def canonical_id(artist, alias_lookup):
    normalized = normalize_text(artist)
    return alias_lookup.get(normalized) or alias_lookup.get(normalized.replace(" ", "")) or normalized


def parse_spotify_ts(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(JST)


def load_live_artist_display_names(alias_lookup):
    with LIVE_CSV_PATH.open("r", encoding="utf-8-sig", newline="") as csv_file:
        rows = list(csv.DictReader(csv_file))

    display_names = {}
    for row in rows:
        artist = (row.get("アーティスト名") or "").strip()
        if not artist:
            continue
        key = canonical_id(artist, alias_lookup)
        display_names.setdefault(key, artist)
    return display_names


def empty_artist_stats(display_name):
    return {
        "artist": display_name,
        "plays": 0,
        "knownMs": 0,
        "firstPlayedAt": None,
        "latestPlayedAt": None,
        "topTracks": Counter(),
        "topTrackMs": Counter(),
        "years": Counter(),
    }


def update_artist_stats(stats, *, track, ts, ms_played):
    stats["plays"] += 1
    stats["knownMs"] += ms_played or 0
    stats["topTracks"][track] += 1
    stats["topTrackMs"][track] += ms_played or 0
    stats["years"][str(ts.year)] += 1

    date = ts.strftime("%Y/%m/%d")
    if stats["firstPlayedAt"] is None or date < stats["firstPlayedAt"]:
        stats["firstPlayedAt"] = date
    if stats["latestPlayedAt"] is None or date > stats["latestPlayedAt"]:
        stats["latestPlayedAt"] = date


def serialize_artist_stats(stats):
    top_tracks = []
    for track, plays in stats["topTracks"].most_common(5):
        top_tracks.append(
            {
                "name": track,
                "plays": plays,
                "knownMs": stats["topTrackMs"][track],
            }
        )

    return {
        "plays": stats["plays"],
        "knownMs": stats["knownMs"],
        "firstPlayedAt": stats["firstPlayedAt"],
        "latestPlayedAt": stats["latestPlayedAt"],
        "topTracks": top_tracks,
        "years": [
            {"year": year, "plays": plays}
            for year, plays in sorted(stats["years"].items())
        ],
    }


def build_payload():
    alias_lookup, display_lookup = load_alias_data()
    live_display_names = load_live_artist_display_names(alias_lookup)
    stats_by_key = {}

    for path in sorted(SPOTIFY_DIR.glob("Streaming_History_Audio_*.json")):
        items = json.loads(path.read_text(encoding="utf-8"))
        for item in items:
            artist = item.get("master_metadata_album_artist_name")
            track = item.get("master_metadata_track_name")
            if not artist or not track:
                continue

            key = canonical_id(artist, alias_lookup)
            display_name = live_display_names.get(key) or display_lookup.get(key) or artist
            ts = parse_spotify_ts(item["ts"])
            ms_played = item.get("ms_played") or 0
            stats = stats_by_key.setdefault(key, empty_artist_stats(display_name))
            stats["artist"] = live_display_names.get(key) or stats["artist"]
            update_artist_stats(
                stats,
                track=track,
                ts=ts,
                ms_played=ms_played,
            )

    ranked_stats = sorted(
        (stats for stats in stats_by_key.values() if stats["plays"] > 0),
        key=lambda item: (-item["plays"], item["artist"].casefold()),
    )
    live_artist_names = set(live_display_names.values())
    kept_artist_names = {
        stats["artist"]
        for stats in ranked_stats[:TOP_SPOTIFY_ARTIST_LIMIT]
    } | live_artist_names
    kept_stats = [
        stats
        for stats in ranked_stats
        if stats["artist"] in kept_artist_names
    ]
    artists = {
        stats["artist"]: serialize_artist_stats(stats)
        for stats in sorted(kept_stats, key=lambda item: item["artist"].casefold())
    }

    total_plays = sum(stats["plays"] for stats in artists.values())
    total_known_ms = sum(stats["knownMs"] for stats in artists.values())
    top_artists = sorted(
        (
            {"name": name, "plays": stats["plays"], "knownMs": stats["knownMs"]}
            for name, stats in artists.items()
        ),
        key=lambda item: (-item["plays"], item["name"].casefold()),
    )[:12]

    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "source": SPOTIFY_DIR.name,
        "summary": {
            "artists": len(artists),
            "totalSpotifyArtists": len(ranked_stats),
            "plays": total_plays,
            "knownMs": total_known_ms,
            "topArtists": top_artists,
        },
        "artists": artists,
    }


payload = build_payload()
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
json_text = json.dumps(payload, ensure_ascii=False, indent=2)
OUTPUT_PATH.write_text(json_text + "\n", encoding="utf-8")
SCRIPT_OUTPUT_PATH.write_text(
    "window.LIVE_LOG_SPOTIFY_ARTIST_STATS = " + json_text + ";\n",
    encoding="utf-8",
)
print(f"Wrote {OUTPUT_PATH} ({payload['summary']['artists']} artists)")
