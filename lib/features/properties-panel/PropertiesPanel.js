import _ from 'lodash';

import {
  domify,
  queryAll,
  query,
  event as domEvent
} from 'min-dom';

import {
  isFunction,
} from 'min-dash';

import {
  List, Map
} from 'immutable';

import {
  getBusinessObject,
  is
} from 'postit-js-core/lib/util/ModelUtil.js';

import {
  KEYS_UNDO, KEYS_REDO
} from 'diagram-js/lib/features/keyboard/KeyboardBindings.js';

import {
  syncFromCanvas as _syncFromCanvas,
  syncToCanvas as _syncToCanvas,
  deleteCanvasElement as _deleteCanvasElement,
  deleteCanvasElementDirectly as _deleteCanvasElementDirectly,
  createCanvasElement as _createCanvasElement,
  findCanvasElement as _findCanvasElement,
  findListElement as _findListElement,
  importShapeToPanel as _importShapeToPanel,
} from './PropertiesPanelUtil.js';

import {
  DEBUG,
  DROPDOWN_ENABLED,
  UNKEY_ENABLED,
  HISTORY_INTERGRATES_PANEL_HISTORY,
  ADD_LIST_NAMES,
  ADD_LIST_TITLES,
  THUMBNAIL,
  CANVAS_OFFSET_X,
  HISTORY_MAX,
  ENTRY_PROTOTYPE,
  POSTIT_IMAGE,
  CANVAS_ENTRIES,
  PLATFORM_ENTRIES,
} from './Constants.js';

import './PropertiesPanel.less';

/** CONFIGURATION --> in Constants.js */

/** constants **/

export const LIST_NAMES = [
  CANVAS_ENTRIES,
  ...ADD_LIST_NAMES
];

export const LIST_TITLES = {
  [CANVAS_ENTRIES]: 'This Canvas',
  ...ADD_LIST_TITLES
};

export const MOVE = 'MOVE';
export const RESIZE = 'RESIZE';

/** constants **/
export const HIGHEST_PRIORITY = 2000;
export var text;

export const PROPERTY_BUTTON_ACTION = {
  'STAR': 0,
  'UNKEY': 1,
  'HIDE': 2,
  'CHANGE_IMAGE': 3,
  'DELETE': 4,
};
export const PROPERTY_BUTTON_ACTION_COUNT = (Object.keys(PROPERTY_BUTTON_ACTION).length-1);
export const PROPERTY_ACTION = {
  ...PROPERTY_BUTTON_ACTION,
  'POST_DELETE': 1+PROPERTY_BUTTON_ACTION_COUNT,
  'COPY_TO_LIST': 2+PROPERTY_BUTTON_ACTION_COUNT,
  'CHANGE_TITLE': 3+PROPERTY_BUTTON_ACTION_COUNT,
  'CHANGE_DESCRIPTION': 4+PROPERTY_BUTTON_ACTION_COUNT,
  'CHANGE_IMAGE_POST': 5+PROPERTY_BUTTON_ACTION_COUNT,
  'ADD': 6+PROPERTY_BUTTON_ACTION_COUNT,
  'UPDATE': 7+PROPERTY_BUTTON_ACTION_COUNT,
  'UPDATE_WITHOUT_HISTORY': 8+PROPERTY_BUTTON_ACTION_COUNT,
  'INTEGRATE': 9+PROPERTY_BUTTON_ACTION_COUNT,
};

export const RENDER = {
  'CURRENT': 0,
  'ALL': 1,
  'NONE': 2,
};

export const DOWN = 1, UP = -1;
export const UNDO = 'undo', REDO = 'redo';


