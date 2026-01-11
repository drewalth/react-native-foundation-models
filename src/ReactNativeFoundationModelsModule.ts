import { NativeModule, requireNativeModule } from 'expo';

import { ReactNativeFoundationModelsModuleEvents } from './ReactNativeFoundationModels.types';

declare class ReactNativeFoundationModelsModule extends NativeModule<ReactNativeFoundationModelsModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ReactNativeFoundationModelsModule>('ReactNativeFoundationModels');
