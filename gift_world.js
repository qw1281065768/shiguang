/* The memory restaurant. Local, procedural art; no external asset requests. */
(function () {
  'use strict';
  window.buildGiftWorld = function buildGiftWorld(T, scene) {
    const palette = {
      cream: 0xd6ccb8, paper: 0xeee3cc, teal: 0x426562, darkTeal: 0x304b49,
      wood: 0x997455, edge: 0x584c3d, amber: 0xc9a16a, red: 0x99594b,
      metal: 0x9ba3a1, skin: 0xd4a184, dark: 0x364340, ink: 0x4b4435,
    };
    const M = {};
    Object.entries(palette).forEach(([k, color]) => { M[k] = new T.MeshStandardMaterial({color, roughness: .77}); });
    const actors = {}, props = {}, colliders = [];
    const material = (color, extra = {}) => new T.MeshStandardMaterial({color, roughness: .72, ...extra});
    const leafMat = material(0x536d53);
    const blackMat = material(0x262d2b);
    const paleTeal = material(0x5d7871);
    const pink = material(0xb78576);
    const white = material(0xfff8e9);
    const geometryCache = new Map();

    function group(name, xyz = [0, 0, 0], parent = scene) {
      const g = new T.Group(); g.name = name; g.position.set(...xyz); parent.add(g); return g;
    }
    function mesh(geo, mat, xyz = [0, 0, 0], parent = scene, name = '') {
      const o = new T.Mesh(geo, mat); o.position.set(...xyz); o.name = name;
      o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
    }
    function box(w, h, d, xyz, mat = M.cream, parent = scene, name = '') {
      return mesh(new T.BoxGeometry(w, h, d), mat, xyz, parent, name);
    }
    function round(w, h, d, radius, xyz, mat = M.cream, parent = scene, name = '') {
      // A bevel catches light and gives otherwise simple props a finished silhouette.
      const key = [w, h, d, radius].join(',');
      let geometry = geometryCache.get(key);
      if (!geometry) {
        const r = Math.min(radius, w / 3, h / 3, d / 3);
        const shape = new T.Shape();
        shape.moveTo(-w / 2 + r, -h / 2 + r);
        shape.lineTo(w / 2 - r, -h / 2 + r);
        shape.lineTo(w / 2 - r, h / 2 - r);
        shape.lineTo(-w / 2 + r, h / 2 - r);
        shape.closePath();
        geometry = new T.ExtrudeGeometry(shape, {depth: d - 2 * r, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: r, bevelThickness: r, curveSegments: 6});
        geometry.translate(0, 0, -d / 2 + r); geometry.computeVertexNormals(); geometryCache.set(key, geometry);
      }
      return mesh(geometry, mat, xyz, parent, name);
    }
    function sphere(r, xyz, mat, parent = scene, scale = [1, 1, 1]) {
      const s = mesh(new T.SphereGeometry(r, 20, 14), mat, xyz, parent); s.scale.set(...scale); return s;
    }
    function cylinder(top, bottom, height, xyz, mat, parent = scene, segments = 24) {
      return mesh(new T.CylinderGeometry(top, bottom, height, segments), mat, xyz, parent);
    }
    function line(points, radius, mat, parent = scene) {
      const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
      return mesh(new T.TubeGeometry(curve, Math.max(8, points.length * 5), radius, 6, false), mat, [0, 0, 0], parent);
    }
    function canvasTexture(width, height, draw) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      draw(canvas.getContext('2d'), width, height);
      const tex = new T.CanvasTexture(canvas); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      return tex;
    }
    function textTexture(title, subtitle, background = '#f4e8cc', color = '#335851') {
      return canvasTexture(1024, 512, (c, w, h) => {
        c.fillStyle = background; c.fillRect(0, 0, w, h);
        c.strokeStyle = color; c.globalAlpha = .25; c.lineWidth = 3; c.strokeRect(25, 25, w - 50, h - 50); c.globalAlpha = 1;
        c.textAlign = 'center'; c.fillStyle = color; c.font = '600 106px "PingFang SC", "Microsoft YaHei", sans-serif'; c.fillText(title, w / 2, 247);
        c.font = '32px "PingFang SC", sans-serif'; c.fillText(subtitle || '', w / 2, 337);
      });
    }
    function plane(w, h, xyz, texture, parent = scene) {
      return mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({map: texture, roughness: .82, side: T.DoubleSide}), xyz, parent);
    }
    function sign(title, subtitle, w, h, xyz, parent = scene, background, color) {
      round(w + .08, h + .08, .06, .02, xyz, M.edge, parent);
      return plane(w, h, [xyz[0], xyz[1], xyz[2] + .035], textTexture(title, subtitle, background, color), parent);
    }
    function collider(minX, maxX, minZ, maxZ) { colliders.push({minX, maxX, minZ, maxZ}); }

    // Quiet, deterministic surface variation rather than perfectly flat toy colours.
    let noiseSeed=73197;
    const random=()=>{noiseSeed=(Math.imul(noiseSeed,1664525)+1013904223)>>>0;return noiseSeed/4294967296;};
    function surfaceTexture(base, mode='paint') {
      return canvasTexture(512,512,(c,w,h)=>{
        c.fillStyle=base;c.fillRect(0,0,w,h);
        for(let i=0;i<9000;i++){const v=random();c.fillStyle=v>.5?'rgba(255,248,223,.045)':'rgba(39,43,35,.045)';const r=mode==='plaster'?random()*3+.5:random()*1.3+.4;c.fillRect(random()*w,random()*h,r,r);}
        if(mode==='wood'){
          for(let i=0;i<170;i++){const y=random()*h;c.strokeStyle=`rgba(43,31,19,${.02+random()*.10})`;c.lineWidth=.4+random()*1.1;c.beginPath();c.moveTo(0,y);for(let x=0;x<=w;x+=28)c.lineTo(x,y+Math.sin(x*.017+i)*3);c.stroke();}
          for(let i=0;i<6;i++){const y=random()*h;c.strokeStyle='rgba(238,210,165,.12)';c.beginPath();c.moveTo(0,y);c.lineTo(w,y+random()*2);c.stroke();}
        }
        if(mode==='paint'){
          for(let i=0;i<55;i++){c.fillStyle='rgba(171,154,115,.13)';c.fillRect(random()*w,random()*h,random()*22+1,random()*2+.4);}
        }
        if(mode==='tile'){
          const edge=c.createLinearGradient(0,0,0,h);edge.addColorStop(0,'rgba(66,60,50,.15)');edge.addColorStop(.05,'rgba(66,60,50,0)');edge.addColorStop(.95,'rgba(66,60,50,0)');edge.addColorStop(1,'rgba(66,60,50,.18)');c.fillStyle=edge;c.fillRect(0,0,w,h);
          c.strokeStyle='rgba(71,69,54,.12)';c.lineWidth=4;c.strokeRect(1,1,w-2,h-2);
          for(let i=0;i<12;i++){c.strokeStyle='rgba(89,80,62,.07)';c.beginPath();let x=random()*w,y=random()*h;c.moveTo(x,y);c.lineTo(x+random()*100,y+random()*70);c.stroke();}
        }
      });
    }
    const plasterTex=surfaceTexture('#e6dfce','plaster');
    M.cream.map=plasterTex;M.cream.bumpMap=plasterTex;M.cream.bumpScale=.012;M.cream.color.set(0xffffff);
    const timberTex=surfaceTexture('#47655f','paint');M.teal.map=timberTex;M.teal.bumpMap=timberTex;M.teal.bumpScale=.008;M.teal.color.set(0xffffff);
    const woodTex=surfaceTexture('#997755','wood');M.wood.map=woodTex;M.wood.bumpMap=woodTex;M.wood.bumpScale=.004;M.wood.color.set(0xffffff);M.wood.roughness=.53;
    const paperTex=surfaceTexture('#eee2c9','plaster');M.paper.map=paperTex;M.paper.color.set(0xffffff);
    // A restrained roughness range keeps the scene tactile rather than glossy
    // and avoids the toy-plastic highlight that appears on large flat props.
    M.cream.roughness=.88;M.paper.roughness=.96;M.teal.roughness=.84;
    M.edge.roughness=.60;M.darkTeal.roughness=.68;M.metal.metalness=.72;M.metal.roughness=.39;M.skin.roughness=.78;
    // The restaurant uses a small, coherent commercial fit-out: oxblood enamel,
    // ivory laminate, glazed tile and brushed aluminium. Domestic wood never
    // carries a large architectural surface.
    const brandRed=material(0x9f302a,{roughness:.48});
    const brandDark=material(0x75231f,{roughness:.63});
    const enamel=material(0xeee8d9,{roughness:.36});
    const laminate=material(0xe9dfc8,{roughness:.45});
    const seatRed=material(0x9a3a31,{roughness:.68});
    const chrome=material(0xa7b1ac,{metalness:.78,roughness:.30});
    const wallTileMap=canvasTexture(1024,256,(c,w,h)=>{
      c.fillStyle='#e6e2d7';c.fillRect(0,0,w,h);
      for(let row=0;row<4;row++)for(let col=0;col<16;col++){
        c.fillStyle=(row+col)%3===0?'#f5f0e4':'#eee9df';c.fillRect(col*64+2,row*64+2,60,60);
        c.fillStyle='rgba(255,255,255,.34)';c.fillRect(col*64+3,row*64+3,58,2);
      }
    });
    const wallTile=material(0xffffff,{map:wallTileMap,roughness:.38,bumpMap:wallTileMap,bumpScale:.003});
    function illuminatedPanel(w,h,xyz,texture,parent=stage){
      round(w+.08,h+.08,.10,.018,xyz,brandDark,parent);
      const display=mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.48,roughness:.4}),[xyz[0],xyz[1],xyz[2]+.057],parent);
      display.castShadow=false;return display;
    }
    // Roof and the camera-side walls are cut away, while the remaining construction
    // has wall thickness, joinery, a service passage and a real exterior street.
    const stage = group('Restaurant — 2003');
    round(9.5,.24,8.3,.04,[0,-.23,.1],material(0x68655c),stage);
    const floor=box(9.2,.1,7.9,[0,-.045,.1],material(0x827c6c),stage,'walkable-floor');
    const floorMats=['#d5c9b3','#cfc3ad','#d9cdb7'].map(color=>{
      const tex=surfaceTexture(color,'tile');return material(0xffffff,{map:tex,bumpMap:tex,bumpScale:.007,roughness:.72});
    });
    for(let ix=0;ix<12;ix++)for(let iz=0;iz<10;iz++){
      const tile=box(.747,.014,.769,[-4.17+ix*.758,.015,-3.45+iz*.784],floorMats[(ix*13+iz*7)%3],stage);tile.rotation.y=((ix+iz)%2)*Math.PI;
    }
    box(9.2,3.3,.21,[0,1.64,-3.86],M.cream,stage);
    box(9.2,1.03,.19,[0,.515,-3.72],wallTile,stage);
    box(9.2,.085,.225,[0,1.045,-3.695],brandRed,stage);
    box(9.2,.115,.235,[0,.057,-3.69],chrome,stage);
    box(9.25,.18,.32,[0,3.25,-3.8],brandRed,stage);
    box(9.2,.09,.018,[0,.79,-3.615],brandRed,stage);
    // A narrow wall return makes the cafe read as a room, without hiding play.
    box(.20,3.3,1.0,[-4.56,1.64,-3.35],M.cream,stage);
    box(.18,.87,7.9,[-4.57,.435,.1],enamel,stage);
    box(.24,.09,7.9,[-4.54,.89,.1],brandRed,stage);
    box(.19,.075,7.9,[-4.47,.48,.1],brandRed,stage);
    box(.20,3.3,.72,[-4.56,1.64,3.67],M.cream,stage);
    const windowGroup=props.window=group('Rain on aluminium window',[-4.53,1.91,-.1],stage);
    const frameMat=material(0x657573,{metalness:.4,roughness:.4});
    for(const z of [-2.76,2.76])box(.14,2.16,.075,[0,0,z],frameMat,windowGroup);
    for(const y of [-1.04,1.04])box(.14,.075,5.59,[0,y,0],frameMat,windowGroup);
    for(const z of [-.93,.93])box(.12,2.08,.054,[0,0,z],frameMat,windowGroup);
    box(.11,.042,5.51,[0,.28,0],frameMat,windowGroup);
    round(.38,.13,5.76,.025,[.03,-1.05,0],enamel,windowGroup);
    for(const z of [-.99,1.0])round(.027,.20,.035,.01,[.09,-.05,z],M.metal,windowGroup);
    const glassTex=canvasTexture(512,512,(c,w,h)=>{
      c.clearRect(0,0,w,h);
      for(let i=0;i<110;i++){let x=random()*w,y=random()*h;c.strokeStyle=`rgba(220,237,238,${.03+random()*.12})`;c.lineWidth=.5+random()*1.3;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+3,y+14,x-2,y+32,x+1,y+50+random()*90);c.stroke();}
      for(let i=0;i<260;i++){let x=random()*w,y=random()*h;c.fillStyle='rgba(223,242,240,.22)';c.beginPath();c.ellipse(x,y,.7+random()*1.2,1.2+random()*1.5,0,0,Math.PI*2);c.fill();}
    });
    const glass=mesh(new T.PlaneGeometry(5.47,2.04),new T.MeshPhysicalMaterial({color:0xc5d6d6,map:glassTex,transparent:true,opacity:.25,roughness:.23,metalness:.02,side:T.DoubleSide,depthWrite:false}),[-4.505,1.91,-.1],stage);glass.rotation.y=Math.PI/2;glass.castShadow=false;
    const sky=canvasTexture(512,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#607a8a');g.addColorStop(.55,'#8799a0');g.addColorStop(1,'#b6b8ac');c.fillStyle=g;c.fillRect(0,0,w,h);});
    // The exterior is a distant painted backdrop.  Unlit shading preserves the
    // blue-grey value of the overcast sky under the interior tungsten lights.
    const outdoor=mesh(new T.PlaneGeometry(12,7),new T.MeshBasicMaterial({map:sky,side:T.DoubleSide}),[-10,2.5,-.1],stage);outdoor.rotation.y=Math.PI/2;outdoor.castShadow=false;
    const street=group('A wet county-town street',[-4.76,0,0],stage);
    const streetMat=material(0x536069,{roughness:.24,metalness:.15});
    box(4.7,.04,9,[-2.35,-.045,0],streetMat,street);
    box(.40,.13,8.8,[-.22,.015,0],material(0x9b9c92),street);
    for(let z=-4;z<4.5;z+=.54)box(.44,.015,.008,[-.23,.088,z],material(0x747e7b),street);
    const facades=[material(0x7a8788),material(0x91918a),material(0x758384)];
    for(let i=0;i<4;i++){
      const z=-3.7+i*2.1,h=2.95+(i%2)*.52;
      box(.56,h,1.94,[-4.16,h/2-.03,z],facades[i%3],street);
      box(.04,1.34,1.57,[-3.858,.74,z],material(0x455e69),street);
      box(.075,.075,1.87,[-3.81,1.48,z],material(0x596464),street);
      for(const wz of [-.47,.47]){box(.035,.56,.43,[-3.845,2.24,z+wz],material(0x566975),street);box(.042,.025,.43,[-3.82,2.24,z+wz],M.metal,street);}
      for(let k=0;k<12;k++)box(.045,.013,1.5,[-3.819,.21+k*.075,z],material(0x617276),street);
      const shop=plane(1.7,.31,[-3.78,1.73,z],textTexture(['新华文具','修鞋 配钥匙','便民副食','照相 彩扩'][i],'', '#737d78','#d6d5bd'),street);shop.rotation.y=Math.PI/2;
      box(.69,.07,1.99,[-3.52,1.52,z],material(i%2?0x646f74:0x77726a),street);
    }
    // Rain reflections are stretched pools of light, not a mirror rendering pass.
    const reflectionTex=canvasTexture(128,256,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,2,w/2,h/2,h/2);g.addColorStop(0,'rgba(231,194,136,.18)');g.addColorStop(1,'rgba(231,194,136,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
    for(let i=0;i<4;i++){const p=mesh(new T.PlaneGeometry(.7,1.8),new T.MeshBasicMaterial({map:reflectionTex,transparent:true,depthWrite:false}),[-1.5-i*.48,.002,-2.9+i*1.5],street);p.rotation.x=-Math.PI/2;p.castShadow=false;}
    // A parked bicycle anchors the place and the period in a single silhouette.
    const bicycle=group('Parked bicycle',[-3.1,.06,1.62],street);bicycle.rotation.y=Math.PI/2;
    const cycleMat=material(0x384d54,{metalness:.65,roughness:.45});
    for(const x of [-.48,.48]){
      const wheel=mesh(new T.TorusGeometry(.30,.024,8,32),blackMat,[x,.31,0],bicycle);const rim=mesh(new T.TorusGeometry(.27,.007,6,32),M.metal,[x,.31,0],bicycle);
      for(let j=0;j<8;j++){const a=j*Math.PI/4;line([[x,.31,0],[x+Math.cos(a)*.27,.31+Math.sin(a)*.27,0]],.003,M.metal,bicycle);}
    }
    for(const ends of [[[-.48,.31,0],[-.14,.72,0]],[[.48,.31,0],[.18,.78,0]],[[-.14,.72,0],[.18,.78,0]],[[-.48,.31,0],[0,.31,0]],[[0,.31,0],[.18,.78,0]],[[0,.31,0],[-.14,.72,0]],[[.18,.78,0],[.48,.31,0]]])line(ends,.019,cycleMat,bicycle);
    round(.19,.038,.12,.014,[-.14,.77,0],blackMat,bicycle);line([[.18,.78,0],[.19,.93,0],[.28,.95,.12]],.016,cycleMat,bicycle);
    const rain=group('Window rain',[-4.48,1,-2.72],stage);
    const rainMat=material(0xcde1e6,{transparent:true,opacity:.29,depthWrite:false});
    for(let i=0;i<65;i++){const y=random()*1.98,z=random()*5.4;const drop=box(.004,.042+(i%4)*.021,.004,[0,y,z],rainMat,rain);drop.rotation.x=.08;drop.userData.baseY=y;drop.castShadow=false;}

    // Service counter, with the return tray on its near lip.
    const counter = group('Service counter', [1.65, 0, -2.87], stage);
    round(5.15,.83,1.25,.035,[0,.43,0],brandRed,counter);
    round(5.27,.13,1.39,.025,[0,.92,0],enamel,counter);
    box(5.18,.09,.03,[0,.17,.645],chrome,counter);
    box(5.18,.025,.03,[0,.80,.645],brandDark,counter);
    // Broad white panels and numbered service positions read across the room.
    for(const x of [-1.69,0,1.69]){
      round(1.60,.50,.022,.012,[x,.49,.645],enamel,counter);
    }
    const counterBrand=plane(1.38,.36,[0,.49,.665],textTexture('小岛汉堡','XIAODAO · SINCE 1998','#eee8d9','#a2352b'),counter);
    const pickup=plane(1.16,.29,[-1.69,.49,.665],textTexture('取 餐','PICK UP','#eee8d9','#a2352b'),counter);
    const order=plane(1.16,.29,[1.69,.49,.665],textTexture('点 餐','ORDER HERE','#eee8d9','#a2352b'),counter);

    collider(-1.03,4.32,-3.6,-2.1);
    const till = props.register = group('Cash register', [2.85,1.02,-2.76], stage);
    round(.57,.13,.43,.03,[0,.06,0],M.darkTeal,till);
    round(.47,.39,.10,.035,[0,.27,-.06],M.darkTeal,till);
    sign('18.00','合计 / 元',.39,.24,[0,.28,0],till,'#7c9781','#243c32');
    for(let i=0;i<3;i++) box(.09,.014,.055,[-.12+i*.12,.138,.10],M.cream,till);
    // This is an ordinary stretch of counter, not a dedicated lost-property station.
    const found=props.found=group('Counter handover',[.6,1,-2.03],stage);
    const receipt=plane(.16,.23,[.25,.008,-.18],textTexture('小岛汉堡','2003 / 10 / 18', '#ded6c3','#66645c'),found);receipt.rotation.x=-Math.PI/2;receipt.rotation.z=.14;
    const drawer=props.lostDrawer=group('Counter drawer',[1.1,.68,-2.90],stage);
    round(.60,.15,.50,.018,[0,0,0],M.edge,drawer);
    round(.57,.018,.47,.007,[0,.082,0],material(0x635844),drawer);
    round(.62,.19,.045,.014,[0,0,-.26],enamel,drawer);
    line([[-.12,.015,-.29],[-.12,.015,-.325],[.12,.015,-.325],[.12,.015,-.29]],.012,M.metal,drawer);
    props.storagePoint=group('Stored voucher',[0,.094,0],drawer);
    props.dropSpot=group('Beside the schoolbag',[-2.75,.055,2.02],stage);
    props.menu=group('Menu board',[1.2,2.48,-3.69],stage);
    const menuMap=canvasTexture(2048,640,(c,w,h)=>{
      c.fillStyle='#fff0d2';c.fillRect(0,0,w,h);
      c.fillStyle='#a63029';c.fillRect(0,0,w,91);
      c.fillStyle='#fff4df';c.textAlign='left';c.font='600 39px "PingFang SC",sans-serif';
      c.fillText('小岛汉堡  /  每一份，现点现做',49,59);
      c.textAlign='right';c.font='25px Arial,sans-serif';c.fillText('FRESH • HOT • SIMPLE',w-42,56);
      function burgerImage(cx,cy,scale){
        c.save();c.translate(cx,cy);c.scale(scale,scale);
        c.fillStyle='rgba(102,53,19,.12)';c.beginPath();c.ellipse(0,108,164,20,0,0,Math.PI*2);c.fill();
        let g=c.createLinearGradient(0,62,0,108);g.addColorStop(0,'#df922e');g.addColorStop(1,'#b36a26');c.fillStyle=g;
        c.beginPath();c.ellipse(0,85,148,25,0,0,Math.PI*2);c.fill();
        c.fillStyle='#63341e';c.beginPath();c.ellipse(0,49,151,29,0,0,Math.PI*2);c.fill();
        c.fillStyle='#c76627';for(let i=0;i<20;i++){c.beginPath();c.ellipse(-130+i*14,38+(i%3)*5,13,13,0,0,Math.PI*2);c.fill();}
        c.fillStyle='#e8b63d';c.beginPath();c.moveTo(-147,26);c.lineTo(121,20);c.lineTo(140,50);c.lineTo(67,56);c.lineTo(10,41);c.lineTo(-97,60);c.closePath();c.fill();
        c.fillStyle='#67913a';for(let i=0;i<9;i++){c.beginPath();c.ellipse(-130+i*32,13+(i%2)*9,31,13,(i%2?.13:-.12),0,Math.PI*2);c.fill();}
        c.fillStyle='#b4482b';c.beginPath();c.ellipse(0,5,145,17,0,0,Math.PI*2);c.fill();
        g=c.createLinearGradient(0,-98,0,4);g.addColorStop(0,'#f7cf76');g.addColorStop(.55,'#e5a548');g.addColorStop(1,'#b56825');c.fillStyle=g;
        c.beginPath();c.moveTo(-149,0);c.bezierCurveTo(-145,-116,135,-120,149,0);c.quadraticCurveTo(0,32,-149,0);c.fill();
        c.fillStyle='#fff1b9';for(let i=0;i<17;i++){const a=i*2.399,r=Math.sqrt((i+.4)/17);c.save();c.translate(Math.cos(a)*112*r,-38+Math.sin(a)*41*r);c.rotate(a);c.beginPath();c.ellipse(0,0,5.4,2.1,0,0,Math.PI*2);c.fill();c.restore();}
        c.restore();
      }
      function friesImage(cx,cy,scale){
        c.save();c.translate(cx,cy);c.scale(scale,scale);
        for(let i=0;i<11;i++){c.save();c.translate(-63+i*12,-14+(i%3)*10);c.rotate((i%3-1)*.06);c.fillStyle=i%2?'#edba45':'#f7cf64';c.fillRect(-5,-108,11,153);c.restore();}
        c.fillStyle='#b43d2b';c.beginPath();c.moveTo(-83,-8);c.quadraticCurveTo(0,26,83,-8);c.lineTo(65,120);c.lineTo(-64,120);c.closePath();c.fill();
        c.fillStyle='#ffeed0';c.font='bold 35px "PingFang SC",sans-serif';c.textAlign='center';c.fillText('小岛',0,70);c.restore();
      }
      const column=w/3;
      for(let i=1;i<3;i++){c.fillStyle='#d7b794';c.fillRect(i*column,109,2,h-133);}
      burgerImage(345,282,1.05);
      // The centre menu shows a recognisable meal rather than a text-only board.
      c.fillStyle='#b4362c';c.beginPath();c.moveTo(1134,199);c.lineTo(1232,199);c.lineTo(1217,368);c.lineTo(1149,368);c.closePath();c.fill();
      c.fillStyle='#f6e9cc';c.fillRect(1129,190,108,12);c.fillRect(1173,129,8,66);
      friesImage(1081,295,.65);burgerImage(909,293,.79);
      friesImage(1705,272,1.00);
      [['香酥鸡腿堡','12'],['鸡腿堡套餐','18'],['薯条 · 小份','6']].forEach((item,i)=>{
        const center=column*(i+.5);c.textAlign='center';c.fillStyle='#582d22';c.font='500 40px "PingFang SC",sans-serif';c.fillText(item[0],center,461);
        c.fillStyle='#a63029';c.font='600 65px Arial,sans-serif';c.fillText('¥ '+item[1],center,549);
      });
      c.fillStyle='#897251';c.font='24px "PingFang SC",sans-serif';c.textAlign='center';c.fillText('单品现点现做',column*.5,598);c.fillText('汉堡 + 薯条 + 热饮',column*1.5,598);c.fillText('刚出锅，趁热吃',column*2.5,598);
    });
    illuminatedPanel(5.50,1.10,[0,0,0],menuMap,props.menu);
    const shopIdentity=canvasTexture(1024,512,(c,w,h)=>{
      c.fillStyle='#a33129';c.fillRect(0,0,w,h);c.strokeStyle='#e6b977';c.lineWidth=3;c.strokeRect(21,21,w-42,h-42);
      c.textAlign='center';c.fillStyle='#fff0d0';c.font='600 120px "PingFang SC",sans-serif';c.fillText('小岛汉堡',w/2,246);
      c.font='33px Arial,sans-serif';c.fillText('X I A O D A O   B U R G E R',w/2,333);
      c.font='28px "PingFang SC",sans-serif';c.fillText('现点现做  ·  始于 1998',w/2,401);
    });
    illuminatedPanel(2.23,1.10,[-2.98,2.48,-3.69],shopIdentity,stage);
    round(4.83,.66,.045,.012,[1.45,1.42,-3.59],chrome,stage);
    box(4.79,.035,.018,[1.45,1.72,-3.56],enamel,stage);
    round(3.7,.09,.48,.02,[1.05,1.05,-3.43],M.metal,stage);
    const takeawayBags=group('Ready for pickup paper bags',[-.55,1.02,-3.10],stage);
    for(let i=0;i<2;i++){
      const bag=group('Paper takeaway bag',[i*.29,0,0],takeawayBags);
      round(.24,.33,.17,.005,[0,.17,0],M.paper,bag);
      round(.25,.025,.17,.004,[0,.345,0],laminate,bag);
      plane(.18,.13,[0,.21,.091],textTexture('小岛','新鲜现做','#efe3c9','#9f302a'),bag);
    }

    // Cup stacks and a soda rail make the rear counter read as a service line,
    // rather than a domestic kitchen with unexplained white cylinders.
    for(let i=0;i<4;i++){
      const x=-.3+i*.46, cup=group('Takeaway cup stack',[x,1.11,-3.47],stage);
      for(let j=0;j<2;j++){
        const y=j*.16;
        cylinder(.077,.091,.15,[0,y+.075,0],enamel,cup,20);
        cylinder(.080,.080,.012,[0,y+.153,0],M.paper,cup,20);
        round(.085,.022,.006,.003,[0,y+.087,.082],brandRed,cup);
      }
    }
    round(.79,.43,.38,.045,[3.28,1.34,-3.47],M.darkTeal,stage);
    for(let i=0;i<3;i++) {
      cylinder(.085,.06,.19,[2.98+i*.26,1.17,-3.23],M.paper,stage);
      cylinder(.094,.094,.02,[2.98+i*.26,1.276,-3.23],brandRed,stage);
      box(.13,.018,.012,[2.98+i*.26,1.18,-3.30],enamel,stage);
    }
    // A compact stainless hot-food pass and heat-lamp rail add a recognisable
    // commercial back-of-house cue without blocking the actors.
    const pass=group('Hot food pass',[2.62,1.72,-3.59],stage);
    const hotLamp=material(0xfff1d7,{emissive:0xffecc9,emissiveIntensity:1.0,roughness:.8});
    round(1.30,.78,.055,.018,[0,0,0],brandDark,pass);
    round(1.18,.58,.022,.008,[0,-.01,.035],material(0x1f2b2c,{roughness:.72}),pass);
    plane(.78,.16,[0,.17,.052],textTexture('出 餐 口','PICK UP  ·  HOT','#2f3938','#ead7b0'),pass);
    round(1.18,.045,.12,.012,[0,-.37,.01],chrome,pass);
    for(const x of [-.42,0,.42]){
      cylinder(.018,.024,.30,[x,.31,.01],chrome,pass,10);
      round(.11,.026,.11,.009,[x,.15,.01],hotLamp,pass);
    }
    for(let i=0;i<3;i++){
      const tray=group('Order tray',[(-1+i)*.36,-.27,.10],pass);
      round(.25,.018,.20,.008,[0,0,0],M.metal,tray);
      box(.02,.035,.20,[-.115,.018,0],brandRed,tray);
      box(.02,.035,.20,[.115,.018,0],brandRed,tray);
    }

    // Service clutter stays behind the action lane; all labels are functional.
    const printer=group('Receipt printer',[2.24,1.012,-2.86],stage);
    round(.28,.18,.33,.025,[0,.09,0],material(0x5b615b),printer);
    box(.20,.018,.035,[0,.183,.03],blackMat,printer);
    const tillReceipt=plane(.14,.27,[0,.188,.15],textTexture('小岛汉堡','鸡腿堡套餐  18.00','#e8e1cc','#777265'),printer);tillReceipt.rotation.x=-Math.PI*.30;
    const rail=group('Order rail',[1.39,1.94,-3.60],stage);
    round(2.44,.045,.06,.014,[0,0,0],M.metal,rail);
    for(let i=0;i<4;i++){
      const ticket=plane(.20,.32,[-.88+i*.50,-.18,.042],textTexture('0'+(21+i),'堂食  '+(i+1)+' 号','#dfd8c4','#6e7065'),rail);ticket.rotation.z=(i%2?.035:-.026);
      box(.040,.065,.020,[-.88+i*.50,-.021,.054],M.metal,rail);
    }
    const condiments=group('Condiments',[3.79,1.02,-2.53],stage);
    round(.47,.045,.30,.015,[0,0,0],M.edge,condiments);
    for(let i=0;i<2;i++){
      const bottle=group(i?'Mustard':'Tomato sauce',[-.12+i*.23,.03,0],condiments);
      cylinder(.065,.063,.25,[0,.13,0],material(i?0xc6a141:0x914d39),bottle);
      cylinder(.033,.064,.10,[0,.305,0],material(i?0xc6a141:0x914d39),bottle);
      cylinder(.018,.027,.070,[0,.39,0],M.paper,bottle);
      const label=plane(.095,.08,[0,.17,.067],textTexture(i?'芥末':'茄汁','', '#cbbd9a','#6d5940'),bottle);
    }
    const utensils=group('Cutlery holder',[-.48,1.02,-2.81],stage);
    cylinder(.11,.087,.20,[0,.1,0],M.metal,utensils);
    for(let i=0;i<6;i++){const spoon=group('spoon',[(i%3-.9)*.049,.16,Math.floor(i/3)*.06-.03],utensils);spoon.rotation.z=(i%2?.14:-.11);round(.013,.22,.012,.004,[0,.11,0],M.metal,spoon);sphere(.032,[0,.25,0],M.metal,spoon,[.65,1,.22]);}
    const towel=round(.38,.020,.28,.007,[-.04,1.027,-2.87],material(0xb2aca0),stage);towel.rotation.y=.19;
    // Wall utilities and paper notices place the setting without turning it into a prop heap.
    round(.085,.14,.025,.008,[-4.16,1.40,-3.615],material(0xaea99b),stage);
    box(.042,.073,.013,[-4.16,1.40,-3.595],M.cream,stage);
    line([[-4.20,1.46,-3.6],[-4.20,2.05,-3.6],[-3.75,2.05,-3.6]],.008,material(0xaaa492),stage);
    const notice=plane(.40,.54,[-3.81,1.68,-3.608],textTexture('招 工','勤工助学请询店员','#d7caa7','#6d695b'),stage);notice.rotation.z=-.035;
    for(const x of [-3.94,-3.70]){const tape=box(.074,.025,.003,[x,1.945,-3.60],material(0xb6ad8d,{transparent:true,opacity:.7}),stage);tape.rotation.z=x<-3.8?.2:-.15;}
    // Restrained wear around edges most often touched by customers.
    for(let i=0;i<17;i++){
      const scratch=box(.018+random()*.12,.003,.004,[-.7+random()*4.65,.989,-2.162],material(0xcfc4ac),stage);scratch.rotation.z=(random()-.5)*.2;
    }
    const ventilation=group('Ventilation grille',[3.8,3.04,-3.64],stage);
    round(.47,.26,.045,.013,[0,0,0],material(0xa8aea5),ventilation);
    for(let i=0;i<7;i++)box(.39,.007,.013,[0,-.087+i*.029,.029],material(0x636e6a),ventilation);

    function chair(x,z,rotation=0) {
      // Upholstered diner seating keeps the original walkable footprint.
      const g=group('Red upholstered restaurant seat',[x,0,z],stage);g.rotation.y=rotation;
      round(.55,.105,.52,.027,[0,.425,0],seatRed,g);
      round(.54,.035,.51,.014,[0,.36,0],enamel,g);
      for(const a of [-1,1]){
        line([[a*.205,.065,.20],[a*.205,.32,.19],[a*.205,.70,-.20],[a*.205,.94,-.20]],.024,chrome,g);
        line([[a*.205,.32,.19],[a*.205,.065,-.20]],.022,chrome,g);
        for(const z of [-.20,.20])cylinder(.028,.028,.021,[a*.205,.045,z],blackMat,g,12);
      }
      round(.55,.47,.065,.025,[0,.755,-.215],enamel,g);
      round(.50,.40,.048,.025,[0,.765,-.172],seatRed,g);
      for(const x of [-.15,0,.15])box(.005,.33,.004,[x,.765,-.145],brandDark,g);
      return g;
    }
    const table = props.table = group('Window table',[-2.8,0,-.4],stage);
    round(1.52,.080,.94,.033,[0,.735,0],brandDark,table);
    round(1.49,.018,.91,.008,[0,.78,0],laminate,table);
    for(const x of [-.46,.46]){
      cylinder(.046,.057,.68,[x,.36,0],chrome,table);
      round(.075,.04,.66,.018,[x,.041,0],chrome,table);
      for(const z of [-.28,.28])cylinder(.045,.045,.022,[x,.025,z],blackMat,table);
    }
    collider(-3.6,-2,-1,.15);
    // Seats at the side keep the eating shot open from the front.
    chair(-3.87,-.4,Math.PI/2);chair(-1.73,-.45,-Math.PI/2);
    collider(-4.13,-3.64,-.68,-.12);collider(-1.98,-1.48,-.72,-.18);
    const napkinBox=props.napkinBox=group('Table tissue dispenser',[-3.31,.797,-.63],stage);
    round(.27,.16,.235,.020,[0,.080,0],M.metal,napkinBox);
    round(.276,.025,.24,.009,[0,.167,0],material(0xb9bcb0,{metalness:.55,roughness:.34}),napkinBox);
    round(.19,.008,.034,.003,[0,.183,0],M.dark,napkinBox);
    const standingTissue=mesh(new T.PlaneGeometry(.165,.16,7,7),new T.MeshStandardMaterial({map:paperTex,color:0xf5edda,roughness:.97,side:T.DoubleSide}),[0,.252,0],napkinBox);
    const tissuePoints=standingTissue.geometry.attributes.position;
    for(let i=0;i<tissuePoints.count;i++){const y=tissuePoints.getY(i);tissuePoints.setZ(i,Math.sin(tissuePoints.getX(i)*27)*.013+(y+.08)*.14);}tissuePoints.needsUpdate=true;standingTissue.geometry.computeVertexNormals();
    // One folded napkin beside the drink is a separate object the player can pick up.
    const napkin=props.napkin=group('Folded paper napkin',[-2.24,.795,-.765],stage);napkin.userData.isNapkin=true;
    const napkinMaterial=new T.MeshStandardMaterial({map:paperTex,color:0xf6eedc,roughness:.98,side:T.DoubleSide});
    for(let layer=0;layer<2;layer++){
      const paper=mesh(new T.PlaneGeometry(.19,.145,10,8),napkinMaterial,[0,layer*.003,0],napkin);
      const vertices=paper.geometry.attributes.position;
      for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i);vertices.setZ(i,Math.sin(x*22+y*13)*.0025+Math.max(0,x-.05)*.045);}vertices.needsUpdate=true;paper.geometry.computeVertexNormals();paper.rotation.x=-Math.PI/2;
    }
    line([[-.083,.007,-.060],[.083,.007,-.060],[.083,.007,.060]],.0012,material(0xd7cdb5),napkin);
    napkin.rotation.y=.16;
    // A faint water ring makes the cleaned laminate table feel used.
    const cupRing=mesh(new T.RingGeometry(.087,.090,40),new T.MeshBasicMaterial({color:0x64533a,transparent:true,opacity:.13,depthWrite:false,side:T.DoubleSide}),[-2.24,.793,-.58],stage);cupRing.rotation.x=-Math.PI/2;cupRing.castShadow=false;

    // A functional number tent replaces the domestic flower vase.
    const tableNumber=group('Table number 03',[-3.27,.80,-.14],stage);
    const numberCard=plane(.20,.23,[0,.12,0],textTexture('03','桌号 TABLE','#a7352c','#fff0d5'),tableNumber);numberCard.rotation.x=-.12;
    round(.22,.016,.14,.004,[0,.008,.01],chrome,tableNumber);

    // A second, modest dining bay gives the room a lived-in restaurant density.
    // It stays against the right edge, leaving the central aisle and exit open.
    const sideTable=props.sideTable=group('Side dining table',[3.15,0,.65],stage);
    round(1.12,.085,.78,.035,[0,.735,0],brandDark,sideTable);
    round(1.085,.015,.745,.006,[0,.785,0],laminate,sideTable);
    cylinder(.060,.085,.70,[0,.36,0],chrome,sideTable);
    round(.52,.045,.43,.015,[0,.040,0],chrome,sideTable);
    collider(2.57,3.73,.24,1.06);
    const sideSeatA=chair(3.15,-.08,0),sideSeatB=chair(3.15,1.38,Math.PI);
    sideSeatA.name='Side dining chair, rear';sideSeatB.name='Side dining chair, front';
    collider(2.86,3.44,-.37,.21);collider(2.86,3.44,1.09,1.67);
    const sideNapkins=group('Side table napkins',[.28,.80,.04],sideTable);
    round(.19,.105,.135,.010,[0,.053,0],M.metal,sideNapkins);
    box(.145,.075,.016,[0,.139,0],M.paper,sideNapkins);
    const emptyCup=group('Branded takeaway paper cup',[-.30,.80,-.16],sideTable);
    cylinder(.079,.055,.19,[0,.095,0],enamel,emptyCup);
    cylinder(.071,.064,.064,[0,.10,0],brandRed,emptyCup);
    cylinder(.084,.084,.012,[0,.196,0],enamel,emptyCup);
    const cupBrand=plane(.072,.035,[0,.102,.074],textTexture('小岛','', '#9f302a','#fff0d6'),emptyCup);
    line([[.01,.198,.01],[.01,.32,.01],[.04,.34,.01]],.006,brandRed,emptyCup);
    const foldedReceipt=plane(.13,.17,[-.31,.800,.12],textTexture('小岛汉堡','15.00','#ded4bb','#746c5a'),sideTable);foldedReceipt.rotation.x=-Math.PI/2;foldedReceipt.rotation.z=.17;
    // The entrance mat carries damp shoe marks, without an extra obstacle.
    const wetMatTex=canvasTexture(256,256,(c,w,h)=>{
      c.clearRect(0,0,w,h);c.fillStyle='rgba(30,43,42,.11)';
      for(let i=0;i<5;i++){c.save();c.translate(42+i*39,55+(i%2)*105);c.rotate(-.25);c.beginPath();c.ellipse(0,0,9,24,0,0,Math.PI*2);c.fill();c.restore();}
    });
    const dampMat=mesh(new T.PlaneGeometry(1.05,.67),new T.MeshBasicMaterial({map:wetMatTex,transparent:true,depthWrite:false}),[2.55,.058,2.85],stage);dampMat.rotation.x=-Math.PI/2;dampMat.castShadow=false;

    // Child's possessions have real, distinct silhouettes.
    const bag = props.bag = group('School bag',[-3.30,0,1.40],stage);
    bag.rotation.y=-.2;
    collider(-3.55,-3.05,1.21,1.6);
    round(.44,.55,.28,.065,[0,.29,0],M.red,bag);
    round(.33,.22,.10,.035,[0,.22,.172],material(0xca785b),bag);
    line([[-.11,.53,0],[-.10,.64,0],[.10,.64,0],[.11,.53,0]],.025,M.edge,bag);
    for(const x of [-.13,.13])line([[x,.5,-.16],[x,.2,-.23],[x,.05,-.13]],.026,M.edge,bag);
    plane(.18,.07,[0,.36,.158],textTexture('三年二班','', '#c9c2a8','#66644f'),bag);
    const exercise=round(.29,.015,.20,.006,[-.03,.535,-.06],M.paper,bag);exercise.rotation.z=.13;
    line([[-.175,.48,.075],[0,.495,.11],[.175,.48,.075]],.008,M.edge,bag);
    for(let i=0;i<9;i++)sphere(.005,[-.16+i*.04,.482,.087],M.metal,bag);
    const coins=props.coins=group('Two coins',[-2.58,.81,-.04],stage);
    coins.scale.setScalar(.35);
    coins.userData.isCoins=true;
    for(let i=0;i<2;i++){
      cylinder(.055,.055,.012,[i*.14,0,0],M.amber,coins);
      const top=plane(.074,.074,[i*.14,.007,0],textTexture('1','', '#efc66e','#947135'),coins);top.rotation.x=-Math.PI/2;
    }
    const coupon=props.coupon=group('Meal voucher',[1.8,1.15,3]);
    coupon.scale.setScalar(.4);
    round(.47,.014,.30,.005,[0,0,0],M.amber,coupon);
    const couponTex=canvasTexture(720,440,(c,w,h)=>{
      c.fillStyle='#f5d892';c.fillRect(0,0,w,h);
      c.fillStyle='#9f302a';c.fillRect(18,18,135,h-36);
      c.fillStyle='#f9e8c0';c.textAlign='center';c.font='500 64px "PingFang SC",sans-serif';c.fillText('小',86,160);c.fillText('岛',86,253);
      c.textAlign='left';c.fillStyle='#604827';c.font='600 99px "PingFang SC",sans-serif';c.fillText('餐 券',206,190);
      c.font='34px "PingFang SC",sans-serif';c.fillText('已付款 · 本店兑换',200,270);c.font='23px sans-serif';c.fillText('NO. 01983  ·  请于柜台兑换',203,331);
      c.strokeStyle='#bc954e';c.setLineDash([10,8]);c.beginPath();c.moveTo(175,34);c.lineTo(175,406);c.stroke();
    });
    const couponFace=plane(.455,.29,[0,.008,0],couponTex,coupon);couponFace.rotation.x=-Math.PI/2;
    const couponBack=plane(.455,.29,[0,-.008,0],textTexture('小岛汉堡','本券仅限堂食，一次使用有效','#e6c77f','#70603f'),coupon);couponBack.rotation.x=Math.PI/2;

    // A meal with recognisable food, under an opening paper sleeve.
    // The tray is deliberately a little larger than the surrounding props.  In the
    // close eating shot the player should read the food immediately, while it still
    // fits naturally in a child's two hands.
    const meal=props.meal=group('A warm meal',[2,1.02,-2.5]);meal.visible=false;meal.userData.isMeal=true;meal.scale.setScalar(.68);
    round(1.12,.045,.72,.02,[0,0,0],M.red,meal);
    round(1.06,.012,.66,.005,[0,.029,0],M.paper,meal);
    for(const x of [-.55,.55])round(.035,.065,.72,.012,[x,.025,0],M.red,meal);
    for(const z of [-.35,.35])round(1.1,.065,.035,.012,[0,.025,z],M.red,meal);
    const burger=props.burger=group('Burger',[-.22,.05,.02],meal);burger.userData.isFood=true;
    const bun=material(0xd9903e,{roughness:.66}), patty=material(0x613526,{roughness:.92}), cheese=material(0xf3c442,{roughness:.57}), tomato=material(0xc95938,{roughness:.64});
    cylinder(.177,.165,.066,[0,.043,0],bun,burger,64).userData.foodLayer=true;
    cylinder(.169,.177,.042,[0,.09,0],patty,burger,64).userData.foodLayer=true;
    const cheeseSlice=mesh(new T.BoxGeometry(.335,.015,.335,24,1,24),cheese,[0,.118,0],burger);cheeseSlice.userData.foodLayer=true;
    cylinder(.161,.165,.018,[0,.14,0],tomato,burger,64).userData.foodLayer=true;
    // Two small onion arcs and a few darker grill marks give the first bite a
    // recognisable, hand-made texture at the close camera distance.
    const onionMat=material(0xf0d8b0,{roughness:.76});
    for(let i=0;i<3;i++){
      const onion=mesh(new T.TorusGeometry(.073,.008,6,18,Math.PI*.72),onionMat,[(-.07+i*.07),.111,.012],burger);
      onion.rotation.x=Math.PI/2;onion.rotation.z=(i-1)*.35;onion.userData.foodDetail=true;
    }
    for(let i=0;i<4;i++){
      const grill=round(.012,.004,.115,.002,[-.10+i*.067,.113,.006],material(0x39231d),burger);grill.rotation.y=(i%2?.16:-.13);grill.userData.foodDetail=true;
    }
    for(let i=0;i<9;i++) sphere(.057,[Math.cos(i*.698)*.123,.153,Math.sin(i*.698)*.123],leafMat,burger,[1.25,.22,.9]).userData.foodDetail=true;
    const top=mesh(new T.SphereGeometry(.178,64,24,0,Math.PI*2,0,Math.PI/2),bun,[0,.172,0],burger);top.scale.set(1,.52,1);top.userData.foodLayer=true;
    for(let i=0;i<13;i++){
      const a=i*2.399,r=.14*Math.sqrt((i+.3)/13),x=Math.cos(a)*r,z=Math.sin(a)*r;
      const seed=sphere(.008,[x,.172+.09*Math.sqrt(1-(r/.18)**2),z],M.paper,burger,[1.2,.3,.65]);seed.rotation.y=a;seed.userData.foodDetail=true;
    }
    const fries=group('Fries',[.29,.065,.10],meal);
    round(.23,.22,.18,.025,[0,.12,0],M.red,fries);sign('小岛','',.13,.08,[0,.12,.087],fries,'#b65b47','#f5d7a1');
    for(let i=0;i<9;i++){
      const f=round(.034,.20+(i%3)*.028,.038,.008,[-.08+(i%5)*.039,.23, -.04+Math.floor(i/5)*.065],material(i%3===0?0xf2c35a:0xdba247,{roughness:.7}),fries);f.rotation.z=(i%3-1)*.10;
      // Uneven tips keep the fries from reading as identical yellow bars.
      sphere(.018,[f.position.x,f.position.y+.105+(i%3)*.014,f.position.z],material(0xf7d67a,{roughness:.72}),fries,[.8,.35,.8]);
    }
    const drink=group('Drink',[.29,.052,-.19],meal);
    cylinder(.11,.077,.29,[0,.15,0],enamel,drink);
    cylinder(.099,.089,.10,[0,.15,0],brandRed,drink);
    const drinkBrand=plane(.12,.055,[0,.15,.104],textTexture('小岛','', '#9f302a','#fff0d6'),drink);
    cylinder(.116,.116,.023,[0,.303,0],enamel,drink);
    line([[0,.3,0],[0,.46,0],[.06,.49,0]],.012,M.red,drink);
    for(const z of [-.07,.01,.08]){
      const drop=sphere(.009,[.106,.16,z],material(0xf2eee0,{transparent:true,opacity:.55,roughness:.22}),drink,[.55,1.5,.55]);
      drop.userData.condensation=true;
    }
    const lid=props.lid=group('Closed burger box',[-.23,.05,.02],meal);
    round(.44,.009,.41,.003,[0,.31,0],M.paper,lid);
    box(.012,.31,.41,[-.218,.155,0],M.paper,lid);box(.012,.31,.41,[.218,.155,0],M.paper,lid);
    box(.44,.31,.012,[0,.155,.205],M.paper,lid);box(.44,.31,.012,[0,.155,-.205],M.paper,lid);
    const seal=plane(.16,.09,[0,.24,.212],textTexture('小岛','', '#9f302a','#fff0d6'),lid);
    const wrapLabel=plane(.36,.27,[0,.317,0],textTexture('小岛汉堡','现做 · 趁热吃','#f0e3c9','#9f302a'),lid);wrapLabel.rotation.x=-Math.PI/2;

    const steamMap=canvasTexture(64,64,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,251,232,.55)');g.addColorStop(.45,'rgba(255,251,232,.2)');g.addColorStop(1,'rgba(255,251,232,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
    const steam=group('Warm steam',[0,0,0],meal);
    for(let i=0;i<5;i++){const sprite=new T.Sprite(new T.SpriteMaterial({map:steamMap,transparent:true,opacity:0,depthWrite:false}));sprite.userData.offset=i/5;steam.add(sprite);}

    function character(name, xyz, outfit, scale=1, kind='adult') {
      const actor=group(name,xyz);actor.scale.setScalar(scale);
      const body=group('body',[0,0,0],actor);
      const hairMat=material(kind==='clerk'?0x423a32:0x343531,{roughness:.88});
      const fabricTex=surfaceTexture('#b8b7aa','plaster');
      const shirt=material(outfit,{map:fabricTex,bumpMap:fabricTex,bumpScale:.0015}),pants=material(kind==='child'?0x4f6060:0x414c50,{roughness:.93});
      const child=kind==='child';
      const torsoPoints=[[.13,.81],[.177,.86],[.19,.99],[.215,1.22],[.19,1.32],[.135,1.37]].map(([r,y])=>new T.Vector2(r,y));
      const torso=mesh(new T.LatheGeometry(torsoPoints,24),shirt,[0,0,0],body);torso.scale.z=.62;
      sphere(.20,[0,.84,0],pants,body,[1,.65,.62]);
      cylinder(.068,.077,.13,[0,1.39,0],M.skin,body);
      const head=group('head',[0,1.59,0],body);
      const headRadius=child?.209:.193;
      sphere(headRadius,[0,0,0],M.skin,head,[.87,1,.81]);
      sphere(.105,[0,-.10,.026],M.skin,head,[1.09,.71,.96]);
      for(const x of [-.172,.172]){
        sphere(.040,[x,-.006,0],M.skin,head,[.63,1,.65]);
        sphere(.019,[x*1.03,-.006,.018],pink,head,[.3,.8,.25]);
      }
      const hairGeo=new T.SphereGeometry(headRadius*1.02,28,18,0,Math.PI*2,0,Math.PI*.63);
      const hair=mesh(hairGeo,hairMat,[0,.035,-.016],head);hair.scale.set(.91,1,.82);hair.rotation.x=-.16;
      // Swept tapered locks, kept close to the skull instead of a toy-like cap.
      for(let i=0;i<6;i++){
        const lock=sphere(.058,[-.13+i*.048,.117+(i%3)*.008,.096],hairMat,head,[.60,.58,.93]);lock.rotation.z=-.4;
      }
      const eyes=[];
      for(const x of [-.066,.066]){
        const eye=group('eye',[x,.017,.148],head);eyes.push(eye);
        sphere(.022,[0,0,0],M.paper,eye,[1,.44,.25]);
        sphere(.013,[0,0,.006],blackMat,eye,[.66,.88,.30]);
        sphere(.0035,[-.003,.005,.011],white,eye);
        line([[-.020,.006,.004],[0,.011,.010],[.020,.005,.003]],.0035,hairMat,eye);
        const brow=round(.045,.008,.008,.002,[x,.052,.150],hairMat,head);brow.rotation.z=x<0?.08:-.08;
      }
      const nose=sphere(.025,[0,-.029,.162],M.skin,head,[.65,1.25,.82]);
      sphere(.019,[0,-.045,.174],M.skin,head,[1,.48,.68]);
      line([[-.030,-.082,.140],[-.008,-.086,.151],[.008,-.086,.151],[.030,-.082,.140]],.0035,material(0x946c5d),head);
      const legs=[],arms=[],knees=[],elbows=[];
      for(const side of [-1,1]){
        const leg=group(side<0?'left leg':'right leg',[side*.105,.84,0],body);
        const thigh=mesh(new T.CapsuleGeometry(.078,.27,5,12),pants,[0,-.18,0],leg);thigh.scale.z=1.03;
        const knee=group('knee',[0,-.37,0],leg);knees.push(knee);
        const calf=mesh(new T.CapsuleGeometry(.062,.25,5,12),pants,[0,-.16,0],knee);
        round(.16,.12,.27,.038,[0,-.405,.047],material(child?0x827460:0x514d45),knee);
        round(.162,.025,.268,.009,[0,-.453,.050],material(0xa6a18e),knee);
        for(let i=0;i<3;i++)line([[-.045,-.345,.06+i*.027],[.045,-.345,.06+i*.027]],.0045,M.paper,knee);
        legs.push(leg);
        const arm=group(side<0?'left arm':'right arm',[side*.225,1.29,0],body);
        sphere(.085,[0,-.035,0],shirt,arm,[1,.9,.87]);
        const upper=mesh(new T.CapsuleGeometry(.066,.15,5,12),shirt,[0,-.12,0],arm);
        const elbow=group('elbow',[0,-.255,0],arm);elbows.push(elbow);
        sphere(.055,[0,0,0],M.skin,elbow);
        const fore=mesh(new T.CapsuleGeometry(.044,.15,5,12),M.skin,[0,-.104,.006],elbow);
        // A shaped palm, thumb and four short fingers give holding a direction.
        const palm=round(.075,.085,.034,.015,[0,-.24,.015],M.skin,elbow);
        sphere(.026,[-side*.041,-.228,.020],M.skin,elbow,[.6,1,.65]);
        for(let f=0;f<4;f++){
          const finger=mesh(new T.CapsuleGeometry(.009,.028,3,6),M.skin,[-.026+f*.017,-.285,.018],elbow);finger.rotation.x=-.08;
        }
        arms.push(arm);
      }
      const hand=group('right hand socket',[0,-.27,.067],elbows[1]);
      const carrySocket=group('tray hold',[0,1.025,.28/scale],body);
      // A small repair belongs to this particular childhood jacket.
      function redRepair(x,y,z){
        round(.052,.070,.014,.005,[x,y,z],M.red,body);
        for(let i=0;i<3;i++){const stitch=box(.047,.003,.005,[x,y-.021+i*.021,z+.010],M.paper,body);stitch.rotation.z=.12;}
      }
      if(kind==='clerk'){
        const apron=mesh(new T.PlaneGeometry(.34,.48,6,6),material(0x90342b,{side:T.DoubleSide}),[0,1.02,.143],body);
        for(const x of [-.105,.105])box(.025,.23,.025,[x,1.29,.135],M.paper,body);
        round(.19,.13,.018,.009,[0,1.02,.158],M.paper,body);
        plane(.09,.035,[.07,1.25,.151],textTexture('小岛','', '#fff0d5','#9f302a'),body);
        // A simple tied-back hairstyle replaces the bright novelty uniform cap.
        sphere(.080,[0,.025,-.178],hairMat,head,[1,.8,.8]);
      }else if(child){
        round(.32,.034,.025,.010,[0,1.275,.141],M.teal,body);
        round(.31,.055,.022,.009,[0,1.17,.144],M.teal,body);
        redRepair(.095,1.20,.157);
        line([[-.13,1.27,.1],[-.17,1.18,.10],[-.17,.92,.10]],.012,M.red,body);
      }else{
        const lapel=plane(.082,.24,[-.084,1.245,.131],surfaceTexture('#747e70','paint'),body);lapel.rotation.z=.17;
        const lapel2=plane(.082,.24,[.084,1.245,.131],surfaceTexture('#747e70','paint'),body);lapel2.rotation.z=-.17;
        for(let i=0;i<3;i++)sphere(.009,[.023,1.01+i*.085,.137],M.edge,body);

      }
      actor.userData={kind,body,head,arms,legs,knees,elbows,eyes,hand,carrySocket,pose:'idle',poseElapsed:0,gaze:null,phase:random()*6.28};
      // Soft grounding remains even where real-time directional shadow filtering is weak.
      const shadowTex=canvasTexture(64,64,(c,w,h)=>{const g=c.createRadialGradient(32,32,1,32,32,32);g.addColorStop(0,'rgba(26,28,24,.26)');g.addColorStop(1,'rgba(26,28,24,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
      const shadow=mesh(new T.PlaneGeometry(.75,.58),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}),[0,.025,0],actor);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
      return actor;
    }
    actors.adult=character('Adult you',[1.8,0,3],0x728179,1,'adult');
    actors.child=character('Childhood you',[-2.7,0,1.6],0xb8a175,.73,'child');
    actors.clerk=character('Kind clerk',[.8,0,-2.9],0x8b685b,1,'clerk');
    actors.customer=character('Customer',[2.5,0,-1.42],0x6b7880,.95,'customer');actors.customer.rotation.y=Math.PI;

    // Commercial return point occupies the old corner planter footprint, so
    // diners can clear their tray without adding anything to the central aisle.
    const trayReturn=group('Tray return point',[-4.005,0,3.245],stage);trayReturn.rotation.y=Math.PI/2;
    round(.54,.95,.49,.018,[0,.49,0],enamel,trayReturn);
    round(.55,.065,.50,.012,[0,.985,0],chrome,trayReturn);
    round(.43,.24,.025,.015,[0,.72,.252],brandDark,trayReturn);
    const returnLabel=plane(.41,.13,[0,.41,.255],textTexture('餐盘回收','谢谢您的配合','#eee8d9','#9f302a'),trayReturn);
    for(let i=0;i<4;i++)round(.43,.019,.34,.007,[0,1.03+i*.027,0],brandRed,trayReturn);
    // Small umbrella stand stays inside the other existing corner collider.
    const umbrellaStand=group('Umbrella stand',[3.88,0,-.69],stage);
    cylinder(.135,.12,.40,[0,.21,0],chrome,umbrellaStand);
    for(const x of [-.055,.055]){
      cylinder(.028,.048,.45,[x,.57,0],brandDark,umbrellaStand);
      line([[x,.79,0],[x,.91,0],[x+.025,.95,0],[x+.045,.91,0]],.011,blackMat,umbrellaStand);
    }
    collider(3.72,4.04,-.85,-.53);
    collider(-4.27,-3.72,2.96,3.53);
    // A practical station clock and broad commercial fixtures replace pendants.
    const clock=group('Clock',[-4.32,3.02,-3.68],stage);
    const rim=cylinder(.17,.17,.045,[0,0,0],chrome,clock);rim.rotation.x=Math.PI/2;
    const face=cylinder(.154,.154,.052,[0,0,.008],enamel,clock);face.rotation.x=Math.PI/2;
    for(let i=0;i<12;i++){const a=i*Math.PI/6;const mark=box(.009,.025,.007,[Math.sin(a)*.128,Math.cos(a)*.128,.037],M.edge,clock);mark.rotation.z=-a;}
    const hand1=box(.014,.086,.012,[.026,.026,.047],brandDark,clock);hand1.rotation.z=-.7;
    const hand2=box(.011,.12,.013,[-.034,.025,.05],brandDark,clock);hand2.rotation.z=.98;
    const diffuser=material(0xfff1d7,{emissive:0xffecc9,emissiveIntensity:1.0,roughness:.8});
    for(const xyz of [[-2.7,3.15,-.35],[1.8,3.15,-1.45]]){
      const g=group('Suspended commercial light',xyz,stage);
      for(const x of [-.50,.50])cylinder(.007,.007,.24,[x,.12,0],chrome,g,8);
      round(1.35,.055,.39,.012,[0,0,0],enamel,g);
      round(1.26,.019,.31,.006,[0,-.038,0],diffuser,g);
      const glow=new T.PointLight(0xffe4bb,8,6.5,2);glow.position.set(0,-.18,0);g.add(glow);
    }
    const mat=round(1.15,.024,.76,.009,[2.55,.029,2.85],M.darkTeal,stage);
    const matPrint=plane(.96,.40,[2.55,.043,2.85],textTexture('欢迎光临','请留意脚下','#3e5047','#a2a28b'),stage);matPrint.rotation.x=-Math.PI/2;

    const ambient=new T.HemisphereLight(0xb9cbd0,0x6f6254,1.5);scene.add(ambient);
    const sun=new T.DirectionalLight(0xe7ddc4,2.10);sun.position.set(-5,5,2);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;
    sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;scene.add(sun);
    const fill=new T.DirectionalLight(0xaec8d4,.82);fill.position.set(4,5,4);scene.add(fill);
    // A cool window bounce separates actors from the warm commercial interior.
    const windowBounce=new T.DirectionalLight(0x8aa9b5,.28);windowBounce.position.set(-6,2.6,1.8);scene.add(windowBounce);

    let stowAnimation=null,moodTarget=0,moodValue=0,staffMealRecorded=false;
    function recordStaffMeal(){
      if(staffMealRecorded)return;staffMealRecorded=true;
      const slip=plane(.18,.26,[1.62,1.018,-2.91],textTexture('员工餐','10 / 18    1 份', '#dfd6bf','#6e6858'),stage);slip.rotation.x=-Math.PI/2;slip.rotation.z=.09;props.staffMealTicket=slip;
      return slip;
    }
    function setMood(stageName){moodTarget=stageName==='ending'||stageName==='meal'||stageName==='warm'?1:0;}
    function stowCoupon(object=props.coupon){
      if(!object)return;
      release(object);scene.updateMatrixWorld(true);object.visible=true;
      stowAnimation={elapsed:0,object,start:object.position.clone(),startRotation:object.quaternion.clone(),attached:false};
    }
    function pose(actor,name) {
      if(typeof actor==='string')actor=actors[actor];
      if(actor){
        if(actor.userData.pose!==name){
          if(['rummage','inspect','hesitate','countCoins','confirm','firstBite'].includes(actor.userData.pose))actor.userData.body.rotation.x=0;
          actor.userData.poseElapsed=0;
        }
        actor.userData.pose=name;
        if(name==='walk')actor.userData.gaze=null;
      }
    }
    // Gaze is separate from locomotion: an actor can look down at a voucher or
    // up at the clerk without snapping their whole body toward it. Targets may
    // be scene objects or world-space Vector3s; passing null releases the gaze.
    function lookAt(actor,target,options={}) {
      if(typeof actor==='string')actor=actors[actor];
      if(!actor)return;
      if(!target){actor.userData.gaze=null;return;}
      actor.userData.gaze={target,offset:new T.Vector3(...(options.offset||[0,0,0])),weight:T.MathUtils.clamp(options.weight??1,0,1)};
    }
    function hold(actor,object) {
      if(typeof actor==='string')actor=actors[actor];
      if(!actor||!object)return;
      object.updateWorldMatrix(true,false);const heldScale=object.getWorldScale(new T.Vector3());
      // Reparenting a prop must also release its previous actor's ownership.
      // Otherwise the giver keeps an invisible object and a frozen raised arm.
      Object.values(actors).forEach(previous=>{
        if(previous!==actor&&previous.userData.held===object){previous.userData.held=null;pose(previous,['sit','sitEat'].includes(previous.userData.pose)?'sit':'idle');}
      });
      if(object===meal||object.userData.isMeal){
        actor.userData.carrySocket.add(object);object.position.set(0,0,0);object.rotation.set(0,0,0);
      }else{
        actor.userData.hand.add(object);object.position.set(object.userData.isCoins?-.06:0,-.015,object.userData.isNapkin?.012:object.userData.isFood||object.userData.isCoins?.025:.08);object.rotation.set(object.userData.isNapkin?-Math.PI/2:object.userData.isFood||object.userData.isCoins?0:.45,0,object.userData.isNapkin?.1:0);
      }
      const seated=['sit','sitEat'].includes(actor.userData.pose);
      object.scale.copy(heldScale).divideScalar(actor.scale.x);object.visible=true;actor.userData.held=object;pose(actor,seated?(object.userData.isFood?'sitEat':'sit'):'reach');
    }
    function bite(food=burger) {
      if(!food||food.userData.bitten)return;food.userData.bitten=true;
      const radius=.077,center=.20;
      // A concave bite removes the front edge of each real food layer.
      food.children.forEach(part=>{
        if(part.userData.foodDetail){if(part.position.z>.092&&Math.abs(part.position.x)<.075)part.visible=false;return;}
        if(!part.userData.foodLayer)return;
        part.geometry=part.geometry.clone();const pos=part.geometry.attributes.position;
        for(let i=0;i<pos.count;i++){const x=pos.getX(i)*part.scale.x+part.position.x,z=pos.getZ(i)*part.scale.z+part.position.z;
          if(Math.abs(x)>=radius)continue;const edge=center-Math.sqrt(radius*radius-x*x);
          if(z>edge)pos.setZ(i,(edge-part.position.z)/part.scale.z);
        }
        pos.needsUpdate=true;part.geometry.computeVertexNormals();
      });
    }
    function release(object) {
      if(!object)return;
      scene.attach(object);
      Object.values(actors).forEach(a=>{if(a.userData.held===object){a.userData.held=null;pose(a,['sit','sitEat'].includes(a.userData.pose)?'sit':'idle');}});
    }
    function update(dt,time) {
      const blend=1-Math.exp(-Math.min(dt,.1)*9);
      if(stowAnimation){
        const a=stowAnimation;a.elapsed+=Math.min(dt,.1);
        const smooth=v=>{const p=Math.max(0,Math.min(1,v));return p*p*(3-2*p);};
        const opening=smooth(a.elapsed/.25),closing=smooth((a.elapsed-.94)/.46);
        drawer.position.z=-2.90-.27*opening+.27*closing;
        if(a.elapsed>.20&&!a.attached){
          props.storagePoint.updateWorldMatrix(true,false);
          const target=props.storagePoint.localToWorld(new T.Vector3(0,.008,0));scene.worldToLocal(target);
          const fraction=Math.max(0,Math.min(1,(a.elapsed-.20)/.67)),travel=smooth(fraction);
          a.object.position.lerpVectors(a.start,target,travel);a.object.position.y+=Math.sin(Math.PI*travel)*.08;
          const orientation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),.10);
          a.object.quaternion.slerpQuaternions(a.startRotation,orientation,travel);
          if(fraction===1){props.storagePoint.attach(a.object);a.object.position.set(0,.008,0);a.object.rotation.set(0,.10,0);a.attached=true;}
        }
        if(a.elapsed>=1.4){drawer.position.z=-2.90;a.object.visible=false;stowAnimation=null;}
      }
      moodValue=T.MathUtils.lerp(moodValue,moodTarget,1-Math.exp(-dt*.5));fill.intensity=1.2-moodValue*.10;sun.intensity=2.45+moodValue*.08;
      Object.values(actors).forEach(actor=>{
        const d=actor.userData,p=d.pose,t=time+d.phase;
        d.poseElapsed+=Math.min(dt,.1);
        const age=d.poseElapsed;
        const carrying=!!(d.held===meal||d.held?.userData.isMeal);
        const walking=p==='walk',seated=p==='sit'||p==='sitEat',eating=p==='eat'||p==='sitEat'||p==='firstBite';const swing=walking?Math.sin(time*10)*.42:0;
        // A first bite has anticipation, contact and a small release. Its clock
        // starts with the pose rather than with the global animation loop.
        const smooth=v=>{v=T.MathUtils.clamp(v,0,1);return v*v*(3-2*v);};
        const biteLift=p==='firstBite'?smooth((age-.35)/.9)*(1-smooth((age-2.6)/1.0)):1;
        d.legs.forEach((leg,i)=>{const target=seated?-1.32:(i? -swing:swing);leg.rotation.x=T.MathUtils.lerp(leg.rotation.x,target,blend);});
        let left=walking?-swing:0,right=walking?swing:0;
        if(p==='shy'){left=-.22;right=-.22;}
        if(p==='rummage'){left=-.15+Math.sin(time*2.3)*.06;right=-.25+Math.sin(time*2.3+.8)*.09;d.body.rotation.x=T.MathUtils.lerp(d.body.rotation.x,.22+Math.sin(time*.8)*.008,blend);}
        if(p==='reach'||p==='carry'||d.held){right=-1.19;left=(d.held===meal||d.held?.userData.isMeal)||p==='carry'?-1.12:-.20;}
        if(p==='happy'){left=-.50;right=-.65;}
        if(p==='sit'){left=-.6;right=-.6;}
        if(carrying){left=-.98;right=-.98;}
        if(p==='eat'){right=-.38;left=-.58;}
        if(p==='wipe'){right=-.95+Math.sin(time*3.2)*.025;left=-.18;}
        if(p==='sitEat'){right=-.38-Math.max(0,Math.sin(time*1.05))*.035;left=-.72;}
        if(p==='inspect'||p==='hesitate'){right=-.93;left=-.17;}
        if(p==='countCoins'){right=-.84;left=-.92+Math.sin(age*2.2)*.035;}
        if(p==='confirm'&&!carrying){left=-.2;right=d.held?-1.05:-.16;}
        if(p==='firstBite'){right=T.MathUtils.lerp(-.9,-.38,biteLift);left=-.58;}
        d.elbows.forEach((elbow,i)=>{
          let bend=walking?-.12:p==='shy'?-.16:-.06;
          if(d.held||p==='reach'||p==='carry')bend=i?-.24:-.15;
          if(carrying)bend=.16;
          if(eating&&i===1)bend=p==='firstBite'?T.MathUtils.lerp(-.7,-1.36,biteLift):-1.36;
          if(p==='rummage')bend=-.06+Math.sin(time*2.3+i)*.055;
          if((p==='inspect'||p==='hesitate')&&i===1)bend=-.70;
          if(p==='countCoins')bend=i?-.72:-.36+Math.sin(age*2.2)*.055;
          if(p==='wipe'&&i===1)bend=-1.40+Math.sin(time*3.2)*.025;
          elbow.rotation.x=T.MathUtils.lerp(elbow.rotation.x,bend,blend);
        });
        d.knees.forEach((knee,i)=>{const flex=seated?1.28:walking?Math.max(0,Math.sin(time*10+(i?Math.PI:0)))*.42:0;knee.rotation.x=T.MathUtils.lerp(knee.rotation.x,flex,blend);});
        const blinkPhase=(time+d.phase)%4.7,blink=blinkPhase<.16?Math.max(.10,Math.abs(blinkPhase-.08)/.08):1;
        d.eyes.forEach(eye=>eye.scale.y=T.MathUtils.lerp(eye.scale.y,blink,1-Math.exp(-Math.min(dt,.1)*35)));
        d.arms[0].rotation.x=T.MathUtils.lerp(d.arms[0].rotation.x,left,blend);
        d.arms[1].rotation.x=T.MathUtils.lerp(d.arms[1].rotation.x,right,blend);
        const leftSpread=p==='countCoins'?.37:carrying?-.24:p==='happy'?-.2:.045;
        const rightSpread=p==='wipe'?-1.48+Math.sin(time*3.2)*.035:eating?(p==='firstBite'?T.MathUtils.lerp(-.24,-1.56,biteLift):-1.56):['inspect','hesitate','countCoins'].includes(p)?-.24:carrying?.24:p==='happy'?.2:-.045;
        d.arms[0].rotation.z=T.MathUtils.lerp(d.arms[0].rotation.z,leftSpread,blend);
        d.arms[1].rotation.z=T.MathUtils.lerp(d.arms[1].rotation.z,rightSpread,blend);
        d.body.position.y=T.MathUtils.lerp(d.body.position.y,(seated?-.23:0)+(walking?Math.abs(Math.sin(time*10))*.025:Math.sin(t*1.8)*.008),blend);
        if(['inspect','hesitate','countCoins','confirm','firstBite'].includes(p))d.body.rotation.x=T.MathUtils.lerp(d.body.rotation.x,p==='countCoins'?.065:p==='hesitate'?.025:0,blend*.55);
        let pitch=p==='rummage'?.27:p==='shy'?.22:p==='wipe'?.08:eating?.10:p==='happy'?-.045:['inspect','hesitate','countCoins'].includes(p)?.25:0;
        let yaw=p==='hesitate'?Math.sin(Math.min(age,2.4)*1.6)*.08:0;
        if(d.gaze){
          const target=d.gaze.target,point=target.isObject3D?target.getWorldPosition(new T.Vector3()):new T.Vector3(target.x,target.y,target.z);
          point.add(d.gaze.offset);d.body.updateWorldMatrix(true,false);d.body.worldToLocal(point).sub(d.head.position);
          const horizontal=Math.hypot(point.x,point.z),weight=d.gaze.weight;
          if(horizontal>.001||Math.abs(point.y)>.001){
            pitch=T.MathUtils.lerp(pitch,T.MathUtils.clamp(-Math.atan2(point.y,horizontal),-.32,.46),weight);
            yaw=T.MathUtils.lerp(yaw,T.MathUtils.clamp(Math.atan2(point.x,point.z),-.58,.58),weight);
          }
        }
        if(p==='confirm')pitch+=Math.sin(Math.min(age/1.1,1)*Math.PI)*.105;
        d.head.rotation.x=T.MathUtils.lerp(d.head.rotation.x,pitch,blend*.55);
        d.head.rotation.y=T.MathUtils.lerp(d.head.rotation.y,yaw,blend*.55);
        d.head.rotation.z=T.MathUtils.lerp(d.head.rotation.z,Math.sin(t*.8)*.008,blend);
        if(d.held?.userData.isFood||d.held?.userData.isCoins){
          // The palm supports the bun; the food stays upright as shoulder and elbow bend.
          const wrist=new T.Quaternion().copy(d.body.quaternion).multiply(d.arms[1].quaternion).multiply(d.elbows[1].quaternion).multiply(d.hand.quaternion);
          d.held.quaternion.copy(wrist.invert()).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),d.held.userData.isCoins?0:Math.PI));
        }
      });
      const opened=!lid.visible||lid.position.y>.13||Math.abs(lid.rotation.x)+Math.abs(lid.rotation.z)>.25;
      steam.visible=meal.visible&&opened&&burger.parent===meal;
      steam.children.forEach((sprite,i)=>{const phase=(time*.19+sprite.userData.offset)%1;sprite.position.set(-.22+Math.sin(time*.7+i)*.035,.35+phase*.46,.02+Math.cos(i*2)*.035);sprite.scale.set(.11+phase*.16,.22+phase*.20,1);sprite.material.opacity=Math.sin(phase*Math.PI)*.3;});
      rain.children.forEach((drop,i)=>{drop.position.y=((drop.userData.baseY-time*(.025+(i%3)*.011))%1.98+1.98)%1.98;});
    }
    pose(actors.child,'shy');
    return {actors,props,colliders,bounds:{minX:-4.05,maxX:4.05,minZ:-1.75,maxZ:3.65},floor,update,pose,lookAt,hold,release,bite,stowCoupon,setMood,recordStaffMeal};
  };
})();
