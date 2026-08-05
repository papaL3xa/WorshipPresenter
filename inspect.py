import sqlite3
c = sqlite3.connect('frontend/scripts/kjv.sqlite3')
for row in c.execute("SELECT name FROM sqlite_master WHERE type='table'"):
    table = row[0]
    print(f"Table: {table}")
    for col in c.execute(f"PRAGMA table_info({table})"):
        print(f"  {col}")