export default function PropertiesPanel(canvas, eventBus, modeling, translate, imageSelection, keyboard, commandStack, elementFactory, postitRenderer, editorActions) {

  this._imageSelection = imageSelection;
  this._canvas = canvas;
  this._eventBus = eventBus;
  this._modeling = modeling;
  this._translate = translate;
  this._keyboard = keyboard;
  this._commandStack = commandStack;
  this._elementFactory = elementFactory;
  this._postitRenderer = postitRenderer;
  this._editorActions = editorActions;
  this.propertiesPanelState = false;
  this.hideDetect = []; // hack: differentiate hide vs delete
  this.dropDownListeners = [];
  this.keyFunctionListeners = [];
  this.inputChangedBySelectionFlag = [];

  this.syncToCanvas = _syncToCanvas.bind(this);
  this.syncFromCanvas = _syncFromCanvas.bind(this);
  this.deleteCanvasElement = _deleteCanvasElement.bind(this);
  this.deleteCanvasElementDirectly = _deleteCanvasElementDirectly.bind(this);
  this.createCanvasElement = _createCanvasElement.bind(this);
  this.findCanvasElement = _findCanvasElement.bind(this);
  this.findListElement = _findListElement.bind(this);
  this.importShapeToPanel = _importShapeToPanel.bind(this);

  this.getElementSource = _getElementSource.bind(this);

  this.listNames = [];
  LIST_NAMES.forEach(listName => {
    this.listNames.push(listName);
  });

  text = { 'URL': this._translate('URL'),
    'Properties Editor': this._translate('Properties Editor'),
    'Search': this._translate('Search'),
    'Search platform & canvas': this._translate('Search platform & canvas'),
    'Usage': this._translate('Usage'),
    'Name': this._translate('Name'),
  };

  PropertiesPanel.MIN_HTML = `<div id="properties-panel-min" class="pjs-ui-element">
    <div class="properties-panel-min-innerwrapper">
      <div class="properties-panel-min-text"><span class="pjs-general-icon"></span></div>
    </div>
  </div>`;

  PropertiesPanel.PANEL_HTML = `<div id="properties-panel" class="pjs-ui-element-bordered">
    <div class="properties-panel-header pjs-text">
      <div class="properties-panel-header-left">
        ${text['Properties Editor']}
      </div>
      <div class="properties-panel-header-right">
          <ul class="pjs-horizontal">
            <li><button id="js-properties-panel-undo" ><span class="pjs-general-icon"></span></button></li>
            <li><button id="js-properties-panel-redo" ><span class="pjs-general-icon"></span></button></li>
          </ul>
      </div>
      <div class="clearfix"></div>
    </div>
    <input type="text" id="js-properties-panel-search" class="properties-panel-top-input" placeholder="${text['Search platform & canvas']}" class="pjs-ui-element"></input>
  </div>`;

  const PANEL_SECTION_HTML = (listName, listTitle) => `<div class="properties-panel-section-header pjs-text">
    <span class="pjs-general-icon panel-properties-${listName}-icon"></span>${listTitle}
    </div>
    <ul class="properties-panel-list properties-panel-list-${listName} pjs-vertical">
    </ul>`;

  const PANEL_ADD_BUTTON_HTML = `
    <button id="js-add-property-panel-element-local" class="panel-property-add-button pjs-ui-element"><span class="pjs-general-icon"></span></button>`;

  /* add property-panel to DOM */
  const canvasDOM = document.getElementById('canvas');
  const containerMax = this._container = domify(PropertiesPanel.PANEL_HTML);
  canvasDOM.insertBefore(containerMax, canvas.firstChild);

  /* add panel sections to DOM */
  this.canvasShapesHistory = List();
  this.listNames.forEach((listName, listId) => {
    const panelSectionDom = domify(PANEL_SECTION_HTML(listName, LIST_TITLES[listName]));
    const propertiesPanel= query('#properties-panel');
    if (listName == CANVAS_ENTRIES) {
      panelSectionDom.insertBefore(domify(PANEL_ADD_BUTTON_HTML), panelSectionDom.lastChild);
    }
    propertiesPanel.appendChild(panelSectionDom);
  });

  const containerMin = domify(PropertiesPanel.MIN_HTML);
  canvasDOM.insertBefore(containerMin, canvas.firstChild);

  /* on board properly imported */

  this._eventBus.on('import.render.complete', function(event) {

    var self = this;

    /* fill entry lists */

    this.lists = [];
    this.canvasShapes = Map(); // shapes that are not images, useful for hiding and recreating
    this.currentScope = [];
    this.scopeVal = null;
    this.activeEntries = [];
    this.history = List();
    this.historyPointer = -1;
    this.canvasUndoRedoActionThrough = false;

    LIST_NAMES.forEach(listName => {
      this.lists[listName] = List();
      this.currentScope[listName] = null;
      this.activeEntries[listName] = List();
    });

    this.syncFromCanvas(); // ENTRIES['canvasEntries']

    this.addToHistory();

    /* build all lists */

    this.listNames.forEach(key => {
      this.updateScope(key);
      this.updateList(key);
    });

    /* canvas image handler */

    function updateCanvasElementProperties(shape, action) {
      if (shape) {
        const listName = CANVAS_ENTRIES;
        const elId = self.findListElement(listName, shape);
        if (elId !== null) {
          const el = self.lists[listName].get(elId);
          let xy = {};
          if (action == MOVE) {
            xy = {
              objPositionX: shape.x,
              objPositionY: shape.y,
            };
          }
          else if (action == RESIZE) {
            xy = {
              width: shape.width,
              height: shape.height,
            };
          }
          self.changeProperties(listName, elId, PROPERTY_ACTION['UPDATE_WITHOUT_HISTORY'], xy);
          if (!is(shape, POSTIT_IMAGE)) {
            self.canvasShapes = self.canvasShapes.set(el.id, shape);
          }
        }
      }
    }

    // assuming commandStack.shape.size.postExecute not allowed
    this._eventBus.on('commandStack.shape.resize.postExecute', HIGHEST_PRIORITY, function(event) {
      const shape = event.context.shape;
      updateCanvasElementProperties(shape, RESIZE);
    });

    this._eventBus.on('commandStack.shape.move.postExecute', HIGHEST_PRIORITY, function(event) {
      const shape = event.context.shape;
      updateCanvasElementProperties(shape, MOVE);
    });

    this._eventBus.on('commandStack.shape.create.postExecute', HIGHEST_PRIORITY, function(event) {
      const shape = event.context.shape;
      self.importShapeToPanel(shape);
    });

    this._eventBus.on('commandStack.shape.delete.postExecute', HIGHEST_PRIORITY, function(event) {
      const shape = event.context.shape;
      if (shape) {
        const listName = CANVAS_ENTRIES;
        const elId = self.findListElement(listName, shape);
        if (elId !== null && !self.hideDetect.includes(shape.id)) { // hide differs from delete
          self.changeProperties(listName, elId, PROPERTY_ACTION['POST_DELETE']);
        }
      }
    });

    this._eventBus.on('commandStack.changed', HIGHEST_PRIORITY, function(event) {
      if (self.canvasUndoRedoActionThrough) {
        self.canvasUndoRedoSync();
        self.canvasUndoRedoActionThrough = false;
      }
    });

    this.canvasUndoRedoSync = function() {
      const entriesArray = self.syncFromCanvas([]);
      this.lists[CANVAS_ENTRIES] = List(entriesArray);
      this.updateScope(CANVAS_ENTRIES);
      this.updateList(CANVAS_ENTRIES);
    };

    /* shape color and text change */
    this._eventBus.on('shape.changed', HIGHEST_PRIORITY, function(event) {
      if (!self.canvasUndoRedoActionThrough) {
        const element = event.element;
        const bo = getBusinessObject(element);
        const elId = self.findListElement(CANVAS_ENTRIES, event.element);
        if (elId !== null) {
          const el = self.lists[CANVAS_ENTRIES].get(elId);
          if (!is(element, POSTIT_IMAGE)) {
            const canvasEl = self.canvasShapes.get(el.id);
            if (bo.name && bo.name != el.objTitle) {
              self.canvasShapes = self.canvasShapes.set(el.id, element);
              self.changeProperties.bind(self, CANVAS_ENTRIES, elId, PROPERTY_ACTION['UPDATE_WITHOUT_HISTORY'], { objTitle: bo.name })();
            } else if (bo.color && bo.color != canvasEl.color) {
              self.canvasShapes = self.canvasShapes.set(el.id, element);
              self.updateList(CANVAS_ENTRIES);
            }
          }
        }
      }
    });

    this._eventBus.on('imageSelection.complete', function(event) {
      const elId = self.findListElement(CANVAS_ENTRIES, event.element);
      if (elId !== null) {
        const bo = getBusinessObject(event.element);
        const source = bo.get('source');
        if (source !== null) {
          self.changeProperties.bind(self, CANVAS_ENTRIES, elId, PROPERTY_ACTION['CHANGE_IMAGE_POST'], source)();
        }
      }
    });

    /* keyboard listeners */
    this._keyboard.addListener(HIGHEST_PRIORITY, function(context) {
      const event = context.keyEvent;
      if (self._keyboard.isCmd(event) && !self._keyboard.isShift(event) && self._keyboard.isKey(KEYS_UNDO, event)) {
        self.canvasUndoRedoActionThrough = true;
      }
      else if (self._keyboard.isCmd(event) && (self._keyboard.isKey(KEYS_REDO, event) || (self._keyboard.isKey(KEYS_UNDO, event) && self._keyboard.isShift(event)))) {
        self.canvasUndoRedoActionThrough = true;
      }
    });

  }.bind(this));

  /** add entry in canvas section */
  const propertiesPanelAddButton = query('#js-add-property-panel-element-local');
  domEvent.bind(propertiesPanelAddButton, 'click', this.addEntry.bind(this, CANVAS_ENTRIES, null, true), false);

  /** fold/unfold properties-panel */
  const propertiesPanelMinDOM = query('#properties-panel-min');
  domEvent.bind(propertiesPanelMinDOM, 'click', this.togglePropertiesPanel.bind(this), false);
  DEBUG ? this.togglePropertiesPanel.bind(this)() : void(0);

  /** entry search */
  const propertiesPanelSearch = query('#js-properties-panel-search');
  domEvent.bind(propertiesPanelSearch, 'input', this.searchEntries.bind(this, propertiesPanelSearch), false);

  /** undo/redo */
  const propertiesPanelUndo = query('#js-properties-panel-undo');
  domEvent.bind(propertiesPanelUndo, 'click', this.undoOrRedo.bind(this, true), false);
  const propertiesPanelRedo = query('#js-properties-panel-redo');
  domEvent.bind(propertiesPanelRedo, 'click', this.undoOrRedo.bind(this, false), false);

  // have to bind this outside keyboard module in order to react even in input fields
  if (this.listNames.includes(PLATFORM_ENTRIES)) {
    this.bindKeyListener('Enter', this.changePropertiesOnActiveElements.bind(this, PROPERTY_ACTION['COPY_TO_LIST']));
  }
  this.bindKeyListener('ArrowDown', this.activateElements.bind(this, (this.keyArrowFunctions.bind(this, DOWN))));
  this.bindKeyListener('ArrowUp', this.activateElements.bind(this, (this.keyArrowFunctions.bind(this, UP))));

}

