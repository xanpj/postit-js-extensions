import {
  domify,
  queryAll,
  query,
  event as domEvent
} from 'min-dom';

import {
  isFunction,
  isArray
} from 'min-dash';

import {
  List, Map
} from 'immutable';

import {
  KEYS_UNDO, KEYS_REDO
} from 'diagram-js/lib/features/keyboard/KeyboardBindings.js';

import {
  updateFromCanvas as _updateFromCanvas,
  syncToCanvas as _syncToCanvas,
  findCanvasElement as _findCanvasElement,
  findListElement as _findListElement,
  importShapeToPanel as _importShapeToPanel,
  deleteCanvasElementFromEntry as _deleteCanvasElementFromEntry,
  deleteCanvasElement as _deleteCanvasElement,
  updateShapeRegistry as _updateShapeRegistry,
  shapePositionFixReverse,
} from './PropertiesPanelUtil.js';

import {
  DEBUG,
  DROPDOWN_ENABLED,
  UNKEY_ENABLED,
  ADD_LIST_NAMES,
  ADD_LIST_TITLES,
  THUMBNAIL,
  CANVAS_OFFSET_X,
  CANVAS_ENTRIES,
  PLATFORM_ENTRIES,
  HISTORY_ENABLED,
} from './Configuration.js';

import {
  ENTRIES,
  IMAGE_ENTRY_PROTOTYPE,
  POSTIT_IMAGE,
  createCanvasElement as _createCanvasElement,
  createImageElement as _createImageElement,
  convertToDefinedEntry,
} from 'postit-js-extensions/lib/features/entry-factory/EntryFactory.js';

import './PropertiesPanel.less';

/** CONFIGURATION --> in Configuration.js */

/** constants **/

export const LIST_NAMES = [
  ...ADD_LIST_NAMES,
  CANVAS_ENTRIES
];

const CANVAS_ENTRIES_ID = LIST_NAMES.indexOf(CANVAS_ENTRIES);
const PLATFORM_ENTRIES_ID = LIST_NAMES.indexOf(PLATFORM_ENTRIES);

export const LIST_TITLES = {
  ...ADD_LIST_TITLES,
  [CANVAS_ENTRIES]: 'This Canvas',
};

export const MOVE = 'MOVE';
export const RESIZE = 'RESIZE';

/** constants **/
export const HIGHEST_PRIORITY = 2000;
export var text;

const PROPERTY_BUTTON_ACTION_NAMES = [
  'STAR',
  'UNKEY',
  'HIDE',
  'CHANGE_IMAGE',
  'DELETE',
];

const PROPERTY_BUTTON_ACTION = {};
PROPERTY_BUTTON_ACTION_NAMES.forEach((name, i) => PROPERTY_BUTTON_ACTION[name] = i);

const PROPERTY_ACTION_NAMES = [
  ...PROPERTY_BUTTON_ACTION_NAMES,
  'POST_DELETE',
  'COPY_TO_LIST',
  'CHANGE_TITLE',
  'CHANGE_DESCRIPTION',
  'CHANGE_IMAGE_POST',
  'ADD',
  'REPLACE',
  'INTEGRATE',
  'SET',
];

const PROPERTY_ACTION = {};
PROPERTY_ACTION_NAMES.forEach((name, i) => PROPERTY_ACTION[name] = i);

export const RENDER = {
  'CURRENT': 0,
  'ALL': 1,
  'NONE': 2,
};

export const DOWN = 1, UP = -1;
export const UNDO = 'undo', REDO = 'redo';

