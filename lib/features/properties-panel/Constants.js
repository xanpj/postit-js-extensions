/** * CONFIGURATION ***/
export const DEBUG = false; // true for default panel maxed

export const DROPDOWN_ENABLED = false; // needs further implementation to be useful
export const UNKEY_ENABLED = false; // needs further implementation to be useful
export const HISTORY_INTERGRATES_PANEL_HISTORY = true; // panel tracks history independent of canvas.

// custom panel sections <section_name>
export const ADD_LIST_NAMES = [
];

// titles for custom panel sections: <section_name: section_title>
export const ADD_LIST_TITLES = {
};

export const THUMBNAIL = {
  WIDTH: 60,
  HEIGHT: 60
};

export const CANVAS_OFFSET_X = 300;
export const HISTORY_MAX = 100;

/** * #CONFIGURATION ***/

export const PLATFORM_ENTRIES = 'platformEntries',
      CANVAS_ENTRIES = 'canvasEntries';

export const POSTIT_IMAGE = 'postit:Image';
export const POSTIT_TYPES = [POSTIT_IMAGE, 'postit:Group', 'postit:SquarePostit', 'postit:CirclePostit', 'postit:TextBox'];


export const ENTRY_PROTOTYPE = () => {
  return {
    id: randStr(),
    objId: randStr(),
    objType: POSTIT_IMAGE,
    objTitle: '',
    objDescription: '',
    objStarred: false,
    objHidden: false,
    objUnkeyed: false,
    objUnkeyedOriginal: false,
    objSrcUnkeyed: '',
    objCreationDate: '',
    source: '',
    objPositionX: null,
    objPositionY: null,
  };
};

export function randStr(length=5) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}


export function objectPropertiesDefined(obj) {
  for (var key of Object.keys(obj)) {
    if (obj[key] === undefined) {
      return false;
    }
  }
  return true;
}


Array.prototype.remove = function(el) {
  const i = this.indexOf(el);
  if (i > -1) {
    this.splice(i, 1);
  }
};

Array.prototype.min = function(arr) {
  return Math.min.apply(Math, arr);
};

Array.prototype.has = function(el) {
  return this.indexOf(el) > -1;
};

Array.prototype.pushIfNotExists = function(el) {
  if (this.indexOf(el) === -1) {
    return this.push(el);
  }
};

Array.prototype.has = function(el) {
  return this.indexOf(el) > -1;
};
