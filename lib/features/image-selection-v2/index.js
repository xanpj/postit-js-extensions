import ImageSelection from './ImageSelection';
import EntryFactoryModule from '../entry-factory';

export default {
  __depends__: [
    EntryFactoryModule
  ],
  __init__: [ 'imageSelection' ],
  imageSelection: [ 'type', ImageSelection ]
};
