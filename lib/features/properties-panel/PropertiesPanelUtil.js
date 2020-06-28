import {
  getBusinessObject,
  is
} from 'postit-js-core/lib/util/ModelUtil.js';

import {
  assign,
} from 'min-dash';

import {
  Map
} from 'immutable';

import {
  DEBUG,
  ENTRY_PROTOTYPE,
  POSTIT_IMAGE,
  POSTIT_TYPES,
  CANVAS_ENTRIES,
  objectPropertiesDefined
} from './Constants.js';


export const createCanvasElement = function(type, options, position, shape = null) {
  if (!shape) {
    shape = this._elementFactory.createShape({
      type,
      ...options,
    });
  }
  shape.panelCreated = options.panelCreated;
  const attach = false;
  const hints = { createElementsBehavior: false };
  position = (position && position.x && position.y) ? position : { x: Math.random() * 100, y: Math.random() * 100 };
  const target = this._canvas.getRootElement();
  this._modeling.createElements([shape], position, target, assign({}, hints, {
    attach: attach,
  }));
  return { id: shape.id, x: position.x, y: position.y, shape, width: shape.width, height: shape.height };
};

export const deleteCanvasElement = function(listName, elId) {
  const el = this.lists[listName].get(elId);
  const element = this.findCanvasElement(el);
  if (element && element.element) {
    this._modeling.removeElements([ element.element ]);
  }
};

export const deleteCanvasElementDirectly = function(element) {
  if (element && element.element)
    this._modeling.removeElements([ element.element ]);
};

export const findListElement = function(listName, element) {
  if (element.id !== undefined) {
    const elId = this.lists[listName].findIndex(el => el.id == element.id);
    return elId > -1 ? elId : null;
  } else {
    return null;
  }
};

export const findCanvasElement = function(el, canvasElements = null) {
  if (!canvasElements) {
    canvasElements = this._canvas._elementRegistry._elements;
  }
  if (el.id !== undefined) {
    const element = Object.keys(canvasElements).find(elementId => el.id == elementId);
    return element ? canvasElements[element] : null;
  } else {
    return null;
  }
};


/**
 * syncing entries to canvas elements without history change or reaction to canvas events.
 *
 * @param      {Array}  listName        panel list name
 * @param      {Array}  targetElements  target elements to sync to | null for canvasElements
 * @param      {Array}  createMissing   draw missing elements from this.lists to canvas
 * @param      {Array}  deleteableElements delete canvas elements in deleteableElements (elements that are not present in the current state of this.lists)
 */
export const syncToCanvas = function(listName, targetElements = null, createMissing = false, deleteableElements = []) {
  let elements = targetElements;
  if (!elements) {
    elements = this._canvas._elementRegistry._elements;
  }

  /* delete historic elements */
  deleteableElements.forEach(el => {
    const element = this.findCanvasElement(el, elements);
    this.deleteCanvasElementDirectly(element);
  });

  /* modify or create elements */
  const newIdPairs = {};
  const entriesArray = this.lists[listName];
  entriesArray.forEach((el, elId) => {
    const element = this.findCanvasElement(el, elements);
    if (createMissing && !element && !el.objHidden) {

      // display xy fix
      const xy = { x: Math.round(el.objPositionX+(el.width/2)), y: Math.round(el.objPositionY+(el.height/2)) };
      if (el.objType == POSTIT_IMAGE) {
        const { id } = this.createCanvasElement(POSTIT_IMAGE, { source: el.source, panelCreated: true }, xy);
        newIdPairs[el.id] = id;
      } else {
        const shape = this.canvasShapes.get(el.id);
        const { id } = this.createCanvasElement(POSTIT_IMAGE, { panelCreated: true }, xy, shape);
        newIdPairs[el.id] = id;
      }
    }

    if (element) {
      const shape = element.element;
      const bo = getBusinessObject(shape);
      const {
        objId,
        objTitle,
        objType,
        objDescription,
        objStarred,
        objHidden,
        objUnkeyed,
        objCreationDate,
        source,
        objSrcUnkeyed,
        objUnkeyedOriginal,

        /* objPositionX,
        objPositionY,*/
        width,
        height,
      } = element.element;
      const entry = {
        objId,
        objTitle,
        objType,
        objDescription,
        objStarred,
        objHidden,
        objUnkeyed,
        objCreationDate,
        source,
        objSrcUnkeyed,
        objUnkeyedOriginal,
        objPositionX: shape.x,
        objPositionY: shape.y,
        width,
        height,
      };
      const attributesOld = Map({ source: element.source, ...bo.$attrs });
      const attributedMed = Map(entry);
      let attributesNew = Map(el);
      attributesNew = attributesNew.delete('id');
      if (!attributesOld.equals(attributesNew)
      && !attributedMed.equals(attributesNew)) {
        this._modeling.updateProperties(element.element, {
          ...el,
        });
      }
    }
  });
  return newIdPairs;
};

