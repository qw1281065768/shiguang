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
  let bought=false,lastCustomerLeft=false,pendingMode=null,seatTransition=null;
  let choiceMemory=null;
  let trayRun=null;
  let couponSeen=false,exploreHints=0,hintUntil=0,exploreKey='',trayRequested=false;
  const diningSeat=new T.Vector3(-1.73,.09,-.45),chairApproach={x:-1.09,z:-.45};
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
  // Both modes share the same performed scenes. Manual control returns to
  // the navigation view at the end of each action.
  function shot(position,target,seconds=0){
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
    camera.fov=(demo||busy)?2*Math.atan(Math.tan(46*Math.PI/360)*Math.max(1,.85/camera.aspect))*180/Math.PI:2*Math.atan(Math.tan(40*Math.PI/360)*Math.max(1,1.38/camera.aspect))*180/Math.PI;
    camera.updateProjectionMatrix();
  }
  function overview(){return demo?Promise.resolve():cameraTo([6.6,5.8,8.7],[-.3,.70,-.08],.75);}
  function role(label){$('#roleName').textContent=label;visible($('#role'),!demo&&!busy);}
  const stages={
    buy:{n:1,title:'买一张儿童套餐券',text:'先把这张券买下来。故事还没到取餐的时候。'},
    choice:{n:2,title:'餐券在你手里',text:'券已经买好了。可以把它留下，也可以先收着。'},
    doorway:{n:2,title:'你在门边停了一下',text:'餐券还在身上。可以回去留下，也可以走出店门；不会结束游戏。'},
    adult:{n:2,title:'把券放到书包旁',text:'把它放在他看得见、也能自己决定的地方。'},
    child:{n:3,title:'找找那张落下的餐券',text:'在店里走走，观察座位和地上的纸片。走近后按 E 或点击观察；找到餐券，再把它捡起。'},
    return:{n:4,title:'送到失物招领处',text:'找到店里的失物招领托盘，把餐券放进去。和店员交谈可以问路，归还需要亲手完成。'},
    meal:{n:5,title:'到窗边吃汉堡',text:'券已经交还。把这份热餐端到窗边，就在这里吃吧。'},
    eat:{n:6,title:'打开纸盒',text:'坐在窗边打开餐盒，再亲手决定什么时候吃第一口。'},
    leave:{n:2,title:'雨还没有停',text:'现在可以控制孩子，看看店里的物件。想接着走餐券的故事，随时回到拿券的时候，不必重买。'},
    done:{n:6,title:'第一幕 · 窗边的位置',text:'这一幕停在这里。你可以留下，或回到章节档案。'}
  };
  function hud(){const s=stages[story.stage];if(!s){visible($('#hud'),false);refreshTargets();return;}$('#chapter').textContent='第一幕 · '+s.n+' / 6';$('#objective').textContent=s.title;
    $('#instruction').textContent=story.stage==='child'&&couponSeen?'这是一张还没用过的儿童套餐券。走近它，再按 E 或点击拾取。':story.stage==='eat'&&eaten?'热气还没有散。准备好了，就吃第一口。':s.text;
    $('#progress').innerHTML=Array.from({length:6},(_,i)=>'<i class="'+(i<s.n?'past':'')+'"></i>').join('');visible($('#hud'),!demo&&!busy&&!endingReady);
    const held=['choice','doorway','adult','return'].includes(story.stage)?'已付款的儿童套餐券':story.stage==='meal'?'店员送你的热套餐':'';
    $('#heldName').textContent=held;visible($('#inventory'),!!held&&!demo);refreshTargets();}
  function advance(next){if(!story.advance(next))throw Error('Unexpected story transition: '+story.stage+' → '+next);exploreHints=0;hintUntil=0;exploreKey='';hud();}
  function cancelWalk(){moveId++;if(walking){world.pose(walking.actor,'idle');walking.resolve(false);walking=null;}}
  async function leaveSeat(actor){
    if(actor!==a.child||!['sit','sitEat'].includes(actor.userData.pose))return;
    if(seatTransition)return seatTransition;
    const from=actor.position.clone(),to=new T.Vector3(chairApproach.x,0,chairApproach.z);
    world.pose(actor,'idle');gaze(actor,null);
    seatTransition=tween(.55,t=>actor.position.lerpVectors(from,to,ease(t)));
    await seatTransition;seatTransition=null;
  }
  async function walk(actor,to,speed=1.65){
    cancelWalk();const id=moveId;await leaveSeat(actor);if(id!==moveId)return false;
    const path=nav.route(actor.position,to);if(!path){toast('这里走不过去，试试旁边的过道。');return Promise.resolve(false);}
    return new Promise(resolve=>{walking={actor,path,index:0,speed,resolve,id};world.pose(actor,'walk');});
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
  function choosing(){return ['choice','doorway'].includes(story.stage);}
  function exploring(){return !demo&&['child','return'].includes(story.stage);}
  function explorePoint(object){
    if(object===p.coupon)return dropPoint;
    if(object===p.lostProperty)return p.returnApproach;
    if(object.userData.approach)return object.userData.approach;
    return observation(object).point||pos(object);
  }
  function exploreNear(object){const point=explorePoint(object);return distance(active.position,point)<=(object===p.coupon?.85:object===p.lostProperty?.48:.58);}
  function explorationAction(object){
    if(object===p.coupon&&story.stage==='child')return {label:couponSeen?'捡起餐券':'观察地上的纸',action:couponSeen?pickCoupon:()=>inspectPaper(object)};
    if(object===p.lostProperty&&story.stage==='return')return {label:'放入失物招领托盘',action:returnCoupon};
    if(object===p.tableReceipt||object===p.counterNote)return {label:object===p.tableReceipt?'看看桌上的小票':'看看取餐单',action:()=>inspectPaper(object)};
    return {label:observation(object).label,action:()=>inspectObject(object)};
  }
  function nearbyExploration(){
    if(!exploring())return null;
    const candidates=[story.stage==='child'?p.coupon:null,p.lostProperty,p.tableReceipt,p.counterNote,a.clerk,p.bag,p.window,p.table].filter(Boolean).filter(exploreNear);
    candidates.sort((x,y)=>distance(active.position,explorePoint(x))-distance(active.position,explorePoint(y)));
    const goal=story.stage==='child'?p.coupon:p.lostProperty;
    const object=candidates.includes(goal)?goal:candidates[0];return object?{object,...explorationAction(object)}:null;
  }
  function currentAction(){return exploring()?nearbyExploration()?.action||null:story.stage==='buy'?buyCoupon:choosing()?null:story.stage==='adult'?()=>dropCoupon(true):story.stage==='child'?pickCoupon:story.stage==='return'?returnCoupon:story.stage==='meal'?carryMeal:story.stage==='eat'?(eaten?finishMeal:openMeal):story.stage==='leave'?revisitChoice:null;}
  function explorationHint(){
    if(!exploring()||busy||paused)return;
    exploreHints=Math.min(3,exploreHints+1);
    const clues=story.stage==='child'?['留意窗边的座位，纸片可能落在桌边或地上。','书包旁露出一角黄色的纸。走近以后先观察。','已经短暂标出书包旁的区域。走过去，观察，再拾取。']:['寻找写着「失物招领」的小牌子，取餐口并不是交还点。','在柜台左侧边角，有一个独立的小托盘。','已经短暂标出失物招领托盘。走到旁边，再按 E 放入。'];
    toast(clues[exploreHints-1],6);if(exploreHints===3)hintUntil=time+8;
    $('#exploreHint').textContent=exploreHints<3?'再给一点线索':'再标一下位置';
  }
  $('#exploreHint').onclick=explorationHint;
  function refreshTargets(){
    exploreKey=story.stage+':'+(nearbyExploration()?.label||'')+':'+demo+':'+busy+':'+paused;
    $('#targets').replaceChildren();$('#targets').setAttribute('data-choice',String(choosing()));targets=[];
    const enabled=started&&!busy&&!paused&&!demo&&story.stage!=='done';
    const nearby=nearbyExploration();
    const label=exploring()?(nearby?.label||'走近物件后观察 · E'):story.stage==='buy'?'买餐券 · 18 元':story.stage==='adult'?'放到书包旁':story.stage==='child'?'捡起餐券':story.stage==='return'?'放入失物招领托盘':story.stage==='meal'?'端到窗边坐下':story.stage==='eat'?(eaten?'吃第一口':'打开纸盒'):story.stage==='leave'?'回到拿券的时候':choosing()?'请在下方作出选择':'正在走进记忆…';
    visible($('#contextAction'),enabled&&story.stage!=='intro');
    $('#contextAction').textContent=busy?'这一段正在发生…':label;
    $('#contextAction').disabled=!enabled||!currentAction();
    $('#contextAction').setAttribute('aria-label',label);
    visible($('#exploreHint'),enabled&&exploring());$('#exploreHint').disabled=!enabled;
    if(!exploreHints)$('#exploreHint').textContent='给我一点线索';
    visible($('#balanceOption'),enabled&&story.stage==='meal');
    const napkinControl=$('#inspectNapkin');
    if(napkinControl){visible(napkinControl,enabled&&story.stage==='eat');napkinControl.disabled=!enabled||story.stage!=='eat';napkinControl.textContent=p.napkin?.userData.used?'看看用过的纸巾':'拿张纸巾';}
    if(!enabled)return;
    if(story.stage==='buy')targets=[target('买餐券 · 18 元',a.clerk,[0,1.8,0],buyCoupon)];
    // The story fork has a fixed, deliberate choice card instead of two
    // overlapping labels attached to the same moving character.
    if(story.stage==='choice')targets=[target('留给他',a.adult,[-.55,1.72,0],chooseKeep),target('先收起来',a.adult,[.55,1.72,0],pauseAtDoor)];
    if(story.stage==='doorway')targets=[target('回去，把券留下',a.adult,[-.55,1.72,0],chooseKeep),target('走出店门',a.adult,[.55,1.72,0],leaveWithCoupon)];
    if(story.stage==='adult')targets=[target('放到书包旁',p.dropSpot||p.bag,[0,.38,0],()=>dropCoupon(true))];
    if(exploring()&&nearby)targets=[target(nearby.label,nearby.object,[0,.28,0],nearby.action)];
    if(story.stage==='meal')targets=[target('端到窗边',p.table,[0,1.15,0],carryMeal)];
    if(story.stage==='eat')targets=[target(eaten?'吃第一口':'打开纸盒',p.meal,[0,.7,0],eaten?finishMeal:openMeal)];
    for(const t of targets){const b=document.createElement('button');b.className=choosing()?'target choice-option':'target';b.setAttribute('aria-label',t.label);b.innerHTML='<span class="num">'+stages[story.stage].n+'</span>'+t.label;
      b.addEventListener('click',()=>perform(t.action));t.button=b;$('#targets').appendChild(b);}
  }
  function modeUI(){
    $('body').setAttribute('data-film',String(demo));
    $('#modeTag').textContent=demo?'自动演绎':'亲自游玩';
    $('#modeSwitch').textContent=pendingMode===null?(demo?'改为亲自游玩':'改为自动演绎'):(pendingMode?'即将自动演绎':'即将交还操作');
    $('#modeSwitch').setAttribute('aria-pressed',String(demo));
    $('#modeSwitch').disabled=endingReady;
    $('#modeNote').textContent=pendingMode!==null?'这段动作结束后切换；故事会从这里继续。':!demo&&['doorway','leave'].includes(story.stage)?'自动体验会接回留券主线；亲自游玩可以继续停留与探索。':demo?'镜头会带你走完这段记忆；随时可以接过操作。':exploring()?'点击空地行走 · 远处物件先走近 · E 只操作附近物件':'点击场景探索 · 点击空地或 WASD 行走 · E 执行当前行动';
    visible($('#readOn'),!!finishSpeech&&!demo);
    visible($('#help'),started&&!demo&&!busy&&!endingReady&&story.stage!=='intro');
    visible($('#role'),started&&!demo&&!busy&&!endingReady);
  }
  function applyMode(next){cancelWalk();demo=next;pendingMode=null;keys.clear();autoPending=false;autoAt=time+.8;modeUI();fitCamera();hud();}
  async function endAction(){
    if(pendingMode!==null)applyMode(pendingMode);
    if(!demo&&!endingReady)await overview();
    if(pendingMode!==null){applyMode(pendingMode);if(!demo&&!endingReady)await overview();}
    busy=false;fitCamera();modeUI();hud();refreshTargets();autoAt=time+(demo?.5:1.8);
  }
  async function perform(action){if(!action||busy||paused||finishSpeech||story.stage==='done')return;busy=true;keys.clear();cancelWalk();autoPending=false;fitCamera();modeUI();hud();refreshTargets();
    try{await action();}catch(error){console.error(error);toast('这一段没有完成，请再试一次。',6);}finally{await endAction();}}
  async function requestMode(){
    if(!started||endingReady)return;
    const next=!(pendingMode===null?demo:pendingMode);
    if(trayRun){
      pendingMode=next===demo?null:next;
      trayRun.assisted=pendingMode===true;clearTrayInput();modeUI();return;
    }
    if(busy||paused||finishSpeech){pendingMode=next===demo?null:next;modeUI();return;}
    busy=true;cancelWalk();applyMode(next);await endAction();
  }
  $('#contextAction').onclick=()=>perform(currentAction());
  $('#modeSwitch').onclick=requestMode;
  if($('#inspectNapkin'))$('#inspectNapkin').onclick=()=>perform(useNapkin);
  $('#balanceOption').onclick=()=>{if(story.stage==='meal'&&!busy&&!paused){trayRequested=true;perform(carryMeal);}};
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
    await shot([.02,1.75,-2.03],[.64,1.5,-1.4]);
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
    foley('paper');bought=true;
    choiceMemory=[a.adult,a.child].map(actor=>({actor,position:actor.position.clone(),rotation:actor.rotation.clone(),pose:actor.userData.pose}));
    advance('choice');await overview();
    if(!demo)toast('券已经在你手里。接下来怎么做？',4);
  }
  async function chooseKeep(){
    if(!['choice','doorway'].includes(story.stage)||!bought)return;
    p.coupon.visible=true;gaze(a.adult,null);
    advance('adult');
    if(!demo)toast('走近书包，把券放在他能看见的地方。',3.5);
  }
  async function pauseAtDoor(){
    if(story.stage!=='choice'||!bought)return;
    p.coupon.visible=false;world.pose(a.adult,'idle');gaze(a.adult,null);foley('paper');
    await shot([.4,2.05,1.1],[2.65,1.05,2.65]);
    if(!await walk(a.adult,{x:2.55,z:2.75},1.55)){p.coupon.visible=true;return;}
    face(a.adult,a.child.position);gaze(a.adult,a.child.userData.head);world.pose(a.adult,'hesitate');
    await wait(.7);advance('doorway');
  }
  async function leaveWithCoupon(){
    if(story.stage!=='doorway'||!bought)return;
    gaze(a.adult,null);
    if(!await walk(a.adult,{x:3.35,z:2.9},1.65))return;
    foley('door');
    world.release(p.coupon);p.coupon.visible=false;
    await tween(.6,t=>$('#fade').style.opacity=String(t));
    a.adult.visible=false;active=a.child;advance('leave');role('小时候的你');if(world.setMood)world.setMood('child');
    await shot([-1.05,1.42,3.15],[-2.62,.64,1.75]);
    await tween(.6,t=>$('#fade').style.opacity=String(1-t));
    face(a.child,p.bag.position);gaze(a.child,p.bag);world.pose(a.child,'rummage');await wait(1.2);
    if(await walk(a.child,{x:-3.7,z:2.05},1.25)){
      face(a.child,p.window.position);gaze(a.child,p.window);
      await shot([-.8,1.7,3.15],[-3.3,1.02,1.9]);
    }
    gaze(a.clerk,a.child.userData.head);await speak('店员','雨还大，再等一会儿吧。',2.7);
    gaze(a.child,a.clerk.userData.head);await speak('孩子','嗯。',1.5);
    gaze(a.child,null);gaze(a.clerk,null);world.pose(a.child,'idle');
    // The memory stays playable. No ending panel, lost progress or forced replay.
  }
  async function revisitChoice(){
    if(story.stage!=='leave'||!choiceMemory)return;
    await tween(.45,t=>$('#fade').style.opacity=String(t));
    for(const saved of choiceMemory){
      saved.actor.position.copy(saved.position);saved.actor.rotation.copy(saved.rotation);
      saved.actor.visible=true;world.pose(saved.actor,saved.pose);gaze(saved.actor,null);
    }
    gaze(a.clerk,null);world.pose(a.clerk,'idle');
    active=a.adult;world.hold(a.adult,p.coupon);role('成年后的你');
    if(world.setMood)world.setMood('adult');advance('choice');
    await shot([3.15,2.05,-.05],[.55,1.2,-1.85]);
    await tween(.45,t=>$('#fade').style.opacity=String(1-t));
    if(!demo)toast('回到刚买好券的时候。餐券还在，不用重新购买。',3.5);
  }
  function placePoint(){
    const x=active.position.x,z=active.position.z;
    for(const turn of [0,.7,-.7,1.5,-1.5,Math.PI]){
      const v=new T.Vector3(x+Math.sin(active.rotation.y+turn)*.4,.055,z+Math.cos(active.rotation.y+turn)*.4);
      if(distance(v,dropZone)<=dropZone.radius&&nav.clear(v.x,v.z)&&reachableApproach(a.child,v))return v;
    }
    return new T.Vector3(dropZone.x,.055,dropZone.z);
  }
  async function dropCoupon(autoApproach=true){
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
    a.adult.visible=false;active=a.child;
    // A short memory cut begins exploration by the menu, not standing on the
    // answer. The voucher stays exactly where the adult left it.
    a.child.position.set(.64,0,-1.38);world.pose(a.child,'idle');face(a.child,p.menu.position);
    advance('child');role('小时候的你');if(world.setMood)world.setMood('child');
    camera.position.set(5.8,5.6,8.8);focus.set(-1.0,.6,.35);camera.lookAt(focus);
    await shot([2.7,2.1,2.5],[.1,.8,-.35]);
    await tween(.6,t=>$('#fade').style.opacity=String(1-t));
    await wait(.5);gaze(a.child,null);
    if(demo)await speak('孩子','那边是不是落了张纸？',2);
  }
  async function pickCoupon(){
    if(story.stage!=='child')return;
    if(!demo&&(!couponSeen||!exploreNear(p.coupon)))return;
    if(demo&&!await approach(a.child,dropPoint,.43)){toast('换一条路靠近餐券。');return;}
    await shot([dropPoint.x+.95,.72,dropPoint.z+.8],[dropPoint.x,.20,dropPoint.z]);
    world.pose(a.child,'reach');const from=pos(p.coupon);
    await tween(.8,t=>{a.child.userData.body.rotation.x=Math.sin(t*Math.PI)*.45;p.coupon.position.lerpVectors(from,a.child.position.clone().add(new T.Vector3(0,.78,.28)),ease(t));});
    a.child.userData.body.rotation.x=0;world.hold(a.child,p.coupon);foley('paper');
    face(a.child,p.found.position);world.pose(a.child,'inspect');gaze(a.child,p.coupon);
    await portrait(a.child,-1);
    await wait(1.6);
    gaze(a.child,p.menu);await shot([1.1,2.45,-1.35],[.28,2.48,-3.64]);await wait(1.25);
    await portrait(a.child,-1);world.pose(a.child,'hesitate');gaze(a.child,p.coupon);await wait(1.5);
    gaze(a.child,a.clerk.userData.head);await wait(1.1);
    await overview();
    advance('return');
  }
  async function returnCoupon(){
    if(story.stage!=='return')return;
    if(!demo&&!exploreNear(p.lostProperty))return;
    if(demo&&!await walk(a.child,p.returnApproach))return;
    face(a.child,pos(p.returnPoint));gaze(a.child,p.returnPoint);
    await shot([-1.65,1.7,-.25],[-.6,1.0,-2.03]);
    const from=pos(p.coupon),placed=pos(p.returnPoint);world.release(p.coupon);
    world.pose(a.child,'reach');
    await tween(.7,t=>{p.coupon.position.lerpVectors(from,placed,ease(t));p.coupon.rotation.set(0,.12,0);});
    p.returnPoint.attach(p.coupon);p.coupon.position.set(0,0,0);world.pose(a.child,'idle');foley('paper');visible($('#inventory'),false);
    gaze(a.clerk,p.returnPoint);face(a.clerk,a.child.position);await wait(.65);
    await speak('孩子','阿姨，这张是我在地上捡到的。我放这里了。',3.2);
    const clerkStart=a.clerk.position.clone(),clerkPickup=new T.Vector3(-.60,0,-2.65);
    face(a.clerk,clerkPickup);world.pose(a.clerk,'walk');
    await tween(.9,t=>a.clerk.position.lerpVectors(clerkStart,clerkPickup,ease(t)));
    face(a.clerk,a.child.position);world.pose(a.clerk,'reach');gaze(a.clerk,p.coupon);
    const onTray=pos(p.coupon);world.hold(a.clerk,p.coupon);const hand=pos(p.coupon);world.release(p.coupon);p.coupon.position.copy(onTray);
    await tween(.7,t=>p.coupon.position.lerpVectors(onTray,hand,ease(t)));world.hold(a.clerk,p.coupon);
    visible($('#inventory'),false);
    gaze(a.clerk,new T.Vector3(3.35,1.4,2.9));
    await shot([1.48,1.72,-1.2],[.8,1.48,-2.9]);
    await speak('店员','好。有人来问，我替他还回去。',2.5);
    face(a.clerk,clerkStart);world.pose(a.clerk,'walk');
    await tween(.9,t=>a.clerk.position.lerpVectors(clerkPickup,clerkStart,ease(t)));
    face(a.clerk,a.child.position);world.pose(a.clerk,'idle');
    gaze(a.clerk,p.coupon);
    await shot([1.9,.86,-3.66],[1.1,.73,-3.12]);
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
    // Leave the handover close-up before the exchange continues, keeping both
    // faces in the conversation instead of holding on the counter and tray.
    await shot([3.15,2.05,-.05],[.55,1.2,-1.85]);
    await speak('孩子','谢谢阿姨。',2.2);
    await speak('店员','在这儿吃，还是带走？',2.6);
    await speak('孩子','在这儿。',1.8);
    if(world.setMood)world.setMood('meal');advance('meal');await overview();
  }
  async function carryMeal(){
    if(story.stage!=='meal')return;
    if(demo||!trayRequested){
      await shot([.7,1.8,2.6],[-2.25,.92,-.10]);
      if(!await walk(a.child,{x:-2.65,z:.8},1.35))return;
    }else if(!await balanceTray())return;
    trayRequested=false;
    face(a.child,p.table.position);world.pose(a.child,'carry');
    const from=pos(p.meal),to=new T.Vector3(-2.65,.84,-.30);world.release(p.meal);
    await tween(.75,t=>{p.meal.position.lerpVectors(from,to,ease(t));p.meal.rotation.y*=1-t;});p.meal.rotation.set(0,0,0);foley('tray');
    world.pose(a.child,'idle');
    if(!await sitAtTable())return;
    await shot([-3.9,1.58,.9],[-2.15,.98,-.35]);
    advance('eat');await wait(.6);
  }
  function clearTrayInput(){
    keys.clear();
    if(trayRun){trayRun.axis=0;trayRun.resting=false;}
    $('#traySteer').value='0';$('#trayRest').setAttribute('aria-pressed','false');
  }
  function assistTray(){if(!trayRun||paused)return;trayRun.assisted=true;clearTrayInput();}
  $('#trayAssist').onclick=assistTray;
  $('#trayRest').onclick=()=>{if(trayRun&&!paused&&!trayRun.assisted){trayRun.resting=!trayRun.resting;$('#trayRest').setAttribute('aria-pressed',String(trayRun.resting));}};
  $('#traySteer').addEventListener('input',e=>{if(trayRun&&!paused&&!trayRun.assisted)trayRun.axis=Number(e.target.value)/100;});
  for(const event of ['change','pointerup','pointercancel','blur'])$('#traySteer').addEventListener(event,()=>{
    if(trayRun)trayRun.axis=0;$('#traySteer').value='0';
  });
  function trayCamera(dt=0){
    const actor=a.child,angle=actor.rotation.y;
    const forward=new T.Vector3(Math.sin(angle),0,Math.cos(angle)),right=new T.Vector3(forward.z,0,-forward.x);
    const look=actor.position.clone().addScaledVector(forward,.72);look.y=.36;
    const eye=actor.position.clone().addScaledVector(forward,-.72).addScaledVector(right,.95);eye.y=2.15;
    const blend=dt?1-Math.exp(-dt*4):1;
    camera.position.lerp(eye,blend);focus.lerp(look,blend);camera.lookAt(focus);
  }
  async function balanceTray(){
    // Movement uses the restaurant's actual collision-safe path. Balance is
    // independent of story progression: a wobble stops feet, never removes food.
    const path=nav.route(a.child.position,{x:-2.65,z:.8});
    if(!path)return false;
    let total=0,previous=a.child.position;
    for(const point of path){total+=distance(previous,point);previous=point;}
    cancelWalk();gaze(a.child,p.meal);clearTrayInput();
    face(a.child,path[0]);world.pose(a.child,'carry');trayCamera();
    visible($('#inventory'),false);visible($('#toast'),false);visible($('#trayPanel'),true);
    $('body').setAttribute('data-tray','true');$('#traySteer').disabled=false;$('#trayRest').disabled=false;
    const result=await new Promise(resolve=>{
      trayRun={path,index:0,total,covered:0,model:GiftBalance.create(),axis:0,resting:false,assisted:pendingMode===true,resolve,lastCatches:0};
    });
    clearTrayInput();trayRun=null;visible($('#trayPanel'),false);$('body').setAttribute('data-tray','false');
    world.setTrayBalance(a.child,{roll:0,pitch:0,slip:0});world.pose(a.child,'carry');
    return result;
  }
  function updateTray(dt){
    const run=trayRun;if(!run)return;
    const actor=a.child,goal=run.path[run.index],v=actor.position;
    const dx=goal.x-v.x,dz=goal.z-v.z,len=Math.hypot(dx,dz),desired=Math.atan2(dx,dz);
    const angle=Math.atan2(Math.sin(desired-actor.rotation.y),Math.cos(desired-actor.rotation.y));
    const axis=keys.has('KeyD')||keys.has('ArrowRight')?1:keys.has('KeyA')||keys.has('ArrowLeft')?-1:run.axis;
    const rest=run.resting||keys.has('Space');
    const state=run.model.step(dt,{axis,resting:rest,assisted:run.assisted,turn:T.MathUtils.clamp(angle,-1,1)});
    const travel=Math.min(len,(run.assisted?.85:.24)*state.speed*dt);
    if(travel>0){
      v.x+=dx/len*travel;v.z+=dz/len*travel;run.covered+=travel;
      actor.rotation.y+=angle*Math.min(1,dt*3.5);
      if(actor.userData.pose!=='walk')world.pose(actor,'walk');
      if(time>footstepAt){foley('step');footstepAt=time+.62;}
    }else if(actor.userData.pose!=='carry')world.pose(actor,'carry');
    world.setTrayBalance(actor,{roll:state.roll*.8,pitch:state.pitch,slip:state.slip});trayCamera(dt);
    if(state.catches>run.lastCatches){run.lastCatches=state.catches;foley('tray');}
    const text=run.assisted?'放慢脚步，稳稳地端过去。':state.recovering?'先停一下。扶稳了，再走。':rest?'停稳了。松开空格，或点「继续走」。':state.elapsed<2.5?'左右拖动扶稳餐盘，也可以用 A / D。':Math.abs(state.roll)>.12?(state.roll>0?'轻轻向右扶，把餐盘放平。':'轻轻向左扶，把餐盘放平。'):'稳住。窗边就在前面。';
    if($('#trayStatus').textContent!==text)$('#trayStatus').textContent=text;
    $('#trayPanel').setAttribute('data-recovering',String(state.recovering));
    $('#trayNeedle').style.transform='translateX(-50%) rotate('+(state.roll*180/Math.PI)+'deg)';
    $('#trayProgress').value=Math.min(1,run.covered/run.total);
    $('#trayRest').textContent=run.resting?'继续走':'停一步';
    $('#trayRest').disabled=run.assisted;$('#traySteer').disabled=run.assisted;$('#trayAssist').disabled=run.assisted;
    $('#trayAssist').textContent=run.assisted?'正在帮你端过去…':'帮我端过去';
    if(len<=travel+.00001){run.index++;if(run.index===run.path.length){run.resolve(true);trayRun=null;}}
  }
  async function sitAtTable(){
    if(distance(a.child.position,diningSeat)<.05&&['sit','sitEat'].includes(a.child.userData.pose))return true;
    if(!await walk(a.child,chairApproach,1.35))return false;
    face(a.child,p.table.position);const from=a.child.position.clone();
    world.pose(a.child,'sit');await tween(.8,t=>a.child.position.lerpVectors(from,diningSeat,ease(t)));
    a.child.rotation.y=-Math.PI/2;gaze(a.child,p.meal);return true;
  }
  async function openMeal(){
    if(story.stage!=='eat'||eaten)return;
    if(!await sitAtTable())return;
    const lid=p.lid,from=lid.position.clone();
    // Hinge the lid on its rear lower edge. The pivot is expressed in lid
    // local units and scaled with the lid, then the translation compensates
    // the rotated pivot so it stays fixed on the meal tray while opening.
    const hinge=new T.Vector3(0,0,-.205).multiply(lid.scale);
    world.pose(a.child,'sit');gaze(a.child,p.meal);
    await shot([-3.4,1.82,.56],[-2.55,.94,-.28]);
    await tween(1.25,t=>{
      const angle=-1.45*ease(t),rotated=hinge.clone().applyEuler(new T.Euler(angle,0,0));
      lid.rotation.x=angle;lid.position.copy(from).add(hinge).sub(rotated);
    });
    eaten=true;world.pose(a.child,'sit');foley('paper');$('#instruction').textContent='点击汉堡，吃下第一口。';
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
    // Stay with the child. A second walk around the furniture used to dilute
    // the first bite and made the ending feel like another task.
    await shot([-3.75,1.75,2.6],[-2.38,1.0,-.4],1.3);await wait(.5);
    advance('done');showEnding();
  }
  function showEnding(){
    endingReady=true;visible($('#chapterMenu'),true);visible($('#hud'),false);visible($('#help'),false);visible($('#role'),false);visible($('#inventory'),false);visible($('#ending'),true);
    $('#pause').disabled=true;modeUI();refreshTargets();
    const eyebrow=$('#ending .eyebrow'),title=$('#ending h2'),copy=$('#ending p');
    eyebrow.textContent='第一幕完';title.textContent='窗边的位置';copy.textContent='雨还在下。那张券回到了该去的地方，餐盒里还冒着热气。';
  }
  async function finishMeal(){
    if(story.stage!=='eat'||!eaten)return;
    if(!await sitAtTable())return;
    await seatedFirstBite();
  }
  async function establish(){
    busy=true;refreshTargets();a.adult.visible=false;world.pose(a.child,'shy');face(a.child,a.customer.position);
    role('一个下雨的下午');
    await shot([.3,1.65,3.35],[-2.7,.83,1.6]);
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
    await shot([.02,1.53,-2.08],[.64,1.06,-1.4]);
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
    role('成年后的你');advance('buy');await endAction();autoAt=time+1;
  }
  async function start(auto,excerpt=false){
    if(started)return;
    started=true;demo=auto;visible($('#intro'),false);visible($('#toolbar'),true);
    busy=true;modeUI();hud();fitCamera();
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
      if(excerpt==='explore'){
        a.adult.visible=false;a.customer.visible=false;lastCustomerLeft=true;bought=true;active=a.child;
        a.child.position.set(.64,0,-1.38);role('小时候的你');world.pose(a.child,'idle');gaze(a.child,null);
        p.coupon.position.copy(dropPoint);p.coupon.rotation.set(0,.2,0);p.coupon.visible=true;
        for(const stage of ['buy','choice','adult','child'])advance(stage);
        world.setMood('child');await endAction();
      }else if(excerpt){
        // A visible chapter excerpt, also useful for replaying the skill segment.
        // Its setup preserves the returned voucher and the independent staff meal.
        a.adult.visible=false;a.customer.visible=false;lastCustomerLeft=true;bought=true;active=a.child;
        a.child.position.set(.3,0,-.8);role('小时候的你');
        for(const stage of ['buy','choice','adult','child','return'])advance(stage);
        await shot([3.15,2.05,-.05],[.55,1.2,-1.85]);
        world.stowCoupon(p.coupon);world.recordStaffMeal();await wait(1.6);
        world.hold(a.child,p.meal);world.setMood('meal');advance('meal');
        trayRequested=true;await carryMeal();await endAction();
      }else await establish();
    }catch(error){
      console.error(error);toast('加载故事时遇到了问题，请重新开始。',10);busy=false;
    }finally{visible($('#loading'),false);}
  }
  function setPause(value){if(!started||endingReady)return;paused=value;clearTrayInput();visible($('#pausePanel'),value);$('#pause').textContent=value?'继续':'暂停';$('#pause').setAttribute('aria-label',value?'继续':'暂停');refreshTargets();if(!value&&!busy&&pendingMode!==null){busy=true;applyMode(pendingMode);endAction();}if(ambientGain)ambientGain.gain.setTargetAtTime(value?0:soundEnabled?.035:0,audioCtx.currentTime,.2);}
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
  // Both launch buttons enter the same story state machine.
  $('#play').onclick=()=>start(false);$('#demo').onclick=()=>start(true);
  $('#tryTray').onclick=()=>start(false,true);
  $('#tryExplore').onclick=()=>start(false,'explore');
  $('#pause').onclick=()=>setPause(!paused);$('#resume').onclick=()=>setPause(false);
  for(const id of ['restart','pauseRestart','again'])$('#'+id).onclick=()=>location.reload();
  function showChapters(){visible($('#ending'),false);visible($('#hud'),false);visible($('#chapterPanel'),true);}
  $('#chapters').onclick=showChapters;$('#chapterMenu').onclick=showChapters;
  $('#backToScene').onclick=()=>{visible($('#chapterPanel'),false);visible($('#ending'),true);};
  function showUnavailable(){visible($('#chapterUnavailable'),true);}
  function closeUnavailable(){visible($('#chapterUnavailable'),false);}
  $('#act2').onclick=showUnavailable;$('#chapterAct2').onclick=showUnavailable;$('#closeUnavailable').onclick=closeUnavailable;
  $('#linger').onclick=()=>{visible($('#ending'),false);visible($('#hud'),!demo);$('#chapter').textContent='第一幕完';$('#objective').textContent='窗边的位置';$('#instruction').textContent='右上角可以查看章节，或重新开始。';if(!demo)cameraTo([2.4,3.8,5.5],[-2.4,.7,-.3],1.5);};
  const selectable=[p.coupon,p.lostProperty,p.tableReceipt,p.counterNote,p.found,p.table,p.meal,p.menu,p.bag,p.coins,p.window,p.sideTable,p.napkin,p.napkinBox,a.child,a.clerk,a.customer].filter(Boolean);
  const names=new Map([[p.coupon,'儿童套餐券'],[p.found,'柜台'],[p.table,'窗边餐桌'],[p.meal,'热乎乎的套餐'],[p.menu,'菜单'],[p.bag,'旧书包'],[p.coins,'两枚硬币'],[p.window,'窗外的雨'],[a.child,'小时候的自己'],[a.clerk,'店员'],[a.customer,'排队的顾客'],[p.sideTable,'刚空下来的座位'],[p.napkin,'纸巾'],[p.napkinBox,'纸巾盒']]);
  function pick(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
    const hits=ray.intersectObjects(scene.children,true);for(const h of hits){let o=h.object,isVisible=true;while(o){if(!o.visible)isVisible=false;o=o.parent;}if(!isVisible)continue;
      o=h.object;while(o){if(selectable.includes(o))return {object:o,point:h.point};o=o.parent;}
      if(h.object.material?.transparent)continue;
      // Opaque furniture blocks interactions with objects behind it.
      break;
    }const at=new T.Vector3();return ray.ray.intersectPlane(plane,at)?{object:null,point:at}:null;}
  function objectAction(object){
    if(exploring())return explorationAction(object);
    if((object===p.napkin||object===p.napkinBox)&&story.stage==='eat')return {label:p.napkin.userData.used?'看看用过的纸巾':'拿张纸巾',action:useNapkin};
    if((object===a.clerk||object===p.found)&&story.stage==='buy')return {label:'买餐券 · 18 元',action:buyCoupon};
    if(object===p.bag&&story.stage==='adult')return {label:'放到书包旁',action:()=>dropCoupon(true)};
    if(object===p.coupon&&story.stage==='child')return {label:'捡起餐券',action:pickCoupon};
    if(object===p.lostProperty&&story.stage==='return')return {label:'放入失物招领托盘',action:returnCoupon};
    if(object===p.table&&story.stage==='meal')return {label:'端到窗边坐下',action:carryMeal};
    if((object===p.meal||object===p.table)&&story.stage==='eat')return {label:eaten?'吃第一口':'打开纸盒',action:eaten?finishMeal:openMeal};
    return null;
  }
  async function useNapkin(){
    if(story.stage!=='eat'||active!==a.child||!p.napkin||a.child.userData.held)return;
    const paper=p.napkin;
    if(paper.userData.used){
      gaze(a.child,paper);await speak('孩子','这张用过的折在一边，别碰到吃的。',2.5);gaze(a.child,null);return;
    }
    // Use the real table prop exactly once. The meal stays in place while the
    // child approaches the clear edge of the table, then returns to the chair.
    if(!await walk(a.child,{x:-2.24,z:-1.30},1.3))return;
    face(a.child,pos(paper));gaze(a.child,paper);world.pose(a.child,'reach');
    await shot([-.55,1.65,-.18],[-2.17,.89,-.96]);
    const home=pos(paper),homeRotation=paper.getWorldQuaternion(new T.Quaternion());
    world.hold(a.child,paper);const hand=pos(paper);world.release(paper);paper.position.copy(home);
    await tween(.7,t=>paper.position.lerpVectors(home,hand,ease(t)));
    world.hold(a.child,paper);world.pose(a.child,'wipe');gaze(a.child,null);foley('paper');
    await wait(1.35);await speak('孩子','纸巾就在杯子旁边。用一张就够了。',2.6);
    world.pose(a.child,'reach');await wait(.3);
    const used=pos(paper);world.release(paper);
    await tween(.7,t=>{paper.position.lerpVectors(used,home,ease(t));paper.quaternion.slerp(homeRotation,t);});
    // A small permanent crease makes the used state visible without spawning
    // a second sheet or changing the napkin's world size.
    paper.traverse(part=>{if(!part.isMesh||!part.geometry?.attributes.position)return;
      part.geometry=part.geometry.clone();const vertices=part.geometry.attributes.position;
      for(let i=0;i<vertices.count;i++){const x=vertices.getX(i);if(x>0){vertices.setX(i,x*Math.cos(.55));vertices.setZ(i,vertices.getZ(i)+x*Math.sin(.55));}}
      vertices.needsUpdate=true;part.geometry.computeVertexNormals();
    });
    paper.rotation.set(0,.62,0);paper.userData.used=true;foley('paper');
    await wait(.4);await sitAtTable();
  }
  function observation(object){
    const adult=active===a.adult,speaker=adult?'成年后的你':'孩子';
    if(object===p.lostProperty)return {label:'看看失物招领处',point:p.returnApproach,pose:'inspect',speaker:'失物招领',line:story.stage==='return'?'小牌上写着「失物招领」。把餐券放进这个托盘，等失主回来。':'这里收着客人忘拿的东西，旁边夹着一张登记表。'};
    if(object===p.menu)return {label:'读一读菜单',point:{x:.62,z:-1.38},pose:'inspect',speaker:'菜单',line:adult?'汉堡十二，套餐十八。那年记了很久的两个数字，还印在这里。':'汉堡十二，套餐十八。来回看了两遍，价钱没有变。'};
    if(object===p.bag)return {label:'看看旧书包',point:{x:-2.15,z:2.12},pose:'rummage',speaker,line:adult?'拉链头绑着一截鞋带。后来换了几个书包，还是记得它卡住的手感。':story.stage==='child'?'书包边有张黄色的纸，刚才好像还没有。':'捏住拉链两边，慢慢往回退一点。作业本的边角已经潮了。'};
    if(object===p.window)return {label:'听一会儿雨',point:{x:-3.7,z:2.05},pose:'idle',speaker:'窗外',line:'水痕沿着玻璃慢慢滑下来。隔着一扇窗，街上的车声也轻了。'};
    if(object===p.sideTable)return {label:'看看刚空下的座位',point:{x:2.15,z:1.35},pose:'reach',speaker:'桌面',line:'杯子留下浅浅一圈水印。椅子还没推回去，刚才的人已经走进雨里。'};
    if(object===p.table)return {label:'看看窗边的位置',point:{x:-2.65,z:.8},pose:'idle',speaker:'窗边',line:'桌角被很多人的袖口磨得发亮。坐在这里，正好能看到玻璃上的雨。'};
    if(object===a.clerk)return {label:'和店员说句话',point:{x:.62,z:-1.38},pose:'confirm',speaker:'店员',line:adult?'外面的雨还没停。要躲一会儿，就坐下吧。':story.stage==='return'?'捡到的东西，放左手边写着「失物招领」的小托盘就好。':story.stage==='child'?'找东西吗？看看窗边座位，刚才有人从那边走。':'先坐一会儿，不着急。'};
    if(object===p.found)return {label:'看看取餐口',point:{x:.62,z:-1.38},pose:'inspect',speaker:'取餐口',line:'这里是取餐的地方。失物招领在柜台左侧，另有一个小托盘。'};
    if(object===a.child)return {label:adult?'看看小时候的自己':'想起书包的拉链',point:adult?{x:-1.94,z:1.54}:null,pose:'hesitate',speaker,line:adult?'袖口还是那道补过的线。他把手缩进去，装作只是在等雨停。':'拉链又卡住了。等雨小一点，就该回去了。'};
    if(object===p.coins)return {label:'看看两枚硬币',pose:'countCoins',speaker:'两枚硬币',line:'来回数了好几遍，还是两块钱。硬币被手心捂得有一点热。'};
    if(object===p.coupon)return {label:'看看手里的餐券',pose:'inspect',speaker:'餐券',line:'刚付过钱的儿童套餐券。薄薄一张纸，这一次可以由你决定把它留在哪里。'};
    if(object===p.meal)return {label:'看看热餐',pose:'inspect',speaker:'餐盒',line:story.stage==='meal'?'纸盒是暖的。走稳一点，把它端到窗边。':'柜台后面的纸盒还没有打开。热气在盖子边缘结成细小的水珠。'};
    if(object===p.napkin||object===p.napkinBox)return {label:'看看纸巾',point:{x:-1.09,z:-1.06},pose:'reach',speaker:'纸巾',line:'纸巾就在杯子旁边。店员把最上面的一张折出一个小角，方便抽出来。'};
    return {label:'看一看',pose:'idle',speaker:names.get(object)||'记忆',line:'这间小店里，时间好像走得慢一点。'};
  }
  async function inspectPaper(object){
    if(!exploring()||!exploreNear(object))return;
    face(active,pos(object));gaze(active,object);world.pose(active,'inspect');foley('paper');
    const point=pos(object);
    await shot([point.x+.15,point.y+.8,point.z+.66],[point.x,point.y,point.z]);
    const voucher=object===p.coupon;
    if(voucher)couponSeen=true;
    await speak(voucher?'餐券':object===p.tableReceipt?'结账小票':'取餐单',voucher?'儿童套餐券，今天还能用。背面没有名字。':object===p.tableReceipt?'汉堡一份，汽水一杯。盖了「已结账」，这张是小票。':'取餐号 16，已经取走了。不是餐券。',2.4);
    world.pose(active,'idle');gaze(active,null);hud();
  }
  async function inspectObject(object){
    const info=observation(object),seated=['sit','sitEat'].includes(active.userData.pose);
    if(exploring()){
      if(!exploreNear(object))return;
      gaze(active,object);world.pose(active,info.pose);
      if(object===a.clerk){gaze(a.clerk,active.userData.head);world.pose(a.clerk,'confirm');}
      await speak(info.speaker,info.line,2.5);gaze(active,null);world.pose(active,'idle');
      if(object===a.clerk){gaze(a.clerk,null);world.pose(a.clerk,'idle');}return;
    }
    if(info.point){if(!await walk(active,info.point,1.4))return;}
    else if(object!==active&&object!==active.userData.held&&!seated){
      const point=pos(object),near=reachableApproach(active,point,.8);
      if(near&&!await walk(active,near,1.4))return;
    }
    if(object!==active&&!['sit','sitEat'].includes(active.userData.pose))face(active,pos(object));
    const pose=['sit','sitEat'].includes(active.userData.pose)?'sit':info.pose;
    world.pose(active,pose);gaze(active,object===active?p.bag:object);
    const center=active.position.clone(),look=center.clone().add(new T.Vector3(0,.9,0));
    await cameraTo([center.x+2.7,2.25,center.z+3.4],look.toArray(),.65);
    if(world.inspectObject)world.inspectObject(object);
    if(object===a.clerk){gaze(a.clerk,active.userData.head);world.pose(a.clerk,'confirm');}
    if(object===p.bag||object===p.coupon||object===p.menu)foley('paper');
    await wait(.55);await speak(info.speaker,info.line,4.1);
    gaze(active,null);world.pose(active,pose==='sit'?'sit':active.userData.held?.userData.isMeal?'carry':'idle');
    if(object===a.clerk){gaze(a.clerk,null);world.pose(a.clerk,'idle');}
  }
  function interactObject(object){
    if(exploring()&&!exploreNear(object)){
      let point=explorePoint(object);
      if(object===p.coupon)point=reachableApproach(active,point,.5);
      if(point&&nav.clear(point.x,point.z)){beginFloorWalk(point);toast('走近以后，再点击物件或按 E。',2);}return;
    }
    const action=objectAction(object);return perform(action?action.action:()=>inspectObject(object));
  }
  async function beginFloorWalk(point){
    if(['sit','sitEat'].includes(active.userData.pose)){
      busy=true;refreshTargets();await leaveSeat(active);await endAction();
      if(demo||paused)return;
    }
    walk(active,point);moveMarker.position.set(point.x,.034,point.z);moveMarker.visible=true;
  }
  renderer.domElement.addEventListener('pointerdown',e=>{if(!started||demo||busy||paused||finishSpeech||story.stage==='done')return;const hit=pick(e);if(!hit)return;
    if(hit.object)interactObject(hit.object);else if(nav.clear(hit.point.x,hit.point.z)){beginFloorWalk(hit.point);}else toast('桌椅不能穿过，点击空地行走。');});
  renderer.domElement.addEventListener('pointermove',e=>{cursor={x:e.clientX,y:e.clientY};if(!started||busy||paused||demo||story.stage==='done')return;const hit=pick(e);hoverObject=hit?.object;visible($('#hover'),!!hoverObject);renderer.domElement.style.cursor=hoverObject?'pointer':'default';if(hoverObject){$('#hover').textContent=(objectAction(hoverObject)?.label||observation(hoverObject).label)+' · 点击';$('#hover').style.left=(e.clientX+14)+'px';$('#hover').style.top=(e.clientY+14)+'px';}});
  renderer.domElement.addEventListener('pointerleave',()=>visible($('#hover'),false));
  addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','Escape'].includes(e.code))e.preventDefault();
    if(trayRun&&['KeyA','KeyD','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();if(!paused&&!trayRun.assisted)keys.add(e.code);return;}
    if(e.repeat)return;if(e.code==='Escape')return setPause(!paused);if(e.code==='Space'&&finishSpeech&&!demo){e.preventDefault();return readOn();}if(!started||busy||paused||finishSpeech||demo||story.stage==='done')return;
    if(e.code==='KeyE')return perform(currentAction());
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){cancelWalk();keys.add(e.code);if(['sit','sitEat'].includes(active.userData.pose)){busy=true;refreshTargets();leaveSeat(active).then(endAction);}}});
  addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{clearTrayInput();if(trayRun)setPause(true);});
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
      if(walking&&time>footstepAt){foley('step');footstepAt=time+.37;}updateMovement(dt);updateTray(dt);if(!walking&&!keys.size&&!busy&&active.userData.pose==='walk')world.pose(active,'idle');world.update(dt,time);
      if(exploring()&&!busy){const key=story.stage+':'+(nearbyExploration()?.label||'')+':'+demo+':'+busy+':'+paused;if(key!==exploreKey)refreshTargets();}
      if(started&&demo&&!busy&&!autoPending&&story.stage!=='done'&&time>autoAt){autoPending=true;perform(async()=>{if(choosing())await chooseKeep();else{const action=currentAction();if(action)await action();}});}
    }
    activeMarker.visible=started&&!demo&&!busy&&!paused&&story.stage!=='done';activeMarker.position.set(active.position.x,.035,active.position.z);
    const current=story.stage==='buy'?p.found:story.stage==='adult'?p.dropSpot:story.stage==='child'?p.coupon:story.stage==='return'?p.lostProperty:story.stage==='meal'?p.table:story.stage==='eat'?p.meal:null;
    goalMarker.visible=!demo&&!!current&&!busy&&!paused&&(!exploring()||time<hintUntil);
    if(current){const v=story.stage==='return'?p.returnApproach:pos(current);goalMarker.position.set(v.x,.04,story.stage==='buy'?-1.38:story.stage==='meal'?.8:v.z);goalMarker.scale.setScalar(1+Math.sin(time*3)*.08);}
    if(world.setLostPropertyActive)world.setLostPropertyActive(story.stage==='return'&&exploreNear(p.lostProperty));
    for(const t of targets){if(choosing())continue;const v=pos(t.object).add(t.offset).project(camera);t.button.style.left=Math.max(110,Math.min(innerWidth-110,(v.x*.5+.5)*innerWidth))+'px';t.button.style.top=Math.max(280,Math.min(innerHeight-115,(-v.y*.5+.5)*innerHeight))+'px';}
    if(busy||paused||demo)visible($('#hover'),false);if(world.setView)world.setView(camera,demo||busy);renderer.render(scene,camera);
  }
  fitCamera();camera.position.copy(view.position);focus.copy(view.target);camera.lookAt(focus);a.adult.visible=false;p.coupon.visible=false;p.meal.position.set(2.0,1.11,-3.31);p.meal.visible=true;p.coins.visible=false;
  face(a.child,new T.Vector3(.5,0,-2));face(a.customer,a.clerk.position);world.pose(a.child,'shy');
  addEventListener('resize',()=>{fitCamera();renderer.setSize(innerWidth,innerHeight);});
  requestAnimationFrame(renderFrame);visible($('#loading'),false);
} catch(error){console.error(error);$('#loading').innerHTML='<span class="loading-mark">暂时没能打开记忆</span><p>请刷新重试。需要支持 WebGL 的浏览器。</p>';}
})();
