import urllib.request
content = urllib.request.urlopen('https://raw.githubusercontent.com/iCodeOkay/SoftProjector-SDAH/master/SDAH.sps').read().decode('utf-8-sig')
for line in content.splitlines():
    if 'God Himself Is With Us' in line:
        print(line)
