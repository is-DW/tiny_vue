import { ShapeFlags } from "@tiny_vue/shared";
import { isSameVNode } from "./createVNode";

export function createRenderer(renderOptions) {
  const {
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    setText: hostSetText,
    setElementText: hostElementSetText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    patchProp: hostPatchProp,
  } = renderOptions;

  const mountChildren = (children, container) => {
    for (let i = 0; i < children.length; i++) {
      // 可能是纯文本
      patch(null, children[i], container);
    }
  };

  const mountElement = (vnode, container) => {
    const { type, children, props, shapeFlag } = vnode;

    let el = (vnode.el = hostCreateElement(type));

    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostElementSetText(el, children);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(children, el);
    }

    hostInsert(el, container);
  };

  const processElement = (n1, n2, container) => {
    if (n1 === null) {
      mountElement(n2, container);
    } else {
      patchElement(n1, n2, container);
    }
  };

  const patchProps = (oldProps, newProps, el) => {
    for (const key in newProps) {
      hostPatchProp(el, key, oldProps[key], newProps[key]);
    }

    for (const key in oldProps) {
      if (!(key in newProps)) {
        hostPatchProp(el, key, oldProps[key], null);
      }
    }
  };

  const unmountChildren = (children) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
    }
  };

  const patchKeyedChildren = (c1, c2, el) => {
    // 比较两儿子的差异更新el
    // appendChild removeChild insertBefore
    // [a,b,c,e,f,d]
    // [a,b,d,q,f,d]
    //
    // 1. 先从头开始比较，再从尾部开始比较，确定不一样元素的范围
    // 2.

    let i = 0; // 开始对比索引
    let e1 = c1.length - 1; // 第一个数组尾部索引
    let e2 = c2.length - 1; // 第二个数组尾部索引

    while (i <= e1 && i <= e2) {
      // 任何一个数组循环结束，就要终止比较
      const n1 = c1[i];
      const n2 = c2[i];

      if (isSameVNode(n1, n2)) {
        patch(n1, n2, el);
      } else {
        break;
      }
      i++;
    }

    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2];

      if (isSameVNode(n1, n2)) {
        patch(n1, n2, el);
      } else {
        break;
      }

      e1--;
      e2--;
    }

    // 处理增加和删除的特殊情况
  };

  /**
   * 算法重要 对比children: text array null
   *
   * 新      旧
   * text    array  删除旧的，设置文本内容
   * text    text   更新文本即可
   * text    null   更新文本即可
   * array   array  diff算法
   * array   text   清空文本，进行挂载
   * array   null   进行挂载
   * null    array  删除所有儿子
   * null    text   清空文本
   * null    null   无需处理
   */
  const patchChildren = (n1, n2, el) => {
    let c1 = n1.children;
    let c2 = n2.children;

    const prevShapeFlag = n1.shapeFlag;
    const currShapeFlag = n1.shapeFlag;

    if (currShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1);
      }

      if (c1 !== c2) {
        hostElementSetText(el, c2);
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (currShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // diff 算法

          patchKeyedChildren(c1, c2, el);
        } else {
          unmountChildren(c1);
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostElementSetText(el, "");
        }

        if (currShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(c2, el);
        }
      }
    }
  };

  const patchElement = (n1, n2, container) => {
    // 1. 比较元素的差异，需要复用dom
    // 2. 比较属性和元素的子节点

    let el = (n2.el = n1.el); // 复用dom

    let oldProps = n1.props || {};
    let newProps = n2.props || {};

    // 只针对某个属性处理
    patchProps(oldProps, newProps, el);

    patchChildren(n1, n2, el);
  };

  const patch = (n1, n2, container) => {
    // 两次一样的元素，则跳过
    if (n1 === n2) {
      return;
    }

    if (n1 && !isSameVNode(n1, n2)) {
      unmount(n1);
      n1 = null;
    }

    // 对元素处理
    processElement(n1, n2, container);
  };

  const unmount = (vnode) => {
    hostRemove(vnode.el);
  };

  // 多次调用render会进行虚拟节点的对比，再进行更新
  const render = (vnode, container) => {
    if (vnode === null) {
      if (container._vnode) {
        unmount(container._vnode);
      }
    }

    // 将虚拟节点变成真实节点进行渲染
    patch(container._vnode || null, vnode, container);

    container._vnode = vnode;
  };

  return {
    render,
  };
}
