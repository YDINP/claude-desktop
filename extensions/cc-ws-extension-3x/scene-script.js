'use strict';

// CC 3.x scene script — runs in engine context, has access to cc globals

function findByUUID(node, uuid) {
  if (!node) return null;
  if (node.uuid === uuid) return node;
  for (const child of node.children) {
    const found = findByUUID(child, uuid);
    if (found) return found;
  }
  return null;
}

function getUITransform(node) {
  try {
    if (cc.UITransform) return node.getComponent(cc.UITransform);
    return node.getComponent('UITransform');
  } catch { return null; }
}

function getOpacity(node) {
  try {
    // CC 3.x: UIOpacity component or node.opacity (0-255)
    if (typeof node.opacity === 'number') return node.opacity;
    if (node._uiProps && typeof node._uiProps.localOpacity === 'number') {
      return Math.round(node._uiProps.localOpacity * 255);
    }
  } catch {}
  return 255;
}

function getClassName(c) {
  try {
    if (cc.js && cc.js.getClassName) return cc.js.getClassName(c);
    if (c.constructor && c.constructor.name) return c.constructor.name;
  } catch {}
  return 'unknown';
}

function nodeToJson(node, deep) {
  if (!node) return null;
  const uiTrans = getUITransform(node);
  const pos = node.position || { x: 0, y: 0, z: 0 };

  return {
    uuid: node.uuid,
    name: node.name,
    active: node.active,
    position: { x: Math.round(pos.x), y: Math.round(pos.y) },
    size: uiTrans
      ? { width: Math.round(uiTrans.contentSize.width), height: Math.round(uiTrans.contentSize.height) }
      : { width: 0, height: 0 },
    anchor: uiTrans
      ? { x: uiTrans.anchorPoint.x, y: uiTrans.anchorPoint.y }
      : { x: 0.5, y: 0.5 },
    scale: { x: node.scale ? node.scale.x : 1, y: node.scale ? node.scale.y : 1 },
    rotation: typeof node.angle === 'number' ? node.angle : (node.rotation || 0),
    opacity: getOpacity(node),
    color: { r: 255, g: 255, b: 255, a: 255 },
    children: deep ? node.children.map(c => nodeToJson(c, true)).filter(Boolean) : [],
    components: (node.components || []).map(c => ({ type: getClassName(c) })),
  };
}

module.exports = {
  getNodeTree() {
    const scene = cc.director.getScene();
    if (!scene) return null;
    return nodeToJson(scene, true);
  },

  getNode(options) {
    const scene = cc.director.getScene();
    if (!scene) return null;
    const node = findByUUID(scene, options.uuid);
    if (!node) return null;
    return nodeToJson(node, false);
  },

  setNodeProperty(options) {
    const scene = cc.director.getScene();
    if (!scene) return { ok: false, error: 'No scene' };
    const node = findByUUID(scene, options.uuid);
    if (!node) return { ok: false, error: 'Node not found' };

    const { key, value } = options;
    const uiTrans = getUITransform(node);
    const pos = node.position;

    if (key === 'x') node.setPosition(value, pos.y, pos.z || 0);
    else if (key === 'y') node.setPosition(pos.x, value, pos.z || 0);
    else if (key === 'width' && uiTrans) uiTrans.width = value;
    else if (key === 'height' && uiTrans) uiTrans.height = value;
    else if (key === 'anchorX' && uiTrans) uiTrans.anchorX = value;
    else if (key === 'anchorY' && uiTrans) uiTrans.anchorY = value;
    else if (key === 'opacity') {
      if (typeof node.opacity === 'number') node.opacity = value;
      else if (node._uiProps) node._uiProps.localOpacity = value / 255;
    }
    else if (key === 'rotation') node.angle = value;
    else if (key === 'active') node.active = value;

    return { ok: true };
  },

  moveNode(options) {
    const scene = cc.director.getScene();
    if (!scene) return { ok: false, error: 'No scene' };
    const node = findByUUID(scene, options.uuid);
    if (!node) return { ok: false, error: 'Node not found' };
    const pos = node.position;
    node.setPosition(options.x, options.y, pos.z || 0);
    return { ok: true };
  },
};