export default function PropertiesPanel(canvas, eventBus, modeling, translate, imageSelection, keyboard, commandStack, elementFactory, postitRenderer, editorActions) {

  this._canvas = canvas;
  this._eventBus = eventBus;
  this._modeling = modeling;
  this._translate = translate;
  this._imageSelection = imageSelection;
  this._keyboard = keyboard;
  this._commandStack = commandStack;
  this._elementFactory = elementFactory;
  this._postitRenderer = postitRenderer;
  this._editorActions = editorActions;

  this.createCanvasElement = _createCanvasElement.bind(this, this._elementFactory, this._modeling, this._canvas);
  this.createImageElement = _createImageElement.bind(this, this._elementFactory, this._modeling, this._canvas);
  this.deleteCanvasElementFromEntry = _deleteCanvasElementFromEntry.bind(this);
  this.deleteCanvasElement = _deleteCanvasElement.bind(this, this._modeling);
  this.findCanvasElement = _findCanvasElement.bind(this);
  this.updateShapeRegistry = _updateShapeRegistry.bind(this);

  this.updateFromCanvas = _updateFromCanvas.bind(this);
  this._syncToCanvas = _syncToCanvas.bind(this);

  this.imageSelectionVersion2 = this._imageSelection.version2 === true;

  this.state = {
    initLoad: true,
    propertiesPanel: false,
    commandStackChanged: false,
    importComplete: false,
    blockCommandStack: false,
    searchText: null,
    keyFunctionListeners: [],
    dropDownHandler: [],
    blockFocus: false,
    historyPointer: -1,
    passNativeUndoRedo: null,
  };

  text = {
    'URL': this._translate('URL'),
    'Properties Editor': this._translate('Properties Editor'),
    'Search': this._translate('Search'),
    'Search platform & canvas': this._translate('Search canvas'),
    'Usage': this._translate('Usage'),
    'Name': this._translate('Name'),
  };

  PropertiesPanel.MIN_PANEL_HTML = `
    <div id="properties-panel-min" class="pjs-ui-element">
      <div class="properties-panel-min-innerwrapper">
        <div class="properties-panel-min-text"><span class="pjs-general-icon"></span></div>
      </div>
    </div>
    `;

  PropertiesPanel.PANEL_HTML = `
    <div id="properties-panel" class="pjs-ui-element-bordered">
      <div class="properties-panel-header pjs-text">
        <div class="properties-panel-header-left">
          ${text['Properties Editor']}
        </div>
        <div class="properties-panel-header-right">
            <ul class="pjs-horizontal">
              ${HISTORY_ENABLED ?
    `<li><button id="js-properties-panel-undo" ><span class="pjs-general-icon"></span></button></li>
                <li><button id="js-properties-panel-redo" ><span class="pjs-general-icon"></span></button></li>`
    : ''
}
            </ul>
        </div>
        <div class="clearfix"></div>
      </div>
      <input type="text" id="js-properties-panel-search" class="properties-panel-top-input" placeholder="${text['Search platform & canvas']}" class="pjs-ui-element"></input>
    </div>
    `;

  PropertiesPanel.PANEL_SECTION_HTML = (listName, listTitle) => `
    <div class="properties-panel-section-header pjs-text">
      <span class="pjs-general-icon panel-properties-${listName}-icon"></span>${listTitle}
    </div>
    <ul class="properties-panel-list properties-panel-list-${listName} pjs-vertical">
    </ul>
    `;

  PropertiesPanel.PANEL_ADD_BUTTON_HTML = `
    <button id="js-add-property-panel-element-local" class="panel-property-add-button pjs-ui-element"><span class="pjs-general-icon"></span></button>
    `;

  PropertiesPanel.DROPDOWN_MARKUP = (listId, dropdownEl, dropdownElId) => `
    <li data-key="dp_${listId}_${dropdownEl.objId}_${dropdownElId}">
        <div class="properties-panel-dropdown-el">
          <img width="20" height="20" src=${dropdownEl.source} />
          <span>${dropdownEl.objTitle}</span>
        </div>
    </li>`;


  this.renderPropertiesPanel();

  this._eventBus.on('import.render.complete', function(event) {

    /* fill entry lists */

    this.history = List();
    this.listNames = [];
    this.entries = [];
    this.scopedEntries = [];
    this.activeEntries = [];
    this.shapeRegistry = Map();

    LIST_NAMES.forEach((listName, listId) => {
      this.listNames.push(listName);
      this.entries.push(List());
      this.scopedEntries.push(null);
      this.activeEntries.push(List());
    });

    this.updateFromCanvas();

    this.updateAll();

    this.bindings();

    this.state.importComplete = true;

  }.bind(this));
}

PropertiesPanel.prototype.syncToCanvas = function(listId) {
  const newShapes = this._syncToCanvas(listId, null, true); // TODO check for changes in syncToCanvas

  /* update ids and positions in case shapes have been newly created. we leave the id management to diagram.js */
  Object.keys(newShapes).forEach(elId => {
    const { shape, x, y } = newShapes[elId]; // need to extract adjusted x,y because of shape postion bug
    const entry = this.entries[listId].get(elId);

    if (entry.type !== POSTIT_IMAGE) {
      this.shapeRegistry = this.shapeRegistry.delete(entry.id);
      this.shapeRegistry = this.shapeRegistry.set(shape.id, shape);
    }

    this.entries[listId] = this.entries[listId].update(elId,
      entry => ({ ...entry,
        'id': shape.id,
        'x':  x,
        'y':  y,
        'width':  shape.width,
        'height': shape.height
      }));
  }
  );
};

PropertiesPanel.prototype.updateAll = function(listIdToUpdate = null) {

  const propertiesPanel = query('#properties-panel');
  const scrollTop = propertiesPanel.scrollTop;

  this.entries.forEach((list, listId) => {
    this.updateScope(listId);

    if (listIdToUpdate === null || listId === listIdToUpdate) {
      this.updateList(listId);
    }

  });

  propertiesPanel.scrollTop = scrollTop;
};