const _getElementSource = function(shape) {
  const gfx = domify('<g class="djs-visual"></g>');
  if (!is(shape, POSTIT_IMAGE)) {
    return this._postitRenderer.drawShape(gfx, shape);
  }
  return null;
};

/** * UI ***/

PropertiesPanel.prototype.bindKeyListener = function(key, fn) {
  if (this.keyFunctionListeners[key])
    domEvent.unbind(document, 'keydown', this.keyFunctionListeners[key].bind(this));
  this.keyFunctionListeners[key] = (e) => {this._keyboard.isKey(key, e) ? fn() : null;};
  domEvent.bind(document, 'keydown', this.keyFunctionListeners[key].bind(this));
};

PropertiesPanel.prototype.undoOrRedo = function(undoOrRedo) {
  if (!HISTORY_INTERGRATES_PANEL_HISTORY) {
    if (undoOrRedo) {
      this._editorActions.trigger(UNDO);
      this.canvasUndoRedoSync();
    } else if (!undoOrRedo) {
      this._editorActions.trigger(REDO);
      this.canvasUndoRedoSync();
    }
  } else {
    if (this.history.size > 0) {

      // update current history state
      let listsTemp = Map();
      this.listNames.forEach(listName => listsTemp = listsTemp.set(listName, this.lists[listName]));
      this.history = this.history.set(this.historyPointer, listsTemp);
      this.canvasShapesHistory = this.canvasShapesHistory.set(this.historyPointer, this.canvasShapes);

      // get past/future history state
      this.historyPointer = undoOrRedo ? Math.max(0, this.historyPointer-1) : Math.min(this.history.size-1,this.historyPointer+1);

      let oldLists = Map();
      this.history.get(this.historyPointer).forEach((val, listName) => {
        const oldListTemp = this.lists[listName];
        oldLists = oldLists.set(listName, oldListTemp);
        this.lists[listName] = val;
      });

      this.canvasShapes = this.canvasShapesHistory.get(this.historyPointer);

      /* update panel */
      this.listNames.forEach((key, i) => {
        this.updateScope(key);
        this.updateList(key);
      });

      /* update canvas */
      const createMissing = true;
      const deleteableElements = oldLists.get(CANVAS_ENTRIES).filter(el => !this.lists[CANVAS_ENTRIES].find(el2 => el.id == el2.id));
      const newIdPairs = this.syncToCanvas(CANVAS_ENTRIES, null, createMissing, deleteableElements);

      // update ids from newly create elements (safer to let canvas handle ids)
      for (const id of Object.keys(newIdPairs)) {
        const oldElement = { id: id };
        const newElement = { id: newIdPairs[id] };
        const elId = this.findListElement(CANVAS_ENTRIES, oldElement);
        this.changeProperties(CANVAS_ENTRIES, elId, PROPERTY_ACTION['UPDATE_WITHOUT_HISTORY'], newElement);
      }
    }
  }
};

