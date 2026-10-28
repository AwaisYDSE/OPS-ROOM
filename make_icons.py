# Draws the Ops Room home-screen icons (run once by the GitHub workflow)
from PIL import Image, ImageDraw, ImageFilter
import math
S=1024
im=Image.new("RGB",(S,S),(0,0,0))
glow=Image.new("RGB",(S,S),(0,0,0)); gd=ImageDraw.Draw(glow)
cx,cy,r=S/2,S/2+10,330
gd.ellipse([cx-r-40,cy-r-40,cx+r+40,cy+r+40],fill=(150,10,20))
glow=glow.filter(ImageFilter.GaussianBlur(70)); im=Image.blend(im,glow,0.9)
d=ImageDraw.Draw(im)
d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=(8,12,18))
for k in range(-2,3):
    w=r*abs(math.sin(k*math.pi/6))
    d.ellipse([cx-w,cy-r,cx+w,cy+r],outline=(70,90,110),width=6)
for lat in (-60,-30,0,30,60):
    y=cy-r*math.sin(math.radians(lat)); half=r*math.cos(math.radians(lat))
    d.line([cx-half,y,cx+half,y],fill=(70,90,110),width=6)
d.ellipse([cx-r,cy-r,cx+r,cy+r],outline=(255,51,65),width=16)
d.pieslice([cx-r,cy-r,cx+r,cy+r],-80,-35,fill=(255,51,65))
d.line([cx,cy,cx+r*math.cos(math.radians(-35)),cy+r*math.sin(math.radians(-35))],fill=(255,255,255),width=10)
px,py=cx+150,cy-90
d.ellipse([px-26,py-26,px+26,py+26],fill=(255,255,255))
d.ellipse([px-60,py-60,px+60,py+60],outline=(255,255,255),width=6)
for s in (512,192,180):
    im.resize((s,s),Image.LANCZOS).save(f"icon-{s}.png")