PropertiesPanel.prototype.updateScope = function(listId) {

  const searchText = this.state.searchText;

  const _titleMatch = titleMatch.bind(this, searchText, false);

  if (searchText) {
    this.scopedEntries[listId] = this.entries[listId].map((el, elId) => ({ objTitle: el.objTitle, elId: elId }))
      .filter(_titleMatch)
      .map((el) => el.elId);
  } else {

    this.scopedEntries[listId] = null;

    // by default hide platform entries
    this.scopedEntries[PLATFORM_ENTRIES_ID] = null;
  }
};

PropertiesPanel.prototype.updateList = function(listId) {
  const ppListDOM = query('#properties-panel .properties-panel-list-'+LIST_NAMES[listId]);

  const listEntries = this.getScopedEntries(listId);

  /* delete previous entry list */

  clearDomElement(ppListDOM);

  /* build new entry list */

  const listEntriesSize = listEntries.size;

  listEntries.forEach((entry, elId) => {
    const el = entry;

    const shapeIsNotImage = (el.type !== POSTIT_IMAGE);

    const propClassChangeImageDisabled = (shapeIsNotImage) ? 'property-panel-img-change-disabled' : '';
    const active = this.activeEntries[listId].has(elId);

    const propActive = (prop) => prop ? 'active' : '';
    const propDisabled = (prop) => prop ? 'disabled' : '';

    let liMarkup = `<li class="properties-panel-list-li" 
                    data-id="${LIST_NAMES[listId]}_${el.objId}_${elId}" 
                    class="${propActive(active)}">
         <div class="properties-panel-list-el">
          <div class="properties-panel-list-el-far-left">
            <ul class="pjs-vertical">
              <li><button ${propDisabled(shapeIsNotImage)} class="properties-panel-property-button pjs-ui-element-bordered">
                <span class="pjs-general-icon ${propActive(el.objStarred)} "></span></button>
              </li>
              <li><button ${propDisabled(shapeIsNotImage || !UNKEY_ENABLED)}  class="properties-panel-property-button pjs-ui-element-bordered">
                <span class="pjs-general-icon ${propActive(el.objUnkeyed)} "></span></button>
              </li>
              <li><button ${propDisabled(LIST_NAMES[listId] == PLATFORM_ENTRIES)} class="properties-panel-property-button pjs-ui-element-bordered">
                <span class="pjs-general-icon ${propActive(el.objHidden)}"></span></button>
              </li>
            </ul>
          </div>
          <div class="properties-panel-list-el-left">
            <button class="properties-panel-list-el-visual
              ${propClassChangeImageDisabled}
              pjs-general-icon
              ${(el.objHidden) ? 'properties-panel-list-el-hidden' : 'properties-panel-list-el-change-image'}
             ">
            </button>
            <span class="pjs-general-icon ${(el.objStarred) ? ' properties-panel-list-el-star' : ''}"></span>
          </div>
          <div class="properties-panel-list-el-right">
            <input type="text" tabindex=${2+(elId*2)} placeholder="${text['Name']}" class="pjs-ui-element" />
              <!--dropdown-->
              <div class="properties-panel-list-el-title-dropdown pjs-ui-element-bordered">
                <ul class="pjs-horizontal">
                </ul>
              </div>
            <textarea type="text" tabindex=${2+(elId*2)+1} placeholder="${text['Usage']}" class="pjs-ui-element">${el.objDescription}</textarea>
          </div>
          <div class="properties-panel-list-el-far-right">
            <button class="properties-panel-property-button pjs-ui-element"><span class="pjs-general-icon"></span></button>
          </div>
          <div class="clearfix"></div>
        </div>
      </li>`;
    const liDOM = domify(liMarkup);

    this.renderThumbnail(listId, elId, el, shapeIsNotImage, liDOM);

    ppListDOM.appendChild(liDOM, ppListDOM.firstChild);

    this.renderActionButtonListeners(listId, elId, el, shapeIsNotImage, ppListDOM);

  });

  this.renderInputListeners(listId, listEntriesSize, ppListDOM);
};