PropertiesPanel.prototype.togglePropertiesPanel = function() {
  const propertiesPanelDOM = query('#properties-panel');
  const propertiesPanelMinDOM = query('#properties-panel-min');
  if (DEBUG || !this.propertiesPanelState) {
    propertiesPanelDOM.style.display = 'block';
    propertiesPanelMinDOM.classList.add('properties-panel-min-maxed');
  } else {
    propertiesPanelDOM.style.display = 'none';
    propertiesPanelMinDOM.classList.remove('properties-panel-min-maxed');
  }
  this.propertiesPanelState = !this.propertiesPanelState;
};

PropertiesPanel.prototype.updateScope = function(listName) {
  const scopeVal = this.scopeVal;
  if (scopeVal) {
    this.currentScope[listName] = this.lists[listName].map((map, i) => (
      map.objTitle.toLowerCase().includes(scopeVal) || map.objTitle == '' ? i : null
    )).filter(map => map !== null);
  } else {
    this.currentScope[listName] = null;

    /* dont show platformEntries by default */
    this.currentScope[PLATFORM_ENTRIES] = [];
  }
};

PropertiesPanel.prototype.updateList = function(listName) {
  const propertiesPanelListDOM = query('#properties-panel .properties-panel-list-'+listName);

  const listEntries = (this.currentScope[listName])
    ? this.lists[listName].filter((map, i) => this.currentScope[listName].includes(i))
    : this.lists[listName];

  /* delete previous entry list */

  while (propertiesPanelListDOM.firstChild) {
    propertiesPanelListDOM.removeChild(propertiesPanelListDOM.firstChild);
  }

  /* build new entry list */

  var i = 0;
  const listEntriesSize = listEntries.size;
  listEntries.forEach((element, elId) => {
    const el = element;
    const shapeIsNotImage = (el.objType !== POSTIT_IMAGE);
    const imgSource = (el.objUnkeyedOriginal ? el.objSrcUnkeyed : el.source) || ' ';

    const propClassStarred = (el.objStarred) ? 'properties-panel-prop-active' : '';
    const propClassUnkeyed = (el.objUnkeyed) ? 'properties-panel-prop-active' : '';
    const propClassHidden = (el.objHidden) ? 'properties-panel-prop-active' : '';
    const propClassStarredDisabled = (shapeIsNotImage) ? 'disabled' : '';
    const propClassUnkeyedDisabled = (shapeIsNotImage || !UNKEY_ENABLED) ? 'disabled' : '';
    const propClassChangeImageDisabled = (shapeIsNotImage) ? 'property-panel-img-change-disabled' : '';
    const propClassHiddenDisabled = (listName == PLATFORM_ENTRIES) ? 'disabled' : '';
    const propClassTitleReadonly = (shapeIsNotImage) ? 'disabled' : '';

    const activeClass = this.activeEntries[listName].has(elId) ? 'active' : '';
    const description = el.objDescription ? el.objDescription : '';

    let entryDOM = `<li class="properties-panel-list-li" data-id="${listName}_${el.objId}_${elId}" class="${activeClass}">
         <div class="properties-panel-list-el">
          <div class="properties-panel-list-el-far-left">
            <ul class="pjs-vertical">
              <li><button ${propClassStarredDisabled} class="properties-panel-property-button pjs-ui-element-bordered"><span class="pjs-general-icon ${propClassStarred} "></span></button></li>
              <li><button ${propClassUnkeyedDisabled} class="properties-panel-property-button pjs-ui-element-bordered"><span class="pjs-general-icon ${propClassUnkeyed} "></span></button></li>
              <li><button ${propClassHiddenDisabled} class="properties-panel-property-button pjs-ui-element-bordered"><span class="pjs-general-icon ${propClassHidden} "></span></button></li>
            </ul>
          </div>
          <div class="properties-panel-list-el-left">
            <button class="properties-panel-list-el-visual ${propClassChangeImageDisabled}
            pjs-general-icon 
            ${(el.objHidden) ? 'properties-panel-list-el-hidden' : 'properties-panel-list-el-change-image'}
             ">
            </button>
            <span class="pjs-general-icon ${(el.objStarred) ? ' properties-panel-list-el-star' : ''}"></span>
          </div>
          <div class="properties-panel-list-el-right">
            <input type="text" tabindex=${2+(elId*2)} placeholder="${text['Name']}" class="pjs-ui-element" ${propClassTitleReadonly} />
              <!--dropdown-->
              <div class="properties-panel-list-el-title-dropdown pjs-ui-element-bordered">
                <ul class="pjs-horizontal">
                </ul>
            </div>
            <textarea type="text" tabindex=${2+(elId*2)+1} placeholder="${text['Usage']}" class="pjs-ui-element">${description}</textarea>
          </div>
          <div class="properties-panel-list-el-far-right">
            <button class="properties-panel-property-button pjs-ui-element"><span class="pjs-general-icon"></span></button>
          </div>
          <div class="clearfix"></div>
        </div>
      </li>`;
    entryDOM = domify(entryDOM);

    /* add element thumbnail */
    const sourceDOM = shapeIsNotImage ? this.getElementSource(this.canvasShapes.get(el.id)) : domify(`<img src="${imgSource}" width="60" height="60" />`);
    const visualDOM = query('.properties-panel-list-el-visual', entryDOM);
    if (shapeIsNotImage) {
      const shapeScaleY = THUMBNAIL.WIDTH / el.width;
      const shapeScaleX = THUMBNAIL.HEIGHT / el.height;
      visualDOM.appendChild(domify(`<svg id="properties-panel-thumbnail-${el.id}" width="${THUMBNAIL.WIDTH}" height="${THUMBNAIL.HEIGHT}"><g class="djs-visual" style="transform: scale(${shapeScaleX} , ${shapeScaleY})"></g></svg>`));
      const visualDOMInner = query('.djs-visual', visualDOM);
      visualDOMInner.appendChild(sourceDOM);
    } else {
      visualDOM.appendChild(sourceDOM);
    }

    propertiesPanelListDOM.appendChild(entryDOM, propertiesPanelListDOM.firstChild);

    /* add action button listeners */
    const propertiesPanelActionButtons = propertiesPanelListDOM.getElementsByTagName('button');
    if (propertiesPanelActionButtons) {
      for (const action in PROPERTY_BUTTON_ACTION) {
        const actionIdLocal = PROPERTY_BUTTON_ACTION[action],
              actionCount = _.keys(PROPERTY_BUTTON_ACTION).length;
        const actionIdGlobal = (i*actionCount)+actionIdLocal;

        if (actionIdLocal == PROPERTY_ACTION['CHANGE_IMAGE']) {
          propertiesPanelActionButtons[actionIdGlobal].addEventListener('click', this.zoomToElement.bind(this, listName, el), false);
          if (!shapeIsNotImage)
            propertiesPanelActionButtons[actionIdGlobal].addEventListener('click', this.changeProperties.bind(this, listName, elId, actionIdLocal), false);
        } else {
          propertiesPanelActionButtons[actionIdGlobal].addEventListener('click', this.changeProperties.bind(this, listName, elId, actionIdLocal), false);
        }

      }
    }

    i++;
  });

  /* add focus input, textarea listeners; bind value to input */

  let propertiesPanelListInputs = queryAll('#properties-panel .properties-panel-list-'+listName + ' input', propertiesPanelListDOM);
  let propertiesPanelListTextarea = queryAll('#properties-panel .properties-panel-list-'+listName + ' textarea', propertiesPanelListDOM);
  propertiesPanelListInputs.forEach((el, elIdPre) => {
    const elId = listEntriesSize - 1 - elIdPre;

    // setting title value here
    propertiesPanelListInputs[elId].value = listEntries.get(elId).objTitle;

    if (DROPDOWN_ENABLED) {
      propertiesPanelListInputs[elId].addEventListener('input', this.changeElementInputFromSelection.bind(this, el, elId, listName), false);
    }
    propertiesPanelListInputs[elId].addEventListener('change', this.changeElementInputFromText.bind(this, el, elId, listName), false);

    propertiesPanelListInputs[elId].addEventListener('keyup', (event) => {event.code === 'Enter' ? propertiesPanelListInputs[elId].blur() : null;});

    propertiesPanelListTextarea[elId].addEventListener('blur', this.changeElementTextarea.bind(this, el, elId, listName), false);
  });

  /* add activate listElement listeners */

  const propertiesPanelListEntries = queryAll('#properties-panel .properties-panel-list-'+listName + ' > li', propertiesPanelListDOM);
  propertiesPanelListEntries.forEach((el, elId) => {
    propertiesPanelListEntries[elId].addEventListener('click', this.focusElement.bind(this, el, elId, listName), false);
  });
};

