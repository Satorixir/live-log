import csv
import json
from collections import Counter
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
CSV_PATH = BASE_DIR / "Live記録 310f761cd0b980718203f48524874968_all.csv"
OUTPUT_PATH = BASE_DIR / "site" / "data" / "lives.json"
SCRIPT_OUTPUT_PATH = BASE_DIR / "site" / "data" / "lives.js"
ARTIST_LINKS_PATH = BASE_DIR / "site" / "data" / "artist_links.json"


def clean(value):
    return (value or "").strip()


def parse_date(value):
    try:
        return datetime.strptime(clean(value), "%Y/%m/%d")
    except ValueError:
        return datetime.min


def yen_number(value):
    digits = "".join(ch for ch in clean(value) if ch.isdigit())
    return int(digits) if digits else None


with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as csv_file:
    rows = list(csv.DictReader(csv_file))

artist_links = {}
if ARTIST_LINKS_PATH.exists():
    artist_links = json.loads(ARTIST_LINKS_PATH.read_text(encoding="utf-8"))

lives = []
for row in rows:
    played_at = clean(row.get("開演日時"))
    parsed = parse_date(played_at)
    artist = clean(row.get("アーティスト名"))
    venue = clean(row.get("会場名"))
    place = clean(row.get("Place"))
    note = clean(row.get("備考"))
    ticket_price = clean(row.get("チケット代金"))

    map_parts = [venue]
    if place and place != venue:
        map_parts.append(place)

    lives.append(
        {
            "date": played_at,
            "year": parsed.year if parsed != datetime.min else None,
            "artist": artist,
            "artistUrl": artist_links.get(artist, ""),
            "venue": venue,
            "ticketPrice": ticket_price,
            "ticketPriceValue": yen_number(ticket_price),
            "place": place,
            "note": note,
            "mapQuery": " ".join(map_parts),
        }
    )

lives.sort(key=lambda item: (item["date"], item["artist"]), reverse=True)

years = sorted({item["year"] for item in lives if item["year"]}, reverse=True)
artists = sorted({item["artist"] for item in lives if item["artist"]}, key=str.casefold)
venues = sorted({item["venue"] for item in lives if item["venue"]}, key=str.casefold)
venue_counts = Counter(item["venue"] for item in lives if item["venue"])
artist_counts = Counter(item["artist"] for item in lives if item["artist"])

payload = {
    "generatedAt": datetime.now().isoformat(timespec="seconds"),
    "source": CSV_PATH.name,
    "lives": lives,
    "facets": {
        "years": years,
        "artists": artists,
        "venues": venues,
    },
    "summary": {
        "total": len(lives),
        "firstDate": lives[-1]["date"] if lives else None,
        "latestDate": lives[0]["date"] if lives else None,
        "venueCount": len(venues),
        "artistCount": len(artists),
        "topVenues": venue_counts.most_common(8),
        "topArtists": artist_counts.most_common(8),
    },
}

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
json_text = json.dumps(payload, ensure_ascii=False, indent=2)
OUTPUT_PATH.write_text(json_text + "\n", encoding="utf-8")
SCRIPT_OUTPUT_PATH.write_text(
    "window.LIVE_LOG_DATA = " + json_text + ";\n",
    encoding="utf-8",
)
print(f"Wrote {OUTPUT_PATH} ({len(lives)} lives)")
