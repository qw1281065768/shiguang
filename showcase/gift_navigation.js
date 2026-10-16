/* Shared by walking, the guided demo and the headless route checks. */
(function(root) {
  'use strict';
  function createNavigation(bounds, obstacles, radius = .23, step = .2) {
    const clear = (x, z) => x >= bounds.minX + radius && x <= bounds.maxX - radius &&
      z >= bounds.minZ + radius && z <= bounds.maxZ - radius &&
      !obstacles.some(b => x > b.minX - radius && x < b.maxX + radius && z > b.minZ - radius && z < b.maxZ + radius);
    const lineClear = (a, b) => {
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (step / 3)));
      for (let i = 0; i <= n; i++) if (!clear(a.x + (b.x-a.x)*i/n, a.z + (b.z-a.z)*i/n)) return false;
      return true;
    };
    const cols = Math.floor((bounds.maxX-bounds.minX)/step)+1;
    const rows = Math.floor((bounds.maxZ-bounds.minZ)/step)+1;
    const point = id => ({x:bounds.minX+(id%cols)*step, z:bounds.minZ+Math.floor(id/cols)*step});
    const nearest = p => {
      let best=-1, distance=Infinity;
      for(let i=0;i<cols*rows;i++) { const v=point(i);if(!clear(v.x,v.z))continue;
        const d=(v.x-p.x)**2+(v.z-p.z)**2;if(d<distance){distance=d;best=i;}
      } return best;
    };
    function route(from, to) {
      if(!clear(to.x,to.z)||!clear(from.x,from.z))return null;
      if(lineClear(from,to))return [{x:to.x,z:to.z}];
      const start=nearest(from),end=nearest(to);
      if(start<0||end<0||!lineClear(from,point(start))||!lineClear(point(end),to))return null;
      const queue=[start],visited=new Set([start]),prev=new Map();
      for(let i=0;i<queue.length;i++) {
        const id=queue[i];if(id===end)break;
        const x=id%cols,z=Math.floor(id/cols);
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
          const nx=x+dx,nz=z+dz,nid=nz*cols+nx;
          if(nx<0||nz<0||nx>=cols||nz>=rows||visited.has(nid))continue;
          if(!lineClear(point(id),point(nid)))continue;
          visited.add(nid);prev.set(nid,id);queue.push(nid);
        }
      }
      if(!visited.has(end))return null;
      const path=[{x:to.x,z:to.z}];let id=end;
      while(id!==start){path.unshift(point(id));id=prev.get(id);}
      path.unshift(point(start));
      const smooth=[];let last=from;
      while(path.length){let n=path.length-1;while(n>0&&!lineClear(last,path[n]))n--;
        last=path[n];smooth.push(last);path.splice(0,n+1);}
      return smooth;
    }
    return {clear,lineClear,route};
  }
  // Hesitation is reversible. Only the child's completed meal ends this act;
  // leaving with the voucher keeps the memory open for exploration and return.
  const allowed={intro:['buy'],buy:['choice'],choice:['adult','doorway'],doorway:['adult','leave'],adult:['child'],child:['return'],return:['meal'],meal:['eat'],eat:['done'],leave:['choice'],done:[]};
  function createStory() {
    let stage='intro';const history=['intro'];
    return {get stage(){return stage},get history(){return history.slice()},
      advance(next){if(!allowed[stage].includes(next))return false;stage=next;history.push(next);return true;}};
  }
  root.GiftCore={createNavigation,createStory};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.GiftCore;
})(typeof window!=='undefined'?window:globalThis);
