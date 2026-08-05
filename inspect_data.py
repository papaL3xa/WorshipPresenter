import sqlite3
c = sqlite3.connect('frontend/scripts/kjv.sqlite3')
print("Verses sample:")
for row in c.execute("SELECT * FROM verses LIMIT 5"):
    print(row)
print("Books sample:")
for row in c.execute("SELECT * FROM books LIMIT 5"):
    print(row)
