"""Draws the Ops Room home-screen icon: a premium 3D world globe with glowing news routes,
a HUD ring with radar sweep and a red LIVE dot. Run by the GitHub workflow; output only changes if this file does."""
import json, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
# world outlines already projected onto the globe
G=json.load(open("icon-geo.json")); S,R,cx,cy=G["S"],G["R"],G["cx"],G["cy"]
def layer(): return Image.new("RGBA",(S,S),(0,0,0,0))
def radial(c0,c1,center,rad):
    im=Image.new("RGBA",(S,S)); px=im.load()
    small=Image.new("RGBA",(256,256)); sp=small.load()
    for y in range(256):
        for x in range(256):
            X,Y=x*S/256,y*S/256; k=min(1,math.hypot(X-center[0],Y-center[1])/rad)
            sp[x,y]=tuple(int(c0[i]+(c1[i]-c0[i])*k) for i in range(4))
    return small.resize((S,S),Image.BICUBIC)
# background: deep midnight blue to black, soft vignette
bg=radial((16,30,58,255),(2,4,10,255),(cx,cy*0.92),S*0.78)
# atmosphere glow
atm=layer(); ImageDraw.Draw(atm).ellipse([cx-R-70,cy-R-70,cx+R+70,cy+R+70],fill=(40,120,255,150))
bg=Image.alpha_composite(bg,atm.filter(ImageFilter.GaussianBlur(90)))
# ocean sphere with lit side
sphere_mask=Image.new("L",(S,S),0); ImageDraw.Draw(sphere_mask).ellipse([cx-R,cy-R,cx+R,cy+R],fill=255)
ocean=radial((26,52,92,255),(4,9,20,255),(cx-R*0.38,cy-R*0.42),R*1.55)
globe=layer(); globe.paste(ocean,(0,0),sphere_mask)
d=ImageDraw.Draw(globe)
for ring in G["grat"]:
    if len(ring)>1: d.line([tuple(p) for p in ring],fill=(110,160,230,40),width=3)
landL=layer(); ld=ImageDraw.Draw(landL)
for ring in G["land"]:
    if len(ring)>2: ld.polygon([tuple(p) for p in ring],fill=(52,78,112,255))
for ring in G["borders"]:
    if len(ring)>1: ld.line([tuple(p) for p in ring],fill=(120,160,205,110),width=3)
for ring in G["land"]:
    if len(ring)>1: ld.line([tuple(p) for p in ring]+[tuple(ring[0])],fill=(150,195,245,170),width=3)
globe=Image.alpha_composite(globe,landL)
# 3D shading: specular highlight + dark limb
hl=radial((255,255,255,70),(255,255,255,0),(cx-R*0.35,cy-R*0.4),R*0.9)
shade=radial((0,0,0,0),(0,0,0,0),(cx,cy),R)  # placeholder
limb=layer(); lp=ImageDraw.Draw(limb)
for i in range(40):
    k=i/40; r=R*(1-k*0.35); a=int(170*(1-k)**2.2)
    lp.ellipse([cx-r,cy-r,cx+r,cy+r],outline=(0,3,12,a),width=int(R*0.012)+2)
limb=limb.filter(ImageFilter.GaussianBlur(14))
sh=Image.alpha_composite(hl,limb); globe=Image.alpha_composite(globe,Image.composite(sh,layer(),sphere_mask))
globe.putalpha(ImageChops.multiply(globe.getchannel("A"),sphere_mask))
img=Image.alpha_composite(bg,globe)
# rim light
rim=layer(); ImageDraw.Draw(rim).arc([cx-R,cy-R,cx+R,cy+R],120,330,fill=(120,190,255,230),width=7)
img=Image.alpha_composite(img,rim.filter(ImageFilter.GaussianBlur(3)))
# glowing news arcs between world cities
arcL=layer(); ad=ImageDraw.Draw(arcL)
segs=[]
for a in G["arcs"]:
    seg=[]
    for p in a:
        if p: seg.append(tuple(p))
        elif seg: segs.append(seg); seg=[]
    if seg: segs.append(seg)
for s in segs:
    if len(s)>1: ad.line(s,fill=(70,230,255,255),width=9,joint="curve")
glowA=arcL.filter(ImageFilter.GaussianBlur(16))
img=Image.alpha_composite(img,glowA); img=Image.alpha_composite(img,glowA)
core=layer(); cd=ImageDraw.Draw(core)
for s in segs:
    if len(s)>1: cd.line(s,fill=(225,250,255,255),width=4,joint="curve")
img=Image.alpha_composite(img,core)
# city nodes
nd=layer(); ndd=ImageDraw.Draw(nd)
for x,y in G["dots"]:
    ndd.ellipse([x-26,y-26,x+26,y+26],fill=(90,235,255,140))
img=Image.alpha_composite(img,nd.filter(ImageFilter.GaussianBlur(10)))
dd=ImageDraw.Draw(img)
for x,y in G["dots"]: dd.ellipse([x-11,y-11,x+11,y+11],fill=(255,255,255,255))
# HUD ring: thin ring, ticks, bright sweep arc
hud=layer(); hd=ImageDraw.Draw(hud); rr=R+95
hd.ellipse([cx-rr,cy-rr,cx+rr,cy+rr],outline=(160,200,255,70),width=4)
for i in range(72):
    a=math.radians(i*5); L=34 if i%6==0 else 14
    hd.line([cx+math.cos(a)*rr,cy+math.sin(a)*rr,cx+math.cos(a)*(rr+L),cy+math.sin(a)*(rr+L)],fill=(170,210,255,150 if i%6==0 else 70),width=5 if i%6==0 else 3)
img=Image.alpha_composite(img,hud)
sw=layer(); ImageDraw.Draw(sw).arc([cx-rr,cy-rr,cx+rr,cy+rr],-62,-8,fill=(80,225,255,255),width=14)
img=Image.alpha_composite(img,sw.filter(ImageFilter.GaussianBlur(12))); img=Image.alpha_composite(img,sw)
# red LIVE pip at the end of the sweep
a=math.radians(-8); px,py=cx+math.cos(a)*rr,cy+math.sin(a)*rr
pip=layer(); ImageDraw.Draw(pip).ellipse([px-70,py-70,px+70,py+70],fill=(255,45,70,190))
img=Image.alpha_composite(img,pip.filter(ImageFilter.GaussianBlur(30)))
dd=ImageDraw.Draw(img); dd.ellipse([px-30,py-30,px+30,py+30],fill=(255,52,74,255)); dd.ellipse([px-12,py-12,px+12,py+12],fill=(255,220,225,255))
out=img.convert("RGB")
for s in (512,192,180): out.resize((s,s),Image.LANCZOS).save(f"icon-{s}.png", optimize=True)
