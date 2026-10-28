// Projects the world map onto the icon globe (used by make_icons.py). Run: node make_icon_geo.js > icon-geo.json
const d3=require('d3'),t=require('topojson-client'),w=require('world-atlas/countries-110m.json');
const S=2048, R=700, cx=S/2, cy=S/2;
const proj=d3.geoOrthographic().rotate([-15,-18,0]).translate([cx,cy]).scale(R).clipAngle(90).precision(0.2);
function rings(obj){ const out=[]; let cur=null; const ctx={moveTo(x,y){cur=[[x,y]];out.push(cur)},lineTo(x,y){cur.push([x,y])},closePath(){},arc(){}}; d3.geoPath(proj,ctx)(obj); return out; }
const C={ny:[-74,40.7],lon:[-0.1,51.5],dxb:[55.3,25.2],lag:[3.4,6.5],sao:[-46.6,-23.5],mos:[37.6,55.8],cai:[31.2,30],jnb:[28,-26.2],bom:[72.8,19],rey:[-21.9,64.1]};
const pairs=[["ny","lon"],["lon","dxb"],["dxb","bom"],["lag","sao"],["lon","mos"],["cai","jnb"],["ny","sao"],["mos","dxb"]];
const arcs=pairs.map(([a,b])=>{const ip=d3.geoInterpolate(C[a],C[b]);const pts=[];for(let i=0;i<=80;i++){const p=ip(i/80);const c=d3.geoDistance(p,[15,18])<Math.PI/2-0.02;pts.push(c?proj(p):null);}
  // lift the arc off the surface toward the viewer for depth
  return pts.map((p,i)=>p?[cx+(p[0]-cx)*(1+0.10*Math.sin(Math.PI*i/80)),cy+(p[1]-cy)*(1+0.10*Math.sin(Math.PI*i/80))]:null);});
const dots=Object.values(C).filter(p=>d3.geoDistance(p,[15,18])<Math.PI/2-0.05).map(p=>proj(p));
console.log(JSON.stringify({S,R,cx,cy,land:rings(t.merge(w,w.objects.countries.geometries)),
  borders:rings(t.mesh(w,w.objects.countries,(a,b)=>a!==b)),grat:rings(d3.geoGraticule().step([15,15])()),arcs,dots}));
