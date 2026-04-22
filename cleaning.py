import pandas as pd

# ── 1. Load raw dataset ────────────────────────────────────────────────────────
df = pd.read_csv("dataset.csv")
print(f"Raw shape: {df.shape}")

# ── 2. Drop rows missing any critical field ────────────────────────────────────
critical_cols = [
    "track_id",
    "track_name",
    "artists",
    "album_name",
    "track_genre",
    "popularity",
    "danceability",
    "energy",
    "acousticness",
    "valence",
    "tempo",
]

df = df.dropna(subset=critical_cols).copy()
print(f"After dropping nulls: {df.shape}")
assert len(df) >= 20_000, "Fewer than 20,000 rows after cleaning — check the dataset."

# ── 3. Normalize artists field (semicolon-separated) ──────────────────────────
df["artists"] = df["artists"].astype(str).str.strip()

def normalize_artists(value):
    parts = [p.strip() for p in value.split(";")]
    parts = [p for p in parts if p]   # remove blanks
    return ";".join(parts)

df["artists"] = df["artists"].apply(normalize_artists)

# ── 4. Deduplicate by track_id (keep one genre per track) ─────────────────────
df_tracks = df[
    [
        "track_id",
        "track_name",
        "popularity",
        "danceability",
        "valence",
        "acousticness",
        "album_name",
        "track_genre",
        "artists",
    ]
].drop_duplicates(subset=["track_id"]).copy()

print(f"Unique tracks: {len(df_tracks)}")

# Pre-split artist lists once — used by both artists.csv and rel_performed_by.csv
df_tracks["artist_list"] = df_tracks["artists"].astype(str).str.split(";")

# ── 5. Node CSV files ──────────────────────────────────────────────────────────

# tracks.csv
df_tracks.drop(columns=["artist_list"]).to_csv("tracks.csv", index=False)
print("Wrote tracks.csv")

# artists.csv
all_artists = []
for sublist in df_tracks["artist_list"]:
    for artist in sublist:
        artist = artist.strip()
        if artist:
            all_artists.append(artist)

df_artists = pd.DataFrame(sorted(set(all_artists)), columns=["name"])
df_artists.to_csv("artists.csv", index=False)
print(f"Wrote artists.csv  ({len(df_artists)} artists)")

# albums.csv
df_albums = df_tracks[["album_name"]].drop_duplicates().copy()
df_albums["album_name"] = df_albums["album_name"].astype(str).str.strip()
df_albums = df_albums[df_albums["album_name"] != ""]
df_albums.rename(columns={"album_name": "name"}, inplace=True)
df_albums.to_csv("albums.csv", index=False)
print(f"Wrote albums.csv  ({len(df_albums)} albums)")

# genres.csv
df_genres = df_tracks[["track_genre"]].drop_duplicates().copy()
df_genres["track_genre"] = df_genres["track_genre"].astype(str).str.strip()
df_genres = df_genres[df_genres["track_genre"] != ""]
df_genres.rename(columns={"track_genre": "name"}, inplace=True)
df_genres.to_csv("genres.csv", index=False)
print(f"Wrote genres.csv  ({len(df_genres)} genres)")

# ── 6. Relationship CSV files ──────────────────────────────────────────────────

# rel_performed_by.csv  (track_id → artist_name)
performed_rows = []
for _, row in df_tracks.iterrows():
    for artist in row["artist_list"]:
        artist = artist.strip()
        if artist:
            performed_rows.append({"track_id": row["track_id"], "artist_name": artist})

df_performed_by = pd.DataFrame(performed_rows).drop_duplicates()
df_performed_by.to_csv("rel_performed_by.csv", index=False)
print(f"Wrote rel_performed_by.csv  ({len(df_performed_by)} rows)")

# rel_belongs_to.csv  (track_id → album_name)
df_belongs_to = df_tracks[["track_id", "album_name"]].drop_duplicates().copy()
df_belongs_to["album_name"] = df_belongs_to["album_name"].astype(str).str.strip()
df_belongs_to = df_belongs_to[df_belongs_to["album_name"] != ""]
df_belongs_to.to_csv("rel_belongs_to.csv", index=False)
print(f"Wrote rel_belongs_to.csv  ({len(df_belongs_to)} rows)")

# rel_has_genre.csv  (track_id → track_genre)
df_has_genre = df_tracks[["track_id", "track_genre"]].drop_duplicates().copy()
df_has_genre["track_genre"] = df_has_genre["track_genre"].astype(str).str.strip()
df_has_genre = df_has_genre[df_has_genre["track_genre"] != ""]
df_has_genre.to_csv("rel_has_genre.csv", index=False)
print(f"Wrote rel_has_genre.csv  ({len(df_has_genre)} rows)")

print("\nAll 7 CSV files generated successfully.")