PropertiesPanel.prototype.searchEntries = function(el, e) {
  this.deactivateElements();
  this.scopeVal = el.value.toLowerCase();
  let firstResultId = [],
      listNameHasResults = [];

  /* update scopes and lists */

  for (const listName of this.listNames) {
    this.updateScope(listName);

    /* element to activate */
    if (this.currentScope[listName] && this.currentScope[listName].size > 0) {
      firstResultId[listName] = this.currentScope[listName].first();
      listNameHasResults.push(listName);
    }

    this.updateList(listName);
  }

  /* highlight very first item */

  if (this.scopeVal && listNameHasResults.length > 0) {

    // highlight platform item first
    let listToHighlightFrom = null;
    if (listNameHasResults.indexOf(PLATFORM_ENTRIES) > -1) {
      listToHighlightFrom = PLATFORM_ENTRIES;
    } else {
      listToHighlightFrom = CANVAS_ENTRIES;
    }
    const firstEntry = query('#properties-panel .properties-panel-list-'+listToHighlightFrom);
  
    //because of .focus(), dont activate CANVAS_ENTREIS during search
    if(listToHighlightFrom == PLATFORM_ENTRIES){
      this.activateElements([{ el: firstEntry.firstChild, elId: firstResultId[listToHighlightFrom], listName: listToHighlightFrom }]);
    }
  }
};

