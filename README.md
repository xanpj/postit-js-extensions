# postit-js-extensions
A collection of extensions for [**diagram-js**](https://github.com/bpmn-io/diagram-js) based projects such as [**postit-js**](https://github.com/pinussilvestrus/postit-js).

## Installation

Drag the folders of your chosen modules from this `lib/features/` directory into your project's `lib/features/` folder.
Your project needs to be a [**diagram-js**](https://github.com/bpmn-io/diagram-js) based projects i.e. [**bpmn-js**](https://github.com/bpmn-io/bpmn-js), [**postit-js**](https://github.com/pinussilvestrus/postit-js) etc.

Import the modules in your modeler.js (or the place where you add your modules)

````
import SelectionOrganizerModule from './features/selection-organizer';
import DragDropImagesModule from './features/drag-drop-images';
````
and add them as additionalModules

```
Modeler.prototype._modelingModules = [
  ...
  SelectionOrganizerModule,
  DragDropImagesModule
];

```

## Modules
### Drag-Drop-Images
<div style="width:200px">![drag-drop-images-1](./docs/drag-drop-images-1.png)</div>

<div style="width:200px">![drag-drop-images-2](./docs/drag-drop-images-2.png)</div>

### Selection-Organizer
<div style="width:200px">![selection-organizer-1](./docs/selection-organizer-1.png)</div>

<div style="width:200px">![selection-organizer-2](./docs/selection-organizer-2.png)</div>
