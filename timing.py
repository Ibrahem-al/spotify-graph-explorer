import time
import random
from neo4j import GraphDatabase

random.seed(42)

# connection
URI      = "bolt://localhost:7687"
AUTH     = ("neo4j", "12345678")
DB_NAME  = "neo4j"

driver = GraphDatabase.driver(URI, auth=AUTH)

# quries
tasks = [
    {
        "id": 1,
        "title": "Highly Popular Tracks",
        "query": """
            MATCH (t:Track)
            WHERE t.popularity > 80
            RETURN t.track_name AS track_name, t.popularity AS popularity
            ORDER BY t.popularity DESC
            LIMIT 20
        """,
    },
    {
        "id": 2,
        "title": "Tracks with 'Love' or 'Dream' in the Title",
        "query": """
            MATCH (t:Track)
            WHERE toLower(t.track_name) CONTAINS 'love'
               OR toLower(t.track_name) CONTAINS 'dream'
            RETURN t.track_name AS track_name, t.popularity AS popularity
            ORDER BY t.popularity DESC
            LIMIT 50
        """,
    },
    {
        "id": 3,
        "title": "Tracks by Taylor Swift",
        "query": """
            MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist {name: 'Taylor Swift'})
            RETURN t.track_name AS track_name, t.popularity AS popularity
            ORDER BY t.popularity DESC
        """,
    },
    {
        "id": 4,
        "title": "Upbeat and Happy Tracks",
        "query": """
            MATCH (t:Track)
            WHERE t.danceability > 0.7
              AND t.valence > 0.7
              AND t.popularity > 60
            RETURN t.track_name   AS track_name,
                   t.popularity   AS popularity,
                   t.danceability AS danceability,
                   t.valence      AS valence
            ORDER BY t.popularity DESC
        """,
    },
    {
        "id": 5,
        "title": "Update Artist Name (Jason Mraz → Jason M.)",
        "query": """
            MATCH (a:Artist {name: 'Jason Mraz'})
            SET a.name = 'Jason M.'
            RETURN a.name
        """,
        "reset_query": """
            MATCH (a:Artist {name: 'Jason M.'})
            SET a.name = 'Jason Mraz'
        """,
    },
    {
        "id": 6,
        "title": "Average Track Popularity by Genre",
        "query": """
            MATCH (t:Track)-[:HAS_GENRE]->(g:Genre)
            RETURN g.name AS genre, avg(t.popularity) AS avg_popularity
            ORDER BY avg_popularity DESC
        """,
    },
    {
        "id": 7,
        "title": "Genre-Wise Track Counts",
        "query": """
            MATCH (t:Track)-[:HAS_GENRE]->(g:Genre)
            RETURN g.name AS genre, count(t) AS track_count
            ORDER BY track_count DESC
            LIMIT 10
        """,
    },
]

RUNS = 10

# timing loop
with driver.session(database=DB_NAME) as session:
    for task in tasks:
        print(f"\n{'='*60}")
        print(f"Task {task['id']}: {task['title']}")
        print('='*60)

        times = []
        for i in range(RUNS):
            # Reset artist name before each run of Task 5
            if task.get("reset_query"):
                session.run(task["reset_query"])

            start = time.perf_counter()
            session.run(task["query"]).data()
            end   = time.perf_counter()

            run_time = end - start
            times.append(run_time)
            print(f"  Run {i+1:>2}: {run_time:.6f} seconds")

        avg = sum(times) / len(times)
        print(f"\n  Average execution time: {avg:.6f} seconds")

driver.close()
print("\nDone.")