PropertiesPanel.prototype.changeElementInputFromText = function(el, elId, listName, ev) {
  if (!this.inputChangedBySelectionFlag[elId]) {
    this.changeProperties(listName, elId, PROPERTY_ACTION['CHANGE_TITLE'], ev);
  }
  this.inputChangedBySelectionFlag[elId] = false;
};

PropertiesPanel.prototype.changeElementInputFromSelection = function(el, elId, listName, ev) {

  // canvasEntries only for dropdown
  if (listName == CANVAS_ENTRIES) {
    const { propertiesPanelListInputs, dropdownDOM } = getDropdownDOM(elId, listName);
    dropdownDOM.style.display = 'block';

    const dropdownContent = List([]);// ENTRIES[PLATFORM_ENTRIES]
    const dropdownDomUl = query(' ul ', dropdownDOM);

    dropdownContent.forEach((dropdownEl, dropdownElId) => {
      let dropdownLiDom = `<li data-key="dp_${listName}_${dropdownEl.objId}_${dropdownElId}">
                  <div class="properties-panel-dropdown-el">
                    <img width="20" height="20" src=${dropdownEl.source} />
                    <span>${dropdownEl.objTitle}</span>
                  </div>
              </li>`;
      dropdownLiDom = domify(dropdownLiDom);
      dropdownDomUl.appendChild(dropdownLiDom, dropdownDomUl.nextSibling);
      domEvent.bind(dropdownLiDom, 'mousedown', (event) => {
        this.inputChangedBySelectionFlag[elId] = true;
        const excludeProperties = ['id', 'objDescription'];
        this.updateEntry(dropdownEl, elId, listName, excludeProperties);
        event.preventDefault();
      });
    });

    /* manual handling of dropdown blur */
    if (dropdownContent.size > 0) {
      if (!this.dropDownListeners[elId]) {
        this.dropDownListeners[elId] = this.closeElementInputSelection.bind(this, el, elId, listName);
        propertiesPanelListInputs[elId].addEventListener('blur', this.dropDownListeners[elId], false);
      }
    }
  }
};

PropertiesPanel.prototype.closeElementInputSelection = function(el, elId, listName) {
  const { propertiesPanelListInputs, dropdownDOM } = getDropdownDOM(elId, listName);
  dropdownDOM.style.display = 'none';
  if (this.dropDownListeners[elId]) {
    propertiesPanelListInputs[elId].removeEventListener('blur', this.dropDownListeners[elId], false);
    this.dropDownListeners[elId] = null;
  }
};

PropertiesPanel.prototype.changeElementTextarea = function(el, elId, listName, ev) {
  this.changeProperties(listName, elId, PROPERTY_ACTION['CHANGE_DESCRIPTION'], ev);
};

PropertiesPanel.prototype.focusElement = function(el, elId, listName) {
  this.deactivateElements();
  this.activateElements([{ el, elId, listName }]);
};

PropertiesPanel.prototype.activateElements = function(elements) {
  let elementsToActivate = null;
  elementsToActivate = isFunction(elements) ? elements() : elements;

  elementsToActivate.forEach((element, i) => {
    const { el, elId, listName } = element;

    if (i === 0) {
      const propertiesPanelListInputs = queryAll('#properties-panel .properties-panel-list-'+listName + ' input');
      if(!propertiesPanelListInputs[elId].disabled && listName !== PLATFORM_ENTRIES){
        propertiesPanelListInputs[elId].focus();
      }
    }

    el.classList.add('active');
    this.activeEntries[listName] = this.activeEntries[listName].push(elId);
  });
};

PropertiesPanel.prototype.deactivateElements = function(elements) {
  if (!elements) {
    const listEntries = queryAll('#properties-panel .properties-panel-list .properties-panel-list-li');
    const propertiesPanelListInputs = queryAll('#properties-panel .properties-panel-list li' + ' input');
    Array.from(listEntries).forEach((el, i) => {
      propertiesPanelListInputs[i].blur();
      el.classList.remove('active');
    });
    this.listNames.forEach(listName => this.activeEntries[listName] = List());
  } else {
    elements.forEach(element => {
      const { el, elId, listName } = element;
      el.classList.remove('active');
      this.activeEntries[listName].delete(elId);
    });
  }
};

PropertiesPanel.prototype.zoomToElement = function(listName, el) {
  if (listName == CANVAS_ENTRIES && el && el.objPositionX && el.objPositionY) {
    this._canvas.zoom('fit-viewport', { x: el.objPositionX - CANVAS_OFFSET_X, y: el.objPositionY });
  }
};

