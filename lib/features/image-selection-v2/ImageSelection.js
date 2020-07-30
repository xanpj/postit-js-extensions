import {
  domify,
  queryAll,
  query,
  event as domEvent
} from 'min-dom';

import {
  isArray,
} from 'min-dash';

import {
  fileReader,
  isSourceText,
  isImage
} from 'postit-js-core/lib/util/FileUtil.js';

import {
  getMousePosition
} from 'postit-js-core/lib/util/ScreenUtil.js';

import {
  ENTRIES,
  POSTIT_IMAGE,
  updateImageSource as _updateImageSource,
  updateImageProperties as _updateImageProperties,
  createImageElement as _createImageElement,
  convertToEntry,
  getCanvasEntries as _getCanvasEntries,
} from 'postit-js-extensions/lib/features/entry-factory/EntryFactory.js';

import './ImageSelection.less';

const SINGLE = 0, STACKED = 1;

const LOW_PRIORITY = 500;
var text;

function clearDom(parentNode) {
  while (parentNode.firstChild) {
    parentNode.removeChild(parentNode.firstChild);
  }
}


function isStacked(val) {
  return !(!val.source2 || val.source2.length == 0);
}

function isDefined(str) {
  return str !== '' && str != null;
}

function unique(arr, prop) {
  return arr.filter((el, index, self) => self.findIndex(e => e[prop] === el[prop]) === index);
}

function renderStackedImage(imgSources, scaleFactor = 1.0, button = false) {
  const marginLeft = [], marginTop = [], isText = [];
  const width = Math.floor(50 * scaleFactor),
        height = Math.floor(50 * scaleFactor);
  marginLeft[0] = Math.floor(40 * scaleFactor), marginTop[0] = Math.floor(-35 * scaleFactor),
  marginLeft[1] = Math.floor(10 * scaleFactor), marginTop[1] = Math.floor(-20 * scaleFactor),
  isText[0] = isSourceText(imgSources[0]);
  isText[1] = isSourceText(imgSources[1]);

  // TODO check if image from local

  const DEFAULT_IMG = './icons/image.svg';
  const style = (pos, sources, isText) => `
                  style="
                  width: ${width}px;
                  height: ${height}px;
                  margin-left: ${marginLeft[pos]}px;
                  margin-top: ${marginTop[pos]}px;
                  ${sources[pos] && !isText[pos]
    ? 'background-image: url('+sources[pos]+')'
    : 'background-image: url('+DEFAULT_IMG+')'
}" 
                  `;

  const imageComponentMarkup = () => imgSources.map((source, pos) => `
                ${button ? '<button>' : ''}
                  <div class="pjs-image-adj pjs-img-pos-${pos}" ${style(pos, imgSources, isText)}>
                    ${isText[pos] ? '<span class="pjs-stacked-image-text">'+imgSources[pos]+'</span>' : ''}
                  </div>
                ${button ? '</button>' : ''}
                `).join('');

  const imageStackedFull = `<div class="pjs-image-selection-middle-box">
   ${ imageComponentMarkup() }
    </div>`;

  return imageStackedFull;
}

const mouseOutsideModal = (ev, modal) => {
  const mousePos = getMousePosition(ev);
  const borders = [-1, 0, 1];
  return borders.every(border => ((mousePos.pageX + border > modal.offsetLeft+modal.clientWidth
        || mousePos.pageX + border < modal.offsetLeft)
        || (mousePos.pageY + border > modal.offsetTop+modal.clientHeight
        || mousePos.pageY + border < modal.offsetTop)));
};

ImageSelection.prototype.version2 = true;

