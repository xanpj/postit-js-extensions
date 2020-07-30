import {
  is
} from 'postit-js-core/lib/util/ModelUtil.js';

import {
  CANVAS_ENTRIES,
} from './Configuration.js';

import {
  POSTIT_IMAGE,
  POSTIT_TYPES,
  elementToEntry,
  convertToDefinedEntry,
  fusionEntry
} from 'postit-js-extensions/lib/features/entry-factory/EntryFactory.js';

import _ from 'lodash';

export const deleteCanvasElementFromEntry = function(listId, elId) {

  const entry = this.entries[listId].get(elId);
  const element = this.findCanvasElement(entry);

  if (element) {
    this.deleteCanvasElement(element);
  }

};

export const deleteCanvasElement = function(_modeling, element) {
  if (element && element.element)
    _modeling.removeElements([ element.element ]);
};

export const findEntryFromCanvasElement = function(listId, element) {
  if (element.id !== undefined) {
    const elId = this.entries[listId].findIndex(el => el.id == element.id);
    return elId > -1 ? elId : null;
  } else {
    return null;
  }
};

const getAllCanvasElements = function(canvas) {
  return canvas._elementRegistry._elements;
};

export const findCanvasElement = function(entry, canvasElements = null) {
  if (!canvasElements) {
    canvasElements = getAllCanvasElements(this._canvas);
  }

  if (entry.id !== undefined) {
    const element = Object.keys(canvasElements).find(elementId => entry.id == elementId);
    return element ? canvasElements[element] : null;
  } else {
    return null;
  }
};


/**
 * syncing entries to canvas elements without history change or reaction on canvas events.
 *
 * @param      {Array}  listId          panel list id
 * @param      {Array}  elements        target elements to sync to | null for canvasElements
 * @param      {Array}  createMissing   draw missing elements from this.entries to canvas
 * @param      {Array}  deleteableElements delete canvas elements in deleteableElements (elements that are not present in the current state of this.entries)
 */
export const syncToCanvas = function(listId, elements = null, createMissing = false, deleteableElements = []) {
  const canvasEntriesId = this.listNames.indexOf(CANVAS_ENTRIES);

  if (!elements) {
    elements = getAllCanvasElements(this._canvas);
  }

  /* delete historic elements */
  deleteableElements.forEach(entry => {
    const element = this.findCanvasElement(entry, elements);
    this.deleteCanvasElement(element);
  });

  /* modify or create elements from entries */

  const newShapes = {};

  this.entries[listId].forEach((entry, elId) => {
    const element = this.findCanvasElement(entry, elements);

    // resyncing native diagram.js attributes i.e. name
    entry = applyNativeAttributeChanges(entry);

    if (!entry.objHidden && createMissing && !element) {

      let position = entry.x ? shapePositionFix({
        x: Math.round(entry.x),
        y: Math.round(entry.y)
      }, entry) : null;
      let size = { width: entry.width, height: entry.height };

      const oldId = entry.id;

      const tmpEntry = entry;

      // let diagram.js handle id management
      delete tmpEntry.id;

      // will use the diagram.js default width and height when creating the image
      if (tmpEntry.width == null || tmpEntry.height == null) {
        delete tmpEntry.width;
        delete tmpEntry.height;
      }

      if (entry.type == POSTIT_IMAGE) {

        newShapes[elId] = this.createImageElement({ ...tmpEntry }, 0, 0, position);

        newShapes[elId] = shapePositionFixReverse(newShapes[elId], size);

        // fixing the position xy bug
        const firstEverRenderDetect = position == null;
        position = { x: newShapes[elId].x, y: newShapes[elId].y };
        if (firstEverRenderDetect) {
          size = { width: newShapes[elId].shape.width, height: newShapes[elId].shape.height };
          position = shapePositionFixReverse(position, size);
        }

        newShapes[elId] = { ...newShapes[elId], ...position };
      } else {
        const shape = this.shapeRegistry.get(oldId);

        newShapes[elId] = this.createCanvasElement(entry.type, { ...tmpEntry }, 0, 0, position, shape);

        newShapes[elId] = shapePositionFixReverse(newShapes[elId], size);
      }

    } else {
      if (element) {
        const shape = element.element;

        let oldElement = elementToEntry(shape);

        let updatedEntry = fusionEntry(entry, oldElement);
        updatedEntry = applyNativeAttributeChanges(updatedEntry, entry);

        /* for comparability */
        if (updatedEntry.name) {
          oldElement.name = updatedEntry.name;
        }

        // changing only affected entries
        if (!_.isEqual(updatedEntry, oldElement)) {
          updatedEntry = shapePositionFix(updatedEntry);

          this._modeling.updateProperties(element.element, {
            ...updatedEntry
          });

        }

      } else {
        entry = deleteNativeAttributeChanges(entry);

        this.addEntry(canvasEntriesId, entry);
      }
    }

  });
  return newShapes;
};