PropertiesPanel.prototype.keyArrowFunctions = function(direction) {

  let listEntries = [];
  this.listNames.forEach(listName => {
    listEntries[listName] = (this.currentScope[listName])
      ? this.lists[listName].filter((map, i) => this.currentScope[listName].includes(i))
      : this.lists[listName];
  });

  /* find next element in list */

  const currentActiveEntries = this.listNames.reduce((sum, listName) => sum + this.activeEntries[listName].size, 0);

  if (currentActiveEntries <= 1) {
    let elementsToHighlight = null, el = null, nextElementId = null;
    elementsToHighlight = this.listNames.map((listName, listId) => {
      nextElementId = (currentActiveEntries > 0) ? (this.activeEntries[listName].get(0) + direction) : 0;
      const downPossible = (direction == DOWN) && listEntries[listName].size > nextElementId;
      const upPossible = (direction == UP) && nextElementId > -1;
      if (downPossible || upPossible) {
        el = queryAll('#properties-panel .properties-panel-list-'+listName + ' > li')[nextElementId];
        elementsToHighlight = { el, elId: nextElementId, listName };
        return elementsToHighlight;
      }
      return null;
    }).find(val => val !== null);
    elementsToHighlight = elementsToHighlight ? [elementsToHighlight] : [];

    /* find next element in other list (switch lists) */

    if (elementsToHighlight.length == 0) {

      elementsToHighlight = this.listNames.map((listName, listId) => {
        let altListName, nextElementId;
        let altListNameDown = (listId < this.listNames.length - 1) ? this.listNames[listId + 1] : null;
        let altListNameUp = (listId > 0) ? this.listNames[listId - 1] : null;
        if (direction == DOWN && altListNameDown !== null && listEntries[altListNameDown].size > 0) {
          nextElementId = 0;
          altListName = altListNameDown;
        } else if (direction == UP && altListNameUp !== null && listEntries[altListNameUp].size > 0) {
          nextElementId = listEntries[altListNameUp].size - 1;
          altListName = altListNameUp;
        }
        if (altListName) {
          el = queryAll('#properties-panel .properties-panel-list-'+altListName + ' > li')[nextElementId];
          elementsToHighlight = { el, elId: nextElementId, listName: altListName };
          return elementsToHighlight;
        }
        return null;
      }).find(val => val !== null);
      elementsToHighlight = elementsToHighlight ? [elementsToHighlight] : [];

    }

    if (elementsToHighlight.length > 0) {
      this.deactivateElements();
      return elementsToHighlight;
    }
  }
  return [];
};

/** * Panel Entries/Property Functions ***/

PropertiesPanel.prototype.addEntry = function(listName, el = null, createCanvasElement = true) {
  if (el == null) {
    el = ENTRY_PROTOTYPE();
  } else {
    el = { ...ENTRY_PROTOTYPE(), ...el };
  }

  if (createCanvasElement) {
    this.changeProperties(listName, 0, PROPERTY_ACTION['ADD'], el);
  } else {
    this.changeProperties(listName, 0, PROPERTY_ACTION['INTEGRATE'], el);
  }

  // empty element will be added to scope
  this.updateScope(listName);
  this.updateList(listName);
};

PropertiesPanel.prototype.updateEntry = function(updatedEl, elId, listName, excludeProperties) {
  this.changeProperties(listName, elId, PROPERTY_ACTION['UPDATE'], { updatedEl, excludeProperties });
  this.updateList(listName);
};

PropertiesPanel.prototype.changePropertiesOnActiveElements = function(actionId) {
  this.listNames.forEach(listName => {
    this.activeEntries[listName].forEach(elId => {
      this.changeProperties(listName, elId, actionId);
    });
  });
};

