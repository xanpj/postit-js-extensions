import {
  domify,
  query,
  event as domEvent
} from 'min-dom';

/* CONFIG */

const POSTIT_GROUP = 'postit:Group';
const POSTIT_GROUP_CONTENT = ['postit:Image', 'postit:SquarePostit', 'postit:CirclePostit'];
const PADDING_V = 30;
const PADDING_H = 30;
const MAX_GROUP_WIDTH = 0;

export default function SelectionOrganizer(canvas, elementRegistry, eventBus, modeling, selection, keyboard) {

  this._canvas = canvas;
  this._elementRegistry = elementRegistry;
  this._eventBus = eventBus;
  this._modeling = modeling;
  this._selection = selection;
  this.lastSelection = [];

  var self = this;

  SelectionOrganizer.TOP_RIGHT_BUTTONS = `<div class="io-editing-tools pjs-buttons">
    <ul class="pjs-horizontal">
    </ul>
  </div>`;

  SelectionOrganizer.HTML_MARKUP = `<li>
      <button id="js-toggle-grid-align" disabled class="pjs-buttons-active" title="Grid-align selected elements in a group">
        <span class="icon-grid-align"></span>
      </button>
    </li>`;

  SelectionOrganizer.TOP_RIGHT_BUTTONS_CSS = `
    .io-editing-tools {
      display: block;
      position:fixed;
      top:0px;
      right: 80px;
      list-style: none;
      padding: 5px;
      margin: 0;
    }

    .pjs-horizontal, .pjs-horizontal li {
        display: inline-block;
    }

    .io-editing-tools button:hover {
        color: #333333;
    }

    .io-editing-tools button {
      color: #555555;
    }
  `;

  SelectionOrganizer.CSS = `
  .icon-grid-align::before  {
    content: '\\f009';
    display: inline-block;
    font-size: 18px;
    font-family: "Font Awesome 5 Free Solid";
    font-style: normal;
    font-weight: normal;
    speak: none;
    display: inline-block;
    text-decoration: inherit;
    text-align: center;
    font-variant: normal;
    text-transform: none;
    line-height: 1.2em;
  }
  
  .io-editing-tools button span.icon-grid-align {
    opacity: 1.0;
  }

  .io-editing-tools button:disabled,
  #io-editing-tools-buttons button:disabled {
    opacity: 0.3 !important;
  }

  `;

  /** adding ui **/

  const style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = SelectionOrganizer.CSS;
  const documentHead = document.getElementsByTagName('HEAD')[0];
  documentHead.appendChild(style);

  const canvasDOM = document.getElementById('canvas');
  let topRightButtons = query('#io-editing-tools-buttons ul.pjs-horizontal');
  if (!topRightButtons) {
    const containerStyle = document.createElement('style');
    containerStyle.type = 'text/css';
    containerStyle.innerHTML = SelectionOrganizer.CSS;
    containerStyle.innerHTML = SelectionOrganizer.TOP_RIGHT_BUTTONS_CSS;
    documentHead.appendChild(containerStyle);
    const topRightButtonsDOM = domify(SelectionOrganizer.TOP_RIGHT_BUTTONS);
    document.getElementsByTagName('body')[0].insertBefore(topRightButtonsDOM, canvasDOM.nextSibling);
    topRightButtons = query('div.io-editing-tools.pjs-buttons ul.pjs-horizontal');
  }
  const gridAlignButtonDOM = domify(SelectionOrganizer.HTML_MARKUP);
  topRightButtons.insertBefore(gridAlignButtonDOM, topRightButtons.firstChild.nextSibling);
  const gridAlignButton = query('li button#js-toggle-grid-align');

  /** catching selection events **/

  /* CMD + A */

  keyboard.addListener(function(context) {
    var event = context.keyEvent;
    if (keyboard.isKey(['a', 'A'], event) && keyboard.isCmd(event)) {
      const rootElement = self._canvas.getRootElement();
      const selectedElements = self._elementRegistry.filter(function(element) {
        return element !== rootElement;
      });
      if (containGroup(selectedElements)) {
        activateGridAlignButton(selectedElements);
      }
    }
  });

  /* CMD Click */

  eventBus.on('element.click', function(event) {
    if (event && event.element) {
      const selectedElements = self._selection._selectedElements;
      if (containGroup(selectedElements)) {
        activateGridAlignButton(selectedElements);
      }
    }
  });

  /* Lasso Selection */

  eventBus.on('lasso.end', function(event) {
    if (event && event.hover && event.hover.children.length > 0) {
      const selectedElements = self._selection._selectedElements;
      if (containGroup(selectedElements)) {
        activateGridAlignButton(selectedElements);
      }
    }
  });

  /** event handlers for gridAlignButton **/

  domEvent.bind(canvasDOM, 'click', function() {
    const selectedElements = self._selection._selectedElements;
    if (selectedElements && selectedElements.length == 0) {
      deactivateGridAlignButton();
    }
  });

  domEvent.bind(gridAlignButton, 'click', executeGridAlign, false);

  /** ui helpers **/

  function executeGridAlign() {
    self.trigger(self.lastSelection);
    gridAlignButton.disabled = true;
  }


  function activateGridAlignButton(elements) {
    self.lastSelection = elements;
    gridAlignButton.disabled = false;
  }

  function deactivateGridAlignButton() {
    self.lastSelection = [];
    gridAlignButton.disabled = true;
  }

}

