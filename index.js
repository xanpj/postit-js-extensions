import DragDropImagesModule from './lib/features/drag-drop-images';

import SelectionOrganizerModule from './lib/features/selection-organizer';

import PropertiesPanelModule from './lib/features/properties-panel-v2';

import ImageSelectionV2Module from './lib/features/image-selection-v2';

export default {
  __depends__: [
    DragDropImagesModule,
    SelectionOrganizerModule,
    PropertiesPanelModule,
    ImageSelectionV2Module,
  ],
  DragDropImages: DragDropImagesModule,
  SelectionOrganizer: SelectionOrganizerModule,
  PropertiesPanel: PropertiesPanelModule,
  ImageSelectionV2: ImageSelectionV2Module,
};