export default function ImageSelection(canvas, eventBus, modeling, translate, elementFactory) {

  this._canvas = canvas;
  this._eventBus = eventBus;
  this._modeling = modeling;
  this._translate = translate;
  this._elementFactory = elementFactory;

  this.state = {
    activeEntries: [],
    uploadedEntries: [],
    currentDragged: null,
    canvasClickBinder: null,
    searchValue: null,
    targetIsStacked: null,
    stackedEditor: null,
    pasted: null,
  };

  this.getCanvasEntries = _getCanvasEntries.bind(this, this._canvas);
  this.updateImageProperties = _updateImageProperties.bind(this, this._modeling);
  this.createImageElement = _createImageElement.bind(this, this._elementFactory, this._modeling, this._canvas);

  var self = this;

  const canvasDOM = query('#canvas');

  eventBus.on('create.end', LOW_PRIORITY, function(event) {
    var context = event.context,
        element = context.shape,
        hints = context.hints;

    if (hints.selectImage) {
      self.select(element);
    }
  });

  text = { 'URL': this._translate('URL'),
    'An error occured during the file upload': this._translate('An error occured during the file upload'),
    'Upload files here': this._translate('Upload files here'),
    'Upload from local is for demo purposes only. It slows down the page and increases the file size.': this._translate('Upload from local is for demo purposes only. It slows down the page and increases the file size.'),
    'Upload': this._translate('Upload'),
    'file': this._translate('file'),
    'files': this._translate('files'),
    'selected': this._translate('selected'),
    'Upload again': this._translate('Upload again'),
    'Search': this._translate('Search'),
    'Use': this._translate('Use'),
    'Drop single image here': this._translate('Drop single image here')
  };

  ImageSelection.IMAGE_UPLOAD_MARKUP = `
     <div class="pjs-image-upload-wrapper">
      <label for="pjs-image-upload">
        <div class="pjs-io-dialog-text-hint">
          <a><ul id="pjs-image-dialog-text-hint-list" class="pjs-horizontal">
            <li><div class="pjs-general-icon pjs-image-dialog-upload-icon"></div></li>
            <li id="pjs-image-selection-files-text-error">${text['An error occured during the file upload']}</li>
            <li id="pjs-image-selection-files-text-upload">${text['Upload']}</li>
          </ul></a>
        </div>
      </label>
      <input type="file" id="pjs-image-upload" style="display:none" multiple/>
    </div>`;

  ImageSelection.IMAGE_SELECTION_MARKUP = `<div id="pjs-image-selection-modal" class="pjs-io-dialog-local">
    <div id="pjs-image-selection-editor">
    </div>
    <div id="pjs-image-selection-main">
      <div class="pjs-io-dialog-section pjs-first">
        <div id="pjs-image-selection-input-wrapper">
          <input id="pjs-image-selection-input" class="pjs-ui-element-bordered" />
            <div id="pjs-image-selection-input-grabber-wrapper">
              <div id="pjs-image-selection-input-grabber">
                <span class="pjs-general-icon"></span>
              </div>
          </div>
        </div>
          <div class="pjs-labeled-input">
            <label for="pjs-image-selection-input" class="pjs-input-text-static">${text['URL']+'/'+text['Search']}:</label>
          </div>
      </div>
      <div class="pjs-io-dialog-section pjs-io-dialog-section-grid">
      </div>
      <div class="pjs-io-dialog-section pjs-io-dialog-section-image-upload">
        ${ImageSelection.IMAGE_UPLOAD_MARKUP}
      </div>
      <div class="pjs-io-dialog-section pjs-io-dialog-section-submit">
        <div class="pjs-buttons pjs-image-selection-submit-wrapper">
          <button id="pjs-image-selection-submit">${text['Use']}</button>
        </div>
      </div>
    </div>
  </div>`;


  this.removeModal = () => {
    const modals = queryAll('#pjs-image-selection-modal'); // abnormal situation
    const body = query('body');
    modals.forEach(modal => {
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
        if (this.state.canvasClickBinder) {
          body.removeEventListener('click', this.state.canvasClickBinder);
        }
      }
    });
  };

  this.renderModal = () => {
    const imageSelectionContainer = domify(ImageSelection.IMAGE_SELECTION_MARKUP);
    const mousePosition = getMousePosition(null);
    imageSelectionContainer.style.left = mousePosition.pageX + 'px';
    imageSelectionContainer.style.top = mousePosition.pageY + 'px';
    canvasDOM.appendChild(imageSelectionContainer);
    if (mousePosition.pageX > window.innerWidth/2) {
      imageSelectionContainer.style.left = (mousePosition.pageX - imageSelectionContainer.clientWidth)+ 'px';
    }
  };

  this.renderGrid = () => {

    const searchValue = this.state.searchValue;

    // retrieve image entries
    const platformEntries = this.platformEntries;

    const localEntries = this.getCanvasEntries().filter(el => el.id != this.element.id && isDefined(el.source));

    const globalEntriesScoped = platformEntries.filter(entry =>
      searchValue &&
                            entry.objTitle.toLowerCase()
                              .includes(searchValue.toLowerCase()));

    const localEntriesScoped = localEntries.filter(entry =>
      searchValue &&
                            (!entry.objTitle
                            || entry.objTitle.toLowerCase()
                              .includes(searchValue.toLowerCase())));

    this.state.currentScope = [...this.state.activeEntries,
      ...localEntriesScoped, ...this.state.uploadedEntries,
      ...globalEntriesScoped];

    this.state.currentScope = unique(this.state.currentScope, 'objId');

    // this.state.currentScope = unique(this.state.currentScope, 'id');

    // split into single and stacked images
    const currentScopeSplit = [];
    currentScopeSplit[SINGLE] = this.state.currentScope.filter(val => !isStacked(val));
    currentScopeSplit[STACKED] = this.state.currentScope.filter(val => isStacked(val));

    // Render Grid
    const imageSelectionGridSection = query('.pjs-io-dialog-section-grid');

    clearDom(imageSelectionGridSection);

    imageSelectionGridSection.appendChild(domify('<div id="pjs-image-selection-grid"></div>'));


    const imageSelectionGrid = query('#pjs-image-selection-grid', imageSelectionGridSection);

    const gridWrappers = [];
    const GRID_COLUMNS = 2;
    let effectiveColumns = (currentScopeSplit[STACKED].length > 0) ? 1 : 0;
    effectiveColumns += (currentScopeSplit[STACKED].length > 0) ? 1 : 0 ;

    for (let i = 0;i<GRID_COLUMNS;i++) {
      const gridWidth = (100/GRID_COLUMNS) - 1;
      const imageSelectionGridMarkup = `<div class="pjs-grid-wrapper pjs-grid-2" style="width: ${gridWidth}%;"></div>`;
      gridWrappers[i] = domify(imageSelectionGridMarkup);
      imageSelectionGrid.appendChild(gridWrappers[i]);

      if (effectiveColumns == 2 && i == 0) {
        const imageSelectionGridDividerMarkup = '<div id="pjs-image-selection-grid-divider" class="pjs-grid-wrapper pjs-grid-2"></div>';
        imageSelectionGrid.appendChild(domify(imageSelectionGridDividerMarkup));
      }

    }

    // Render Images
    for (let i = 0; i<currentScopeSplit.length;i++) {
      for (let j = 0; j<currentScopeSplit[i].length;j++) {
        const entry = currentScopeSplit[i][j];

        const isFromCanvasClass = localEntries.find(localEntry => entry.id && localEntry.id === entry.id) ? 'fromCanvas' : '';
        const isActiveClass = this.state.activeEntries.find(activeEntry => activeEntry.id === entry.id) ? 'active' : '';

        // let isTargetClass = entry.id && this.element.id === entry.id ? 'fromTarget' : '';
        let isTargetClass = isActiveClass && j==0 && (i==!this.state.targetIsStacked ? 0 : 1) ? 'fromTarget' : '';
        const highlightElementClasses = isActiveClass + ' ' + isFromCanvasClass + ' ' + isTargetClass;

        const leftGrid = i == 0;
        const gridIconElementMarkup = `
          <div class="pjs-grid-col">
            <button class="pjs-image-selection-grid-el ${highlightElementClasses}">
              ${leftGrid
    ? `<img src="${entry.source}" />`
    : renderStackedImage([entry.source2, entry.source], 0.5, false)}
            </button>
          </div>`;
        gridWrappers[i].appendChild(domify(gridIconElementMarkup));
      }
    }

    // Image Binders
    for (let gridId = 0; gridId < currentScopeSplit.length; gridId++) {

      const buttons = queryAll('button', gridWrappers[gridId]);

      for (let elId = 0; elId < currentScopeSplit[gridId].length; elId++) {

        const button = buttons[elId];
        const entry = currentScopeSplit[gridId][elId];

        domEvent.bind(button, 'click', this.activateImage.bind(this, entry), false);
        domEvent.bind(button, 'drag', () => this.state.currentDragged = entry, false);
      }
    }

    const imageSelectionModalDOM = document.getElementById('pjs-image-selection-modal');
    const mousePosition = getMousePosition(null);
    const windowHeight = window.getComputedStyle(imageSelectionModalDOM).height.replace('px', '');
    if (mousePosition.pageY > window.innerHeight-windowHeight) {
      imageSelectionModalDOM.style.top = Math.round(mousePosition.pageY - windowHeight) + 'px';
    }
  };

  this.renderImageEditor = () => {
    this.state.stackedEditor = !this.state.stackedEditor ? [{}, {}, {}] : this.state.stackedEditor;

    const imageEditor = query('#pjs-image-selection-editor');
    clearDom(imageEditor);

    const active = this.isActive(this.state.stackedEditor[2]) ? 'active' : '';
    const fromTarget = this.isTarget(this.state.stackedEditor[2]) ? 'fromTarget' : '';

    const stackedEditorParts = [this.state.stackedEditor[1], this.state.stackedEditor[0]];
    const editorPartsMarkup = stackedEditorParts.map((img, pos) => `
        <div id="pjs-image-editor-${pos}" class="pjs-image-stacked-editor-box">
          ${img && img.source ? (isSourceText(img.source) ? '<span class="pjs-stacked-image-text">'+img.source+'</span>' : '<img src="'+img.source+'">') : text['Drop single image here']}
        </div>
      `).join('');

    const imageStackedEditorMarkup = `
      <div id="pjs-image-selection-editor-inner">
        <div id="pjs-image-selection-wrapper" class="${fromTarget + ' ' + active}">
          ${editorPartsMarkup}
        </div>
      </div>`;

    imageEditor.appendChild(domify(imageStackedEditorMarkup));

    const stackedEditorBoxes = queryAll('.pjs-image-stacked-editor-box');
    stackedEditorBoxes.forEach((box, elId) => {

      domEvent.bind(box, 'drop', (event) => {
        this.state.stackedEditor[Math.abs(1-elId)] = this.state.currentDragged;
        this.addStacked();
        this.renderImageEditor();
        this.renderGrid();
      }, false);
      domEvent.bind(box, 'dragover', (event) => box.classList.add('draggedActive'), false);
      domEvent.bind(box, 'dragleave', (event) => box.classList.remove('draggedActive'), false);

    });
  };

  this.activateImage = (entry, uploaded = false) => {
    if (uploaded) {
      this.state.uploadedEntries.push(entry);
    }

    // switch target
    if (this.state.activeEntries.length == 0
     || this.state.activeEntries.length == 1 && (isStacked(entry) !== isStacked(this.state.activeEntries[0]))) {
      this.state.activeEntries = [];
      this.state.targetIsStacked = isStacked(entry);
    }

    // make active
    const removeId = this.state.activeEntries.findIndex(a => a.id === entry.id);
    if (removeId > -1) {
      this.state.activeEntries.splice(removeId, 1);
    } else {
      this.state.activeEntries.push(entry);
    }
    this.renderGrid();

    if (isStacked(entry)) {
      this.state.stackedEditor = (removeId > -1) ? null : [{ source: entry.source }, { source: entry.source2 }, entry];
      this.renderImageEditor();
    }
  };

  this.useImages = () => {
    const sources = this.state.activeEntries,
          element = this.element;
    let callback = this.callback;

    if (!callback) {
      callback = this.updateImageProperties.bind(this, element);
    }

    // (1) call providing target element
    if (element !== null) {

      if (isArray(sources) && sources.length > 0) {
        let i = sources.length - 1;
        const source = sources[i];
        source.width = element.width;
        source.height = element.height;

        // delete source.x; delete source.y;
        while (i > 0) {
          this.createImageElement(source, element.x, element.y);
          i--;
        }
        sources[0].x = element.x;
        sources[0].y = element.y;
        sources[0].width = element.width;
        sources[0].height = element.height;
        callback(sources[0]);

        element.source = isArray(sources) ? sources[0].source : sources.source;
        element.id = this.element.id;

      }

      this._eventBus.fire('imageSelection.complete', { element: element });

    // (2) external call w/o canvas target
    } else {
      callback(sources);
    }

    this.activeEntries = [];
    this.removeModal();
  };

  this.binders = () => {
    const inputField = query('#pjs-image-selection-input'),
          submitButton = query('#pjs-image-selection-submit'),
          modal = query('#pjs-image-selection-modal'),
          imageSelectionInputGrabber = query('#pjs-image-selection-input-grabber'),
          imageUploadReader = query('#pjs-image-upload'),
          body = query('body');

    const canvasClickBinder = domEvent.bind(body, 'click', function(ev) {
      if (modal && mouseOutsideModal(ev, modal)) {
        this.removeModal();
      }
    }.bind(this));
    this.state.canvasClickBinder = canvasClickBinder;

    domEvent.bind(inputField, 'input', async function(event) {
      this.state.searchValue = inputField.value;

      if (this.state.pasted) {
        const text = inputField.value;

        let textIsImage = false;

        textIsImage = await isImage(text);

        if (textIsImage) {
          this.activateImage(convertToEntry({ type: POSTIT_IMAGE, source: text }));
        }

        this.state.pasted = false;
      }

      this.renderGrid();
    }.bind(this));

    // from url
    domEvent.bind(inputField, 'paste', function(event) {
      this.state.pasted = true;
    }.bind(this));

    domEvent.bind(inputField, 'keyup', function(event) {
      if (event.keyCode === 13) {
        event.preventDefault();

        // (1) active first image
        if (this.state.activeEntries.length == 0 && this.state.currentScope.length > 0) {
          this.activateImage(this.state.currentScope[0]);
        }

        // (2) use activated images
        else {
          submitButton.click();
        }
      }
    }.bind(this));

    domEvent.bind(submitButton, 'click', function(event) {
      this.useImages();
    }.bind(this));

    domEvent.bind(imageSelectionInputGrabber, 'click', function(event) {

      if (!this.state.stackedEditor) {
        this.state.stackedEditor = new Array(3);
      }

      // top image
      this.state.stackedEditor[1] = convertToEntry({ type: POSTIT_IMAGE, source: this.state.searchValue });

      this.addStacked();
      this.renderImageEditor();
      this.renderGrid();

    }.bind(this), false);

    // local file dialog
    domEvent.bind(imageUploadReader, 'change', async function() {

      let uploadDisplayText, entries = [];

      let uploadResultObj = await fileReader(null, imageUploadReader.files),
          uploadResult = uploadResultObj.results,
          errors = uploadResultObj.errors;

      if (!errors) {
        let uploadedFilesCount = (uploadResult.length) ? uploadResult.length : null;
        uploadDisplayText = uploadedFilesCount || text['No'] ;

        if (isNaN(uploadedFilesCount) === false) {

          const filePluralText = (uploadResult.length == 1) ? text['file'] : text['files'];
          uploadDisplayText += ' ' + filePluralText + ' ' + text['selected'];

          entries = uploadResult.map(src => convertToEntry({ type: POSTIT_IMAGE, source: src }));
        }

        entries.forEach(entry => this.activateImage(entry));

      } else {
        console.log(uploadDisplayText);

        // display error
      }
    }.bind(this));
  };

  this.addStacked = (el) => {
    if (this.state.stackedEditor[0] && this.state.stackedEditor[1]
      && this.state.stackedEditor[0].source && this.state.stackedEditor[1].source
    ) {
      this.state.stackedEditor[2] = convertToEntry({ type: POSTIT_IMAGE, source: this.state.stackedEditor[0].source, source2: this.state.stackedEditor[1].source });
      this.state.uploadedEntries.unshift(this.state.stackedEditor[2]);
    }
  };

  this.isActive = (b) => {
    return this.state.activeEntries.find(a => b && b.id && a.id === b.id);
  };

  this.isTarget = (a) => {
    return this.state.targetIsStacked
     && this.state.activeEntries.length > 0
     && this.state.activeEntries[0].id === a.id;
  };


}


/**
 * { Select new image for element, and upload/create new image elements }
 *
 * @param      {Object|null}  element           Primary target element to have its source changed (Type: Entry or Canvas element)
 * @param      {Function}     callback          Callback receives selected entries (including sources).
 * @param      {Boolean}      singleUploadOnly  If activated only target element can be changed, no further uploads.
 */
ImageSelection.prototype.select = function(element, callback, singleUploadOnly = false) {

  this.removeModal();

  this.platformEntries = ENTRIES.map(entry => convertToEntry(entry));
  this.state.activeEntries = this.getCanvasEntries().filter(el => el.id == element.id
                                                                  && isDefined(element.source));

  this.element = element;
  this.callback = callback;

  this.renderModal();
  this.renderGrid();

  const inputField = query('#pjs-image-selection-input');
  inputField.focus();

  this.binders();

};


ImageSelection.prototype._getParentContainer = function() {
  return this._canvas.getContainer();
};


ImageSelection.prototype.$inject = [
  'canvas',
  'eventBus',
  'modeling',
  'translate',
  'elementFactory',
];