export const importShapeToPanel = function(shape) {

  // if element was not created through panel
  if (!shape.panelCreated) {
    if (!is(shape, POSTIT_IMAGE)) {
      this.canvasShapes = this.canvasShapes.set(shape.id, shape);
    }
    const el = convertShapeToPanelElement(shape);
    if (el) {
      const createCanvasElement = false;
      this.addEntry(CANVAS_ENTRIES, el, createCanvasElement);
    }
  }
};

export const convertShapeToPanelElement = function(shape) {
  if (shape && POSTIT_TYPES.has(shape.type)) {
    const bo = getBusinessObject(shape);
    const el = {
      id: shape.id,
      source: shape.source || null,
      objType: shape.type,
      objTitle: shape.name || bo.name || '',
      objSrcUnkeyed: '',
      objPositionX: shape.x,
      objPositionY: shape.y,
      width: shape.width,
      height: shape.height,
    };
    return { ...ENTRY_PROTOTYPE(), ...el };
  }
  return null;
};

/**
 * sync canvas element properties to panel entries
 *
 * @param      {null|Array}  entriesArray panel entries | null for this.lists
 * @param      {Array}  sourceElements to sync from | null for canvasElements
 */
export const syncFromCanvas = function(entriesArray = null, sourceElements = null) {
  (DEBUG) ? console.log('syncFromCanvas') : void(0);
  let elements = sourceElements;
  if (!elements) {
    elements = this._canvas._elementRegistry._elements;
  }
  (DEBUG) ? console.log(elements) : void(0);
  Object.keys(elements).forEach(elId => {
    const element = elements[elId].element;
    (DEBUG) ? console.log('element') : void(0);
    (DEBUG) ? console.log(element) : void(0);
    if (POSTIT_TYPES.includes(element.type)) {
      const bo = getBusinessObject(element);
      const {
        objId,
        objTitle,
        objType,
        objDescription,
        objStarred,
        objHidden,
        objUnkeyed,
        objCreationDate,
        objSrcUnkeyed,
      } = bo.$attrs;
      const { id, source } = bo;
      const el = {
        id,
        objId,
        objTitle,
        objType,
        objDescription,
        objStarred: objStarred == 'true',
        objHidden: objHidden == 'true',
        objUnkeyed: objUnkeyed == 'true',
        objCreationDate,
        source: source || null,
        objSrcUnkeyed,
        objUnkeyedOriginal: objUnkeyed == 'true',
        objPositionX: element.x,
        objPositionY: element.y,
        width: element.width,
        height: element.height
      };
      const createCanvasElement = false;
      if (objectPropertiesDefined(el)) {
        if (!is(element, POSTIT_IMAGE)) {
          this.canvasShapes = this.canvasShapes.set(el.id, element);
        }
        (!entriesArray) ? this.addEntry(CANVAS_ENTRIES, el, createCanvasElement) : entriesArray.push(el);
      } else {
        const shapeEl = convertShapeToPanelElement(element);
        (DEBUG) ? console.log(shapeEl) : void(0);
        if (shapeEl) {
          if (!is(element, POSTIT_IMAGE)) {
            this.canvasShapes = this.canvasShapes.set(shapeEl ? shapeEl.id : el.id, element);
          }
          (!entriesArray) ? this.addEntry(CANVAS_ENTRIES, shapeEl, createCanvasElement) : entriesArray.push(shapeEl);
        }
      }
    }
  });
  return entriesArray ? entriesArray.reverse() : null;
};
