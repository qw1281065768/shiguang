(function () {
  'use strict';
  // Only local, pre-generated GLBs are loaded by the game. API credentials stay
  // in the Python authoring tool, never in this manifest or the browser.
  // A failed or stalled art download must never hold the chapter hostage. The
  // manifest and concurrent model loads have a shared 18-second upper bound.
  function deadline(work, milliseconds, label, lateResult, onTimeout) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        if (onTimeout) onTimeout();
        reject(new Error(label + ' timed out'));
      }, Math.max(0, milliseconds));
      Promise.resolve().then(work).then(value => {
        if (settled) { if (lateResult) lateResult(value); return; }
        settled = true; clearTimeout(timer); resolve(value);
      }, error => {
        if (settled) return;
        settled = true; clearTimeout(timer); reject(error);
      });
    });
  }
  function disposeAsset(asset) {
    if (!asset) return;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    const scenes = new Set([asset.scene, ...(asset.scenes || [])]);
    scenes.forEach(scene => scene?.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.skeleton?.boneTexture) textures.add(object.skeleton.boneTexture);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach(material => {
        materials.add(material);
        Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
      });
    }));
    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
    geometries.forEach(geometry => geometry.dispose());
  }
  window.loadGiftAssets = async function (T, world) {
    const started = performance.now(), totalBudget = 18000;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const manifest = await deadline(async () => {
      const response = await fetch('./assets/tripo/manifest.json', {cache:'no-cache', ...(controller ? {signal:controller.signal} : {})});
      if (!response.ok) throw new Error('Asset manifest unavailable');
      return response.json();
    }, 6000, 'Asset manifest', null, () => controller?.abort());
    if (!Array.isArray(manifest.assets)) throw new Error('Invalid asset manifest');
    const loader = new T.GLTFLoader();
    const results = await Promise.all(manifest.assets.filter(a => a.enabled).map(async entry => {
      let asset = null;
      try {
        if (!/^[a-zA-Z0-9_./-]+\.glb$/.test(entry.url) || entry.url.includes('..') || !entry.url.startsWith('assets/tripo/')) throw new Error('Asset must be a local GLB');
        const anchor = world.props[entry.target];
        if (!anchor) throw new Error('Unknown asset attachment point');
        if (['meal','burger','lid','coupon'].includes(entry.target)) throw new Error('Articulated gameplay props require per-part integration');
        const remaining = Math.min(12000, totalBudget - (performance.now() - started));
        if (remaining <= 0) throw new Error('Asset loading budget exhausted');
        asset = await deadline(() => loader.loadAsync(entry.url), remaining, 'Model ' + entry.id, disposeAsset);
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
            // Preserve the loader's color spaces and map channels: normal and
            // roughness data must not be converted as if they were colour.
            Object.values(m).forEach(value=>{if(value?.isTexture)value.anisotropy=4;});
            if('metalness' in m)m.metalness=Math.min(Number.isFinite(m.metalness)?m.metalness:0,.12);
            if('roughness' in m)m.roughness=Math.max(Number.isFinite(m.roughness)?m.roughness:0,.68);
            if('envMapIntensity' in m)m.envMapIntensity=.55;
          });
        });
        const existing = [...anchor.children];
        anchor.add(model);
        existing.forEach(o => o.visible = false);
        anchor.userData.externalAsset = entry.id;
        return {id:entry.id,loaded:true};
      } catch (error) {
        disposeAsset(asset);
        console.warn('Model retained procedural fallback:', entry.id, error.message);
        return {id:entry.id,loaded:false};
      }
    }));
    return results;
  };
})();