PropertiesPanel.prototype.renderThumbnail = function(listId, elId, el, shapeIsNotImage, liDOM) {

  // el is entry

  const imageVisible = this.findCanvasElement(el);

  const sourceDOM = shapeIsNotImage
    ? this.getElementSource(this.shapeRegistry.get(el.id))
    : imageVisible
      ? this.getElementSource(imageVisible.element)
      : domify(`<img src="${el.source}" width="${THUMBNAIL.WIDTH}" height="${THUMBNAIL.HEIGHT}" />`);

  const visualDOM = query('.properties-panel-list-el-visual', liDOM);

  const stackedScale = el.source2 ? 1.5 : 1;
  const shapeScaleY = THUMBNAIL.WIDTH / el.width / stackedScale;
  const shapeScaleX = THUMBNAIL.HEIGHT / el.height / stackedScale;
  const offset = el.source2 ? `translate(0px, ${THUMBNAIL.HEIGHT*2}px)` : '';
  visualDOM.appendChild(domify(`
      <svg id="properties-panel-thumbnail-${el.id}"
           width="${THUMBNAIL.WIDTH}"
           height="${THUMBNAIL.HEIGHT}"
           style="">
           <g class="djs-visual"
            style="transform: scale(${shapeScaleX} , ${shapeScaleY}) ${offset}">
            </g>
      </svg>`));
  const visualDOMInner = query('.djs-visual', visualDOM);
  visualDOMInner.appendChild(sourceDOM);

  // visualDOM.appendChild(sourceDOM);
};

PropertiesPanel.prototype.renderInputListeners = function(listId, listEntriesSize, ppListDOM) {

  /* focus input, textarea listeners */

  const ppListEntries = queryAll('#properties-panel .properties-panel-list-' + LIST_NAMES[listId] + ' > li', ppListDOM);

  const ppListInputs = queryAll('#properties-panel .properties-panel-list-'+ LIST_NAMES[listId] + ' input', ppListDOM);
  const ppListTextarea = queryAll('#properties-panel .properties-panel-list-'+ LIST_NAMES[listId] + ' textarea', ppListDOM);

  ppListInputs.forEach((el, elIdPre) => {
    const elId = this.scopedEntries[listId] ? this.scopedEntries[listId].get(elIdPre) : elIdPre;

    // setting title value here
    ppListInputs[elIdPre].value = this.entries[listId].get(elId).objTitle;

    domEvent.bind(ppListInputs[elIdPre], 'input', this.changeElementTitle.bind(this, listId, elId, el), false);
    domEvent.bind(ppListTextarea[elIdPre], 'input', this.changeElementTextarea.bind(this, listId, elId, el), false);

    // domEvent.bind(ppListInputs[elIdPre], 'keyup', (event) => {event.code === 'Enter' ? ppListInputs[elIdPre].blur() : null;});

    domEvent.bind(ppListEntries[elIdPre], 'click', (ev) => this.focusElement.bind(this, listId, elId, ppListEntries[elIdPre], ev)(), false);
  });
};

PropertiesPanel.prototype.renderActionButtonListeners = function(listId, elIdPre, el, shapeIsNotImage, ppListDOM) {
  const elId = this.scopedEntries[listId] ? this.scopedEntries[listId].get(elIdPre) : elIdPre;

  const ppActionButton = ppListDOM.getElementsByTagName('button');
  if (ppActionButton) {
    for (const action in PROPERTY_BUTTON_ACTION) {

      const actionIdLocal = PROPERTY_BUTTON_ACTION[action],
            actionCount = Object.keys(PROPERTY_BUTTON_ACTION).length,
            actionIdGlobal = (elIdPre*actionCount)+actionIdLocal;

      if (actionIdLocal == PROPERTY_ACTION['CHANGE_IMAGE']) {

        domEvent.bind(ppActionButton[actionIdGlobal], 'click',
          this.zoomToElement.bind(this, listId, el),
          false);

        if (!shapeIsNotImage) {
          const entry = this.entries[listId].get(elId);

          domEvent.bind(ppActionButton[actionIdGlobal], 'click',
            this.changeProperties.bind(this, listId, elId, actionIdLocal, entry),
            false);
        }
      } else {
        domEvent.bind(ppActionButton[actionIdGlobal], 'click',
          this.changeProperties.bind(this, listId, elId, actionIdLocal),
          false);

      }

    }
  }
};

PropertiesPanel.prototype.renderPropertiesPanel = function() {
  const canvasDOM = document.getElementById('canvas');
  const container = this._container = domify(PropertiesPanel.PANEL_HTML);
  canvasDOM.insertBefore(container, canvasDOM.firstChild);

  LIST_NAMES.forEach((listName, listId) => {
    const panelSectionDOM = domify(PropertiesPanel.PANEL_SECTION_HTML(LIST_NAMES[listId], LIST_TITLES[listName]));
    const propertiesPanel= query('#properties-panel');

    if (listId == CANVAS_ENTRIES_ID) {
      panelSectionDOM.insertBefore(domify(PropertiesPanel.PANEL_ADD_BUTTON_HTML), panelSectionDOM.lastChild);
    }

    propertiesPanel.appendChild(panelSectionDOM);
  });

  const containerMinDOM = domify(PropertiesPanel.MIN_PANEL_HTML);
  canvasDOM.insertBefore(containerMinDOM, canvasDOM.firstChild);
};

