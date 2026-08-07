from PIL import Image

img = Image.open('icon.png')
size = max(img.size)
new_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
new_img.paste(img, ((size - img.size[0]) // 2, (size - img.size[1]) // 2))
new_img = new_img.resize((256, 256), Image.Resampling.LANCZOS)
new_img.save('icon_square.png')
