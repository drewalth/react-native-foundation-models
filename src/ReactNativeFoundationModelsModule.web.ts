import { registerWebModule, NativeModule } from 'expo';

import { ReactNativeFoundationModelsModuleEvents } from './ReactNativeFoundationModels.types';

class ReactNativeFoundationModelsModule extends NativeModule<ReactNativeFoundationModelsModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ReactNativeFoundationModelsModule, 'ReactNativeFoundationModelsModule');