PropertiesPanel.prototype.togglePropertiesPanel = function() {
  const ppDOM = query('#properties-panel');
  const ppMinDOM = query('#properties-panel-min');

  if (DEBUG || !this.state.propertiesPanel) {
    ppDOM.style.display = 'block';
    ppMinDOM.classList.add('properties-panel-min-maxed');
  } else {
    ppDOM.style.display = 'none';
    ppMinDOM.classList.remove('properties-panel-min-maxed');
  }

  this.state.propertiesPanel = !this.state.propertiesPanel;
};



PropertiesPanel.prototype.activateElements = function(elements) {
  let elementsToActivate = isFunction(elements) ? elements() : elements;

  elementsToActivate.forEach((element, i) => {
    const { listId, elId, el } = element;
    let targetElement = element.ev && element.ev.target ? element.ev.target : null;

    el.classList.add('active'); // activate li without updateAll
    this.activeEntries[listId] = this.activeEntries[listId].push(elId); // add entry to activeEntries

    if (!this.state.blockFocus) {
      if (!targetElement) {
        targetElement = query(' input', el);
      }
      targetElement.focus(); // focus clicked input element of li
    }

  });
};

PropertiesPanel.prototype.deactivateElements = function(elements) {

  if (!elements) {

    const listEntries = queryAll('#properties-panel .properties-panel-list .properties-panel-list-li');

    // const ppListInputs = queryAll('#properties-panel .properties-panel-list li' + ' input');

    Array.from(listEntries).forEach((el, i) => {

      // ppListInputs[i].blur();

      el.classList.remove('active');
    });

    this.entries.forEach((list, listId) => {
      this.activeEntries[listId] = List();
    });

  } else {

    elements.forEach(element => {
      const { listId, elId, el } = element;
      el.classList.remove('active');

      this.activeEntries[listId].delete(elId);
    });

  }
};

PropertiesPanel.prototype.focusElement = function(listId, elId, el, ev = null) {

  this.deactivateElements();

  this.activateElements([{ listId, elId, el, ev }]);
};

PropertiesPanel.prototype.loadSearchEntries = function(el, ev) {

  this.state.blockFocus = true;

  this.state.searchText = el.value;
  const searchText = this.state.searchText;

  this.deactivateElements();

  /* update scopes and lists */

  let elIdToHighlight = null,
      listToHighlight = null;

  this.entries.forEach((list, listId) => {

    this.updateScope(listId);

    if (this.scopedEntries[listId]
      && this.scopedEntries[listId].size > 0) {

      if (!elIdToHighlight) {

        elIdToHighlight = this.scopedEntries[listId].first();
        listToHighlight = listId;

      }
    }

    this.updateList(listId);

  });

  const firstEl = query('#properties-panel .properties-panel-list-'+LIST_NAMES[listToHighlight]);

  if (searchText && elIdToHighlight !== null) {
    this.activateElements([{
      listId: listToHighlight,
      elId: elIdToHighlight,
      el: firstEl.firstChild
    }]);
  }
};



PropertiesPanel.prototype.showElementDropdown = function(listId, elId, el) {

  const searchText = el.value;
  const _titleMatch = titleMatch.bind(this, searchText, false);

  const { ppListInputs, dropdownDOM } = getDropdownDOM(listId, elId);

  const dropdownContent = ENTRIES.filter(_titleMatch);// ENTRIES[PLATFORM_ENTRIES]
  const dropdownDomUl = query(' ul ', dropdownDOM);

  clearDomElement(dropdownDomUl);

  if (dropdownDOM) {
    if (!dropdownContent || dropdownContent.length == 0) {

      dropdownDOM.style.display = 'none';

    } else {

      dropdownDOM.style.display = 'block';

      dropdownContent.forEach((dropdownEl, dropdownElId) => {

        let dropdownLiDom = PropertiesPanel.DROPDOWN_MARKUP(listId, dropdownEl, dropdownElId);
        dropdownLiDom = domify(dropdownLiDom);

        dropdownDomUl.appendChild(dropdownLiDom, dropdownDomUl.nextSibling);

        domEvent.bind(dropdownLiDom, 'mousedown', (event) => {

          // dropdownEl.id = '';
          dropdownEl.objDescription = '';
          this.changeProperties(listId, elId, PROPERTY_ACTION['REPLACE'], dropdownEl);

          event.preventDefault();
        });

      });

      /* handling of dropdown blur */

      if (dropdownContent.length > 0) {
        if (!this.state.dropDownHandler[elId]) {

          this.state.dropDownHandler[elId] = this.closeElementInputSelection.bind(this, listId, elId, ppListInputs[elId]);

          ppListInputs[elId].addEventListener('blur', this.state.dropDownHandler[elId], false);
        }
      }
    }
  }
};

