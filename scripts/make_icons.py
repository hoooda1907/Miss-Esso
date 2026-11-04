from PIL import Image
R = 'android/app/src/main/res'
im = Image.open('icon-512.png').convert('RGBA')
for n, s in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    for f in ('ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground'):
        im.resize((s, s), Image.LANCZOS).save(f'{R}/mipmap-{n}/{f}.png')
print('icons ok')
