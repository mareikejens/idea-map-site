// All distances are in the same world coordinates as the rail and the glass ball.
const MarbleRun = (() => {
  const clamp = (x,lo=0,hi=1) => Math.max(lo,Math.min(hi,x));
  const mix = (a,b,t) => a+(b-a)*t;
  const ease = t => t*t*(3-2*t);
  const rad = Math.PI/180;
  const radius = 19;
  const ends = [-115,150,550,710,1010,1330,1630,1810];
  // The opening never climbs. The marble starts high on a calm slope and creeps to the brink while the worry
  // builds. The acceleration belongs to the collapse scene: there it tips over the brink, plunges ever faster,
  // and the run gives way as it arrives.
  // The drop is tall and short: about 50° at its steepest, so the marble visibly races rather than rolls.
  const plungeHeight=150, plungeFrom=352, plungeTo=548, brink=345;
  // Scene 3 spends its first quarter on the plunge (about 0.7s); the break clock then starts just before the run lets go.
  const fall={start:.26,from:.22};
  const plunge = x => {const u=clamp((x-plungeFrom)/(plungeTo-plungeFrom));return u*u*(3-2*u)};
  const ground = x => 148+.055*x
    - plungeHeight*(1-plunge(x))
    + (x>=1480?58:0)
    - .055*Math.max(0,x-1630);
  const camera = {1:[45,143,680],2:[348,155,720],3:[730,248,1120],4:[730,248,1120],
    5:[650,222,740],6:[860,215,492],7:[1162,250,680],8:[1480,267,535],9:[1763,305,680]};
  const times = {1:2500,2:2200,3:1450,4:1500,5:1500,6:4400,7:2800,8:2200,9:3800};
  function railPath(a,b){
    const points=[];
    for(let x=a;x<b;x+=4)points.push([x,ground(x)]);
    points.push([b,ground(b)]);
    return points.map(([x,y],i)=>(i?'L':'M')+x+' '+y.toFixed(2)).join(' ');
  }
  function rail(a,b){
    const d=railPath(a,b);
    // The same concave ceramic profile is used on every section and moving leaf.
    const layers=[[9,15,'#d4c3ae'],[6,19,'#e3d5c2'],[2,20,'#fcf7ef'],[-2,14,'#e0d3c3'],[-4,9,'#ede3d5'],[-5,3,'#fffaf3'],[5,3,'#fffdf7']];
    return '<g fill="none" stroke-linecap="round" stroke-linejoin="round">'+layers.map(([dy,w,c])=>'<path d="'+d+'" transform="translate(0 '+dy+')" stroke="'+c+'" stroke-width="'+w+'"/>').join('')+'</g>';

  }
  const foot=(x)=>'<ellipse cx="'+(x+3)+'" cy="342" rx="29" ry="4" fill="url(#shadow)"/><rect x="'+(x-5)+'" y="'+ground(x)+'" width="10" height="'+(341-ground(x))+'" rx="4" fill="url(#ash)"/>';
  const balanceX=1810,gateX=1169,gateY=ground(gateX)-81;
  const balanceY=ground(balanceX);
  const westBank=765,eastBank=955,bridgeCentre=(westBank+eastBank)/2;
  function leaf(id,bank,tip){
    const y=ground(bank),end=ground(tip);
    const brace='<path d="M'+bank+' '+(y+25)+' L'+tip+' '+(end+6)+' L'+bank+' '+(y+5)+'Z" fill="#d4b895"/>';
    return '<g id="'+id+'">'+brace+rail(Math.min(bank,tip),Math.max(bank,tip))+'</g>'+
      '<circle cx="'+bank+'" cy="'+y+'" r="6" fill="#c1a17f"/><circle cx="'+bank+'" cy="'+y+'" r="2" fill="#f4e6d4"/>';
  }
  // Worry, before anything breaks: hairline cracks run across the glazed rail where the marble is heading.
  // Each crack is one path that is drawn in from the top lip downwards (see app.js).
  const crackSites=[212,258,300,345,398,452,520,578];
  function crack(x,i){
    let seed=x*7+13;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-.5};
    const top=ground(x)-6;let px=x,d='M'+x+' '+top.toFixed(1),branch='';
    for(let k=1;k<=5;k++){
      px+=rand()*9;const at=px.toFixed(1)+' '+(top+k*4.3).toFixed(1);d+=' L'+at;
      if(k===2+i%2)branch=' M'+at+' l'+(rand()>0?7:-7)+' '+(3+rand()*3).toFixed(1)+' l'+(rand()*6).toFixed(1)+' 4';
    }
    return '<path class="crack" data-x="'+x+'" d="'+d+branch+'" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" opacity="0" fill="none" stroke="#7d6a55" stroke-width=".55" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  const cracks=(a,b)=>crackSites.map((x,i)=>x>a&&x<b?crack(x,i):'').join('');
  // The run shivers in gusts rather than buzzing: a slow swell over two fast, slightly different wobbles per section.
  function quake(i,phase,tremor){
    const a=tremor*(.3+.7*Math.max(0,Math.sin(phase*1.9+i*.4))**2);
    return [.5*a*Math.sin(phase*61+i*2.1),1.3*a*Math.sin(phase*74+i*1.3)];
  }
  const sections=[
    foot(-490)+foot(-190)+foot(12)+foot(344)+rail(-1100,548)+cracks(-1100,548),
    foot(609)+rail(551,708)+cracks(551,708),
    foot(westBank)+foot(eastBank)+rail(712,westBank)+rail(eastBank,1007)+leaf('bridgeLeft',westBank,bridgeCentre-1)+leaf('bridgeRight',eastBank,bridgeCentre+1),
    foot(1070)+foot(1280)+rail(1012,1328)+'<path d="M'+(gateX-7)+' '+(ground(gateX)+1)+' V'+gateY+'" stroke="#e1d1bc" stroke-width="8" stroke-linecap="round"/><g id="gate"><rect x="'+(gateX-4)+'" y="'+gateY+'" width="8" height="69" rx="4" fill="url(#ash)"/></g><circle cx="'+gateX+'" cy="'+gateY+'" r="5" fill="#c6a786"/>',
    foot(1363)+foot(1424)+rail(1332,1441)+foot(1496)+foot(1583)+rail(1480,1628),
    '<ellipse cx="1810" cy="341" rx="46" ry="5" fill="url(#shadow)"/><path d="M1781 340 L1805 '+(balanceY+12)+' Q1810 '+(balanceY+2)+' 1815 '+(balanceY+12)+' L1839 340Z" fill="url(#ash)"/><g id="balance">'+rail(1632,1988)+'<rect x="1985" y="'+(ground(1988)-34)+'" width="8" height="40" rx="4" fill="url(#ash)"/><circle cx="1810" cy="'+(balanceY+6)+'" r="4" fill="#ae967a"/></g>'

  ];
  // There is one blue marble in the story and only ever one in the picture. It cannot cross the open bridge, so at each
  // station after it (3 to 5) the same blue marble is fed into the run from above, and gets stuck there: the run does not
  // solve the problem for it. These are its three stand-ins. Each is only visible during its own scene.
  const mateCount=3;
  const mateArt=()=>Array.from({length:mateCount},(_,i)=>'<ellipse id="mateShadow'+i+'" rx="23" ry="4" fill="url(#shadow)"/>').join('')+
    Array.from({length:mateCount},(_,i)=>'<g id="mate'+i+'" style="opacity:0"><image href="assets/run-glass.webp" x="-19" y="-19" width="38" height="38" clip-path="url(#orb)"/></g>').join('');
  function art(){
    const explosion=typeof RunExplosion==='undefined'?require('./explosion.js'):RunExplosion;
    return '<defs><linearGradient id="ash"><stop stop-color="#cdb292"/><stop offset=".4" stop-color="#eddcc5"/><stop offset="1" stop-color="#d3b99a"/></linearGradient><radialGradient id="shadow"><stop stop-color="#77664e" stop-opacity=".27"/><stop offset="1" stop-color="#77664e" stop-opacity="0"/></radialGradient><g id="glass-at-impact"><image href="assets/run-glass.webp" x="-19" y="-19" width="38" height="38"/></g><clipPath id="orb"><circle r="19"/></clipPath></defs>'+
      sections.map((s,i)=>'<g id="part'+i+'">'+s+'</g>').join('')+
      mateArt()+'<circle id="halo" r="19" fill="none" stroke="#a32b36" stroke-width="1.4" opacity="0" vector-effect="non-scaling-stroke"/><ellipse id="contact" rx="23" ry="4" fill="url(#shadow)"/><g id="traveller"><image href="assets/run-glass.webp" x="-19" y="-19" width="38" height="38" clip-path="url(#orb)"/></g>'+
      explosion.art();
  }
  // Integrate travel time along the dipped rail from gravitational potential.
  function timedRail(a,b,push=125){
    let time=0;const points=[[0,a]],initial=ground(a);
    for(let x=a+1;x<=b;x++){
      const dy=ground(x)-ground(x-1);
      time+=Math.hypot(1,dy)/Math.sqrt(push**2+2*410*Math.max(-10,ground(x)-initial));
      points.push([time,x]);
    }
    return f=>{const t=f*time;let lo=0,hi=points.length-1;
      while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid][0]<t)lo=mid;else hi=mid}
      return mix(points[lo][1],points[hi][1],(t-points[lo][0])/(points[hi][0]-points[lo][0]));
    };
  }
  // On a steep rail the marble sits along the rail's normal, not straight above it.
  function ride(x){
    const slope=(ground(x+1)-ground(x-1))/2,n=Math.hypot(1,slope);
    return {x:x+(radius+6)*slope/n,y:ground(x)-(radius+6)/n};
  }
  const approach=668,waitingX=westBank-radius-5,gateStop=gateX-radius-4,lipStop=1985-radius;
  // A marble fed in from above: how far over its resting place it still is. It falls, lands, and hops once.
  function dropIn(t,from,to){
    const u=clamp((t-from)/(to-from));
    if(u<.7)return 340*(1-(u/.7)**2);
    const v=(u-.7)/.3;return 44*v*(1-v);
  }
  // Where the stand-ins of stations 3 to 5 are. Outside its own scene a stand-in is not shown (app.js fades it), so the
  // marble is always in exactly one place.
  function mates(step,t,balance){
    const rest=x=>ground(x)-radius-6,list=[];
    const put=(m,x)=>list.push({scale:1,air:false,spin:x/radius/rad,x,...m});
    {
      // Thinking: appears on the far side of the bridge, rolls into the gate, is thrown back, tries once more and stays there.
      let x=gateStop,up=0,show=0;
      if(step===7){
        show=clamp(t/.05);up=dropIn(t,0,.2);
        if(t<.5)x=mix(1040,gateStop,clamp((t-.2)/.3)**1.6);
        else if(t<.66)x=mix(gateStop,gateStop-26,1-(1-(t-.5)/.16)**2);
        else x=mix(gateStop-26,gateStop,clamp((t-.66)/.2)**2);
      }
      put({y:rest(x)-up,show,air:up>3},x);
    }
    {
      // Work: rolls off the end of its rail, misses the next one and ends up on the floor, out of the run.
      const edge=1444,land=1470,end=1487,lying=341-radius*1.12;
      let x=end,y=lying,scale=1.12,air=false,show=0;
      if(step===8){
        show=clamp(t/.05);
        if(t<.52){x=mix(1352,edge,clamp((t-.2)/.32)**1.6);const up=dropIn(t,0,.2);y=rest(x)-up;scale=1;air=up>3}
        else if(t<.72){const v=(t-.52)/.2;x=mix(edge,land,v);y=mix(rest(edge),lying,v*v);scale=mix(1,1.12,v);air=true}
        else{const v=(t-.72)/.28,hop=Math.min(1,v/.35);x=mix(land,end,1-(1-v)**2);y=lying-40*hop*(1-hop)}
      }
      put({y,show,air,scale},x);
    }
    {
      // Equity: lands on one side of the seesaw and rolls to the low end. All the weight is on one side.
      let x=lipStop,up=0,show=0;
      if(step===9){
        show=clamp(t/.05);up=dropIn(t,0,.18);
        if(t<.6)x=mix(1850,lipStop,clamp((t-.2)/.4)**1.7);
        else if(t<.72)x=mix(lipStop,lipStop-13,1-(1-(t-.6)/.12)**2);
        else x=mix(lipStop-13,lipStop,clamp((t-.72)/.12)**2);
      }
      put({y:balanceY+(x-balanceX)*Math.tan(balance*rad)-(radius+6)/Math.cos(balance*rad)-up,show,air:up>3},x);
    }
    return list;
  }
  // Scene 1: the marble ambles for the first part, then the word "Fast." lands and it takes off.
  // `fastAt` is the place in the scene where that happens (app.js shows the word at the same moment).
  const fastAt=.4;
  const surge=t=>t<fastAt?.16*t/fastAt:.16+.84*(1-(1-(t-fastAt)/(1-fastAt))**2.2);
  let plungeRun=null;
  function pose(step,f){
    const t=clamp(f);
    const explosion=typeof RunExplosion==='undefined'?require('./explosion.js'):RunExplosion;
    const breaking=step===3||step===4;
    const plunging=step===3&&t<fall.start;
    const breakage=step===3?(plunging?0:mix(fall.from,1,(t-fall.start)/(1-fall.start))):step===4?1-t:0;
    let x=550;
    if(step===1)x=mix(ends[0],ends[1],surge(t));
    else if(step===2)x=mix(150,brink,t);
    // After the break is mended the marble rolls on towards the bridge. The bridge is as far as it gets.
    else if(step===5)x=mix(550,approach,t);
    else if(step===6)x=mix(approach,waitingX,1-(1-clamp(t/.19))**2);
    else if(step>6)x=waitingX;
    // The two banks reach for each other, strain, and fall back open.
    let bridge=0;
    if(step===6){
      const rise=ease(clamp((t-.28)/.24)),give=ease(clamp((t-.64)/.12));
      bridge=.62*rise*(1-give)+.014*Math.sin(t*250)*clamp((t-.42)/.1)*(1-give)-.06*Math.sin(Math.PI*clamp((t-.76)/.16));
    }
    // The gate only shudders when the marble runs into it, twice, a little less the second time.
    const gate=step===7?-7*Math.sin(Math.PI*clamp((t-.5)/.12))-2.5*Math.sin(Math.PI*clamp((t-.86)/.08)):0;
    // The seesaw tips under the one marble and stays down, with a small thud when its end meets the floor.
    const balance=step===9?10*ease(clamp((t-.13)/.42))-.9*Math.sin(Math.PI*clamp((t-.55)/.1)):0;
    let y=ground(x)-radius-6;
    if(step===2)({x,y}=ride(x));
    if(plunging){
      // Gravity sets the pace: slow over the brink, fastest at the bottom, straight into the break.
      plungeRun=plungeRun||timedRail(brink,550+13*fall.from/explosion.onset,45);
      ({x,y}=ride(plungeRun(t/fall.start)));
    }else if(breaking)({x,y}=explosion.ball(breakage,y));
    const stressReached=(step===3&&breakage>=explosion.impact)||(step===6&&t>=.66)||
      (step===7&&t>=.5)||(step===8&&t>=.52)||(step===9&&t>=.6);
    // tremor: how hard the run shakes (0 to 1). front: cracks left of this x have appeared.
    const tremor=step===2?ease(clamp((t-.2)/.5)):step===3?1-clamp(t/(fall.start*.5)):0;
    const front=step===2?mix(150,brink,t)+130:step===3?brink+130+2500*t:step===4?mix(660,250,t):-1e4;
    return {tremor,front,stressReached,x,y,spin:(x-ends[0])/radius/rad,breakage,bridge,gate,balance,airborne:false,left:step>6,mates:mates(step,t,balance)};
  }
  function transforms(p){
    const explosion=typeof RunExplosion==='undefined'?require('./explosion.js'):RunExplosion;
    const out=explosion.transforms(p);
    const lift=62*(1-p.bridge);
    out.bridgeLeft='rotate('+(-lift)+' '+westBank+' '+ground(westBank)+')';
    out.bridgeRight='rotate('+lift+' '+eastBank+' '+ground(eastBank)+')';
    out.gate='rotate('+p.gate+' '+gateX+' '+gateY+')';
    if(p.tremor)for(let i=0;i<sections.length;i++){
      const [dx,dy]=quake(i,p.phase||0,p.tremor);
      out['part'+i]='translate('+dx.toFixed(2)+' '+dy.toFixed(2)+') '+out['part'+i];
    }
    out.balance='rotate('+p.balance+' '+balanceX+' '+balanceY+')';
    p.mates.forEach((m,i)=>{
      out['mate'+i]='translate('+m.x.toFixed(2)+' '+m.y.toFixed(2)+') rotate('+m.spin.toFixed(1)+') scale('+m.scale.toFixed(3)+')';
      out['mateShadow'+i]='translate('+m.x.toFixed(2)+' '+(m.y+21*m.scale).toFixed(2)+') scale('+(m.air||m.show<1?0:1)+')';
    });
    return out;
  }
  // How visible each marble is (0 to 1). A stand-in fades in at the top of its fall. The marble that came down the run
  // is left behind at the bridge once the story moves past it.
  const fades=p=>({traveller:p.left?0:1,contact:p.left?0:1,...Object.fromEntries(p.mates.map((m,i)=>['mate'+i,m.show]))});
  return {art,pose,transforms,fades,quake,ground,ride,brink,fastAt,surge,impact:()=>(typeof RunExplosion==='undefined'?require('./explosion.js'):RunExplosion).impact,fall,camera,times,ease,clamp,mix};
})();
if(typeof module!=='undefined')module.exports=MarbleRun;