PropertiesPanel.prototype.closeElementInputSelection = function(listId, elId, el) {
  if (this.state.dropDownHandler[elId]) {
    el.removeEventListener('blur', this.state.dropDownHandler[elId], false);
    this.state.dropDownHandler[elId] = null;
  }
};

PropertiesPanel.prototype.changeImage = function(_listId, _elId, _element, entry) {
  if (this.imageSelectionVersion2) {
    if (entry && isArray(entry) && entry.length > 0) {

      // only uses first image in case of multi upload.
      entry = entry[0];
      entry = shapePositionFixReverse(entry);
    } else {
      entry = shapePositionFixReverse(entry);
    }
  } else {
    entry = shapePositionFixReverse(convertToDefinedEntry({ ..._element.element, source: entry }));
  }

  if (entry) {
    delete entry.id;
    this.changeProperties(_listId, _elId, PROPERTY_ACTION['DELETE'], entry);
  }

  this.changeProperties(_listId, _elId, PROPERTY_ACTION['SET'], entry);
};

PropertiesPanel.prototype.changeElementTitle = function(listId, elId, el, ev) {
  this.changeProperties(listId, elId, PROPERTY_ACTION['CHANGE_TITLE'], ev);

  const entry = this.entries[listId].get(elId);
  if (DROPDOWN_ENABLED && listId === CANVAS_ENTRIES_ID && entry.type == POSTIT_IMAGE) {
    this.showElementDropdown(listId, elId, el);
  }
};

PropertiesPanel.prototype.changeElementTextarea = function(listId, elId, el, ev) {
  this.changeProperties(listId, elId, PROPERTY_ACTION['CHANGE_DESCRIPTION'], ev);
};

PropertiesPanel.prototype.changePropertiesOnActiveElements = function(actionId) {
  this.entries.forEach(listId => {
    this.activeEntries[listId].forEach(elId => {
      this.changeProperties(listId, elId, actionId);
    });
  });
};

PropertiesPanel.prototype.changeProperties = function(listId, elId, actionId, ev = null) {

  // reset the undo/redo lock after a real action
  if (ev instanceof MouseEvent) {
    this.state.passNativeUndoRedo = false;
  }

  if (!this.state.blockCommandStack) {
    this.state.blockCommandStack = true;

    let panelRenderRestriction = null;

    /* list dependent actions (not in effect yet) */

    if (LIST_NAMES[listId] == PLATFORM_ENTRIES) {
      if (actionId == PROPERTY_ACTION['DELETE']) {
        actionId = PROPERTY_ACTION['COPY_TO_LIST'];
      }
    } else if (LIST_NAMES[listId] == CANVAS_ENTRIES) {
      if (actionId == PROPERTY_ACTION['COPY_TO_LIST']) {
        actionId = -1;
      }
    }

    /* action handlers */

    let entry = this.entries[listId].get(elId);

    if (actionId == PROPERTY_ACTION['ADD']) {
      entry = ev || IMAGE_ENTRY_PROTOTYPE({});
      this.entries[listId] = this.entries[listId].push(entry);
    }
    else if (actionId == PROPERTY_ACTION['DELETE']) {
      this.deleteCanvasElementFromEntry(listId, elId);

      this.entries[listId] = this.entries[listId].delete(elId);
    }
    else if (actionId == PROPERTY_ACTION['REPLACE']) {
      const entry = this.entries[listId].get(elId);
      const newEntry = { ...entry, ...ev };
      delete newEntry.id;

      this.deleteCanvasElementFromEntry(listId, elId);

      this.entries[listId] = this.entries[listId].set(elId, newEntry);
    }
    else if (actionId == PROPERTY_ACTION['SET']) {
      this.entries[listId] = this.entries[listId].set(elId, ev);

    }
    else if (actionId == PROPERTY_ACTION['CHANGE_IMAGE']) {
      const element = this.findCanvasElement(ev);

      if (element) { // not hidden

        if (this.imageSelectionVersion2 && element.element) {
          this._imageSelection.select(element.element, this.changeImage.bind(this, listId, elId, element));
        } else {
          this._imageSelection.select(null, this.changeImage.bind(this, listId, elId, element));
        }
      }

      // document.getElementById('pjs-image-selection-modal').style.position = 'fixed';
    }
    else if (actionId == PROPERTY_ACTION['STAR']) {
      this.entries[listId] = this.entries[listId].update(elId,
        val => ({ ...val, 'objStarred': !val.objStarred })
      );
    }
    else if (actionId == PROPERTY_ACTION['UNKEY']) {
      let source0;
      let source1;

      if (!entry.objUnkeyed) { // means it has been equal pre change
        source0 = entry.sourceUnkeyed;
        source1 = entry.source;
      } else if (entry.objUnkeyed) {
        source0 = entry.source;
        source1 = entry.sourceUnkeyed;
      }

      if (entry.objUnkeyed != entry.objUnkeyedOriginal) {
        const source0Old = source0;
        source0 = source1;
        source1 = source0Old;
      }

      this.entries[listId] = this.entries[listId].update(elId,
        val => ({ ...val, 'source': source0, 'sourceUnkeyed': source1, 'objUnkeyed': !val.objUnkeyed })
      );
    }
    else if (actionId == PROPERTY_ACTION['HIDE']) {
      if (!entry.objHidden) { // means was hidden
        this.deleteCanvasElementFromEntry(listId, elId);
      }

      this.entries[listId] = this.entries[listId].update(elId,
        val => ({ ...val, 'objHidden': !val.objHidden })
      );
    }
    else if (actionId == PROPERTY_ACTION['CHANGE_TITLE']) {
      this.entries[listId] = this.entries[listId].update(elId, val => ({ ...val, 'objTitle': ev.target.value }));
      panelRenderRestriction = RENDER['NONE'];
    }
    else if (actionId == PROPERTY_ACTION['CHANGE_DESCRIPTION']) {
      this.entries[listId] = this.entries[listId].update(elId, val => ({ ...val, 'objDescription': ev.target.value }));
      panelRenderRestriction = RENDER['NONE'];
    }

    // dont sync while undoing otherwise it would go on infinitely.
    if (!this.state.passNativeUndoRedo) {
      this.syncToCanvas(listId);

      if (!panelRenderRestriction) {
        this.updateAll();
      }
    }

    this.state.blockCommandStack = false;
  }
};



