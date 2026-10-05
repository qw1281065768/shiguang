(function () {
  'use strict';
  // Only local, pre-generated GLBs are loaded by the game. API credentials stay
  // in the Python authoring tool, never in this manifest or the browser.
  window.loadGiftAssets = async function (T, world) {
    const results = [];
    const response = await fetch('./assets/tripo/manifest.json', {cache:'no-cache'});
    if (!response.ok) throw new Error('Asset manifest unavailable');
    const manifest = await response.json();
    if (!Array.isArray(manifest.assets)) throw new Error('Invalid asset manifest');
    const loader = new T.GLTFLoader();
    for (const entry of manifest.assets.filter(a => a.enabled)) {
      try {
        if (!/^[a-zA-Z0-9_./-]+\.glb$/.test(entry.url) || entry.url.includes('..') || !entry.url.startsWith('assets/tripo/')) throw new Error('Asset must be a local GLB');
        const anchor = world.props[entry.target];
        if (!anchor) throw new Error('Unknown asset attachment point');
        if (['meal','burger','lid','coupon'].includes(entry.target)) throw new Error('Articulated gameplay props require per-part integration');
        const asset = await loader.loadAsync(entry.url);
        const model = asset.scene;
        model.rotation.set(...(entry.rotation || [0,0,0]));
        const size = new T.Box3().setFromObject(model).getSize(new T.Vector3());
        const normalization = entry.height ? entry.height / size.y : entry.maxDimension ? entry.maxDimension / Math.max(size.x,size.y,size.z) : 1;
        const scale = normalization * (entry.scale ?? 1);
        if (!Number.isFinite(scale) || scale <= 0) throw new Error('Asset has invalid dimensions');
        model.scale.setScalar(scale);
        const bounds = new T.Box3().setFromObject(model), center = bounds.getCenter(new T.Vector3());
        model.position.set(-center.x, entry.grounded === false ? -center.y : -bounds.min.y, -center.z);
        if (entry.offset) model.position.add(new T.Vector3(...entry.offset));
        model.traverse(o => {
          if(!o.isMesh)return;
          o.castShadow=true;o.receiveShadow=true;
          // Text-to-model exports often mark every pixel as metallic. That
          // makes canvas, ABS and painted wood read like chrome in the diner.
          // Keep the generated PBR textures, but give this lived-in scene a
          // restrained non-metallic response; small metal details still read
          // through their baked texture and highlights.
          const materials=Array.isArray(o.material)?o.material:[o.material];
          materials.filter(Boolean).forEach(m=>{
            if('metalness' in m)m.metalness=Math.min(Number.isFinite(m.metalness)?m.metalness:0,.12);
            if('roughness' in m)m.roughness=Math.max(Number.isFinite(m.roughness)?m.roughness:0,.68);
            if('envMapIntensity' in m)m.envMapIntensity=.55;
          });
        });
        const existing = [...anchor.children];
        anchor.add(model);
        existing.forEach(o => o.visible = false);
        anchor.userData.externalAsset = entry.id;
        results.push({id:entry.id,loaded:true});
      } catch (error) {
        console.warn('Model retained procedural fallback:', entry.id, error.message);
        results.push({id:entry.id,loaded:false});
      }
    }
    return results;
  };
})();