PropertiesPanel.prototype.changeProperties = function(listName, elId, actionId, ev = null) {
  let panelRender = RENDER['CURRENT'];

  /* modify action based on list (if multiple lists and therefore sections exist) */

  if (listName == PLATFORM_ENTRIES) {
    if (actionId == PROPERTY_ACTION['DELETE']) {
      actionId = PROPERTY_ACTION['COPY_TO_LIST'];
    }
  } else if (listName == CANVAS_ENTRIES) {
    if (actionId == PROPERTY_ACTION['COPY_TO_LIST']) {
      actionId = -1;
    }
  }

  /* action */

  if (actionId == PROPERTY_ACTION['DELETE']) {
    if (this.findCanvasElement(this.lists[listName].get(elId)) !== null) {
      this.deleteCanvasElement(listName, elId);
    } else {
      this.changeProperties(listName, elId, PROPERTY_ACTION['POST_DELETE']);
    }
  } else if (actionId == PROPERTY_ACTION['POST_DELETE']) {
    this.lists[listName] = this.lists[listName].delete(elId);
    this.addToHistory();
  }
  else if (actionId == PROPERTY_ACTION['COPY_TO_LIST']) {
    const nextListId = (this.listNames.findIndex(val => val == listName) + 1) % (this.listNames.length);
    const el = this.lists[listName].get(elId);
    this.changeProperties(this.listNames[nextListId], elId, PROPERTY_ACTION['ADD'], el);
    panelRender = RENDER['ALL'];
  }
  else if (actionId == PROPERTY_ACTION['STAR']) {
    this.lists[listName] = this.lists[listName].update(elId, val => ({ ...val, 'objStarred': !val.objStarred }));
  }
  else if (actionId == PROPERTY_ACTION['UNKEY']) {
    const el = this.lists[listName].get(elId);
    let source0 = '', source1 = '';
    if (el) {
      source0 = el.objSrcUnkeyed;
      source1 = el.source;
    }
    this.lists[listName] = this.lists[listName].update(elId, val => ({ ...val, 'source': source0, 'objSrcUnkeyed': source1, 'objUnkeyed': !val.objUnkeyed }));
  }
  else if (actionId == PROPERTY_ACTION['HIDE']) {
    const el = this.lists[listName].get(elId);
    let oldId = el.id;
    let id = oldId;

    // display x,y fix
    let x = Math.round(el.objPositionX+(el.width/2));
    let y = Math.round(el.objPositionY+(el.height/2));

    // element had been drawn to canvas
    if (x !== undefined && y !== undefined) {
      this.hideDetect.pushIfNotExists(id);
      if (!el.objHidden) {
        this.deleteCanvasElement(listName, elId);
      } else {
        let newElement, options;
        if (el.objType !== POSTIT_IMAGE) {
          options = { panelCreated: true };
          const shape = this.canvasShapes.get(el.id);
          newElement = this.createCanvasElement(el.objType, options, { x, y }, shape); // TODO theoretically duplicates with existing elements are possible
          id = newElement.id;
          this.canvasShapes = this.canvasShapes.set(id, shape); // because id stays the same no deletion from canvasShape necessary
        } else {
          options = { source: el.source, panelCreated: true };
          newElement = this.createCanvasElement(POSTIT_IMAGE, options, { x, y });
          id = newElement.id;
        }
      }
      this.lists[listName] = this.lists[listName].update(elId, val => ({ ...val, 'objHidden': !val.objHidden, id: id }));
      this.hideDetect.remove(oldId);
      this.hideDetect.remove(id);
    }
  }
  else if (actionId == PROPERTY_ACTION['CHANGE_IMAGE']) {
    this._imageSelection.select(null, this.changeImage.bind(this, listName, elId));
    document.getElementById('pjs-image-selection-modal').style.position = 'fixed';
  }
  else if (actionId == PROPERTY_ACTION['CHANGE_IMAGE_POST']) {
    this.lists[listName] = this.lists[listName].update(elId, val => ({ ...val, 'source': ev, 'objSrcUnkeyed': ev }));
    this.addToHistory();
  }
  else if (actionId == PROPERTY_ACTION['CHANGE_TITLE']) {
    this.lists[listName] = this.lists[listName].update(elId, val => ({ ...val, 'objTitle': ev.target.value }));
    panelRender = RENDER['NONE'];
    this.addToHistory();
  }
  else if (actionId == PROPERTY_ACTION['CHANGE_DESCRIPTION']) {
    this.lists[listName] = this.lists[listName].update(elId, val => ({ ...val, 'objDescription': ev.target.value }));
    panelRender = RENDER['NONE'];
    this.addToHistory();
  }
  else if (actionId == PROPERTY_ACTION['ADD']) {
    delete ev.id;
    const options = { source: null, panelCreated: true, ...ev };
    const { id, x, y, width, height } = this.createCanvasElement(POSTIT_IMAGE, options, { x: ev.objPositionX, y: ev.objPositionY });

    // display reverse x,y fix
    const newX = Math.round(x-(width/2));
    const newY = Math.round(y-(height/2));
    this.lists[listName] = this.lists[listName].insert(0, { ...ev, objPositionX: newX, objPositionY: newY, width: width, height: height, id: id });
    this.addToHistory();
  }
  else if (actionId == PROPERTY_ACTION['INTEGRATE']) {
    this.lists[listName] = this.lists[listName].insert(0, ev);
    this.addToHistory();
  }
  else if (actionId == PROPERTY_ACTION['UPDATE']) {
    if (ev.excludeProperties) {
      ev.excludeProperties.forEach(property => delete ev.updatedEl[property]);
    }
    if (ev.updatedEl) {
      ev = ev.updatedEl;
    }
    this.lists[listName] = this.lists[listName].update(elId, val => ({ ...val, ...ev }));
    this.addToHistory();
  }
  else if (actionId == PROPERTY_ACTION['UPDATE_WITHOUT_HISTORY']) {
    this.lists[listName] = this.lists[listName].update(elId, val => ({ ...val, ...ev }));
  }

  /* sync with canvas attrs */

  this.syncToCanvas(CANVAS_ENTRIES);

  /* update ui */

  if (panelRender == RENDER['ALL']) {
    this.listNames.forEach((key, i) => {
      this.updateScope(key);
      this.updateList(key);
    });
  } else if (panelRender == RENDER['CURRENT']) {
    this.updateScope(listName);
    this.updateList(listName);
  }
};

/** * Further functions ***/

PropertiesPanel.prototype.addToHistory = function() {

  if (this.history.size > HISTORY_MAX) {
    this.history = this.history.slice(0, this.history.size);
  }
  let listsTemp = Map();
  this.listNames.forEach(listName => listsTemp = listsTemp.set(listName, this.lists[listName]));
  this.history = this.history.insert(this.historyPointer+1, listsTemp);
  this.canvasShapesHistory = this.canvasShapesHistory.insert(this.historyPointer+1, this.canvasShapes);
  this.historyPointer = this.historyPointer + 1;
};

PropertiesPanel.prototype.changeImage = function(_listName, _elId, source) {

  // (2) if source from multi file upload
  if (source && source instanceof Array) {

    // only use first image in case of multi upload.
    source = source[0];
  }
  this.changeProperties(_listName, _elId, PROPERTY_ACTION['CHANGE_IMAGE_POST'], source);
  this.updateList(_listName);
};

/** * Helper functions ***/

function getDropdownDOM(elId, listName) {
  const propertiesPanelListDOM = query('#properties-panel .properties-panel-list-'+listName);
  const propertiesPanelListInputs = queryAll(' input', propertiesPanelListDOM);
  const propertiesPanelListDropDowns = queryAll(' .properties-panel-list-el-title-dropdown', propertiesPanelListDOM);
  const dropdownDOM = propertiesPanelListDropDowns[elId];
  return { propertiesPanelListInputs, dropdownDOM };
}


PropertiesPanel.prototype.$inject = [
  'canvas',
  'eventBus',
  'modelng',
  'translate',
  'imageSelection',
  'keyboard',
  'commandStack',
  'elementFactory',
  'postitRenderer',
];
