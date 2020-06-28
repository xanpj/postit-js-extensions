import DragDropImagesModule from './lib/features/drag-drop-images';

import SelectionOrganizerModule from './lib/features/selection-organizer';

import PropertiesPanelModule from './lib/features/properties-panel';

export default {
  __depends__: [
    DragDropImagesModule,
    SelectionOrganizerModule,
    PropertiesPanelModule,
  ],
  DragDropImages: DragDropImagesModule,
  SelectionOrganizer: SelectionOrganizerModule,
  PropertiesPanel: PropertiesPanelModule,
};
