'use strict';

// CC 2.x 씬 스크립트 — 씬 내부 데이터 접근
module.exports = {
  // 전체 노드 트리 반환
  getNodeTree(event) {
    const scene = cc.director.getScene();
    if (!scene) { event.reply('No scene loaded'); return; }
    function nodeToJson(node) {
      return {
        uuid: node.uuid,
        name: node.name,
        active: node.active,
        position: { x: Math.round(node.x), y: Math.round(node.y) },
        size: { width: Math.round(node.width), height: Math.round(node.height) },
        anchor: { x: node.anchorX, y: node.anchorY },
        scale: { x: node.scaleX, y: node.scaleY },
        rotation: node.rotation,
        opacity: node.opacity,
        color: { r: node.color.r, g: node.color.g, b: node.color.b, a: node.color.a },
        children: node.children.map(nodeToJson),
        components: node._components.map(c => ({ type: cc.js.getClassName(c) })),
      };
    }
    event.reply(null, nodeToJson(scene));
  },

  // 단일 노드 정보
  getNode(event, options) {
    const node = findByUUID(cc.director.getScene(), options.uuid);
    if (!node) { event.reply('Node not found'); return; }
    event.reply(null, {
      uuid: node.uuid, name: node.name,
      position: { x: node.x, y: node.y },
      size: { width: node.width, height: node.height },
      anchor: { x: node.anchorX, y: node.anchorY },
      opacity: node.opacity,
      color: { r: node.color.r, g: node.color.g, b: node.color.b, a: node.color.a },
    });
  },

  // 노드 프로퍼티 설정
  setNodeProperty(event, options) {
    const node = findByUUID(cc.director.getScene(), options.uuid);
    if (!node) { event.reply('Node not found'); return; }
    const { key, value } = options;
    if (key === 'x') node.x = value;
    else if (key === 'y') node.y = value;
    else if (key === 'width') node.width = value;
    else if (key === 'height') node.height = value;
    else if (key === 'opacity') node.opacity = value;
    else if (key === 'rotation') node.rotation = value;
    else if (key === 'scaleX') node.scaleX = value;
    else if (key === 'scaleY') node.scaleY = value;
    else if (key === 'active') node.active = value;
    else if (key === 'color' && value) {
      node.color = new cc.Color(value.r, value.g, value.b, value.a ?? 255);
    }
    event.reply(null, { ok: true });
  },

  // 노드 이동
  moveNode(event, options) {
    const node = findByUUID(cc.director.getScene(), options.uuid);
    if (!node) { event.reply('Node not found'); return; }
    node.x = options.x;
    node.y = options.y;
    event.reply(null, { ok: true });
  },
};

function findByUUID(node, uuid) {
  if (node.uuid === uuid) return node;
  for (const child of node.children) {
    const found = findByUUID(child, uuid);
    if (found) return found;
  }
  return null;
}
