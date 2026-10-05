(function () {
'use strict';
const T=window.THREE,$=s=>document.querySelector(s);
try {
  const scene=new T.Scene();scene.background=new T.Color('#26383f');
  // Keep the room crisp while letting the wet street fall off gently in the
  // distance.  The short fog range gives the window a real rainy atmosphere
  // without washing out the interaction area.
  scene.fog=new T.Fog('#26383f',18,32);
  const camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.1,90);
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.79;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  $('#game').appendChild(renderer.domElement);
  const world=window.buildGiftWorld(T,scene),a=world.actors,p=world.props;
  const nav=GiftCore.createNavigation(world.bounds,world.colliders,.24),story=GiftCore.createStory();
  const ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0);
  const tweens=[],waiters=[],keys=new Set();const focus=new T.Vector3();
  let time=0,last=performance.now(),paused=false,started=false,demo=false,busy=false,active=a.adult;
  let walking=null,moveId=0,targets=[],subtitleToken=0,toastToken=0,autoPending=false,autoAt=0,hoverObject=null;
  let cursor={x:0,y:0},dropPoint=new T.Vector3(-2.75,.055,2.02),eaten=false;
  const dropZone={x:-2.75,z:2.02,radius:.48};
  let bought=false,lastCustomerLeft=false,alternateEnding=false;
  // The scene must not begin while a reviewed GLB is still popping into place.
  // Keep the fallback procedural prop visible if loading fails, but make the
  // start gate deterministic once real production assets are enabled.
  let assetResults=[];
  let assetReady=window.loadGiftAssets?window.loadGiftAssets(T,world).then(results=>{
    assetResults=results;
    return results;
  }).catch(e=>{
    console.warn('Model manifest:',e.message);
    assetResults=[];
    return [];
  }):Promise.resolve([]);
  let soundEnabled=false,audioCtx,ambientGain,finishSpeech=null,speechStarted=0,endingReady=false,footstepAt=0;
  const view={position:new T.Vector3(.1,2.2,3.3),target:new T.Vector3(-2.65,.98,-.4)};
  const visible=(el,on)=>el.hidden=!on;
  const pos=o=>o.getWorldPosition(new T.Vector3());
  const ease=t=>t*t*(3-2*t);
  const distance=(v,w)=>Math.hypot(v.x-w.x,v.z-w.z);
  function face(actor,v){actor.rotation.y=Math.atan2(v.x-actor.position.x,v.z-actor.position.z);}
  function tween(seconds,fn){return new Promise(resolve=>tweens.push({at:time,d:seconds,fn,resolve}));}
  function wait(seconds){return new Promise(resolve=>waiters.push({at:time+seconds,resolve}));}
  function speak(speaker,line,seconds=4.1){
    if(finishSpeech)finishSpeech();const token=++subtitleToken;speechStarted=time;
    $('#speaker').textContent=speaker;$('#line').textContent=line;visible($('#subtitle'),true);visible($('#readOn'),!demo);
    return new Promise(resolve=>{let finished=false;const entry={at:time+seconds,resolve:done};
      function done(){if(finished)return;finished=true;const index=waiters.indexOf(entry);if(index>=0)waiters.splice(index,1);
        if(token===subtitleToken){visible($('#subtitle'),false);visible($('#readOn'),false);finishSpeech=null;}resolve();}
      finishSpeech=done;waiters.push(entry);
    });
  }
  function readOn(){if(!paused&&finishSpeech&&time-speechStarted>.35)finishSpeech();}
  $('#readOn').onclick=readOn;
  function toast(line,seconds=2.8){const token=++toastToken;$('#toast').textContent=line;visible($('#toast'),true);wait(seconds).then(()=>{if(token===toastToken)visible($('#toast'),false);});}
  function cameraTo(position,target,d=1.2){const from=camera.position.clone(),start=focus.clone(),end=new T.Vector3(...position),look=new T.Vector3(...target);
    return tween(d,t=>{camera.position.lerpVectors(from,end,ease(t));focus.lerpVectors(start,look,ease(t));camera.lookAt(focus);});}
  // Film mode uses editorial cuts. Moving the camera across the whole room
  // between every action was exposing the cutaway set and losing the action.
  function shot(position,target,seconds=0){
    if(!demo)return Promise.resolve();
    if(seconds)return cameraTo(position,target,seconds);
    camera.position.set(...position);focus.set(...target);camera.lookAt(focus);
    return Promise.resolve();
  }
  function gaze(actor,object){if(world.lookAt)world.lookAt(actor,object);}
  function portrait(actor,side=1){
    const v=actor.position,forward=new T.Vector3(Math.sin(actor.rotation.y),0,Math.cos(actor.rotation.y));
    const right=new T.Vector3(forward.z,0,-forward.x),look=v.clone().add(new T.Vector3(0,1.43*actor.scale.x,0));
    const eye=look.clone().addScaledVector(forward,1.65).addScaledVector(right,side*.85);eye.y+=.16;
    return shot(eye.toArray(),look.toArray());
  }
  function fitCamera(){
    // Preserve the horizontal framing when the game lives in a narrow app panel.
    camera.aspect=innerWidth/innerHeight;
    camera.fov=demo?2*Math.atan(Math.tan(46*Math.PI/360)*Math.max(1,.85/camera.aspect))*180/Math.PI:2*Math.atan(Math.tan(40*Math.PI/360)*Math.max(1,1.38/camera.aspect))*180/Math.PI;
    camera.updateProjectionMatrix();
  }
  function overview(){return demo?Promise.resolve():cameraTo([7.7,6.7,10.3],[-.35,.65,-.1]);}
  function role(label){$('#roleName').textContent=label;visible($('#role'),!demo);}
  const stages={
    buy:{n:1,title:'买一张儿童套餐券',text:'先把这张券买下来。故事还没到取餐的时候。'},
    choice:{n:2,title:'餐券在你手里',text:'把这次机会留在原处，或者带着它离开。'},
    adult:{n:2,title:'把券放到书包旁',text:'把它放在他看得见、也能自己决定的地方。'},
    child:{n:3,title:'书包旁边，有一张券',text:'孩子捡起餐券。跟着他看一看，这次他会怎么处理。'},
    return:{n:4,title:'去问一问店员',text:'把餐券交给柜台，请店员替失主收好。'},
    meal:{n:5,title:'把餐端到窗边',text:'店员给了他另一份餐。端到窗边，给这段雨声一个位置。'},
    eat:{n:6,title:'打开纸盒',text:'打开餐盒。第一口之后，这段记忆才真正停下来。'},
    leave:{n:2,title:'第一幕 · 没有留下',text:'带走餐券，跟着这段记忆走到门外。'},
    done:{n:6,title:'第一幕 · 窗边的位置',text:'这一幕停在这里。你可以留下，或回到章节档案。'}
  };
  function hud(){const s=stages[story.stage];if(!s)return;$('#chapter').textContent='第一幕 · '+s.n+' / 6';$('#objective').textContent=s.title;
    $('#instruction').textContent=s.text;
    $('#progress').innerHTML=Array.from({length:6},(_,i)=>'<i class="'+(i<s.n?'past':'')+'"></i>').join('');visible($('#hud'),!demo);
    const held=story.stage==='choice'||story.stage==='adult'||story.stage==='return'?'已付款的儿童套餐券':story.stage==='meal'?'店员送你的热套餐':'';
    $('#heldName').textContent=held;visible($('#inventory'),!!held&&!demo);refreshTargets();}
  function advance(next){if(!story.advance(next))throw Error('Unexpected story transition: '+story.stage+' → '+next);hud();}
  function cancelWalk(){moveId++;if(walking){world.pose(walking.actor,'idle');walking.resolve(false);walking=null;}}
  function walk(actor,to,speed=1.65){
    cancelWalk();const path=nav.route(actor.position,to);if(!path){toast('这里走不过去，试试旁边的过道。');return Promise.resolve(false);}
    const id=moveId;return new Promise(resolve=>{walking={actor,path,index:0,speed,resolve,id};world.pose(actor,'walk');});
  }
  function reachableApproach(actor,point,r=.48){
    const options=[];for(let i=0;i<16;i++){const angle=i*Math.PI/8;const v={x:point.x+Math.cos(angle)*r,z:point.z+Math.sin(angle)*r};
      if(nav.clear(v.x,v.z)&&nav.lineClear(v,point)&&nav.route(actor.position,v))options.push(v);}
    return options.sort((x,y)=>distance(x,actor.position)-distance(y,actor.position))[0];
  }
  async function approach(actor,point,r=.48){if(distance(actor.position,point)<r+.12){cancelWalk();face(actor,point);return true;}
    const goal=reachableApproach(actor,point,r);if(!goal)return false;const ok=await walk(actor,goal);if(ok)face(actor,point);return ok;}
  function target(label,object,offset,action){return {label,object,offset:new T.Vector3(...offset),action};}
  // The fork must be an intentional click.  E still works for ordinary
  // contextual actions, but cannot silently choose a life path for the player.
  function currentAction(){return story.stage==='buy'?buyCoupon:story.stage==='choice'?null:story.stage==='adult'?dropCoupon:story.stage==='child'?pickCoupon:story.stage==='return'?returnCoupon:story.stage==='meal'?carryMeal:story.stage==='eat'?(eaten?finishMeal:openMeal):null;}
  function refreshTargets(){
    $('#targets').replaceChildren();targets=[];if(!started||busy||paused||demo||story.stage==='done')return;
    if(story.stage==='buy')targets=[target('买餐券 · 18 元',a.clerk,[0,1.8,0],buyCoupon)];
    // Keep the two alternatives visually separate; both point at the adult,
    // but a shared anchor would make one floating button cover the other.
    if(story.stage==='choice')targets=[target('留给他',a.adult,[-.55,1.72,0],chooseKeep),target('带着券离开',a.adult,[.55,1.72,0],leaveWithCoupon)];
    if(story.stage==='adult')targets=[target('放到书包旁',p.dropSpot||p.bag,[0,.38,0],()=>dropCoupon(true))];
    if(story.stage==='child')targets=[target('捡起餐券',p.coupon,[0,.35,0],pickCoupon)];
    if(story.stage==='return')targets=[target('把券交给店员',a.clerk,[0,1.8,0],returnCoupon)];
    if(story.stage==='meal')targets=[target('端到窗边',p.table,[0,1.15,0],carryMeal)];
    if(story.stage==='eat')targets=[target(eaten?'吃第一口':'打开纸盒',p.meal,[0,.7,0],eaten?finishMeal:openMeal)];
    for(const t of targets){const b=document.createElement('button');b.className='target';b.setAttribute('aria-label',t.label);b.innerHTML='<span class="num">'+stages[story.stage].n+'</span>'+t.label;
      b.addEventListener('click',()=>perform(t.action));t.button=b;$('#targets').appendChild(b);}
  }
  async function perform(action){if(!action||busy||paused||story.stage==='done')return;busy=true;autoPending=false;refreshTargets();
    try{await action();}catch(error){console.error(error);toast('这一段没有完成，请从头再试。',6);}finally{busy=false;refreshTargets();autoAt=time+(demo?.25:1.8);}}
  function makeMoney(){
    const money=new T.Group();
    for(let i=0;i<2;i++){
      const note=new T.Mesh(new T.BoxGeometry(.22,.004,.10),new T.MeshStandardMaterial({color:i?0x9b9b75:0xa46c69,roughness:.95}));
      note.position.set(i*.015,i*.006,0);money.add(note);
    }return money;
  }
  async function buyCoupon(){
    if(story.stage!=='buy'||bought)return;
    await shot([3.5,1.85,1.2],[.7,1.05,-1.8]);
    if(!await walk(a.adult,{x:.64,z:-1.4}))return;
    face(a.adult,a.clerk.position);face(a.clerk,a.adult.position);
    if(demo)await shot([.02,1.75,-2.03],[.64,1.5,-1.4]);
    else await cameraTo([3.7,2.9,3.1],[.6,1.02,-2.05],1.1);
    await speak('成年后的你','我先买一张儿童套餐券，餐先不取。',3.1);
    await shot([1.45,1.73,-1.32],[.8,1.46,-2.9]);
    await speak('店员','十八。券先收好，想用的时候拿来。',3.1);
    const money=makeMoney();world.hold(a.adult,money);await wait(.55);
    const start=pos(money),counter=new T.Vector3(.6,1.01,-2.03);world.release(money);
    await tween(.65,t=>money.position.lerpVectors(start,counter,ease(t)));
    foley('coins');world.hold(a.clerk,money);await wait(.45);world.release(money);money.visible=false;
    world.hold(a.clerk,p.coupon);await wait(.5);
    await shot([1.60,1.55,-1.25],[.66,1.04,-2.05]);
    const from=pos(p.coupon);world.hold(a.adult,p.coupon);const to=pos(p.coupon);world.release(p.coupon);p.coupon.position.copy(from);
    await tween(.65,t=>p.coupon.position.lerpVectors(from,to,ease(t)));world.hold(a.adult,p.coupon);world.pose(a.clerk,'idle');
    foley('paper');bought=true;advance('choice');await overview();
    if(!demo)toast('券已经在你手里。接下来怎么做？',4);
  }
  async function chooseKeep(){
    if(story.stage!=='choice'||!bought)return;
    advance('adult');
    if(!demo)toast('把这次机会放在他看得见、也能自己决定的地方。',3.5);
  }
  async function leaveWithCoupon(){
    if(story.stage!=='choice'||!bought)return;
    alternateEnding=true;visible($('#inventory'),false);$('#objective').textContent='你从店门离开';$('#instruction').textContent='餐券被你带走了。';
    await walk(a.adult,{x:3.35,z:2.9},1.65);foley('door');
    world.release(p.coupon);p.coupon.visible=false;
    await tween(.6,t=>$('#fade').style.opacity=String(t));
    a.adult.visible=false;advance('leave');role('小时候的你');if(world.setMood)world.setMood('child');
    camera.position.set(5.8,5.6,8.8);focus.set(-1.0,.6,.35);camera.lookAt(focus);
    await tween(.6,t=>$('#fade').style.opacity=String(1-t));
    await speak('记忆','这一次，你没有把券留下。',3.2);
    await speak('孩子','雨什么时候会停？',2.4);
    advance('done');showEnding(true);
  }
  function placePoint(){
    const x=active.position.x,z=active.position.z;
    for(const turn of [0,.7,-.7,1.5,-1.5,Math.PI]){
      const v=new T.Vector3(x+Math.sin(active.rotation.y+turn)*.4,.055,z+Math.cos(active.rotation.y+turn)*.4);
      if(distance(v,dropZone)<=dropZone.radius&&nav.clear(v.x,v.z)&&reachableApproach(a.child,v))return v;
    }
    return new T.Vector3(dropZone.x,.055,dropZone.z);
  }
  async function dropCoupon(autoApproach=false){
    if(story.stage!=='adult'||!bought||!lastCustomerLeft)return;
    await shot([.25,1.85,3.85],[-2.55,.7,1.8]);
    if(distance(a.adult.position,dropZone)>.85){
      if(!autoApproach){toast('这里是过道，他未必看得见。靠近窗边的书包再放。',4);return;}
      if(!await walk(a.adult,{x:-2.15,z:2.12}))return;
    }
    cancelWalk();dropPoint=placePoint();face(a.adult,dropPoint);world.pose(a.adult,'reach');
    gaze(a.adult,p.bag);
    await shot([-1.05,1.27,3.5],[-2.57,.57,1.97]);
    const from=pos(p.coupon);world.release(p.coupon);
    await tween(.95,t=>{p.coupon.position.lerpVectors(from,dropPoint,ease(t));p.coupon.rotation.set(0,.2,t*.12);a.adult.userData.body.rotation.x=Math.sin(t*Math.PI)*.35;});
    foley('paper');a.adult.userData.body.rotation.x=0;p.coupon.rotation.set(0,.2,0);world.pose(a.adult,'idle');
    await wait(demo?.9:0);
    visible($('#inventory'),false);$('#objective').textContent='你从店门离开';$('#instruction').textContent='餐券留在他的书包旁。';
    await shot([3.7,1.9,3.5],[-1.75,.83,1.55]);
    await walk(a.adult,{x:3.35,z:2.9},1.65);foley('door');
    await tween(.6,t=>$('#fade').style.opacity=String(t));
    a.adult.visible=false;active=a.child;world.pose(a.child,'shy');face(a.child,p.bag.position);
    advance('child');role('小时候的你');if(world.setMood)world.setMood('child');
    camera.position.set(5.8,5.6,8.8);focus.set(-1.0,.6,.35);camera.lookAt(focus);
    await shot([-1.25,1.4,3.6],[-2.63,.63,1.85]);
    await tween(.6,t=>$('#fade').style.opacity=String(1-t));
    await wait(.5);gaze(a.child,p.coupon);await speak('孩子','谁把它落在这儿了？',2);
  }
  async function pickCoupon(){
    if(story.stage!=='child')return;
    if(!await approach(a.child,dropPoint,.43)){toast('换一条路靠近餐券。');return;}
    await shot([dropPoint.x+.95,.72,dropPoint.z+.8],[dropPoint.x,.20,dropPoint.z]);
    world.pose(a.child,'reach');const from=pos(p.coupon);
    await tween(.8,t=>{a.child.userData.body.rotation.x=Math.sin(t*Math.PI)*.45;p.coupon.position.lerpVectors(from,a.child.position.clone().add(new T.Vector3(0,.78,.28)),ease(t));});
    a.child.userData.body.rotation.x=0;world.hold(a.child,p.coupon);foley('paper');
    const hesitation=a.child.position.clone();
    face(a.child,p.found.position);world.pose(a.child,'inspect');gaze(a.child,p.coupon);
    if(demo)await portrait(a.child,-1);
    else await cameraTo([hesitation.x+3.1,3.1,hesitation.z+4.8],[hesitation.x,.9,hesitation.z],1.1);
    await wait(1.6);
    gaze(a.child,p.menu);await shot([1.1,2.45,-1.35],[.28,2.48,-3.64]);await wait(1.25);
    await portrait(a.child,-1);world.pose(a.child,'hesitate');gaze(a.child,p.coupon);await wait(1.5);
    gaze(a.child,a.clerk.userData.head);await wait(1.1);
    await overview();
    advance('return');
  }
  async function returnCoupon(){
    if(story.stage!=='return')return;
    await shot([2.5,2.05,1.5],[-.4,.86,-1.0]);
    if(!await walk(a.child,{x:.62,z:-1.38})){return;}face(a.child,p.found.position);face(a.clerk,a.child.position);
    gaze(a.child,a.clerk.userData.head);gaze(a.clerk,a.child.userData.head);
    if(demo)await shot([.1,1.54,-2.09],[.63,1.03,-1.4]);
    else await cameraTo([4.1,3.1,3.7],[.55,1,-1.95],1.3);
    await speak('孩子','阿姨，我捡到一张。有人回来找的话，先替他收好吧。',3.8);
    await shot([1.7,1.42,-1.3],[.72,1.05,-2.05]);
    const from=pos(p.coupon);world.hold(a.clerk,p.coupon);const hand=pos(p.coupon);world.release(p.coupon);p.coupon.position.copy(from);
    world.pose(a.child,'reach');await tween(.7,t=>p.coupon.position.lerpVectors(from,hand,ease(t)));world.hold(a.clerk,p.coupon);world.pose(a.child,'idle');
    visible($('#inventory'),false);
    gaze(a.clerk,new T.Vector3(3.35,1.4,2.9));
    await shot([1.48,1.72,-1.2],[.8,1.48,-2.9]);
    await speak('店员','好。有人来问，我替他还回去。',2.5);
    gaze(a.clerk,p.coupon);
    await shot([1.9,1.25,-3.53],[1.1,.8,-3.04]);
    if(world.stowCoupon){world.stowCoupon(p.coupon);await wait(1.6);}else{world.release(p.coupon);p.coupon.visible=false;}
    await shot([1.8,1.68,-.6],[.65,1.08,-2.05]);
    await walk(a.child,{x:.3,z:-.8},1.2);face(a.clerk,a.child.position);
    gaze(a.clerk,a.child.userData.head);
    await speak('店员','等一下，别急着走。',1.8);
    face(a.child,a.clerk.position);
    gaze(a.child,a.clerk.userData.head);world.pose(a.child,'hesitate');
    await shot([1.55,1.75,-1.2],[1.3,1.24,-2.94]);
    world.pose(a.clerk,'reach');const mealShelf=pos(p.meal);world.hold(a.clerk,p.meal);const clerkTray=pos(p.meal);world.release(p.meal);p.meal.position.copy(mealShelf);
    await tween(.8,t=>p.meal.position.lerpVectors(mealShelf,clerkTray,ease(t)));world.hold(a.clerk,p.meal);
    if(world.recordStaffMeal)world.recordStaffMeal();
    await speak('店员','我这份还没动过。你先吃，别让它凉了。',3.0);
    await shot([.25,1.45,-2.04],[.32,1.06,-.8]);
    await speak('孩子','我不是拿它来换饭的。',2.4);
    await shot([1.4,1.72,-1.25],[.8,1.49,-2.9]);
    await speak('店员','我知道。那张券我替失主收着；这一份，是我请你的。',3.8);
    await shot([1.7,1.52,-.92],[.64,.95,-1.9]);
    const mealStart=pos(p.meal);world.release(p.meal);world.hold(a.child,p.meal);const mealEnd=pos(p.meal);world.release(p.meal);p.meal.position.copy(mealStart);
    await tween(.85,t=>p.meal.position.lerpVectors(mealStart,mealEnd,ease(t)));world.hold(a.child,p.meal);world.pose(a.clerk,'idle');
    world.pose(a.child,'confirm');gaze(a.child,a.clerk.userData.head);await wait(.8);
    await speak('孩子','谢谢阿姨。',2.2);
    await speak('店员','在这儿吃，还是带走？',2.6);
    await speak('孩子','在这儿。',1.8);
    if(world.setMood)world.setMood('meal');advance('meal');await overview();
  }
  async function carryMeal(){
    if(story.stage!=='meal')return;
    await shot([.7,1.8,2.6],[-2.25,.92,-.10]);
    if(!await walk(a.child,{x:-2.65,z:.8},1.35))return;
    face(a.child,p.table.position);world.pose(a.child,'carry');
    const from=pos(p.meal),to=new T.Vector3(-2.65,.84,-.30);world.release(p.meal);
    await tween(.75,t=>{p.meal.position.lerpVectors(from,to,ease(t));p.meal.rotation.y*=1-t;});p.meal.rotation.set(0,0,0);foley('tray');
    world.pose(a.child,'idle');
    if(demo){
      await walk(a.child,{x:-1.09,z:-.45},1.25);face(a.child,p.table.position);
      const stand=a.child.position.clone(),seat=new T.Vector3(-1.73,.09,-.45);
      world.pose(a.child,'sit');await tween(.8,t=>a.child.position.lerpVectors(stand,seat,ease(t)));
      a.child.rotation.y=-Math.PI/2;gaze(a.child,p.meal);
      await shot([-3.9,1.58,.9],[-2.15,.98,-.35]);
    }else await cameraTo([1.6,4.4,5.2],[-2.1,.7,-.25],1.5);
    advance('eat');
    await wait(.6);
  }
  async function openMeal(){
    if(story.stage!=='eat'||eaten)return;
    if(!demo&&distance(a.child.position,{x:-2.65,z:.8})>.12&&!await walk(a.child,{x:-2.65,z:.8}))return;
    face(a.child,p.table.position);const lid=p.lid,from=lid.position.clone();world.pose(a.child,demo?'sit':'reach');
    await shot([-3.4,1.82,.56],[-2.55,.94,-.28]);
    await tween(1.25,t=>{lid.rotation.x=-1.8*ease(t);lid.position.set(from.x,from.y+t*.25,from.z-t*.38);});
    eaten=true;world.pose(a.child,demo?'sit':'happy');foley('paper');$('#instruction').textContent='点击汉堡，吃下第一口。';
    await wait(.9);
  }
  async function seatedFirstBite(){
    gaze(a.child,a.clerk.userData.head);
    await shot([-3.25,1.17,.6],[-1.78,1.02,-.4]);await wait(1.2);
    gaze(a.clerk,a.child.userData.head);world.pose(a.clerk,'confirm');
    await shot([1.45,1.74,-1.35],[.8,1.51,-2.9]);await wait(1.15);
    gaze(a.child,p.burger);world.pose(a.clerk,'idle');
    await shot([-3.5,1.48,.65],[-2.02,.97,-.35]);
    const from=pos(p.burger);world.hold(a.child,p.burger);const hand=pos(p.burger);world.release(p.burger);
    p.burger.position.copy(from);await tween(.9,t=>p.burger.position.lerpVectors(from,hand,ease(t)));
    world.hold(a.child,p.burger);world.pose(a.child,'sitEat');gaze(a.child,null);
    await wait(1.3);if(world.bite)world.bite(p.burger);await wait(1.8);
    await speak('孩子','有纸巾吗？',2.2);
    await speak('店员','杯子旁边，自己拿就好。',1.9);
    // Stay with the child. A second walk around the furniture used to dilute
    // the first bite and made the ending feel like another task.
    await shot([-3.75,1.75,2.6],[-2.38,1.0,-.4],2.3);await wait(1.5);
    advance('done');showEnding(false);
  }
  function showEnding(alternate=false){
    endingReady=true;visible($('#chapterMenu'),true);visible($('#hud'),false);visible($('#help'),false);visible($('#role'),false);visible($('#inventory'),false);visible($('#ending'),true);
    $('#pause').disabled=true;
    const eyebrow=$('#ending .eyebrow'),title=$('#ending h2'),copy=$('#ending p');
    if(alternate){eyebrow.textContent='第一幕 · 另一种后来';title.textContent='没有留下的券';copy.textContent='雨还在下。这个下午没有被改写。';}
    else{eyebrow.textContent='第一幕完';title.textContent='窗边的位置';copy.textContent='雨还在下。那张券回到了该去的地方，餐盒里还冒着热气。';}
  }
  async function finishMeal(){
    if(story.stage!=='eat'||!eaten)return;
    if(demo)return seatedFirstBite();
    if(distance(a.child.position,{x:-2.65,z:.8})>.12&&!await walk(a.child,{x:-2.65,z:.8}))return;
    face(a.child,p.table.position);
    await cameraTo([.4,2.9,4.7],[-2.5,.95,.25],1.1);
    if(p.burger){const from=pos(p.burger);world.hold(a.child,p.burger);const hand=pos(p.burger);world.release(p.burger);p.burger.position.copy(from);
      world.pose(a.child,'reach');await tween(.7,t=>p.burger.position.lerpVectors(from,hand,ease(t)));world.hold(a.child,p.burger);world.pose(a.child,'eat');
      await wait(.8);if(world.bite)world.bite(p.burger);await wait(.55);
      const held=pos(p.burger);world.release(p.burger);await tween(.8,t=>p.burger.position.lerpVectors(held,from,ease(t)));p.burger.rotation.set(0,0,0);
      // Put the bitten burger back on the tray before the child reaches for a
      // napkin.  Keeping it in the tray hierarchy preserves the shared meal
      // silhouette and lets the steam continue to read as warm food.
      if(p.meal&&p.burger.parent!==p.meal){p.meal.attach(p.burger);p.burger.position.set(-.22,.05,.02);p.burger.rotation.set(0,0,0);}
    }
    world.pose(a.child,'happy');
    await speak('孩子','有纸巾吗？',2.0);
    await speak('店员','杯子旁边，自己拿就好。',1.8);
    // Use the clear side of the table to reach the napkin and the chair.
    await walk(a.child,{x:-1.09,z:-1.06},1.35);face(a.child,p.table.position);
    if(p.napkin){
      const paperHome=pos(p.napkin);world.hold(a.child,p.napkin);const paperHand=pos(p.napkin);world.release(p.napkin);p.napkin.position.copy(paperHome);
      world.pose(a.child,'reach');await tween(.65,t=>p.napkin.position.lerpVectors(paperHome,paperHand,ease(t)));
      world.hold(a.child,p.napkin);world.pose(a.child,'wipe');await wait(1.7);
      const used=pos(p.napkin);world.release(p.napkin);await tween(.6,t=>p.napkin.position.lerpVectors(used,paperHome,ease(t)));p.napkin.rotation.set(0,.15,0);
    }
    await walk(a.child,{x:-1.09,z:-.45},1.35);face(a.child,p.table.position);
    const stand=a.child.position.clone(),seat=new T.Vector3(-1.73,.09,-.45);
    await tween(.7,t=>a.child.position.lerpVectors(stand,seat,ease(t)));
    a.child.rotation.y=-Math.PI/2;world.pose(a.child,'sit');await wait(.45);
    const tableBurger=pos(p.burger);world.hold(a.child,p.burger);const seatedHand=pos(p.burger);world.release(p.burger);p.burger.position.copy(tableBurger);world.pose(a.child,'sit');
    await tween(.75,t=>p.burger.position.lerpVectors(tableBurger,seatedHand,ease(t)));world.hold(a.child,p.burger);world.pose(a.child,'sitEat');
    await cameraTo([3,4.5,6.8],[-4.1,.6,-.4],2);
    advance('done');role('第一幕 · 窗边的位置');
    showEnding(false);
  }
  async function establish(){
    busy=true;refreshTargets();a.adult.visible=false;world.pose(a.child,'shy');face(a.child,a.customer.position);
    role('一个下雨的下午');
    if(demo)await shot([.3,1.65,3.35],[-2.7,.83,1.6]);
    else await cameraTo([4.9,3.15,5.6],[1.25,.98,-2.1],1.5);
    await speak('记忆','我试着重新走进那天下午。',3.0);
    world.pose(a.customer,'reach');const sample=p.coupon.clone();sample.visible=true;world.hold(a.customer,sample);
    await shot([3.1,1.7,-2.45],[2.5,1.28,-1.42]);
    await speak('顾客','这张今天能用吗？',2.4);
    await shot([1.65,1.68,-1.25],[.8,1.44,-2.9]);
    await speak('店员','能。饮料要什么？',2.5);
    await shot([3.1,1.7,-2.45],[2.5,1.28,-1.42]);
    await speak('顾客','汽水就行，谢谢。',1.8);
    world.release(sample);sample.visible=false;
    const takeout=p.meal.clone();takeout.userData.isMeal=true;world.hold(a.customer,takeout);
    await shot([3.9,1.8,1.4],[2.9,1.0,.0]);
    await walk(a.customer,{x:3.35,z:2.9},1.8);world.release(takeout);takeout.visible=false;a.customer.visible=false;lastCustomerLeft=true;foley('door');
    await walk(a.child,{x:.64,z:-1.4},1.35);face(a.child,a.clerk.position);face(a.clerk,a.child.position);
    if(demo)await shot([.02,1.53,-2.08],[.64,1.06,-1.4]);
    else await cameraTo([3.6,2.65,2.9],[.5,1.0,-1.9],1.1);
    // His own two coins are visible on the counter, and are taken back.
    world.hold(a.child,p.coins);await wait(.3);const coinHand=pos(p.coins),coinCounter=new T.Vector3(.52,1.005,-2.02);world.release(p.coins);
    await tween(.65,t=>p.coins.position.lerpVectors(coinHand,coinCounter,ease(t)));world.pose(a.child,'countCoins');gaze(a.child,p.coins);
    foley('coins');await speak('孩子','不要饮料，只买汉堡，多少钱？',3.4);
    await shot([1.08,1.64,-1.30],[.52,1.015,-2.02]);
    await speak('店员','十二，不加饮料。',1.6);
    await wait(.9);await shot([.04,1.44,-2.07],[.64,1.055,-1.4]);
    await speak('孩子','那先不买了。',2.5);
    world.pose(a.child,'reach');const coinsFrom=pos(p.coins);
    await tween(.65,t=>p.coins.position.lerpVectors(coinsFrom,a.child.position.clone().add(new T.Vector3(.14,.63,-.16)),ease(t)));p.coins.visible=false;world.pose(a.child,'shy');
    await speak('店员','外面的雨还没收住。先坐会儿吧，不着急。',3.0);
    await shot([.0,1.8,3.55],[-2.52,.75,1.55]);
    await walk(a.child,{x:-2.7,z:1.6},1.3);face(a.child,p.bag.position);world.pose(a.child,'rummage');
    await shot([-1.05,1.42,3.15],[-2.62,.64,1.75]);
    await speak('你','这个拉链头，总卡在这里。',2.7);
    a.adult.visible=true;active=a.adult;world.pose(a.adult,'idle');face(a.adult,a.child.position);
    role('成年后的你');await overview();advance('buy');visible($('#help'),!demo);busy=false;refreshTargets();autoAt=time+1;
  }
  async function start(auto){
    if(started)return;
    started=true;demo=auto;visible($('#intro'),false);visible($('#toolbar'),true);
    $('body').setAttribute('data-film',String(demo));fitCamera();
    $('#modeTag').textContent=demo?'第一幕 · 善意':'亲自游玩';
    try{initSound();audioCtx.resume();soundEnabled=true;ambientGain.gain.setTargetAtTime(.035,audioCtx.currentTime,.4);$('#sound').textContent='声音 开';$('#sound').setAttribute('aria-label','关闭声音');}catch(e){/* Audio is optional; the story remains captioned. */}
    visible($('#loading'),true);
    $('#loading').innerHTML='<span class="loading-mark">拾光</span><p>正在整理这间店里的物件…</p>';
    try{
      await assetReady;
      // A failed candidate never blocks the story: loadGiftAssets keeps the
      // procedural fallback in place and reports the candidate for QA.
      $('#loading').innerHTML='<span class="loading-mark">拾光</span><p>正在打开那天下午…</p>';
      // Asset loading is the only blocking part.  The opening scene itself is
      // an intentional playable cinematic, so it must be visible while its
      // dialogue and character blocking run.
      visible($('#loading'),false);
      await establish();
    }catch(error){
      console.error(error);toast('加载故事时遇到了问题，请重新开始。',10);busy=false;
    }finally{visible($('#loading'),false);}
  }
  function setPause(value){if(!started||endingReady)return;paused=value;keys.clear();visible($('#pausePanel'),value);$('#pause').textContent=value?'继续':'暂停';$('#pause').setAttribute('aria-label',value?'继续':'暂停');refreshTargets();if(ambientGain)ambientGain.gain.setTargetAtTime(value?0:soundEnabled?.035:0,audioCtx.currentTime,.2);}
  function initSound(){if(audioCtx)return;audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*3,audioCtx.sampleRate),data=buffer.getChannelData(0);let smooth=0;
    for(let i=0;i<data.length;i++){smooth=(smooth+Math.random()*.2-.1)/1.04;data[i]=smooth*2.5;}
    const source=audioCtx.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1500;
    ambientGain=audioCtx.createGain();ambientGain.gain.value=0;source.connect(filter).connect(ambientGain).connect(audioCtx.destination);source.start();}
  function chime(freq){if(!soundEnabled||!audioCtx)return;const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.045,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.45);osc.connect(gain).connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+.5);}

  function foley(kind){
    if(!soundEnabled||!audioCtx||paused)return;
    const spec={step:[.08,330,.035],paper:[.24,2100,.034],coins:[.06,3500,.022],tray:[.09,750,.04],door:[.3,1100,.018]}[kind];
    if(!spec)return;
    const [duration,hz,level]=spec,n=Math.ceil(audioCtx.sampleRate*duration),buf=audioCtx.createBuffer(1,n,audioCtx.sampleRate),data=buf.getChannelData(0);
    for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);
    const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();source.buffer=buf;
    filter.type=kind==='paper'?'highpass':'lowpass';filter.frequency.value=hz;gain.gain.value=level;
    source.connect(filter).connect(gain).connect(audioCtx.destination);source.start();
    if(kind==='door'||kind==='coins'){const tone=audioCtx.createOscillator(),amp=audioCtx.createGain();tone.frequency.value=kind==='door'?1175:2390;const now=audioCtx.currentTime;
      amp.gain.setValueAtTime(.012,now);amp.gain.exponentialRampToValueAtTime(.0001,now+.45);tone.connect(amp).connect(audioCtx.destination);tone.start();tone.stop(now+.45);}
  }
  $('#sound').onclick=()=>{try{initSound();audioCtx.resume();soundEnabled=!soundEnabled;ambientGain.gain.setTargetAtTime(soundEnabled&&!paused?.035:0,audioCtx.currentTime,.3);$('#sound').textContent='声音 '+(soundEnabled?'开':'关');$('#sound').setAttribute('aria-label',soundEnabled?'关闭声音':'打开声音');}catch(e){toast('当前浏览器无法播放声音。');}};
  // Chapter select deliberately launches Act I in guided mode.  The hidden
  // play control remains a dev/test hook; it is no longer offered in the UI.
  $('#play').onclick=()=>start(false);$('#demo').onclick=()=>start(true);
  $('#pause').onclick=()=>setPause(!paused);$('#resume').onclick=()=>setPause(false);
  for(const id of ['restart','pauseRestart','again'])$('#'+id).onclick=()=>location.reload();
  function showChapters(){visible($('#ending'),false);visible($('#hud'),false);visible($('#chapterPanel'),true);}
  $('#chapters').onclick=showChapters;$('#chapterMenu').onclick=showChapters;
  $('#backToScene').onclick=()=>{visible($('#chapterPanel'),false);visible($('#ending'),true);};
  function showUnavailable(){visible($('#chapterUnavailable'),true);}
  function closeUnavailable(){visible($('#chapterUnavailable'),false);}
  $('#act2').onclick=showUnavailable;$('#chapterAct2').onclick=showUnavailable;$('#closeUnavailable').onclick=closeUnavailable;
  $('#linger').onclick=()=>{visible($('#ending'),false);visible($('#hud'),!demo);$('#chapter').textContent='第一幕完';$('#objective').textContent='窗边的位置';$('#instruction').textContent='右上角可以查看章节，或重新开始。';if(!demo)cameraTo([2.4,3.8,5.5],[-2.4,.7,-.3],1.5);};
  const selectable=[p.coupon,p.found,p.table,p.meal,p.menu,p.bag,p.coins,p.window,p.sideTable,a.child,a.clerk,a.customer].filter(Boolean);
  const names=new Map([[p.coupon,'儿童套餐券'],[p.found,'柜台'],[p.table,'窗边餐桌'],[p.meal,'热乎乎的套餐'],[p.menu,'菜单'],[p.bag,'旧书包'],[p.coins,'两枚硬币'],[p.window,'窗外的雨'],[a.child,'小时候的自己'],[a.clerk,'店员'],[a.customer,'排队的顾客'],[p.sideTable,'刚空下来的座位']]);
  function pick(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
    const hits=ray.intersectObjects(scene.children,true);for(const h of hits){let o=h.object,isVisible=true;while(o){if(!o.visible)isVisible=false;o=o.parent;}if(!isVisible)continue;
      o=h.object;while(o){if(selectable.includes(o))return {object:o,point:h.point};o=o.parent;}
      if(h.object.material?.transparent)continue;
      // Opaque furniture blocks interactions with objects behind it.
      break;
    }const at=new T.Vector3();return ray.ray.intersectPlane(plane,at)?{object:null,point:at}:null;}
  function interactObject(object){
    if(object===a.clerk&&story.stage==='buy')return perform(buyCoupon);
    if(object===p.bag&&story.stage==='adult')return perform(()=>dropCoupon(true));
    if(object===p.coupon&&story.stage==='child')return perform(pickCoupon);
    if((object===p.found||object===a.clerk)&&story.stage==='return')return perform(returnCoupon);
    if(object===p.table&&story.stage==='meal')return perform(carryMeal);
    if((object===p.meal||object===p.table)&&story.stage==='eat')return perform(eaten?finishMeal:openMeal);
    if(object===a.child)speak(story.stage==='adult'?'成年后的你':'小时候的你',story.stage==='adult'?'袖口还是那道补过的线。':'拉链又卡住了。',3.5);
    else if(object===p.menu)speak('菜单','汉堡十二，套餐十八。价格牌的塑封边已经翘起来。',3.5);
    else if(object===p.bag)speak(story.stage==='adult'?'成年后的你':'小时候的你','拉链头绑了一截鞋带。得捏住两边才能拉动。',3.5);
    else if(object===p.coins)speak('两枚硬币','来回数了好几遍，还是两块钱。',3.5);
    else if(object===p.window)speak('窗外','雨点落在玻璃上，把街上的声音隔得很远。',3.5);
    else if(object===a.clerk)speak('店员',story.stage==='adult'?'外面的雨还没停。要躲一会儿，就坐下吧。':'先坐一会儿，不着急。',3.2);
    else if(object===p.found)speak('柜台','一叠点餐单，下面压着收款的零钱。',3.2);
    else if(object===p.sideTable)speak('桌面','杯壁还挂着水珠。这里刚有人坐过。',2.8);
    else if(object===p.table)speak('窗边','这里刚好能看见雨停。',2.8);
    else if(object===p.coupon)toast('刚付过钱的餐券。放在他低头拿书包能看见的地方。');
  }
  renderer.domElement.addEventListener('pointerdown',e=>{if(!started||demo||busy||paused||story.stage==='done')return;const hit=pick(e);if(!hit)return;
    if(hit.object)interactObject(hit.object);else if(nav.clear(hit.point.x,hit.point.z)){walk(active,hit.point);moveMarker.position.set(hit.point.x,.034,hit.point.z);moveMarker.visible=true;}else toast('桌椅不能穿过，点击空地行走。');});
  renderer.domElement.addEventListener('pointermove',e=>{cursor={x:e.clientX,y:e.clientY};if(!started||busy||paused||demo)return;const hit=pick(e);hoverObject=hit?.object;visible($('#hover'),!!hoverObject);renderer.domElement.style.cursor=hoverObject?'pointer':'default';if(hoverObject){$('#hover').textContent=names.get(hoverObject)||'查看';$('#hover').style.left=(e.clientX+14)+'px';$('#hover').style.top=(e.clientY+14)+'px';}});
  renderer.domElement.addEventListener('pointerleave',()=>visible($('#hover'),false));
  addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','Escape'].includes(e.code))e.preventDefault();
    if(e.repeat)return;if(e.code==='Escape')return setPause(!paused);if(e.code==='Space'&&finishSpeech&&!demo){e.preventDefault();return readOn();}if(!started||busy||paused||demo||story.stage==='done')return;
    if(e.code==='KeyE')return perform(currentAction());
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){cancelWalk();keys.add(e.code);}});
  addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
  const markerMaterial=new T.MeshBasicMaterial({color:0xf5c57d,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false});
  const moveMarker=new T.Mesh(new T.RingGeometry(.15,.19,36),markerMaterial);moveMarker.rotation.x=-Math.PI/2;scene.add(moveMarker);moveMarker.visible=false;
  const goalMarker=new T.Mesh(new T.RingGeometry(.32,.365,48),markerMaterial.clone());goalMarker.rotation.x=-Math.PI/2;scene.add(goalMarker);goalMarker.visible=false;
  const activeMarker=new T.Mesh(new T.RingGeometry(.30,.325,40),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7,side:T.DoubleSide,depthWrite:false}));activeMarker.rotation.x=-Math.PI/2;scene.add(activeMarker);
  function updateMovement(dt){
    if(walking){const w=walking,goal=w.path[w.index],v=w.actor.position,dx=goal.x-v.x,dz=goal.z-v.z,len=Math.hypot(dx,dz),travel=w.speed*dt;
      if(len<=travel){v.x=goal.x;v.z=goal.z;w.index++;if(w.index===w.path.length){walking=null;moveMarker.visible=false;world.pose(w.actor,'idle');w.resolve(true);}}
      else{v.x+=dx/len*travel;v.z+=dz/len*travel;w.actor.rotation.y=Math.atan2(dx,dz);}return;}
    if(!keys.size||busy||demo||paused||!started||story.stage==='done')return;
    const forward=new T.Vector3(-camera.position.x+focus.x,0,-camera.position.z+focus.z).normalize(),right=new T.Vector3(-forward.z,0,forward.x),delta=new T.Vector3();
    if(keys.has('KeyW')||keys.has('ArrowUp'))delta.add(forward);if(keys.has('KeyS')||keys.has('ArrowDown'))delta.sub(forward);if(keys.has('KeyD')||keys.has('ArrowRight'))delta.add(right);if(keys.has('KeyA')||keys.has('ArrowLeft'))delta.sub(right);
    if(delta.lengthSq()){delta.normalize().multiplyScalar(1.65*dt);const v=active.position;if(nav.clear(v.x+delta.x,v.z))v.x+=delta.x;if(nav.clear(v.x,v.z+delta.z))v.z+=delta.z;active.rotation.y=Math.atan2(delta.x,delta.z);world.pose(active,'walk');}
  }
  function renderFrame(now){
    requestAnimationFrame(renderFrame);const dt=Math.min(.045,(now-last)/1000);last=now;
    if(!paused){time+=dt;
      for(let i=tweens.length-1;i>=0;i--){const tw=tweens[i],t=Math.min(1,(time-tw.at)/tw.d);tw.fn(t);if(t===1){tweens.splice(i,1);tw.resolve();}}
      for(let i=waiters.length-1;i>=0;i--)if(time>=waiters[i].at){const w=waiters.splice(i,1)[0];w.resolve();}
      if(walking&&time>footstepAt){foley('step');footstepAt=time+.37;}updateMovement(dt);if(!walking&&!keys.size&&!busy&&active.userData.pose==='walk')world.pose(active,'idle');world.update(dt,time);
      if(started&&demo&&!busy&&!autoPending&&story.stage!=='done'&&time>autoAt){autoPending=true;perform(async()=>{if(story.stage==='choice')await chooseKeep();else if(story.stage==='adult')await dropCoupon(true);else{const action=story.stage==='choice'?chooseKeep:currentAction();if(action)await action();}});}
    }
    activeMarker.visible=started&&!demo&&!busy&&!paused&&story.stage!=='done';activeMarker.position.set(active.position.x,.035,active.position.z);
    const current=story.stage==='buy'?p.found:story.stage==='adult'?p.dropSpot:story.stage==='child'?p.coupon:story.stage==='return'?p.found:story.stage==='meal'?p.table:story.stage==='eat'?p.meal:null;
    goalMarker.visible=!demo&&!!current&&!busy&&!paused;if(current){const v=pos(current);goalMarker.position.set(v.x,.04,['return','buy'].includes(story.stage)?-1.38:story.stage==='meal'?.8:v.z);goalMarker.scale.setScalar(1+Math.sin(time*3)*.08);}
    for(const t of targets){const v=pos(t.object).add(t.offset).project(camera);t.button.style.left=Math.max(110,Math.min(innerWidth-110,(v.x*.5+.5)*innerWidth))+'px';t.button.style.top=Math.max(280,Math.min(innerHeight-115,(-v.y*.5+.5)*innerHeight))+'px';}
    if(busy||paused)visible($('#hover'),false);renderer.render(scene,camera);
  }
  fitCamera();camera.position.copy(view.position);focus.copy(view.target);camera.lookAt(focus);a.adult.visible=false;p.coupon.visible=false;p.meal.position.set(2.0,1.11,-3.31);p.meal.visible=true;p.coins.visible=false;
  face(a.child,new T.Vector3(.5,0,-2));face(a.customer,a.clerk.position);world.pose(a.child,'shy');
  addEventListener('resize',()=>{fitCamera();renderer.setSize(innerWidth,innerHeight);});
  requestAnimationFrame(renderFrame);visible($('#loading'),false);
} catch(error){console.error(error);$('#loading').innerHTML='<span class="loading-mark">暂时没能打开记忆</span><p>请刷新重试。需要支持 WebGL 的浏览器。</p>';}
})();