PropertiesPanel.prototype.addEntry = function(listId, entry) {
  this.changeProperties(CANVAS_ENTRIES_ID, null, PROPERTY_ACTION['ADD'], entry);

  this.updateAll();
};

PropertiesPanel.prototype.updateEntry = function(listId, elId, entry) {
  this.changeProperties(listId, elId, PROPERTY_ACTION['SET'], entry);
};



PropertiesPanel.prototype.bindings = function() {

  /** fold/unfold properties-panel */
  const ppMinDOM = query('#properties-panel-min');
  domEvent.bind(ppMinDOM, 'click', this.togglePropertiesPanel.bind(this), false);
  DEBUG ? this.togglePropertiesPanel.bind(this)() : void(0);

  /** add button (only in bottom section) */
  const ppAddButton = query('#js-add-property-panel-element-local');
  domEvent.bind(ppAddButton, 'click', this.addEntry.bind(this, CANVAS_ENTRIES_ID, null), false);

  /** search */
  const ppSearch = query('#js-properties-panel-search');
  domEvent.bind(ppSearch, 'input', this.loadSearchEntries.bind(this, ppSearch), false);
  domEvent.bind(ppSearch, 'blur', () => this.state.blockFocus = false, false);

  /** undo/redo */
  if (HISTORY_ENABLED) {
    const ppUndo = query('#js-properties-panel-undo');
    domEvent.bind(ppUndo, 'click', this.undoOrRedo.bind(this, true), false);
    const ppRedo = query('#js-properties-panel-redo');
    domEvent.bind(ppRedo, 'click', this.undoOrRedo.bind(this, false), false);
  }

  /* keys */
  // have to bind this outside diagram.js keyboard module in order to react even in input fields
  if (LIST_NAMES.includes(PLATFORM_ENTRIES)) {
    this.bindKeyListener('Enter', this.changePropertiesOnActiveElements.bind(this, PROPERTY_ACTION['COPY_TO_LIST']));
  }
  this.bindKeyListener('ArrowDown', this.activateElements.bind(this, (this.keyArrowFunctions.bind(this, DOWN))));
  this.bindKeyListener('ArrowUp', this.activateElements.bind(this, (this.keyArrowFunctions.bind(this, UP))));

  /* diagram.js event */
  this._eventBus.on('imageSelection.complete', function(event) {

    // retrigger fromCanvas sync process to apply all canvas immediately in multiuplod
    this.updateFromCanvas();
  }.bind(this));

  /* keyboard listeners */
  this._keyboard.addListener(HIGHEST_PRIORITY, function(context) {
    const event = context.keyEvent;
    if (this._keyboard.isCmd(event) && !this._keyboard.isShift(event) && this._keyboard.isKey(KEYS_UNDO, event)) {
      this.state.passNativeUndoRedo = true;
    }
    else if (this._keyboard.isCmd(event) && (this._keyboard.isKey(KEYS_REDO, event) || (this._keyboard.isKey(KEYS_UNDO, event) && this._keyboard.isShift(event)))) {
      this.state.passNativeUndoRedo = true;
    }
  }.bind(this));

  this._eventBus.on('commandStack.changed', HIGHEST_PRIORITY, function(event) {
    if (this.state.importComplete) {

      if (!this.state.blockCommandStack) {
        this.updateFromCanvas();

        this.updateAll(CANVAS_ENTRIES_ID);

        this.state.passNativeUndoRedo = false;
      }
    }
  }.bind(this));
};

