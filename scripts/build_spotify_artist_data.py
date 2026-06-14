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


def normalize_text(value):
    if not value:
        return ""
    value = unicodedata.normalize("NFKC", value).casefold().strip()
    return re.sub(r"\s+", " ", value)


def load_alias_lookup():
    if not ALIAS_PATH.exists():
        return {}
    raw = json.loads(ALIAS_PATH.read_text(encoding="utf-8"))
    alias_lookup = {}
    for alias, canonical in raw.items():
        alias_norm = normalize_text(alias)
        canonical_norm = normalize_text(canonical)
        alias_lookup[alias_norm] = canonical_norm
        alias_lookup[alias_norm.replace(" ", "")] = canonical_norm
        alias_lookup[canonical_norm.replace(" ", "")] = canonical_norm
    return alias_lookup


def canonical_id(artist, alias_lookup):
    normalized = normalize_text(artist)
    return alias_lookup.get(normalized, normalized)


def parse_spotify_ts(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(JST)


def load_live_artist_targets(alias_lookup):
    with LIVE_CSV_PATH.open("r", encoding="utf-8-sig", newline="") as csv_file:
        rows = list(csv.DictReader(csv_file))

    targets = defaultdict(list)
    for row in rows:
        artist = (row.get("アーティスト名") or "").strip()
        if not artist:
            continue
        key = canonical_id(artist, alias_lookup)
        if artist not in targets[key]:
            targets[key].append(artist)
    return targets


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
    alias_lookup = load_alias_lookup()
    targets = load_live_artist_targets(alias_lookup)
    stats_by_artist = {
        display_name: empty_artist_stats(display_name)
        for names in targets.values()
        for display_name in names
    }

    for path in sorted(SPOTIFY_DIR.glob("Streaming_History_Audio_*.json")):
        items = json.loads(path.read_text(encoding="utf-8"))
        for item in items:
            artist = item.get("master_metadata_album_artist_name")
            track = item.get("master_metadata_track_name")
            if not artist or not track:
                continue

            key = canonical_id(artist, alias_lookup)
            if key not in targets:
                continue

            ts = parse_spotify_ts(item["ts"])
            ms_played = item.get("ms_played") or 0
            for display_name in targets[key]:
                update_artist_stats(
                    stats_by_artist[display_name],
                    track=track,
                    ts=ts,
                    ms_played=ms_played,
                )

    artists = {
        name: serialize_artist_stats(stats)
        for name, stats in sorted(stats_by_artist.items())
        if stats["plays"] > 0
    }

    total_plays = sum(stats["plays"] for stats in artists.values())
    total_known_ms = sum(stats["knownMs"] for stats in artists.values())

    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "source": SPOTIFY_DIR.name,
        "summary": {
            "matchedArtists": len(artists),
            "plays": total_plays,
            "knownMs": total_known_ms,
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
print(f"Wrote {OUTPUT_PATH} ({payload['summary']['matchedArtists']} matched artists)")
