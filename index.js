import DragDropImagesModule from './lib/features/drag-drop-images';

import SelectionOrganizerModule from './lib/features/selection-organizer';

export default {
  __depends__: [
    DragDropImagesModule,
    SelectionOrganizerModule,
  ],
  DragDropImages: DragDropImagesModule,
  SelectionOrganizer: SelectionOrganizerModule,
};
