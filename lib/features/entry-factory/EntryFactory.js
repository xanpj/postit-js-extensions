import {
  getBusinessObject,
  getDiBounds,
} from 'postit-js-core/lib/util/ModelUtil.js';
import {
  assign
} from 'min-dash';
export const POSTIT_IMAGE = 'postit:Image';
export const POSTIT_TYPES = [POSTIT_IMAGE, 'postit:Group', 'postit:SquarePostit', 'postit:CirclePostit', 'postit:TextBox'];
export const randStr = function(length = 5) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
export const ENTRIES = [{
  objId: 'Global Book V1',
  type: POSTIT_IMAGE,
  objTitle: 'Global Book V1',
  objUnkeyedOriginal: false,
  objCreationDate: '2012-20-20-19-02-10',
  source: 'https://picsum.photos/seed/1/150/150',
  sourceUnkeyed: 'https://picsum.photos/seed/101/150/150',
}, {
  objId: 'Global Book V2',
  type: POSTIT_IMAGE,
  objTitle: 'Global Book V2',
  objUnkeyedOriginal: false,
  objCreationDate: '2012-20-20-19-02-10',
  source: 'https://picsum.photos/seed/2/150/150',
  sourceUnkeyed: 'https://picsum.photos/seed/102/150/150',
}, {
  objId: 'Global Duck V3',
  type: POSTIT_IMAGE,
  objTitle: 'Global Duck V3',
  objUnkeyedOriginal: false,
  objCreationDate: '2012-20-20-19-02-10',
  source: 'https://picsum.photos/seed/3/150/150',
  sourceUnkeyed: 'https://picsum.photos/seed/103/150/150',
}, {
  objId: 'Global Esinquvy V4',
  type: POSTIT_IMAGE,
  objTitle: 'Global Esinquvy V4',
  objUnkeyedOriginal: false,
  objCreationDate: '2012-20-20-19-02-10',
  source: 'https://picsum.photos/seed/4/150/150',
  sourceUnkeyed: 'https://picsum.photos/seed/104/150/150',
}, {
  objId: 'Global Frjoprstz V5',
  type: POSTIT_IMAGE,
  objTitle: 'Global Frjoprstz V5',
  objUnkeyedOriginal: false,
  objCreationDate: '2012-20-20-19-02-10',
  source: 'https://picsum.photos/seed/5/150/150',
  sourceUnkeyed: 'https://picsum.photos/seed/105/150/150',
}, {
  objId: 'Global Hslmwx V6',
  type: POSTIT_IMAGE,
  objTitle: 'Global Hslmwx V6',
  objUnkeyedOriginal: false,
  objCreationDate: '2012-20-20-19-02-10',
  source: 'https://picsum.photos/seed/9/150/150',
  source2: 'https://picsum.photos/seed/10/150/150',
  sourceUnkeyed: 'https://picsum.photos/seed/109/150/150',
}];
export const ENTRY_PROTOTYPE = (e) => {
  return {
    id: e.id == null ? randStr() : e.id,
    type: e.type || null,
    objId: e.objId == null ? randStr() : e.objId,
    objTitle: e.objTitle || '',
    objDescription: e.objDescription || '',
    objStarred: e.objStarred ? true : false,
    objHidden: e.objHidden ? true : false,
    objCreationDate: e.objCreationDate || '',
    x: e.x || null,
    y: e.y || null,
    width: e.width || null,
    height: e.height || null,
  };
};
export const IMAGE_ENTRY_PROTOTYPE = (e) => {
  return { ...ENTRY_PROTOTYPE(e),
    type: POSTIT_IMAGE,
    objStacked: e.objStacked ? true : false,
    source: e.source || '',
    source2: e.source2 || '',
    sourceUnkeyed: e.sourceUnkeyed || '',
    objUnkeyed: e.objUnkeyed ? true : false,
    objUnkeyedOriginal: e.objUnkeyedOriginal ? true : false,
  };
};
export const objectPropertiesDefined = function(obj) {
  for (var key of Object.keys(obj)) {
    if (obj[key] === undefined) {
      return false;
    }
  }
  return true;
};
export const getCanvasEntries = function(_canvas) {
  const entries = [];
  const elements = _canvas._elementRegistry._elements; // TODO check if rendered
  Object.keys(elements).forEach(elId => {
    const element = elements[elId].element;

    // check necessary?
    if (element.type == POSTIT_IMAGE) {
      entries.push(elementToEntry(element));
    }
  });
  return entries;
};
export const elementToEntry = (shape) => {
  var entry = null;
  let bo = getBusinessObject(shape);

  let type, objTitle;
  type = bo.$type;
  const {
    id,
    objId,
    objDescription,
    objStarred,
    objHidden,
    objCreationDate
  } = bo;
  if (type == POSTIT_IMAGE) {
    var {
      objUnkeyed,
      objUnkeyedOriginal,
      objStacked,
      source,
      source2,
      sourceUnkeyed
    } = bo;
    objTitle = bo.objTitle;
  } else {
    if (bo.name) {
      objTitle = bo.name;
    }
  }
  var {
    x,
    y,
    width,
    height
  } = getDiBounds(shape);
  if (type == POSTIT_IMAGE) {
    entry = {
      type,
      id,
      objId,
      objTitle,
      objDescription,
      objStarred,
      objHidden,
      objUnkeyed,
      objUnkeyedOriginal,
      objCreationDate,
      objStacked,
      source,
      source2,
      sourceUnkeyed,
      x,
      y,
      width,
      height
    };
  } else {
    entry = {
      type,
      id,
      objId,
      objTitle,
      objDescription,
      objStarred,
      objHidden,
      objCreationDate,
      x,
      y,
      width,
      height
    };
  }
  return entry;
};
export const fusionEntry = function(entry, elementEntry) {
  var { x, y, width, height } = elementEntry;
  if (elementEntry.type == POSTIT_IMAGE) {
    var { source, source2, sourceUnkeyed } = elementEntry;
    return { ...entry, x, y, width, height, source, source2, sourceUnkeyed };
  }
  return { ...entry, x, y, width, height };
};
export const convertToDefinedEntry = function(options) {

  // not using is() because it requires businessObject
  return (options.type == POSTIT_IMAGE) ? IMAGE_ENTRY_PROTOTYPE(options) : ENTRY_PROTOTYPE(options);
};
export const convertToEntry = convertToDefinedEntry;
export const updateImageSource = function(_modeling, source, element) {
  _modeling.updateProperties(element, {
    source: source
  });
};
export const updateImageProperties = function(_modeling, element, options) {
  if (options.type && options.type === POSTIT_IMAGE) {
    delete options.id;
  }
  _modeling.updateProperties(element, { ...options
  });
};
export const createImageElement = function(_elementFactory, _modeling, _canvas, options, x, y, position = null) {
  return createCanvasElement(_elementFactory, _modeling, _canvas, POSTIT_IMAGE, options, x, y, position);
};
export const createCanvasElement = function(_elementFactory, _modeling, _canvas, type, options, x, y, position, shape = null) {
  options = options || [];
  if (!shape) {
    if (options.type && options.type === POSTIT_IMAGE) {
      delete options.id;
    }
    shape = _elementFactory.createShape({
      type: type,
    });
  } else {
    if (options.type && options.type === POSTIT_IMAGE) {
      delete shape.id;
    }
  }
  const attach = false;
  const hints = {
    createElementsBehavior: false
  };
  const prepPosition = {
    x: (Math.random() * 100),
    y: (Math.random() * 100)
  };
  position = position ? position : (x == null && y == null)
    ? {
      x: Math.round(prepPosition.x),
      y: Math.round(prepPosition.y)
    }
    : {
      x: Math.round(prepPosition.x + x),
      y: Math.round(prepPosition.y + y)
    };
  const target = _canvas.getRootElement();
  const element = _modeling.createElements([shape], position, target, assign({}, hints, {
    attach: attach,
  }));

  /* seting properties: we cannot set the business properties during creation so we need to update immediately after */
  _modeling.updateProperties(element[0], {
    ...options
  });

  // returning position seperately because their is a diagram.js related bug with shape positions
  return {
    shape: shape,
    x: position.x,
    y: position.y
  };
};
export default function EntryFactory() {}