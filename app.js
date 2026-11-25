// iPhone Chrome and Brave size 100svh as if their toolbars were not there, so the page ended up a little taller than what
// you can see: a tiny scroll, and the bottom buttons sitting under the toolbar. innerHeight is the visible height.
{const setVh=()=>document.documentElement.style.setProperty('--vh',innerHeight+'px');setVh();addEventListener('resize',setVh);addEventListener('orientationchange',setVh)}
'use strict';
const {welcome:W,about:A,story:S,ui:U,groups}=window.IDEA_MAP;
document.querySelector('.mast .face').setAttribute('aria-label',A.open);
// Header: who, then what. On a phone the two stack (see .mast-who in style.css).
{
  const title=document.querySelector("#siteTitle");
  for(const [cls,text] of [['mast-who',A.name],['mast-dot','·'],['mast-what',W.siteTitle]]){
    const part=document.createElement('span');part.className=cls;part.textContent=text;
    if(cls==='mast-dot')part.setAttribute('aria-hidden','true');
    title.append(part);
  }
}
const ideas=groups.flatMap((group,g)=>group.ideas.map((i,index)=>({...i,g,group,shade:index%6})));
const app=document.querySelector('#app'),sheet=document.querySelector('#sheet'),detail=document.querySelector('#detail');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={step:0,name:'',fullName:'',email:'',picked:new Set(),read:new Set(),own:[],area:0,sent:'',paused:false};
// A visitor's own marble is an idea like any other, flagged `own`. It lives in the same list so the jar can draw it.
function addOwnIdea({id,title,note,g}){
  g=Math.max(0,Math.min(groups.length-1,g|0));
  const idea={id:String(id),title:String(title).slice(0,60),note:String(note||'').slice(0,280),g,group:groups[g],shade:0,own:true};
  ideas.push(idea);state.own.push(idea);return idea;
}
try{
  const saved=JSON.parse(sessionStorage.getItem('idea-map-visual')||'{}');
  state.fullName=String(saved.fullName||saved.name||'');state.name=state.fullName.trim().split(/\s+/)[0];
  state.email=String(saved.email||'');state.sent=String(saved.sent||'');state.area=Math.max(0,Math.min(groups.length-1,saved.area|0));
  for(const own of (saved.own||[]).slice(0,5))addOwnIdea(own);
  const known=id=>ideas.some(i=>i.id===id);
  state.picked=new Set((saved.ids||[]).filter(known));state.read=new Set((saved.read||[]).filter(known));
}catch{}
function save(){
  try{sessionStorage.setItem('idea-map-visual',JSON.stringify({
    fullName:state.fullName,email:state.email,sent:state.sent,area:state.area,ids:[...state.picked],read:[...state.read],
    own:state.own.map(({id,title,note,g})=>({id,title,note,g}))
  }))}catch{}
}
const esc=v=>String(v).replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
function marbleImage(g,shade){return 'assets/swirl-'+g+'-'+shade+'.webp'}
function ball(idea){return idea.own?'<span aria-hidden="true" class="ball own"></span>':'<span aria-hidden="true" class="ball" style="--glass:url('+marbleImage(idea.g,idea.shade)+')"></span>'}
function btn(key,label,cls='action'){return '<button class="'+cls+'" data-action="'+key+'">'+esc(label)+'</button>'}
function named(v){return v.replace('{name}',()=>state.name)}
const jarTitle=()=>state.name?named(U.personalJar):U.jar;
// Story controls. "Skip to the ideas" is there for visitors in a hurry.
function controls(label=U.next,withPause=false){
  const early=state.step>=1&&state.step<10;
  return '<nav class="controls">'+btn('back',U.back,'subtle')+(early?btn('skip',U.skip,'subtle skip'):'')+(withPause?btn('pause',U.pause,'pause'):'')+btn('next',label,'keyboard-next')+'</nav>';
}
let raf=0;
function animate(duration,paint,done){
  cancelAnimationFrame(raf);let elapsed=0,last=0;
  function tick(now){
    if(last&&!state.paused&&!document.hidden&&!sheet.open)elapsed+=Math.min(now-last,80);
    last=now;
    const f=reduced.matches?1:Math.min(1,elapsed/duration);
    paint(f);
    if(f<1)raf=requestAnimationFrame(tick);
    else if(done)done();
  }
  paint(reduced.matches?1:0);raf=requestAnimationFrame(tick);
}
let lastCamera=null,lastPose=null,lastScene=0,coverX=-300,openerStart=-115,rig=null;
// Every scene waits for a click, so the marble starts from rest and comes to rest: speed ramps up, holds, ramps down.
function settle(u){const r=.16,v=1/(1-r);return u<r?v*u*u/(2*r):u>1-r?1-v*(1-u)*(1-u)/(2*r):v*(u-r/2)}
function machine(stage,step){
  // The sculpture is drawn once per stage and then only moved, so scenes flow into each other without a redraw.
  if(!rig||rig.stage!==stage){
    stage.innerHTML='<svg aria-hidden="true" preserveAspectRatio="xMidYMid meet">'+MarbleRun.art()+'</svg>';
    const nodes=new Map();
    for(const node of stage.firstElementChild.querySelectorAll('[id]'))nodes.set(node.id,node);
    rig={stage,svg:stage.firstElementChild,nodes,cracks:[...stage.querySelectorAll('.crack')].map(el=>({el,x:+el.dataset.x}))};
  }
  const {svg,nodes}=rig;
  const closeUp=step<=2,from=lastScene;
  const carried=!!lastCamera&&Math.abs(step-from)===1;
  const target=step===0?[-300,48,660]:MarbleRun.camera[step];
  const start=carried?lastCamera:target;
  const entryPose=carried&&from>0?lastPose:null;
  // Breaking and mending are one clock run in two directions: pick it up wherever the other scene left it.
  const f0=!entryPose?0:step===4&&from===3?1-entryPose.breakage:step===3&&from===4?MarbleRun.fall.start+(1-MarbleRun.fall.start)*MarbleRun.clamp((entryPose.breakage-MarbleRun.fall.from)/(1-MarbleRun.fall.from)):0;
  const duration=Math.max(700,[0,4900,3900,2800,2600,3500,5100,3850,3450,4600][step]*(1-f0));
  // A scene left early hands its marble over: for half a second the pose glides from where it was to where it belongs.
  const joinSpan=f0?0:MarbleRun.clamp(520/duration);
  // "I am." and the marble goes: only a breath at the brink while the words change, then it races down the drop.
  const hold=step===3&&!f0?700:0;
  lastScene=step;
  // f is the place in the scene's choreography, u the plain time since the scene began (both 0 to 1).
  function paint(f,u){
    let pose=MarbleRun.pose(Math.max(1,step),f);
    if(step===0||step===1){
      const x=step===0?coverX:MarbleRun.mix(openerStart,150,f);
      pose={...pose,x,y:MarbleRun.ground(x)-25,spin:(x+115)*180/(19*Math.PI)};
    }
    if(entryPose&&u<joinSpan){
      const join=MarbleRun.ease(u/joinSpan);
      for(const key of ['x','y','spin','breakage','gate','bridge','balance']){
        pose[key]=MarbleRun.mix(entryPose[key],pose[key],join);
      }
    }
    lastPose=pose;
    // Worry: the run shivers under the marble (which rides along with its section) and cracks draw themselves in ahead of it.
    pose.phase=performance.now()/1000;
    if(reduced.matches)pose.tremor=0;
    let shown=pose;
    if(pose.tremor){const [dx,dy]=MarbleRun.quake(0,pose.phase,pose.tremor);shown={...pose,x:pose.x+dx,y:pose.y+dy}}
    for(const {el,x} of rig.cracks){
      const grown=MarbleRun.clamp((pose.front-x)/50);
      el.setAttribute('stroke-dashoffset',1-grown);el.setAttribute('opacity',grown?.9:0);
    }
    stage.closest('.stage')?.classList.toggle('stressed',pose.stressReached);
    for(const [id,value] of Object.entries(MarbleRun.transforms(shown)))nodes.get(id).setAttribute('transform',value);
    const rect=stage.getBoundingClientRect(),mobile=rect.width<700;
    if(!rect.width)return;   // not laid out (hidden tab): there is no camera to aim yet
    // In the collapse scene the camera stays close for the first moment of the plunge, then pulls back as the marble gathers speed.
    const blend=MarbleRun.ease(MarbleRun.clamp(step===3?(u-.1)*2.4:u*(step===6?6:2.7)));
    let cx,cy,width;
    if(closeUp){
      width=mobile?340:780;
      cx=pose.x-(mobile?.04:.17)*width;
      cy=pose.y-(mobile?.16:.13)*width*rect.height/Math.max(1,rect.width);
      if(step&&carried){
        // Ease from the previous scene's framing into following the marble, in either direction.
        const enter=MarbleRun.ease(MarbleRun.clamp(u*3.5));
        cx=MarbleRun.mix(start[0],cx,enter);cy=MarbleRun.mix(start[1],cy,enter);width=start[2]*Math.pow(width/start[2],enter);
      }
    }else{
      cx=MarbleRun.mix(start[0],target[0],blend);cy=MarbleRun.mix(start[1],target[1],blend);
      width=start[2]*Math.pow(target[2]*(mobile?(step>=5?.86:.72):1)/start[2],blend);
    }

    const height=width*rect.height/Math.max(1,rect.width);
    if(step===0){
      const field=app.querySelector('#visitor').getBoundingClientRect();
      let dockX=field.right-rect.left-22,dockY=field.top-rect.top+field.height/2;
      // On a phone the field stands clear above the run and the marble waits on the rail just past its end.
      // (The rail's top edge is about 16 drawing units below the marble's centre. The rail climbs to the left by
      // .055 per unit, so the gap is measured at the field's left end, where the rail is highest.)
      if(mobile){const px=rect.width/width;dockX=field.right-rect.left+8+19*px;dockY=field.bottom-rect.top+7+.055*(field.width+30)-16*px}
      cx=-240-(dockX/rect.width-.5)*width;
      cy=(MarbleRun.ground(-240)-25)-(dockY/rect.height-.5)*height;
    }
    if(step===0){
      const button=app.querySelector('.marble-start');
      button.style.left=((-240-cx)/width+.5)*100+'%';
      button.style.setProperty('--roll-x',(pose.x+240)*rect.width/width+'px');
      button.style.setProperty('--roll-angle',pose.spin+'deg');
      nodes.get('traveller').style.visibility='hidden';
      button.style.top=((pose.y-cy)/height+.5)*100+'%';
      button.style.setProperty('--orb-size',38*rect.width/width+'px');
    }
    lastCamera=[cx,cy,width];svg.setAttribute('viewBox',[cx-width/2,cy-height/2,width,height].join(' '));
  }
  if(step===0){
    let previous=0,elapsed=0;
    function roll(now){
      if(previous&&!document.hidden&&!state.paused)elapsed+=Math.min(80,now-previous);previous=now;
      // Follow an endless incoming rail while a visitor takes time over the form.
      coverX=-240+7*Math.sin(elapsed/680);
      paint(0,0);if(!reduced.matches)raf=requestAnimationFrame(roll);
    }
    roll(performance.now());return;
  }
  // No auto-advance: when the scene has played, Continue appears and the visitor clicks on.
  const section=stage.closest('section');
  const lead=hold/(duration+hold);
  animate(duration+hold,raw=>{const u=Math.max(0,(raw-lead)/(1-lead));paint(f0+(1-f0)*settle(u),u)},()=>{
    section.classList.add('ready');
    // The worried scene keeps shivering while it waits for the click.
    if(step===2&&!reduced.matches){const idle=()=>{if(!state.paused&&!document.hidden&&!sheet.open)paint(1,1);raf=requestAnimationFrame(idle)};raf=requestAnimationFrame(idle)}
  });
}
function welcome(){
  app.innerHTML='<section class="welcome opening"><div class="illustration"></div><div class="welcome-copy"><button class="face" type="button" data-about aria-label="'+esc(A.open)+'"><img src="assets/mareike.jpg" alt="Mareike Jens"></button><h1>'+esc(W.title)+'<span>'+esc(W.subtitle)+'</span></h1><form id="entry" novalidate><div class="namebox"><input id="visitor" autocomplete="name" aria-label="'+esc(W.label)+'" placeholder="'+esc(W.label)+'"></div></form><p class="visit-notice">'+esc(W.notice||'')+'</p></div><button class="marble-start" form="entry" type="submit" aria-label="'+esc(U.start)+'"></button></section>';
  machine(app.querySelector('.illustration'),0);
  const input=document.querySelector('#visitor');input.value=state.fullName;
  app.querySelector('form').onsubmit=e=>{
    e.preventDefault();const full=input.value.trim().replace(/\s+/g,' '),parts=full.split(' ');
    // The marble only starts once there is a name: nudge the field instead of rolling.
    if(!full){
      input.focus();
      if(!reduced.matches)input.parentElement.animate([{translate:'0'},{translate:'-7px'},{translate:'6px'},{translate:'-3px'},{translate:'0'}],{duration:360,easing:'ease-out'});
      return;
    }
    const from=app.querySelector('.welcome-copy .face img').getBoundingClientRect();
    state.fullName=full;state.name=parts[0];openerStart=coverX;save();Track.send('start');go(1,()=>dockPortrait(from));
  };
}
// The cover portrait travels up into the header corner while shrinking; the header fades in around it.
function dockPortrait(from){
  if(reduced.matches)return;
  const mast=document.querySelector('.mast'),img=mast.querySelector('.face img'),to=img.getBoundingClientRect();
  const timing={duration:950,easing:'cubic-bezier(.5,0,.15,1)',fill:'backwards'};
  const border=3*to.width/from.width;
  img.animate([
    {transformOrigin:'top left',transform:'translate('+(from.left-to.left)+'px,'+(from.top-to.top)+'px) scale('+from.width/to.width+')',boxShadow:'0 0 0 '+border+'px white, 0 3px 12px #6e553723'},
    {transformOrigin:'top left',transform:'none',boxShadow:'0 0 0 0 white, 0 3px 12px #6e553723'}
  ],timing);
  mast.animate([{backgroundColor:'transparent'},{}],timing);
  for(const el of mast.querySelectorAll('#siteTitle,.mast-tools'))el.animate([{opacity:0,translate:'-8px 0'},{opacity:1,translate:'0 0'}],{duration:450,delay:650,easing:'ease-out',fill:'backwards'});
}
function about(){
  const logos=[['kit.png','KIT',1.2],['ibm.svg','IBM',1],['bcg.png','BCG',1],['optiml.png','Optiml',1.15],['eth.png','ETH Zürich',.88]];
  openSheet('<div class="detail about"><img class="portrait" src="assets/mareike.jpg" alt=""><h2>'+esc(A.name)+'</h2><p>'+esc(A.lead)+'</p><p>'+esc(A.body)+'</p><p class="small">'+esc(A.background)+'</p><ul class="logos" aria-label="'+esc(A.logosLabel)+'">'+logos.map(([file,name,h])=>'<li><img src="assets/logos/'+file+'" alt="'+name+'" style="height:'+h+'em"></li>').join('')+'</ul><p class="links"><a href="https://www.linkedin.com/in/mareike-jens/" target="_blank" rel="noopener">LinkedIn</a><a href="https://mareikejens.substack.com/" target="_blank" rel="noopener">Substack</a>'+(A.email?'<a href="mailto:'+esc(A.email)+'">'+esc(A.emailLabel)+'</a>':'')+(window.IDEA_MAP.send?.bookingUrl?'<a href="'+esc(window.IDEA_MAP.send.bookingUrl)+'" target="_blank" rel="noopener">'+esc(A.bookLabel)+'</a>':'')+'</p></div>');
}
document.addEventListener('click',e=>{if(e.target.closest('[data-about]'))about()});
function runWords(label){
  const mark=label.match(/\[([^\]]+)\]/);
  if(!mark)return esc(label);
  return esc(label.slice(0,mark.index))+'<strong class="beat">'+esc(mark[1])+'</strong>'+esc(label.slice(mark.index+mark[0].length));
}
// Body copy: words in [brackets] arrive a beat after the rest of the line.
function lateWords(text){
  const mark=text.match(/\[([^\]]+)\]/);
  if(!mark)return esc(text);
  return esc(text.slice(0,mark.index))+'<span class="late">'+esc(mark[1])+'</span>'+esc(text.slice(mark.index+mark[0].length));
}
function story(){
  const s=state.step,group=s===3?groups[0]:s>=6?groups[s-5]:null;
  // "What about you?" stands alone first; the next click asks the question itself (see go()).
  const worried=esc(state.name?named(S.worried):S.worriedGuest)+' <span class="held">'+esc(S.worriedAsk)+'</span>';
  const title=group?runWords(group.runLabel):s===2?worried:esc([null,S.intro,null,null,S.even,S.transition][s]);
  const body=s===1?S.introBody:group?.question;
  const kind=group?'station':s<=2?'opening':'';
  // The first danger is posed as a question: "I am." stands alone while the marble races down the drop, "What if…" then takes its place, and the answer appears as the marble bursts.
  // "I am." answers the question from the scene before, then the first danger follows.
  const lead=s===3?'<span class="iam">'+esc(S.iAm)+'</span><span class="whatif">'+esc(S.whatIf)+'</span> ':'';
  const head='<h1 tabindex="-1" class="'+(s===2?'worry':'')+'">'+lead+(lead?'<span class="answer">'+title+'</span>':title)+'</h1>'+(body?'<p>'+lateWords(body)+'</p>':'');
  let section=app.querySelector('.stage.machine');
  if(!section){
    app.innerHTML='<section class="stage machine '+kind+'"><div class="headline">'+head+'</div><div class="illustration"></div>'+controls(U.next,true)+'</section>';
    section=app.firstElementChild;
  }else{
    // Same stage, next scene: only the words change. The old line fades out, then the new one fades in.
    section.classList.remove('ready');
    const pause=section.querySelector('.pause');pause.textContent=U.pause;pause.removeAttribute('aria-pressed');
    const headline=section.querySelector('.headline');
    const swap=()=>{
      section.classList.toggle('station',kind==='station');section.classList.toggle('opening',kind==='opening');
      headline.innerHTML=head;headline.classList.remove('leaving');headline.querySelector('h1').focus({preventScroll:true});
    };
    if(reduced.matches)swap();else{headline.classList.add('leaving');headTimer=setTimeout(swap,200)}
  }
  machine(section.querySelector('.illustration'),s);
}
let headTimer=0;
// The marble page: the screen fills with marbles, they part around a clearing, the sentence appears there and the question then replaces it.
// ?flood opens this page directly, for reviewing it without replaying the story.
function fillMarbleField(){
  const field=app.querySelector('.specimens');
  if(!field)return;
  const stage=field.parentNode;
  const {width:W,height:H}=field.getBoundingClientRect();
  // About 150 marbles whatever the screen: the marble grows with the screen instead of the count.
  const d=Math.min(72,Math.max(30,Math.sqrt(W*H/150)/1.21));
  const pitch=d*1.3,rowHeight=d*1.13;
  const columns=Math.ceil(W/pitch)+2,rows=Math.ceil(H/rowHeight)+2;
  let seed=2407;
  const random=n=>{seed=(seed*16807)%2147483647;return Math.floor(seed/2147483647*n)};
  const rnd=()=>random(10000)/10000;
  // Opening picture: a loose hand-laid field. A grid, with every marble nudged off its spot and sized a little differently.
  const slots=[],visible=[];
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const r=d*(.4+rnd()*.2);
    const x=(col-.7+(row%2)*.5)*pitch+d/2+(rnd()-.5)*d*.3,y=(row-.4)*rowHeight+d/2+(rnd()-.5)*d*.3;
    if(x-r>=0&&x+r<=W&&y-r>20&&y+r<H-110)visible.push(slots.length);
    slots.push({x,y,r,g:random(groups.length),shade:random(6),tx:x,ty:y});
  }
  const shown=ideas.filter(i=>!i.own);
  const pool=visible.length>=shown.length?visible:slots.map((_,i)=>i);
  shown.forEach((idea,i)=>Object.assign(slots[pool[Math.floor((i+.5)*pool.length/shown.length)]],{idea,g:idea.g,shade:idea.shade}));
  // The field spreads out from the marble that rolled in from the run.
  const first=slots.find(m=>m.idea&&m.idea.id==='thinking-1')||{x:W/2,y:H/2};
  const reach=Math.hypot(Math.max(first.x,W-first.x),Math.max(first.y,H-first.y));
  for(const m of slots)m.arrive=Math.hypot(m.x-first.x,m.y-first.y)/reach*650;

  {
    // Clearing: a rounded opening in the middle. Marbles inside are pushed to its rim, then everything shuffles until nobody overlaps much.
    const cx=W/2,cy=H*.43,rx=Math.min(W*.47,360),ry=Math.min(Math.max(H*.165,112),170);
    const norm=(x,y)=>(Math.abs((x-cx)/rx)**2.5+Math.abs((y-cy)/ry)**2.5)**.4;
    const clear=m=>{
      const need=1+m.r/ry*.55,n=norm(m.tx,m.ty);
      if(n>=need)return;
      if(n<.02){m.tx=cx+(rnd()-.5)*8;m.ty=cy+(rnd()<.5?-4:4);return clear(m)}
      m.tx=cx+(m.tx-cx)*need/n;m.ty=cy+(m.ty-cy)*need/n;
    };
    for(let pass=0;pass<45;pass++){
      slots.forEach(clear);
      for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){
        const p=slots[i],q=slots[j],dx=q.tx-p.tx,dy=q.ty-p.ty,gap=(p.r+q.r)*1.04,dist=Math.hypot(dx,dy)||.01;
        if(dist>=gap)continue;
        const push=(gap-dist)/2/dist;
        p.tx-=dx*push;p.ty-=dy*push;q.tx+=dx*push;q.ty+=dy*push;
      }
    }
    slots.forEach(clear);
    for(const m of slots){m.delay=Math.min(1,Math.max(0,norm(m.x,m.y)-.2))*160;m.time=900}
    for(const [k,v] of Object.entries({cx,cy,rx,ry}))stage.style.setProperty('--'+k,v+'px');
  }
  field.innerHTML=slots.map(m=>{
    const vars={left:m.x-m.r,top:m.y-m.r,width:m.r*2,'--dx':m.tx-m.x,'--dy':m.ty-m.y};
    const times={'--in':m.arrive,'--delay':m.delay,'--time':m.time};
    const drift='--ax:'+((rnd()-.5)*d*.26).toFixed(1)+'px;--ay:'+((rnd()-.5)*d*.26).toFixed(1)+'px;--beat:'+(6+rnd()*6).toFixed(1)+'s;--phase:-'+(rnd()*12).toFixed(1)+'s';
    return '<span class="specimen" '+(m.idea?'data-seed="'+esc(m.idea.id)+'"':'')+' style="'+
      Object.entries(vars).map(([k,v])=>k+':'+v.toFixed(1)+'px').join(';')+';'+Object.entries(times).map(([k,v])=>k+':'+Math.round(v)+'ms').join(';')+';'+drift+
      '"><img alt="" src="'+marbleImage(m.g,m.shade)+'"></span>';
  }).join('');
}
function flood(origin){
  app.innerHTML='<section class="world"><div class="flood"><div class="specimens" aria-hidden="true"></div><div class="clearing" aria-hidden="true"></div><div class="covercopy"><h1 tabindex="-1">'+esc(S.swarm)+'</h1><p>'+esc(S.swarmBody)+'</p></div></div>'+controls(U.sort)+'</section>';
  fillMarbleField();
  const world=app.firstElementChild,stage=world.firstElementChild;
  // Four beats, each one a tap (see go()): the screen is full of marbles; a tap and they make room and the sentence arrives; a tap and the question
  // takes its place; a tap and the game opens. With reduced motion everything is shown at once.
  cancelAnimationFrame(raf);
  if(reduced.matches){stage.classList.add('settled','asked');world.classList.add('ready')}
  if(origin&&!reduced.matches){
    const seed=app.querySelector('[data-seed="thinking-1"]');
    const img=seed?.querySelector('img'),dest=seed?.getBoundingClientRect();
    if(img&&dest)img.animate([
      {transformOrigin:'top left',transform:'translate('+(origin.left-dest.left)+'px,'+(origin.top-dest.top)+'px) scale('+origin.width/dest.width+')'},
      {transformOrigin:'top left',transform:'none'}
    ],{duration:700,easing:'cubic-bezier(.22,.68,.2,1)'});
  }
}
window.addEventListener('resize',()=>{if(state.step===10)fillMarbleField()});
// Marble field → game. The field is lifted off the page onto a layer above it and the game is built underneath. Then the marbles of the
// problem the game opens on fly to their places on its shelves, every other marble parts outward and fades, and the game fades in.
let veil=null,veilTimer=0;
function endHandover(){
  clearTimeout(veilTimer);veil?.remove();veil=null;
  for(const el of app.querySelectorAll('.arriving,.incoming'))el.classList.remove('arriving','incoming');
}
function handover(swap){
  const world=app.firstElementChild,box=world.getBoundingClientRect();
  veil=document.createElement('div');veil.className='handover';
  world.style.cssText='position:absolute;margin:0;min-height:0;left:'+box.left+'px;top:'+box.top+'px;width:'+box.width+'px;height:'+box.height+'px';
  veil.append(world);document.body.append(veil);
  // Where every marble is right now (measuring also makes the browser settle the moved layer, so the moves below animate).
  const marbles=[...world.querySelectorAll('.specimen')].map(el=>({el,box:el.getBoundingClientRect(),at:new DOMMatrix(getComputedStyle(el).transform)}));
  veil.classList.add('going');swap();
  const game=app.firstElementChild;game.classList.add('arriving');
  const cx=box.left+box.width/2,cy=box.top+box.height*.43,far=Math.hypot(box.width,box.height)*.7;
  let landing=0,last=0;
  for(const {el,box:b,at} of marbles){
    const x=b.left+b.width/2,y=b.top+b.height/2;
    const pick=el.dataset.seed&&[...game.querySelectorAll('.pick:not(.selected)')].find(p=>p.dataset.id===el.dataset.seed);
    if(pick){
      const slot=pick.querySelector('.ball').getBoundingClientRect(),delay=180+landing++*70;
      pick.classList.add('incoming');last=Math.max(last,delay+900);
      el.style.zIndex=2;
      el.style.transition='transform .9s cubic-bezier(.3,.1,.15,1) '+delay+'ms';
      el.style.transform='translate('+(at.e+slot.left+slot.width/2-x)+'px,'+(at.f+slot.top+slot.height/2-y)+'px) scale('+slot.width/b.width+')';
    }else{
      const reach=Math.hypot(x-cx,y-cy)||1,delay=Math.min(1,reach/far)*120;
      el.style.transition='transform .85s cubic-bezier(.5,0,.8,.45) '+delay+'ms,opacity .45s ease '+(delay+280)+'ms';
      el.style.transform='translate('+(at.e+(x-cx)/reach*far)+'px,'+(at.f+(y-cy)/reach*far)+'px)';
      el.style.opacity=0;
    }
  }
  // Landed: the real shelf marbles fade in under the flown ones, then the layer is taken away.
  veilTimer=setTimeout(()=>{
    for(const el of game.querySelectorAll('.incoming'))el.classList.remove('incoming');
    veilTimer=setTimeout(endHandover,400);
  },Math.max(last,950));
}
let booted=false;
function go(n,after){
  const from=state.step;
  const source=from===9&&n===10?app.querySelector('#traveller image'):null;
  const handoff=source?source.getBoundingClientRect():null;
  if(n===11)n=from===12?10:12;                 // step 11 (the plain list) is retired: the flood leads straight into the game
  n=Math.max(0,Math.min(12,n));
  // Marble page: the first tap parts the marbles and brings the sentence, the second brings the question, the third moves on.
  const asking=from===10&&n>10&&app.querySelector('.flood:not(.asked)');
  if(asking){
    cancelAnimationFrame(raf);
    if(!asking.classList.contains('settled'))asking.classList.add('settled');
    else{asking.classList.add('asked');asking.parentNode.classList.add('ready')}
    return;
  }
  // "Are you worried?": the first click on that scene brings the question, the next one moves on.
  const held=from===2&&n>2&&app.querySelector('.headline:not(.leaving) .held:not(.shown)');
  if(held){held.classList.add('shown');return}
  state.step=n;state.paused=false;cancelAnimationFrame(raf);clearTimeout(headTimer);
  const swap=()=>{
    if(from===12)Play.unmount();
    window.scrollTo(0,0);
    if(!n)lastCamera=null;
    document.body.classList.toggle('cover',!n);   // the header only exists once the run has started
    if(!n)welcome();else if(n<=9)story();else if(n===10)flood(handoff);else Play.mount();
    app.querySelector('h1[tabindex]')?.focus({preventScroll:true});
    if(after)after();
  };
  // Scenes of the run share one stage and animate themselves. Every other change of screen is a
  // different page, so the browser cross-fades a snapshot of the old one into the new one.
  const sameStage=from>=1&&from<=9&&n>=1&&n<=9&&app.querySelector('.stage.machine');
  endHandover();
  if(from===10&&n===12&&booted&&!reduced.matches&&app.querySelector('.specimen'))handover(swap);
  // Cover → story: no cross-fade of the whole page. The portrait flies up on its own (dockPortrait), and a cross-fade
  // would also keep a second copy of it fading out in place. Only the new screen fades in.
  else if(from===0&&n===1&&booted&&!reduced.matches){swap();app.animate([{opacity:0},{opacity:1}],{duration:450,easing:'ease'})}
  else if(!booted||sameStage||reduced.matches||!document.startViewTransition)swap();
  else document.startViewTransition(swap);
  booted=true;
}
function openSheet(html){detail.innerHTML=html;const x=sheet.querySelector('.x');x.textContent='×';x.setAttribute('aria-label',U.close);if(!sheet.open)sheet.showModal();sheet.scrollTop=0}
function cardSections(idea){
  const fields=[['vision','Vision'],['why','Why'],['question','Let’s discuss']];
  const clean=key=>idea[key].replace(/\s*\((?:draft|guess)(?::[^)]*)?\)\s*$/,'');
  // The scene is a picture: assets/scenes/<idea id>.jpg. Its words stay as the alt text for screen readers.
  // If the picture is missing, the figure marks itself "missing" and the stylesheet shows the words instead.
  const scene='<figure class="card-scene"><img src="assets/scenes/'+esc(idea.id)+'.jpg" alt="'+esc(clean('scene'))+'" onerror="this.parentNode.classList.add(\'missing\')">'+
    '<figcaption><b>Scene</b>'+esc(clean('scene'))+'</figcaption></figure>';
  return scene+'<dl class="card-sections">'+fields.map(([key,label])=>'<dt>'+label+'</dt><dd>'+esc(clean(key))+'</dd>').join('')+'</dl>';
}
sheet.querySelector('.x').onclick=()=>sheet.close();
sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)sheet.close()}});
app.onclick=e=>{
  const b=e.target.closest('button');
  if(!b){
    if(state.step>=1&&state.step<=11&&!e.target.closest('a,input,textarea,select,form,dialog')&&!window.getSelection()?.toString())go(state.step+1);
    return;
  }
  switch(b.dataset.action){
    case'next':go(state.step+1);break;
    case'back':go(state.step-1);break;
    case'restart':go(0);break;
    case'skip':
      // Two scenes hold back a second line until the next tap. Mark them as shown so the jump goes straight through.
      app.querySelector('.held')?.classList.add('shown');app.querySelector('.flood')?.classList.add('asked');
      go(12);break;
    case'pause':state.paused=!state.paused;b.textContent=state.paused?U.resume:U.pause;b.setAttribute('aria-pressed',state.paused);break;
  }
};
document.querySelector('.mast').onclick=e=>{if(!e.target.closest('button,a')&&state.step>=1&&state.step<=11&&!sheet.open)go(state.step+1)};
document.addEventListener('keydown',e=>{
  if(state.step<1||state.step>11||sheet.open||e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('button,a,input,textarea,select'))return;
  if(e.key==='Enter'||e.key===' '||e.key==='ArrowRight'){e.preventDefault();go(state.step+1)}
});
// ?skip jumps straight to the game, for reviewing it without replaying the story.
// A visitor who already reached the ideas in this tab lands there again after a reload, instead of at the welcome screen.
let reached=false;try{reached=sessionStorage.getItem('idea-map-reached')==='yes'&&!!state.fullName}catch{}
go(new URLSearchParams(location.search).has('skip')||reached?12:new URLSearchParams(location.search).has('flood')?10:0);