SelectionOrganizer.prototype.trigger = function(elements) {
  if (elements && elements.length > 0) {
    gridDistribute(this, elements);
  }
};

function gridDistribute(self, elements) {
  const g = [], s = [], groups = [], groupElements = [];

  /* find groups */

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type == POSTIT_GROUP) {
      groupElements.push(el);
      g.push({
        gx: el.x,
        gy: el.y,
        gw: el.width,
        gh: el.height
      });
    }
  }

  /* put element in the smallest, enclosing group */

  let iOffset = 0;
  for (let i = 0; i < elements.length;i++) {
    const el = elements[i];
    if (POSTIT_GROUP_CONTENT.includes(el.type)) {
      s.push({
        sx: el.x,
        sy: el.y,
        sw: el.width,
        sh: el.height
      });

      let potentialGroup = { id: -1, size: 0 };
      for (let j = 0; j < g.length; j++) {
        if (!groups[j]) {
          groups[j] = [];
        }
        if (inGroup(g[j], s[i+iOffset])) {
          const size = g[j].gw * g[j].gh;

          // put ambigous element in the smaller sized group

          if (potentialGroup.size == 0 || potentialGroup.size > size) {
            potentialGroup = { id: j, size };
          }
        }
      }
      if (potentialGroup.id > -1) {
        groups[potentialGroup.id].push(el);
      }
    } else {
      iOffset--;
    }

  }

  /* grid align elements */

  let f = {};
  for (let i = 0; i < groups.length; i++) {
    f.x = g[i].gx;
    f.y = g[i].gy;
    let newGroupWidth = g[i].gw;
    let contentWidth = 0, contentWidthMax = 0, contentHeight = 0, contentHeightLastElement = 0, row = 0;
    let paddingI = 0;
    for (let j = 0; j < groups[i].length; j++) {
      const el = groups[i][j];
      const paddedWidth = contentWidth + PADDING_H * (1 + paddingI);
      newGroupWidth = paddedWidth + el.width + PADDING_H;
      let newX = f.x + paddedWidth;
      let newY = f.y + contentHeight + PADDING_V * (row + 1);
      if (newGroupWidth >= contentWidthMax) {
        contentWidthMax = newGroupWidth;
      }
      if ((MAX_GROUP_WIDTH && (newGroupWidth > MAX_GROUP_WIDTH))
      || (!MAX_GROUP_WIDTH && (newGroupWidth > g[i].gw))) {
        contentHeight += contentHeightLastElement;
        row += 1;
        newX = f.x + PADDING_H;
        newY = f.y + contentHeight + PADDING_V * (row + 1);
        contentHeightLastElement = el.height;
        contentWidthMax = paddedWidth;
        contentWidth = 0;
        paddingI = 0;
      } else if (Number(j) == 0) {
        contentHeightLastElement = el.height;
        contentWidthMax = newGroupWidth;
      }
      self._modeling.moveElements([ el ], { x: newX - el.x, y: newY - el.y });
      contentWidth += el.width;
      paddingI += 1;
    }

    /* wrap group */

    if (groups[i].length > 0) {
      const groupEl = groupElements[i];
      const newWidth = contentWidthMax;
      const newHeight = contentHeight + contentHeightLastElement + PADDING_V * (row + 2);
      self._modeling.resizeShape(groupEl , { x: g[i].gx, y: g[i].gy, width: newWidth, height: newHeight });
    }
  }
}

/* helpers */

function containGroup(elements) {
  if (elements && elements.length >= 2) {
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].type == POSTIT_GROUP)
        return true;
    }
  }
}

function inGroup(g, s) {
  const { gx, gy, gw, gh } = g;
  const { sx, sy, sw, sh } = s;
  return (sx > gx && sx+sw < gx+gw
    && sy+sh < gy+gh && sy > gy);
}

SelectionOrganizer.prototype.$inject = [
  'canvas',
  'elementRegistry',
  'eventBus',
  'modeling',
  'selection',
  'keyboard'
];