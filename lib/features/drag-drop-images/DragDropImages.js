import {
  domify,
  event as domEvent
} from 'min-dom';

import {
  assign
} from 'min-dash';

import {
  fileReader
} from './FileUtil.js';

var text;
export default function DragDropImages(eventBus, canvas, modeling, elementFactory, create, translate) {

  this._eventBus = eventBus;
  this._canvas = canvas;
  this._modeling = modeling;
  this._elementFactory = elementFactory;
  this._create = create;
  this._translate = translate;

  text = { 'URL': this._translate('URL'),
    'An error occured during the file upload': this._translate('An error occured during the file upload'),
    'Upload files here': this._translate('Upload files here'),
    'Upload from local is for demo purposes only. It slows down the page and increases the file size.': this._translate('Upload from local is for demo purposes only. It slows down the page and increases the file size.'),
    'uploaded': this._translate('uploaded'),
    'file': this._translate('file'),
    'files': this._translate('files'),
    'selected': this._translate('selected'),
    'Upload again': this._translate('Upload again'),
    'Drag here': this._translate('Drag here'),
  };

  DragDropImages.CSS = `
    .pjs-visible {
      visibility: visible !important;
      display: block !important;
    }
    
    #pjs-drop-zone {
      visibility: hidden;
      position: absolute;
      width: 100%;
      height: 100%;
      background-color: #555555;
      z-index: 1;
      opacity: 0.9;
    }

    #pjs-drop-zone-border {
      border-radius: 10px 10px 10px 10px;
      -moz-border-radius: 10px 10px 10px 10px;
      -webkit-border-radius: 10px 10px 10px 10px;
      border: 5px dashed #000000;
      z-index: 2;
      display: table;
      width: 98.9%;
      height: 100%; 
    }

    .pjs-drop-zone-text {
      vertical-align: middle;
      width: 100%;
      font-size: 25px;
      font-weight: bold;
      margin: 0 auto;
      text-align: center;
      display: table-cell;
  }`;

  DragDropImages.HTML_MARKUP = '<div id="pjs-drop-zone">'+
        '<div id="pjs-drop-zone-border">'+
          '<div class="pjs-drop-zone-text">'+
          text['Drag here']+
        '</div>'+
      '</div>'+
  '</div>';

  var style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = DragDropImages.CSS;
  document.getElementsByTagName('HEAD')[0].appendChild(style);

  const canvasDOM = document.getElementById('canvas');

  const container = this._container = domify(DragDropImages.HTML_MARKUP);
  canvasDOM.insertBefore(container, canvas.firstChild);

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  domEvent.bind(canvasDOM, 'drag', function(ev) {
  }, false);
  domEvent.bind(canvasDOM, 'dragstart', function(ev) {
  }, false);
  domEvent.bind(canvasDOM, 'dragend', function(ev) {
  }, false);
  domEvent.bind(canvasDOM, 'dragover', function(ev) {
    preventDefaults(ev);
  }, false);
  domEvent.bind(canvasDOM, 'dragenter', function(ev) {
    document.getElementById('pjs-drop-zone').classList.toggle('pjs-visible');
  }, false);
  domEvent.bind(canvasDOM,'dragleave', function(ev) {
    document.getElementById('pjs-drop-zone').classList.toggle('pjs-visible');
  }, false);
  domEvent.bind(canvasDOM, 'drop', async function(ev) {
    preventDefaults(ev);
    document.getElementById('pjs-drop-zone').classList.toggle('pjs-visible');
    uploadFiles(ev);
  }, false);


  async function uploadFiles(ev) {
    let uploadDisplayText;
    let uploadResultObj = await fileReader(ev, null);
    let uploadResult = uploadResultObj.results;
    let errors = uploadResultObj.errors;
    if (!errors) {
      let uploadedFilesCount = (uploadResult.length) ? uploadResult.length : null;
      uploadDisplayText = uploadedFilesCount;
      if (isNaN(uploadedFilesCount) === false) {
        const filePluralText =+ (uploadResult.length == 1) ? text['file'] : text['files'];
        uploadDisplayText += ' ' + filePluralText + ' ' + text['uploaded'];
      }
      for (const f in uploadResult) {
        createImage(ev, uploadResult[f]);
      }
      console.log(uploadDisplayText);

      // topModal.displaySuccessModal(uploadDisplayText);
    } else {

      // topModal.displayErrorModal(text['An error occured during the file upload']);
    }
  }


  function createImage(event, src) {
    var shape = elementFactory.createShape({
      type: 'postit:Image',
      source: src
    });

    const attach = false;
    const hints = { createElementsBehavior: false };
    const position = { x: event.x + Math.random() * 100, y: event.y + Math.random() * 100 };
    const target = canvas.getRootElement();
    modeling.createElements([shape], position, target, assign({}, hints, {
      attach: attach
    }));
  }

}

DragDropImages.prototype.$inject = [
  'eventBus',
  'canvas',
  'modeling',
  'elementFactory',
  'create',
  'translate'
];