// offsetting position to bypass diagram.js bug when dealing with shape xy
// bug: xy used in shape creation and shape updating are based on different origins.
export const shapePositionFix = function(entry, size = null) {
  entry.x += (entry.width) ? (entry.width/2) : size.width;
  entry.y += (entry.height) ? (entry.height/2) : size.height;
  entry.x = Math.round(entry.x);
  entry.y = Math.round(entry.y);
  return entry;
};

export const shapePositionFixReverse = function(entry, size = null) {
  entry.x -= (entry.width) ? (entry.width/2) : size.width;
  entry.y -= (entry.height) ? (entry.height/2) : size.height;
  entry.x = Math.round(entry.x);
  entry.y = Math.round(entry.y);
  return entry;
};

export const updateShapeRegistry = function(element, shape, entry) {
  this.shapeRegistry = this.shapeRegistry.set(entry.id, shape);
};


// postit-js attribute 'name' in non-image types is used to fill objTitle in the
// panel's 'entry data structure'
const applyNativeAttributeChanges = function(entry, fromEntry = null) {
  if (entry.type !== POSTIT_IMAGE) {
    if (Object.prototype.hasOwnProperty.call(entry, 'name') && entry.name !== '') {
      entry.objTitle = entry.name;
    } else if (fromEntry) {
      entry.name = fromEntry.objTitle;
    }
  }
  return entry;
};

const deleteNativeAttributeChanges = function(entry) {
  if (entry.type !== POSTIT_IMAGE) {
    if (Object.prototype.hasOwnProperty.call(entry, 'name')) {
      delete entry.name;
    }
  }
  return entry;
};


/**
 * sync canvas element properties to panel entries
 *
 * @param      {Array}  elements to sync from | null for canvasElements
 */
export const updateFromCanvas = function(elements = null) {


  const canvasEntriesId = this.listNames.indexOf(CANVAS_ENTRIES);

  if (!elements) {
    elements = getAllCanvasElements(this._canvas);
  }

  const elementKeys = Object.keys(elements);

  /* delete left over entries (for keeping up with undo/redo) */

  const registeredEntries = [];

  elementKeys.forEach(i => {
    const element = elements[i];
    const shape = element.element;

    if (POSTIT_TYPES.includes(shape.type)) {

      let elId = this.entries[canvasEntriesId].findIndex(entry => entry.id === shape.id);

      registeredEntries.push(elId);

    }
  });

  this.entries[canvasEntriesId] = this.entries[canvasEntriesId].filter((entry, elId) => entry.objHidden || registeredEntries.indexOf(elId) > -1);


  /* sync canvas elements to entries */

  elementKeys.forEach(i => {
    const element = elements[i];
    const shape = element.element;

    if (POSTIT_TYPES.includes(shape.type)) {

      let elId = this.entries[canvasEntriesId].findIndex(entry => entry.id === shape.id);
      let entry = (elId > -1) ? this.entries[canvasEntriesId].get(elId) : null;

      if (entry) {
        let updatedEntry = convertToDefinedEntry(elementToEntry(shape));

        // delete updatedEntry.objId; // objId is irrelevant in the panel in this version
        // delete entry.objId;

        updatedEntry = shapePositionFixReverse(updatedEntry);

        if (!is(shape, POSTIT_IMAGE)) {
          this.updateShapeRegistry(element, shape, updatedEntry);
        }

        // changing only affected entries
        if (!_.isEqual(updatedEntry, entry)) {
          this.updateEntry(canvasEntriesId, elId, updatedEntry);
        }

      } else {



        entry = convertToDefinedEntry(elementToEntry(shape));

        entry = shapePositionFixReverse(entry);

        if (!is(shape, POSTIT_IMAGE)) {
          this.updateShapeRegistry(element, shape, entry);
        }
        this.addEntry(canvasEntriesId, entry);

      }
    }

  });


};