PropertiesPanel.prototype.bindKeyListener = function(key, fn) {
  if (this.state.keyFunctionListeners[key])
    domEvent.unbind(document, 'keydown', this.state.keyFunctionListeners[key].bind(this));

  this.state.keyFunctionListeners[key] = (ev) => {this._keyboard.isKey(key, ev) ? fn() : null;};
  domEvent.bind(document, 'keydown', this.state.keyFunctionListeners[key].bind(this));
};

PropertiesPanel.prototype.keyArrowFunctions = function(direction) {
  const listEntries = [];

  this.entries.forEach((list, listId) => listEntries.push(this.getScopedEntries(listId)));

  let activeEntry = null;

  this.activeEntries.forEach((list, listId) => {
    if (activeEntry === null && list.size > 0) {
      activeEntry = { listId: listId, elId: list.first() };
    }
  });

  if (activeEntry !== null) {
    activeEntry.elId = direction > 0 ? Math.min(activeEntry.elId+direction, listEntries[activeEntry.listId].size-1)
      : Math.max(activeEntry.elId+direction, 0);

    this.deactivateElements();
    return [{ ...activeEntry, el: queryAll('#properties-panel .properties-panel-list .properties-panel-list-li')[activeEntry.elId] }];
  }

  return [];
};



PropertiesPanel.prototype.addToHistory = function() {

  if (HISTORY_ENABLED) {

    /* if (this.history.size > HISTORY_MAX) {
      this.history = this.history.slice(0, this.history.size);
    }*/

    let historyStateEntries = List();
    this.entries.forEach((list, listId) => historyStateEntries = historyStateEntries.set(listId, list));

    let historyState = Map();
    historyState = historyState.set('entries', historyStateEntries);
    historyState = historyState.set('shapeRegistry', this.shapeRegistry);

    this.state.historyPointer = this.state.historyPointer + 1;

    this.history = this.history.insert(this.state.historyPointer, historyState);
  }
};

PropertiesPanel.prototype.undoOrRedo = function(undoOrRedo) {
  if (this.history && this.history.size > 0) {

    this.state.historyPointer = undoOrRedo
      ? Math.max(0, this.state.historyPointer-1)
      : Math.min(this.history.size-1,this.state.historyPointer+1);

    const entries = [];
    this.history.get(this.state.historyPointer).get('entries').map((list, listId) => entries.push(list));
    const shapeRegistry = this.history.get(this.state.historyPointer).get('shapeRegistry');

    this.entries = entries;
    this.shapeRegistry = shapeRegistry;

    this.updateAll();

  }
};



PropertiesPanel.prototype.zoomToElement = function(listId, el) {
  if (listId == CANVAS_ENTRIES_ID && el && el.x && el.y) {
    this._canvas.zoom('fit-viewport', { x: el.x - CANVAS_OFFSET_X, y: el.y });
  }
};

PropertiesPanel.prototype.getElementSource = function(shape) {
  const gfx = domify('<g class="djs-visual"></g>');
  const sh = this._postitRenderer.drawShape(gfx, shape);
  return sh;
};

PropertiesPanel.prototype.getScopedEntries = function(listId) {
  return (this.scopedEntries[listId])
    ? this.entries[listId].filter((map, i) => this.scopedEntries[listId].includes(i))
    : this.entries[listId];
};



const titleMatch = function(searchText, showEmpty, el, i) {
  searchText = searchText.toLowerCase().trim();
  if (
    (searchText || showEmpty)
      && (el.objTitle.toLowerCase()
        .includes(searchText)
      || showEmpty && el.objTitle === '')) {
    return true;
  }
  else {
    return false;
  }
};

const getDropdownDOM = function(listId, elId) {
  const listName = LIST_NAMES[listId];
  const ppListDOM = query('#properties-panel .properties-panel-list-'+listName);
  const ppListInputs = queryAll(' input', ppListDOM);
  const ppListDropDowns = queryAll(' .properties-panel-list-el-title-dropdown', ppListDOM);
  const dropdownDOM = ppListDropDowns[elId];
  return { ppListInputs, dropdownDOM };
};

const clearDomElement = function(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
};

PropertiesPanel.prototype.$inject = [
  'canvas',
  'eventBus',
  'modeling',
  'translate',
  'imageSelection',
  'keyboard',
  'commandStack',
  'elementFactory',
  'postitRenderer',
];
