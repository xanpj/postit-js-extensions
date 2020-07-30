import PropertiesPanel from './PropertiesPanel';
import EntryFactoryModule from '../entry-factory';

export default {
  __depends__: [
    EntryFactoryModule
  ],
  __init__: [ 'propertiesPanel' ],
  propertiesPanel: [ 'type', PropertiesPanel ]
};
