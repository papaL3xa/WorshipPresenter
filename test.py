import csv
with open('/home/sagala/pisgahbisdac/PB/frontend/public/data/SDAH_Hymnal.tsv') as f:
    r = csv.reader(f, delimiter='\t')
    for row in r:
        if row[0] == 'SDAH_3':
            print("Segment 1:")
            print(repr(row[4]))
            print("Segment 2:")
            print(repr(row[5]))
            break
